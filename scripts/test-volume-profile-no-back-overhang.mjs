import assert from "node:assert/strict";
import { NativeVolumeProfilePrimitive } from "../src/lib/nativeVolumeProfilePrimitive.ts";

/**
 * Nothing may be painted out of the BACK of a profile.
 *
 * Traders put a delta footprint behind the profile, so any bar drawn to the
 * left of the spine covers their chart. The POC highlight used to add the
 * row's delta width to the left even when that row's delta bar had been drawn
 * on the RIGHT — a light bar sticking out of the back with nothing under it.
 */
const mediaSize = { width: 1400, height: 900 };
let bars = [];
class Path2DStub {
  rect(x, y, w, h) { bars.push({ x, w }); }
  roundRect(x, y, w, h) { bars.push({ x, w }); }
  moveTo() {} lineTo() {}
}
globalThis.Path2D = Path2DStub;
const context = new Proxy({}, {
  get: (_t, key) => {
    if (key === "measureText") return () => ({ width: 40 });
    if (key === "createLinearGradient") return () => ({ addColorStop() {} });
    return () => {};
  },
  set: () => true,
});
const target = { useMediaCoordinateSpace: (cb) => cb({ context, mediaSize }) };

const TICK = 0.25;
// Every row buys: delta is positive throughout, so every delta bar belongs on
// the right and nothing at all should be drawn behind the spine.
const levels = Array.from({ length: 200 }, (_, i) => ({
  price: Number((29000 + i * TICK).toFixed(4)),
  volume: 100 + (i % 40) * 10,
  bidVolume: 10, askVolume: 90 + (i % 40) * 10,
  delta: 80 + (i % 40) * 10,
  trades: 5,
}));
const poc = levels.reduce((best, l) => (l.volume > best.volume ? l : best), levels[0]);
const profile = {
  schemaVersion: "kwantify-volume-profile-v1", provider: "Databento", source: "CME executions",
  id: "rth", root: "NQ", period: "daily",
  startMs: Date.UTC(2026, 7, 21, 13, 30), endMs: Date.UTC(2026, 7, 21, 20, 0),
  asOf: Date.UTC(2026, 7, 21, 20, 0),
  tickSize: TICK, groupTicks: 1, levels,
  poc: poc.price, valueAreaHigh: poc.price + 10, valueAreaLow: poc.price - 10,
  totalVolume: levels.reduce((s, l) => s + l.volume, 0), developingPoc: [],
};
const style = {
  mode: "volume", widthBasis: "percent", widthPercent: 20, opacity: 70,
  positiveDeltaColor: "#0f0", negativeDeltaColor: "#f00", outsideValueAreaColor: "#333",
  valueAreaColor: "#0f0", gradient: false, pocColor: "#eee",
  showValueArea: true, showDelta: true, showProfileSpine: true,
  showPocLine: true, showValueAreaLines: true, showText: false,
  showPocHighlight: true, // the element under test
  showProfileOutline: false, automaticGrouping: true, autoGroupFactor: 1,
  valueAreaPercent: 70, snapMode: "anchor", pocLineWidth: 3, showDevelopingPoc: false,
  developingPocStartMs: null, valueAreaLineWidth: 1, showPeaks: false, showValleys: false,
  peakColor: "#0f0", valleyColor: "#f00", peakLineWidth: 1, valleyLineWidth: 1,
  pvSensitivity: 50, pvExcludeHighLow: false, peakMinVolumePercent: 0, valleyMaxVolumePercent: 100,
  peakOnlyOutsideValueArea: false, valleyOnlyOutsideValueArea: false, showBusinessZone: false,
  businessZoneColor: "#0f0", businessZoneOpacity: 20, businessZoneLineWidth: 1,
  showVwap: false, vwapColor: "#00f", vwapLineWidth: 1, vwapDash: "solid",
  vwapBandDeviations: [], vwapBandColor: "#00f", levelDash: "solid",
  showLevelLabels: false, levelLabelSide: "right", showLevelLabelPrice: false,
  visualStyle: "automatic", borderWidth: 1,
  showSummaryVolume: false, showSummaryTrades: false,
  summaryTextColor: "#fff", summaryAskColor: "#0f0", summaryBidColor: "#f00",
};

const PX_PER_BAR = 0.05;
const newestSeconds = profile.endMs / 1000;
const scale = {
  timeToCoordinate: (t) => mediaSize.width + ((Number(t) - newestSeconds) / 60) * PX_PER_BAR,
  coordinateToLogical: (x) => (x - mediaSize.width) / PX_PER_BAR,
  logicalToCoordinate: (l) => mediaSize.width + Number(l) * PX_PER_BAR,
  getVisibleLogicalRange: () => ({ from: -mediaSize.width / PX_PER_BAR, to: 0 }),
  width: () => mediaSize.width,
};
const HIGH = 29100, LOW = 28950;
const primitive = new NativeVolumeProfilePrimitive();
primitive.attached({
  series: {
    priceToCoordinate: (price) => ((HIGH - price) / (HIGH - LOW)) * mediaSize.height,
    coordinateToPrice: (y) => HIGH - (y / mediaSize.height) * (HIGH - LOW),
  },
  chart: { timeScale: () => scale },
  requestUpdate: () => {},
});
primitive.setModels([{
  id: profile.id, profile, style,
  lastCandleTime: newestSeconds, intervalSeconds: 60,
  maxVolume: 500, maxAbsDelta: 480,
  lowPrice: levels[0].price, highPrice: levels.at(-1).price,
}]);

bars = [];
primitive.paneViews()[0].renderer().draw(target);
assert.ok(bars.length > 10, "expected the profile body to be drawn");

const spineX = scale.timeToCoordinate(profile.startMs / 1000);
const behind = bars.filter((bar) => bar.x < spineX - 0.5);
assert.deepEqual(
  behind, [],
  `${behind.length} bar(s) painted behind the profile spine at ${spineX.toFixed(0)}: `
  + `${behind.slice(0, 3).map((b) => `x=${b.x.toFixed(0)} w=${b.w.toFixed(0)}`).join(", ")}`,
);

console.log("Volume profile back-overhang tests passed.");
