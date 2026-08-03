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
};

const streams = new Map<string, SharedStream>();
// The seed is deliberately bounded for browser responsiveness; complete
// session calculations such as Volume Profile stay inside the gateway.
const MAX_TAPE_RECORDS = 25_000;

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
  const recordKey = (record: InstitutionalTrade) => record.eventId
    || `${record.timestamp}:${record.recordIndex}:${record.close}:${record.volume}`;

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

async function startStream(
  key: string,
  stream: SharedStream,
  symbol: string,
  contractSymbol: string,
) {
  publishStatus(stream, "checking");
  try {
    const health = await fetch("/api/institutional-market-data?path=health", {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!health.ok || stream.subscribers.size === 0) {
      publishStatus(stream, "unavailable");
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
    source.addEventListener("ready", () => publishStatus(stream, "connected"));
    source.addEventListener("seed", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { records?: unknown };
        const records = decodeRecords(payload.records);
        stream.records = mergeRecords(stream.records, records);
        stream.subscribers.forEach((subscriber) => subscriber.onSeed?.(stream.records));
      } catch {
        // A malformed seed must not interrupt the live stream.
      }
    });
    source.addEventListener("trades", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { records?: unknown };
        const records = decodeRecords(payload.records);
        if (!records.length) return;
        stream.records = mergeRecords(stream.records, records);
        stream.subscribers.forEach((subscriber) => subscriber.onTrades(records));
      } catch {
        // Ignore a malformed batch and reconcile on the next valid batch.
      }
    });
    source.onerror = () => publishStatus(stream, "checking");
  } catch {
    publishStatus(stream, "unavailable");
    if (stream.subscribers.size === 0) streams.delete(key);
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
    };
    streams.set(key, stream);
  }

  const subscriber: Subscriber = {
    onSeed: args.onSeed,
    onTrades: args.onTrades,
    onStatus: args.onStatus,
  };
  stream.subscribers.add(subscriber);
  subscriber.onStatus?.(stream.status);
  if (stream.records.length) subscriber.onSeed?.(stream.records);
  if (!stream.source && !stream.startPromise) {
    stream.startPromise = startStream(key, stream, symbol, contractSymbol)
      .finally(() => { if (stream) stream.startPromise = null; });
  }

  return () => {
    const current = streams.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      current.source?.close();
      streams.delete(key);
    }
  };
}
