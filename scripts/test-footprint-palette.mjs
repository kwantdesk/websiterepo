import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The footprint's colours are settable, and they were not.
 *
 * Every colour key was already resolved in Chart.tsx and honoured by the
 * renderer - ask, bid, POC, delta POC, value area, clusters, single prints,
 * stacked imbalance, VWAP. What was missing was any way to set one. Worse, the
 * profile pickers that DID exist were disabled until "Use theme colours" was
 * off, and that control existed nowhere in the footprint dialog, so they could
 * never be reached at all.
 */

const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/lib/footprintSettings.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** The block this test is about, so a picker elsewhere cannot satisfy it. */
const palette = (() => {
  const start = control.indexOf('<div data-settings-section="Colours"');
  assert.ok(start > 0, "the footprint palette block is missing");
  return control.slice(start, control.indexOf("</div>\n              ) : null}", start));
})();

check("the toggle that gates the pickers actually exists", () => {
  // THE BUG. Without this control the profile pickers were permanently
  // disabled, behind a tooltip telling the trader to turn off a switch that was
  // not in the dialog.
  assert.match(palette, /checked=\{settingsInstance\.settings\?\.useThemeColors !== false\}/);
  assert.match(palette, /settings: \{ \.\.\.\(current\.settings \?\? \{\}\), useThemeColors: event\.target\.checked \}/);
  assert.match(palette, /Use theme colours/);
});

check("every colour the renderer honours can be set", () => {
  // A key the renderer reads but the dialog cannot reach is a setting that does
  // not exist as far as a trader is concerned.
  for (const key of [
    "askColor", "bidColor", "neutralColor", "pocColor", "deltaPocColor",
    "stackedAskColor", "stackedBidColor", "betweenColor", "textColor",
    "valueAreaColor", "clusterColor", "singlePrintColor",
    "unfinishedAuctionColor", "vwapColor",
  ]) {
    assert.ok(palette.includes(`"${key}"`), `${key} has no picker`);
    assert.ok(chart.includes(`${key}:`), `${key} is not resolved for the renderer`);
  }
});

check("it uses the same picker as every other colour on the desk", () => {
  // ChartColorField is the site-wide themed picker. A native colour input here
  // would open the Windows dialog and look nothing like the rest of the desk.
  assert.match(palette, /<ChartColorField/);
  assert.doesNotMatch(palette, /type="color"/);
});

check("theme-linked colours defer to the theme, the rest never do", () => {
  // Ask and bid have a theme equivalent, so the toggle owns them. Cluster,
  // single print, VWAP and the others do not, so they stay the trader's choice
  // and must not be greyed out by a switch that cannot supply them.
  const [themed, always] = palette.split("The theme has no equivalent");
  for (const key of ["askColor", "bidColor", "pocColor", "stackedAskColor"]) {
    assert.ok(themed.includes(`"${key}"`), `${key} should sit in the theme-gated group`);
  }
  for (const key of ["clusterColor", "singlePrintColor", "vwapColor", "textColor"]) {
    assert.ok(always.includes(`"${key}"`), `${key} should sit in the always-editable group`);
  }
  // Matched on the condition rather than the whole expression: it became
  // multi-line when a gradient scheme was given the right to lock it too.
  assert.match(themed, /settingsInstance\.settings\?\.useThemeColors !== false/);
  assert.doesNotMatch(always, /disabled=\{settingsInstance\.settings\?\.useThemeColors/);
});

check("a chosen colour survives validation, so it saves with the workspace", () => {
  // Settings are written through the indicator instance, which is what a
  // workspace persists. Validation must carry unknown-to-it keys through rather
  // than rebuilding the object from a whitelist, or every colour would be
  // dropped on the next load.
  assert.match(settings, /const merged = \{ \.\.\.DEFAULT_FOOTPRINT_SETTINGS, \.\.\.source \} as FootprintSettings;/);
  assert.match(settings, /return \{\s*\n\s*\.\.\.merged,/);
  assert.match(palette, /replace\(settingsInstance\.instanceId, \(current\) => \(\{/);
});

check("one click recolours the whole footprint", () => {
  /*
   * What was actually asked for: the same gradient schemes the volume profile
   * has, applied in ONE CLICK. Fourteen individual swatches is not that.
   *
   * The endpoints map to the two sides a footprint is made of - `from` is the
   * bid, `to` is the ask - and the POC, value area, neutral and stacked
   * markers are blended from those two, so a scheme reads as one graded
   * palette rather than two raw colours with unrelated markers over it.
   */
  assert.match(palette, /VOLUME_PROFILE_GRADIENTS\.map\(\(gradient\) => \{/);
  assert.match(palette, /gradientPreset: gradient\.id/);
  // An Off button, or a scheme could never be taken back off.
  assert.match(palette, /gradientPreset: VOLUME_PROFILE_GRADIENT_OFF/);

  // The renderer has to honour it, or the button is decoration.
  assert.match(chart, /const footprintGradient = resolveVolumeProfileGradient\(footprintSettings\.gradientPreset\);/);
  assert.match(chart, /askColor: footprintGradient\s*\n\s*\? footprintGradient\.to/);
  assert.match(chart, /bidColor: footprintGradient\s*\n\s*\? footprintGradient\.from/);
  // Derived, not raw: the markers blend the two endpoints.
  assert.match(chart, /valueAreaColor: footprintGradient\s*\n\s*\? mixHexColors\(footprintGradient\.from, footprintGradient\.to, 0\.35\)/);
});

check("the schemes are the profile's own, not a second list", () => {
  // A copied list would drift the first time one of them was tuned.
  const gradients = readFileSync(new URL("../src/lib/volumeProfileGradients.ts", import.meta.url), "utf8");
  assert.match(gradients, /export const VOLUME_PROFILE_GRADIENTS/);
  assert.match(palette, /VOLUME_PROFILE_GRADIENTS/);
});

check("an active scheme owns every colour", () => {
  // The profile locks its pickers while a scheme is on, for a good reason:
  // letting both apply produces something that half-follows a gradient. Both
  // footprint groups defer now - the theme-gated ones AND the always-editable
  // ones, which had no disabled state at all before.
  const deferrals = palette.match(/isVolumeProfileGradientActive\(settingsInstance\.settings\?\.gradientPreset\)/g) ?? [];
  assert.ok(deferrals.length >= 4, `expected both picker groups to defer, found ${deferrals.length}`);
  assert.match(palette, /A gradient scheme owns every colour/);
});


console.log(`\nfootprint palette: ${passed}/${passed} checks passed`);
