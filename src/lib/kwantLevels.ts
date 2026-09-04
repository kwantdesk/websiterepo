import type { ChartGammaSourceLevel } from "@/lib/chartGammaLevels";
import type {
  GammaChartInstrument,
  GammaConversionDefinition,
} from "@/lib/chartGammaConversion";
import {
  cashFallbackGammaConversion,
  gammaConversionOptions,
  isNativeGammaConversion,
} from "@/lib/chartGammaConversion";

export const KWANT_LEVELS_SETTINGS_VERSION = 3;

export type KwantLevelsDataSource = "GEX_CALL_MINUS_PUT";

export type KwantLevelsSettings = {
  conversion: string;
  dataSource: KwantLevelsDataSource;
  maxLevels: number;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  showLabels: boolean;
  showEnvironment: boolean;
  useThemeColors: boolean;
  positiveColor: string;
  negativeColor: string;
  magnetColor: string;
  centreColor: string;
};

const finiteBounded = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

/**
 * Normalizes the complete, currently supportable Option Levels contract.
 *
 * DeepCharts also exposes Call/Put volume and proprietary real-time OI modes.
 * Quant Desk deliberately does not relabel a partial consolidated-tape window
 * or dated OI as either of those modes. They can be added when the licensed
 * provider supplies a complete equivalent source.
 */
export function normalizeKwantLevelsSettings(
  input: Record<string, unknown> | null | undefined,
  theme: { upColor: string; downColor: string },
): KwantLevelsSettings {
  const lineStyle = input?.lineStyle;
  return {
    conversion: typeof input?.conversion === "string" ? input.conversion : "AUTO",
    dataSource: "GEX_CALL_MINUS_PUT",
    maxLevels: Math.round(finiteBounded(input?.maxLevels, 14, 4, 24)),
    lineWidth: finiteBounded(input?.lineWidth, 1, 1, 4),
    lineStyle: lineStyle === "solid" || lineStyle === "dotted" ? lineStyle : "dashed",
    showLabels: input?.showLabels !== false,
    showEnvironment: input?.showEnvironment !== false,
    useThemeColors: input?.useThemeColors !== false,
    positiveColor: typeof input?.positiveColor === "string" ? input.positiveColor : theme.upColor,
    negativeColor: typeof input?.negativeColor === "string" ? input.negativeColor : theme.downColor,
    magnetColor: typeof input?.magnetColor === "string" ? input.magnetColor : "#8B5CF6",
    centreColor: typeof input?.centreColor === "string" ? input.centreColor : "#06B6D4",
  };
}

/** Only cash-option sources are valid: the product uses QuantData + Rithmic. */
export function resolveKwantLevelsConversion(
  instrument: GammaChartInstrument,
  requested: unknown,
): GammaConversionDefinition | null {
  const cashOptions = gammaConversionOptions(instrument).filter((candidate) => !isNativeGammaConversion(candidate));
  if (requested !== "AUTO") {
    const exact = cashOptions.find((candidate) => candidate.id === requested);
    if (exact) return exact;
  }
  return cashFallbackGammaConversion(instrument);
}

const primaryKinds = new Set([
  "CALL_WALL",
  "PUT_WALL",
  "GAMMA_MAGNET",
  "GAMMA_ACCELERATOR",
  "GAMMA_CENTRE",
  "HIGH_VOL_LEVEL",
  "ZERO_GAMMA",
  "MAJOR_POSITIVE_OI",
  "MAJOR_POSITIVE_VOLUME",
]);

export function selectKwantLevels(
  levels: ChartGammaSourceLevel[],
  maximum: number,
) {
  const limit = Math.round(finiteBounded(maximum, 14, 4, 24));
  return [...levels]
    .sort((left, right) => (
      Number(primaryKinds.has(right.kind)) - Number(primaryKinds.has(left.kind))
      || left.rank - right.rank
      || Math.abs(right.value ?? 0) - Math.abs(left.value ?? 0)
      || left.price - right.price
    ))
    .slice(0, limit);
}

export function kwantLevelColor(
  kind: ChartGammaSourceLevel["kind"],
  settings: KwantLevelsSettings,
  theme: { upColor: string; downColor: string },
) {
  const positive = settings.useThemeColors ? theme.upColor : settings.positiveColor;
  const negative = settings.useThemeColors ? theme.downColor : settings.negativeColor;
  if (["CALL_WALL", "POSITIVE_GEX", "MAJOR_POSITIVE_OI", "MAJOR_POSITIVE_VOLUME"].includes(kind)) return positive;
  if (["PUT_WALL", "NEGATIVE_GEX"].includes(kind)) return negative;
  if (kind === "GAMMA_CENTRE") return settings.centreColor;
  if (kind === "ZERO_GAMMA") return settings.centreColor;
  if (["HIGH_VOL_LEVEL", "EXPECTED_MOVE_MAX", "EXPECTED_MOVE_MIN"].includes(kind)) return settings.magnetColor;
  return settings.magnetColor;
}
