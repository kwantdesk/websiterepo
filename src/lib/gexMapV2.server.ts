import { unstable_cache } from "next/cache";

import {
  getGexMapPanel,
  QuantDataError,
  readConsolidatedTape,
  readOpenInterestByStrike,
} from "@/lib/quantData.server";
import type { GexMapExpiryScope, GexMapPanelPayload, GexMapRepresentation } from "@/lib/gexMap";
import type { ExposureStrike, OptionsFlowPrint } from "@/lib/optionsFlow";
import {
  classifyConsolidatedTape,
  type ProviderConsolidatedTrade,
  accumulateDecayedTape,
  emptyDealerInventory,
  contractKey,
  revalueDealerGex,
  priorTradingDates,
  DEALER_BOOK_CARRY_SESSIONS,
  v2Readiness,
  DEALER_FLOW_HALF_LIFE_MS,
  type DealerInventoryState,
} from "@/lib/gexMapV2";

/**
 * GEX Map v2 — the server path for the dealer-inventory model.
 *
 * v1 (getGexMapPanel) is untouched. This produces the same payload shape with a
 * different `model`, so the panel renders it without changes; only the numbers
 * differ.
 *
 * The expensive part is the tape. The provider caps the consolidated order-flow
 * endpoint at 100 rows per request and every request takes a slot in the
 * process-wide 80ms scheduler, so rebuilding a session's inventory on each
 * five-second panel refresh would be the August quota burn all over again.
 * Two things prevent that:
 *
 *   - the tape is read newest-first and bounded to TAPE_PAGE_LIMIT pages, which
 *     suits the model rather than merely capping it: with a three-hour
 *     half-life, a print from this morning already counts for a fraction of a
 *     recent one, so the newest prints are where nearly all the signal is;
 *   - the built state is cached per symbol and session so refreshes reuse it.
 *
 * What that costs in honesty is stated in the payload: `absorbedPrints` and
 * `tapeTruncated` say exactly what the book was built from, and the panel is
 * expected to surface it rather than present a partial book as a full one.
 */

/**
 * 100 rows a page.
 *
 * Measured against the reference on SPX at 2026-08-26 close, 40 pages produced
 * a book with a gross magnitude 0.54x the reference - roughly half a session's
 * inventory, which is what a truncated tape looks like. The cap is the binding
 * constraint on magnitude, not the model.
 *
 * Raised to 100 pages, 10,000 prints. The cost is bounded and paid once: the
 * built book is cached per symbol and session, so a five-second panel refresh
 * never re-reads the tape. `tapeTruncated` still reports when even this was not
 * enough rather than presenting a partial book as a whole one.
 */
const TAPE_PAGE_LIMIT = 100;

/**
 * The prior sessions' tape for the same contracts.
 *
 * A 0DTE contract is not new on its expiry day, and a book that opens flat
 * discards more flow than it keeps: from-zero at the open covered 36% of the
 * reference's strikes against 80% with three sessions carried.
 *
 * Cached for a day and keyed per session, because a completed session's tape
 * cannot change. That is what makes this affordable - the extra reads are paid
 * once per symbol and date, not on a panel refresh, and the live session's tape
 * remains the only one re-read.
 */
const readCarriedTape = (symbol: string, sessionDate: string) => unstable_cache(
  async () => {
    try {
      return (await readConsolidatedTape(symbol, sessionDate, TAPE_PAGE_LIMIT)).prints;
    } catch {
      /*
       * A missing prior session is not a failure of today's panel.
       *
       * A market holiday has no tape at all, and the provider's retention will
       * eventually end. Either way the book is simply built from less carried
       * flow, which `absorbedPrints` already reports. Failing the whole panel
       * because a session three days ago is unavailable would be worse.
       */
      return [] as OptionsFlowPrint[];
    }
  },
  ["gex-map-v2-carried-tape-v1", symbol, sessionDate],
  { revalidate: 24 * 60 * 60 },
)();

export type DealerInventoryPanelPayload = GexMapPanelPayload & {
  model: "DEALER_INVENTORY";
  readiness: ReturnType<typeof v2Readiness>;
  /** Prints that moved the book, after midpoints and unusable records dropped. */
  absorbedPrints: number;
  /** True when the page limit was hit, so older flow is not represented. */
  tapeTruncated: boolean;
  /** Oldest print the book was built from. */
  tapeFromMs: number | null;
};

/**
 * A parsed flow print in the shape the classifier reads.
 *
 * parseFlow renames the provider's fields, so this maps them back. Every
 * classifier input survives the round trip, including `tradeType` - the
 * multi-leg conditions are what identify one leg of a spread whose partners
 * offset much of the gamma it appears to add, and without them a spread leg
 * would be counted at full weight as directional positioning.
 */
function asConsolidatedTrade(print: OptionsFlowPrint): ProviderConsolidatedTrade {
  return {
    strikePrice: print.strikePrice,
    contractType: print.contractType,
    expirationDate: print.expirationDate,
    size: print.size,
    tradeSideCode: print.side,
    tradeConsolidationType: print.consolidationType,
    tradeType: print.tradeType,
    openInterest: print.openInterest,
    isOpeningPosition: print.opening,
    tradeTime: print.tradeTime,
  };
}

/**
 * Build the dealer book from the tape.
 *
 * Prints arrive newest-first and are replayed oldest-first, because the OI
 * bound is applied per step: a position that reaches the bound and then trades
 * back must be free to move again, which a bound applied to the total would not
 * allow. The book is aged to `asOfMs` between steps so an old print counts for
 * less than a recent one.
 */
function buildInventory(
  prints: readonly OptionsFlowPrint[],
  openInterest: (key: string) => number,
  sessionDate: string,
  asOfMs: number,
): { state: DealerInventoryState; absorbed: number; fromMs: number | null } {
  const classified = classifyConsolidatedTape(prints.map(asConsolidatedTrade));
  if (!classified.length) {
    return { state: emptyDealerInventory(sessionDate, asOfMs), absorbed: 0, fromMs: null };
  }
  const times = prints
    .map((print) => print.tradeTime)
    .filter((value) => Number.isFinite(value) && value > 0);
  const fromMs = times.length ? Math.min(...times) : null;

  // Age the book to each trade as it folds in. Advancing the whole tape and
  // decaying once at the end applies one factor to everything, which is a
  // global scalar and changes no relative value - the book would silently be
  // on the `carry` policy that measured actively wrong.
  const state = accumulateDecayedTape(
    emptyDealerInventory(sessionDate, fromMs ?? asOfMs),
    classified,
    openInterest,
    asOfMs,
    DEALER_FLOW_HALF_LIFE_MS,
  );
  return { state, absorbed: classified.length, fromMs };
}

async function buildDealerInventoryPanel(
  symbol: string,
  sessionDate: string,
  scope: GexMapExpiryScope,
  representation: GexMapRepresentation,
): Promise<DealerInventoryPanelPayload> {
  // The structural panel supplies spot, candles, expirations and the provider's
  // own exposure per strike. Reusing it keeps v2 on identical greeks and an
  // identical clock to v1 - if the two used different surfaces, every
  // difference between the models would be uninterpretable.
  // The structural panel first: its `expiration` decides which contracts the
  // open interest must cover, and getting that wrong silently distorts every
  // per-contract gamma this model divides out.
  const structural = await getGexMapPanel(symbol, "GAMMA", sessionDate, scope, representation);
  const carriedDates = priorTradingDates(sessionDate, DEALER_BOOK_CARRY_SESSIONS);
  const [openInterest, tape, ...carried] = await Promise.all([
    readOpenInterestByStrike(symbol, sessionDate, scope === "FRONT_EXPIRY" ? structural.expiration : null),
    readConsolidatedTape(symbol, sessionDate, TAPE_PAGE_LIMIT),
    ...carriedDates.map((date) => readCarriedTape(symbol, date)),
  ]);

  const openInterestByStrike = new Map(openInterest.map((row) => [row.strike, row]));
  const expirations = structural.expiration ? [structural.expiration] : structural.expirations;
  const asOfMs = Date.parse(structural.asOf) || Date.now();

  const oiFor = (key: string) => {
    const [, strikeText, right] = key.split("|");
    const row = openInterestByStrike.get(Number(strikeText));
    if (!row) return 0;
    return right === "call" ? row.callOpenInterest : row.putOpenInterest;
  };

  /*
   * Prior-session prints in the SAME contracts, folded in ahead of today's.
   *
   * Filtered to the panel's own expirations first: a prior session's tape is
   * mostly other expiries, and carrying them would build a book the panel never
   * draws. Sorted with today's into one time-ordered tape, because the book is
   * aged to each print as it folds in - interleaving them out of order would
   * decay the wrong ones.
   */
  const inScope = new Set(expirations);
  const prints = [...carried.flat(), ...tape.prints]
    .filter((print) => inScope.has(print.expirationDate?.slice(0, 10) ?? ""))
    .sort((left, right) => left.tradeTime - right.tradeTime);

  const { state, absorbed, fromMs } = buildInventory(prints, oiFor, sessionDate, asOfMs);

  /*
   * The contract's OWN gamma, taken from the most recent print that carried
   * one. Latest rather than first: gamma moves with spot and time, and the
   * panel is revaluing the book as it stands now, not as it stood at the
   * opening trade.
   */
  const gammaByContract = new Map<ReturnType<typeof contractKey>, number>();
  const gammaAsOf = new Map<string, number>();
  for (const print of prints) {
    const gamma = print.gamma;
    const expiration = print.expirationDate?.slice(0, 10);
    const strike = print.strikePrice;
    if (gamma === null || !expiration || strike === null) continue;
    if (print.contractType !== "CALL" && print.contractType !== "PUT") continue;
    const key = contractKey(expiration, strike, print.contractType === "CALL" ? "call" : "put");
    if ((gammaAsOf.get(key) ?? -1) >= print.tradeTime) continue;
    gammaAsOf.set(key, print.tradeTime);
    gammaByContract.set(key, Math.abs(gamma));
  }

  // Revalue the carried book against each contract's own gamma. The arithmetic
  // lives in the pure module so it is covered by test:gex-map-v2 rather than
  // only by whatever a live panel happens to exercise.
  const frame = revalueDealerGex({
    state,
    strikes: structural.latestStrikes.map((row) => row.strike),
    expirations,
    gammaByContract,
    spot: structural.stockPrice ?? 0,
    representation,
  });
  const latestStrikes: ExposureStrike[] = frame.nodes.map((node) => ({
    strike: node.strike,
    call: node.callNet,
    put: node.putNet,
    net: node.net,
  }));

  /*
   * An empty book must FAIL, not return an empty ladder.
   *
   * The panel keeps the last renderable surface while a request is in flight,
   * so an empty v2 response is silently replaced on screen by the v1 numbers
   * that were there before - identical rows under a DEALER label. That is the
   * exact confusion this model was separated to avoid, and it is invisible:
   * nothing errors, the toggle just appears to do nothing.
   */
  if (!latestStrikes.length) {
    throw new QuantDataError(
      absorbed === 0
        ? `No classified options flow is available for ${symbol} on ${sessionDate}, so no dealer book can be built.`
        : `The dealer book for ${symbol} on ${sessionDate} holds no position at any listed strike.`,
      422,
      null,
    );
  }

  return {
    ...structural,
    model: "DEALER_INVENTORY",
    readiness: v2Readiness(symbol),
    absorbedPrints: absorbed,
    tapeTruncated: tape.truncated,
    tapeFromMs: fromMs,
    latestStrikes,
    /*
     * NO FRAMES.
     *
     * These drive the change columns and replay. Passing the structural frames
     * through would put v1's history under a DEALER label beside v2's ladder -
     * the same lie as the empty-book fallback, in the one place a trader reads
     * to see how a node is BUILDING. A node whose value came from one model and
     * whose change came from another is worse than no change at all.
     *
     * Deriving them properly needs the book rebuilt at each lookback, which is
     * another tape read per window. That waits for the state to be persisted
     * rather than rebuilt, so the panel is not charged for it on every refresh.
     */
    frames: [],
    netExposure: latestStrikes.reduce((sum, row) => sum + row.net, 0),
    grossExposure: latestStrikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
  };
}

/**
 * A completed session's tape is immutable, so its book is too. The live session
 * is rebuilt on a short cycle - long enough that a five-second panel refresh
 * cannot re-read the tape, short enough that the book still tracks the day.
 */
export async function getDealerInventoryPanel(
  symbolInput: string,
  sessionDate: string,
  scope: GexMapExpiryScope,
  representation: GexMapRepresentation,
  completedSession: boolean,
): Promise<DealerInventoryPanelPayload> {
  const symbol = symbolInput.trim().toUpperCase();
  const key = ["gex-map-v2-dealer-inventory-v1", symbol, sessionDate, scope, representation];
  return unstable_cache(
    () => buildDealerInventoryPanel(symbol, sessionDate, scope, representation),
    key,
    { revalidate: completedSession ? 6 * 60 * 60 : 60 },
  )();
}
