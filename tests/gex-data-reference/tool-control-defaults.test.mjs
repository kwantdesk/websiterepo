import {numericControlChoices} from '../../public/gex-data-app/numeric-control-options.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';
import {setChoiceValue} from '../../public/gex-data-app/choice-controls.js';
import {resolveFilterOverride} from '../../public/gex-data-app/preferences-model.js';

const spyTools = [
  'dark-flow', 'dark-pool-levels', 'interval-map',
  'exposure-by-expiration', 'exposure-by-strike', 'exposure-forecast',
  'heat-map', 'iv-rank', 'max-pain-over-time', 'net-drift', 'net-flow',
  'open-interest-by-expiration', 'open-interest-by-strike',
  'open-interest-over-time', 'term-structure', 'volatility-drift',
  'volatility-skew', 'stock-price-over-time',
];
const unsetTools = [
  'option-price-over-time', 'contract-statistics',
  'contract-trade-side-statistics', 'max-pain',
];
const unrestrictedTools = [
  'equity-prints', 'exchange-notifications', 'news-articles',
  'market-share', 'market-share-table', 'open-interest-change',
  'order-flow-consolidated', 'order-flow-unconsolidated',
];
const absentTickerTools = ['market-map', 'gainers-losers'];

for (const tool of spyTools) test(`${tool}: explicit SPY ticker default`, () => {
  assert.equal(toolControlDefault(tool, 'ticker', 'QQQ'), 'SPY');
});
for (const tool of unsetTools) test(`${tool}: explicit unset ticker stays blank`, () => {
  assert.equal(toolControlDefault(tool, 'ticker', 'QQQ'), '');
});
for (const tool of unrestrictedTools) test(`${tool}: explicit unrestricted ticker stays blank`, () => {
  assert.equal(toolControlDefault(tool, 'ticker', 'QQQ'), '');
});
for (const tool of absentTickerTools) test(`${tool}: absent ticker default preserves fallback`, () => {
  assert.equal(toolControlDefault(tool, 'ticker', 'QQQ'), 'QQQ');
});

test('all 32 audited defaults are accounted for without duplicate local ids', () => {
  const tools = [...spyTools, ...unsetTools, ...unrestrictedTools, ...absentTickerTools];
  assert.equal(tools.length, 32);
  assert.equal(new Set(tools).size, 32);
});

test('unknown tools, futures and inherited object keys preserve exact fallback', () => {
  for (const tool of ['unknown', 'futures-depth-map', 'futures-dom-ladder',
    'futures-footprint', 'futures-order-flow', '__proto__', 'constructor', '', undefined, null]) {
    for (const fallback of ['QQQ', '', undefined, null, 0, false]) {
      assert.equal(toolControlDefault(tool, 'ticker', fallback), fallback);
    }
  }
  assert.equal(toolControlDefault('max-pain', 'ticker', 'QQQ'), '');
  assert.equal(toolControlDefault('unknown', 'ticker', 'QQQ'), 'QQQ');
});

test('no dates, periods, optional tickers or other controls are inferred', () => {
  const fallback = {selected: 'saved value'};
  for (const tool of [...spyTools, ...unsetTools, ...unrestrictedTools, ...absentTickerTools]) {
    for (const control of ['date', 'mode', 'period', 'expiry', 'tickerOptional', '', undefined]) {
      assert.equal(toolControlDefault(tool, control, fallback), fallback);
    }
  }
});

test('pure initial defaults do not mutate a saved, copied or global selection', () => {
  const selections = {saved: {ticker: 'NDX'}, copied: {ticker: 'SPX'}, global: {ticker: 'QQQ'}};
  const before = structuredClone(selections);
  assert.equal(toolControlDefault('net-drift', 'ticker', 'QQQ'), 'SPY');
  assert.deepEqual(selections, before);
});

const source = readFileSync(new URL('../../public/gex-data-app/app.js', import.meta.url), 'utf8');
function actual(name) {
  const match = new RegExp(`^  function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Actual ${name} exists`);
  const tail = source.slice(match.index + match[0].length);
  const next = /^  (?:async )?function /m.exec(tail);
  assert.ok(next, `Actual ${name} boundary exists`);
  return source.slice(match.index, match.index + match[0].length + next.index);
}

// Model actual select sanitation: assigning a missing option produces a blank
// value, not a valid selection. Tests separately assert the blank option exists.
class Element {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = document;
    this.children = []; this.dataset = {}; this._value = '';
    this.classList = {add() {}, remove() {}};
  }
  get options() { return this.children.filter(child => child.tagName === 'OPTION'); }
  get value() { return this._value; }
  set value(value) {
    const text = String(value);
    this._value = this.tagName !== 'SELECT' || this.options.some(option => option.value === text) ? text : '';
  }
  append(...children) {
    const firstOption = this.tagName === 'SELECT' && !this.options.length;
    for (const child of children) { child.parent = this; this.children.push(child); }
    if (firstOption && this.options.length) this.value = this.options[0].value;
  }
  add(option) { this.append(option); }
  replaceChildren() { this.children = []; }
  closest() { return this.parent; }
}
const descend = node => [node, ...node.children.flatMap(descend)];
function actualTickerHarness(toolId, {saved, copied, page = {}, global = {}} = {}) {
  const document = {createElement: tag => new Element(tag, document)};
  const holder = document.createElement('div');
  const tool = {id: toolId, controls: ['ticker']};
  const env = {document, activeTool: tool, toolControlDefault,numericControlChoices, CONTROL_OPTIONS: {},
    instrumentChoices: () => [['SPY', 'SPY'], ['QQQ', 'QQQ']],
    Option: function (text, value) { const option = document.createElement('option'); option.textContent = text; option.value = value; return option; },
    element: (tag, cls) => { const node = document.createElement(tag); node.className = cls; return node; },
    q: selector => selector === '#toolControls' ? holder : descend(holder).find(node => node.dataset?.control === /data-control="([^"]+)"/.exec(selector)?.[1]),
    qa: () => descend(holder).filter(node => node.dataset?.control),
    setChoiceValue, resolveFilterOverride, getFilterOverrides: () => ({page, global}),
    savedToolControls: saved ? {[toolId]: {...saved}} : {},
    VIEW_PARAMETERS: new URLSearchParams(copied ? {instance: 'copy', ...copied} : {}),
    commonSessionDateControls:null, netDriftContractControls:null,
  };
  const start = source.indexOf('  const CONTROL_META = {');
  const end = source.indexOf('\n  const q =', start);
  const render = actual('renderControls');
  const stop = render.indexOf('    const surfaceSelections=');
  assert.ok(start >= 0 && end > start && stop > 0);
  // Actual creation/restoration prefix, followed by actual filter reflection;
  // exclude unrelated menus, metadata requests and chart rendering only.
  vm.runInNewContext(source.slice(start, end) +
    ['makeControl', 'getControl', 'setControl', 'reflectFilterOverrides'].map(actual).join('\n') +
    render.slice(0, stop) + '\nreflectFilterOverrides();\n}\nthis.api={renderControls,getControl};', env);
  env.api.renderControls(tool);
  return {input: env.q('[data-control="ticker"]'), get: () => env.api.getControl('ticker')};
}

for (const tool of spyTools) test(`actual ${tool} factory selects the proven SPY option`, () => {
  const h = actualTickerHarness(tool);
  assert.equal(h.input.value, 'SPY');
  assert.equal(h.get(), 'SPY');
  assert.ok(h.input.options.some(option => option.value === 'SPY'));
});

for (const tool of [...unsetTools, 'equity-prints', 'open-interest-change',
  'order-flow-consolidated', 'order-flow-unconsolidated']) {
  test(`actual ${tool} factory has a valid visible blank option`, () => {
    const h = actualTickerHarness(tool);
    assert.equal(h.input.value, '');
    assert.equal(h.get(), '');
    const blank = h.input.options.find(option => option.value === '');
    assert.ok(blank, 'Blank must be a selectable option, not a sanitized missing selection');
    assert.equal(blank.textContent, ['option-price-over-time', 'max-pain'].includes(tool) ? 'Select instrument' : 'All instruments');
  });
}

test('actual restoration preserves saved QQQ, copied SPYD and saved precedence over a copy', () => {
  assert.equal(actualTickerHarness('net-drift', {saved: {ticker: 'QQQ'}}).get(), 'QQQ');
  const copied = actualTickerHarness('net-drift', {copied: {c_ticker: 'SPYD'}});
  assert.equal(copied.input.value, 'SPYD'); assert.equal(copied.get(), 'SPYD');
  assert.equal(copied.input.options.find(option => option.value === 'SPYD').textContent, 'SPYD — saved selection');
  assert.equal(actualTickerHarness('net-drift', {saved: {ticker: 'QQQ'}, copied: {c_ticker: 'SPYD'}}).get(), 'QQQ');
});

test('actual global/page filter reflection preserves own saved selection and override precedence', () => {
  const global = actualTickerHarness('net-drift', {saved: {ticker: 'QQQ'}, global: {tickers: ['NDX']}});
  assert.equal(global.input.value, 'NDX'); assert.equal(global.get(), 'NDX');
  assert.equal(global.input.dataset.overrideOwn, 'QQQ'); assert.equal(global.input.disabled, true);
  const page = actualTickerHarness('net-drift', {saved: {ticker: 'QQQ'}, global: {tickers: ['NDX']}, page: {tickers: ['SPYD']}});
  assert.equal(page.input.value, 'SPYD'); assert.equal(page.get(), 'SPYD');
  assert.equal(page.input.dataset.overrideOwn, 'QQQ');
});
