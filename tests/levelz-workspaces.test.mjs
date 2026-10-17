import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const libText = readFileSync(new URL("../src/lib/levelzWorkspaceLayout.ts", import.meta.url), "utf8");
const componentText = readFileSync(new URL("../src/components/levelz/LevelzDesk.tsx", import.meta.url), "utf8");
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const library = { exports: {} };
vm.runInNewContext(compile(libText), { module: library, exports: library.exports, Set, Date });
const api = library.exports;
const plain = value => JSON.parse(JSON.stringify(value));

test("Levels layout normalizes bad input, bounds work, preserves selections and swaps without losing panels", () => {
  const desk = api.normalizeLevelDesk({});
  assert.equal(desk.panels.length, 4);
  const changed = api.moveLevelPanel(desk, "levelz-1", "levelz-4");
  assert.equal(changed.panels[3].family, "gamma");
  assert.equal(changed.panels[0].family, "structure");
  assert.equal(desk.panels[0].family, "gamma");
  assert.equal(api.moveLevelPanel({ ...desk, locked: true }, "levelz-1", "levelz-4").panels, desk.panels);
  assert.equal(api.moveLevelPanel(desk, "missing", "levelz-4"), desk);
  const invalid = api.normalizeLevelDesk({ panels: [null, { id: "a", instrument: "BAD", timeframe: "0", family: "invalid" }, { id: "a" }], split: 1000, activePanelId: "bad" });
  assert.equal(invalid.panels.length, 1); assert.equal(invalid.split, 80); assert.equal(invalid.activePanelId, "a");
  assert.equal(invalid.panels[0].instrument, "NQ");
  assert.equal(api.normalizeLevelDesk({ panels: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` })) }).panels.length, 8);
  const presets = api.normalizeLevelPresets([{ id: "p", name: " Saved ", desk: changed }, { id: "p", name: "duplicate" }, null]);
  assert.equal(presets.length, 1); assert.equal(presets[0].name, "Saved");
  assert.deepEqual(plain(presets[0].desk), plain(changed));
});

function harness(initial = new Map()) {
  const states = [], effects = [], refs = [], listeners = new Map();
  let cursor = 0, dirty = true, tree, blocked = false;
  const storage = { getItem: key => initial.get(key) ?? null, setItem: (key, value) => initial.set(key, value) };
  const window = { localStorage: storage, addEventListener: (name, cb) => { const entries = listeners.get(name) ?? new Set(); entries.add(cb); listeners.set(name, entries); }, removeEventListener: (name, cb) => listeners.get(name)?.delete(cb), dispatchEvent: event => { for (const cb of listeners.get(event.type) ?? []) cb(event); }, confirm: () => true };
  const document = { addEventListener() {}, removeEventListener() {} };
  const react = {
    useState: initial => { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], update => { const next = typeof update === "function" ? update(states[i]) : update; if (next !== states[i]) { states[i] = next; dirty = true; } }]; },
    useRef: initial => { const i = cursor++; return refs[i] ??= { current: initial }; },
    useCallback: fn => { cursor++; return fn; },
    useEffect: (fn, deps) => { const i = cursor++; const old = effects[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) effects[i] = { deps, fn, cleanup: old?.cleanup, pending: true }; },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const module = { exports: {} };
  vm.runInNewContext(compile(componentText), { module, exports: module.exports, require: name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "lucide-react") return new Proxy({}, { get: (_, key) => key });
    if (name.endsWith("levelzWorkspaceLayout")) return api;
    if (name.endsWith("browserStorageQuota")) return { writeProtectedItem: (key, value) => { if (blocked) return { ok: false }; storage.setItem(key, value); return { ok: true }; } };
    if (name.endsWith("userPreferences")) return { PREFERENCES_HYDRATED_EVENT: "hydrate" };
    throw Error(name);
  }, window, document, CustomEvent: class { constructor(type) { this.type = type; } }, crypto: { randomUUID: () => `id-${initial.size}-${states.length}-${Date.now()}` }, Date });
  const flush = () => {
    for (let pass = 0; dirty; pass++) {
      assert.ok(pass < 15, "no effect/render loop"); dirty = false; cursor = 0;
      tree = module.exports.default({ renderPanel: (panel, index, actions) => jsx("panel", { panel, index, actions, children: actions.controls }), renderEducation: panel => jsx("education", { panel }) });
      for (const effect of effects) if (effect?.pending) { effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.fn(); }
    }
    return tree;
  };
  const nodes = () => { flush(); const result = []; const walk = value => { if (Array.isArray(value)) return value.forEach(walk); if (!value || typeof value !== "object") return; result.push(value); walk(value.props?.children); }; walk(tree); return result; };
  const find = predicate => { const value = nodes().find(predicate); assert.ok(value, "UI control exists"); return value; };
  const clickTitle = title => { const node = find(n => n.props?.title === title); assert.ok(!node.props.disabled); node.props.onClick(); flush(); };
  flush();
  return { flush, nodes, find, clickTitle, storage: initial, window, setBlocked: v => blocked = v, panels: () => nodes().filter(n => n.type === "panel") };
}

test("Levels controls link, move, lock, resize, duplicate and close using stable panel identities", () => {
  const h = harness();
  assert.equal(h.panels().length, 4);
  h.clickTitle("Link chart viewports");
  assert.ok(h.panels().every(n => n.props.actions.linked));
  const move = h.find(n => n.props?.["aria-label"] === "Move panel 1");
  move.props.onKeyDown({ key: "ArrowRight", preventDefault() {} }); h.flush();
  assert.equal(h.panels()[0].props.panel.id, "levelz-2");
  h.clickTitle("Lock layout");
  assert.ok(h.find(n => n.props?.["aria-label"] === "Move panel 1").props.disabled);
  h.clickTitle("Unlock layout");
  const resize = h.find(n => n.props?.role === "separator");
  resize.props.onKeyDown({ key: "ArrowRight", preventDefault() {} }); h.flush();
  assert.equal(h.find(n => n.props?.role === "separator").props["aria-valuenow"], 52);
  h.clickTitle("Duplicate panel"); assert.equal(h.panels().length, 5);
  h.clickTitle("Close panel"); assert.equal(h.panels().length, 4);
  h.clickTitle("Single panel"); assert.equal(h.panels().length, 1);
  h.clickTitle("Four-panel grid"); assert.equal(h.panels().length, 4);
  const firstId = h.panels()[0].props.panel.id;
  const handle = h.find(n => n.props?.["aria-label"] === "Move panel 1");
  handle.props.onDragStart({ dataTransfer: { setData() {} } });
  const targets = h.nodes().filter(n => n.props?.onDrop);
  targets[2].props.onDrop({ preventDefault() {} }); h.flush();
  assert.equal(h.panels()[2].props.panel.id, firstId, "drop captures source before clearing drag ref");
});

test("Levels Save As and Quick Save survive reload, restore selections and reject failed saves", () => {
  const h = harness();
  h.panels()[0].props.actions.change({ family: "value-area", instrument: "ES", timeframe: "15m" }); h.flush();
  h.find(n => n.type === "button" && n.props["aria-expanded"] === false).props.onClick(); h.flush();
  h.find(n => n.type === "input").props.onChange({ target: { value: "My Levels" } }); h.flush();
  h.find(n => n.type === "form").props.onSubmit({ preventDefault() {} }); h.flush();
  const saved = JSON.parse(h.storage.get(api.LEVELZ_WORKSPACES_KEY));
  assert.equal(saved.presets.length, 1); assert.equal(saved.presets[0].desk.panels[0].instrument, "ES");
  const restored = harness(h.storage);
  assert.equal(restored.panels()[0].props.panel.family, "value-area");
  restored.panels()[0].props.actions.change({ instrument: "MES" }); restored.flush();
  restored.find(n => n.type === "button" && n.props["aria-expanded"] === false).props.onClick(); restored.flush();
  const quick = restored.find(n => n.type === "button" && n.props.children === "Quick Save");
  restored.setBlocked(true); quick.props.onClick(); restored.flush();
  assert.equal(JSON.parse(restored.storage.get(api.LEVELZ_WORKSPACES_KEY)).presets[0].desk.panels[0].instrument, "ES");
  restored.setBlocked(false); quick.props.onClick(); restored.flush();
  assert.equal(JSON.parse(restored.storage.get(api.LEVELZ_WORKSPACES_KEY)).presets[0].desk.panels[0].instrument, "MES");
  // Account hydration replaces desk state rather than leaking another user's layout.
  restored.storage.delete(api.LEVELZ_WORKSPACES_KEY);
  restored.window.dispatchEvent({ type: "hydrate" }); restored.flush();
  assert.equal(restored.panels()[0].props.panel.instrument, "NQ");
});

test("Levels uses account-backed preferences and keeps its family dropdown and shared chart viewport path", () => {
  const prefs = readFileSync(new URL("../src/lib/userPreferences.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/components/levelz/LevelzWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(prefs.includes(`"${api.LEVELZ_WORKSPACES_KEY}"`));
  assert.match(page, /menuLabel="Level family"/);
  assert.match(page, /viewportSyncRole=\{linked \? "peer" : "independent"\}/);
  assert.match(page, /chartInstanceId=\{config.id\}/);
  assert.match(page, /useEffect\(\(\) => \(\) => onRuntime\(config.id, null\)/);
  assert.match(componentText, /setProperty\("--levelz-split"/);
});
