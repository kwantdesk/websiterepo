import type {
  GammaRegime,
  GammaStrength,
  OptionsFuturesRoot,
} from "@/lib/optionsFlow";

export type ChartGammaSourceLevelKind =
  | "CALL_WALL"
  | "PUT_WALL"
  | "GAMMA_MAGNET"
  | "GAMMA_CENTRE"
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
};

export type ChartGammaSourceSnapshot = {
  // NDX/QQQ/SPX/SPY = cash-index sources (KwantData, converted). NQ/ES = native
  // futures-options gamma computed directly from the chain (Databento, no conversion).
  symbol: "NDX" | "QQQ" | "SPX" | "SPY" | "NQ" | "ES";
  stockPrice: number;
  revision: string;
  validationStrikes: number[];
  levels: ChartGammaSourceLevel[];
};

export type ChartGammaLevelsPayload = {
  root: Extract<OptionsFuturesRoot, "NQ" | "ES">;
  requestedSource: ChartGammaSourceSnapshot["symbol"];
  checkedAt: string;
  refreshAfterMs: number;
  marketOpen: boolean;
  snapshotMode?: "LIVE" | "NEW_YORK_EOD";
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
};
