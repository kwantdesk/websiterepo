import type { GexMapFrame } from "@/lib/gexMap";

/**
 * Per-strike exposure history for the GEX Map node detail panel.
 *
 * Two properties of the source data make this easy to get wrong, and both
 * produce a number that looks authoritative and is nonsense:
 *
 * 1. Frames are INCREMENTAL. A frame carries only the strikes that changed,
 *    so a strike's value at any instant is its last update at or before that
 *    instant. A strike with no update yet has NO value - it is not zero, and
 *    treating it as zero turns the first real print into an infinite rise.
 *
 * 2. Frames cover ONE SESSION at one-minute resolution. Intraday windows are
 *    genuinely measurable; a 1-day window is not, because yesterday's map is
 *    not in this payload. Falling back to the oldest frame reports the change
 *    since the session open under a "1 day" label - which is how a node that
 *    opened near zero comes to show +1832% for a day it never covered.
 */
export type GexNodeSample = { timestamp: number; value: number };

export type GexNodeChange = {
  windowMs: number;
  /** False when the series does not reach back far enough to measure this. */
  available: boolean;
  /** Signed change in exposure. Null when unavailable. */
  absolute: number | null;
  /**
   * Change relative to the magnitude of the baseline. Null when unavailable,
   * and null when the baseline is too small for a ratio to carry meaning.
   */
  percent: number | null;
  baseline: number | null;
  current: number | null;
};

/**
 * A percentage against a baseline this small is arithmetic, not information:
 * a node that was worth $50k an hour ago and is worth $21m now is "+43,000%",
 * which tells the trader nothing they could not read from the absolute figure.
 */
export const GEX_NODE_PERCENT_BASELINE_FLOOR = 100_000;

/**
 * The value of one strike over the whole retained history, one sample per
 * frame that actually touched it, oldest first.
 */
export function buildGexNodeSeries(
  frames: readonly GexMapFrame[],
  strike: number,
  /** Ignore frames after this instant, so replay cannot read its own future. */
  throughMs: number = Number.POSITIVE_INFINITY,
): GexNodeSample[] {
  const series: GexNodeSample[] = [];
  for (const frame of frames) {
    if (!Number.isFinite(frame.timestamp) || frame.timestamp > throughMs) continue;
    for (const update of frame.updates) {
      if (update.strike !== strike || !Number.isFinite(update.net)) continue;
      series.push({ timestamp: frame.timestamp, value: update.net });
    }
  }
  return series.sort((left, right) => left.timestamp - right.timestamp);
}

/** The strike's value at an instant: its last update at or before it. */
export function gexNodeValueAt(series: readonly GexNodeSample[], atMs: number): number | null {
  let value: number | null = null;
  for (const sample of series) {
    if (sample.timestamp > atMs) break;
    value = sample.value;
  }
  return value;
}

/**
 * Change over one window, or an explicit "not measurable".
 *
 * The window is only honoured when the series genuinely starts at or before
 * its far edge. Anything shorter reports `available: false` rather than
 * silently substituting the oldest sample it happens to hold.
 */
export function gexNodeChangeOver(
  series: readonly GexNodeSample[],
  windowMs: number,
  nowMs?: number,
): GexNodeChange {
  const unavailable: GexNodeChange = {
    windowMs, available: false, absolute: null, percent: null, baseline: null, current: null,
  };
  if (!series.length || !Number.isFinite(windowMs) || windowMs <= 0) return unavailable;
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : series[series.length - 1].timestamp;
  const current = gexNodeValueAt(series, now);
  if (current === null) return unavailable;

  const target = now - windowMs;
  // The series has to PREDATE the window's edge. A series that begins inside
  // the window can only report the change since it began, which is a
  // different measurement wearing this one's label.
  if (series[0].timestamp > target) return { ...unavailable, current };
  const baseline = gexNodeValueAt(series, target);
  if (baseline === null) return { ...unavailable, current };

  const absolute = current - baseline;
  const magnitude = Math.abs(baseline);
  return {
    windowMs,
    available: true,
    absolute,
    // Signed exposure flips sign, so the ratio is taken against the
    // baseline's MAGNITUDE - otherwise a move from -5M to +5M reads as -200%.
    percent: magnitude >= GEX_NODE_PERCENT_BASELINE_FLOOR ? (absolute / magnitude) * 100 : null,
    baseline,
    current,
  };
}

export const GEX_NODE_CHANGE_WINDOWS = [
  { id: "1m", label: "1 min", ms: 60_000, extended: false },
  { id: "5m", label: "5 min", ms: 5 * 60_000, extended: false },
  { id: "10m", label: "10 min", ms: 10 * 60_000, extended: false },
  { id: "15m", label: "15 min", ms: 15 * 60_000, extended: false },
  { id: "1h", label: "1 hour", ms: 60 * 60_000, extended: true },
  { id: "4h", label: "4 hours", ms: 4 * 60 * 60_000, extended: true },
  { id: "1d", label: "1 day", ms: 24 * 60 * 60_000, extended: true },
] as const;

export type GexNodeBias = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

/**
 * A node is only called positive or negative once it carries enough exposure
 * for the sign to mean something. Below that it is noise around zero.
 */
export function gexNodeBias(value: number | null, floor = GEX_NODE_PERCENT_BASELINE_FLOOR): GexNodeBias {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < floor) return "NEUTRAL";
  return value > 0 ? "POSITIVE" : "NEGATIVE";
}

/**
 * Which way the exposure is travelling, read over the shortest window that is
 * actually measurable rather than asserting a direction from one sample.
 */
export function gexNodeTrend(
  series: readonly GexNodeSample[],
  nowMs?: number,
): "INCREASING" | "DECREASING" | "STEADY" | "UNKNOWN" {
  for (const window of [60_000, 5 * 60_000, 15 * 60_000]) {
    const change = gexNodeChangeOver(series, window, nowMs);
    if (!change.available || change.absolute === null) continue;
    const reference = Math.max(Math.abs(change.baseline ?? 0), GEX_NODE_PERCENT_BASELINE_FLOOR);
    // Within a tenth of a percent of the baseline is not a direction.
    if (Math.abs(change.absolute) < reference * 0.001) return "STEADY";
    return change.absolute > 0 ? "INCREASING" : "DECREASING";
  }
  return "UNKNOWN";
}

/** How much history the panel actually holds, for the sparkline's axis. */
export function gexNodeCoverageMs(series: readonly GexNodeSample[]): number {
  if (series.length < 2) return 0;
  return series[series.length - 1].timestamp - series[0].timestamp;
}
