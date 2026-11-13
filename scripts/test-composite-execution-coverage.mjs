import assert from "node:assert/strict";
import {
  applyInstitutionalTradesToVolumeProfile,
  fetchInstitutionalVolumeProfile,
  isExecutionBackedVolumeProfile,
} from "../src/lib/institutionalMarketData.ts";

const startMs = Date.parse("2026-11-12T15:00:00Z");
const endMs = startMs + 120_000;
const originalFetch = globalThis.fetch;
let gatewayCalls = 0;
try {
  for (const symbol of ["NQ", "ES", "MES", "MNQ", "CL", "GC", "6M", "UB"]) {
    const response = {
      schemaVersion: "kwantify-volume-profile-v1",
      provider: "Rithmic", source: "Rithmic Ticker Plant trades",
      root: symbol, contractSymbol: symbol + "Z6", period: "custom",
      complete: false, startMs, endMs,
      coverageStartMs: startMs + 60_000, coverageEndMs: endMs - 1,
      missingSessionDates: ["2026-11-11"],
      tickSize: 0.25, groupTicks: 1, valueAreaPercent: 70,
      minTradeVolume: 0, maxTradeVolume: 0, totalVolume: 3,
      askVolume: 3, bidVolume: 0, trades: 1, vwap: 100, standardDeviation: 0,
      developingPoc: [],
      levels: [{ price: 100, volume: 3, askVolume: 3, bidVolume: 0, delta: 3, trades: 1 }],
    };
    globalThis.fetch = async () => {
      gatewayCalls++;
      return Response.json(response);
    };
    const request = { symbol, period: "custom", startMs, endMs };
    assert.equal(isExecutionBackedVolumeProfile(response), false);
    assert.equal(isExecutionBackedVolumeProfile({ ...response, period: "weekly" }, true), false);
    assert.equal(isExecutionBackedVolumeProfile({ ...response, coverageEndMs: endMs }, true), false);
    assert.equal(isExecutionBackedVolumeProfile({ ...response, source: "OHLCV" }, true), false);
    assert.equal(await fetchInstitutionalVolumeProfile(request), null);
    const optedIn = { ...request, allowPartialComposite: true };
    const [first, second] = await Promise.all([
      fetchInstitutionalVolumeProfile(optedIn), fetchInstitutionalVolumeProfile(optedIn),
    ]);
    assert.equal(first, second);
    assert.equal(first?.root, symbol);
    assert.equal(first?.complete, false);
    assert.equal(first?.totalVolume, 3);
    assert.deepEqual(first?.missingSessionDates, response.missingSessionDates);
    assert(isExecutionBackedVolumeProfile(first, true));
    const trade = (timestamp) => ({ timestamp, close: 100.25, volume: 2, trades: 1, askVolume: 2, bidVolume: 0 });
    const prints = [trade(endMs + 42), trade(endMs - 1), trade(endMs + 17)];
    assert.equal(applyInstitutionalTradesToVolumeProfile(first, prints), first);
    const live = applyInstitutionalTradesToVolumeProfile({ ...first, followsLiveComposite: true }, prints);
    assert.equal(live.totalVolume, 7);
    assert.equal(live.coverageEndMs, endMs + 42);
    assert.equal(live.endMs, endMs + 43);
    assert.equal(live.complete, false);
  }
  assert.equal(gatewayCalls, 16, "Coalesce identical opted-in requests and isolate strict callers");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Partial Composite gateway, scope, replay boundary and execution reconciliation passed.");
