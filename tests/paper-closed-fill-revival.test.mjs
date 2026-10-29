import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createPaperTradingAccount } from '../src/lib/paperAccounts.ts';
import { emptyPaperTradingLedger, placePaperOrder, closePaperPosition, clearPaperAccountFills, processPaperQuote, normalizePaperTradingLedger, paperAccountJournalFills, resetPaperAccountLedger } from '../src/lib/paperTrading.ts';
import { mergeAccountPreferenceChanges, mergePaperTradingLedgerUpdate, PAPER_LEDGER_KEY } from '../src/lib/accountPreferenceMerge.ts';
const record = createPaperTradingAccount({ name: 'Closed protection fixture', balance: 50000, leverage: '1:30', instrument: 'NQ' });
const timestamp = 1793000000000;
const account = ledger => ledger.accounts[record.id];
const snapshot = ledger => ({ version: 1, complete: true, updatedAt: new Date(timestamp).toISOString(), values: { [PAPER_LEDGER_KEY]: JSON.stringify(ledger) } });
const merge = (base, local, remote) => JSON.parse(mergeAccountPreferenceChanges(snapshot(base), snapshot(local), snapshot(remote)).values[PAPER_LEDGER_KEY]);
const quote = (price, offset) => ({ bid: price, ask: price, last: price, timestamp: timestamp + offset });
function open(quantity = 1, side = 'buy') {
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], { accountId: record.id, symbol: 'NQ', side, type: 'market', quantity, price: null, stopLoss: side === 'buy' ? 29990 : 30010, takeProfits: [{ price: side === 'buy' ? 30010 : 29990, quantity }] }, quote(30000, 0));
  assert.equal(result.error, undefined); return result.ledger;
}
const tick = (ledger, price) => processPaperQuote(ledger, [record], 'NQ', quote(price, 2000), { executionAuthorized: true });
function close(ledger, quantity) {
  const result = closePaperPosition(ledger, record.id, account(ledger).positions[0].id, quote(30002, 1000), quantity);
  assert.equal(result.error, undefined); return result.ledger;
}

for (const side of ['buy', 'sell']) for (const price of [29990, 30010]) for (const reverse of [false, true]) {
  test(`manual ${side} close and removed fills cannot reappear at old protection ${price}, peer order ${reverse}`, () => {
    const base = open(1, side), closed = close(base), cleared = clearPaperAccountFills(closed, record.id, timestamp + 1100);
    assert.equal(account(tick(cleared, price)).fills.length, 0, 'single-ledger closed positions already ignore future prices');
    const stalePeer = tick(base, price);
    const combined = merge(base, ...(reverse ? [stalePeer, cleared] : [cleared, stalePeer]));
    assert.deepEqual(account(combined).fills, [], 'sync must not restore removed entry/exit triangles');
    assert.equal(account(combined).cashBalance, account(closed).cashBalance);
    assert.equal(account(combined).positions[0].status, 'closed');
    assert.equal(account(combined).positions[0].remainingQuantity, 0);
    const exits = paperAccountJournalFills(account(combined)).filter(fill => fill.role !== 'entry');
    assert.equal(exits.length, 1); assert.equal(exits[0].role, 'manual_close'); assert.equal(exits[0].price, 30002);
  });
}

test('an unchanged local ledger must reject an older open-position sync response after closing', () => {
  const base = open(), cleared = clearPaperAccountFills(close(base), record.id, timestamp + 1100);
  const result = merge(cleared, cleared, base);
  assert.equal(account(result).positions[0].status, 'closed');
  assert.deepEqual(account(tick(result, 29990)).fills, []);
  assert.equal(account(result).cashBalance, account(cleared).cashBalance);
});

test('a committed manual exit cannot be repriced by a later peer SL/TP with the same fill id', () => {
  const base = open(), closed = close(base), cleared = clearPaperAccountFills(closed, record.id, timestamp + 1100);
  const result = merge(cleared, cleared, tick(base, 30010));
  assert.deepEqual(account(result).fills, []);
  assert.equal(account(result).cashBalance, account(closed).cashBalance);
  assert.equal(account(result).realizedPnl, account(closed).realizedPnl);
  assert.equal(paperAccountJournalFills(account(result)).at(-1).price, 30002);
});

test('clearing partial-exit markers does not cancel the protection on the remaining quantity', () => {
  const base = open(2), cleared = clearPaperAccountFills(close(base, 1), record.id, timestamp + 1100);
  const result = tick(cleared, 30010);
  assert.equal(account(result).positions[0].status, 'closed');
  assert.equal(account(result).fills.length, 1);
  assert.equal(account(result).fills[0].role, 'take_profit');
  assert.equal(account(result).fills[0].quantity, 1);
  assert.equal(paperAccountJournalFills(account(result)).filter(fill => fill.role !== 'entry').length, 2);
});

test('removed fill identities survive persistence without hiding future trades', () => {
  const closed = close(open()), cleared = clearPaperAccountFills(closed, record.id, timestamp + 1100);
  const stored = normalizePaperTradingLedger(JSON.parse(JSON.stringify(cleared)));
  assert.deepEqual(new Set(account(stored).clearedFillIds), new Set(account(closed).fills.map(fill => fill.id)));
  assert.deepEqual(account(stored).fills, []);
});

test('storage/hydration cannot revive a closed position or its cleared markers', () => {
  const base = open(), cleared = clearPaperAccountFills(close(base), record.id, timestamp + 1100);
  for (const incoming of [base, tick(base, 29990), tick(base, 30010)]) {
    const result = mergePaperTradingLedgerUpdate(cleared, incoming);
    assert.equal(account(result).positions[0].status, 'closed');
    assert.deepEqual(account(tick(result, 29990)).fills, []);
    assert.equal(account(result).cashBalance, account(cleared).cashBalance);
  }
});

test('legacy cleared ledgers infer marker removal from durable journal evidence', () => {
  const base = open(), cleared = clearPaperAccountFills(close(base), record.id, timestamp + 1100);
  delete account(cleared).clearedFillIds;
  const persisted = normalizePaperTradingLedger(JSON.parse(JSON.stringify(cleared)));
  assert.equal(account(persisted).clearedFillIds.length, 2);
  const result = merge(persisted, persisted, tick(base, 30010));
  assert.deepEqual(account(result).fills, []);
  assert.equal(account(result).cashBalance, account(cleared).cashBalance);
});

test('real new entries remain visible after removing old fills, and explicit account reset still works', () => {
  const base = open(), cleared = clearPaperAccountFills(close(base), record.id, timestamp + 1100);
  const placed = placePaperOrder(cleared, [record], { accountId: record.id, symbol: 'NQ', side: 'sell', type: 'market', quantity: 1, price: null, stopLoss: 30015, takeProfits: [{ price: 29980, quantity: 1 }] }, quote(30000, 3000));
  assert.equal(placed.error, undefined);
  assert.equal(account(placed.ledger).fills.length, 1);
  assert.equal(account(placed.ledger).fills[0].role, 'entry');
  const merged = merge(cleared, cleared, placed.ledger);
  assert.equal(account(merged).fills.length, 1);
  const reset = resetPaperAccountLedger(merged, record.id);
  const result = mergePaperTradingLedgerUpdate(merged, reset);
  assert.deepEqual(account(result).positions, []);
  assert.deepEqual(account(result).fills, []);
  assert.equal(account(result).cashBalance, account(reset).cashBalance);
});

test('journal close evidence protects legacy ledgers whose closed position row was removed', () => {
  const base = open(), cleared = clearPaperAccountFills(close(base), record.id, timestamp + 1100);
  account(cleared).positions = [];
  const result = mergePaperTradingLedgerUpdate(cleared, base);
  assert.equal(account(result).positions.some(p => p.status === 'open'), false);
  assert.deepEqual(account(tick(result, 30010)).fills, []);
  assert.equal(account(result).cashBalance, account(cleared).cashBalance);
});

test('a stale open quantity cannot undo a partial close after clearing markers', () => {
  const base = open(2), cleared = clearPaperAccountFills(close(base, 1), record.id, timestamp + 1100);
  const result = mergePaperTradingLedgerUpdate(cleared, base);
  assert.equal(account(result).positions[0].remainingQuantity, 1);
  const filled = tick(result, 30010);
  assert.equal(account(filled).fills.length, 1);
  assert.equal(account(filled).fills[0].quantity, 1);
});

test('a stale resting entry order cannot refill a trade that was filled, closed and cleared', () => {
  const pending = placePaperOrder(emptyPaperTradingLedger(), [record], { accountId: record.id, symbol: 'NQ', side: 'buy', type: 'limit', quantity: 1, price: 30000, stopLoss: 29990, takeProfits: [{ price: 30010, quantity: 1 }] }, quote(30005, 0)).ledger;
  const opened = processPaperQuote(pending, [record], 'NQ', quote(30000, 500), { executionAuthorized: true });
  const cleared = clearPaperAccountFills(close(opened), record.id, timestamp + 1100);
  const result = mergePaperTradingLedgerUpdate(cleared, pending);
  assert.equal(account(result).orders[0].status, 'filled');
  const later = tick(result, 29990);
  assert.equal(account(later).positions.some(p => p.status === 'open'), false);
  assert.deepEqual(account(later).fills, []);
});

test('actual workspace storage and hydration handlers reconcile against the live closed ledger', () => {
  const workspace = readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = workspace.indexOf('  useEffect(() => {\n    const handleStorage =');
  const endMarker = '  }, [commitPaperLedger]);';
  const end = workspace.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(workspace.slice(start, end + endMarker.length), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const base = open(), cleared = clearPaperAccountFills(close(base), record.id, timestamp + 1100);
  for (const event of ['storage', 'hydrated']) {
    const listeners = new Map(), ref = { current: cleared }; let cleanup;
    vm.runInNewContext(code, {
      useEffect: fn => { cleanup = fn(); },
      window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
      paperLedgerRef: ref, commitPaperLedger: ledger => { ref.current = ledger; },
      loadPaperTradingLedger: () => event === 'storage' ? base : tick(base, 30010),
      mergePaperTradingLedgerUpdate,
      PAPER_TRADING_ACCOUNTS_EVENT: 'accounts', PREFERENCES_HYDRATED_EVENT: 'hydrated',
    });
    listeners.get(event)(event === 'storage' ? { key: PAPER_LEDGER_KEY } : { detail: { keys: [PAPER_LEDGER_KEY] } });
    assert.equal(account(ref.current).positions[0].status, 'closed');
    assert.deepEqual(account(ref.current).fills, []);
    assert.equal(account(ref.current).cashBalance, account(cleared).cashBalance);
    cleanup(); assert.equal(listeners.size, 0);
  }
});

test('marker-removal metadata is deterministic and legitimate balance adjustments still apply', () => {
  const cleared = clearPaperAccountFills(close(open()), record.id, timestamp + 1100);
  const peer = JSON.parse(JSON.stringify(cleared));
  account(peer).clearedFillIds.reverse();
  account(peer).cashBalance += 100;
  const result = mergePaperTradingLedgerUpdate(cleared, peer);
  assert.deepEqual(account(result).clearedFillIds, [...account(result).clearedFillIds].sort());
  assert.equal(account(result).cashBalance, account(cleared).cashBalance + 100);
  assert.deepEqual(account(result).fills, []);
});
