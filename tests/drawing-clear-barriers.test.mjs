import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createDrawing } from '../src/lib/chartDrawTools.ts';
import { CHART_DRAWING_PREFERENCE_KEY as key } from '../src/lib/chartDrawingPreferences.ts';
import { DRAWING_CLEAR_BARRIERS_KEY as clears, chartDrawingPaneDocumentKey, drawingClearToken, markDrawingDocumentCleared } from '../src/lib/drawingClearBarriers.ts';
import { mergeAccountPreferenceChanges } from '../src/lib/accountPreferenceMerge.ts';
import { hydrateUserPreferences } from '../src/lib/userPreferences.ts';
import { queueDrawingSave } from '../src/lib/drawingSaveQueue.ts';
import { PrecisionToolsStore } from '../src/chart/precision-tools/store.ts';
import { createDefaultConfigs } from '../src/chart/precision-tools/defaults.ts';
import { precisionObjectStorageKey, loadPrecisionDocument } from '../src/chart/precision-tools/persistence.ts';

const line = JSON.parse(JSON.stringify(createDrawing('trendLine', [{ time: 1, price: 10 }, { time: 2, price: 20 }])));
const newer = JSON.parse(JSON.stringify(createDrawing('entryArrow', [{ time: 3, price: 30 }])));
const doc = chartDrawingPaneDocumentKey(key, 'a');
const marker = (documentKey = doc, at = 10, token = 'clear') => JSON.stringify({ [documentKey]: { at, token } });
const snapshot = values => ({ version: 1, complete: true, updatedAt: new Date(0).toISOString(), values });
const drawingValues = (a = [], b = [newer]) => ({ [key]: JSON.stringify({ a, b }) });
const merge = (base, local, remote) => mergeAccountPreferenceChanges(snapshot(base), snapshot(local), snapshot(remote)).values;
function browser() {
  const data = new Map();
  globalThis.window = { localStorage: { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) },
    dispatchEvent() {}, requestAnimationFrame(fn) { fn(); return 0; }, matchMedia: () => ({ matches: false }) };
  globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} }, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } }, querySelector: () => null, querySelectorAll: () => [] };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  return data;
}

test('explicit full-pane clear wins over previously unseen old remote drawings, preserving another pane', () => {
  const result = merge(drawingValues(), { ...drawingValues(), [clears]: marker() }, drawingValues([line]));
  assert.deepEqual(JSON.parse(result[key]), { a: [], b: [newer] });
});
test('stale phone edits cannot resurrect a drawing cleared on desktop', () => {
  const result = merge(drawingValues([line]), drawingValues([{ ...line, text: 'stale edit' }]), { ...drawingValues(), [clears]: marker() });
  assert.deepEqual(JSON.parse(result[key]).a, []);
});
test('already-saved local clear survives an older remote snapshot with no locally dirty drawings', () => {
  const cleared = { ...drawingValues(), [clears]: marker() };
  assert.deepEqual(JSON.parse(merge(cleared, cleared, drawingValues([line]))[key]).a, []);
});
test('new post-clear drawings survive; clients acknowledging the same clear can still add independently', () => {
  const base = { ...drawingValues(), [clears]: marker() };
  const local = { ...drawingValues([line]), [clears]: marker() };
  const remote = { ...drawingValues([newer]), [clears]: marker() };
  assert.equal(JSON.parse(merge(base, local, remote)[key]).a.length, 2);
  assert.deepEqual(JSON.parse(merge(base, local, drawingValues())[key]).a, [line]);
});
test('a second clear supersedes both old drawings and the earlier clear epoch', () => {
  const old = { ...drawingValues([line]), [clears]: marker() };
  const fresh = { ...drawingValues(), [clears]: marker(doc, 11, 'next') };
  assert.deepEqual(JSON.parse(merge(old, old, fresh)[key]).a, []);
});
test('professional, legacy position and precision documents obey the same deletion barrier', () => {
  for (const storageKey of ['kwantify-chart-drawings:NQ', 'kwantdesk:chart-drawings:v1:chart:NQ', 'kwantdesk:position-drawings:v1:chart:NQ', precisionObjectStorageKey('desk', 'chart:NQ')]) {
    const local = { [storageKey]: '[]', [clears]: marker(storageKey) };
    assert.equal(merge({}, local, { [storageKey]: JSON.stringify([line]) })[storageKey], '[]');
  }
});
test('Algo and normal Charts clear intents are independent', () => {
  const algoKey = 'kwantdesk:algo-charting:chart-drawtools:v1';
  const local = { ...drawingValues([line]), [algoKey]: JSON.stringify({ a: [] }), [clears]: marker(chartDrawingPaneDocumentKey(algoKey, 'a')) };
  const result = merge({}, local, { ...drawingValues([line]), [algoKey]: JSON.stringify({ a: [newer] }) });
  assert.deepEqual(JSON.parse(result[key]).a, [line]);
  assert.deepEqual(JSON.parse(result[algoKey]).a, []);
});
test('clearing during initial account hydration survives the late cloud response and reload', async () => {
  const data = browser(); data.set('kwantdesk:active-preferences-owner:v1', 'owner'); data.set(key, JSON.stringify({ a: [line] }));
  let resolve; const cloud = new Promise(done => { resolve = done; });
  const client = { from: () => ({ select: () => { const chain = { eq: () => chain, abortSignal: () => chain, maybeSingle: () => cloud }; return chain; } }) };
  const pending = hydrateUserPreferences(client, { id: 'owner', user_metadata: {} });
  markDrawingDocumentCleared(doc); data.set(key, JSON.stringify({ a: [] }));
  resolve({ data: { preferences: snapshot({ [key]: JSON.stringify({ a: [line] }) }) }, error: null });
  await pending;
  assert.deepEqual(JSON.parse(data.get(key)).a, []);
  assert.ok(drawingClearToken(doc));
});
test('precision clear synchronously persists even an empty store with an active draft', () => {
  browser();
  const store = new PrecisionToolsStore('desk', 'chart:NQ');
  const config = createDefaultConfigs()[0]; store.createDraft(config.toolId, config);
  store.clear();
  assert.equal(store.getSnapshot().draft, null);
  assert.deepEqual(loadPrecisionDocument('desk', 'chart:NQ').objects, []);
  assert.ok(drawingClearToken(precisionObjectStorageKey('desk', 'chart:NQ')));
  assert.deepEqual(new PrecisionToolsStore('desk', 'chart:NQ').getSnapshot().objects, []);
});
function sourceEffect(file, text) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found; const visit = node => { if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes(text)) found = node.arguments[0]; ts.forEachChild(node, visit); }; visit(source);
  assert.ok(found); return found.getText(source);
}
test('actual precision hydration cannot restore its pre-clear response', async () => {
  browser(); let resolve; const response = new Promise(done => { resolve = done; });
  const objects = []; let replacements = 0;
  const ctx = vm.createContext({ workspaceId: 'desk', chartId: 'chart:NQ', AbortController,
    fetch: () => response, drawingClearToken, precisionObjectStorageKey,
    store: { getSnapshot: () => ({ objects }), replaceDocument: () => { replacements++; } },
    setCloudHydrated() {}, setConfigs() {}, savePrecisionConfigs() {},
    mergeHydratedPrecisionObjects: (a, b) => [...a, ...b] });
  const effect = sourceEffect('src/chart/precision-tools/PrecisionToolsLayer.tsx', 'const hydrationBaseline');
  vm.runInContext(ts.transpileModule(`(${effect})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  markDrawingDocumentCleared(precisionObjectStorageKey('desk', 'chart:NQ'));
  resolve({ ok: true, json: async () => ({ configured: true, objects: [{ id: 'old', updatedAt: 1 }] }) });
  await new Promise(done => setImmediate(done));
  assert.equal(replacements, 0);
});
test('chart-level precision clear is scoped to its pane and cancels in-progress input', () => {
  let listener, removed = 0;
  const ctx = vm.createContext({ workspaceId: 'desk', chartId: 'a',
    window: { addEventListener: (_type, fn) => { listener = fn; } }, CLEAR_CHART_DRAWINGS_EVENT: 'clear',
    store: { cancelDraft() {}, select() {}, clear() { removed++; } },
    dragRef: { current: {} }, pencilScreenPathRef: { current: [1] }, zoomStartRef: { current: {} },
    lassoRef: { current: {} }, placedCountRef: { current: 1 }, setSelectionBox() {} });
  const effect = sourceEffect('src/chart/precision-tools/PrecisionToolsLayer.tsx', 'const onClearAll');
  vm.runInContext(ts.transpileModule(`(${effect})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  listener({ detail: { workspaceId: 'desk', chartId: 'b' } }); assert.equal(removed, 0);
  listener({ detail: { workspaceId: 'desk', chartId: 'a' } }); assert.equal(removed, 1);
  assert.equal(ctx.dragRef.current, null); assert.equal(ctx.pencilScreenPathRef.current.length, 0);
});
test('actual professional restore rejects both delayed clear races and stale API data after remount', () => {
  browser();
  const file = 'src/components/Chart.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback; const visit = n => { if (ts.isArrowFunction(n) && n.parameters[0]?.name.getText(source) === 'records'
    && n.getText(source).includes('professionalDrawingsLoadGenerationRef.current !== loadGeneration')) callback = n; ts.forEachChild(n, visit); }; visit(source);
  assert.ok(callback); let restored = 0;
  const storageKey = 'kwantdesk:chart-drawings:v1:a:NQ';
  const ctx = vm.createContext({ cancelled: false, professionalDrawingsLoadGenerationRef: { current: 2 }, loadGeneration: 1,
    drawingClearToken, drawingsStorageKey: () => storageKey, instrument: 'NQ', chartInstanceId: 'a',
    setProfessionalDrawings() { restored++; }, replaceProfessionalManagerDrawings() {} });
  vm.runInContext(ts.transpileModule(`var restore = ${callback.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  ctx.restore([line]); assert.equal(restored, 0);
  ctx.professionalDrawingsLoadGenerationRef.current = 1;
  markDrawingDocumentCleared(storageKey); ctx.restore([line]); assert.equal(restored, 0);
});
test('slow previous save completes before clear; unrelated charts are not blocked', async () => {
  browser(); const original = globalThis.fetch; const calls = []; let finish;
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); if (calls.length === 1) await new Promise(done => { finish = done; }); return { ok: true }; };
  try {
    const first = queueDrawingSave('a', '/api/chart-drawings', { drawings: [line] });
    await new Promise(done => setImmediate(done));
    const clear = queueDrawingSave('a', '/api/chart-drawings', { drawings: [] });
    await queueDrawingSave('b', '/api/chart-drawings', { drawings: [newer] });
    assert.equal(calls.length, 2); finish(); await Promise.all([first, clear]);
    assert.deepEqual(calls.at(-1).drawings, []);
  } finally { globalThis.fetch = original; }
});
