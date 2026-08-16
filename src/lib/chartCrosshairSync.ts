import type { Candle } from "@/lib/backtester";
import { normalizePaperSymbol } from "@/lib/paperTrading";

export const CHART_CROSSHAIR_SYNC_STORAGE_KEY = "kwantdesk:chart-crosshair-sync:v1";
export const CHART_CROSSHAIR_SYNC_TOGGLE_EVENT = "kwantdesk:chart-crosshair-sync-toggle";
export const CHART_CROSSHAIR_SYNC_MOVE_EVENT = "kwantdesk:chart-crosshair-sync-move";

export type ChartCrosshairSyncScope = "matching" | "gamvue";

export type ChartCrosshairSyncToggle = {
  scope: ChartCrosshairSyncScope;
  enabled: boolean;
};

export type ChartCrosshairSyncMove = {
  sourceChartId: string;
  scope: ChartCrosshairSyncScope;
  instrumentKey: string;
  sourceTimestampMs: number | null;
  price: number | null;
  referencePrice: number | null;
  visible: boolean;
};

export function chartCrosshairInstrumentKey(symbol: string | null | undefined) {
  return normalizePaperSymbol(symbol ?? "");
}

function crosshairSyncStorageKey(scope: ChartCrosshairSyncScope) {
  return scope === "gamvue"
    ? `${CHART_CROSSHAIR_SYNC_STORAGE_KEY}:gamvue`
    : CHART_CROSSHAIR_SYNC_STORAGE_KEY;
}

export function readChartCrosshairSyncEnabled(scope: ChartCrosshairSyncScope = "matching") {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(crosshairSyncStorageKey(scope)) === "true";
  } catch {
    return false;
  }
}

export function saveChartCrosshairSyncEnabled(
  enabled: boolean,
  scope: ChartCrosshairSyncScope = "matching",
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(crosshairSyncStorageKey(scope), String(enabled));
  } catch {
    // Crosshair linking still works for the active tab when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent<ChartCrosshairSyncToggle>(CHART_CROSSHAIR_SYNC_TOGGLE_EVENT, {
    detail: { scope, enabled },
  }));
}

export function resolveSyncedChartCandle(sourceTimestampMs: number, candles: Candle[]) {
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

  return resolvedIndex < 0 ? null : candles[resolvedIndex];
}

/**
 * Preserve the pointer's percentage displacement from the source candle when
 * projecting it onto a differently priced GAM VUE instrument.
 */
export function resolveEquivalentCrosshairPrice(
  sourcePrice: number,
  sourceReferencePrice: number,
  targetReferencePrice: number,
) {
  if (
    !Number.isFinite(sourcePrice)
    || !Number.isFinite(sourceReferencePrice)
    || !Number.isFinite(targetReferencePrice)
    || sourceReferencePrice === 0
  ) return null;
  const equivalent = targetReferencePrice * (sourcePrice / sourceReferencePrice);
  return Number.isFinite(equivalent) ? equivalent : null;
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
  const candle = resolveSyncedChartCandle(sourceTimestampMs, candles);
  if (!candle) return null;
  const candleTimestamp = candle.timestamp;
  return chartTimeBySourceTime.get(candleTimestamp)
    ?? Math.floor(candleTimestamp / 1_000);
}
