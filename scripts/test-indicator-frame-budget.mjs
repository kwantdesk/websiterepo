import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const bigBlocks = read("src/lib/bigBlocksPrimitive.ts");
assert.match(bigBlocks, /visibleZones\(\)/, "Big Blocks must expose a viewport-bounded zone set");
assert.match(bigBlocks, /const zones = this\.primitive\.visibleZones\(\)/, "Big Blocks must paint only viewport-relevant zones");

const imbalance = read("src/lib/imbalanceZonesPrimitive.ts");
assert.match(imbalance, /visibleZones\(\)/, "Imbalance Tracker must expose a viewport-bounded zone set");
assert.match(imbalance, /const zones = this\.primitive\.visibleZones\(\)/, "Imbalance Tracker must paint only viewport-relevant zones");

const bigTrades = read("src/lib/bigTradesPrimitive.ts");
assert.match(bigTrades, /denseViewport/, "Big Contracts must reduce overdraw at compressed zoom levels");
assert.match(bigTrades, /labelsFitFrameBudget/, "Big Contracts must cap expensive label layout work");
assert.match(bigTrades, /textWidthCache/, "Big Contracts must cache repeated text measurements");

const profile = read("src/lib/nativeVolumeProfilePrimitive.ts");
for (const field of ["structure", "vwap", "summary"]) {
  assert.match(profile, new RegExp(`derived\\.${field}`), `Volume Profile must reuse cached ${field} analytics`);
}

const chart = read("src/components/Chart.tsx");
assert.match(chart, /bigTradeFullPassKey/, "Big Contracts must use a bounded authoritative refresh cadence");
assert.match(chart, /recentExecutionTail\(indicatorMarketTrades, 15 \* 60_000\)/, "Big Contracts must not rescan unreachable historical tape on every reconciliation");
assert.match(chart, /pendingDeepEffortCandleRef/, "Big Blocks must coalesce forming-candle work");
assert.match(chart, /requestAnimationFrame\(paintLatest\)/, "Big Blocks must run no more than once per display frame");

const inactiveGuardFiles = [
  "src/lib/absorptionDetectorPrimitive.ts",
  "src/lib/barPocPrimitive.ts",
  "src/lib/bounceLevelsPrimitive.ts",
  "src/lib/chartOverlayPrimitive.ts",
  "src/lib/classicGexProfilePrimitive.ts",
  "src/lib/darkPoolGexPrimitive.ts",
  "src/lib/darkPoolMapPrimitive.ts",
  "src/lib/deepPatternBuilderPrimitive.ts",
  "src/lib/deepVTrackerPrimitive.ts",
  "src/lib/deepWallPrimitive.ts",
  "src/lib/deltaLadderPrimitive.ts",
  "src/lib/dynamicPocPrimitive.ts",
  "src/lib/footprintPrimitive.ts",
  "src/lib/gammaHeatmapPrimitive.ts",
  "src/lib/gexIntervalMapPrimitive.ts",
  "src/lib/miniDomPrimitive.ts",
  "src/lib/netGammaExposurePrimitive.ts",
  "src/lib/pocAuctionPrimitive.ts",
  "src/lib/positionCalculatorPrimitive.ts",
  "src/lib/pullingStackingPrimitive.ts",
  "src/lib/ratioHighlightPrimitive.ts",
  "src/lib/smtDivergencePrimitive.ts",
  "src/lib/stackedImbalancePrimitive.ts",
  "src/lib/stopSpotterPrimitive.ts",
  "src/lib/tpo/primitive.ts",
  "src/lib/unfinishedAuctionPrimitive.ts",
];
for (const path of inactiveGuardFiles) {
  const source = read(path);
  assert.doesNotMatch(
    source,
    /paneViews\(\)\s*\{\s*return \[this\.(?:paneView|view)\];\s*\}/,
    `${path} must not register a renderer while it has no visible model`,
  );
}

console.log("Indicator frame-budget guards passed.");
