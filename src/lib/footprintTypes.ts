export type FootprintAggressorSide = "buy" | "sell" | "unknown";

export type FootprintContentMode =
  | "bid-ask"
  | "delta"
  | "volume"
  | "volume-delta"
  | "trades"
  | "bid-ask-histogram"
  | "volume-histogram"
  | "delta-histogram"
  | "ladder";

export type FootprintVisualizationMode =
  | "solid"
  | "heatmap"
  | "histogram"
  | "heatmap-histogram"
  | "text-only";

export type FootprintScaleMode =
  | "per-bar"
  | "all-loaded"
  | "visible-region"
  | "fixed-maximum";

export type FootprintNumberFormat = "full" | "compact" | "automatic";
export type FootprintComparisonMode = "diagonal" | "same-row" | "delta-percent";

export interface FootprintTrade {
  instrument: string;
  timestamp: number;
  sequence?: number | string;
  arrivalIndex: number;
  price: number;
  size: number;
  side: FootprintAggressorSide;
  tickSize: number;
  bidPrice?: number;
  askPrice?: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  tradeCount: number;
}

export interface FootprintPriceLevel {
  tickIndex: number;
  price: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  bidTrades: number;
  askTrades: number;
  unknownTrades: number;
  classifiedVolume: number;
  totalVolume: number;
  delta: number;
  deltaPercent: number;
  isPoc: boolean;
  isValueArea: boolean;
  isBidImbalance: boolean;
  isAskImbalance: boolean;
  isStackedBidImbalance: boolean;
  isStackedAskImbalance: boolean;
  stackedBidVolume: number;
  stackedAskVolume: number;
  isUnfinishedAuctionHigh: boolean;
  isUnfinishedAuctionLow: boolean;
  isMaxBid: boolean;
  isMaxAsk: boolean;
  isMaxVolume: boolean;
  isMaxPositiveDelta: boolean;
  isMaxNegativeDelta: boolean;
  isMaxTrades: boolean;
}

export interface FootprintBarModel {
  id: string;
  instrument: string;
  startTime: number;
  endTime: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  openTick: number;
  highTick: number;
  lowTick: number;
  closeTick: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  classifiedVolume: number;
  totalVolume: number;
  delta: number;
  deltaPercent: number;
  deltaOpen: number;
  deltaHigh: number;
  deltaLow: number;
  deltaClose: number;
  bidTrades: number;
  askTrades: number;
  unknownTrades: number;
  totalTrades: number;
  levels: Map<number, FootprintPriceLevel>;
  rows: FootprintPriceLevel[];
  pocTick: number | null;
  valueAreaHighTick: number | null;
  valueAreaLowTick: number | null;
  maxBidTick: number | null;
  maxAskTick: number | null;
  maxVolumeTick: number | null;
  maxPositiveDeltaTick: number | null;
  maxNegativeDeltaTick: number | null;
  maxTradesTick: number | null;
  vwap: number | null;
  isClosed: boolean;
  hasPriceLevelFlow: boolean;
}

export interface FootprintAnalyticsSettings {
  valueAreaPercent: number;
  comparisonMode: FootprintComparisonMode;
  imbalanceRatio: number;
  minimumDominantVolume: number;
  minimumDifference: number;
  ignoreZeroValues: boolean;
  stackedImbalanceLevels: number;
  unfinishedAuctionEnabled: boolean;
  unfinishedAuctionMinimumVolume: number;
}

export function createEmptyFootprintLevel(tickIndex: number, tickSize: number): FootprintPriceLevel {
  return {
    tickIndex,
    price: tickIndex * tickSize,
    bidVolume: 0,
    askVolume: 0,
    unknownVolume: 0,
    bidTrades: 0,
    askTrades: 0,
    unknownTrades: 0,
    classifiedVolume: 0,
    totalVolume: 0,
    delta: 0,
    deltaPercent: 0,
    isPoc: false,
    isValueArea: false,
    isBidImbalance: false,
    isAskImbalance: false,
    isStackedBidImbalance: false,
    isStackedAskImbalance: false,
    stackedBidVolume: 0,
    stackedAskVolume: 0,
    isUnfinishedAuctionHigh: false,
    isUnfinishedAuctionLow: false,
    isMaxBid: false,
    isMaxAsk: false,
    isMaxVolume: false,
    isMaxPositiveDelta: false,
    isMaxNegativeDelta: false,
    isMaxTrades: false,
  };
}
