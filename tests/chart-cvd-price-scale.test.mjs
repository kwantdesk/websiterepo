import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(
  new URL("../src/components/ChartIndicatorPanes.tsx", import.meta.url),
  "utf8",
);
const chartSource = await fs.readFile(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);

test("CVD value rail matches the native chart price-scale width", () => {
  assert.match(source, /priceScaleWidth: number/);
  assert.match(source, /width: valueScaleWidth/);
  assert.doesNotMatch(source, /width - 61|width: 61/);
  assert.match(chartSource, /chart\.priceScale\("right"\)\.width\(\)/);
  assert.match(chartSource, /priceScaleWidth=\{nativePriceScaleWidth\}/);
});

test("CVD owns an independent right-axis wheel scale", () => {
  assert.match(source, /verticalScaleByPane/);
  assert.match(source, /cvd-price-scale-/);
  assert.match(source, /aria-label="Scale CVD vertically"/);
  assert.match(source, /event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?scalePaneFromWheel/);
});

test("scrolling any lower indicator pane scales that pane instead of the main chart", () => {
  assert.match(source, /indicator-pane-wheel-zone-/);
  assert.match(source, /data-indicator-pane-wheel-zone=\{group\.key\}/);
  assert.match(source, /style=\{\{ top: top \+ 25, width, height:/);
  assert.match(source, /scalePaneFromWheel\(group\.key, event\.deltaY, event\.deltaMode\)/);
  assert.match(source, /chartContainer\.addEventListener\("wheel", captureIndicatorWheel,[\s\S]*?capture: true[\s\S]*?passive: false/);
  assert.match(chartSource, /closest\("\[data-indicator-pane-wheel-zone\]"\)[\s\S]*?return/);
});

test("CVD scaling is bounded and can be reset without changing the main chart", () => {
  assert.match(source, /Math\.max\(0\.2, Math\.min\(8,/);
  assert.match(source, /onDoubleClick=[\s\S]*?delete next\[group\.key\]/);
  assert.doesNotMatch(source, /cvd-price-scale-[\s\S]{0,1800}chartRef/);
});

test("lower indicator panes can be grabbed and panned vertically only", () => {
  assert.match(source, /verticalPanByPane/);
  assert.match(source, /const startY = event\.clientY/);
  assert.match(source, /moveEvent\.clientY - startY/);
  assert.doesNotMatch(source, /const startX = event\.clientX/);
  assert.match(source, /cursor-grabbing/);
  assert.match(source, /scaleDomain\(seriesDomain\(\[series\]\), verticalScale, verticalPan\)/);
});
