import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".cvd-heal-test-"));
const bundle = join(outDir, "flow.mjs");
execSync(
  `npx esbuild src/lib/institutionalMarketData.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { healClosedCandleFlow } = await import(`file://${bundle.replaceAll("\\", "/")}`);

const MINUTE = 60_000;
const NOW = 1_770_000_000_000;
const BARS = 60;
const start = NOW - BARS * MINUTE;

/** The exchange-baked truth: every bar carries its full aggressor split. */
const baked = Array.from({ length: BARS }, (_, i) => {
  const ask = 1_800 + (i % 7) * 90;
  const bid = 1_500 + (i % 5) * 70;
  return {
    timestamp: start + i * MINUTE,
    open: 20_000, high: 20_010, low: 19_990, close: 20_005,
    volume: ask + bid, trades: 400,
    askVolume: ask, bidVolume: bid, delta: ask - bid,
  };
});

/**
 * What the browser holds after a session where the live stream fragmented:
 * closed bars captured a small FRACTION of their executions. They are not
 * empty, so the old "only heal empty bars" gate ignored every one of them.
 */
const LIVE_EDGE_BARS = 2;
const held = baked.map((bar, i) => {
  if (i >= BARS - LIVE_EDGE_BARS) return { ...bar };       // live edge: full flow
  const ask = Math.round(bar.askVolume * 0.03);
  const bid = Math.round(bar.bidVolume * 0.03);
  return { ...bar, askVolume: ask, bidVolume: bid, delta: ask - bid, volume: ask + bid };
});

const liveEdgeFrom = NOW - LIVE_EDGE_BARS * MINUTE;
const healed = healClosedCandleFlow(held, baked, liveEdgeFrom);

// 1. The under-counted session must be recognised as needing repair.
assert.ok(healed, "under-counted closed bars must trigger a heal");
assert.equal(healed.length, held.length);

// 2. Every closed bar now matches the exchange-baked flow.
for (let i = 0; i < BARS - LIVE_EDGE_BARS; i += 1) {
  assert.equal(healed[i].askVolume, baked[i].askVolume, `bar ${i} ask not healed`);
  assert.equal(healed[i].bidVolume, baked[i].bidVolume, `bar ${i} bid not healed`);
  assert.equal(healed[i].delta, baked[i].delta, `bar ${i} delta not healed`);
}

// 3. The live edge keeps what the stream gave it — the baked history lags the
//    tape, so it must never drag the forming bars backwards.
for (let i = BARS - LIVE_EDGE_BARS; i < BARS; i += 1) {
  assert.equal(healed[i], held[i], `live edge bar ${i} must be left alone`);
}

// 4. The reported symptom: cumulative delta was collapsed against the live
//    edge. After healing the session carries its real cumulative move.
const cumulative = (bars) => bars.reduce((total, bar) => total + Number(bar.delta ?? 0), 0);
const truth = cumulative(baked);
assert.ok(
  Math.abs(cumulative(held) / truth) < 0.2,
  "the broken fixture must genuinely be a collapsed CVD",
);
assert.ok(
  Math.abs(cumulative(healed) - truth) < Math.abs(truth) * 0.02,
  `healed CVD must track the real cumulative delta (${cumulative(healed)} vs ${truth})`,
);

// 5. A session already matching the baked history must NOT force a rebuild.
assert.equal(
  healClosedCandleFlow(baked.map((bar) => ({ ...bar })), baked, liveEdgeFrom),
  null,
  "an already-correct series must not be committed again",
);

// 6. Poll-to-poll wobble inside the tolerance must not force a rebuild either.
const wobbled = baked.map((bar) => ({ ...bar, askVolume: bar.askVolume + 3, volume: bar.volume + 3 }));
assert.equal(
  healClosedCandleFlow(wobbled, baked, liveEdgeFrom),
  null,
  "small baked wobble must not trigger a full series rebuild",
);

// 7. Empty bars still heal — the original behaviour must not regress.
const bare = baked.map((bar, i) => (
  i === 5 ? { ...bar, askVolume: 0, bidVolume: 0, delta: 0, volume: 0 } : { ...bar }
));
const bareHealed = healClosedCandleFlow(bare, baked, liveEdgeFrom);
assert.ok(bareHealed, "a bar with no flow at all must still heal");
assert.equal(bareHealed[5].askVolume, baked[5].askVolume);

rmSync(outDir, { recursive: true, force: true });
console.log("CVD flow heal: 7/7 checks passed");
