import { CHART_INDICATOR_CATALOG, type ChartIndicatorInstance } from "./chartIndicatorCatalog";
import type { CalculatedIndicatorSeries } from "./chartIndicatorEngine";

// These studies report oscillator/flow units, not instrument prices. Keep the
// conventional separate-pane default; moving one onto price owns another scale.
export const MOMENTUM_INDICATOR_IDS = new Set(CHART_INDICATOR_CATALOG
  .filter(indicator => indicator.category === "Momentum").map(indicator => indicator.id));

export function momentumOnChart(instance: ChartIndicatorInstance) {
  return MOMENTUM_INDICATOR_IDS.has(instance.indicatorId) && instance.settings?.chartArea === "chart";
}

export function applyMomentumPlacement(instance: ChartIndicatorInstance, series: CalculatedIndicatorSeries[]) {
  if (!momentumOnChart(instance)) return series;
  return series.map(definition => definition.placement !== "pane" ? definition : {
    ...definition,
    placement: "overlay" as const,
    // MACD/KST plots share a scale. An explicitly independent cycle plot keeps
    // its separate scale, without ever sharing the candle price axis.
    priceScaleId: `momentum-${instance.instanceId}${definition.independentScale ? `-${definition.key}` : ""}`,
    independentScale: true,
    lastValueVisible: false,
  });
}

export function momentumScaleMargins(top: number, bottom: number) {
  // Confine the overlay to the lower part of the actual price plot, above any
  // docked indicators. This changes display placement only, never its values.
  return { top: top + Math.max(0, 1 - top - bottom) * 0.55, bottom };
}
