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
  // NDX/QQQ/SPX/SPY = cash-index sources (QuantData, converted). NQ/ES = native
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
  sessionDate: string;
  environment: {
    gammaRegime: GammaRegime;
    gammaStrength: GammaStrength;
    gammaStateLabel: string;
    regimeStrength: number;
  };
  revision: string;
  sources: ChartGammaSourceSnapshot[];
};


