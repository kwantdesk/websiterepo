import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries } from "./chartIndicatorEngine";

export type EventIndicatorTimeMap = {
  exact: Map<number, number>;
  uniqueSecond: Map<number, number>;
};

/**
 * Relate an event candle's real execution timestamp to the synthetic,
 * sequential second used by Lightweight Charts.
 *
 * Several volume/range bars can close inside one wall-clock second. A map
 * keyed only by that second silently keeps the last bar and drops every other
 * indicator point in it. Exact milliseconds are authoritative; a whole-second
 * fallback is retained only when that second contains exactly one candle.
 */
export function buildEventIndicatorTimeMap(
  candles: Candle[],
  chartTimeBySourceTime: Map<number, number>,
): EventIndicatorTimeMap | null {
  const exact = new Map<number, number>();
  const uniqueSecond = new Map<number, number>();
  const ambiguousSeconds = new Set<number>();

  for (const candle of candles) {
    const chartTime = chartTimeBySourceTime.get(candle.timestamp);
    if (chartTime == null) continue;
    exact.set(candle.timestamp, chartTime);
    const second = Math.floor(candle.timestamp / 1_000);
    if (uniqueSecond.has(second)) {
      uniqueSecond.delete(second);
      ambiguousSeconds.add(second);
    } else if (!ambiguousSeconds.has(second)) {
      uniqueSecond.set(second, chartTime);
    }
  }

  return exact.size ? { exact, uniqueSecond } : null;
}

export function alignIndicatorSeriesToEventBars(
  series: CalculatedIndicatorSeries[],
  map: EventIndicatorTimeMap | null,
) {
  if (!map) return series;
  return series.map((definition) => {
    const alignTime = (time: number) => map.exact.get(Math.round(time * 1_000))
      ?? map.uniqueSecond.get(Math.floor(time));
    let moved = false;
    const data = definition.data.flatMap((point) => {
      const pointTime = Number(point.time);
      const sourceTimestamp = Math.round(pointTime * 1_000);
      const chartTime = map.exact.get(sourceTimestamp) ?? map.uniqueSecond.get(Math.floor(pointTime));
      if (chartTime == null) return [];
      if (chartTime !== pointTime) moved = true;
      return [{ ...point, time: chartTime }];
    });
    const shiftCandle = definition.shiftCandle ? {
      ...definition.shiftCandle,
      signals: definition.shiftCandle.signals.flatMap((signal) => {
        const time = alignTime(signal.time);
        return time == null ? [] : [{ ...signal, time }];
      }),
    } : undefined;
    const gapZones = definition.gapZones ? {
      ...definition.gapZones,
      zones: definition.gapZones.zones.flatMap((zone) => {
        const startTime = alignTime(zone.startTime);
        const endTime = alignTime(zone.endTime);
        return startTime == null ? [] : [{ ...zone, startTime, endTime: endTime ?? startTime }];
      }),
    } : undefined;
    return moved || data.length !== definition.data.length || shiftCandle || gapZones
      ? { ...definition, data, ...(shiftCandle ? { shiftCandle } : {}), ...(gapZones ? { gapZones } : {}) }
      : definition;
  });
}
