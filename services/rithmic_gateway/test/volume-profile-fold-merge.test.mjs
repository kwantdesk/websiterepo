import test from "node:test";
import assert from "node:assert/strict";

import {
  combinedVolumeProfileCoverage,
  volumeProfileSourcesHaveGap,
  volumeProfileTailTrades,
} from "../src/volume-profile-fold-merge.mjs";

test("a folded live profile appends only newer Rithmic prints", () => {
  const folded = { coverageStartMs: 100, coverageEndMs: 300 };
  const trades = [200, 300, 301, 450].map((timestampMs) => ({ timestampMs }));
  assert.deepEqual(
    volumeProfileTailTrades(trades, folded).map((trade) => trade.timestampMs),
    [301, 450],
  );
});

test("a stale checkpoint cannot hide a hole before the live ring", () => {
  const folded = { coverageStartMs: 100, coverageEndMs: 300 };
  assert.equal(volumeProfileSourcesHaveGap(folded, [{ timestampMs: 301 }]), false);
  assert.equal(
    volumeProfileSourcesHaveGap(folded, [{ timestampMs: 60_301 }]),
    false,
    "a genuinely quiet minute is not proof that data went missing",
  );
  assert.equal(volumeProfileSourcesHaveGap(folded, [{ timestampMs: 300_301 }]), true);
});

test("a stale fold and its live suffix report combined coverage", () => {
  assert.deepEqual(
    combinedVolumeProfileCoverage(
      { coverageStartMs: 100, coverageEndMs: 300 },
      [{ timestampMs: 301 }, { timestampMs: 450 }],
    ),
    { coverageStartMs: 100, coverageEndMs: 450 },
  );
});

test("without a fold the entire ring remains eligible", () => {
  const trades = [{ timestampMs: 10 }, { timestampMs: 20 }];
  assert.equal(volumeProfileTailTrades(trades, null), trades);
  assert.deepEqual(combinedVolumeProfileCoverage(null, trades), {
    coverageStartMs: 10,
    coverageEndMs: 20,
  });
});
