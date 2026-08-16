import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildGexCalMatrix } from "../src/lib/gexCalendar.ts";

const bucket = (timestamp, rows, sourcePrice = 5000) => ({ timestamp, sourcePrice, rows });
const row = (expirationDate, sourceStrike, callExposure, putExposure) => ({ expirationDate, sourceStrike, callExposure, putExposure });
const surface = {
  schemaVersion: 1,
  provider: "quantdata",
  representation: "provider-signed-exposure",
  sourceTicker: "SPX",
  sessionDate: "2026-08-14",
  marketOpen: false,
  status: "HISTORICAL",
  checkedAt: "2026-08-14T20:00:00.000Z",
  refreshAfterMs: 60_000,
  aggregationPeriod: "1m",
  buckets: [
    bucket(1_000, [row("2026-08-14", 5000, 10, -5), row("2026-08-21", 5050, 0, 0)]),
    bucket(2_000, [row("2026-08-14", 5000, 20, -7), row("2026-08-21", 5050, -80, 5)]),
    bucket(3_000, [row("2026-08-14", 5000, 999, 999)]),
  ],
  limitations: [],
};

const replay = buildGexCalMatrix({ surface, asOfTimestamp: 2_500, side: "NET" });
assert.equal(replay.selectedTimestamp, 2_000, "replay must not select a future bucket");
assert.equal(replay.cells.find((cell) => cell.strike === 5000)?.value, 13);
assert.equal(replay.cells.find((cell) => cell.strike === 5000)?.change, 8);
assert.equal(replay.globalKing?.strike, 5050, "King uses maximum absolute raw value");
assert.equal(replay.cells.find((cell) => cell.strike === 5050)?.value, -75, "negative signs are preserved");
assert.equal(replay.cells.find((cell) => cell.strike === 5050)?.previousValue, 0, "zero is distinct from missing");

const currentOnly = buildGexCalMatrix({ surface: { ...surface, buckets: [surface.buckets[0]] }, side: "NET" });
assert.equal(currentOnly.cells[0].previousValue, null, "missing baseline remains missing");

const largeRows = [];
for (let expiry = 0; expiry < 120; expiry += 1) {
  const expirationDate = new Date(Date.UTC(2026, 7, 14 + expiry)).toISOString().slice(0, 10);
  for (let strike = 0; strike < 500; strike += 1) largeRows.push(row(expirationDate, 4500 + strike * 5, strike - 200, expiry - 60));
}
const started = performance.now();
const large = buildGexCalMatrix({ surface: { ...surface, buckets: [bucket(4_000, largeRows)] }, side: "NET" });
const elapsed = performance.now() - started;
assert.equal(large.cells.length, 60_000);
assert.ok(elapsed < 2_500, `60k matrix normalization took ${elapsed.toFixed(1)}ms`);
console.log(`GEX CAL deterministic tests passed · 60,000 cells in ${elapsed.toFixed(1)}ms`);
