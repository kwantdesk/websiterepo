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

const { buildBounceLevelsSnapshot, selectLookaheadSafeBounceBucket } = require("../src/lib/bounceLevels.ts");
const { classifyBounceNodeMomentum } = require("../src/lib/bounceLevelsPrimitive.ts");

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
assert.equal(snapshot.schemaVersion, 2, "the heat-field payload uses the current schema");
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

console.log("Bounce Levels tests passed");
