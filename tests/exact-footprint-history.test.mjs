import assert from "node:assert/strict";
import test from "node:test";
import { decodeExactFootprintHistory } from "../src/lib/exactFootprintHistory.ts";
import { buildFootprintBars } from "../src/lib/footprint.ts";

const t = Date.parse("2026-10-16T14:00:00Z");
const candle = { timestamp: t, open: 100, high: 101, low: 100, close: 100, volume: 9 };
const payload = { schemaVersion: "kwantdesk-exact-tape-window-v1", contractSymbol: "NQZ6",
  truncated: false, fromMs: t, toMs: t + 60000, sourceRecordCount: 4,
  records: [[t + 1, 100, 2, 1], [t + 1, 100, 2, 1], [t + 2, 101, 3, -1], [t + 3, 100, 2, 0]] };

test("exact footprint retains identical same-time prints and unknown volume", () => {
  const records = decodeExactFootprintHistory(payload, "NQZ6", [candle], t, t + 60000);
  assert.equal(records.length, 4);
  assert.equal(new Set(records.map(r => r.eventId)).size, 4);
  assert.equal(records[3].aggressor, "UNKNOWN");
  const bars = buildFootprintBars([candle], records, { tickSize: .25, groupTicks: 1,
    minimumTradeVolume: 0, maximumTradeVolume: 0, imbalanceMode: "diagonal",
    minimumImbalancePercent: 300, minimumDelta: 0, includeZero: true });
  assert.equal(bars[0].totalVolume, 9);
  assert.equal(bars[0].askVolume, 4);
  assert.equal(bars[0].bidVolume, 3);
  assert.equal(bars[0].unknownVolume, 2);
  assert.equal(bars[0].totalTrades, 4);
  assert.equal(bars[0].delta, 1);
  assert.equal(bars[0].pocPrice, 100);
});

test("sampled, wrong-contract, truncated, missing-volume and unordered tapes fail closed", () => {
  for (const patch of [{ truncated: true }, { contractSymbol: "ESZ6" }, { sourceRecordCount: 6 },
    { records: payload.records.slice(1), sourceRecordCount: 3 },
    { records: [...payload.records].reverse() }]) {
    assert.throws(() => decodeExactFootprintHistory({ ...payload, ...patch }, "NQZ6", [candle], t, t + 60000));
  }
  assert.throws(() => decodeExactFootprintHistory(payload, "NQZ6", [{ ...candle, volume: 100 }], t, t + 60000));
});
