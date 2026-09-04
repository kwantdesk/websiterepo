import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("footprint viewport refresh has no human-visible debounce", () => {
  assert.doesNotMatch(chart, /footprintViewportRefreshTimerRef/);
  assert.match(chart, /footprintViewportCoverageRef/);
  assert.match(chart, /queueChartFrameWork\(`footprint-viewport:/);
});

check("prefetched footprint rows are reused during ordinary pans", () => {
  assert.match(chart, /const leftSafe = coverage\.first === 0 \|\| visibleFirst >= coverage\.first \+ guard/);
  assert.match(chart, /const rightSafe = coverage\.last === footprintCandles\.length \|\| visibleLast <= coverage\.last - guard/);
  assert.match(chart, /if \(leftSafe && rightSafe\) return/);
});

check("magnet hit testing cannot scan the full candle history", () => {
  const start = chart.indexOf("const magnetCandidates =");
  const end = chart.indexOf("const drawingPointFromMouse", start);
  const body = chart.slice(start, end);
  assert.match(body, /coordinateToLogical\(x\)/);
  assert.match(body, /firstIndex/);
  assert.match(body, /lastIndex/);
  assert.doesNotMatch(body, /for \(const candle of candles\)/);
});

check("drawing state persistence is coalesced while dragging", () => {
  assert.match(chart, /drawingManager\.on\("drawing:updated", scheduleProfessionalDrawingStateSync\)/);
  assert.match(chart, /window\.addEventListener\("mouseup", flushProfessionalDrawingStateSync\)/);
  assert.match(chart, /}, 90\);/);
});

console.log(`\nchart interaction budget: ${passed}/${passed} checks passed`);
