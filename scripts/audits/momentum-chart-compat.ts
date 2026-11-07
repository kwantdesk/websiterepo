import { createChart as originalCreateChart } from "../../src/lib/lightweightChartsCompat";
export * from "../../src/lib/lightweightChartsCompat";
export function createChart(...args: Parameters<typeof originalCreateChart>) {
  const chart = originalCreateChart(...args);
  const audit = { chart, series: [] as any[] };
  (window as any).momentumChartAudit = audit;
  for (const method of ["addCandlestickSeries", "addLineSeries", "addHistogramSeries"] as const) {
    const add = chart[method].bind(chart) as any;
    (chart as any)[method] = (options: any) => {
      const series = add(options);
      audit.series.push({ method, series });
      return series;
    };
  }
  return chart;
}
