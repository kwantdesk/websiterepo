import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STATS_PALETTES,
  resolveStatsPalette,
  statsPaletteSettings,
} from "../src/lib/statsPalettes.ts";
import { GEX_MAP_PALETTE_PRESETS } from "../src/lib/gexMapPalette.ts";

/**
 * A Kwant Stats colour scheme has to be readable and has to actually apply.
 *
 * Two failures matter. A scheme whose text lands on its own header colour
 * prints numbers nobody can read — and it would look like a rendering bug
 * rather than a palette choice. And a scheme applied while the study is still
 * following the chart theme does nothing at all, which reads as a broken
 * control.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const HEX = /^#[0-9a-f]{6}$/i;

const luminance = (hex) => {
  const int = Number.parseInt(hex.slice(1), 16);
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((int >> 16) & 255)
    + 0.7152 * channel((int >> 8) & 255)
    + 0.0722 * channel(int & 255);
};
const contrast = (a, b) => {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
};

check("the schemes are the desk's own, not a new set", () => {
  assert.equal(
    STATS_PALETTES.length, GEX_MAP_PALETTE_PRESETS.length,
    "a separate list would drift from the shared palettes the moment either changed",
  );
  assert.ok(STATS_PALETTES.length >= 20, `expected at least twenty, got ${STATS_PALETTES.length}`);
});

check("every scheme fills all five colours", () => {
  for (const palette of STATS_PALETTES) {
    for (const role of ["positiveColor", "negativeColor", "neutralColor", "textColor", "headerColor"]) {
      assert.match(palette[role], HEX, `${palette.id}.${role} is not a colour`);
    }
    assert.ok(palette.label.length > 0, `${palette.id} has no label`);
  }
});

check("text is readable on its own header in every scheme", () => {
  const failures = STATS_PALETTES
    .map((palette) => [palette.label, contrast(palette.textColor, palette.headerColor)])
    .filter(([, ratio]) => ratio < 4.5);
  assert.deepEqual(failures, [], `unreadable: ${failures.map(([l, r]) => `${l} ${r.toFixed(2)}`).join(", ")}`);
});

check("up and down are never the same colour", () => {
  for (const palette of STATS_PALETTES) {
    assert.notEqual(
      palette.positiveColor.toLowerCase(), palette.negativeColor.toLowerCase(),
      `${palette.id} cannot tell a positive row from a negative one`,
    );
  }
});

check("applying a scheme takes the study off the chart theme", () => {
  // Left on, the theme stays in charge and the scheme does nothing.
  const settings = statsPaletteSettings(STATS_PALETTES[0]);
  assert.equal(settings.useThemeColors, false);
  assert.equal(settings.statsPaletteId, STATS_PALETTES[0].id);
  assert.equal(settings.positiveColor, STATS_PALETTES[0].positiveColor);
  assert.equal(settings.headerColor, STATS_PALETTES[0].headerColor);
});

check("an unknown or missing scheme resolves to nothing rather than a default", () => {
  // The caller uses null to mean "leave the colours alone", so silently
  // substituting a palette here would overwrite hand-set colours.
  for (const id of [undefined, "", "not-a-palette"]) {
    assert.equal(resolveStatsPalette(id), null, `"${String(id)}" must not resolve`);
  }
});

check("the study reads its own colours when the theme is off", () => {
  const source = readFileSync(new URL("../src/lib/kwantStats.ts", import.meta.url), "utf8");
  for (const role of ["positiveColor", "negativeColor", "neutralColor", "textColor", "headerColor"]) {
    assert.ok(source.includes(role), `kwantStats never reads ${role}`);
  }
  assert.match(source, /useThemeColors \? colors\.positive : text\(instance, "positiveColor"/);
});

check("the picker is wired to the settings panel", () => {
  const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  assert.match(control, /statsPaletteSettings\(palette\)/, "choosing a scheme must write its colours");
  assert.match(control, /statsPaletteId: ""/, "Custom must clear the scheme without touching the colours");
});

console.log(`\nstats palettes: ${passed}/${passed} checks passed (${STATS_PALETTES.length} schemes)`);
