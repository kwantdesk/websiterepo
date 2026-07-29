import type { Candle } from "@/lib/backtester";

export const LIVE_CHART_CANDLE_EVENT = "kwantdesk:live-chart-candle";

export type LiveChartCandleDetail = {
  key: string;
  candle: Candle;
};
