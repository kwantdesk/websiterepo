const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, isMain, options) {
  if (request.startsWith("@/")) request = path.join(root, "src", request.slice(2));
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  buildGexIntervalMapSnapshot,
  normalizeGexIntervalProviderPayload,
} = require("../src/lib/gexIntervalMap.ts");

const baseSettings = {
  mode: "raw",
  baseline: "previous-bucket",
  rollingBuckets: 3,
  content: "net",
  expiration: {
    mode: "all-expirations",
    includeWeeklies: true,
    includeMonthlies: true,
    includeQuarterlies: true,
  },
  aggregationMode: "exact-display-tick",
  customBinSizePoints: 1,
  minimumAbsoluteExposure: 0,
  maximumDistancePoints: 0,
  maximumPoints: 1000,
};

const surface = normalizeGexIntervalProviderPayload({
  sourceTicker: "QQQ",
  sessionDate: "2026-08-14",
  marketOpen: true,
  checkedAt: "2026-08-14T14:32:00.000Z",
  aggregationPeriod: "1m",
  pricePayload: { data: {
    1776177000000: { closePrice: 730 },
    1776177060000: { closePrice: 731 },
  } },
  payload: { data: {
    1776177000000: { "2026-08-14": {
      730: { CALL: 100, PUT: -40 },
      731: { CALL: 20, PUT: -10 },
    } },
    1776177060000: { "2026-08-14": {
      730: { CALL: 130, PUT: -50 },
      732: { CALL: 15, PUT: -5 },
    } },
  } },
});

assert.equal(surface.buckets.length, 2, "provider buckets normalize in chronological order");

const displayPrices = [
  { timestamp: 1776177000000, price: 29930 },
  { timestamp: 1776177060000, price: 29971 },
];
const raw = buildGexIntervalMapSnapshot(surface, "NQ", displayPrices, baseSettings);
assert.ok(raw.points.length >= 4, "raw mode retains mapped strike/time observations");
assert.equal(raw.netExposure, 90, "raw totals use the complete latest surface");
assert.ok(raw.levels.find((level) => level.kind === "DOMINANT_ABSOLUTE"), "latest bucket derives a dominant absolute Net GEX level");
assert.equal(raw.levels.some((level) => level.kind === "MAX_NEGATIVE"), false, "a Max Negative level is not fabricated when no negative Net GEX exists");
assert.ok(raw.points.every((point) => Number.isFinite(point.percentageOfBucketMagnitude)), "points retain bucket contribution percentages");
assert.equal(raw.tracks.maxPositive.length, 2, "the strongest positive strike is tracked through time");
assert.equal(raw.tracks.underlyingPrice.length, 2, "the synchronized underlying price path is retained");

const zeroNetSurface = normalizeGexIntervalProviderPayload({
  sourceTicker: "QQQ",
  sessionDate: "2026-08-14",
  marketOpen: true,
  checkedAt: "2026-08-14T14:32:00.000Z",
  aggregationPeriod: "1m",
  pricePayload: { data: { 1776177000: { closePrice: 730 } } },
  payload: { data: { 1776177000: { "2026-08-14": { 730: { CALL: 100, PUT: -100 } } } } },
});
assert.equal(zeroNetSurface.buckets[0].timestamp, 1776177000000, "provider timestamps normalize whether supplied in seconds or milliseconds");
const zeroNet = buildGexIntervalMapSnapshot(zeroNetSurface, "NQ", [displayPrices[0]], baseSettings);
assert.equal(zeroNet.points.length, 0, "zero net-exposure cells do not create a misleading grid of minimum-size dots");

const difference = buildGexIntervalMapSnapshot(surface, "NQ", displayPrices, { ...baseSettings, mode: "difference" });
const latest = difference.points.filter((point) => point.timestamp === 1776177060000);
assert.ok(latest.some((point) => point.sourceStrike === 731 && point.net === -10), "a strike missing from the new bucket is emitted as a negative difference");
assert.ok(latest.some((point) => point.sourceStrike === 732 && point.net === 10), "a newly appearing strike is emitted as a positive difference");
assert.equal(latest.find((point) => point.sourceStrike === 730).previousNet, 60, "points retain the prior raw Net GEX value for tooltips and alerts");

const filtered = buildGexIntervalMapSnapshot(surface, "NQ", displayPrices, { ...baseSettings, minimumAbsoluteExposure: 1_000_000 });
assert.equal(filtered.points.length, 0, "the visual threshold can hide every point");
assert.equal(filtered.netExposure, raw.netExposure, "visual thresholds do not alter raw totals");

const firstMapping = raw.points.find((point) => point.timestamp === 1776177000000).mapping;
const secondMapping = raw.points.find((point) => point.timestamp === 1776177060000).mapping;
assert.notEqual(firstMapping.calculatedAtMs, secondMapping.calculatedAtMs, "each bucket stores its own historical mapping timestamp");

const catalogSource = fs.readFileSync(path.join(root, "src/lib/chartIndicatorCatalog.ts"), "utf8");
const workspaceSource = fs.readFileSync(path.join(root, "src/components/KwantifyWorkspace.tsx"), "utf8");
const primitiveSource = fs.readFileSync(path.join(root, "src/lib/gexIntervalMapPrimitive.ts"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "src/app/api/gex-interval-map/route.ts"), "utf8");
assert.match(catalogSource, /indicator\("GEX Interval Map", "Options Flow"/, "indicator is registered under Options Flow");
assert.match(workspaceSource, /tool-gex-interval-map[\s\S]*indicatorId: "gex-interval-map"/, "Add Tool uses the same stable indicator ID");
assert.match(primitiveSource, /useMediaCoordinateSpace/, "the renderer uses the chart canvas media-coordinate primitive");
assert.match(primitiveSource, /x < -40[\s\S]*x > mediaSize\.width/, "the renderer culls off-screen points");
assert.doesNotMatch(routeSource, /NEXT_PUBLIC_(?:QUANTDATA|GEX)[A-Z_]*(?:KEY|TOKEN|SECRET)/, "options-provider credentials are never exposed through a public environment variable");

const performanceBuckets = [];
const performancePrices = [];
for (let bucketIndex = 0; bucketIndex < 240; bucketIndex += 1) {
  const timestamp = 1776177000000 + bucketIndex * 60_000;
  performancePrices.push({ timestamp, price: 29_900 + bucketIndex * 0.25 });
  performanceBuckets.push({
    timestamp,
    sourcePrice: 730 + bucketIndex * 0.01,
    rows: Array.from({ length: 61 }, (_, strikeIndex) => ({
      expirationDate: "2026-08-14",
      sourceStrike: 700 + strikeIndex,
      callExposure: (strikeIndex + 1) * 1000 + bucketIndex,
      putExposure: -(61 - strikeIndex) * 800,
    })),
  });
}
const performanceSurface = { ...surface, buckets: performanceBuckets };
const performanceStartedAt = performance.now();
const performanceSnapshot = buildGexIntervalMapSnapshot(performanceSurface, "NQ", performancePrices, { ...baseSettings, maximumPoints: 12000 });
const performanceElapsedMs = performance.now() - performanceStartedAt;
assert.ok(performanceSnapshot.points.length <= 12000, "the retained-point ceiling is enforced");
assert.ok(performanceElapsedMs < 2000, `normalization and mapping stay bounded (${performanceElapsedMs.toFixed(1)}ms)`);

console.log("GEX Interval Map tests passed");
