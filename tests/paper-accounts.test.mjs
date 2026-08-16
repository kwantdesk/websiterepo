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
  processPaperQuote,
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

test("fallback quotes can mark P&L but cannot invent a take-profit fill", () => {
  const account = createPaperTradingAccount({
    name: "100K Sim",
    balance: 100_000,
    leverage: "1:30",
    instrument: "All CME Futures",
  });
  const placed = placePaperOrder(
    ensurePaperAccountLedger(emptyPaperTradingLedger(), account),
    [account],
    {
      accountId: account.id,
      symbol: "NQ",
      side: "buy",
      type: "market",
      quantity: 1,
      stopLoss: 29_990,
      takeProfits: [{ price: 30_010, quantity: 1 }],
    },
    { bid: 29_999.75, ask: 30_000, timestamp: 1_000 },
  );

  const marked = processPaperQuote(
    placed.ledger,
    [account],
    "NQ",
    { bid: 30_020, ask: 30_020.25, timestamp: 2_000 },
    { executionAuthorized: false },
  );
  const markedAccount = marked.accounts[account.id];
  assert.equal(markedAccount.positions[0].status, "open");
  assert.equal(markedAccount.positions[0].markPrice, 30_020);
  assert.equal(markedAccount.positions[0].protectionMarkPrice, 30_000);
  assert.equal(markedAccount.fills.filter((fill) => fill.role === "take_profit").length, 0);
  assert.equal(markedAccount.cashBalance, 100_000);
  assert.equal(markedAccount.realizedPnl, 0);
});

test("validated live quotes close protection only on a real executable crossing", () => {
  const account = createPaperTradingAccount({
    name: "100K Sim",
    balance: 100_000,
    leverage: "1:30",
    instrument: "All CME Futures",
  });
  const placed = placePaperOrder(
    ensurePaperAccountLedger(emptyPaperTradingLedger(), account),
    [account],
    {
      accountId: account.id,
      symbol: "NQ",
      side: "buy",
      type: "market",
      quantity: 1,
      stopLoss: 29_990,
      takeProfits: [{ price: 30_010, quantity: 1 }],
    },
    { bid: 29_999.75, ask: 30_000, timestamp: 1_000 },
  );

  const safe = processPaperQuote(
    placed.ledger,
    [account],
    "NQ",
    { bid: 30_005, ask: 30_005.25, timestamp: 2_000 },
    { executionAuthorized: true },
  );
  assert.equal(safe.accounts[account.id].positions[0].status, "open");

  const hit = processPaperQuote(
    safe,
    [account],
    "NQ",
    { bid: 30_010, ask: 30_010.25, timestamp: 3_000 },
    { executionAuthorized: true },
  );
  assert.equal(hit.accounts[account.id].positions[0].status, "closed");
  assert.equal(hit.accounts[account.id].fills.at(-1).role, "take_profit");
  assert.equal(hit.accounts[account.id].fills.at(-1).price, 30_010);
  assert.equal(hit.accounts[account.id].realizedPnl, 200);
  assert.equal(hit.accounts[account.id].cashBalance, 100_200);
});

test("an older execution quote cannot rewind protection and create a false fill", () => {
  const account = createPaperTradingAccount({
    name: "100K Sim",
    balance: 100_000,
    leverage: "1:30",
    instrument: "All CME Futures",
  });
  const placed = placePaperOrder(
    ensurePaperAccountLedger(emptyPaperTradingLedger(), account),
    [account],
    {
      accountId: account.id,
      symbol: "NQ",
      side: "buy",
      type: "market",
      quantity: 1,
      takeProfits: [{ price: 30_010, quantity: 1 }],
    },
    { bid: 29_999.75, ask: 30_000, timestamp: 10_000 },
  );
  const safe = processPaperQuote(
    placed.ledger,
    [account],
    "NQ",
    { bid: 30_005, ask: 30_005.25, timestamp: 12_000 },
    { executionAuthorized: true },
  );
  const stale = processPaperQuote(
    safe,
    [account],
    "NQ",
    { bid: 30_020, ask: 30_020.25, timestamp: 11_000 },
    { executionAuthorized: true },
  );
  assert.equal(stale.accounts[account.id].positions[0].status, "open");
  assert.equal(stale.accounts[account.id].fills.filter((fill) => fill.role === "take_profit").length, 0);
  assert.equal(stale.accounts[account.id].realizedPnl, 0);
});
