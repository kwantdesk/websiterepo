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
