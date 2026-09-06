import type { CalculatedIndicatorSeries } from "./chartIndicatorEngine";

export const SUPER_TREND_LIVE_PLOT_EVENT = "kwantdesk:super-trend-live-plot";
export type SuperTrendLivePlotDetail = { chartKey: string; instanceId: string; series?: CalculatedIndicatorSeries; reset?: boolean };

/** A bounded tail, keyed by actual chart time. Styles/numerical configuration never leak across scopes. */
export class SuperTrendPlotBuffer {
  private styleKey: string | undefined;
  private points = new Map<number, CalculatedIndicatorSeries["data"][number]>();
  push(series: CalculatedIndicatorSeries) {
    if (this.styleKey !== series.superTrendStyleKey) {
      this.points.clear(); this.styleKey = series.superTrendStyleKey;
    }
    for (const point of series.data) {
      if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) continue;
      this.points.set(point.time, point);
    }
    while (this.points.size > 1500) this.points.delete(this.points.keys().next().value!);
  }
  merge(base: CalculatedIndicatorSeries): CalculatedIndicatorSeries {
    if (!this.points.size || !base.superTrendStyleKey || base.superTrendStyleKey !== this.styleKey) return base;
    const baseLastTime = base.data.at(-1)?.time ?? -Infinity;
    // Completed history is authoritative. Only its forming edge and later live points overlay it.
    for (const time of this.points.keys()) if (time < baseLastTime) this.points.delete(time);
    if (!this.points.size) return base;
    const values = new Map(base.data.map(point => [point.time, point]));
    for (const [time, point] of this.points) values.set(time, point);
    return { ...base, data: [...values.values()].sort((a, b) => a.time - b.time).slice(-1500) };
  }
  clear() { this.points.clear(); this.styleKey = undefined; }
}
