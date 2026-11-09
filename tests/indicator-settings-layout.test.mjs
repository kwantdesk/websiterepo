import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/indicators/IndicatorSettingsLayout.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputText)(createRequire(import.meta.url), module, module.exports);
const Layout = module.exports.default;
const el = React.createElement;

test('late-declared colours and visibility always precede navigation and settings', () => {
  const html = renderToStaticMarkup(el(Layout, null,
    el('div', { 'data-settings-section': 'Inputs' }, 'other inputs'),
    el('label', { 'data-settings-header': 'visibility' }, 'Visible'),
    el('div', { 'data-settings-header': 'colours' }, 'Colour choices'),
    el('input', { 'data-settings-section': 'General', value: 'preserved setting', readOnly: true })));
  assert.ok(html.indexOf('Visible') < html.indexOf('Colour choices'));
  assert.ok(html.indexOf('Colour choices') < html.indexOf('data-indicator-settings-tabs'));
  assert.ok(html.indexOf('data-indicator-settings-tabs') < html.indexOf('preserved setting'));
  assert.equal((html.match(/value="preserved setting"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /other inputs/);
  assert.match(html, /aria-pressed="true"[^>]*>General/);
});

test('profile-specific tabs and extra settings share one rail without losing extra sections', () => {
  const html = renderToStaticMarkup(el(Layout, null,
    el('div', { 'data-settings-header': 'navigation' }, el('button', { 'aria-pressed': true }, 'Data settings')),
    el('div', { 'data-settings-section': 'General' }, 'Profile inputs'),
    el('div', { 'data-settings-section': 'Style' }, 'Extra settings')));
  assert.equal((html.match(/data-indicator-settings-tabs=/g) ?? []).length, 1);
  assert.match(html, />Data settings</);
  assert.match(html, />Style</);
  assert.match(html, /Profile inputs/);
});

test('fragments preserve all header controls and a one-section indicator still has a menu', () => {
  const html = renderToStaticMarkup(el(Layout, null,
    el(React.Fragment, null,
      el('div', { 'data-settings-header': 'colours' }, el('input', { value: '#12AB34', readOnly: true })),
      el('div', { 'data-settings-section': 'General' }, 'Settings'))));
  assert.equal((html.match(/value="#12AB34"/g) ?? []).length, 1);
  assert.match(html, /data-indicator-settings-tabs="sections"/);
  assert.match(html, />General</);
});
