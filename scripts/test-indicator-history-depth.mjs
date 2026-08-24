import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";

/**
 * Chart.tsx lets a short list of studies span the whole loaded history rather
 * than the 1,500-bar lite window, so Volume no longer stops a day short of
 * price. Membership is a COST decision: the series recompute runs on the main
 * thread every 1-2s, and VWAP at that depth measures ~92ms, which would block
 * five frames a second and bring back the stutter the lite window exists to
 * prevent. This fails if anything expensive joins the list.
 */

// The per-study budget is the real guard: VWAP measures ~85ms and trips it on
// its own. The total is deliberately loose because these timings swing by 3x
// between runs on a busy machine, and a flaky guard gets deleted rather than
// fixed.
const PER_STUDY_BUDGET_MS = 8;
const TOTAL_BUDGET_MS = 45;

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const block = /const DEEP_HISTORY_INDICATOR_IDS = new Set\(\[([\s\S]*?)\]\)/.exec(source);
assert.ok(block, "DEEP_HISTORY_INDICATOR_IDS not found in Chart.tsx");
const ids = [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.ok(ids.length > 0, "the deep-history list is empty");

const depthMatch = /const DEEP_HISTORY_INDICATOR_MAX_BARS = ([\d_]+)/.exec(source);
assert.ok(depthMatch, "DEEP_HISTORY_INDICATOR_MAX_BARS not found");
const bars = Number(depthMatch[1].replace(/_/g, ""));

const theme = { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#888" };
const candles = [];
let price = 20_000;
for (let i = 0; i < bars; i += 1) {
  price += Math.sin(i / 7) * 3;
  const open = price;
  const close = price + Math.cos(i / 5) * 2;
  candles.push({
    timestamp: 1_700_000_000_000 + i * 60_000,
    open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close,
    volume: 500 + (i % 97),
  });
}

let total = 0;
console.log(`measuring ${ids.length} deep-history studies at ${bars.toLocaleString()} bars\n`);
for (const id of ids) {
  // The BEST of several runs, not the mean.
  //
  // A single timing on a busy machine swung this study between 2ms and 12ms
  // across runs, which fails a budget for reasons that have nothing to do with
  // the code. The minimum is the least-contaminated estimate of what the work
  // actually costs: interference can only ever make a run slower.
  let ms = Infinity;
  let points = 0;
  for (let run = 0; run < 7; run += 1) {
    const start = process.hrtime.bigint();
    const series = calculateIndicatorSeries(
      { instanceId: id, indicatorId: id, enabled: true, settings: {} },
      candles, theme, { instrument: "NQ", tickSize: 0.25 },
    );
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    if (elapsed < ms) ms = elapsed;
    points = series.reduce((sum, entry) => sum + entry.data.length, 0);
  }
  total += ms;
  console.log(`  ${id.padEnd(30)} ${ms.toFixed(2).padStart(7)} ms   ${points} pts`);
  assert.ok(points > 0, `"${id}" produced no points at depth; it cannot be a deep-history study`);
  assert.ok(
    ms <= PER_STUDY_BUDGET_MS,
    `"${id}" costs ${ms.toFixed(1)}ms at ${bars} bars, over the ${PER_STUDY_BUDGET_MS}ms budget. `
    + "The recompute is main-thread and runs every 1-2s; leave this study on the lite window.",
  );
}

console.log(`\n  ${"TOTAL".padEnd(30)} ${total.toFixed(2).padStart(7)} ms`);
assert.ok(
  total <= TOTAL_BUDGET_MS,
  `the deep-history list costs ${total.toFixed(1)}ms with everything enabled, over the ${TOTAL_BUDGET_MS}ms budget`,
);
console.log(`\nindicator history depth: ${ids.length}/${ids.length} studies inside budget`);
