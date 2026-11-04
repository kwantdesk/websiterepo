import assert from "node:assert/strict";
import test from "node:test";

import { themePresets } from "../src/lib/themePresets.ts";
import { legacyHollowTheme } from "./fixtures/legacy-hollow-theme.mjs";

// Match the revision imported by palettes.js; different query strings create
// different module state, so the old test never themed its actual palette.
const revision = "v=20261017-aleph-font";
const themesUrl = new URL(`../public/heatmap-app/src/ui-themes.js?${revision}`, import.meta.url);
const palettesUrl = new URL(`../public/heatmap-app/src/palettes.js?${revision}`, import.meta.url);
const { setWebsiteThemeColors } = await import(themesUrl);
const {
  DEFAULT_PALETTE,
  HEAT_GRADIENT_PRESETS,
  paletteCanvasTheme,
  paletteLut,
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
    const chrome = paletteCanvasTheme(DEFAULT_PALETTE);
    const surfaces = [rgb(chrome.axis), rgb(chrome.axisAlt)];
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

test("a saved legacy hollow palette replaces black sell ink with distinct light green", () => {
  const chromey = {colors: legacyHollowTheme};
  assert.ok(chromey);
  setWebsiteThemeColors(chromey.colors);
  const { bid, ask } = paletteAccents(DEFAULT_PALETTE);

  assert.deepEqual(bid, [0, 255, 0]);
  assert.ok(ask[1] > ask[0] && ask[1] > ask[2], `expected light green, received ${ask}`);
  assert.ok(Math.min(...ask) >= 100, `sell bubbles must be light, received ${ask}`);
  assert.notDeepEqual(ask, bid);
  assert.ok(colorContrast(ask, [0, 0, 0]) >= 4.5);
});

 test('all dark/white map presets keep DOM and price rail on their own palette surface',()=>{for(const theme of themePresets){setWebsiteThemeColors(theme.colors);for(const preset of HEAT_GRADIENT_PRESETS){const chrome=paletteCanvasTheme(preset.id),background=[...paletteLut(preset.id).subarray(0,3)];assert.deepEqual(rgb(chrome.axis),background);assert.deepEqual(rgb(chrome.axisAlt),background);assert.ok(colorContrast(rgb(chrome.text),background)>=4.5,theme.name+' / '+preset.id);for(const accent of Object.values(paletteAccents(preset.id)))assert.ok(colorContrast(accent,background)>=4.5);}}});
 test('switching map presets and website themes uses fresh colours without a reload',()=>{setWebsiteThemeColors({foreground:'#ffffff',background:'#000000',panel:'#080808',chartBackground:'#000000'});assert.equal(paletteCanvasTheme('cyan-magenta').axisAlt,'#000000');assert.equal(paletteCanvasTheme('white-cyan-magenta').axisAlt,'#ffffff');assert.equal(paletteCanvasTheme('cyan-magenta').axisAlt,'#000000');setWebsiteThemeColors({foreground:'#111111',background:'#fafafa',panel:'#f1f1f1',chartBackground:'#fafafa'});assert.equal(paletteCanvasTheme('auto').axisAlt,'#f1f1f1');assert.ok(colorContrast(rgb(paletteCanvasTheme('white-cyan-magenta').text),[255,255,255])>=4.5);});
