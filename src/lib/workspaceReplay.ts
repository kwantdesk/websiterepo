import { cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";
import { newYorkSessionTimestamp, setGexVueReplaySession, type GexVueReplayState } from "@/lib/gexVueReplay";

export type WorkspaceReplayClock = { sessionDate: string; timestampMs: number };

/** Session labels are trading dates, not the date on which Globex opens. */
export function selectWorkspaceReplaySession(state: GexVueReplayState, date: string, scope: "charts" | "gamma", time = "09:30") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Choose a valid session date.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid New York time.");
  const next = setGexVueReplaySession(state, date);
  const window = scope === "charts" ? cmeSessionWindowForDate(next.sessionDate) : null;
  const startMs = window?.startMs ?? next.startMs;
  const endMs = window ? window.endMs - 60 * 60_000 : next.endMs;
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const clockDate = new Date(`${next.sessionDate}T00:00:00Z`);
  // 18:00–23:59 NY belongs to the preceding calendar evening.
  if (scope === "charts" && minute >= 18 * 60) clockDate.setUTCDate(clockDate.getUTCDate() - 1);
  const requested = newYorkSessionTimestamp(clockDate.toISOString().slice(0, 10), minute);
  if (requested < startMs || requested > endMs) throw new Error(scope === "charts" ? "Choose a time in the session (18:00 previous evening–17:00 New York)." : "Choose a time between 09:30 and 16:00 New York.");
  return { ...next, active: true, startMs, endMs, timestampMs: requested, playing: false };
}

/** Count is stable between observations; binary search never selects a future row. */
export function replayObservationCount(rows: readonly { timestamp: number }[], clock: number) {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].timestamp <= clock) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// These source tools expose immutable as-of snapshots, not just an EOD date.
export const WORKSPACE_REPLAY_SNAPSHOT_TOOLS = ["heat-map", "exposure-by-strike", "exposure-by-expiration", "market-map"] as const;

/** These chart engines currently consume the live book/current-only resources. */
export const WORKSPACE_REPLAY_LIVE_ONLY_INDICATORS = new Set([
  "pulling-stacking", "absorption-detector", "iceberg-refresh-detector",
  "liquidity-stop-sweep-detector", "cumulative-iceberg-stop", "book-speed",
  "depth-of-market", "mini-dom", "big-blocks-options", "implied-volatility-rank",
  "classic-gex-profile", "expected-move", "gamma-environment",
]);
