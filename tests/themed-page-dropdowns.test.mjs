import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('new React pages reuse the existing KwantSelect, not browser menus',()=>{
  for(const path of ['src/components/news/OptionsExpirationCalendar.tsx','src/components/news/FuturesExpirationCalendar.tsx','src/components/news/FinancialInfoWorkspace.tsx']){
    const source=read(path);assert.match(source,/import KwantSelect/);assert.match(source,/<KwantSelect/);assert.doesNotMatch(source,/<select\b/);
  }
});
test('both integrated static pages load one shared theme-driven popup implementation',()=>{
  for(const path of ['public/gex-data-app/index.html','public/kwanty-app/index.html']){
    const html=read(path);const kwanty=path.includes('kwanty');assert.ok(html.includes(`/gex-data-app/themed-select.js?v=${kwanty?'3':'1'}`));assert.ok(html.includes(`/gex-data-app/themed-select.css?v=${kwanty?'2':'1'}`));
  }
  const css=read('public/gex-data-app/themed-select.css');assert.match(css,/select\.kwant-choice-source\{display:none!important\}/);
  for(const token of ['primary','panel','surface','foreground','border','muted'])assert.ok(css.includes(`var(--site-${token})`));
  assert.match(css,/aria-selected=true/);assert.match(css,/:focus-visible/);
});
test('adapter keeps source form/events and saved selection, and never polls or inserts labels as HTML',()=>{
  const js=read('public/gex-data-app/themed-select.js');
  assert.match(js,/\['value', 'selectedIndex'\]/);assert.match(js,/Event\('change', \{bubbles: true\}\)/);
  assert.match(js,/option\.disabled/);assert.match(js,/closest\('dialog\[open\]'\)/);
  assert.match(js,/MutationObserver/);assert.match(js,/controls\.delete\(select\)/);
  assert.match(js,/event\.key === 'Escape'/);assert.match(js,/event\.key === 'Tab'/);
  assert.doesNotMatch(js,/innerHTML|setInterval|setTimeout|requestAnimationFrame|fetch\(/);
});
