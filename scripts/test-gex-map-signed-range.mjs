import test from "node:test";
import assert from "node:assert/strict";
import { formatGexMapExposureLegend } from "../src/lib/gexMapFormat.ts";
import {
  gexMapExposureRange, gexMapHeatStrength, gexMapHeatColorHex, gexMapHeatColorCss,
  gexMapSignedLegendGradient, gexMapPaletteFromPreset, gexMapSignedScaleHex,
  GEX_MAP_SHARED_PALETTE_PRESETS, normalizeGexMapPalette, hexLerp, gexMapSignedScale,
} from "../src/lib/gexMapPalette.ts";

const range = gexMapExposureRange([-1.76e9, -440e6, 0, 11e6, 44e6]);
test("the domain is the actual current negative/positive range, without symmetric padding", () => {
  assert.deepEqual(range, { min: -1.76e9, max: 44e6 });
  assert.equal(gexMapHeatStrength(range.min, range), 0);
  assert.equal(gexMapHeatStrength(range.max, range), 1);
  assert.equal(gexMapHeatStrength(-440e6, range), .375);
  assert.equal(gexMapHeatStrength(11e6, range), .625);
  assert.equal(gexMapHeatStrength(0, range), .5);
});

for (const preset of GEX_MAP_SHARED_PALETTE_PRESETS) {
  test(`${preset.label}: both unequal peaks reach their own exact palette endpoints`, () => {
    const palette = gexMapPaletteFromPreset(preset);
    const before = structuredClone(palette);
    const scale = gexMapSignedScaleHex(palette, { negative: "#000000", positive: "#FFFFFF" });
    assert.equal(gexMapHeatColorHex(gexMapHeatStrength(range.min, range), scale), scale[0]);
    assert.equal(gexMapHeatColorHex(gexMapHeatStrength(range.max, range), scale), scale[9]);
    assert.equal(gexMapHeatColorHex(gexMapHeatStrength(-440e6, range), scale), scale[3]);
    assert.equal(gexMapHeatColorHex(gexMapHeatStrength(11e6, range), scale), scale[6]);
    // Very small values must keep their sign despite floating-point rounding.
    assert.notEqual(gexMapHeatColorHex(gexMapHeatStrength(-1e-20, range), scale),
      gexMapHeatColorHex(gexMapHeatStrength(1e-20, range), scale));
    for (const value of [range.min, -1e6, -1e-20, 0, 1e-20, 1e6, range.max]) {
      assert.equal(gexMapHeatColorCss(gexMapHeatStrength(value, range), scale),
        gexMapHeatColorHex(gexMapHeatStrength(value, range), scale));
    }
    assert.deepEqual(palette, before, "scaling cannot rewrite a saved palette");
  });
}

test("zero seam never mixes nonzero opposite signs, and the legend matches it", () => {
  const scale = ["#00FFFF", "#11EEEE", "#22DDDD", "#33CCCC", "#44BBBB",
    "#BB44BB", "#CC33CC", "#DD22DD", "#EE11EE", "#FF00FF"];
  assert.equal(gexMapHeatColorHex(.5 - Number.EPSILON, scale), scale[4]);
  assert.equal(gexMapHeatColorHex(.5 + Number.EPSILON, scale), scale[5]);
  const gradient = gexMapSignedLegendGradient(scale);
  assert.ok(gradient.includes(`${scale[4]} 50%, ${scale[5]} 50%`));
  assert.ok(gradient.includes(`${scale[0]} 0%`));
  assert.ok(gradient.includes(`${scale[9]} 100%`));
});

test("small-unit Greeks still reach the endpoints, rather than dividing by an invented one", () => {
  const small = gexMapExposureRange([-.0004, .0000002]);
  assert.equal(gexMapHeatStrength(-.0004, small), 0);
  assert.equal(gexMapHeatStrength(.0000002, small), 1);
});

test("missing sides and empty/nonfinite inputs never invent exposure", () => {
  assert.deepEqual(gexMapExposureRange([1, 9]), { min: 0, max: 9 });
  assert.deepEqual(gexMapExposureRange([-9, -1]), { min: -9, max: 0 });
  assert.deepEqual(gexMapExposureRange([NaN, Infinity, -Infinity, 0]), { min: 0, max: 0 });
  assert.equal(gexMapHeatStrength(NaN, range), .5);
  assert.equal(gexMapHeatStrength(0, gexMapExposureRange([])), .5);
});

test("legend labels show actual asymmetric peaks and retain small-unit precision", () => {
  assert.equal(formatGexMapExposureLegend(range.min), "−$1.76B");
  assert.equal(formatGexMapExposureLegend(range.max), "+$44.00M");
  assert.equal(formatGexMapExposureLegend(0), "0");
  assert.equal(formatGexMapExposureLegend(.1), "+$0.1");
  assert.equal(formatGexMapExposureLegend(-.0004), "−$4.00e-4");
});

test("a new snapshot recomputes both peaks independently; old input is unchanged", () => {
  const old = [-1.76e9, 44e6], next = [-44e6, 88e6];
  assert.deepEqual(gexMapExposureRange(next), { min: -44e6, max: 88e6 });
  assert.deepEqual(gexMapExposureRange(old), { min: -1.76e9, max: 44e6 });
  assert.equal(gexMapHeatStrength(44e6, gexMapExposureRange(next)), .75);
  assert.equal(gexMapHeatStrength(44e6, gexMapExposureRange(old)), 1);
});

test("theme CSS colours use the same side interpolation and saved custom stops survive", () => {
  const css = Array.from({ length: 10 }, (_, i) => `var(--color-${i})`);
  assert.equal(gexMapHeatColorCss(0, css), css[0]);
  assert.equal(gexMapHeatColorCss(1, css), css[9]);
  assert.equal(gexMapHeatColorCss(.5 - Number.EPSILON, css).includes(css[5]), false);
  assert.equal(gexMapHeatColorCss(.5 + Number.EPSILON, css).includes(css[4]), false);
});

test("stock weak nodes fade in their own hue, without an opposite-sign purple middle", () => {
  const neutral = [16, 20, 26];
  const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const preset of GEX_MAP_SHARED_PALETTE_PRESETS) {
    for (const [stops, endpoint] of [[preset.scale.slice(0, 5), preset.negative], [preset.scale.slice(5), preset.positive]]) {
      const peak = channels(endpoint);
      for (const stop of stops) channels(stop).forEach((channel, i) => {
        assert.ok(channel >= Math.min(neutral[i], peak[i]) && channel <= Math.max(neutral[i], peak[i]), preset.id);
      });
    }
  }
  const scale = GEX_MAP_SHARED_PALETTE_PRESETS.find((p) => p.id === "cyan-magenta").scale;
  const neg = channels(gexMapHeatColorHex(gexMapHeatStrength(-1, { min: -100, max: 100 }), scale));
  const pos = channels(gexMapHeatColorHex(gexMapHeatStrength(1, { min: -100, max: 100 }), scale));
  assert.ok(neg[1] > neg[0] && neg[2] > neg[0], "weak negative stays cyan");
  assert.ok(pos[0] > pos[1] && pos[2] > pos[1], "weak positive stays magenta");
});

test("unchanged old stock ramps upgrade on load; customised stops and star colours survive", () => {
  for (const preset of GEX_MAP_SHARED_PALETTE_PRESETS) {
    const old = gexMapPaletteFromPreset(preset);
    old.scaleStops = Array.from({ length: 10 }, (_, i) => hexLerp(old.negative, old.positive, i / 9));
    old.negativeSoft = old.scaleStops[4]; old.positiveSoft = old.scaleStops[5]; old.star = "#123ABC";
    const migrated = normalizeGexMapPalette(old);
    assert.deepEqual(migrated.scaleStops, preset.scale);
    assert.equal(migrated.star, old.star);
    old.scaleStops[2] = "#123ABC";
    assert.deepEqual(normalizeGexMapPalette(old).scaleStops, old.scaleStops);
  }
});

test("theme and fallback ramps reach full endpoints and dim both signs near zero", () => {
  const palette = { ...gexMapPaletteFromPreset(GEX_MAP_SHARED_PALETTE_PRESETS[0]), useThemeColors: true };
  const scale = gexMapSignedScaleHex(palette, { negative: "#00FFFF", positive: "#FF00FF" });
  assert.equal(scale[0], "#00FFFF"); assert.equal(scale[9], "#FF00FF");
  assert.ok(parseInt(scale[4].slice(3, 5), 16) < 50);
  assert.ok(parseInt(scale[5].slice(1, 3), 16) < 50);
  const css = gexMapSignedScale(palette);
  assert.ok(css[0].includes("var(--danger) 100%"));
  assert.ok(css[9].includes("var(--primary) 100%"));
  assert.ok(css[4].includes("var(--danger) 10%"));
  assert.ok(css[5].includes("var(--primary) 10%"));
});
