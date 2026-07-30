import type { Candle } from "@/lib/backtester";

export const LIVE_CHART_CANDLE_EVENT = "kwantdesk:live-chart-candle";
export const DATABENTO_LIVE_TICK_EVENT = "kwantdesk:databento-tick";
export const DATABENTO_LIVE_STATUS_EVENT = "kwantdesk:databento-status";

export type LiveChartCandleDetail = {
  key: string;
  candle: Candle;
};

export type DatabentoLiveStatus = "connecting" | "live" | "reconnecting";
