import assert from "node:assert/strict";
import test from "node:test";

import { themePresets } from "../src/lib/themePresets.ts";

const revision = "v=20260904-liq-contrast";
const themesUrl = new URL(`../public/heatmap-app/src/ui-themes.js?${revision}`, import.meta.url);
const palettesUrl = new URL(`../public/heatmap-app/src/palettes.js?${revision}`, import.meta.url);
const { setWebsiteThemeColors } = await import(themesUrl);
const {
  DEFAULT_PALETTE,
  colorContrast,
  paletteAccents,
  readableAccentText,
} = await import(palettesUrl);

function rgb(value) {
  const match = String(value).match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  assert.ok(match, `expected six-digit hex colour, received ${value}`);
  return match.slice(1).map((part) => Number.parseInt(part, 16));
}

test("every website theme keeps both Liquidity Map sides readable", () => {
  for (const preset of themePresets) {
    setWebsiteThemeColors(preset.colors);
    const accents = paletteAccents(DEFAULT_PALETTE);
    const surfaces = [rgb(preset.colors.chartBackground), rgb(preset.colors.panel)];
    for (const [side, accent] of Object.entries(accents)) {
      for (const surface of surfaces) {
        assert.ok(
          colorContrast(accent, surface) >= 4.5,
          `${preset.name} ${side} must meet 4.5:1 against ${surface.join(",")}`,
        );
      }
      assert.ok(
        colorContrast(readableAccentText(accent), accent) >= 4.5,
        `${preset.name} ${side} best-price label must remain readable`,
      );
    }
  }
});

test("Chromey Mono replaces its black hollow sell ink with distinct light green", () => {
  const chromey = themePresets.find((preset) => preset.name === "Chromey Mono");
  assert.ok(chromey);
  setWebsiteThemeColors(chromey.colors);
  const { bid, ask } = paletteAccents(DEFAULT_PALETTE);

  assert.deepEqual(bid, [0, 255, 0]);
  assert.ok(ask[1] > ask[0] && ask[1] > ask[2], `expected light green, received ${ask}`);
  assert.ok(Math.min(...ask) >= 100, `sell bubbles must be light, received ${ask}`);
  assert.notDeepEqual(ask, bid);
  assert.ok(colorContrast(ask, [0, 0, 0]) >= 4.5);
});
