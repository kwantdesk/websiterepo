import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MiniDomPrimitive, miniDomLayout } from "../src/lib/miniDomPrimitive.ts";
import { layoutRightStudyLanes, volumeProfileUsesOuterRightDock } from "../src/lib/rightChartStudyDock.ts";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.ok(chart.indexOf("ref={chartContainerRef}") < chart.indexOf("data-chart-right-study-dock"));
assert.ok(chart.indexOf("data-chart-right-study-dock") < chart.lastIndexOf("<DepthOfMarketPanel"));
assert.doesNotMatch(chart, /miniDomReservedRightOffsetRef/);
assert.match(chart, /miniDomPrimitiveRef\.current\?\.drawInDock/);
assert.deepEqual(new MiniDomPrimitive().paneViews(), []);

const dock = layoutRightStudyLanes(960, [
  { id: "mini-dom", width: 97 }, { id: "volume:composite", width: 140 },
]);
assert.deepEqual(dock.map(lane => lane.width), [97, 140]);
const small = layoutRightStudyLanes(240, dock);
assert.ok(small.reduce((sum, lane) => sum + lane.width, 0) <= 80);
assert.deepEqual(layoutRightStudyLanes(140, dock), []);
const geometry = miniDomLayout({ paneWidth: 97, widthPx: 95, rightGapPx: 2, showBids: true, showAsks: true, outerDock: true });
assert.deepEqual([geometry.left, geometry.width, geometry.right], [0, 95, 95]);

assert.equal(volumeProfileUsesOuterRightDock("kwant-profile", "right"), false);
assert.equal(volumeProfileUsesOuterRightDock("weekly-volume-profile", "right"), false);
assert.equal(volumeProfileUsesOuterRightDock("composite-volume-profile", "right"), true);
assert.equal(volumeProfileUsesOuterRightDock("composite-volume-profile", "left"), false);
console.log("Mini DOM dock, narrow width, and volume profile exceptions passed.");
