import assert from "node:assert/strict";
import test from "node:test";

import { latestGexMapStrikesFromFrames } from "../src/lib/gexMap.ts";

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
