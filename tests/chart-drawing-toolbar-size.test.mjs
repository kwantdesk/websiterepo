import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

test("the shared per-chart drawing toolbar is one quarter smaller", () => {
  assert.match(chart, /const buttonSize = smooth\(28\.5, 9\.9\)/);
  assert.match(chart, /const iconSize = smooth\(12\.75, 5\.25\)/);
  assert.match(chart, /const gap = smooth\(2\.25, 1\.1\)/);
  assert.match(chart, /rounded-md border border-border\/80 bg-panel\/92 p-\[2px\]/);
  assert.doesNotMatch(chart, /const buttonSize = smooth\(38,/);
});
