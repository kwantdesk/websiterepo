"use client";

import { createExecutionTapeEngine, type ExecutionTapeEngine, type ExecutionTapeStatus } from "@/lib/executionTapeEngine";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type RithmicIndicatorStreamStatus = ExecutionTapeStatus;

type Subscriber = {
  onSeed?: (records: InstitutionalTrade[]) => void;
  onTrades: (records: InstitutionalTrade[]) => void;
  onStatus?: (status: RithmicIndicatorStreamStatus) => void;
};

/**
 * One shared feed per contract, fanned out to every pane that wants it.
 *
 * The ingest half — connecting, parsing, dedup, tape and batching — runs in a
 * worker so it cannot take milliseconds away from React and canvas painting.
 * This module is the main-thread half: subscriber bookkeeping and fan-out.
 * If a worker cannot be created the same engine runs inline instead, so the
 * feed degrades in speed rather than disappearing.
 */
type SharedStream = {
  subscribers: Set<Subscriber>;
  records: InstitutionalTrade[];
  status: RithmicIndicatorStreamStatus;
  seeded: boolean;
  symbol: string;
  contractSymbol: string;
  /** Set only on the fallback path. */
  inlineEngine: ExecutionTapeEngine | null;
};

const streams = new Map<string, SharedStream>();

type WorkerMessage =
  | { type: "status"; key: string; status: RithmicIndicatorStreamStatus }
  | { type: "seed"; key: string; records: InstitutionalTrade[] }
  | { type: "trades"; key: string; records: InstitutionalTrade[] };

let worker: Worker | null = null;
let workerUnavailable = false;

function ensureWorker(): Worker | null {
  if (worker || workerUnavailable) return worker;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    workerUnavailable = true;
    return null;
  }
  try {
    worker = new Worker(new URL("./marketTape.worker.ts", import.meta.url));
  } catch {
    // A CSP without worker support, or an environment that cannot build one:
    // fall back to running the engine on this thread.
    workerUnavailable = true;
    return null;
  }
  worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    const stream = streams.get(message?.key ?? "");
    if (message?.type === "trades") {
      try {
        if (!stream) return;
        // The worker owns the authoritative tape; this copy exists only to
        // seed a pane that attaches later, so it is bounded the same way.
        for (const record of message.records) stream.records.push(record);
        if (stream.records.length > 29_096) stream.records.splice(0, stream.records.length - 25_000);
        stream.subscribers.forEach((subscriber) => subscriber.onTrades(message.records));
      } finally {
        // Acknowledge only after synchronous fan-out. Until this arrives the
        // worker coalesces subsequent prints instead of filling Chromium's
        // structured-clone message queue with unbounded batches.
        (event.currentTarget as Worker | null)?.postMessage({ type: "ack", key: message.key });
      }
      return;
    }
    if (!stream) return;
    if (message.type === "status") {
      stream.status = message.status;
      stream.subscribers.forEach((subscriber) => subscriber.onStatus?.(message.status));
      return;
    }
    if (message.type === "seed") {
      stream.records = message.records;
      stream.seeded = true;
      stream.subscribers.forEach((subscriber) => subscriber.onSeed?.(message.records.slice()));
      return;
    }
  });
  worker.addEventListener("error", () => {
    // A worker that dies mid-session must not silently take the feed with it.
    workerUnavailable = true;
    worker = null;
    for (const [key, stream] of streams) {
      if (stream.inlineEngine || stream.subscribers.size === 0) continue;
      startInlineEngine(key, stream);
    }
  });
  return worker;
}

function startInlineEngine(key: string, stream: SharedStream) {
  stream.inlineEngine = createExecutionTapeEngine(stream.symbol, stream.contractSymbol, {
    onStatus: (status) => {
      stream.status = status;
      stream.subscribers.forEach((subscriber) => subscriber.onStatus?.(status));
    },
    onSeed: (records) => {
      stream.records = records;
      stream.seeded = true;
      stream.subscribers.forEach((subscriber) => subscriber.onSeed?.(records.slice()));
    },
    onTrades: (records) => {
      for (const record of records) stream.records.push(record);
      if (stream.records.length > 29_096) stream.records.splice(0, stream.records.length - 25_000);
      stream.subscribers.forEach((subscriber) => subscriber.onTrades(records));
    },
  });
  stream.inlineEngine.start();
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
  const fresh = !stream;
  if (!stream) {
    stream = {
      subscribers: new Set(),
      records: [],
      status: "checking",
      seeded: false,
      symbol,
      contractSymbol,
      inlineEngine: null,
    };
    streams.set(key, stream);
  }

  // Do not let a newly attached pane receive the same records once in its seed
  // and again from an already queued live publication.
  stream.inlineEngine?.flushPending();

  const subscriber: Subscriber = {
    onSeed: args.onSeed,
    onTrades: args.onTrades,
    onStatus: args.onStatus,
  };
  stream.subscribers.add(subscriber);
  subscriber.onStatus?.(stream.status);
  if (stream.records.length) subscriber.onSeed?.(stream.records.slice());

  if (fresh) {
    const active = ensureWorker();
    if (active) active.postMessage({ type: "subscribe", key, symbol, contractSymbol });
    else startInlineEngine(key, stream);
  }

  return () => {
    const current = streams.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size > 0) return;
    if (current.inlineEngine) current.inlineEngine.stop();
    else worker?.postMessage({ type: "unsubscribe", key });
    streams.delete(key);
  };
}
