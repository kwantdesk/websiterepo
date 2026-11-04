import test from 'node:test';
import assert from 'node:assert/strict';
import { netFlowRows, volatilityDriftRows, volatilitySkewSeries, termStructureRows, openInterestStrikeRows } from '../../public/gex-data-app/volatility-surface-model.js';

// Small actual licensed SPY2026-10-16 excerpts, captured2026-11-03. Full licensed
// payloads remain uncommitted under tmp/gex-parity-20261103/licensed-*.json.
const T0 = 1792157400000, T1 = T0 + 60000;
const drift = { data: { [T1]: { arv: 11.83269707111541, iv: 14.68658447265625, stockPrice: 772.59 }, [T0]: { arv: 0, iv: 15.020370483398438, stockPrice: 772.91 } } };
const skew = { stockPrice: 762.74, data: { '2026-10-19': { '555.0': { CALL: .0476837158203125, PUT: 107.71751403808594 }, '550.0': { CALL: .0476837158203125, PUT: 110.48316955566406 } }, '2026-10-16': { '300.0': { CALL: 2188.6348724365234 } } } };
const term = { stockPrice: 762.74, data: { '2026-10-19': { '550.0': { CALL: { delta: 1, iv: .0476837158203125, moneyType: 'IN_THE_MONEY' }, PUT: { delta: -.00048449898542715614, iv: 110.48316955566406, moneyType: 'OUT_OF_THE_MONEY' } } } } };

test('actual Net Flow cents become dollars per bucket, without accumulating Net Drift', () => {
  const payload = { data: { [T1]: { callSum: 369184500, putSum: 379543400, stockPrice: 772.59 }, [T0]: { callSum: 578802800, putSum: 552105200, stockPrice: 772.91 } } };
  assert.deepEqual(netFlowRows(payload), [ { time: T0, call: 5788028, put: 5521052, spot: 772.91 }, { time: T1, call: 3691845, put: 3795434, spot: 772.59 } ]);
  assert.equal(netFlowRows(payload, { dataMode: 'NET_VOLUME' })[1].call, 369184500);
});

test('Net Flow keeps absent legs null and optionally applies source leading-price preprocessing', () => {
  const payload = { data: { [T0]: { callSum: 0, stockPrice: 0 }, [T1]: { callSum: 5, putSum: 0, stockPrice: 10 }, [T1 + 60000]: { callSum: 20, putSum: null } } };
  assert.deepEqual(netFlowRows(payload)[0], { time: T0, call: 0, put: null, spot: null });
  const rows = netFlowRows(payload, { dataMode: 'VOLUME', underlyingRequired: true });
  assert.equal(rows.length, 2);
  assert.equal(rows[1].spot, 10);
  assert.equal(rows[1].put, null);
  assert.throws(() => netFlowRows(payload, { dataMode: 'INVENTED' }));
});

test('actual drift retains IV percentage points, explicit zero ARV and dollar stock price', () => {
  assert.deepEqual(volatilityDriftRows(drift), [ { time: T0, iv: 15.020370483398438, arv: 0, spot: 772.91 }, { time: T1, iv: 14.68658447265625, arv: 11.83269707111541, spot: 772.59 } ]);
});

test('drift missing warm-up is a gap and never filled with zero, previous or future volatility', () => {
  const payload = { data: { [T0]: { iv: null, stockPrice: 10 }, [T1]: { iv: 1, arv: .2, stockPrice: 11 } } };
  const rows = volatilityDriftRows(payload);
  assert.equal(rows[0].iv, null);
  assert.equal(rows[0].arv, null);
  assert.equal(rows[1].iv, 1);
  assert.equal(volatilityDriftRows(payload, { ivUnit: 'fraction' })[1].iv, 100);
});

test('drift regular-session start follows New York clock across DST without cutting the close', () => {
  for (const open of ['2026-10-16T13:30:00Z', '2026-11-03T14:30:00Z']) {
    const start = Date.parse(open), payload = { data: { [start - 60000]: { iv: 1 }, [start]: { iv: 2 }, [start + 7 * 3600000]: { iv: 3 } } };
    assert.deepEqual(volatilityDriftRows(payload).map(row => row.iv), [2, 3]);
    assert.equal(volatilityDriftRows(payload, { regularSessionOnly: false }).length, 3);
  }
});

test('skew preserves raw tiny/extreme IVs but plots reference-valid legs with deterministic ordering', () => {
  const rows = volatilitySkewSeries(skew);
  assert.deepEqual(rows.map(series => series.expiration), ['2026-10-16', '2026-10-19']);
  assert.equal(rows[0].rows[0].iv, 2188.6348724365234);
  assert.equal(rows[0].rows[0].putIv, null);
  assert.equal(rows[1].rows[0].strike, 550);
  assert.equal(rows[1].rows[0].callIv, .0476837158203125);
  assert.equal(rows[1].rows[0].iv, 110.48316955566406);
});

test('skew CALL/PUT selections and expiry filters preserve actual leg values', () => {
  assert.equal(volatilitySkewSeries(skew, { contractType: 'PUT' })[0].rows[0].iv, null);
  assert.equal(volatilitySkewSeries(skew, { contractTypes: ['CALL'], expirations: ['2026-10-19'] })[0].rows[0].iv, null);
  assert.equal(volatilitySkewSeries({ data: { '2026-10-16': { 0: { CALL: 0, PUT: 10 } } } })[0].rows[0].iv, 10);
});

test('explicit fractional documentation encoding never relies on IV magnitude', () => {
  const payload = { data: { '2026-10-19': { 100: { CALL: .25, PUT: .3 } } } };
  assert.equal(volatilitySkewSeries(payload, { ivUnit: 'fraction' })[0].rows[0].iv, 27.5);
  assert.equal(volatilitySkewSeries(payload)[0].rows[0].iv, null);
  assert.throws(() => volatilitySkewSeries(payload, { ivUnit: 'auto' }));
});

test('all five default expiry curves apply the shipped >=1 rule to actual licensed strike700 legs', () => {
  // Source656428, byte1269427 in26k4mykzwgrj-.js; actual saved licensed SPY
  //2026-10-16 snapshot excerpt. Preserve the extreme same-day observation too.
  const data = {
    '2026-10-16': { 700: { CALL: 403.83338928222656, PUT: 271.9402313232422 } },
    '2026-10-19': { 700: { CALL: .0476837158203125, PUT: 44.87037658691406 } },
    '2026-10-20': { 700: { CALL: 34.37995910644531, PUT: 41.62788391113281 } },
    '2026-10-21': { 700: { CALL: .0476837158203125, PUT: 38.95759582519531 } },
    '2026-10-22': { 700: { CALL: 32.18650817871094, PUT: 36.38267517089844 } },
  };
  const expected = [337.8868103027344, 44.87037658691406, 38.00392150878906, 38.95759582519531, 34.28459167480469];
  assert.deepEqual(volatilitySkewSeries({ data }).map(series => series.rows[0].iv), expected);
  assert.deepEqual(Object.keys(data), volatilitySkewSeries({ data }).map(series => series.expiration));
});

test('skew threshold is inclusive after explicit unit conversion and raw zero remains inspectable', () => {
  const payload = { data: { '2026-10-16': { 100: { CALL: 0, PUT: .999 }, 101: { CALL: 1, PUT: 3 }, 102: { CALL: .999, PUT: 1 } } } };
  const rows = volatilitySkewSeries(payload)[0].rows;
  assert.deepEqual(rows.map(row => row.iv), [null, 2, 1]);
  assert.equal(rows[0].callIv, 0);
  assert.equal(rows[0].putIv, .999);
  assert.equal(volatilitySkewSeries(payload, { contractType: 'CALL' })[0].rows[2].iv, null);
  assert.equal(volatilitySkewSeries({ data: { '2026-10-16': { 100: { CALL: .01, PUT: .005 } } } }, { ivUnit: 'fraction' })[0].rows[0].iv, 1);
});

test('actual term cells survive ATM filtering, even when the plotted expiry has no matching contracts', () => {
  const rows = termStructureRows(term, { sessionDate: '2026-10-16' });
  assert.equal(rows[0].iv, null);
  assert.equal(rows[0].count, 0);
  assert.equal(rows[0].contracts.length, 2);
  assert.equal(rows[0].daysUntilExpiration, 3);
  assert.equal(rows[0].contracts[0].iv, .0476837158203125);
  const all = termStructureRows(term, { sessionDate: '2026-10-16', moneyTypes: [] });
  assert.equal(all[0].iv, (.0476837158203125 + 110.48316955566406) / 2);
});

test('Skew eligibility must not leak into Term Structure whole-chain mean or Drift levels', () => {
  // Term481754 directly averages the filtered IVs; Drift732868 copies levels.
  // Only Skew656428 rejects values below1 percentage point.
  const payload = { data: { '2026-10-19': { 550: {
    CALL: { delta: 1, iv: .0476837158203125, moneyType: 'IN_THE_MONEY' },
    PUT: { delta: -.00048449898542715614, iv: 110.48316955566406, moneyType: 'OUT_OF_THE_MONEY' },
  } } } };
  const all = termStructureRows(payload, { sessionDate: '2026-10-16', moneyTypes: [] })[0];
  assert.equal(all.count, 2);
  assert.equal(all.iv, 55.26542663574219);
  const itm = termStructureRows(payload, { sessionDate: '2026-10-16', moneyTypes: ['ITM'] })[0];
  assert.equal(itm.count, 1);
  assert.equal(itm.iv, .0476837158203125);
  assert.deepEqual(volatilityDriftRows({ data: { [T0]: { iv: .0476837158203125, arv: 0, stockPrice: 772.91 } } }),
    [{ time: T0, iv: .0476837158203125, arv: 0, spot: 772.91 }]);
});

test('term DTE counts calendar days across New York DST and clamps elapsed expirations to zero', () => {
  const cell = { 100: { CALL: { delta: .5, iv: 10, moneyType: 'ATM' } } };
  const payload = { data: { '2026-11-02': cell, '2026-10-29': cell, '2026-10-30': cell } };
  assert.deepEqual(termStructureRows(payload, { sessionDate: '2026-10-30' }).map(row => [row.expiration, row.daysUntilExpiration]),
    [['2026-10-29', 0], ['2026-10-30', 0], ['2026-11-02', 3]]);
  assert.equal(termStructureRows({ data: { '2027-03-15': cell } }, { sessionDate: '2027-03-12' })[0].daysUntilExpiration, 3);
});

test('actual matching-minute609DTE ATM contracts average exactly without inventing an absent put', () => {
  // Actual SPY Oct16,2026 snapshotTime20:01Z corresponds to the reference
  // completed-minute label20:00Z. Source spot762.68 matches the reference.
  // Public response SHA25685dfb04fa49d8379e3e696a82150dfd685a45a762f74953d89e8baf8ed3741bb.
  const payload = { stockPrice: 762.68, data: { '2028-06-16': {
    '765.0': { CALL: { delta: .6887146164306681, iv: 17.309188842773438, moneyType: 'AT_THE_MONEY' } },
    '770.0': { PUT: { delta: -.32465915353486674, iv: 20.933151245117188, moneyType: 'AT_THE_MONEY' } },
  } } };
  const before = structuredClone(payload), row = termStructureRows(payload, { sessionDate: '2026-10-16' })[0];
  assert.equal(row.daysUntilExpiration, 609);
  assert.equal(row.count, 2);
  assert.equal(row.iv, 19.121170043945312);
  assert.equal(row.iv, (payload.data['2028-06-16']['765.0'].CALL.iv + payload.data['2028-06-16']['770.0'].PUT.iv) / 2);
  assert.equal(row.contracts.find(contract => contract.strike === 765 && contract.contractType === 'PUT'), undefined);
  assert.deepEqual(payload, before);
});

test('term averages all matching contracts, reflects absolute put delta and uses inclusive boundaries', () => {
  const payload = { data: { '2026-11-06': { 101: { CALL: { delta: .7, iv: 30, moneyType: 'ATM' }, PUT: { delta: -.7, iv: 40, moneyType: 'AT_THE_MONEY' } }, 100: { CALL: { delta: .3, iv: 10, moneyType: 'AT_THE_MONEY' }, PUT: { delta: -.3, iv: 20, moneyType: 'ATM' } }, 102: { CALL: { delta: .2, iv: 100, moneyType: 'ATM' }, PUT: { delta: -.8, iv: 200, moneyType: 'ATM' } } } } };
  const options = { sessionDate: '2026-10-30', deltaMin: .3, deltaMax: .7 };
  const rows = termStructureRows(payload, options);
  assert.equal(rows[0].iv, 25);
  assert.equal(rows[0].count, 4);
  assert.equal(rows[0].daysUntilExpiration, 7);
  assert.equal(rows[0].contracts.length, 6);
  assert.equal(termStructureRows(payload, { ...options, contractTypes: ['PUT'] })[0].iv, 30);
});

test('term skips missing delta/IV in the mean without discarding source cells or changing inputs', () => {
  const payload = { data: { '2026-11-03': { 100: { CALL: { delta: .5, iv: null, moneyType: 'ATM' }, PUT: { iv: 20, moneyType: 'ATM' } } } } };
  const before = structuredClone(payload), rows = termStructureRows(payload, { sessionDate: '2026-11-03' });
  assert.equal(rows[0].iv, null);
  assert.equal(rows[0].count, 0);
  assert.equal(rows[0].contracts.length, 2);
  rows[0].contracts[0].source.iv = 777;
  assert.deepEqual(payload, before);
  assert.throws(() => termStructureRows(payload, { sessionDate: '2026-02-30' }));
  assert.throws(() => termStructureRows(payload, { sessionDate: '2026-11-03', deltaMin: .8, deltaMax: .2 }));
});

test('OI actual contract counts are sorted, unscaled and missing sides remain null', () => {
  const payload = { data: { '55.0': { callOpenInterest: 2, putOpenInterest: 8039 }, '50.0': { callOpenInterest: 47, putOpenInterest: 72478 }, 60: { callOpenInterest: 0 }, bad: { callOpenInterest: 1, putOpenInterest: 2 } } };
  assert.deepEqual(openInterestStrikeRows(payload), [ { strike: 50, call: 47, put: 72478, total: 72525 }, { strike: 55, call: 2, put: 8039, total: 8041 }, { strike: 60, call: 0, put: null, total: null } ]);
});

test('malformed observations never become zero-valued plotted points', () => {
  const payload = { data: { junk: { callSum: 10, putSum: 20 }, [T0]: { callSum: false, putSum: '', iv: 'invalid', arv: NaN, stockPrice: 0 } } };
  assert.deepEqual(netFlowRows(payload), [{ time: T0, call: null, put: null, spot: null }]);
  assert.deepEqual(volatilityDriftRows(payload), [{ time: T0, iv: null, arv: null, spot: null }]);
  assert.deepEqual(volatilitySkewSeries({ data: [] }), []);
  assert.deepEqual(openInterestStrikeRows(null), []);
});

test('an invalid bucket between reversed timestamps cannot poison chronological ordering', () => {
  const payload = { data: { [T1]: { callSum: 10, putSum: 20 }, invalid: { callSum: 100 }, [T0]: { callSum: 30, putSum: 40 } } };
  assert.deepEqual(netFlowRows(payload).map(row => row.time), [T0, T1]);
});
