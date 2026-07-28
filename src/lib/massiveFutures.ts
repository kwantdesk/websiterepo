export type MassiveFuturesExchange = "CME" | "COMEX";

export type MassiveFuturesSymbolDefinition = {
  symbol: string;
  productCode: string;
  displayName: string;
  exchange: MassiveFuturesExchange;
  delayed: boolean;
  aliases: string[];
  defaultBroker: "Massive";
};

export const KWANTIFY_MASSIVE_FUTURES_TOP10 = [
  {
    symbol: "MNQ",
    productCode: "MNQ",
    displayName: "Micro E-mini Nasdaq-100",
    exchange: "CME",
    delayed: true,
    aliases: ["MNQ", "MICRO NASDAQ", "MICRO E-MINI NASDAQ"],
    defaultBroker: "Massive",
  },
  {
    symbol: "NQ",
    productCode: "NQ",
    displayName: "E-mini Nasdaq-100",
    exchange: "CME",
    delayed: true,
    aliases: ["NQ", "NASDAQ FUTURES", "E-MINI NASDAQ"],
    defaultBroker: "Massive",
  },
  {
    symbol: "MES",
    productCode: "MES",
    displayName: "Micro E-mini S&P 500",
    exchange: "CME",
    delayed: true,
    aliases: ["MES", "MICRO S&P", "MICRO E-MINI S&P"],
    defaultBroker: "Massive",
  },
  {
    symbol: "ES",
    productCode: "ES",
    displayName: "E-mini S&P 500",
    exchange: "CME",
    delayed: true,
    aliases: ["ES", "S&P FUTURES", "E-MINI S&P"],
    defaultBroker: "Massive",
  },
  {
    symbol: "MYM",
    productCode: "MYM",
    displayName: "Micro E-mini Dow",
    exchange: "CME",
    delayed: true,
    aliases: ["MYM", "MICRO DOW", "MICRO E-MINI DOW"],
    defaultBroker: "Massive",
  },
  {
    symbol: "YM",
    productCode: "YM",
    displayName: "E-mini Dow",
    exchange: "CME",
    delayed: true,
    aliases: ["YM", "DOW FUTURES", "E-MINI DOW"],
    defaultBroker: "Massive",
  },
  {
    symbol: "M2K",
    productCode: "M2K",
    displayName: "Micro E-mini Russell 2000",
    exchange: "CME",
    delayed: true,
    aliases: ["M2K", "MICRO RUSSELL", "MICRO E-MINI RUSSELL"],
    defaultBroker: "Massive",
  },
  {
    symbol: "RTY",
    productCode: "RTY",
    displayName: "E-mini Russell 2000",
    exchange: "CME",
    delayed: true,
    aliases: ["RTY", "RUSSELL FUTURES", "E-MINI RUSSELL"],
    defaultBroker: "Massive",
  },
  {
    symbol: "MGC",
    productCode: "MGC",
    displayName: "Micro Gold",
    exchange: "COMEX",
    delayed: true,
    aliases: ["MGC", "MICRO GOLD"],
    defaultBroker: "Massive",
  },
  {
    symbol: "GC",
    productCode: "GC",
    displayName: "Gold",
    exchange: "COMEX",
    delayed: true,
    aliases: ["GC", "GOLD FUTURES"],
    defaultBroker: "Massive",
  },
] as const satisfies readonly MassiveFuturesSymbolDefinition[];

export const MASSIVE_FUTURES_MAJOR_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1D"] as const;

const MASSIVE_FUTURES_BY_SYMBOL = new Map(
  KWANTIFY_MASSIVE_FUTURES_TOP10.flatMap((definition) => {
    const allKeys = [definition.symbol, definition.productCode, ...definition.aliases];
    return allKeys.map((key) => [key.trim().toUpperCase(), definition] as const);
  }),
);

export function getMassiveFuturesSymbolDefinition(symbol: string) {
  return MASSIVE_FUTURES_BY_SYMBOL.get(symbol.trim().toUpperCase()) ?? null;
}

export function isMassiveFuturesSymbol(symbol: string) {
  return Boolean(getMassiveFuturesSymbolDefinition(symbol));
}

export function getMassiveFuturesSymbols() {
  return KWANTIFY_MASSIVE_FUTURES_TOP10.map((definition) => definition.symbol);
}

