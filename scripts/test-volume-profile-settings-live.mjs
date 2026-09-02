import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

/**
 * No volume-profile setting is stored and then ignored.
 *
 * Four have been found this way, each of them a control that persisted,
 * round-tripped through the settings versions and moved nothing on the chart:
 * `numberOfProfiles`, `valueAreaDeveloping`, `pocHighlightOpacity` and
 * `shiftedPocOpacity` (with `shiftedPocTicks`, whose feature was never built).
 *
 * A dead setting survives every ordinary review. It looks right in the dialog,
 * it saves, it reloads, and the only way to notice is to compare against
 * another platform and wonder why yours does not move. So it is checked
 * mechanically instead: for every key the profile stores, something outside the
 * config file has to read it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const root = fileURLToPath(new URL("../src", import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(full) ? [full] : [];
});

/** Where settings are declared and persisted, rather than acted on. */
const DECLARING = "chartIndicatorConfig.ts";
/** A control proves the trader can set it, not that anything obeys it. */
const DIALOG = "ChartIndicatorsControl.tsx";
/*
 * Bookkeeping rather than behaviour: the schema version decides which
 * migrations run and is deliberately never read by a renderer.
 */
const BOOKKEEPING = new Set([
  "profileSettingsVersion",
  // Interaction state for the settings dialog: it distinguishes the first
  // session pick (isolate) from later multi-select toggles. It is consumed by
  // the dialog itself rather than by the profile renderer.
  "sessionSelectionArmed",
]);

const files = walk(root).map((path) => ({
  path: path.slice(path.indexOf("src")).split("\\").join("/"),
  source: readFileSync(path, "utf8"),
}));

const THEME = {
  upColor: "#22C55E", downColor: "#EF4444", borderUpColor: "#16A34A",
  borderDownColor: "#DC2626", gridColor: "#71717A", backgroundColor: "#050607",
};

const consumersOf = (key) => {
  const pattern = new RegExp(`(\\.|\\?\\.|["'\`])${key}\\b`);
  return files
    .filter(({ path, source }) => !path.endsWith(DECLARING) && !path.endsWith(DIALOG) && pattern.test(source))
    .map(({ path }) => path);
};

const PROFILE_IDS = ["kwant-profile", "weekly-volume-profile", "delta-profile", "ask-bid-volume-profile"];

check("every profile setting is read by something", () => {
  const inert = [];
  for (const id of PROFILE_IDS) {
    const settings = defaultIndicatorSettings(id, THEME);
    for (const key of Object.keys(settings)) {
      if (BOOKKEEPING.has(key)) continue;
      if (!consumersOf(key).length) inert.push(`${id}.${key} = ${JSON.stringify(settings[key])}`);
    }
  }
  assert.deepEqual(
    [...new Set(inert)], [],
    `these are stored and nothing acts on them:\n  ${[...new Set(inert)].join("\n  ")}`,
  );
});

check("the four that were dead are genuinely wired now", () => {
  /*
   * Named individually, because the sweep above would go quiet again the
   * moment somebody deleted the key rather than honouring it.
   */
  for (const key of [
    "numberOfProfiles", "valueAreaDeveloping",
    "pocHighlightOpacity", "shiftedPocOpacity", "shiftedPocTicks",
  ]) {
    const consumers = consumersOf(key);
    assert.ok(consumers.length, `${key} is inert again`);
  }
});

check("every setting has a way to be set", () => {
  /*
   * The other half of a dead control: honoured by the renderer with nothing in
   * the dialog to reach it. Four line widths and the whole Plot Width/Offset
   * family were in that state.
   *
   * Booleans and colours are covered by the dialog's generated section, and the
   * session toggles by DESK_SESSION_SETTING_KEYS - neither names the key
   * literally, so only numbers and strings need an explicit control.
   */
  const dialog = files.find((file) => file.path.endsWith(DIALOG));
  assert.ok(dialog, "the settings dialog is gone");
  const unreachable = [];
  for (const id of PROFILE_IDS) {
    const settings = defaultIndicatorSettings(id, THEME);
    for (const [key, value] of Object.entries(settings)) {
      if (BOOKKEEPING.has(key)) continue;
      if (typeof value === "boolean" || /colou?r$/i.test(key)) continue;
      if (/^session[A-Za-z]+Enabled$/.test(key)) continue;
      if (!consumersOf(key).length) continue;
      // Same shape as a consumer: a control reads it as `settings?.key` or
      // names it as a quoted key in a control table. Either is reachable.
      if (!new RegExp(`(\\.|\\?\\.|["'\`])${key}\\b`).test(dialog.source)) unreachable.push(`${id}.${key}`);
    }
  }
  const missing = [...new Set(unreachable)];
  assert.deepEqual(missing, [], `these are honoured with no control to set them: ${missing.join(", ")}`);
});

check("the POC highlight is not painted at a fixed opacity", () => {
  // It was hardcoded to 0.72, so its slider moved a stored number and nothing
  // else.
  const primitive = files.find((file) => file.path.endsWith("nativeVolumeProfilePrimitive.ts"));
  assert.ok(primitive, "the profile primitive is gone");
  assert.ok(
    !/fillPath\(pocPath, levelPocColor, 0\.72/.test(primitive.source),
    "the POC highlight is hardcoded again",
  );
  assert.match(
    primitive.source,
    /Number\(style\.pocHighlightOpacity \?\? 72\) \/ 100/,
    "the POC highlight no longer reads its opacity",
  );
});

check("the shifted POC groups on the row grid", () => {
  /*
   * Grouping to anything other than the row grid would step the trail between
   * two rows rather than onto one, which reads as a rendering fault.
   */
  const primitive = files.find((file) => file.path.endsWith("nativeVolumeProfilePrimitive.ts"));
  assert.match(
    primitive.source,
    /volumeProfileBinTick\(\s*\n?\s*Math\.round\(point\.price \/ profile\.tickSize\), shiftTicks,\s*\n?\s*\) \* profile\.tickSize/,
    "the shifted POC no longer groups onto the row grid",
  );
  assert.match(primitive.source, /const shiftTicks = Math\.max\(1, Math\.round\(Number\(style\.shiftedPocTicks \?\? 1\)\)\)/);
});

check("a grouping of one is the untouched trail", () => {
  // The default must not quietly change what an existing chart draws.
  const primitive = files.find((file) => file.path.endsWith("nativeVolumeProfilePrimitive.ts"));
  assert.match(
    primitive.source,
    /shiftTicks > 1\s*\n?\s*\?/,
    "grouping is applied even when it is set to one",
  );
});

console.log(`\nvolume profile settings live: ${passed}/${passed} checks passed`);
