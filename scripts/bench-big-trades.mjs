import { calculateBigTradePrints } from "../src/lib/bigTrades.ts";

/**
 * How expensive is one Big Contracts recompute?
 *
 * This decides whether the study can simply be sampled faster or needs an
 * incremental live path. Sampling at 40ms is only viable if a full recompute
 * is a small fraction of a frame.
 */
const MIN = 60_000;
const now = Date.UTC(2026, 7, 24, 18, 0);

function build(tradeCount, barCount) {
  const candles = Array.from({ length: barCount }, (_, i) => {
    const p = 29000 + Math.sin(i / 20) * 40;
    return {
      timestamp: now - (barCount - i) * MIN,
      open: p, high: p + 5, low: p - 5, close: p,
      volume: 3000, askVolume: 1600, bidVolume: 1400, trades: 900,
    };
  });
  const span = barCount * MIN;
  const trades = Array.from({ length: tradeCount }, (_, i) => {
    const t = now - span + Math.floor((i / tradeCount) * span);
    const size = i % 997 === 0 ? 120 : i % 89 === 0 ? 35 : 1 + (i % 4);
    const p = 29000 + Math.sin(i / 500) * 40;
    const buy = i % 2 === 0;
    return {
      eventId: `e${i}`, recordIndex: i, timestamp: t,
      open: p, high: p, low: p, close: p,
      volume: size, askVolume: buy ? size : 0, bidVolume: buy ? 0 : size,
      delta: buy ? size : -size, trades: 1, aggressor: buy ? "BUY" : "SELL",
    };
  });
  return { candles, trades };
}

const settings = {
  daysToLoad: 1, manualFilter: 30, rthManualFilter: 30, maximumFilter: 0,
  clusterWindowMs: 100, clusterPriceTicks: 0, maxMarkersPerBar: 50,
  standardDeviation: 1, rthStandardDeviation: 1, minimumSize: 6, maximumSize: 32,
  minimumOpacity: 25, maximumOpacity: 90, cappingMaxVolume: 0, tickSize: 0.25,
};

for (const [tradeCount, barCount] of [[20_000, 390], [60_000, 390], [150_000, 1440]]) {
  const { candles, trades } = build(tradeCount, barCount);
  calculateBigTradePrints(candles, trades, settings, now);   // warm
  const runs = 20;
  const started = performance.now();
  let printed = 0;
  for (let i = 0; i < runs; i += 1) {
    printed = calculateBigTradePrints(candles, trades, settings, now).length;
  }
  const per = (performance.now() - started) / runs;
  console.log(
    `${tradeCount.toLocaleString()} prints / ${barCount} bars -> ${per.toFixed(2)}ms per recompute `
    + `(${printed} markers) | at 40ms cadence that is ${(per / 40 * 100).toFixed(0)}% of one core`,
  );
}
