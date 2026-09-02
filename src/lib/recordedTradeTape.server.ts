import { fetchInstitutionalMarketData } from "@/lib/institutionalMarketData.server";

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

export async function fetchRecordedTrades(args: {
  symbol: string;
  startMs: number;
  endMs: number;
  limit?: number;
}): Promise<RecordedTrade[]> {
  const end = Number.isFinite(args.endMs) && args.endMs > 0 ? args.endMs : Date.now();
  const start = Number.isFinite(args.startMs) && args.startMs > 0 ? args.startMs : end - 6 * 60 * 60_000;
  const query = new URLSearchParams({
    exchange: "CME",
    symbol: contractRootSymbol(args.symbol),
    fromMs: String(Math.round(start)),
    toMs: String(Math.round(end)),
    limit: String(args.limit ?? 500_000),
  });
  const response = await fetchInstitutionalMarketData(`/v1/market-data/trade-tape?${query}`);
  if (!response.ok) {
    const detail = await response.text();
    /*
     * Thrown, never returned empty. An empty range chart reads as a quiet
     * market rather than a failed request, which is how the vendor outage went
     * unnoticed for as long as it did.
     */
    throw new Error(`The recorded trade tape is unavailable (${response.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await response.json()) as { trades?: unknown };
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
  return trades;
}
