export type MarketIndexDefinition = {
  symbol: "VIX" | "VXN";
  providerTicker: `I:${string}`;
  displayName: string;
  exchange: "CBOE";
  family: "S&P 500" | "Nasdaq-100";
  defaultBroker: "Market Index";
};

export const MARKET_INDEX_DEFINITIONS = [
  {
    symbol: "VIX",
    providerTicker: "I:VIX",
    displayName: "Cboe S&P 500 Volatility Index",
    exchange: "CBOE",
    family: "S&P 500",
    defaultBroker: "Market Index",
  },
  {
    symbol: "VXN",
    providerTicker: "I:VXN",
    displayName: "Cboe Nasdaq-100 Volatility Index",
    exchange: "CBOE",
    family: "Nasdaq-100",
    defaultBroker: "Market Index",
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
