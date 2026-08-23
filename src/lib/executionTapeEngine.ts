/**
 * Owns one execution feed: connection lifecycle, decoding, dedup, tape and
 * batching.
 *
 * This is the work that used to sit on the UI thread, competing with React and
 * canvas painting for the same milliseconds — which is why a busy tape could
 * stall the pointer and freeze the price. It only needs fetch, EventSource and
 * timers, all of which exist in a worker, so the engine is written once and
 * the caller decides where it runs: the market-data worker normally, or
 * inline on the main thread when a worker cannot be created.
 */
import { admitRecords, decodeRecords, type ExecutionTapeBuffer } from "@/lib/executionTape";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type ExecutionTapeStatus = "checking" | "connected" | "unavailable";

const TRADE_PUBLISH_INTERVAL_MS = 40;
/**
 * How long a silent stream is tolerated before it is treated as dead.
 *
 * An SSE connection can go half-open - the hosting proxy rotates it, the
 * socket stays up, and no error ever fires - so the ONLY signal is silence.
 * Heartbeats refresh the clock, so silence here means the feed genuinely
 * stopped delivering, not that the market went quiet.
 *
 * These were 30s stale / 5s watchdog / 4s reconnect, a worst case of 39
 * seconds before a print could reappear, and prints then arrived in a burst
 * at the end of it. The liquidity stream runs against the SAME gateway on
 * 15s / 3s / 250ms and has done so reliably, which is what makes these values
 * safe rather than optimistic: the gateway's heartbeat is already known to be
 * frequent enough for them.
 */
export const STREAM_STALE_AFTER_MS = 15_000;
export const STREAM_WATCHDOG_INTERVAL_MS = 3_000;
/**
 * A stall is not an outage. A watchdog reconnect goes straight back out,
 * while an explicit error keeps a backoff so a genuinely down gateway is not
 * hammered by every open pane.
 */
export const STREAM_STALE_RECONNECT_DELAY_MS = 250;
export const STREAM_RECONNECT_DELAY_MS = 4_000;

export type ExecutionTapeEngineHandlers = {
  onStatus: (status: ExecutionTapeStatus) => void;
  /** The full retained tape, published once per connection. */
  onSeed: (records: InstitutionalTrade[]) => void;
  /** Genuinely new prints only, batched. */
  onTrades: (records: InstitutionalTrade[]) => void;
};

export function createExecutionTapeEngine(
  symbol: string,
  contractSymbol: string,
  handlers: ExecutionTapeEngineHandlers,
) {
  const tape: ExecutionTapeBuffer = { records: [], recordKeys: new Set<string>() };
  let source: EventSource | null = null;
  let status: ExecutionTapeStatus = "checking";
  let generation = 0;
  let seedPublished = false;
  let stopped = false;
  let lastActivityAt = Date.now();
  let pending: InstitutionalTrade[] = [];
  let publishTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;

  const setStatus = (next: ExecutionTapeStatus) => {
    status = next;
    handlers.onStatus(next);
  };

  const flush = () => {
    if (publishTimer !== null) {
      clearTimeout(publishTimer);
      publishTimer = null;
    }
    if (!pending.length) return;
    const records = pending;
    pending = [];
    handlers.onTrades(records);
  };

  // Execution messages arrive far faster than any chart can economically
  // render. Every print enters the tape immediately; the fan-out is batched.
  const queue = (records: InstitutionalTrade[]) => {
    for (const record of records) pending.push(record);
    if (publishTimer !== null) return;
    publishTimer = setTimeout(flush, TRADE_PUBLISH_INTERVAL_MS);
  };

  const closeConnection = () => {
    source?.close();
    source = null;
    if (watchdogTimer !== null) clearInterval(watchdogTimer);
    watchdogTimer = null;
  };

  const scheduleReconnect = (delayMs: number = STREAM_RECONNECT_DELAY_MS) => {
    if (stopped) return;
    closeConnection();
    setStatus("checking");
    if (reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delayMs);
  };

  async function connect(): Promise<void> {
    if (stopped) return;
    closeConnection();
    generation += 1;
    const thisGeneration = generation;
    setStatus("checking");
    try {
      const health = await fetch("/api/institutional-market-data?path=health", {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (stopped || generation !== thisGeneration) return;
      if (!health.ok) {
        setStatus("unavailable");
        scheduleReconnect();
        return;
      }

      const query = new URLSearchParams({ exchange: "CME", symbol, contractSymbol });
      const stream = new EventSource(
        `/api/institutional-market-data/v1/market-data/trades?${query.toString()}`,
      );
      source = stream;

      const markActivity = () => {
        if (generation !== thisGeneration || stopped) return false;
        lastActivityAt = Date.now();
        return true;
      };

      stream.addEventListener("ready", () => {
        if (!markActivity()) return;
        setStatus("connected");
      });
      stream.addEventListener("heartbeat", () => {
        if (!markActivity()) return;
        if (status !== "connected") setStatus("connected");
      });
      stream.addEventListener("seed", (event) => {
        if (!markActivity()) return;
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as { records?: unknown };
          const additions = admitRecords(tape, decodeRecords(payload.records));
          if (!seedPublished) {
            // The hosting proxy rotates long-running streams. Re-emitting a
            // full seed on every reconnect made every open pane rebuild its
            // history at once. Subscribers need the full seed exactly once;
            // later seed deltas enter the normal compact live fan-out.
            if (publishTimer !== null) clearTimeout(publishTimer);
            publishTimer = null;
            pending = [];
            seedPublished = true;
            handlers.onSeed(tape.records.slice());
          } else if (additions.length) {
            queue(additions);
          }
        } catch {
          // A malformed seed must not interrupt the live stream.
        }
      });
      stream.addEventListener("trades", (event) => {
        if (!markActivity()) return;
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as { records?: unknown };
          // A reconnect can replay the tail of the execution stream. Publish
          // only genuinely new prints so CVD and volume profiles cannot count
          // the same execution twice.
          const additions = admitRecords(tape, decodeRecords(payload.records));
          if (!additions.length) return;
          if (seedPublished) queue(additions);
        } catch {
          // Ignore a malformed batch and reconcile on the next valid batch.
        }
      });

      lastActivityAt = Date.now();
      watchdogTimer = setInterval(() => {
        if (
          generation === thisGeneration
          && Date.now() - lastActivityAt > STREAM_STALE_AFTER_MS
        ) scheduleReconnect(STREAM_STALE_RECONNECT_DELAY_MS);
      }, STREAM_WATCHDOG_INTERVAL_MS);

      stream.onerror = () => {
        if (generation !== thisGeneration) return;
        // EventSource's implicit reconnect can leave the feed half-open after
        // the hosting proxy rotates it. Own the lifecycle explicitly so the
        // pane never stays frozen behind a healthy quote.
        scheduleReconnect();
      };
    } catch {
      setStatus("unavailable");
      scheduleReconnect();
    }
  }

  return {
    start: () => { void connect(); },
    /** The retained tape, for a subscriber attaching after the seed. */
    snapshot: () => tape.records.slice(),
    status: () => status,
    /** Publish anything queued now, so a new subscriber cannot be sent the
     *  same records in its seed and again in a pending batch. */
    flushPending: flush,
    stop: () => {
      stopped = true;
      if (publishTimer !== null) clearTimeout(publishTimer);
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      publishTimer = null;
      reconnectTimer = null;
      pending = [];
      closeConnection();
    },
  };
}

export type ExecutionTapeEngine = ReturnType<typeof createExecutionTapeEngine>;
