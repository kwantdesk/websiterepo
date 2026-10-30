import assert from "node:assert/strict";
import test from "node:test";
import { TpoProfilePrimitive } from "../src/lib/tpo/primitive.ts";
import { defaultTpoSettings } from "../src/lib/tpo/settings.ts";

function model(id, index, color, instanceId = "daily", overrides = {}) {
  const cells = [0, 1].map(subperiodIndex => ({ subperiodIndex, marker: "AB"[subperiodIndex], sessionSegment: 0, volume: null, bidVolume: null, askVolume: null, delta: null, trades: null }));
  const rows = [100, 101, 102].map(rowTick => ({ rowTick, lowTick: rowTick, highTick: rowTick, subperiodIds: ["a", "b"], subperiodIndexes: [0, 1], markers: ["A", "B"], cells, tpoCount: 2, volume: null, bidVolume: null, askVolume: null, delta: null, trades: null }));
  return {
    instanceId, profile: { id, instrumentId: "NQ", startTimeMs: index * 1000000, endTimeMs: index * 1000000 + 100000, developing: false, source: "bar-range", lowerGranularity: true, tickSize: 1, ticksPerRow: 1, rows, subperiods: [], totalTpos: 6, profileHighTick: 102, profileLowTick: 100, closeTick: 101, pocTick: 101, vahTick: 102, valTick: 100, developingPoc: [], developingVah: [], developingVal: [], initialBalanceHighTick: null, initialBalanceLowTick: null, singlePrints: [], peaksValleys: [], totalVolume: null, totalTrades: null, bidVolume: null, askVolume: null, delta: null },
    settings: { ...defaultTpoSettings("daily-tpo"), displayType: "blocks", gradientPreset: "off", inheritThemeColours: true, showSummary: false, showPoc: false, showInitialBalance: false, showSinglePrints: false, showOpenClose: false, ...overrides },
    theme: Object.fromEntries(["background", "foreground", "muted", "profile", "bullish", "bearish", "poc", "valueArea", "singlePrint", "peak", "valley", "selection"].map(key => [key, color])), lastCandleTime: null, intervalSeconds: 60,
  };
}

function scene(models, starts, inset = 36) {
  const colors = new Set(models.map(m => m.theme.profile)), painted = new Set(), state = {};
  const context = new Proxy(state, {
    get(target, key) {
      if (key === "measureText") return text => ({ width: String(text).length * 6 });
      if (["fill", "fillRect", "fillText"].includes(key)) return () => { if (colors.has(target.fillStyle)) painted.add(target.fillStyle); };
      if (["stroke", "strokeRect", "strokeText"].includes(key)) return () => { if (colors.has(target.strokeStyle)) painted.add(target.strokeStyle); };
      return target[key] ?? (() => {});
    }, set(target, key, value) { target[key] = value; return true; },
  });
  const coordinates = new Map();
  models.forEach(m => { const x = starts[m.profile.id]; coordinates.set(m.profile.startTimeMs / 1000, x); coordinates.set(m.profile.endTimeMs / 1000, x == null ? null : x + 100); });
  const primitive = new TpoProfilePrimitive();
  primitive.setPaneInsets({ left: inset });
  primitive.attached({ chart: { timeScale: () => ({ timeToCoordinate: t => coordinates.get(Number(t)) ?? null, getVisibleLogicalRange: () => ({ from: 0, to: 80 }) }) }, series: { priceToCoordinate: p => 160 - (p - 100) * 10 }, requestUpdate() {} });
  primitive.setModels(models);
  const draw = () => {
    painted.clear();
    for (const pane of primitive.paneViews()) pane.renderer().draw({ useMediaCoordinateSpace: cb => cb({ context, mediaSize: { width: 800, height: 300 } }) });
    return [...painted].sort();
  };
  return { primitive, draw, hideEnd(id) { const m = models.find(m => m.profile.id === id); coordinates.set(m.profile.endTimeMs / 1000, null); }, move(id, x) { const m = models.find(m => m.profile.id === id); coordinates.set(m.profile.startTimeMs / 1000, x); coordinates.set(m.profile.endTimeMs / 1000, x + 100); } };
}

const old = () => model("old", 1, "#ff0000"), incoming = () => model("incoming", 2, "#00ff00");
test("latest TPO replaces the older left-docked profile at the actual visible edge", () => {
  for (const inset of [0, 36, 64]) for (const x of [inset + 2, inset + 1.5, inset + 1, inset, -200]) {
    const s = scene([old(), incoming()], { old: -400, incoming: x }, inset);
    assert.deepEqual(s.draw(), ["#00ff00"], `edge ${inset}, incoming ${x}`);
    assert.equal(s.primitive.profileHitTest(inset + 5, 150)?.profileId, "incoming");
    if (inset) assert.equal(s.primitive.profileHitTest(inset - 1, 150), null);
  }
});

test("panning back restores the previous wall profile while the newer one is on-screen", () => {
  const s = scene([old(), incoming()], { old: -400, incoming: 38 });
  assert.deepEqual(s.draw(), ["#00ff00"]);
  s.move("incoming", 200); assert.deepEqual(s.draw(), ["#00ff00", "#ff0000"]);
  s.move("incoming", 36); assert.deepEqual(s.draw(), ["#00ff00"]);
});

test("wall ownership is chronological rather than render-array order", () => {
  for (const models of [[old(), incoming()], [incoming(), old()]]) {
    const s = scene(models, { old: -400, incoming: 20 });
    assert.deepEqual(s.draw(), ["#00ff00"]);
  }
});

test("independent TPO studies retain independent wall profiles", () => {
  const weekly = model("weekly", 3, "#0000ff", "weekly");
  const s = scene([old(), incoming(), weekly], { old: -400, incoming: 10, weekly: -100 });
  assert.deepEqual(s.draw(), ["#0000ff", "#00ff00"]);
});

test("right-docked mode does not leave old profiles clamped to the left edge", () => {
  const models = [old(), incoming()].map(m => ({ ...m, settings: { ...m.settings, showOnRight: true } }));
  const s = scene(models, { old: -400, incoming: 200 });
  assert.deepEqual(s.draw(), ["#00ff00"]);
});

test("an unprojectable newer profile cannot take ownership from a drawable profile", () => {
  const s = scene([old(), incoming()], { old: -400, incoming: 20 });
  s.hideEnd("incoming");
  assert.deepEqual(s.draw(), ["#ff0000"]);
});

test("the replaced profile loses its levels, summary and single-print layer as well as its blocks", () => {
  const models = [old(), incoming()].map(m => ({ ...m, settings: { ...m.settings, mirror: true, showPoc: true, showSummary: true, valueAreaShowLines: true, showSinglePrints: true }, profile: { ...m.profile, singlePrints: [{ lowTick: 100, highTick: 102, tested: false, volumePerTick: null }] } }));
  const s = scene(models, { old: -400, incoming: 20 });
  assert.deepEqual(s.draw(), ["#00ff00"]);
});
