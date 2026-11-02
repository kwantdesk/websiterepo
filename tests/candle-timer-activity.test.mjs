import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { candleCountdownRemainingMs, chartSourceTimestamp, chartActivityRemainingMs } from '../src/lib/chartCountdown.ts';

test('calendar timers use actual CME DST/week/month boundaries, including leap years', () => {
  for (const [interval, start, end] of [
    ['1D', '2026-10-31T22:00:00Z', '2026-11-01T23:00:00Z'],
    ['1W', '2026-10-25T22:00:00Z', '2026-11-01T23:00:00Z'],
    ['1M', '2026-01-31T23:00:00Z', '2026-02-28T23:00:00Z'],
    ['1M', '2028-01-31T23:00:00Z', '2028-02-29T23:00:00Z'],
  ]) {
    const from = Date.parse(start), to = Date.parse(end), now = from + 1000;
    assert.equal(candleCountdownRemainingMs(from, 86400000, now, true, interval), to - now, interval);
    assert.equal(candleCountdownRemainingMs(from, 86400000, to, true, interval), null);
  }
});

const workspace = readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('Workspace.tsx', workspace, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) { let result; const visit = node => { if (predicate(node)) result = node; ts.forEachChild(node, visit); }; visit(source); return result; }

test('the actual futures early-return path marks fresh quotes active but rejects cached/stale packets', () => {
  const mark = find(n => ts.isVariableDeclaration(n) && n.name.getText(source) === 'markMarketActive');
  const branch = find(n => ts.isIfStatement(n) && n.expression.getText(source) === 'usingDatabentoPaneFeed' && n.getText(source).includes('witnessRithmicExecution'));
  assert.ok(mark); assert.ok(branch);
  for (const patch of [{}, { cached: true }, { timestamp: 1793600000000 - 60000 }]) {
    const active = [], delays = [];
    const context = { useCallback: f => f, Date: { now: () => 1793600000000 }, chartActivityRemainingMs, chartSourceTimestamp,
      marketActiveRef: { current: false }, marketInactiveTimerRef: { current: null },
      setMarketIsActive: value => active.push(value),
      window: { clearTimeout() {}, setTimeout: (f, ms) => { delays.push(ms); return 1; } },
      usingDatabentoPaneFeed: true, price: { timestamp: 1793600000000, contractSymbol: 'NQZ6', isTrade: true, ...patch },
      pane: { symbol: 'NQ' }, displayCmeSymbol: s => s, witnessRithmicExecution() {},
    };
    const code = `const ${mark.getText(source)}; function consume() { ${branch.getText(source)} } consume();`;
    vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    assert.equal(active.length, Object.keys(patch).length ? 0 : 1);
    if (!Object.keys(patch).length) assert.deepEqual(delays, [15000]);
  }
});

test('the execution-only clock uses the newest exchange observation, never arrival time', () => {
  const start = workspace.indexOf('      let newestExecutionTimestamp = -Infinity;');
  const end = workspace.indexOf('      if (needsOrderFlowHistory)', start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const context = { records: [{ timestamp: 1000 }, { timestamp: 900 }, { timestamp: NaN }, { timestamp: 1200 }],
    liveTailStartTimestampRef: { current: null }, markMarketActive: t => calls.push(t) };
  vm.runInNewContext(ts.transpileModule(workspace.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.deepEqual(calls, [1200]);
  assert.equal(context.liveTailStartTimestampRef.current, 900);
});
