export const INDICATOR_HISTORY_DAY_MS = 86_400_000;

export function indicatorHistoryDays(settings?: Record<string, unknown>) {
  if (settings?.indicatorHistoryMode !== "manual") return null;
  const requested = Number(settings.historyDaysLimit ?? 5);
  return Number.isFinite(requested) ? Math.min(365, Math.max(1, Math.round(requested))) : 5;
}

export function indicatorHistoryStart(
  settings: Record<string, unknown> | undefined,
  firstCandleMs: number | undefined,
  anchorMs: number,
) {
  const days = indicatorHistoryDays(settings);
  return Math.max(firstCandleMs ?? -Infinity,
    days === null ? -Infinity : anchorMs - days * INDICATOR_HISTORY_DAY_MS);
}
