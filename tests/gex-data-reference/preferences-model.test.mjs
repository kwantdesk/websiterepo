import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_CONFIGURATION_OPTIONS, DEFAULT_TOOL_CONFIGURATION, sanitizeToolConfiguration, setConfigurationVisibility, resolveFilterOverride, toggleAttachedFilterGroup, normalizeFilterExpression } from '../../public/gex-data-app/preferences-model.js';

test('all eight source show switches default to visible and keep alphabetical labels', () => {
  assert.equal(TOOL_CONFIGURATION_OPTIONS.length, 8);
  assert.deepEqual(TOOL_CONFIGURATION_OPTIONS.map(value => value.label), TOOL_CONFIGURATION_OPTIONS.map(value => value.label).sort());
  assert.deepEqual(Object.values(DEFAULT_TOOL_CONFIGURATION), Array(8).fill(false));
});

test('configuration sanitizer admits only known boolean keys without mutation', () => {
  const input = { hideLegends: true, hideTooltips: 'false', apiKey: 'do-not-persist', extra: true };
  const result = sanitizeToolConfiguration(input);
  assert.equal(result.hideLegends, true);
  assert.equal(result.hideTooltips, false);
  assert.equal(Object.keys(result).length, 8);
  assert.equal(result.apiKey, undefined);
  assert.equal(input.extra, true);
  assert.deepEqual(sanitizeToolConfiguration(null), DEFAULT_TOOL_CONFIGURATION);
});

test('show labels invert stored hide values', () => {
  assert.equal(setConfigurationVisibility({}, 'hideCrosshairs', false).hideCrosshairs, true);
  assert.equal(setConfigurationVisibility({ hideCrosshairs: true }, 'hideCrosshairs', true).hideCrosshairs, false);
  assert.deepEqual(setConfigurationVisibility({}, '__proto__', false), DEFAULT_TOOL_CONFIGURATION);
});

test('page/global/tool precedence is independent and alerts ignore overrides', () => {
  assert.deepEqual(resolveFilterOverride({ toolValue: 'SPY', pageValue: 'QQQ', globalValue: 'NDX' }), { type: 'PAGE', value: 'QQQ' });
  assert.deepEqual(resolveFilterOverride({ toolValue: ['SPY'], pageValue: [], globalValue: ['NDX'], isTicker: true }), { type: 'GLOBAL', value: ['NDX'] });
  assert.deepEqual(resolveFilterOverride({ toolValue: 'SPY', pageValue: '', globalValue: undefined }), { type: 'NONE', value: 'SPY' });
  assert.deepEqual(resolveFilterOverride({ toolValue: 'SPY', pageValue: 'QQQ', globalValue: 'NDX', alert: true }), { type: 'NONE', value: 'SPY' });
});

test('filter-group toggles prepend new ids and remove detached ids', () => {
  assert.deepEqual(toggleAttachedFilterGroup(['a', 'b'], 'c'), ['c', 'a', 'b']);
  assert.deepEqual(toggleAttachedFilterGroup(['a', 'b'], 'a'), ['b']);
});

test('public DSL normalizes aliases and preserves zero/false, with no private cents conversion', () => {
  const result = normalizeFilterExpression({ conjunction: 'AND', filters: [
    { field: 'PREMIUM', operation: '>=', value: 100000 },
    { field: 'IS_UNUSUAL', operation: 'eq', value: false },
    { field: 'DELTA', operation: '=', values: 0 },
  ] });
  assert.deepEqual(result.filters[0], { field: 'PREMIUM', operation: 'GREATER_THAN_OR_EQUAL_TO', values: [100000] });
  assert.deepEqual(result.filters[1].values, [false]);
  assert.deepEqual(result.filters[2].values, [0]);
});

test('public DSL rejects mixed, empty, unknown and private-only contains syntax', () => {
  for (const value of [
    { conjunction: 'OR', filters: [] },
    { conjunction: 'AND', filters: [], field: 'TICKER' },
    { field: 'TICKER', operation: 'CONTAINS', value: 'SP' },
    { field: 'SIZE', operation: '>=', value: Infinity },
    { field: 'SIZE', operation: '=', values: [] },
    { field: 'SIZE', operation: '=', values: [{}] },
    { field: 'SIZE', operation: '=', value: 1, values: [2] },
  ]) assert.throws(() => normalizeFilterExpression(value), TypeError);
  assert.throws(() => normalizeFilterExpression({ field: 'SECRET', operation: '=', value: 'x' }, { allowedFields: ['TICKER'] }), /unsupported field/);
});

test('public DSL enforces depth 5 and 100 terminals', () => {
  const leaf = { field: 'TICKER', operation: '=', value: 'SPY' };
  let nested = leaf;
  for (let index = 0; index < 5; index++) nested = { conjunction: 'AND', filters: [nested] };
  assert.doesNotThrow(() => normalizeFilterExpression(nested));
  assert.throws(() => normalizeFilterExpression({ conjunction: 'AND', filters: [nested] }), /depth/);
  assert.doesNotThrow(() => normalizeFilterExpression({ conjunction: 'OR', filters: Array(100).fill(leaf) }));
  assert.throws(() => normalizeFilterExpression({ conjunction: 'OR', filters: Array(101).fill(leaf) }), /terminal count/);
});
