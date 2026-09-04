import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type DeepContractEvent = {
  id: string;
  timestamp: number;
  price: number;
  top: number;
  bottom: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
};

export type DeepContractSettings = Record<string, number | string | boolean>;

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function eventFromTrade(
  trade: InstitutionalTrade,
  tickSize: number,
  boxTicks: number,
): DeepContractEvent | null {
  const timestamp = finite(trade.timestamp);
  const price = finite(trade.close);
  const volume = Math.max(0, finite(trade.volume));
  if (!(timestamp > 0) || !(price > 0) || !(volume > 0) || trade.flowOnly || trade.aggressor === "UNKNOWN") {
    return null;
  }
  const halfRange = Math.max(tickSize, boxTicks * tickSize) / 2;
  return {
    id: `deep-${trade.eventId ?? `${trade.recordIndex}-${timestamp}-${price}`}`,
    timestamp,
    price,
    top: price + halfRange,
    bottom: price - halfRange,
    volume,
    executions: Math.max(1, finite(trade.trades, 1)),
    side: trade.aggressor === "BUY" ? "ASK" : "BID",
  };
}

/**
 * Deep-contract price boxes from the exact execution tape.
 *
 * The installed Deep Charts study exposes BoxTickRange, MinFilterTrade and
 * TickMargin. Those are reproduced directly here: a real aggressive print
 * must clear the minimum, nearby same-side executions are combined inside the
 * margin, and the resulting box remains centred on the volume-weighted traded
 * price. Candle volume is never substituted for a trade.
 */
export function calculateDeepContractEvents(
  trades: readonly InstitutionalTrade[],
  settings: DeepContractSettings,
  tickSizeInput: number,
  now = Date.now(),
): DeepContractEvent[] {
  const tickSize = Math.max(Number.EPSILON, finite(tickSizeInput, 0.25));
  const boxTicks = clamp(Math.round(finite(settings.deepBoxTickRange, 4)), 1, 100);
  const minimum = clamp(finite(settings.deepMinimumTradeSize, 30), 1, 5_000);
  const margin = clamp(finite(settings.deepTickMargin, 1), 0, 100) * tickSize + Number.EPSILON;
  const clusterWindow = clamp(finite(settings.clusterWindowMs, 100), 0, 10_000);
  const days = clamp(Math.round(finite(settings.daysToLoad, 1)), 1, 30);
  const newestTimestamp = trades.reduce(
    (latest, trade) => Math.max(latest, finite(trade.timestamp)),
    0,
  ) || now;
  const anchor = now - newestTimestamp > 6 * 60 * 60_000 ? newestTimestamp : now;
  const cutoff = anchor - days * 86_400_000;
  const candidates: DeepContractEvent[] = [];
  for (const trade of trades) {
    if (finite(trade.timestamp) < cutoff) continue;
    const candidate = eventFromTrade(trade, tickSize, boxTicks);
    if (candidate) candidates.push(candidate);
  }
  candidates.sort((left, right) => left.timestamp - right.timestamp);
  const result: DeepContractEvent[] = [];

  for (const candidate of candidates) {
    const previous = result.at(-1);
    if (
      previous
      && previous.side === candidate.side
      && candidate.timestamp - previous.timestamp <= clusterWindow
      && Math.abs(candidate.price - previous.price) <= margin
    ) {
      const combined = previous.volume + candidate.volume;
      previous.price = (previous.price * previous.volume + candidate.price * candidate.volume) / combined;
      previous.volume = combined;
      previous.executions += candidate.executions;
      previous.timestamp = candidate.timestamp;
      const halfRange = Math.max(tickSize, boxTicks * tickSize) / 2;
      previous.top = previous.price + halfRange;
      previous.bottom = previous.price - halfRange;
      continue;
    }
    result.push(candidate);
  }

  return result.filter((event) => event.volume >= minimum).slice(-6_000);
}

/** Immediate O(new executions) admission between authoritative full passes. */
export function admitLiveDeepContractEvents(
  trades: readonly InstitutionalTrade[],
  afterTimestamp: number,
  settings: DeepContractSettings,
  tickSizeInput: number,
): DeepContractEvent[] {
  const tickSize = Math.max(Number.EPSILON, finite(tickSizeInput, 0.25));
  const boxTicks = clamp(Math.round(finite(settings.deepBoxTickRange, 4)), 1, 100);
  const minimum = clamp(finite(settings.deepMinimumTradeSize, 30), 1, 5_000);
  const admitted: DeepContractEvent[] = [];
  for (let index = trades.length - 1; index >= 0; index -= 1) {
    const trade = trades[index];
    if (finite(trade.timestamp) <= afterTimestamp) break;
    const event = eventFromTrade(trade, tickSize, boxTicks);
    if (event && event.volume >= minimum) admitted.push(event);
  }
  return admitted.reverse();
}

export function retainDeepContractEvents(
  previous: readonly DeepContractEvent[],
  next: readonly DeepContractEvent[],
  windowStartMs: number,
  cap = 6_000,
) {
  const merged = new Map<string, DeepContractEvent>();
  for (const event of previous) if (event.timestamp >= windowStartMs) merged.set(event.id, event);
  for (const event of next) if (event.timestamp >= windowStartMs) merged.set(event.id, event);
  const ordered = [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
  return ordered.length > cap ? ordered.slice(-cap) : ordered;
}
