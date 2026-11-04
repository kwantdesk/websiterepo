import test from 'node:test';
import assert from 'node:assert/strict';
import { netDriftTooltipModel, netDriftTooltipRows, netDriftInitialRthIndex, netDriftVolumeDomain, netDriftUnderlyingScope } from '../../public/gex-data-app/net-drift-interaction-model.js';

// Actual shipped module297760 fixture fragments after source495530 cumulative
// processing and explicit cents->dollars normalization. No provider requests.
const first = { time: 1721136600000, call: 1174905, put: -82799, callBand: 492285, putBand: 154082, netVolume: 11682, spot: 562.9 };
const second = { time: 1721136660000, call: 1682766, put: -469337, callBand: 891977, putBand: 221002, netVolume: 19898, spot: 563.01 };
const terminal = { time: 1721160900000, call: 14177810, put: 20531156, callBand: 42197089, putBand: 28879061, netVolume: 28737, spot: 564.57 };

test('underlying scope follows the resolved single ticker independently of missing price data', () => {
  assert.deepEqual(netDriftUnderlyingScope({ filter: { ticker: 'SPY' } }), { ticker: 'SPY', eligible: true });
  assert.deepEqual(netDriftUnderlyingScope({ filter: { tickers: ['QQQ'] } }, ['QQQ']), { ticker: 'QQQ', eligible: true });
  assert.deepEqual(netDriftUnderlyingScope({ filter: { ticker: ' spy ', tickers: ['SPY'] } }), { ticker: 'SPY', eligible: true });
  assert.deepEqual(netDriftUnderlyingScope({ data: { 1: { stockPrice: 700 } } }), { ticker: null, eligible: false });
});

test('multiple globals disable underlying scope by source count even if the resolved request has one ticker', () => {
  assert.deepEqual(netDriftUnderlyingScope({ filter: { ticker: 'SPY' } }, ['SPY', 'QQQ']), { ticker: 'SPY', eligible: false });
  assert.equal(netDriftUnderlyingScope({ filter: { ticker: 'SPY' } }, ['SPY', 'SPY']).eligible, false);
  assert.equal(netDriftUnderlyingScope({ filter: { tickers: ['SPY', 'QQQ'] } }).eligible, false);
});

test('empty, ambiguous and malformed ticker scopes never manufacture a single underlying', () => {
  for (const request of [null, {}, { filter: {} }, { filter: [] }, { filter: { ticker: '' } }, { filter: { ticker: ['SPY'] } },
    { filter: { tickers: [] } }, { filter: { tickers: 'SPY' } }, { filter: { tickers: ['SPY', 'SPY'] } },
    { filter: { ticker: 'SPY', tickers: ['QQQ'] } }, { filter: { ticker: 'BAD SYMBOL' } }]) {
    assert.deepEqual(netDriftUnderlyingScope(request), { ticker: null, eligible: false });
  }
  assert.equal(netDriftUnderlyingScope({ filter: { ticker: 'SPY' } }, 'SPY').eligible, false);
});

test('actual source tooltip shows call/put/difference and volume even when all their lines are hidden', () => {
  const options = { showCalls: false, showPuts: false, showNet: false, showUnderlying: false, timeZone: 'America/New_York' };
  const model = netDriftTooltipModel(first, [first, second], options);
  assert.equal(model.title, '9:30 AM on July 16, 2024');
  assert.deepEqual(model.entries.map(entry => entry.label), ['Net Call Premium:', 'Net Put Premium:', 'Net Premium Difference:', 'Net Volume:', 'Underlying Price:']);
  assert.deepEqual(model.entries.map(entry => entry.formatted), ['$1.17 M', '-$82.80 K', '$1.26 M', '11.68 K', '$562.90 (0.00%)']);
  assert.equal(model.entries[2].value, 1257704);
  assert.equal(model.hint, 'Click for more information');
  assert.equal(netDriftTooltipRows(first, [first], options).at(-1), model.hint);
});

test('bands add both actual midpoint values with no half-width division and preserve raw rows', () => {
  const original = structuredClone([first, second]);
  const model = netDriftTooltipModel(second, [first, second], { showBands: true });
  assert.deepEqual(model.entries.map(entry => entry.key), ['call', 'put', 'net', 'callBand', 'putBand', 'netVolume', 'spot']);
  assert.equal(model.entries[3].value, 891977);
  assert.equal(model.entries[3].formatted, '$891.98 K');
  assert.equal(model.entries[4].formatted, '$221 K');
  assert.deepEqual([first, second], original);
});

test('source percent change uses first valid actual spot and always two decimals in the selected zone', () => {
  const rows = [{ ...first, time: first.time - 60_000, spot: 0 }, first, second, terminal];
  const model = netDriftTooltipModel(terminal, rows, { timeZone: 'Australia/Brisbane' });
  assert.equal(model.title, '6:15 AM on July 17, 2024');
  assert.equal(model.firstSpot, 562.9);
  assert.equal(model.changePoints, (564.57 - 562.9) / 562.9 * 100);
  assert.equal(model.entries.at(-1).formatted, '$564.57 (0.30%)');
  assert.equal(model.entries.at(-1).direction, 'up');
  const falling = netDriftTooltipModel({ ...second, spot: 550 }, [first]);
  assert.equal(falling.entries.at(-1).formatted, '$550 (-2.29%)');
  assert.equal(falling.entries.at(-1).direction, 'down');
});

test('missing quotes/premiums/volume remain absent or unknown and never borrow future observations', () => {
  const model = netDriftTooltipModel({ time: first.time, call: null, put: 0, netVolume: NaN, spot: 100 }, [{ ...second, spot: 200 }], { showBands: true });
  assert.equal(model.entries[0].formatted, '—');
  assert.equal(model.entries[1].formatted, '$0');
  assert.equal(model.entries[2].formatted, '—');
  assert.equal(model.entries[3].formatted, '—');
  assert.equal(model.entries[5].formatted, '—');
  assert.equal(model.entries.at(-1).formatted, '$100');
  assert.equal(model.changePoints, null);
  assert.equal(netDriftTooltipModel({ time: first.time, spot: 0 }, [first]).entries.some(entry => entry.key === 'spot'), false);
  assert.deepEqual(netDriftTooltipRows(null), []);
});

test('negative signed volume abbreviates absolute magnitude before restoring the source sign', () => {
  const model = netDriftTooltipModel({ ...first, netVolume: -1005 }, [first]);
  assert.equal(model.entries.find(entry => entry.key === 'netVolume').formatted, '-1.01 K');
  assert.equal(model.entries.find(entry => entry.key === 'netVolume').direction, 'down');
});

test('RTH category reset follows New York clock across DST without removing original categories', () => {
  for (const open of ['2026-10-16T13:30:00Z', '2026-11-03T14:30:00Z']) {
    const start = Date.parse(open), rows = [{ time: NaN }, { time: start - 60_000 }, { time: start }, { time: start + 60_000 }], original = structuredClone(rows);
    assert.equal(netDriftInitialRthIndex(rows), 2);
    assert.deepEqual(rows, original);
    assert.equal(netDriftInitialRthIndex(rows.slice(0, 2)), null);
  }
  assert.equal(netDriftInitialRthIndex([]), null);
});

test('raw volume domain is anchored at zero and does not pad positive-only or negative-only flow', () => {
  const positive = netDriftVolumeDomain([{ netVolume: 1 }, { netVolume: 10 }, { netVolume: NaN }]);
  assert.equal(positive.min, 0);
  assert.equal(positive.max, 10);
  const negative = netDriftVolumeDomain([{ netVolume: -1 }, { netVolume: -10 }]);
  assert.equal(negative.min, -10);
  assert.equal(negative.max, 0);
  const mixed = netDriftVolumeDomain([{ netVolume: -5 }, { netVolume: 10 }]);
  assert.ok(mixed.min <= -5 && mixed.max >= 10);
  assert.ok(netDriftVolumeDomain([]).ticks.every(Number.isFinite));
  assert.ok(netDriftVolumeDomain([{ netVolume: 0 }]).ticks.every(Number.isFinite));
});
