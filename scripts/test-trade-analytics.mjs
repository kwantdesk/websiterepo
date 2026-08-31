import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  PLANNED_RISK_LOCK_MS, paperPlannedRiskReward, paperInitialRisk,
  placePaperOrder, processPaperQuote, emptyPaperTradingLedger,
  ensurePaperAccountLedger,
} = await import("../src/lib/paperTrading.ts");
const { calculateJournalExecutionStats } = await import("../src/lib/journal.ts");

/**
 * What a trade turned out to be, measured while it happens.
 *
 * The plan is read thirty seconds in, because the first half-minute is when a
 * trader is still nudging the stop and target into place - and because reading
 * it at the CLOSE would let a stop trailed into profit rewrite the risk the
 * trade was actually taken with, flattering every R measured against it.
 *
 * The result is written onto the FILL, since a closed position is deleted from
 * the ledger and the trader may clear their fills afterwards.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const T0 = 1_000_000;
const account = { id: "acc1", name: "Demo One", balance: 100000, leverage: "1:1" };

function openTrade({ stopLoss = 19900, takeProfit = 20200, side = "buy" } = {}) {
  let ledger = ensurePaperAccountLedger(emptyPaperTradingLedger(), account);
  const placed = placePaperOrder(ledger, [account], {
    accountId: "acc1", symbol: "NQ", side, type: "market", quantity: 1,
    stopLoss, takeProfits: takeProfit === null ? [] : [{ price: takeProfit, quantity: 1 }],
  }, { bid: 20000, ask: 20000, last: 20000, timestamp: T0 });
  assert.ok(!placed.error, `the order was rejected: ${placed.error}`);
  return placed.ledger;
}

const quote = (ledger, price, timestamp) => processPaperQuote(
  ledger, [account], "NQ",
  { bid: price, ask: price, last: price, timestamp },
  { executionAuthorized: true },
);

check("risk and reward come from the planned levels", () => {
  assert.equal(paperPlannedRiskReward(20000, 19900, 20200), 2);
  assert.equal(paperPlannedRiskReward(20000, 19950, 20050), 1);
  // A stop AT the entry risks nothing; dividing by it would report an infinite
  // reward on a trade that simply had no room in it.
  assert.equal(paperPlannedRiskReward(20000, 20000, 20200), null);
  assert.equal(paperPlannedRiskReward(20000, null, 20200), null);
  assert.equal(paperPlannedRiskReward(20000, 19900, null), null);
});

check("initial risk is the stop distance in money", () => {
  // NQ is $20 a point, so 100 points on one contract is $2,000.
  assert.equal(paperInitialRisk("NQ", 20000, 19900, 1), 2000);
  assert.equal(paperInitialRisk("NQ", 20000, 19900, 2), 4000);
  assert.equal(paperInitialRisk("NQ", 20000, null, 1), null);
  assert.equal(paperInitialRisk("NQ", 20000, 20000, 1), null);
});

check("the plan is read thirty seconds in, not at the close", () => {
  /*
   * The whole point. A stop moved to break-even after the trade worked must not
   * become the risk the trade is judged against.
   */
  assert.equal(PLANNED_RISK_LOCK_MS, 30_000);
  let ledger = openTrade();
  const before = ledger.accounts.acc1.positions[0];
  assert.equal(before.plannedStopLoss, 19900, "the plan was not seeded at entry");
  assert.equal(before.plannedLockedAt, undefined, "the plan locked immediately");

  // Trail the stop up to break-even, then let the lock pass.
  ledger = {
    ...ledger,
    accounts: {
      acc1: {
        ...ledger.accounts.acc1,
        positions: ledger.accounts.acc1.positions.map((p) => ({ ...p, stopLoss: 20000 })),
      },
    },
  };
  ledger = quote(ledger, 20050, T0 + PLANNED_RISK_LOCK_MS + 1);
  const after = ledger.accounts.acc1.positions[0];
  assert.equal(after.plannedLockedAt, T0 + PLANNED_RISK_LOCK_MS + 1);
  assert.equal(after.plannedStopLoss, 20000, "the settled stop was not taken");
});

check("the excursion follows the trade both ways", () => {
  let ledger = openTrade();
  ledger = quote(ledger, 19950, T0 + 1_000);   // against
  ledger = quote(ledger, 20120, T0 + 2_000);   // in favour
  ledger = quote(ledger, 20010, T0 + 3_000);   // back off
  const position = ledger.accounts.acc1.positions[0];
  assert.equal(position.worstPrice, 19950, "the drawdown was not remembered");
  assert.equal(position.bestPrice, 20120, "the best move was not remembered");
});

check("a display-only quote cannot invent a drawdown", () => {
  // A stale watchlist price must not record a move the trade never saw.
  let ledger = openTrade();
  ledger = processPaperQuote(
    ledger, [account], "NQ",
    { bid: 15000, ask: 15000, last: 15000, timestamp: T0 + 1_000 },
    { executionAuthorized: false },
  );
  const position = ledger.accounts.acc1.positions[0];
  assert.equal(position.worstPrice, 20000, "an unauthorised quote moved the watermark");
});

check("the finished trade is written onto the fill", () => {
  /*
   * The position is deleted the moment it closes, so anything not on the fill
   * is gone - which is also why the journal copies it across at that moment.
   */
  let ledger = openTrade();
  ledger = quote(ledger, 19950, T0 + 1_000);
  ledger = quote(ledger, 20200, T0 + PLANNED_RISK_LOCK_MS + 5_000);
  const fills = ledger.accounts.acc1.fills.filter((fill) => fill.role !== "entry");
  assert.equal(fills.length, 1, "the target did not fill");
  const [exit] = fills;
  assert.equal(exit.plannedStopLoss, 19900);
  assert.equal(exit.plannedTakeProfit, 20200);
  assert.equal(exit.plannedRiskReward, 2);
  assert.equal(exit.initialRisk, 2000);
  // 200 points at $20 = $4,000 on $2,000 of risk.
  assert.equal(exit.rMultiple, 2);
  assert.equal(exit.adverseExcursion, -1000, "the 50-point drawdown was not valued");
  assert.ok(exit.favourableExcursion >= 4000);
  assert.ok(exit.holdMs >= PLANNED_RISK_LOCK_MS);
});

check("a trade with no stop reports no R rather than zero", () => {
  // Zero would read as a scratch. There is simply no R to be a multiple of.
  let ledger = openTrade({ stopLoss: null });
  ledger = quote(ledger, 20200, T0 + PLANNED_RISK_LOCK_MS + 1_000);
  const exit = ledger.accounts.acc1.fills.find((fill) => fill.role !== "entry");
  assert.equal(exit.initialRisk, null);
  assert.equal(exit.rMultiple, null);
  assert.equal(exit.plannedRiskReward, null);
});

check("the journal statistics ignore what nothing supports", () => {
  /*
   * An imported broker trade has no excursion - nobody watched it tick by tick.
   * Averaging that in as zero would drag every number toward it.
   */
  const trades = [
    { netPnl: 100, durationMs: 60_000, adverseExcursion: -50, favourableExcursion: 200, plannedRiskReward: 2 },
    { netPnl: -50, durationMs: 120_000, adverseExcursion: -150, favourableExcursion: 40, plannedRiskReward: 3 },
    { netPnl: 25, durationMs: null, adverseExcursion: null, favourableExcursion: null, plannedRiskReward: null },
  ];
  const stats = calculateJournalExecutionStats(trades);
  assert.equal(stats.averageHoldMs, 90_000, "a missing hold time was counted");
  assert.equal(stats.averageAdverseExcursion, -100);
  assert.equal(stats.averageFavourableExcursion, 120);
  assert.equal(stats.averagePlannedRiskReward, 2.5);
  // Favourable reach over adverse reach: 120 / 100.
  assert.equal(stats.edgeRatio, 1.2);
});

check("adverse excursion is never reported as a gain", () => {
  const stats = calculateJournalExecutionStats([
    { netPnl: 10, durationMs: 1_000, adverseExcursion: -20, favourableExcursion: 30, plannedRiskReward: 1 },
  ]);
  assert.ok(stats.averageAdverseExcursion <= 0, `drawdown reported as ${stats.averageAdverseExcursion}`);
});

check("capture is measured only where there was something to capture", () => {
  /*
   * A trade whose best moment was its entry had nothing to give back. Scoring
   * it zero would say the trader let a winner go when no winner existed.
   */
  const stats = calculateJournalExecutionStats([
    { netPnl: 50, durationMs: 1_000, adverseExcursion: -10, favourableExcursion: 100, plannedRiskReward: 1 },
    { netPnl: -30, durationMs: 1_000, adverseExcursion: -40, favourableExcursion: 0, plannedRiskReward: 1 },
  ]);
  assert.equal(stats.captureRate, 0.5, "the flat trade was averaged into capture");
});

check("empty input answers nothing rather than zero", () => {
  const stats = calculateJournalExecutionStats([]);
  for (const [key, value] of Object.entries(stats)) {
    assert.equal(value, null, `${key} invented a value from no trades`);
  }
});

check("the journal shows all eight, and carries the trade's own numbers", () => {
  const journal = readFileSync(
    new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8",
  );
  for (const label of [
    "Avg hold time", "Avg hold · winners", "Avg hold · losers",
    "Avg adverse excursion", "Avg favourable excursion",
    "Avg planned R : R", "Capture rate", "Edge ratio",
  ]) {
    assert.ok(journal.includes(`label="${label}"`), `missing card: ${label}`);
  }

  const bridge = readFileSync(new URL("../src/lib/paperJournal.ts", import.meta.url), "utf8");
  for (const field of [
    "initialRisk: fill.initialRisk", "rMultiple: fill.rMultiple",
    "adverseExcursion: fill.adverseExcursion", "favourableExcursion: fill.favourableExcursion",
    "plannedRiskReward: fill.plannedRiskReward", "durationMs: fill.holdMs",
  ]) {
    assert.ok(bridge.includes(field), `the journal discards ${field}`);
  }
});

console.log(`\ntrade analytics: ${passed}/${passed} checks passed`);
