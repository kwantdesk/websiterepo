export type CachedLiveQuote = {
  instrument: string;
  bid: number;
  ask: number;
  mid: number;
  openPrice?: number;
  broker?: string;
  contractSymbol?: string;
  timestamp?: string | number;
  cachedAt: number;
};

const STORAGE_KEY = "kwantdesk:cme-live-quotes:v1";
const MAX_QUOTES = 40;
const DEFAULT_MAX_AGE_MS = 15 * 60_000;

function normalizeQuote(value: unknown): CachedLiveQuote | null {
  if (!value || typeof value !== "object") return null;
  const quote = value as Partial<CachedLiveQuote>;
  const instrument = typeof quote.instrument === "string" ? quote.instrument.trim() : "";
  const bid = Number(quote.bid);
  const ask = Number(quote.ask);
  const mid = Number(quote.mid);
  const cachedAt = Number(quote.cachedAt);
  if (
    !instrument
    || !Number.isFinite(mid)
    || mid <= 0
    || !Number.isFinite(cachedAt)
    || cachedAt <= 0
  ) {
    return null;
  }

  return {
    instrument,
    bid: Number.isFinite(bid) && bid > 0 ? bid : mid,
    ask: Number.isFinite(ask) && ask > 0 ? ask : mid,
    mid,
    openPrice: Number.isFinite(Number(quote.openPrice)) && Number(quote.openPrice) > 0
      ? Number(quote.openPrice)
      : mid,
    broker: typeof quote.broker === "string" ? quote.broker : "Databento",
    contractSymbol: typeof quote.contractSymbol === "string" ? quote.contractSymbol : undefined,
    timestamp: typeof quote.timestamp === "string" || typeof quote.timestamp === "number"
      ? quote.timestamp
      : cachedAt,
    cachedAt,
  };
}

export function readLiveQuoteCache(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (typeof window === "undefined") return new Map<string, CachedLiveQuote>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return new Map<string, CachedLiveQuote>();
    const cutoff = Date.now() - maxAgeMs;
    return new Map(
      parsed
        .map(normalizeQuote)
        .filter((quote): quote is CachedLiveQuote => Boolean(quote && quote.cachedAt >= cutoff))
        .map((quote) => [quote.instrument, quote]),
    );
  } catch {
    return new Map<string, CachedLiveQuote>();
  }
}

export function writeLiveQuoteCache(quotes: Iterable<{
  instrument: string;
  bid: number;
  ask: number;
  mid: number;
  openPrice?: number;
  broker?: string;
  contractSymbol?: string;
  timestamp?: string | number;
}>) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const merged = readLiveQuoteCache(Number.POSITIVE_INFINITY);
  for (const quote of quotes) {
    const normalized = normalizeQuote({ ...quote, cachedAt: now });
    if (normalized) merged.set(normalized.instrument, normalized);
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        [...merged.values()]
          .sort((left, right) => right.cachedAt - left.cachedAt)
          .slice(0, MAX_QUOTES),
      ),
    );
  } catch {
    // Live data continues normally when browser storage is unavailable.
  }
}
