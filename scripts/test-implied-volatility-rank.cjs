const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const filename = path.join(__dirname, "..", "src", "lib", "impliedVolatilityRank.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const moduleUnderTest = { exports: {} };
new Function("exports", "require", "module", "__filename", "__dirname", output)(
  moduleUnderTest.exports,
  require,
  moduleUnderTest,
  filename,
  path.dirname(filename),
);

const {
  automaticIvSourceTicker,
  buildIvRankSnapshot,
  calculateIvPercentile,
  calculateIvRank,
  combineCallPutLegs,
  deriveIvRankDisplayStatus,
  displayIvPercent,
  interpolateConstantMaturityIv,
  impliedVolatilityRankCacheKey,
} = moduleUnderTest.exports;

assert.ok(Math.abs(calculateIvRank(0.3, 0.2, 0.4) - 50) < 1e-10);
assert.equal(calculateIvRank(0.2, 0.2, 0.4), 0);
assert.equal(calculateIvRank(0.4, 0.2, 0.4), 100);
assert.equal(calculateIvRank(0.1, 0.2, 0.4), 0, "rank clamps below zero by default");
assert.equal(calculateIvRank(0.5, 0.2, 0.4), 100, "rank clamps above 100 by default");
assert.ok(calculateIvRank(0.5, 0.2, 0.4, { clampToZeroHundred: false }) > 100, "rank can expose an expanded range when clamping is disabled");
assert.equal(calculateIvRank(0.2, 0.2, 0.2), null, "zero-width IV windows are unavailable");
assert.equal(calculateIvPercentile([0.1, 0.2, 0.3, 0.4], 0.3), 50);
assert.equal(calculateIvPercentile([0.1, 0.2, 0.3, 0.4], 0.3, "below-or-equal"), 75);
assert.equal(calculateIvPercentile([0.1, 0.2, 0.3, 0.4], 0.3, "mid-rank"), 62.5);
assert.equal(displayIvPercent(0.2538), "25.38%", "fractional provider IV is converted once");
assert.equal(deriveIvRankDisplayStatus({ status: "live", hasPriorSessionRange: true }).label, "LIVE IV · PRIOR SESSION RANGE");
assert.equal(deriveIvRankDisplayStatus({ status: "prior-session" }).shortLabel, "PRIOR");
assert.equal(deriveIvRankDisplayStatus({ status: "delayed", ageMs: 15 * 60_000 }).label, "DELAYED · 15m");
assert.equal(deriveIvRankDisplayStatus({ status: "stale", ageMs: 2 * 60_000 }).label, "STALE · LAST UPDATE 2m");
assert.equal(deriveIvRankDisplayStatus({ status: "unavailable" }).label, "UNAVAILABLE");

const combined = combineCallPutLegs(
  { lastIv: 0.4, windowMinimumIv: 0.2, windowMaximumIv: 0.8, ivRank: 33.3 },
  { lastIv: 0.2, windowMinimumIv: 0.1, windowMaximumIv: 0.5, ivRank: 25 },
);
assert.ok(Math.abs(combined.lastIv - 0.3) < 1e-10);
assert.ok(Math.abs(combined.windowMinimumIv - 0.15) < 1e-10);
assert.ok(Math.abs(combined.windowMaximumIv - 0.65) < 1e-10);
assert.equal(combined.ivRank, null);
assert.ok(interpolateConstantMaturityIv({ iv1: 0.2, time1: 10, iv2: 0.3, time2: 40, targetTime: 30 }) > 0.2);
assert.equal(automaticIvSourceTicker("MNQU6"), "QQQ");
assert.equal(automaticIvSourceTicker("ESU6"), "SPY");
assert.equal(
  impliedVolatilityRankCacheKey({ sourceTicker: "qqq", displayInstrument: "mnq", lookBackPeriodDays: 252, targetMaturityDays: 30, contractMode: "average-call-put", useLiveIntradayIv: true }),
  "quantdata:QQQ:MNQ:252:30:average-call-put:live:5:carry",
);

const payload = {
  data: {
    "2026-08-13": {
      expirationDate: "2026-09-11",
      stockPrice: 730,
      contractTypeToIVData: {
        CALL: { lastIv: 0.3, windowMinIv: 0.2, windowMaxIv: 0.4 },
        PUT: { lastIv: 0.5, windowMinIv: 0.3, windowMaxIv: 0.7 },
      },
    },
    "2026-08-14": {
      expirationDate: "2026-09-11",
      stockPrice: 735,
      contractTypeToIVData: {
        CALL: { lastIv: 0.35, windowMinIv: 0.2, windowMaxIv: 0.5 },
        PUT: { lastIv: 0.45, windowMinIv: 0.3, windowMaxIv: 0.7 },
      },
    },
  },
};
const snapshot = buildIvRankSnapshot(payload, null, {
  sourceTicker: "QQQ",
  displayInstrument: "NQ",
  contractMode: "average-call-put",
  lookBackPeriodDays: 252,
  targetMaturityDays: 30,
  marketOpen: false,
  nowMs: Date.parse("2026-08-16T00:00:00Z"),
});
assert.equal(snapshot.observations.length, 2);
assert.equal(snapshot.latestHistorical.sessionDate, "2026-08-14");
assert.equal(snapshot.latestHistorical.combined.lastIv, 0.4);
assert.equal(snapshot.current.status, "prior-session");
assert.equal(snapshot.provider, "quantdata");

for (const [mode, expected] of [["call", 50], ["put", 37.5], ["average-call-put", 42.8571428571], ["call-put-split", 42.8571428571]]) {
  const modeSnapshot = buildIvRankSnapshot(payload, null, {
    sourceTicker: "QQQ",
    displayInstrument: "NQ",
    contractMode: mode,
    lookBackPeriodDays: 252,
    targetMaturityDays: 30,
    marketOpen: false,
    nowMs: Date.parse("2026-08-16T00:00:00Z"),
  });
  assert.ok(Math.abs(modeSnapshot.current.ivRank - expected) < 1e-6, `${mode} selects an independently calculated rank`);
}

const oneLegSnapshot = buildIvRankSnapshot({ data: { "2026-08-14": {
  expirationDate: "2026-09-11",
  stockPrice: 735,
  contractTypeToIVData: { CALL: { lastIv: 0.3, windowMinIv: 0.2, windowMaxIv: 0.4 } },
} } }, null, {
  sourceTicker: "QQQ",
  displayInstrument: "NQ",
  contractMode: "average-call-put",
  lookBackPeriodDays: 252,
  targetMaturityDays: 30,
  marketOpen: false,
  nowMs: Date.parse("2026-08-16T00:00:00Z"),
});
assert.ok(Math.abs(oneLegSnapshot.current.ivRank - 50) < 1e-10, "a configured missing-leg fallback retains the available leg");
assert.match(oneLegSnapshot.latestHistorical.dataQuality.warnings[0], /Only the call IV leg/);

const unavailableSnapshot = buildIvRankSnapshot({ data: {} }, null, {
  sourceTicker: "QQQ",
  displayInstrument: "NQ",
  contractMode: "average-call-put",
  lookBackPeriodDays: 252,
  targetMaturityDays: 30,
  marketOpen: false,
});
assert.equal(unavailableSnapshot.current, null);
assert.equal(unavailableSnapshot.overallStatus, "unavailable");

console.log("Implied Volatility Rank formula and normalization tests passed.");
