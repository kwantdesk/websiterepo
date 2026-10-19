import test from 'node:test';
import assert from 'node:assert/strict';
import { tableValue, compareTableValues, filterTableValue, formatTableValue, tableRowStyle } from '../../public/gex-data-app/table-view.js';

test('option-print clocks retain reference millisecond precision without changing equity clocks',()=>{
 const epoch=Date.parse('2026-10-16T20:03:19.257Z'),zone={timeZone:'Australia/Brisbane'};
 assert.equal(formatTableValue(epoch,{type:'time',fractionalSecondDigits:3},{},zone),'6:03:19.257 AM');
 assert.equal(formatTableValue(epoch,{type:'time'},{},zone),'6:03:19 AM');
});

test('table sort handles numeric zero, negative values and nested Greeks', () => {
  const rows = [{ value: 5 }, { value: 0 }, { value: -2 }, { value: 10 }]; rows.sort((a, b) => compareTableValues(a.value, b.value, 'decimal'));
  assert.deepEqual(rows.map(row => row.value), [-2, 0, 5, 10]); assert.equal(tableValue({ greeks: { delta: 0 } }, 'greeks.delta'), 0); assert.equal(tableValue({ 'greeks.delta': 0 }, 'greeks.delta'), 0);
});
test('column filters support zero-safe comparisons, range and text alternatives', () => {
  assert.equal(filterTableValue(0, '=0', 'integer'), true); assert.equal(filterTableValue(-2, '<0', 'decimal'), true); assert.equal(filterTableValue(1234, '1,000..2,000', 'money'), true); assert.equal(filterTableValue(null, '<5', 'money'), false);
  assert.equal(filterTableValue('CALL', 'call|put'), true); assert.equal(filterTableValue('CANCEL_LAST', '!CANCEL'), false); assert.equal(filterTableValue('PUT', '=put'), true);
});
test('table composition uses licensed contract, price and moneyness fields without changing them', () => {
  const row = { ticker: 'QQQ', expirationDate: '2026-10-23', strikePrice: 700, contractType: 'CALL', optionPrice: 2.5, bidPrice: 2.4, askPrice: 2.6, tradeSideCode: 'ASK', moneyness: { moneyType: 'IN_THE_MONEY', degree: 9.5, degreeInPercent: 1.34 } };
  assert.equal(formatTableValue(null, { type: 'contract' }, row), 'QQQ · Oct 23, 2026 · $700 · Call');
  assert.equal(formatTableValue(row.optionPrice, { type: 'priceSide' }, row), '$2.50 · A'); assert.equal(formatTableValue(null, { type: 'bidAsk' }, row), '$2.40 × $2.60'); assert.equal(formatTableValue(null, { type: 'moneyness' }, row), 'ITM by $9.50 (1.34%)');
  assert.equal(formatTableValue(0, { type: 'greek' }), '0.00000'); assert.equal(formatTableValue(.04768, { type: 'percentage' }), '4.77%'); assert.equal(row.strikePrice, 700);
});
test('table date and time formatting uses Brisbane user timezone, independently keyed columns', () => {
  const instant = Date.parse('2026-10-16T20:00:00Z'); assert.equal(formatTableValue(instant, { type: 'date' }), 'Oct 17, 2026'); assert.equal(formatTableValue(instant, { type: 'time' }), '6:00:00 AM');
});

test('equity execution prices preserve two cents digits even for whole dollars',()=>{
  assert.equal(formatTableValue(1289,{type:'money',key:'price'}),'$1,289.00');
  assert.equal(formatTableValue(875.7,{type:'money',key:'price'}),'$875.70');
  assert.equal(formatTableValue(775,{type:'money',key:'strikePrice'}),'$775');
});

test('consolidated flow DTE and inapplicable classifications match displayed source units',()=>{
  assert.equal(formatTableValue(3,{type:'decimal',key:'dte'}),'3.00');
  assert.equal(formatTableValue(3.01,{type:'decimal',key:'dte'}),'3.01');
  assert.equal(formatTableValue('NOT_APPLICABLE',{type:'enum',key:'sector'}),'N/A');
});

test('market-share table keeps full dollar amounts, independent of chart abbreviations',()=>{
 assert.equal(formatTableValue(4231897372,{type:'money',key:'equityTotalPremium',rawMoney:true}),'$4,231,897,372');
 assert.equal(formatTableValue(4231897372,{type:'money',key:'premium'}),'$4.23 B');
 assert.equal(formatTableValue('UNKNOWN',{type:'text',key:'group',blankUnknown:true}),'');
});

test('actual consolidated IV uses percentage points, not an extra hundred-fold multiplier',()=>{
  // Licensed gateway observation, 2026-10-20: SPY session 2026-10-16,
  // CALL 766, expiration 2026-10-19. Public field-reference currently disagrees.
  assert.equal(formatTableValue(10.2519989013672,{type:'percentagePoints'}),'10.25%');
  assert.equal(formatTableValue(11.301040649414062,{type:'percentagePoints'}),'11.30%');
  assert.equal(formatTableValue(15.4972,{type:'percentagePoints'}),'15.50%');
  assert.equal(compareTableValues(0,15.4972,'percentagePoints'),-15.4972);
});
test('cancellation has precedence over golden, unusual and opening styles', () => {
  assert.equal(tableRowStyle({ tradeType: 'CANCEL', isGoldenSweep: true }), 'qtable-cancelled'); assert.equal(tableRowStyle({ isGoldenSweep: true, isUnusual: true }), 'qtable-golden'); assert.equal(tableRowStyle({ isUnusual: true, isOpeningPosition: true }), 'qtable-unusual');
});
