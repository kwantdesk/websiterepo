import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import { aggregateCandlesByMilliseconds } from "@/lib/chartOverlays";
import { applyMarketTradesToEventBars } from "@/lib/eventBars";

export const CANDLESTICK_BAR_SETTINGS_VERSION = 1;

export type CandlestickBarParameterType = "minutes" | "vol-bars" | "range";

export type CandlestickBarSettings = {
  parameterType: CandlestickBarParameterType;
  parameter1: number;
  parameter2: number;
  positiveColor: string;
  negativeColor: string;
  filled: boolean;
  candleWidth: number;
  borderWidth: 1 | 2 | 3 | 4;
  opacity: number;
  showVerticalLineOnClose: boolean;
  useThemeColors: boolean;
};

export const CANDLESTICK_BAR_DEFAULTS: CandlestickBarSettings = {
  parameterType: "minutes",
  parameter1: 15,
  parameter2: 4,
  positiveColor: "#22C55E",
  negativeColor: "#EF4444",
  filled: true,
  candleWidth: 86,
  borderWidth: 1,
  opacity: 68,
  showVerticalLineOnClose: false,
  useThemeColors: true,
};

const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function normalizeCandlestickBarSettings(
  input: Record<string, unknown> | null | undefined,
  theme?: { upColor: string; downColor: string },
): CandlestickBarSettings {
  const parameterType = input?.parameterType === "range" || input?.parameterType === "vol-bars"
    ? input.parameterType
    : "minutes";
  const useThemeColors = input?.useThemeColors !== false;
  return {
    parameterType,
    parameter1: Math.round(bounded(input?.parameter1, 15, 1, 100_000)),
    parameter2: Math.round(bounded(input?.parameter2, 4, 1, 100_000)),
    positiveColor: useThemeColors && theme ? theme.upColor : String(input?.positiveColor ?? theme?.upColor ?? CANDLESTICK_BAR_DEFAULTS.positiveColor),
    negativeColor: useThemeColors && theme ? theme.downColor : String(input?.negativeColor ?? theme?.downColor ?? CANDLESTICK_BAR_DEFAULTS.negativeColor),
    filled: input?.filled !== false,
    candleWidth: bounded(input?.candleWidth, 86, 10, 100),
    borderWidth: Math.round(bounded(input?.borderWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    opacity: bounded(input?.opacity, 68, 5, 100),
    showVerticalLineOnClose: input?.showVerticalLineOnClose === true,
    useThemeColors,
  };
}

function exactExecutionTape(trades: readonly InstitutionalTrade[]) {
  return trades
    .filter((trade) => !trade.flowOnly && Number.isFinite(trade.timestamp) && Number.isFinite(trade.close) && trade.close > 0)
    .map((trade) => ({
      timestamp: trade.timestamp,
      price: trade.close,
      size: Math.max(0, Number(trade.volume) || 0),
      trades: Math.max(1, Number(trade.trades) || 1),
      delta: Number.isFinite(Number(trade.delta)) ? Number(trade.delta) : Number(trade.askVolume ?? 0) - Number(trade.bidVolume ?? 0),
    }))
    .sort((left, right) => left.timestamp - right.timestamp);
}

/**
 * Builds the independent candle overlay. Time candles can safely use the
 * authoritative loaded OHLC history; price target/range modes require exact
 * executions and return no bars rather than inventing intrabar paths.
 */
export function buildCandlestickBarCandles(args: {
  candles: readonly Candle[];
  trades: readonly InstitutionalTrade[];
  symbol: string;
  settings?: Record<string, unknown> | null;
}) {
  const settings = normalizeCandlestickBarSettings(args.settings);
  if (settings.parameterType === "minutes") {
    return aggregateCandlesByMilliseconds([...args.candles], settings.parameter1 * 60_000);
  }
  const tape = exactExecutionTape(args.trades);
  if (!tape.length) return [];
  const timeframe = settings.parameterType === "range"
    ? `${settings.parameter1}r`
    : `${settings.parameter1}/${settings.parameter2}VB`;
  return applyMarketTradesToEventBars([], tape, timeframe, args.symbol, 25_000);
}
