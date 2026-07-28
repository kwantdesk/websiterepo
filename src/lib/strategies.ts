import { Candle, StrategySignal, getSession } from "./backtester";

export function emaCrossStrategy(
  candles: Candle[],
  index: number,
  indicators: Record<string, unknown>
): StrategySignal {
  const noSignal: StrategySignal = {
    action: null,
    stopLoss: 0,
    takeProfit: 0,
    riskPercent: 1,
  };

  if (index < 52) return noSignal;

  const candle = candles[index];
  const prevCandle = candles[index - 1];
  const session = getSession(candle.timestamp);
  const ema50 = indicators.ema50 as number[];

  if (session !== "LONDON" && session !== "NEW_YORK") return noSignal;

  const priceAboveEma = candle.close > ema50[index];
  const prevBelowEma = prevCandle.close <= ema50[index - 1];

  if (priceAboveEma && prevBelowEma) {
    return {
      action: "LONG",
      stopLoss: 15,
      takeProfit: 30,
      riskPercent: 1,
    };
  }

  const priceBelowEma = candle.close < ema50[index];
  const prevAboveEma = prevCandle.close >= ema50[index - 1];

  if (priceBelowEma && prevAboveEma) {
    return {
      action: "SHORT",
      stopLoss: 15,
      takeProfit: 30,
      riskPercent: 1,
    };
  }

  return noSignal;
}