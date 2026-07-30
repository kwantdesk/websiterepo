import type { Candle } from "@/lib/backtester";

export const LIVE_CHART_CANDLE_EVENT = "kwantdesk:live-chart-candle";
export const DATABENTO_LIVE_TICK_EVENT = "kwantdesk:databento-tick";
export const DATABENTO_LIVE_STATUS_EVENT = "kwantdesk:databento-status";

export type LiveChartCandleDetail = {
  key: string;
  candle: Candle;
};

export type DatabentoLiveStatus = "connecting" | "live" | "reconnecting";

type DatabentoLiveStatusSnapshot = {
  status: DatabentoLiveStatus;
  updatedAt: number;
};

let latestDatabentoLiveStatus: DatabentoLiveStatusSnapshot | null = null;

export function publishDatabentoLiveStatus(status: DatabentoLiveStatus) {
  latestDatabentoLiveStatus = {
    status,
    updatedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATABENTO_LIVE_STATUS_EVENT, {
      detail: status,
    }));
  }
}

export function readDatabentoLiveStatus(maxAgeMs = 30_000) {
  if (
    !latestDatabentoLiveStatus
    || Date.now() - latestDatabentoLiveStatus.updatedAt > maxAgeMs
  ) {
    return null;
  }
  return latestDatabentoLiveStatus.status;
}
