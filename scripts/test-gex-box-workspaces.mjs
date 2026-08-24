import assert from "node:assert/strict";

/**
 * GEX BOX workspaces are the charts workspaces' gestures over a store of their
 * own.
 *
 * The failure that matters is the two lists touching. A charts workspace is
 * panes, a layout tree, chart settings and indicators; a GEX BOX workspace is
 * pages of tool panels and a palette. They share no fields, so applying one
 * where the other belongs would not error — it would render an empty screen,
 * which reads as the tool being broken.
 */

class MemoryStorage {
  constructor() { this.map = new Map(); this.failWrites = false; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { if (this.failWrites) throw new Error("QuotaExceededError"); this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
const storage = new MemoryStorage();
globalThis.window = { localStorage: storage, dispatchEvent: () => true };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

const {
  GEX_BOX_WORKSPACES_STORAGE_KEY,
  MAX_GEX_BOX_WORKSPACES,
  deleteGexBoxWorkspace,
  exportGexBoxWorkspace,
  importGexBoxWorkspace,
  loadGexBoxWorkspaces,
  saveGexBoxWorkspace,
} = await import("../src/lib/gexBoxWorkspaces.ts");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const reset = () => { storage.map.clear(); storage.failWrites = false; };
const snapshot = (pageId = "p1") => ({
  pages: [{ id: pageId, name: "Page 1", layout: "grid", panels: [{ id: "x", toolId: "interval-map", title: "T", settings: {} }] }],
  activePageId: pageId,
  paletteId: "viridis",
});

check("a saved workspace comes back whole", () => {
  reset();
  const result = saveGexBoxWorkspace("Morning", snapshot());
  assert.equal(result.ok, true);
  const [preset] = loadGexBoxWorkspaces();
  assert.equal(preset.name, "Morning");
  assert.equal(preset.pages.length, 1);
  assert.equal(preset.paletteId, "viridis");
});

check("saving the same name again updates rather than duplicating", () => {
  reset();
  saveGexBoxWorkspace("Morning", snapshot("a"));
  saveGexBoxWorkspace("morning", snapshot("b"));
  const presets = loadGexBoxWorkspaces();
  assert.equal(presets.length, 1, "two entries with one label cannot be told apart");
  assert.equal(presets[0].activePageId, "b", "the newer layout wins");
});

check("the snapshot is copied, not referenced", () => {
  reset();
  const live = snapshot();
  saveGexBoxWorkspace("Copy", live);
  live.pages[0].name = "MUTATED";
  assert.equal(loadGexBoxWorkspaces()[0].pages[0].name, "Page 1", "a later edit must not reach the saved copy");
});

check("an unnamed or empty workspace is refused", () => {
  reset();
  assert.equal(saveGexBoxWorkspace("   ", snapshot()).ok, false);
  assert.equal(saveGexBoxWorkspace("Empty", { pages: [], activePageId: "" }).ok, false);
  assert.deepEqual(loadGexBoxWorkspaces(), []);
});

check("a full quota reports rather than pretending it saved", () => {
  reset();
  storage.failWrites = true;
  const result = saveGexBoxWorkspace("Nope", snapshot());
  assert.equal(result.ok, false);
  assert.match(result.error, /storage/i);
});

check("corrupt storage yields no workspaces instead of throwing", () => {
  reset();
  storage.map.set(GEX_BOX_WORKSPACES_STORAGE_KEY, "{not json");
  assert.deepEqual(loadGexBoxWorkspaces(), []);
  storage.map.set(GEX_BOX_WORKSPACES_STORAGE_KEY, JSON.stringify({ not: "an array" }));
  assert.deepEqual(loadGexBoxWorkspaces(), []);
});

check("one bad entry does not discard its good neighbours", () => {
  reset();
  storage.map.set(GEX_BOX_WORKSPACES_STORAGE_KEY, JSON.stringify([
    { id: "a", name: "Good", pages: [{ id: "p" }], activePageId: "p" },
    { id: "b", name: "", pages: [{ id: "p" }] },
    { id: "c", name: "No pages", pages: [] },
    "not an object",
    { id: "d", name: "Also good", pages: [{ id: "p" }], activePageId: "p" },
  ]));
  assert.deepEqual(loadGexBoxWorkspaces().map((entry) => entry.name), ["Also good", "Good"]);
});

check("delete removes only what it names", () => {
  reset();
  saveGexBoxWorkspace("One", snapshot());
  const second = saveGexBoxWorkspace("Two", snapshot());
  const left = deleteGexBoxWorkspace(second.preset.id);
  assert.deepEqual(left.map((entry) => entry.name), ["One"]);
});

check("export and import round-trip", () => {
  reset();
  const saved = saveGexBoxWorkspace("Trip", snapshot());
  const result = importGexBoxWorkspace(exportGexBoxWorkspace(saved.preset));
  assert.equal(result.ok, true);
  assert.equal(result.preset.name, "Trip");
  assert.equal(result.preset.pages.length, 1);
});

check("a charts workspace file is refused, not half-applied", () => {
  // It has none of these fields, so loading it would produce an empty
  // dashboard rather than an error the trader can act on.
  const chartsFile = JSON.stringify({ id: "w", name: "Charts", layout: {}, panes: [], chartSettings: {} });
  const result = importGexBoxWorkspace(chartsFile);
  assert.equal(result.ok, false);
  assert.match(result.error, /GEX BOX/);
});

check("importing junk is refused with a readable reason", () => {
  for (const raw of ["", "{}", "not json", JSON.stringify({ kind: "kwantdesk.indicator-template" })]) {
    const result = importGexBoxWorkspace(raw);
    assert.equal(result.ok, false, `"${raw}" must be refused`);
    assert.ok(result.error.length > 0);
  }
});

check("the count is bounded", () => {
  reset();
  for (let i = 0; i < MAX_GEX_BOX_WORKSPACES; i += 1) {
    assert.equal(saveGexBoxWorkspace(`W${i}`, snapshot()).ok, true);
  }
  assert.equal(saveGexBoxWorkspace("One too many", snapshot()).ok, false);
  assert.equal(saveGexBoxWorkspace("W0", snapshot("changed")).ok, true, "an existing name stays updatable");
});

check("the store is its own key, not the charts one", () => {
  assert.match(GEX_BOX_WORKSPACES_STORAGE_KEY, /gex-box/);
});

console.log(`\ngex box workspaces: ${passed}/${passed} checks passed`);
