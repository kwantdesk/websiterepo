import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaperTradingAccount } from '../src/lib/paperAccounts.ts';
import { emptyPaperTradingLedger, placePaperOrder, processPaperQuote, reconcilePaperOrdersAgainstBars, updatePaperOrderPrice, normalizePaperTradingLedger } from '../src/lib/paperTrading.ts';

const time = 1_790_000_000_000;
const authorized = { executionAuthorized: true };
const quote = (last, timestamp) => ({ bid: last, ask: last, last, timestamp });
const account = createPaperTradingAccount({ name: 'activation regression', balance: 250000, leverage: '1:1', instrument: 'NQ' });
const orderIn = ledger => ledger.accounts[account.id].orders[0];
const place = (side, price, placedAt = time) => placePaperOrder(emptyPaperTradingLedger(), [account], {
  accountId: account.id, symbol: 'NQ', side, type: 'limit', quantity: 1, price, stopLoss: null, takeProfits: [],
}, quote(24000, time), placedAt).ledger;

for (const side of ['buy', 'sell']) {
  const limit = side === 'buy' ? 23950 : 24050;
  test(`${side}: stale quote and bars before placement cannot fill a new limit`, () => {
    let ledger = place(side, limit, time + 120000);
    assert.equal(orderIn(ledger).createdAt, time + 120000);
    for (const timestamp of [time + 1, time + 60000, time + 120000]) {
      ledger = processPaperQuote(ledger, [account], 'NQ', quote(limit, timestamp), authorized);
      assert.equal(orderIn(ledger).status, 'working');
    }
    ledger = reconcilePaperOrdersAgainstBars(ledger, [account], 'NQ', [
      { timestamp: time + 60000, low: limit - 1, high: limit + 1 },
      { timestamp: time + 120000, low: limit - 1, high: limit + 1 },
    ], authorized);
    assert.equal(orderIn(ledger).status, 'working');
    ledger = processPaperQuote(ledger, [account], 'NQ', quote(24000, time + 120001), authorized);
    assert.equal(orderIn(ledger).status, 'working');
    ledger = processPaperQuote(ledger, [account], 'NQ', quote(limit, time + 120002), authorized);
    assert.equal(orderIn(ledger).status, 'filled');
    assert.equal(orderIn(ledger).filledPrice, limit);
  });

  test(`${side}: moving a resting limit cannot reuse an earlier touch, including after reload`, () => {
    let ledger = place(side, side === 'buy' ? 23900 : 24100);
    ledger = updatePaperOrderPrice(ledger, account.id, orderIn(ledger).id, limit, time + 120000);
    assert.equal(orderIn(ledger).createdAt, time);
    assert.equal(orderIn(ledger).priceActivatedAt, time + 120000);
    ledger = normalizePaperTradingLedger(JSON.parse(JSON.stringify(ledger)));
    ledger = reconcilePaperOrdersAgainstBars(ledger, [account], 'NQ', [
      { timestamp: time + 60000, low: limit - 1, high: limit + 1 },
      { timestamp: time + 120000, low: limit - 1, high: limit + 1 },
    ], authorized);
    ledger = processPaperQuote(ledger, [account], 'NQ', quote(limit, time + 90000), authorized);
    assert.equal(orderIn(ledger).status, 'working');
    ledger = processPaperQuote(ledger, [account], 'NQ', quote(24000, time + 120001), authorized);
    assert.equal(orderIn(ledger).status, 'working');
    ledger = processPaperQuote(ledger, [account], 'NQ', quote(limit, time + 120002), authorized);
    assert.equal(orderIn(ledger).status, 'filled');
    assert.equal(orderIn(ledger).filledPrice, limit);
  });

  test(`${side}: bars wholly after a reprice and current marketable limits still fill`, () => {
    let ledger = place(side, side === 'buy' ? 23900 : 24100);
    ledger = updatePaperOrderPrice(ledger, account.id, orderIn(ledger).id, limit, time + 120000);
    ledger = reconcilePaperOrdersAgainstBars(ledger, [account], 'NQ', [
      { timestamp: time + 180000, low: limit - 1, high: limit + 1 },
    ], authorized);
    assert.equal(orderIn(ledger).filledPrice, limit);
    const marketable = place(side, side === 'buy' ? 24001 : 23999);
    const filled = processPaperQuote(marketable, [account], 'NQ', quote(24000, time + 1), authorized);
    assert.equal(orderIn(filled).status, 'filled');
    assert.equal(orderIn(filled).filledPrice, 24000);
  });
}
