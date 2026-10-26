import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { bigContractHistoryWindows, mergeBigContractHistory, distributeContractMarkers } from "../src/lib/bigContractHistory.ts";
import { mergeInstitutionalTradeTape } from "../src/lib/liveExecutionTape.ts";
import { calculateBigTradePrints } from "../src/lib/bigTrades.ts";

const DAY = 86_400_000;
const trade = (timestamp, index, overrides = {}) => ({ timestamp, recordIndex: index, eventId: `live-${index}`, close: 100, volume: 50, delta: 50, aggressor: "BUY", ...overrides });

for (const days of [1, 2, 5, 30]) {
  test(`${days} days requests the entire selected window in bounded daily slices`, () => {
    const end = 40 * DAY;
    const windows = bigContractHistoryWindows(days, end);
    assert.equal(windows.length, days);
    assert.equal(windows[0].fromMs, end - days * DAY);
    assert.equal(windows.at(-1).toMs, end);
    for (let i = 1; i < windows.length; i++) assert.equal(windows[i].fromMs, windows[i - 1].toMs);
    assert.ok(windows.every((range) => range.toMs - range.fromMs === DAY));
  });
}

test("archived markers survive the dense live tape's record ceiling", () => {
  const archived = [trade(DAY, 1), trade(2 * DAY, 2)];
  const live = mergeInstitutionalTradeTape([], Array.from({ length: 70_000 }, (_, i) => trade(3 * DAY + i, i + 100)));
  assert.ok(live.length < 70_000);
  const merged = mergeBigContractHistory(archived, live);
  assert.equal(merged[0].timestamp, DAY);
  assert.equal(merged[1].timestamp, 2 * DAY);
});

test("overlapping live/archive IDs do not double an execution or erase genuine identical prints", () => {
  const archived = [trade(DAY, 1, { eventId: "archive-1" }), trade(DAY, 2, { eventId: "archive-2" })];
  const live = [trade(DAY, 3), trade(DAY, 4), trade(DAY, 5), trade(DAY + 1, 6, { flowOnly: true })];
  assert.equal(mergeBigContractHistory(archived, live).length, 3);
});

test("the actual Big Contracts calculator retains 23-hour and 47-hour historical orders for the selected days", () => {
  const now = Date.UTC(2026, 9, 22, 20);
  const tape = mergeBigContractHistory([trade(now - 47 * 3_600_000, 1), trade(now - 23 * 3_600_000, 2)], [trade(now, 3)]);
  const settings = { filterMode: "manual", manualFilter: 1, enableClustering: false };
  assert.equal(calculateBigTradePrints([], tape, { ...settings, daysToLoad: 1 }, now).length, 2);
  assert.equal(calculateBigTradePrints([], tape, { ...settings, daysToLoad: 2 }, now).length, 3);
});

test("drawing limits retain the full day instead of just the latest few hours", () => {
  const now = Date.UTC(2026, 9, 22, 20);
  const tape = Array.from({ length: 20_000 }, (_, i) => trade(now - DAY + 1 + i * 4_320, i));
  const prints = calculateBigTradePrints([], tape, { filterMode: "manual", manualFilter: 1, enableClustering: false, daysToLoad: 1 }, now);
  assert.ok(prints.length <= 12_000);
  assert.ok(prints[0].timestamp < now - 23 * 3_600_000);
  assert.ok(prints.at(-1).timestamp > now - 60_000);
  const reduced = distributeContractMarkers(tape, 100);
  assert.equal(reduced.length, 100);
  assert.ok(reduced[0].timestamp < now - 23 * 3_600_000);
});

test("settings changes restart hydration and sparse candidates stay isolated from other studies/replay", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(workspace, /\[bigContractDays, pane.broker, pane.symbol, pane.timeframe, period, replayHistoryRange\]/);
  assert.match(workspace, /if \(cancelled\) return;\s+batches\[index\]/);
  assert.match(workspace, /bigContractHistory=\{replayHistoryRange \|\| bigContractHistory.symbol !== pane.symbol \? undefined/);
  assert.equal((chart.match(/mergeBigContractHistory\(replayTimestampMs == null \? bigContractHistory : \[\], indicatorMarketTrades\)/g) ?? []).length, 2);
});
