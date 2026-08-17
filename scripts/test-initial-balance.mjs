import assert from "node:assert/strict";
import { buildInitialBalanceLevels } from "../src/lib/marketSessions.ts";

const base = Date.parse("2026-01-05T14:30:00.000Z"); // 09:30 New York (EST)
const candle = (offsetMinutes, open, high, low, close) => ({
  timestamp: base + offsetMinutes * 60_000,
  open,
  high,
  low,
  close,
  volume: 100,
});

const candles = [
  candle(0, 100, 101, 99, 100.5),
  candle(5, 100.5, 102, 98, 101),
  candle(10, 101, 103, 100, 102),
  candle(15, 102, 110, 97, 109),
  candle(20, 109, 111, 96, 108),
  candle(75, 108, 112, 95, 111),
];

const settings = {
  durationMinutes: 15,
  showTokyo: false,
  showLondon: false,
  showNewYork: true,
  showSydney: false,
  newYorkStart: "09:30",
  newYorkEnd: "16:00",
  lookbackDays: 7,
  hideWeekends: true,
};

const frozen = buildInitialBalanceLevels(candles, settings, 5 * 60_000);
assert.equal(frozen.length, 2, "IB returns one high and one low");
assert.equal(frozen.find((level) => level.side === "high")?.price, 103, "IBH ignores later session highs");
assert.equal(frozen.find((level) => level.side === "low")?.price, 98, "IBL ignores later session lows");
assert.equal(frozen.find((level) => level.side === "high")?.startTimestamp, base + 10 * 60_000, "IBH begins at the wick that established the high");
assert.equal(frozen.find((level) => level.side === "low")?.startTimestamp, base + 5 * 60_000, "IBL begins at the wick that established the low");
assert.equal(frozen[0].developing, false, "IB freezes after its formation window");
assert.match(frozen[0].label, /15m/, "IB label states the selected formation window");

const developing = buildInitialBalanceLevels(candles.slice(0, 2), settings, 5 * 60_000);
assert.equal(developing.length, 2);
assert.equal(developing[0].developing, true, "IB develops while the formation window is open");
assert.match(developing[0].label, /BUILDING/, "Developing state is visible on-chart");

const fallback = buildInitialBalanceLevels(candles, { ...settings, durationMinutes: 17 }, 5 * 60_000);
assert.equal(fallback[0].durationMinutes, 60, "Unsupported durations normalize to 60 minutes");
assert.equal(fallback.find((level) => level.side === "high")?.price, 111, "60-minute fallback uses the complete first hour only");

const globexBase = Date.parse("2026-01-05T23:00:00.000Z"); // 18:00 New York (EST)
const globexCandles = [
  { ...candle(0, 100, 101, 99, 100.5), timestamp: globexBase },
  { ...candle(5, 100.5, 103, 98, 102), timestamp: globexBase + 5 * 60_000 },
  { ...candle(30, 102, 104, 97, 103), timestamp: globexBase + 30 * 60_000 },
];
const globex = buildInitialBalanceLevels(globexCandles, {
  durationMinutes: 30,
  showGlobex: true,
  showTokyo: false,
  showLondon: false,
  showNewYork: false,
  showSydney: false,
  globexLabel: "Globex",
  globexStart: "18:00",
  globexEnd: "17:00",
  lookbackDays: 7,
  hideWeekends: true,
}, 5 * 60_000);
assert.equal(globex.length, 2, "Globex produces its own IBH and IBL pair");
assert.match(globex.find((level) => level.side === "low")?.label ?? "", /^Globex IBL 30m/, "Globex uses the intended compact chart label");
assert.equal(globex.find((level) => level.side === "high")?.startTimestamp, globexBase + 5 * 60_000, "Globex IBH starts at its forming wick");

const nextNewYorkBase = Date.parse("2026-01-06T14:30:00.000Z");
const nextSessionCandles = [
  { ...candle(0, 200, 201, 199, 200.5), timestamp: nextNewYorkBase },
  { ...candle(5, 200.5, 204, 198, 203), timestamp: nextNewYorkBase + 5 * 60_000 },
  { ...candle(15, 203, 210, 190, 205), timestamp: nextNewYorkBase + 15 * 60_000 },
];
const replaced = buildInitialBalanceLevels([...candles, ...nextSessionCandles], settings, 5 * 60_000);
assert.equal(replaced.length, 2, "A new session replaces the previous session's IB pair");
assert.ok(replaced.every((level) => level.session.startTimestamp === nextNewYorkBase), "No stale prior-session IB levels remain");
assert.equal(replaced.find((level) => level.side === "high")?.price, 204, "The replacement IBH uses only the newest opening window");
assert.equal(replaced.find((level) => level.side === "low")?.price, 198, "The replacement IBL uses only the newest opening window");

console.log("Initial Balance levels tests passed.");
