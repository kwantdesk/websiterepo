"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  FolderPlus,
  Grid3X3,
  Info,
  LineChart,
  List,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Search,
  Settings,
  Settings2,
  Sparkles,
  Star,
  Store,
  Trash2,
  Trophy,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { runBacktest, runStrategyCode, type BacktestConfig, type BacktestResult, type Candle, type Trade } from "@/lib/backtester";
import { generateSampleData } from "@/lib/sampleData";
import { createClient } from "@/lib/supabase";
import { clearSavedStrategiesRaw, loadSavedStrategiesRaw, saveSavedStrategiesRaw } from "@/lib/automation";
import { defaultChartSettings, extractUserChartSettings, loadStoredChartSettings, saveStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import {
  createPaperTradingAccount,
  loadPaperTradingAccounts,
  savePaperTradingAccounts,
  parseMoney as parsePaperMoney,
  type PaperTradingAccountRecord,
} from "@/lib/paperAccounts";
import {
  getMassiveFuturesSymbolDefinition,
  getMassiveFuturesSymbols,
  isMassiveFuturesSymbol,
} from "@/lib/massiveFutures";
import AppSidebar from "@/components/AppSidebar";
import ChartCreateAlertModal from "@/components/alerts/ChartCreateAlertModal";
import {
  getExpirationLabel,
  getTriggerModeLabel,
  loadChartAlerts,
  saveChartAlerts,
  type ChartAlertRecord,
} from "@/lib/chartAlerts";

const Chart = dynamic(() => import("@/components/Chart"), { ssr: false });

const BOTTOM_PANEL_MIN_HEIGHT = 150;
const BOTTOM_PANEL_DEFAULT_HEIGHT = 300;
const BOTTOM_PANEL_COLLAPSED_HEIGHT = 40;
const BOTTOM_PANEL_COLLAPSE_SNAP_HEIGHT = 72;
const CHART_TOP_BAR_HEIGHT = 52;
const RIGHT_PANEL_MIN_WIDTH = 240;
const RIGHT_PANEL_MAX_WIDTH = 500;
const RIGHT_PANEL_DEFAULT_WIDTH = 280;
const RIGHT_PANEL_COLLAPSE_SNAP_WIDTH = 120;

type Message = { role: "user" | "assistant"; content: string };
type StrategyVersion = { code: string; timestamp: Date | string; version: number };
type ChartTemplate = { name: string; settings: ChartSettings };
type WatchlistItem = {
  key: string;
  symbol: string;
  broker: string;
  displayName?: string;
  exchange?: string;
  delayed?: boolean;
  marketType?: "spot" | "futures";
  lastPrice: number;
  openPrice: number;
  bid: number;
  ask: number;
  mid: number;
  change: number;
  changePercent: number;
  flash: "up" | "down" | null;
};
type WatchlistSection = { id: string; name: string; symbols: string[] };
type InstrumentPickerItem = { key: string; symbol: string; fullName: string; category: string; broker: string };
type Broker = {
  name: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeClassName: string;
  badgeTextClassName?: string;
  badgeStyle?: CSSProperties;
  type: "paper" | "capital" | "ctrader" | "oanda" | "tradovate" | "binance" | "soon";
};
type BrokerConnectionState = {
  broker: string;
  mode: "Live" | "Demo";
  ownership: "paper" | "shared" | "user";
  connectionState?: "connected" | "not_ready" | "broken";
  connectedAt: string;
  accountId?: string | number;
  accountLabel?: string;
};
type StrategyItem = {
  id: string;
  name: string;
  code: string;
  language: string;
  addedToChart: boolean;
  visible: boolean;
  lastModified: Date | string;
  versions?: StrategyVersion[];
  currentVersion?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  totalPnl?: number;
};

type WorkspaceLayout = "single" | "split-vertical" | "split-horizontal" | "quad";
type WorkspacePane = {
  id: string;
  symbol: string;
  broker: string;
  timeframe: string;
  period: string;
  watchlistKey: string;
};

type CTraderStatusAccount = {
  accountId: number;
  isLive?: boolean;
  traderLogin?: number;
  brokerName?: string;
  brokerTitle?: string;
  accountNumber?: string;
};

type CTraderStatusResponse = {
  linked: boolean;
  provider: string;
  permissionScope?: string;
  accounts?: CTraderStatusAccount[];
};

const CTRADER_LOGIN_TO_BROKER: Record<number, string> = {
  5289101: "Pepperstone",
  9029766: "IC Markets",
  1110550: "FP Markets",
  2127793: "BlackBull Markets",
  10639945: "FxPro",
};

const FALLBACK_CTRADER_BROKER_NAMES = ["Pepperstone", "IC Markets", "FP Markets", "BlackBull Markets", "FxPro"] as const;
const OANDA_INSTRUMENT_MAP: Record<string, string> = {
  EURUSD: "EUR_USD",
  GBPUSD: "GBP_USD",
  USDJPY: "USD_JPY",
  AUDUSD: "AUD_USD",
  XAUUSD: "XAU_USD",
  NAS100: "NAS100_USD",
  "S&P500": "SPX500_USD",
  GER40: "DE30_EUR",
  UK100: "UK100_GBP",
  NIKKEI: "JP225_USD",
  BTCUSD: "BCO_USD",
  OIL: "BCO_USD",
  DOW30: "US30_USD",
};
const OANDA_GRANULARITY_MAP: Record<string, string> = {
  "1m": "M1", "5m": "M5", "15m": "M15", "30m": "M30",
  "1h": "H1", "2h": "H2", "4h": "H4", "1D": "D", "1W": "W", "1M": "M",
};
const DEFAULT_WORKSPACE_PANES: WorkspacePane[] = [
  { id: "pane-1", symbol: "NAS100", broker: "OANDA", timeframe: "5m", period: "1Y", watchlistKey: makeWatchlistKey("NAS100", "OANDA") },
  { id: "pane-2", symbol: "XAUUSD", broker: "OANDA", timeframe: "5m", period: "1Y", watchlistKey: makeWatchlistKey("XAUUSD", "OANDA") },
  { id: "pane-3", symbol: "EURUSD", broker: "OANDA", timeframe: "5m", period: "1Y", watchlistKey: makeWatchlistKey("EURUSD", "OANDA") },
  { id: "pane-4", symbol: "GER40", broker: "OANDA", timeframe: "5m", period: "1Y", watchlistKey: makeWatchlistKey("GER40", "OANDA") },
];

function normalizeWorkspacePane(pane: Partial<WorkspacePane>, fallback: WorkspacePane): WorkspacePane {
  return {
    id: pane.id ?? fallback.id,
    symbol: pane.symbol ?? fallback.symbol,
    broker: pane.broker ?? fallback.broker,
    timeframe: pane.timeframe ?? fallback.timeframe,
    period: pane.period ?? "1Y",
    watchlistKey: pane.watchlistKey ?? makeWatchlistKey(pane.symbol ?? fallback.symbol, pane.broker ?? fallback.broker),
  };
}

function makeWatchlistKey(symbol: string, broker: string) {
  return `${broker}::${symbol}`;
}

function createWatchlistItem(symbol: string, broker: string, detail?: { price: string; change: string }) {
  const mid = detail ? Number(detail.price.replace(/,/g, "")) : 0;
  const changePercent = detail ? Number(detail.change.replace("%", "")) : 0;
  const massiveDefinition = broker === "Massive" ? getMassiveFuturesSymbolDefinition(symbol) : null;
  return {
    key: makeWatchlistKey(symbol, broker),
    symbol,
    broker,
    displayName: massiveDefinition?.displayName,
    exchange: massiveDefinition?.exchange,
    delayed: massiveDefinition?.delayed,
    marketType: massiveDefinition ? ("futures" as const) : ("spot" as const),
    lastPrice: mid,
    openPrice: mid,
    bid: mid ? mid - 0.1 : 0,
    ask: mid ? mid + 0.1 : 0,
    mid,
    change: mid * (changePercent / 100),
    changePercent,
    flash: null,
  };
}

function getStaticWatchlistDetail(
  symbol: string,
  broker: string,
  details: Record<string, { price: string; change: string; up: boolean }>,
) {
  return broker === "OANDA" || broker === "Massive" ? details[symbol] : undefined;
}

function resolveCTraderBrokerName(account: CTraderStatusAccount) {
  if (account.brokerName?.trim()) return account.brokerName.trim();
  if (account.brokerTitle?.trim()) return account.brokerTitle.trim();
  if (typeof account.traderLogin === "number" && CTRADER_LOGIN_TO_BROKER[account.traderLogin]) {
    return CTRADER_LOGIN_TO_BROKER[account.traderLogin];
  }
  if (typeof account.traderLogin === "number") {
    return `cTrader ${account.traderLogin}`;
  }
  return `cTrader ${account.accountId}`;
}

function formatCTraderAccountLabel(account: CTraderStatusAccount) {
  const brokerName = resolveCTraderBrokerName(account);
  const accountMarker =
    account.accountNumber?.trim() ||
    (typeof account.traderLogin === "number" ? String(account.traderLogin) : String(account.accountId));
  const environment = account.isLive ? "Live" : "Demo";
  return `${brokerName} ${environment} ${accountMarker}`;
}

const presetColors = [
  "#00F5A0", "#22C55E", "#3B82F6", "#8B5CF6",
  "#EC4899", "#EF4444", "#F97316", "#EAB308",
  "#06B6D4", "#FFFFFF", "#71717A", "#000000",
];

const defaultWatchlistSections: WatchlistSection[] = [
  {
    id: "default",
    name: "Main",
    symbols: [
      makeWatchlistKey("NAS100", "OANDA"),
      makeWatchlistKey("XAUUSD", "OANDA"),
      makeWatchlistKey("EURUSD", "OANDA"),
      makeWatchlistKey("GBPUSD", "OANDA"),
      makeWatchlistKey("GER40", "OANDA"),
      makeWatchlistKey("S&P500", "OANDA"),
      makeWatchlistKey("UK100", "OANDA"),
    ],
  },
];

const watchlistFlagColors = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#8B5CF6", "#06B6D4", "#EC4899", "#F97316"];

const defaultBacktestSettings = {
  initialCapital: 10000,
  baseCurrency: "USD",
  orderSizeType: "percent_equity",
  orderSizeValue: 10,
  pyramiding: 0,
  commissionType: "percent",
  commissionValue: 0.04,
  slippage: 2,
  marginLong: 100,
  marginShort: 100,
  fillOrders: "next_bar_open",
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
};

function getPeriodConfig(period: string): { from: string; label: string } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return {
    "1D": { from: new Date(now - 1 * day).toISOString(), label: "1D" },
    "5D": { from: new Date(now - 5 * day).toISOString(), label: "5D" },
    "1M": { from: new Date(now - 30 * day).toISOString(), label: "1M" },
    "3M": { from: new Date(now - 90 * day).toISOString(), label: "3M" },
    "6M": { from: new Date(now - 180 * day).toISOString(), label: "6M" },
    "1Y": { from: new Date(now - 365 * day).toISOString(), label: "1Y" },
    All: { from: new Date(now - 4 * 365 * day).toISOString(), label: "All" },
  }[period] ?? { from: new Date(now - 365 * day).toISOString(), label: "1Y" };
}

function isTooManyCandles(period: string, timeframe: string) {
  if (timeframe === "1m") return ["6M", "1Y", "All"].includes(period);
  if (timeframe === "5m") return period === "All";
  return false;
}

function getTimeframeMs(timeframe: string) {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const map: Record<string, number> = {
    "1m": minute,
    "5m": 5 * minute,
    "15m": 15 * minute,
    "30m": 30 * minute,
    "1h": hour,
    "2h": 2 * hour,
    "4h": 4 * hour,
    "1D": day,
    "1W": 7 * day,
    "1M": 30 * day,
  };
  return map[timeframe] ?? 5 * minute;
}

function getHistoricalCandleLimit(period: string, timeframe: string, fallback = 500) {
  const periodConfig = getPeriodConfig(period);
  const from = Date.parse(periodConfig.from);
  const to = Date.now();
  if (!Number.isFinite(from)) return fallback;
  const estimated = Math.ceil((to - from) / getTimeframeMs(timeframe)) + 500;
  return Math.max(fallback, Math.min(estimated, 500_000));
}

function getTimeframeBucketStart(timestampMs: number, timeframe: string) {
  const timeframeMs = getTimeframeMs(timeframe);
  if (!Number.isFinite(timestampMs) || timeframeMs <= 0) return timestampMs;
  return Math.floor(timestampMs / timeframeMs) * timeframeMs;
}

function formatPrice(price: number, symbol: string): string {
  const fiveDecimal = ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"];
  const threeDecimalForex = ["USDJPY"];
  const threeDecimal = ["XAUUSD", "OIL"];
  const oneDecimal = ["NAS100", "S&P500", "GER40", "UK100", "DOW30", "NIKKEI", "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY", "MGC", "GC"];

  if (fiveDecimal.includes(symbol)) return price.toFixed(5);
  if (threeDecimalForex.includes(symbol)) return price.toFixed(3);
  if (threeDecimal.includes(symbol)) return price.toFixed(3);
  if (oneDecimal.includes(symbol)) return price.toFixed(1);
  return price.toFixed(2);
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getLiveMoveLimit(symbol: string) {
  if (["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"].includes(symbol)) return 0.035;
  if (symbol === "USDJPY") return 0.04;
  if (["XAUUSD", "XAGUSD", "MGC", "GC"].includes(symbol)) return 0.08;
  if (["NAS100", "S&P500", "GER40", "UK100", "DOW30", "NIKKEI", "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY"].includes(symbol)) return 0.1;
  return 0.12;
}

function getCandleRangeLimit(symbol: string) {
  if (["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"].includes(symbol)) return 0.12;
  if (symbol === "USDJPY") return 0.15;
  if (["XAUUSD", "XAGUSD", "MGC", "GC"].includes(symbol)) return 0.25;
  return 0.4;
}

function getRecentTypicalRange(candles: Candle[], lookback = 8) {
  const ranges = candles
    .slice(-lookback)
    .map((candle) => {
      const high = Number(candle.high);
      const low = Number(candle.low);
      return Number.isFinite(high) && Number.isFinite(low) ? Math.max(0, high - low) : 0;
    })
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  if (ranges.length === 0) return 0;
  const middle = Math.floor(ranges.length / 2);
  if (ranges.length % 2 === 0) return (ranges[middle - 1] + ranges[middle]) / 2;
  return ranges[middle];
}

function sanitizeCandle(candle: Candle, symbol: string, referencePrice?: number): Candle | null {
  let { open, high, low, close } = candle;
  if (![open, high, low, close].every(isPositiveFinite)) return null;

  if (referencePrice && isPositiveFinite(referencePrice)) {
    const bodyMoveLimit = getLiveMoveLimit(symbol) * 2;
    const openMoveRatio = Math.abs(open - referencePrice) / referencePrice;
    const closeMoveRatio = Math.abs(close - referencePrice) / referencePrice;

    if (openMoveRatio > bodyMoveLimit && closeMoveRatio > bodyMoveLimit) return null;
    if (openMoveRatio > bodyMoveLimit) open = close;
    if (closeMoveRatio > bodyMoveLimit) close = open;
  }

  const bodyHigh = Math.max(open, close);
  const bodyLow = Math.min(open, close);
  const rawHigh = Math.max(open, high, low, close);
  const rawLow = Math.min(open, high, low, close);
  const reference = Math.max(Math.abs(close), 1e-9);
  const rangeRatio = (rawHigh - rawLow) / reference;

  if (rangeRatio > getCandleRangeLimit(symbol)) {
    return { ...candle, open, close, high: bodyHigh, low: bodyLow };
  }

  return {
    ...candle,
    open,
    close,
    high: Math.max(rawHigh, bodyHigh),
    low: Math.min(rawLow, bodyLow),
  };
}

function sanitizeCandles(candles: Candle[], symbol: string) {
  const cleanCandles: Candle[] = [];

  for (const candle of candles) {
    const referencePrice = cleanCandles[cleanCandles.length - 1]?.close;
    const cleanCandle = sanitizeCandle(candle, symbol, referencePrice);
    if (cleanCandle) cleanCandles.push(cleanCandle);
  }

  return cleanCandles;
}

function mergeLiveMidIntoCandles(
  candles: Candle[],
  mid: number,
  symbol: string,
  timeframe: string,
  tickTimestamp = Date.now(),
) {
  if (!isPositiveFinite(mid) || candles.length === 0) return candles;

  const updated = [...candles];
  const lastIndex = updated.length - 1;
  const referencePrice = lastIndex > 0 ? updated[lastIndex - 1].close : undefined;
  const repairedLast = sanitizeCandle(updated[lastIndex], symbol, referencePrice);
  if (!repairedLast) return candles;

  const lastBucketStart = getTimeframeBucketStart(repairedLast.timestamp, timeframe);
  const liveBucketStart = getTimeframeBucketStart(tickTimestamp, timeframe);

  if (liveBucketStart > lastBucketStart) {
    const anchor = repairedLast.close || repairedLast.open || mid;
    const nextCandle = sanitizeCandle(
      {
        timestamp: liveBucketStart,
        open: anchor,
        high: Math.max(anchor, mid),
        low: Math.min(anchor, mid),
        close: mid,
      },
      symbol,
      repairedLast.close,
    );
    if (!nextCandle) return candles;
    updated[lastIndex] = repairedLast;
    updated.push(nextCandle);
    if (updated.length > 600) updated.shift();
    return updated;
  }

  if (liveBucketStart < lastBucketStart) {
    return updated;
  }

  const reference = repairedLast.close || repairedLast.open;
  const moveRatio = reference > 0 ? Math.abs(mid - reference) / reference : 0;
  if (moveRatio > getLiveMoveLimit(symbol)) {
    return reanchorLiveMidIntoCandles(candles, mid, symbol);
  }

  const typicalRange = getRecentTypicalRange(candles);
  const retainedWickLimit = Math.max(typicalRange * 2.5, reference * 0.0012);
  const bodyHigh = Math.max(repairedLast.open, mid);
  const bodyLow = Math.min(repairedLast.open, mid);
  const cappedHigh = Math.min(
    Math.max(repairedLast.high, repairedLast.open, mid),
    bodyHigh + retainedWickLimit,
  );
  const cappedLow = Math.max(
    Math.min(repairedLast.low, repairedLast.open, mid),
    bodyLow - retainedWickLimit,
  );

  updated[lastIndex] = {
    ...repairedLast,
    close: mid,
    high: cappedHigh,
    low: cappedLow,
  };

  return updated;
}

function reanchorLiveMidIntoCandles(candles: Candle[], mid: number, symbol: string) {
  if (!isPositiveFinite(mid) || candles.length === 0) return candles;

  const lastIndex = candles.length - 1;
  const previousClose = lastIndex > 0 ? candles[lastIndex - 1].close : candles[lastIndex].open;
  const anchor = isPositiveFinite(previousClose) ? previousClose : mid;
  const baseline = sanitizeCandle(
    {
      ...candles[lastIndex],
      open: anchor,
      high: Math.max(anchor, mid),
      low: Math.min(anchor, mid),
      close: mid,
    },
    symbol,
    lastIndex > 1 ? candles[lastIndex - 2].close : undefined,
  );

  if (!baseline) return candles;
  const updated = [...candles];
  updated[lastIndex] = baseline;
  return updated;
}

async function fetchWorkspaceCandles(symbol: string, timeframe: string, broker: string, period: string, outputsize = 500) {
  const periodConfig = getPeriodConfig(period);
  const usingCTraderFeed = FALLBACK_CTRADER_BROKER_NAMES.includes(broker as (typeof FALLBACK_CTRADER_BROKER_NAMES)[number]);
  const oandaInstrument = OANDA_INSTRUMENT_MAP[symbol];
  const oandaGranularity = OANDA_GRANULARITY_MAP[timeframe] || "M5";
  const from = Date.parse(periodConfig.from);
  const to = Date.now();
  const historicalLimit = getHistoricalCandleLimit(period, timeframe, outputsize);

  try {
    const storedUrl = `/api/market-data/history?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&from=${from}&to=${to}&limit=${historicalLimit}`;
    const storedRes = await fetch(storedUrl, { cache: "no-store" });
    const storedData = await storedRes.json();
    if (storedData.configured && storedData.candles && storedData.candles.length > 0) {
      return sanitizeCandles(storedData.candles as Candle[], symbol);
    }
  } catch {
    // Fall through to broker APIs while historical storage is being populated.
  }

  if (usingCTraderFeed) {
    try {
      const res = await fetch(
        `/api/ctrader?action=candles&broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&from=${Date.parse(periodConfig.from)}&to=${Date.now()}&count=${Math.max(outputsize, 3)}`,
      );
      const data = await res.json();
      if (data.candles && data.candles.length > 0) return sanitizeCandles(data.candles as Candle[], symbol);
      throw new Error(data.error || `${broker} did not return candle data for ${symbol}.`);
    } catch {
      throw new Error(`${broker} candle feed unavailable for ${symbol}.`);
    }
  }

  if (oandaInstrument) {
    try {
      let url = `/api/oanda?action=candles&instrument=${oandaInstrument}&granularity=${oandaGranularity}`;
      url += `&from=${encodeURIComponent(periodConfig.from)}&to=${encodeURIComponent(new Date(to).toISOString())}&maxCandles=${historicalLimit}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.candles && data.candles.length > 0) return sanitizeCandles(data.candles as Candle[], symbol);
    } catch {
      // fall through
    }
  }

  const res = await fetch(`/api/market-data?symbol=${symbol}&interval=${timeframe}&outputsize=${historicalLimit}`);
  const data = await res.json();
  return sanitizeCandles((data.candles || []) as Candle[], symbol);
}

const presetTemplates: ChartTemplate[] = [
  { name: "Default", settings: defaultChartSettings },
  { name: "Classic", settings: { ...defaultChartSettings, upColor: "#26A69A", downColor: "#EF5350", borderUpColor: "#26A69A", borderDownColor: "#EF5350", wickUpColor: "#26A69A", wickDownColor: "#EF5350" } },
  { name: "Night Owl", settings: { ...defaultChartSettings, upColor: "#2196F3", downColor: "#FF9800", borderUpColor: "#2196F3", borderDownColor: "#FF9800", wickUpColor: "#2196F3", wickDownColor: "#FF9800" } },
  { name: "Monochrome", settings: { ...defaultChartSettings, upColor: "#FFFFFF", downColor: "#71717A", borderUpColor: "#FFFFFF", borderDownColor: "#71717A", wickUpColor: "#FFFFFF", wickDownColor: "#71717A" } },
  { name: "TradingView", settings: { ...defaultChartSettings, upColor: "#26A69A", downColor: "#FF5252", borderUpColor: "#26A69A", borderDownColor: "#FF5252", wickUpColor: "#26A69A", wickDownColor: "#FF5252" } },
  { name: "Bloomberg", settings: { ...defaultChartSettings, upColor: "#00FF00", downColor: "#FF0000", borderUpColor: "#00FF00", borderDownColor: "#FF0000", wickUpColor: "#00FF00", wickDownColor: "#FF0000", backgroundColor: "#000000" } },
];

function formatDollar(value: number): string {
  return "$" + Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getNiceIntervals(min: number, max: number, targetLines: number): number[] {
  const range = Math.max(max - min, 1);
  const roughStep = range / targetLines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const niceSteps = [1, 2, 5, 10];
  let step = niceSteps.find((value) => value * magnitude >= roughStep) || 10;
  step *= magnitude;

  const intervals: number[] = [];
  let value = Math.ceil(min / step) * step;
  while (value <= max) {
    intervals.push(value);
    value += step;
  }
  return intervals;
}

function EquityChart({
  trades,
  initialBalance,
  showEquity,
  showExcursions,
}: {
  trades: Trade[];
  initialBalance: number;
  showEquity: boolean;
  showExcursions: boolean;
}) {
  if (!trades || trades.length === 0) {
    return <div className="flex h-full items-center justify-center text-[13px] text-muted">No trades to display</div>;
  }

  const padding = { top: 15, right: 70, bottom: 35, left: 5 };
  const chartWidth = 900;
  const chartHeight = 220;
  let cumPnl = 0;
  const points = [{ index: 0, equity: initialBalance, pnl: 0 }];

  trades.forEach((trade, i) => {
    const tradePnl = (trade as Trade & { pnlDollars?: number }).pnlDollars ?? trade.pnlPoints ?? 0;
    cumPnl += tradePnl;
    points.push({ index: i + 1, equity: initialBalance + cumPnl, pnl: cumPnl });
  });

  const maxEquity = Math.max(...points.map((point) => point.equity), initialBalance);
  const minEquity = Math.min(...points.map((point) => point.equity), initialBalance);
  const range = Math.max(maxEquity - minEquity, 1);
  const yMin = minEquity - range * 0.1;
  const yMax = maxEquity + range * 0.1;
  const xScale = (index: number) => padding.left + (index / (points.length - 1)) * (chartWidth - padding.left - padding.right);
  const yScale = (value: number) => padding.top + ((yMax - value) / (yMax - yMin)) * (chartHeight - padding.top - padding.bottom);
  const baselineY = yScale(initialBalance);
  const linePath = points.map((point, i) => `${i === 0 ? "M" : "L"} ${xScale(point.index)} ${yScale(point.equity)}`).join(" ");
  const fillPath = `${linePath} L ${xScale(points.length - 1)} ${baselineY} L ${xScale(0)} ${baselineY} Z`;
  const yIntervals = getNiceIntervals(yMin, yMax, 6);
  const dateLabels: { x: number; label: string }[] = [];
  const dateStep = Math.max(1, Math.floor(trades.length / 7));
  const firstExit = trades[0]?.exitTime ?? Date.now();
  const lastExit = trades[trades.length - 1]?.exitTime ?? firstExit;
  const showYearLabels = lastExit - firstExit > 180 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < trades.length; i += dateStep) {
    const trade = trades[i];
    const date = new Date(trade.exitTime);
    const label = date.toLocaleDateString("en-US", showYearLabels ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" });
    dateLabels.push({ x: xScale(i + 1), label });
  }
  const lastPoint = points[points.length - 1];
  const finalColor = lastPoint.equity >= initialBalance ? "#22C55E" : "#EF4444";
  const finalLabelY = yScale(lastPoint.equity);
  const finalLabel = lastPoint.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const finalBadgeWidth = Math.max(48, finalLabel.length * 5.7 + 10);

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <clipPath id="equityAboveClip">
          <rect x={padding.left} y={0} width={chartWidth - padding.left - padding.right} height={baselineY} />
        </clipPath>
        <clipPath id="equityBelowClip">
          <rect x={padding.left} y={baselineY} width={chartWidth - padding.left - padding.right} height={chartHeight - baselineY} />
        </clipPath>
      </defs>

      <rect x={padding.left} y={padding.top} width={chartWidth - padding.left - padding.right} height={chartHeight - padding.top - padding.bottom} fill="transparent" />

      {yIntervals.map((value) => (
        <g key={value}>
          <line x1={padding.left} y1={yScale(value)} x2={chartWidth - padding.right} y2={yScale(value)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          <text x={chartWidth - padding.right + 8} y={yScale(value) + 3.5} fill="#666" fontSize="9" fontFamily="monospace" textAnchor="start">
            {value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </text>
        </g>
      ))}

      <line x1={padding.left} y1={baselineY} x2={chartWidth - padding.right} y2={baselineY} stroke="#555" strokeWidth="0.8" strokeDasharray="4,2" />

      {showEquity && (
        <>
          <path d={fillPath} fill="rgba(34, 197, 94, 0.15)" clipPath="url(#equityAboveClip)" />
          <path d={fillPath} fill="rgba(239, 68, 68, 0.15)" clipPath="url(#equityBelowClip)" />
          <path d={linePath} fill="none" stroke="#22C55E" strokeWidth="1.5" clipPath="url(#equityAboveClip)" />
          <path d={linePath} fill="none" stroke="#EF4444" strokeWidth="1.5" clipPath="url(#equityBelowClip)" />
        </>
      )}

      {(showEquity || showExcursions) && points.map((point, i) => {
        if (i === 0) return null;
        const color = point.equity >= initialBalance ? "#22C55E" : "#EF4444";
        return <circle key={i} cx={xScale(point.index)} cy={yScale(point.equity)} r="3" fill={color} />;
      })}

      {dateLabels.map((dateLabel, i) => (
        <line key={`tick-${i}`} x1={dateLabel.x} y1={chartHeight - padding.bottom} x2={dateLabel.x} y2={chartHeight - padding.bottom + 4} stroke="#444" strokeWidth="0.5" />
      ))}

      {dateLabels.map((dateLabel, i) => (
        <text key={i} x={dateLabel.x} y={chartHeight - 5} fill="#555" fontSize="9" fontFamily="monospace" textAnchor="middle">
          {dateLabel.label}
        </text>
      ))}

      <rect x={chartWidth - padding.right + 4} y={finalLabelY - 7} width={finalBadgeWidth} height="14" rx="7" fill={finalColor} />
      <text x={chartWidth - padding.right + 9} y={finalLabelY + 3.5} fill="white" fontSize="9" fontFamily="monospace" fontWeight="bold">
        {finalLabel}
      </text>
    </svg>
  );
}

function WorkspaceChartPane({
  pane,
  active,
  period,
  settings,
  trades,
  onActivate,
  onOpenSettings,
  onCreateAlertAtPrice,
  onRemoveAllIndicators,
  onSelectPeriod,
}: {
  pane: WorkspacePane;
  active: boolean;
  period: string;
  settings: ChartSettings;
  trades?: (Trade & { markerVisible?: boolean })[];
  onActivate: () => void;
  onOpenSettings: () => void;
  onCreateAlertAtPrice: (price: string) => void;
  onRemoveAllIndicators: () => void;
  onSelectPeriod: (period: string) => void;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveFeedError, setLiveFeedError] = useState<string | null>(null);
  const [lastMarketUpdateAt, setLastMarketUpdateAt] = useState<number | null>(null);
  const [statusNow, setStatusNow] = useState(() => Date.now());
  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWorkspaceCandles(pane.symbol, pane.timeframe, pane.broker, period)
      .then((nextCandles) => {
        if (cancelled) return;
        setCandles(sanitizeCandles(nextCandles, pane.symbol));
        setLastMarketUpdateAt(Date.now());
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCandles([]);
        setError("Unable to load chart");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pane.broker, pane.symbol, pane.timeframe, period]);

  useEffect(() => {
    const usingCTraderFeed = FALLBACK_CTRADER_BROKER_NAMES.includes(pane.broker as (typeof FALLBACK_CTRADER_BROKER_NAMES)[number]);
    const usingMassivePaneFeed = pane.broker === "Massive" || isMassiveFuturesSymbol(pane.symbol);
    const nameMap: Record<string, string> = {
      EUR_USD: "EURUSD",
      GBP_USD: "GBPUSD",
      USD_JPY: "USDJPY",
      AUD_USD: "AUDUSD",
      XAU_USD: "XAUUSD",
      NAS100_USD: "NAS100",
      SPX500_USD: "S&P500",
      DE30_EUR: "GER40",
      UK100_GBP: "UK100",
      JP225_USD: "NIKKEI",
      BCO_USD: "OIL",
      US30_USD: "DOW30",
      USD_CAD: "USDCAD",
      USD_CHF: "USDCHF",
      NZD_USD: "NZDUSD",
    };

    if (usingMassivePaneFeed) {
      return;
    }

    const stream = new EventSource(
      usingCTraderFeed
        ? `/api/ctrader/stream?broker=${encodeURIComponent(pane.broker)}&symbols=${encodeURIComponent(pane.symbol)}`
        : "/api/oanda/stream",
    );

    stream.onmessage = (event) => {
      try {
        const price = JSON.parse(event.data) as { error?: string; instrument: string; mid: number };
        if (price.error) {
          setLiveFeedError(price.error);
          return;
        }

        const displayName = usingCTraderFeed ? price.instrument : (nameMap[price.instrument] || price.instrument);
        if (displayName !== pane.symbol) return;

        setLastMarketUpdateAt(Date.now());
        setLiveFeedError(null);
        setCandles((prev) => {
          const merged = mergeLiveMidIntoCandles(prev, price.mid, pane.symbol, pane.timeframe);
          return merged === prev ? reanchorLiveMidIntoCandles(prev, price.mid, pane.symbol) : merged;
        });
      } catch {
        // ignore malformed stream payloads
      }
    };

    stream.onerror = () => {
      stream.close();
      setLiveFeedError(`${pane.broker} live feed is unavailable right now.`);
      window.setTimeout(() => setStreamReconnectNonce((value) => value + 1), 1200);
    };

    return () => stream.close();
  }, [pane.broker, pane.symbol, pane.timeframe, streamReconnectNonce]);

  useEffect(() => {
    const usingMassivePaneFeed = pane.broker === "Massive" || isMassiveFuturesSymbol(pane.symbol);
    if (!usingMassivePaneFeed) return;

    let cancelled = false;

    const loadSnapshots = async () => {
      try {
        const response = await fetch(`/api/massive-futures/snapshot?symbols=${encodeURIComponent(pane.symbol)}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        const snapshot = Array.isArray(payload.snapshots) ? payload.snapshots[0] : null;
        if (cancelled || !snapshot || typeof snapshot.lastPrice !== "number") return;
        setLastMarketUpdateAt(Date.now());
        setCandles((prev) => mergeLiveMidIntoCandles(prev, snapshot.lastPrice, pane.symbol, pane.timeframe));
      } catch {
        if (!cancelled) {
          setLiveFeedError("Massive delayed futures snapshot is unavailable right now.");
        }
      }
    };

    void loadSnapshots();
    const interval = window.setInterval(loadSnapshots, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pane.broker, pane.symbol, pane.timeframe]);

  useEffect(() => {
    const interval = window.setInterval(() => setStatusNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const marketIsActive = lastMarketUpdateAt ? statusNow - lastMarketUpdateAt <= 15_000 : false;
  const marketStatusLabel = loading ? "Loading" : liveFeedError ? "Feed Unavailable" : marketIsActive ? "Active" : "Market Closed";
  const marketStatusClasses = loading
    ? "bg-surface text-muted"
    : liveFeedError
      ? "bg-danger/15 text-danger"
      : marketIsActive
      ? "bg-primary/15 text-primary"
      : "bg-danger/15 text-danger";

  return (
    <div
      onMouseDown={onActivate}
      className={`relative h-full overflow-hidden rounded-2xl border bg-panel ${active ? "border-primary/50 shadow-[0_0_0_1px_rgba(236,72,153,0.28)]" : "border-border"}`}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-[13px] text-muted">Loading chart data...</div>
      ) : error ? (
        <div className="flex h-full items-center justify-center text-[13px] text-muted">{error}</div>
      ) : (
        <Chart
          candles={candles}
          trades={trades}
          instrument={pane.symbol}
          timeframe={pane.timeframe}
          marketIsActive={marketIsActive}
          settings={settings}
          onOpenSettings={onOpenSettings}
          onCreateAlertAtPrice={onCreateAlertAtPrice}
          onRemoveAllIndicators={onRemoveAllIndicators}
          toolbarEnabled
        />
      )}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-panel/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted shadow-lg shadow-black/25 backdrop-blur">
        <span className="font-semibold text-foreground">{pane.symbol}</span>
        <span>{pane.broker}</span>
        {pane.broker === "Massive" && <AlertTriangle className="h-3 w-3 text-orange-300/90" />}
        <span>{pane.timeframe}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${marketStatusClasses}`}>{marketStatusLabel}</span>
      </div>
      <div className="absolute bottom-8 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-panel/80 px-1 py-0.5 backdrop-blur">
        {["1D", "5D", "1M", "3M", "6M", "1Y", "All"].map((range) => (
          <button
            key={range}
            onClick={(event) => {
              event.stopPropagation();
              onSelectPeriod(range);
            }}
            className={"rounded px-2 py-1 text-[11px] transition-all " + (period === range ? "bg-surface text-foreground font-medium" : "text-muted hover:text-foreground")}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}

const demoStrategies: StrategyItem[] = [
  {
    id: "ema-cross",
    name: "EMA Cross Strategy",
    language: "JavaScript",
    addedToChart: true,
    visible: true,
    lastModified: new Date("2026-05-17T09:00:00"),
    code: `// Strategy: EMA Cross Strategy
// Instrument: Any | Timeframe: 5m

function strategy(candles, index, indicators) {
  if (index < 52) return { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 };
  
  var ema20 = indicators.ema20;
  var ema50 = indicators.ema50;
  
  if (!ema20 || !ema50 || !ema20[index] || !ema50[index]) {
    return { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 };
  }
  
  if (ema20[index] > ema50[index] && ema20[index - 1] <= ema50[index - 1]) {
    return { action: "LONG", stopLoss: 15, takeProfit: 30, riskPercent: 1 };
  }
  
  if (ema20[index] < ema50[index] && ema20[index - 1] >= ema50[index - 1]) {
    return { action: "SHORT", stopLoss: 15, takeProfit: 30, riskPercent: 1 };
  }
  
  return { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 };
}`,
  },
];

function normalizeStrategy(strategy: Partial<StrategyItem> & { id: string; name: string; code: string }): StrategyItem {
  const version = strategy.currentVersion ?? strategy.versions?.at(-1)?.version ?? 1;
  const timestamp = strategy.updatedAt ?? strategy.lastModified ?? new Date();
  return {
    id: strategy.id,
    name: strategy.name,
    code: strategy.code,
    language: strategy.language ?? "typescript",
    addedToChart: strategy.addedToChart ?? false,
    visible: strategy.visible ?? true,
    lastModified: timestamp,
    versions: strategy.versions?.length ? strategy.versions : [{ code: strategy.code, timestamp, version }],
    currentVersion: version,
    createdAt: strategy.createdAt ?? timestamp,
    updatedAt: timestamp,
    totalPnl: strategy.totalPnl ?? 0,
  };
}

function formatStrategyDate(value: Date | string | undefined) {
  if (!value) return "today";
  return new Date(value).toLocaleDateString();
}

function validateStrategyCode(code: string) {
  if (!code.includes("function strategy")) return { valid: false, message: "Line 1: Missing required function strategy(...)." };
  if (!/return\s*\{[\s\S]*action[\s\S]*stopLoss[\s\S]*takeProfit/i.test(code)) return { valid: false, message: "Line 1: Strategy must return action, stopLoss, and takeProfit." };
  let balance = 0;
  for (const [index, char] of [...code].entries()) {
    if (char === "{") balance += 1;
    if (char === "}") balance -= 1;
    if (balance < 0) return { valid: false, message: `Line ${code.slice(0, index).split("\n").length}: Unexpected closing brace.` };
  }
  if (balance !== 0) return { valid: false, message: "Line 1: Unmatched braces in strategy code." };
  const undefinedLine = code.split("\n").findIndex((line) => /\bundefined\b/.test(line));
  if (undefinedLine >= 0) return { valid: false, message: `Line ${undefinedLine + 1}: Avoid undefined variables in strategy logic.` };
  return { valid: true, message: "" };
}

function AssistantContent({
  text,
  copiedKey,
  onCopy,
}: {
  text: string;
  copiedKey: string | null;
  onCopy: (code: string, key: string) => void;
}) {
  let codeIndex = 0;
  return (
    <>
      {text.split(/(```[\w]*[\s\S]*?```)/g).map((part, index) => {
        if (!part.startsWith("```")) {
          return <span key={index} className="whitespace-pre-wrap text-[13px] leading-6 text-muted">{part}</span>;
        }
        const code = part.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
        const lang = part.match(/^```(\w+)/)?.[1] ?? "code";
        const key = `code-${codeIndex++}`;
        return (
          <div key={index} className="group relative my-3 overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{lang}</span>
              <button onClick={() => onCopy(code, key)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:bg-surface hover:text-foreground group-hover:opacity-100" title="Copy">
                {copiedKey === key ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-6 text-primary/90"><code>{code}</code></pre>
          </div>
        );
      })}
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [strategyError, setStrategyError] = useState("");
  const [backtesting, setBacktesting] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [updateToast, setUpdateToast] = useState<{ status: "loading" | "success" | "error"; message: string }>({ status: "loading", message: "Updating report..." });
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [chartTrades, setChartTrades] = useState<(Trade & { markerVisible?: boolean })[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [aiWidth, setAiWidth] = useState(360);
  const [isResizingAI, setIsResizingAI] = useState(false);
  const [bottomTab, setBottomTab] = useState<"strategies" | "metrics" | "trades">("metrics");
  const [selectedInstrument, setSelectedInstrument] = useState("NAS100");
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(() => {
    if (typeof window === "undefined") return "single";
    try {
      const saved = window.localStorage.getItem("olisa-chart-workspace-layout") as WorkspaceLayout | null;
      return saved === "split-vertical" || saved === "split-horizontal" || saved === "quad" || saved === "single" ? saved : "single";
    } catch {
      return "single";
    }
  });
  const [workspaceLocked, setWorkspaceLocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("olisa-chart-workspace-locked") === "true";
  });
  const [workspaceSplitRatio, setWorkspaceSplitRatio] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const raw = Number(window.localStorage.getItem("olisa-chart-workspace-split-ratio") ?? "50");
    return Number.isFinite(raw) ? Math.min(80, Math.max(20, raw)) : 50;
  });
  const [workspaceQuadSplit, setWorkspaceQuadSplit] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 50, y: 50 };
    try {
      const parsed = JSON.parse(window.localStorage.getItem("olisa-chart-workspace-quad-split") ?? "{\"x\":50,\"y\":50}") as { x?: number; y?: number };
      return {
        x: Math.min(75, Math.max(25, parsed.x ?? 50)),
        y: Math.min(75, Math.max(25, parsed.y ?? 50)),
      };
    } catch {
      return { x: 50, y: 50 };
    }
  });
  const [workspacePanes, setWorkspacePanes] = useState<WorkspacePane[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANES;
    try {
      const parsed = JSON.parse(window.localStorage.getItem("olisa-chart-workspace-panes") ?? "null") as Partial<WorkspacePane>[] | null;
      if (!parsed || parsed.length < 1) return DEFAULT_WORKSPACE_PANES;
      return parsed.map((pane, index) => normalizeWorkspacePane(pane, DEFAULT_WORKSPACE_PANES[index] ?? DEFAULT_WORKSPACE_PANES[0]));
    } catch {
      return DEFAULT_WORKSPACE_PANES;
    }
  });
  const [activePaneId, setActivePaneId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANES[0].id;
    return window.localStorage.getItem("olisa-chart-workspace-active-pane") ?? DEFAULT_WORKSPACE_PANES[0].id;
  });
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    createWatchlistItem("NAS100", "OANDA"),
    createWatchlistItem("XAUUSD", "OANDA"),
    createWatchlistItem("EURUSD", "OANDA"),
    createWatchlistItem("GBPUSD", "OANDA"),
    createWatchlistItem("GER40", "OANDA"),
    createWatchlistItem("S&P500", "OANDA"),
    createWatchlistItem("UK100", "OANDA"),
  ]);
  const [watchlistContextMenu, setWatchlistContextMenu] = useState<{ x: number; y: number; key: string; symbol: string } | null>(null);
  const [watchlistFavorites, setWatchlistFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("olisa-watchlist-favorites") ?? "[]");
    } catch {
      return [];
    }
  });
  const [watchlistFlags, setWatchlistFlags] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem("olisa-watchlist-flags") ?? "{}");
    } catch {
      return {};
    }
  });
  const [watchlistSections, setWatchlistSections] = useState<WatchlistSection[]>(() => {
    if (typeof window === "undefined") return defaultWatchlistSections;
    try {
      const saved = JSON.parse(window.localStorage.getItem("olisa-watchlist-sections") ?? "null");
      return Array.isArray(saved) && saved.length > 0 ? saved : defaultWatchlistSections;
    } catch {
      return defaultWatchlistSections;
    }
  });
  const [collapsedWatchlistSections, setCollapsedWatchlistSections] = useState<Record<string, boolean>>({});
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [sectionContextMenu, setSectionContextMenu] = useState<{ x: number; y: number; sectionId: string } | null>(null);
  const [draggedWatchlistItem, setDraggedWatchlistItem] = useState<{ symbol: string; sectionId: string } | null>(null);
  const [watchlistDropTarget, setWatchlistDropTarget] = useState<{ sectionId: string; symbol?: string } | null>(null);
  const [showInstrumentSearch, setShowInstrumentSearch] = useState(false);
  const [instrumentSearch, setInstrumentSearch] = useState("");
  const [selectedWatchlistKey, setSelectedWatchlistKey] = useState<string>(makeWatchlistKey("NAS100", "OANDA"));
  const [selectedTimeframe, setSelectedTimeframe] = useState("5m");
  const [selectedPeriod, setSelectedPeriod] = useState(DEFAULT_WORKSPACE_PANES[0].period);
  const [chartLoadingMessage, setChartLoadingMessage] = useState("");
  const [feedErrorByBroker, setFeedErrorByBroker] = useState<Record<string, string>>({});
  const [streamHealthyByBroker, setStreamHealthyByBroker] = useState<Record<string, boolean>>({});
  const [lastStreamTickAtByBroker, setLastStreamTickAtByBroker] = useState<Record<string, number>>({});
  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [rightPanel, setRightPanel] = useState<"order" | "watchlist" | "alerts" | "alertslog" | null>("watchlist");
  const [lastOpenRightPanel, setLastOpenRightPanel] = useState<"order" | "watchlist" | "alerts" | "alertslog">("watchlist");
  const [showChartAlertModal, setShowChartAlertModal] = useState(false);
  const [chartAlertPriceDraft, setChartAlertPriceDraft] = useState<string>("");
  const [chartAlerts, setChartAlerts] = useState<ChartAlertRecord[]>([]);
  const [editingChartAlert, setEditingChartAlert] = useState<ChartAlertRecord | null>(null);
  const [pendingAlertDelete, setPendingAlertDelete] = useState<ChartAlertRecord | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === "undefined") return RIGHT_PANEL_DEFAULT_WIDTH;
    const saved = Number(window.localStorage.getItem("olisa-right-panel-width"));
    return Number.isFinite(saved) ? Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, saved)) : RIGHT_PANEL_DEFAULT_WIDTH;
  });
  const [alertLogCount, setAlertLogCount] = useState(5);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [brokerSearch, setBrokerSearch] = useState("");
  const [brokerFavourites, setBrokerFavourites] = useState<string[]>([]);
  const [connectedBroker, setConnectedBroker] = useState<string | null>(null);
  const [brokerConnections, setBrokerConnections] = useState<Record<string, BrokerConnectionState>>({});
  const [linkedCTraderAccounts, setLinkedCTraderAccounts] = useState<CTraderStatusAccount[]>([]);
  const [paperTradingAccounts, setPaperTradingAccounts] = useState<PaperTradingAccountRecord[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [brokerMode, setBrokerMode] = useState<"Live" | "Demo">("Demo");
  const [showQuickPaperAccountForm, setShowQuickPaperAccountForm] = useState(false);
  const [paperAccountName, setPaperAccountName] = useState("");
  const [paperAccountBalance, setPaperAccountBalance] = useState("$10,000");
  const [paperAccountInstrument, setPaperAccountInstrument] = useState("NAS100");
  const [paperAccountLeverage, setPaperAccountLeverage] = useState("1:30");
  const [paperAccountStrategy, setPaperAccountStrategy] = useState("Manual / No Strategy");
  const [orderUnits, setOrderUnits] = useState("1");
  const [orderTP, setOrderTP] = useState("");
  const [orderSL, setOrderSL] = useState("");
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [showExits, setShowExits] = useState(true);
  const [unitsType, setUnitsType] = useState<"units" | "lots" | "usd" | "pctBalance">("units");
  const [tpType, setTpType] = useState<"price" | "ticks" | "pctPrice" | "rewardUsd" | "rewardPct">("price");
  const [slType, setSlType] = useState<"price" | "ticks" | "pctPrice" | "riskUsd" | "riskPct">("price");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    if (typeof window === "undefined") return BOTTOM_PANEL_DEFAULT_HEIGHT;
    const saved = Number(window.localStorage.getItem("olisa-bottom-panel-height"));
    const initialMaxHeight = Math.max(BOTTOM_PANEL_DEFAULT_HEIGHT, window.innerHeight - 120);
    return Number.isFinite(saved)
      ? Math.min(initialMaxHeight, Math.max(BOTTOM_PANEL_MIN_HEIGHT, saved))
      : BOTTOM_PANEL_DEFAULT_HEIGHT;
  });
  const [bottomMinimized, setBottomMinimized] = useState(false);
  const [equityPeriod, setEquityPeriod] = useState("365d");
  const [favTFs, setFavTFs] = useState(["1m", "5m", "15m", "1h", "4h", "1D"]);
  const [showAllTF, setShowAllTF] = useState(false);
  const [showMiniAI, setShowMiniAI] = useState(false);
  const [miniExpanded, setMiniExpanded] = useState(false);
  const [miniMessages, setMiniMessages] = useState<Message[]>([]);
  const [miniInput, setMiniInput] = useState("");
  const [miniLoading, setMiniLoading] = useState(false);
  const [strategies, setStrategies] = useState<StrategyItem[]>(demoStrategies);
  const [chartIndicatorsSuppressed, setChartIndicatorsSuppressed] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(demoStrategies[0].id);
  const [activeStrategyId, setActiveStrategyId] = useState(demoStrategies[0].id);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<string | null>(null);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [chartToggles, setChartToggles] = useState({
    equity: true,
    buyHold: false,
    excursions: false,
    drawdowns: false,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ performance: true });
  const [showBacktestSettings, setShowBacktestSettings] = useState(false);
  const [backtestSettingsTab, setBacktestSettingsTab] = useState<"properties" | "inputs">("properties");
  const [backtestSettings, setBacktestSettings] = useState(defaultBacktestSettings);
  const [backtestSettingsDraft, setBacktestSettingsDraft] = useState(defaultBacktestSettings);
  const [tradeSort, setTradeSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "entryTime", direction: "desc" });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("Symbol");
  const [colorPicker, setColorPicker] = useState<keyof ChartSettings | null>(null);
  const [colorDraft, setColorDraft] = useState("#00F5A0");
  const [hexDraft, setHexDraft] = useState("00F5A0");
  const [colorHsv, setColorHsv] = useState({ h: 155, s: 100, v: 96 });
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => loadStoredChartSettings());
  const [draftChartSettings, setDraftChartSettings] = useState<ChartSettings>(chartSettings);
  const [chartSettingsSnapshot, setChartSettingsSnapshot] = useState<ChartSettings>(chartSettings);
  const [templates, setTemplates] = useState<ChartTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("olisa-chart-templates") ?? "[]") as ChartTemplate[];
    } catch {
      return [];
    }
  });
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem("olisa-recent-colors");
      return saved ? JSON.parse(saved) as string[] : [];
    } catch {
      return [];
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const miniMessagesEndRef = useRef<HTMLDivElement>(null);
  const aiDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const updateToastTimeoutRef = useRef<number | null>(null);
  const chartLaunchAppliedRef = useRef(false);
  const chartLaunchRunRef = useRef(false);

  const allTimeframes = ["1s", "5s", "10s", "15s", "30s", "1m", "3m", "5m", "10m", "15m", "30m", "45m", "1h", "2h", "3h", "4h", "6h", "8h", "12h", "1D", "2D", "3D", "1W", "1M", "3M", "6M", "1Y"];
  const linkedCTraderBrokerNames = useMemo(
    () => Array.from(new Set(linkedCTraderAccounts.map(resolveCTraderBrokerName))),
    [linkedCTraderAccounts],
  );
  const cTraderBrokerNames = useMemo(
    () =>
      linkedCTraderBrokerNames.length > 0
        ? linkedCTraderBrokerNames
        : [...FALLBACK_CTRADER_BROKER_NAMES],
    [linkedCTraderBrokerNames],
  );
  const cTraderBrokerNameSet = useMemo(() => new Set(cTraderBrokerNames), [cTraderBrokerNames]);
  const usingCTraderFeed = connectedBroker ? cTraderBrokerNameSet.has(connectedBroker) : false;
  const usingMassiveFeed = connectedBroker === "Massive" || isMassiveFuturesSymbol(selectedInstrument);
  const activeChartBrokerLabel = usingCTraderFeed && connectedBroker ? connectedBroker : usingMassiveFeed ? "Massive" : "OANDA";
  const watchlistSymbolsCsv = useMemo(() => {
    const unique = new Set<string>();
    watchlist
      .filter((item) => item.broker === activeChartBrokerLabel)
      .forEach((item) => unique.add(item.symbol));
    if (selectedInstrument) unique.add(selectedInstrument);
    return Array.from(unique).join(",");
  }, [activeChartBrokerLabel, selectedInstrument, watchlist]);
  const instrumentCategories = [
    { category: "Indices", items: [["NAS100", "Nasdaq 100"], ["S&P500", "S&P 500"], ["GER40", "Germany 40"], ["UK100", "FTSE 100"], ["NIKKEI", "Nikkei 225"], ["DOW30", "Dow Jones 30"]] },
    { category: "Forex", items: [["EURUSD", "Euro / US Dollar"], ["GBPUSD", "British Pound / US Dollar"], ["USDJPY", "US Dollar / Japanese Yen"], ["AUDUSD", "Australian Dollar / US Dollar"], ["NZDUSD", "New Zealand Dollar / US Dollar"], ["USDCAD", "US Dollar / Canadian Dollar"], ["USDCHF", "US Dollar / Swiss Franc"]] },
    { category: "Commodities", items: [["XAUUSD", "Gold Spot"], ["XAGUSD", "Silver Spot"], ["OIL", "Crude Oil"], ["NATGAS", "Natural Gas"]] },
    { category: "Crypto", items: [["BTCUSD", "Bitcoin / US Dollar"], ["ETHUSD", "Ethereum / US Dollar"], ["SOLUSD", "Solana / US Dollar"], ["XRPUSD", "XRP / US Dollar"]] },
    {
      category: "Futures",
      items: getMassiveFuturesSymbols().map((symbol) => {
        const definition = getMassiveFuturesSymbolDefinition(symbol);
        return [symbol, definition?.displayName ?? symbol];
      }),
    },
  ];
  const watchlistDetails: Record<string, { price: string; change: string; up: boolean }> = {
    NAS100: { price: "18,547.20", change: "+0.34%", up: true },
    XAUUSD: { price: "2,418.50", change: "+0.12%", up: true },
    BTCUSD: { price: "67,234.00", change: "-1.23%", up: false },
    EURUSD: { price: "1.0842", change: "+0.05%", up: true },
    GER40: { price: "18,234.50", change: "-0.18%", up: false },
    "S&P500": { price: "5,321.40", change: "+0.22%", up: true },
    UK100: { price: "8,123.00", change: "+0.08%", up: true },
    MNQ: { price: "21,734.50", change: "-0.11%", up: false },
    NQ: { price: "21,742.00", change: "-0.08%", up: false },
    MES: { price: "6,021.25", change: "+0.05%", up: true },
    ES: { price: "6,023.00", change: "+0.04%", up: true },
    MYM: { price: "42,811.00", change: "-0.03%", up: false },
    YM: { price: "42,823.00", change: "-0.02%", up: false },
    M2K: { price: "2,134.40", change: "+0.09%", up: true },
    RTY: { price: "2,135.80", change: "+0.08%", up: true },
    MGC: { price: "3,398.20", change: "+0.14%", up: true },
    GC: { price: "3,401.80", change: "+0.13%", up: true },
  };
  const selectedWatchlistItem = watchlist.find((item) => item.symbol === selectedInstrument && item.broker === activeChartBrokerLabel);
  const fallbackDetail = getStaticWatchlistDetail(selectedInstrument, activeChartBrokerLabel, watchlistDetails);
  const fallbackMidPrice = fallbackDetail ? Number(fallbackDetail.price.replace(/,/g, "")) || 0 : 0;
  const selectedMidPrice = selectedWatchlistItem?.mid ?? fallbackMidPrice;
  const currentLivePrice = {
    bid: selectedWatchlistItem?.bid ?? selectedMidPrice,
    ask: selectedWatchlistItem?.ask ?? selectedMidPrice,
    mid: selectedMidPrice,
  };
  const hasSelectedLiveQuote = currentLivePrice.bid > 0 && currentLivePrice.ask > 0;
  const currentSpread = Math.max(0, currentLivePrice.ask - currentLivePrice.bid);
  const orderPanelBidLabel = hasSelectedLiveQuote ? formatPrice(currentLivePrice.bid, selectedInstrument) : "--";
  const orderPanelAskLabel = hasSelectedLiveQuote ? formatPrice(currentLivePrice.ask, selectedInstrument) : "--";
  const orderPanelSpreadLabel = hasSelectedLiveQuote ? formatPrice(currentSpread, selectedInstrument) : "--";
  const currentCandle = chartCandles[chartCandles.length - 1];
  const currentOhlc = currentCandle ? {
    open: currentCandle.open,
    high: currentCandle.high,
    low: currentCandle.low,
    close: currentLivePrice.mid,
  } : null;
  const selectedChangePercent = selectedWatchlistItem?.changePercent ?? (fallbackDetail ? Number(fallbackDetail.change.replace("%", "")) || 0 : 0);
  const activeBrokerFeedError = feedErrorByBroker[activeChartBrokerLabel] ?? null;

  useEffect(() => {
    if (chartTrades.length > 0) return;
    const selectedMid = selectedWatchlistItem?.mid;
    if (!selectedMid || selectedMid <= 0) return;

    setChartCandles((prev) => mergeLiveMidIntoCandles(prev, selectedMid, selectedInstrument, selectedTimeframe));
  }, [chartTrades.length, selectedTimeframe, selectedWatchlistItem?.mid]);
  const activeWorkspacePane = useMemo(
    () => workspacePanes.find((pane) => pane.id === activePaneId) ?? workspacePanes[0] ?? DEFAULT_WORKSPACE_PANES[0],
    [activePaneId, workspacePanes],
  );
  const visibleWorkspacePaneIds = useMemo(() => {
    if (workspaceLayout === "single") return [activeWorkspacePane.id];
    if (workspaceLayout === "quad") return workspacePanes.slice(0, 4).map((pane) => pane.id);
    return workspacePanes.slice(0, 2).map((pane) => pane.id);
  }, [activeWorkspacePane.id, workspaceLayout, workspacePanes]);
  const chartStrategyOptions = useMemo(
    () =>
      (chartIndicatorsSuppressed ? [] : strategies)
        .filter((strategy) => strategy.addedToChart)
        .map((strategy) => ({ id: strategy.id, name: strategy.name })),
    [chartIndicatorsSuppressed, strategies],
  );
  const instrumentAlerts = chartAlerts.filter((alert) => alert.instrument === selectedInstrument);
  const alertLogEntries = [
    { time: "2 min ago", side: "LONG", symbol: "BTCUSD", price: "77,234.50", strategy: "EMA Cross Strategy", account: "Demo Account", status: "Executed", sl: "77,200", tp: "77,500", pnl: "+$234.50" },
    { time: "15 min ago", side: "SHORT", symbol: "BTCUSD", price: "77,890.20", strategy: "EMA Cross Strategy", account: "Demo Account", status: "Executed", sl: "78,050", tp: "77,500", pnl: "+$118.30" },
    { time: "1 hour ago", side: "LONG", symbol: "XAUUSD", price: "3,218.50", strategy: "EMA Cross Strategy", account: "Demo Account", status: "Webhook Error", sl: "3,210", tp: "3,235", error: "Connection timeout" },
    { time: "2 hours ago", side: "LONG", symbol: "BTCUSD", price: "78,100.00", strategy: "EMA Cross Strategy", account: "Demo Account", status: "Executed", sl: "77,850", tp: "78,400", pnl: "-$89.20" },
    { time: "3 hours ago", side: "SHORT", symbol: "NAS100", price: "21,500.30", strategy: "EMA Cross Strategy", account: "Demo Account", status: "Failed", sl: "21,560", tp: "21,380", error: "Insufficient margin" },
  ];
  const brokers: Broker[] = [
    { name: "Paper Trading", subtitle: "Kwantify Simulator", badgeClassName: "bg-[#402033] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", badgeTextClassName: "text-primary", type: "paper" },
    { name: "Capital.com", badgeLabel: "C", badgeClassName: "bg-[#123a46] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#17d1ff]", type: "capital" },
    { name: "Pepperstone", badgeLabel: "P", badgeClassName: "bg-[#0c4f86] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]", badgeTextClassName: "text-white", badgeStyle: { backgroundImage: "linear-gradient(135deg, #1386D7 0%, #0A3F6C 100%)" }, type: "ctrader" },
    { name: "IC Markets", badgeLabel: "IC", badgeClassName: "bg-[#141b33] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]", badgeTextClassName: "text-[#73b6ff]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #111a36 0%, #1b2448 100%)" }, type: "ctrader" },
    { name: "FP Markets", badgeLabel: "FP", badgeClassName: "bg-[#10311f] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]", badgeTextClassName: "text-[#00d46f]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #102817 0%, #134927 100%)" }, type: "ctrader" },
    { name: "BlackBull Markets", badgeLabel: "BB", badgeClassName: "bg-[#0f1016] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", badgeTextClassName: "text-[#f4f7fb]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #0d1018 0%, #171922 100%)" }, type: "ctrader" },
    { name: "FxPro", badgeLabel: "FX", badgeClassName: "bg-[#4d161c] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", badgeTextClassName: "text-[#ff7b88]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #5f1822 0%, #2a1015 100%)" }, type: "ctrader" },
    { name: "Tradovate", badgeLabel: "T", badgeClassName: "bg-[#103d46] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", badgeTextClassName: "text-[#31d5eb]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #0a4e5f 0%, #10313d 100%)" }, type: "tradovate" },
    { name: "OANDA", badgeLabel: "O", badgeClassName: "bg-[#231a1d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", badgeTextClassName: "text-white", badgeStyle: { backgroundImage: "linear-gradient(135deg, #271d21 0%, #171215 100%)" }, type: "oanda" },
    { name: "FXCM", badgeLabel: "FXCM", badgeClassName: "bg-[#132746] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", badgeTextClassName: "text-[#2b8cff]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #11284b 0%, #172238 100%)" }, type: "soon" },
    { name: "Binance", badgeLabel: "BN", badgeClassName: "bg-[#4c390b] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#f0b90b]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #5d470e 0%, #302307 100%)" }, type: "binance" },
    { name: "Exness", badgeLabel: "E", badgeClassName: "bg-[#4a3509] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#ffd43b]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #60440b 0%, #352609 100%)" }, type: "soon" },
    { name: "easyMarkets", badgeLabel: "eM", badgeClassName: "bg-[#15331f] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#00d46f]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #12361f 0%, #1a261f 100%)" }, type: "soon" },
    { name: "OKX", badgeLabel: "OKX", badgeClassName: "bg-[#272329] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-white", badgeStyle: { backgroundImage: "linear-gradient(135deg, #332f35 0%, #181518 100%)" }, type: "soon" },
    { name: "Trade Nation", badgeLabel: "TN", badgeClassName: "bg-[#512517] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#ff6e2d]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #5f311d 0%, #33170f 100%)" }, type: "soon" },
    { name: "Fusion Markets", badgeLabel: "F", badgeClassName: "bg-[#173554] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#46a3ff]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #18477d 0%, #16263e 100%)" }, type: "soon" },
    { name: "ThinkMarkets", badgeLabel: "TM", badgeClassName: "bg-[#153523] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#3ef29a]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #0f4228 0%, #15261d 100%)" }, type: "soon" },
    { name: "BlackBull", badgeLabel: "B", badgeClassName: "bg-[#121212] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-white", badgeStyle: { backgroundImage: "linear-gradient(135deg, #181818 0%, #090909 100%)" }, type: "soon" },
    { name: "FOREX.com", badgeLabel: "FX", badgeClassName: "bg-[#153421] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#3dd885]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #17462b 0%, #102319 100%)" }, type: "soon" },
    { name: "Vantage", badgeLabel: "V", badgeClassName: "bg-[#512b12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#ff8b3d]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #713b12 0%, #33190a 100%)" }, type: "soon" },
    { name: "Blueberry", badgeLabel: "B", badgeClassName: "bg-[#17345a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#4ea0ff]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #1f4d8a 0%, #14253d 100%)" }, type: "soon" },
    { name: "GO Markets", badgeLabel: "GO", badgeClassName: "bg-[#143c36] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", badgeTextClassName: "text-[#29d6b1]", badgeStyle: { backgroundImage: "linear-gradient(135deg, #0f5a4d 0%, #102925 100%)" }, type: "soon" },
  ];
  const brokerByName = useMemo(
    () => Object.fromEntries(brokers.map((broker) => [broker.name, broker])),
    [brokers],
  );
  const renderBrokerBadge = useCallback((broker: Broker, sizeClassName: string, labelClassName: string) => {
    const badgeShellClassName = `relative flex items-center justify-center overflow-hidden ${sizeClassName} rounded-2xl border border-white/5 ${broker.badgeClassName}`;
    if (broker.type === "paper") {
      return (
        <div className={badgeShellClassName} style={broker.badgeStyle}>
          <BarChart3 className="h-[54%] w-[54%] text-primary" />
        </div>
      );
    }

    if (broker.name === "Binance") {
      return (
        <div className={badgeShellClassName} style={broker.badgeStyle}>
          <div className="relative h-[52%] w-[52%] rotate-45">
            <span className="absolute left-1/2 top-0 h-[22%] w-[22%] -translate-x-1/2 rounded-[2px] bg-[#F0B90B]" />
            <span className="absolute left-0 top-1/2 h-[22%] w-[22%] -translate-y-1/2 rounded-[2px] bg-[#F0B90B]" />
            <span className="absolute right-0 top-1/2 h-[22%] w-[22%] -translate-y-1/2 rounded-[2px] bg-[#F0B90B]" />
            <span className="absolute bottom-0 left-1/2 h-[22%] w-[22%] -translate-x-1/2 rounded-[2px] bg-[#F0B90B]" />
            <span className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-[#F0B90B]" />
          </div>
        </div>
      );
    }

    if (broker.name === "OKX") {
      return (
        <div className={badgeShellClassName} style={broker.badgeStyle}>
          <div className="grid grid-cols-2 gap-[3px]">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="h-2.5 w-2.5 rounded-[2px] bg-white" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={badgeShellClassName} style={broker.badgeStyle}>
        <span className={`${labelClassName} ${broker.badgeTextClassName ?? "text-white"}`}>{broker.badgeLabel}</span>
      </div>
    );
  }, []);
  const activeTradingBrokerLabel = connectedBroker ?? "OANDA";
  const activeTradingBroker = brokerByName[activeTradingBrokerLabel] ?? null;
  const defaultPaperTradingAccount = paperTradingAccounts[0] ?? null;
  const ctraderAccountsByBroker = useMemo(
    () =>
      linkedCTraderAccounts.reduce<Record<string, CTraderStatusAccount[]>>((acc, account) => {
        const brokerName = resolveCTraderBrokerName(account);
        if (!acc[brokerName]) acc[brokerName] = [];
        acc[brokerName].push(account);
        return acc;
      }, {}),
    [linkedCTraderAccounts],
  );
  const currentBrokerConnection: BrokerConnectionState = useMemo(() => {
    const saved = brokerConnections[activeTradingBrokerLabel];
    if (saved) return saved;
    return {
      broker: activeTradingBrokerLabel,
      mode: "Demo",
      ownership: activeTradingBroker?.type === "paper" ? "paper" : "shared",
      connectionState:
        activeTradingBroker?.type === "paper"
          ? defaultPaperTradingAccount
            ? "connected"
            : "not_ready"
          : "not_ready",
      connectedAt: new Date(0).toISOString(),
      accountId: activeTradingBroker?.type === "paper" ? defaultPaperTradingAccount?.id : undefined,
      accountLabel:
        activeTradingBroker?.type === "paper"
          ? defaultPaperTradingAccount?.name ?? "No paper account selected"
          : `${activeTradingBrokerLabel} shared feed`,
    };
  }, [activeTradingBroker, activeTradingBrokerLabel, brokerConnections, defaultPaperTradingAccount]);
  const selectedPaperTradingAccount =
    paperTradingAccounts.find((account) => account.id === currentBrokerConnection.accountId) ??
    defaultPaperTradingAccount;
  const activeBrokerAccounts = useMemo(
    () => ctraderAccountsByBroker[activeTradingBrokerLabel] ?? [],
    [activeTradingBrokerLabel, ctraderAccountsByBroker],
  );
  const selectedBrokerAccount =
    activeBrokerAccounts.find((account) => account.accountId === currentBrokerConnection.accountId) ??
    activeBrokerAccounts[0] ??
    null;
  const tradingUnlocked =
    (currentBrokerConnection.ownership === "paper" && currentBrokerConnection.connectionState === "connected") ||
    (currentBrokerConnection.ownership === "user" && currentBrokerConnection.connectionState === "connected");
  const orderPanelMarginUsd = selectedMidPrice > 0 ? selectedMidPrice * Math.max(Number(orderUnits) || 1, 1) * 0.02 : 0;
  const orderPanelTradeValueUsd = selectedMidPrice > 0 ? selectedMidPrice * Math.max(Number(orderUnits) || 1, 1) : 0;
  const activeBrokerHealth = activeTradingBroker ? getBrokerHealth(activeTradingBroker) : {
    state: "not_ready" as const,
    label: "Not ready",
    dotClassName: "bg-orange-400",
    detail: "No broker selected",
  };
  const orderPanelAccountSummary = currentBrokerConnection.ownership === "paper"
    ? {
        status: "Connected",
        balance: selectedPaperTradingAccount?.balance ?? "Locked",
        equity: selectedPaperTradingAccount?.equity ?? "Locked",
        unrealized: selectedPaperTradingAccount?.pnl ?? "Locked",
        realized: selectedPaperTradingAccount?.today ?? "Locked",
        margin: `${formatDollar(orderPanelMarginUsd)} / ${selectedPaperTradingAccount?.equity ?? "Locked"}`,
      }
    : currentBrokerConnection.ownership === "user" && currentBrokerConnection.connectionState === "connected"
      ? {
          status: "Connected",
          balance: "Syncing...",
          equity: "Syncing...",
          unrealized: "Syncing...",
          realized: "Syncing...",
          margin: orderPanelMarginUsd > 0 ? `${formatDollar(orderPanelMarginUsd)} / Syncing...` : "Syncing...",
        }
      : {
          status: currentBrokerConnection.connectionState === "broken" ? "Broken" : "Not Ready",
          balance: "Locked",
          equity: "Locked",
          unrealized: "Locked",
          realized: "Locked",
          margin: "Locked until your broker is connected",
        };
  const orderPanelLockTone =
    activeBrokerHealth.state === "broken"
      ? {
          border: "border-danger/20",
          background: "bg-danger/10",
          icon: "text-danger",
          title: "Connection needs attention",
          body: "This broker connection looks broken. Reconnect the account or choose another connected account before sending orders.",
        }
      : {
          border: "border-yellow-400/20",
          background: "bg-yellow-400/10",
          icon: "text-yellow-300",
          title: "Trading locked",
          body:
            activeTradingBroker?.type === "paper"
              ? "Create or select a paper trading account before sending orders from the simulator."
              : currentBrokerConnection.ownership === "shared"
              ? "Live prices are available on the shared feed, but order entry stays locked until you connect your own broker account."
              : "Connect a broker account and choose the account you want to route orders through.",
        };
  const pickerEnabledBrokers = useMemo(
    () => {
      const names = new Set<string>(["OANDA", "Massive"]);
      cTraderBrokerNames.forEach((name) => names.add(name));
      return Array.from(names);
    },
    [cTraderBrokerNames],
  );
  const instrumentPickerItems = useMemo<InstrumentPickerItem[]>(
    () =>
      pickerEnabledBrokers.flatMap((brokerName) =>
        instrumentCategories.flatMap((group) =>
          group.items
            .filter(() => (group.category === "Futures" ? brokerName === "Massive" : brokerName !== "Massive"))
            .map(([symbol, fullName]) => ({
              key: `${brokerName}::${symbol}`,
              symbol,
              fullName,
              category: group.category,
              broker: brokerName,
            })),
        ),
      ),
    [instrumentCategories, pickerEnabledBrokers],
  );
  const filteredInstrumentPickerItems = useMemo(() => {
    const query = instrumentSearch.trim().toLowerCase();
    if (!query) return instrumentPickerItems;
    return instrumentPickerItems.filter((item) =>
      `${item.symbol} ${item.fullName} ${item.broker} ${item.category}`.toLowerCase().includes(query),
    );
  }, [instrumentPickerItems, instrumentSearch]);
  const watchlistBrokerSymbols = useMemo(
    () =>
      watchlist.reduce<Record<string, string[]>>((acc, item) => {
        if (!acc[item.broker]) acc[item.broker] = [];
        if (!acc[item.broker].includes(item.symbol)) acc[item.broker].push(item.symbol);
        return acc;
      }, {}),
    [watchlist],
  );
  const watchlistSectionSymbolKeys = useMemo(
    () => new Set(watchlistSections.flatMap((section) => section.symbols)),
    [watchlistSections],
  );

  const showReportToast = (status: "loading" | "success" | "error", message: string, hideAfterMs?: number) => {
    if (updateToastTimeoutRef.current) {
      window.clearTimeout(updateToastTimeoutRef.current);
      updateToastTimeoutRef.current = null;
    }
    setUpdateToast({ status, message });
    setShowUpdateToast(true);
    if (hideAfterMs) {
      updateToastTimeoutRef.current = window.setTimeout(() => {
        setShowUpdateToast(false);
        updateToastTimeoutRef.current = null;
      }, hideAfterMs);
    }
  };

  function normalizeHex(value: string) {
    const clean = value.replace("#", "").trim();
    return /^[0-9A-Fa-f]{6}$/.test(clean) ? `#${clean.toUpperCase()}` : null;
  }

  function hexToRgb(value: string) {
    const normalized = normalizeHex(value);
    if (!normalized) return { r: 0, g: 245, b: 160 };
    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16),
    };
  }

  function rgbToHex(r: number, g: number, b: number) {
    return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }

  function rgbToHsv(value: string) {
    const { r, g, b } = hexToRgb(value);
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let h = 0;

    if (delta !== 0) {
      if (max === red) h = ((green - blue) / delta) % 6;
      else if (max === green) h = (blue - red) / delta + 2;
      else h = (red - green) / delta + 4;
    }

    return {
      h: Math.round((h * 60 + 360) % 360),
      s: max === 0 ? 0 : Math.round((delta / max) * 100),
      v: Math.round(max * 100),
    };
  }

  function hsvToHex(h: number, s: number, v: number) {
    const saturation = s / 100;
    const value = v / 100;
    const chroma = value * saturation;
    const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = value - chroma;
    const [r, g, b] =
      h < 60 ? [chroma, x, 0] :
      h < 120 ? [x, chroma, 0] :
      h < 180 ? [0, chroma, x] :
      h < 240 ? [0, x, chroma] :
      h < 300 ? [x, 0, chroma] :
      [chroma, 0, x];

    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  function setLiveColor(nextColor: string) {
    const normalized = normalizeHex(nextColor);
    if (!normalized) return;
    setColorDraft(normalized);
    setHexDraft(normalized.replace("#", ""));
    setColorHsv(rgbToHsv(normalized));
    const nextRecentColors = [normalized, ...recentColors.filter((color) => color !== normalized)].slice(0, 12);
    setRecentColors(nextRecentColors);
    window.localStorage.setItem("olisa-recent-colors", JSON.stringify(nextRecentColors));
    if (!colorPicker) return;
    setDraftChartSettings((current) => ({ ...current, [colorPicker]: normalized }));
    setChartSettings((current) => ({ ...current, [colorPicker]: normalized }));
  }

  function chooseColorAndClose(nextColor: string) {
    setLiveColor(nextColor);
    setColorPicker(null);
  }

  function openColorPicker(field: keyof ChartSettings) {
    const value = String(draftChartSettings[field]);
    const normalized = normalizeHex(value) ?? "#00F5A0";
    setColorPicker(field);
    setColorDraft(normalized);
    setHexDraft(normalized.replace("#", ""));
    setColorHsv(rgbToHsv(normalized));
  }

  function updateColorDraft(value: string) {
    const normalized = normalizeHex(value) ?? value;
    setColorDraft(normalized.startsWith("#") ? normalized : `#${normalized.replace("#", "")}`);
    setHexDraft(normalized.replace("#", "").slice(0, 6).toUpperCase());
    if (normalizeHex(value)) {
      setLiveColor(value);
    }
  }

  function updateGradientColor(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const s = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const v = Math.min(100, Math.max(0, 100 - ((event.clientY - rect.top) / rect.height) * 100));
    const nextHsv = { ...colorHsv, s, v };
    setColorHsv(nextHsv);
    setLiveColor(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v));
  }

  function updateHue(value: number) {
    const nextHsv = { ...colorHsv, h: value };
    setColorHsv(nextHsv);
    setLiveColor(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v));
  }

  function applyChartTemplate(templateSettings: ChartSettings) {
    const normalizedSettings = { ...defaultChartSettings, ...templateSettings };
    setDraftChartSettings(normalizedSettings);
    setChartSettings(normalizedSettings);
    setShowTemplateMenu(false);
  }

  function saveChartTemplate() {
    const name = templateName.trim();
    if (!name) return;
    const nextTemplates = [...templates.filter((template) => template.name !== name), { name, settings: draftChartSettings }];
    setTemplates(nextTemplates);
    window.localStorage.setItem("olisa-chart-templates", JSON.stringify(nextTemplates));
    setTemplateName("");
    setShowSaveTemplate(false);
  }

  function deleteChartTemplate(name: string) {
    const nextTemplates = templates.filter((template) => template.name !== name);
    setTemplates(nextTemplates);
    window.localStorage.setItem("olisa-chart-templates", JSON.stringify(nextTemplates));
  }

  async function persistChartSettings(settings: ChartSettings) {
    if (!supabase) return;
    await supabase.auth.updateUser({
      data: {
        chartSettings: settings,
        chart_settings: settings,
      },
    });
  }

  async function applyChartSettings() {
    setChartSettings(draftChartSettings);
    setChartSettingsSnapshot(draftChartSettings);
    saveStoredChartSettings(draftChartSettings);
    void persistChartSettings(draftChartSettings);
    setShowSettings(false);
    setShowTemplateMenu(false);
  }

  function cancelChartSettings() {
    setDraftChartSettings(chartSettingsSnapshot);
    setChartSettings(chartSettingsSnapshot);
    setShowSettings(false);
    setShowTemplateMenu(false);
    setColorPicker(null);
  }

  function openChartSettings() {
    setChartSettingsSnapshot(chartSettings);
    setDraftChartSettings(chartSettings);
    setShowSettings(true);
  }

  function openCreateAlert(defaultPrice?: string) {
    setEditingChartAlert(null);
    setChartAlertPriceDraft(defaultPrice ?? (selectedMidPrice ? formatPrice(selectedMidPrice, selectedInstrument) : ""));
    setShowChartAlertModal(true);
    setRightPanel("alerts");
  }

  function openEditAlert(alert: ChartAlertRecord) {
    setEditingChartAlert(alert);
    setChartAlertPriceDraft(alert.targetValue ?? "");
    setShowChartAlertModal(true);
    setRightPanel("alerts");
  }

  function handleCreateChartAlert(alert: ChartAlertRecord) {
    const nextAlerts = [alert, ...chartAlerts.filter((item) => item.id !== alert.id)];
    setChartAlerts(nextAlerts);
    saveChartAlerts(nextAlerts);
    setEditingChartAlert(null);
    setRightPanel("alerts");
  }

  function handleToggleChartAlert(alertId: string) {
    setChartAlerts((current) => {
      const next = current.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              state: (alert.state === "paused" ? "active" : "paused") as ChartAlertRecord["state"],
              updatedAt: new Date().toISOString(),
            }
          : alert,
      );
      saveChartAlerts(next);
      return next;
    });
  }

  function handleDeleteChartAlert(alertId: string) {
    setChartAlerts((current) => {
      const next = current.filter((alert) => alert.id !== alertId);
      saveChartAlerts(next);
      return next;
    });
    setPendingAlertDelete(null);
  }

  function ColorButton({ field, label }: { field: keyof ChartSettings; label: string }) {
    const value = String(draftChartSettings[field]);
    const hueColor = hsvToHex(colorHsv.h, 100, 100);
    return (
      <div className="relative flex items-center justify-between gap-3">
        <span className="text-[12px] text-muted">{label}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openColorPicker(field);
          }}
          className="h-7 w-7 cursor-pointer rounded-md border border-border transition hover:border-primary/50"
          style={{ backgroundColor: value }}
          aria-label={`Choose ${label.toLowerCase()} color`}
        />
        {colorPicker === field && (
          <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-9 z-[120] w-[260px] rounded-2xl border border-border bg-panel p-4 shadow-2xl">
            <div
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateGradientColor(event); }}
              onPointerMove={(event) => { if (event.buttons === 1) updateGradientColor(event); }}
              className="relative mb-3 h-[140px] cursor-crosshair rounded-xl border border-border"
              style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
            >
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.7)]"
                style={{ left: `${colorHsv.s}%`, top: `${100 - colorHsv.v}%` }}
              />
            </div>
            <input type="range" min="0" max="360" value={colorHsv.h} onChange={(event) => updateHue(Number(event.target.value))} className="mb-3 h-2 w-full cursor-pointer appearance-none rounded-full" style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }} />
            <div className="mb-3 flex items-center gap-3"><div className="h-8 w-8 rounded-lg border border-border" style={{ backgroundColor: colorDraft }} /><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted">#</span><input value={hexDraft} onChange={(event) => updateColorDraft(event.target.value)} placeholder="00F5A0" className="w-full rounded-lg border border-border bg-surface py-1.5 pl-7 pr-3 font-mono text-[13px] outline-none focus:border-primary/40" /></div></div>
            <div className="mb-3 grid grid-cols-6 gap-2">{presetColors.map((color) => <button key={color} type="button" onClick={() => chooseColorAndClose(color)} className="h-6 w-6 cursor-pointer rounded-lg border border-border" style={{ backgroundColor: color }} />)}</div>
            {recentColors.length > 0 && <div><div className="mb-2 text-[11px] text-muted">Recent</div><div className="flex flex-wrap gap-2">{recentColors.map((color) => <button key={color} type="button" onClick={() => chooseColorAndClose(color)} className="h-6 w-6 cursor-pointer rounded-lg border border-border" style={{ backgroundColor: color }} />)}</div></div>}
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    if (rightPanel === "alertslog") setAlertLogCount(0);
  }, [rightPanel]);

  useEffect(() => {
    if (rightPanel) {
      setLastOpenRightPanel(rightPanel);
    }
  }, [rightPanel]);

  const getBottomPanelMaxHeight = useCallback(() => {
    const mainRect = mainRef.current?.getBoundingClientRect();
    if (!mainRect) {
      return Math.max(BOTTOM_PANEL_DEFAULT_HEIGHT, window.innerHeight - 120);
    }
    return Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.floor(mainRect.height - CHART_TOP_BAR_HEIGHT));
  }, []);

  useEffect(() => {
    const clampBottomPanelHeight = () => {
      const maxHeight = getBottomPanelMaxHeight();
      setBottomPanelHeight((currentHeight) => {
        const nextHeight = Math.min(maxHeight, Math.max(BOTTOM_PANEL_MIN_HEIGHT, currentHeight));
        if (nextHeight !== currentHeight) {
          window.localStorage.setItem("olisa-bottom-panel-height", String(nextHeight));
        }
        return nextHeight;
      });
    };

    clampBottomPanelHeight();
    window.addEventListener("resize", clampBottomPanelHeight);
    return () => window.removeEventListener("resize", clampBottomPanelHeight);
  }, [getBottomPanelMaxHeight]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAlertLogCount((count) => rightPanel === "alertslog" ? count : Math.min(count + 1, 9));
    }, 60000);
    return () => window.clearInterval(timer);
  }, [rightPanel]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bottomPanelHeight, rightPanel, rightPanelWidth]);

  useEffect(() => {
    try {
      setBrokerFavourites(JSON.parse(window.localStorage.getItem("olisa-broker-favourites") ?? "[]"));
      setConnectedBroker(window.localStorage.getItem("olisa-connected-broker"));
      setBrokerConnections(JSON.parse(window.localStorage.getItem("olisa-broker-connections") ?? "{}"));
      setPaperTradingAccounts(loadPaperTradingAccounts());
    } catch {
      setBrokerFavourites([]);
      setBrokerConnections({});
      setPaperTradingAccounts([]);
    }
  }, []);

  useEffect(() => {
    savePaperTradingAccounts(paperTradingAccounts);
  }, [paperTradingAccounts]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key) {
        if (event.key === "kwantify-paper-trading-accounts") {
          setPaperTradingAccounts(loadPaperTradingAccounts());
        }
        if (event.key === "olisa-broker-connections") {
          try {
            setBrokerConnections(JSON.parse(window.localStorage.getItem("olisa-broker-connections") ?? "{}"));
          } catch {
            setBrokerConnections({});
          }
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncCTraderStatus = async () => {
      try {
        const response = await fetch("/api/ctrader?action=status", { cache: "no-store" });
        const payload = (await response.json()) as CTraderStatusResponse;
        if (cancelled || !response.ok || !payload.linked || !Array.isArray(payload.accounts)) return;

        const accounts = payload.accounts.filter((account) => typeof account.accountId === "number");
        setLinkedCTraderAccounts(accounts);

        const linkedBrokerNames = Array.from(new Set(accounts.map(resolveCTraderBrokerName)));
        if (linkedBrokerNames.length === 0) return;

        setBrokerConnections((current) => {
          const next = { ...current };
          linkedBrokerNames.forEach((brokerName) => {
            const brokerAccounts = accounts.filter((account) => resolveCTraderBrokerName(account) === brokerName);
            const selectedAccount =
              brokerAccounts.find((account) => account.accountId === next[brokerName]?.accountId) ??
              brokerAccounts[0] ??
              null;
            if (!selectedAccount) return;

            next[brokerName] = {
              broker: brokerName,
              mode: selectedAccount.isLive ? "Live" : "Demo",
              ownership: "user",
              connectionState: "connected",
              connectedAt: next[brokerName]?.connectedAt ?? new Date().toISOString(),
              accountId: selectedAccount.accountId,
              accountLabel: formatCTraderAccountLabel(selectedAccount),
            };
          });
          return next;
        });
      } catch {
        // no-op: cTrader may be disconnected
      }
    };

    syncCTraderStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("olisa-broker-connections", JSON.stringify(brokerConnections));
  }, [brokerConnections]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-layout", workspaceLayout);
  }, [workspaceLayout]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-locked", String(workspaceLocked));
  }, [workspaceLocked]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-split-ratio", String(workspaceSplitRatio));
  }, [workspaceSplitRatio]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-quad-split", JSON.stringify(workspaceQuadSplit));
  }, [workspaceQuadSplit]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-panes", JSON.stringify(workspacePanes));
  }, [workspacePanes]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-active-pane", activePaneId);
  }, [activePaneId]);

  useEffect(() => {
    if (visibleWorkspacePaneIds.includes(activePaneId)) return;
    setActivePaneId(visibleWorkspacePaneIds[0] ?? DEFAULT_WORKSPACE_PANES[0].id);
  }, [activePaneId, visibleWorkspacePaneIds]);

  useEffect(() => {
    const nextPane = activeWorkspacePane;
    if (!nextPane) return;
    if (selectedInstrument !== nextPane.symbol) setSelectedInstrument(nextPane.symbol);
    if (selectedTimeframe !== nextPane.timeframe) setSelectedTimeframe(nextPane.timeframe);
    if (selectedPeriod !== nextPane.period) setSelectedPeriod(nextPane.period);
    if (connectedBroker !== nextPane.broker) setConnectedBroker(nextPane.broker);
    if (selectedWatchlistKey !== nextPane.watchlistKey) setSelectedWatchlistKey(nextPane.watchlistKey);
  }, [activeWorkspacePane, connectedBroker, selectedInstrument, selectedPeriod, selectedTimeframe, selectedWatchlistKey]);

  useEffect(() => {
    window.localStorage.setItem("olisa-watchlist-favorites", JSON.stringify(watchlistFavorites));
  }, [watchlistFavorites]);

  useEffect(() => {
    window.localStorage.setItem("olisa-watchlist-flags", JSON.stringify(watchlistFlags));
  }, [watchlistFlags]);

  useEffect(() => {
    window.localStorage.setItem("olisa-watchlist-sections", JSON.stringify(watchlistSections));
  }, [watchlistSections]);

  useEffect(() => {
    setChartAlerts(loadChartAlerts());
  }, []);

  useEffect(() => {
    if (!watchlistContextMenu) return;
    const close = () => setWatchlistContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWatchlistContextMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [watchlistContextMenu]);

  useEffect(() => {
    const nameMap: Record<string, string> = {
      EUR_USD: "EURUSD",
      GBP_USD: "GBPUSD",
      USD_JPY: "USDJPY",
      AUD_USD: "AUDUSD",
      XAU_USD: "XAUUSD",
      NAS100_USD: "NAS100",
      SPX500_USD: "S&P500",
      DE30_EUR: "GER40",
      UK100_GBP: "UK100",
      JP225_USD: "NIKKEI",
      BCO_USD: "OIL",
      US30_USD: "DOW30",
      USD_CAD: "USDCAD",
      USD_CHF: "USDCHF",
      NZD_USD: "NZDUSD",
    };

    const eventSource = new EventSource(
      usingCTraderFeed
        ? `/api/ctrader/stream?broker=${encodeURIComponent(activeChartBrokerLabel)}&symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
        : "/api/oanda/stream",
    );

    eventSource.onmessage = (event) => {
      try {
        const price = JSON.parse(event.data) as { error?: string; instrument: string; bid: number; ask: number; mid: number; broker?: string };
        if (price.error) {
          setFeedErrorByBroker((current) => ({ ...current, [activeChartBrokerLabel]: price.error as string }));
          return;
        }

        setFeedErrorByBroker((current) => {
          if (!current[activeChartBrokerLabel]) return current;
          const next = { ...current };
          delete next[activeChartBrokerLabel];
          return next;
        });
        setStreamHealthyByBroker((current) => ({ ...current, [activeChartBrokerLabel]: true }));
        setLastStreamTickAtByBroker((current) => ({ ...current, [activeChartBrokerLabel]: Date.now() }));

        const displayName = usingCTraderFeed ? price.instrument : (nameMap[price.instrument] || price.instrument);

        setWatchlist((current) => current.map((item) => {
          if (item.symbol !== displayName || item.broker !== activeChartBrokerLabel) return item;
          const prevMid = item.lastPrice || price.mid;
          const moveRatio = prevMid > 0 ? Math.abs(price.mid - prevMid) / prevMid : 0;
          if (moveRatio > 0.2) return item;
          const openPrice = item.openPrice || price.mid;
          const flash = price.mid > prevMid ? "up" : price.mid < prevMid ? "down" : null;
          return {
            ...item,
            broker: price.broker || activeChartBrokerLabel,
            lastPrice: price.mid,
            openPrice,
            bid: price.bid,
            ask: price.ask,
            mid: price.mid,
            change: price.mid - openPrice,
            changePercent: openPrice ? ((price.mid - openPrice) / openPrice) * 100 : 0,
            flash,
          };
        }));

        window.setTimeout(() => {
          setWatchlist((current) => current.map((item) => item.symbol === displayName && item.broker === activeChartBrokerLabel ? { ...item, flash: null } : item));
        }, 300);

        if (displayName === selectedInstrument && chartTrades.length === 0) {
          setChartCandles((prev) => mergeLiveMidIntoCandles(prev, price.mid, selectedInstrument, selectedTimeframe));
        }
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
      setStreamHealthyByBroker((current) => ({ ...current, [activeChartBrokerLabel]: false }));
      setFeedErrorByBroker((current) => ({
        ...current,
        [activeChartBrokerLabel]: `${activeChartBrokerLabel} live feed is unavailable right now.`,
      }));
      window.setTimeout(() => setStreamReconnectNonce((value) => value + 1), 1200);
      console.log(`${activeChartBrokerLabel} stream disconnected, reconnecting...`);
    };

    return () => eventSource.close();
  }, [activeChartBrokerLabel, chartTrades.length, selectedInstrument, selectedTimeframe, streamReconnectNonce, usingCTraderFeed, watchlistSymbolsCsv]);

  useEffect(() => {
    if (activeChartBrokerLabel === "Massive") {
      return;
    }

    const nameMap: Record<string, string> = {
      EUR_USD: "EURUSD",
      GBP_USD: "GBPUSD",
      USD_JPY: "USDJPY",
      AUD_USD: "AUDUSD",
      XAU_USD: "XAUUSD",
      NAS100_USD: "NAS100",
      SPX500_USD: "S&P500",
      DE30_EUR: "GER40",
      UK100_GBP: "UK100",
      JP225_USD: "NIKKEI",
      BCO_USD: "OIL",
      US30_USD: "DOW30",
      USD_CAD: "USDCAD",
      USD_CHF: "USDCHF",
      NZD_USD: "NZDUSD",
    };

    const fetchPrices = async () => {
      try {
        if (usingCTraderFeed) {
          const lastTickAt = lastStreamTickAtByBroker[activeChartBrokerLabel] ?? 0;
          const streamRecentlyAlive = streamHealthyByBroker[activeChartBrokerLabel] && Date.now() - lastTickAt < 3000;
          if (streamRecentlyAlive) return;
        }
        const res = await fetch(
          activeChartBrokerLabel === "Massive"
            ? `/api/massive-futures/snapshot?symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
            : usingCTraderFeed
              ? `/api/ctrader?action=pricing&broker=${encodeURIComponent(activeChartBrokerLabel)}&symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
              : "/api/oanda?action=pricing",
        );
        const data = await res.json();
        const prices = activeChartBrokerLabel === "Massive" ? data.snapshots : data.prices;
        if (!res.ok || data.error || !prices) {
          setFeedErrorByBroker((current) => ({
            ...current,
            [activeChartBrokerLabel]: data.error || `${activeChartBrokerLabel} pricing is unavailable right now.`,
          }));
          return;
        }

        setFeedErrorByBroker((current) => {
          if (!current[activeChartBrokerLabel]) return current;
          const next = { ...current };
          delete next[activeChartBrokerLabel];
          return next;
        });

        prices.forEach((price: { instrument?: string; symbol?: string; bid?: number; ask?: number; mid?: number; broker?: string; lastPrice?: number; openPrice?: number }) => {
          const displayName =
            activeChartBrokerLabel === "Massive"
              ? price.symbol || ""
              : usingCTraderFeed
                ? price.instrument || ""
                : (nameMap[price.instrument || ""] || price.instrument || "");
          const mid = activeChartBrokerLabel === "Massive" ? Number(price.lastPrice ?? 0) : Number(price.mid ?? 0);
          const bid = activeChartBrokerLabel === "Massive" ? mid : Number(price.bid ?? mid);
          const ask = activeChartBrokerLabel === "Massive" ? mid : Number(price.ask ?? mid);
          const openPriceFromFeed = activeChartBrokerLabel === "Massive" ? Number(price.openPrice ?? mid) : undefined;

          setWatchlist((current) => current.map((item) => {
            if (item.symbol !== displayName || item.broker !== activeChartBrokerLabel) return item;
            const prevMid = item.lastPrice || mid;
            const moveRatio = prevMid > 0 ? Math.abs(mid - prevMid) / prevMid : 0;
            if (moveRatio > 0.2) return item;
            const openPrice = openPriceFromFeed || item.openPrice || mid;
            return {
              ...item,
              broker: price.broker || activeChartBrokerLabel,
              lastPrice: mid,
              openPrice,
              bid,
              ask,
              mid,
              change: mid - openPrice,
              changePercent: openPrice ? ((mid - openPrice) / openPrice) * 100 : 0,
              flash: mid > prevMid ? "up" : mid < prevMid ? "down" : null,
            };
          }));

          if (displayName === selectedInstrument && chartTrades.length === 0) {
            setChartCandles((prev) => mergeLiveMidIntoCandles(prev, mid, selectedInstrument, selectedTimeframe));
          }
        });

        window.setTimeout(() => {
          setWatchlist((current) => current.map((item) => ({ ...item, flash: null })));
        }, 300);
      } catch (err) {
        console.error("Price fetch error:", err);
      }
    };

    fetchPrices();
    const interval = window.setInterval(fetchPrices, 500);
    return () => window.clearInterval(interval);
  }, [activeChartBrokerLabel, chartTrades.length, lastStreamTickAtByBroker, selectedInstrument, selectedTimeframe, streamHealthyByBroker, usingCTraderFeed, watchlistSymbolsCsv]);

  useEffect(() => {
    const nameMap: Record<string, string> = {
      EUR_USD: "EURUSD",
      GBP_USD: "GBPUSD",
      USD_JPY: "USDJPY",
      AUD_USD: "AUDUSD",
      XAU_USD: "XAUUSD",
      NAS100_USD: "NAS100",
      SPX500_USD: "S&P500",
      DE30_EUR: "GER40",
      UK100_GBP: "UK100",
      JP225_USD: "NIKKEI",
      BCO_USD: "OIL",
      US30_USD: "DOW30",
      USD_CAD: "USDCAD",
      USD_CHF: "USDCHF",
      NZD_USD: "NZDUSD",
    };

    const updateInactiveFeeds = async () => {
      const brokers = Object.keys(watchlistBrokerSymbols).filter((broker) => broker !== activeChartBrokerLabel);
      await Promise.all(
        brokers.map(async (broker) => {
          const symbols = watchlistBrokerSymbols[broker];
          if (!symbols || symbols.length === 0) return;
          const isCTrader = cTraderBrokerNameSet.has(broker);
          const url = broker === "Massive"
            ? `/api/massive-futures/snapshot?symbols=${encodeURIComponent(symbols.join(","))}`
            : isCTrader
              ? `/api/ctrader?action=pricing&broker=${encodeURIComponent(broker)}&symbols=${encodeURIComponent(symbols.join(","))}`
              : "/api/oanda?action=pricing";

          try {
            const res = await fetch(url);
            const data = await res.json();
            const prices = broker === "Massive" ? data.snapshots : data.prices;
            if (!res.ok || data.error || !Array.isArray(prices)) return;

            prices.forEach((price: { instrument?: string; symbol?: string; bid?: number; ask?: number; mid?: number; broker?: string; lastPrice?: number; openPrice?: number }) => {
              const displayName = broker === "Massive" ? price.symbol || "" : isCTrader ? price.instrument || "" : (nameMap[price.instrument || ""] || price.instrument || "");
              const mid = broker === "Massive" ? Number(price.lastPrice ?? 0) : Number(price.mid ?? 0);
              const bid = broker === "Massive" ? mid : Number(price.bid ?? mid);
              const ask = broker === "Massive" ? mid : Number(price.ask ?? mid);
              const openPriceFromFeed = broker === "Massive" ? Number(price.openPrice ?? mid) : undefined;
              setWatchlist((current) =>
                current.map((item) => {
                  if (item.symbol !== displayName || item.broker !== broker) return item;
                  const prevMid = item.lastPrice || mid;
                  const moveRatio = prevMid > 0 ? Math.abs(mid - prevMid) / prevMid : 0;
                  if (moveRatio > 0.2) return item;
                  const openPrice = openPriceFromFeed || item.openPrice || mid;
                  return {
                    ...item,
                    broker: price.broker || broker,
                    lastPrice: mid,
                    openPrice,
                    bid,
                    ask,
                    mid,
                    change: mid - openPrice,
                    changePercent: openPrice ? ((mid - openPrice) / openPrice) * 100 : 0,
                    flash: mid > prevMid ? "up" : mid < prevMid ? "down" : null,
                  };
                }),
              );
            });
          } catch {
            // keep other feeds running even if one broker call fails
          }
        }),
      );

      window.setTimeout(() => {
        setWatchlist((current) => current.map((item) => ({ ...item, flash: null })));
      }, 250);
    };

    updateInactiveFeeds();
    const interval = window.setInterval(updateInactiveFeeds, 700);
    return () => window.clearInterval(interval);
  }, [activeChartBrokerLabel, cTraderBrokerNameSet, watchlistBrokerSymbols]);

  async function fetchChartCandles(outputsize = 500, period = selectedPeriod) {
    const periodConfig = getPeriodConfig(period);
    const oandaInstrument = OANDA_INSTRUMENT_MAP[selectedInstrument];
    const oandaGranularity = OANDA_GRANULARITY_MAP[selectedTimeframe] || "M5";
    const from = Date.parse(periodConfig.from);
    const to = Date.now();
    const historicalLimit = getHistoricalCandleLimit(period, selectedTimeframe, outputsize);

    try {
      const storedUrl = `/api/market-data/history?broker=${encodeURIComponent(activeChartBrokerLabel)}&symbol=${encodeURIComponent(selectedInstrument)}&timeframe=${encodeURIComponent(selectedTimeframe)}&from=${from}&to=${to}&limit=${historicalLimit}`;
      const storedRes = await fetch(storedUrl, { cache: "no-store" });
      const storedData = await storedRes.json();
      if (storedData.configured && storedData.candles && storedData.candles.length > 0) {
        return sanitizeCandles(storedData.candles as Candle[], selectedInstrument);
      }
    } catch {
      // Fall through to direct broker APIs while historical storage is being populated.
    }

    if (usingCTraderFeed) {
      try {
        const res = await fetch(
          `/api/ctrader?action=candles&broker=${encodeURIComponent(activeChartBrokerLabel)}&symbol=${encodeURIComponent(selectedInstrument)}&interval=${encodeURIComponent(selectedTimeframe)}&from=${Date.parse(periodConfig.from)}&to=${Date.now()}&count=${Math.max(outputsize, 3)}`,
        );
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          return sanitizeCandles(data.candles as Candle[], selectedInstrument);
        }
        throw new Error(data.error || `${activeChartBrokerLabel} did not return candles for ${selectedInstrument}.`);
      } catch {
        throw new Error(`${activeChartBrokerLabel} candle feed unavailable for ${selectedInstrument}.`);
      }
    }

    if (activeChartBrokerLabel === "Massive") {
      const res = await fetch(
        `/api/market-data?broker=Massive&symbol=${encodeURIComponent(selectedInstrument)}&interval=${encodeURIComponent(selectedTimeframe)}&from=${from}&to=${to}&outputsize=${historicalLimit}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      return sanitizeCandles((data.candles || []) as Candle[], selectedInstrument);
    }

    if (oandaInstrument) {
      try {
        let url = `/api/oanda?action=candles&instrument=${oandaInstrument}&granularity=${oandaGranularity}`;
        url += `&from=${encodeURIComponent(periodConfig.from)}&to=${encodeURIComponent(new Date(to).toISOString())}&maxCandles=${historicalLimit}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          return sanitizeCandles(data.candles as Candle[], selectedInstrument);
        }
      } catch {
        // Fall back to the existing market-data route when OANDA is unavailable.
      }
    }

    const res = await fetch(`/api/market-data?symbol=${selectedInstrument}&interval=${selectedTimeframe}&outputsize=${outputsize}`);
    const data = await res.json();
    return sanitizeCandles((data.candles || []) as Candle[], selectedInstrument);
  }

  useEffect(() => {
    if (!selectedInstrument) return;
    if (chartTrades.length > 0) return;

    const checkNewCandle = async () => {
      try {
        const oandaInst = OANDA_INSTRUMENT_MAP[selectedInstrument];
        const oandaGran = OANDA_GRANULARITY_MAP[selectedTimeframe] || "M5";
        const url = usingCTraderFeed
          ? `/api/ctrader?action=candles&broker=${encodeURIComponent(activeChartBrokerLabel)}&symbol=${encodeURIComponent(selectedInstrument)}&interval=${encodeURIComponent(selectedTimeframe)}&count=3`
          : activeChartBrokerLabel === "Massive"
            ? `/api/massive-futures/snapshot?symbols=${encodeURIComponent(selectedInstrument)}`
          : oandaInst
            ? `/api/oanda?action=candles&instrument=${oandaInst}&granularity=${oandaGran}&count=3`
            : null;

        if (!url) return;

        const res = await fetch(url);
        const data = await res.json();
        if (activeChartBrokerLabel === "Massive" && Array.isArray(data.snapshots) && data.snapshots[0]?.lastPrice) {
          setChartCandles((prev) => mergeLiveMidIntoCandles(prev, Number(data.snapshots[0].lastPrice), selectedInstrument, selectedTimeframe));
          return;
        }

        if (data.candles && data.candles.length > 0) {
          setChartCandles((prev) => {
            if (prev.length === 0) return prev;
            const latestCandle = sanitizeCandle(
              data.candles[data.candles.length - 1] as Candle,
              selectedInstrument,
              prev[prev.length - 1].close,
            );
            if (!latestCandle) return prev;
            const lastTimestamp = prev[prev.length - 1].timestamp;
            if (latestCandle.timestamp > lastTimestamp) {
              const updated = [...prev, latestCandle];
              if (updated.length > 600) updated.shift();
              return updated;
            }
            if (latestCandle.timestamp === lastTimestamp) {
              const updated = [...prev];
              updated[updated.length - 1] = latestCandle;
              return updated;
            }
            return prev;
          });
        }
      } catch {}
    };

    const interval = window.setInterval(checkNewCandle, 5000);
    return () => window.clearInterval(interval);
  }, [activeChartBrokerLabel, chartTrades.length, selectedInstrument, selectedTimeframe, usingCTraderFeed]);

  useEffect(() => {
    const loadData = async () => {
      try {
        showReportToast("loading", "Updating report...");
        const periodConfig = getPeriodConfig(selectedPeriod);
        if (isTooManyCandles(selectedPeriod, selectedTimeframe)) {
          setChartLoadingMessage("Too many candles for this timeframe/period combination. Reduce the period or increase the timeframe.");
          return;
        }
        setChartLoadingMessage(`Loading ${periodConfig.label} of ${selectedTimeframe} data... this may take a moment`);
        const candles = await fetchChartCandles(getHistoricalCandleLimit(selectedPeriod, selectedTimeframe, 500));
        if (candles.length > 0) {
          setChartCandles(sanitizeCandles(candles, selectedInstrument));
          if (backtestResult && !backtestResult.error) {
            const config: BacktestConfig = {
              initialBalance: 10000,
              broker: { spread: 1.5, slippage: 0.5, commission: 0 },
              maxPositions: 1,
            };
            const result = runBacktest(candles, config);
            setBacktestResult(result);
            setChartTrades(result.trades);
          }
          showReportToast("success", `Report updated — ${selectedInstrument} ${selectedTimeframe}`, 2000);
          setChartLoadingMessage(`Loaded ${candles.length.toLocaleString()} candles`);
        } else {
          const fallback = generateSampleData(60);
          setChartCandles(fallback);
          if (backtestResult && !backtestResult.error) {
            const config: BacktestConfig = {
              initialBalance: 10000,
              broker: { spread: 1.5, slippage: 0.5, commission: 0 },
              maxPositions: 1,
            };
            const result = runBacktest(fallback, config);
            setBacktestResult(result);
            setChartTrades(result.trades);
          }
          showReportToast("success", `Report updated — ${selectedInstrument} ${selectedTimeframe}`, 2000);
        }
      } catch {
        if (!usingCTraderFeed) {
          const fallback = generateSampleData(60);
          setChartCandles(fallback);
        }
        showReportToast("error", "Failed to update report", 3000);
      } finally {
        window.setTimeout(() => setChartLoadingMessage(""), 3500);
      }
    };
    loadData();
  }, [selectedInstrument, selectedTimeframe, selectedPeriod]);

  useEffect(() => {
    if (!backtestResult || backtestResult.error) {
      showReportToast("loading", "Updating report...");
      window.setTimeout(() => showReportToast("success", `Report updated — ${selectedInstrument} ${selectedTimeframe}`, 2000), 300);
      return;
    }

    const reportPeriod = equityPeriod === "7d" ? "5D" : equityPeriod === "30d" ? "1M" : equityPeriod === "90d" ? "3M" : equityPeriod === "365d" ? "1Y" : "All";
    const outputsize = getHistoricalCandleLimit(reportPeriod, selectedTimeframe, equityPeriod === "7d" ? 2000 : 5000);

    const loadAndBacktest = async () => {
      try {
        setBacktesting(true);
        showReportToast("loading", "Updating report...");
        const candles = await fetchChartCandles(outputsize, reportPeriod);
        if (candles.length > 0) {
          const cleanCandles = sanitizeCandles(candles, selectedInstrument);
          const config: BacktestConfig = {
            initialBalance: 10000,
            broker: { spread: 1.5, slippage: 0.5, commission: 0 },
            maxPositions: 1,
          };
          const result = runBacktest(cleanCandles, config);
          setChartCandles(cleanCandles);
          setBacktestResult(result);
          setChartTrades(result.trades);
          showReportToast("success", `Report updated — ${selectedInstrument} ${selectedTimeframe}`, 2000);
        }
      } catch {
        showReportToast("error", "Failed to update report", 3000);
      } finally {
        setBacktesting(false);
      }
    };

    loadAndBacktest();
  }, [equityPeriod]);

  useEffect(() => {
    if (!backtestResult) {
      setChartTrades([]);
      return;
    }

    const added = strategies.filter((strategy) => strategy.addedToChart);
    if (added.length > 0) {
      setChartTrades(
        added.flatMap((strategy) =>
          backtestResult.trades.map((trade) => ({ ...trade, markerVisible: strategy.visible }))
        )
      );
    } else {
      setChartTrades(backtestResult.trades.map((trade) => ({ ...trade, markerVisible: true })));
    }
  }, [backtestResult, strategies]);

  useEffect(() => {
    loadSavedStrategies();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || chartLaunchAppliedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const requestedStrategyId = params.get("strategyId");
    const requestedVersion = Number(params.get("version"));
    const requestedInstrument = params.get("instrument");
    const requestedTimeframe = params.get("timeframe");
    const shouldRun = params.get("backtest") === "1";

    if (!requestedStrategyId && !requestedInstrument && !requestedTimeframe && !shouldRun) return;
    if (requestedStrategyId && !strategies.some((strategy) => strategy.id === requestedStrategyId)) return;

    chartLaunchAppliedRef.current = true;
    setBottomTab("metrics");
    setBottomMinimized(false);

    if (requestedStrategyId) {
      setSelectedStrategy(requestedStrategyId);
      setActiveStrategyId(requestedStrategyId);
    }

    if (Number.isFinite(requestedVersion) && requestedVersion > 0) {
      setSelectedVersion(requestedVersion);
    }

    if (requestedInstrument) {
      const broker = "OANDA";
      const watchlistKey = makeWatchlistKey(requestedInstrument, broker);
      setSelectedInstrument(requestedInstrument);
      setSelectedWatchlistKey(watchlistKey);
      setConnectedBroker(broker);
      setWorkspacePanes((current) =>
        current.map((pane) =>
          pane.id === activePaneId
            ? {
                ...pane,
                symbol: requestedInstrument,
                broker,
                watchlistKey,
                timeframe: requestedTimeframe ?? pane.timeframe,
              }
            : pane,
        ),
      );
    }

    if (requestedTimeframe) {
      setSelectedTimeframe(requestedTimeframe);
    }

    if (shouldRun) {
      chartLaunchRunRef.current = true;
    }
  }, [activePaneId, strategies]);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    const checkUsername = async () => {
      const user = (await supabase?.auth?.getUser())?.data?.user ?? null;
      if (!user) {
        setAuthChecked(true);
        const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      const existingUsername = user?.user_metadata?.username as string | undefined;
      setCurrentUsername(existingUsername ?? "Account");
      const profileChartSettings = extractUserChartSettings(user);
      if (profileChartSettings) {
        setChartSettings(profileChartSettings);
        setDraftChartSettings(profileChartSettings);
        setChartSettingsSnapshot(profileChartSettings);
        saveStoredChartSettings(profileChartSettings);
      }
      setAuthChecked(true);
    };

    checkUsername();
  }, [router, supabase]);

  useEffect(() => {
    saveStoredChartSettings(chartSettings);
  }, [chartSettings]);

  useEffect(() => {
    if (bottomTab === "strategies") loadSavedStrategies();
  }, [bottomTab]);

  useEffect(() => {
    setSelectedVersion(null);
  }, [selectedStrategy]);

  useEffect(() => {
    if (strategies.length > 0 && !strategies.some((strategy) => strategy.id === activeStrategyId)) {
      setActiveStrategyId(strategies[0].id);
    }
  }, [activeStrategyId, strategies]);

  useEffect(() => {
    if (sessionStorage.getItem("ai-minimized") !== "true") return;
    setShowMiniAI(true);
    setMiniExpanded(sessionStorage.getItem("ai-expanded") === "true");
    const saved = sessionStorage.getItem("ai-messages");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed)) setMiniMessages(parsed);
      } catch {
        sessionStorage.removeItem("ai-messages");
      }
    }
    sessionStorage.removeItem("ai-minimized");
    sessionStorage.removeItem("ai-expanded");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    miniMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [miniMessages, miniLoading]);

  useEffect(() => {
    if (!showInstrumentSearch) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowInstrumentSearch(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showInstrumentSearch]);

  useEffect(() => {
    setWatchlistSections((current) =>
      current.map((section) => ({
        ...section,
        symbols: section.symbols.map((value) => {
          if (value.includes("::")) return value;
          const existing = watchlist.find((item) => item.symbol === value);
          return existing?.key ?? makeWatchlistKey(value, "OANDA");
        }),
      })),
    );
    setWatchlistFavorites((current) =>
      current.map((value) => {
        if (value.includes("::")) return value;
        const existing = watchlist.find((item) => item.symbol === value);
        return existing?.key ?? makeWatchlistKey(value, "OANDA");
      }),
    );
    setWatchlistFlags((current) => {
      const next: Record<string, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        if (key.includes("::")) {
          next[key] = value;
          return;
        }
        const existing = watchlist.find((item) => item.symbol === key);
        next[existing?.key ?? makeWatchlistKey(key, "OANDA")] = value;
      });
      return next;
    });
  }, [watchlist]);

  const startBottomResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const mainBottom = mainRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
      const maxHeight = getBottomPanelMaxHeight();
      const rawHeight = mainBottom - moveEvent.clientY;
      if (rawHeight <= BOTTOM_PANEL_COLLAPSE_SNAP_HEIGHT) {
        setBottomMinimized(true);
        return;
      }
      const nextHeight = Math.min(maxHeight, Math.max(BOTTOM_PANEL_MIN_HEIGHT, rawHeight));
      setBottomMinimized(false);
      setBottomPanelHeight(nextHeight);
      window.localStorage.setItem("olisa-bottom-panel-height", String(nextHeight));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingAI || !aiDragRef.current) return;
      setAiWidth(Math.min(Math.max(aiDragRef.current.startWidth + e.clientX - aiDragRef.current.startX, 280), 600));
    };
    const handleMouseUp = () => setIsResizingAI(false);
    if (isResizingAI) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingAI]);

  async function signOut() {
    await supabase?.auth?.signOut();
    setCurrentUsername("Account");
    setShowUsernameModal(false);
    router.replace("/login?returnTo=/");
  }

  async function saveUsername() {
    setUsernameError("");
    if (!/^[A-Za-z0-9_]{3,}$/.test(newUsername)) {
      setUsernameError("Username must be at least 3 characters and only use letters, numbers, and underscores.");
      return;
    }

    const { error } = (await supabase?.auth?.updateUser({
      data: { username: newUsername, display_name: newUsername },
    })) ?? { error: { message: "Configuration error - please try again later." } };
    if (error) {
      setUsernameError(error.message);
      return;
    }
    setCurrentUsername(newUsername);
    setShowUsernameModal(false);
  }

  async function copyCode(code: string, key: string) {
    await navigator.clipboard.writeText(code);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1200);
  }

  async function sendChat(source: "full" | "mini") {
    const currentInput = source === "full" ? input : miniInput;
    const currentLoading = source === "full" ? loading : miniLoading;
    const currentMessages = source === "full" ? messages : miniMessages;
    if (!currentInput.trim() || currentLoading) return;
    const nextMessages = [...currentMessages, { role: "user" as const, content: currentInput.trim() }];
    if (source === "full") {
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
    } else {
      setMiniMessages(nextMessages);
      setMiniInput("");
      setMiniLoading(true);
    }
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      const finalMessages = [...nextMessages, { role: "assistant" as const, content: data.response ?? "I could not generate a strategy right now." }];
      if (source === "full") setMessages(finalMessages);
      else setMiniMessages(finalMessages);
    } catch {
      const finalMessages = [...nextMessages, { role: "assistant" as const, content: "I could not generate a strategy right now." }];
      if (source === "full") setMessages(finalMessages);
      else setMiniMessages(finalMessages);
    } finally {
      if (source === "full") setLoading(false);
      else setMiniLoading(false);
    }
  }

  const maximizeMiniAI = () => {
    sessionStorage.setItem("ai-messages", JSON.stringify(miniMessages));
    window.location.href = "/ai";
  };

  const handleRunBacktest = () => {
    setBottomTab("metrics");
    setBottomMinimized(false);
    setStrategyError("");

    if (chartCandles.length < 52) {
      setStrategyError("Not enough data. Switch to a longer timeframe or period.");
      return;
    }

    try {
      setBacktesting(true);
      const now = chartCandles[chartCandles.length - 1]?.timestamp ?? Date.now();
      const presetDays = backtestSettings.datePreset === "7d" ? 7 : backtestSettings.datePreset === "30d" ? 30 : backtestSettings.datePreset === "90d" ? 90 : backtestSettings.datePreset === "365d" ? 365 : null;
      const fromTime = backtestSettings.dateFrom ? new Date(backtestSettings.dateFrom).getTime() : presetDays ? now - presetDays * 24 * 60 * 60 * 1000 : -Infinity;
      const toTime = backtestSettings.dateTo ? new Date(backtestSettings.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
      const backtestCandles = chartCandles.filter((candle) => candle.timestamp >= fromTime && candle.timestamp <= toTime);
      if (backtestCandles.length < 52) {
        setStrategyError("Not enough data in the selected backtest date range.");
        return;
      }
      const config: BacktestConfig = {
        initialBalance: backtestSettings.initialCapital,
        broker: { spread: 1.5, slippage: backtestSettings.slippage, commission: backtestSettings.commissionValue },
        maxPositions: Math.max(1, backtestSettings.pyramiding + 1),
        ...backtestSettings,
      };

      const strategy = strategies.find((item) => item.id === activeStrategyId);
      const requestedVersion =
        selectedVersion && strategy?.id === selectedStrategy
          ? normalizeStrategy(strategy).versions?.find((version) => version.version === selectedVersion)
          : undefined;
      const strategyCode = requestedVersion?.code ?? strategy?.code ?? "";
      if (strategyCode && strategyCode.includes("function strategy")) {
        const result = runStrategyCode(backtestCandles, strategyCode, config);
        if (result.error) {
          setStrategyError(result.error);
          setBacktestResult(result);
          setChartTrades([]);
        } else {
          setBacktestResult(result);
          setChartTrades(result.trades);
          setStrategyError("");
        }
      } else {
        const result = runBacktest(backtestCandles, config);
        setBacktestResult(result);
        setChartTrades(result.trades);
        setStrategyError("");
      }
    } catch (err) {
      setStrategyError("Backtest failed: " + (err as Error).message);
    } finally {
      setBacktesting(false);
    }
  };

  useEffect(() => {
    if (!chartLaunchRunRef.current) return;
    if (!chartCandles.length) return;
    if (backtesting) return;
    chartLaunchRunRef.current = false;
    handleRunBacktest();
  }, [activeStrategyId, backtesting, chartCandles.length, selectedStrategy, selectedVersion, strategies]);

  const selectedStrategyItem = strategies.find((strategy) => strategy.id === selectedStrategy) ?? strategies[0];
  const activeStrategy = strategies.find((strategy) => strategy.id === activeStrategyId) ?? strategies[0];
  const selectedStrategyVersions = selectedStrategyItem ? normalizeStrategy(selectedStrategyItem).versions ?? [] : [];
  const currentStrategyVersion = selectedStrategyItem ? normalizeStrategy(selectedStrategyItem).currentVersion ?? 1 : 1;
  const viewedVersionNumber = selectedVersion ?? currentStrategyVersion;
  const viewedVersion = selectedStrategyVersions.find((version) => version.version === viewedVersionNumber);
  const isViewingCurrentVersion = viewedVersionNumber === currentStrategyVersion;
  const strategyDisplayCode = isViewingCurrentVersion ? selectedStrategyItem?.code ?? "" : viewedVersion?.code ?? selectedStrategyItem?.code ?? "";
  const strategyLines = strategyDisplayCode.split("\n");
  const strategyValidation = validateStrategyCode(selectedStrategyItem?.code ?? "");
  const filteredTrades = getFilteredTrades();
  const wins = filteredTrades.filter((trade) => trade.result === "WIN");
  const losses = filteredTrades.filter((trade) => trade.result === "LOSS");
  const longTrades = filteredTrades.filter((trade) => trade.direction === "LONG");
  const shortTrades = filteredTrades.filter((trade) => trade.direction === "SHORT");
  const totalPnl = filteredTrades.reduce((sum, trade) => sum + trade.pnlPoints, 0);
  const grossProfit = wins.reduce((sum, trade) => sum + Math.max(trade.pnlPoints, 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + Math.min(trade.pnlPoints, 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const pnlPercent = backtestResult ? (totalPnl / backtestSettings.initialCapital) * 100 : 0;
  const maxDrawdownUsd = backtestResult ? backtestResult.maxDrawdown : 0;
  const avgProfit = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? -grossLoss / losses.length : 0;
  const pnlValues = filteredTrades.map((trade) => trade.pnlPoints);
  const minPnl = Math.min(0, ...pnlValues);
  const maxPnl = Math.max(0, ...pnlValues);
  const binSize = Math.max((maxPnl - minPnl) / 8, 1);
  const pnlBuckets = Array.from({ length: 8 }, (_, index) => {
    const start = minPnl + index * binSize;
    const end = index === 7 ? Infinity : start + binSize;
    return { start, end, count: filteredTrades.filter((trade) => trade.pnlPoints >= start && trade.pnlPoints < end).length };
  });
  const maxBucket = Math.max(1, ...pnlBuckets.map((bucket) => bucket.count));

  const statFor = (trades: typeof filteredTrades) => {
    const localWins = trades.filter((trade) => trade.result === "WIN");
    const localLosses = trades.filter((trade) => trade.result === "LOSS");
    const localPnl = trades.reduce((sum, trade) => sum + trade.pnlPoints, 0);
    const localGrossProfit = localWins.reduce((sum, trade) => sum + Math.max(trade.pnlPoints, 0), 0);
    const localGrossLoss = Math.abs(localLosses.reduce((sum, trade) => sum + Math.min(trade.pnlPoints, 0), 0));
    const returns = trades.map((trade) => trade.pnlPercent);
    const avgReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
    const stdDev = returns.length ? Math.sqrt(returns.reduce((sum, value) => sum + Math.pow(value - avgReturn, 2), 0) / returns.length) : 0;
    const downside = returns.filter((value) => value < 0);
    const downsideStd = downside.length ? Math.sqrt(downside.reduce((sum, value) => sum + Math.pow(value, 2), 0) / downside.length) : 0;
    const duration = (trade: typeof filteredTrades[number]) => trade.durationBars ?? Math.max(1, Math.round((trade.exitTime - trade.entryTime) / (5 * 60 * 1000)));
    return {
      pnl: localPnl,
      pnlPercent: backtestSettings.initialCapital ? (localPnl / backtestSettings.initialCapital) * 100 : 0,
      grossProfit: localGrossProfit,
      grossLoss: localGrossLoss,
      profitFactor: localGrossLoss > 0 ? localGrossProfit / localGrossLoss : localGrossProfit > 0 ? Infinity : 0,
      sharpe: stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0,
      sortino: downsideStd > 0 ? (avgReturn / downsideStd) * Math.sqrt(252) : avgReturn > 0 ? 999 : 0,
      total: trades.length,
      wins: localWins.length,
      losses: localLosses.length,
      profitable: trades.length ? (localWins.length / trades.length) * 100 : 0,
      avg: trades.length ? localPnl / trades.length : 0,
      avgWin: localWins.length ? localGrossProfit / localWins.length : 0,
      avgLoss: localLosses.length ? localLosses.reduce((sum, trade) => sum + trade.pnlPoints, 0) / localLosses.length : 0,
      largestWin: localWins.length ? Math.max(...localWins.map((trade) => trade.pnlPoints)) : 0,
      largestLoss: localLosses.length ? Math.min(...localLosses.map((trade) => trade.pnlPoints)) : 0,
      avgBars: trades.length ? trades.reduce((sum, trade) => sum + duration(trade), 0) / trades.length : 0,
      avgWinBars: localWins.length ? localWins.reduce((sum, trade) => sum + duration(trade), 0) / localWins.length : 0,
      avgLossBars: localLosses.length ? localLosses.reduce((sum, trade) => sum + duration(trade), 0) / localLosses.length : 0,
    };
  };

  const allStats = statFor(filteredTrades);
  const longStats = statFor(longTrades);
  const shortStats = statFor(shortTrades);
  const money = (value: number) => `${value >= 0 ? "+" : "-"}${formatDollar(value)}`;
  const plainMoney = (value: number) => `${value < 0 ? "-" : ""}${formatDollar(value)}`;
  const percent = (value: number) => `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;
  const ratio = (value: number) => value === Infinity || value >= 999 ? "âˆž" : value.toFixed(2);
  const formatTradeDate = (timestamp: number) => new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    const valueFor = (trade: typeof filteredTrades[number]) => {
      if (tradeSort.key === "index") return filteredTrades.indexOf(trade);
      if (tradeSort.key === "pnlPercent") return trade.pnlPercent;
      if (tradeSort.key === "durationBars") return trade.durationBars ?? 0;
      return trade[tradeSort.key as keyof typeof trade] as number | string;
    };
    const aValue = valueFor(a);
    const bValue = valueFor(b);
    const comparison = typeof aValue === "string" ? String(aValue).localeCompare(String(bValue)) : Number(aValue) - Number(bValue);
    return tradeSort.direction === "asc" ? comparison : -comparison;
  });
  const updateTradeSort = (key: string) => setTradeSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));

  function persistStrategies(next: StrategyItem[]) {
    saveSavedStrategiesRaw(JSON.stringify(next.map(normalizeStrategy)));
  }

  function loadSavedStrategies() {
    const saved = loadSavedStrategiesRaw();
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as StrategyItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const normalized = parsed.map(normalizeStrategy);
      setStrategies(normalized);
      setSelectedStrategy((current) => current && normalized.some((strategy) => strategy.id === current) ? current : normalized[0]?.id ?? null);
      setActiveStrategyId((current) => current && normalized.some((strategy) => strategy.id === current) ? current : normalized[0]?.id ?? "");
    } catch {
      clearSavedStrategiesRaw();
    }
  }

  const updateStrategy = (id: string, updates: Partial<StrategyItem>) => {
    setStrategies((current) => {
      const next = current.map((strategy) =>
        strategy.id === id ? normalizeStrategy({ ...strategy, ...updates, lastModified: new Date(), updatedAt: new Date() }) : strategy
      );
      persistStrategies(next);
      return next;
    });
  };

  const saveStrategyVersion = (id: string) => {
    setStrategies((current) => {
      const next = current.map((strategy) => {
        if (strategy.id !== id) return strategy;
        const normalized = normalizeStrategy(strategy);
        const nextVersion = (normalized.currentVersion ?? normalized.versions?.length ?? 1) + 1;
        return normalizeStrategy({
          ...normalized,
          versions: [...(normalized.versions ?? []), { code: normalized.code, timestamp: new Date(), version: nextVersion }],
          currentVersion: nextVersion,
          lastModified: new Date(),
          updatedAt: new Date(),
        });
      });
      persistStrategies(next);
      setSelectedVersion(null);
      return next;
    });
  };

  const revertStrategyVersion = (id: string, version: StrategyVersion) => {
    setStrategies((current) => {
      const next = current.map((strategy) => {
        if (strategy.id !== id) return strategy;
        const normalized = normalizeStrategy(strategy);
        const nextVersion = (normalized.currentVersion ?? normalized.versions?.length ?? 1) + 1;
        return normalizeStrategy({
          ...normalized,
          code: version.code,
          versions: [...(normalized.versions ?? []), { code: version.code, timestamp: new Date(), version: nextVersion }],
          currentVersion: nextVersion,
          lastModified: new Date(),
          updatedAt: new Date(),
        });
      });
      persistStrategies(next);
      setSelectedVersion(null);
      return next;
    });
  };

  const toggleStrategyOnChart = (id: string) => {
    const strategy = strategies.find((item) => item.id === id);
    if (!strategy) return;
    if (!strategy.addedToChart) {
      setChartIndicatorsSuppressed(false);
    }
    updateStrategy(id, { addedToChart: !strategy.addedToChart, visible: strategy.addedToChart ? strategy.visible : true });
    if (!backtestResult && !strategy.addedToChart) handleRunBacktest();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const brokerConnectError = params.get("brokerConnectError");
    const brokerConnectMessage = params.get("brokerConnectMessage");
    if (!brokerConnectError) return;

    if (brokerConnectError === "ctrader_not_configured") {
      showReportToast("error", "cTrader connect is not configured on this environment yet.", 5000);
    } else if (brokerConnectError === "ctrader_state_mismatch") {
      showReportToast("error", "cTrader authorisation expired. Please click Continue to cTrader again.", 6000);
    } else if (brokerConnectError === "ctrader_missing_code") {
      showReportToast("error", "cTrader did not return an authorisation code. Please try again.", 6000);
    } else {
      showReportToast(
        "error",
        brokerConnectMessage
          ? `Broker connect failed: ${brokerConnectMessage}`
          : "Broker connect failed. Please try again.",
        7000,
      );
    }

    params.delete("brokerConnectError");
    params.delete("brokerConnectMessage");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const handleRemoveAllIndicatorsFromChart = useCallback(() => {
    setChartIndicatorsSuppressed(true);
    setStrategies((current) => {
      const next = current.map((strategy) =>
        strategy.addedToChart
          ? normalizeStrategy({
              ...strategy,
              addedToChart: false,
              visible: false,
              lastModified: new Date(),
              updatedAt: new Date(),
            })
          : strategy,
      );
      persistStrategies(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleRemoveAllIndicatorsEvent = () => {
      handleRemoveAllIndicatorsFromChart();
    };

    window.addEventListener("kwantify:remove-all-indicators", handleRemoveAllIndicatorsEvent);
    return () => {
      window.removeEventListener("kwantify:remove-all-indicators", handleRemoveAllIndicatorsEvent);
    };
  }, [handleRemoveAllIndicatorsFromChart]);

  const duplicateStrategy = (strategy: StrategyItem) => {
    const copy = normalizeStrategy({ ...strategy, id: `strategy-${Date.now()}`, name: `${strategy.name} Copy`, addedToChart: false, lastModified: new Date(), updatedAt: new Date() });
    setStrategies((current) => {
      const next = [copy, ...current];
      persistStrategies(next);
      return next;
    });
    setSelectedStrategy(copy.id);
  };

  const deleteStrategy = (id: string) => {
    setStrategies((current) => {
      const next = current.filter((strategy) => strategy.id !== id);
      if (selectedStrategy === id) setSelectedStrategy(next[0]?.id ?? null);
      persistStrategies(next);
      return next;
    });
  };

  const editStrategy = (strategy: StrategyItem) => {
    sessionStorage.setItem("olisa-editor-strategy", JSON.stringify(strategy));
    sessionStorage.setItem(`olisa-editor-strategy-${strategy.id}`, JSON.stringify(strategy));
    window.location.href = `/editor?strategy=${strategy.id}`;
  };

  function getFilteredEquityCurve() {
    if (!backtestResult) return [];
    const curve = backtestResult.equityCurve;
    if (equityPeriod === "all" || curve.length === 0) return curve;
    const now = curve[curve.length - 1].timestamp;
    const days = equityPeriod === "7d" ? 7 : equityPeriod === "30d" ? 30 : equityPeriod === "90d" ? 90 : 365;
    return curve.filter((p) => p.timestamp >= now - days * 24 * 60 * 60 * 1000);
  }

  function getFilteredTrades() {
    if (!backtestResult) return [];
    if (equityPeriod === "all") return backtestResult.trades;
    const curve = backtestResult.equityCurve;
    if (curve.length === 0) return backtestResult.trades;
    const now = curve[curve.length - 1].timestamp;
    const days = equityPeriod === "7d" ? 7 : equityPeriod === "30d" ? 30 : equityPeriod === "90d" ? 90 : 365;
    return backtestResult.trades.filter((t) => t.entryTime >= now - days * 24 * 60 * 60 * 1000);
  }

  const toggleFavTF = (tf: string) => {
    setFavTFs((current) =>
      current.includes(tf) ? (current.length > 1 ? current.filter((item) => item !== tf) : current) : [...current, tf]
    );
  };

  const watchlistBySymbol = new Map(watchlist.map((item) => [item.key, item]));

  const sortSectionSymbols = (symbols: string[]) => {
    const knownSymbols = symbols.filter((symbol) => watchlistBySymbol.has(symbol));
    const favorites = knownSymbols.filter((symbol) => watchlistFavorites.includes(symbol)).sort((a, b) => a.localeCompare(b));
    const rest = knownSymbols.filter((symbol) => !watchlistFavorites.includes(symbol));
    return [...favorites, ...rest];
  };

  const toggleWatchlistFavorite = (symbol: string) => {
    setWatchlistFavorites((current) => current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]);
    setWatchlistContextMenu(null);
  };

  const flagWatchlistSymbol = (symbol: string, color: string) => {
    setWatchlistFlags((current) => ({ ...current, [symbol]: color }));
    setWatchlistContextMenu(null);
  };

  const unflagAllSymbols = () => {
    setWatchlistFlags({});
    setWatchlistContextMenu(null);
  };

  const removeWatchlistSymbol = (symbol: string) => {
    setWatchlist((current) => current.filter((item) => item.key !== symbol));
    setWatchlistSections((current) => current.map((section) => ({ ...section, symbols: section.symbols.filter((item) => item !== symbol) })));
    setWatchlistFavorites((current) => current.filter((item) => item !== symbol));
    setWatchlistFlags((current) => {
      const next = { ...current };
      delete next[symbol];
      return next;
    });
    setWatchlistContextMenu(null);
  };

  const addWatchlistSection = () => {
    const id = `section-${Date.now()}`;
    setWatchlistSections((current) => [...current, { id, name: "New Section", symbols: [] }]);
    setRenamingSectionId(id);
    setWatchlistContextMenu(null);
  };

  const moveWatchlistSection = (sectionId: string, direction: "up" | "down") => {
    setWatchlistSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setSectionContextMenu(null);
  };

  const duplicateWatchlistSection = (sectionId: string) => {
    setWatchlistSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      if (index < 0) return current;
      const section = current[index];
      const copy = { ...section, id: `section-${Date.now()}`, name: `${section.name} Copy`, symbols: [...section.symbols] };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSectionContextMenu(null);
  };

  const deleteWatchlistSection = (sectionId: string) => {
    setWatchlistSections((current) => {
      if (current.length <= 1) return current;
      const section = current.find((item) => item.id === sectionId);
      if (!section) return current;
      if (section.symbols.length > 0 && !window.confirm("Move symbols to Main?")) return current;

      const targetSection = current.find((item) => item.id !== sectionId);
      return current
        .filter((item) => item.id !== sectionId)
        .map((item) => item.id === targetSection?.id ? { ...item, symbols: [...item.symbols, ...section.symbols] } : item);
    });
    setSectionContextMenu(null);
  };

  const moveWatchlistSymbol = (symbol: string, targetSectionId: string, targetSymbol?: string) => {
    setWatchlistSections((current) => current.map((section) => {
      const withoutSymbol = section.symbols.filter((item) => item !== symbol);
      if (section.id !== targetSectionId) return { ...section, symbols: withoutSymbol };
      const insertIndex = targetSymbol ? withoutSymbol.indexOf(targetSymbol) : withoutSymbol.length;
      const nextSymbols = [...withoutSymbol];
      nextSymbols.splice(insertIndex >= 0 ? insertIndex : nextSymbols.length, 0, symbol);
      return { ...section, symbols: nextSymbols };
    }));
    setWatchlistDropTarget(null);
  };

  const moveWatchlistSymbolToSection = (symbol: string, sectionId: string) => {
    moveWatchlistSymbol(symbol, sectionId);
    setWatchlistContextMenu(null);
  };

  const renderWatchlistRow = (row: WatchlistItem, section: WatchlistSection) => {
    const displayPrice = formatPrice(row.mid, row.symbol);
    const priceColor = row.flash === "up" ? "#22C55E" : row.flash === "down" ? "#EF4444" : "#A1A1AA";
    const changeColor = row.change > 0 ? "#22C55E" : row.change < 0 ? "#EF4444" : "#A1A1AA";
    const percentColor = row.changePercent > 0 ? "#22C55E" : row.changePercent < 0 ? "#EF4444" : "#A1A1AA";
    const isDropTarget = watchlistDropTarget?.sectionId === section.id && watchlistDropTarget.symbol === row.key;
    const isFavorite = watchlistFavorites.includes(row.key);
    return (
      <button
        key={row.key}
        draggable
        onClick={() => selectInstrument(row.symbol, row.broker, row.key)}
        onContextMenu={(event) => {
          event.preventDefault();
          setSectionContextMenu(null);
          setWatchlistContextMenu({ x: event.clientX, y: event.clientY, key: row.key, symbol: row.symbol });
        }}
        onDragStart={() => setDraggedWatchlistItem({ symbol: row.key, sectionId: section.id })}
        onDragEnd={() => {
          setDraggedWatchlistItem(null);
          setWatchlistDropTarget(null);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setWatchlistDropTarget({ sectionId: section.id, symbol: row.key });
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedWatchlistItem) moveWatchlistSymbol(draggedWatchlistItem.symbol, section.id, row.key);
          setDraggedWatchlistItem(null);
        }}
        className={`grid w-full grid-cols-[minmax(92px,1fr)_74px_54px_54px] items-center gap-2 border-t-2 px-3 py-2 text-left transition-colors hover:bg-surface/60 ${isDropTarget ? "border-blue-500" : "border-transparent"} ${selectedWatchlistKey === row.key ? "bg-surface" : ""}`}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {watchlistFlags[row.key] && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: watchlistFlags[row.key] }} />}
            <span className="block truncate text-[9px] uppercase tracking-wider text-muted">{row.broker}</span>
            {row.delayed && (
              <AlertTriangle className="h-3 w-3 shrink-0 text-orange-300/90" aria-label="Delayed market data" />
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="block truncate text-[13px] font-medium text-foreground">{row.symbol}</span>
            {isFavorite && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${row.symbol} from favorites`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleWatchlistFavorite(row.key);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleWatchlistFavorite(row.key);
                  }
                }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-yellow-400 transition-colors hover:text-yellow-300"
              >
                <Star className="h-3 w-3 fill-current text-current" />
              </span>
            )}
          </span>
        </span>
        <span className="text-right font-mono text-[12px] transition-colors duration-500" style={{ color: priceColor }}>{displayPrice}</span>
        <span className="text-right font-mono text-[11px]" style={{ color: changeColor }}>{row.change > 0 ? "+" : row.change < 0 ? "-" : ""}{Math.abs(row.change).toFixed(2)}</span>
        <span className="text-right font-mono text-[11px]" style={{ color: percentColor }}>{row.changePercent > 0 ? "+" : ""}{row.changePercent.toFixed(2)}%</span>
      </button>
    );
  };

  const addInstrument = (entry: InstrumentPickerItem) => {
    const detail = getStaticWatchlistDetail(entry.symbol, entry.broker, watchlistDetails);
    const watchlistItem = createWatchlistItem(entry.symbol, entry.broker, detail ? { price: detail.price, change: detail.change } : undefined);
    setWatchlist((current) => current.some((item) => item.key === watchlistItem.key) ? current : [...current, watchlistItem]);
    setWatchlistSections((current) =>
      current.some((section) => section.symbols.includes(watchlistItem.key))
        ? current
        : current.map((section, index) => index === 0 ? { ...section, symbols: [...section.symbols, watchlistItem.key] } : section),
    );
    setWatchlistFavorites((current) => current.includes(watchlistItem.key) ? current : [...current, watchlistItem.key]);
    selectInstrument(entry.symbol, entry.broker, watchlistItem.key);
  };

  const toggleInstrumentInWatchlist = (entry: InstrumentPickerItem) => {
    const exists = watchlistSectionSymbolKeys.has(entry.key);
    if (exists) {
      removeWatchlistSymbol(entry.key);
      return;
    }
    addInstrument(entry);
  };

  const updateWorkspacePane = useCallback((paneId: string, patch: Partial<WorkspacePane>) => {
    setWorkspacePanes((current) => current.map((pane) => (pane.id === paneId ? { ...pane, ...patch } : pane)));
  }, []);

  const activateWorkspacePane = useCallback((paneId: string) => {
    const nextPane = workspacePanes.find((pane) => pane.id === paneId);
    if (!nextPane) return;
    setActivePaneId(paneId);
    setSelectedInstrument(nextPane.symbol);
    setSelectedTimeframe(nextPane.timeframe);
    setSelectedPeriod(nextPane.period);
    setConnectedBroker(nextPane.broker);
    setSelectedWatchlistKey(nextPane.watchlistKey);
    window.localStorage.setItem("olisa-connected-broker", nextPane.broker);
    window.sessionStorage.setItem("olisa-broker-session", JSON.stringify({ broker: nextPane.broker, mode: brokerMode, connectedAt: new Date().toISOString() }));
  }, [brokerMode, workspacePanes]);

  const startWorkspaceResize = (axis: "split-x" | "split-y" | "quad-x" | "quad-y", event: React.MouseEvent<HTMLDivElement>) => {
    if (workspaceLocked) return;
    event.preventDefault();
    const container = mainRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (axis === "split-x") {
        const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        setWorkspaceSplitRatio(Math.min(80, Math.max(20, next)));
        return;
      }
      if (axis === "split-y") {
        const next = ((moveEvent.clientY - rect.top - CHART_TOP_BAR_HEIGHT) / Math.max(rect.height - CHART_TOP_BAR_HEIGHT, 1)) * 100;
        setWorkspaceSplitRatio(Math.min(80, Math.max(20, next)));
        return;
      }
      if (axis === "quad-x") {
        const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        setWorkspaceQuadSplit((current) => ({ ...current, x: Math.min(75, Math.max(25, next)) }));
        return;
      }
      const next = ((moveEvent.clientY - rect.top - CHART_TOP_BAR_HEIGHT) / Math.max(rect.height - CHART_TOP_BAR_HEIGHT, 1)) * 100;
      setWorkspaceQuadSplit((current) => ({ ...current, y: Math.min(75, Math.max(25, next)) }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const startRightPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rawWidth = window.innerWidth - moveEvent.clientX - 44;
      if (rawWidth <= RIGHT_PANEL_COLLAPSE_SNAP_WIDTH) {
        setRightPanel(null);
        return;
      }
      const nextWidth = Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, rawWidth));
      setRightPanelWidth(nextWidth);
      window.localStorage.setItem("olisa-right-panel-width", String(nextWidth));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const toggleRightPanel = (panel: "order" | "watchlist" | "alerts" | "alertslog") => {
    setRightPanel((current) => current === panel ? null : panel);
  };

  const reopenRightPanel = () => {
    setRightPanel(lastOpenRightPanel);
  };

  const filteredBrokers = brokers
    .filter((broker) => broker.name.toLowerCase().includes(brokerSearch.toLowerCase()))
    .sort((a, b) => {
      const aFav = brokerFavourites.includes(a.name);
      const bFav = brokerFavourites.includes(b.name);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return brokers.findIndex((broker) => broker.name === a.name) - brokers.findIndex((broker) => broker.name === b.name);
    });

  function getBrokerHealth(broker: Broker) {
    const connection = brokerConnections[broker.name];
    const hasFeedError = Boolean(feedErrorByBroker[broker.name]);
    const linkedAccounts = ctraderAccountsByBroker[broker.name] ?? [];

    if (broker.type === "paper") {
      if (paperTradingAccounts.length === 0) {
        return {
          state: "not_ready" as const,
          label: "Not ready",
          dotClassName: "bg-orange-400",
          detail: "Create a paper account to start",
        };
      }
      return {
        state: "connected" as const,
        label: "Connected",
        dotClassName: "bg-primary",
        detail: connection?.accountLabel ?? `${paperTradingAccounts.length} paper account${paperTradingAccounts.length === 1 ? "" : "s"} ready`,
      };
    }

    if (hasFeedError) {
      return {
        state: "broken" as const,
        label: "Broken",
        dotClassName: "bg-danger",
        detail: feedErrorByBroker[broker.name] ?? "Connection error",
      };
    }

    if (broker.type === "ctrader" && linkedAccounts.length > 0) {
      return {
        state: "connected" as const,
        label: "Connected",
        dotClassName: "bg-primary",
        detail: `${linkedAccounts.length} account${linkedAccounts.length === 1 ? "" : "s"} linked`,
      };
    }

    if (connection?.ownership === "shared") {
      return {
        state: "not_ready" as const,
        label: "Not ready",
        dotClassName: "bg-orange-400",
        detail: "Shared feed only",
      };
    }

    if (connection?.ownership === "user" && connection.connectionState === "connected") {
      return {
        state: "connected" as const,
        label: "Connected",
        dotClassName: "bg-primary",
        detail: connection.accountLabel ?? "Broker linked",
      };
    }

    return {
      state: "not_ready" as const,
      label: "Not ready",
      dotClassName: "bg-orange-400",
      detail: broker.type === "soon" ? "Coming soon" : "Connect to unlock trading",
    };
  }

  const toggleBrokerFavourite = (brokerName: string) => {
    setBrokerFavourites((current) => {
      const next = current.includes(brokerName) ? current.filter((name) => name !== brokerName) : [...current, brokerName];
      window.localStorage.setItem("olisa-broker-favourites", JSON.stringify(next));
      return next;
    });
  };

  const connectBroker = (brokerName: string) => {
    const broker = brokerByName[brokerName];
    const paperAccount =
      broker?.type === "paper"
        ? paperTradingAccounts.find((account) => account.id === brokerConnections[brokerName]?.accountId) ??
          paperTradingAccounts[0] ??
          null
        : null;
    const ctraderAccount =
      broker?.type === "ctrader"
        ? ctraderAccountsByBroker[brokerName]?.find((account) => account.accountId === brokerConnections[brokerName]?.accountId) ??
          ctraderAccountsByBroker[brokerName]?.[0] ??
          null
        : null;
    const nextConnection: BrokerConnectionState = {
      broker: brokerName,
      mode: broker?.type === "paper" ? "Demo" : ctraderAccount?.isLive ? "Live" : brokerMode,
      ownership: broker?.type === "paper" ? "paper" : ctraderAccount ? "user" : "shared",
      connectionState:
        broker?.type === "paper"
          ? paperAccount
            ? "connected"
            : "not_ready"
          : ctraderAccount
            ? "connected"
            : "not_ready",
      connectedAt: new Date().toISOString(),
      accountId: broker?.type === "paper" ? paperAccount?.id : ctraderAccount?.accountId,
      accountLabel:
        broker?.type === "paper"
          ? paperAccount?.name ?? "No paper account selected"
          : ctraderAccount
            ? formatCTraderAccountLabel(ctraderAccount)
            : `${brokerName} shared feed`,
    };
    updateWorkspacePane(activePaneId, {
      broker: brokerName,
      watchlistKey: makeWatchlistKey(selectedInstrument, brokerName),
    });
    setBrokerConnections((current) => ({ ...current, [brokerName]: nextConnection }));
    setConnectedBroker(brokerName);
    window.localStorage.setItem("olisa-connected-broker", brokerName);
    window.sessionStorage.setItem("olisa-broker-session", JSON.stringify(nextConnection));
    setSelectedBroker(null);
    setShowBrokerModal(false);
  };

  const selectPaperTradingAccount = (accountId: string) => {
    const nextAccount = paperTradingAccounts.find((account) => account.id === accountId);
    if (!nextAccount) return;
    setBrokerConnections((current) => ({
      ...current,
      ["Paper Trading"]: {
        ...(current["Paper Trading"] ?? {
          broker: "Paper Trading",
          ownership: "paper",
          mode: "Demo",
          connectedAt: new Date().toISOString(),
        }),
        broker: "Paper Trading",
        ownership: "paper",
        mode: "Demo",
        connectionState: "connected",
        accountId: nextAccount.id,
        accountLabel: nextAccount.name,
      },
    }));
  };

  const selectBrokerAccount = (brokerName: string, accountId: number) => {
    const nextAccount = (ctraderAccountsByBroker[brokerName] ?? []).find((account) => account.accountId === accountId);
    if (!nextAccount) return;

    setBrokerConnections((current) => ({
      ...current,
      [brokerName]: {
        ...(current[brokerName] ?? {
          broker: brokerName,
          ownership: "user",
          connectedAt: new Date().toISOString(),
        }),
        broker: brokerName,
        mode: nextAccount.isLive ? "Live" : "Demo",
        ownership: "user",
        connectionState: "connected",
        accountId: nextAccount.accountId,
        accountLabel: formatCTraderAccountLabel(nextAccount),
      },
    }));
  };

  const startCTraderBrokerConnect = (brokerName: string) => {
    if (typeof window === "undefined") return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/ctrader/start?scope=trading&broker=${encodeURIComponent(brokerName)}&returnTo=${encodeURIComponent(returnTo)}`;
  };

  const clearBacktest = () => {
    setChartTrades([]);
    setBacktestResult(null);
  };

  const selectInstrument = (symbol: string, broker?: string, watchlistKey?: string) => {
    clearBacktest();
    updateWorkspacePane(activePaneId, {
      symbol,
      broker: broker ?? connectedBroker ?? "OANDA",
      watchlistKey: watchlistKey ?? makeWatchlistKey(symbol, broker ?? connectedBroker ?? "OANDA"),
    });
    setSelectedInstrument(symbol);
    if (watchlistKey) setSelectedWatchlistKey(watchlistKey);
    if (broker && broker !== connectedBroker) {
      setConnectedBroker(broker);
      window.localStorage.setItem("olisa-connected-broker", broker);
      window.sessionStorage.setItem("olisa-broker-session", JSON.stringify({ broker, mode: brokerMode, connectedAt: new Date().toISOString() }));
    }
  };

  const selectTimeframe = (timeframe: string) => {
    clearBacktest();
    updateWorkspacePane(activePaneId, { timeframe });
    setSelectedTimeframe(timeframe);
  };

  const chooseBroker = (broker: Broker) => {
    setSelectedBroker(broker);
    setBrokerMode("Demo");
  };

  const selectedBrokerAccounts = selectedBroker ? ctraderAccountsByBroker[selectedBroker.name] ?? [] : [];
  const selectedBrokerPaperAccounts = selectedBroker?.type === "paper" ? paperTradingAccounts : [];

  const createQuickPaperTradingAccount = () => {
    const trimmedName = paperAccountName.trim();
    if (!trimmedName) return;
    const nextAccount = createPaperTradingAccount({
      name: trimmedName,
      balance: parsePaperMoney(paperAccountBalance),
      leverage: paperAccountLeverage,
      instrument: paperAccountInstrument,
      strategy: paperAccountStrategy,
    });
    setPaperTradingAccounts((current) => [nextAccount, ...current]);
    setBrokerConnections((current) => ({
      ...current,
      ["Paper Trading"]: {
        broker: "Paper Trading",
        ownership: "paper",
        mode: "Demo",
        connectionState: "connected",
        connectedAt: new Date().toISOString(),
        accountId: nextAccount.id,
        accountLabel: nextAccount.name,
      },
    }));
    setPaperAccountName("");
    setPaperAccountBalance("$10,000");
    setPaperAccountInstrument("NAS100");
    setPaperAccountLeverage("1:30");
    setPaperAccountStrategy("Manual / No Strategy");
    setShowQuickPaperAccountForm(false);
  };

  const handleChartPeriod = (paneId: string, period: string) => {
    clearBacktest();
    updateWorkspacePane(paneId, { period });
    if (paneId === activePaneId) {
      setSelectedPeriod(period);
    }
  };

  if (!authChecked) {
    return <div className="h-screen w-screen bg-background" />;
  }

  return (
    <div className="flex h-screen select-none overflow-hidden bg-background text-foreground">
      <AppSidebar
        activeItem="charts"
        accountLabel="Account"
        accountTitle={currentUsername ? `Sign out @${currentUsername}` : "Account"}
        onAccountClick={signOut}
      />

      {showAI && (
        <div style={{ width: aiWidth }} className="relative flex shrink-0 flex-col border-r border-border bg-panel">
          <div className="flex h-12 items-center justify-between border-b border-border px-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="text-[13px] font-semibold">Strategy Builder</span></div><button onClick={() => setShowAI(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && <div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div><p className="mb-4 max-w-[260px] text-[13px] leading-6 text-muted">Describe a strategy in plain English and Kwantify will generate structured strategy code.</p><div className="w-full space-y-2">{["NAS100 FVG long, London session, regime filter", "XAUUSD mean reversion 15m, tight SL", "BTCUSD momentum with liquidity sweep"].map((example) => <button key={example} onClick={() => setInput(example)} className="w-full rounded-xl border border-border bg-surface p-3 text-left text-[13px] text-muted transition-colors hover:border-primary/30 hover:text-foreground">{example}</button>)}</div></div>}
            {messages.map((msg, i) => <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={msg.role === "user" ? "max-w-[85%] rounded-2xl bg-surface px-4 py-3 text-[13px] leading-6" : "max-w-[92%] rounded-2xl border border-border bg-card px-4 py-3"}>{msg.role === "assistant" && <div className="mb-2 text-[11px] font-semibold">Kwantify AI</div>}{msg.role === "assistant" ? <AssistantContent text={msg.content} copiedKey={copiedKey} onCopy={copyCode} /> : msg.content}</div></div>)}
            {loading && <div className="flex gap-1.5"><div className="h-2 w-2 animate-pulse rounded-full bg-primary" /><div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" /><div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" /></div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-border p-3"><div className="flex gap-2 rounded-2xl border border-border bg-surface p-2 focus-within:border-primary/40"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat("full")} placeholder="Describe your strategy..." className="flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:text-muted/60" /><button onClick={() => sendChat("full")} disabled={loading || !input.trim()} className="rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-background disabled:opacity-40">Build</button></div></div>
          <div onMouseDown={(e) => { setIsResizingAI(true); aiDragRef.current = { startX: e.clientX, startWidth: aiWidth }; }} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col" ref={mainRef}>
        <header className="relative flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-panel px-5">
          {chartTrades.length > 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2 py-1">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[11px] text-primary">Backtest Active</span>
                <button onClick={clearBacktest} className="ml-1 text-[10px] text-muted hover:text-foreground">Clear</button>
              </div>
            </>
          )}
          <div className="relative flex items-center gap-0.5">
            {favTFs.map((tf) => <button key={tf} onClick={() => selectTimeframe(tf)} className={`rounded-lg px-2.5 py-1.5 text-[13px] transition-all ${selectedTimeframe === tf ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>{tf}</button>)}
            <button onClick={() => setShowAllTF(!showAllTF)} className="rounded-lg px-2 py-1.5 text-muted hover:text-foreground"><ChevronDown className="h-4 w-4" /></button>
            {showAllTF && <div className="absolute left-0 top-[34px] z-50 grid w-[360px] grid-cols-4 gap-1 rounded-2xl border border-border bg-panel p-3 shadow-2xl shadow-black/40">{allTimeframes.map((tf) => <div key={tf} className="flex items-center rounded-lg hover:bg-surface"><button onClick={() => { selectTimeframe(tf); setShowAllTF(false); }} className="flex-1 px-2 py-1.5 text-left text-[12px]">{tf}</button><button onClick={() => toggleFavTF(tf)} className="px-2 text-muted hover:text-primary"><Star className={`h-3.5 w-3.5 ${favTFs.includes(tf) ? "fill-primary text-primary" : ""}`} /></button></div>)}</div>}
          </div>
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-xl border border-border bg-surface/70 p-1">
            {[
              {
                layout: "single" as WorkspaceLayout,
                title: "Single chart",
                icon: (
                  <span className="grid h-4 w-4 grid-cols-1 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
              {
                layout: "split-vertical" as WorkspaceLayout,
                title: "Two charts side by side",
                icon: (
                  <span className="grid h-4 w-4 grid-cols-2 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
              {
                layout: "split-horizontal" as WorkspaceLayout,
                title: "Two charts stacked",
                icon: (
                  <span className="grid h-4 w-4 grid-rows-2 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
              {
                layout: "quad" as WorkspaceLayout,
                title: "Four-chart grid",
                icon: (
                  <span className="grid h-4 w-4 grid-cols-2 grid-rows-2 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
            ].map(({ layout, title, icon }) => (
              <button
                key={layout}
                onClick={() => setWorkspaceLayout(layout)}
                title={title}
                aria-label={title}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${workspaceLayout === layout ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}
              >
                {icon}
              </button>
            ))}
            <button
              onClick={() => setWorkspaceLocked((current) => !current)}
              className={`ml-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${workspaceLocked ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground"}`}
              title={workspaceLocked ? "Unlock layout" : "Lock layout"}
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setShowBrokerModal(true)}
            className="cursor-pointer rounded-lg border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-all hover:bg-card"
          >
            Trade
          </button>
          <div className="mr-3 flex items-center gap-2"><span className={`text-[12px] font-medium ${selectedChangePercent >= 0 ? "text-primary" : "text-danger"}`}>{selectedChangePercent >= 0 ? "+" : ""}{selectedChangePercent.toFixed(2)}%</span></div>
          <button onClick={signOut} title={currentUsername ? `@${currentUsername}` : "Account"} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface transition-colors hover:bg-card"><User className="h-4 w-4 text-muted" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="relative h-full min-w-0">
            {workspaceLayout === "single" && (
              <WorkspaceChartPane
                pane={activeWorkspacePane}
                active
                period={activeWorkspacePane.period}
                settings={chartSettings}
                trades={chartTrades}
                onActivate={() => activateWorkspacePane(activeWorkspacePane.id)}
                onOpenSettings={openChartSettings}
                onCreateAlertAtPrice={openCreateAlert}
                onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                onSelectPeriod={(period) => handleChartPeriod(activeWorkspacePane.id, period)}
              />
            )}
            {workspaceLayout === "split-vertical" && (
              <>
                <div className="absolute inset-y-0 left-0" style={{ width: `calc(${workspaceSplitRatio}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
                <div
                  onMouseDown={(event) => startWorkspaceResize("split-x", event)}
                  className={`absolute inset-y-0 z-20 w-1.5 -translate-x-1/2 ${workspaceLocked ? "cursor-default" : "cursor-col-resize"}`}
                  style={{ left: `${workspaceSplitRatio}%` }}
                >
                  <div className="h-full w-full bg-border/70 hover:bg-primary/50" />
                </div>
                <div className="absolute inset-y-0 right-0" style={{ width: `calc(${100 - workspaceSplitRatio}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
              </>
            )}
            {workspaceLayout === "split-horizontal" && (
              <>
                <div className="absolute inset-x-0 top-0" style={{ height: `calc(${workspaceSplitRatio}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
                <div
                  onMouseDown={(event) => startWorkspaceResize("split-y", event)}
                  className={`absolute inset-x-0 z-20 h-1.5 -translate-y-1/2 ${workspaceLocked ? "cursor-default" : "cursor-row-resize"}`}
                  style={{ top: `${workspaceSplitRatio}%` }}
                >
                  <div className="h-full w-full bg-border/70 hover:bg-primary/50" />
                </div>
                <div className="absolute inset-x-0 bottom-0" style={{ height: `calc(${100 - workspaceSplitRatio}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
              </>
            )}
            {workspaceLayout === "quad" && (
              <>
                <div className="absolute left-0 top-0" style={{ width: `calc(${workspaceQuadSplit.x}% - 3px)`, height: `calc(${workspaceQuadSplit.y}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
                <div className="absolute right-0 top-0" style={{ width: `calc(${100 - workspaceQuadSplit.x}% - 3px)`, height: `calc(${workspaceQuadSplit.y}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[1] ?? workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
                <div className="absolute bottom-0 left-0" style={{ width: `calc(${workspaceQuadSplit.x}% - 3px)`, height: `calc(${100 - workspaceQuadSplit.y}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[2] ?? workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[2] ?? workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[2] ?? workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[2] ?? workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[2] ?? workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[2] ?? workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
                <div className="absolute bottom-0 right-0" style={{ width: `calc(${100 - workspaceQuadSplit.x}% - 3px)`, height: `calc(${100 - workspaceQuadSplit.y}% - 3px)` }}>
                  <WorkspaceChartPane
                    pane={workspacePanes[3] ?? workspacePanes[0] ?? activeWorkspacePane}
                    active={activePaneId === (workspacePanes[3] ?? workspacePanes[0] ?? activeWorkspacePane).id}
                    period={(workspacePanes[3] ?? workspacePanes[0] ?? activeWorkspacePane).period}
                    settings={chartSettings}
                    trades={activePaneId === (workspacePanes[3] ?? workspacePanes[0] ?? activeWorkspacePane).id ? chartTrades : []}
                    onActivate={() => activateWorkspacePane((workspacePanes[3] ?? workspacePanes[0] ?? activeWorkspacePane).id)}
                    onOpenSettings={openChartSettings}
                    onCreateAlertAtPrice={openCreateAlert}
                    onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
                    onSelectPeriod={(period) => handleChartPeriod((workspacePanes[3] ?? workspacePanes[0] ?? activeWorkspacePane).id, period)}
                  />
                </div>
                <div
                  onMouseDown={(event) => startWorkspaceResize("quad-x", event)}
                  className={`absolute inset-y-0 z-20 w-1.5 -translate-x-1/2 ${workspaceLocked ? "cursor-default" : "cursor-col-resize"}`}
                  style={{ left: `${workspaceQuadSplit.x}%` }}
                >
                  <div className="h-full w-full bg-border/70 hover:bg-primary/50" />
                </div>
                <div
                  onMouseDown={(event) => startWorkspaceResize("quad-y", event)}
                  className={`absolute inset-x-0 z-20 h-1.5 -translate-y-1/2 ${workspaceLocked ? "cursor-default" : "cursor-row-resize"}`}
                  style={{ top: `${workspaceQuadSplit.y}%` }}
                >
                  <div className="h-full w-full bg-border/70 hover:bg-primary/50" />
                </div>
              </>
            )}
            {chartLoadingMessage && <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg border border-border bg-panel/90 px-3 py-1.5 text-[12px] text-muted shadow-lg backdrop-blur">{chartLoadingMessage}</div>}
            {/* Strategy labels overlay */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
              {strategies.filter(s => !chartIndicatorsSuppressed && s.addedToChart).map(s => (
                <div key={s.id} className={"flex items-center gap-2 bg-panel/80 backdrop-blur border border-border rounded-lg px-2.5 py-1.5 transition-all duration-200 " + (s.visible ? "" : "opacity-40")}>
                  <div className={"w-2 h-2 rounded-full " + (s.visible ? ((s.totalPnl ?? 0) >= 0 ? "bg-primary" : "bg-danger") : "bg-muted")} />
                  <span className={"text-[11px] font-medium " + (s.visible ? "text-foreground" : "text-muted")}>{s.name}</span>
                  <button onClick={() => {
                    const updated = strategies.map(st => st.id === s.id ? { ...st, visible: !st.visible } : st);
                    setStrategies(updated);
                  }} className="text-muted hover:text-foreground transition-colors">
                    {s.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {false && rightPanel && (
            <div style={{ width: rightPanelWidth }} className="relative flex shrink-0 flex-col border-l border-border bg-panel">
              <div onMouseDown={startRightPanelResize} className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:w-1.5 hover:bg-primary/30" />
              {rightPanel === "order" && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-primary"><Zap className="h-3.5 w-3.5" /></div><div><div className="text-[13px] font-semibold text-foreground">{selectedInstrument}</div><div className="text-[11px] text-muted">Order ticket</div></div></div>
                    <button onClick={() => setRightPanel(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="relative mb-4 grid grid-cols-2 gap-2">
                    <button onClick={() => setOrderSide("sell")} className={`rounded-xl border border-danger/20 px-3 py-2 text-left transition-all ${orderSide === "sell" ? "bg-danger/20 text-danger" : "bg-danger/10 text-danger/80"}`}><div className="text-[12px] font-semibold">Sell</div><div className="font-mono text-[13px]">{watchlistDetails[selectedInstrument]?.price ?? "29,096.2"}</div></button>
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-muted">0.0</div>
                    <button onClick={() => setOrderSide("buy")} className={`rounded-xl border border-primary/20 px-3 py-2 text-right transition-all ${orderSide === "buy" ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/80"}`}><div className="text-[12px] font-semibold">Buy</div><div className="font-mono text-[13px]">{watchlistDetails[selectedInstrument]?.price ?? "29,096.2"}</div></button>
                  </div>
                  <div className="mb-4 grid grid-cols-3 border-b border-border text-[13px]">{(["market", "limit", "stop"] as const).map((type) => <button key={type} onClick={() => setOrderType(type)} className={`py-2 capitalize transition-colors ${orderType === type ? "border-b-2 border-primary text-foreground" : "text-muted hover:text-foreground"}`}>{type}</button>)}</div>
                  {orderType !== "market" && <div className="mb-4 space-y-1.5"><label className="text-[12px] text-muted">{orderType === "limit" ? "Limit price" : "Stop price"}</label><input defaultValue={watchlistDetails[selectedInstrument]?.price ?? "29,096.2"} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /></div>}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Units</span><select value={unitsType} onChange={(e) => setUnitsType(e.target.value as typeof unitsType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="units">Units</option><option value="lots">Lots</option><option value="usd">USD</option><option value="pctBalance">% Balance</option></select></div><div className="flex items-center gap-1 text-[12px] text-muted"><span className="font-mono text-foreground">581.92 USD</span><ChevronDown className="h-3 w-3" /></div></div>
                    <div className="flex items-center gap-2"><input value={orderUnits} onChange={(e) => setOrderUnits(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button></div>
                  </div>
                  <div className="mb-4 rounded-xl border border-border bg-background/30">
                    <button onClick={() => setShowExits((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-[13px] font-medium">Exits{showExits ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}</button>
                    {showExits && <div className="space-y-4 border-t border-border p-3"><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Take profit</span><select value={tpType} onChange={(e) => setTpType(e.target.value as typeof tpType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="rewardUsd">reward USD</option><option value="rewardPct">reward % balance</option></select></div><button onClick={() => setTpEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${tpEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${tpEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!tpEnabled} value={orderTP} onChange={(e) => setOrderTP(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">75 ticks</span></div></div><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Stop loss</span><select value={slType} onChange={(e) => setSlType(e.target.value as typeof slType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="riskUsd">risk USD</option><option value="riskPct">risk % balance</option></select></div><button onClick={() => setSlEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${slEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${slEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!slEnabled} value={orderSL} onChange={(e) => setOrderSL(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">75 ticks</span></div></div></div>}
                  </div>
                  <div className="mb-4 space-y-2 text-[13px]"><h3 className="font-semibold text-primary">Order info</h3><div className="flex justify-between"><span className="text-muted">Margin</span><span className="font-mono">581.92 / 81,682.73</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full w-[18%] rounded-full bg-primary" /></div><div className="flex justify-between"><span className="text-muted">Leverage</span><span className="font-mono">50:1</span></div><div className="flex justify-between"><span className="text-muted">Tick value</span><span className="font-mono">0.1 USD</span></div><div className="flex justify-between"><span className="text-muted">Trade value</span><span className="font-mono">29,096.20 USD</span></div></div>
                  <button className={`w-full rounded-xl py-3 font-semibold text-background ${orderSide === "buy" ? "bg-primary" : "bg-danger"}`}>{orderSide === "buy" ? "Buy" : "Sell"} {orderUnits || "1"} {selectedInstrument} {orderType.toUpperCase()}</button>
                </div>
              )}
              {rightPanel === "watchlist" && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex h-12 items-center justify-between border-b border-border px-4"><button className="flex items-center gap-1 text-[14px] font-semibold">Watchlist <ChevronDown className="h-3.5 w-3.5 text-muted" /></button><div className="flex items-center gap-1"><button onClick={() => setShowInstrumentSearch(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Grid3X3 className="h-3.5 w-3.5" /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button></div></div>
                  <div className="grid grid-cols-[minmax(92px,1fr)_74px_54px_54px] gap-2 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted"><span>Symbol</span><span className="text-right">Last</span><span className="text-right">Chg</span><span className="text-right">Chg%</span></div>
                  <div className="flex-1 overflow-y-auto">{watchlist.map((row) => { const item = getStaticWatchlistDetail(row.symbol, row.broker, watchlistDetails); const displayPrice = item?.price ?? (row.mid ? row.mid.toLocaleString(undefined, { maximumFractionDigits: 5 }) : "--"); const change = item ? Number(item.change.replace("%", "")) : row.change; const changePercent = item ? Number(item.change.replace("%", "")) : row.changePercent; const up = changePercent >= 0; return <button key={row.key} onClick={() => selectInstrument(row.symbol, row.broker, row.key)} className={`grid w-full grid-cols-[minmax(92px,1fr)_74px_54px_54px] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface/60 ${selectedWatchlistKey === row.key ? "bg-surface" : ""}`}><span className="min-w-0"><span className="block truncate text-[9px] uppercase tracking-wider text-muted">{row.broker}</span><span className="block truncate text-[13px] font-medium text-foreground">{row.symbol}</span></span><span className="text-right font-mono text-[12px] text-foreground">{displayPrice}</span><span className={`text-right font-mono text-[11px] ${up ? "text-primary" : "text-danger"}`}>{up ? "+" : "-"}{Math.abs(change).toFixed(2)}</span><span className={`text-right font-mono text-[11px] ${up ? "text-primary" : "text-danger"}`}>{up ? "+" : ""}{changePercent.toFixed(2)}%</span></button>; })}</div>
                </div>
              )}
              {rightPanel === "alerts" && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex h-12 items-center justify-between border-b border-border px-4"><h3 className="text-[14px] font-semibold">Alerts</h3><button onClick={() => openCreateAlert()} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button></div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {selectedInstrument ? (
                      instrumentAlerts.length > 0 ? (
                        <div className="space-y-2">
                          {instrumentAlerts.slice(0, 6).map((alert) => (
                            <div key={alert.id} className="rounded-xl border border-border bg-background/30 p-3">
                              <div className="flex items-start gap-2">
                                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.state === "active" ? "bg-primary" : alert.state === "paused" ? "bg-danger" : "bg-yellow-400"}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => openEditAlert(alert)}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <div className="text-[13px] text-foreground">{alert.conditionLabel}</div>
                                    </button>
                                    <div className="flex items-center gap-1">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${alert.state === "active" ? "bg-primary/15 text-primary" : alert.state === "paused" ? "bg-danger/15 text-danger" : "bg-yellow-400/15 text-yellow-300"}`}>
                                        {alert.state === "active" ? "Live" : alert.state === "paused" ? "Paused" : "Triggered"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChartAlert(alert.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
                                        title={alert.state === "paused" ? "Start alert" : "Pause alert"}
                                      >
                                        {alert.state === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPendingAlertDelete(alert)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                                        title="Delete alert"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openEditAlert(alert)}
                                    className="mt-1 block w-full text-left"
                                  >
                                    <div className="text-[11px] text-muted">{alert.timeframe} / {getTriggerModeLabel(alert.triggerMode)} / {getExpirationLabel(alert.expiration)}</div>
                                    <div className="mt-1 truncate text-[11px] text-muted">{new Date(alert.createdAt).toLocaleString()}</div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                      ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">No alerts for {selectedInstrument}. Create one from the chart or press +.</div>
                    ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">Choose a market to create an alert.</div>}
                  </div>
                  <div className="border-t border-border p-4"><button onClick={() => { window.location.href = "/alerts"; }} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted hover:text-foreground">Manage All Alerts</button></div>
                </div>
              )}
              {rightPanel === "alertslog" && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex h-12 items-center justify-between border-b border-border px-4">
                    <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" /><h3 className="text-[14px] font-semibold">Signal Log</h3><span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">{alertLogCount}</span></div>
                    <button onClick={() => setAlertLogCount(0)} className="text-[11px] font-medium text-muted hover:text-foreground">Clear All</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {alertLogEntries.map((entry) => {
                      const directionClass = entry.side === "LONG" ? "text-primary" : "text-danger";
                      const statusClass = entry.status === "Executed" ? "bg-primary/10 text-primary" : entry.status === "Pending" ? "bg-yellow-500/10 text-yellow-500" : "bg-danger/10 text-danger";
                      return (
                        <div key={`${entry.time}-${entry.symbol}-${entry.price}`} className="mb-2 rounded-xl bg-surface/50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-muted">{entry.time}</span>
                            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{entry.status}</span>
                          </div>
                          <div className="text-[13px] font-semibold text-foreground"><span className={directionClass}>{entry.side}</span> {entry.symbol} @ {entry.price}</div>
                          <div className="mt-1 text-[10px] text-muted">SL: {entry.sl} | TP: {entry.tp}</div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="min-w-0"><div className="truncate text-[11px] text-muted">{entry.strategy}</div><div className="truncate text-[11px] text-muted">{entry.account}</div></div>
                            {entry.pnl && <span className={`font-mono text-[11px] ${entry.pnl.startsWith("+") ? "text-primary" : "text-danger"}`}>{entry.pnl}</span>}
                          </div>
                          {entry.error && <div className="mt-2 text-[11px] text-danger">{entry.error}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-3 border-t border-border p-4">
                    <button onClick={() => { window.location.href = "/alerts"; }} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted hover:text-foreground">View Full History</button>
                    <div className="text-center text-[11px] text-muted">Today: 12 signals | 10 executed | 2 failed</div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="hidden w-[44px] shrink-0 flex-col items-center gap-2 border-l border-border bg-panel py-3">
            {[
              { id: "order" as const, title: "Order Panel", icon: FileText },
              { id: "watchlist" as const, title: "Watchlist", icon: List },
              { id: "alerts" as const, title: "Alerts", icon: Bell },
              { id: "alertslog" as const, title: "Alerts Log", icon: BellRing },
            ].map((item) => {
              const Icon = item.icon;
              const active = rightPanel === item.id;
              return (
                <button key={item.id} title={item.title} onClick={() => setRightPanel(active ? null : item.id)} className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}>
                  <Icon className="h-[18px] w-[18px]" />
                  {item.id === "alertslog" && alertLogCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-semibold text-white">{alertLogCount}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {!bottomMinimized && (
          <div onMouseDown={startBottomResize} className="relative h-4 flex-shrink-0 cursor-row-resize bg-transparent">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors group-hover:bg-primary/30" />
            <div className="flex h-full items-center justify-center">
              <div className="h-1 w-12 rounded-full bg-muted/40 shadow-[0_0_0_1px_rgba(24,24,27,0.45)]" />
            </div>
          </div>
        )}
        <div style={{ height: bottomMinimized ? BOTTOM_PANEL_COLLAPSED_HEIGHT : bottomPanelHeight }} className="flex flex-shrink-0 flex-col overflow-hidden border-t border-border bg-panel">
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-panel px-5">
          <button onClick={() => setBottomMinimized((value) => !value)} className="flex items-center gap-2 text-[13px] font-semibold text-foreground hover:text-primary">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            Strategy Report
          </button>
          <div className="h-5 w-px bg-border" />
          <button onClick={() => { setBottomTab("strategies"); setBottomMinimized(false); }} className={`flex items-center gap-1.5 px-3 py-1 text-[13px] transition-colors ${bottomTab === "strategies" ? "rounded-lg border border-border bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>
            <Code2 className="h-3.5 w-3.5" />
            Strategies
          </button>
          <div className="relative z-50">
            <button onClick={() => setShowStrategyDropdown((value) => !value)} className="flex max-w-[240px] cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-3 py-1.5 transition-all duration-200 hover:bg-surface">
              <span className={"h-2 w-2 shrink-0 rounded-full " + ((activeStrategy?.totalPnl ?? 0) >= 0 ? "bg-primary" : "bg-danger")} />
              <span className="truncate text-[12px] font-medium text-foreground">{activeStrategy?.name ?? "Select Strategy"}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted" />
            </button>
            {showStrategyDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStrategyDropdown(false)} />
                <div className="absolute z-50 mt-1 w-[240px] overflow-hidden rounded-xl border border-border bg-panel py-1 shadow-xl shadow-black/20">
                  {strategies.map((strategy) => {
                    const active = strategy.id === activeStrategyId;
                    const language = strategy.language.toLowerCase().includes("type") ? "TS" : strategy.language.toLowerCase().includes("pine") ? "Pine" : strategy.language;
                    return (
                      <button key={strategy.id} onClick={() => { setActiveStrategyId(strategy.id); setSelectedStrategy(strategy.id); setBacktestResult(null); setStrategyError(""); setBottomTab("metrics"); setBottomMinimized(false); setShowStrategyDropdown(false); }} className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left transition-all duration-200 hover:bg-surface ${active ? "bg-surface" : ""}`}>
                        <span className={"h-2 w-2 shrink-0 rounded-full " + ((strategy.totalPnl ?? 0) >= 0 ? "bg-primary" : "bg-danger")} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{strategy.name}</span>
                        <span className="rounded-md bg-surface/80 px-1.5 py-0.5 text-[10px] text-muted">{language}</span>
                        {active && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button onClick={handleRunBacktest} className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary transition-all hover:bg-primary/20">
            <Play className="h-3 w-3" />
            Run Backtest
          </button>
          <button onClick={() => { setBacktestSettingsDraft(backtestSettings); setBacktestSettingsTab("properties"); setShowBacktestSettings(true); }} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-foreground" title="Backtest settings">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setBottomTab("metrics"); setBottomMinimized(false); }} className={`px-3 py-1 text-[13px] transition-colors ${bottomTab === "metrics" ? "rounded-lg border border-border bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>Metrics</button>
          <button onClick={() => { setBottomTab("trades"); setBottomMinimized(false); }} className={`flex items-center gap-1.5 px-3 py-1 text-[13px] transition-colors ${bottomTab === "trades" ? "rounded-lg border border-border bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>
            <List className="h-3.5 w-3.5" />
            List of trades
          </button>
          <div className="flex-1" />
          <select value={equityPeriod} onChange={(e) => setEquityPeriod(e.target.value)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] text-muted outline-none"><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="365d">365 days</option><option value="all">All</option></select>
        </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {bottomTab === "metrics" && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {backtesting && <div className="flex items-center gap-2 p-5"><div className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span className="text-[13px] text-muted">Running backtest...</span></div>}
                {!backtesting && strategyError && <div className="m-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 font-mono text-[12px] text-danger">{strategyError}</div>}
                {!backtesting && !strategyError && !backtestResult && <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface"><Play className="h-6 w-6 text-muted" /></div><span className="text-[14px] font-medium text-muted">Run a backtest to see results</span><span className="text-[12px] text-muted/60">Select a strategy and click "Run Backtest"</span></div>}
                {!backtesting && backtestResult && !backtestResult.error && (
                  <div className="min-w-[980px]">
                    <section className="flex min-h-[420px] flex-col border-b border-border">
                      <div className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-2"><h3 className="text-[14px] font-semibold">Equity chart</h3><Info className="h-3.5 w-3.5 text-muted" /></div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
                        {[
                          ["equity", "Equity"],
                          ["buyHold", "Buy & hold"],
                          ["excursions", "Trades excursions"],
                          ["drawdowns", "Run-up/Drawdowns"],
                        ].map(([key, label]) => {
                          const active = chartToggles[key as keyof typeof chartToggles];
                          return <button key={key} onClick={() => setChartToggles((current) => ({ ...current, [key]: !active }))} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition-colors ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}>{active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{label}</button>;
                        })}
                      </div>
                      <div className="flex items-center justify-between border-y border-border px-6 py-3">
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted">Net P&L</div>
                          <div className="font-mono text-[14px] font-semibold" style={{ color: totalPnl >= 0 ? "#22C55E" : "#EF4444" }}>
                            {totalPnl >= 0 ? "+" : "-"}{formatDollar(totalPnl)} ({pnlPercent.toFixed(2)}%)
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted">Max equity drawdown</div>
                          <div className="font-mono text-[14px] font-semibold" style={{ color: "#EF4444" }}>
                            -{formatDollar(maxDrawdownUsd)} ({backtestResult.maxDrawdownPercent.toFixed(2)}%)
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted">Total trades</div>
                          <div className="font-mono text-[14px] font-semibold text-foreground">{filteredTrades.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted">Win Rate</div>
                          <div className="font-mono text-[14px] font-semibold text-foreground">
                            {allStats.profitable.toFixed(2)}% {wins.length}/{filteredTrades.length}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted">Profit factor</div>
                          <div className="font-mono text-[14px] font-semibold" style={{ color: profitFactor >= 1 ? "#22C55E" : "#EF4444" }}>
                            {profitFactor === Infinity ? "âˆž" : profitFactor.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="min-h-[260px] flex-1 overflow-hidden px-2 py-2">
                        {chartToggles.equity || chartToggles.buyHold || chartToggles.drawdowns || chartToggles.excursions ? (
                          <EquityChart trades={filteredTrades} initialBalance={backtestSettings.initialCapital} showEquity={chartToggles.equity} showExcursions={chartToggles.excursions} />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[13px] text-muted">Chart hidden</div>
                        )}
                      </div>
                    </section>

                    {backtestResult.totalTrades === 0 ? (
                      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface"><BarChart3 className="h-6 w-6 text-muted" /></div><span className="text-[14px] font-medium text-muted">No trades to display</span><span className="max-w-[300px] text-center text-[12px] text-muted/60">The strategy did not generate any trades on the current data. Try a different timeframe, load more history, or adjust the strategy logic.</span></div>
                    ) : [
                      ["performance", "Performance"],
                      ["analysis", "Trades analysis"],
                      ["capital", "Capital efficiency"],
                      ["drawdowns", "Run-ups and drawdowns"],
                    ].map(([key, title]) => {
                      const open = !!expandedSections[key];
                      return (
                        <section key={key} className="border-b border-border">
                          <button onClick={() => setExpandedSections((current) => ({ ...current, [key]: !open }))} className="flex w-full items-center gap-2 px-5 py-3 text-left text-[13px] font-semibold hover:bg-surface/40">
                            {open ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 rotate-[-90deg] text-muted" />}
                            {title}
                          </button>
                          {open && key === "performance" && (
                            <div className="px-5 pb-5">
                              <table className="w-full text-[12px] font-mono">
                                <thead><tr className="bg-surface text-[10px] uppercase text-muted"><th className="px-3 py-2 text-left font-medium">Metric</th><th className="px-3 py-2 text-right font-medium">All Trades</th><th className="px-3 py-2 text-right font-medium">Long Trades</th><th className="px-3 py-2 text-right font-medium">Short Trades</th></tr></thead>
                                <tbody>{[
                                  ["Net Profit ($)", money(allStats.pnl), money(longStats.pnl), money(shortStats.pnl)],
                                  ["Net Profit (%)", percent(allStats.pnlPercent), percent(longStats.pnlPercent), percent(shortStats.pnlPercent)],
                                  ["Gross Profit", plainMoney(allStats.grossProfit), plainMoney(longStats.grossProfit), plainMoney(shortStats.grossProfit)],
                                  ["Gross Loss", plainMoney(allStats.grossLoss), plainMoney(longStats.grossLoss), plainMoney(shortStats.grossLoss)],
                                  ["Max Drawdown ($)", plainMoney(backtestResult.maxDrawdown), plainMoney(backtestResult.maxDrawdown), plainMoney(backtestResult.maxDrawdown)],
                                  ["Max Drawdown (%)", percent(backtestResult.maxDrawdownPercent), percent(backtestResult.maxDrawdownPercent), percent(backtestResult.maxDrawdownPercent)],
                                  ["Profit Factor", ratio(allStats.profitFactor), ratio(longStats.profitFactor), ratio(shortStats.profitFactor)],
                                  ["Sharpe Ratio", allStats.sharpe.toFixed(2), longStats.sharpe.toFixed(2), shortStats.sharpe.toFixed(2)],
                                  ["Sortino Ratio", ratio(allStats.sortino), ratio(longStats.sortino), ratio(shortStats.sortino)],
                                  ["Total trades", allStats.total, longStats.total, shortStats.total],
                                  ["Winning trades", allStats.wins, longStats.wins, shortStats.wins],
                                  ["Losing trades", allStats.losses, longStats.losses, shortStats.losses],
                                  ["Percent profitable", `${allStats.profitable.toFixed(2)}%`, `${longStats.profitable.toFixed(2)}%`, `${shortStats.profitable.toFixed(2)}%`],
                                  ["Avg trade P&L", money(allStats.avg), money(longStats.avg), money(shortStats.avg)],
                                  ["Avg winning trade", money(allStats.avgWin), money(longStats.avgWin), money(shortStats.avgWin)],
                                  ["Avg losing trade", money(allStats.avgLoss), money(longStats.avgLoss), money(shortStats.avgLoss)],
                                  ["Largest winning trade", money(allStats.largestWin), money(longStats.largestWin), money(shortStats.largestWin)],
                                  ["Largest losing trade", money(allStats.largestLoss), money(longStats.largestLoss), money(shortStats.largestLoss)],
                                  ["Avg bars in trades", allStats.avgBars.toFixed(1), longStats.avgBars.toFixed(1), shortStats.avgBars.toFixed(1)],
                                  ["Avg bars in winning trades", allStats.avgWinBars.toFixed(1), longStats.avgWinBars.toFixed(1), shortStats.avgWinBars.toFixed(1)],
                                  ["Avg bars in losing trades", allStats.avgLossBars.toFixed(1), longStats.avgLossBars.toFixed(1), shortStats.avgLossBars.toFixed(1)],
                                ].map((row, index) => <tr key={row[0]} className={index % 2 === 0 ? "bg-surface/30" : "bg-transparent"}><td className="px-3 py-2 text-muted">{row[0]}</td><td className="px-3 py-2 text-right">{row[1]}</td><td className="px-3 py-2 text-right">{row[2]}</td><td className="px-3 py-2 text-right">{row[3]}</td></tr>)}</tbody>
                              </table>
                            </div>
                          )}
                          {open && key === "analysis" && (
                            <div className="grid grid-cols-2 gap-4 px-5 pb-5">
                              <div className="rounded-xl border border-border bg-background/40 p-4"><h4 className="mb-4 text-[13px] font-semibold">P&L Distribution</h4><svg viewBox="0 0 360 170" className="h-44 w-full"><line x1="20" y1="145" x2="340" y2="145" stroke="#27272A" /><line x1="180" y1="12" x2="180" y2="145" stroke="#71717A" strokeDasharray="4 4" /><line x1={20 + ((avgProfit + Math.abs(minPnl)) / Math.max(maxPnl - minPnl, 1)) * 320} y1="12" x2={20 + ((avgProfit + Math.abs(minPnl)) / Math.max(maxPnl - minPnl, 1)) * 320} y2="145" stroke="#22C55E" strokeDasharray="3 3" />{pnlBuckets.map((bucket, index) => { const height = Math.max(4, (bucket.count / maxBucket) * 118); const x = 24 + index * 40; return <g key={bucket.start}><rect x={x} y={145 - height} width="28" height={height} rx="4" fill={bucket.start >= 0 ? "#22C55E" : "#EF4444"} opacity="0.75" /><text x={x + 14} y="162" textAnchor="middle" fill="#A1A1AA" fontSize="10">{bucket.start.toFixed(0)}</text></g>; })}</svg><div className="mt-1 flex justify-between text-[11px] text-muted"><span>Avg loss {money(avgLoss)}</span><span>Avg profit {money(avgProfit)}</span></div></div>
                              <div className="rounded-xl border border-border bg-background/40 p-4"><h4 className="mb-4 text-[13px] font-semibold">Win/loss ratio</h4><div className="flex items-center justify-center gap-8"><svg viewBox="0 0 140 140" className="h-36 w-36"><circle cx="70" cy="70" r="48" fill="none" stroke="#EF4444" strokeWidth="18" /><circle cx="70" cy="70" r="48" fill="none" stroke="#22C55E" strokeWidth="18" strokeDasharray={`${Math.max(0, Math.min(100, allStats.profitable)) * 3.016} 301.6`} strokeLinecap="round" transform="rotate(-90 70 70)" /><circle cx="70" cy="70" r="35" fill="var(--panel)" /><text x="70" y="68" textAnchor="middle" fill="currentColor" className="font-mono text-xl font-semibold">{filteredTrades.length}</text><text x="70" y="84" textAnchor="middle" fill="#A1A1AA" className="text-[10px]">trades</text></svg><div className="space-y-2 text-[12px]"><div className="flex justify-between gap-8"><span style={{ color: "#22C55E" }}>Wins: {wins.length} ({allStats.profitable.toFixed(1)}%)</span></div><div className="flex justify-between gap-8"><span style={{ color: "#EF4444" }}>Losses: {losses.length} ({(100 - allStats.profitable).toFixed(1)}%)</span></div></div></div></div>
                            </div>
                          )}
                          {open && key === "capital" && <div className="grid grid-cols-4 gap-3 px-5 pb-5 text-[12px]">{[["Annualized Return", percent(backtestResult.annualizedReturn)], ["Return on Initial Capital", percent(backtestResult.totalPnLPercent)], ["Max Margin Used", plainMoney(backtestResult.maxMarginUsed)], ["Margin Efficiency", ratio(backtestResult.marginEfficiency)]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background/40 p-4"><div className="mb-2 text-muted">{label}</div><div className="font-mono text-[16px] font-semibold">{value}</div></div>)}</div>}
                          {open && key === "drawdowns" && <div className="grid grid-cols-5 gap-3 px-5 pb-5 text-[12px]">{[["Average Equity Run-up", plainMoney(backtestResult.avgEquityRunUp)], ["Max Equity Run-up", plainMoney(backtestResult.maxEquityRunUp)], ["Average Drawdown Duration", backtestResult.avgDrawdownDuration.toFixed(1) + " bars"], ["Max Drawdown Duration", backtestResult.maxDrawdownDuration.toFixed(0) + " bars"], ["Recovery Factor", ratio(backtestResult.recoveryFactor)]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background/40 p-4"><div className="mb-2 text-muted">{label}</div><div className="font-mono text-[16px] font-semibold">{value}</div></div>)}</div>}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {bottomTab === "strategies" && (
              <div className="flex min-h-0 flex-1">
                <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border p-4">
                  <div className="space-y-2">
                    {strategies.map((strategy) => {
                      const normalized = normalizeStrategy(strategy);
                      const validation = validateStrategyCode(normalized.code);
                      return (
                      <div key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={`group rounded-xl border p-3 transition-colors hover:border-primary/30 ${selectedStrategy === strategy.id ? "border-primary/30 bg-primary/5" : "border-border bg-surface"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {editingStrategy === strategy.id ? (
                              <input value={strategy.name} onChange={(e) => updateStrategy(strategy.id, { name: e.target.value })} onBlur={() => setEditingStrategy(null)} autoFocus className="w-full rounded-lg border border-border bg-panel px-2 py-1 text-[14px] outline-none" />
                            ) : (
                              <div className="flex items-center gap-2"><div className="truncate text-[14px] font-medium text-foreground">{strategy.name}</div>{!validation.valid && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" title={validation.message} />}</div>
                            )}
                            <div className="mt-2 flex items-center gap-2"><span className="inline-flex rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] text-muted">{strategy.language}</span><span className="text-[10px] text-muted">v{normalized.currentVersion}</span></div>
                            <div className="mt-2 text-[11px] text-muted">Modified {formatStrategyDate(strategy.lastModified)}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {strategy.addedToChart && <button onClick={(e) => { e.stopPropagation(); updateStrategy(strategy.id, { visible: !strategy.visible }); }} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-panel" title={strategy.visible ? "Hide" : "Show"}>{strategy.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted" />}</button>}
                            <button onClick={(e) => { e.stopPropagation(); editStrategy(strategy); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-foreground" title="Edit"><Pencil className="h-4 w-4" /></button>
                            <div className="relative">
                              <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:bg-panel hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                              <div className="absolute right-0 top-7 z-20 hidden w-40 rounded-xl border border-border bg-panel p-1 shadow-xl group-hover:block">
                                <button onClick={(e) => { e.stopPropagation(); setEditingStrategy(strategy.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-muted hover:bg-surface">Rename</button>
                                <button onClick={(e) => { e.stopPropagation(); duplicateStrategy(strategy); }} className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-muted hover:bg-surface">Duplicate</button>
                                <button onClick={(e) => { e.stopPropagation(); toggleStrategyOnChart(strategy.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-muted hover:bg-surface">{strategy.addedToChart ? "Remove from Chart" : "Add to Chart"}</button>
                                <button onClick={(e) => { e.stopPropagation(); deleteStrategy(strategy.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-danger hover:bg-danger/10">Delete</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );})}
                  </div>
                </aside>
                <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  {selectedStrategyItem ? (
                    <>
                      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
                        <div className="flex items-center gap-3"><h3 className="text-[15px] font-semibold">{selectedStrategyItem.name}</h3><select value={viewedVersionNumber} onChange={(e) => setSelectedVersion(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none">{selectedStrategyVersions.map((version) => <option key={version.version} value={version.version}>v{version.version} ? {formatStrategyDate(version.timestamp)}</option>)}</select><span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted">{selectedStrategyItem.language}</span></div>
                        <div className="flex items-center gap-2">{!isViewingCurrentVersion && viewedVersion && <button onClick={() => revertStrategyVersion(selectedStrategyItem.id, viewedVersion)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Revert to this version</button>}<button onClick={() => saveStrategyVersion(selectedStrategyItem.id)} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Save</button><button onClick={handleRunBacktest} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground"><Play className="h-4 w-4 text-primary" />Run Backtest</button><button onClick={() => toggleStrategyOnChart(selectedStrategyItem.id)} className={`rounded-xl border px-4 py-2 text-[13px] ${selectedStrategyItem.addedToChart ? selectedStrategyItem.visible ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted" : "border-border bg-surface text-muted hover:text-foreground"}`}>{selectedStrategyItem.addedToChart ? selectedStrategyItem.visible ? "On Chart" : "Hidden" : "Add to Chart"}</button></div>
                      </div>
                      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
                        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-background font-mono text-[13px] leading-6">
                          <div className="select-none border-r border-border bg-panel px-3 py-3 text-right text-muted">{strategyLines.map((_, index) => <div key={index}>{index + 1}</div>)}</div>
                          <textarea value={strategyDisplayCode} onChange={(e) => updateStrategy(selectedStrategyItem.id, { code: e.target.value })} readOnly={!isViewingCurrentVersion} spellCheck={false} className="flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-foreground outline-none read-only:text-muted" />
                        </div>
                      </div>
                      {!strategyValidation.valid && <div className="border-t border-danger/30 bg-danger/10 px-5 py-2 font-mono text-[12px] text-danger">{strategyValidation.message}</div>}
                    </>
                  ) : <div className="flex h-full items-center justify-center text-[13px] text-muted">Select a strategy</div>}
                </section>
              </div>
            )}
            {bottomTab === "trades" && <div className="flex-1 overflow-auto">{backtestResult && backtestResult.trades.length > 0 ? <table className="w-full min-w-[1120px] text-[12px]"><thead className="sticky top-0 z-10 bg-panel"><tr className="border-b border-border text-muted">{[
              ["#", "index", "text-left"],
              ["Type", "direction", "text-left"],
              ["Entry Date", "entryTime", "text-left"],
              ["Entry Price", "entryPrice", "text-right"],
              ["Exit Date", "exitTime", "text-left"],
              ["Exit Price", "exitPrice", "text-right"],
              ["P&L ($)", "pnlPoints", "text-right"],
              ["P&L (%)", "pnlPercent", "text-right"],
              ["Run-up", "runUp", "text-right"],
              ["Drawdown", "drawdown", "text-right"],
              ["Duration (bars)", "durationBars", "text-right"],
            ].map(([label, key, align]) => <th key={key} onClick={() => updateTradeSort(key)} className={`cursor-pointer px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider hover:text-foreground ${align}`}>{label}{tradeSort.key === key ? (tradeSort.direction === "asc" ? " ↑" : " ↓") : ""}</th>)}</tr></thead><tbody>{sortedTrades.map((trade, i) => <tr key={`${trade.entryTime}-${trade.exitTime}-${i}`} className="border-b border-border/50 hover:bg-surface/30"><td className="px-4 py-2 font-mono text-muted">{i + 1}</td><td className="px-4 py-2 font-semibold" style={{ color: trade.direction === "LONG" ? "#22C55E" : "#EF4444" }}>{trade.direction}</td><td className="px-4 py-2 font-mono text-muted">{formatTradeDate(trade.entryTime)}</td><td className="px-4 py-2 text-right font-mono">{formatPrice(trade.entryPrice, selectedInstrument)}</td><td className="px-4 py-2 font-mono text-muted">{formatTradeDate(trade.exitTime)}</td><td className="px-4 py-2 text-right font-mono">{formatPrice(trade.exitPrice, selectedInstrument)}</td><td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: trade.pnlPoints >= 0 ? "#22C55E" : "#EF4444" }}>{money(trade.pnlPoints)}</td><td className="px-4 py-2 text-right font-mono" style={{ color: trade.pnlPercent >= 0 ? "#22C55E" : "#EF4444" }}>{trade.pnlPercent >= 0 ? "+" : ""}{trade.pnlPercent.toFixed(2)}%</td><td className="px-4 py-2 text-right font-mono">{formatPrice(trade.runUp ?? 0, selectedInstrument)}</td><td className="px-4 py-2 text-right font-mono">{formatPrice(trade.drawdown ?? 0, selectedInstrument)}</td><td className="px-4 py-2 text-right font-mono">{trade.durationBars ?? 0}</td></tr>)}</tbody><tfoot className="sticky bottom-0 bg-panel"><tr className="border-t border-border font-mono text-[12px]"><td className="px-4 py-2 text-muted" colSpan={6}>Total</td><td className="px-4 py-2 text-right font-semibold" style={{ color: totalPnl >= 0 ? "#22C55E" : "#EF4444" }}>{money(totalPnl)}</td><td className="px-4 py-2 text-right" style={{ color: pnlPercent >= 0 ? "#22C55E" : "#EF4444" }}>{pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%</td><td className="px-4 py-2 text-right">{formatPrice(filteredTrades.reduce((sum, trade) => sum + (trade.runUp ?? 0), 0), selectedInstrument)}</td><td className="px-4 py-2 text-right">{formatPrice(filteredTrades.reduce((sum, trade) => sum + (trade.drawdown ?? 0), 0), selectedInstrument)}</td><td className="px-4 py-2 text-right">{allStats.avgBars.toFixed(1)}</td></tr></tfoot></table> : backtestResult && backtestResult.trades.length === 0 ? <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface"><FileText className="h-6 w-6 text-muted" /></div><span className="text-[14px] font-medium text-muted">No trades to display</span><span className="text-[12px] text-muted/60">No trades were generated during the backtest period</span></div> : <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface"><Play className="h-6 w-6 text-muted" /></div><span className="text-[14px] font-medium text-muted">Run a backtest to see results</span><span className="text-[12px] text-muted/60">Select a strategy and click "Run Backtest"</span></div>}</div>}
          </div>
        </div>
      </div>

      {rightPanel && (
        <div style={{ width: rightPanelWidth }} className="relative flex shrink-0 flex-col border-l border-border bg-panel">
          <div onMouseDown={startRightPanelResize} className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:w-1.5 hover:bg-primary/30" />
          {rightPanel === "order" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-primary"><Zap className="h-3.5 w-3.5" /></div>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">{selectedInstrument}</div>
                    <div className="text-[11px] text-muted">{activeTradingBrokerLabel} order ticket</div>
                  </div>
                </div>
                <button onClick={() => setRightPanel(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="relative mb-4 grid grid-cols-2 gap-2">
                <button onClick={() => setOrderSide("sell")} className={`rounded-xl border border-danger/20 px-3 py-2 text-left transition-all ${orderSide === "sell" ? "bg-danger/20 text-danger" : "bg-danger/10 text-danger/80"}`}><div className="text-[12px] font-semibold">Sell</div><div className="font-mono text-[13px]" style={{ color: "#EF4444" }}>{orderPanelBidLabel}</div></button>
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-muted">{orderPanelSpreadLabel}</div>
                <button onClick={() => setOrderSide("buy")} className={`rounded-xl border border-primary/20 px-3 py-2 text-right transition-all ${orderSide === "buy" ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/80"}`}><div className="text-[12px] font-semibold">Buy</div><div className="font-mono text-[13px]" style={{ color: "#22C55E" }}>{orderPanelAskLabel}</div></button>
              </div>
              {!tradingUnlocked && (
                <div className={`mb-4 rounded-xl border p-3 ${orderPanelLockTone.border} ${orderPanelLockTone.background}`}>
                  <div className="flex items-start gap-2">
                    <Lock className={`mt-0.5 h-4 w-4 ${orderPanelLockTone.icon}`} />
                    <div>
                      <div className={`text-[12px] font-semibold ${activeBrokerHealth.state === "broken" ? "text-danger" : "text-yellow-200"}`}>{orderPanelLockTone.title}</div>
                      <div className={`mt-1 text-[11px] leading-5 ${activeBrokerHealth.state === "broken" ? "text-danger/80" : "text-yellow-100/80"}`}>
                        {orderPanelLockTone.body}
                      </div>
                      {activeBrokerFeedError && (
                        <div className={`mt-2 text-[11px] leading-5 ${activeBrokerHealth.state === "broken" ? "text-danger/70" : "text-yellow-100/70"}`}>
                          Feed status: {activeBrokerFeedError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className={`${tradingUnlocked ? "" : "pointer-events-none opacity-60"}`}>
                <div className="mb-4 grid grid-cols-3 border-b border-border text-[13px]">{(["market", "limit", "stop"] as const).map((type) => <button key={type} onClick={() => setOrderType(type)} className={`py-2 capitalize transition-colors ${orderType === type ? "border-b-2 border-primary text-foreground" : "text-muted hover:text-foreground"}`}>{type}</button>)}</div>
                {orderType !== "market" && <div className="mb-4 space-y-1.5"><label className="text-[12px] text-muted">{orderType === "limit" ? "Limit price" : "Stop price"}</label><input defaultValue={selectedMidPrice ? formatPrice(selectedMidPrice, selectedInstrument) : ""} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /></div>}
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Units</span><select value={unitsType} onChange={(e) => setUnitsType(e.target.value as typeof unitsType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="units">Units</option><option value="lots">Lots</option><option value="usd">USD</option><option value="pctBalance">% Balance</option></select></div><div className="flex items-center gap-1 text-[12px] text-muted"><span className="font-mono text-foreground">{formatDollar(orderPanelMarginUsd)}</span><ChevronDown className="h-3 w-3" /></div></div>
                  <div className="flex items-center gap-2"><input value={orderUnits} onChange={(e) => setOrderUnits(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button></div>
                </div>
              </div>
              <div className="mb-4 rounded-xl border border-border bg-background/30">
                <button onClick={() => setShowExits((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-[13px] font-medium">Exits{showExits ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}</button>
                {showExits && <div className={`space-y-4 border-t border-border p-3 ${tradingUnlocked ? "" : "pointer-events-none opacity-60"}`}><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Take profit</span><select value={tpType} onChange={(e) => setTpType(e.target.value as typeof tpType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="rewardUsd">reward USD</option><option value="rewardPct">reward % balance</option></select></div><button onClick={() => setTpEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${tpEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${tpEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!tpEnabled} value={orderTP} onChange={(e) => setOrderTP(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">75 ticks</span></div></div><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Stop loss</span><select value={slType} onChange={(e) => setSlType(e.target.value as typeof slType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="riskUsd">risk USD</option><option value="riskPct">risk % balance</option></select></div><button onClick={() => setSlEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${slEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${slEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!slEnabled} value={orderSL} onChange={(e) => setOrderSL(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">75 ticks</span></div></div></div>}
              </div>
              <div className="mb-4 rounded-xl border border-border bg-background/30 p-3 text-[13px]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-primary">Broker account</h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      activeBrokerHealth.state === "connected"
                        ? "bg-primary/15 text-primary"
                        : activeBrokerHealth.state === "broken"
                          ? "bg-danger/15 text-danger"
                          : "bg-orange-400/15 text-orange-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${activeBrokerHealth.dotClassName}`} />
                    {activeBrokerHealth.label}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-muted">Broker</span><span className="font-mono text-right">{activeTradingBrokerLabel}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Mode</span><span className="font-mono text-right">{currentBrokerConnection.mode}</span></div>
                  {activeTradingBroker?.type === "paper" && paperTradingAccounts.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted">Account</span><span className="text-[11px] text-muted">{activeBrokerHealth.detail}</span></div>
                      <select
                        value={String(currentBrokerConnection.accountId ?? paperTradingAccounts[0]?.id ?? "")}
                        onChange={(event) => selectPaperTradingAccount(event.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] outline-none focus:border-primary/40"
                      >
                        {paperTradingAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {`${account.name} - ${account.balance} - ${account.leverage}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : activeBrokerAccounts.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted">Account</span><span className="text-[11px] text-muted">{activeBrokerHealth.detail}</span></div>
                      <select
                        value={String(currentBrokerConnection.accountId ?? activeBrokerAccounts[0]?.accountId ?? "")}
                        onChange={(event) => selectBrokerAccount(activeTradingBrokerLabel, Number(event.target.value))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] outline-none focus:border-primary/40"
                      >
                        {activeBrokerAccounts.map((account) => (
                          <option key={account.accountId} value={account.accountId}>
                            {formatCTraderAccountLabel(account)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex justify-between"><span className="text-muted">Connection</span><span className="font-mono text-right">{currentBrokerConnection.accountLabel ?? activeTradingBrokerLabel}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted">Balance</span><span className="font-mono">{orderPanelAccountSummary.balance}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Equity</span><span className="font-mono">{orderPanelAccountSummary.equity}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Unrealized</span><span className="font-mono">{orderPanelAccountSummary.unrealized}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Realized</span><span className="font-mono">{orderPanelAccountSummary.realized}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Margin</span><span className="font-mono text-right">{orderPanelAccountSummary.margin}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className={`h-full rounded-full ${tradingUnlocked ? "w-[18%] bg-primary" : "w-[8%] bg-muted/40"}`} /></div>
                  <div className="flex justify-between"><span className="text-muted">Leverage</span><span className="font-mono">{tradingUnlocked ? activeTradingBroker?.type === "paper" ? selectedPaperTradingAccount?.leverage ?? "--" : "50:1" : "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Tick value</span><span className="font-mono">0.1 USD</span></div>
                  <div className="flex justify-between"><span className="text-muted">Trade value</span><span className="font-mono">{formatDollar(orderPanelTradeValueUsd)}</span></div>
                </div>
              </div>
              <button disabled={!tradingUnlocked} className={`w-full rounded-xl py-3 font-semibold text-background ${tradingUnlocked ? orderSide === "buy" ? "bg-primary" : "bg-danger" : "cursor-not-allowed bg-muted/30 text-muted"}`}>{tradingUnlocked ? `${orderSide === "buy" ? "Buy" : "Sell"} ${orderUnits || "1"} ${selectedInstrument} ${orderType.toUpperCase()}` : "Connect Your Broker To Trade"}</button>
              {!tradingUnlocked && (
                <button onClick={() => setShowBrokerModal(true)} className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted transition-colors hover:text-foreground">
                  Link Your Own Broker
                </button>
              )}
            </div>
          )}
          {rightPanel === "watchlist" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-12 items-center justify-between border-b border-border px-4"><button className="flex items-center gap-1 text-[14px] font-semibold">Watchlist <ChevronDown className="h-3.5 w-3.5 text-muted" /></button><div className="flex items-center gap-1"><button onClick={() => setShowInstrumentSearch(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Grid3X3 className="h-3.5 w-3.5" /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button></div></div>
              <div className="grid grid-cols-[minmax(92px,1fr)_74px_54px_54px] gap-2 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted"><span>Symbol</span><span className="text-right">Last</span><span className="text-right">Chg</span><span className="text-right">Chg%</span></div>
              <div className="flex-1 overflow-y-auto">
                {watchlistSections.map((section) => {
                  const symbols = sortSectionSymbols(section.symbols);
                  const sectionDropTarget = watchlistDropTarget?.sectionId === section.id && !watchlistDropTarget.symbol;
                  return (
                    <div key={section.id}>
                      <div
                        className={`flex items-center justify-between border-t-2 px-3 py-2 ${sectionDropTarget ? "border-blue-500" : "border-transparent"}`}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setWatchlistContextMenu(null);
                          setSectionContextMenu({ x: event.clientX, y: event.clientY, sectionId: section.id });
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setWatchlistDropTarget({ sectionId: section.id });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedWatchlistItem) moveWatchlistSymbol(draggedWatchlistItem.symbol, section.id);
                          setDraggedWatchlistItem(null);
                        }}
                      >
                        {renamingSectionId === section.id ? (
                          <input
                            key={"rename-" + section.id}
                            autoFocus
                            type="text"
                            defaultValue={section.name}
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onFocus={(event) => event.currentTarget.select()}
                            className="w-full rounded-lg border border-primary bg-surface px-2 py-1 text-[12px] text-foreground outline-none"
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter") {
                                const val = event.currentTarget.value.trim();
                                if (val) {
                                  const updated = watchlistSections.map((item) => item.id === section.id ? { ...item, name: val } : item);
                                  setWatchlistSections(updated);
                                  localStorage.setItem("olisa-watchlist-sections", JSON.stringify(updated));
                                }
                                setRenamingSectionId(null);
                              }
                              if (event.key === "Escape") {
                                setRenamingSectionId(null);
                              }
                            }}
                            onBlur={(event) => {
                              const val = event.currentTarget.value.trim();
                              if (val) {
                                const updated = watchlistSections.map((item) => item.id === section.id ? { ...item, name: val } : item);
                                setWatchlistSections(updated);
                                localStorage.setItem("olisa-watchlist-sections", JSON.stringify(updated));
                              }
                              setRenamingSectionId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="cursor-default text-[11px] font-semibold uppercase tracking-wider text-muted"
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              setRenamingSectionId(section.id);
                            }}
                          >
                            {section.name}
                          </span>
                        )}
                      </div>
                      {!collapsedWatchlistSections[section.id] && symbols.map((symbol) => {
                        const row = watchlistBySymbol.get(symbol);
                        return row ? renderWatchlistRow(row, section) : null;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {rightPanel === "alerts" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-12 items-center justify-between border-b border-border px-4"><h3 className="text-[14px] font-semibold">Alerts</h3><button onClick={() => openCreateAlert()} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button></div>
              <div className="flex-1 overflow-y-auto p-4">
                {selectedInstrument ? (
                  instrumentAlerts.length > 0 ? (
                        <div className="space-y-2">
                          {instrumentAlerts.slice(0, 6).map((alert) => (
                            <div key={alert.id} className="rounded-xl border border-border bg-background/30 p-3">
                              <div className="flex items-start gap-2">
                                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.state === "active" ? "bg-primary" : alert.state === "paused" ? "bg-danger" : "bg-yellow-400"}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => openEditAlert(alert)}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <div className="text-[13px] text-foreground">{alert.conditionLabel}</div>
                                    </button>
                                    <div className="flex items-center gap-1">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${alert.state === "active" ? "bg-primary/15 text-primary" : alert.state === "paused" ? "bg-danger/15 text-danger" : "bg-yellow-400/15 text-yellow-300"}`}>
                                        {alert.state === "active" ? "Live" : alert.state === "paused" ? "Paused" : "Triggered"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChartAlert(alert.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
                                        title={alert.state === "paused" ? "Start alert" : "Pause alert"}
                                      >
                                        {alert.state === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPendingAlertDelete(alert)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                                        title="Delete alert"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openEditAlert(alert)}
                                    className="mt-1 block w-full text-left"
                                  >
                                    <div className="text-[11px] text-muted">{alert.timeframe} / {getTriggerModeLabel(alert.triggerMode)} / {getExpirationLabel(alert.expiration)}</div>
                                    <div className="mt-1 truncate text-[11px] text-muted">{new Date(alert.createdAt).toLocaleString()}</div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                  ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">No alerts for {selectedInstrument}. Create one from the chart or press +.</div>
                ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">Choose a market to create an alert.</div>}
              </div>
              <div className="border-t border-border p-4"><button onClick={() => { window.location.href = "/alerts"; }} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted hover:text-foreground">Manage All Alerts</button></div>
            </div>
          )}
          {rightPanel === "alertslog" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-12 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" /><h3 className="text-[14px] font-semibold">Signal Log</h3><span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">{alertLogCount}</span></div>
                <button onClick={() => setAlertLogCount(0)} className="text-[11px] font-medium text-muted hover:text-foreground">Clear All</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {alertLogEntries.map((entry) => {
                  const directionClass = entry.side === "LONG" ? "text-primary" : "text-danger";
                  const statusClass = entry.status === "Executed" ? "bg-primary/10 text-primary" : entry.status === "Pending" ? "bg-yellow-500/10 text-yellow-500" : "bg-danger/10 text-danger";
                  return (
                    <div key={`${entry.time}-${entry.symbol}-${entry.price}`} className="mb-2 rounded-xl bg-surface/50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted">{entry.time}</span>
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{entry.status}</span>
                      </div>
                      <div className="text-[13px] font-semibold text-foreground"><span className={directionClass}>{entry.side}</span> {entry.symbol} @ {entry.price}</div>
                      <div className="mt-1 text-[10px] text-muted">SL: {entry.sl} | TP: {entry.tp}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="min-w-0"><div className="truncate text-[11px] text-muted">{entry.strategy}</div><div className="truncate text-[11px] text-muted">{entry.account}</div></div>
                        {entry.pnl && <span className={`font-mono text-[11px] ${entry.pnl.startsWith("+") ? "text-primary" : "text-danger"}`}>{entry.pnl}</span>}
                      </div>
                      {entry.error && <div className="mt-2 text-[11px] text-danger">{entry.error}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3 border-t border-border p-4">
                <button onClick={() => { window.location.href = "/alerts"; }} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted hover:text-foreground">View Full History</button>
                <div className="text-center text-[11px] text-muted">Today: 12 signals | 10 executed | 2 failed</div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="relative flex w-[44px] shrink-0 flex-col items-center gap-2 border-l border-border bg-panel py-3">
        {!rightPanel && (
          <button
            title={`Reopen ${lastOpenRightPanel === "alertslog" ? "Alerts Log" : lastOpenRightPanel.charAt(0).toUpperCase() + lastOpenRightPanel.slice(1)}`}
            onClick={reopenRightPanel}
            className="absolute -left-3 top-1/2 z-20 flex h-12 w-3 -translate-y-1/2 items-center justify-center rounded-l-full border border-r-0 border-border bg-panel text-muted shadow-lg transition-colors hover:bg-surface hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
        )}
        {[
          { id: "order" as const, title: "Order Panel", icon: FileText },
          { id: "watchlist" as const, title: "Watchlist", icon: List },
          { id: "alerts" as const, title: "Alerts", icon: Bell },
          { id: "alertslog" as const, title: "Alerts Log", icon: BellRing },
        ].map((item) => {
          const Icon = item.icon;
          const active = rightPanel === item.id;
          return (
            <button key={item.id} title={item.title} onClick={() => toggleRightPanel(item.id)} className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}>
              <Icon className="h-[18px] w-[18px]" />
              {item.id === "alertslog" && alertLogCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-semibold text-white">{alertLogCount}</span>}
            </button>
          );
        })}
      </div>

      <div className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-panel px-5 py-3 shadow-xl transition-all duration-300 ${showUpdateToast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
        {updateToast.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {updateToast.status === "success" && <CheckCircle className="h-4 w-4 text-primary" />}
        {updateToast.status === "error" && <AlertCircle className="h-4 w-4 text-danger" />}
        <span className={`text-[13px] ${updateToast.status === "error" ? "text-danger" : "text-foreground"}`}>{updateToast.message}</span>
      </div>

      {showBrokerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setShowBrokerModal(false); setSelectedBroker(null); }}>
          <div className="flex max-h-[600px] w-[700px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-5">
              <h2 className="text-[18px] font-semibold">Trade with your broker</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input value={brokerSearch} onChange={(event) => setBrokerSearch(event.target.value)} placeholder="Search brokers..." className="w-48 rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-[13px] outline-none focus:border-primary/40" />
                </div>
                <button onClick={() => { setShowBrokerModal(false); setSelectedBroker(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </div>
            {!selectedBroker ? (
              <>
                <div className="grid flex-1 grid-cols-4 gap-3 overflow-y-auto p-5">
                  {filteredBrokers.map((broker) => {
                    const favourite = brokerFavourites.includes(broker.name);
                    const connected = connectedBroker === broker.name;
                    const brokerHealth = getBrokerHealth(broker);
                    return (
                      <button key={broker.name} onClick={() => chooseBroker(broker)} className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all hover:border-primary/30 ${connected ? "border-primary/40 bg-primary/5" : "border-border bg-surface/50"}`}>
                        <span onClick={(event) => { event.stopPropagation(); toggleBrokerFavourite(broker.name); }} className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:bg-panel hover:text-yellow-400">
                          <Star className={`h-3.5 w-3.5 ${favourite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        </span>
                        {renderBrokerBadge(
                          broker,
                          "h-12 w-12",
                          broker.badgeLabel && broker.badgeLabel.length >= 4 ? "text-[11px] font-black tracking-[0.08em]" : "text-[15px] font-black tracking-[0.03em]",
                        )}
                        <span className="text-[13px] font-medium text-foreground">{broker.name}</span>
                        {broker.subtitle && <span className="text-[10px] text-muted">{broker.subtitle}</span>}
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          brokerHealth.state === "connected"
                            ? "bg-primary/10 text-primary"
                            : brokerHealth.state === "broken"
                              ? "bg-danger/10 text-danger"
                              : "bg-orange-400/10 text-orange-300"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${brokerHealth.dotClassName}`} />
                          {brokerHealth.label}
                        </span>
                        <span className="line-clamp-2 text-[10px] leading-4 text-muted">{brokerHealth.detail}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border px-5 py-3 text-center"><button className="text-[13px] text-primary hover:underline">Need a broker? Compare brokers</button></div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5">
                  <button onClick={() => setSelectedBroker(null)} className="mb-5 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Back</button>
                  <div className="mb-6 flex items-center gap-4">
                    {renderBrokerBadge(
                      selectedBroker,
                      "h-14 w-14",
                      selectedBroker.badgeLabel && selectedBroker.badgeLabel.length >= 4 ? "text-[12px] font-black tracking-[0.08em]" : "text-lg font-black tracking-[0.03em]",
                    )}
                    <div><h3 className="text-[17px] font-semibold">Connect your {selectedBroker.name} account</h3><p className="mt-1 text-[13px] text-muted">Credentials are kept in this browser session only.</p></div>
                  </div>
                  <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface/40 px-4 py-3">
                    <div>
                      <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Connection status</div>
                      <div className="mt-1 text-[13px] text-muted">{getBrokerHealth(selectedBroker).detail}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        getBrokerHealth(selectedBroker).state === "connected"
                          ? "bg-primary/15 text-primary"
                          : getBrokerHealth(selectedBroker).state === "broken"
                            ? "bg-danger/15 text-danger"
                            : "bg-orange-400/15 text-orange-300"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${getBrokerHealth(selectedBroker).dotClassName}`} />
                      {getBrokerHealth(selectedBroker).label}
                    </span>
                  </div>
                  {selectedBroker.type === "capital" && (
                    <div className="space-y-3"><input type="password" placeholder="API Key" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /><div className="flex rounded-xl border border-border bg-surface p-1">{(["Live", "Demo"] as const).map((mode) => <button key={mode} onClick={() => setBrokerMode(mode)} className={`flex-1 rounded-lg py-2 text-[13px] ${brokerMode === mode ? "bg-panel text-foreground" : "text-muted"}`}>{mode}</button>)}</div></div>
                  )}
                  {selectedBroker.type === "paper" && (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[13px] leading-6 text-muted">
                        Paper Trading uses the in-house Kwantify simulator. Choose which demo account should receive orders from this chart, or create a new one here and it will also appear in the Accounts area.
                      </div>
                      {selectedBrokerPaperAccounts.length > 0 ? (
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-primary">Paper accounts</span>
                            <button
                              onClick={() => setShowQuickPaperAccountForm((value) => !value)}
                              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] text-muted hover:text-foreground"
                            >
                              {showQuickPaperAccountForm ? "Close quick create" : "Create account"}
                            </button>
                          </div>
                          <select
                            value={String(brokerConnections[selectedBroker.name]?.accountId ?? selectedBrokerPaperAccounts[0]?.id ?? "")}
                            onChange={(event) => selectPaperTradingAccount(event.target.value)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary/40"
                          >
                            {selectedBrokerPaperAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {`${account.name} - ${account.balance} - ${account.leverage}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-[13px] text-orange-100/85">
                          No paper accounts yet. Create one below and we will link it straight away.
                        </div>
                      )}
                      {(showQuickPaperAccountForm || selectedBrokerPaperAccounts.length === 0) && (
                        <div className="space-y-3 rounded-2xl border border-border bg-background/40 p-4">
                          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Quick create paper account</div>
                          <input value={paperAccountName} onChange={(event) => setPaperAccountName(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" placeholder="Account name" />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <select value={paperAccountBalance} onChange={(event) => setPaperAccountBalance(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>$1,000</option><option>$5,000</option><option>$10,000</option><option>$25,000</option><option>$50,000</option><option>$100,000</option>
                            </select>
                            <select value={paperAccountLeverage} onChange={(event) => setPaperAccountLeverage(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>1:1</option><option>1:10</option><option>1:30</option><option>1:50</option><option>1:100</option><option>1:200</option><option>1:500</option>
                            </select>
                            <select value={paperAccountInstrument} onChange={(event) => setPaperAccountInstrument(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>NAS100</option><option>XAUUSD</option><option>BTCUSD</option><option>Multiple</option>
                            </select>
                            <select value={paperAccountStrategy} onChange={(event) => setPaperAccountStrategy(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>Manual / No Strategy</option>
                              {strategies.map((strategy) => <option key={strategy.id} value={strategy.name}>{strategy.name}</option>)}
                            </select>
                          </div>
                          <button
                            onClick={createQuickPaperTradingAccount}
                            disabled={!paperAccountName.trim()}
                            className="w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Create paper account
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedBroker.type === "ctrader" && (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[13px] leading-6 text-muted">
                        This cTrader lane now uses a real account-authorisation flow. Continue to cTrader, approve the accounts you want Kwantify to access, then we will bring you back here with your linked broker session ready for market data and later order routing.
                      </div>
                      {selectedBrokerAccounts.length > 0 && (
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-primary">Linked accounts</span>
                            <span className="flex items-center gap-1 text-[11px] text-primary">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              Connected
                            </span>
                          </div>
                          <select
                            value={brokerConnections[selectedBroker.name]?.accountId ?? selectedBrokerAccounts[0]?.accountId ?? ""}
                            onChange={(event) => selectBrokerAccount(selectedBroker.name, Number(event.target.value))}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary/40"
                          >
                            {selectedBrokerAccounts.map((account) => (
                              <option key={account.accountId} value={account.accountId}>
                                {formatCTraderAccountLabel(account)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedBroker.type === "oanda" && (
                    <div className="space-y-3"><input type="password" placeholder="API Token" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /><input placeholder="Account ID" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /><div className="flex rounded-xl border border-border bg-surface p-1">{(["Live", "Demo"] as const).map((mode) => <button key={mode} onClick={() => setBrokerMode(mode)} className={`flex-1 rounded-lg py-2 text-[13px] ${brokerMode === mode ? "bg-panel text-foreground" : "text-muted"}`}>{mode}</button>)}</div></div>
                  )}
                  {selectedBroker.type === "tradovate" && (
                    <div className="space-y-3"><input placeholder="Username" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /><input type="password" placeholder="Password" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /><div className="flex rounded-xl border border-border bg-surface p-1">{(["Live", "Demo"] as const).map((mode) => <button key={mode} onClick={() => setBrokerMode(mode)} className={`flex-1 rounded-lg py-2 text-[13px] ${brokerMode === mode ? "bg-panel text-foreground" : "text-muted"}`}>{mode}</button>)}</div></div>
                  )}
                  {selectedBroker.type === "binance" && (
                    <div className="space-y-3"><input type="password" placeholder="API Key" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /><input type="password" placeholder="API Secret" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" /></div>
                  )}
                  {selectedBroker.type === "soon" && <div className="rounded-2xl border border-border bg-surface/50 p-5 text-[13px] text-muted">Coming soon — we're working on connecting this broker.</div>}
                </div>
                <div className="flex items-center justify-between border-t border-border p-5">
                  <button className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Test Connection</button>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedBroker(null)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Back</button>
                    {selectedBroker.type === "ctrader" ? (
                      <>
                        <button onClick={() => connectBroker(selectedBroker.name)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Use Shared Feed</button>
                        <button onClick={() => startCTraderBrokerConnect(selectedBroker.name)} className="rounded-xl bg-primary px-5 py-2 text-[13px] font-semibold text-background">Continue to cTrader</button>
                      </>
                    ) : selectedBroker.type === "paper" ? (
                      <button onClick={() => connectBroker(selectedBroker.name)} disabled={selectedBrokerPaperAccounts.length === 0} className="rounded-xl bg-primary px-5 py-2 text-[13px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">Use Selected Paper Account</button>
                    ) : (
                      <button onClick={() => connectBroker(selectedBroker.name)} disabled={selectedBroker.type === "soon"} className="rounded-xl bg-primary px-5 py-2 text-[13px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">Connect</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sectionContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setSectionContextMenu(null)} />
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="fixed z-50 w-[200px] rounded-xl border border-border bg-panel py-1 shadow-2xl"
            style={{ left: sectionContextMenu.x, top: sectionContextMenu.y }}
          >
            <button
              onMouseDown={(event) => {
                event.stopPropagation();
                const sectionId = sectionContextMenu?.sectionId;
                setSectionContextMenu(null);
                setTimeout(() => {
                  if (sectionId) setRenamingSectionId(sectionId);
                }, 50);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <Pencil className="h-4 w-4 text-muted" />
              <span>Rename section</span>
            </button>
            <button
              onMouseDown={(event) => {
                event.stopPropagation();
                moveWatchlistSection(sectionContextMenu.sectionId, "up");
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <ChevronUp className="h-4 w-4 text-muted" />
              <span>Move up</span>
            </button>
            <button
              onMouseDown={(event) => {
                event.stopPropagation();
                moveWatchlistSection(sectionContextMenu.sectionId, "down");
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <ChevronDown className="h-4 w-4 text-muted" />
              <span>Move down</span>
            </button>
            <button
              onMouseDown={(event) => {
                event.stopPropagation();
                duplicateWatchlistSection(sectionContextMenu.sectionId);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <Copy className="h-4 w-4 text-muted" />
              <span>Duplicate section</span>
            </button>
            <button
              onMouseDown={(event) => {
                event.stopPropagation();
                deleteWatchlistSection(sectionContextMenu.sectionId);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-[13px] text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete section</span>
            </button>
          </div>
        </>
      )}

      {watchlistContextMenu && (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          className="fixed z-50 w-[240px] rounded-xl border border-border bg-panel py-2 shadow-2xl"
          style={{ left: watchlistContextMenu.x, top: watchlistContextMenu.y }}
        >
          <button
              onMouseDown={(event) => {
                event.stopPropagation();
                setWatchlistFlags((current) => {
                  const next = { ...current };
                if (next[watchlistContextMenu.key]) delete next[watchlistContextMenu.key];
                else next[watchlistContextMenu.key] = watchlistFlagColors[0];
                  return next;
                });
                setWatchlistContextMenu(null);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-[13px] text-foreground hover:bg-surface"
          >
            <span className="flex-1 text-left">Flag/Unflag {watchlistContextMenu.symbol}</span>
            <span className="text-[11px] text-muted">Alt+Enter</span>
          </button>
          <div className="grid grid-cols-8 gap-1 px-3 py-2">
            {watchlistFlagColors.map((color) => (
              <button
                key={color}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  flagWatchlistSymbol(watchlistContextMenu.key, color);
                }}
                className="h-5 w-5 cursor-pointer rounded-full border-2 border-transparent hover:border-white"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              unflagAllSymbols();
            }}
            className="w-full px-3 py-2 text-left text-[13px] text-muted hover:bg-surface hover:text-foreground"
          >
            Unflag all symbols
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              toggleWatchlistFavorite(watchlistContextMenu.key);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
          >
            <Star className={`h-4 w-4 text-yellow-400 ${watchlistFavorites.includes(watchlistContextMenu.key) ? "fill-current" : ""}`} />
            <span>{watchlistFavorites.includes(watchlistContextMenu.key) ? "Remove from favorites" : "Add to favorites"}</span>
          </button>
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              removeWatchlistSymbol(watchlistContextMenu.key);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
          >
            <Trash2 className="h-4 w-4 text-muted" />
            <span>Remove {watchlistContextMenu.symbol}</span>
          </button>
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              setShowInstrumentSearch(true);
              setWatchlistContextMenu(null);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
          >
            <Plus className="h-4 w-4 text-muted" />
            <span>Add symbol</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onMouseDown={(event) => {
              event.stopPropagation();
              addWatchlistSection();
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
          >
            <FolderPlus className="h-4 w-4 text-muted" />
            <span>Add section</span>
          </button>
          <div className="px-3 py-2 text-[12px] text-muted">Move to section &gt;</div>
          <div className="max-h-32 overflow-y-auto">
            {watchlistSections.map((section) => (
              <button
                key={section.id}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  moveWatchlistSymbolToSection(watchlistContextMenu.key, section.id);
                }}
                className="w-full px-6 py-1.5 text-left text-[12px] text-foreground hover:bg-surface"
              >
                {section.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showUsernameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[420px] rounded-2xl border border-border bg-panel p-6 shadow-2xl shadow-black/50">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Welcome to Kwantify!</h2>
              <p className="mt-2 text-[13px] text-muted">Choose your username to continue.</p>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Choose a username" className="w-full rounded-xl border border-border bg-surface py-3 pl-8 pr-4 text-[13px] outline-none focus:border-primary/40" />
            </div>
            {usernameError && <p className="mt-2 text-[12px] text-danger">{usernameError}</p>}
            <button onClick={saveUsername} className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background">Continue</button>
          </div>
        </div>
      )}
      <ChartCreateAlertModal
        isOpen={showChartAlertModal}
        instrument={selectedInstrument}
        timeframe={selectedTimeframe}
        strategies={chartStrategyOptions}
        defaultPrice={chartAlertPriceDraft}
        initialAlert={editingChartAlert}
        onClose={() => {
          setShowChartAlertModal(false);
          setEditingChartAlert(null);
        }}
        onCreate={handleCreateChartAlert}
      />
      {pendingAlertDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4" onClick={() => setPendingAlertDelete(null)}>
          <div className="w-full max-w-[420px] rounded-2xl border border-border bg-panel p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[18px] font-semibold text-foreground">Delete alert?</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted">
                  Are you sure you want to delete <span className="font-medium text-foreground">{pendingAlertDelete.conditionLabel}</span>? This will remove the alert from your chart.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingAlertDelete(null)}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteChartAlert(pendingAlertDelete.id)}
                className="rounded-xl bg-danger px-4 py-2 text-[13px] font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showMiniAI && !miniExpanded && <button onClick={() => setMiniExpanded(true)} className="fixed bottom-20 left-16 z-30 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-2xl shadow-black/30"><Bot className="h-4 w-4" />AI</button>}
      {showMiniAI && miniExpanded && <div className="fixed bottom-20 left-16 z-30 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/40"><div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Strategy Builder</span></div><div className="flex items-center gap-1"><button onClick={() => setMiniExpanded(false)} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Minus className="h-4 w-4" /></button><button onClick={maximizeMiniAI} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Maximize2 className="h-4 w-4" /></button><button onClick={() => { setShowMiniAI(false); setMiniExpanded(false); sessionStorage.removeItem("ai-messages"); sessionStorage.removeItem("ai-minimized"); }} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div></div><div className="flex-1 space-y-4 overflow-y-auto p-4">{miniMessages.length === 0 && <div className="flex h-full flex-col items-center justify-center text-center"><Bot className="mb-3 h-6 w-6 text-primary" /><p className="text-sm font-semibold">Ask Kwantify to build a strategy</p><p className="mt-1 text-xs leading-5 text-muted">Describe an entry, risk model, session, or market condition.</p></div>}{miniMessages.map((msg, i) => <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex gap-3"}>{msg.role === "user" ? <div className="max-w-[80%] rounded-2xl bg-surface px-3 py-2 text-[13px] leading-6">{msg.content}</div> : <div className="text-[13px] leading-6 text-muted"><AssistantContent text={msg.content} copiedKey={copiedKey} onCopy={copyCode} /></div>}</div>)}{miniLoading && <div className="flex gap-1.5"><div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /><div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" /><div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" /></div>}<div ref={miniMessagesEndRef} /></div><div className="border-t border-border p-3"><div className="rounded-2xl border border-border bg-surface p-2 focus-within:border-primary/35"><textarea value={miniInput} onChange={(e) => setMiniInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat("mini"); } }} placeholder="Describe your strategy..." rows={2} className="max-h-24 w-full resize-none bg-transparent px-2 py-1 text-[13px] leading-6 outline-none placeholder:text-muted/60" /><div className="flex justify-end"><button onClick={() => sendChat("mini")} disabled={miniLoading || !miniInput.trim()} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button></div></div></div></div>}
      {showBacktestSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setShowBacktestSettings(false)}>
          <div className="w-[500px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><h2 className="text-[16px] font-semibold">Strategy Properties</h2></div>
              <button onClick={() => setShowBacktestSettings(false)} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex border-b border-border px-5 pt-3">
              {(["properties", "inputs"] as const).map((tab) => <button key={tab} onClick={() => setBacktestSettingsTab(tab)} className={`border-b-2 px-4 pb-2 text-[13px] capitalize ${backtestSettingsTab === tab ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>{tab}</button>)}
            </div>
            {backtestSettingsTab === "properties" ? (
              <div className="max-h-[560px] space-y-4 overflow-y-auto p-5">
                {[["Initial Capital", "initialCapital"], ["Pyramiding", "pyramiding"], ["Slippage (ticks)", "slippage"]].map(([label, key]) => <label key={key} className="block space-y-1.5"><span className="text-[12px] text-muted">{label}</span><input type="number" value={backtestSettingsDraft[key as keyof typeof backtestSettingsDraft] as number} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, [key]: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /></label>)}
                <label className="block space-y-1.5"><span className="text-[12px] text-muted">Base Currency</span><select value={backtestSettingsDraft.baseCurrency} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, baseCurrency: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{["USD", "EUR", "GBP", "AUD", "JPY"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
                <div className="grid grid-cols-[1fr_120px] gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Order Size</span><select value={backtestSettingsDraft.orderSizeType} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, orderSizeType: e.target.value, orderSizeValue: e.target.value === "percent_equity" ? 10 : e.target.value === "fixed_quantity" ? 1 : 1000 }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="percent_equity">% of Equity</option><option value="fixed_quantity">Fixed Quantity</option><option value="fixed_usd">Fixed USD</option></select></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">Value</span><input type="number" value={backtestSettingsDraft.orderSizeValue} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, orderSizeValue: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label></div>
                <div className="grid grid-cols-[1fr_120px] gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Commission</span><select value={backtestSettingsDraft.commissionType} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, commissionType: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="percent">% of Position</option><option value="fixed_contract">Fixed per Contract</option><option value="fixed_order">Fixed per Order</option></select></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">Value</span><input type="number" step="0.01" value={backtestSettingsDraft.commissionValue} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, commissionValue: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label></div>
                <div className="grid grid-cols-2 gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Margin Long (%)</span><input type="number" value={backtestSettingsDraft.marginLong} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, marginLong: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">Margin Short (%)</span><input type="number" value={backtestSettingsDraft.marginShort} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, marginShort: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label></div>
                <label className="block space-y-1.5"><span className="text-[12px] text-muted">Fill Orders</span><select value={backtestSettingsDraft.fillOrders} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, fillOrders: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="next_bar_open">On Next Bar Open</option><option value="bar_close">On Bar Close</option></select></label>
                <div className="grid grid-cols-3 gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Date Range</span><select value={backtestSettingsDraft.datePreset} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, datePreset: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="365d">Last 365 days</option><option value="all">All available</option></select></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">From</span><input type="date" value={backtestSettingsDraft.dateFrom} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, dateFrom: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px] outline-none" /></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">To</span><input type="date" value={backtestSettingsDraft.dateTo} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, dateTo: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px] outline-none" /></label></div>
              </div>
            ) : <div className="p-8 text-center text-[13px] text-muted">Strategy inputs will appear here when a strategy with configurable parameters is selected</div>}
            <div className="flex items-center justify-between border-t border-border px-5 py-4"><button onClick={() => setBacktestSettingsDraft(defaultBacktestSettings)} className="rounded-lg border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Reset to Default</button><button onClick={() => { setBacktestSettings(backtestSettingsDraft); setShowBacktestSettings(false); }} className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-background">Apply</button></div>
          </div>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setShowSettings(false)}>
          <div className="flex h-[560px] w-[500px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b border-border px-5"><h2 className="text-lg font-semibold">Settings</h2><button onClick={() => { cancelChartSettings(); setShowSettings(false); }} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="flex min-h-0 flex-1">
              <aside className="w-36 border-r border-border p-2">{["Symbol", "Scales and lines", "Trading"].map((tab) => <button key={tab} onClick={() => setSettingsTab(tab)} className={`w-full rounded-lg px-3 py-2 text-left text-[12px] ${settingsTab === tab ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>{tab}</button>)}</aside>
              <div onClick={() => setColorPicker(null)} className="min-w-0 flex-1 space-y-5 overflow-y-auto p-5">
                {settingsTab === "Symbol" && (
                  <>
                    <section className="space-y-3"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Candles</h3><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draftChartSettings.colorBarsPreviousClose} onChange={(event) => setDraftChartSettings((current) => ({ ...current, colorBarsPreviousClose: event.target.checked }))} />Color bars based on previous close</label><ColorButton field="upColor" label="Body up" /><ColorButton field="downColor" label="Body down" /><ColorButton field="borderUpColor" label="Border up" /><ColorButton field="borderDownColor" label="Border down" /><ColorButton field="wickUpColor" label="Wick up" /><ColorButton field="wickDownColor" label="Wick down" /></section>
                    <section className="space-y-3"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Chart</h3><ColorButton field="backgroundColor" label="Background" /><ColorButton field="gridColor" label="Grid lines" /><label className="flex items-center justify-between gap-3 text-[12px] text-muted"><span>Show grid lines</span><input type="checkbox" checked={draftChartSettings.gridLines} onChange={(event) => setDraftChartSettings((current) => ({ ...current, gridLines: event.target.checked }))} /></label></section>
                    <section className="space-y-3"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Data</h3><select value={draftChartSettings.timezone} onChange={(event) => setDraftChartSettings((current) => ({ ...current, timezone: event.target.value }))} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"><option>(UTC-5) New York</option><option>(UTC+0) London</option><option>(UTC+3) Dubai</option><option>(UTC+8) Singapore</option><option>(UTC+10) Sydney</option></select><select value={draftChartSettings.precision} onChange={(event) => setDraftChartSettings((current) => ({ ...current, precision: event.target.value }))} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"><option>Default</option><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></section>
                  </>
                )}
                {settingsTab !== "Symbol" && <div className="text-[13px] text-muted">Settings for {settingsTab.toLowerCase()} will be available soon.</div>}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border p-4">
              <div className="relative">
                <button onClick={() => setShowTemplateMenu((value) => !value)} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-muted hover:text-foreground">Template <ChevronDown className="h-3.5 w-3.5" /></button>
                {showTemplateMenu && (
                  <div className="absolute bottom-9 left-0 z-[110] w-64 overflow-hidden rounded-xl border border-border bg-panel py-2 shadow-2xl">
                    <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-muted">Presets</div>
                    {presetTemplates.map((template) => <button key={template.name} onClick={() => applyChartTemplate(template.settings)} className="w-full px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface">{template.name}</button>)}
                    {templates.length > 0 && <div className="my-1 border-t border-border" />}
                    {templates.length > 0 && <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-muted">Saved templates</div>}
                    {templates.map((template) => (
                      <div key={template.name} className="flex items-center hover:bg-surface">
                        <button onClick={() => applyChartTemplate(template.settings)} className="min-w-0 flex-1 px-3 py-2 text-left text-[12px] text-foreground">{template.name}</button>
                        <button onClick={() => deleteChartTemplate(template.name)} className="px-3 text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <div className="my-1 border-t border-border" />
                    <button onClick={() => { setShowSaveTemplate(true); setShowTemplateMenu(false); }} className="w-full px-3 py-2 text-left text-[12px] text-muted hover:bg-surface hover:text-foreground">Save as template...</button>
                    <button onClick={() => applyChartTemplate(defaultChartSettings)} className="w-full px-3 py-2 text-left text-[12px] text-muted hover:bg-surface hover:text-foreground">Reset to default</button>
                  </div>
                )}
              </div>
              <div className="flex gap-2"><button onClick={cancelChartSettings} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Cancel</button><button onClick={applyChartSettings} className="rounded-xl bg-primary px-5 py-2 text-[13px] font-semibold text-background">Ok</button></div>
            </div>
          </div>
        </div>
      )}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70" onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }}>
          <div className="w-[320px] rounded-2xl border border-border bg-panel p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-base font-semibold">Save as template</h3>
            <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} autoFocus placeholder="Template name" className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" />
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Cancel</button><button onClick={saveChartTemplate} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Save</button></div>
          </div>
        </div>
      )}
      {showInstrumentSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="flex h-[620px] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <Search className="h-4 w-4 text-muted" />
              <input
                autoFocus
                value={instrumentSearch}
                onChange={(e) => setInstrumentSearch(e.target.value)}
                placeholder="Search instruments or brokers..."
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => {
                  setShowInstrumentSearch(false);
                  setInstrumentSearch("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
                aria-label="Close instrument picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.1fr)_minmax(220px,1.4fr)_92px] gap-3 border-b border-border px-5 py-3 text-[10px] uppercase tracking-wider text-muted">
              <span>Broker</span>
              <span>Instrument</span>
              <span>Market</span>
              <span className="text-right">Action</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredInstrumentPickerItems.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-muted">
                  No instruments match that search yet.
                </div>
              ) : (
                filteredInstrumentPickerItems.map((entry) => {
                  const exists = watchlistSectionSymbolKeys.has(entry.key);
                  return (
                    <div key={entry.key} className="grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.1fr)_minmax(220px,1.4fr)_92px] items-center gap-3 border-b border-border/60 px-5 py-3">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-surface px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          {entry.broker}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-foreground">{entry.symbol}</div>
                        <div className="truncate text-[11px] uppercase tracking-wider text-muted">{entry.category}</div>
                      </div>
                      <div className="min-w-0 truncate text-[13px] text-muted">{entry.fullName}</div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleInstrumentInWatchlist(entry)}
                          className={`inline-flex min-w-[74px] items-center justify-center gap-1 rounded-lg px-3 py-2 text-[12px] font-medium ${
                            exists ? "bg-primary/10 text-primary" : "border border-border bg-surface text-foreground hover:border-primary/30"
                          }`}
                        >
                          {exists ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {exists ? "Added" : "Add"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {showAllTF && <div className="fixed inset-0 z-40" onClick={() => setShowAllTF(false)} />}
    </div>
  );
}
