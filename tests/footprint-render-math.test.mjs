import assert from "node:assert/strict";
import test from "node:test";
import { footprintPercentile } from "../src/lib/footprintRenderMath.ts";

test("renderer quickselect returns the same exact percentile as sorting", () => {
  const values = Array.from({ length: 10_001 }, (_, index) => ((index * 7919) % 997) + (index % 7));
  for (const fraction of [0.5, 0.7, 0.95, 1]) {
    const ordered = [...values].sort((left, right) => left - right);
    const target = Math.floor((ordered.length - 1) * fraction);
    assert.equal(footprintPercentile([...values], fraction), Math.max(1, ordered[target]));
  }
});

test("renderer percentile keeps empty and sub-contract scales usable", () => {
  assert.equal(footprintPercentile([], 0.95), 1);
  assert.equal(footprintPercentile([0, 0, 0], 0.95), 1);
});
