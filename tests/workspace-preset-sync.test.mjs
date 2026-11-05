import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccountPreferenceChanges } from '../src/lib/accountPreferenceMerge.ts';
import { markWorkspacePresetDeleted, WORKSPACE_PRESET_DELETIONS_KEY as DELETIONS } from '../src/lib/workspacePresetPreferences.ts';
import { isTrackedStorageKey } from '../src/lib/accountPreferenceKeys.ts';
import { hydrateUserPreferences } from '../src/lib/userPreferences.ts';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { mergeWorkspacePresetPreferences } from '../src/lib/workspacePresetPreferences.ts';
const key = 'kwantdesk-chart-workspace-presets';
const snapshot = values => ({ version: 1, complete: true, updatedAt: '2026-11-05T00:00:00Z', values });
const preset = (id, time = '2026-11-05T00:00:00Z') => ({ id, name: id, updatedAt: time, panes: [{ symbol: 'NQ' }], layout: { type: 'pane', paneId: 'nq' } });
const merge = (base, local, remote) => mergeAccountPreferenceChanges(snapshot(base), snapshot(local), snapshot(remote)).values;
for (const prefix of ['', 'kwantdesk:gamma-charting:', 'kwantdesk:algo-charting:']) {
  const store = prefix + key;
  const library = (...items) => ({ [store]: JSON.stringify(items) });
  const ids = values => JSON.parse(values[store]).map(item => item.id);
  test(`${prefix || 'charts'} stale empty phone list cannot delete acknowledged desktop saves`, () => {
    const known = library(preset('kept'));
    assert.deepEqual(ids(merge(known, library(), known)), ['kept']);
    assert.deepEqual(ids(merge(known, {}, library())), ['kept']);
  });
  test(`${prefix || 'charts'} concurrent saves survive in either device direction`, () => {
    const a = library(preset('a')), b = library(preset('b'));
    assert.deepEqual(ids(merge(library(), a, b)), ['a', 'b']);
    assert.deepEqual(merge(library(), a, b), merge(library(), b, a));
  });
  test(`${prefix || 'charts'} an explicit deletion survives a stale device and does not remove another workspace`, () => {
    const base = library(preset('a'), preset('b'));
    const deleted = { ...library(preset('b')), [DELETIONS]: markWorkspacePresetDeleted(undefined, store, 'a') };
    assert.deepEqual(ids(merge(base, base, deleted)), ['b']);
    assert.deepEqual(ids(merge(base, deleted, base)), ['b']);
    const result = merge(base, base, deleted);
    assert.deepEqual(ids(merge(result, base, result)), ['b']);
  });
  test(`${prefix || 'charts'} a recent Quick Save wins over an old copy without erasing other IDs`, () => {
    const base = library(preset('a'));
    const local = library({ ...preset('a', '2026-11-05T01:00:00Z'), name: 'Updated' });
    const remote = library(preset('a'), preset('b'));
    assert.equal(JSON.parse(merge(base, local, remote)[store])[0].name, 'Updated');
    assert.deepEqual(ids(merge(base, local, remote)), ['a', 'b']);
  });
}
test('deletion records are tracked and isolated to the workspace scope', () => {
  assert.equal(isTrackedStorageKey(DELETIONS), true);
  const scope = 'kwantdesk:algo-charting:' + key;
  const before = { [key]: JSON.stringify([preset('same')]), [scope]: JSON.stringify([preset('same')]) };
  const result = merge(before, { ...before, [DELETIONS]: markWorkspacePresetDeleted(undefined, scope, 'same') }, before);
  assert.equal(JSON.parse(result[key]).length, 1);
  assert.equal(JSON.parse(result[scope]).length, 0);
});
test('malformed or missing phone library cannot erase a valid remote library', () => {
  const known = { [key]: JSON.stringify([preset('kept')]) };
  assert.deepEqual(JSON.parse(merge(known, { [key]: 'broken' }, known)[key]).map(item => item.id), ['kept']);
});
test('initial hydration retains a surviving same-account save, without copying another account', async () => {
  const savedGlobals = { window: globalThis.window, document: globalThis.document, CustomEvent: globalThis.CustomEvent };
  try {
    for (const owner of ['owner', 'other']) {
      const data = new Map([['kwantdesk:active-preferences-owner:v1', owner], [key, JSON.stringify([preset('survivor')])]]);
      const storage = { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
        getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
      globalThis.window = { localStorage: storage, dispatchEvent() {}, requestAnimationFrame: fn => fn() };
      globalThis.document = { documentElement: { style: { setProperty() {} }, dataset: {} }, querySelector: () => null };
      globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
      const cloud = snapshot({ [key]: '[]' });
      const client = { from() { const chain = { select: () => chain, eq: () => chain, abortSignal: () => chain,
        maybeSingle: async () => ({ data: { preferences: cloud, updated_at: cloud.updatedAt }, error: null }) }; return chain; } };
      await hydrateUserPreferences(client, { id: 'owner', user_metadata: {} });
      assert.deepEqual(JSON.parse(data.get(key)).map(item => item.id), owner === 'owner' ? ['survivor'] : []);
    }
  } finally { Object.assign(globalThis, savedGlobals); }
});
test('actual workspace save retains peer additions and failed Delete rolls back its removal record', async () => {
  const source = ts.createSourceFile('workspace.tsx', fs.readFileSync('src/components/KwantifyWorkspace.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let text;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'persistWorkspacePresets') text = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(text);
  const data = new Map([[key, JSON.stringify([preset('a'), preset('peer')])]]), states = [], messages = [];
  let failLibrary = false;
  const context = {
    window: { localStorage: { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) }, dispatchEvent() {} },
    workspacePresetSaveBusyRef: { current: false }, setWorkspacePresetSaving() {}, readWorkspacePreferenceValue: name => data.get(name) ?? null, recordConfirmedWorkspacePreference() {}, supabase: null, preferenceUserId: "owner",
    CustomEvent: class {}, chartWorkspaceScopeRef: { current: 'charts' }, WORKSPACE_PRESETS_STORAGE_KEY: key,
    WORKSPACE_PRESET_DELETIONS_KEY: DELETIONS, workspacePresets: [preset('a')],
    workspaceScopeStorageKey: (_scope, key) => key, markWorkspacePresetDeleted, mergeWorkspacePresetPreferences,
    normalizeWorkspacePresets: values => values, setWorkspacePresets: values => states.push(values), showReportToast: (...args) => messages.push(args),
    writeProtectedItem: (name, value) => {
      if (failLibrary && name === key) return { ok: false };
      data.set(name, value); return { ok: true };
    },
  };
  const save = vm.runInNewContext(ts.transpileModule(`const fn = ${text}; fn;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await save([{ ...preset('a'), name: 'Explicit save' }]);
  assert.deepEqual(JSON.parse(data.get(key)).map(item => item.id), ['a', 'peer']);
  assert.equal(JSON.parse(data.get(key))[0].name, 'Explicit save');
  const previous = data.get(key), stateCount = states.length;
  failLibrary = true;
  assert.equal(await save([], 'a'), null);
  assert.equal(data.get(key), previous);
  assert.equal(data.has(DELETIONS), false);
  assert.equal(states.length, stateCount);
  assert.equal(messages.at(-1)[0], 'error');
  let acknowledge;
  context.supabase = {};
  context.saveWorkspacePreferencePatch = async (_client, userId, patch) => {
    assert.equal(userId, 'owner');
    await new Promise(resolve => { acknowledge = resolve; });
    return { values: patch };
  };
  const pending = save([{ ...preset('a'), name: 'Account-confirmed save', updatedAt: '2026-11-05T00:00:01Z' }]);
  assert.equal(states.length, stateCount, 'no successful UI state before account acknowledgement');
  assert.equal(context.workspacePresetSaveBusyRef.current, true);
  assert.equal(await save([preset('double click')]), null, 'duplicate click cannot fork a second save');
  acknowledge();
  const confirmed = await pending;
  assert.equal(confirmed.find(item => item.id === 'a').name, 'Account-confirmed save');
  assert.equal(states.length, stateCount + 1);
  assert.equal(context.workspacePresetSaveBusyRef.current, false);
});
