import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";
import { settingsWithPalette, paletteRolesFor } from "../src/lib/indicatorPaletteRegistry.ts";
import { INDICATOR_GRADIENTS, resolveIndicatorPalette } from "../src/lib/indicatorPalettes.ts";

const theme = { up: "#22C55E", down: "#EF4444", neutral: "#8A8F98", accent: "#2962FF", text: "#FFFFFF" };
let checks = 0;
for (const scheme of INDICATOR_GRADIENTS) {
  for (const useThemeColors of [true, false]) {
    for (const syncGexMapColors of [true, false]) {
      const saved = { indicatorId: "bounce-levels", settings: {
        ...defaultIndicatorSettings("bounce-levels"),
        useThemeColors, syncGexMapColors, gradientPreset: scheme.id,
      } };
      const before = structuredClone(saved);
      const output = settingsWithPalette(saved, theme);
      assert.equal(output.settings.useThemeColors, false, scheme.id);
      assert.equal(output.settings.syncGexMapColors, false, scheme.id);
      const expected = resolveIndicatorPalette("bounce-levels", saved.settings, theme, useThemeColors, paletteRolesFor("bounce-levels"));
      for (const [key, colour] of Object.entries(expected)) assert.equal(output.settings[key], colour, `${scheme.id}.${key}`);
      // Render-only authority must not rewrite persisted choices. Off restores
      // their theme/map link, and malformed scheme IDs cannot disable either.
      assert.deepEqual(saved, before);
      for (const gradientPreset of ["off", "unknown-scheme", ""]) {
        const off = { ...saved, settings: { ...saved.settings, gradientPreset } };
        assert.equal(settingsWithPalette(off, theme), off);
      }
      checks++;
    }
  }
}
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const memo = chart.slice(chart.indexOf("const bounceLevelsPrimitiveData = useMemo"), chart.indexOf("useEffect(() => { bounceLevelsPrimitiveRef.current?.update"));
assert.match(memo, /settings\.borderUpColor, settings\.gridColor, settings\.downColor, settings\.upColor\]\)/, "all theme colours used by Bounce must invalidate its cached render data");
console.log(`Bounce palette: ${checks} scheme/theme/map combinations and theme invalidation passed`);
