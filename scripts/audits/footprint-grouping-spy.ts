import {createChart as original} from '../../src/lib/lightweightChartsCompat';
export * from '../../src/lib/lightweightChartsCompat';
export function createChart(...args:Parameters<typeof original>){
 const chart=original(...args),add=chart.addCandlestickSeries.bind(chart);
 (window as any).groupChart=chart;
 chart.addCandlestickSeries=options=>{const series=add(options),attach=series.attachPrimitive.bind(series);(window as any).groupSeries=series;
  series.attachPrimitive=primitive=>{if('observePriceScale' in primitive)(window as any).footprint=primitive;return attach(primitive)};return series;};return chart;
}
