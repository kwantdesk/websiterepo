import assert from "node:assert/strict";

import { detectSinglePrints } from "../src/lib/tpo/engine.ts";

// A realistic daily profile shape: a fat middle (many subperiod visits), two
// thin interior low-volume shelves, and long single-visit tails at both
// extremes. This is exactly the case the trader described — the tails show up
// while the interior thin shelves do not.
const row = (tick, tpoCount, volume) => ({
  rowTick: tick,
  lowTick: tick,
  highTick: tick,
  tpoCount,
  volume,
  bidVolume: null,
  askVolume: null,
  delta: null,
  letters: "",
  isValueArea: false,
  isPoc: false,
});

const rows = [
  // lower tail: 6 contiguous single-visit rows
  ...[0, 1, 2, 3, 4, 5].map((t) => row(t, 1, 10)),
  // body
  row(6, 8, 900), row(7, 9, 950),
  // interior thin shelf A: two single-visit rows
  row(8, 1, 12), row(9, 1, 14),
  // body
  row(10, 7, 800), row(11, 9, 990), row(12, 8, 870),
  // interior thin shelf B: one single-visit row
  row(13, 1, 9),
  // body
  row(14, 6, 700), row(15, 7, 760),
  // upper tail: 6 contiguous single-visit rows
  ...[16, 17, 18, 19, 20, 21].map((t) => row(t, 1, 11)),
];

const zoneSpan = (zone) => zone.highTick - zone.lowTick + 1;
const isInterior = (zone) => zone.lowTick > 5 && zone.highTick < 16;

// --- 1. With everything open, every thin run is marked, interior included ---
const all = detectSinglePrints(rows, 1, true, 0, 0, 1);
assert.equal(all.length, 4, `expected 4 zones (2 tails + 2 interior), got ${all.length}`);
assert.equal(all.filter(isInterior).length, 2, "both interior shelves must be marked");

// --- 2. A tall Minimum-ticks filter silently removes ONLY the interior ones ---
const minTicks12 = detectSinglePrints(rows, 12, true, 0, 0, 1);
assert.equal(
  minTicks12.filter(isInterior).length,
  0,
  "with a 12-tick minimum the interior shelves are filtered out — this is why only the extremes showed",
);

// --- 3. Quality ranks by thin TRADE, so interior shelves survive it ---------
const quality60 = detectSinglePrints(rows, 1, true, 60, 0, 1);
assert.ok(
  quality60.length < all.length,
  "quality above zero must drop some zones",
);
assert.ok(
  quality60.some(isInterior),
  "quality must not systematically discard the interior low-volume shelves",
);

// --- 4. Thinness reveals shelves the strict definition cannot ---------------
const thickShelf = [
  row(0, 9, 900), row(1, 8, 880),
  row(2, 3, 30), row(3, 2, 25), // visibly thin, but NOT single prints
  row(4, 9, 910), row(5, 8, 890),
];
assert.equal(
  detectSinglePrints(thickShelf, 1, true, 0, 0, 1).length,
  0,
  "strict single prints cannot see a 2-3 visit shelf",
);
const revealed = detectSinglePrints(thickShelf, 1, true, 0, 0, 3);
assert.equal(revealed.length, 1, "thinness 3 reveals the low-volume shelf");
assert.equal(revealed[0].lowTick, 2);
assert.equal(revealed[0].highTick, 3);

// --- 5. Excluding extremes leaves the interior structure intact -------------
const interiorOnly = detectSinglePrints(rows, 1, false, 0, 0, 1);
assert.equal(
  interiorOnly.filter(isInterior).length,
  2,
  "turning extremes off must keep the interior shelves",
);
assert.ok(
  interiorOnly.every((zone) => isInterior(zone)),
  "turning extremes off must drop the tails",
);

// --- 6. Step downs are relative, which is what marks interior shelves -------
// A profile that steps 8 -> 2 -> 8 has a hole in it. The absolute test cannot
// see it at any thinness below 2, because 2 is not "thin" in absolute terms —
// only measuring the DROP against the surrounding rows finds it.
const stepped = [
  row(0, 8, 800), row(1, 8, 800), row(2, 8, 800),
  row(3, 2, 40),
  row(4, 8, 800), row(5, 8, 800), row(6, 8, 800),
];
const strictOnly = detectSinglePrints(stepped, 1, true, 0, 0, 1, 0);
assert.equal(strictOnly.length, 0, "a 2-wide row is not a strict single print");

const byStep = detectSinglePrints(stepped, 1, true, 0, 0, 1, 3);
assert.equal(byStep.length, 1, "a drop of 6 against its neighbours is a step down");
assert.equal(byStep[0].lowTick, 3);
assert.equal(byStep[0].highTick, 3);

// The same 2-wide row in a thin profile is NOT a step down: nothing around it
// is any wider, so there is no hole in the auction to mark.
const uniformlyThin = [row(0, 2, 40), row(1, 2, 40), row(2, 2, 40), row(3, 2, 40)];
assert.equal(
  detectSinglePrints(uniformlyThin, 1, true, 0, 0, 1, 3).length,
  0,
  "a uniformly thin profile has no step downs",
);

// Depth is adjustable: requiring a drop of 7 rejects a drop of 6.
assert.equal(
  detectSinglePrints(stepped, 1, true, 0, 0, 1, 7).length,
  0,
  "raising the required drop excludes shallower steps",
);
// 0 turns the relative test off entirely, leaving the strict behaviour.
assert.equal(
  detectSinglePrints(stepped, 1, true, 0, 0, 1, 0).length,
  0,
  "step down 0 keeps only strict single prints",
);

// Deeper steps of every width qualify: 1, 2, 3 and 4 wide against an 8 shoulder.
for (const width of [1, 2, 3, 4]) {
  const profile = [
    row(0, 8, 800), row(1, 8, 800),
    row(2, width, width * 20),
    row(3, 8, 800), row(4, 8, 800),
  ];
  assert.equal(
    detectSinglePrints(profile, 1, true, 0, 0, 1, 3).length,
    1,
    `a ${width}-wide row under an 8-wide shoulder is a step down`,
  );
}

// --- 7. A low-volume area is entered AND left -------------------------------
// A run that steps down and never recovers is the profile's tail, not a hole
// inside the auction. That one-sided case was most of the noise.
const oneSided = [
  row(0, 8, 800), row(1, 8, 800),
  row(2, 2, 40), row(3, 2, 40), row(4, 2, 40),
];
assert.equal(
  detectSinglePrints(oneSided, 1, false, 0, 0, 1, 3).length,
  0,
  "a step down that never steps back up is a tail, not a low-volume area",
);

// The same run with a shoulder on the far side is a real hole.
const pocketed = [
  row(0, 8, 800), row(1, 8, 800),
  row(2, 2, 40), row(3, 2, 40), row(4, 2, 40),
  row(5, 8, 800), row(6, 8, 800),
];
const pocket = detectSinglePrints(pocketed, 1, false, 0, 0, 1, 3);
assert.equal(pocket.length, 1, "a run with a matching opposite step is marked");
assert.equal(pocket[0].lowTick, 2, "the zone widens from the step...");
assert.equal(pocket[0].highTick, 4, "...until it meets the equivalent opposite");

console.log("TPO single print tests passed.");
