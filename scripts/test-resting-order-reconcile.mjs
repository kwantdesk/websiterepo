import assert from "node:assert/strict";

const {
  reconcilePaperOrdersAgainstBars,
  placePaperOrder,
  emptyPaperTradingLedger,
  ensurePaperAccountLedger,
} = await import("../src/lib/paperTrading.ts");

/**
 * A resting order fills on price the quote stream never delivered.
 *
 * `processPaperQuote` compares an order against ONE quote, which is only
 * correct if every quote arrives. A backgrounded tab has its timers throttled
 * to roughly one a minute and each wake carries the latest price only, so a
 * limit touched for two minutes an hour ago is never observed. The trader comes
 * back to a working order beside a chart that plainly traded through it — which
 * is exactly what was reported, more than once.
 *
 * A bar's high and low are the range actually traversed, so they see what the
 * samples missed.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const ACCOUNT = { id: "acct-1", name: "Demo", leverage: "1:1", balance: "100000" };
const T0 = 1_788_000_000_000;

const bar = (minute, low, high) => ({
  timestamp: T0 + minute * 60_000, low, high,
});

const ledgerWithOrder = (side, type, price) => {
  const base = ensurePaperAccountLedger(emptyPaperTradingLedger(), ACCOUNT);
  const placed = placePaperOrder(
    base, [ACCOUNT],
    {
      accountId: ACCOUNT.id, symbol: "NQ", side, type,
      quantity: 1, price, stopLoss: null, takeProfits: [],
    },
    { bid: 20_000, ask: 20_000.25, timestamp: T0 },
  );
  const ledger = placed.ledger ?? placed;
  const account = ledger.accounts[ACCOUNT.id];
  assert.ok(account, "the order did not reach an account");
  return ledger;
};

const workingCount = (ledger) =>
  (ledger.accounts[ACCOUNT.id]?.orders ?? []).filter((order) => order.status === "working").length;
const positions = (ledger) => ledger.accounts[ACCOUNT.id]?.positions ?? [];

check("a limit the stream never saw hit still fills", () => {
  /*
   * The reported bug. The order rests at 19,950; an hour later a bar prints a
   * low of 19,940 and recovers. No quote we sampled was ever at or below the
   * limit.
   */
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  assert.equal(workingCount(ledger), 1, "the order was not resting to begin with");
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ",
    [bar(1, 19_990, 20_010), bar(2, 19_940, 20_005), bar(3, 19_995, 20_020)],
    { executionAuthorized: true },
  );
  assert.equal(workingCount(next), 0, "the order is still working after the bar traded through it");
  assert.equal(positions(next).length, 1, "no position was opened");
});

check("it fills at the limit, not at the bar", () => {
  // Filling at the low would be inventing price improvement nobody quoted.
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ", [bar(1, 19_900, 20_010)], { executionAuthorized: true },
  );
  assert.equal(positions(next)[0]?.entryPrice, 19_950);
});

check("it fills at the bar that crossed, not when the check ran", () => {
  /*
   * The reconciliation may run an hour late. Stamping the fill with "now"
   * would put it in the wrong session and the wrong daily P&L.
   */
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ",
    [bar(1, 19_990, 20_010), bar(2, 19_940, 20_005), bar(9, 19_900, 19_980)],
    { executionAuthorized: true },
  );
  // The EARLIEST crossing, not the last one.
  assert.equal(positions(next)[0]?.openedAt, T0 + 2 * 60_000);
});

check("a bar that opened before the order cannot fill it", () => {
  /*
   * The bar containing the placement carries price action from before the
   * order existed. Filling from it would be inventing a fill out of the past.
   */
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ",
    [{ timestamp: T0, low: 19_900, high: 20_010 }, { timestamp: T0 - 60_000, low: 19_800, high: 20_000 }],
    { executionAuthorized: true },
  );
  assert.equal(workingCount(next), 1, "an order filled from a bar older than itself");
});

check("a bar that never reached the limit leaves it working", () => {
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ", [bar(1, 19_960, 20_010), bar(2, 19_955, 20_000)],
    { executionAuthorized: true },
  );
  assert.equal(workingCount(next), 1);
  assert.equal(next, ledger, "an untouched ledger should be returned by identity");
});

check("a sell limit needs the high, not the low", () => {
  const ledger = ledgerWithOrder("sell", "limit", 20_100);
  const missed = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ", [bar(1, 19_900, 20_050)], { executionAuthorized: true },
  );
  assert.equal(workingCount(missed), 1, "a sell limit filled without the price trading up to it");
  const hit = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ", [bar(1, 19_900, 20_150)], { executionAuthorized: true },
  );
  assert.equal(workingCount(hit), 0);
});

check("a buy stop needs the high, a sell stop the low", () => {
  // The mirror of a limit, and easy to get backwards.
  const buyStop = ledgerWithOrder("buy", "stop", 20_100);
  assert.equal(
    workingCount(reconcilePaperOrdersAgainstBars(
      buyStop, [ACCOUNT], "NQ", [bar(1, 19_900, 20_150)], { executionAuthorized: true },
    )), 0, "a buy stop did not trigger on the high",
  );
  const sellStop = ledgerWithOrder("sell", "stop", 19_900);
  assert.equal(
    workingCount(reconcilePaperOrdersAgainstBars(
      sellStop, [ACCOUNT], "NQ", [bar(1, 19_850, 20_000)], { executionAuthorized: true },
    )), 0, "a sell stop did not trigger on the low",
  );
});

check("another symbol's bars cannot fill it", () => {
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "ES", [bar(1, 19_900, 20_010)], { executionAuthorized: true },
  );
  assert.equal(workingCount(next), 1);
});

check("nothing fills without execution authority", () => {
  /*
   * The same gate the quote path uses. A marking pass must never open a
   * position.
   */
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  for (const options of [{}, { executionAuthorized: false }]) {
    const next = reconcilePaperOrdersAgainstBars(ledger, [ACCOUNT], "NQ", [bar(1, 19_900, 20_010)], options);
    assert.equal(next, ledger, "an unauthorized pass filled an order");
  }
});

check("a malformed bar is ignored, not guessed at", () => {
  const ledger = ledgerWithOrder("buy", "limit", 19_950);
  const next = reconcilePaperOrdersAgainstBars(
    ledger, [ACCOUNT], "NQ",
    [{ timestamp: T0 + 60_000, low: Number.NaN, high: Number.NaN }, { timestamp: T0 + 120_000, low: 5, high: 1 }],
    { executionAuthorized: true },
  );
  assert.equal(workingCount(next), 1);
});

console.log(`\nresting order reconcile: ${passed}/${passed} checks passed`);
