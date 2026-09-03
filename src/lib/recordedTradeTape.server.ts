import { fetchInstitutionalMarketData } from "@/lib/institutionalMarketData.server";
import { futuresVenue } from "@/lib/futuresVenue";

/**
 * The desk's own recorded prints, for the charts that are built from prints.
 *
 * Range, volume, renko and tick bars close on price travelled or contracts
 * traded, so the path taken WITHIN a minute is exactly the information they
 * need and exactly what an OHLC bar discards - a minute-bar history cannot
 * produce them at any resolution. These paths asked the vendor for a raw
 * trades feed; that account answers 402, so the chart types had no history at
 * all.
 *
 * One reader, used by every consumer. Two copies of this parsing would drift,
 * and prints decoded slightly differently in two places produce bars that
 * disagree without either looking wrong.
 */

/** What the collector stores per print: the four fields a bar builder needs. */
export type RecordedTrade = {
  timestamp: number;
  price: number;
  /**
   * The aggressor as the feed reported it: 1 bought, -1 sold, 0 means the feed
   * did not say. Recorded rather than inferred, and a 0 must stay a 0 - a
   * guessed side is worse than an absent one.
   */
  side: number;
  size: number;
};

/**
 * "NQ.c.0" and "NQZ5" both mean the NQ book to the collector, which resolves
 * the front month itself from its own subscriptions.
 */
export function contractRootSymbol(symbol: string) {
  const upper = String(symbol || "").toUpperCase();
  // .c / .v / .n are continuous, volume and tick-bar roots respectively; all
  // three name the same book to the collector.
  const continuous = upper.match(/^([A-Z0-9]{1,3})\.[A-Z]\.\d+$/);
  if (continuous) return continuous[1];
  return upper.replace(/[A-Z]\d$/, "") || upper;
}

/** The venue that owns a futures root. Tape requests must address the file's
 * real exchange; asking CME for a CBOT/COMEX/NYMEX contract returns an honest
 * empty array that is otherwise indistinguishable from "nothing traded". */
export function exchangeForRecordedSymbol(symbol: string) {
  return futuresVenue(symbol);
}

/**
 * The gateway's own ceiling, matched here so a request is never quietly cut
 * shorter than the collector was willing to serve.
 *
 * A busy NQ session is roughly 400,000 prints, so this covers a normal
 * trading week. Range bars need every print - the geometry closes on price
 * travelled, so a thinned tape draws different bars rather than coarser ones -
 * which means the only safe way to bound a window is to cover fewer sessions,
 * never to sample within them.
 */
export const MAX_RECORDED_PRINTS = 1_500_000;
const MAX_RECORDED_TAPE_PAGES = 4;
const RECORDED_TAPE_TIMEOUT_MS = 90_000;

/**
 * The prints plus the contract they actually came from.
 *
 * Callers that record provenance need the resolved symbol: "NQ" is a root, and
 * writing it down as though it were the contract hides which book the numbers
 * describe.
 */
export async function fetchRecordedTape(args: {
  symbol: string;
  startMs: number;
  endMs: number;
  limit?: number;
}): Promise<{
  symbol: string;
  trades: RecordedTrade[];
  /**
   * The oldest print the collector could actually supply for this window, and
   * whether it had to stop short of the whole of it.
   *
   * A caller that measures a window - a value area is the price band holding a
   * share of ALL the volume in it - has to know the window was covered. Half a
   * week's prints produce a perfectly plausible weekly value area at the wrong
   * prices.
   */
  earliestMs: number | null;
  truncated: boolean;
}> {
  const end = Number.isFinite(args.endMs) && args.endMs > 0 ? args.endMs : Date.now();
  const start = Number.isFinite(args.startMs) && args.startMs > 0 ? args.startMs : end - 6 * 60 * 60_000;
  const query = new URLSearchParams({
    exchange: exchangeForRecordedSymbol(args.symbol),
    symbol: contractRootSymbol(args.symbol),
    fromMs: String(Math.round(start)),
    toMs: String(Math.round(end)),
    limit: String(args.limit ?? MAX_RECORDED_PRINTS),
  });
  // A full NQ page is intentionally large and was measured at ~33 seconds.
  // The generic 15-second gateway deadline aborted every complete event-bar
  // request, leaving the browser to display only its short live cache. Keep a
  // dedicated bounded deadline below the route's 285/300-second ceilings.
  const response = await fetchInstitutionalMarketData(
    `/v1/market-data/trade-tape?${query}`,
    {},
    RECORDED_TAPE_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text();
    /*
     * Thrown, never returned empty. An empty range chart reads as a quiet
     * market rather than a failed request, which is how the vendor outage went
     * unnoticed for as long as it did.
     */
    throw new Error(`The recorded trade tape is unavailable (${response.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    trades?: unknown; symbol?: unknown; earliestMs?: unknown; truncated?: unknown;
  };
  const rows = Array.isArray(payload.trades) ? payload.trades : [];
  const trades: RecordedTrade[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const timestamp = Number(record.timestamp);
    const price = Number(record.price);
    const size = Math.max(0, Number(record.size ?? 0));
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    if (!Number.isFinite(price) || price <= 0 || size <= 0) continue;
    trades.push({ timestamp, price, size, side: Number(record.side ?? 0) });
  }
  const earliest = Number(payload.earliestMs);
  return {
    symbol: String(payload.symbol || contractRootSymbol(args.symbol)),
    trades,
    earliestMs: Number.isFinite(earliest) && earliest > 0
      ? earliest
      : trades[0]?.timestamp ?? null,
    truncated: payload.truncated === true,
  };
}

export async function fetchRecordedTrades(args: {
  symbol: string;
  startMs: number;
  endMs: number;
  limit?: number;
}): Promise<RecordedTrade[]> {
  const pages: RecordedTrade[][] = [];
  let pageEndMs = args.endMs;
  let previousEarliest = Number.POSITIVE_INFINITY;

  for (let pageIndex = 0; pageIndex < MAX_RECORDED_TAPE_PAGES; pageIndex += 1) {
    const page = await fetchRecordedTape({ ...args, endMs: pageEndMs });
    pages.unshift(page.trades);
    if (!page.truncated || page.earliestMs === null || page.earliestMs <= args.startMs) {
      return pages.flat().sort((left, right) => left.timestamp - right.timestamp);
    }
    if (page.earliestMs >= previousEarliest || page.earliestMs >= pageEndMs) {
      throw new Error("The recorded trade tape did not advance while paging older history.");
    }
    previousEarliest = page.earliestMs;
    // The gateway retains every print sharing the cutoff millisecond, so the
    // next page can be exclusive without dropping same-timestamp executions.
    pageEndMs = page.earliestMs - 1;
  }

  throw new Error(
    `The complete execution window exceeds ${(MAX_RECORDED_TAPE_PAGES * (args.limit ?? MAX_RECORDED_PRINTS)).toLocaleString()} recorded prints.`,
  );
}
