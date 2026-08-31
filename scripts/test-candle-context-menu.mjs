import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { OPEN_CANDLE_SETTINGS_EVENT } = await import("../src/lib/candleStyle.ts");

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const control = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8",
);

/**
 * Reaching the candle colours from the chart itself.
 *
 * The colours, the style and the gradient schemes all live in one panel, and
 * the only way in was the indicator list - which is not where anyone reaches
 * for them. Right-clicking the candles is.
 *
 * The chart asks for that panel by name rather than growing a second copy of
 * the same controls, because two sets of colour pickers writing the same
 * settings is how they drift apart.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the event has one definition, shared by both sides", () => {
  assert.equal(OPEN_CANDLE_SETTINGS_EVENT, "kwantdesk:open-candle-settings");
  assert.ok(chart.includes("OPEN_CANDLE_SETTINGS_EVENT"), "the chart does not use the shared name");
  assert.ok(control.includes("OPEN_CANDLE_SETTINGS_EVENT"), "the control does not use the shared name");
  // A hand-typed string on either side would drift silently.
  assert.doesNotMatch(chart, /"kwantdesk:open-candle-settings"/);
  assert.doesNotMatch(control, /"kwantdesk:open-candle-settings"/);
});

check("the right-click menu offers the colours", () => {
  assert.match(chart, /Candle colours and palettes\.\.\./);
  assert.match(chart, /window\.dispatchEvent\(new CustomEvent\(OPEN_CANDLE_SETTINGS_EVENT\)\)/);
});

check("only the focused chart offers it", () => {
  /*
   * The control that owns the panel always edits the ACTIVE chart. Offering
   * this from a pane that is not focused would quietly change a different
   * chart's candles - the trader would watch the wrong one repaint.
   */
  const at = chart.indexOf("Candle colours and palettes...");
  const before = chart.slice(Math.max(0, at - 900), at);
  assert.match(before, /\{keyboardActive \? \(/, "the entry is not gated on the focused pane");
});

check("the panel opens and the listener is removed", () => {
  assert.match(control, /window\.addEventListener\(OPEN_CANDLE_SETTINGS_EVENT, open\)/);
  assert.match(control, /window\.removeEventListener\(OPEN_CANDLE_SETTINGS_EVENT, open\)/);
  assert.match(control, /const open = \(\) => setCandleSettingsOpen\(true\);/);
});

check("the existing chart settings entry is still there", () => {
  // The request was colours AND chart settings; this one already existed and
  // must not have been replaced by the new one.
  assert.match(chart, /Chart settings\.\.\./);
  assert.match(chart, /onOpenSettings\?\.\(\);/);
});

check("no second set of colour controls was grown on the chart", () => {
  /*
   * The panel is the single place these settings are written. A duplicate set
   * of pickers in the context menu would be two sources for one value.
   */
  const menuStart = chart.indexOf("{contextMenu && (");
  const menu = chart.slice(menuStart, menuStart + 12_000);
  assert.ok(!menu.includes("CANDLE_SETTING_KEYS"), "the menu writes candle settings directly");
  assert.ok(!menu.includes("ChartColorField"), "the menu grew its own colour pickers");
});

console.log(`\ncandle context menu: ${passed}/${passed} checks passed`);
