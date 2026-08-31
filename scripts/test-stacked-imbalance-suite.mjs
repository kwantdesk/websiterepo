import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  StackedImbalanceEngine,
  buildStackedImbalanceGroups,
  calculateImbalanceCells,
  normalizeStackedImbalanceSettings,
} from "../src/lib/stackedImbalanceSuite.ts";

const row = (tickIndex, bidVolume, askVolume, bidTrades = 1, askTrades = 1) => ({
  tickIndex, price: tickIndex * 0.25, bidVolume, askVolume, unknownVolume: 0,
  bidTrades, askTrades, unknownTrades: 0, classifiedVolume: bidVolume + askVolume,
  totalVolume: bidVolume + askVolume, volume: bidVolume + askVolume,
  delta: askVolume - bidVolume, deltaPercent: (askVolume - bidVolume) / Math.max(1, askVolume + bidVolume),
  betweenVolume: 0, betweenTrades: 0, isPoc: false, isValueArea: false,
  isBidImbalance: false, isAskImbalance: false, bidImbalance: false, askImbalance: false,
  isStackedBidImbalance: false, isStackedAskImbalance: false, stackedBidVolume: 0, stackedAskVolume: 0,
  isUnfinishedAuctionHigh: false, isUnfinishedAuctionLow: false, isMaxBid: false, isMaxAsk: false,
  isMaxVolume: false, isMaxPositiveDelta: false, isMaxNegativeDelta: false, isMaxTrades: false,
});

const authoritative = JSON.parse(readFileSync(
  new URL("../native/parity/fixtures/charts/stacked-imbalance-suite-authoritative.json", import.meta.url),
  "utf8",
));

const fixtureBar = (source) => {
  const fixtureRows = source.rows.map((value) => row(
    value.tickIndex,
    value.bidVolume,
    value.askVolume,
    value.bidTrades,
    value.askTrades,
  ));
  const bidVolume = fixtureRows.reduce((sum, value) => sum + value.bidVolume, 0);
  const askVolume = fixtureRows.reduce((sum, value) => sum + value.askVolume, 0);
  const totalTrades = fixtureRows.reduce((sum, value) => sum + value.bidTrades + value.askTrades, 0);
  const fallbackTick = Math.round(source.close / authoritative.tickSize);
  const lowTick = fixtureRows.length ? Math.min(...fixtureRows.map((value) => value.tickIndex)) : fallbackTick;
  const highTick = fixtureRows.length ? Math.max(...fixtureRows.map((value) => value.tickIndex)) : fallbackTick;
  return {
    id: source.id,
    instrument: "NQ",
    startTime: source.startTime,
    endTime: source.endTime,
    timestamp: source.startTime,
    open: source.close,
    high: highTick * authoritative.tickSize,
    low: lowTick * authoritative.tickSize,
    close: source.close,
    openTick: fallbackTick,
    highTick,
    lowTick,
    closeTick: fallbackTick,
    bidVolume,
    askVolume,
    unknownVolume: 0,
    betweenVolume: 0,
    classifiedVolume: bidVolume + askVolume,
    totalVolume: bidVolume + askVolume,
    volume: bidVolume + askVolume,
    delta: askVolume - bidVolume,
    deltaPercent: (askVolume - bidVolume) / Math.max(1, bidVolume + askVolume),
    deltaOpen: 0,
    deltaHigh: Math.max(0, askVolume - bidVolume),
    deltaLow: Math.min(0, askVolume - bidVolume),
    deltaClose: askVolume - bidVolume,
    bidTrades: fixtureRows.reduce((sum, value) => sum + value.bidTrades, 0),
    askTrades: fixtureRows.reduce((sum, value) => sum + value.askTrades, 0),
    unknownTrades: 0,
    totalTrades,
    rows: fixtureRows,
    levels: new Map(fixtureRows.map((value) => [value.tickIndex, value])),
    pocTick: fallbackTick,
    valueAreaHighTick: highTick,
    valueAreaLowTick: lowTick,
    maxBidTick: fallbackTick,
    maxAskTick: fallbackTick,
    maxVolumeTick: fallbackTick,
    maxPositiveDeltaTick: fallbackTick,
    maxNegativeDeltaTick: fallbackTick,
    maxTradesTick: fallbackTick,
    pocPrice: source.close,
    deltaPocPrice: source.close,
    vah: highTick * authoritative.tickSize,
    val: lowTick * authoritative.tickSize,
    vwap: source.close,
    isClosed: source.isClosed,
    hasPriceLevelFlow: fixtureRows.length > 0,
    trades: totalTrades,
  };
};

const fixtureBars = new Map(Object.entries(authoritative.bars).map(([name, source]) => [name, fixtureBar(source)]));

for (const scenario of authoritative.cellScenarios) {
  const cell = calculateImbalanceCells(
    fixtureBars.get(scenario.bar),
    normalizeStackedImbalanceSettings(scenario.settings),
    1,
  ).find((candidate) => candidate.side === scenario.side && candidate.tickIndex === scenario.tickIndex);
  assert.ok(cell, scenario.name);
  assert.deepEqual({
    comparison: cell.comparison,
    numerator: cell.numerator,
    denominator: cell.denominator,
    ratio: cell.ratio,
    ratioPercent: cell.ratioPercent,
    difference: cell.difference,
    zeroSide: cell.zeroSide,
    qualified: cell.qualified,
    score: cell.score,
  }, scenario.expected, scenario.name);
}

for (const scenario of authoritative.groupScenarios) {
  const source = fixtureBars.get(scenario.bar);
  const settings = normalizeStackedImbalanceSettings(scenario.settings);
  const cells = calculateImbalanceCells(source, settings, 1);
  const group = buildStackedImbalanceGroups(cells, source.id, source.endTime, source.isClosed, settings, 1)
    .find((candidate) => candidate.side === scenario.side);
  assert.ok(group, scenario.name);
  assert.deepEqual({
    id: group.id,
    lowTick: group.lowTick,
    highTick: group.highTick,
    levelCount: group.levelCount,
    totalNumerator: group.totalNumerator,
    totalDenominator: group.totalDenominator,
    weightedRatio: group.weightedRatio,
    score: group.score,
    confirmed: group.confirmed,
  }, scenario.expected, scenario.name);
}

for (const scenario of authoritative.engineScenarios) {
  const fixtureEngine = new StackedImbalanceEngine();
  for (const step of scenario.steps) {
    const frame = fixtureEngine.update(
      step.bars.map((name) => fixtureBars.get(name)),
      "NQ",
      authoritative.tickSize,
      1,
      scenario.settings,
      step.now,
    );
    const zone = frame.zones.find((candidate) => candidate.id === "NQ:1000:ASK:400:403");
    assert.ok(zone, `${scenario.name}:${step.now}`);
    assert.deepEqual({
      state: zone.state,
      departed: zone.departed,
      retestCount: zone.retestCount,
      alerts: frame.alerts.map((alert) => alert.type),
    }, {
      state: step.state,
      departed: step.departed,
      retestCount: step.retestCount,
      alerts: step.alerts,
    }, `${scenario.name}:${step.now}`);
  }
}

const rows = [
  row(399, 20, 5),
  row(400, 10, 120),
  row(401, 10, 140),
  row(402, 10, 160),
  row(403, 10, 180),
  row(404, 0, 0),
];
const bar = {
  id: "NQ:1000", instrument: "NQ", startTime: 1000, endTime: 2000, timestamp: 1000,
  open: 100, high: 101, low: 99, close: 100.5, openTick: 400, highTick: 404, lowTick: 396, closeTick: 402,
  bidVolume: 60, askVolume: 605, unknownVolume: 0, betweenVolume: 0, classifiedVolume: 665, totalVolume: 665,
  volume: 665, delta: 545, deltaPercent: 545 / 665, deltaOpen: 0, deltaHigh: 545, deltaLow: 0, deltaClose: 545,
  bidTrades: 6, askTrades: 6, unknownTrades: 0, totalTrades: 12, rows, levels: new Map(rows.map((value) => [value.tickIndex, value])),
  pocTick: 403, valueAreaHighTick: 403, valueAreaLowTick: 400, maxBidTick: 399, maxAskTick: 403,
  maxVolumeTick: 403, maxPositiveDeltaTick: 403, maxNegativeDeltaTick: 399, maxTradesTick: 403,
  pocPrice: 100.75, deltaPocPrice: 100.75, vah: 100.75, val: 100, vwap: 100.4,
  isClosed: true, hasPriceLevelFlow: true, trades: 12,
};

const settings = normalizeStackedImbalanceSettings({ minimumStackedScore: 0 });
const cells = calculateImbalanceCells(bar, settings, 1);
const ask400 = cells.find((cell) => cell.side === "ASK" && cell.tickIndex === 400);
assert.equal(ask400?.denominator, 20, "diagonal ask must compare to the lower bid cell");
assert.equal(ask400?.ratio, 6);
assert.equal(ask400?.qualified, true);

const groups = buildStackedImbalanceGroups(cells, bar.id, bar.endTime, true, settings, 1);
const askGroup = groups.find((group) => group.side === "ASK" && group.confirmed);
assert.ok(askGroup, "three or more adjacent qualified ask cells must form a confirmed stack");
assert.ok(askGroup.levelCount >= 3);
assert.equal(askGroup.weightedRatio, askGroup.totalNumerator / askGroup.totalDenominator, "group ratio must use summed numerator and denominator");

const zeroBar = { ...bar, id: "NQ:zero", rows: [row(500, 0, 80, 0, 2), row(499, 0, 0, 0, 0)] };
const zeroCell = calculateImbalanceCells(zeroBar, { ...settings, minimumCombinedVolume: 0 }, 1).find((cell) => cell.side === "ASK" && cell.tickIndex === 500);
assert.equal(zeroCell?.zeroSide, true);
assert.equal(zeroCell?.ratio, null, "zero-side imbalance must not be represented as Infinity");

const engine = new StackedImbalanceEngine();
const first = engine.update([bar], "NQ", 0.25, 1, { ...settings, enableAlerts: true }, 2100);
assert.ok(first.zones.length > 0, "confirmed stack must create an extended zone");
assert.ok(first.alerts.some((alert) => alert.type === "QUALIFIED"), "first qualification must emit one stable alert transition");
const second = engine.update([bar], "NQ", 0.25, 1, { ...settings, enableAlerts: true }, 2200);
assert.equal(second.alerts.filter((alert) => alert.type === "QUALIFIED").length, 0, "live updates must not repeat the same qualification alert");

console.log(`Stacked Imbalance Suite authoritative fixture passed (${authoritative.cellScenarios.length + authoritative.groupScenarios.length + authoritative.engineScenarios.length} scenarios).`);
