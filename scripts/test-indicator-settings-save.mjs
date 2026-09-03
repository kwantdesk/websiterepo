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
 * One footer serves all of them. A per-indicator button would be one more
 * thing to forget for the next study added, which is how the footprint ended
 * up being the only one that had it.
 */

const source = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the footer is not conditional on which indicator is open", () => {
  /*
   * The thing that went wrong before: the only save lived inside the
   * footprint's own block, so it existed for exactly one study.
   */
  const footerAt = source.indexOf('Save and Cancel, on EVERY indicator');
  assert.ok(footerAt > 0, "there is no shared settings footer");
  const footprintBlockEnds = source.lastIndexOf("footprintSaveStatus", footerAt);
  assert.ok(footprintBlockEnds > 0 && footprintBlockEnds < footerAt, "the footer sits inside the footprint block");
});

check("it offers both keeping and discarding", () => {
  const footer = source.slice(source.indexOf("Save and Cancel, on EVERY indicator"));
  assert.match(footer, /onClick=\{commitSettings\}/, "there is no way to save without closing");
  assert.match(footer, /onClick=\{discardSettingsAndClose\}/, "there is no way to cancel");
});

check("the save sits bottom right, after the cancel", () => {
  // Right-hand side is where a dialog's confirming action belongs, and the
  // owner asked for it there specifically.
  const footer = source.slice(source.indexOf("Save and Cancel, on EVERY indicator"));
  const cancelAt = footer.indexOf("discardSettingsAndClose");
  const saveAt = footer.indexOf("onClick={commitSettings}");
  assert.ok(cancelAt > 0 && saveAt > cancelAt, "save is not the rightmost action");
  assert.match(footer, /justify-between/, "the footer does not push its actions right");
});

check("it says whether anything is actually unsaved", () => {
  /*
   * The dialog already knew - it used the same check to decide whether to
   * interrupt on the way out. Saying it up front is what makes the button
   * feel like it did something.
   */
  const footer = source.slice(source.indexOf("Save and Cancel, on EVERY indicator"));
  assert.match(footer, /settingsAreDirty\(\)/, "the footer does not report unsaved changes");
  assert.match(footer, /Unsaved changes/);
  assert.match(footer, /All changes saved/);
});

check("it stays reachable on a long settings list", () => {
  // Pinned outside the scrolling body: a study with forty settings must not
  // hide its save at the bottom of them.
  const footer = source.slice(source.indexOf("Save and Cancel, on EVERY indicator"));
  assert.match(footer, /shrink-0/, "the footer can be scrolled away or squashed");
});

check("closing without the button still asks rather than silently keeping", () => {
  // The prompt is not replaced by the button; it is the safety net for anyone
  // who clicks away, which is how this was reported in the first place.
  assert.match(source, /if \(settingsAreDirty\(\)\) \{\s*\n\s*setUnsavedSettingsPrompt\(true\);/);
});

check("Save establishes a clean baseline without closing the dialog", () => {
  assert.match(source, /settingsOpenSnapshotRef\.current = captureIndicatorSettingsSnapshot\(committedInstance\);/);
  const footer = source.slice(source.indexOf("Save and Cancel, on EVERY indicator"));
  assert.doesNotMatch(
    footer.slice(0, footer.indexOf("</div>\n        </div>")),
    /onClick=\{commitSettingsAndClose\}/,
    "the permanent Save action still closes the settings dialog",
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
