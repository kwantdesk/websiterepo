import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChartHistoryRepairGate } from '../src/lib/chartHistoryRepairGate.ts';

test('only one repair may run even after its cooldown has expired', () => {
  const gate = new ChartHistoryRepairGate();
  assert.equal(gate.begin(100), true);
  assert.equal(gate.begin(100_000), false);
  gate.finish(false, 100_000);
  assert.equal(gate.begin(101_999), false);
  assert.equal(gate.begin(102_000), true);
});

test('failed and incomplete history backs off to a bounded 30 seconds', () => {
  const gate = new ChartHistoryRepairGate();
  let now = 100;
  for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
    assert.equal(gate.begin(now), true);
    gate.finish(false, now);
    assert.equal(gate.delay(now), delay);
    assert.equal(gate.begin(now + delay - 1), false);
    now += delay;
  }
});

test('successful recovery resets failures and allows a later genuine repair immediately', () => {
  const gate = new ChartHistoryRepairGate();
  gate.begin(0); gate.finish(false, 0);
  gate.begin(2_000); gate.finish(true, 2_000);
  assert.equal(gate.delay(2_000), 0);
  assert.equal(gate.begin(2_000), true);
  gate.finish(false, 2_000);
  assert.equal(gate.delay(2_000), 2_000);
});

test('workspace uses one cancellable timer and releases repair gate on every async exit', () => {
  const code = readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8');
  const scope = code.slice(code.indexOf('    const repairGate ='), code.indexOf('  // Adding an order-flow study'));
  assert.equal((scope.match(/reconciliationTimer = window.setTimeout/g) ?? []).length, 1);
  assert.match(scope, /Math\.max\(minimumDelay, repairGate\.delay\(\)\)/);
  assert.match(scope, /if \(!repairGate\.begin\(\)\)/);
  assert.match(scope, /finally\s*\{\s*repairGate\.finish\(recovered\)/);
  assert.match(scope, /if \(reconciliationTimer !== null\) window\.clearTimeout/);
  assert.match(scope, /requestController\.abort\(\)/);
  const repair = scope.slice(scope.indexOf('    const reconcileTail ='));
  assert.match(repair, /requestController\.signal,\s*true,[\s\S]*?true,\s*\)/);
  assert.match(repair, /recovered = true;[\s\S]*writeChartHistoryCache/);
});
