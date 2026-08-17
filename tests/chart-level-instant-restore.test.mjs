import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("chart levels restore last-good overlays before background refresh", () => {
  assert.match(workspace, /GAMMA_SESSION_CACHE_PREFIX = "kwantdesk:gamma-levels:last-good:v1:"/);
  assert.match(workspace, /GAMMA_OVERLAY_CACHE_PREFIX = "kwantdesk:chart-gamma-overlay:last-good:v1:"/);
  assert.match(workspace, /writeGammaSessionPayload\(conversion, options\.calibrated === true, payload\)/);
  assert.match(workspace, /useState<GammaChartOverlay \| null>\(\(\) =>[\s\S]*?readGammaOverlayCache\(gammaInstrument, settings\)\)/);
  assert.match(workspace, /useState<ValueAreaChartOverlay \| null>\(\(\) =>[\s\S]*?readValueAreaOverlayCache\(pane\.symbol, settings\)\)/);
  assert.match(workspace, /const cachedGammaOverlayDirect = readGammaOverlayCache\(gammaInstrument, settings\)[\s\S]*?setGammaOverlay\(cachedGammaOverlay\)/);
  assert.match(workspace, /const cachedValueAreaOverlay = valueAreaLevelsAvailable[\s\S]*?readValueAreaOverlayCache\(pane\.symbol, settings\)[\s\S]*?setValueAreaOverlay\(cachedValueAreaOverlay\)/);
  assert.match(workspace, /setGammaLevelsLoading\([\s\S]*?gammaLevelsAvailable[\s\S]*?&& !cachedGammaOverlay,[\s\S]*?\)/);
  assert.match(workspace, /setValueAreaLevelsLoading\(valueAreaLevelsEnabled && valueAreaLevelsAvailable && !cachedValueAreaOverlay\)/);
});

test("ES gamma restores native levels and starts them before candle history is ready", () => {
  assert.match(workspace, /const cachedGammaCandidates = \[primaryGammaConversion, fallbackGammaConversion\]/);
  assert.match(workspace, /readGammaSessionPayload\(conversion\)/);
  assert.match(workspace, /Native futures gamma is independent of cash\/futures calibration/);
  const warmupIndex = workspace.indexOf("void fetchGammaPayload(fallbackGammaConversion)");
  const readinessGateIndex = workspace.indexOf("if (!gammaDataReady)");
  assert.ok(warmupIndex > 0 && readinessGateIndex > warmupIndex);
});

test("value-area restore uses the parent CME book and survives a page reload", () => {
  assert.match(workspace, /const sourceKey = valueAreaSourceSymbol\(instrument\)\.toUpperCase\(\)/);
  assert.match(workspace, /for \(const storage of \[window\.sessionStorage, window\.localStorage\]\)/);
  assert.match(workspace, /window\.localStorage\.setItem\(`\$\{VALUE_AREA_SESSION_CACHE_PREFIX\}\$\{cacheKey\}`, serialized\)/);
  assert.match(workspace, /VALUE_AREA_LAST_GOOD_MAX_AGE_MS = 8 \* 24 \* 60 \* 60_000/);
  assert.doesNotMatch(workspace, /validValueAreaProfile\(payload\.weekly\)[\s\S]{0,120}valueAreaPayloadIsCurrent\(payload\)/);
  assert.match(workspace, /stale: !valueAreaPayloadIsCurrent\(sourcePayload\)/);
  assert.match(workspace, /let retainedOverlay = valueAreaOverlay/);
  assert.doesNotMatch(workspace, /if \(retainedOverlay && !valueAreaPayloadIsCurrent\(retainedOverlay\)\)/);
});

test("browser gamma cache is bounded and revalidated rather than treated as live", () => {
  assert.match(workspace, /GAMMA_SESSION_CACHE_MAX_AGE_MS = 96 \* 60 \* 60_000/);
  assert.match(workspace, /expiresAt: now \+ 1_000/);
  assert.match(workspace, /isRenderableGammaPayload\(payload\)/);
});
