import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

// The engine imports through the "@/..." alias, so bundle it into the repo
// (a temp dir outside the project resolves to a different drive root on
// Windows and the alias plugin never fires).
const outDir = mkdtempSync(join(process.cwd(), ".bigtrades-test-"));
const bundle = join(outDir, "bigTrades.mjs");
execSync(
  `npx esbuild src/lib/bigTrades.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);

const { calculateBigTradePrints, MANUAL_FILTER_CEILING } = await import(
  `file://${bundle.replaceAll("\\", "/")}`
);

const NOW = 1_770_000_000_000;

/** One print per second so nothing clusters, with a controlled size mix. */
function tape(sizes) {
  return sizes.map((volume, index) => ({
    eventId: `t${index}`,
    timestamp: NOW - (sizes.length - index) * 1_000,
    close: 20_000 + index,
    volume,
    trades: 1,
    aggressor: index % 2 === 0 ? "BUY" : "SELL",
    recordIndex: index,
  }));
}

const SIZES = [
  ...Array.from({ length: 200 }, (_, i) => 5 + (i % 20)),   // noise 5-24
  ...Array.from({ length: 40 }, (_, i) => 120 + i * 5),     // 120-315
  ...Array.from({ length: 5 }, (_, i) => 600 + i * 100),    // 600-1000
];
const trades = tape(SIZES);
const base = { enableClustering: false, daysToLoad: 1, filterMode: "manual" };

const run = (settings) => calculateBigTradePrints([], trades, { ...base, ...settings }, NOW);

// 1. A manual minimum above the old 100-contract cap is honoured exactly.
const at250 = run({ manualFilter: 250 });
assert.ok(at250.length > 0, "250-lot minimum must still show the big prints");
assert.ok(
  at250.every((print) => print.volume >= 250),
  "no print below the manual minimum may survive",
);
assert.equal(
  at250.length,
  SIZES.filter((size) => size >= 250).length,
  "every print at or above the minimum must be kept",
);

// 2. The old ceiling silently turned 250 into 100. Prove it no longer does.
const at100 = run({ manualFilter: 100 });
assert.ok(
  at100.length > at250.length,
  "a lower minimum must admit strictly more prints than a higher one",
);

// 3. Raising the minimum must FILTER, not resize the survivors. This is the
//    reported symptom: the same trade drew smaller purely because the filter
//    moved. Track one specific print that survives both settings.
const radiusOf = (prints, volume) => prints.find((print) => print.volume === volume)?.radius;
for (const volume of [300, 600, 1000]) {
  const small = radiusOf(at100, volume);
  const large = radiusOf(at250, volume);
  assert.ok(small != null && large != null, `print of ${volume} must survive both minimums`);
  assert.ok(
    Math.abs(small - large) < 1e-9,
    `a ${volume}-lot print resized when the minimum moved (${small} vs ${large})`,
  );
}

// 4. Size still varies with trade size inside a single setting.
const bySize = [...at250].sort((a, b) => a.volume - b.volume);
assert.ok(
  bySize.at(-1).radius > bySize[0].radius,
  "a bigger trade must still draw a bigger marker",
);

// 5. The ceiling is a real bound, well past any genuine print.
assert.ok(MANUAL_FILTER_CEILING >= 5_000, "manual ceiling must clear real CME prints");
assert.equal(run({ manualFilter: MANUAL_FILTER_CEILING + 10_000 }).length, 0);

rmSync(outDir, { recursive: true, force: true });
console.log("big trades manual filter: 5/5 checks passed");
