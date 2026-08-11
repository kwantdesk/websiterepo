import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_FREQUENT_EMOJIS, rankedEmojis } from "../src/lib/emojis.ts";

test("emoji ranking starts with stable defaults", () => {
  assert.deepEqual(rankedEmojis({}, 5), DEFAULT_FREQUENT_EMOJIS.slice(0, 5));
});

test("frequently used emojis replace defaults in the quick strip", () => {
  const ranked = rankedEmojis({ "🚀": 12, "💎": 4, "👍": 1 }, 5);
  assert.equal(ranked[0], "🚀");
  assert.equal(ranked[1], "💎");
  assert.ok(ranked.includes("👍"));
});
