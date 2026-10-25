import { calculateIndicatorSeries, type IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { CHART_INDICATOR_BY_ID, type ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { Candle } from "@/lib/backtester";

// These studies use the identical normal-chart calculator and generic plot
// surfaces. Native execution/book/options primitives need their own source and
// projection adapters; exposing an Add button must never manufacture those inputs.
export const KWANTY_PRICE_STUDIES = new Set([
  "moving-average", "relative-strength-index-rsi", "rate-of-change-roc", "momentum-indicator", "macd-indicator",
  "average-true-range-atr", "standard-deviation", "bollinger-bands", "donchian-channel", "keltner-channel",
  "commodity-channel-index-cci", "aroon-up-down", "aroon-oscillator", "awesome-oscillator", "stochastic-oscillator",
  "williams-r", "average-directional-index-adx", "parabolic-sar", "linear-regression", "regression-channel",
  "inverse-cyber-cycle", "tillson-t3", "know-sure-thing-kst", "super-trend", "super-trend-difference",
  "absolute-levels", "price-movement-levels", "average-daily-range-target", "pivot-points",
  "vwap", "vwap-envelopes", "rolling-vwap", "chaikin-accumulation-distribution", "volume",
]);
const volumeStudies = new Set(["vwap", "vwap-envelopes", "rolling-vwap", "chaikin-accumulation-distribution", "volume"]);
export function kwantyIndicatorReason(id: string, candles: readonly Candle[]) {
  const definition = CHART_INDICATOR_BY_ID.get(id);
  if (!definition) return "Unknown indicator.";
  if (definition.requiresOrderFlow) return "Requires classified executions or volume-at-price, not options positioning snapshots. Use a normal traded-instrument chart.";
  if (!KWANTY_PRICE_STUDIES.has(id)) return "This study needs its native chart source/projection adapter. It remains available on Charts.";
  if (volumeStudies.has(id) && !candles.some(candle => typeof candle.volume === "number" && candle.volume > 0)) return "Requires reported traded volume. A cash index does not supply it.";
  return null;
}
export function calculateKwantyStudies(instances: ChartIndicatorInstance[], candles: Candle[], theme: IndicatorTheme, instrument: string, replayTimestampMs?: number | null) {
  return instances.filter(instance => instance.enabled).map(instance => {
    const reason = kwantyIndicatorReason(instance.indicatorId, candles);
    const series = reason ? [] : calculateIndicatorSeries(instance, candles, theme, { instrument, replayTimestampMs });
    return { instance, title: CHART_INDICATOR_BY_ID.get(instance.indicatorId)?.name ?? instance.indicatorId, reason, series };
  });
}
