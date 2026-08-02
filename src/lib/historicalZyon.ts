import type { Candle } from "@/lib/backtester";

export type HistoricalZyonLevelFamily = "gamma" | "quant" | "valueArea";

export type HistoricalZyonLevel = {
  family: HistoricalZyonLevelFamily;
  label: string;
  price: number;
  visible: boolean;
};

export type HistoricalZyonZone = {
  family: "quant";
  label: string;
  low: number;
  high: number;
  visible: boolean;
};

export type HistoricalZyonPriceWindow = {
  window: "5M" | "15M" | "30M" | "1H" | "4H" | "1D";
  from: string;
  to: string;
  bars: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
};

export type HistoricalZyonReplayInput = {
  mode: "HISTORICAL_REPLAY";
  replayId: string;
  root: "NQ" | "ES";
  instrument: "NQ" | "MNQ" | "ES" | "MES";
  asOf: string;
  replayStartedAt: string;
  replayTimeZone: string;
  timeframe: string;
  playing: boolean;
  speed: number;
  currentPrice: number | null;
  priceWindows: HistoricalZyonPriceWindow[];
  recentCandles: Candle[];
  levels: HistoricalZyonLevel[];
  zones: HistoricalZyonZone[];
};
