import type { Candle } from "@/lib/backtester";
import { normalizePaperSymbol } from "@/lib/paperTrading";

export const CHART_CROSSHAIR_SYNC_STORAGE_KEY = "kwantdesk:chart-crosshair-sync:v1";
export const CHART_CROSSHAIR_SYNC_TOGGLE_EVENT = "kwantdesk:chart-crosshair-sync-toggle";
export const CHART_CROSSHAIR_SYNC_MOVE_EVENT = "kwantdesk:chart-crosshair-sync-move";

export type ChartCrosshairSyncMove = {
  sourceChartId: string;
  instrumentKey: string;
  sourceTimestampMs: number | null;
  price: number | null;
  visible: boolean;
};

export function chartCrosshairInstrumentKey(symbol: string | null | undefined) {
  return normalizePaperSymbol(symbol ?? "");
}

export function readChartCrosshairSyncEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHART_CROSSHAIR_SYNC_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveChartCrosshairSyncEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHART_CROSSHAIR_SYNC_STORAGE_KEY, String(enabled));
  } catch {
    // Crosshair linking still works for the active tab when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent<boolean>(CHART_CROSSHAIR_SYNC_TOGGLE_EVENT, {
    detail: enabled,
  }));
}

/**
 * Convert an absolute market timestamp into the candle time used by a receiving
 * chart. Time charts resolve to the containing candle; event charts resolve to
 * the most recent event bar at or before that timestamp.
 */
export function resolveSyncedChartTime(
  sourceTimestampMs: number,
  candles: Candle[],
  chartTimeBySourceTime: ReadonlyMap<number, number>,
) {
  if (!Number.isFinite(sourceTimestampMs) || candles.length === 0) return null;

  let low = 0;
  let high = candles.length - 1;
  let resolvedIndex = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (candles[middle].timestamp <= sourceTimestampMs) {
      resolvedIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (resolvedIndex < 0) return null;
  const candleTimestamp = candles[resolvedIndex].timestamp;
  return chartTimeBySourceTime.get(candleTimestamp)
    ?? Math.floor(candleTimestamp / 1_000);
}
