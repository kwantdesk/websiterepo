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

console.log("TPO single print tests passed.");
