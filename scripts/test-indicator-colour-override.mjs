import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";

/**
 * Picking a colour has to change what is drawn.
 *
 * Indicators paint from the theme while `useThemeColors` is true, and it
 * defaults to true. The colour picker cleared that flag ONLY when the
 * indicator had an entry in themeColourMapFor — which is bounce levels and the
 * volume profiles. On every other indicator the chosen colour was written to
 * settings and then ignored, which is what "changing the colours doesn't work"
 * meant on Big Contracts and Big Blocks.
 */
const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");

// --- the override is unconditional now ---
{
  // The GENERIC picker — the one every indicator without a bespoke colour
  // block uses. Anchored on its theme-map seeding so it cannot be confused
  // with the footprint profile picker, which is correctly disabled until the
  // trader turns theme colours off.
  const anchor = control.indexOf("themeColours && current.settings?.useThemeColors !== false ? themeColours");
  assert.ok(anchor > 0, "the generic colour picker was not found");
  const body = control.slice(anchor - 900, anchor + 900);
  assert.ok(
    body.includes("useThemeColors: false,"),
    "picking a colour must clear the theme override for every indicator",
  );
  assert.ok(
    !body.includes("...(themeColours ? { useThemeColors: false } : {})"),
    "clearing the flag must not depend on the indicator having a theme map",
  );
  // The seeding of sibling colours is still gated on a map, since without one
  // there is nothing to seed from.
  assert.ok(
    body.includes("themeColours && current.settings?.useThemeColors !== false ? themeColours : {}"),
    "sibling colours are still seeded where a map exists",
  );

  // The footprint's own profile colours take the other honest route: the
  // fields are disabled until theme colours are turned off. That must stay.
  assert.match(
    control,
    /disabled=\{settingsInstance\.settings\?\.useThemeColors !== false\}/,
    "the footprint profile colours stay gated behind their own toggle",
  );
}

// --- the two reported indicators map their swatches to what is drawn ---
{
  const map = control.slice(control.indexOf("const themeColourMapFor ="));
  const body = map.slice(0, map.indexOf("\n};"));
  assert.ok(body.includes('indicatorId === "big-trades"'), "Big Contracts needs a theme map");
  assert.ok(body.includes('indicatorId === "deep-m-effort-nq"'), "Big Blocks needs a theme map");
  // Both primitives read the theme's up/down colours for their two sides.
  assert.match(body, /askColor: chartSettings\.upColor/);
  assert.match(body, /bidColor: chartSettings\.downColor/);

  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  for (const [label, marker] of [
    ["Big Contracts", "bigTradePrimitiveMarkers"],
    ["Big Blocks", "bigBlockRenderZones"],
  ]) {
    const update = chart.slice(chart.indexOf(marker));
    const options = update.slice(0, update.indexOf("},\n    );"));
    assert.ok(
      options.includes("useThemeColors") && options.includes("settings.upColor"),
      `${label} still resolves its colours through the theme flag`,
    );
  }
}

// --- the flag really does default on, which is what made this silent ---
{
  for (const indicatorId of ["big-trades", "deep-m-effort-nq"]) {
    const defaults = defaultIndicatorSettings(indicatorId);
    assert.equal(defaults.useThemeColors, true,
      `${indicatorId} paints from the theme until a colour is picked`);
    assert.ok(defaults.askColor, `${indicatorId} carries its own ask colour`);
    assert.ok(defaults.bidColor, `${indicatorId} carries its own bid colour`);
  }
}

// --- every indicator offering the flag is covered by the unconditional clear ---
{
  const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  const withFlag = new Set(
    [...config.matchAll(/indicatorId === "([a-z0-9-]+)"[\s\S]{0,900}?useThemeColors: true/g)]
      .map((match) => match[1]),
  );
  assert.ok(withFlag.size >= 15,
    `expected many indicators to carry the flag, found ${withFlag.size}`);
  // Which id each block belongs to is not worth asserting from source text —
  // the block above proves it properly through defaultIndicatorSettings for
  // the two that were reported. What matters here is the SCALE: the picker no
  // longer branches on the indicator when clearing the flag, so every one of
  // these two dozen is fixed by the same line.
}

console.log("Indicator colour override tests passed.");
