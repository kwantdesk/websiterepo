import assert from "node:assert/strict";
import test from "node:test";
import { GAMMA_ENVIRONMENT_SOURCES, normalizeGammaEnvironmentSource, resolveGammaEnvironmentConversion } from "../src/lib/chartGammaConversion.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

test("each explicit gamma ticker keeps its own frame on every chart family", () => {
  for (const chart of ["NQ", "MNQ", "ES", "MES", "GC", "AMD", "SPY", "SPXW", "NDX", "QQQ"]) {
    for (const source of GAMMA_ENVIRONMENT_SOURCES) {
      const conversion = resolveGammaEnvironmentConversion(source, chart);
      assert.equal(conversion?.source, source, `${chart}: ${source}`);
      assert.equal(conversion.futuresRoot, ["NQ", "NDX", "QQQ"].includes(source) ? "NQ" : "ES");
    }
  }
});

test("automatic retains existing cash routing and futures overlay routing", () => {
  for (const source of ["SPX", "SPXW", "SPY", "NDX", "QQQ"]) {
    assert.equal(resolveGammaEnvironmentConversion("AUTO", source)?.source, source);
  }
  for (const chart of ["NQ", "MNQ", "ES", "MES", "GC", "AMD"]) {
    assert.equal(resolveGammaEnvironmentConversion("AUTO", chart), null);
  }
});

test("source selection survives saved indicator normalization without changing styles", () => {
  assert.equal(defaultIndicatorSettings("gamma-environment").sourceSymbol, "AUTO");
  for (const source of ["AUTO", ...GAMMA_ENVIRONMENT_SOURCES]) {
    const saved = normalizeStoredIndicator({ instanceId: "gamma-test", indicatorId: "gamma-environment", enabled: true, settings: { sourceSymbol: source, position: "bottom-right", badgeScale: 1.5 } });
    assert.equal(saved.settings.sourceSymbol, source);
    assert.equal(saved.settings.position, "bottom-right");
    assert.equal(saved.settings.badgeScale, 1.5);
  }
  assert.equal(normalizeGammaEnvironmentSource(" qqq "), "QQQ");
  for (const invalid of [null, undefined, "missing", "<script>"]) assert.equal(normalizeGammaEnvironmentSource(invalid), "AUTO");
});
