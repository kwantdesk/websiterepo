import assert from "node:assert/strict";
import test from "node:test";

import { calculateJournalAdvancedStats, parseJournalTextFile } from "../src/lib/journal.ts";

test("advanced journal metrics calculate daily quality and recovery", () => {
  const csv = [
    "Entry Time,Exit Time,Instrument,Direction,Contracts,Entry Price,Exit Price,Net P&L",
    "2026-08-10T01:31:00Z,2026-08-10T01:38:00Z,MNQ,Long,1,23000,23020,100",
    "2026-08-10T02:02:00Z,2026-08-10T02:09:00Z,MNQ,Short,1,23040,23025,50",
    "2026-08-11T01:31:00Z,2026-08-11T01:38:00Z,MNQ,Long,1,23000,22980,-100",
    "2026-08-12T01:31:00Z,2026-08-12T01:38:00Z,MNQ,Long,1,23000,23010,50",
  ].join("\n");
  const parsed = parseJournalTextFile("metrics.csv", csv, "Main", "metrics");

  const stats = calculateJournalAdvancedStats(parsed.trades);

  assert.equal(stats.tradedDays, 3);
  assert.equal(stats.winningDays, 2);
  assert.equal(stats.losingDays, 1);
  assert.equal(stats.winningDayRate, 2 / 3);
  assert.equal(stats.averageWinningDay, 100);
  assert.equal(stats.averageLosingDay, -100);
  assert.equal(stats.bestDay, 150);
  assert.equal(stats.worstDay, -100);
  assert.ok(Math.abs(stats.payoffRatio - (2 / 3)) < 1e-12);
  assert.equal(stats.recoveryFactor, 1);
});
