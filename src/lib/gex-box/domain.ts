export type GexBoxSurface = "classic" | "state" | "orderflow" | "research";
export type GexBoxProviderView = Exclude<GexBoxSurface, "research">;
export type ExposureMetric = "gex" | "dex" | "gamma" | "convexity" | "negative_vanna" | "charm";

export type SourceStamp = {
  provider: "gexbot" | "quantdata" | "kwantdesk";
  providerTimestamp: number;
  receivedAt: number;
  session: "LIVE_RTH" | "FROZEN_NEW_YORK_CLOSE" | "DELAYED";
  freshnessMs: number;
  formulaVersion: string | null;
  simulated: boolean;
};

export type AnalyticsInstrument = {
  id: string;
  providerTicker: string;
  displaySymbol: string;
  underlyingSymbol: string;
  assetClass: "index" | "etf" | "future" | "volatility";
  strikeIncrement: number;
  contractMultiplier: number;
};

export type PriceTransform = {
  sourceSymbol: string;
  displaySymbol: string;
  slope: number;
  intercept: number;
  updatedAt: number;
  source: string;
};

export type NormalizedOptionContract = {
  symbol: string;
  underlying: string;
  expiry: string;
  strike: number;
  side: "call" | "put";
  openInterest: number;
  volume: number;
  multiplier: number;
  delta: number | null;
  gamma: number | null;
  vanna: number | null;
  charm: number | null;
  impliedVolatility: number | null;
  source: SourceStamp;
};

export type ExposureValue = {
  metric: ExposureMetric;
  value: number;
  basis: "open_interest" | "volume";
  unit: "usd_per_1pct" | "usd" | "delta_dollars" | "provider_native";
  native: boolean;
};

export type StrikeExposure = {
  strike: number;
  volumeExposure: number;
  openInterestExposure: number;
  priorOpenInterestExposure: number[];
  changeByWindow: Partial<Record<1 | 5 | 10 | 15 | 30, number>>;
};

export type DerivedLevel = {
  kind: "zero_gamma" | "major_positive" | "major_negative" | "spot";
  price: number;
  exposure: number | null;
  basis: "provider" | "calculated";
};

export type LevelFrame = {
  timestamp: number;
  zeroGamma: DerivedLevel | null;
  majorPositive: DerivedLevel | null;
  majorNegative: DerivedLevel | null;
};

export type LadderFrame = {
  timestamp: number;
  instrument: AnalyticsInstrument;
  spot: number;
  strikes: StrikeExposure[];
  totals: { volume: number; openInterest: number };
  levels: LevelFrame;
  source: SourceStamp;
};

export const GEX_BOX_ORDERFLOW_METRICS = [
  "dex_orderflow",
  "gex_orderflow",
  "convexity_orderflow",
  "net_gex",
  "net_convexity",
  "aggregate_dex",
  "net_negative_vanna",
  "net_charm",
] as const;

export type OrderflowMetric = typeof GEX_BOX_ORDERFLOW_METRICS[number];

export type OrderflowPoint = {
  timestamp: number;
  spot: number;
  values: Partial<Record<OrderflowMetric, number>>;
  source: SourceStamp;
};

export type GexStreamEvent =
  | { type: "snapshot"; sequence: number; frame: LadderFrame }
  | { type: "orderflow"; sequence: number; point: OrderflowPoint }
  | { type: "status"; sequence: number; source: SourceStamp };

export const GEX_BOX_INSTRUMENTS: AnalyticsInstrument[] = [
  { id: "NQ_NDX", providerTicker: "NQ_NDX", displaySymbol: "NQ / NDX", underlyingSymbol: "NDX", assetClass: "future", strikeIncrement: 25, contractMultiplier: 100 },
  { id: "ES_SPX", providerTicker: "ES_SPX", displaySymbol: "ES / SPX", underlyingSymbol: "SPX", assetClass: "future", strikeIncrement: 5, contractMultiplier: 100 },
  { id: "NDX", providerTicker: "NDX", displaySymbol: "NDX", underlyingSymbol: "NDX", assetClass: "index", strikeIncrement: 25, contractMultiplier: 100 },
  { id: "QQQ", providerTicker: "QQQ", displaySymbol: "QQQ", underlyingSymbol: "QQQ", assetClass: "etf", strikeIncrement: 1, contractMultiplier: 100 },
  { id: "SPX", providerTicker: "SPX", displaySymbol: "SPX", underlyingSymbol: "SPX", assetClass: "index", strikeIncrement: 5, contractMultiplier: 100 },
  { id: "SPY", providerTicker: "SPY", displaySymbol: "SPY", underlyingSymbol: "SPY", assetClass: "etf", strikeIncrement: 1, contractMultiplier: 100 },
  { id: "RUT", providerTicker: "RUT", displaySymbol: "RUT", underlyingSymbol: "RUT", assetClass: "index", strikeIncrement: 5, contractMultiplier: 100 },
  { id: "IWM", providerTicker: "IWM", displaySymbol: "IWM", underlyingSymbol: "IWM", assetClass: "etf", strikeIncrement: 1, contractMultiplier: 100 },
  { id: "VIX", providerTicker: "VIX", displaySymbol: "VIX", underlyingSymbol: "VIX", assetClass: "volatility", strikeIncrement: 1, contractMultiplier: 100 },
];

export function displayPrice(sourcePrice: number, transform: PriceTransform | null) {
  return transform ? transform.slope * sourcePrice + transform.intercept : sourcePrice;
}
