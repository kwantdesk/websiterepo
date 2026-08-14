import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaperTradingAccount,
  parseMoney,
} from "../src/lib/paperAccounts.ts";
import {
  emptyPaperTradingLedger,
  ensurePaperAccountLedger,
  placePaperOrder,
  summarizePaperAccount,
} from "../src/lib/paperTrading.ts";

test("paper account balances accept full, compact, and numeric amounts", () => {
  assert.equal(parseMoney("$100,000"), 100_000);
  assert.equal(parseMoney("USD\u00a0100,000.00"), 100_000);
  assert.equal(parseMoney("50k"), 50_000);
  assert.equal(parseMoney(100_000), 100_000);
  assert.equal(parseMoney("$1.5m"), 1_500_000);
});

test("new paper accounts retain their requested starting balance", () => {
  const oneHundredK = createPaperTradingAccount({
    name: "100K Sim",
    balance: 100_000,
    leverage: "1:30",
    instrument: "All CME Futures",
  });
  const fiftyK = createPaperTradingAccount({
    name: "50K Sim",
    balance: 50_000,
    leverage: "1:30",
    instrument: "All CME Futures",
  });

  assert.equal(parseMoney(oneHundredK.balance), 100_000);
  assert.equal(parseMoney(oneHundredK.equity), 100_000);
  assert.equal(parseMoney(fiftyK.balance), 50_000);
  assert.equal(parseMoney(fiftyK.equity), 50_000);
  assert.notEqual(oneHundredK.id, fiftyK.id);
});

test("a stale zero ledger is healed before margin validation and order placement", () => {
  for (const balance of [50_000, 100_000]) {
    const account = createPaperTradingAccount({
      name: `${balance / 1_000}K Sim`,
      balance,
      leverage: "1:30",
      instrument: "All CME Futures",
    });
    const rejectedOrder = {
      id: "old-rejection",
      accountId: account.id,
      symbol: "NQ",
      side: "buy",
      type: "market",
      quantity: 1,
      price: null,
      status: "rejected",
      createdAt: 1,
      stopLoss: null,
      takeProfits: [],
      rejectionReason: "Insufficient available funds",
    };
    const staleLedger = {
      version: 1,
      accounts: {
        [account.id]: {
          accountId: account.id,
          startingBalance: 0,
          cashBalance: 0,
          realizedPnl: 0,
          positions: [],
          orders: [rejectedOrder],
          fills: [],
          updatedAt: 1,
        },
      },
    };

    const healed = ensurePaperAccountLedger(staleLedger, account);
    assert.equal(summarizePaperAccount(healed, account).balance, balance);
    assert.equal(summarizePaperAccount(healed, account).availableFunds, balance);

    const result = placePaperOrder(
      healed,
      [account],
      {
        accountId: account.id,
        symbol: "NQ",
        side: "buy",
        type: "market",
        quantity: 1,
      },
      { bid: 29_999.75, ask: 30_000, timestamp: 2 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.order.status, "filled");
    assert.equal(result.ledger.accounts[account.id].positions.length, 1);
  }
});

test("an empty ledger initializes directly from the selected account", () => {
  const account = createPaperTradingAccount({
    name: "100K Sim",
    balance: 100_000,
    leverage: "1:30",
    instrument: "All CME Futures",
  });
  const ledger = ensurePaperAccountLedger(emptyPaperTradingLedger(), account);
  assert.equal(ledger.accounts[account.id].startingBalance, 100_000);
  assert.equal(ledger.accounts[account.id].cashBalance, 100_000);
});
