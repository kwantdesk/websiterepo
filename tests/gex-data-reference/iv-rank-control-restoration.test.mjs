import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { additionalToolRequest } from '../../public/gex-data-app/additional-tool-requests.js';
import {toolControlDefault} from '../../public/gex-data-app/tool-control-defaults.js';
import { resolveFilterOverride, expirationFilterForTool } from '../../public/gex-data-app/preferences-model.js';

const source = readFileSync(new URL('../../public/gex-data-app/app.js', import.meta.url), 'utf8');
function actual(name) {
  const match = new RegExp(`^  function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Actual function ${name} exists`);
  const rest = source.slice(match.index + match[0].length), next = /^  (?:async )?function /m.exec(rest);
  assert.ok(next, `Function boundary after ${name}`);
  return source.slice(match.index, match.index + match[0].length + next.index);
}

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.value = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  add(option) { this.children.push(option); }
}
const descend = node => [node, ...node.children.flatMap(descend)];
const plain = value => JSON.parse(JSON.stringify(value));

function harness({ saved, copied } = {}) {
  const holder = new Element('div');
  // Exercise the actual numeric factory and saved/copy restoration sequence;
  // omit the unrelated custom multi-select contract-type widget from this DOM.
  const tool = { id: 'iv-rank', controls: ['ticker', 'lookback', 'maturity'] };
  const env = { activeTool: tool, toolControlDefault, CONTROL_OPTIONS: {}, instrumentChoices: () => [['QQQ', 'QQQ'], ['SPY', 'SPY']],
    element: (tag, cls) => { const node = new Element(tag); node.className = cls; return node; },
    document: { createElement: tag => new Element(tag) },
    Option: function (text, value) { this.text = text; this.value = value; this.children = []; },
    q: selector => selector === '#toolControls' ? holder : descend(holder).find(node => node.dataset?.control === /data-control="([^"]+)"/.exec(selector)?.[1]),
    qa: () => descend(holder).filter(node => node.dataset?.control),
    setChoiceValue: (node, value) => { node.value = value; },
    savedToolControls: saved ? { 'iv-rank': { ...saved } } : {},
    VIEW_PARAMETERS: new URLSearchParams(copied ? { instance: 'copied', ...copied } : {}),
    commonSessionDateControls:null, netDriftContractControls:null, getFilterOverrides: () => ({ page: {}, global: {} }), resolveFilterOverride, expirationFilterForTool,
    masterReplay: null, apiStatus: { market: { sessionDate: '2026-10-16' } }, toolCursor: null,
    FILTER_GROUP_TOOLS: new Set(), additionalToolRequest,
  };
  const metadataStart = source.indexOf('  const CONTROL_META = {'), metadataEnd = source.indexOf('\n  const q =', metadataStart);
  assert.ok(metadataStart >= 0 && metadataEnd > metadataStart);
  const render = actual('renderControls'), restorationEnd = render.indexOf('    const surfaceSelections=');
  assert.ok(restorationEnd > 0);
  vm.createContext(env);
  vm.runInContext(source.slice(metadataStart, metadataEnd) + '\n' +
    ['makeControl', 'getControl', 'setControl', 'requestBase', 'maybeFilter', 'buildRequest'].map(actual).join('\n') +
    '\n' + render.slice(0, restorationEnd) + '\n}\nthis.api={renderControls,getControl,buildRequest};', env);
  env.api.renderControls(tool);
  return { input: id => descend(holder).find(node => node.dataset?.control === id),
    request: () => plain(env.api.buildRequest(tool)), getControl: env.api.getControl };
}

test('Actual IV Rank maturity factory exposes supported integer bounds and the existing default', () => {
  const h = harness(), input = h.input('maturity');
  assert.equal(input.type, 'number'); assert.equal(input.step, '1');
  assert.equal(input.min, '1'); assert.equal(input.max, '365');
  assert.equal(input.value, '30'); assert.equal(h.request().maturity, 30);
});

for (const zero of [0, '0', '0.0', ' 0 ']) {
  test(`Actual saved legacy maturity ${JSON.stringify(zero)} restores visibly to supported 1`, () => {
    const saved = { maturity: zero, lookback: '365' }, h = harness({ saved });
    assert.equal(h.input('maturity').value, '1');
    assert.equal(h.getControl('maturity'), '1'); assert.equal(h.request().maturity, 1);
    assert.equal(saved.maturity, zero, 'Restoration does not mutate the supplied saved object');
  });
}

test('Actual copied URL maturity zero restores visibly to 1, without overriding saved controls', () => {
  const copied = { c_maturity: '0', c_lookback: '365' }, h = harness({ copied });
  assert.equal(h.input('maturity').value, '1'); assert.equal(h.request().maturity, 1);
  const saved = harness({ copied, saved: { maturity: '365', lookback: '365' } });
  assert.equal(saved.input('maturity').value, '365'); assert.equal(saved.request().maturity, 365);
});

for (const value of ['1', '365']) {
  test(`Actual saved and copied maturity retain valid boundary ${value}`, () => {
    for (const setup of [{ saved: { maturity: value } }, { copied: { c_maturity: value } }]) {
      const h = harness(setup);
      assert.equal(h.input('maturity').value, value); assert.equal(h.request().maturity, Number(value));
    }
  });
}

test('Directly typed zero is rejected before a request body can reach fetch, instead of silently changing the entry', () => {
  const h = harness(); h.input('maturity').value = '0';
  assert.equal(h.getControl('maturity'), '0');
  assert.throws(() => h.request(), /maturity must be an integer between 1 and 365/);
  assert.equal(h.input('maturity').value, '0', 'Invalid typed input remains visible for correction');
});

test('Typed fractional, negative, empty and over-limit maturity are rejected while valid boundary edits remain usable', () => {
  const h = harness();
  for (const value of ['0.5', '-1', '', '366']) {
    h.input('maturity').value = value;
    assert.throws(() => h.request(), /maturity must be an integer between 1 and 365/);
  }
  for (const value of ['1', '365']) {
    h.input('maturity').value = value; assert.equal(h.request().maturity, Number(value));
  }
});
