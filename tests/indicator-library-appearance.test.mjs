import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/ChartIndicatorsControl.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const library = source.slice(source.indexOf('{libraryOpen &&'), source.indexOf('{candleSettingsOpen &&'));

test('library owns rounded dialog and control styles rather than compact toolbar utilities', () => {
  assert.match(library, /data-indicator-library[\s\S]*?role="dialog"[\s\S]*?aria-labelledby="indicator-library-title"/);
  assert.match(library, /id="indicator-library-title"/);
  assert.match(css, /\.kwant-indicator-library\s*\{[^}]*border-radius:\s*16px/);
  assert.match(css, /\.kwant-indicator-library-search\s*\{[^}]*border-radius:\s*10px/);
  assert.doesNotMatch(library, /focus-within:border-primary/);
});

test('library spacing is explicit and unaffected by global compact padding utilities', () => {
  assert.match(css, /\.kwant-indicator-library-header\s*\{[^}]*padding:\s*20px 24px/);
  assert.match(css, /\.kwant-indicator-library-results\s*\{[^}]*padding:\s*18px 20px/);
  assert.match(css, /\.kwant-indicator-library-category\s*\{[^}]*padding:\s*10px 14px/);
  assert.match(css, /\.kwant-indicator-library-row\s*\{[^}]*padding:\s*14px 12px/);
});

test('semantic dialog remains theme-linked instead of inheriting the fixed-dark dialog skin', () => {
  const override = css.indexOf('body.kwant-cockpit-ui .kwant-indicator-library {');
  assert.ok(override > css.indexOf('body.kwant-cockpit-ui [aria-modal="true"] {'));
  assert.match(css.slice(override), /^body\.kwant-cockpit-ui \.kwant-indicator-library\s*\{[^}]*border-color:\s*var\(--border\);[^}]*background-color:\s*var\(--panel\);/);
});

test('search removes the nested border and coloured typing outline only inside the library', () => {
  assert.match(library, /aria-label="Search indicators"/);
  assert.match(css, /body \.kwant-indicator-library \.kwant-indicator-library-search input\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none/);
  assert.match(css, /body \.kwant-indicator-library \.kwant-indicator-library-search input:focus-visible\s*\{[^}]*outline:\s*none;[^}]*box-shadow:\s*none/);
  assert.match(css, /body\.kwant-cockpit-ui button:focus-visible/,'site-wide keyboard focus must remain intact');
});

test('library keeps responsive search, readable rows and existing add/favourite handlers', () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.kwant-indicator-library-search\s*\{[^}]*order:\s*4;[^}]*width:\s*100%/);
  assert.match(css, /\.kwant-indicator-library-description\s*\{[^}]*white-space:\s*normal/);
  assert.match(library, /onClick=\{\(\) => toggleLibraryIndicator\(definition\.id\)\}/);
  assert.match(library, /onClick=\{\(\) => toggleFavourite\(definition\.id\)\}/);
  assert.match(library, /onChange=\{\(event\) => setSearch\(event\.target\.value\)\}/);
});
