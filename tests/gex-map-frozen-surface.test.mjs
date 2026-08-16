import assert from "node:assert/strict";
import test from "node:test";

import {
  hasRenderableGexMapSurface,
  latestGexMapStrikesFromFrames,
  selectGexMapKingNode,
} from "../src/lib/gexMap.ts";

test("a frozen GEX surface is rebuilt from incremental session frames", () => {
  const rows = latestGexMapStrikesFromFrames([
    {
      timestamp: 1,
      updates: [
        { strike: 100, call: 10, put: -2, net: 8 },
        { strike: 105, call: 4, put: -7, net: -3 },
      ],
    },
    {
      timestamp: 2,
      updates: [
        { strike: 100, call: 13, put: -3, net: 10 },
        { strike: 110, call: 6, put: -1, net: 5 },
      ],
    },
  ]);

  assert.deepEqual(rows, [
    { strike: 100, call: 13, put: -3, net: 10 },
    { strike: 105, call: 4, put: -7, net: -3 },
    { strike: 110, call: 6, put: -1, net: 5 },
  ]);
});

test("empty cached surfaces cannot replace a visible GEX ladder", () => {
  assert.equal(hasRenderableGexMapSurface({ latestStrikes: [], frames: [] }), false);
  assert.equal(hasRenderableGexMapSurface({
    latestStrikes: [],
    frames: [{
      timestamp: 1,
      updates: [{ strike: 100, call: 10, put: -2, net: 8 }],
    }],
  }), true);
});

test("King Node uses the largest absolute raw signed exposure across the complete surface", () => {
  const completeFilteredSurface = [
    { strike: 7_780, call: 2_000_000_000, put: -1_000_000_000, net: 1_000_000_000 },
    { strike: 7_785, call: 250_000_000, put: -75_300_000_000, net: -75_050_000_000 },
    { strike: 7_790, call: 72_000_000_000, put: -1_000_000_000, net: 71_000_000_000 },
  ];

  assert.deepEqual(selectGexMapKingNode(completeFilteredSurface), completeFilteredSurface[1]);
});

test("King Node ignores non-finite exposure and does not prefer positive values", () => {
  assert.deepEqual(selectGexMapKingNode([
    { strike: 100, call: 0, put: 0, net: Number.NaN },
    { strike: 105, call: 20, put: 0, net: 20 },
    { strike: 110, call: 0, put: -25, net: -25 },
  ]), { strike: 110, call: 0, put: -25, net: -25 });
  assert.equal(selectGexMapKingNode([]), null);
});
