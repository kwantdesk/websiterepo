import { cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";
import { newYorkSessionTimestamp, setGexVueReplaySession, type GexVueReplayState } from "@/lib/gexVueReplay";

export type WorkspaceReplayClock = { sessionDate: string; timestampMs: number };

export function workspaceReplayClockParts(timestampMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(timestampMs);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return { date: `${read("year")}-${read("month")}-${read("day")}`, hour: read("hour"), minute: read("minute") };
}

/** Session labels remain exchange trading dates, independent of display zone. */
export function workspaceReplaySessionBounds(state: GexVueReplayState, date: string, scope: "charts" | "gamma") {
  const day = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error("Choose a valid session date.");
  const next = setGexVueReplaySession(state, date);
  const window = scope === "charts" ? cmeSessionWindowForDate(next.sessionDate) : null;
  const startMs = window?.startMs ?? next.startMs;
  const endMs = window ? window.endMs - 60 * 60_000 : next.endMs;
  return { ...next, startMs, endMs };
}

export function selectWorkspaceReplaySession(state: GexVueReplayState, date: string, scope: "charts" | "gamma", time = "09:30", timeZone = "America/New_York") {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid start time.");
  const next = workspaceReplaySessionBounds(state, date, scope);
  const { startMs, endMs } = next;
  // Validate the actual IANA zone instead of silently treating bad input as UTC.
  try { workspaceReplayClockParts(startMs, timeZone); } catch { throw new Error("Choose a valid time zone."); }
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const clockDate = new Date(`${next.sessionDate}T00:00:00Z`);
  // 18:00–23:59 NY belongs to the preceding calendar evening.
  if (scope === "charts" && minute >= 18 * 60) clockDate.setUTCDate(clockDate.getUTCDate() - 1);
  let requested = newYorkSessionTimestamp(clockDate.toISOString().slice(0, 10), minute);
  if (timeZone !== "America/New_York") {
    // A session can cross midnight in any selected zone. Try only its actual
    // local dates, then round-trip every offset candidate. No fixed offsets,
    // invented DST gap times or arbitrary local-calendar date substitution.
    const dates = new Set([workspaceReplayClockParts(startMs, timeZone).date, workspaceReplayClockParts(endMs, timeZone).date]);
    const matches = new Set<number>();
    for (const localDate of dates) {
      const wallMs = Date.parse(`${localDate}T${time}:00Z`);
      for (const probe of [startMs, endMs, wallMs - 86_400_000, wallMs, wallMs + 86_400_000]) {
        const local = workspaceReplayClockParts(probe, timeZone);
        const offsetMs = Date.parse(`${local.date}T${local.hour}:${local.minute}:00Z`) - Math.floor(probe / 60_000) * 60_000;
        const candidate = wallMs - offsetMs;
        if (candidate < startMs || candidate > endMs) continue;
        const roundTrip = workspaceReplayClockParts(candidate, timeZone);
        if (roundTrip.date === localDate && `${roundTrip.hour}:${roundTrip.minute}` === time) matches.add(candidate);
      }
    }
    if (matches.size > 1) throw new Error("This clock time occurs twice in the session. Choose UTC to select an exact time.");
    requested = matches.size ? [...matches][0] : Number.NaN;
  }
  if (!Number.isFinite(requested) || requested < startMs || requested > endMs) throw new Error(timeZone === "America/New_York"
    ? scope === "charts" ? "Choose a time in the session (18:00 previous evening–17:00 New York)." : "Choose a time between 09:30 and 16:00 New York."
    : "Choose a start time within the session range shown in your selected time zone.");
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
