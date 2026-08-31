import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { CHART_INDICATOR_CATALOG } = await import("../src/lib/chartIndicatorCatalog.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");
const { settingsWithThemeColours, themeDerivedColorKeys } =
  await import("../src/lib/indicatorPaletteRegistry.ts");
const { themePresets } = await import("../src/lib/themePresets.ts");

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

/**
 * Every indicator follows the theme, on every theme.
 *
 * A study's colours were seeded from the theme ONCE, when it was added, and
 * never re-derived. Changing theme moved the candles and left the studies
 * behind - Volume and CVD among them. Only the handful with a hand-written
 * block in Chart.tsx ever followed, which is why the footprint worked and its
 * neighbours did not.
 *
 * The generic seam that should have done it returned early unless a gradient
 * scheme was set. With the scheme Off - the normal state, and the state the
 * trader reported this from - it did nothing at all.
 *
 * This checks the whole catalogue against every shipped theme, because being
 * asked for this a third time is the actual failure.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const asChartSettings = (preset) => ({
  upColor: preset.colors.candleUp,
  downColor: preset.colors.candleDown,
  borderUpColor: preset.colors.candleUpBorder,
  borderDownColor: preset.colors.candleDownBorder,
  gridColor: preset.colors.gridColor,
  backgroundColor: preset.colors.chartBackground,
});

const ids = CHART_INDICATOR_CATALOG.map((definition) => definition.id);
const themes = themePresets.map((preset) => ({ name: preset.name, settings: asChartSettings(preset) }));

check("there is a catalogue and a set of themes to check", () => {
  // If either collection stops resolving, everything below passes vacuously.
  assert.ok(ids.length > 50, `only ${ids.length} indicators`);
  assert.ok(themes.length > 20, `only ${themes.length} themes`);
});

check("every theme-derived colour lands on the new theme, for every indicator", () => {
  const failures = [];
  for (const id of ids) {
    const keys = [...themeDerivedColorKeys(id)];
    if (!keys.length) continue;
    for (const from of themes) {
      // Created under one theme...
      let created;
      try {
        created = { indicatorId: id, settings: { ...defaultIndicatorSettings(id, from.settings), useThemeColors: true } };
      } catch { continue; }
      for (const to of themes) {
        if (to.name === from.name) continue;
        const moved = settingsWithThemeColours(created, to.settings);
        const expected = defaultIndicatorSettings(id, to.settings);
        for (const key of keys) {
          if (moved.settings?.[key] !== expected[key]) {
            failures.push(`${id}.${key}: ${from.name} -> ${to.name} gave ${moved.settings?.[key]}, theme says ${expected[key]}`);
          }
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} colours did not follow:\n  ${failures.slice(0, 12).join("\n  ")}`);
});

check("the two the trader reported are among them", () => {
  // Volume and CVD. Named explicitly so a regression says so in one line.
  for (const id of ["volume", "cumulative-volume-delta"]) {
    const keys = [...themeDerivedColorKeys(id)];
    assert.ok(keys.length, `${id} has no theme-derived colours at all`);
    const created = { indicatorId: id, settings: { ...defaultIndicatorSettings(id, themes[0].settings), useThemeColors: true } };
    const moved = settingsWithThemeColours(created, themes[1].settings);
    const changed = keys.filter((key) => created.settings[key] !== moved.settings?.[key]);
    assert.ok(changed.length, `${id} did not repaint when the theme changed`);
  }
});

check("colours a study fixes for itself keep their meaning", () => {
  /*
   * Session identities and regime bands are not theme colours. Rewriting them
   * from the theme would collapse Tokyo, London, New York and Sydney onto one
   * colour, which is worse than not following at all - which is exactly why
   * the keys are discovered from the study's own defaults rather than guessed
   * from their names.
   */
  for (const id of ["sessions", "vix-environment"]) {
    assert.equal(themeDerivedColorKeys(id).size, 0, `${id} would have its identity colours overwritten`);
    const created = { indicatorId: id, settings: { ...defaultIndicatorSettings(id, themes[0].settings), useThemeColors: true } };
    assert.equal(settingsWithThemeColours(created, themes[1].settings), created, `${id} was rewritten anyway`);
  }
});

check("a study that says it follows the theme actually does", () => {
  /*
   * `useThemeColors: true` with hardcoded colours is a flag that lies, and
   * nothing downstream can correct it: a colour only moves with the theme if
   * the default it came from did. Classic GEX Profile was in exactly that
   * state.
   *
   * Opting out is fine and Gamma Environment does it deliberately - semantic
   * green/red so positive and negative gamma stay apart on monochrome themes -
   * but it says so with the flag.
   */
  const liars = [];
  for (const id of ids) {
    let defaults;
    try { defaults = defaultIndicatorSettings(id, themes[0].settings); } catch { continue; }
    if (defaults?.useThemeColors !== true) continue;
    const colourKeys = Object.keys(defaults).filter((key) => /colou?r$/i.test(key));
    if (!colourKeys.length) continue;
    // At least one of its colours has to actually move with the theme.
    if (!themeDerivedColorKeys(id).size) liars.push(id);
  }
  assert.deepEqual(liars, [], `these claim to follow the theme and cannot:\n  ${liars.join("\n  ")}`);
});

check("picking a colour opts the instance out", () => {
  // `useThemeColors: false` is what the settings dialog writes when a colour is
  // chosen, and it has to survive a theme change or the pick is meaningless.
  const chosen = {
    indicatorId: "cumulative-volume-delta",
    settings: { ...defaultIndicatorSettings("cumulative-volume-delta", themes[0].settings), useThemeColors: false },
  };
  assert.equal(settingsWithThemeColours(chosen, themes[1].settings), chosen);
});

check("an instance already on the theme is returned by identity", () => {
  /*
   * This runs on the live path for every study on every chart. Allocating a
   * fresh settings object when nothing changed would rerender the whole
   * indicator list on every pass.
   */
  const settings = { ...defaultIndicatorSettings("volume", themes[0].settings), useThemeColors: true };
  const instance = { indicatorId: "volume", settings };
  assert.equal(settingsWithThemeColours(instance, themes[0].settings), instance);
});

check("the chart applies it under the scheme, not over it", () => {
  // A chosen gradient scheme is a deliberate act and still outranks the theme.
  assert.match(
    chart,
    /settingsWithPalette\(\s*[\s\S]{0,1200}?settingsWithThemeColours\(instance, indicatorThemeSettings\),\s*\n\s*indicatorPaletteThemeValue,\s*\n\s*\)/,
    "the chart no longer feeds theme colours into the palette seam",
  );
});

console.log(`\nindicator theme follow: ${passed}/${passed} checks passed`);
