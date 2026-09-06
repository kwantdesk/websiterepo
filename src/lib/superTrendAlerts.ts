import type { SuperTrendPoint } from "./superTrend";

export type SuperTrendAlertFrame = {
  /** Must change with instrument, timeframe, numerical settings or history replacement. */
  scopeKey: string;
  /** False during history loading, replay, closed market, disabled alerts or disconnected feed. */
  live: boolean;
  /** Actual received trade timestamp (ms), not candle-open time or render time. */
  sourceTimestamp: number;
  now: number;
  point?: SuperTrendPoint;
};

/** Per-instance, bounded alert state. Never use chart render/theme clocks as feed evidence. */
export class SuperTrendAlertTracker {
  private scope = "";
  private time = -Infinity;
  private sourceTime = -Infinity;
  private direction: SuperTrendPoint["direction"] | undefined;
  private emitted = new Set<SuperTrendPoint["direction"]>();

  /** Establish history silently without replaying alerts. Same-bar dedup survives reconciliation. */
  seed(scopeKey: string, point: SuperTrendPoint | null) {
    if (!point) { this.scope = ""; this.direction = undefined; this.emitted.clear(); return; }
    if (this.scope !== scopeKey || this.time !== point.time) this.emitted.clear();
    this.scope = scopeKey; this.time = point.time; this.direction = point.direction;
    this.emitted.add(point.direction);
  }

  update(frame: SuperTrendAlertFrame): SuperTrendPoint | null {
    const point = frame.point;
    const valid = frame.live && point !== undefined
      && [frame.now, frame.sourceTimestamp, point.time, point.value].every(Number.isFinite)
      && frame.now - frame.sourceTimestamp >= -1000
      && frame.now - frame.sourceTimestamp <= 15000;
    if (!valid) {
      this.scope = ""; this.direction = undefined; this.time = -Infinity;
      this.sourceTime = -Infinity; this.emitted.clear();
      return null;
    }
    if (this.scope !== frame.scopeKey || this.direction === undefined || point.breakBefore || point.time < this.time) {
      this.scope = frame.scopeKey; this.time = point.time; this.direction = point.direction;
      this.sourceTime = frame.sourceTimestamp; this.emitted = new Set([point.direction]);
      return null;
    }
    // Re-rendering, theme changes and stale frames cannot invent a trade event.
    if (frame.sourceTimestamp <= this.sourceTime) return null;
    this.sourceTime = frame.sourceTimestamp;
    if (point.time > this.time) { this.time = point.time; this.emitted.clear(); }
    const changed = point.direction !== this.direction;
    this.direction = point.direction;
    if (!changed || this.emitted.has(point.direction)) return null;
    this.emitted.add(point.direction);
    return point;
  }
}
