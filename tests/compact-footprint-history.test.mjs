import assert from "node:assert/strict";
import test from "node:test";
import { createExactFootprintFold } from "../services/rithmic_gateway/src/exact-footprint-fold.mjs";
import { decodeCompactFootprintHistory, decodeAvailableCompactFootprintHistory } from "../src/lib/compactFootprintHistory.ts";
import { buildFootprintBars, buildFootprintBarsCached } from "../src/lib/footprint.ts";
const t = Date.parse("2026-10-16T14:00:00Z");
const prints = [[t + 1, 100, 2, 1], [t + 1, 100, 2, 1], [t + 2, 101, 5, -1],
  [t + 3, 100, 2, 0], [t + 4, 101, 3, 1], [t + 60001, 101, 3, -1], [t + 60002, 100, 2, 1]];
const candles = [{ timestamp: t, open: 100, high: 101, low: 100, close: 101, volume: 14 },
  { timestamp: t + 60000, open: 101, high: 101, low: 100, close: 100, volume: 5 }];
function compact(rows, candles, min = 0, max = 0) {
  const end = candles.at(-1).timestamp + 60000;
  const fold = createExactFootprintFold({ starts: candles.map(c => c.timestamp), toMs: end,
    minimumTradeVolume: min, maximumTradeVolume: max });
  for (const [timestamp, price, size, side] of rows) fold.add({ timestamp, price, size, side });
  const payload = { ...fold.result(), schemaVersion: "kwantdesk-exact-footprint-v1", contractSymbol: "NQZ6",
    fromMs: candles[0].timestamp, toMs: end, minimumTradeVolume: min, maximumTradeVolume: max };
  return { payload, records: decodeCompactFootprintHistory(payload, "NQZ6", candles, candles[0].timestamp, end, min, max) };
}
const raw = prints.map(([timestamp, price, volume, side], i) => ({ timestamp, open: price, high: price, low: price,
  close: price, volume, bidVolume: side < 0 ? volume : 0, askVolume: side > 0 ? volume : 0,
  delta: side * volume, trades: 1, recordIndex: i, eventId: `print:${i}`,
  aggressor: side > 0 ? "BUY" : side < 0 ? "SELL" : "UNKNOWN" }));

test("compact history exactly matches raw executions, filters, grouping, trade counts and delta wicks", () => {
  for (const [min, max] of [[0, 0], [2, 2], [3, 0]]) for (const inputType of ["volume", "num-trades"]) for (const groupTicks of [1, 4]) {
    const { records } = compact(prints, candles, min, max);
    const settings = { tickSize: .25, groupTicks, minimumTradeVolume: min, maximumTradeVolume: max,
      inputType, imbalanceMode: "diagonal", minimumImbalancePercent: 300, minimumDelta: 0, includeZero: true };
    assert.deepEqual(buildFootprintBars(candles, records, settings), buildFootprintBars(candles, raw, settings));
  }
});

test("normal views exceeding the raw 100k limit retain every execution in compact price levels", () => {
  const rows = Array.from({ length: 100001 }, (_, i) => [t + i / 10, 100, 1, i % 2 ? 1 : -1]);
  const { payload, records } = compact(rows, [{ timestamp: t, open: 100, high: 100, low: 100, close: 100, volume: rows.length }]);
  assert.equal(payload.sourceRecordCount, 100001);
  assert.equal(records.length, 2);
  assert.equal(records.reduce((sum, r) => sum + r.volume, 0), 100001);
  assert.equal(records.reduce((sum, r) => sum + r.trades, 0), 100001);
});

test("wrong contract, candle coverage and malformed totals fail closed", () => {
  const { payload } = compact(prints, candles);
  for (const patch of [{ contractSymbol: "MNQZ6" }, { sourceRecordCount: 1 }, { minimumTradeVolume: 4 },
    { bars: [{ ...payload.bars[0], volume: 15 }, payload.bars[1]] },
    { bars: [{ ...payload.bars[0], deltaHigh: -1 }, payload.bars[1]] }]) {
    assert.throws(() => decodeCompactFootprintHistory({ ...payload, ...patch }, "NQZ6", candles, t, t + 120000, 0, 0));
  }
});

test("initial exact history hydrates all closed bars immediately, not through the slow correction cursor", () => {
  const cache = { current: null };
  const settings = { tickSize: .25, groupTicks: 1, minimumTradeVolume: 0, maximumTradeVolume: 0,
    imbalanceMode: "diagonal", minimumImbalancePercent: 300, minimumDelta: 0, includeZero: true };
  const empty = buildFootprintBarsCached(cache, candles, [], settings);
  assert.equal(empty[0].totalVolume, 0);
  const { records } = compact(prints, candles);
  const loaded = buildFootprintBarsCached(cache, candles, records, settings);
  assert.equal(loaded[0].totalVolume, 14);
  assert.equal(loaded[1].totalVolume, 5);
});

test("an unrecorded edge cannot suppress verified neighbouring candles", () => {
  const {payload}=compact(prints,candles);
  const missing={timestamp:t,open:null,high:null,low:null,close:null,volume:0,delta:0,deltaHigh:0,deltaLow:0,levels:[]};
  const result=decodeAvailableCompactFootprintHistory({...payload,bars:[missing,payload.bars[1]]},"NQZ6",candles,t,t+120000,0,0);
  assert.deepEqual(result.missingTimestamps,[t]);
  const bars=buildFootprintBars(candles,result.records,{tickSize:.25,groupTicks:1,minimumTradeVolume:0,maximumTradeVolume:0,imbalanceMode:"diagonal",minimumImbalancePercent:300,minimumDelta:0,includeZero:true});
  assert.equal(bars[0].totalVolume,0);
  assert.equal(bars[1].totalVolume,5);
  assert.equal(bars[1].delta,-1);
});

test("partial decoding still rejects corrupt levels, totals and identity", () => {
  const {payload}=compact(prints,candles);
  for(const patch of [{contractSymbol:"ESZ6"},{bars:[{...payload.bars[0],delta:900},payload.bars[1]]},
    {bars:[{...payload.bars[0],levels:[[900,1,0,0,1,0,0]]},payload.bars[1]]}]) {
    assert.throws(()=>decodeAvailableCompactFootprintHistory({...payload,...patch},"NQZ6",candles,t,t+120000,0,0));
  }
});
