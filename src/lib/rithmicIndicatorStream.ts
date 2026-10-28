"use client";

import { createExecutionTapeEngine, type ExecutionTapeEngine, type ExecutionTapeStatus } from "@/lib/executionTapeEngine";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import type { ExecutionStreamContinuity } from "@/lib/executionStreamContinuity";
import { recordDatabentoLiveExecutions } from "@/lib/chartLiveEvents";
import { createExecutionFreshnessGuard } from "@/lib/executionFreshness";

export type RithmicIndicatorStreamStatus = ExecutionTapeStatus;

type Subscriber = {
  executionPriority?: boolean;
  reportedFailure?: boolean;
  onSeed?: (records: InstitutionalTrade[]) => void;
  onTrades: (records: InstitutionalTrade[]) => void;
  onStatus?: (status: RithmicIndicatorStreamStatus) => void;
  onContinuity?: (continuity: ExecutionStreamContinuity) => void;
  onRecovery?: () => void;
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
  continuity: ExecutionStreamContinuity;
  seeded: boolean;
  symbol: string;
  contractSymbol: string;
  /** Set only on the fallback path. */
  inlineEngine: ExecutionTapeEngine | null;
  latestExecution: number;
  freshness: ReturnType<typeof createExecutionFreshnessGuard> | null;
};

const streams = new Map<string, SharedStream>();

function notifySubscriber(subscriber: Subscriber, notify: () => void) {
  try { notify(); } catch {
    // One failed chart must not discard the batch for protection or siblings.
    // Report once per subscription, not once per tick during a busy session.
    if (!subscriber.reportedFailure) {
      subscriber.reportedFailure = true;
      console.error("Market-data subscriber failed; other consumers remain active.");
    }
  }
}

function publishTrades(stream: SharedStream, records: InstitutionalTrade[]) {
  // Protective execution is synchronous and precedes chart cache/render work.
  for (const subscriber of stream.subscribers) {
    if (subscriber.executionPriority) notifySubscriber(subscriber, () => subscriber.onTrades(records));
  }
  recordDatabentoLiveExecutions(stream.symbol, records);
  for (const record of records) {
    stream.records.push(record);
    stream.latestExecution = Math.max(stream.latestExecution, record.timestamp);
  }
  if (stream.records.length > 29_096) stream.records.splice(0, stream.records.length - 25_000);
  for (const subscriber of stream.subscribers) {
    if (!subscriber.executionPriority) notifySubscriber(subscriber, () => subscriber.onTrades(records));
  }
}

type WorkerMessage =
  | { type: "status"; key: string; status: RithmicIndicatorStreamStatus }
  | { type: "continuity"; key: string; continuity: ExecutionStreamContinuity }
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
        publishTrades(stream, message.records);
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
      stream.subscribers.forEach((subscriber) => notifySubscriber(subscriber, () => subscriber.onStatus?.(message.status)));
      return;
    }
    if (message.type === "continuity") {
      stream.continuity = message.continuity;
      stream.subscribers.forEach((subscriber) => notifySubscriber(subscriber, () => subscriber.onContinuity?.(message.continuity)));
      return;
    }
    if (message.type === "seed") {
      stream.records = message.records;
      for (const record of message.records) stream.latestExecution = Math.max(stream.latestExecution, record.timestamp);
      stream.seeded = true;
      stream.subscribers.forEach((subscriber) => notifySubscriber(subscriber, () => subscriber.onSeed?.(message.records.slice())));
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
      stream.subscribers.forEach((subscriber) => notifySubscriber(subscriber, () => subscriber.onStatus?.(status)));
    },
    onContinuity: (continuity) => {
      stream.continuity = continuity;
      stream.subscribers.forEach((subscriber) => notifySubscriber(subscriber, () => subscriber.onContinuity?.(continuity)));
    },
    onSeed: (records) => {
      stream.records = records;
      for (const record of records) stream.latestExecution = Math.max(stream.latestExecution, record.timestamp);
      stream.seeded = true;
      stream.subscribers.forEach((subscriber) => notifySubscriber(subscriber, () => subscriber.onSeed?.(records.slice())));
    },
    onTrades: (records) => {
      publishTrades(stream, records);
    },
  });
  stream.inlineEngine.start();
}

export function subscribeRithmicIndicatorTrades(args: {
  /** Evaluate protective execution before cache maintenance and chart callbacks. */
  executionPriority?: boolean;
  symbol: string;
  contractSymbol: string;
  onSeed?: Subscriber["onSeed"];
  onTrades: Subscriber["onTrades"];
  onStatus?: Subscriber["onStatus"];
  onContinuity?: Subscriber["onContinuity"];
  onRecovery?: Subscriber["onRecovery"];
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
      continuity: "checking",
      seeded: false,
      symbol,
      contractSymbol,
      inlineEngine: null,
      latestExecution: 0,
      freshness: null,
    };
    streams.set(key, stream);
    const current = stream;
    current.freshness = createExecutionFreshnessGuard({
      now: Date.now,
      latestExecution: () => current.latestExecution,
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: handle => window.clearTimeout(handle),
      recover: () => {
        if (streams.get(key) !== current) return;
        if (current.inlineEngine) current.inlineEngine.reconnect();
        else worker?.postMessage({ type: "reconnect", key });
        current.subscribers.forEach(subscriber => notifySubscriber(subscriber, () => subscriber.onRecovery?.()));
      },
    });
  }

  // Do not let a newly attached pane receive the same records once in its seed
  // and again from an already queued live publication.
  stream.inlineEngine?.flushPending();

  const subscriber: Subscriber = {
    executionPriority: args.executionPriority,
    onSeed: args.onSeed,
    onTrades: args.onTrades,
    onStatus: args.onStatus,
    onContinuity: args.onContinuity,
    onRecovery: args.onRecovery,
  };
  stream.subscribers.add(subscriber);
  notifySubscriber(subscriber, () => subscriber.onStatus?.(stream.status));
  notifySubscriber(subscriber, () => subscriber.onContinuity?.(stream.continuity));
  if (stream.records.length) notifySubscriber(subscriber, () => subscriber.onSeed?.(stream.records.slice()));

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
    current.freshness?.dispose();
    streams.delete(key);
  };
}

/** Only a fresh confirmed print on the same concrete contract is a witness.
 * Bid/ask movement alone is normal between executions and must not reconnect. */
export function witnessRithmicExecution(args: {
  symbol: string; contractSymbol: string; timestamp: number; isTrade?: boolean; cached?: boolean;
}) {
  if (args.isTrade !== true || args.cached) return;
  const stream = streams.get(`${args.symbol.trim().toUpperCase()}:${args.contractSymbol.trim().toUpperCase()}`);
  if (!stream?.seeded || stream.status !== "connected") return;
  stream.freshness?.witness(args.timestamp);
}
