import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  captureIndicatorSettingsSnapshot,
  indicatorSettingsAreDirty,
} from "../src/lib/indicatorSettingsDraft.ts";

/**
 * Every indicator's settings dialog offers somewhere to save.
 *
 * The dialog applies each change as it is made, so closing it was the only way
 * to keep or drop them - and clicking away asked "unsaved changes?" without
 * offering anywhere to answer that properly. Only the footprint had a button,
 * so every other study made a trader dismiss a prompt to do the ordinary thing.
 *
 * One header action serves all of them. A per-indicator button would be one more
 * thing to forget for the next study added, which is how the footprint ended
 * up being the only one that had it.
 */

const source = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the header Save is not conditional on which indicator is open", () => {
  /*
   * The thing that went wrong before: the only save lived inside the
   * footprint's own block, so it existed for exactly one study.
   */
  const headerAt = source.indexOf("One shared header action rail serves every current and future indicator");
  const settingsBodyAt = source.indexOf("<IndicatorSettingsSections>", headerAt);
  assert.ok(headerAt > 0, "there is no shared settings header action");
  assert.ok(settingsBodyAt > headerAt, "the shared Save is not in the fixed dialog header");
});

check("Save is immediately beside Close", () => {
  const header = source.slice(
    source.indexOf("One shared header action rail serves every current and future indicator"),
    source.indexOf("<IndicatorSettingsSections>"),
  );
  const saveAt = header.indexOf("onClick={commitSettings}");
  const closeAt = header.indexOf("onClick={closeSettingsDialog}");
  assert.ok(saveAt > 0 && closeAt > saveAt, "Save is not immediately before the close action");
  assert.match(header, /aria-label=\{`Save \$\{settingsDefinition\.name\} settings`\}/);
  assert.match(header, /aria-label=\{`Close \$\{settingsDefinition\.name\} settings`\}/);
});

check("the broken floating footer is gone", () => {
  assert.doesNotMatch(source, /Save and Cancel, on EVERY indicator/);
  const afterDialog = source.slice(source.indexOf("</IndicatorSettingsSections>"));
  assert.doesNotMatch(afterDialog, /onClick=\{commitSettings\}[\s\S]*?<\/div>\s*<\/div>,/,
    "a Save action still floats outside the settings dialog");
});

check("it says whether anything is actually unsaved", () => {
  /*
   * The dialog already knew - it used the same check to decide whether to
   * interrupt on the way out. Saying it up front is what makes the button
   * feel like it did something.
   */
  const header = source.slice(
    source.indexOf("One shared header action rail serves every current and future indicator"),
    source.indexOf("<IndicatorSettingsSections>"),
  );
  assert.match(header, /settingsAreDirty\(\)/, "the header does not report unsaved changes");
  assert.match(header, /Unsaved changes/);
  assert.match(header, /All changes saved/);
});

check("it stays reachable on a long settings list", () => {
  const headerStart = source.lastIndexOf("className=", source.indexOf("title=\"Drag settings window\""));
  const header = source.slice(headerStart, source.indexOf("<IndicatorSettingsSections>"));
  assert.match(header, /flex shrink-0 touch-none/, "the title bar can be scrolled away or squashed");
});

check("closing without the button still asks rather than silently keeping", () => {
  // The prompt is not replaced by the button; it is the safety net for anyone
  // who clicks away, which is how this was reported in the first place.
  assert.match(source, /if \(settingsAreDirty\(\)\) \{\s*\n\s*setUnsavedSettingsPrompt\(true\);/);
});

check("Save establishes a clean baseline without closing the dialog", () => {
  assert.match(source, /settingsOpenSnapshotRef\.current = captureIndicatorSettingsSnapshot\(committedInstance\);/);
  assert.match(source, /settingsHasPendingEditRef\.current = false;\s*\n\s*refreshSettingsSaveState/,
    "Save does not repaint the clean state until the debounced parent update arrives");
  const header = source.slice(
    source.indexOf("One shared header action rail serves every current and future indicator"),
    source.indexOf("<IndicatorSettingsSections>"),
  );
  assert.doesNotMatch(
    header,
    /onClick=\{commitSettingsAndClose\}/,
    "the permanent Save action still closes the settings dialog",
  );
});

check("edit and save status do not wait for debounced workspace persistence", () => {
  assert.match(source, /settingsHasPendingEditRef\.current = true;\s*\n\s*refreshSettingsSaveState/,
    "an edit is not shown as unsaved synchronously");
  assert.match(source, /if \(\s*settingsHasPendingEditRef\.current[\s\S]*?\) return true;/,
    "the close guard does not recognise the synchronous pending-edit state");
});

check("Footprint cannot bypass the shared clean-baseline save", () => {
  const footprintActionsAt = source.indexOf("value={footprintTemplateName}");
  const dialogEnd = source.indexOf("</div>,\n        document.body", footprintActionsAt);
  assert.ok(footprintActionsAt > 0, "the Footprint template controls were not found");
  const footprintActions = source.slice(footprintActionsAt, dialogEnd);
  assert.doesNotMatch(
    footprintActions,
    /Save settings/,
    "Footprint still exposes a second save path that can leave the dialog dirty",
  );
  assert.doesNotMatch(
    footprintActions,
    /saveFootprintSettings\(settingsInstance\.instanceId, validated\)/,
    "Footprint still persists settings without updating the shared saved baseline",
  );
});

check("clicking away after Save is clean", () => {
  const instance = { instanceId: "kwant-profile-1", enabled: true, settings: { valueAreaPercent: 68 } };
  const opened = captureIndicatorSettingsSnapshot(instance);
  const edited = { ...instance, settings: { valueAreaPercent: 70 } };
  assert.equal(indicatorSettingsAreDirty(opened, edited), true);
  const saved = captureIndicatorSettingsSnapshot(edited);
  assert.equal(indicatorSettingsAreDirty(saved, edited), false);
});

check("visibility participates in Save and Discard", () => {
  const instance = { instanceId: "volume-1", enabled: true, settings: { opacity: 70 } };
  const opened = captureIndicatorSettingsSnapshot(instance);
  assert.equal(indicatorSettingsAreDirty(opened, { ...instance, enabled: false }), true);
  assert.match(source, /enabled: opened\.enabled/,
    "Discard does not restore the indicator's saved visibility");
});

check("the baseline cannot be mutated by live preview edits", () => {
  const instance = { instanceId: "macd-1", enabled: true, settings: { length: 12 } };
  const opened = captureIndicatorSettingsSnapshot(instance);
  instance.settings.length = 26;
  assert.equal(opened.settings.length, 12);
  assert.equal(indicatorSettingsAreDirty(opened, instance), true);
});

console.log(`\nindicator settings save: ${passed}/${passed} checks passed`);
