export type MarketIndexLiveSnapshot = {
  symbol: string;
  lastPrice: number;
  openPrice?: number;
  change?: number;
  changePercent?: number;
  timestamp: number;
  marketOpen: boolean;
  delayed?: boolean;
  provider?: string;
};

type SnapshotListener = (snapshot: MarketIndexLiveSnapshot) => void;
type ErrorListener = (error: Error) => void;
type Subscriber = { onSnapshot: SnapshotListener; onError?: ErrorListener };

const subscribers = new Map<string, Set<Subscriber>>();
let pollTimer: number | null = null;
let pollInFlight = false;
let requestedImmediatePoll = false;
let lastSuccessfulPollHadLiveMarket = false;

const LIVE_POLL_MS = 750;
const IDLE_POLL_MS = 5_000;

function supportedSnapshot(value: unknown): value is MarketIndexLiveSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketIndexLiveSnapshot>;
  return typeof candidate.symbol === "string"
    && typeof candidate.lastPrice === "number"
    && Number.isFinite(candidate.lastPrice)
    && candidate.lastPrice > 0
    && typeof candidate.timestamp === "number"
    && Number.isFinite(candidate.timestamp)
    && typeof candidate.marketOpen === "boolean";
}

function schedulePoll(delay: number) {
  if (typeof window === "undefined" || !subscribers.size) return;
  if (pollTimer !== null) window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(() => {
    pollTimer = null;
    void pollMarketIndices();
  }, Math.max(0, delay));
}

async function pollMarketIndices() {
  if (pollInFlight) {
    requestedImmediatePoll = true;
    return;
  }
  const symbols = [...subscribers.keys()];
  if (!symbols.length) return;
  pollInFlight = true;
  requestedImmediatePoll = false;
  const pollStartedAt = Date.now();
  let anyLive = false;
  let requestTimeout: number | null = null;
  try {
    const requestController = new AbortController();
    requestTimeout = window.setTimeout(() => requestController.abort(), 4_000);
    const response = await fetch(
      `/api/market-indices?snapshot=1&symbols=${encodeURIComponent(symbols.join(","))}`,
      { cache: "no-store", signal: requestController.signal },
    );
    window.clearTimeout(requestTimeout);
    requestTimeout = null;
    const payload = await response.json() as { snapshots?: unknown[]; error?: string };
    if (!response.ok) throw new Error(payload.error || `Options quote feed failed (${response.status}).`);
    const snapshots = Array.isArray(payload.snapshots)
      ? payload.snapshots.filter(supportedSnapshot)
      : [];
    for (const snapshot of snapshots) {
      const symbol = snapshot.symbol.trim().toUpperCase();
      anyLive ||= snapshot.marketOpen;
      subscribers.get(symbol)?.forEach((subscriber) => subscriber.onSnapshot(snapshot));
    }
    if (snapshots.length) lastSuccessfulPollHadLiveMarket = anyLive;
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error("Options quote feed is unavailable.");
    subscribers.forEach((rows) => rows.forEach((subscriber) => subscriber.onError?.(normalized)));
  } finally {
    if (requestTimeout !== null) window.clearTimeout(requestTimeout);
    pollInFlight = false;
    if (subscribers.size) {
      const targetCadence = anyLive || lastSuccessfulPollHadLiveMarket
        ? LIVE_POLL_MS
        : IDLE_POLL_MS;
      schedulePoll(
        requestedImmediatePoll
          ? 0
          // Keep the cadence start-to-start. Waiting another full interval
          // after the network response made a 500ms request behave like a
          // 1.25s feed even though LIVE_POLL_MS is 750ms.
          : Math.max(0, targetCadence - (Date.now() - pollStartedAt)),
      );
    }
  }
}

/**
 * Every visible options chart shares one batched browser request. Subscribers
 * still receive each honest provider frame immediately; no prices are
 * interpolated or fabricated between upstream updates.
 */
export function subscribeMarketIndexSnapshot(
  symbol: string,
  onSnapshot: SnapshotListener,
  onError?: ErrorListener,
) {
  const normalized = symbol.trim().toUpperCase();
  const subscriber = { onSnapshot, onError };
  const rows = subscribers.get(normalized) ?? new Set<Subscriber>();
  rows.add(subscriber);
  subscribers.set(normalized, rows);
  schedulePoll(0);

  return () => {
    const current = subscribers.get(normalized);
    current?.delete(subscriber);
    if (current && !current.size) subscribers.delete(normalized);
    if (!subscribers.size && pollTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
  };
}
