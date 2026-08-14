import type { InstitutionalTrade } from "./institutionalMarketData";
import type { FootprintAggressorSide, FootprintTrade } from "./footprintTypes";

const finite = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function institutionalTradeToFootprintTrade(
  record: InstitutionalTrade,
  instrument: string,
  tickSize: number,
  arrivalIndex = record.recordIndex,
): FootprintTrade | null {
  const price = finite(record.close, finite(record.open));
  if (!(price > 0) || !(tickSize > 0)) return null;

  let bidVolume = Math.max(0, finite(record.bidVolume));
  let askVolume = Math.max(0, finite(record.askVolume));
  const reported = Math.max(0, finite(record.volume, bidVolume + askVolume));
  const aggressor: FootprintAggressorSide = record.aggressor === "BUY"
    ? "buy"
    : record.aggressor === "SELL"
      ? "sell"
      : "unknown";

  // Only use the explicit aggressor when the source did not already provide
  // classified Bid/Ask totals. Candle direction and price movement are never
  // used to invent classification.
  if (bidVolume + askVolume === 0) {
    if (aggressor === "buy") askVolume = reported;
    else if (aggressor === "sell") bidVolume = reported;
  }

  const size = Math.max(reported, bidVolume + askVolume);
  if (!(size > 0)) return null;
  const unknownVolume = Math.max(0, size - bidVolume - askVolume);
  const tradeCount = Math.max(1, finite(record.trades, 1));

  return {
    instrument,
    timestamp: finite(record.timestamp),
    sequence: record.eventId ?? record.recordIndex,
    arrivalIndex,
    price,
    size,
    side: aggressor,
    tickSize,
    bidVolume,
    askVolume,
    unknownVolume,
    tradeCount,
  };
}

export function orderFootprintTrades(trades: FootprintTrade[]): FootprintTrade[] {
  const unique = new Map<string, FootprintTrade>();
  for (const trade of trades) {
    const key = trade.sequence === undefined
      ? `arrival:${trade.arrivalIndex}:${trade.timestamp}:${trade.price}`
      : `sequence:${String(trade.sequence)}`;
    if (!unique.has(key)) unique.set(key, trade);
  }
  return [...unique.values()].sort((left, right) => {
    const timeDifference = left.timestamp - right.timestamp;
    if (timeDifference) return timeDifference;
    const leftSequence = String(left.sequence ?? "");
    const rightSequence = String(right.sequence ?? "");
    const sequenceDifference = leftSequence.localeCompare(rightSequence, undefined, { numeric: true });
    return sequenceDifference || left.arrivalIndex - right.arrivalIndex;
  });
}
