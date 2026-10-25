import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("timeframe shortcuts and layout controls each own an unshrunk track", () => {
  assert.match(workspace, /kwant-chart-shortcuts kwant-chart-toolbar-scrollport/);
  assert.match(workspace, /kwant-chart-layout-controls kwant-chart-toolbar-scrollport/);
  assert.match(workspace, /ref=\{timeframeMenuRef\} className="kwant-chart-toolbar-track/);
  assert.match(workspace, /kwant-chart-toolbar-track flex items-center gap-1/);
  assert.match(workspace, /ref=\{timeframeMenuRef\}/);
});

test("status stays with shortcuts while time and chart actions stay together", () => {
  assert.match(workspace, /kwant-chart-shortcuts[^\n]*[\s\S]*?Backtest Active/);
  assert.match(workspace, /kwant-chart-actions kwant-chart-toolbar-scrollport[\s\S]*?kwant-chart-toolbar-track[\s\S]*?ChartIndicatorsControl[\s\S]*?TimeZoneSelect/);
  assert.doesNotMatch(workspace, /col-start-3 row-start-1[^\n]*justify-end[^\n]*overflow-hidden/);
});
