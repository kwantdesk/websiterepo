import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart as createChartV5,
  createSeriesMarkers,
  type IChartApi as IChartApiV5,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";

/**
 * Transitional Lightweight Charts v4 -> v5 facade.
 *
 * KwantDesk has several live indicators and primitives that were written against
 * the v4 series constructors. Keeping the old method names at this boundary lets
 * those consumers migrate independently while every chart runs on the v5 engine.
 * New code should use `chart.addSeries(...)` directly.
 */
type LegacyCandlestickSeries = ISeriesApi<"Candlestick"> & {
  setMarkers(markers: SeriesMarker<Time>[]): void;
};

export type IChartApi = IChartApiV5 & {
  addCandlestickSeries(options?: unknown): LegacyCandlestickSeries;
  addHistogramSeries(options?: unknown): ISeriesApi<"Histogram">;
  addLineSeries(options?: unknown): ISeriesApi<"Line">;
};

export function createChart(
  ...args: Parameters<typeof createChartV5>
): IChartApi {
  const chart = createChartV5(...args) as IChartApi;

  chart.addCandlestickSeries = (options) => {
    const series = chart.addSeries(CandlestickSeries, options as never) as LegacyCandlestickSeries;
    const markerPrimitive = createSeriesMarkers(series, []);
    series.setMarkers = (markers) => markerPrimitive.setMarkers(markers);
    return series;
  };
  chart.addHistogramSeries = (options) =>
    chart.addSeries(HistogramSeries, options as never);
  chart.addLineSeries = (options) =>
    chart.addSeries(LineSeries, options as never);

  return chart;
}

export { LineStyle, LineType } from "lightweight-charts";
export type {
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

// v5 renamed these plugin interfaces. Aliasing them here keeps existing KwantDesk
// primitives source-compatible until each one is moved to the new drawing engine.
export type {
  IPrimitivePaneRenderer as ISeriesPrimitivePaneRenderer,
  IPrimitivePaneView as ISeriesPrimitivePaneView,
} from "lightweight-charts";
