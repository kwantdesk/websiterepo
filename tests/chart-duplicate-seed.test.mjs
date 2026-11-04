import test from 'node:test';
import assert from 'node:assert/strict';
import { createChartDuplicateSeeds } from '../src/lib/chartDuplicateSeed.ts';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('a duplicate takes a fresh snapshot only when requested and releases it after hydration', () => {
  const c = createChartDuplicateSeeds(); let count = 0, value = 1;
  const stop = c.register('charts:a', () => { count++; return { value }; });
  assert.equal(count, 0); value = 2; assert.equal(c.copy('charts:a', 'charts:b'), true);
  assert.deepEqual(c.peek('charts:b'), { value: 2 }); assert.equal(count, 1);
  c.discard('charts:b'); assert.equal(c.peek('charts:b'), null); stop(); assert.equal(c.copy('charts:a', 'charts:c'), false);
});
test('unready and other-scope charts cannot seed a duplicate', () => {
  const c = createChartDuplicateSeeds(); c.register('charts:a', () => null); c.register('algo:a', () => ({ value: 1 }));
  assert.equal(c.copy('charts:a', 'charts:b'), false); assert.equal(c.peek('charts:b'), null);
  assert.equal(c.copy('gamma:a', 'charts:b'), false);
});
test('stale effect cleanup does not remove a newer mounted source', () => {
  const c = createChartDuplicateSeeds(), old = c.register('charts:a', () => ({ value: 1 }));
  c.register('charts:a', () => ({ value: 2 })); old(); c.copy('charts:a', 'charts:b'); assert.equal(c.peek('charts:b').value, 2);
});
test('unmounted pending copies retain at most eight snapshots', () => {
  const c = createChartDuplicateSeeds(); c.register('charts:a', () => ({ value: 1 }));
  for (let i = 0; i < 9; i++) c.copy('charts:a', String(i));
  assert.equal(c.peek('0'), null); assert.ok(c.peek('8'));
});

test('actual Workspace seed copies current candle geometry and rejects unsettled/replay sources', () => {
  const source = ts.createSourceFile('Workspace.tsx', fs.readFileSync('src/components/KwantifyWorkspace.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let register;
  function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(source) === 'workspaceDuplicateSeeds.register') register = node; ts.forEachChild(node, visit); }
  visit(source); assert.ok(register);
  const candle = { timestamp: 100, open: 101, high: 105, low: 99, close: 103 };
  const context = vm.createContext({ chartIsLoading: false, replayActive: false, error: null, historyHydratedRef: { current: true },
    latestCandlesRef: { current: [candle] }, latestMarketTradesRef: { current: [{ timestamp: 101 }] }, latestOrderFlowCandlesRef: { current: [] },
    requestedChartHydrationKey: 'NQ:1m:5D', resolvedContractSymbol: 'NQZ6', orderFlowHistoryReady: true,
  });
  const code = ts.transpileModule(`var snapshot = ${register.arguments[1].getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(code, context); const first = context.snapshot(); assert.notEqual(first.candles[0], candle);
  first.candles[0].high = 999; assert.equal(candle.high, 105);
  context.latestCandlesRef.current = [{ ...candle, close: 104 }]; assert.equal(context.snapshot().candles[0].close, 104);
  context.historyHydratedRef.current = false; assert.equal(context.snapshot(), null);
  context.historyHydratedRef.current = true; context.replayActive = true; assert.equal(context.snapshot(), null);
});
