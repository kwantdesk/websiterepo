import assert from "node:assert/strict";
import test from "node:test";
import { resolveBounceGexMapConfiguration as resolve, bounceGexMapFollowPatch as follow } from "../src/lib/bounceGexMapConfiguration.ts";
import { normalizeLinkedGexMapSettings } from "../src/lib/gexMapLinkedSettings.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { prepareBounceGexMirror, selectBounceGexMirror } from "../src/lib/bounceGexMapMirror.ts";

const shared = normalizeLinkedGexMapSettings({ viewMode: "full", stepMinutes: 5, expiryScope: "ALL_EXPIRIES",
  representation: "PER_ONE_PERCENT_MOVE", exposureModel: "DEALER_INVENTORY",
  starSettings: { dimOpacity: .14, showRawValues: true, valueMode: "star-percent" },
  panels: [{ id: "qqq", symbol: "QQQ", greekMode: "VANNA" }, { id: "spx", symbol: "SPX", greekMode: "GAMMA" }] });
const defaults = { ...defaultIndicatorSettings("bounce-levels"), sourceTicker: "AUTO", priceMode: "eod" };
const detached = { ...defaults, ...follow(resolve("NQ", defaults, shared), false) };
test("unfollow retains the exact active source, Greek and full profile", () => {
  const before = resolve("NQ", defaults, shared), after = resolve("NQ", detached, shared);
  assert.equal(after.symbol, before.symbol); assert.equal(after.greek, before.greek);
  assert.equal(after.model, before.model); assert.deepEqual(after.profile, before.profile);
  assert.equal(detached.priceMode, "live", "latent legacy EOD must not activate on unlink");
  assert.equal(detached.sourceTicker, "QQQ"); assert.equal(detached.mapColumnId, "qqq");
});
test("later GEX Map changes cannot retarget detached AUTO or change its nodes/columns", () => {
  const changed = normalizeLinkedGexMapSettings({ panels: [{ id: "ndx", symbol: "NDX", greekMode: "CHARM" }], viewMode: "star" });
  const a = resolve("NQ", detached, shared), b = resolve("NQ", detached, changed);
  assert.deepEqual(b, a);
});
test("standalone snapshots survive the real stored-indicator normalizer", () => {
  const stored = normalizeStoredIndicator({ instanceId: "test", indicatorId: "bounce-levels", enabled: true, settings: detached });
  assert.equal(stored.settings.mapPanels, detached.mapPanels);
  assert.deepEqual(resolve("NQ", stored.settings, shared).profile, shared);
});
test("source without a Map column displays and requests the same retained Greek", () => {
  const value = resolve("NQ", { ...defaults, sourceTicker: "NDX", greekMode: "VANNA", mapColumnId: "qqq" }, shared);
  assert.equal(value.source, "NDX"); assert.equal(value.symbol, "NDX"); assert.equal(value.panel, null);
  assert.equal(value.greek, "VANNA"); assert.equal(value.model, "STRUCTURAL_OI");
});
test("matching source-column overrides apply only while linked", () => {
  const ndx = normalizeLinkedGexMapSettings({ ...shared, panels: [{ id: "ndx", symbol: "NDX", greekMode: "DELTA" }] });
  assert.equal(resolve("NQ", { ...defaults, sourceTicker: "NDX", greekMode: "VANNA" }, ndx).greek, "DELTA");
  assert.equal(resolve("NQ", { ...detached, sourceTicker: "NDX" }, ndx).greek, "VANNA");
});
test("relink uses current shared settings and normalizes unsupported local Greeks", () => {
  const linked = resolve("NQ", { ...detached, ...follow(resolve("NQ", detached, shared), true) }, shared);
  assert.deepEqual(linked.profile, shared); assert.equal(linked.linked, true);
  assert.equal(resolve("NQ", { ...defaults, sourceTicker: "NDX", greekMode: "AUTO" }, shared).greek, "GAMMA");
});

const time = Date.parse("2026-10-30T13:30:00Z");
function surface(symbol, spot, strikes) {
  const rows = strikes.map((strike, i) => ({ strike, net: i ? 44e6 : -1.76e9, call: i ? 44e6 : 0, put: i ? 0 : -1.76e9 }));
  return { symbol, greekMode: "GAMMA", sessionDate: "2026-10-30", scope: "ALL_EXPIRIES", representation: "PER_ONE_DOLLAR_MOVE",
    model: "STRUCTURAL_OI", stockPrice: spot, asOf: new Date(time).toISOString(), status: "LIVE", refreshAfterMs: 5000,
    candles: [{ timestamp: time, open: spot, high: spot, low: spot, close: spot, volume: 1 }],
    latestStrikes: rows, frames: [{ timestamp: time, updates: rows }] };
}
function snapshot(payload, display, price) {
  return selectBounceGexMirror(prepareBounceGexMirror({ payload, displayInstrument: display, settings: shared,
    displayPriceAt: () => price, liveDisplayPrice: price, colorScale: ["#00FFFF", "#004444", "#002222", "#001111", "#001111", "#110011", "#220022", "#440044", "#880088", "#FF00FF"] }), null);
}
test("NDX projections use index/futures basis for NQ and MNQ, not an ETF ratio", () => {
  for (const instrument of ["NQ", "MNQ"]) {
    const s = snapshot(surface("NDX", 20000, [19950, 20050]), instrument, 22000);
    assert.equal(s.mapping.method, "spot-futures-basis"); assert.equal(s.mapping.alpha, 2000); assert.equal(s.mapping.beta, 1);
    assert.deepEqual(s.levels.map((l) => l.mappedPrice), [21950, 22050]);
    assert.deepEqual(s.exposureField.at(-1).nodes.map((n) => n.sourceStrike), [19950, 20050]);
  }
});
test("QQQ-to-NQ projection uses the ETF ratio, with unchanged raw strike/exposure", () => {
  const s = snapshot(surface("QQQ", 500, [499, 501]), "NQ", 22000);
  assert.equal(s.mapping.method, "live-ratio"); assert.equal(s.mapping.beta, 44);
  assert.deepEqual(s.levels.map((l) => l.mappedPrice), [21956, 22044]);
  assert.equal(s.levels[0].signedExposure, -1.76e9);
});
test("NDX on an NDX chart keeps raw index strikes, with no futures basis", () => {
  const s = snapshot(surface("NDX", 20000, [19950, 20050]), "NDX", 22000);
  assert.equal(s.mapping.method, "same-underlying-direct"); assert.deepEqual(s.levels.map((l) => l.mappedPrice), [19950, 20050]);
});
test("SPX and SPXW use the ES/MES basis without changing strike spacing", () => {
  for (const source of ["SPX", "SPXW"]) for (const display of ["ES", "MES"]) {
    const s = snapshot(surface(source, 6000, [5975, 6025]), display, 6050);
    assert.equal(s.mapping.method, "spot-futures-basis");
    assert.deepEqual(s.levels.map((l) => l.mappedPrice), [6025, 6075]);
  }
});
test("SPY and IWM use their own host-instrument ratios, including micros", () => {
  for (const [source, displays, spot, price, strikes, expected] of [
    ["SPY", ["ES", "MES"], 500, 6000, [499, 501], [5988, 6012]],
    ["IWM", ["RTY", "M2K"], 200, 2200, [199, 201], [2189, 2211]],
  ]) for (const display of displays) {
    const s = snapshot(surface(source, spot, strikes), display, price);
    assert.equal(s.mapping.method, "live-ratio");
    assert.deepEqual(s.levels.map((l) => l.mappedPrice), expected);
  }
});
