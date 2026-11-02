import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { applyInstitutionalTradesToCandles } from '../src/lib/institutionalMarketData.ts';
import { executionCandlePaintBatch, retainFormingCandleExtrema } from '../src/lib/liveCandleAuthority.ts';
import { ObservedCandleHistory } from '../src/lib/observedCandleHistory.ts';

const time = 1793604000000;
const print = (offset, close) => ({ timestamp: time + offset, open: close, high: close, low: close, close, volume: 1, trades: 1, delta: 1, askVolume: 1, bidVolume: 0 });
const fold = (bars, prints) => applyInstitutionalTradesToCandles(bars, prints, '1m', 'NQ', 600);

test('late rollover executions retain their own candle wick and do not rewind the new bar', () => {
  const initial = fold([], [print(100, 20000), print(59000, 20002), print(60100, 20005)]);
  const repaired = fold(initial, [print(59500, 20010), print(59200, 19995)]);
  assert.deepEqual([repaired[0].open, repaired[0].high, repaired[0].low, repaired[0].close], [20000, 20010, 19995, 20010]);
  assert.deepEqual(repaired[1], initial[1]);
  assert.equal(initial[0].high, 20002, 'previous immutable render array remains unchanged');
  assert.deepEqual(executionCandlePaintBatch(initial, repaired, time).map(b => b.timestamp), [time, time + 60000]);
});

test('real exchange order corrects a first-arrival open, but never replaces a seeded historical open', () => {
  const initial = fold([], [print(500, 20005)]);
  const repaired = fold(initial, [print(100, 20000)]);
  assert.equal(repaired[0].open, 20000);
  assert.equal(repaired[0].close, 20005);
  assert.equal(retainFormingCandleExtrema(initial[0], repaired[0]).open, 20000);
  const buffer = new ObservedCandleHistory();
  buffer.observe('NQ', initial[0], time + 500);
  assert.equal(buffer.observe('NQ', repaired[0], time + 500).open, 20000);
  const seeded = [{ timestamp: time, open: 19990, high: 20008, low: 19989, close: 20005, volume: 20 }];
  const after = fold(fold(seeded, [print(500, 20005)]), [print(100, 20000)]);
  assert.equal(after[0].open, 19990);
  assert.equal(after[0].close, 20005);
});

test('a missing interior bucket is restored only when real prints for it arrive', () => {
  const initial = fold([], [print(100, 20000), print(120100, 20010)]);
  const repaired = fold(initial, [print(60500, 20005), print(60100, 20003)]);
  assert.deepEqual(repaired.map(b => b.timestamp), [time, time + 60000, time + 120000]);
  assert.deepEqual([repaired[1].open, repaired[1].close], [20003, 20005]);
  assert.equal(initial.length, 2, 'no synthetic gap candle is inserted without a print');
});

test('actual direct chart flush uses historical update without moving the live cursor backwards', () => {
  const text = readFileSync(new URL('../src/components/Chart.tsx', import.meta.url), 'utf8');
  const source = ts.createSourceFile('Chart.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let flush;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'flush' && node.getText(source).includes('historicalUpdate')) flush = node; ts.forEachChild(node, visit); };
  visit(source);
  assert.ok(flush);
  const updates = [];
  const newest = time + 60000;
  const context = { frame: null, scheduleNext() {}, pendingCandles: [fold([], [print(100, 20000), print(59500, 20010)])[0]],
    timeframe: '1m', instrument: 'NQ', timeframeToMs: () => 60000,
    candleSeriesRef: { current: { update: (bar, historical) => updates.push({ bar, historical }) } },
    lastRenderedCandleTimeRef: { current: newest / 1000 }, lastRenderedSourceTimestampRef: { current: newest },
    heikinAshiActiveRef: { current: false }, liveFootprintEnabledRef: { current: false },
    recordChartTickPaint() {}, eventSourceTimeByChartTimeRef: { current: new Map() }, eventChartTimeBySourceTimeRef: { current: new Map() },
  };
  vm.runInNewContext(ts.transpileModule(flush.getText(source) + ';flush();', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].historical, true);
  assert.equal(updates[0].bar.high, 20010);
  assert.equal(context.lastRenderedSourceTimestampRef.current, newest);
  assert.equal(context.lastRenderedCandleTimeRef.current, newest / 1000);
});
