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
  perContractDollarGamma,
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

/** 100 rows a page, so this is 4,000 of the most recent prints. */
const TAPE_PAGE_LIMIT = 40;

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
  const [structural, openInterest, tape] = await Promise.all([
    getGexMapPanel(symbol, "GAMMA", sessionDate, scope, representation),
    readOpenInterestByStrike(symbol, sessionDate),
    readConsolidatedTape(symbol, sessionDate, TAPE_PAGE_LIMIT),
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

  const { state, absorbed, fromMs } = buildInventory(tape.prints, oiFor, sessionDate, asOfMs);

  // Revalue the carried book against the provider's current per-contract gamma.
  const latestStrikes: ExposureStrike[] = [];
  for (const row of structural.latestStrikes) {
    const oi = openInterestByStrike.get(row.strike);
    if (!oi) continue;
    const gamma = perContractDollarGamma({
      strike: row.strike,
      callExposure: row.call,
      putExposure: row.put,
      callOpenInterest: oi.callOpenInterest,
      putOpenInterest: oi.putOpenInterest,
    });
    let callContracts = 0;
    let putContracts = 0;
    for (const expiration of expirations) {
      callContracts += state.contracts[contractKey(expiration, row.strike, "call")] ?? 0;
      putContracts += state.contracts[contractKey(expiration, row.strike, "put")] ?? 0;
    }
    if (callContracts === 0 && putContracts === 0) continue;
    const call = callContracts * gamma.call;
    const put = putContracts * gamma.put;
    latestStrikes.push({ strike: row.strike, call, put, net: call + put });
  }

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
    // The change columns and replay belong to the structural frames. Deriving
    // them here would need the book rebuilt at each lookback, which is another
    // full tape read per window - left for when the state is persisted rather
    // than rebuilt, so the panel is not quietly charged for it every refresh.
    frames: structural.frames,
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
