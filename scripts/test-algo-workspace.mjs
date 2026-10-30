import assert from "node:assert/strict";
import test from "node:test";
import {
  ALGO_INSTRUMENTS, ALGO_TEMPLATES, aggregateAlgoCandles, algoSessionTimestamp,
  bootstrapAlgoTrades, buildAlgoPreview, defaultAlgoConfig, summarizeAlgoTrades, validateAlgoConfig,
} from "../src/lib/algoWorkspace.ts";

const base = () => defaultAlgoConfig(new Date("2026-10-31T00:00:00Z"));
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, a + " != " + b);
const configForDays = () => ({ ...base(), from: "2026-10-05", to: "2026-10-09" });
function fill(id, day, net, overrides = {}) {
  const entryTime = algoSessionTimestamp(day, "10:00", "America/New_York");
  return { id, algo: "Test", algoId: "test", direction: "Long", entryTime, exitTime: entryTime + 60000,
    entryPrice: 100, exitPrice: 101, stopPrice: 99, targetPrice: 102, quantity: 1,
    reason: "TP", gross: net, costs: 0, net, r: net / 100, ...overrides };
}

test("default window is stable, weekday-bounded, and valid", () => {
  const c = base(); assert.equal(validateAlgoConfig(c), null);
  assert.equal(c.to, "2026-10-30"); assert.equal(new Date(c.from).getUTCDay(), 1);
});
test("invalid dates, reversed windows, excessive windows and overnight previews fail explicitly", () => {
  for (const change of [{ from: "2026-02-30" }, { to: "2025-10-01" }, { from: "2020-01-01" }, { sessionEnd: "09:00" }, { sessionStart: "25:00" }]) {
    assert.ok(validateAlgoConfig({ ...base(), ...change }));
  }
});
test("non-finite numeric inputs and disabled-all selection are rejected", () => {
  for (const change of [{ capital: NaN }, { contracts: .5 }, { commission: -1 }, { slippageTicks: Infinity }]) assert.ok(validateAlgoConfig({ ...base(), ...change }));
  const c = base(); for (const a of Object.values(c.algorithms)) a.enabled = false;
  assert.match(validateAlgoConfig(c), /Enable/);
  assert.equal(validateAlgoConfig(c, false), null, "all-off preferences must still restore");
});
test("New York sessions honor DST rather than using a fixed UTC offset", () => {
  assert.equal(new Date(algoSessionTimestamp("2026-10-30", "09:30", "America/New_York")).toISOString(), "2026-10-30T13:30:00.000Z");
  assert.equal(new Date(algoSessionTimestamp("2026-11-02", "09:30", "America/New_York")).toISOString(), "2026-11-02T14:30:00.000Z");
  assert.equal(new Date(algoSessionTimestamp("2026-10-30", "09:30", "Australia/Brisbane")).toISOString(), "2026-10-29T23:30:00.000Z");
});
test("equity, drawdown, win rate, profit factor and expectancy reconcile to the fills", () => {
  const c = configForDays();
  const trades = [fill("b", "2026-10-06", -50), fill("a", "2026-10-05", 100), fill("c", "2026-10-07", 0)];
  const { metrics: m, equity } = summarizeAlgoTrades(trades, c);
  assert.equal(m.net, 50); assert.equal(m.maxDrawdown, 50); near(m.maxDrawdownPercent, 50 / 50100 * 100);
  assert.equal(m.wins, 1); assert.equal(m.losses, 1); near(m.winRate, 100 / 3); assert.equal(m.profitFactor, 2);
  near(m.expectancy, 50 / 3); assert.equal(m.recovery, 1); assert.equal(m.consecutiveLosses, 1);
  assert.deepEqual(equity.map((p) => p.equity), [50000, 50100, 50050, 50050]);
});
test("Sharpe uses sample deviation and includes flat weekdays; Sortino uses full-day downside deviation", () => {
  const { metrics } = summarizeAlgoTrades([fill("a", "2026-10-05", 100), fill("b", "2026-10-06", -50)], configForDays());
  const returns = [100 / 50000, -50 / 50100, 0, 0, 0];
  const mean = returns.reduce((a, b) => a + b) / 5;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / 4;
  near(metrics.sharpe, mean / Math.sqrt(variance) * Math.sqrt(252));
  near(metrics.sortino, mean / Math.sqrt(returns[1] ** 2 / 5) * Math.sqrt(252));
});
test("undefined risk ratios remain null instead of invented zero or infinity", () => {
  const wins = summarizeAlgoTrades([fill("a", "2026-10-05", 100)], configForDays()).metrics;
  assert.equal(wins.profitFactor, null); assert.equal(wins.sortino, null); assert.equal(wins.calmar, null); assert.equal(wins.recovery, null);
  const empty = summarizeAlgoTrades([], configForDays()).metrics;
  assert.equal(empty.net, 0); assert.equal(empty.sharpe, null); assert.equal(empty.sortino, null);
});
test("preview is deterministic and carries explicit provenance", () => {
  const a = buildAlgoPreview(base()), b = buildAlgoPreview(base());
  assert.equal(a.kind, "preview"); assert.deepEqual(a, b);
  assert.ok(a.trades.length > 20); assert.ok(a.candles.length > 1000);
});
test("each instrument has tick-aligned valid candles and correctly priced costs", () => {
  for (const symbol of Object.keys(ALGO_INSTRUMENTS)) {
    const c = { ...base(), instrument: symbol, from: "2026-10-29", to: "2026-10-30" };
    const run = buildAlgoPreview(c), instrument = ALGO_INSTRUMENTS[symbol];
    let previous = 0;
    for (const b of run.candles) {
      assert.ok(b.timestamp > previous); previous = b.timestamp;
      assert.ok(b.high >= Math.max(b.open, b.close)); assert.ok(b.low <= Math.min(b.open, b.close));
      for (const price of [b.open, b.high, b.low, b.close]) near(price / instrument.tick, Math.round(price / instrument.tick));
    }
    for (const t of run.trades) {
      near(t.costs, 2 * (c.commission + c.slippageTicks * instrument.tick * instrument.pointValue));
      near(t.net, t.gross - t.costs);
      assert.ok(t.exitTime >= t.entryTime);
      if (t.reason === "TP") assert.equal(t.exitPrice, t.targetPrice);
      if (t.reason === "SL") assert.equal(t.exitPrice, t.stopPrice);
    }
    near(run.metrics.net, run.trades.reduce((sum, t) => sum + t.net, 0));
  }
});
test("algo selection removes its fills without altering the other algo or sample candles", () => {
  const c = base(), before = buildAlgoPreview(c);
  c.algorithms["vwap-reversion"].enabled = false;
  const after = buildAlgoPreview(c);
  assert.ok(after.trades.every((t) => t.algoId === "opening-range"));
  assert.deepEqual(before.candles, after.candles);
  assert.deepEqual(before.trades.filter((t) => t.algoId === "opening-range"), after.trades);
});
test("parameter changes affect preview fills without repainting the source candles", () => {
  const c = base(), before = buildAlgoPreview(c);
  c.algorithms["opening-range"].stopTicks = 8;
  const after = buildAlgoPreview(c);
  assert.deepEqual(before.candles, after.candles);
  assert.notDeepEqual(before.trades, after.trades);
});
test("aggregated charts preserve OHLC extrema and volume without mutating minute data", () => {
  const bars = [
    { timestamp: 0, open: 10, high: 13, low: 9, close: 12, volume: 2 },
    { timestamp: 60000, open: 12, high: 14, low: 11, close: 13, volume: 3 },
    { timestamp: 300000, open: 13, high: 15, low: 12, close: 14, volume: 4 },
  ];
  const snapshot = structuredClone(bars), result = aggregateAlgoCandles(bars, 5);
  assert.deepEqual(result[0], { timestamp: 0, open: 10, high: 14, low: 9, close: 13, volume: 5 });
  assert.equal(result.length, 2); assert.deepEqual(bars, snapshot);
});
test("Monte Carlo is reproducible, finite and reconciles known constant-PnL outcomes", () => {
  const trades = [fill("a", "2026-10-05", 100), fill("b", "2026-10-06", 100)];
  const result = bootstrapAlgoTrades(trades, 50000, 120, 42);
  assert.deepEqual(result, bootstrapAlgoTrades(trades, 50000, 120, 42));
  assert.equal(result.paths.length, 120); assert.equal(result.p5, 50200); assert.equal(result.p95, 50200);
  assert.equal(result.lossProbability, 0); assert.equal(result.ruinProbability, 0);
});
test("Monte Carlo reports losses and capital-loss threshold crossings", () => {
  const result = bootstrapAlgoTrades([fill("a", "2026-10-05", -26000)], 50000);
  assert.equal(result.p50, 24000); assert.equal(result.lossProbability, 100); assert.equal(result.ruinProbability, 100);
  assert.equal(bootstrapAlgoTrades([], 50000).p50, 50000);
});
test("weekend-only preview windows fail without synthetic session trades", () => {
  assert.throws(() => buildAlgoPreview({ ...base(), from: "2026-10-31", to: "2026-11-01" }), /weekday/);
});
test("all template parameter schemas remain independently configurable", () => {
  const c = base(); assert.equal(Object.keys(c.algorithms).length, ALGO_TEMPLATES.length);
  c.algorithms["opening-range"].targetTicks = 1;
  assert.equal(c.algorithms["vwap-reversion"].targetTicks, 56);
});
