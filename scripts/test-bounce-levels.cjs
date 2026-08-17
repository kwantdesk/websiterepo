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
  BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT,
  buildBounceLevelsSnapshot,
  mergeBounceIntervalSurfaces,
  mergeBounceLevelsSnapshots,
  selectLookaheadSafeBounceBucket,
} = require("../src/lib/bounceLevels.ts");
const {
  BOUNCE_LEVELS_HEAT_THICKNESS_SCALE,
  calculateBounceNodeHeight,
  classifyBounceNodeMomentum,
} = require("../src/lib/bounceLevelsPrimitive.ts");

assert.equal(BOUNCE_LEVELS_HEAT_THICKNESS_SCALE, 0.75, "Bounce Levels heat ribbons render at three quarters thickness");
assert.equal(calculateBounceNodeHeight(2, 18, 0), 1.5, "minimum heat thickness is reduced proportionally");
assert.equal(calculateBounceNodeHeight(2, 18, 1), 13.5, "maximum heat thickness is reduced proportionally");

const now = Date.parse("2026-08-14T15:00:00.000Z");
const mapping = {
  method: "live-ratio",
  sourceTicker: "QQQ",
  displayInstrument: "NQ",
  alpha: 0,
  beta: 41,
  sourceSpotPrice: 735,
  displayMidPrice: 30135,
  mappedSourceSpotPrice: 30135,
  mappingConfidence: 96,
  calculatedAtMs: now,
  dataAgeMs: 0,
};
const makeRow = (id, sourceStrike, mappedPrice, netExposure, callExposure = Math.max(netExposure, 0), putExposure = Math.min(netExposure, 0)) => ({
  id,
  sourceTicker: "QQQ",
  displayInstrument: "NQ",
  sourceStrike,
  sourceStrikes: [sourceStrike],
  mappedDisplayPrice: mappedPrice,
  mappedDisplayTick: mappedPrice,
  callExposure,
  putExposure,
  netExposure,
  absoluteCallExposure: Math.abs(callExposure),
  absolutePutExposure: Math.abs(putExposure),
  absoluteTotalExposure: Math.abs(callExposure) + Math.abs(putExposure),
  percentageOfTotalAbsoluteExposure: 0,
  percentageOfVisibleAbsoluteExposure: 0,
  expirationContributions: [],
  mapping,
  sourceSnapshotTimeMs: now,
  receivedTimeMs: now,
});
const rows = [
  makeRow("near-positive", 734, 30094, 80),
  makeRow("negative-king", 735, 30135, -500, 20, -520),
  makeRow("far-positive", 736, 30176, 400),
  makeRow("small", 737, 30217, 5),
];
const profile = {
  schemaVersion: 1,
  id: "profile",
  provider: "quantdata",
  sourceTicker: "QQQ",
  sourceSpotPrice: 735,
  displayInstrument: "NQ",
  displayPrice: 30095,
  representation: "per-one-percent-move",
  expirationLabel: "0–1 DTE",
  expirationDates: ["2026-08-14"],
  rows,
  totalCallExposure: 500,
  totalPutExposure: -520,
  totalNetExposure: -15,
  totalAbsoluteExposure: 985,
  totalRegime: "negative",
  maxPositiveRow: rows[2],
  maxNegativeRow: rows[1],
  dominantAbsoluteRow: rows[1],
  callWallRow: rows[2],
  putWallRow: rows[1],
  mapping,
  snapshotTimeMs: now,
  receivedTimeMs: now,
  refreshAfterMs: 5000,
  status: "live",
  limitations: [],
};
const history = {
  schemaVersion: 1,
  provider: "quantdata",
  representation: "provider-signed-exposure",
  sourceTicker: "QQQ",
  sessionDate: "2026-08-14",
  marketOpen: true,
  status: "LIVE",
  checkedAt: new Date(now).toISOString(),
  refreshAfterMs: 5000,
  aggregationPeriod: "1m",
  limitations: [],
  buckets: [
    { timestamp: now - 120000, sourcePrice: 734.8, rows: rows.map((row) => ({ expirationDate: "2026-08-14", sourceStrike: row.sourceStrike, callExposure: row.callExposure * 0.3, putExposure: row.putExposure * 0.3 })) },
    { timestamp: now - 60000, sourcePrice: 734.9, rows: rows.map((row) => ({ expirationDate: "2026-08-14", sourceStrike: row.sourceStrike, callExposure: row.callExposure * 0.5, putExposure: row.putExposure * 0.5 })) },
    { timestamp: now + 60000, sourcePrice: 735.1, rows: rows.map((row) => ({ expirationDate: "2026-08-14", sourceStrike: row.sourceStrike, callExposure: row.callExposure * 50, putExposure: row.putExposure * 50 })) },
  ],
};

const snapshot = buildBounceLevelsSnapshot(profile, history, { maximumLevels: 3, minimumExposurePercentile: 0, minimumPercentOfKing: 0, minimumRelevanceScore: 0 });
assert.equal(snapshot.king.id, "negative-king", "KING uses the greatest absolute signed exposure, including negative exposure");
assert.equal(snapshot.king.mappedPrice, 30135, "KING is independent of the nearest/current-price row");
assert.equal(snapshot.levels.length, 3, "the configured active-level ceiling is deterministic");
assert.ok(snapshot.levels.some((level) => level.rateOfChangePercent > 0), "history produces deterministic positive node accumulation without reading the future bucket");
assert.ok(snapshot.levels.every((level) => Number.isFinite(level.relevanceScore)), "every retained level has a finite relevance score");
assert.equal(snapshot.king.percentOfKing, 100, "KING is exactly 100 percent of KING magnitude");
assert.equal(snapshot.schemaVersion, 3, "the heat-field payload uses the immutable strike-history schema");
assert.equal(snapshot.exposureField.length, 3, "the exposure field includes lookahead-safe history plus the current live surface");
assert.ok(snapshot.exposureField.every((slice) => slice.timestamp <= now), "the exposure field never renders a future bucket");
assert.ok(snapshot.exposureField.flatMap((slice) => slice.nodes).every((node) => Number.isFinite(node.strength) && node.strength > 0), "every rendered heat node has a finite magnitude strength");
assert.ok(snapshot.floor && snapshot.floor.mappedPrice < profile.displayPrice, "floor is selected below current display price");
assert.ok(snapshot.ceiling && snapshot.ceiling.mappedPrice > profile.displayPrice, "ceiling is selected above current display price");
assert.equal(selectLookaheadSafeBounceBucket(history, now).timestamp, now - 60000, "replay selects the latest snapshot at or before replay time");
assert.equal(selectLookaheadSafeBounceBucket(history, now - 180000), null, "replay never reaches forward when no prior snapshot exists");
assert.equal(classifyBounceNodeMomentum(18), "building", "positive node momentum expands the live edge");
assert.equal(classifyBounceNodeMomentum(2), "stable", "small node changes keep a flat live edge");
assert.equal(classifyBounceNodeMomentum(-18), "weakening", "moderate unwinds taper the live edge");
assert.equal(classifyBounceNodeMomentum(-60), "dumped", "rapid unwinds collapse into a short decay tail");

const priorSessionTime = Date.parse("2026-08-13T15:00:00.000Z");
const priorSessionSurface = {
  ...history,
  sessionDate: "2026-08-13",
  status: "HISTORICAL",
  aggregationPeriod: "5m",
  buckets: [{
    timestamp: priorSessionTime,
    sourcePrice: 733,
    rows: [{ expirationDate: "2026-08-13", sourceStrike: 733, callExposure: 250, putExposure: 0 }],
  }],
};
const mergedWeeklySurface = mergeBounceIntervalSurfaces(priorSessionSurface, history);
assert.deepEqual(
  mergedWeeklySurface.buckets.map((bucket) => bucket.timestamp),
  [priorSessionTime, now - 120000, now - 60000, now + 60000],
  "weekly history and the current one-minute session are merged chronologically",
);
const weeklySnapshot = buildBounceLevelsSnapshot(profile, mergedWeeklySurface, {
  maximumNodesPerSlice: 8,
  historyBuckets: BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT,
});
assert.ok(
  weeklySnapshot.exposureField.some((slice) => slice.timestamp === priorSessionTime && slice.nodes.some((node) => node.sourceStrike === 733)),
  "historical 0DTE rows are filtered against their own New York session date rather than today's expiration",
);

const oldSlices = Array.from({ length: 900 }, (_, index) => ({
  ...snapshot.exposureField[0],
  timestamp: now - (900 - index) * 300_000,
}));
const retainedWeeklySnapshot = mergeBounceLevelsSnapshots(
  { ...snapshot, exposureField: oldSlices },
  snapshot,
);
assert.ok(retainedWeeklySnapshot.exposureField.length > 720, "browser snapshot merging no longer truncates weekly history at the old 720-bucket ceiling");

const zeroRows = rows.map((row) => makeRow(`zero-${row.id}`, row.sourceStrike, row.mappedDisplayPrice, 0, 0, 0));
const zeroSnapshot = buildBounceLevelsSnapshot({ ...profile, id: "zero-profile", rows: zeroRows }, null, { maximumLevels: 8, minimumExposurePercentile: 0, minimumPercentOfKing: 0, minimumRelevanceScore: 0 });
assert.equal(zeroSnapshot.king, null, "an all-zero filtered surface has no KING");
assert.equal(zeroSnapshot.mapSignature.startsWith("none|"), true, "the structural signature explicitly records no KING");

const migratedRows = rows.map((row) => row.id === "far-positive" ? { ...row, netExposure: 900, callExposure: 900, absoluteCallExposure: 900, absoluteTotalExposure: 900 } : row);
const migrated = buildBounceLevelsSnapshot({ ...profile, id: "migrated-profile", rows: migratedRows }, history, { maximumLevels: 4, minimumExposurePercentile: 0, minimumPercentOfKing: 0, minimumRelevanceScore: 0 });
assert.equal(migrated.king.id, "far-positive", "KING migrates deterministically when another absolute signed exposure becomes dominant");
assert.notEqual(migrated.mapSignature, snapshot.mapSignature, "KING migration changes the structural map signature used by alerts");

const directMapping = { ...mapping, method: "same-underlying-direct", sourceTicker: "SPY", displayInstrument: "SPY", alpha: 0, beta: 1, sourceSpotPrice: 600, displayMidPrice: 600, mappedSourceSpotPrice: 600 };
const directRows = [makeRow("spy-600", 600, 600, 250), makeRow("spy-605", 605, 605, -150)].map((row) => ({ ...row, sourceTicker: "SPY", displayInstrument: "SPY", mapping: directMapping }));
const directProfile = { ...profile, id: "spy-profile", sourceTicker: "SPY", displayInstrument: "SPY", sourceSpotPrice: 600, displayPrice: 601, rows: directRows, mapping: directMapping, maxPositiveRow: directRows[0], maxNegativeRow: directRows[1], dominantAbsoluteRow: directRows[0], callWallRow: directRows[0], putWallRow: directRows[1] };
const directHistory = { ...history, sourceTicker: "SPY", buckets: history.buckets.slice(0, 2).map((bucket) => ({ ...bucket, sourcePrice: 600, rows: directRows.map((row) => ({ expirationDate: "2026-08-14", sourceStrike: row.sourceStrike, callExposure: row.callExposure, putExposure: row.putExposure })) })) };
const directSnapshot = buildBounceLevelsSnapshot(directProfile, directHistory, { maximumLevels: 2, maximumNodesPerSlice: 8 });
assert.ok(directSnapshot.exposureField.flatMap((slice) => slice.nodes).some((node) => node.sourceStrike === 600 && node.mappedPrice === 600), "native option underlyings retain exact strike-to-price mapping");

const source = fs.readFileSync(path.join(root, "src/app/api/bounce-levels/route.ts"), "utf8");
assert.doesNotMatch(source, /NEXT_PUBLIC_(?:QUANTDATA|GEX)[A-Z_]*(?:KEY|TOKEN|SECRET)/, "provider credentials remain server-only");
assert.match(source, /selectLookaheadSafeBounceBucket/, "the API uses the tested lookahead-safe selector");

const migrationTimes = [0, 1, 2, 3, 4].map((minute) => now + minute * 60_000);
const migrationValues = [[100, 10], [80, 25], [55, 60], [25, 100], [5, 130]].map(([left, right]) => [left * 1_000_000, right * 1_000_000]);
const migrationRow = (strike, exposure, timestamp) => ({
  ...makeRow(`migration-${strike}`, strike, strike, exposure, Math.max(exposure, 0), Math.min(exposure, 0)),
  sourceTicker: "QQQ",
  displayInstrument: "QQQ",
  mapping: { ...mapping, method: "same-underlying-direct", displayInstrument: "QQQ", beta: 1, sourceSpotPrice: 742.5, displayMidPrice: 742.5, mappedSourceSpotPrice: 742.5 },
  sourceSnapshotTimeMs: timestamp,
  receivedTimeMs: timestamp,
});
const migrationSurface = {
  ...history,
  buckets: migrationTimes.slice(0, -1).map((timestamp, index) => ({
    timestamp,
    sourcePrice: 742.5,
    rows: [742, 743].map((strike, strikeIndex) => ({ expirationDate: "2026-08-14", sourceStrike: strike, callExposure: migrationValues[index][strikeIndex], putExposure: 0 })),
  })),
};
const migrationProfile = {
  ...profile,
  id: "strike-migration-profile",
  sourceTicker: "QQQ",
  displayInstrument: "QQQ",
  sourceSpotPrice: 742.5,
  displayPrice: 742.5,
  snapshotTimeMs: migrationTimes[4],
  receivedTimeMs: migrationTimes[4],
  mapping: { ...mapping, method: "same-underlying-direct", displayInstrument: "QQQ", beta: 1, sourceSpotPrice: 742.5, displayMidPrice: 742.5, mappedSourceSpotPrice: 742.5 },
  rows: [742, 743].map((strike, index) => migrationRow(strike, migrationValues[4][index], migrationTimes[4])),
};
const migrationSnapshot = buildBounceLevelsSnapshot(migrationProfile, migrationSurface, {
  maximumLevels: 2,
  maximumNodesPerSlice: 2,
  minimumExposurePercentile: 0,
  minimumPercentOfKing: 0,
  minimumRelevanceScore: 0,
  activeEnterThreshold: 0.05,
  activeExitThreshold: 0.08,
  retirementConfirmationSnapshots: 3,
  visualStrengthBasis: "percent-of-king",
  rollWeakeningThreshold: 40,
  rollBuildingThreshold: 40,
  maxRollDistance: 1,
  rollWindowMs: 120_000,
});
const migration742 = migrationSnapshot.exposureSeries.find((series) => series.strike === 742);
const migration743 = migrationSnapshot.exposureSeries.find((series) => series.strike === 743);
assert.ok(migration742 && migration743, "742 and 743 are stored as two independent strike series");
assert.notEqual(migration742.nodeKey, migration743.nodeKey, "strike identity cannot be reused during a roll");
assert.deepEqual(migration742.samples.map((sample) => sample.absoluteExposure), migrationValues.map((values) => values[0]), "742 keeps its complete weakening history");
assert.deepEqual(migration743.samples.map((sample) => sample.absoluteExposure), migrationValues.map((values) => values[1]), "743 keeps its complete building history");
assert.equal(migration742.samples[0].percentOfKing, 1, "742 t0 strength is finalized against the t0 King");
assert.equal(migration743.samples[0].percentOfKing, 0.1, "743 t0 strength is finalized against the t0 King");
assert.equal(migrationSnapshot.exposureField[2].kingStrike, 743, "King changes to 743 at t2");
assert.equal(migrationSnapshot.exposureField[0].nodes.find((node) => node.sourceStrike === 742).visualStrength, 1, "later King migration does not rewrite 742 t0 pixels");
assert.ok(migrationSnapshot.exposureField.at(-1).nodes.some((node) => node.sourceStrike === 742), "742 remains visible during hysteresis retirement after leaving Top-N strength");
assert.ok(migrationSnapshot.rolls.some((roll) => roll.fromStrike === 742 && roll.toStrike === 743 && roll.direction === "UP"), "derived roll analytics detect 742 weakening while 743 builds");
assert.equal(migrationSnapshot.exposureRefreshIntervalMs, 60_000, "effective cadence is measured from real provider timestamps");

const negativeValues = [[-100, -10], [-70, -40], [-30, -120]].map(([left, right]) => [left * 1_000_000, right * 1_000_000]);
const negativeSurface = {
  ...migrationSurface,
  buckets: migrationTimes.slice(0, 2).map((timestamp, index) => ({
    timestamp,
    sourcePrice: 742.5,
    rows: [742, 743].map((strike, strikeIndex) => ({ expirationDate: "2026-08-14", sourceStrike: strike, callExposure: 0, putExposure: negativeValues[index][strikeIndex] })),
  })),
};
const negativeProfile = {
  ...migrationProfile,
  id: "negative-strike-migration-profile",
  snapshotTimeMs: migrationTimes[2],
  receivedTimeMs: migrationTimes[2],
  rows: [742, 743].map((strike, index) => migrationRow(strike, negativeValues[2][index], migrationTimes[2])),
};
const negativeSnapshot = buildBounceLevelsSnapshot(negativeProfile, negativeSurface, { maximumNodesPerSlice: 2, activeEnterThreshold: 0.05, activeExitThreshold: 0.02 });
const negativeFinal = negativeSnapshot.exposureField.at(-1).nodes;
assert.ok(negativeFinal.find((node) => node.sourceStrike === 742).shortRateOfChange < 0, "negative 742 exposure is weakening by absolute magnitude");
assert.ok(negativeFinal.find((node) => node.sourceStrike === 743).shortRateOfChange > 0, "more-negative 743 exposure is correctly classified as building by absolute magnitude");

const replayMigration = buildBounceLevelsSnapshot({ ...migrationProfile, snapshotTimeMs: migrationTimes[2], receivedTimeMs: migrationTimes[2], rows: [742, 743].map((strike, index) => migrationRow(strike, migrationValues[2][index], migrationTimes[2])) }, migrationSurface, { maximumNodesPerSlice: 2, activeEnterThreshold: 0.05 });
assert.ok(replayMigration.exposureSeries.every((series) => series.samples.every((sample) => sample.timestamp <= migrationTimes[2])), "replay series contain no future exposure samples");

console.log("Bounce Levels tests passed");
