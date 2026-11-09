/** Resolve automatic grouping from the scale actually painted by the chart. */
export function footprintGroupTicks(settings: Record<string, unknown>, pixelsPerTick: number | null, bodyTicks: number): number {
  const manual = Math.max(1, Math.round(Number(settings.manualTicks ?? 1)));
  if (settings.groupingMode === "manual" || pixelsPerTick === null || !Number.isFinite(pixelsPerTick) || pixelsPerTick <= 0) return manual;
  const targetPixels = Math.max(8, Number(settings.fontSize ?? 10) * 1.05);
  const factor = Math.max(0.5, Math.min(4, Number(settings.autoGroupFactor ?? 1)));
  let grouped = Math.max(1, Math.ceil(targetPixels / Math.max(0.01, pixelsPerTick) * factor));
  if (settings.groupMode === "open-close") grouped = Math.max(grouped, Math.ceil(bodyTicks / 18));
  return Math.min(100, grouped);
}
