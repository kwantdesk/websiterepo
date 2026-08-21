import { NativeVolumeProfilePrimitive } from "../src/lib/nativeVolumeProfilePrimitive.ts";

/**
 * Measures what one repaint of the volume profile costs.
 *
 * draw() runs on EVERY chart invalidation — crosshair moves, live ticks, a
 * sibling indicator updating, every frame of a pan. This harness drives the
 * real draw path with a counting canvas so the per-frame work is a number
 * rather than an impression.
 */

let ops = 0;
const count = () => { ops += 1; };
class Path2DStub {
  rect() { count(); }
  roundRect() { count(); }
  moveTo() { count(); }
  lineTo() { count(); }
}
globalThis.Path2D = Path2DStub;

const context = new Proxy({}, {
  get: (_target, key) => {
    if (key === "measureText") return () => ({ width: 40 });
    if (key === "createLinearGradient") return () => ({ addColorStop() {} });
    if (key === "canvas") return { width: 1400, height: 900 };
    return () => { count(); };
  },
  set: () => { count(); return true; },
});

const mediaSize = { width: 1400, height: 900 };
const target = { useMediaCoordinateSpace: (cb) => cb({ context, mediaSize }) };

// NQ: 0.25 tick. A session that ranged 400 points holds 1,600 traded ticks.
const TICK = 0.25;
const buildProfile = (id, period, startMs, endMs, low, ticks) => {
  const levels = [];
  for (let i = 0; i < ticks; i += 1) {
    const price = Number((low + i * TICK).toFixed(4));
    const volume = 500 + Math.round(4000 * Math.exp(-(((i - ticks / 2) / (ticks / 5)) ** 2)));
    const bidVolume = Math.round(volume * 0.48);
    levels.push({ price, volume, bidVolume, askVolume: volume - bidVolume, delta: volume - 2 * bidVolume, trades: Math.max(1, Math.round(volume / 12)) });
  }
  const poc = levels.reduce((best, l) => (l.volume > best.volume ? l : best), levels[0]);
  return {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Databento", source: "CME executions",
    id, root: "NQ", period, startMs, endMs, asOf: endMs,
    tickSize: TICK, groupTicks: 1, levels,
    poc: poc.price, valueAreaHigh: poc.price + 40, valueAreaLow: poc.price - 40,
    totalVolume: levels.reduce((s, l) => s + l.volume, 0),
    developingPoc: [],
  };
};

const style = {
  mode: "volume", widthBasis: "percent", widthPercent: 22, opacity: 70,
  positiveDeltaColor: "#22C55E", negativeDeltaColor: "#EF4444",
  outsideValueAreaColor: "#3F3F46", valueAreaColor: "#A3FF12", gradient: false,
  pocColor: "#FACC15", showValueArea: true, showDelta: false, showProfileSpine: true,
  showPocLine: true, showValueAreaLines: true, showText: true, showPocHighlight: true,
  showProfileOutline: false, automaticGrouping: true, autoGroupFactor: 1,
  valueAreaPercent: 70, snapMode: "anchor", pocLineWidth: 1, showDevelopingPoc: false,
  developingPocStartMs: null, valueAreaLineWidth: 1, showPeaks: false, showValleys: false,
  peakColor: "#22C55E", valleyColor: "#EF4444", peakLineWidth: 1, valleyLineWidth: 1,
  pvSensitivity: 50, pvExcludeHighLow: false, peakMinVolumePercent: 0, valleyMaxVolumePercent: 100,
  peakOnlyOutsideValueArea: false, valleyOnlyOutsideValueArea: false, showBusinessZone: false,
  businessZoneColor: "#A3FF12", businessZoneOpacity: 20, businessZoneLineWidth: 1,
  showVwap: false, vwapColor: "#60A5FA", vwapLineWidth: 1, vwapDash: "solid",
  vwapBandDeviations: [], vwapBandColor: "#60A5FA", extendMode: "none", levelDash: "solid",
  showLevelLabels: true, levelLabelSide: "right", showLevelLabelPrice: true,
  interactionBars: [], visualStyle: "automatic", borderWidth: 1,
  showSummaryVolume: false, showSummaryTrades: false,
  summaryTextColor: "#FFF", summaryAskColor: "#22C55E", summaryBidColor: "#EF4444",
};

const DAY = 86_400_000;
const now = Date.UTC(2026, 7, 20, 20, 0, 0);
const models = [];
// The reported workspace: five daily profiles and the weeklies beside them.
for (let d = 0; d < 5; d += 1) {
  const start = now - (4 - d) * DAY;
  models.push({
    id: `daily-${d}`, profile: buildProfile(`daily-${d}`, "daily", start - 82_800_000, start, 29200, 1600),
    style, lastCandleTime: Math.floor(now / 1000), intervalSeconds: 60,
    maxVolume: 4500, maxAbsDelta: 900, lowPrice: 29200, highPrice: 29600,
  });
}
for (let w = 0; w < 2; w += 1) {
  const start = now - (1 - w) * 5 * DAY;
  models.push({
    id: `weekly-${w}`, profile: buildProfile(`weekly-${w}`, "weekly", start - 5 * DAY, start, 29000, 4000),
    style, lastCandleTime: Math.floor(now / 1000), intervalSeconds: 60,
    maxVolume: 12000, maxAbsDelta: 2400, lowPrice: 29000, highPrice: 30000,
  });
}

// Price scale: 900px covering 29,000-30,000, so a 0.25 tick is 0.225px and the
// renderer's legibility floor decides the grouping, exactly as on the chart.
let HIGH = 30000, LOW = 29000;
const priceToCoordinate = (price) => ((HIGH - price) / (HIGH - LOW)) * mediaSize.height;
const coordinateToPrice = (y) => HIGH - (y / mediaSize.height) * (HIGH - LOW);

// 0.9px per one-minute bar: a 1400px pane then holds about a day and a half,
// the ordinary view for a chart carrying five daily profiles beside weeklies.
const PX_PER_BAR = 0.9;
const newestSeconds = now / 1000;
const logicalOf = (seconds) => (seconds - newestSeconds) / 60;
const timeScale = {
  timeToCoordinate: (t) => mediaSize.width + logicalOf(Number(t)) * PX_PER_BAR,
  coordinateToLogical: (x) => (x - mediaSize.width) / PX_PER_BAR,
  logicalToCoordinate: (l) => mediaSize.width + Number(l) * PX_PER_BAR,
  getVisibleLogicalRange: () => ({ from: -mediaSize.width / PX_PER_BAR, to: 0 }),
  width: () => mediaSize.width,
};

const primitive = new NativeVolumeProfilePrimitive();
primitive.attached({
  series: { priceToCoordinate, coordinateToPrice },
  chart: { timeScale: () => timeScale },
  requestUpdate: () => {},
});
primitive.setModels(models);

const renderer = primitive.paneViews()[0].renderer();
const frame = () => { ops = 0; renderer.draw(target); return ops; };

const measure = (label, prepare) => {
  for (let i = 0; i < 4; i += 1) { prepare(i); frame(); }
  const FRAMES = 60;
  const started = performance.now();
  let last = 0;
  for (let i = 0; i < FRAMES; i += 1) { prepare(i); last = frame(); }
  const perFrame = (performance.now() - started) / FRAMES;
  console.log(
    `${label.padEnd(34)} ${perFrame.toFixed(2).padStart(7)} ms/frame`
    + `  ${Math.round(1000 / perFrame).toString().padStart(6)} fps`
    + `  ${last.toLocaleString().padStart(9)} ops`,
  );
  return perFrame;
};

console.log(`profiles drawn: ${models.length} (5 daily @1600 ticks, 2 weekly @4000), pane 1400x900
`);

// Panning sideways: the price scale is unchanged, so the grouped rows stay
// cached and only the drawing repeats.
const steady = measure("pan, price scale unchanged", () => { HIGH = 30000; LOW = 29000; });

// Panning with the price axis auto-scaling, which is the default: every frame
// lands on a slightly different visible range.
const rescale = measure("pan, price scale auto-scaling", (i) => {
  HIGH = 30000 + (i % 20) * 1.7;
  LOW = 29000 + (i % 20) * 1.3;
});

console.log(`
auto-scaling costs ${(rescale / steady).toFixed(1)}x a steady frame`);
