import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePositioningWallTouches,
  createPositioningWallEpisodes,
  reconstructPositioningWallSamples,
} from "../src/lib/positioningWallResearch.ts";

test("reconstructs the 65/35 GEX/DEX wall ranking without future observations", () => {
  const gammaFrames = [{
    timestamp: 60_000,
    updates: [
      { strike: 99, call: 0, put: 0, net: 50 },
      { strike: 100, call: 0, put: 0, net: 100 },
      { strike: 101, call: 0, put: 0, net: 80 },
    ],
  }];
  const deltaFrames = [{
    timestamp: 60_000,
    updates: [
      { strike: 99, call: 0, put: 0, net: 100 },
      { strike: 100, call: 0, put: 0, net: 20 },
      { strike: 101, call: 0, put: 0, net: 10 },
    ],
  }];
  const samples = reconstructPositioningWallSamples({
    gammaFrames,
    deltaFrames,
    sourceCandles: [{ timestamp: 60_000, open: 100, high: 100, low: 100, close: 100, volume: 1 }],
    futuresCandles: [{ timestamp: 60_000, open: 200, high: 200, low: 200, close: 200, volume: 1 }],
    limit: 3,
  });
  assert.equal(samples.length, 3);
  assert.equal(samples[0].sourceStrike, 100);
  assert.equal(samples[0].midpoint, 200);
  assert.ok(Math.abs(samples[0].score - 0.72) < 1e-9);
  assert.equal(samples[1].sourceStrike, 99);
});

test("groups repeated frames into one lifecycle instead of counting each minute as a new wall", () => {
  const base = {
    rank: 1,
    sourceStrike: 100,
    midpoint: 200,
    score: 1,
    netGex: 10,
    netDex: 5,
    futuresPrice: 200,
    sourcePrice: 100,
  };
  const episodes = createPositioningWallEpisodes([
    { ...base, timestamp: 60_000 },
    { ...base, timestamp: 120_000 },
    { ...base, timestamp: 20 * 60_000 },
  ]);
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].samples.length, 2);
});

test("tests midpoint and fixed edges separately and records exact first-touch reactions", () => {
  const sample = {
    timestamp: 60_000,
    rank: 1,
    sourceStrike: 100,
    midpoint: 200,
    score: 1,
    netGex: 100,
    netDex: 50,
    futuresPrice: 190,
    sourcePrice: 95,
  };
  const study = analyzePositioningWallTouches({
    root: "NQ",
    samples: [sample],
    futuresCandles: [
      { timestamp: 0, open: 190, high: 191, low: 189, close: 190 },
      { timestamp: 60_000, open: 193, high: 194, low: 192, close: 193 },
      { timestamp: 120_000, open: 193, high: 194, low: 184, close: 185 },
      { timestamp: 180_000, open: 185, high: 186, low: 180, close: 181 },
    ],
    reactionWindowMinutes: 5,
    reactionThreshold: 8,
    adverseTolerance: 4,
  });
  const bottom = study.touches.find((touch) => touch.line === "BOTTOM");
  assert.ok(bottom);
  assert.equal(bottom.price, 194);
  assert.equal(bottom.approach, "FROM_BELOW");
  assert.equal(bottom.exactExtremeTouch, true);
  assert.equal(bottom.cleanReaction, true);
});
