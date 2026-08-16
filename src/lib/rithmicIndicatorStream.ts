"use client";

import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type RithmicIndicatorStreamStatus = "checking" | "connected" | "unavailable";

type Subscriber = {
  onSeed?: (records: InstitutionalTrade[]) => void;
  onTrades: (records: InstitutionalTrade[]) => void;
  onStatus?: (status: RithmicIndicatorStreamStatus) => void;
};

type SharedStream = {
  source: EventSource | null;
  subscribers: Set<Subscriber>;
  records: InstitutionalTrade[];
  status: RithmicIndicatorStreamStatus;
  startPromise: Promise<void> | null;
  pendingTrades: InstitutionalTrade[];
  publishTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  watchdogTimer: ReturnType<typeof setInterval> | null;
  lastActivityAt: number;
  generation: number;
  seedPublished: boolean;
};

const streams = new Map<string, SharedStream>();
// The seed is deliberately bounded for browser responsiveness; complete
// session calculations such as Volume Profile stay inside the gateway.
const MAX_TAPE_RECORDS = 25_000;
// Execution messages can arrive far faster than React can economically render
// several chart panes. Preserve every print in the shared tape immediately,
// but fan visual updates out as one compact batch. Price presentation uses the
// separate live tick path, so this does not make the chart price less live.
const TRADE_PUBLISH_INTERVAL_MS = 40;
const STREAM_RECONNECT_DELAY_MS = 1_000;
const STREAM_WATCHDOG_INTERVAL_MS = 5_000;
const STREAM_STALE_AFTER_MS = 20_000;

function recordKey(record: InstitutionalTrade) {
  return record.eventId
    || `${record.timestamp}:${record.recordIndex}:${record.close}:${record.volume}`;
}

function unseenRecords(current: InstitutionalTrade[], incoming: InstitutionalTrade[]) {
  if (!incoming.length) return [];
  const seen = new Set(
    current
      .slice(-Math.max(512, incoming.length * 4))
      .map(recordKey),
  );
  return incoming.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validRecord(value: unknown): value is InstitutionalTrade {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<InstitutionalTrade>;
  return Number.isFinite(Number(row.timestamp))
    && Number.isFinite(Number(row.close))
    && Number.isFinite(Number(row.volume));
}

function decodeRecords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(validRecord).map((row) => ({
    ...row,
    eventId: row.eventId ? String(row.eventId) : undefined,
    recordIndex: Number(row.recordIndex ?? 0),
    timestamp: Number(row.timestamp),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    trades: Number(row.trades ?? 1),
    volume: Number(row.volume),
    bidVolume: Number(row.bidVolume ?? 0),
    askVolume: Number(row.askVolume ?? 0),
    delta: Number(row.delta ?? 0),
    aggressor: row.aggressor === "BUY" || row.aggressor === "SELL" ? row.aggressor : "UNKNOWN",
    sideSemanticsVersion: Number(row.sideSemanticsVersion ?? 2),
  } satisfies InstitutionalTrade));
}

function mergeRecords(current: InstitutionalTrade[], incoming: InstitutionalTrade[]) {
  if (!incoming.length) return current;
  // Live batches are already chronological. Avoid rebuilding and sorting a
  // 25,000-row map for every SSE message; only compare against the recent tail
  // where a reconnect can repeat records.
  const recentKeys = new Set(
    current
      .slice(-Math.max(512, incoming.length * 4))
      .map(recordKey),
  );
  const additions = incoming.filter((record) => !recentKeys.has(recordKey(record)));
  if (!additions.length) return current;
  const currentTail = current.at(-1);
  const additionsAreOrdered = additions.every((record, index) => (
    index === 0
      ? !currentTail
        || record.timestamp > currentTail.timestamp
        || (record.timestamp === currentTail.timestamp && record.recordIndex >= currentTail.recordIndex)
      : record.timestamp > additions[index - 1].timestamp
        || (record.timestamp === additions[index - 1].timestamp
          && record.recordIndex >= additions[index - 1].recordIndex)
  ));
  if (additionsAreOrdered) {
    return current.concat(additions).slice(-MAX_TAPE_RECORDS);
  }

  const byId = new Map<string, InstitutionalTrade>();
  for (const record of [...current, ...additions]) {
    byId.set(recordKey(record), record);
  }
  return [...byId.values()]
    .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex)
    .slice(-MAX_TAPE_RECORDS);
}

function publishStatus(stream: SharedStream, status: RithmicIndicatorStreamStatus) {
  stream.status = status;
  stream.subscribers.forEach((subscriber) => subscriber.onStatus?.(status));
}

function flushPendingTrades(stream: SharedStream) {
  if (stream.publishTimer !== null) {
    clearTimeout(stream.publishTimer);
    stream.publishTimer = null;
  }
  if (!stream.pendingTrades.length) return;
  const records = stream.pendingTrades;
  stream.pendingTrades = [];
  stream.subscribers.forEach((subscriber) => subscriber.onTrades(records));
}

function queueTradePublication(stream: SharedStream, records: InstitutionalTrade[]) {
  stream.pendingTrades.push(...records);
  if (stream.publishTimer !== null) return;
  stream.publishTimer = setTimeout(() => flushPendingTrades(stream), TRADE_PUBLISH_INTERVAL_MS);
}

function clearConnection(stream: SharedStream) {
  stream.source?.close();
  stream.source = null;
  if (stream.watchdogTimer !== null) clearInterval(stream.watchdogTimer);
  stream.watchdogTimer = null;
}

function launchStream(
  key: string,
  stream: SharedStream,
  symbol: string,
  contractSymbol: string,
) {
  if (stream.startPromise || stream.subscribers.size === 0 || streams.get(key) !== stream) return;
  stream.startPromise = startStream(key, stream, symbol, contractSymbol)
    .finally(() => {
      if (streams.get(key) === stream) stream.startPromise = null;
    });
}

function scheduleReconnect(
  key: string,
  stream: SharedStream,
  symbol: string,
  contractSymbol: string,
) {
  if (streams.get(key) !== stream || stream.subscribers.size === 0) return;
  clearConnection(stream);
  publishStatus(stream, "checking");
  if (stream.reconnectTimer !== null) return;
  stream.reconnectTimer = setTimeout(() => {
    stream.reconnectTimer = null;
    launchStream(key, stream, symbol, contractSymbol);
  }, STREAM_RECONNECT_DELAY_MS);
}

async function startStream(
  key: string,
  stream: SharedStream,
  symbol: string,
  contractSymbol: string,
) {
  clearConnection(stream);
  const generation = stream.generation + 1;
  stream.generation = generation;
  publishStatus(stream, "checking");
  try {
    const health = await fetch("/api/institutional-market-data?path=health", {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (stream.subscribers.size === 0) {
      return;
    }
    if (!health.ok) {
      publishStatus(stream, "unavailable");
      scheduleReconnect(key, stream, symbol, contractSymbol);
      return;
    }

    const query = new URLSearchParams({
      exchange: "CME",
      symbol,
      contractSymbol,
    });
    const source = new EventSource(
      `/api/institutional-market-data/v1/market-data/trades?${query.toString()}`,
    );
    stream.source = source;
    const markActivity = () => {
      if (stream.generation !== generation) return false;
      stream.lastActivityAt = Date.now();
      return true;
    };
    source.addEventListener("ready", () => {
      if (!markActivity()) return;
      publishStatus(stream, "connected");
    });
    source.addEventListener("heartbeat", () => {
      if (!markActivity()) return;
      if (stream.status !== "connected") publishStatus(stream, "connected");
    });
    source.addEventListener("seed", (event) => {
      if (!markActivity()) return;
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { records?: unknown };
        const records = decodeRecords(payload.records);
        const additions = unseenRecords(stream.records, records);
        stream.records = mergeRecords(stream.records, additions);
        if (!stream.seedPublished) {
          // The hosting proxy rotates long-running streams. Re-emitting a full
          // 25k seed on every reconnect made every open CVD/profile pane rebuild
          // its history at once, producing the periodic whole-workspace freeze.
          // Existing subscribers need the full seed exactly once; later seed
          // deltas enter the normal compact live fanout.
          if (stream.publishTimer !== null) clearTimeout(stream.publishTimer);
          stream.publishTimer = null;
          stream.pendingTrades = [];
          stream.seedPublished = true;
          stream.subscribers.forEach((subscriber) => subscriber.onSeed?.(stream.records));
        } else if (additions.length) {
          queueTradePublication(stream, additions);
        }
      } catch {
        // A malformed seed must not interrupt the live stream.
      }
    });
    source.addEventListener("trades", (event) => {
      if (!markActivity()) return;
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { records?: unknown };
        const records = decodeRecords(payload.records);
        if (!records.length) return;
        // A reconnect can replay the tail of the execution stream. Publish
        // only genuinely new prints so CVD and volume profiles cannot count
        // the same execution twice.
        const additions = unseenRecords(stream.records, records);
        if (!additions.length) return;
        stream.records = mergeRecords(stream.records, additions);
        if (stream.seedPublished) queueTradePublication(stream, additions);
      } catch {
        // Ignore a malformed batch and reconcile on the next valid batch.
      }
    });
    stream.lastActivityAt = Date.now();
    stream.watchdogTimer = setInterval(() => {
      if (
        stream.generation === generation
        && Date.now() - stream.lastActivityAt > STREAM_STALE_AFTER_MS
      ) {
        scheduleReconnect(key, stream, symbol, contractSymbol);
      }
    }, STREAM_WATCHDOG_INTERVAL_MS);
    source.onerror = () => {
      if (stream.generation !== generation) return;
      // EventSource's implicit reconnect can leave the indicator feed in a
      // half-open state after the hosting proxy rotates it. Own the lifecycle
      // explicitly so Footprint never remains frozen behind a healthy quote.
      scheduleReconnect(key, stream, symbol, contractSymbol);
    };
  } catch {
    publishStatus(stream, "unavailable");
    if (stream.subscribers.size === 0) streams.delete(key);
    else scheduleReconnect(key, stream, symbol, contractSymbol);
  }
}

export function subscribeRithmicIndicatorTrades(args: {
  symbol: string;
  contractSymbol: string;
  onSeed?: Subscriber["onSeed"];
  onTrades: Subscriber["onTrades"];
  onStatus?: Subscriber["onStatus"];
}) {
  const symbol = args.symbol.trim().toUpperCase();
  const contractSymbol = args.contractSymbol.trim().toUpperCase();
  const key = `${symbol}:${contractSymbol}`;
  let stream = streams.get(key);
  if (!stream) {
    stream = {
      source: null,
      subscribers: new Set(),
      records: [],
      status: "checking",
      startPromise: null,
      pendingTrades: [],
      publishTimer: null,
      reconnectTimer: null,
      watchdogTimer: null,
      lastActivityAt: Date.now(),
      generation: 0,
      seedPublished: false,
    };
    streams.set(key, stream);
  }

  // Do not let a newly attached pane receive the same records once in its seed
  // and again from an already queued live publication.
  flushPendingTrades(stream);
  const subscriber: Subscriber = {
    onSeed: args.onSeed,
    onTrades: args.onTrades,
    onStatus: args.onStatus,
  };
  stream.subscribers.add(subscriber);
  subscriber.onStatus?.(stream.status);
  if (stream.records.length) subscriber.onSeed?.(stream.records);
  if (!stream.source && !stream.startPromise) {
    launchStream(key, stream, symbol, contractSymbol);
  }

  return () => {
    const current = streams.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      if (current.publishTimer !== null) clearTimeout(current.publishTimer);
      if (current.reconnectTimer !== null) clearTimeout(current.reconnectTimer);
      current.publishTimer = null;
      current.reconnectTimer = null;
      current.pendingTrades = [];
      clearConnection(current);
      streams.delete(key);
    }
  };
}
