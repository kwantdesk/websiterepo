export const OPTIONS_FLOW_TICKERS = [
  "SPX",
  "SPY",
  "NDX",
  "QQQ",
  "IWM",
  "AAPL",
  "NVDA",
  "TSLA",
  "MSFT",
  "AMZN",
  "META",
  "AMD",
] as const;

export type OptionsFlowTicker = (typeof OPTIONS_FLOW_TICKERS)[number];

export type OptionsFuturesRoot = "ES" | "NQ" | "RTY";
export type CanonicalOptionsSourceSymbol = "QQQ" | "SPY";

/**
 * The product must not compare or label different options books as one Gamma
 * environment. NQ surfaces use QQQ and ES surfaces use SPY everywhere; NDX and
 * SPX remain selectable research instruments on the Gamma page, but they are
 * not the canonical futures-facing regime source.
 */
export function canonicalOptionsSourceForRoot(
  root: Extract<OptionsFuturesRoot, "NQ" | "ES">,
): CanonicalOptionsSourceSymbol {
  return root === "NQ" ? "QQQ" : "SPY";
}
// RATIO/BASIS convert cash-index gamma onto the futures chart. NATIVE computes gamma
// directly from the futures options chain (Databento) in native futures price terms.
export type OptionsFuturesLevelTranslation = "BASIS" | "RATIO" | "NATIVE";

const OPTIONS_FUTURES_RATIO_BOUNDS: Partial<Record<OptionsFlowTicker, readonly [number, number]>> = {
  NDX: [1, 1.02],
  QQQ: [40.9, 41.6],
  SPX: [1, 1.01],
  SPY: [10, 10.15],
  IWM: [8, 12],
};

export function isOptionsFuturesRatioSane(symbol: string, ratio: number) {
  const bounds = OPTIONS_FUTURES_RATIO_BOUNDS[symbol as OptionsFlowTicker];
  return Boolean(bounds && Number.isFinite(ratio) && ratio >= bounds[0] && ratio <= bounds[1]);
}

export const OPTIONS_FLOW_INSTRUMENTS: ReadonlyArray<{
  symbol: OptionsFlowTicker;
  label: string;
  futuresRoot: OptionsFuturesRoot | null;
  levelTranslation: OptionsFuturesLevelTranslation | null;
}> = [
  { symbol: "SPX", label: "S&P 500 Index", futuresRoot: "ES", levelTranslation: "RATIO" },
  { symbol: "SPY", label: "SPDR S&P 500 ETF", futuresRoot: "ES", levelTranslation: "RATIO" },
  { symbol: "NDX", label: "Nasdaq-100 Index", futuresRoot: "NQ", levelTranslation: "RATIO" },
  { symbol: "QQQ", label: "Invesco QQQ", futuresRoot: "NQ", levelTranslation: "RATIO" },
  { symbol: "IWM", label: "Russell 2000 ETF", futuresRoot: "RTY", levelTranslation: "RATIO" },
  { symbol: "AAPL", label: "Apple", futuresRoot: null, levelTranslation: null },
  { symbol: "NVDA", label: "NVIDIA", futuresRoot: null, levelTranslation: null },
  { symbol: "TSLA", label: "Tesla", futuresRoot: null, levelTranslation: null },
  { symbol: "MSFT", label: "Microsoft", futuresRoot: null, levelTranslation: null },
  { symbol: "AMZN", label: "Amazon", futuresRoot: null, levelTranslation: null },
  { symbol: "META", label: "Meta", futuresRoot: null, levelTranslation: null },
  { symbol: "AMD", label: "AMD", futuresRoot: null, levelTranslation: null },
];

export type GreekMode = "GAMMA" | "DELTA" | "VANNA" | "CHARM";

export type GammaRegime = "POSITIVE" | "NEGATIVE" | "NEUTRAL";
export type GammaStrength = "BALANCED" | "WEAK" | "MODERATE" | "STRONG" | "EXTREME";

export type GammaEnvironmentClassification = {
  gammaRegime: GammaRegime;
  gammaStrength: GammaStrength;
  gammaStateLabel: string;
  regimeStrength: number;
};

/**
 * Classifies an asset's gamma balance without comparing incompatible dollar
 * exposure totals. `gross` is the sum of absolute call and put GEX while `net`
 * is their dealer-signed sum, so the resulting concentration is dimensionless.
 */
export function classifyGammaEnvironment(net: number | null, gross: number | null): GammaEnvironmentClassification {
  if (net === null || gross === null || !Number.isFinite(net) || !Number.isFinite(gross) || gross <= 0) {
    return {
      gammaRegime: "NEUTRAL",
      gammaStrength: "BALANCED",
      gammaStateLabel: "NEUTRAL GAMMA · BALANCED",
      regimeStrength: 0,
    };
  }

  const regimeStrength = Math.min(1, Math.abs(net) / gross);
  const gammaRegime: GammaRegime = regimeStrength < 0.005
    ? "NEUTRAL"
    : net > 0
      ? "POSITIVE"
      : "NEGATIVE";
  const gammaStrength: GammaStrength = gammaRegime === "NEUTRAL"
    ? "BALANCED"
    : regimeStrength < 0.05
      ? "WEAK"
      : regimeStrength < 0.15
        ? "MODERATE"
        : regimeStrength < 0.30
          ? "STRONG"
          : "EXTREME";

  return {
    gammaRegime,
    gammaStrength,
    gammaStateLabel: `${gammaRegime} GAMMA · ${gammaStrength}`,
    regimeStrength,
  };
}

export type ExposureStrike = {
  strike: number;
  call: number;
  put: number;
  net: number;
};

export type ExposureExpiry = {
  expiration: string;
  call: number;
  put: number;
  net: number;
};

export type ExposureSummary = {
  mode: GreekMode;
  representation: "PER_ONE_PERCENT_MOVE";
  net: number;
  gross: number;
  strikes: ExposureStrike[];
  expiries: ExposureExpiry[];
};

export type OpenInterestStrike = {
  strike: number;
  callOpenInterest: number;
  putOpenInterest: number;
  totalOpenInterest: number;
};

export type OptionsLevelKind =
  | "CALL_WALL"
  | "PUT_WALL"
  | "GAMMA_MAGNET"
  | "GAMMA_CENTRE"
  | "HIGH_VOL_LEVEL"
  | "ZERO_GAMMA"
  | "MAJOR_POSITIVE_OI"
  | "MAJOR_POSITIVE_VOLUME"
  | "EXPECTED_MOVE_MAX"
  | "EXPECTED_MOVE_MIN"
  | "GEX_CLUSTER"
  | "PUT_SUPPORT"
  | "ZERO_DTE_CALL_WALL"
  | "ZERO_DTE_PUT_WALL"
  | "ZERO_DTE_MAGNET"
  | "ZERO_DTE_PUT_SUPPORT"
  | "ZERO_DTE_MAX_PAIN";

export type OptionsKeyLevel = {
  id: string;
  kind: OptionsLevelKind;
  label: string;
  price: number;
  scope: "FULL_CHAIN" | "ZERO_DTE" | "SESSION";
  metric: "GEX" | "GEX_AND_OPEN_INTEREST" | "OPEN_INTEREST_MAX_PAIN" | "EXPECTED_MOVE_1SIGMA" | "GEX_DEX_COMPOSITE";
  value: number | null;
  rank: number;
  derived: boolean;
  explanation: string;
};

export type OptionsFlowPrint = {
  id: string;
  ticker: string;
  contractType: "CALL" | "PUT" | "UNKNOWN";
  expirationDate: string | null;
  dte: number | null;
  strikePrice: number | null;
  premium: number;
  size: number | null;
  volume: number | null;
  openInterest: number | null;
  optionPrice: number | null;
  stockPrice: number | null;
  impliedVolatility: number | null;
  side: string;
  consolidationType: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  unusual: boolean;
  opening: boolean;
  tradeTime: number;
};

export type FlowBoardItem = {
  ticker: string;
  bullishPremium: number;
  bearishPremium: number;
  netPremium: number;
  totalPremium: number;
  bullishShare: number;
  tradeCount: number;
  volume: number;
};

export type PremiumDriftPoint = {
  timestamp: number;
  callPremium: number;
  putPremium: number;
  cumulativeCallPremium: number;
  cumulativePutPremium: number;
  stockPrice: number | null;
};

export type IntradayExposurePoint = {
  timestamp: number;
  call: number;
  put: number;
  net: number;
  gross: number;
};

export type IntradayExposureSeries = {
  mode: GreekMode;
  expiration: string;
  aggregationPeriod: "1m";
  points: IntradayExposurePoint[];
  latestStrikes: ExposureStrike[];
  lookbacks: Array<{
    minutes: 5 | 15 | 30;
    strikes: ExposureStrike[];
  }>;
};

export type OptionsPositioningPulsePayload = {
  symbol: string;
  source: "KwantData";
  asOf: string;
  refreshAfterMs: number;
  status: "LIVE" | "DELAYED" | "LAST_SESSION";
  session: {
    marketOpen: boolean;
    sessionDate: string;
  };
  mode: GreekMode;
  expiration: string;
  series: IntradayExposureSeries;
  rateLimitRemaining: number | null;
};

export type GammaChangeWindow = {
  minutes: 1 | 5 | 15 | 30;
  strike: number;
  change: number;
  previousValue: number;
  currentValue: number;
  state: "POSITIVE_BUILD" | "NEGATIVE_BUILD" | "POSITIVE_UNWIND" | "NEGATIVE_UNWIND";
};

export type VolatilitySkewPoint = {
  strike: number;
  callIv: number | null;
  putIv: number | null;
};

export type TradeSidePremiumSummary = {
  callBought: number;
  callSold: number;
  putBought: number;
  putSold: number;
  neutral: number;
  longOptionPremium: number;
  shortOptionPremium: number;
  netLongPremium: number;
  longShare: number | null;
};

export type ExpectedMoveRange = {
  method: "QD_PRIOR_IV_ONE_SIGMA" | "PRIOR_REALIZED_RANGE";
  anchorPrice: number;
  anchorLabel: "SESSION_OPEN" | "LATEST_PRICE";
  annualizedIv: number;
  movePercent: number;
  moveDollars: number;
  min: number;
  max: number;
  sourceExpiration: string | null;
  approximate: boolean;
  exactMenthorQEquivalent: false;
};

export type DteGammaBucket = {
  label: "0-5 DTE" | "6-20 DTE" | ">20 DTE";
  minDte: number;
  maxDte: number | null;
  call: number;
  put: number;
  net: number;
  gross: number;
};

export type PutCallVolumeSummary = {
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  putCallRatio: number | null;
  callPremium: number;
  putPremium: number;
};

export type VolatilityTermPoint = {
  expiration: string;
  dte: number;
  strike: number;
  atmIv: number;
  callIv: number | null;
  putIv: number | null;
};

export type VolatilitySkewSummary = {
  expiration: string;
  dte: number;
  put25DeltaIv: number;
  call25DeltaIv: number;
  difference: number;
  relativeBias: number;
  state: "PUT_BIAS" | "CALL_BIAS" | "BALANCED";
};

export type MarketMapIntelligence = {
  expectedMove: ExpectedMoveRange | null;
  dealerPositioning: {
    netGex: number | null;
    netDex: number | null;
    frontExpiryNetGex: number | null;
    frontExpiryNetDex: number | null;
    frontExpiryGexChange1h: number | null;
    frontExpiryDexChange1h: number | null;
    lastFrontExpiryGammaFlipAt: number | null;
    dteGamma: DteGammaBucket[];
  };
  putCallVolume: PutCallVolumeSummary | null;
  volatility: {
    atmIv30d: number | null;
    historicalVol21d: number | null;
    ivRank: number | null;
    ivPercentile: number | null;
    ivHistorySessions: number;
    vrp: number | null;
    normalizedVrp: number | null;
    volatilityState: "RICH" | "FAIR" | "DISCOUNTED" | "UNAVAILABLE";
    skew0Dte: VolatilitySkewSummary | null;
    skew30Dte: VolatilitySkewSummary | null;
    termStructure: VolatilityTermPoint[];
    termStructureState: "CONTANGO" | "FLAT" | "BACKWARDATION" | "UNAVAILABLE";
  };
};

export type PositioningIntelligence = {
  scope: "FRONT_EXPIRY";
  expiration: string | null;
  aggregationPeriod: "1m";
  strikeRange: { min: number; max: number } | null;
  history: Record<GreekMode, IntradayExposureSeries | null>;
  majorPositiveGamma: { strike: number; value: number } | null;
  majorNegativeGamma: { strike: number; value: number } | null;
  gammaChange: GammaChangeWindow[];
  volatilitySkew: VolatilitySkewPoint[];
  tradeSidePremium: TradeSidePremiumSummary | null;
  methodology: {
    exposureSource: "KwantData Interval Map";
    classificationSource: "Kwant Data proprietary model";
    classificationConfidence: "PROPRIETARY";
    note: string;
  };
};

export type OptionsCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OptionsPriceMode = "CASH" | "FUTURES";

export type OptionsMarketData = {
  requestedMode: OptionsPriceMode;
  mode: OptionsPriceMode;
  provider: "KwantData" | "Massive" | "Databento" | "Rithmic" | "dxFeed";
  status: "LIVE" | "DELAYED" | "LAST_SESSION" | "UNAVAILABLE";
  symbol: string;
  futuresRoot: OptionsFuturesRoot | null;
  asOf: string;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  basisToOptionsUnderlying: number | null;
  levelPriceScale: number;
  stale: boolean;
  fallback: boolean;
  detail: string;
  candles: OptionsCandle[];
};

export type OptionsMarketPulsePayload = {
  symbol: string;
  asOf: string;
  refreshAfterMs: number;
  marketData: OptionsMarketData;
  rateLimitRemaining: number | null;
};

export type OptionsFlowPayload = {
  symbol: string;
  source: "KwantData";
  asOf: string;
  refreshAfterMs: number;
  snapshotMode: "LIVE" | "NEW_YORK_EOD";
  session: {
    marketOpen: boolean;
    sessionDate: string;
  };
  stockPrice: number | null;
  stockPriceAsOf: string | null;
  environment: {
    gammaRegime: GammaRegime;
    gammaStrength: GammaStrength;
    gammaStateLabel: string;
    regimeStrength: number;
    volatilityState: "COMPRESSION" | "BALANCED" | "EXPANSION RISK";
    ivRank: number | null;
    callIv: number | null;
    putIv: number | null;
    netPremium: number;
    bullishShare: number | null;
  };
  levels: {
    callWall: number | null;
    putWall: number | null;
    gammaHvl: number | null;
    gammaMagnet: number | null;
    gammaCenter: number | null;
    majorPositiveOi: number | null;
    majorPositiveVolume: number | null;
    frontExpiration: string | null;
    zeroDteAvailable: boolean;
    zeroDteCallWall: number | null;
    zeroDtePutWall: number | null;
    zeroDteGammaMagnet: number | null;
    zeroDteMaxPain: number | null;
    putSupport: number[];
    zeroDtePutSupport: number[];
    keyLevels: OptionsKeyLevel[];
  };
  exposures: Record<GreekMode, ExposureSummary | null>;
  openInterest: OpenInterestStrike[];
  zeroDteGamma: ExposureSummary | null;
  zeroDteOpenInterest: OpenInterestStrike[];
  positioning: PositioningIntelligence;
  marketMap: MarketMapIntelligence;
  drift: PremiumDriftPoint[];
  flow: OptionsFlowPrint[];
  flowBoard: FlowBoardItem[];
  candles: OptionsCandle[];
  marketData: OptionsMarketData;
  rateLimitRemaining: number | null;
  errors: string[];
};
