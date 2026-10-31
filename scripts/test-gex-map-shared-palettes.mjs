import assert from "node:assert/strict";
import { VOLUME_PROFILE_GRADIENTS } from "../src/lib/volumeProfileGradients.ts";
import {
  GEX_MAP_SHARED_PALETTE_PRESETS, gexMapPaletteFromPreset, gexMapHeatStrength,
  gexMapHeatColorHex, gexMapSignedScaleHex, normalizeGexMapPalette,
} from "../src/lib/gexMapPalette.ts";

assert.deepEqual(GEX_MAP_SHARED_PALETTE_PRESETS.map(p => [p.id, p.label]),
  VOLUME_PROFILE_GRADIENTS.map(p => [p.id, p.label]));
for (const gradient of VOLUME_PROFILE_GRADIENTS) {
  const preset = GEX_MAP_SHARED_PALETTE_PRESETS.find(p => p.id === gradient.id);
  const seeded = gexMapPaletteFromPreset(preset);
  const scale = gexMapSignedScaleHex(seeded, { negative: "#000000", positive: "#FFFFFF" });
  assert.equal(scale.length, 10);
  assert.equal(scale[0], gradient.from.toUpperCase());
  assert.equal(scale[9], gradient.to.toUpperCase());
  // Endpoints still represent exactly -100% / +100% of Star; no node reranking.
  assert.equal(gexMapHeatColorHex(gexMapHeatStrength(-100, 100), scale), gradient.from.toUpperCase());
  assert.equal(gexMapHeatColorHex(gexMapHeatStrength(100, 100), scale), gradient.to.toUpperCase());
  assert.equal(gexMapHeatStrength(0, 100), 0.5);
  // Editing and saving a slot must not regenerate it from preset endpoints.
  const original = structuredClone(preset);
  seeded.scaleStops[3] = "#123ABC";
  seeded.star = "#ABC123";
  const restored = normalizeGexMapPalette(JSON.parse(JSON.stringify(seeded)));
  assert.equal(restored.scaleStops[3], "#123ABC");
  assert.equal(restored.star, "#ABC123");
  assert.deepEqual(gexMapSignedScaleHex(restored, { negative: "#000000", positive: "#FFFFFF" }), seeded.scaleStops);
  assert.deepEqual(preset, original, "custom edits cannot mutate stock presets");
}
// Retiring the old buttons must not erase someone's explicitly saved custom scale.
const oldSaved = { useThemeColors: false, positive: "#FDE725", positiveSoft: "#35B779",
  negative: "#31688E", negativeSoft: "#440154", star: "#FFFFFF",
  scaleStops: ["#440154","#482878","#3E4989","#31688E","#26828E","#1F9E89","#35B779","#6DCD59","#B4DE2C","#FDE725"] };
assert.deepEqual(normalizeGexMapPalette(oldSaved), oldSaved);
console.log("12 canonical palette seed/mapping/custom-save cases and saved-colour compatibility passed.");
