import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Indicator templates live in browser storage, so every read is a read of
 * something a person could have hand-edited, a half-written write could have
 * truncated, or a quota error could have left behind. The failures worth
 * catching are the quiet ones: a template loaded into the wrong study, or one
 * bad entry taking the whole settings panel down.
 */

// A localStorage good enough to exercise the real code paths, including a
// quota that can be made to fail.
class MemoryStorage {
  constructor() { this.map = new Map(); this.failWrites = false; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.map.set(key, String(value));
  }
  removeItem(key) { this.map.delete(key); }
}
const storage = new MemoryStorage();
const dispatchedEvents = [];
globalThis.window = {
  localStorage: storage,
  dispatchEvent: (event) => { dispatchedEvents.push(event.type); return true; },
};
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

const {
  INDICATOR_TEMPLATES_STORAGE_KEY,
  MAX_TEMPLATES_PER_INDICATOR,
  deleteIndicatorTemplate,
  exportIndicatorTemplate,
  indicatorTemplateFileName,
  importIndicatorTemplate,
  loadIndicatorTemplates,
  saveIndicatorTemplate,
} = await import("../src/lib/indicatorTemplates.ts");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const reset = () => { storage.map.clear(); storage.failWrites = false; dispatchedEvents.length = 0; };

check("a saved template comes back", () => {
  reset();
  const result = saveIndicatorTemplate("macd-indicator", "Scalping", { signalColor: "#ABCDEF", length: 9 });
  assert.equal(result.ok, true);
  const templates = loadIndicatorTemplates("macd-indicator");
  assert.equal(templates.length, 1);
  assert.equal(templates[0].name, "Scalping");
  assert.deepEqual(templates[0].settings, { signalColor: "#ABCDEF", length: 9 });
  assert.ok(dispatchedEvents.includes("kwantdesk:indicator-templates-changed"));
  assert.ok(dispatchedEvents.includes("kwantdesk:preferences-changed"), "saving must trigger signed-in account sync");
});

check("saving the same name again updates rather than duplicating", () => {
  reset();
  saveIndicatorTemplate("macd-indicator", "Scalping", { length: 9 });
  saveIndicatorTemplate("macd-indicator", "scalping", { length: 21 });
  const templates = loadIndicatorTemplates("macd-indicator");
  assert.equal(templates.length, 1, "two entries with one label cannot be told apart");
  assert.equal(templates[0].settings.length, 21, "the newer settings win");
});

check("templates are kept per indicator", () => {
  reset();
  saveIndicatorTemplate("macd-indicator", "Mine", { a: 1 });
  saveIndicatorTemplate("volume", "Mine", { b: 2 });
  assert.deepEqual(loadIndicatorTemplates("macd-indicator")[0].settings, { a: 1 });
  assert.deepEqual(loadIndicatorTemplates("volume")[0].settings, { b: 2 });
});

check("an unnamed template is refused", () => {
  reset();
  for (const name of ["", "   "]) {
    const result = saveIndicatorTemplate("volume", name, { a: 1 });
    assert.equal(result.ok, false);
  }
  assert.equal(loadIndicatorTemplates("volume").length, 0);
});

check("a full quota reports rather than pretending it saved", () => {
  reset();
  storage.failWrites = true;
  const result = saveIndicatorTemplate("volume", "Nope", { a: 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /storage/i);
});

check("corrupt storage yields no templates instead of throwing", () => {
  reset();
  storage.map.set(INDICATOR_TEMPLATES_STORAGE_KEY, "{not json");
  assert.deepEqual(loadIndicatorTemplates("volume"), []);
  storage.map.set(INDICATOR_TEMPLATES_STORAGE_KEY, JSON.stringify(["wrong", "shape"]));
  assert.deepEqual(loadIndicatorTemplates("volume"), []);
});

check("one bad entry does not discard its good neighbours", () => {
  reset();
  storage.map.set(INDICATOR_TEMPLATES_STORAGE_KEY, JSON.stringify({
    volume: [
      { id: "a", name: "Good", settings: { x: 1 }, updatedAt: "" },
      { id: "b", name: "", settings: { x: 2 } },
      { id: "c", name: "No settings" },
      "not an object",
      { id: "d", name: "Also good", settings: { x: 3 }, updatedAt: "" },
    ],
  }));
  const templates = loadIndicatorTemplates("volume");
  assert.deepEqual(templates.map((entry) => entry.name), ["Good", "Also good"]);
});

check("a template cannot claim to belong to another indicator", () => {
  reset();
  storage.map.set(INDICATOR_TEMPLATES_STORAGE_KEY, JSON.stringify({
    volume: [{ id: "a", name: "Sneaky", indicatorId: "macd-indicator", settings: { x: 1 } }],
  }));
  assert.equal(loadIndicatorTemplates("volume")[0].indicatorId, "volume", "the store's key is the truth");
  assert.deepEqual(loadIndicatorTemplates("macd-indicator"), []);
});

check("delete removes only what it names", () => {
  reset();
  saveIndicatorTemplate("volume", "One", { a: 1 });
  const second = saveIndicatorTemplate("volume", "Two", { a: 2 });
  const left = deleteIndicatorTemplate("volume", second.template.id);
  assert.deepEqual(left.map((entry) => entry.name), ["One"]);
});

check("export and import round-trip", () => {
  reset();
  const saved = saveIndicatorTemplate("bollinger-bands", "Wide", { upperColor: "#AA0000" });
  const text = exportIndicatorTemplate(saved.template);
  const imported = importIndicatorTemplate("bollinger-bands", text);
  assert.equal(imported.ok, true);
  assert.equal(imported.name, "Wide");
  assert.deepEqual(imported.settings, { upperColor: "#AA0000" });
  assert.equal(indicatorTemplateFileName(saved.template), "bollinger-bands-wide.kwantdesk.json");
});

check("unsupported and oversized template files are refused", () => {
  const unsupported = JSON.stringify({
    kind: "kwantdesk.indicator-template",
    version: 99,
    indicatorId: "volume",
    name: "Future",
    settings: { a: 1 },
  });
  assert.equal(importIndicatorTemplate("volume", unsupported).ok, false);
  assert.match(importIndicatorTemplate("volume", unsupported).error, /version/i);
  assert.match(importIndicatorTemplate("volume", "x".repeat(300_000)).error, /large/i);
});

check("importing another study's template is refused, not silently applied", () => {
  reset();
  const saved = saveIndicatorTemplate("bollinger-bands", "Wide", { upperColor: "#AA0000" });
  const result = importIndicatorTemplate("macd-indicator", exportIndicatorTemplate(saved.template));
  assert.equal(result.ok, false, "wrong-study settings produce a broken indicator, not an error");
  assert.match(result.error, /bollinger-bands/);
});

check("importing junk is refused with a readable reason", () => {
  for (const raw of ["", "{}", "not json", JSON.stringify({ kind: "something-else" })]) {
    const result = importIndicatorTemplate("volume", raw);
    assert.equal(result.ok, false, `"${raw}" must be refused`);
    assert.ok(result.error.length > 0);
  }
});

check("the per-indicator count is bounded", () => {
  reset();
  for (let i = 0; i < MAX_TEMPLATES_PER_INDICATOR; i += 1) {
    assert.equal(saveIndicatorTemplate("volume", `T${i}`, { i }).ok, true);
  }
  const overflow = saveIndicatorTemplate("volume", "One too many", { i: 999 });
  assert.equal(overflow.ok, false);
  // An existing name must still be updatable once the cap is reached.
  assert.equal(saveIndicatorTemplate("volume", "T0", { i: -1 }).ok, true);
});

check("the shared UI downloads real files and saves imported templates", () => {
  const source = readFileSync(new URL("../src/components/IndicatorTemplateBar.tsx", import.meta.url), "utf8");
  assert.match(source, /new Blob\(/);
  assert.match(source, /link\.download = indicatorTemplateFileName/);
  assert.match(source, /fileRef\.current\?\.click\(\)/, "Import must open the browser's file picker");
  assert.match(source, /saveIndicatorTemplate\(indicatorId, result\.name, importedSettings\)/);
  assert.match(source, /PREFERENCES_HYDRATED_EVENT/, "cloud-restored templates must refresh the open panel");
});

check("all indicator-specific template stores are account-synced", () => {
  const source = readFileSync(new URL("../src/lib/userPreferences.ts", import.meta.url), "utf8");
  for (const key of [
    "kwantdesk:indicator-templates:v1",
    "kwantdesk:footprint:templates:v1",
    "kwantdesk:volume-profile-templates:v1",
    "kwantdesk:tpo-user-presets:v1",
    "kwantdesk:gex-interval-map-presets:v1",
  ]) {
    assert.match(source, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${key} is missing from account preferences`);
  }
});

console.log(`\nindicator templates: ${passed}/${passed} checks passed`);
