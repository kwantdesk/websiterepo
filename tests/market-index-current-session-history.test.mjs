import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/api/market-indices/route.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const now = Date.parse("2026-11-16T17:00:00Z");
const yesterday = Date.parse("2026-11-13T20:00:00Z");

function historyRoute(result) {
  const calls = [];
  const context = {
    exports: {}, URL, Date: class extends Date { static now() { return now; } },
    require(name) {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "@/lib/chartIntervals") return { supportsChartInterval: () => true };
      if (name === "@/lib/marketIndices") return { getMarketIndexDefinition: () => ({ providerKind: "INDEX" }) };
      if (name === "@/lib/conditionalJson") return { conditionalJson: (_, body) => Response.json(body) };
      if (name === "@/lib/quantData.server") return {
        getQuantDataHttpError: error => ({ status: error.status ?? 500, message: error.message }),
      };
      if (name === "@/lib/marketIndices.server") return {
        hasIntradayMarketIndexHistoryAccess: () => true,
        fetchMarketIndexCandles: async options => { calls.push(options); return result(); },
      };
      if (name === "@/lib/institutionalMarketData.server") return {
        isInstitutionalMarketDataConfigured: () => true,
        fetchInstitutionalMarketData: () => assert.fail("A second archive path would block chart paint"),
      };
      throw Error(name);
    },
  };
  vm.runInNewContext(outputText, context);
  return { calls, get: query => context.exports.GET(new Request("https://test.local/api/market-indices?" + query)) };
}

test("existing recorded candles return immediately even if the current session has no recording yet", async () => {
  const candles = Object.assign([{ timestamp: yesterday, open: 7000, high: 7001, low: 6999, close: 7000 }], {
    historyCoverage: { partial: true, availableTo: yesterday },
  });
  const route = historyRoute(() => candles);
  const response = await route.get("symbol=SPX&timeframe=1m");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.candles[0].timestamp, yesterday);
  assert.deepEqual(body.historyCoverage, candles.historyCoverage);
  assert.equal(route.calls.length, 1);
  assert.equal(route.calls[0].to, now, "default history must end at the current time");
});

test("empty recordings and transient archive failures remain distinct", async () => {
  const empty = historyRoute(() => { throw Object.assign(new Error("No candles recorded for this range."), { status: 422 }); });
  const failed = historyRoute(() => { throw new TypeError("Failed to fetch"); });
  assert.equal((await empty.get("symbol=SPX")).status, 422);
  const response = await failed.get("symbol=SPX");
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "Recorded chart history is temporarily unavailable.");
  assert.equal(failed.calls.length, 1);
});
