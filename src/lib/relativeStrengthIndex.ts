import type { KstAverage } from "@/lib/knowSureThing";

export const RSI_DEFAULTS = {
  length: 14,
  showAverage: true,
  averageType: "simple",
  averageLength: 20,
  showLevels: true,
  overboughtLevel: 70,
  oversoldLevel: 30,
  levelLineWidth: 1,
} as const;

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

export function rsiSettings(settings: Record<string, unknown> = {}) {
  const { averageType } = settings;
  const type: KstAverage = averageType === "exponential" || averageType === "triangular" || averageType === "weighted"
    ? averageType : RSI_DEFAULTS.averageType;
  return {
    length: boundedInteger(settings.length, RSI_DEFAULTS.length, 2, 500),
    showAverage: settings.showAverage !== false,
    averageType: type,
    averageLength: boundedInteger(settings.averageLength, RSI_DEFAULTS.averageLength, 1, 500),
    showLevels: settings.showLevels !== false,
    overboughtLevel: boundedInteger(settings.overboughtLevel, RSI_DEFAULTS.overboughtLevel, 0, 100),
    oversoldLevel: boundedInteger(settings.oversoldLevel, RSI_DEFAULTS.oversoldLevel, 0, 100),
    levelLineWidth: boundedInteger(settings.levelLineWidth, RSI_DEFAULTS.levelLineWidth, 1, 4) as 1 | 2 | 3 | 4,
  };
}
