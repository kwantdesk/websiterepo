import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as palettes from '../src/lib/gexMapPalette.ts';

const source = readFileSync(new URL('../src/components/gex-map/BounceGexMapColours.tsx', import.meta.url), 'utf8');
async function harness(run) {
  const previous = globalThis.window;
  const events = new EventTarget(), values = new Map();
  globalThis.window = Object.assign(events, { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  let state, initial = true, mounted = false;
  const cleanups = [];
  const context = { exports: {}, window: globalThis.window, require: name => {
    if (name === 'react') return {
      useState: seed => { if (initial) { state = seed(); initial = false; } return [state, next => { state = next; }]; },
      useEffect: effect => { if (!mounted) cleanups.push(effect()); },
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '@/lib/gexMapPalette') return palettes;
    throw Error(name);
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  const render = () => { const tree = context.exports.default(); mounted = true; return tree; };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  try { await run({ render, nodes, values }); await Promise.resolve(); } finally { cleanups.forEach(cleanup => cleanup?.()); globalThis.window = previous; }
}

test('every actual shared palette is visible without opening the advanced view and saves its exact colours', () => harness(({ render, nodes, values }) => {
  assert.equal(values.size, 0);
  const buttons = nodes(render()).filter(n => n.type === 'button');
  assert.equal(values.size, 0, 'opening settings must not reset the palette');
  assert.equal(buttons.length, palettes.GEX_MAP_SHARED_PALETTE_PRESETS.length);
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].props.onClick();
    const expected = palettes.gexMapPaletteFromPreset(palettes.GEX_MAP_SHARED_PALETTE_PRESETS[i]);
    assert.ok(palettes.gexMapPalettesEqual(palettes.loadGexMapPalette(), expected));
    const active = nodes(render()).filter(n => n.type === 'button' && n.props['aria-pressed']);
    assert.equal(active.length, 1);
    assert.equal(active[0].props['aria-label'], buttons[i].props['aria-label']);
  }
}));

test('theme toggle preserves custom colours and reflects changes made by the advanced editor', () => harness(({ render, nodes }) => {
  render();
  const custom = { ...palettes.gexMapPaletteFromPreset(palettes.GEX_MAP_SHARED_PALETTE_PRESETS[0]), star: '#12AB34' };
  palettes.saveGexMapPalette(custom);
  const input = () => nodes(render()).find(n => n.type === 'input');
  input().props.onChange({ target: { checked: true } });
  assert.equal(input().props.checked, true);
  assert.equal(palettes.loadGexMapPalette().star, '#12AB34');
  input().props.onChange({ target: { checked: false } });
  assert.equal(input().props.checked, false);
  assert.ok(palettes.gexMapPalettesEqual(palettes.loadGexMapPalette(), custom));
}));

test('Bounce exposes Colours as a direct settings section rather than hiding the controls in General', () => {
  const controls = readFileSync(new URL('../src/components/ChartIndicatorsControl.tsx', import.meta.url), 'utf8');
  assert.match(controls, /<div data-settings-section="Colours">\s*<BounceGexMapColours \/>\s*<\/div>/);
});
