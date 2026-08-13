import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(
  new URL("../src/components/ChartIndicatorPanes.tsx", import.meta.url),
  "utf8",
);

test("CVD owns an independent right-axis wheel scale", () => {
  assert.match(source, /verticalScaleByPane/);
  assert.match(source, /cvd-price-scale-/);
  assert.match(source, /aria-label="Scale CVD vertically"/);
  assert.match(source, /event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?setVerticalScaleByPane/);
});

test("CVD scaling is bounded and can be reset without changing the main chart", () => {
  assert.match(source, /Math\.max\(0\.2, Math\.min\(8,/);
  assert.match(source, /onDoubleClick=[\s\S]*?delete next\[group\.key\]/);
  assert.doesNotMatch(source, /cvd-price-scale-[\s\S]{0,1800}chartRef/);
});
