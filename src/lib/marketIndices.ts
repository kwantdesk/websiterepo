export type MarketInstrumentSymbol =
  | "VIX" | "VXN" | "SPX" | "SPXW" | "SPY" | "NDX" | "QQQ" | "IWM"
  | "AAPL" | "NVDA" | "TSLA" | "MSFT" | "AMZN" | "META" | "AMD";

export type MarketIndexDefinition = {
  symbol: MarketInstrumentSymbol;
  providerTicker: string;
  providerKind: "INDEX" | "STOCK";
  displayName: string;
  exchange: "CBOE" | "NASDAQ" | "NYSE ARCA";
  family: string;
  group: "Volatility Indices" | "Options Underlyings";
  defaultBroker: "Market Index";
};

export const MARKET_INDEX_DEFINITIONS = [
  {
    symbol: "VIX",
    providerTicker: "I:VIX",
    providerKind: "INDEX",
    displayName: "Cboe S&P 500 Volatility Index",
    exchange: "CBOE",
    family: "S&P 500",
    group: "Volatility Indices",
    defaultBroker: "Market Index",
  },
  {
    symbol: "VXN",
    providerTicker: "I:VXN",
    providerKind: "INDEX",
    displayName: "Cboe Nasdaq-100 Volatility Index",
    exchange: "CBOE",
    family: "Nasdaq-100",
    group: "Volatility Indices",
    defaultBroker: "Market Index",
  },
  {
    symbol: "SPX", providerTicker: "I:SPX", providerKind: "INDEX",
    displayName: "S&P 500 Index", exchange: "CBOE", family: "S&P 500",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "SPXW", providerTicker: "I:SPX", providerKind: "INDEX",
    displayName: "S&P 500 Weeklys", exchange: "CBOE", family: "S&P 500",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "SPY", providerTicker: "SPY", providerKind: "STOCK",
    displayName: "SPDR S&P 500 ETF Trust", exchange: "NYSE ARCA", family: "S&P 500",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "NDX", providerTicker: "I:NDX", providerKind: "INDEX",
    displayName: "Nasdaq-100 Index", exchange: "NASDAQ", family: "Nasdaq-100",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "QQQ", providerTicker: "QQQ", providerKind: "STOCK",
    displayName: "Invesco QQQ Trust", exchange: "NASDAQ", family: "Nasdaq-100",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "IWM", providerTicker: "IWM", providerKind: "STOCK",
    displayName: "iShares Russell 2000 ETF", exchange: "NYSE ARCA", family: "Russell 2000",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "AAPL", providerTicker: "AAPL", providerKind: "STOCK",
    displayName: "Apple", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "NVDA", providerTicker: "NVDA", providerKind: "STOCK",
    displayName: "NVIDIA", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "TSLA", providerTicker: "TSLA", providerKind: "STOCK",
    displayName: "Tesla", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "MSFT", providerTicker: "MSFT", providerKind: "STOCK",
    displayName: "Microsoft", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "AMZN", providerTicker: "AMZN", providerKind: "STOCK",
    displayName: "Amazon", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "META", providerTicker: "META", providerKind: "STOCK",
    displayName: "Meta Platforms", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
  {
    symbol: "AMD", providerTicker: "AMD", providerKind: "STOCK",
    displayName: "Advanced Micro Devices", exchange: "NASDAQ", family: "Single Stock",
    group: "Options Underlyings", defaultBroker: "Market Index",
  },
] as const satisfies readonly MarketIndexDefinition[];

const MARKET_INDEX_BY_SYMBOL = new Map<string, MarketIndexDefinition>(
  MARKET_INDEX_DEFINITIONS.map((definition) => [definition.symbol, definition] as const),
);

export function getMarketIndexDefinition(symbol: string) {
  return MARKET_INDEX_BY_SYMBOL.get(symbol.trim().toUpperCase()) ?? null;
}

export function isMarketIndexSymbol(symbol: string) {
  return Boolean(getMarketIndexDefinition(symbol));
}
