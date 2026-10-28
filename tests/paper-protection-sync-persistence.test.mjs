import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccountPreferenceChanges, PAPER_LEDGER_KEY } from '../src/lib/accountPreferenceMerge.ts';
import { createPaperTradingAccount } from '../src/lib/paperAccounts.ts';
import { emptyPaperTradingLedger, placePaperOrder, updatePaperProtection, processPaperQuote } from '../src/lib/paperTrading.ts';
const record = createPaperTradingAccount({ name: 'Protection fixture', balance: 50000, leverage: '1:30', instrument: 'NQ' });
const timestamp = 1793000000000;
function open(stopLoss = null) {
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], { accountId: record.id, symbol: 'NQ', side: 'buy', type: 'market', quantity: 2, price: null, stopLoss, takeProfits: [{ price: 30010, quantity: 1 }] }, { bid: 30000, ask: 30000, last: 30000, timestamp });
  assert.equal(result.error, undefined);
  return result.ledger;
}
const position = ledger => ledger.accounts[record.id].positions[0];
const edit = (ledger, change) => updatePaperProtection(ledger, record.id, position(ledger).id, change).ledger;
const snapshot = ledger => ({ version: 1, complete: true, updatedAt: new Date(timestamp).toISOString(), values: { [PAPER_LEDGER_KEY]: JSON.stringify(ledger) } });
const merge = (base, local, remote) => JSON.parse(mergeAccountPreferenceChanges(snapshot(base), snapshot(local), snapshot(remote)).values[PAPER_LEDGER_KEY]);
for (const reverse of [false, true]) {
  test(`a new working stop survives a concurrent target edit, direction ${reverse}`, () => {
    const base = open();
    const stop = edit(base, { kind: 'stop_loss', price: 29995 });
    const target = edit(base, { kind: 'take_profit', targetId: position(base).takeProfits[0].id, price: 30012 });
    const merged = merge(base, ...(reverse ? [stop, target] : [target, stop]));
    assert.equal(position(merged).stopLoss, 29995);
    assert.equal(position(merged).takeProfits[0].price, 30012);
    assert.equal(position(merged).status, 'open');
  });
  test(`a new stop survives a concurrent partial target fill, direction ${reverse}`, () => {
    const base = open();
    const stop = edit(base, { kind: 'stop_loss', price: 29995 });
    const filled = processPaperQuote(base, [record], 'NQ', { bid: 30010, ask: 30010, last: 30010, timestamp: timestamp + 1000 }, { executionAuthorized: true });
    assert.equal(position(filled).remainingQuantity, 1);
    const merged = merge(base, ...(reverse ? [stop, filled] : [filled, stop]));
    assert.equal(position(merged).stopLoss, 29995);
    assert.equal(position(merged).remainingQuantity, 1);
    assert.equal(position(merged).takeProfits[0].filledQuantity, 1);
    const stopped = processPaperQuote(merged, [record], 'NQ', { bid: 29995, ask: 29995, last: 29995, timestamp: timestamp + 2000 }, { executionAuthorized: true });
    assert.equal(position(stopped).status, 'closed');
    assert.equal(stopped.accounts[record.id].fills.at(-1).price, 29995);
  });
  test(`explicit stop removal is retained across an unrelated target edit, direction ${reverse}`, () => {
    const base = open(29995);
    const removed = edit(base, { kind: 'stop_loss', price: null });
    const target = edit(base, { kind: 'take_profit', targetId: position(base).takeProfits[0].id, price: 30012 });
    const merged = merge(base, ...(reverse ? [removed, target] : [target, removed]));
    assert.equal(position(merged).stopLoss, null);
    assert.equal(position(merged).takeProfits[0].price, 30012);
  });
}
test('an independently added target survives an edit of the existing stop', () => {
  const base = open(29995);
  const stop = edit(base, { kind: 'stop_loss', price: 29996 });
  const target = edit(base, { kind: 'take_profit', price: 30020, quantity: 1 });
  const result = position(merge(base, stop, target));
  assert.equal(result.stopLoss, 29996);
  assert.equal(result.takeProfits.length, 2);
});
for (const reverse of [false, true]) {
  test(`an existing stop move survives a stale partial fill and remains executable, direction ${reverse}`, () => {
    const base = open(29990);
    const moved = edit(base, { kind: 'stop_loss', price: 29996.25 });
    const filled = processPaperQuote(base, [record], 'NQ', { bid: 30010, ask: 30010, last: 30010, timestamp: timestamp + 1000 }, { executionAuthorized: true });
    const merged = merge(base, ...(reverse ? [moved, filled] : [filled, moved]));
    assert.equal(position(merged).stopLoss, 29996.25);
    assert.equal(position(merged).remainingQuantity, 1);
    const stopped = processPaperQuote(merged, [record], 'NQ', { bid: 29996.25, ask: 29996.25, last: 29996.25, timestamp: timestamp + 2000 }, { executionAuthorized: true });
    assert.equal(position(stopped).status, 'closed');
    assert.equal(stopped.accounts[record.id].fills.at(-1).price, 29996.25);
  });
  test(`explicit target removal survives a concurrent stop edit, direction ${reverse}`, () => {
    const base = open(29990);
    const stop = edit(base, { kind: 'stop_loss', price: 29995 });
    const removed = edit(base, { kind: 'take_profit', targetId: position(base).takeProfits[0].id, price: null });
    const result = position(merge(base, ...(reverse ? [stop, removed] : [removed, stop])));
    assert.equal(result.stopLoss, 29995);
    assert.deepEqual(result.takeProfits, []);
  });
}
