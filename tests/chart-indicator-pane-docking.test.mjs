import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const panes = await fs.readFile(new URL("../src/components/ChartIndicatorPanes.tsx", import.meta.url), "utf8");

test("indicator pane order and dock are saved independently for every chart", () => {
  assert.match(chart, /kwantdesk:indicator-pane-layout:\$\{liveCandleEventKey\}/);
  assert.match(chart, /moveIndicatorPane[\s\S]*?targetKeys\.splice[\s\S]*?next\[paneKey\] = \{ dock, order \}/);
  assert.match(chart, /paneStackHeight\("bottom"\)/);
  assert.match(chart, /paneStackHeight\("top"\)/);
});

test("minus handle drags panes to all four dock targets", () => {
  assert.match(panes, /Click to minimize · drag to reorder or dock/);
  assert.match(panes, /onPointerDown=\{\(event\) => onPaneHandlePointerDown/);
  for (const dock of ["top", "bottom", "left", "right"]) {
    assert.match(panes, new RegExp(`\\["${dock}", "${dock.toUpperCase()}"`));
  }
});

test("right dock terminates before the native chart price scale", () => {
  assert.match(panes, /renderSideSurface\("right"[\s\S]*?\{ right: priceScaleWidth, top: topHeight \}/);
  assert.match(panes, /renderSideSurface\("left"[\s\S]*?\{ left: 0, top: topHeight \}/);
});

test("side-docked indicators reconfigure into a full-height vertical rail", () => {
  assert.match(panes, /function ChartVerticalIndicatorPaneSurface/);
  assert.match(panes, /data-indicator-side-rail="true"/);
  assert.match(panes, /return \(x \/ Math\.max\(1, globalPlotWidth\)\) \* plotHeight/);
  assert.match(panes, /leftHeight = groupsByDock\.left\.length \? availableSideHeight : 0/);
  assert.match(panes, /rightHeight = groupsByDock\.right\.length \? availableSideHeight : 0/);
});
