import type {
  GammaRegime,
  GammaStrength,
  OptionsFuturesRoot,
} from "@/lib/optionsFlow";

export type ChartGammaSourceLevelKind =
  | "CALL_WALL"
  | "PUT_WALL"
  | "GAMMA_MAGNET"
  | "GAMMA_ACCELERATOR"
  | "GAMMA_CENTRE"
  | "HIGH_VOL_LEVEL"
  | "ZERO_GAMMA"
  | "MAJOR_POSITIVE_OI"
  | "MAJOR_POSITIVE_VOLUME"
  | "POSITIVE_GEX"
  | "NEGATIVE_GEX"
  | "EXPECTED_MOVE_MAX"
  | "EXPECTED_MOVE_MIN";

export type ChartGammaSourceLevel = {
  id: string;
  kind: ChartGammaSourceLevelKind;
  label: string;
  price: number;
  value: number | null;
  rank: number;
  expiryScope?: "NEAR_TERM_7D" | "FULL_CHAIN" | "ZERO_DTE";
  dominantExpiry?: string | null;
  regime?: "POSITIVE" | "NEGATIVE" | "UNKNOWN";
  signConvention?: string;
};

const GAMMA_LEVEL_KIND_PRIORITY: Record<ChartGammaSourceLevelKind, number> = {
  CALL_WALL: 100,
  PUT_WALL: 100,
  ZERO_GAMMA: 95,
  HIGH_VOL_LEVEL: 94,
  GAMMA_CENTRE: 90,
  MAJOR_POSITIVE_OI: 85,
  MAJOR_POSITIVE_VOLUME: 84,
  EXPECTED_MOVE_MAX: 80,
  EXPECTED_MOVE_MIN: 80,
  POSITIVE_GEX: 20,
  NEGATIVE_GEX: 20,
  GAMMA_MAGNET: 10,
  GAMMA_ACCELERATOR: 96,
};

/**
 * Collapses gamma references that resolve to the same tradable tick. Converting
 * cash-index levels onto futures can make previously distinct source strikes land
 * on one price; rendering each one separately produces duplicated lines and labels.
 */
export function mergeGammaLevelsAtSamePrice(
  levels: ChartGammaSourceLevel[],
  tickSize = 0.25,
) {
  const safeTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  const grouped = new Map<number, ChartGammaSourceLevel>();

  for (const level of levels) {
    if (!Number.isFinite(level.price) || level.price <= 0) continue;
    const tick = Math.round(level.price / safeTick);
    const price = tick * safeTick;
    const existing = grouped.get(tick);
    if (!existing) {
      grouped.set(tick, { ...level, price });
      continue;
    }

    const labels = new Set([
      ...existing.label.split(" / ").map((label) => label.trim()).filter(Boolean),
      ...level.label.split(" / ").map((label) => label.trim()).filter(Boolean),
    ]);
    const primary = GAMMA_LEVEL_KIND_PRIORITY[level.kind] > GAMMA_LEVEL_KIND_PRIORITY[existing.kind]
      ? level
      : existing;
    grouped.set(tick, {
      ...primary,
      id: `${existing.id}-${level.id}`,
      price,
      label: [...labels].join(" / "),
      value: Math.abs(level.value ?? 0) > Math.abs(existing.value ?? 0)
        ? level.value
        : existing.value,
      rank: Math.min(existing.rank, level.rank),
    });
  }

  return [...grouped.values()];
}

export type ChartGammaSourceSnapshot = {
  // NDX/QQQ/SPX/SPXW/SPY = cash-index sources (KwantData, converted). NQ/ES = native
  // futures-options gamma computed directly from the chain (Databento, no conversion).
  symbol: "NDX" | "QQQ" | "SPX" | "SPXW" | "SPY" | "NQ" | "ES";
  stockPrice: number;
  revision: string;
  validationStrikes: number[];
  levels: ChartGammaSourceLevel[];
  cage?: {
    regime: "POSITIVE" | "NEGATIVE" | "UNKNOWN";
    flip: number | null;
    crossings: number[];
    flipNote: string | null;
    expiryScope: "NEAR_TERM_7D" | "FULL_CHAIN" | "ZERO_DTE";
    signConvention: string;
  };
};

export type ChartGammaPositioningStrike = {
  sourceStrike: number;
  futuresEquivalent: number;
  call: number;
  put: number;
  net: number;
};

export type ChartGammaPositioningSnapshot = {
  sourceSymbol: "NDX" | "QQQ" | "SPX" | "SPXW" | "SPY";
  futuresRoot: Extract<OptionsFuturesRoot, "NQ" | "ES">;
  expiration: string | null;
  asOf: string;
  status: "LIVE" | "HISTORICAL_INTRADAY" | "NEW_YORK_EOD";
  sourcePrice: number;
  futuresPrice: number;
  priceScale: number;
  totals: {
    call: number;
    put: number;
    net: number;
    gross: number;
  };
  strikes: ChartGammaPositioningStrike[];
  lookbacks: Array<{
    minutes: 5 | 15 | 30;
    strikes: ChartGammaPositioningStrike[];
  }>;
};

export type ChartGammaLevelsPayload = {
  root: Extract<OptionsFuturesRoot, "NQ" | "ES">;
  requestedSource: ChartGammaSourceSnapshot["symbol"];
  checkedAt: string;
  refreshAfterMs: number;
  marketOpen: boolean;
  snapshotMode?: "LIVE" | "NEW_YORK_EOD" | "HISTORICAL_INTRADAY";
  sessionDate: string;
  environment: {
    gammaRegime: GammaRegime;
    gammaStrength: GammaStrength;
    gammaStateLabel: string;
    regimeStrength: number;
  };
  revision: string;
  sources: ChartGammaSourceSnapshot[];
  /**
   * Native futures gamma is preferred. When the native CME options chain is
   * temporarily unavailable, the server can return a cash-index gamma map
   * calibrated onto the matching futures price so charts do not go blank.
   */
  dataOrigin?: "NATIVE_FUTURES" | "CASH_INDEX" | "CASH_CALIBRATED_FALLBACK";
  calibrationSource?: ChartGammaSourceSnapshot["symbol"];
  levelPriceScale?: number;
  positioning?: ChartGammaPositioningSnapshot;
};
