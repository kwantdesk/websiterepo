"use client";

import type {
  RithmicLiquiditySnapshot,
  RithmicOrderLifecycleEvent,
  TrackedLiquidityLevel,
} from "@/lib/structureLevels";

export type RithmicLiquidityStatus = "checking" | "connected" | "unavailable";

type Subscriber = {
  onSnapshot: (snapshot: RithmicLiquiditySnapshot) => void;
  onStatus?: (status: RithmicLiquidityStatus) => void;
  replayHistory?: boolean;
};

type RawPayload = {
  status?: {
    connected?: boolean;
    fullDepth?: boolean;
    bookValid?: boolean;
    contractSymbol?: string;
    individualOrders?: boolean;
  };
  snapshot?: {
    id?: number;
    timestamp?: number;
    tickSize?: number;
    bids?: unknown;
    asks?: unknown;
    bestBid?: number;
    bestAsk?: number;
    lastTick?: number;
    microTick?: number;
    imbalance?: { bid?: number; ask?: number; ratio?: number };
    trades?: unknown;
    latencyMs?: number | null;
    fullDepth?: boolean;
    bookValid?: boolean;
    contractSymbol?: string;
    individualOrders?: boolean;
    orderEvents?: unknown;
  };
  error?: string;
};

type Tracker = TrackedLiquidityLevel & {
  firstSeenAt: number;
  lastSeenAt: number;
  lastSize: number;
};

type SharedPoll = {
  subscribers: Set<Subscriber>;
  trackers: Map<string, Tracker>;
  status: RithmicLiquidityStatus;
  timer: number | null;
  watchdog: number | null;
  eventSource: EventSource | null;
  latestSnapshot: RithmicLiquiditySnapshot | null;
  lastActivityAt: number;
  generation: number;
  root: string;
  contractSymbol: string;
  exchange: string;
  pendingDepth: RawPayload | null;
  pendingTrades: unknown[];
  pendingOrderEvents: unknown[];
  pendingTick: {
    timestamp?: number;
    tick?: number;
    contractSymbol?: string;
  } | null;
  publishHandle: number | null;
  publishMode: "animation-frame" | "timeout" | null;
};

const streams = new Map<string, SharedPoll>();
const INITIAL_BOOK_TIMEOUT_MS = 8_000;
const STREAM_STALE_TIMEOUT_MS = 15_000;
const STREAM_WATCHDOG_INTERVAL_MS = 3_000;
// The gateway can produce hundreds of book mutations between two browser
// paints. Materialising an 800-row book for every mutation made allocation
// rate proportional to exchange traffic and eventually killed Chrome's
// renderer during live sessions. Keep every trade/lifecycle event, but emit
// only the newest authoritative book once the browser can actually paint it.
const MAX_PENDING_MARKET_EVENTS = 50_000;

function publishStatus(stream: SharedPoll, status: RithmicLiquidityStatus) {
  if (stream.status === status) return;
  stream.status = status;
  stream.subscribers.forEach((subscriber) => subscriber.onStatus?.(status));
}

function decodeRows(value: unknown, side: "BID" | "ASK", tickSize: number) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Array<{ side: "BID" | "ASK"; price: number; size: number; orders: number; largestOrder: number | null }> => {
    if (!Array.isArray(item) || item.length < 2) return [];
    const tick = Number(item[0]);
    const size = Number(item[1]);
    const orders = Number(item[2] ?? 0);
    const largestOrder = item[3] == null ? null : Number(item[3]);
    if (![tick, size, orders].every(Number.isFinite) || size <= 0) return [];
    return [{ side, price: tick * tickSize, size, orders, largestOrder: largestOrder !== null && Number.isFinite(largestOrder) ? Math.max(0, largestOrder) : null }];
  });
}

function updateTrackers(
  stream: SharedPoll,
  payload: RawPayload,
  recipients: Iterable<Subscriber> = stream.subscribers,
) {
  const now = Date.now();
  const tickSize = Number(payload.snapshot?.tickSize ?? 0.25) || 0.25;
  const rows = [
    ...decodeRows(payload.snapshot?.bids, "BID", tickSize),
    ...decodeRows(payload.snapshot?.asks, "ASK", tickSize),
  ];
  const active = new Set<string>();
  for (const row of rows) {
    const key = `${row.side}:${Math.round(row.price / tickSize)}`;
    active.add(key);
    const previous = stream.trackers.get(key);
    if (!previous) {
      stream.trackers.set(key, {
        ...row,
        emaSize: row.size,
        peakSize: row.size,
        observations: 1,
        stableObservations: 1,
        persistenceMs: 0,
        addedSize: row.size,
        removedSize: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        lastSize: row.size,
      });
      continue;
    }
    const delta = row.size - previous.lastSize;
    const stable = Math.abs(delta) / Math.max(1, previous.lastSize) <= 0.2;
    Object.assign(previous, {
      ...row,
      emaSize: previous.emaSize * 0.78 + row.size * 0.22,
      peakSize: Math.max(previous.peakSize, row.size),
      observations: previous.observations + 1,
      stableObservations: previous.stableObservations + (stable ? 1 : 0),
      persistenceMs: now - previous.firstSeenAt,
      addedSize: previous.addedSize + Math.max(0, delta),
      removedSize: previous.removedSize + Math.max(0, -delta),
      lastSeenAt: now,
      lastSize: row.size,
    });
  }

  for (const [key, tracker] of stream.trackers) {
    if (active.has(key)) continue;
    if (tracker.lastSize > 0) tracker.removedSize += tracker.lastSize;
    tracker.lastSize = 0;
    tracker.size = 0;
    if (now - tracker.lastSeenAt > 30_000) stream.trackers.delete(key);
  }

  const timestamp = Number(payload.snapshot?.timestamp ?? now);
  const decodeTrade = (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const trade = value as Record<string, unknown>;
    const tick = Number(trade.tick);
    const size = Number(trade.size);
    const tradeTimestamp = Number(trade.timestamp ?? timestamp);
    if (![tick, size, tradeTimestamp].every(Number.isFinite) || size <= 0) return null;
    return {
      id: Number(trade.id ?? tradeTimestamp),
      timestamp: tradeTimestamp,
      price: tick * tickSize,
      size,
      side: trade.side === "sell" ? "SELL" as const : "BUY" as const,
    };
  };
  const trades = Array.isArray(payload.snapshot?.trades)
    ? payload.snapshot.trades.flatMap((trade) => {
        const decoded = decodeTrade(trade);
        return decoded ? [decoded] : [];
      })
    : [];
  const orderEvents = Array.isArray(payload.snapshot?.orderEvents)
    ? payload.snapshot.orderEvents.flatMap((value): RithmicOrderLifecycleEvent[] => {
        if (!value || typeof value !== "object") return [];
        const event = value as Record<string, unknown>;
        const action = String(event.action || "").toUpperCase();
        const side = String(event.side || "").toUpperCase();
        const price = Number(event.price);
        const previousPrice = event.previousPrice == null ? null : Number(event.previousPrice);
        const size = Number(event.size);
        const previousSize = Number(event.previousSize);
        const eventTimestamp = Number(event.timestamp ?? payload.snapshot?.timestamp ?? timestamp);
        if (
          ![price, size, previousSize, eventTimestamp].every(Number.isFinite)
          || !["ADD", "MODIFY", "REMOVE"].includes(action)
          || !["BID", "ASK"].includes(side)
        ) return [];
        return [{
          sequence: Number(event.sequence) || 0,
          timestamp: eventTimestamp,
          orderId: String(event.orderId || ""),
          action: action as RithmicOrderLifecycleEvent["action"],
          side: side as RithmicOrderLifecycleEvent["side"],
          price,
          previousPrice: previousPrice !== null && Number.isFinite(previousPrice) ? previousPrice : null,
          size,
          previousSize,
        }];
      })
    : [];
  const bestBidTick = Number(payload.snapshot?.bestBid);
  const bestAskTick = Number(payload.snapshot?.bestAsk);
  const lastTick = Number(payload.snapshot?.lastTick);
  const microTick = Number(payload.snapshot?.microTick);
  const snapshot: RithmicLiquiditySnapshot = {
    asOf: new Date(Number.isFinite(timestamp) ? timestamp : now).toISOString(),
    contractSymbol: String(payload.status?.contractSymbol || payload.snapshot?.contractSymbol || stream.contractSymbol || stream.root),
    tickSize,
    fullDepth: Boolean(payload.status?.fullDepth ?? payload.snapshot?.fullDepth),
    bookValid: Boolean(payload.status?.bookValid ?? payload.snapshot?.bookValid),
    individualOrders: Boolean(payload.status?.individualOrders ?? payload.snapshot?.individualOrders),
    ageMs: payload.snapshot?.latencyMs == null ? null : Number(payload.snapshot.latencyMs),
    bestBid: Number.isFinite(bestBidTick) && bestBidTick > 0 ? bestBidTick * tickSize : null,
    bestAsk: Number.isFinite(bestAskTick) && bestAskTick > 0 ? bestAskTick * tickSize : null,
    lastPrice: Number.isFinite(lastTick) && lastTick > 0 ? lastTick * tickSize : null,
    microPrice: Number.isFinite(microTick) && microTick > 0 ? microTick * tickSize : null,
    bidDepth: Number(payload.snapshot?.imbalance?.bid ?? 0) || 0,
    askDepth: Number(payload.snapshot?.imbalance?.ask ?? 0) || 0,
    trades,
    orderEvents,
    levels: [...stream.trackers.values()]
      .filter((tracker) => tracker.size > 0)
      .map(({ firstSeenAt: _firstSeenAt, lastSeenAt: _lastSeenAt, lastSize: _lastSize, ...tracker }) => tracker),
  };
  stream.latestSnapshot = snapshot;
  for (const subscriber of recipients) subscriber.onSnapshot(snapshot);
}

function appendBounded(target: unknown[], value: unknown) {
  if (!Array.isArray(value) || !value.length) return;
  for (const item of value) target.push(item);
  if (target.length > MAX_PENDING_MARKET_EVENTS) {
    target.splice(0, target.length - MAX_PENDING_MARKET_EVENTS);
  }
}

function cancelScheduledPublish(stream: SharedPoll) {
  if (stream.publishHandle === null) return;
  if (stream.publishMode === "animation-frame") {
    window.cancelAnimationFrame(stream.publishHandle);
  } else {
    window.clearTimeout(stream.publishHandle);
  }
  stream.publishHandle = null;
  stream.publishMode = null;
}

function flushPendingMarketFrame(stream: SharedPoll) {
  stream.publishHandle = null;
  stream.publishMode = null;

  const pendingDepth = stream.pendingDepth;
  const pendingTick = stream.pendingTick;
  stream.pendingDepth = null;
  stream.pendingTick = null;

  if (pendingDepth?.snapshot) {
    const trades = stream.pendingTrades;
    const orderEvents = stream.pendingOrderEvents;
    stream.pendingTrades = [];
    stream.pendingOrderEvents = [];
    const tick = Number(pendingTick?.tick);
    const tickTimestamp = Number(pendingTick?.timestamp);
    updateTrackers(stream, {
      status: pendingDepth.status,
      snapshot: {
        ...pendingDepth.snapshot,
        trades,
        orderEvents,
        ...(Number.isFinite(tick) && tick > 0 ? { lastTick: tick } : {}),
        ...(Number.isFinite(tickTimestamp) && tickTimestamp > 0 ? { timestamp: tickTimestamp } : {}),
        ...(pendingTick?.contractSymbol ? { contractSymbol: pendingTick.contractSymbol } : {}),
      },
    });
    return;
  }

  stream.pendingTrades = [];
  stream.pendingOrderEvents = [];
  const tick = Number(pendingTick?.tick);
  if (!stream.latestSnapshot || !Number.isFinite(tick) || tick <= 0) return;
  const snapshot: RithmicLiquiditySnapshot = {
    ...stream.latestSnapshot,
    asOf: new Date(Number(pendingTick?.timestamp) || Date.now()).toISOString(),
    contractSymbol: String(pendingTick?.contractSymbol || stream.latestSnapshot.contractSymbol),
    lastPrice: tick * stream.latestSnapshot.tickSize,
    ageMs: 0,
    // A price-only update must never replay the last trade batch into detector
    // engines. The immutable book rows are intentionally shared until the next
    // depth frame instead of being cloned for every tick.
    trades: [],
    orderEvents: [],
  };
  stream.latestSnapshot = snapshot;
  for (const subscriber of stream.subscribers) subscriber.onSnapshot(snapshot);
}

function scheduleMarketFrame(stream: SharedPoll) {
  if (stream.publishHandle !== null) return;
  if (document.visibilityState === "hidden") {
    stream.publishMode = "timeout";
    stream.publishHandle = window.setTimeout(() => flushPendingMarketFrame(stream), 100);
    return;
  }
  stream.publishMode = "animation-frame";
  stream.publishHandle = window.requestAnimationFrame(() => flushPendingMarketFrame(stream));
}

function queueDepthFrame(stream: SharedPoll, payload: RawPayload) {
  const { trades, orderEvents, ...snapshot } = payload.snapshot ?? {};
  const previous = stream.pendingDepth;
  stream.pendingDepth = {
    status: { ...previous?.status, ...payload.status },
    snapshot: { ...previous?.snapshot, ...snapshot },
  };
  appendBounded(stream.pendingTrades, trades);
  appendBounded(stream.pendingOrderEvents, orderEvents);
  scheduleMarketFrame(stream);
}

function clearWatchdog(stream: SharedPoll) {
  if (stream.watchdog !== null) window.clearInterval(stream.watchdog);
  stream.watchdog = null;
}

function markStreamActivity(stream: SharedPoll) {
  stream.lastActivityAt = Date.now();
}

function scheduleReconnect(stream: SharedPoll, delayMs = 1_000) {
  if (!stream.subscribers.size || stream.timer !== null) return;
  stream.timer = window.setTimeout(() => {
    stream.timer = null;
    connectStream(stream);
  }, delayMs);
}

function connectStream(stream: SharedPoll) {
  if (stream.eventSource || !stream.subscribers.size) return;
  const generation = ++stream.generation;
  const query = new URLSearchParams({
    exchange: stream.exchange,
    symbol: stream.root,
    depthTicks: "800",
    includeOrderEvents: "1",
  });
  if (stream.contractSymbol) query.set("contractSymbol", stream.contractSymbol);
  const source = new EventSource(`/api/institutional-market-data/v1/heatmap/stream?${query}`);
  stream.eventSource = source;
  markStreamActivity(stream);
  source.addEventListener("depth", (event) => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as RawPayload;
      markStreamActivity(stream);
      queueDepthFrame(stream, payload);
      publishStatus(stream, payload.status?.connected ? "connected" : "checking");
    } catch {
      publishStatus(stream, "unavailable");
    }
  });
  source.addEventListener("history", (event) => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        status?: RawPayload["status"];
        snapshots?: RawPayload["snapshot"][];
        final?: boolean;
      };
      const snapshots = payload.snapshots ?? [];
      markStreamActivity(stream);
      // Preserve event ordering if a live mutation happened immediately before
      // a retained-history packet during reconnect.
      if (stream.pendingDepth || stream.pendingTick) {
        cancelScheduledPublish(stream);
        flushPendingMarketFrame(stream);
      }
      const replayRecipients = [...stream.subscribers].filter((subscriber) => subscriber.replayHistory);
      if (replayRecipients.length) {
        for (const snapshot of snapshots) {
          updateTrackers(stream, { status: payload.status, snapshot }, replayRecipients);
        }
      }

      // The gateway sends retained frames instead of a separate initial
      // `depth` event whenever history exists. Live-only consumers such as
      // DOM Pro must still receive the newest frame or they wait forever for
      // another book mutation during quiet markets.
      if (payload.final && snapshots.length) {
        const liveRecipients = [...stream.subscribers].filter((subscriber) => !subscriber.replayHistory);
        if (liveRecipients.length) {
          if (replayRecipients.length && stream.latestSnapshot) {
            // The final replay frame already advanced the shared trackers.
            // Deliver that normalized snapshot directly so the same book
            // mutation is not counted twice when both consumer types exist.
            for (const subscriber of liveRecipients) subscriber.onSnapshot(stream.latestSnapshot);
          } else {
            updateTrackers(stream, { status: payload.status, snapshot: snapshots[snapshots.length - 1] }, liveRecipients);
          }
        }
        publishStatus(stream, payload.status?.connected ? "connected" : "checking");
      }
    } catch {
      publishStatus(stream, "unavailable");
    }
  });
  source.addEventListener("ready", () => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    markStreamActivity(stream);
    publishStatus(stream, "checking");
  });
  source.addEventListener("heartbeat", () => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    markStreamActivity(stream);
  });
  source.addEventListener("tick", (event) => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    markStreamActivity(stream);
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        timestamp?: number;
        tick?: number;
        contractSymbol?: string;
      };
      const tick = Number(payload.tick);
      if ((!stream.latestSnapshot && !stream.pendingDepth) || !Number.isFinite(tick) || tick <= 0) return;
      stream.pendingTick = payload;
      scheduleMarketFrame(stream);
    } catch {
      // A malformed tick must not discard the last good book frame.
    }
  });
  source.onerror = () => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    source.close();
    if (stream.eventSource === source) stream.eventSource = null;
    clearWatchdog(stream);
    publishStatus(stream, "unavailable");
    scheduleReconnect(stream);
  };
  clearWatchdog(stream);
  stream.watchdog = window.setInterval(() => {
    if (stream.generation !== generation || stream.eventSource !== source) return;
    const timeout = stream.latestSnapshot ? STREAM_STALE_TIMEOUT_MS : INITIAL_BOOK_TIMEOUT_MS;
    if (Date.now() - stream.lastActivityAt <= timeout) return;
    source.close();
    if (stream.eventSource === source) stream.eventSource = null;
    clearWatchdog(stream);
    publishStatus(stream, "unavailable");
    scheduleReconnect(stream, 250);
  }, STREAM_WATCHDOG_INTERVAL_MS);
}

export function subscribeRithmicLiquidity(args: {
  root: string;
  contractSymbol?: string | null;
  exchange?: string;
  onSnapshot: Subscriber["onSnapshot"];
  onStatus?: Subscriber["onStatus"];
  replayHistory?: boolean;
}) {
  const root = args.root.trim().toUpperCase();
  const contractSymbol = String(args.contractSymbol || "").trim().toUpperCase();
  const exchange = String(args.exchange || "CME").trim().toUpperCase();
  const key = `${exchange}:${contractSymbol || root}`;
  let stream = streams.get(key);
  if (!stream) {
    stream = {
      subscribers: new Set(),
      trackers: new Map(),
      status: "checking",
      timer: null,
      watchdog: null,
      eventSource: null,
      latestSnapshot: null,
      lastActivityAt: Date.now(),
      generation: 0,
      root,
      contractSymbol,
      exchange,
      pendingDepth: null,
      pendingTrades: [],
      pendingOrderEvents: [],
      pendingTick: null,
      publishHandle: null,
      publishMode: null,
    };
    streams.set(key, stream);
  }
  const subscriber: Subscriber = {
    onSnapshot: args.onSnapshot,
    onStatus: args.onStatus,
    replayHistory: args.replayHistory,
  };
  stream.subscribers.add(subscriber);
  subscriber.onStatus?.(stream.status);
  if (stream.latestSnapshot) subscriber.onSnapshot(stream.latestSnapshot);
  connectStream(stream);

  return () => {
    const current = streams.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size) return;
    if (current.timer !== null) window.clearTimeout(current.timer);
    cancelScheduledPublish(current);
    current.pendingDepth = null;
    current.pendingTrades = [];
    current.pendingOrderEvents = [];
    current.pendingTick = null;
    clearWatchdog(current);
    current.eventSource?.close();
    current.eventSource = null;
    streams.delete(key);
  };
}
