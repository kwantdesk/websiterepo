import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STREAM_RECONNECT_DELAY_MS,
  STREAM_STALE_AFTER_MS,
  STREAM_STALE_RECONNECT_DELAY_MS,
  STREAM_WATCHDOG_INTERVAL_MS,
} from "../src/lib/executionTapeEngine.ts";

/**
 * How long a big print can be invisible when the execution stream stalls.
 *
 * An SSE connection can go half-open - the proxy rotates it, the socket stays
 * up, no error fires - so the only signal is silence. Heartbeats refresh the
 * activity clock, so silence means the feed genuinely stopped, not that the
 * market went quiet.
 *
 * The old values gave a worst case of 39 seconds before a print could
 * reappear, and the backlog then landed all at once. That is the reported
 * "about 30 seconds late".
 */

// --- the worst case a trader can actually experience ---
{
  const worstCase = STREAM_STALE_AFTER_MS + STREAM_WATCHDOG_INTERVAL_MS + STREAM_STALE_RECONNECT_DELAY_MS;
  // Detection is bounded by the stale threshold plus one watchdog tick, since
  // the watchdog only samples periodically.
  assert.equal(worstCase, 15_000 + 3_000 + 250);
  assert.ok(worstCase < 20_000, `a stalled feed must recover well inside 20s, got ${worstCase}ms`);
  // The old configuration, for the record: 30s + 5s + 4s.
  assert.ok(worstCase < 39_000 / 2, "and must be at least twice as fast as the old 39s");
}

// --- the values match the sibling stream proven against the same gateway ---
{
  const liquidity = readFileSync(new URL("../src/lib/rithmicLiquidityStream.ts", import.meta.url), "utf8");
  const staleMatch = liquidity.match(/STREAM_STALE_TIMEOUT_MS = ([\d_]+)/);
  const watchdogMatch = liquidity.match(/STREAM_WATCHDOG_INTERVAL_MS = ([\d_]+)/);
  assert.ok(staleMatch && watchdogMatch, "the liquidity stream's timings were not found");
  const parse = (value) => Number(value.replace(/_/g, ""));
  // This is what makes the tightening safe rather than optimistic: the
  // gateway's heartbeat is already known to sustain these.
  assert.equal(STREAM_STALE_AFTER_MS, parse(staleMatch[1]),
    "the trades stream must not tolerate more silence than the liquidity stream");
  assert.equal(STREAM_WATCHDOG_INTERVAL_MS, parse(watchdogMatch[1]));
}

// --- a stall reconnects immediately; an outage still backs off ---
{
  assert.ok(STREAM_STALE_RECONNECT_DELAY_MS <= 250, "a stalled stream goes straight back out");
  assert.ok(STREAM_RECONNECT_DELAY_MS >= 4_000,
    "an explicit error keeps its backoff so a downed gateway is not hammered");
  assert.ok(STREAM_STALE_RECONNECT_DELAY_MS < STREAM_RECONNECT_DELAY_MS,
    "a stall and an outage must not be treated the same way");

  const engine = readFileSync(new URL("../src/lib/executionTapeEngine.ts", import.meta.url), "utf8");
  assert.ok(engine.includes("scheduleReconnect(STREAM_STALE_RECONNECT_DELAY_MS)"),
    "the watchdog must use the fast path");
  // onerror must NOT pass the fast delay - that is the outage path.
  const onError = engine.slice(engine.indexOf("stream.onerror"));
  assert.ok(onError.slice(0, 400).includes("scheduleReconnect();"),
    "an explicit error keeps the default backoff");
}

// --- the watchdog cannot outrun its own threshold ---
{
  assert.ok(STREAM_WATCHDOG_INTERVAL_MS < STREAM_STALE_AFTER_MS,
    "sampling slower than the threshold would add a whole extra tick of delay");
}

// --- the live fan-out itself stays sub-frame ---
{
  const engine = readFileSync(new URL("../src/lib/executionTapeEngine.ts", import.meta.url), "utf8");
  const publish = engine.match(/TRADE_PUBLISH_INTERVAL_MS = ([\d_]+)/);
  assert.ok(publish, "the publish interval was not found");
  assert.ok(Number(publish[1].replace(/_/g, "")) <= 50,
    "a healthy stream must fan out within a frame; the delay was never here");
}

console.log("Execution stream staleness tests passed.");
