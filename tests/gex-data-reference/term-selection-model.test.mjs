import test from 'node:test';
import assert from 'node:assert/strict';
import { termSelectionState } from '../../public/gex-data-app/term-selection-model.js';
import { termStructureRows } from '../../public/gex-data-app/volatility-surface-model.js';

const leg = (iv, delta = .5) => ({ iv, delta, moneyType: 'AT_THE_MONEY' });
const payload = { data: {
  '2026-10-23': { '730.0': { CALL: leg(30), PUT: leg(32, -.5) }, '700.0': { CALL: leg(10), PUT: leg(12, -.5) } },
  '2026-10-19': { '720.0': { CALL: leg(20), PUT: leg(22, -.5) }, '700.0': { CALL: leg(8), PUT: leg(10, -.5) }, '730.0': { CALL: leg(28), PUT: leg(30, -.5) } },
  '2026-10-21': { '710.0': { CALL: leg(16) } },
} };

test('default empty selections mean the complete sorted expiry and strike catalogues', () => {
  const state = termSelectionState(payload);
  assert.deepEqual(state.expirations, ['2026-10-19', '2026-10-21', '2026-10-23']);
  assert.deepEqual(state.strikes, [700, 710, 720, 730]);
  assert.deepEqual(state.selectedExpirations, []);
  assert.deepEqual(state.selectedStrikes, []);
  assert.deepEqual(state.visibleExpirations, state.expirations);
  assert.deepEqual(state.visibleStrikes, state.strikes);
  assert.equal(state.allExpirations, true);
  assert.equal(state.allStrikes, true);
});

test('noncontiguous multi-checkbox selections stay exact and persist without mutating controls', () => {
  const controls = { termExpirations: ['2026-10-23', '2026-10-19', '2026-10-23'], termStrikes: ['730', 700, 730] };
  const original = structuredClone({ payload, controls }), state = termSelectionState(payload, JSON.parse(JSON.stringify(controls)));
  assert.deepEqual(state.selectedExpirations, ['2026-10-19', '2026-10-23']);
  assert.deepEqual(state.selectedStrikes, [700, 730]);
  assert.deepEqual(state.visibleExpirations, state.selectedExpirations);
  assert.deepEqual(state.visibleStrikes, state.selectedStrikes);
  assert.deepEqual({ payload, controls }, original);
});

test('explicit empty new arrays reset All and override old dates and strike ranges', () => {
  const controls = { termExpirations: [], termStrikes: [], expiry: '2026-10-21', expiryStart: '2026-10-21', expiryEnd: '2026-10-21', minStrike: 710, maxStrike: 710 };
  const state = termSelectionState(payload, controls);
  assert.deepEqual(state.visibleExpirations, state.expirations);
  assert.deepEqual(state.visibleStrikes, state.strikes);
  assert.equal(state.allExpirations, true);
  assert.equal(state.allStrikes, true);
});

test('legacy controls remain fallback with independent date and strike restrictions', () => {
  const state = termSelectionState(payload, { expiryStart: '2026-10-20', expiryEnd: '2026-10-23', minStrike: '710', maxStrike: '720' });
  assert.deepEqual(state.visibleExpirations, ['2026-10-21', '2026-10-23']);
  assert.deepEqual(state.visibleStrikes, [710, 720]);
  assert.deepEqual(termSelectionState(payload, { expiry: '2026-10-23,2026-10-19' }).selectedExpirations, ['2026-10-19', '2026-10-23']);
});

test('temporarily unavailable persisted selections never silently broaden to All', () => {
  const state = termSelectionState(payload, { termExpirations: ['2026-11-20'], termStrikes: [999] });
  assert.deepEqual(state.selectedExpirations, ['2026-11-20']);
  assert.deepEqual(state.selectedStrikes, [999]);
  assert.deepEqual(state.visibleExpirations, []);
  assert.deepEqual(state.visibleStrikes, []);
  assert.equal(state.allExpirations, false);
  assert.equal(state.allStrikes, false);
});

test('exact strike selection filters the mean, preserving every original source contract', () => {
  const before = structuredClone(payload), state = termSelectionState(payload, { termExpirations: ['2026-10-19', '2026-10-23'], termStrikes: [700, 730] });
  const rows = termStructureRows(payload, { sessionDate: '2026-10-16', expirations: state.selectedExpirations, strikePrices: state.selectedStrikes });
  assert.deepEqual(rows.map(row => row.expiration), state.selectedExpirations);
  assert.deepEqual(rows.map(row => row.iv), [19, 21]);
  assert.deepEqual(rows.map(row => row.count), [4, 4]);
  assert.equal(rows[0].contracts.length, 6);
  assert.ok(rows[0].contracts.filter(contract => contract.strike === 720).every(contract => !contract.included));
  assert.deepEqual(payload, before);
});

test('signed put delta and contract selection remain independent from exact strike/expiry selections', () => {
  const input = { data: { '2026-10-23': { 700: { CALL: leg(10, .3), PUT: leg(20, -.7) }, 720: { CALL: leg(999, .5), PUT: leg(888, -.5) }, 730: { CALL: leg(30, .7), PUT: leg(40, -.3) } } } };
  const options = { sessionDate: '2026-10-16', strikePrices: [700, 730], deltaMin: .3, deltaMax: .7 };
  assert.equal(termStructureRows(input, options)[0].iv, 25);
  assert.equal(termStructureRows(input, { ...options, contractTypes: ['PUT'] })[0].iv, 30);
  assert.equal(termStructureRows(input, { ...options, deltaMin: .6, contractTypes: ['PUT'] })[0].iv, 20);
  assert.equal(termStructureRows(input, { ...options, deltaMin: .6, contractTypes: ['CALL'] })[0].iv, 30);
});

test('validates arrays and units and ignores malformed catalogue keys', () => {
  assert.deepEqual(termSelectionState({ data: { nope: { 700: {} }, '2026-02-30': { 710: {} }, '2026-10-23': { bad: {}, '': {}, '700.0': {} } } }).strikes, [700]);
  assert.throws(() => termSelectionState(payload, { termExpirations: '2026-10-23' }));
  assert.throws(() => termSelectionState(payload, { termStrikes: [NaN] }));
  assert.throws(() => termSelectionState(payload, { termExpirations: ['2026-02-30'] }));
  assert.throws(() => termSelectionState(payload, { minStrike: 730, maxStrike: 700 }));
  assert.throws(() => termStructureRows(payload, { sessionDate: '2026-10-16', strikePrices: [false] }));
});
