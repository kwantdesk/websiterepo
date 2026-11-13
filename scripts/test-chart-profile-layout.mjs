
import assert from "node:assert/strict";
import { ChartProfileLayout, separateProfileBodies } from "../src/lib/chartProfileLayout.ts";

const dailyVolume = { owner: "daily-volume", anchor: 100, leftWidth: 45, rightWidth: 110 };
const weeklyVolume = { owner: "weekly-volume", anchor: 100, leftWidth: 0, rightWidth: 150, edge: "left" };
const dailyTpo = { owner: "daily-tpo", anchor: 104, leftWidth: 0, rightWidth: 110, edge: "left" };
const weeklyTpo = { owner: "weekly-tpo", anchor: 280, leftWidth: 110, rightWidth: 0 };
const previousDaily = { owner: "daily-volume", anchor: 450, leftWidth: 30, rightWidth: 90 };
const rightVolume = { owner: "daily-volume", anchor: 795, leftWidth: 140, rightWidth: 0, edge: "right" };
const rightWeekly = { owner: "weekly-volume", anchor: 795, leftWidth: 100, rightWidth: 0, edge: "right" };
const modelMap = (...bodies) => new Map(bodies.map(body => [body, body]));
const span = (body, placement = { anchor: body.anchor, scale: 1 }) => [
  placement.anchor - body.leftWidth * placement.scale,
  placement.anchor + body.rightWidth * placement.scale,
];
const assertSeparated = (bodies, positions, left, right) => {
  const spans = bodies.map(body => span(body, positions.get(body))).sort((a, b) => a[0] - b[0]);
  spans.forEach(([start, end], index) => {
    assert.ok(end > start, "every study retains visible space");
    assert.ok(start >= left - 0.001 && end <= right + 0.001, "profile stays inside the chart");
    assert.ok(index === 0 || spans[index - 1][1] < start, "profile bodies have a gap");
  });
};

const bodies = [dailyVolume, weeklyVolume, dailyTpo, weeklyTpo, previousDaily, rightVolume, rightWeekly];
const positions = separateProfileBodies(modelMap(...bodies), 60, 800);
assertSeparated(bodies, positions, 60, 800);
assert.equal(positions.has(previousDaily), false, "an independent historical profile stays at its anchor");
assert.ok(span(weeklyVolume, positions.get(weeklyVolume))[0] < span(dailyVolume, positions.get(dailyVolume))[0]);
assert.ok(span(rightWeekly, positions.get(rightWeekly))[1] <= rightWeekly.anchor);

assert.equal(separateProfileBodies(modelMap(dailyVolume), 60, 800).size, 0);
const otherDaily = { ...dailyVolume, anchor: 110 };
assert.equal(separateProfileBodies(modelMap(dailyVolume, otherDaily), 60, 800).size, 0);
const offscreen = { ...weeklyTpo, anchor: -5 };
assert.equal(separateProfileBodies(modelMap(dailyVolume, offscreen), 60, 800).size, 0);

const narrowBodies = [dailyVolume, weeklyVolume, dailyTpo, weeklyTpo].map(body => ({
  ...body, anchor: Math.min(body.anchor, 118),
}));
assertSeparated(narrowBodies, separateProfileBodies(modelMap(...narrowBodies), 60, 120), 60, 120);

const layout = new ChartProfileLayout();
let volume = modelMap(dailyVolume);
let tpo = modelMap(dailyTpo);
let reads = 0;
layout.addSource(() => { reads++; return volume; });
layout.addSource(() => { reads++; return tpo; });
const first = layout.positions(60, 800, 100, 200);
assertSeparated([dailyVolume, dailyTpo], first, 60, 800);
assert.equal(layout.positions(60, 800, 100, 200), first, "both renderers share the same layout");
assert.equal(reads, 2, "crosshair redraws reuse the geometry");
assert.notEqual(layout.positions(60, 800, 120, 220), first, "panning reflows the profiles");
tpo = modelMap();
layout.invalidate();
assert.equal(layout.positions(60, 800, 120, 220).size, 0, "removing a study restores the original layout");
console.log("Shared TPO and volume profile layout checks passed.");


import { NativeVolumeProfilePrimitive } from "../src/lib/nativeVolumeProfilePrimitive.ts";
import { TpoProfilePrimitive } from "../src/lib/tpo/primitive.ts";
import { defaultTpoSettings } from "../src/lib/tpo/settings.ts";

const chartLayout = new ChartProfileLayout();
const volumeBars = [];
const tpoBars = [];
class ChartPath {
  rect(x, _y, width) { volumeBars.push([x, x + width]); }
  roundRect(x, y, width) { this.rect(x, y, width); }
  moveTo() {}
  lineTo() {}
}

const volumePrimitive = new NativeVolumeProfilePrimitive(() => new ChartPath(), chartLayout);
const tpoPrimitive = new TpoProfilePrimitive(chartLayout);
const startMs = 1_800_000_000_000;
const endMs = startMs + 30 * 60_000;
let offset = 100;
const scale = {
  getVisibleLogicalRange: () => ({ from: -offset, to: 800 - offset }),
  timeToCoordinate: (time) => offset + (Number(time) - startMs / 1_000) / 6,
};
const series = {
  priceToCoordinate: (price) => (110 - price) * 10,
  coordinateToPrice: (y) => 110 - y / 10,
};
const params = { chart: { timeScale: () => scale }, series, requestUpdate() {} };
volumePrimitive.attached(params);
tpoPrimitive.attached(params);
volumePrimitive.setPaneInsets({ left: 60 });
tpoPrimitive.setPaneInsets({ left: 60 });

const volumeSettings = {
  mode: "volume", snapMode: "left", widthBasis: "period-percent", widthPercent: 40,
  opacity: 1, valueAreaPercent: 70, manualGroupTicks: 1, showValueArea: true,
  valueAreaColor: "#00ff00", outsideValueAreaColor: "#008000", showLevelLabels: false,
};
const buildVolume = (period) => ({
  id: period, dockInstanceId: period,
  lastCandleTime: endMs / 1_000, intervalSeconds: 60,
  maxVolume: 20, maxAbsDelta: 10, lowPrice: 100, highPrice: 100,
  style: volumeSettings,
  profile: {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Databento", source: "CME executions",
    period, id: period, root: "NQ", startMs, endMs, asOf: endMs,
    tickSize: 1, groupTicks: 1, totalVolume: 20, poc: 100, valueAreaHigh: 100, valueAreaLow: 100,
    levels: [{ price: 100, volume: 20, delta: 10, bidVolume: 5, askVolume: 15, trades: 4 }],
    developingPoc: [],
  },
});
const tpoModels = ["tpo-chart", "weekly-tpo"].map((instanceId) => ({
  instanceId, lastCandleTime: endMs / 1_000, intervalSeconds: 60,
  settings: {
    ...defaultTpoSettings(instanceId), tpoType: "profile", visualStyle: "solid",
    currentWidth: 40, widthMode: "period-percent", showValueArea: false, showPoc: false,
  },
  theme: {},
  profile: {
    id: instanceId, startTimeMs: startMs, endTimeMs: endMs, tickSize: 1,
    profileLowTick: 100, profileHighTick: 100, subperiods: [], peaksValleys: [],
    rows: [{
      lowTick: 100, highTick: 100, tpoCount: 5,
      cells: Array.from({ length: 5 }, () => ({ sessionSegment: 0 })),
      markers: [],
    }],
  },
}));

const target = {
  useMediaCoordinateSpace: (draw) => draw({
    mediaSize: { width: 800, height: 200 },
    context: new Proxy({}, {
      get: (_target, name) => {
        if (name === "fillRect") return (x, _y, width) => tpoBars.push([x, x + width]);
        if (name === "measureText") return () => ({ width: 20 });
        return () => {};
      },
      set: () => true,
    }),
  }),
};
volumePrimitive.setModels(["daily", "weekly"].map(buildVolume));
tpoPrimitive.setModels(tpoModels);

for (const anchor of [100, 25]) {
  offset = anchor;
  volumeBars.length = 0;
  tpoBars.length = 0;
  volumePrimitive.paneViews()[0].renderer().draw(target);
  tpoPrimitive.paneViews()[1].renderer().draw(target);
  assert.equal(volumeBars.length, 2, "both daily and weekly volume profiles paint");
  assert.equal(tpoBars.length, 2, "both daily and weekly TPO profiles paint");
  const allBars = [...volumeBars, ...tpoBars].sort((a, b) => a[0] - b[0]);
  assert.ok(allBars.every(([x], index) => index === 0 || x > allBars[index - 1][1]));
  assert.deepEqual(new Set(tpoBars.map(([start, end]) => tpoPrimitive.profileHitTest((start + end) / 2, 100)?.instanceId)),
    new Set(["tpo-chart", "weekly-tpo"]), "each moved TPO retains its own hit target");
}
console.log("Both chart renderers paint and hit-test separate profiles at session anchors and at the left wall.");



offset = 100;
const rightDocked = { ...tpoModels[1], settings: { ...tpoModels[1].settings, showOnRight: true } };
volumePrimitive.setModels([]);
tpoPrimitive.setModels([tpoModels[0], rightDocked]);
tpoBars.length = 0;
tpoPrimitive.paneViews()[1].renderer().draw(target);
assert.equal(tpoBars.length, 1, "a right-docked TPO reserves no space inside the price pane");
assert.equal(tpoBars[0][0], offset, "the remaining profile uses its original anchor");
tpoBars.length = 0;
tpoPrimitive.drawInDock(target, rightDocked.instanceId);
assert.equal(tpoBars.length, 1, "the right-docked profile paints in its own dock");
