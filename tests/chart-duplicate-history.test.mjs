import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createChartWarmHistory } from '../src/lib/chartWarmHistory.ts';

test('warm decoded history expires and is bounded by entries and record weight', () => {
  let now = 0; const c = createChartWarmHistory(value => value.weight, () => now);
  const value = { weight: 30000 }; c.put('NQZ6:1m', value); assert.equal(c.get('NQZ6:1m'), value);
  assert.equal(c.get('NQH7:1m'), undefined); now = 10000; assert.equal(c.get('NQZ6:1m'), undefined);
  for (let i = 0; i < 5; i++) c.put(String(i), value);
  assert.equal(c.get('0'), undefined); assert.equal(c.get('4'), value);
  c.put('oversize', { weight: 120001 }); assert.equal(c.get('oversize'), undefined);
});

function history() {
  const file = 'src/components/KwantifyWorkspace.tsx', source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'fetchWorkspaceHistoricalExecutions');
  let now = 0, requests = 0, decodes = 0, contract = 'NQZ6', fail = false;
  const context = vm.createContext({ Promise, Map, Math, Number, DEFAULT_CHART_HISTORY_CALENDAR_DAYS: 10,
    currentCmeContract: () => contract, displayCmeSymbol: value => value,
    workspaceHistoricalExecutionRequests: new Map(), workspaceWarmExecutions: createChartWarmHistory(value => value.candles.length + value.records.length, () => now),
    async fetchJsonWithBudget() { requests++; if (fail) throw Error('offline'); return { response: { ok: true }, payload: { candles: [{ close: 100 }], executions: [[1, 100, 10, 10]] } }; },
    sanitizeCandles: value => value, compactIndicatorExecutionHistory: value => value, decodeExecutionTape: value => { decodes++; return value; },
  });
  vm.runInContext(ts.transpileModule(fn.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { read: (...args) => context.fetchWorkspaceHistoricalExecutions(...args), get requests() { return requests; }, get decodes() { return decodes; }, tick: value => { now = value; }, contract: value => { contract = value; }, fail: value => { fail = value; } };
}
test('actual duplicate history path shares both in-flight and completed decode work', async () => {
  const h = history(), first = h.read('NQ'), pending = h.read('NQ'); assert.equal(first, pending);
  const value = await first; assert.equal(await h.read('NQ'), value); assert.equal(h.requests, 1); assert.equal(h.decodes, 1);
  h.tick(10000); await h.read('NQ'); assert.equal(h.requests, 2);
});
test('actual history cache separates contracts, requested depth and replay range', async () => {
  const h = history(); await h.read('NQ'); h.contract('NQH7'); await h.read('NQ'); await h.read('NQ', 20);
  await h.read('NQ', 10, { key: 'monday', fromMs: 1, toMs: 2 }); await h.read('NQ', 10, { key: 'tuesday', fromMs: 3, toMs: 4 }); assert.equal(h.requests, 5);
});
test('failed history read is retryable rather than retained as a poisoned duplicate', async () => {
  const h = history(); h.fail(true); await assert.rejects(h.read('NQ'), /offline/); h.fail(false); await h.read('NQ'); assert.equal(h.requests, 2);
});
