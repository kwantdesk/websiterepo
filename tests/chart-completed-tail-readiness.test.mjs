import test from 'node:test';
import assert from 'node:assert/strict';
import { cmeChartTailNeedsReconciliation } from '../src/lib/chartHistoryWindow.ts';

const now = Date.UTC(2026, 9, 20, 14, 2, 40);
const active = Math.floor(now / 60_000) * 60_000;
const bar = timestamp => ({timestamp,open:100,high:102,low:99,close:101,volume:10});
const closed = Array.from({length:30},(_,i)=>bar(active-(30-i)*60_000));

test('completed current-session history can paint before the first forming execution',()=>{
  assert.equal(cmeChartTailNeedsReconciliation(closed,'1m',now),false);
  assert.equal(closed.at(-1).timestamp,active-60_000,'no invented active candle');
});
test('a missing completed minute and older internal gaps still require recovery',()=>{
  assert.equal(cmeChartTailNeedsReconciliation(closed.slice(0,-1),'1m',now),true);
  assert.equal(cmeChartTailNeedsReconciliation(closed.filter((_,i)=>i!==25),'1m',now),true);
  assert.equal(cmeChartTailNeedsReconciliation([bar(active)],'1m',now),true);
  assert.equal(cmeChartTailNeedsReconciliation([bar(active-60_000)],'1m',now),true);
});
test('first genuine live execution joins closed history without quarantine or missing-bar forgiveness',()=>{
  assert.equal(cmeChartTailNeedsReconciliation(closed,'1m',now,[now]),false);
  assert.equal(cmeChartTailNeedsReconciliation(closed.slice(0,-1),'1m',now,[now]),true);
});
