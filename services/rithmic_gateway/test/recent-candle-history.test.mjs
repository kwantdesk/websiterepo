import test from "node:test";
import assert from "node:assert/strict";
import { completedSessions, validatedMinute } from "../scripts/reconcile-recent-candle-history.mjs";

test("recent repair chooses completed Globex sessions and skips the live session/weekend", () => {
  assert.deepEqual(completedSessions(Date.parse("2026-10-26T06:00:00Z")),
    ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
});
test("provider close markers normalize once; impossible bars fail the replay", () => {
  assert.deepEqual(validatedMinute({ marker: 180, openPrice: 100, highPrice: 110, lowPrice: 90, closePrice: 104, volume: 5 }),
    [120000, 100, 110, 90, 104, 5]);
  assert.throws(() => validatedMinute({ marker: 180, openPrice: 100, highPrice: 99, lowPrice: 90, closePrice: 104, volume: 5 }), /Invalid provider minute/);
});
