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
let indexEventSource: EventSource | null = null;
let indexEventSourceKey = "";
let streamConnected = false;
const lastStreamFrameAt = new Map<string, number>();
export type MarketIndexFrameIdentity = Pick<MarketIndexLiveSnapshot, "timestamp" | "lastPrice">;
const lastDeliveredFrame = new Map<string, MarketIndexFrameIdentity>();

// Index quotes now come from the KwantData session tape (per-minute bars with
// a short server cache) after the Massive subscription ended, so polling
// faster than a few seconds only re-reads identical values.
const LIVE_POLL_MS = 4_000;
const IDLE_POLL_MS = 15_000;
const STREAM_STALE_MS = 5_000;
// QuantData is polled once on the VPS and broadcast through one shared SSE
// stream. Keep these symbols on that stream: sending every browser through the
// REST fallback both freezes the ticker behind its short client timeout and
// multiplies paid provider requests at the opening bell.
const VPS_STREAM_SYMBOLS = new Set([
  "SPX", "SPXW", "NDX",
  "SPY", "QQQ", "IWM",
  "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD",
]);

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

/**
 * Cash-index providers can publish several genuine price changes inside one
 * minute while keeping the bar's minute timestamp. Reject only an older frame
 * or an exact timestamp/price duplicate; treating every equal timestamp as a
 * duplicate froze SPX and NDX between minute boundaries.
 */
export function shouldAcceptMarketIndexFrame(
  previous: MarketIndexFrameIdentity | null | undefined,
  next: MarketIndexFrameIdentity,
) {
  if (!previous) return true;
  if (next.timestamp < previous.timestamp) return false;
  return next.timestamp !== previous.timestamp || next.lastPrice !== previous.lastPrice;
}

function deliverSnapshot(snapshot: MarketIndexLiveSnapshot, streamed = false) {
  const symbol = snapshot.symbol.trim().toUpperCase();
  const previous = lastDeliveredFrame.get(symbol);
  // A slower route fallback must never rewind a chart after a newer VPS frame
  // has already painted it. Equal timestamps remain valid when price changed.
  if (!shouldAcceptMarketIndexFrame(previous, snapshot)) return;
  lastDeliveredFrame.set(symbol, {
    timestamp: snapshot.timestamp,
    lastPrice: snapshot.lastPrice,
  });
  if (streamed) lastStreamFrameAt.set(symbol, Date.now());
  subscribers.get(symbol)?.forEach((subscriber) => subscriber.onSnapshot(snapshot));
}

function activeVpsStreamSymbols() {
  return [...subscribers.keys()].filter((symbol) => VPS_STREAM_SYMBOLS.has(symbol));
}

function restartIndexStream() {
  if (typeof window === "undefined") return;
  const symbols = activeVpsStreamSymbols();
  const key = symbols.sort().join(",");
  if (key === indexEventSourceKey && indexEventSource) return;
  indexEventSource?.close();
  indexEventSource = null;
  indexEventSourceKey = key;
  streamConnected = false;
  if (!key) return;

  const source = new EventSource(
    `/api/institutional-market-data/v1/market-data/index-stream?symbols=${encodeURIComponent(key)}`,
  );
  indexEventSource = source;
  source.addEventListener("status", (event) => {
    try {
      const status = JSON.parse((event as MessageEvent<string>).data) as { connected?: boolean };
      streamConnected = status.connected === true;
      if (!streamConnected) schedulePoll(0);
    } catch {
      streamConnected = false;
    }
  });
  source.onmessage = (event) => {
    try {
      const snapshot = JSON.parse(event.data) as unknown;
      if (!supportedSnapshot(snapshot)) return;
      streamConnected = true;
      deliverSnapshot(snapshot, true);
    } catch {
      // A malformed provider frame is isolated; EventSource remains live.
    }
  };
  source.onerror = () => {
    streamConnected = false;
    schedulePoll(0);
  };
}

async function pollMarketIndices() {
  if (pollInFlight) {
    requestedImmediatePoll = true;
    return;
  }
  const now = Date.now();
  const symbols = [...subscribers.keys()].filter((symbol) => (
    !VPS_STREAM_SYMBOLS.has(symbol)
    || !streamConnected
    || now - (lastStreamFrameAt.get(symbol) ?? 0) > STREAM_STALE_MS
  ));
  if (!subscribers.size) return;
  if (!symbols.length) {
    schedulePoll(LIVE_POLL_MS);
    return;
  }
  pollInFlight = true;
  requestedImmediatePoll = false;
  const pollStartedAt = Date.now();
  let anyLive = false;
  let requestTimeout: number | null = null;
  try {
    const requestController = new AbortController();
    requestTimeout = window.setTimeout(() => requestController.abort(), 4_000);
    const vpsSymbols = symbols.filter((symbol) => VPS_STREAM_SYMBOLS.has(symbol));
    const legacySymbols = symbols.filter((symbol) => !VPS_STREAM_SYMBOLS.has(symbol));
    const requests = [
      ...(vpsSymbols.length ? [fetch(
        `/api/institutional-market-data/v1/market-data/index-snapshot?symbols=${encodeURIComponent(vpsSymbols.join(","))}`,
        { cache: "no-store", signal: requestController.signal },
      )] : []),
      ...(legacySymbols.length ? [fetch(
        `/api/market-indices?snapshot=1&symbols=${encodeURIComponent(legacySymbols.join(","))}`,
        { cache: "no-store", signal: requestController.signal },
      )] : []),
    ];
    const responses = await Promise.all(requests);
    window.clearTimeout(requestTimeout);
    requestTimeout = null;
    const payloads = await Promise.all(responses.map(async (response) => ({
      response,
      payload: await response.json() as { snapshots?: unknown[]; error?: string },
    })));
    const failed = payloads.find(({ response }) => !response.ok);
    if (failed) throw new Error(failed.payload.error || `Options quote feed failed (${failed.response.status}).`);
    const snapshots = payloads.flatMap(({ payload }) => Array.isArray(payload.snapshots)
      ? payload.snapshots.filter(supportedSnapshot)
      : []);
    for (const snapshot of snapshots) {
      anyLive ||= snapshot.marketOpen;
      deliverSnapshot(snapshot);
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
  restartIndexStream();
  schedulePoll(0);

  return () => {
    const current = subscribers.get(normalized);
    current?.delete(subscriber);
    if (current && !current.size) subscribers.delete(normalized);
    restartIndexStream();
    if (!subscribers.size && pollTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (!subscribers.size) {
      indexEventSource?.close();
      indexEventSource = null;
      indexEventSourceKey = "";
      streamConnected = false;
      lastStreamFrameAt.clear();
      lastDeliveredFrame.clear();
    }
  };
}
