import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function loadFunction(path, name, globals) {
  const text = readFileSync(new URL(path, import.meta.url), "utf8");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn, `${name} must exist`);
  const code = ts.transpileModule(fn.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(`${code}; ${name}`, { AbortSignal, URLSearchParams, ...globals });
}

test("partial underlying history reaches a scoped non-blocking chart notice", () => {
  const route = readFileSync(new URL("../src/app/api/market-indices/route.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(route, /historyCoverage: candles.historyCoverage/);
  assert.match(workspace, /historyCoverage: payload.historyCoverage/);
  assert.match(workspace, /setHistoryCoverageWarning\(historyCoverage\?\.partial/);
  assert.match(workspace, /Showing available history only/);
  assert.match(workspace, /!chartIsLoading && historyCoverageWarning\?\.key/);
});

test("real candle loader returns while optional flow and browser persistence remain blocked", async () => {
  const candle = { timestamp: 1000, open: 100, high: 102, low: 98, close: 101, volume: 20 };
  const never = new Promise(() => {});
  let optionalRequests = 0;
  const tapes = new Map();
  const load = loadFunction("../src/components/KwantifyWorkspace.tsx", "fetchWorkspaceCandles", {
    getPeriodConfig: () => ({ from: "2026-10-12" }),
    FALLBACK_CTRADER_BROKER_NAMES: [], OANDA_INSTRUMENT_MAP: {}, OANDA_GRANULARITY_MAP: {},
    getHistoricalCandleLimit: () => 10000, DEFAULT_CHART_HISTORY_CALENDAR_DAYS: 10,
    workspaceCandleRequests: new Map(), isEventBasedChartInterval: () => false,
    fetchWorkspaceOrderFlow: () => { optionalRequests++; return never; },
    fetchJsonWithBudget: async () => ({ response: { ok: true }, payload: { candles: [candle], executions: [] } }),
    sanitizeCandles: rows => rows, decodeExecutionTape: rows => rows,
    mergeInstitutionalTradeTape: (a, b) => [...a, ...b],
    workspaceExecutionTape: tapes, workspaceOrderFlowKey: () => "NQ:1m",
    storeWorkspaceExecutionTape: (key, rows) => tapes.set(key, rows),
    writeChartHistoryCache: () => never, writeExecutionTapeCache: () => never,
  });
  const result = await Promise.race([
    load("NQ.c.0", "1m", "Databento", "1W", 500, true),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Candle readiness waited on optional work")), 200)),
  ]);
  assert.equal(result[0], candle);
  assert.equal(optionalRequests, 0);
  assert.equal(result[0].delta, undefined, "Missing flow must not become fabricated zero delta");
});

test("underlying history uses one bounded archive request and rejects wrong symbols or false OHLC", async () => {
  const requests = [];
  let payload = { symbol: "SPX", candles: [{ timestamp: 1000, open: 100, high: 102, low: 98, close: 101, volume: 20 }] };
  const load = loadFunction("../src/lib/quantData.server.ts", "getOptionsUnderlyingHistory", {
    underlyingHistoryPlan: () => ({ aggregationPeriod: "1m", sessionScoped: true }),
    isInstitutionalMarketDataConfigured: () => true,
    fetchInstitutionalMarketData: async path => { requests.push(path); return { ok: true, json: async () => payload }; },
    isRecord: value => value && typeof value === "object" && !Array.isArray(value),
    QuantDataError: Error,
  });
  const input = { symbol: "SPXW", timeframe: "1m", from: 0, to: 2000 };
  assert.equal((await load(input)).length, 1);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /index-history\?symbol=SPX&timeframe=1m&from=0&to=2000/);
  payload = { ...payload, symbol: "QQQ" };
  await assert.rejects(load(input), /invalid instrument/);
  payload = { symbol: "SPX", candles: [], truncated: true };
  await assert.rejects(load(input), /No underlying chart history/);
  payload = { symbol: "SPX", truncated: true, candles: [{ timestamp: 1000, open: 100, high: 102, low: 98, close: 101, volume: 20 }] };
  const partial = await load(input);
  assert.equal(partial.length, 1, "a bounded recent archive must not blank the whole chart");
  assert.equal(partial.historyCoverage.partial, true);
  assert.equal(partial.historyCoverage.requestedFrom, 0);
  assert.equal(partial.historyCoverage.availableFrom, 1000);
  payload = { symbol: "SPX", candles: [{ timestamp: 1000, open: 100, high: 99, low: 98, close: 101, volume: 20 }] };
  await assert.rejects(load(input), /geometry/);
});

test("closed futures sessions do not hold history behind a live-seam network request", async () => {
  const load = loadFunction("../src/components/KwantifyWorkspace.tsx", "fetchWorkspaceLiveSeam", {
    isEventBasedChartInterval: () => false,
    isCmeClosedSessionTimestamp: () => true,
    fetchInstitutionalSnapshot: () => { throw new Error("Closed session must not request a live seam"); },
  });
  assert.equal((await load("NQ.c.0", "1m", "NQZ6")).length, 0);
});

test("the actual timed history cache preserves valid OHLC when classified flow is unavailable", async () => {
  let candles = [{ timestamp: 1000, open: 100, high: 102, low: 98, close: 101, volume: 20 }];
  const load = loadFunction("../src/app/api/databento/market/route.ts", "getDurableTimeHistory", {
    unstable_cache: (fn) => fn,
    getDatabentoOrderFlowHistory: async () => ({ candles, executions: [] }),
    encodeHistory: value => value, decodeHistory: value => value,
    DURABLE_TIME_HISTORY_REVALIDATE_SECONDS: 12,
  });
  const result = await load("NQ.c.0", "1m", 10, "2026-10-12", "2026-10-17");
  assert.equal(result.candles[0], candles[0]);
  assert.equal(result.candles[0].delta, undefined);
  candles = [];
  await assert.rejects(load("NQ.c.0", "1m", 10, "2026-10-12", "2026-10-17"), /no candles/);
});
