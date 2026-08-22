import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Day and overnight are measured against their own tape.
 *
 * Overnight trades a fraction of the day session's volume. Measured together,
 * one threshold is set almost entirely by the day session: the overnight hours
 * show nothing at all, then the open floods. DeepChart carries a full second
 * filter set for RTH (RthFilterMode / RthFilterMinVol / RthFilterStdDev) for
 * the same reason. These checks pin that a genuinely large overnight print
 * registers as one.
 */

const outDir = mkdtempSync(join(process.cwd(), ".bt-session-test-"));
const bundle = join(outDir, "bigTrades.mjs");
execSync(
  `npx esbuild src/lib/bigTrades.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { calculateBigTradePrints, isRegularTradingHours } = await import(
  `file://${bundle.replaceAll("\\", "/")}`
);

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// 2026-08-20 is a Thursday. 14:00 UTC = 09:00 Chicago (RTH); 04:00 UTC = 23:00 (overnight).
const RTH_NOON_UTC = Date.parse("2026-08-20T16:00:00.000Z");   // 11:00 Chicago
const OVERNIGHT_UTC = Date.parse("2026-08-20T04:00:00.000Z");  // 23:00 Chicago
const NOW = Date.parse("2026-08-20T20:00:00.000Z");

check("the session classifier agrees with the CME clock", () => {
  assert.equal(isRegularTradingHours(RTH_NOON_UTC), true, "11:00 Chicago is RTH");
  assert.equal(isRegularTradingHours(OVERNIGHT_UTC), false, "23:00 Chicago is overnight");
  // Boundaries: 08:30 open is in, 15:15 close is out.
  assert.equal(isRegularTradingHours(Date.parse("2026-08-20T13:30:00.000Z")), true, "08:30 open");
  assert.equal(isRegularTradingHours(Date.parse("2026-08-20T20:15:00.000Z")), false, "15:15 close");
});

// A realistic mix: a heavy day session and a thin overnight one, plus a
// genuinely large overnight print that a trader would want to see.
const STANDOUT_OVERNIGHT = 90;
function buildTape() {
  const out = [];
  let index = 0;
  const push = (baseMs, offsetSeconds, volume) => {
    out.push({
      eventId: `t${index}`,
      timestamp: baseMs + offsetSeconds * 1_000,
      close: 20_000 + (index % 40),
      volume,
      trades: 1,
      aggressor: index % 2 === 0 ? "BUY" : "SELL",
      recordIndex: index,
    });
    index += 1;
  };
  // Overnight: 300 prints of 1-12 lots, then one 90-lot print.
  for (let i = 0; i < 300; i += 1) push(OVERNIGHT_UTC, i, 1 + (i % 12));
  push(OVERNIGHT_UTC, 400, STANDOUT_OVERNIGHT);
  // Day session: 300 prints of 40-140 lots.
  for (let i = 0; i < 300; i += 1) push(RTH_NOON_UTC, i, 40 + (i % 100));
  return out.sort((a, b) => a.timestamp - b.timestamp);
}
const trades = buildTape();
const base = { enableClustering: false, daysToLoad: 2, filterMode: "automatic", automaticIntensity: "medium" };
const run = (settings) => calculateBigTradePrints([], trades, { ...base, ...settings }, NOW);
const hasStandout = (prints) => prints.some((p) =>
  p.volume === STANDOUT_OVERNIGHT && !isRegularTradingHours(p.timestamp));

check("one combined threshold buries the overnight session", () => {
  const combined = run({ sessionFilterEnabled: false });
  const overnight = combined.filter((p) => !isRegularTradingHours(p.timestamp));
  assert.equal(
    overnight.length, 0,
    `the day session should set the bar out of the overnight tape's reach, got ${overnight.length} overnight markers`,
  );
});

check("splitting surfaces the standout overnight print", () => {
  const split = run({ sessionFilterEnabled: true });
  assert.ok(hasStandout(split), `the ${STANDOUT_OVERNIGHT}-lot overnight print must register`);
});

check("splitting does not flood the overnight session", () => {
  const split = run({ sessionFilterEnabled: true });
  const overnight = split.filter((p) => !isRegularTradingHours(p.timestamp));
  assert.ok(
    overnight.length <= 60,
    `overnight markers must stay selective, got ${overnight.length} of 301 prints`,
  );
});

check("the day session is unaffected by the split", () => {
  const combined = run({ sessionFilterEnabled: false }).filter((p) => isRegularTradingHours(p.timestamp));
  const split = run({ sessionFilterEnabled: true }).filter((p) => isRegularTradingHours(p.timestamp));
  assert.ok(
    Math.abs(combined.length - split.length) <= combined.length * 0.35,
    `RTH selection should be broadly stable: ${combined.length} combined vs ${split.length} split`,
  );
});

check("RTH can carry its own manual minimum", () => {
  const prints = run({
    sessionFilterEnabled: true,
    filterMode: "manual", manualFilter: 20,
    rthFilterMode: "manual", rthManualFilter: 130,
  });
  const rth = prints.filter((p) => isRegularTradingHours(p.timestamp));
  const overnight = prints.filter((p) => !isRegularTradingHours(p.timestamp));
  assert.ok(rth.every((p) => p.volume >= 130), "the RTH minimum must be honoured in RTH");
  assert.ok(overnight.every((p) => p.volume >= 20), "the base minimum must be honoured overnight");
  assert.ok(overnight.some((p) => p.volume < 130), "overnight must not inherit the RTH minimum");
});

check("capping by size keeps the print and stops it stretching the scale", () => {
  const withCap = run({ sessionFilterEnabled: true, cappingMode: "size", cappingMaxVolume: 100 });
  assert.ok(hasStandout(withCap), "a capped print must still be drawn, not dropped");
  const radii = withCap.map((p) => p.radius);
  assert.ok(radii.every((r) => Number.isFinite(r) && r > 0), "every radius must be finite and positive");
});

check("capping by reject removes the print entirely", () => {
  const rejected = run({ sessionFilterEnabled: true, cappingMode: "reject", cappingMaxVolume: 80 });
  assert.ok(
    rejected.every((p) => p.volume <= 80),
    "no print above the cap may survive in reject mode",
  );
});

check("a session with too little tape borrows the combined scale", () => {
  // Only two overnight prints: not enough to describe a distribution.
  const thin = [
    ...Array.from({ length: 300 }, (_, i) => ({
      eventId: `r${i}`, timestamp: RTH_NOON_UTC + i * 1_000, close: 20_000,
      volume: 40 + (i % 100), trades: 1, aggressor: "BUY", recordIndex: i,
    })),
    { eventId: "o1", timestamp: OVERNIGHT_UTC, close: 20_000, volume: 5, trades: 1, aggressor: "BUY", recordIndex: 900 },
    { eventId: "o2", timestamp: OVERNIGHT_UTC + 1_000, close: 20_000, volume: 6, trades: 1, aggressor: "SELL", recordIndex: 901 },
  ].sort((a, b) => a.timestamp - b.timestamp);
  const prints = calculateBigTradePrints([], thin, { ...base, sessionFilterEnabled: true }, NOW);
  assert.ok(prints.every((p) => Number.isFinite(p.radius) && p.radius > 0), "no NaN radius from a thin session");
  assert.ok(
    !prints.some((p) => p.volume <= 6),
    "a two-print overnight sample must not become its own scale and promote 5-lot trades",
  );
});

rmSync(outDir, { recursive: true, force: true });
console.log(`\nbig trades session split: ${passed}/${passed} checks passed`);
