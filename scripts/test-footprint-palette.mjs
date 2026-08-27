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
  assert.match(themed, /disabled=\{settingsInstance\.settings\?\.useThemeColors !== false\}/);
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

console.log(`\nfootprint palette: ${passed}/${passed} checks passed`);
