import { unstable_cache } from "next/cache";
import { after } from "next/server";

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
 * One read per key at a time, however many callers ask for it.
 *
 * `unstable_cache` shares a RESULT once it has one; it does not share a
 * computation still in flight. Every panel rebuild therefore started its own
 * full-session read - fifty-plus pages against an allowance of roughly twenty
 * requests per window - abandoned it at the budget, and started another one
 * sixty seconds later. The reads piled up, competed with each other, and the
 * warm-up they were performing never finished: measured, the book was still
 * reporting zero carried sessions after several minutes.
 *
 * Joining the in-flight promise makes the warm-up converge, and is the same
 * coalescing the provider client already does for individual requests.
 */
/** A completed session's tape cannot change; the live one keeps growing. */
const CARRIED_TAPE_MEMO_MS = 24 * 60 * 60_000;
const LIVE_TAPE_MEMO_MS = 60_000;

const inFlightReads = new Map<string, Promise<unknown>>();

/**
 * And the finished result, held in this instance's own memory.
 *
 * `unstable_cache` does not commit a result computed after the response has
 * gone - which is exactly what a warm-up handed to `after()` is. Measured: the
 * background read completed, the next rebuild sixty seconds later still found
 * nothing cached, and the book reported zero carried sessions indefinitely. The
 * warm-up ran forever and delivered nothing.
 *
 * So the result is memoised here as it resolves. `unstable_cache` is still
 * wrapped around the read for the cross-instance case, where it works; this is
 * what makes the warm-up actually converge on the instance that performed it.
 */
const completedReads = new Map<string, { at: number; value: unknown }>();
const COMPLETED_READ_LIMIT = 64;

function joinInFlight<T>(key: string, start: () => Promise<T>, memoMs: number): Promise<T> {
  const done = completedReads.get(key);
  if (done && Date.now() - done.at < memoMs) return Promise.resolve(done.value as T);
  const existing = inFlightReads.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = start()
    .then((value) => {
      completedReads.set(key, { at: Date.now(), value });
      if (completedReads.size > COMPLETED_READ_LIMIT) {
        const oldest = completedReads.keys().next().value;
        if (oldest !== undefined) completedReads.delete(oldest);
      }
      return value;
    })
    .finally(() => { inFlightReads.delete(key); });
  inFlightReads.set(key, promise);
  return promise;
}

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
const readCarriedTape = (symbol: string, sessionDate: string) => joinInFlight(
  `carried:${symbol}:${sessionDate}`,
  () => unstable_cache(
    async () => {
      try {
        return (await readConsolidatedTape(symbol, sessionDate, TAPE_PAGE_LIMIT, "background")).prints;
      } catch {
        /*
         * A missing prior session is not a failure of today's panel.
         *
         * A market holiday has no tape at all, and the provider's retention
         * will eventually end. Either way the book is simply built from less
         * carried flow, which `carriedSessions` reports. Failing the whole
         * panel because a session three days ago is unavailable would be worse.
         */
        return [] as OptionsFlowPrint[];
      }
    },
    ["gex-map-v2-carried-tape-v1", symbol, sessionDate],
    { revalidate: 24 * 60 * 60 },
  )(),
  CARRIED_TAPE_MEMO_MS,
);


/**
 * How many pages the panel will read on the request path before drawing.
 *
 * A full session is around seventy pages and takes twenty-one seconds against
 * the provider's allowance - a trader clicking DEALER should not watch that.
 * The tape is read NEWEST first and the book decays with a twelve-hour
 * half-life, so the first twelve pages carry the most heavily weighted flow
 * there is. That is a partial book, and `tapeTruncated` says so rather than
 * presenting it as the whole session.
 *
 * The complete read runs behind it on the background lane, and the refresh
 * after it finishes draws the full book.
 */
const FIRST_PAINT_PAGE_LIMIT = 12;

/** Warm-ups already scheduled, so a refresh cannot stack duplicates. */
const carriedTapeBuilds = new Set<string>();

/**
 * Hand work to the platform so it survives the response, and never twice.
 *
 * MUST be called from the request scope, never from inside `unstable_cache`.
 * Registered from within a cached computation, `after` attaches to a scope that
 * never flushes and the work is torn down with it - measured, the read simply
 * never finished, the memo below never filled, and the book reported zero
 * carried sessions indefinitely while appearing to be warming.
 *
 * Outside a request scope - a warm-up, a script - there is nothing to defer
 * past, so it simply runs.
 */
function warmInBackground(key: string, work: Promise<unknown>) {
  if (carriedTapeBuilds.has(key)) return;
  carriedTapeBuilds.add(key);
  const settle = () => work
    // A warm-up that fails every time is indistinguishable from one that is
    // merely slow: the book just stays thin forever. Say so once per attempt.
    .catch((error) => { console.warn(`[gex-map-v2] warm-up failed for ${key}`, error); })
    .finally(() => { carriedTapeBuilds.delete(key); });
  try { after(settle); } catch { void settle(); }
}

/**
 * The whole live session, read once a minute at most.
 *
 * This is what makes the steady state cheap: a five-second panel refresh reuses
 * it rather than re-reading fifty-odd pages. The first click of a session is
 * the one with nothing to reuse, and that is the click the page limit above
 * exists for.
 */
const fullLiveTape = (symbol: string, sessionDate: string) => joinInFlight(
  `live:${symbol}:${sessionDate}`,
  () => unstable_cache(
    () => readConsolidatedTape(symbol, sessionDate, TAPE_PAGE_LIMIT, "background"),
    ["gex-map-v2-live-tape-v1", symbol, sessionDate],
    { revalidate: 60 },
  )(),
  LIVE_TAPE_MEMO_MS,
);

/** A finished read, if this instance has one that is still good. */
function warmRead<T>(key: string, memoMs: number): T | null {
  const done = completedReads.get(key);
  return done && Date.now() - done.at < memoMs ? (done.value as T) : null;
}

/**
 * The live session's tape: the whole thing if it is already warm, the most
 * recent pages if it is not.
 *
 * No waiting and no racing. The builder runs inside a cache, and anything it
 * blocks on is time the trader spends watching a spinner - so it takes what is
 * warm or reads a bounded slice, and the warm-up that fills the gap is started
 * from the request scope by getDealerInventoryPanel.
 */
async function readTapeForFirstPaint(symbol: string, sessionDate: string) {
  const warm = warmRead<Awaited<ReturnType<typeof readConsolidatedTape>>>(
    `live:${symbol}:${sessionDate}`,
    LIVE_TAPE_MEMO_MS,
  );
  if (warm) return warm;
  // Foreground lane deliberately: this IS the request the trader is waiting on.
  const recent = await readConsolidatedTape(symbol, sessionDate, FIRST_PAINT_PAGE_LIMIT);
  return { ...recent, truncated: true };
}

/**
 * The prior session's prints if they are ready, and nothing if they are not.
 *
 * The panel is honest about it in the meantime: `carriedSessions` says how many
 * of the prior sessions are actually in the book, so a thin ladder is never
 * presented as a complete one.
 */
function carriedTapeIfWarm(symbol: string, sessionDate: string): OptionsFlowPrint[] {
  return warmRead<OptionsFlowPrint[]>(`carried:${symbol}:${sessionDate}`, CARRIED_TAPE_MEMO_MS) ?? [];
}

/**
 * Start every read the book wants but will not wait for.
 *
 * Called from the request scope so `after` has a scope that actually flushes,
 * and outside the panel's cache so the work is not torn down when the cached
 * computation returns.
 */
export function warmDealerBookTapes(symbol: string, sessionDate: string) {
  warmInBackground(`live:${symbol}:${sessionDate}`, fullLiveTape(symbol, sessionDate));
  for (const date of priorTradingDates(sessionDate, DEALER_BOOK_CARRY_SESSIONS)) {
    warmInBackground(`carried:${symbol}:${date}`, readCarriedTape(symbol, date));
  }
}

export type DealerInventoryPanelPayload = GexMapPanelPayload & {
  model: "DEALER_INVENTORY";
  readiness: ReturnType<typeof v2Readiness>;
  /** Prints that moved the book, after midpoints and unusable records dropped. */
  absorbedPrints: number;
  /** True when the page limit was hit, so older flow is not represented. */
  tapeTruncated: boolean;
  /** Oldest print the book was built from. */
  tapeFromMs: number | null;
  /**
   * How many prior sessions of the same contracts are in the book, out of
   * DEALER_BOOK_CARRY_SESSIONS. Below that the ladder is thinner than it will
   * be once the remaining tapes finish reading in the background.
   */
  carriedSessions: number;
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
    readTapeForFirstPaint(symbol, sessionDate),
    // Bounded: today's tape is what the panel cannot draw without. The prior
    // sessions only deepen it, so they are never allowed to hold up the draw.
    ...carriedDates.map((date) => carriedTapeIfWarm(symbol, date)),
  ]);
  const carriedSessions = carried.filter((prints) => prints.length > 0).length;

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
    carriedSessions,
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
  /*
   * Started HERE, in the request scope, and deliberately not awaited.
   *
   * Inside the cached builder below, `after` attaches to a scope that never
   * flushes and the work is torn down with the computation - measured, the read
   * never finished and the book reported zero carried sessions indefinitely
   * while appearing to warm. Out here it survives the response, so the refresh
   * after it lands draws the full book.
   */
  warmDealerBookTapes(symbol, sessionDate);
  const key = ["gex-map-v2-dealer-inventory-v1", symbol, sessionDate, scope, representation];
  return unstable_cache(
    () => buildDealerInventoryPanel(symbol, sessionDate, scope, representation),
    key,
    { revalidate: completedSession ? 6 * 60 * 60 : 60 },
  )();
}
