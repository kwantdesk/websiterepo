import assert from "node:assert/strict";
import { NativeVolumeProfilePrimitive } from "../src/lib/nativeVolumeProfilePrimitive.ts";

/**
 * A level line must never run past the profile in front of it.
 *
 * The chain is worked out in TIME, so it always knows a profile is ahead. The
 * bug was in the hand-off to screen space: if the profile ahead could not be
 * measured — off screen, or an anchor time the scale would not resolve, which
 * is what a zoom or a scroll produces — the level fell back to the full pane
 * width and shot forward across every profile ahead of it.
 */
const mediaSize = { width: 1400, height: 900 };
let lineEnds = [];
class Path2DStub { rect() {} roundRect() {} moveTo() {} lineTo() {} }
globalThis.Path2D = Path2DStub;
const context = new Proxy({}, {
  get: (_t, key) => {
    if (key === "measureText") return () => ({ width: 40 });
    if (key === "createLinearGradient") return () => ({ addColorStop() {} });
    if (key === "lineTo") return (x, y) => { lineEnds.push({ x, y }); };
    return () => {};
  },
  set: () => true,
});
const target = { useMediaCoordinateSpace: (cb) => cb({ context, mediaSize }) };

const TICK = 0.25;
// The two profiles sit at different prices so their level lines land at
// different heights and the test can tell whose line reached where.
const profile = (id, startMs, endMs, priceBase) => {
  const levels = Array.from({ length: 200 }, (_, i) => ({
    price: Number((priceBase + i * TICK).toFixed(4)),
    volume: 100 + (i % 30), bidVolume: 50, askVolume: 50 + (i % 30), delta: 0, trades: 3,
  }));
  return {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Databento", source: "CME executions",
    id, root: "NQ", period: "daily", startMs, endMs, asOf: endMs,
    tickSize: TICK, groupTicks: 1, levels,
    poc: priceBase + 25, valueAreaHigh: priceBase + 40, valueAreaLow: priceBase + 10,
    totalVolume: 1e6, developingPoc: [],
  };
};
const style = {
  mode: "volume", widthBasis: "percent", widthPercent: 15, opacity: 70,
  positiveDeltaColor: "#0f0", negativeDeltaColor: "#f00", outsideValueAreaColor: "#333",
  valueAreaColor: "#0f0", gradient: false, pocColor: "#ff0",
  showValueArea: true, showDelta: false, showProfileSpine: true,
  showPocLine: true, showValueAreaLines: true, showText: false, showPocHighlight: false,
  showProfileOutline: false, automaticGrouping: true, autoGroupFactor: 1,
  valueAreaPercent: 70, snapMode: "anchor", pocLineWidth: 1, showDevelopingPoc: false,
  developingPocStartMs: null, valueAreaLineWidth: 1, showPeaks: false, showValleys: false,
  peakColor: "#0f0", valleyColor: "#f00", peakLineWidth: 1, valleyLineWidth: 1,
  pvSensitivity: 50, pvExcludeHighLow: false, peakMinVolumePercent: 0, valleyMaxVolumePercent: 100,
  peakOnlyOutsideValueArea: false, valleyOnlyOutsideValueArea: false, showBusinessZone: false,
  businessZoneColor: "#0f0", businessZoneOpacity: 20, businessZoneLineWidth: 1,
  showVwap: false, vwapColor: "#00f", vwapLineWidth: 1, vwapDash: "solid",
  vwapBandDeviations: [], vwapBandColor: "#00f", extendMode: "none", levelDash: "solid",
  showLevelLabels: false, levelLabelSide: "right", showLevelLabelPrice: false,
  interactionBars: [], visualStyle: "automatic", borderWidth: 1,
  showSummaryVolume: false, showSummaryTrades: false,
  summaryTextColor: "#fff", summaryAskColor: "#0f0", summaryBidColor: "#f00",
};

const DAY = 86_400_000;
const now = Date.UTC(2026, 7, 21, 20, 0);
const PX_PER_BAR = 0.02;
const newestSeconds = now / 1000;
const logicalOf = (seconds) => (seconds - newestSeconds) / 60;

// `resolvable` decides which times the scale will answer for, so a test can
// reproduce a zoom that puts the profile ahead out of reach.
const makeScale = (resolvable) => ({
  timeToCoordinate: (t) => (resolvable(Number(t))
    ? mediaSize.width + logicalOf(Number(t)) * PX_PER_BAR
    : null),
  coordinateToLogical: (x) => (x - mediaSize.width) / PX_PER_BAR,
  logicalToCoordinate: (l) => mediaSize.width + Number(l) * PX_PER_BAR,
  getVisibleLogicalRange: () => ({ from: -mediaSize.width / PX_PER_BAR, to: 0 }),
  width: () => mediaSize.width,
});

const HIGH = 29200, LOW = 28900;
const run = ({ resolvable, behindBasis, aheadBasis }) => {
  const behind = profile("behind", now - 2 * DAY, now - DAY, 28950);
  const ahead = profile("ahead", now - DAY, now, 29100);
  // The projection basis is per model: a profile with no lastCandleTime
  // cannot place itself when the scale refuses its anchor time.
  const basisFor = (id) => (id === "behind" ? behindBasis : aheadBasis);
  const models = [behind, ahead].map((p) => ({
    id: p.id, profile: p, style,
    lastCandleTime: basisFor(p.id),
    intervalSeconds: basisFor(p.id) == null ? null : 60,
    maxVolume: 4000, maxAbsDelta: 500,
    lowPrice: p.levels[0].price, highPrice: p.levels.at(-1).price,
  }));
  const primitive = new NativeVolumeProfilePrimitive();
  const scale = makeScale(resolvable);
  primitive.attached({
    series: {
      priceToCoordinate: (price) => ((HIGH - price) / (HIGH - LOW)) * mediaSize.height,
      coordinateToPrice: (y) => HIGH - (y / mediaSize.height) * (HIGH - LOW),
    },
    chart: { timeScale: () => scale },
    requestUpdate: () => {},
  });
  primitive.setModels(models);
  lineEnds = [];
  primitive.paneViews()[0].renderer().draw(target);
  // "behind" is priced under 29,000, so its lines are in the lower half.
  const midY = ((HIGH - 29_000) / (HIGH - LOW)) * mediaSize.height;
  const behindEnds = lineEnds.filter((point) => point.y > midY).map((point) => point.x);
  return { behindEnds, aheadStartX: mediaSize.width + logicalOf((now - DAY) / 1000) * PX_PER_BAR };
};

// --- baseline: everything resolvable, levels stop at the profile ahead ---
{
  const { behindEnds, aheadStartX } = run({ resolvable: () => true, behindBasis: newestSeconds, aheadBasis: newestSeconds });
  assert.ok(behindEnds.length, "expected the rear profile's level lines to be drawn");
  const furthest = Math.max(...behindEnds);
  assert.ok(
    furthest <= aheadStartX + 1,
    `levels ran to ${furthest.toFixed(0)}, past the profile ahead at ${aheadStartX.toFixed(0)}`,
  );
}

// --- the zoom case: the profile ahead cannot measure its own anchor ---
{
  // Its start time is refused, exactly as the scale refuses a time it has no
  // bar for. Before the fix this fell straight through to the pane width.
  const aheadStartSeconds = (now - DAY) / 1000;
  // The profile ahead can neither be asked for directly nor place itself,
  // which is the state a zoom leaves it in. The rear profile still draws.
  const { behindEnds, aheadStartX } = run({
    resolvable: (t) => t !== aheadStartSeconds,
    behindBasis: newestSeconds,
    aheadBasis: null,
  });
  assert.ok(behindEnds.length, "the rear profile must still be drawn");
  const furthest = Math.max(...behindEnds);
  assert.ok(
    furthest < mediaSize.width - 1,
    `levels reached the live edge (${furthest.toFixed(0)}) with a profile in front`,
  );
  assert.ok(
    furthest <= aheadStartX + 1,
    `levels ran to ${furthest.toFixed(0)}, past the profile ahead at ${aheadStartX.toFixed(0)}`,
  );
}

// --- nothing can be placed at all: stop, never run to the live edge ---
{
  const aheadStartSeconds = (now - DAY) / 1000;
  // Neither profile can place the one ahead, and the scale refuses every
  // time the rear profile would project through as well.
  const { behindEnds } = run({
    resolvable: (t) => t === (now - 2 * DAY) / 1000 || t === newestSeconds,
    behindBasis: newestSeconds,
    aheadBasis: null,
  });
  assert.ok(behindEnds.length, "the rear profile must still be drawn");
  const furthest = Math.max(...behindEnds);
  assert.ok(
    furthest < mediaSize.width - 1,
    `levels reached the live edge (${furthest.toFixed(0)}) though a profile is in front`,
  );
}

console.log("Volume profile chain fallback tests passed.");
