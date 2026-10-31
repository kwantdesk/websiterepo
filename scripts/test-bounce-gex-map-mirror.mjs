import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { prepareBounceGexMirror, selectBounceGexMirror } from "../src/lib/bounceGexMapMirror.ts";
import { mergeBounceGexMapHistory } from "../src/lib/bounceGexMapHistory.ts";
import { buildGexMapSnapshots, gexMapSurfaceRows } from "../src/lib/gexMapSnapshots.ts";
import { selectGexMapStarNode, DEFAULT_GEX_MAP_EXPIRY_SCOPE, DEFAULT_GEX_MAP_REPRESENTATION } from "../src/lib/gexMap.ts";
import { deriveGexMapStarModel } from "../src/lib/gexMapStar.ts";
import { DEFAULT_LINKED_GEX_MAP_SETTINGS, normalizeLinkedGexMapSettings, mergeLinkedGexMapPanels, linkedGexMapPanel, effectiveLinkedGexMapModel } from "../src/lib/gexMapLinkedSettings.ts";
import { GEX_MAP_SHARED_PALETTE_PRESETS as GEX_MAP_PALETTE_PRESETS, gexMapExposureRange, gexMapSignedScaleHex, gexMapHeatStrength, gexMapHeatColorHex } from "../src/lib/gexMapPalette.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { subscribeGexMapSurface, publishGexMapSurface } from "../src/lib/gexMapSurfaceBus.ts";
import { formatGexMapExposure } from "../src/lib/gexMapFormat.ts";
import { resolveBounceGexMapSource } from "../src/lib/bounceGexMapSource.ts";

let checks = 0;
const check = (name, run) => { run(); checks++; console.log("ok " + name); };
const t = Date.parse("2026-10-30T13:30:00Z"), minute = 60000;
const scale = ["#001122", "#008899", "#ffffff", "#bbaa11", "#eeff00"];
const settings = normalizeLinkedGexMapSettings(DEFAULT_LINKED_GEX_MAP_SETTINGS);
const row = (strike, net, call = net >= 0 ? net : 0, put = net < 0 ? net : 0) => ({ strike, net, call, put });
function payload(patch = {}) {
  const rows = [row(7560, -1e9), row(7635, 100), row(7555, 2e7)];
  return {
    symbol: "SPX", greekMode: "GAMMA", sessionDate: "2026-10-30", expiration: "2026-10-30", expirations: ["2026-10-30"],
    scope: "FRONT_EXPIRY", model: "STRUCTURAL_OI", representation: "PER_ONE_DOLLAR_MOVE", asOf: new Date(t + 2 * minute).toISOString(),
    status: "LAST_SESSION", refreshAfterMs: 5000, stockPrice: 7560.68, latestStrikes: rows,
    candles: [0, 1, 2].map((n) => ({ timestamp: t + n * minute, open: 7560, high: 7562, low: 7559, close: 7560.68, volume: 1 })),
    frames: [0, 1, 2].map((n) => ({ timestamp: t + n * minute, updates: rows.map((r) => ({ ...r, net: r.net * (n + 1) / 3 })) })),
    source: "recorded test surface", sourceTimeZone: "America/New_York", sessionChangePercent: 0, netExposure: 0, grossExposure: 0, ...patch,
  };
}
function prepare(p, config = settings, more = {}) {
  return prepareBounceGexMirror({ payload: p, settings: config, displayInstrument: p.symbol, displayPriceAt: () => 7560.68, liveDisplayPrice: 7560.68, colorScale: scale, ...more });
}
function compareSurface(p, snapshot, timestamp = null) {
  assert.ok(snapshot);
  const expected = gexMapSurfaceRows(buildGexMapSnapshots(p, timestamp, settings.stepMinutes).current);
  assert.equal(snapshot.levels.length, expected.length);
  for (const r of expected) {
    const level = snapshot.levels.find((l) => l.sourceStrike === r.strike);
    assert.ok(level, "Missing map strike " + r.strike);
    assert.deepEqual([level.signedExposure, level.callExposure, level.putExposure, level.mappedPrice], [r.net, r.call, r.put, r.strike]);
  }
}
check("stock Bounce uses the map's exact scope, units and linked defaults", () => {
  const defaults = defaultIndicatorSettings("bounce-levels");
  assert.equal(defaults.gexMapMirror, true); assert.equal(defaults.linkGexMapSettings, true);
  assert.equal(defaults.mapExpiryScope, DEFAULT_GEX_MAP_EXPIRY_SCOPE);
  assert.equal(defaults.mapRepresentation, DEFAULT_GEX_MAP_REPRESENTATION);
  const migrated = normalizeStoredIndicator({ instanceId: "old", indicatorId: "bounce-levels", enabled: true, settings: { topExposurePercent: 10, minimumRelevanceScore: 55 } });
  assert.equal(migrated.settings.gexMapMirror, true); assert.equal(migrated.settings.bounceLevelsSettingsVersion, 6);
});
check("weak nodes survive beyond the former 24/64-node caps", () => {
  const rows = Array.from({ length: 279 }, (_, i) => row(7000 + i * 5, i === 127 ? 1 : (i + 1) * 1e6));
  const p = payload({ latestStrikes: rows });
  compareSurface(p, selectBounceGexMirror(prepare(p), null));
  assert.equal(selectBounceGexMirror(prepare(p), null).levels.find((l) => l.sourceStrike === 7635).signedExposure, 1);
});
check("raw signed net is retained even when it differs from call plus put", () => {
  const p = payload({ latestStrikes: [row(7635, -19, 400, -300)] });
  compareSurface(p, selectBounceGexMirror(prepare(p), null));
});
check("live uses latest strikes and removes obsolete frame-only nodes", () => {
  const p = payload({ latestStrikes: [row(7635, 42)] });
  const s = selectBounceGexMirror(prepare(p), null);
  compareSurface(p, s); assert.equal(s.levels[0].signedExposure, 42);
});
check("zero-zero rows are hidden exactly like Map; balanced nonzero rows remain", () => {
  const p = payload({ latestStrikes: [row(7635, 0, 10, -10), row(7630, 0, 0, 0)] });
  compareSurface(p, selectBounceGexMirror(prepare(p), null));
});
check("ties use the map's descending strike order", () => {
  const p = payload({ latestStrikes: [row(7600, 100), row(7610, -100)] });
  const s = selectBounceGexMirror(prepare(p), null);
  assert.equal(s.king.sourceStrike, selectGexMapStarNode(gexMapSurfaceRows(buildGexMapSnapshots(p, null, 1).current)).strike);
  assert.equal(s.king.sourceStrike, 7610);
});
for (const viewMode of ["full", "star", "ninja"]) for (const selectionStrategy of ["structural", "magnitude", "velocity"]) {
  check(viewMode + "/" + selectionStrategy + " uses the exact Map roles, highlights and dimming", () => {
    const config = normalizeLinkedGexMapSettings({ ...settings, viewMode, starSettings: { ...settings.starSettings, selectionStrategy, highlightedNodes: 3, dimOpacity: .12 } });
    const p = payload(), map = buildGexMapSnapshots(p, null, config.stepMinutes), rows = gexMapSurfaceRows(map.current);
    const model = deriveGexMapStarModel({ rows, previous: map.previous, spot: p.stockPrice, settings: config.starSettings });
    const s = selectBounceGexMirror(prepare(p, config), null), nodes = s.exposureField.at(-1).nodes;
    for (const d of model.rows) {
      const n = nodes.find((n) => n.sourceStrike === d.strike);
      const highlighted = viewMode === "full" || (viewMode === "star" ? d.strike === selectGexMapStarNode(rows).strike : d.isHighlighted);
      assert.equal(n.mapHighlighted, highlighted);
      assert.equal(n.mapOpacity, highlighted || d.strike === 7560 ? 1 : .12);
      const roles = viewMode === "star" && d.strike === selectGexMapStarNode(rows).strike ? ["star", ...d.roles.filter((r) => r !== "star" && r !== "normal")] : d.roles.filter((r) => r !== "normal");
      const label = roles.map((r) => r.toUpperCase()).join(" / ") || "NODE";
      assert.equal(n.mapRoleLabel, label);
    }
  });
}
check("all Greek/model/scope/unit combinations preserve the provider values", () => {
  for (const greekMode of ["GAMMA", "DELTA", "VANNA", "CHARM"]) for (const model of ["STRUCTURAL_OI", "DEALER_INVENTORY"])
    for (const scope of ["FRONT_EXPIRY", "ALL_EXPIRIES"]) for (const representation of ["PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE"]) {
      const p = payload({ greekMode, model, scope, representation });
      const s = selectBounceGexMirror(prepare(p), null); compareSurface(p, s);
      assert.equal(s.sourceModel, model); assert.equal(s.greekMode, greekMode);
      assert.equal(s.representation, representation === "PER_ONE_DOLLAR_MOVE" ? "per-one-dollar-move" : "per-one-percent-move");
    }
});
check("replay never substitutes a later live ladder or a later interval", () => {
  const p = payload({ latestStrikes: [row(7635, 1e15)] }), prepared = prepare(p);
  assert.equal(selectBounceGexMirror(prepared, t - 1), null);
  for (const timestamp of [t, t + minute / 2, t + minute, t + 2 * minute]) {
    const s = selectBounceGexMirror(prepared, timestamp); compareSurface(p, s, timestamp);
    assert.ok(s.exposureField.every((f) => f.timestamp <= timestamp));
    assert.ok(s.levels.every((l) => l.signedExposure !== 1e15));
  }
});
check("a cleared node leaves an actual historical gap before reappearing", () => {
  const p = payload({ frames: [row(7635, 10), row(7635, 0, 0, 0), row(7635, 20)].map((r, n) => ({ timestamp: t + n * minute, updates: [r] })) });
  const s = selectBounceGexMirror(prepare(p), t + 2 * minute);
  assert.deepEqual(s.exposureField.map((f) => f.nodes.some((n) => n.sourceStrike === 7635)), [true, false, true]);
});
check("replay classifications stay identical after sparse or final observations", () => {
  const p = payload({ frames: payload().frames.filter((_, i) => i !== 1) });
  const config = normalizeLinkedGexMapSettings({ ...settings, viewMode: "ninja", starSettings: { ...settings.starSettings, selectionStrategy: "velocity" } });
  const prepared = prepare(p, config);
  for (const timestamp of [t + 90_000, t + 5 * minute]) {
    const map = buildGexMapSnapshots(p, timestamp, 1), rows = gexMapSurfaceRows(map.current);
    const model = deriveGexMapStarModel({ rows, previous: map.previous, spot: p.stockPrice, settings: config.starSettings });
    const snapshot = selectBounceGexMirror(prepared, timestamp); compareSurface(p, snapshot, timestamp);
    for (const d of model.rows) {
      const node = snapshot.exposureField.at(-1).nodes.find((n) => n.sourceStrike === d.strike);
      assert.equal(node.mapHighlighted, d.isHighlighted);
      assert.ok(node.timestamp <= timestamp);
    }
    assert.equal(snapshot.sourceSnapshotTimeMs, timestamp > t + 2 * minute ? t + 2 * minute : t);
  }
});
check("new minutes reuse the unchanged historical prefix and match a cold reconstruction", () => {
  const base = payload(), before = prepare(base);
  const nextRows = [row(7635, 900)];
  const head = payload({ latestStrikes: nextRows, frames: [{ timestamp: t + 3 * minute, updates: nextRows }], asOf: new Date(t + 3 * minute).toISOString() });
  const merged = mergeBounceGexMapHistory(base, head), incremental = prepare(merged, settings, { liveReference: head });
  assert.strictEqual(incremental.frames[0], before.frames[0]);
  const cold = prepare(structuredClone(merged), settings, { liveReference: head });
  assert.deepEqual(selectBounceGexMirror(incremental, t + 3 * minute), selectBounceGexMirror(cold, t + 3 * minute));
});
check("arriving paired prices fill only the missing mapping tail without changing earlier nodes", () => {
  const p = payload(), base = { displayInstrument: "ES", historyKey: "ES:2026-10-30", mappingThrough: t + 59999, displayPriceAt: (time) => time < t + minute ? 7600 : null };
  const before = prepare(p, settings, base); assert.equal(before.frames.length, 1);
  const updated = { ...base, mappingThrough: t + 3 * minute, displayPriceAt: () => 7600 };
  const after = prepare(p, settings, updated);
  assert.equal(after.frames.length, 3); assert.strictEqual(after.frames[0], before.frames[0]);
  assert.deepEqual(selectBounceGexMirror(after, t + 2 * minute), selectBounceGexMirror(prepare(structuredClone(p), settings, updated), t + 2 * minute));
});
check("labels use the same signed compact number format as Map", () => {
  assert.equal(formatGexMapExposure(3660537), "$3.66M");
  assert.equal(formatGexMapExposure(-1944459945), "−$1.94B");
});
check("session bootstrap preserves real frames and ignores synthetic compact checkpoints", () => {
  const archive = payload(), head = payload({ frames: [{ timestamp: t + 30000, updates: [row(7635, 123)] }, { timestamp: t + 3 * minute, updates: [row(7635, 999)] }] });
  const merged = mergeBounceGexMapHistory(archive, head);
  assert.deepEqual(merged.frames.map((f) => f.timestamp), [t, t + minute, t + 2 * minute, t + 3 * minute]);
  assert.strictEqual(mergeBounceGexMapHistory(archive, head), merged, "consumers share one merged history");
  for (const patch of [{ model: "DEALER_INVENTORY" }, { greekMode: "DELTA" }, { symbol: "QQQ" }, { sessionDate: "2026-10-29" }, { representation: "PER_ONE_PERCENT_MOVE" }]) {
    const wrongMeasurement = payload(patch);
    assert.strictEqual(mergeBounceGexMapHistory(archive, wrongMeasurement), wrongMeasurement);
  }
  const wrong = payload({ scope: "ALL_EXPIRIES" });
  assert.strictEqual(mergeBounceGexMapHistory(archive, wrong), wrong);
});
check("live comparisons remain the compact Map's comparisons after history bootstrap", () => {
  const archive = payload(), head = payload({ latestStrikes: [row(7635, 900)], frames: [{ timestamp: t, updates: [row(7635, 100)] }, { timestamp: t + 2 * minute, updates: [row(7635, 500)] }] });
  const merged = mergeBounceGexMapHistory(archive, head);
  const prepared = prepare(merged, settings, { liveReference: head });
  const s = selectBounceGexMirror(prepared, null);
  assert.equal(s.levels[0].rateOfChangeAbsolute, 800);
  compareSurface(head, s);
});
check("ordinary price ticks reuse prepared history, never recomputing every old node", () => {
  const p = payload(), a = prepare(p), b = prepare(p, settings, { liveDisplayPrice: 9999 });
  assert.strictEqual(a.frames, b.frames);
  const changed = prepare(p, normalizeLinkedGexMapSettings({ ...settings, viewMode: "full" }));
  assert.notStrictEqual(a.frames, changed.frames);
});
check("SPXW aliases keep the true SPX strike unchanged", () => {
  const p = payload({ symbol: "SPXW" }), s = selectBounceGexMirror(prepare(p, settings, { displayInstrument: "SPX" }), null);
  assert.equal(s.mapping.method, "same-underlying-direct"); assert.equal(s.levels.find((l) => l.sourceStrike === 7635).mappedPrice, 7635);
});
check("futures projections use real paired prices, including micro contracts", () => {
  for (const displayInstrument of ["ES", "MES", "NQ", "MNQ", "RTY", "M2K"]) {
    const source = /^(M?NQ)$/.test(displayInstrument) ? "NDX" : /^(M2K|RTY)$/.test(displayInstrument) ? "IWM" : "SPX";
    const p = payload({ symbol: source });
    const s = selectBounceGexMirror(prepare(p, settings, { displayInstrument, liveDisplayPrice: 7600, displayPriceAt: () => 7600 }), null);
    assert.equal(s.displayInstrument, displayInstrument); assert.ok(s.levels.every((l) => Number.isFinite(l.mappedPrice)));
    assert.notEqual(s.mapping.method, "same-underlying-direct");
  }
});
check("missing historical mapping prices cannot be replaced with future live prices", () => {
  const p = payload();
  const prepared = prepare(p, settings, { displayInstrument: "ES", displayPriceAt: () => null, liveDisplayPrice: 9000 });
  assert.equal(selectBounceGexMirror(prepared, t + minute), null);
  assert.ok(selectBounceGexMirror(prepared, null));
});
check("every palette uses exactly the Map's independent signed peak scale", () => {
  const p = payload(), range = gexMapExposureRange(p.latestStrikes.map((r) => r.net));
  for (const preset of GEX_MAP_PALETTE_PRESETS) {
    const colorScale = gexMapSignedScaleHex({ useThemeColors: false, ...preset, scaleStops: preset.scale }, { positive: "#00ff00", negative: "#ff0000" });
    const s = selectBounceGexMirror(prepare(p, settings, { colorScale }), null);
    for (const n of s.exposureField.at(-1).nodes) assert.equal(n.mapColor, gexMapHeatColorHex(gexMapHeatStrength(n.signedExposure, range), colorScale));
  }
});
check("both unequal signed peaks saturate, without changing King identity or exposure", () => {
  const rows = [row(7500, -1.76e9), row(7550, -440e6), row(7600, 44e6), row(7650, 11e6)];
  const p = payload({ latestStrikes: rows, frames: [{ timestamp: t, updates: rows }] });
  const colorScale = gexMapSignedScaleHex({ useThemeColors: false, ...GEX_MAP_PALETTE_PRESETS[0], scaleStops: GEX_MAP_PALETTE_PRESETS[0].scale }, { positive: "#00ff00", negative: "#ff0000" });
  const snapshot = selectBounceGexMirror(prepare(p, settings, { colorScale }), null);
  const nodes = snapshot.exposureField.at(-1).nodes;
  assert.equal(nodes.find((n) => n.sourceStrike === 7500).mapColor, colorScale[0]);
  assert.equal(nodes.find((n) => n.sourceStrike === 7600).mapColor, colorScale[9]);
  assert.equal(snapshot.king.sourceStrike, 7500);
  assert.deepEqual(nodes.map((n) => n.signedExposure), rows.map((r) => r.net));
});
check("replay colours use the peaks at that snapshot, never a later session peak", () => {
  const first = [row(7500, -1.76e9), row(7600, 44e6)];
  const later = [...first, row(7650, 88e6)];
  const p = payload({ latestStrikes: later, frames: [{ timestamp: t, updates: first }, { timestamp: t + minute, updates: later }] });
  const prepared = prepare(p);
  const before = selectBounceGexMirror(prepared, t);
  const after = selectBounceGexMirror(prepared, t + minute);
  assert.equal(before.exposureField.at(-1).nodes.find((n) => n.sourceStrike === 7600).mapColor, scale.at(-1));
  assert.equal(after.exposureField[0].nodes.find((n) => n.sourceStrike === 7600).mapColor, scale.at(-1));
  assert.notEqual(after.exposureField.at(-1).nodes.find((n) => n.sourceStrike === 7600).mapColor, scale.at(-1));
});
check("sub-unit exposures use Map's percentage denominator without numeric scaling", () => {
  const p = payload({ latestStrikes: [row(7635, .1)] }), s = selectBounceGexMirror(prepare(p), null);
  assert.equal(s.levels[0].signedExposure, .1); assert.equal(s.exposureField.at(-1).nodes[0].percentOfKing, .1); assert.equal(s.levels[0].percentOfKing, 10);
});
check("closing another map does not forget an earlier source's column metric", () => {
  const a = normalizeLinkedGexMapSettings({ ...settings, panels: [{ id: "left", symbol: "SPX", greekMode: "DELTA" }] });
  const b = normalizeLinkedGexMapSettings({ ...settings, panels: [{ id: "left", symbol: "NDX", greekMode: "CHARM" }] });
  const merged = mergeLinkedGexMapPanels(b, a);
  assert.equal(linkedGexMapPanel(merged, "SPXW").greekMode, "DELTA");
  assert.equal(linkedGexMapPanel(merged, "NDX").greekMode, "CHARM");
  assert.equal(effectiveLinkedGexMapModel({ ...merged, exposureModel: "DEALER_INVENTORY" }, "DELTA"), "STRUCTURAL_OI");
});
check("AUTO source and the editor use the same chart-aware instrument family", () => {
  assert.equal(resolveBounceGexMapSource("NQZ6", settings, "AUTO").source, "QQQ");
  assert.equal(resolveBounceGexMapSource("MESZ6", settings, "AUTO").source, "SPX");
  assert.equal(resolveBounceGexMapSource("M2KZ6", settings, "AUTO").source, "IWM");
  const ndx = mergeLinkedGexMapPanels(normalizeLinkedGexMapSettings({ ...settings, panels: [{ id: "left", symbol: "NDX", greekMode: "DELTA" }] }), settings);
  const source = resolveBounceGexMapSource("MNQ", ndx, "AUTO").source;
  assert.equal(source, "NDX"); assert.equal(linkedGexMapPanel(ndx, source).greekMode, "DELTA");
  assert.equal(resolveBounceGexMapSource("GC", settings, "AUTO").source, "");
});
check("surface bus updates all listeners and detaches unmounted charts", () => {
  const seen = [], stops = [1, 2, 3].map((i) => subscribeGexMapSurface("test", (p) => seen.push([i, p])));
  const p = payload(); publishGexMapSurface("test", p); assert.equal(seen.length, 3);
  stops[1](); publishGexMapSurface("test", p); assert.equal(seen.length, 5);
  stops.forEach((f) => f()); publishGexMapSurface("test", p); assert.equal(seen.length, 5);
});
// Optional private runtime evidence: no full licensed surface is committed.
const actualPath = new URL("../tmp/spx-7635-real-front-surfaces.json", import.meta.url);
if (existsSync(actualPath)) check("all 279 archived SPX nodes match, including the actual 7635 positive node", () => {
  for (const observed of JSON.parse(readFileSync(actualPath, "utf8"))) {
    const p = payload({ ...observed, latestStrikes: observed.rows, asOf: new Date(observed.recordedAtMs).toISOString() });
    const s = selectBounceGexMirror(prepare(p), null); compareSurface(p, s);
    const target = s.levels.find((l) => l.sourceStrike === 7635);
    assert.equal(target.signedExposure, observed.representation === "PER_ONE_DOLLAR_MOVE" ? 3660537 : 277398476);
    assert.equal(s.levels.length, 279);
  }
});
console.log(checks + " Bounce/GEX Map parity checks passed.");
