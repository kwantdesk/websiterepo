import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chartSource = await fs.readFile(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);

test("every chart level label family anchors its name at the left edge", () => {
  assert.match(chartSource, /const labelX = 7;/);
  assert.match(chartSource, /const x = 4;/);
  assert.match(chartSource, /const labelLeft = 4;/);
  assert.match(chartSource, /const left = 4;/);
  assert.match(chartSource, /const labelX = 10;/);
  assert.doesNotMatch(chartSource, /mediaSize\.width - width - 5/);
  assert.doesNotMatch(chartSource, /plotWidth - labelWidth - 10/);
});

test("level labels use compact square tags instead of rounded pills", () => {
  assert.match(chartSource, /roundRect\(x, y - 6, width, 12, 1\)/);
  assert.match(chartSource, /roundRect\(labelLeft, labelTop, labelWidth, 17, 1\)/);
  assert.match(chartSource, /roundRect\(left, y - 8, width, 16, 1\)/);
  assert.match(chartSource, /height=\{17\}[\s\S]*?rx=\{1\}/);
  assert.doesNotMatch(chartSource, /roundRect\(left, y - 9, width, 18, 5\)/);
});
