import assert from "node:assert/strict";
import {
  admitLiveBigTradePrints,
  admitsBigTrade,
  calculateBigTradePrints,
  calculateBigTradePrintsWithContext,
} from "../src/lib/bigTrades.ts";

/**
 * Big Contracts must show a large print immediately, not on the next sample.
 *
 * A full pass measures the tape's distribution - sorting volumes, quantiles,
 * per-session scales - and costs 22ms on a 20,000-print tape, 183ms on
 * 150,000. It cannot run at stream cadence, so the study samples every 1.5s
 * and a print could sit invisible for over a second after the tape held it.
 *
 * The live edge sizes a new print against the scale the last pass already
 * measured: O(new prints), no re-measuring.
 */
const MIN = 60_000;
const now = Date.UTC(2026, 7, 24, 18, 0);
const settings = {
  daysToLoad: 1, manualFilter: 30, rthManualFilter: 30, maximumFilter: 0,
  clusterWindowMs: 100, clusterPriceTicks: 0, maxMarkersPerBar: 50,
  standardDeviation: 1, rthStandardDeviation: 1, minimumSize: 6, maximumSize: 32,
  minimumOpacity: 25, maximumOpacity: 90, cappingMaxVolume: 0, tickSize: 0.25,
};

const candles = Array.from({ length: 390 }, (_, i) => {
  const p = 29000 + Math.sin(i / 20) * 40;
  return {
    timestamp: now - (390 - i) * MIN, open: p, high: p + 5, low: p - 5, close: p,
    volume: 3000, askVolume: 1600, bidVolume: 1400, trades: 900,
  };
});
const trade = (i, size, t, buy = true) => ({
  eventId: `e${i}`, recordIndex: i, timestamp: t,
  open: 29000, high: 29000, low: 29000, close: 29000 + (i % 7) * 0.25,
  volume: size, askVolume: buy ? size : 0, bidVolume: buy ? 0 : size,
  delta: buy ? size : -size, trades: 1, aggressor: buy ? "BUY" : "SELL",
});
const tape = Array.from({ length: 20_000 }, (_, i) =>
  trade(i, i % 997 === 0 ? 120 : i % 89 === 0 ? 35 : 1 + (i % 4),
    now - 390 * MIN + Math.floor((i / 20_000) * 390 * MIN)));

// --- the refactor did not change what the full pass produces ---
{
  const { prints, context } = calculateBigTradePrintsWithContext(candles, tape, settings, now);
  assert.ok(prints.length > 0, "the full pass still produces prints");
  assert.deepEqual(prints, calculateBigTradePrints(candles, tape, settings, now),
    "the original entry point must be unchanged");
  assert.ok(context, "and must hand back the scale it measured");
}

// --- a new large print is admitted and sized without re-measuring ---
{
  const { prints, context } = calculateBigTradePrintsWithContext(candles, tape, settings, now);
  const watermark = tape[tape.length - 1].timestamp;
  const withLive = [...tape, trade(99_001, 400, watermark + 250)];
  const live = admitLiveBigTradePrints(context, withLive, watermark);
  assert.equal(live.length, 1, "the new print is drawn immediately");
  assert.equal(live[0].volume, 400);
  assert.equal(live[0].side, "ASK", "a buy aggressor draws on the ask side");
  assert.ok(live[0].radius >= settings.minimumSize && live[0].radius <= settings.maximumSize);
  assert.ok(live[0].opacity > 0 && live[0].opacity <= 0.9);

  // And it sizes the same as the authoritative pass would.
  const full = calculateBigTradePrints(candles, withLive, settings, now);
  const authoritative = full.find((print) => print.volume === 400);
  assert.ok(authoritative, "the next full pass keeps it");
  assert.ok(Math.abs(authoritative.radius - live[0].radius) < 1.5,
    `live sizing must match the full pass: ${live[0].radius} vs ${authoritative.radius}`);
}

// --- small prints are still refused ---
{
  const { context } = calculateBigTradePrintsWithContext(candles, tape, settings, now);
  const watermark = tape[tape.length - 1].timestamp;
  const withNoise = [...tape, trade(99_002, 2, watermark + 100)];
  assert.equal(admitLiveBigTradePrints(context, withNoise, watermark).length, 0,
    "a 2-lot must not become a Big Contract");
  assert.equal(admitsBigTrade(context, watermark + 100, 2), false);
  assert.equal(admitsBigTrade(context, watermark + 100, 400), true);
}

// --- the scan stops at the watermark instead of walking the whole tape ---
{
  const { context } = calculateBigTradePrintsWithContext(candles, tape, settings, now);
  const watermark = tape[tape.length - 1].timestamp;
  const withLive = [...tape,
    trade(99_003, 400, watermark + 100),
    trade(99_004, 500, watermark + 200)];
  const live = admitLiveBigTradePrints(context, withLive, watermark);
  assert.equal(live.length, 2, "both new prints");
  assert.deepEqual(live.map((p) => p.volume), [400, 500], "returned oldest first");
  // Nothing already committed may be emitted twice - that would double-draw.
  assert.equal(admitLiveBigTradePrints(context, withLive, live.at(-1).timestamp).length, 0);
}

// --- and it is cheap enough to run at stream cadence ---
{
  const { context } = calculateBigTradePrintsWithContext(candles, tape, settings, now);
  const watermark = tape[tape.length - 1].timestamp;
  const batch = [...tape, ...Array.from({ length: 40 }, (_, i) =>
    trade(90_000 + i, i % 8 === 0 ? 200 : 3, watermark + i + 1))];
  const started = performance.now();
  const runs = 500;
  for (let i = 0; i < runs; i += 1) admitLiveBigTradePrints(context, batch, watermark);
  const per = (performance.now() - started) / runs;
  console.log(`  live admission: ${per.toFixed(4)}ms per batch of 40`);
  assert.ok(per < 1, `the live edge must be far inside a frame, got ${per.toFixed(3)}ms`);
}

// --- the chart actually paints it without a React round trip ---
{
  const { readFileSync } = await import("node:fs");
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.ok(chart.includes("admitLiveBigTradePrints(context, detail.tape, committed.watermark)"),
    "the live edge must run off the execution event, not the sampler");
  assert.ok(chart.includes("bigTradeLiveContextRef.current = context"),
    "the measured scale has to be retained between passes");
  // Straight to the canvas primitive - putting this through React state would
  // reintroduce the very cost the sampler exists to avoid.
  const listener = chart.slice(chart.indexOf("Draw a qualifying print the moment"));
  const body = listener.slice(0, listener.indexOf("const bigTradeEventChartTimes"));
  assert.ok(body.includes("primitive.update("), "it must paint imperatively");
  assert.ok(!body.includes("setState") && !body.includes("startTransition"),
    "the live edge must not go through React");
  // A replay must not be shown the live tape.
  assert.ok(body.includes("liveReplayActiveRef.current"), "replay must be excluded");
  // The watermark must be the source timestamp: a marker's `time` is a chart
  // coordinate, and on event bars a synthetic second.
  assert.ok(chart.includes("anchoredBigTradePrints.at(-1)?.timestamp"),
    "the watermark must come from the source timestamp");
}

console.log("Big Contracts live-edge tests passed.");
