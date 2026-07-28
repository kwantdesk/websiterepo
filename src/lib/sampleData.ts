import { Candle } from "./backtester";

export function generateSampleData(days: number = 60): Candle[] {
  const candles: Candle[] = [];
  const startDate = new Date("2025-01-01T00:00:00Z").getTime();
  const interval = 5 * 60 * 1000;
  const candlesPerDay = 288;

  let price = 18500;
  let trend = 1;
  let trendDuration = 0;

  for (let d = 0; d < days; d++) {
    if (trendDuration <= 0) {
      trend = Math.random() > 0.45 ? 1 : -1;
      trendDuration = Math.floor(Math.random() * 50) + 20;
    }
    trendDuration--;

    for (let c = 0; c < candlesPerDay; c++) {
      const timestamp = startDate + (d * candlesPerDay + c) * interval;
      const hour = new Date(timestamp).getUTCHours();

      let volatility = 3;
      if (hour >= 8 && hour < 16) volatility = 12;
      if (hour >= 13 && hour < 22) volatility = 18;

      const trendBias = trend * volatility * 0.15;
      const noise = (Math.random() - 0.5) * volatility;
      const strongMove = Math.random() < 0.03;
      const moveSize = strongMove ? volatility * 2.5 * trend : 0;

      const change = trendBias + noise + moveSize;
      const open = price;
      const close = price + change;

      const wickMultiplier = strongMove ? 0.2 : 0.6;
      const high = Math.max(open, close) + Math.random() * volatility * wickMultiplier;
      const low = Math.min(open, close) - Math.random() * volatility * wickMultiplier;

      candles.push({
        timestamp,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.floor(Math.random() * 10000) + 1000,
      });

      price = close;
      if (price < 16000) trend = 1;
      if (price > 21000) trend = -1;
    }
  }

  return candles;
}