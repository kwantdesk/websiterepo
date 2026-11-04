import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { HEAT_METRICS } from '../../public/gex-data-app/exposure-models.js';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';

const source = readFileSync(new URL('../../public/gex-data-app/app.js', import.meta.url), 'utf8');
function actual(name) {
  const match = new RegExp(`^  function ${name}\\(`, 'm').exec(source);
  assert.ok(match);
  const tail = source.slice(match.index + match[0].length), next = /^  (?:async )?function /m.exec(tail);
  assert.ok(next);
  return source.slice(match.index, match.index + match[0].length + next.index);
}
// Model the native SELECT rule that assigning a nonexistent value removes the
// selection. This would expose the old raw-value restoration bug as blank.
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.selectedIndex = -1; this._value = ''; }
  get options() { return this.children.flatMap(child=>child.tagName==='OPTGROUP'?child.children:[child]); }
  get value() { return this.tagName === 'SELECT' ? this.options[this.selectedIndex]?.value ?? '' : this._value; }
  set value(value) { if (this.tagName === 'SELECT') this.selectedIndex = this.options.findIndex(option => option.value === String(value)); else this._value = String(value); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  add(option) { this.children.push(option); if (this.selectedIndex < 0) this.selectedIndex = 0; }
}
const descend = node => [node, ...node.children.flatMap(descend)];
function harness({ id = 'exposure-by-strike', controls = ['greek', 'representation'], saved, copied } = {}) {
  const holder = new Element('div'), tool = { id, controls };
  const env = { activeTool: tool, toolControlDefault, HEAT_METRICS, NEWS_TOPIC_CHOICES: [], NEWS_SENTIMENTS: [], PERIOD_OPTIONS: [],
    NOTIFICATION_TYPES: [], PRICE_CHART_TYPES: [], MARKET_SHARE_MODES: [], instrumentChoices: () => [['QQQ', 'QQQ']],
    document: { createElement: tag => new Element(tag) },
    element: (tag, cls) => { const node = new Element(tag); node.className = cls; return node; },
    Option: function (text, value) { this.text = text; this.value = value; this.children = []; this.dataset = {}; },
    q: selector => selector === '#toolControls' ? holder : descend(holder).find(node => node.dataset?.control === /data-control="([^"]+)"/.exec(selector)?.[1]),
    qa: () => descend(holder).filter(node => node.dataset?.control),
    setChoiceValue: (node, value) => { if (!node.options.some(option => option.value === value)) node.add({ value, children: [] }); node.value = value; },
    savedToolControls: saved ? { [id]: saved } : {}, VIEW_PARAMETERS: new URLSearchParams(copied ? { instance: 'copy', ...copied } : {}),
    commonSessionDateControls:null, netDriftContractControls:null,
  };
  const start = source.indexOf('  const CONTROL_OPTIONS = {'), end = source.indexOf('\n  const q =', start);
  assert.ok(start >= 0 && end > start);
  const render = actual('renderControls'), stop = render.indexOf('    const surfaceSelections=');
  assert.ok(stop > 0);
  vm.createContext(env);
  vm.runInContext(source.slice(start, end) + '\n' + ['makeControl', 'setControl'].map(actual).join('\n') +
    '\n' + render.slice(0, stop) + '\n}\nthis.api={setControl,renderControls};', env);
  env.api.renderControls(tool);
  return { setControl: env.api.setControl, input: name => descend(holder).find(node => node.dataset?.control === name) };
}

test('Negative control: native select sanitation turns an unknown assigned value into a blank selection', () => {
  const select = new Element('select'); select.add({ value: 'GAMMA' });
  assert.equal(select.value, 'GAMMA'); select.value = 'GEX';
  assert.equal(select.value, ''); assert.equal(select.selectedIndex, -1);
});

const required = [
  ['exposure-by-strike', 'greek', 'GAMMA', 'DELTA'],
  ['exposure-by-strike', 'representation', 'PER_ONE_PERCENT_MOVE', 'RAW'],
  ['heat-map', 'heatMetric', 'NET_GAMMA_EXPOSURE', 'CALL_DELTA'],
  ['option-price-over-time', 'contractType', '', 'PUT'],
  ['contract-trade-side-statistics', 'sideMetric', 'PREMIUM', 'VOLUME'],
];
for (const [id, control, initial, valid] of required) {
  test(`${control}: actual saved/copy unknown or blank preserves the visible factory selection`, () => {
    for (const invalid of ['', 'REMOVED_LEGACY_VALUE']) {
      for (const setup of [{ saved: { [control]: invalid } }, { copied: { [`c_${control}`]: invalid } }]) {
        const h = harness({ id, controls: [control], ...setup });
        assert.equal(h.input(control).value, initial);
        assert.notEqual(h.input(control).selectedIndex, -1);
      }
    }
  });
  test(`${control}: valid restored choices survive and subsequent invalid changes retain the current choice`, () => {
    for (const setup of [{ saved: { [control]: valid } }, { copied: { [`c_${control}`]: valid } }]) {
      const h = harness({ id, controls: [control], ...setup });
      assert.equal(h.input(control).value, valid);
      h.setControl(control, 'REMOVED_LEGACY_VALUE'); assert.equal(h.input(control).value, valid);
      h.setControl(control, ''); assert.equal(h.input(control).value, control==='contractType'?'':valid);
    }
  });
}

test('Intentional optional All blank remains valid when an actual blank-valued option exists', () => {
  for (const [id, control, value] of [['equity-prints', 'printType', 'DARK_POOL'], ['open-interest-change', 'contractTypeOptional', 'PUT']]) {
    const h = harness({ id, controls: [control], saved: { [control]: value } });
    assert.equal(h.input(control).value, value);
    h.setControl(control, ''); assert.equal(h.input(control).value, '');
    assert.notEqual(h.input(control).selectedIndex, -1, 'Blank is selected, not an invalid empty selection');
    const copied = harness({ id, controls: [control], copied: { [`c_${control}`]: '' } });
    assert.equal(copied.input(control).value, ''); assert.notEqual(copied.input(control).selectedIndex, -1);
  }
});

test('Existing saved-control precedence wins over valid and invalid copied URL fields', () => {
  for (const copied of ['DELTA', 'REMOVED_LEGACY_VALUE']) {
    const h = harness({ saved: { greek: 'VANNA' }, copied: { c_greek: copied } });
    assert.equal(h.input('greek').value, 'VANNA');
  }
});

test('Invalid restoration does not corrupt the underlying selection of an overridden native control', () => {
  const h = harness(), input = h.input('greek'); input.dataset.overrideOwn = 'GAMMA'; input.value = 'DELTA';
  h.setControl('greek', 'OLD_VALUE'); assert.equal(input.dataset.overrideOwn, 'GAMMA'); assert.equal(input.value, 'DELTA');
  h.setControl('greek', 'VANNA'); assert.equal(input.dataset.overrideOwn, 'VANNA'); assert.equal(input.value, 'DELTA');
});

test('Ticker restoration keeps its existing saved-symbol insertion behavior', () => {
  const h = harness({ controls: ['ticker'], saved: { ticker: 'NEW_SYMBOL' } });
  assert.equal(h.input('ticker').value, 'NEW_SYMBOL');
});
