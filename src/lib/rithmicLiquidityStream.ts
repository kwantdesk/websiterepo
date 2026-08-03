"use client";

import type { RithmicLiquiditySnapshot, TrackedLiquidityLevel } from "@/lib/structureLevels";

export type RithmicLiquidityStatus = "checking" | "connected" | "unavailable";

type Subscriber = {
  onSnapshot: (snapshot: RithmicLiquiditySnapshot) => void;
  onStatus?: (status: RithmicLiquidityStatus) => void;
};

type RawPayload = {
  status?: {
    connected?: boolean;
    fullDepth?: boolean;
    bookValid?: boolean;
    contractSymbol?: string;
  };
  snapshot?: {
    timestamp?: number;
    tickSize?: number;
    bids?: unknown;
    asks?: unknown;
    latencyMs?: number | null;
    fullDepth?: boolean;
    bookValid?: boolean;
    contractSymbol?: string;
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
  eventSource: EventSource | null;
  root: string;
  contractSymbol: string;
  exchange: string;
};

const streams = new Map<string, SharedPoll>();

function publishStatus(stream: SharedPoll, status: RithmicLiquidityStatus) {
  if (stream.status === status) return;
  stream.status = status;
  stream.subscribers.forEach((subscriber) => subscriber.onStatus?.(status));
}

function decodeRows(value: unknown, side: "BID" | "ASK", tickSize: number) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Array<{ side: "BID" | "ASK"; price: number; size: number; orders: number }> => {
    if (!Array.isArray(item) || item.length < 2) return [];
    const tick = Number(item[0]);
    const size = Number(item[1]);
    const orders = Number(item[2] ?? 0);
    if (![tick, size, orders].every(Number.isFinite) || size <= 0) return [];
    return [{ side, price: tick * tickSize, size, orders }];
  });
}

function updateTrackers(stream: SharedPoll, payload: RawPayload) {
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
  const snapshot: RithmicLiquiditySnapshot = {
    asOf: new Date(Number.isFinite(timestamp) ? timestamp : now).toISOString(),
    contractSymbol: String(payload.status?.contractSymbol || payload.snapshot?.contractSymbol || stream.contractSymbol || stream.root),
    tickSize,
    fullDepth: Boolean(payload.status?.fullDepth ?? payload.snapshot?.fullDepth),
    bookValid: Boolean(payload.status?.bookValid ?? payload.snapshot?.bookValid),
    ageMs: payload.snapshot?.latencyMs == null ? null : Number(payload.snapshot.latencyMs),
    levels: [...stream.trackers.values()]
      .filter((tracker) => tracker.size > 0)
      .map(({ firstSeenAt: _firstSeenAt, lastSeenAt: _lastSeenAt, lastSize: _lastSize, ...tracker }) => tracker),
  };
  stream.subscribers.forEach((subscriber) => subscriber.onSnapshot(snapshot));
}

function connectStream(stream: SharedPoll) {
  if (stream.eventSource || !stream.subscribers.size) return;
  const query = new URLSearchParams({
    exchange: stream.exchange,
    symbol: stream.root,
    depthTicks: "800",
  });
  if (stream.contractSymbol) query.set("contractSymbol", stream.contractSymbol);
  const source = new EventSource(`/api/institutional-market-data/v1/heatmap/stream?${query}`);
  stream.eventSource = source;
  source.addEventListener("depth", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as RawPayload;
      updateTrackers(stream, payload);
      publishStatus(stream, payload.status?.connected ? "connected" : "checking");
    } catch {
      publishStatus(stream, "unavailable");
    }
  });
  source.addEventListener("ready", () => publishStatus(stream, "checking"));
  source.onerror = () => {
    source.close();
    if (stream.eventSource === source) stream.eventSource = null;
    publishStatus(stream, "unavailable");
    if (stream.subscribers.size && stream.timer === null) {
      stream.timer = window.setTimeout(() => {
        stream.timer = null;
        connectStream(stream);
      }, 1_500);
    }
  };
}

export function subscribeRithmicLiquidity(args: {
  root: string;
  contractSymbol?: string | null;
  exchange?: string;
  onSnapshot: Subscriber["onSnapshot"];
  onStatus?: Subscriber["onStatus"];
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
      eventSource: null,
      root,
      contractSymbol,
      exchange,
    };
    streams.set(key, stream);
  }
  const subscriber: Subscriber = { onSnapshot: args.onSnapshot, onStatus: args.onStatus };
  stream.subscribers.add(subscriber);
  subscriber.onStatus?.(stream.status);
  connectStream(stream);

  return () => {
    const current = streams.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size) return;
    if (current.timer !== null) window.clearTimeout(current.timer);
    current.eventSource?.close();
    current.eventSource = null;
    streams.delete(key);
  };
}
