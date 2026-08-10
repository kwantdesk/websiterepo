import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("chart levels restore last-good overlays before background refresh", () => {
  assert.match(workspace, /GAMMA_SESSION_CACHE_PREFIX = "kwantdesk:gamma-levels:last-good:v1:"/);
  assert.match(workspace, /writeGammaSessionPayload\(conversion, options\.calibrated === true, payload\)/);
  assert.match(workspace, /const cachedGammaPayload = primaryGammaConversion[\s\S]*?setGammaOverlay\(cachedGammaOverlay\)/);
  assert.match(workspace, /const cachedValueAreaPayload = valueAreaLevelsAvailable[\s\S]*?setValueAreaOverlay\(cachedValueAreaOverlay\)/);
  assert.match(workspace, /setGammaLevelsLoading\(gammaLevelsEnabled && gammaLevelsAvailable && !cachedGammaOverlay\)/);
  assert.match(workspace, /setValueAreaLevelsLoading\(valueAreaLevelsEnabled && valueAreaLevelsAvailable && !cachedValueAreaOverlay\)/);
});

test("browser gamma cache is bounded and revalidated rather than treated as live", () => {
  assert.match(workspace, /GAMMA_SESSION_CACHE_MAX_AGE_MS = 96 \* 60 \* 60_000/);
  assert.match(workspace, /expiresAt: now \+ 1_000/);
  assert.match(workspace, /isRenderableGammaPayload\(payload\)/);
});
