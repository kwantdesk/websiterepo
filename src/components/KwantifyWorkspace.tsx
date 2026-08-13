"use client";

import KwantSelect from "@/components/ui/KwantSelect";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import ChartIndicatorsControl from "@/components/ChartIndicatorsControl";
import SourceCodeIndicatorsControl from "@/components/SourceCodeIndicatorsControl";
import KwantLoader from "@/components/KwantLoader";
import LiveGexPanelBoundary from "@/components/backtesting/LiveGexPanelBoundary";
import LiveGexPanel from "@/components/backtesting/HistoricalGexPanel";
import ZyonPanelBoundary from "@/components/zyon/ZyonPanelBoundary";
import UserAvatar from "@/components/socials/UserAvatar";
import WorkspaceFailureBoundary from "@/components/WorkspaceFailureBoundary";
import KwantBotInterpreterPanel from "@/components/kwantbot/KwantBotInterpreterPanel";
import { useKwantBotInterpreter } from "@/hooks/useKwantBotInterpreter";
import { useSocialNotifications } from "@/hooks/useSocialNotifications";
import { useStructureLevels } from "@/hooks/useStructureLevels";
import { useGexBotFlow } from "@/hooks/useGexBotFlow";
import { ACTIVITY_STREAK_TIME_ZONE } from "@/lib/activityStreak";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";

import { Activity as ReactActivity, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
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
  Bot,
  BrainCircuit,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  FolderPlus,
  Grid3X3,
  Info,
  Layers3,
  List,
  Loader2,
  Lock,
  Maximize2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MoveDiagonal2,
  Pause,
  Paperclip,
  Pencil,
  Play,
  PictureInPicture2,
  Plus,
  Repeat,
  Save,
  Search,
  Send,
  Settings,
  Settings2,
  Sparkles,
  Star,
  Store,
  Trash2,
  Trophy,
  Upload,
  Unlock,
  User,
  UsersRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { runBacktest, runStrategyCode, type BacktestConfig, type BacktestResult, type Candle, type Trade } from "@/lib/backtester";
import { createClient } from "@/lib/supabase";
import type { FriendsPayload } from "@/lib/friends";
import { cacheProfileIdentity, readProfileIdentityCache } from "@/lib/profileIdentityCache";
import { useAccountPreferenceSync } from "@/hooks/useAccountPreferenceSync";
import { compactLegacyAuthPreferenceMetadata, hydrateUserPreferences } from "@/lib/userPreferences";
import { normalizeTimeZone } from "@/lib/timeZones";
import { clearSavedStrategiesRaw, loadSavedStrategiesRaw, saveSavedStrategiesRaw } from "@/lib/automation";
import { defaultChartSettings, extractUserChartSettings, loadStoredChartSettings, saveStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import type { ChartLevel, ChartZone } from "@/components/Chart";
import {
  CHART_INDICATOR_BY_ID,
  type ChartIndicatorInstance,
} from "@/lib/chartIndicatorCatalog";
import {
  clonePaneIndicatorState,
  normalizePaneIndicatorState,
} from "@/lib/chartIndicatorConfig";
import { mergeGammaLevelsAtSamePrice, type ChartGammaLevelsPayload } from "@/lib/chartGammaLevels";
import {
  buildChartVolumeProfile,
  applyInstitutionalTradesToVolumeProfile,
  enrichCandlesWithInstitutionalCandleFlow,
  enrichCandlesWithInstitutionalTrades,
  fetchInstitutionalSnapshot,
  fetchInstitutionalOrderFlowLevels,
  fetchInstitutionalVolumeProfile,
  mergeInstitutionalVolumeProfiles,
  type InstitutionalOrderFlowResult,
  type InstitutionalTrade,
  type InstitutionalVolumeProfile,
} from "@/lib/institutionalMarketData";
import { subscribeRithmicIndicatorTrades } from "@/lib/rithmicIndicatorStream";
import {
  currentGameplanSession,
  gameplanSessionLabel,
  isGameplanPayload,
  type GameplanPayload,
  type GameplanSession,
} from "@/lib/gameplan";
import {
  fetchWorkspaceData,
  gameplanCacheKey,
  preloadWorkspaceData,
  readWorkspaceData,
} from "@/lib/workspaceDataCache";
import {
  GAMEPLAN_CHART_OVERLAYS_EVENT,
  GAMEPLAN_CHART_OVERLAYS_STORAGE_KEY,
  createGameplanChartOverlay,
  gameplanChartRootForInstrument,
  loadGameplanChartOverlays,
  removeGameplanChartOverlay,
  saveGameplanChartOverlay,
  type GameplanChartOverlay,
  type GameplanChartOverlayStore,
} from "@/lib/gameplanChartOverlay";
import { serializeDeepChartsXml } from "@/lib/deepChartsExport";
import {
  PLATFORM_LEVEL_EXPORT_OPTIONS,
  serializePlatformLevels,
  type PlatformLevelExportFormat,
} from "@/lib/platformLevelExport";
import {
  buildChartGammaCalibration,
  cashFallbackGammaConversion,
  findCashCloseFuturesCandle,
  identityGammaCalibration,
  isGammaChartInstrument,
  isNativeGammaConversion,
  loadChartGammaCalibration,
  resolveGammaConversion,
  roundedGammaPrice,
  saveChartGammaCalibration,
  type ChartGammaCalibration,
  type GammaConversionDefinition,
} from "@/lib/chartGammaConversion";
import {
  createPaperTradingAccount,
  loadPaperTradingAccounts,
  savePaperTradingAccounts,
  parseMoney as parsePaperMoney,
  type PaperTradingAccountRecord,
} from "@/lib/paperAccounts";
import {
  cancelPaperOrder,
  closePaperPosition,
  emptyPaperTradingLedger,
  flattenPaperAccount,
  loadPaperTradingLedger,
  normalizePaperSymbol,
  paperContractNotional,
  paperContractSpec,
  paperOrderQuantity,
  paperPointValue,
  paperTickSize,
  parseLeverage,
  placePaperOrder,
  processPaperQuote,
  savePaperTradingLedger,
  snapPaperPrice,
  summarizePaperAccount,
  updatePaperProtection,
  type PaperPosition,
  type PaperTradeFill,
  type PaperTradingLedger,
} from "@/lib/paperTrading";
import {
  getMassiveFuturesSymbolDefinition,
  isMassiveFuturesSymbol,
} from "@/lib/massiveFutures";
import {
  MARKET_INDEX_DEFINITIONS,
  getMarketIndexDefinition,
  isMarketIndexSymbol,
} from "@/lib/marketIndices";
import {
  DATABENTO_DEFAULT_SYMBOLS,
  DATABENTO_FUTURES,
  isContinuousFuture,
  type DatabentoInstrument,
} from "@/lib/databento";
import {
  CHART_INTERVAL_GROUPS,
  formatChartInterval,
  isEventBasedChartInterval,
  makeCustomChartInterval,
  parseChartIntervalInput,
  supportsChartInterval,
  type ChartIntervalKind,
} from "@/lib/chartIntervals";
import { applyMarketTradesToEventBars, futuresTickSize } from "@/lib/eventBars";
import type { ValueAreaProfile } from "@/lib/valueArea";
import {
  DATABENTO_LIVE_TICK_EVENT,
  LIVE_CHART_CANDLE_EVENT,
  publishDatabentoLiveStatus,
  readDatabentoLiveTail,
  recordDatabentoLiveTick,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";
import {
  mergeChartHistory,
  peekExecutionTapeCache,
  peekCompatibleChartHistoryCache,
  readCompatibleChartHistoryCache,
  readChartHistoryCache,
  readExecutionTapeCache,
  writeChartHistoryCache,
  writeExecutionTapeCache,
} from "@/lib/chartHistoryCache";
import {
  cmeSessionDateKey,
  cmeSessionStartMs,
  cmeSessionWindowForDate,
  cmeChartTailNeedsReconciliation,
  DEFAULT_CHART_HISTORY_CALENDAR_DAYS,
  hasMinimumChartHistory,
  trimToRecentChartSessions,
} from "@/lib/chartHistoryWindow";
import { readLiveQuoteCache, writeLiveQuoteCache } from "@/lib/liveQuoteCache";
import {
  loadKwantBotConversation,
  saveKwantBotConversation,
} from "@/lib/kwantBotChatStore";
import AppSidebar from "@/components/AppSidebar";
import ChartCreateAlertModal from "@/components/alerts/ChartCreateAlertModal";
import {
  getExpirationLabel,
  getTriggerModeLabel,
  loadChartAlerts,
  saveChartAlerts,
  type ChartAlertRecord,
} from "@/lib/chartAlerts";
import {
  appendClassicGexHistory,
  shouldPublishClassicGex,
  type ClassicGexHistorySnapshot,
  type ClassicGexProfilePayload,
} from "@/lib/classicGexProfile";
import { mergeOneFamilyPositioning } from "@/lib/gexBotFlow";

function workspaceLoader(title: string, detail: string) {
  return (
    <KwantLoader
      className="h-full min-h-0 flex-1"
      compact
      title={title}
      detail={detail}
    />
  );
}

const loadChartWorkspace = () => import("@/components/Chart");
const loadGammaWorkspace = () => import("@/components/options-flow/GammaWorkspace");
const loadGexMapWorkspace = () => import("@/components/gex-map/GexMapWorkspace");
const loadLiquidityMapWorkspace = () => import("@/components/liquidity-map/LiquidityMapWorkspace");
const loadOptionsHeatmapWorkspace = () => import("@/components/heatmap/OptionsHeatmapWorkspace");
const loadGexBotWorkspace = () => import("@/components/gexbot/GexBotWorkspace");
const loadGexDeskWorkspace = () => import("@/components/gexdesk/GexDeskWorkspace");
const loadGameplanWorkspace = () => import("@/components/gameplan/GameplanWorkspace");
const loadNewsWorkspace = () => import("@/components/news/NewsWorkspace");
const loadZyonWorkspace = () => import("@/components/zyon/ZyonWorkspace");
const loadJournalWorkspace = () => import("@/components/journal/JournalWorkspace");
const loadBacktestingWorkspace = () => import("@/components/backtesting/BacktestingWorkspace");
const loadLevelzWorkspace = () => import("@/components/levelz/LevelzWorkspace");
const loadSocialsWorkspace = () => import("@/components/socials/SocialsWorkspace");
const loadKwantBotWorkspace = () => import("@/components/kwantbot/KwantBotIntelligenceWorkspace");

const workspaceModulePreloaders: Record<string, () => Promise<unknown>> = {
  charts: loadChartWorkspace,
  gamma: loadGammaWorkspace,
  gexmap: loadGexMapWorkspace,
  liqmap: loadLiquidityMapWorkspace,
  heatmap: loadOptionsHeatmapWorkspace,
  gexbot: loadGexBotWorkspace,
  gexdesk: loadGexDeskWorkspace,
  gameplan: loadGameplanWorkspace,
  news: loadNewsWorkspace,
  zyon: loadZyonWorkspace,
  journal: loadJournalWorkspace,
  backtesting: loadBacktestingWorkspace,
  levelz: loadLevelzWorkspace,
  socials: loadSocialsWorkspace,
  kwantbot: loadKwantBotWorkspace,
};

function preloadWorkspaceModule(section: string) {
  return workspaceModulePreloaders[section]?.() ?? Promise.resolve(null);
}

const Chart = dynamic(loadChartWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Loading chart", "Restoring cached candles and layout."),
});
const GammaWorkspace = dynamic(loadGammaWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Gamma", "Restoring the latest options view."),
});
const GexMapWorkspace = dynamic(loadGexMapWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening GEXMAP", "Restoring exposure panels."),
});
const LiquidityMapWorkspace = dynamic(loadLiquidityMapWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening LIQ MAP", "Connecting the liquidity map."),
});
const OptionsHeatmapWorkspace = dynamic(loadOptionsHeatmapWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Heat Map", "Restoring options positioning and the shared NQ tape."),
});
const GexBotWorkspace = dynamic(loadGexBotWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening GEX BOT", "Restoring the latest New York options frame."),
});
const GexDeskWorkspace = dynamic(loadGexDeskWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Gexdesk", "Mapping options positioning onto live NQ."),
});
const GameplanWorkspace = dynamic(loadGameplanWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Gameplan", "Loading the active session map."),
});
const NewsWorkspace = dynamic(loadNewsWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening News", "Loading the economic calendar."),
});
const ZyonWorkspace = dynamic(loadZyonWorkspace, {
  ssr: false,
  loading: () => (
    <KwantLoader
      className="h-full min-h-0 flex-1"
      compact
      icon={Sparkles}
      title="Opening ZYON"
      detail="Loading the latest conversation."
    />
  ),
});
const JournalWorkspace = dynamic(loadJournalWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Journal", "Restoring account records."),
});
const BacktestingWorkspace = dynamic(loadBacktestingWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Backtesting", "Preparing the historical replay engine."),
});
const LevelzWorkspace = dynamic(loadLevelzWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening LEVELZ", "Restoring the level workspaces."),
});
const SocialsWorkspace = dynamic(loadSocialsWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Socials", "Restoring the latest record and feed."),
});
const KwantBotIntelligenceWorkspace = dynamic(loadKwantBotWorkspace, {
  ssr: false,
  loading: () => workspaceLoader("Opening Kwant Bot", "Restoring market intelligence."),
});
const OptionsTapePanel = dynamic(() => import("@/components/kwantbot/OptionsTapePanel"), {
  ssr: false,
  loading: () => workspaceLoader("Opening Options Tape", "Restoring the New York tape."),
});
const FriendsPanel = dynamic(() => import("@/components/friends/FriendsPanel"), {
  ssr: false,
  loading: () => workspaceLoader("Opening Friends", "Restoring conversations."),
});
const SocialNotificationsPanel = dynamic(() => import("@/components/socials/SocialNotificationsPanel"), {
  ssr: false,
  loading: () => workspaceLoader("Opening activity", "Restoring social notifications."),
});

const BOTTOM_PANEL_MIN_HEIGHT = 150;
const BOTTOM_PANEL_DEFAULT_HEIGHT = 300;
const BOTTOM_PANEL_COLLAPSED_HEIGHT = 40;
const BOTTOM_PANEL_COLLAPSE_SNAP_HEIGHT = 72;
const CHART_TOP_BAR_HEIGHT = 40;
const RIGHT_PANEL_MIN_WIDTH = 64;
const RIGHT_PANEL_MAX_WIDTH = 1600;
const RIGHT_PANEL_DEFAULT_WIDTH = 280;
type RightPanel = "order" | "watchlist" | "gex" | "zyon" | "kwantbot" | "optionstape" | "alerts" | "alertslog" | "friends" | "messages";

type FriendMessageToast = {
  id: string;
  senderUserId: string;
  senderName: string;
  senderHandle: string;
  avatarUrl: string;
  preview: string;
};
type AlertsPanelTab = "social" | "market";
const CHART_INDICATORS_STORAGE_KEY = "kwantdesk-chart-indicators";

type Message = { role: "user" | "assistant"; content: string };
type StrategyVersion = { code: string; timestamp: Date | string; version: number };
type ChartTemplate = { name: string; settings: ChartSettings };
type WatchlistItem = {
  key: string;
  symbol: string;
  broker: string;
  displayName?: string;
  contractSymbol?: string;
  exchange?: string;
  delayed?: boolean;
  marketType?: "spot" | "futures" | "options";
  lastPrice: number;
  openPrice: number;
  bid: number;
  ask: number;
  mid: number;
  change: number;
  changePercent: number;
  flash: "up" | "down" | null;
};
type LiveWatchlistSnapshot = Pick<
  WatchlistItem,
  "lastPrice" | "openPrice" | "bid" | "ask" | "mid" | "change" | "changePercent" | "flash"
>;
type LiveFeedPrice = {
  error?: string;
  instrument: string;
  bid: number;
  ask: number;
  mid: number;
  broker?: string;
  isTrade?: boolean;
  size?: number;
  trades?: number;
  delta?: number;
  contractSymbol?: string;
  timestamp?: string | number;
  cached?: boolean;
};

const liveWatchlistSnapshots = new Map<string, LiveWatchlistSnapshot>();
const liveWatchlistSubscribers = new Map<string, Set<() => void>>();
const liveWatchlistNotifyTimers = new Map<string, ReturnType<typeof setTimeout>>();
const liveWatchlistFlashTimers = new Map<string, ReturnType<typeof setTimeout>>();

function publishLiveWatchlistQuote(
  key: string,
  quote: LiveFeedPrice,
  fallbackOpenPrice = 0,
) {
  const previous = liveWatchlistSnapshots.get(key);
  const mid = Number(quote.mid);
  if (!Number.isFinite(mid) || mid <= 0) return;
  const previousMid = previous?.mid || mid;
  const openPrice = previous?.openPrice || fallbackOpenPrice || mid;
  const change = mid - openPrice;
  liveWatchlistSnapshots.set(key, {
    lastPrice: mid,
    openPrice,
    bid: Number.isFinite(Number(quote.bid)) ? Number(quote.bid) : mid,
    ask: Number.isFinite(Number(quote.ask)) ? Number(quote.ask) : mid,
    mid,
    change,
    changePercent: openPrice ? (change / openPrice) * 100 : 0,
    flash: mid > previousMid ? "up" : mid < previousMid ? "down" : previous?.flash ?? null,
  });

  const previousFlashTimer = liveWatchlistFlashTimers.get(key);
  if (previousFlashTimer) clearTimeout(previousFlashTimer);
  liveWatchlistFlashTimers.set(key, setTimeout(() => {
    liveWatchlistFlashTimers.delete(key);
    const current = liveWatchlistSnapshots.get(key);
    if (!current?.flash) return;
    liveWatchlistSnapshots.set(key, { ...current, flash: null });
    liveWatchlistSubscribers.get(key)?.forEach((notify) => notify());
  }, 600));

  // Paint the small watchlist cells independently of the enormous workspace
  // shell. Quotes are coalesced to 10fps so a burst of CME packets cannot make
  // React rebuild every chart pane or starve primary navigation.
  if (liveWatchlistNotifyTimers.has(key)) return;
  liveWatchlistNotifyTimers.set(key, setTimeout(() => {
    liveWatchlistNotifyTimers.delete(key);
    liveWatchlistSubscribers.get(key)?.forEach((notify) => notify());
  }, 100));
}

function subscribeLiveWatchlistQuote(key: string, notify: () => void) {
  const subscribers = liveWatchlistSubscribers.get(key) ?? new Set<() => void>();
  subscribers.add(notify);
  liveWatchlistSubscribers.set(key, subscribers);
  notify();
  return () => {
    subscribers.delete(notify);
    if (!subscribers.size) liveWatchlistSubscribers.delete(key);
  };
}
type QueuedLiveTick = {
  mid: number;
  timestamp: number;
  isTrade?: boolean;
  size?: number;
  trades?: number;
  delta?: number;
  cached?: boolean;
};
type KwantBotMessage = {
  id: string;
  text: string;
  receivedAt: string;
  sender: "bot" | "user";
  attachments?: KwantBotAttachment[];
};
type KwantBotAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
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

type WorkspaceLayout = "single" | "split-vertical" | "split-horizontal" | "quad" | "custom";
type WorkspacePanelKind = "charts" | "zyon" | "gameplan" | "gamma" | "gexmap" | "liqmap" | "news" | "socials" | "journal";
type WorkspacePane = {
  id: string;
  symbol: string;
  broker: string;
  timeframe: string;
  period: string;
  watchlistKey: string;
  content: WorkspacePanelKind | null;
};
type WorkspaceFloatingWindow = {
  paneId: string;
  /** Normalized workspace coordinates keep the window responsive across screens. */
  x: number;
  y: number;
  width: number;
  height: number;
  locked: boolean;
};
type PaneLevelVisibility = {
  gamma: boolean;
  kwant: boolean;
  structure: boolean;
  valueArea: boolean;
};
type WorkspaceLayoutNode =
  | { type: "pane"; paneId: string }
  | {
      type: "split";
      id: string;
      axis: "x" | "y";
      ratio: number;
      first: WorkspaceLayoutNode;
      second: WorkspaceLayoutNode;
    };
type WorkspaceDropZone = "left" | "right" | "top" | "bottom" | "center";
type WorkspacePreset = {
  id: string;
  name: string;
  layout: WorkspaceLayoutNode;
  panes: WorkspacePane[];
  chartSettings: ChartSettings;
  indicators?: Record<string, ChartIndicatorInstance[]>;
  levelVisibility?: Record<string, PaneLevelVisibility>;
  floatingWindows?: WorkspaceFloatingWindow[];
  updatedAt: string;
};
type WorkspaceBackupFile = {
  format: "kwantdesk-chart-workspaces";
  version: 1;
  exportedAt: string;
  presets: WorkspacePreset[];
};
type LevelExportType = "gamma" | "gameplan" | "valueArea" | "historicalStructure";
type ValueAreaLevelExportSnapshot = {
  checkedAt: string;
  sourceLabel: string;
  levels: ChartLevel[];
};
type StructureLevelExportSnapshot = {
  checkedAt: string;
  sourceLabel: string;
  levels: ChartLevel[];
  zones: Array<ChartZone & {
    role: string;
    confidence: number;
  }>;
};
type GammaLevelExportSnapshot = {
  paneId: string;
  instrument: string;
  sourceSymbol: string;
  contractSymbol: string | null;
  checkedAt: string | null;
  regime: GammaChartOverlay["regime"] | null;
  sourceLabel: string;
  levels: ChartLevel[];
  valueArea: ValueAreaLevelExportSnapshot | null;
  structure: StructureLevelExportSnapshot | null;
};
type LevelExportRow = {
  levelType: "Gamma Levels" | "Kwant Levels" | "Value Area Levels" | "Historical Supply/Demand + S/R";
  instrument: string;
  sourceSymbol: string;
  contractSymbol: string;
  id: string;
  name: string;
  role: string;
  price: number;
  zoneLow: number;
  zoneHigh: number;
  strength: number | null;
  color: string;
  lineStyle: string;
  lineWidth: number;
  source: string;
  asOf: string;
};
export type PrimaryWorkspaceSection = "charts" | "gamma" | "levelz" | "gexmap" | "liqmap" | "heatmap" | "gexbot" | "gexdesk" | "gameplan" | "kwantbot" | "news" | "zyon" | "journal" | "socials" | "backtesting";

const WORKSPACE_PRESETS_STORAGE_KEY = "kwantdesk-chart-workspace-presets";
const ACTIVE_WORKSPACE_PRESET_STORAGE_KEY = "kwantdesk-chart-workspace-active-preset";
const WORKSPACE_FLOATING_WINDOWS_STORAGE_KEY = "olisa-chart-workspace-floating-windows";
const WORKSPACE_BACKUP_FORMAT = "kwantdesk-chart-workspaces";
const MAX_WORKSPACE_BACKUP_BYTES = 2_000_000;
const GAMMA_LEVELS_ENABLED_STORAGE_KEY = "kwantdesk:chart-gamma-levels-enabled:v1";
const HISTORICAL_STRUCTURE_ENABLED_STORAGE_KEY = "kwantdesk:chart-historical-structure-enabled:v1";
const VALUE_AREA_LEVELS_ENABLED_STORAGE_KEY = "kwantdesk:chart-value-area-levels-enabled:v1";
const PANE_LEVEL_VISIBILITY_STORAGE_KEY = "kwantdesk:chart-pane-level-visibility:v1";
const KWANTBOT_MESSAGES_STORAGE_KEY = "kwantdesk-kwantbot-messages";
const LIQUIDITY_MAP_INSTRUMENT_STORAGE_KEY = "kwantdesk:liquidity-map-instrument:v1";
const BOTTOM_WORKSPACE_SECTIONS = [
  { id: "charts" as const, label: "Charts" },
  { id: "gamma" as const, label: "Gamma" },
  { id: "levelz" as const, label: "LEVELZ" },
  { id: "gexmap" as const, label: "GEXMAP" },
  { id: "liqmap" as const, label: "LIQ MAP" },
  { id: "heatmap" as const, label: "Heat Map" },
  { id: "gexbot" as const, label: "GEX Bot" },
  { id: "gexdesk" as const, label: "Gexdesk" },
  { id: "gameplan" as const, label: "Gameplan" },
  { id: "kwantbot" as const, label: "KwantBot" },
  { id: "news" as const, label: "News" },
  { id: "zyon" as const, label: "ZYON" },
  { id: "journal" as const, label: "Journal" },
  { id: "socials" as const, label: "Socials" },
  { id: "backtesting" as const, label: "Backtesting" },
];
const DEFAULT_KWANTBOT_MESSAGES: KwantBotMessage[] = [
  {
    id: "kwantbot-welcome",
    text: "I’m online. Send me a message, chart screenshot, photo, or research file whenever you’re ready.",
    receivedAt: "",
    sender: "bot",
  },
];

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
  { id: "pane-1", symbol: "ES.v.0", broker: "Databento", timeframe: "5m", period: "5D", watchlistKey: makeWatchlistKey("ES.v.0", "Databento"), content: "charts" },
  { id: "pane-2", symbol: "NQ.v.0", broker: "Databento", timeframe: "5m", period: "5D", watchlistKey: makeWatchlistKey("NQ.v.0", "Databento"), content: "charts" },
  { id: "pane-3", symbol: "CL.v.0", broker: "Databento", timeframe: "5m", period: "5D", watchlistKey: makeWatchlistKey("CL.v.0", "Databento"), content: "charts" },
  { id: "pane-4", symbol: "GC.v.0", broker: "Databento", timeframe: "5m", period: "5D", watchlistKey: makeWatchlistKey("GC.v.0", "Databento"), content: "charts" },
];

const WORKSPACE_PANEL_OPTIONS: Array<{
  id: WorkspacePanelKind;
  label: string;
  description: string;
  icon: typeof BarChart3;
}> = [
  { id: "charts", label: "CHARTS", description: "Live chart and indicators", icon: BarChart3 },
  { id: "zyon", label: "ZYON", description: "AI quant analyst", icon: Sparkles },
  { id: "gameplan", label: "GAMEPLAN", description: "Live session plan", icon: FileText },
  { id: "gamma", label: "GAMMA", description: "Options positioning", icon: Zap },
  { id: "gexmap", label: "GEX MAP", description: "Strike exposure map", icon: Layers3 },
  { id: "liqmap", label: "LIQ MAP", description: "Live Level 3 liquidity", icon: List },
  { id: "news", label: "NEWS", description: "Calendar and macro", icon: Bell },
  { id: "socials", label: "SOCIALS", description: "Feed, desks and profiles", icon: UsersRound },
  { id: "journal", label: "JOURNAL", description: "Trades and analysis", icon: FileText },
];

function isWorkspacePanelKind(value: unknown): value is WorkspacePanelKind {
  return WORKSPACE_PANEL_OPTIONS.some((option) => option.id === value);
}

function displayCmeSymbol(symbol: string) {
  return symbol.replace(/\.[vnc]\.\d+$/i, "");
}

function liquidityMapInstrument(symbol: string) {
  const contractRoot = displayCmeSymbol(symbol)
    .toUpperCase()
    .replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
  if (contractRoot === "NQ" || contractRoot === "MNQ") return "NQ.v.0";
  if (contractRoot === "ES" || contractRoot === "MES") return "ES.v.0";
  return "";
}

function displayCmeText(value: string) {
  return value.replace(/\b([A-Z0-9]+)\.[vnc]\.\d+\b/gi, "$1");
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function downloadLevelFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function displayMarketSource(broker: string) {
  if (broker === "Databento") return "CME";
  if (broker === "Market Index") return "CBOE";
  return broker;
}

function fallbackFuturesContract(root: string, now = new Date()) {
  const quarterly = new Set([
    "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY",
    "ZN", "TN", "ZB", "UB", "ZF", "ZT", "10Y", "SR3",
    "6E", "M6E", "6J", "6B", "M6B", "6A", "M6A", "6C", "6S", "6N", "6M",
  ]);
  const deliveryMonths: Record<string, number[]> = {
    GC: [2, 4, 6, 8, 10, 12], MGC: [2, 4, 6, 8, 10, 12],
    SI: [3, 5, 7, 9, 12], SIL: [3, 5, 7, 9, 12], HG: [3, 5, 7, 9, 12],
    PL: [1, 4, 7, 10], PA: [3, 6, 9, 12],
    ZC: [3, 5, 7, 9, 12], ZW: [3, 5, 7, 9, 12],
    ZS: [1, 3, 5, 7, 8, 9, 11],
    ZM: [1, 3, 5, 7, 8, 9, 10, 12], ZL: [1, 3, 5, 7, 8, 9, 10, 12],
    LE: [2, 4, 6, 8, 10, 12], HE: [2, 4, 5, 6, 7, 8, 10, 12],
    GF: [1, 3, 4, 5, 8, 9, 10, 11],
  };
  const eligibleMonths = quarterly.has(root)
    ? [3, 6, 9, 12]
    : deliveryMonths[root] ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const currentMonth = now.getUTCMonth() + 1;
  let year = now.getUTCFullYear();
  let month = eligibleMonths.find((candidate) => (
    quarterly.has(root) ? candidate >= currentMonth : candidate > currentMonth
  ));
  if (!month) {
    month = eligibleMonths[0];
    year += 1;
  }
  const monthCode = "FGHJKMNQUVXZ"[month - 1];
  return {
    contractSymbol: `${root}${monthCode}${String(year).slice(-1)}`,
    contractLabel: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

function currentCmeContract(symbol: string) {
  if (!isContinuousFuture(symbol)) return null;
  return fallbackFuturesContract(displayCmeSymbol(symbol)).contractSymbol;
}

const CME_MICRO_PARENT_ROOTS: Record<string, string> = {
  MNQ: "NQ",
  MES: "ES",
  MYM: "YM",
  M2K: "RTY",
  MGC: "GC",
  MCL: "CL",
  SIL: "SI",
  QG: "NG",
  M6E: "6E",
  M6B: "6B",
  M6A: "6A",
  MBT: "BTC",
  MET: "ETH",
};

function parentCmeRoot(symbol: string) {
  const root = displayCmeSymbol(symbol)
    .toUpperCase()
    .replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
  return CME_MICRO_PARENT_ROOTS[root] ?? root;
}

function contractMatchesChartInstrument(chartSymbol: string, contractSymbol: string | null) {
  if (!contractSymbol) return false;
  return parentCmeRoot(chartSymbol) === parentCmeRoot(contractSymbol);
}

function valueAreaSourceSymbol(chartSymbol: string) {
  const parent = parentCmeRoot(chartSymbol);
  return `${parent}.v.0`;
}

function createWorkspaceLayoutTree(
  layout: Exclude<WorkspaceLayout, "custom">,
  panes: WorkspacePane[],
): WorkspaceLayoutNode {
  const pane = (index: number): WorkspaceLayoutNode => ({
    type: "pane",
    paneId: (panes[index] ?? DEFAULT_WORKSPACE_PANES[index] ?? panes[0] ?? DEFAULT_WORKSPACE_PANES[0]).id,
  });
  if (layout === "split-vertical") {
    return { type: "split", id: "root-x", axis: "x", ratio: 50, first: pane(0), second: pane(1) };
  }
  if (layout === "split-horizontal") {
    return { type: "split", id: "root-y", axis: "y", ratio: 50, first: pane(0), second: pane(1) };
  }
  if (layout === "quad") {
    return {
      type: "split",
      id: "root-x",
      axis: "x",
      ratio: 50,
      first: {
        type: "split",
        id: "left-y",
        axis: "y",
        ratio: 50,
        first: pane(0),
        second: pane(2),
      },
      second: {
        type: "split",
        id: "right-y",
        axis: "y",
        ratio: 50,
        first: pane(1),
        second: pane(3),
      },
    };
  }
  return pane(0);
}

function collectWorkspacePaneIds(node: WorkspaceLayoutNode): string[] {
  return node.type === "pane"
    ? [node.paneId]
    : [...collectWorkspacePaneIds(node.first), ...collectWorkspacePaneIds(node.second)];
}

function swapWorkspacePaneIds(
  node: WorkspaceLayoutNode,
  firstPaneId: string,
  secondPaneId: string,
): WorkspaceLayoutNode {
  if (node.type === "pane") {
    if (node.paneId === firstPaneId) return { ...node, paneId: secondPaneId };
    if (node.paneId === secondPaneId) return { ...node, paneId: firstPaneId };
    return node;
  }
  return {
    ...node,
    first: swapWorkspacePaneIds(node.first, firstPaneId, secondPaneId),
    second: swapWorkspacePaneIds(node.second, firstPaneId, secondPaneId),
  };
}

function updateWorkspaceSplitRatio(
  node: WorkspaceLayoutNode,
  splitId: string,
  ratio: number,
): WorkspaceLayoutNode {
  if (node.type === "pane") return node;
  if (node.id === splitId) return { ...node, ratio };
  const first = updateWorkspaceSplitRatio(node.first, splitId, ratio);
  if (first !== node.first) return { ...node, first };
  const second = updateWorkspaceSplitRatio(node.second, splitId, ratio);
  return second === node.second ? node : { ...node, second };
}

function insertWorkspacePane(
  node: WorkspaceLayoutNode,
  targetPaneId: string,
  nextPaneId: string,
  axis: "x" | "y",
  splitId: string,
): WorkspaceLayoutNode {
  if (node.type === "pane") {
    if (node.paneId !== targetPaneId) return node;
    return {
      type: "split",
      id: splitId,
      axis,
      ratio: 50,
      first: node,
      second: { type: "pane", paneId: nextPaneId },
    };
  }
  return {
    ...node,
    first: insertWorkspacePane(node.first, targetPaneId, nextPaneId, axis, splitId),
    second: insertWorkspacePane(node.second, targetPaneId, nextPaneId, axis, splitId),
  };
}

function insertWorkspacePaneAtEdge(
  node: WorkspaceLayoutNode,
  targetPaneId: string,
  movingPaneId: string,
  zone: Exclude<WorkspaceDropZone, "center">,
  splitId: string,
): WorkspaceLayoutNode {
  if (node.type === "pane") {
    if (node.paneId !== targetPaneId) return node;
    const moving: WorkspaceLayoutNode = { type: "pane", paneId: movingPaneId };
    const axis = zone === "left" || zone === "right" ? "x" : "y";
    const movingFirst = zone === "left" || zone === "top";
    return {
      type: "split",
      id: splitId,
      axis,
      ratio: 50,
      first: movingFirst ? moving : node,
      second: movingFirst ? node : moving,
    };
  }
  const first = insertWorkspacePaneAtEdge(node.first, targetPaneId, movingPaneId, zone, splitId);
  if (first !== node.first) return { ...node, first };
  const second = insertWorkspacePaneAtEdge(node.second, targetPaneId, movingPaneId, zone, splitId);
  return second === node.second ? node : { ...node, second };
}

function workspaceDropZoneAtPoint(element: HTMLElement, clientX: number, clientY: number): WorkspaceDropZone {
  const rect = element.getBoundingClientRect();
  const x = (clientX - rect.left) / Math.max(rect.width, 1);
  const y = (clientY - rect.top) / Math.max(rect.height, 1);
  const edge = 0.28;
  if (x <= edge && y > edge && y < 1 - edge) return "left";
  if (x >= 1 - edge && y > edge && y < 1 - edge) return "right";
  if (y <= edge) return "top";
  if (y >= 1 - edge) return "bottom";
  return "center";
}

function removeWorkspacePane(node: WorkspaceLayoutNode, paneId: string): WorkspaceLayoutNode | null {
  if (node.type === "pane") return node.paneId === paneId ? null : node;
  const first = removeWorkspacePane(node.first, paneId);
  const second = removeWorkspacePane(node.second, paneId);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
}

function normalizeWorkspaceLayoutNode(
  value: unknown,
  validPaneIds: Set<string>,
): WorkspaceLayoutNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Partial<WorkspaceLayoutNode> & Record<string, unknown>;
  if (node.type === "pane" && typeof node.paneId === "string" && validPaneIds.has(node.paneId)) {
    return { type: "pane", paneId: node.paneId };
  }
  if (
    node.type === "split"
    && typeof node.id === "string"
    && (node.axis === "x" || node.axis === "y")
  ) {
    const first = normalizeWorkspaceLayoutNode(node.first, validPaneIds);
    const second = normalizeWorkspaceLayoutNode(node.second, validPaneIds);
    if (!first || !second) return null;
    const ratio = Number(node.ratio);
    return {
      type: "split",
      id: node.id,
      axis: node.axis,
      ratio: Number.isFinite(ratio) ? Math.min(96, Math.max(4, ratio)) : 50,
      first,
      second,
    };
  }
  return null;
}

function clampWorkspaceUnit(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function normalizeWorkspaceFloatingWindows(
  value: unknown,
  validPaneIds?: Set<string>,
): WorkspaceFloatingWindow[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const windows: WorkspaceFloatingWindow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Partial<WorkspaceFloatingWindow>;
    if (
      typeof candidate.paneId !== "string"
      || !candidate.paneId
      || seen.has(candidate.paneId)
      || (validPaneIds && !validPaneIds.has(candidate.paneId))
    ) continue;
    const width = Math.min(0.96, Math.max(0.12, clampWorkspaceUnit(Number(candidate.width), 0.58)));
    const height = Math.min(0.96, Math.max(0.18, clampWorkspaceUnit(Number(candidate.height), 0.62)));
    const x = Math.min(1 - width, clampWorkspaceUnit(Number(candidate.x), 0.18));
    const y = Math.min(1 - height, clampWorkspaceUnit(Number(candidate.y), 0.12));
    seen.add(candidate.paneId);
    windows.push({
      paneId: candidate.paneId,
      x,
      y,
      width,
      height,
      locked: candidate.locked === true,
    });
  }
  return windows.slice(0, 12);
}

function loadWorkspaceFloatingWindows(validPaneIds?: Set<string>) {
  if (typeof window === "undefined") return [];
  try {
    return normalizeWorkspaceFloatingWindows(
      JSON.parse(window.localStorage.getItem(WORKSPACE_FLOATING_WINDOWS_STORAGE_KEY) ?? "[]"),
      validPaneIds,
    );
  } catch {
    return [];
  }
}

const EMPTY_PANE_LEVEL_VISIBILITY: PaneLevelVisibility = {
  gamma: false,
  kwant: false,
  structure: false,
  valueArea: false,
};

function normalizePaneLevelVisibility(value: unknown): Record<string, PaneLevelVisibility> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([paneId, entry]) => Boolean(paneId) && entry && typeof entry === "object" && !Array.isArray(entry))
      .map(([paneId, entry]) => {
        const candidate = entry as Partial<PaneLevelVisibility>;
        return [paneId, {
          gamma: candidate.gamma === true,
          kwant: candidate.kwant === true,
          structure: candidate.structure === true,
          valueArea: candidate.valueArea === true,
        } satisfies PaneLevelVisibility];
      }),
  );
}

function clonePaneLevelVisibility(value: Record<string, PaneLevelVisibility>) {
  return Object.fromEntries(
    Object.entries(value).map(([paneId, visibility]) => [paneId, { ...visibility }]),
  );
}

function isWorkspacePreset(value: unknown): value is WorkspacePreset {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const preset = value as Partial<WorkspacePreset>;
  return Boolean(
    typeof preset.id === "string"
    && preset.id
    && typeof preset.name === "string"
    && preset.name.trim()
    && typeof preset.updatedAt === "string"
    && Array.isArray(preset.panes)
    && preset.layout
    && preset.chartSettings,
  );
}

function normalizeWorkspacePresets(value: unknown): WorkspacePreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isWorkspacePreset)
    .map((preset) => {
      const panes = preset.panes.map((pane, index) =>
        normalizeWorkspacePane(pane, DEFAULT_WORKSPACE_PANES[index] ?? DEFAULT_WORKSPACE_PANES[0]));
      const layout = normalizeWorkspaceLayoutNode(preset.layout, new Set(panes.map((pane) => pane.id)))
        ?? createWorkspaceLayoutTree("single", panes);
      return {
        ...preset,
        panes,
        layout,
        indicators: normalizePaneIndicatorState(preset.indicators),
        levelVisibility: normalizePaneLevelVisibility(preset.levelVisibility),
        floatingWindows: normalizeWorkspaceFloatingWindows(
          preset.floatingWindows,
          new Set(panes.map((pane) => pane.id)),
        ),
      };
    })
    .slice(0, 100)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadLocalWorkspacePresets(): WorkspacePreset[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeWorkspacePresets(
      JSON.parse(window.localStorage.getItem(WORKSPACE_PRESETS_STORAGE_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

function normalizeWorkspacePane(pane: Partial<WorkspacePane>, fallback: WorkspacePane): WorkspacePane {
  if (pane.broker !== "Databento" && pane.broker !== "Market Index") return fallback;
  const broker = pane.broker ?? fallback.broker;
  const requestedTimeframe = pane.timeframe ?? fallback.timeframe;
  const timeframe = broker === "Market Index" && !supportsChartInterval(requestedTimeframe, broker)
    ? "1D"
    : requestedTimeframe;
  return {
    id: pane.id ?? fallback.id,
    symbol: pane.symbol ?? fallback.symbol,
    broker,
    timeframe,
    period: pane.period ?? "5D",
    watchlistKey: pane.watchlistKey ?? makeWatchlistKey(pane.symbol ?? fallback.symbol, pane.broker ?? fallback.broker),
    // Existing saved workspaces predate mixed panels and are chart panes.
    content: pane.content === null || isWorkspacePanelKind(pane.content) ? pane.content : "charts",
  };
}

function makeWatchlistKey(symbol: string, broker: string) {
  return `${broker}::${symbol}`;
}

function createWatchlistItem(symbol: string, broker: string, detail?: { price: string; change: string }) {
  const mid = detail ? Number(detail.price.replace(/,/g, "")) : 0;
  const changePercent = detail ? Number(detail.change.replace("%", "")) : 0;
  const massiveDefinition = broker === "Massive" ? getMassiveFuturesSymbolDefinition(symbol) : null;
  const databentoDefinition = broker === "Databento" ? DATABENTO_FUTURES.find((item) => item.symbol === symbol) : null;
  const marketIndexDefinition = broker === "Market Index" ? getMarketIndexDefinition(symbol) : null;
  return {
    key: makeWatchlistKey(symbol, broker),
    symbol,
    broker,
    displayName: massiveDefinition?.displayName ?? databentoDefinition?.label ?? marketIndexDefinition?.displayName,
    contractSymbol: broker === "Databento" ? currentCmeContract(symbol) ?? undefined : undefined,
    exchange: massiveDefinition?.exchange ?? databentoDefinition?.venue ?? marketIndexDefinition?.exchange,
    delayed: massiveDefinition?.delayed ?? false,
    marketType: broker === "Databento" ? (isContinuousFuture(symbol) ? ("futures" as const) : ("options" as const)) : massiveDefinition ? ("futures" as const) : ("spot" as const),
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
    symbols: DATABENTO_DEFAULT_SYMBOLS.map((symbol) => makeWatchlistKey(symbol, "Databento")),
  },
  {
    id: "macro",
    name: "Volatility",
    symbols: MARKET_INDEX_DEFINITIONS.map((index) => makeWatchlistKey(index.symbol, "Market Index")),
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
    "5D": { from: new Date(now - DEFAULT_CHART_HISTORY_CALENDAR_DAYS * day).toISOString(), label: "5D" },
    "1W": { from: new Date(now - 7 * day).toISOString(), label: "1W" },
    "1M": { from: new Date(now - 30 * day).toISOString(), label: "1M" },
    "3M": { from: new Date(now - 90 * day).toISOString(), label: "3M" },
    "6M": { from: new Date(now - 180 * day).toISOString(), label: "6M" },
    "1Y": { from: new Date(now - 365 * day).toISOString(), label: "1Y" },
    All: { from: new Date(now - 4 * 365 * day).toISOString(), label: "All" },
  }[period] ?? { from: new Date(now - 365 * day).toISOString(), label: "1Y" };
}

function requestedChartHistoryStart(period: string) {
  if (period === "5D") {
    return Date.now() - DEFAULT_CHART_HISTORY_CALENDAR_DAYS * 24 * 60 * 60_000;
  }
  return Date.parse(getPeriodConfig(period).from);
}

function trimChartHistoryForPeriod(candles: Candle[], period: string, requestedFrom: number) {
  const withinRequestedWindow = candles.filter((candle) => candle.timestamp >= requestedFrom);
  return period === "5D"
    ? trimToRecentChartSessions(withinRequestedWindow)
    : withinRequestedWindow;
}

function isTooManyCandles(period: string, timeframe: string) {
  if (timeframe === "1m") return ["6M", "1Y", "All"].includes(period);
  if (timeframe === "5m") return period === "All";
  return false;
}

function getTimeframeMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) return 5 * 60_000;
  const value = Math.max(1, Number(match[1]));
  const units: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 24 * 60 * 60_000,
    W: 7 * 24 * 60 * 60_000,
    M: 30 * 24 * 60 * 60_000,
  };
  return value * (units[match[2]] ?? 5 * 60_000);
}

function chicagoTradingDate(timestamp: number) {
  return cmeSessionDateKey(timestamp) ?? new Date(timestamp).toISOString().slice(0, 10);
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

function trimCandlesAfterActiveBucket(
  candles: Candle[],
  timeframe: string,
  now = Date.now(),
) {
  if (isEventBasedChartInterval(timeframe)) return candles;
  const activeBucket = getTimeframeBucketStart(now, timeframe);
  return candles.filter((candle) =>
    getTimeframeBucketStart(candle.timestamp, timeframe) <= activeBucket);
}

function trimDisconnectedActiveTail(
  candles: Candle[],
  timeframe: string,
  now = Date.now(),
) {
  if (isEventBasedChartInterval(timeframe) || candles.length < 2) return candles;
  const durationMs = getTimeframeMs(timeframe);
  if (!Number.isFinite(durationMs) || durationMs >= 24 * 60 * 60_000) return candles;
  const normalized = mergeChartHistory([], candles);
  const activeBucket = getTimeframeBucketStart(now, timeframe);
  if (getTimeframeBucketStart(normalized.at(-1)?.timestamp ?? 0, timeframe) !== activeBucket) {
    return normalized;
  }
  // A browser tick can arrive before the gateway seam. Never retain that
  // isolated active tail in memory/cache or it appears as a candle floating
  // several minutes to the right of history. The subsequent seam merge adds
  // these buckets back from authoritative executions.
  const lowerBound = Math.max(1, normalized.length - 12);
  for (let index = normalized.length - 1; index >= lowerBound; index -= 1) {
    const current = getTimeframeBucketStart(normalized[index].timestamp, timeframe);
    const previous = getTimeframeBucketStart(normalized[index - 1].timestamp, timeframe);
    if (current - previous > durationMs) return normalized.slice(0, index);
  }
  return normalized;
}

function mergeHistoricalWithLiveTail(
  historical: Candle[],
  rendered: Candle[],
  timeframe: string,
  liveTailStartTimestamp: number | null,
) {
  const normalizedHistory = mergeChartHistory([], historical);
  if (isEventBasedChartInterval(timeframe)) {
    const historyTail = normalizedHistory.at(-1)?.timestamp ?? Number.NEGATIVE_INFINITY;
    const liveOnly = rendered.filter((candle) => candle.timestamp > historyTail);
    return mergeChartHistory(normalizedHistory, liveOnly);
  }
  if (liveTailStartTimestamp === null) return normalizedHistory;

  const liveBucketStart = getTimeframeBucketStart(liveTailStartTimestamp, timeframe);
  const byTimestamp = new Map(normalizedHistory.map((candle) => [
    getTimeframeBucketStart(candle.timestamp, timeframe),
    {
      ...candle,
      timestamp: getTimeframeBucketStart(candle.timestamp, timeframe),
    },
  ]));

  for (const liveCandle of rendered) {
    const timestamp = getTimeframeBucketStart(liveCandle.timestamp, timeframe);
    if (timestamp < liveBucketStart) continue;
    const historicalCandle = byTimestamp.get(timestamp);
    if (!historicalCandle) {
      byTimestamp.set(timestamp, { ...liveCandle, timestamp });
      continue;
    }
    byTimestamp.set(timestamp, {
      ...historicalCandle,
      ...liveCandle,
      timestamp,
      open: historicalCandle.open,
      high: Math.max(historicalCandle.high, liveCandle.high),
      low: Math.min(historicalCandle.low, liveCandle.low),
      close: liveCandle.close,
      volume: Math.max(
        Number(historicalCandle.volume ?? 0),
        Number(liveCandle.volume ?? 0),
      ),
    });
  }

  return [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function mergeObservedDatabentoTail(
  historical: Candle[],
  observedSeconds: Candle[],
  timeframe: string,
) {
  if (!observedSeconds.length || isEventBasedChartInterval(timeframe)) return historical;
  const buckets = new Map<number, Candle>();
  for (const second of observedSeconds) {
    const timestamp = getTimeframeBucketStart(second.timestamp, timeframe);
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, { ...second, timestamp });
      continue;
    }
    buckets.set(timestamp, {
      ...existing,
      high: Math.max(existing.high, second.high),
      low: Math.min(existing.low, second.low),
      close: second.close,
      volume: Number(existing.volume ?? 0) + Number(second.volume ?? 0),
      trades: Number(existing.trades ?? 0) + Number(second.trades ?? 0),
      delta: Number(existing.delta ?? 0) + Number(second.delta ?? 0),
      deltaClose: Number(existing.deltaClose ?? existing.delta ?? 0) + Number(second.deltaClose ?? second.delta ?? 0),
      askVolume: Number(existing.askVolume ?? 0) + Number(second.askVolume ?? 0),
      bidVolume: Number(existing.bidVolume ?? 0) + Number(second.bidVolume ?? 0),
    });
  }

  const currentBucket = getTimeframeBucketStart(Date.now(), timeframe);
  const merged = new Map(mergeChartHistory([], historical).map((candle) => [
    getTimeframeBucketStart(candle.timestamp, timeframe),
    { ...candle, timestamp: getTimeframeBucketStart(candle.timestamp, timeframe) },
  ]));
  for (const [timestamp, observed] of buckets) {
    const existing = merged.get(timestamp);
    if (!existing) {
      merged.set(timestamp, observed);
      continue;
    }
    // Closed historical bars remain authoritative. The live tail only fills
    // missing buckets and completes the still-forming bucket.
    if (timestamp < currentBucket) continue;
    merged.set(timestamp, {
      ...existing,
      ...observed,
      timestamp,
      open: existing.open,
      high: Math.max(existing.high, observed.high),
      low: Math.min(existing.low, observed.low),
      close: observed.close,
      volume: Math.max(Number(existing.volume ?? 0), Number(observed.volume ?? 0)),
      trades: Math.max(Number(existing.trades ?? 0), Number(observed.trades ?? 0)),
      askVolume: Math.max(Number(existing.askVolume ?? 0), Number(observed.askVolume ?? 0)),
      bidVolume: Math.max(Number(existing.bidVolume ?? 0), Number(observed.bidVolume ?? 0)),
    });
  }
  return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function marketTimestamp(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return marketTimestamp(numeric);
  }
  if (typeof value === "number") {
    const timestamp = value > 10_000_000_000_000_000
      ? Math.floor(value / 1_000_000)
      : value > 10_000_000_000_000
        ? Math.floor(value / 1_000)
        : value < 10_000_000_000
          ? Math.floor(value * 1_000)
          : value;
    const now = Date.now();
    return timestamp > now + 60_000 || timestamp < now - 15 * 60_000 ? now : timestamp;
  }
  const parsed = Date.parse(String(value ?? ""));
  const now = Date.now();
  return Number.isFinite(parsed) && parsed <= now + 60_000 && parsed >= now - 15 * 60_000
    ? parsed
    : now;
}

function compactTimeBasedTicks(ticks: QueuedLiveTick[], timeframe: string) {
  if (ticks.length <= 4) return ticks;
  const buckets = new Map<number, {
    first: QueuedLiveTick;
    low: QueuedLiveTick;
    high: QueuedLiveTick;
    last: QueuedLiveTick;
  }>();

  for (const tick of ticks) {
    const bucket = getTimeframeBucketStart(tick.timestamp, timeframe);
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, { first: tick, low: tick, high: tick, last: tick });
      continue;
    }
    if (tick.mid < current.low.mid) current.low = tick;
    if (tick.mid > current.high.mid) current.high = tick;
    current.last = tick;
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, bucket]) => {
      const unique = new Map<string, QueuedLiveTick>();
      for (const tick of [bucket.first, bucket.low, bucket.high, bucket.last]) {
        unique.set(`${tick.timestamp}:${tick.mid}`, tick);
      }
      return [...unique.values()];
    });
}

function formatPrice(price: number, symbol: string): string {
  const root = displayCmeSymbol(symbol).toUpperCase();
  const fiveDecimal = ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"];
  const threeDecimalForex = ["USDJPY"];
  const threeDecimal = ["XAUUSD", "OIL"];
  const oneDecimal = ["NAS100", "S&P500", "GER40", "UK100", "DOW30", "NIKKEI", "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY", "MGC", "GC"];

  if (root === "10Y") return price.toFixed(3);
  if (fiveDecimal.includes(root)) return price.toFixed(5);
  if (threeDecimalForex.includes(root)) return price.toFixed(3);
  if (threeDecimal.includes(root)) return price.toFixed(3);
  if (oneDecimal.includes(root)) return price.toFixed(1);
  return price.toFixed(2);
}

const LiveWatchlistNumbers = memo(function LiveWatchlistNumbers({ row }: { row: WatchlistItem }) {
  const [snapshot, setSnapshot] = useState<LiveWatchlistSnapshot | null>(() =>
    liveWatchlistSnapshots.get(row.key) ?? null);

  useEffect(() => subscribeLiveWatchlistQuote(row.key, () => {
    setSnapshot(liveWatchlistSnapshots.get(row.key) ?? null);
  }), [row.key]);

  const quote = snapshot ?? row;
  const priceColor = quote.flash === "up" ? "#22C55E" : quote.flash === "down" ? "#EF4444" : "#A1A1AA";
  const changeColor = quote.change > 0 ? "#22C55E" : quote.change < 0 ? "#EF4444" : "#A1A1AA";
  const percentColor = quote.changePercent > 0 ? "#22C55E" : quote.changePercent < 0 ? "#EF4444" : "#A1A1AA";

  return (
    <>
      <span className="text-right font-mono text-[12px] transition-colors duration-300" style={{ color: priceColor }}>
        {formatPrice(quote.mid, row.symbol)}
      </span>
      <span className="text-right font-mono text-[11px]" style={{ color: changeColor }}>
        {quote.change > 0 ? "+" : quote.change < 0 ? "-" : ""}{Math.abs(quote.change).toFixed(2)}
      </span>
      <span className="text-right font-mono text-[11px]" style={{ color: percentColor }}>
        {quote.changePercent > 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
      </span>
    </>
  );
});

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getLiveMoveLimit(symbol: string) {
  const root = displayCmeSymbol(symbol);
  if (["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"].includes(root)) return 0.035;
  if (root === "USDJPY") return 0.04;
  if (["XAUUSD", "XAGUSD", "MGC", "GC"].includes(root)) return 0.08;
  if (["NAS100", "S&P500", "GER40", "UK100", "DOW30", "NIKKEI", "MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY"].includes(root)) return 0.1;
  return 0.12;
}

function getCandleRangeLimit(symbol: string) {
  const root = displayCmeSymbol(symbol);
  if (["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"].includes(root)) return 0.12;
  if (root === "USDJPY") return 0.15;
  if (["XAUUSD", "XAGUSD", "MGC", "GC"].includes(root)) return 0.25;
  return 0.4;
}

function getSingleTickMoveRatio(symbol: string) {
  const root = displayCmeSymbol(symbol);
  if (["MNQ", "NQ", "MES", "ES", "MYM", "YM", "M2K", "RTY"].includes(root)) return 0.002;
  if (["6E", "6J", "6B", "6A", "6C"].includes(root)) return 0.0015;
  if (["ZN", "ZB", "ZF", "ZT", "SR3"].includes(root)) return 0.002;
  if (["CL", "NG", "RB", "HO"].includes(root)) return 0.006;
  if (["GC", "MGC", "SI", "HG", "PL"].includes(root)) return 0.004;
  return 0.003;
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

function getSingleTickMoveLimit(candles: Candle[], symbol: string, reference: number) {
  const typicalRange = getRecentTypicalRange(candles, 20);
  return Math.max(
    futuresTickSize(symbol) * 16,
    reference * getSingleTickMoveRatio(symbol),
    typicalRange * 3,
  );
}

type LiveOutlierCandidate = {
  price: number;
  count: number;
  firstSeenAt: number;
  lastEventTimestamp: number;
};

function validateLiveTick(args: {
  candles: Candle[];
  symbol: string;
  price: number;
  timestamp: number;
  referencePrice: number | null;
  referenceTimestamp: number | null;
  candidate: LiveOutlierCandidate | null;
}) {
  const {
    candles,
    symbol,
    price,
    timestamp,
    referencePrice,
    referenceTimestamp,
    candidate,
  } = args;
  if (!isPositiveFinite(price) || !Number.isFinite(timestamp)) {
    return { accepted: false, candidate: null as LiveOutlierCandidate | null };
  }
  if (referenceTimestamp !== null && timestamp < referenceTimestamp - 2_000) {
    return { accepted: false, candidate };
  }
  if (!referencePrice || !isPositiveFinite(referencePrice)) {
    return { accepted: true, candidate: null as LiveOutlierCandidate | null };
  }

  const move = Math.abs(price - referencePrice);
  const limit = getSingleTickMoveLimit(candles, symbol, referencePrice);
  if (move <= limit) {
    return { accepted: true, candidate: null as LiveOutlierCandidate | null };
  }

  const now = Date.now();
  const tolerance = Math.max(futuresTickSize(symbol) * 16, limit * 0.12);
  const continuesCandidate =
    candidate
    && now - candidate.firstSeenAt <= 3_000
    && Math.abs(price - candidate.price) <= tolerance;
  const nextCandidate: LiveOutlierCandidate = continuesCandidate
    ? {
        price: (candidate.price * candidate.count + price) / (candidate.count + 1),
        count: candidate.count + (timestamp === candidate.lastEventTimestamp ? 0 : 1),
        firstSeenAt: candidate.firstSeenAt,
        lastEventTimestamp: timestamp,
      }
    : {
        price,
        count: 1,
        firstSeenAt: now,
        lastEventTimestamp: timestamp,
      };

  if (nextCandidate.count >= 4) {
    return { accepted: true, candidate: null as LiveOutlierCandidate | null };
  }
  return { accepted: false, candidate: nextCandidate };
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

  return cleanCandles.map((candle, index, rows) => {
    if (index === 0) return candle;
    const previous = rows[index - 1];
    const next = rows[index + 1];
    const reference = previous.close;
    // Only the recent volatility window is used by getSingleTickMoveLimit.
    // Slicing the entire history for every candle made this pass O(n²) and
    // blocked the chart thread on multi-day intraday histories.
    const recentHistory = rows.slice(Math.max(0, index - 20), index);
    const moveLimit = getSingleTickMoveLimit(recentHistory, symbol, reference);
    const nextConfirmsReference = Boolean(
      next && Math.abs(next.close - reference) <= moveLimit,
    );
    let open = candle.open;
    let close = candle.close;

    if (
      Math.abs(open - reference) > moveLimit
      && (Math.abs(close - reference) <= moveLimit || nextConfirmsReference)
    ) open = reference;
    if (
      Math.abs(close - reference) > moveLimit
      && nextConfirmsReference
    ) close = Math.abs(next.open - reference) <= moveLimit ? next.open : reference;

    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const bodyNearReference =
      Math.abs(open - reference) <= moveLimit
      || Math.abs(close - reference) <= moveLimit;
    const repairIsConfirmed = nextConfirmsReference && bodyNearReference;
    const high = repairIsConfirmed
      ? Math.min(candle.high, bodyHigh + moveLimit)
      : Math.max(candle.high, bodyHigh);
    const low = repairIsConfirmed
      ? Math.max(candle.low, bodyLow - moveLimit)
      : Math.min(candle.low, bodyLow);

    return {
      ...candle,
      open,
      close,
      high: Math.max(high, bodyHigh),
      low: Math.min(low, bodyLow),
    };
  });
}

function mergeLiveMidIntoCandles(
  candles: Candle[],
  mid: number,
  symbol: string,
  timeframe: string,
  tickTimestamp = Date.now(),
  flow?: {
    isTrade?: boolean;
    size?: number;
    trades?: number;
    delta?: number;
  },
) {
  const executedSize = flow?.isTrade ? Math.max(0, Number(flow.size ?? 0)) : 0;
  const executedTrades = flow?.isTrade ? Math.max(1, Number(flow.trades ?? 1)) : 0;
  const executedDelta = flow?.isTrade ? Number(flow.delta ?? 0) : 0;
  const executedAsk = executedDelta > 0 ? executedSize : 0;
  const executedBid = executedDelta < 0 ? executedSize : 0;
  if (!isPositiveFinite(mid)) return candles;
  if (candles.length === 0) {
    return [{
      timestamp: getTimeframeBucketStart(tickTimestamp, timeframe),
      open: mid,
      high: mid,
      low: mid,
      close: mid,
      volume: executedSize,
      trades: executedTrades,
      delta: executedDelta,
      deltaOpen: 0,
      deltaHigh: Math.max(0, executedDelta),
      deltaLow: Math.min(0, executedDelta),
      deltaClose: executedDelta,
      askVolume: executedAsk,
      bidVolume: executedBid,
    }];
  }

  const updated = [...candles];
  const lastIndex = updated.length - 1;
  const referencePrice = lastIndex > 0 ? updated[lastIndex - 1].close : undefined;
  const repairedLast = sanitizeCandle(updated[lastIndex], symbol, referencePrice);
  if (!repairedLast) return candles;

  const lastBucketStart = getTimeframeBucketStart(repairedLast.timestamp, timeframe);
  const liveBucketStart = getTimeframeBucketStart(tickTimestamp, timeframe);

  if (liveBucketStart > lastBucketStart) {
    const nextCandle = sanitizeCandle(
      {
        timestamp: liveBucketStart,
        open: mid,
        high: mid,
        low: mid,
        close: mid,
        volume: executedSize,
        trades: executedTrades,
        delta: executedDelta,
        deltaOpen: 0,
        deltaHigh: Math.max(0, executedDelta),
        deltaLow: Math.min(0, executedDelta),
        deltaClose: executedDelta,
        askVolume: executedAsk,
        bidVolume: executedBid,
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
    const timeframeMs = getTimeframeMs(timeframe);
    if (lastBucketStart - liveBucketStart > timeframeMs) return updated;

    // Some cached/provider OHLC tails can label the forming higher-timeframe
    // bar with its closing boundary. In that case a valid live tick appears to
    // belong to the previous bucket and was silently ignored, leaving the 1H
    // (and larger) price label frozen. Drop only that single ahead-of-clock
    // tail and rebuild the active bucket from the real tick.
    const currentAndPast = updated.filter((candle) =>
      getTimeframeBucketStart(candle.timestamp, timeframe) <= liveBucketStart);
    if (!currentAndPast.length || currentAndPast.length === updated.length) {
      return updated;
    }
    return mergeLiveMidIntoCandles(
      currentAndPast,
      mid,
      symbol,
      timeframe,
      tickTimestamp,
      flow,
    );
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

  const previousDeltaClose = Number(
    repairedLast.deltaClose ?? repairedLast.delta ?? 0,
  );
  const nextDeltaClose = previousDeltaClose + executedDelta;
  updated[lastIndex] = {
    ...repairedLast,
    close: mid,
    high: cappedHigh,
    low: cappedLow,
    volume: Math.max(0, Number(repairedLast.volume ?? 0)) + executedSize,
    trades: Math.max(0, Number(repairedLast.trades ?? 0)) + executedTrades,
    delta: Number(repairedLast.delta ?? 0) + executedDelta,
    deltaOpen: Number(repairedLast.deltaOpen ?? 0),
    deltaHigh: Math.max(
      Number(repairedLast.deltaHigh ?? previousDeltaClose),
      nextDeltaClose,
    ),
    deltaLow: Math.min(
      Number(repairedLast.deltaLow ?? previousDeltaClose),
      nextDeltaClose,
    ),
    deltaClose: nextDeltaClose,
    askVolume: Math.max(0, Number(repairedLast.askVolume ?? 0)) + executedAsk,
    bidVolume: Math.max(0, Number(repairedLast.bidVolume ?? 0)) + executedBid,
  };

  return updated;
}

function hasFiveDayHistory(candles: Candle[], timeframe: string) {
  return hasMinimumChartHistory(candles, timeframe);
}

function hasUsableOrderFlowHistory(candles: Candle[]) {
  const verified = candles.filter((candle) =>
    Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0);
  // A five-day 1m chart should carry a meaningful run of flow candles, while
  // a 4h/daily chart may legitimately contain only a handful. Scale the
  // requirement to the chart rather than forcing every interval to have 60
  // populated bars (which made higher timeframes re-download forever).
  const minimumVerified = Math.min(60, Math.max(2, Math.floor(candles.length * 0.05)));
  if (verified.length < minimumVerified) return false;
  const first = verified[0]?.timestamp ?? 0;
  const last = verified.at(-1)?.timestamp ?? 0;
  return last > first;
}

function hasRenderableOrderFlow(candles: Candle[]) {
  return candles.some((candle) =>
    Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0);
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

const workspaceCandleRequests = new Map<string, Promise<Candle[]>>();
const workspaceLiveSeamRequests = new Map<string, Promise<Candle[]>>();
const workspaceExecutionTape = new Map<string, InstitutionalTrade[]>();
const workspaceOrderFlowRequests = new Map<string, Promise<InstitutionalOrderFlowResult | null>>();

function workspaceOrderFlowKey(symbol: string, timeframe: string) {
  return `${symbol}::${timeframe}::flow`;
}

function fetchWorkspaceLiveSeam(
  symbol: string,
  timeframe: string,
  contractSymbol: string,
) {
  if (isEventBasedChartInterval(timeframe)) return Promise.resolve([] as Candle[]);
  const key = `${symbol}::${contractSymbol}::${timeframe}`;
  const pending = workspaceLiveSeamRequests.get(key);
  if (pending) return pending;
  const now = Date.now();
  const recentFlowRequest = Promise.race([
    fetchInstitutionalOrderFlowLevels({
      symbol: displayCmeSymbol(symbol),
      contractSymbol,
      timeframe,
      fromMs: now - 2 * 60 * 60_000,
      toMs: now,
      includeTrades: false,
      timeoutMs: 12_000,
    }),
    // The execution archive is extra seam insurance, not permission to hold
    // a usable snapshot behind a slow optional endpoint.
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1_500)),
  ]);
  const request = Promise.all([
    fetchInstitutionalSnapshot({
      symbol: displayCmeSymbol(symbol),
      contractSymbol,
      timeframe,
      // This is only the history/live seam. The normal CME request still owns
      // the five-session backfill, while the live gateway supplies the recent
      // bars that a delayed historical edge cannot contain yet.
      lookbackBars: 480,
      timeoutMs: 12_000,
    }),
    // A collector snapshot can begin at the moment its current process was
    // started. The short execution archive is independent of that chart
    // snapshot and closes the exact few-minute hole left after a restart.
    recentFlowRequest,
  ]).then(([snapshot, recentFlow]) => sanitizeCandles(
    mergeChartHistory(snapshot?.candles ?? [], recentFlow?.candles ?? []),
    symbol,
  ))
    .catch(() => [] as Candle[])
    .finally(() => {
      if (workspaceLiveSeamRequests.get(key) === request) {
        workspaceLiveSeamRequests.delete(key);
      }
    });
  workspaceLiveSeamRequests.set(key, request);
  return request;
}

function compactIndicatorExecutionHistory(records: InstitutionalTrade[]) {
  if (records.length <= 50_000) return records;
  const ordered = [...records].sort((left, right) =>
    left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
  const recentCutoff = (ordered.at(-1)?.timestamp ?? Date.now()) - 15 * 60_000;
  const strongestByMinute = new Map<number, InstitutionalTrade[]>();
  const recent: InstitutionalTrade[] = [];
  ordered.forEach((record) => {
    if (record.timestamp >= recentCutoff) {
      recent.push(record);
      return;
    }
    const minute = Math.floor(record.timestamp / 60_000) * 60_000;
    const bucket = strongestByMinute.get(minute) ?? [];
    bucket.push(record);
    bucket.sort((left, right) => right.volume - left.volume || left.timestamp - right.timestamp);
    if (bucket.length > 12) bucket.length = 12;
    strongestByMinute.set(minute, bucket);
  });
  return [
    ...[...strongestByMinute.values()].flat(),
    ...recent.slice(-25_000),
  ]
    .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex)
    .slice(-50_000);
}

function fetchWorkspaceOrderFlow(
  symbol: string,
  timeframe: string,
  contractSymbol: string,
) {
  const key = `${symbol}::${contractSymbol}::${timeframe}`;
  const pending = workspaceOrderFlowRequests.get(key);
  if (pending) return pending;
  // Anchor to the CME session open, not a rolling 6-hour window. A rolling
  // window leaves the earlier part of the session with no executions, so the
  // volume profile carries real delta only for the recent hours and a
  // delta-free block before it. That appears as a profile whose delta bars
  // simply stop partway up. Two sessions of headroom keeps the
  // weekly profile and an overnight chart covered.
  const now = Date.now();
  const sessionStartMs = cmeSessionStartMs(now);
  const fromMs = sessionStartMs !== null
    ? Math.min(sessionStartMs, now - 6 * 60 * 60_000) - 24 * 60 * 60_000
    : now - 30 * 60 * 60_000;
  const request = fetchInstitutionalOrderFlowLevels({
    symbol: displayCmeSymbol(symbol),
    contractSymbol,
    timeframe,
    fromMs,
    toMs: now,
    includeTrades: true,
    // A full session of executions is a much larger payload than six hours;
    // 25s was tuned for the smaller window and would abort the backfill.
    timeoutMs: 120_000,
  }).finally(() => {
    if (workspaceOrderFlowRequests.get(key) === request) {
      workspaceOrderFlowRequests.delete(key);
    }
  });
  workspaceOrderFlowRequests.set(key, request);
  return request;
}

function applyAvailableOrderFlowHistory(
  candles: Candle[],
  timeframe: string,
  flowCandles: Candle[],
  executionTape: InstitutionalTrade[],
) {
  if (!candles.length) return candles;
  return isEventBasedChartInterval(timeframe)
    ? executionTape.length
      ? enrichCandlesWithInstitutionalTrades(candles, executionTape, candles.length)
      : candles
    : flowCandles.length
      ? enrichCandlesWithInstitutionalCandleFlow(candles, flowCandles)
      : candles;
}

function normalizeExecutionTimestamp(value: unknown) {
  let timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return Number.NaN;
  if (timestamp > 100_000_000_000_000_000) timestamp /= 1_000_000;
  else if (timestamp > 100_000_000_000_000) timestamp /= 1_000;
  else if (timestamp > 0 && timestamp < 100_000_000_000) timestamp *= 1_000;
  return Math.round(timestamp);
}

function decodeExecutionTape(value: unknown): InstitutionalTrade[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!Array.isArray(entry) || entry.length < 4) return [];
    const timestamp = normalizeExecutionTimestamp(entry[0]);
    const price = Number(entry[1]);
    const volume = Number(entry[2]);
    const delta = Number(entry[3]);
    const flowOnly = entry[7] === "flow";
    const askVolume = flowOnly ? Number(entry[4]) : delta > 0 ? volume : 0;
    const bidVolume = flowOnly ? Number(entry[5]) : delta < 0 ? volume : 0;
    const trades = flowOnly ? Number(entry[6]) : 1;
    if (
      !Number.isFinite(timestamp)
      || !Number.isFinite(price)
      || !Number.isFinite(volume)
      || !Number.isFinite(delta)
      || timestamp <= 0
      || price <= 0
      || volume <= 0
      || !Number.isFinite(askVolume)
      || !Number.isFinite(bidVolume)
      || askVolume + bidVolume <= 0
    ) return [];
    return [{
      eventId: `cme-${timestamp}-${index}`,
      recordIndex: timestamp * 10 + (index % 10),
      timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      trades: Math.max(1, trades),
      volume: askVolume + bidVolume,
      bidVolume,
      askVolume,
      delta,
      aggressor: delta > 0
        ? "BUY" as const
        : delta < 0
          ? "SELL" as const
          : "UNKNOWN" as const,
      sideSemanticsVersion: 2,
      flowOnly,
    }];
  }).sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
}

function mergeInstitutionalTradeTape(
  current: InstitutionalTrade[],
  incoming: InstitutionalTrade[],
) {
  if (!incoming.length) return current;
  // Exact Rithmic executions supersede a Databento one-second flow bucket
  // covering the same instant. Keeping both would double-count live CVD at
  // the historical/live seam.
  const exactSecondBuckets = new Set(
    incoming
      .filter((record) => !record.flowOnly)
      .map((record) => Math.floor(record.timestamp / 1_000)),
  );
  const baseCurrent = exactSecondBuckets.size
    ? current.filter((record) => !(
        record.flowOnly
        && exactSecondBuckets.has(Math.floor(record.timestamp / 1_000))
      ))
    : current;
  const recordKey = (record: InstitutionalTrade) => record.eventId
    || `${record.timestamp}:${record.recordIndex}:${record.close}:${record.volume}`;
  const boundTape = (records: InstitutionalTrade[]) => {
    // Historical one-second flow and exact execution prints serve different
    // studies. A single tail slice let an old 50k print cache evict every CVD
    // bucket that had just arrived. Reserve capacity for both instead.
    const flow = records.filter((record) => record.flowOnly).slice(-30_000);
    const exact = records.filter((record) => !record.flowOnly).slice(-25_000);
    return [...flow, ...exact].sort((left, right) =>
      left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
  };
  const recentKeys = new Set(
    baseCurrent
      .slice(-Math.max(512, incoming.length * 4))
      .map(recordKey),
  );
  const additions = incoming.filter((record) => !recentKeys.has(recordKey(record)));
  if (!additions.length) return baseCurrent;
  const currentTail = baseCurrent.at(-1);
  const additionsAreOrdered = additions.every((record, index) => (
    index === 0
      ? !currentTail
        || record.timestamp > currentTail.timestamp
        || (record.timestamp === currentTail.timestamp && record.recordIndex >= currentTail.recordIndex)
      : record.timestamp > additions[index - 1].timestamp
        || (record.timestamp === additions[index - 1].timestamp
          && record.recordIndex >= additions[index - 1].recordIndex)
  ));
  if (additionsAreOrdered) {
    return boundTape(baseCurrent.concat(additions));
  }

  const records = new Map<string, InstitutionalTrade>();
  for (const record of [...baseCurrent, ...additions]) {
    records.set(recordKey(record), record);
  }
  return boundTape([...records.values()]);
}

async function fetchWorkspaceCandles(
  symbol: string,
  timeframe: string,
  broker: string,
  period: string,
  outputsize = 500,
  includeOrderFlow = false,
  signal?: AbortSignal,
  forceFresh = false,
) {
  const periodConfig = getPeriodConfig(period);
  const usingCTraderFeed = FALLBACK_CTRADER_BROKER_NAMES.includes(broker as (typeof FALLBACK_CTRADER_BROKER_NAMES)[number]);
  const oandaInstrument = OANDA_INSTRUMENT_MAP[symbol];
  const oandaGranularity = OANDA_GRANULARITY_MAP[timeframe] || "M5";
  const from = Date.parse(periodConfig.from);
  const to = Date.now();
  const historicalLimit = getHistoricalCandleLimit(period, timeframe, outputsize);

  if (broker === "Databento") {
    const requestKey = `${symbol}::${timeframe}::${includeOrderFlow ? "flow" : "bars"}${forceFresh ? "::fresh" : ""}`;
    const pending = workspaceCandleRequests.get(requestKey);
    if (pending) return pending;

    const request = (async () => {
      const eventBased = isEventBasedChartInterval(timeframe);
      const contractSymbol = currentCmeContract(symbol);
      const orderFlowRequest = includeOrderFlow && contractSymbol
        ? fetchWorkspaceOrderFlow(symbol, timeframe, contractSymbol)
        : Promise.resolve(null);
      const response = await fetch(
        `/api/cme-history?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&days=${DEFAULT_CHART_HISTORY_CALENDAR_DAYS}${includeOrderFlow ? "&orderFlow=1" : ""}${forceFresh ? `&fresh=1&t=${Date.now()}` : ""}`,
        {
          cache: "no-store",
          // Keep a history request alive across rapid timeframe switches. Its
          // result still warms the browser cache for the next selection.
          signal: AbortSignal.timeout(isEventBasedChartInterval(timeframe) ? 285_000 : 45_000),
        },
      );
      const [payload, institutionalOrderFlow] = await Promise.all([
        response.json(),
        orderFlowRequest,
      ]);
      if (!response.ok) throw new Error(payload.error ?? `CME did not return candles for ${displayCmeSymbol(symbol)}.`);
      const providerCandles = sanitizeCandles((payload.candles ?? []) as Candle[], symbol);
      // The history provider owns event-bar geometry. A gateway candle is a
      // clock bucket and must never replace range, volume, trade, delta or
      // Renko bars: doing so collapsed a five-day 40R chart to one 1-minute
      // candle. CVD then received a single point, which is invisible in line
      // mode. Keep the real event bars and apply executions to them below.
      const rawDownloaded = providerCandles;
      const providerExecutionTape = includeOrderFlow
        ? decodeExecutionTape(payload.executions)
        : [];
      const privateExecutionTape = institutionalOrderFlow
        ? institutionalOrderFlow.records.length
          ? institutionalOrderFlow.records
          : institutionalOrderFlow.trades
        : [];
      const executionTape = mergeInstitutionalTradeTape(
        providerExecutionTape,
        compactIndicatorExecutionHistory(privateExecutionTape),
      );
      if (includeOrderFlow) {
        workspaceExecutionTape.set(
          workspaceOrderFlowKey(symbol, timeframe),
          executionTape,
        );
      }
      const downloaded = includeOrderFlow && eventBased && executionTape.length
        ? enrichCandlesWithInstitutionalTrades(rawDownloaded, executionTape, rawDownloaded.length)
        : rawDownloaded;
      await Promise.all([
        downloaded.length
          ? writeChartHistoryCache(symbol, timeframe, downloaded)
          : Promise.resolve(null),
        executionTape.length
          ? writeExecutionTapeCache(symbol, timeframe, executionTape)
          : Promise.resolve(null),
      ]);
      return downloaded;
    })();

    workspaceCandleRequests.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (workspaceCandleRequests.get(requestKey) === request) {
        workspaceCandleRequests.delete(requestKey);
      }
    }
  }

  if (broker === "Market Index") {
    const response = await fetch(
      `/api/market-indices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&from=${from}&to=${to}`,
      { cache: "no-store", signal },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `${symbol} index history is unavailable.`);
    return sanitizeCandles((payload.candles ?? []) as Candle[], symbol);
  }

  try {
    const storedUrl = `/api/market-data/history?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&from=${from}&to=${to}&limit=${historicalLimit}`;
    const storedRes = await fetch(storedUrl, { cache: "no-store", signal });
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
        { signal },
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
      const res = await fetch(url, { signal });
      const data = await res.json();
      if (data.candles && data.candles.length > 0) return sanitizeCandles(data.candles as Candle[], symbol);
    } catch {
      // fall through
    }
  }

  const res = await fetch(
    `/api/market-data?symbol=${symbol}&interval=${timeframe}&outputsize=${historicalLimit}`,
    { signal },
  );
  const data = await res.json();
  return sanitizeCandles((data.candles || []) as Candle[], symbol);
}

async function warmDatabentoChartHistory(symbol: string, timeframe: string) {
  if (isEventBasedChartInterval(timeframe)) return;
  const cached = await readChartHistoryCache(symbol, timeframe);
  if (
    cached?.candles.length
    && Date.now() - cached.updatedAt <= 5 * 60_000
    && hasFiveDayHistory(cached.candles, timeframe)
  ) {
    return;
  }
  await fetchWorkspaceCandles(
    symbol,
    timeframe,
    "Databento",
    "5D",
    500,
    false,
  );
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

type GammaChartOverlay = {
  instrument: string;
  levels: ChartLevel[];
  calibration: ChartGammaCalibration;
  label: string;
  regime: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  checkedAt: string;
  sourceLabel: string;
  stale: boolean;
};

type GammaPayloadCacheEntry = {
  expiresAt: number;
  promise: Promise<ChartGammaLevelsPayload>;
  payload?: ChartGammaLevelsPayload;
};

function isGammaRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteGammaNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRenderableGammaStrike(value: unknown) {
  return isGammaRecord(value)
    && isFiniteGammaNumber(value.sourceStrike)
    && value.sourceStrike > 0
    && isFiniteGammaNumber(value.futuresEquivalent)
    && value.futuresEquivalent > 0
    && isFiniteGammaNumber(value.call)
    && isFiniteGammaNumber(value.put)
    && isFiniteGammaNumber(value.net);
}

function isRenderableGammaPositioning(value: unknown) {
  if (!isGammaRecord(value)) return false;
  if (typeof value.sourceSymbol !== "string" || typeof value.futuresRoot !== "string") return false;
  if (typeof value.asOf !== "string" || typeof value.status !== "string") return false;
  if (!isFiniteGammaNumber(value.sourcePrice) || value.sourcePrice <= 0) return false;
  if (!isFiniteGammaNumber(value.futuresPrice) || value.futuresPrice <= 0) return false;
  if (!isFiniteGammaNumber(value.priceScale) || value.priceScale <= 0) return false;
  if (!isGammaRecord(value.totals)
    || !isFiniteGammaNumber(value.totals.call)
    || !isFiniteGammaNumber(value.totals.put)
    || !isFiniteGammaNumber(value.totals.net)
    || !isFiniteGammaNumber(value.totals.gross)) return false;
  if (!Array.isArray(value.strikes) || !value.strikes.every(isRenderableGammaStrike)) return false;
  return Array.isArray(value.lookbacks) && value.lookbacks.every((lookback) => (
    isGammaRecord(lookback)
    && isFiniteGammaNumber(lookback.minutes)
    && Array.isArray(lookback.strikes)
    && lookback.strikes.every(isRenderableGammaStrike)
  ));
}

function isRenderableGammaPayload(value: unknown): value is ChartGammaLevelsPayload {
  if (!isGammaRecord(value)) return false;
  if ((value.root !== "NQ" && value.root !== "ES") || typeof value.requestedSource !== "string") return false;
  if (typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt))) return false;
  if (typeof value.sessionDate !== "string" || typeof value.revision !== "string") return false;
  if (!isFiniteGammaNumber(value.refreshAfterMs) || typeof value.marketOpen !== "boolean") return false;
  if (!isGammaRecord(value.environment) || typeof value.environment.gammaStateLabel !== "string") return false;
  if (!Array.isArray(value.sources) || !value.sources.length) return false;
  const sourcesAreSafe = value.sources.every((source) => (
    isGammaRecord(source)
    && typeof source.symbol === "string"
    && isFiniteGammaNumber(source.stockPrice)
    && source.stockPrice > 0
    && typeof source.revision === "string"
    && Array.isArray(source.validationStrikes)
    && source.validationStrikes.every((strike) => isFiniteGammaNumber(strike) && strike > 0)
    && Array.isArray(source.levels)
    && source.levels.every((level) => (
      isGammaRecord(level)
      && typeof level.id === "string"
      && typeof level.kind === "string"
      && typeof level.label === "string"
      && isFiniteGammaNumber(level.price)
      && level.price > 0
    ))
  ));
  if (!sourcesAreSafe) return false;
  return value.positioning === undefined || isRenderableGammaPositioning(value.positioning);
}

type CompletedValueAreaProfile = ValueAreaProfile & {
  start: string;
  end: string;
  label: string;
};

type ValueAreaPayload = {
  symbol: string;
  source: "CME";
  dataset: "GLBX.MDP3";
  method: "TRADE_BY_TRADE";
  valueAreaTarget: number;
  generatedAt: string;
  nextRefreshAt: string;
  daily: CompletedValueAreaProfile;
  weekly: CompletedValueAreaProfile;
};

type ValueAreaChartOverlay = {
  instrument: string;
  levels: ChartLevel[];
  currentLabel: string | null;
  dailyLabel: string;
  weeklyLabel: string;
  generatedAt: string;
  nextRefreshAt: string;
  // Set when a refresh fails while last-good levels stay on the chart. The
  // painter must render them visibly stale, never fresh-looking.
  stale?: boolean;
};

type ValueAreaPayloadCacheEntry = {
  expiresAt: number;
  promise: Promise<ValueAreaPayload>;
  payload?: ValueAreaPayload;
};

type GameplanChartDecorations = {
  levels: ChartLevel[];
  zones: ChartZone[];
};

function parseHexColor(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function mixChartColor(base: string, accent: string, accentWeight: number) {
  const baseRgb = parseHexColor(base);
  const accentRgb = parseHexColor(accent);
  if (!baseRgb || !accentRgb) return accent;
  const weight = Math.max(0, Math.min(1, accentWeight));
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
  return `#${toHex(baseRgb.r * (1 - weight) + accentRgb.r * weight)}${toHex(baseRgb.g * (1 - weight) + accentRgb.g * weight)}${toHex(baseRgb.b * (1 - weight) + accentRgb.b * weight)}`;
}

function colorWithAlpha(color: string, alpha: number) {
  const rgb = parseHexColor(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function levelAsOfLabel(asOf: string | number | null | undefined) {
  const ms = typeof asOf === "number" ? asOf : asOf ? Date.parse(asOf) : Number.NaN;
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

// Failure never gets to keep painting fresh-looking lines. When a feed dies,
// its last-good levels stay visible only washed out and tagged STALE with the
// as-of time of the data they were built from.
function markLevelsStale(levels: ChartLevel[], asOf: string | number | null | undefined): ChartLevel[] {
  const asOfLabel = levelAsOfLabel(asOf);
  return levels.map((level) => ({
    ...level,
    color: colorWithAlpha(level.color, 0.42),
    label: `${level.label} · STALE${asOfLabel ? ` ${asOfLabel}` : ""}`,
  }));
}

function formatGameplanZone(low: number, high: number) {
  const format = (value: number) => value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return low === high ? format(low) : `${format(low)}–${format(high)}`;
}

function buildGameplanChartDecorations(
  overlay: GameplanChartOverlay | null,
  settings: ChartSettings,
): GameplanChartDecorations {
  if (!overlay) return { levels: [], zones: [] };
  const colors = {
    magnet: settings.upColor,
    wall: settings.downColor,
    accelerant: mixChartColor(settings.upColor, "#F59E0B", 0.62),
    decision: mixChartColor(settings.upColor, "#38BDF8", 0.62),
  } satisfies Record<GameplanChartOverlay["levels"][number]["role"], string>;

  return {
    levels: overlay.levels.map((level): ChartLevel => {
      const color = colors[level.role];
      return {
        id: `gameplan-line-${level.id}`,
        price: (level.zone[0] + level.zone[1]) / 2,
        color,
        label: `${level.name} · ${level.role.toUpperCase()}`,
        lineStyle: level.role === "decision" ? "solid" : level.role === "accelerant" ? "dotted" : "dashed",
        lineWidth: level.strength >= 4 || level.role === "decision" ? 2 : 1,
        axisLabelVisible: true,
      };
    }),
    zones: overlay.levels.map((level): ChartZone => {
      const color = colors[level.role];
      return {
        id: `gameplan-zone-${level.id}`,
        low: level.zone[0],
        high: level.zone[1],
        color,
        fillColor: colorWithAlpha(color, level.role === "decision" ? 0.14 : 0.09),
        label: `${level.name} · ${formatGameplanZone(level.zone[0], level.zone[1])}`,
      };
    }),
  };
}

const valueAreaPayloadCache = new Map<string, ValueAreaPayloadCacheEntry>();
const VALUE_AREA_SESSION_CACHE_PREFIX = "kwantdesk:value-area:last-good:v2:";

function valueAreaPayloadIsCurrent(payload: Pick<ValueAreaPayload, "nextRefreshAt">, now = Date.now()) {
  const refreshAt = Date.parse(payload.nextRefreshAt);
  return Number.isFinite(refreshAt) && refreshAt > now;
}

function readValueAreaSessionPayload(cacheKey: string) {
  if (typeof window === "undefined") return null;
  const storageKey = `${VALUE_AREA_SESSION_CACHE_PREFIX}${cacheKey}`;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const payload = JSON.parse(raw) as ValueAreaPayload;
    const valid = payload.symbol.toUpperCase() === cacheKey
      && payload.method === "TRADE_BY_TRADE"
      && validValueAreaProfile(payload.daily)
      && validValueAreaProfile(payload.weekly)
      && valueAreaPayloadIsCurrent(payload);
    if (!valid) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return payload;
  } catch {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {}
    return null;
  }
}

function fetchValueAreaPayload(symbol: string) {
  const cacheKey = symbol.toUpperCase();
  const now = Date.now();
  const restored = valueAreaPayloadCache.has(cacheKey)
    ? null
    : readValueAreaSessionPayload(cacheKey);
  if (restored) {
    const refreshAt = Date.parse(restored.nextRefreshAt);
    valueAreaPayloadCache.set(cacheKey, {
      expiresAt: Number.isFinite(refreshAt) && refreshAt > now
        ? refreshAt
        : now + 5_000,
      promise: Promise.resolve(restored),
      payload: restored,
    });
  }

  let cached = valueAreaPayloadCache.get(cacheKey);
  // Do not keep an expired prior-session payload around while a new profile is
  // being built. This was most visible on the Sunday/Monday reopen: a Thursday
  // profile restored from Friday morning could stay painted while Friday's
  // authoritative profile streamed in.
  if (cached?.payload && !valueAreaPayloadIsCurrent(cached.payload, now)) {
    valueAreaPayloadCache.delete(cacheKey);
    cached = undefined;
  }
  if (cached && cached.expiresAt > now) return cached.promise;

  const previous = cached;
  const controller = new AbortController();
  // A cold value-area build streams the whole prior-week tick tape and takes
  // 15-120s (measured NQ/ES). Aborting at 20s guaranteed the daily post-roll
  // rebuild always looked like "failing to fetch" even though the server was
  // mid-build. The retry loop still polls every 15-30s, so a generous ceiling
  // costs nothing when the cache is warm (those answers arrive in <100ms).
  const timeout = window.setTimeout(() => controller.abort(), 150_000);
  const promise = fetch(
    `/api/databento/value-area?symbol=${encodeURIComponent(symbol)}`,
    { cache: "no-store", signal: controller.signal },
  )
    .then(async (response) => {
      const raw = await response.text();
      let payload: ValueAreaPayload & { error?: string };
      try {
        payload = JSON.parse(raw) as ValueAreaPayload & { error?: string };
      } catch {
        throw new Error("CME value-area service returned an invalid response.");
      }
      if (!response.ok) throw new Error(payload.error || "CME value-area levels are unavailable.");
      const refreshAt = Date.parse(payload.nextRefreshAt);
      const current = valueAreaPayloadCache.get(cacheKey);
      if (current?.promise === promise) {
        current.expiresAt = Number.isFinite(refreshAt)
          ? Math.max(Date.now() + 30_000, refreshAt)
          : Date.now() + 60 * 60_000;
        current.payload = payload;
      }
      try {
        window.sessionStorage.setItem(
          `${VALUE_AREA_SESSION_CACHE_PREFIX}${cacheKey}`,
          JSON.stringify(payload),
        );
      } catch {}
      return payload;
    })
    .catch((error) => {
      if (valueAreaPayloadCache.get(cacheKey)?.promise === promise) {
        if (previous?.payload) {
          valueAreaPayloadCache.set(cacheKey, {
            ...previous,
            expiresAt: Date.now() + 30_000,
          });
        } else {
          valueAreaPayloadCache.delete(cacheKey);
        }
      }
      throw error instanceof Error && error.name === "AbortError"
        ? new Error("CME value-area calculation is still preparing.")
        : error;
    })
    .finally(() => window.clearTimeout(timeout));

  valueAreaPayloadCache.set(cacheKey, {
    expiresAt: Date.now() + 30_000,
    promise,
    payload: previous?.payload,
  });
  return promise;
}

function validValueAreaProfile(profile: CompletedValueAreaProfile) {
  return [
    profile.vah,
    profile.val,
    profile.poc,
    profile.vwap,
    profile.totalVolume,
    profile.tradeRecords,
  ].every((value) => Number.isFinite(value))
    && profile.val <= profile.poc
    && profile.poc <= profile.vah
    && profile.totalVolume > 0
    && profile.tradeRecords > 0;
}

function validDevelopingValueAreaProfile(
  profile: InstitutionalVolumeProfile | null,
): profile is InstitutionalVolumeProfile & {
  vah: number;
  val: number;
  poc: number;
  vwap: number;
} {
  return Boolean(profile)
    && [profile?.vah, profile?.val, profile?.poc, profile?.vwap, profile?.totalVolume, profile?.trades]
      .every((value) => Number.isFinite(value))
    && Number(profile?.val) <= Number(profile?.poc)
    && Number(profile?.poc) <= Number(profile?.vah)
    && Number(profile?.totalVolume) > 0
    && Number(profile?.trades) > 0;
}

function buildValueAreaChartOverlay(
  payload: ValueAreaPayload,
  instrument: string,
  settings: ChartSettings,
  developing: InstitutionalVolumeProfile | null = null,
): ValueAreaChartOverlay | null {
  if (
    payload.symbol.toUpperCase() !== instrument.toUpperCase()
    || payload.method !== "TRADE_BY_TRADE"
    || !validValueAreaProfile(payload.daily)
    || !validValueAreaProfile(payload.weekly)
  ) {
    return null;
  }

  const dailyColor = mixChartColor(settings.upColor, "#38BDF8", 0.56);
  const weeklyColor = mixChartColor(settings.upColor, "#F59E0B", 0.68);
  const currentColor = settings.upColor;
  // Keep the visible chart labels concise. The data-source detail belongs in
  // diagnostics, not beside every fixed value-area level.
  const periodLevels = (
    prefix: "CUR" | "PD" | "PW",
    profile: Pick<CompletedValueAreaProfile, "vah" | "val" | "poc" | "vwap" | "end">,
    color: string,
    current = false,
  ): ChartLevel[] => [
    {
      id: `${prefix.toLowerCase()}-vah-${profile.end}`,
      price: profile.vah,
      color,
      label: current ? "VAH" : `${prefix} VAH`,
      lineStyle: "dashed",
      lineWidth: current ? 2 : 1,
      axisLabelVisible: true,
    },
    {
      id: `${prefix.toLowerCase()}-val-${profile.end}`,
      price: profile.val,
      color,
      label: current ? "VAL" : `${prefix} VAL`,
      lineStyle: "dashed",
      lineWidth: current ? 2 : 1,
      axisLabelVisible: true,
    },
    {
      id: `${prefix.toLowerCase()}-poc-${profile.end}`,
      price: profile.poc,
      color,
      label: current ? "POC" : `${prefix} POC`,
      lineStyle: "solid",
      lineWidth: 2,
      axisLabelVisible: true,
    },
    {
      id: `${prefix.toLowerCase()}-vwap-${profile.end}`,
      price: profile.vwap,
      color,
      label: current ? "VWAP" : `${prefix} VWAP`,
      lineStyle: "dotted",
      lineWidth: 2,
      axisLabelVisible: true,
    },
  ];

  const currentProfile = validDevelopingValueAreaProfile(developing)
    ? {
        vah: developing.vah,
        val: developing.val,
        poc: developing.poc,
        vwap: developing.vwap,
        end: developing.asOf,
      }
    : null;

  return {
    instrument,
    levels: [
      ...(currentProfile ? periodLevels("CUR", currentProfile, currentColor, true) : []),
      ...periodLevels("PD", payload.daily, dailyColor),
      ...periodLevels("PW", payload.weekly, weeklyColor),
    ],
    currentLabel: currentProfile ? "Current developing session" : null,
    dailyLabel: payload.daily.label,
    weeklyLabel: payload.weekly.label,
    generatedAt: payload.generatedAt,
    nextRefreshAt: payload.nextRefreshAt,
  };
}

const gammaPayloadCache = new Map<string, GammaPayloadCacheEntry>();
const GAMMA_SESSION_CACHE_PREFIX = "kwantdesk:gamma-levels:last-good:v1:";
const GAMMA_SESSION_CACHE_MAX_AGE_MS = 96 * 60 * 60_000;

function gammaPayloadCacheKey(conversion: GammaConversionDefinition, calibrated = false) {
  return `${conversion.futuresRoot}:${conversion.source}${calibrated ? ":calibrated" : ""}`;
}

function readGammaSessionPayload(
  conversion: GammaConversionDefinition,
  calibrated = false,
) {
  if (typeof window === "undefined") return null;
  const cacheKey = gammaPayloadCacheKey(conversion, calibrated);
  const storageKey = `${GAMMA_SESSION_CACHE_PREFIX}${cacheKey}`;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) continue;
      const record = JSON.parse(raw) as { savedAt?: number; payload?: unknown };
      const savedAt = Number(record.savedAt);
      const payload = record.payload;
      const valid = Number.isFinite(savedAt)
        && Date.now() - savedAt <= GAMMA_SESSION_CACHE_MAX_AGE_MS
        && isRenderableGammaPayload(payload)
        && payload.root === conversion.futuresRoot
        && payload.requestedSource === conversion.source;
      if (!valid) {
        storage.removeItem(storageKey);
        continue;
      }
      return payload;
    } catch {
      try { storage.removeItem(storageKey); } catch {}
    }
  }
  return null;
}

function writeGammaSessionPayload(
  conversion: GammaConversionDefinition,
  calibrated: boolean,
  payload: ChartGammaLevelsPayload,
) {
  if (typeof window === "undefined") return;
  const cacheKey = gammaPayloadCacheKey(conversion, calibrated);
  const serialized = JSON.stringify({ savedAt: Date.now(), payload });
  try {
    window.sessionStorage.setItem(`${GAMMA_SESSION_CACHE_PREFIX}${cacheKey}`, serialized);
  } catch {}
  try {
    window.localStorage.setItem(`${GAMMA_SESSION_CACHE_PREFIX}${cacheKey}`, serialized);
  } catch {}
}

function lastVerifiedGammaPayload(conversion: GammaConversionDefinition) {
  const cached = gammaPayloadCache.get(gammaPayloadCacheKey(conversion, true));
  return cached?.payload?.positioning ? cached.payload : null;
}

function gammaRefreshDelay(value: unknown) {
  const delay = Number(value);
  return Number.isFinite(delay) && delay > 0
    ? Math.max(60_000, Math.min(5 * 60_000, delay))
    : 60_000;
}

function fetchGammaPayload(
  conversion: GammaConversionDefinition,
  options: { allowStale?: boolean; calibrated?: boolean; calibrationPrice?: number | null } = {},
) {
  const cacheKey = gammaPayloadCacheKey(conversion, options.calibrated === true);
  const now = Date.now();
  let cached = gammaPayloadCache.get(cacheKey);
  if (!cached) {
    const restored = readGammaSessionPayload(conversion, options.calibrated === true);
    if (restored) {
      cached = {
        // Paint immediately, then revalidate almost at once rather than
        // treating browser storage as an authoritative live feed.
        expiresAt: now + 1_000,
        promise: Promise.resolve(restored),
        payload: restored,
      };
      gammaPayloadCache.set(cacheKey, cached);
    }
  }
  if (options.allowStale && cached?.payload && cached.expiresAt > now) {
    return Promise.resolve(cached.payload);
  }
  if (cached && cached.expiresAt > now) return cached.promise;

  const previous = cached;
  const calibrationPrice = Number(options.calibrationPrice);
  const calibrationQuery = options.calibrated && Number.isFinite(calibrationPrice) && calibrationPrice > 0
    ? `&futuresPrice=${encodeURIComponent(calibrationPrice.toFixed(6))}`
    : "";
  const requestUrl = `/api/chart-gamma-levels?root=${encodeURIComponent(conversion.futuresRoot)}&source=${encodeURIComponent(conversion.source)}${options.calibrated ? "&calibrated=1" : ""}${calibrationQuery}`;
  const requestPayload = async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25_000);
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
      const raw = await response.text();
      let candidate: unknown = null;
      try {
        candidate = JSON.parse(raw);
      } catch {
        candidate = null;
      }
      const errorMessage = isGammaRecord(candidate) && typeof candidate.error === "string"
        ? candidate.error
        : response.ok
          ? "The Gamma service returned an invalid response."
          : `Gamma levels are unavailable (${response.status}).`;
        if (!response.ok) {
          const responseError = new Error(errorMessage) as Error & { status?: number };
          responseError.status = response.status;
          throw responseError;
        }
      if (!isRenderableGammaPayload(candidate)) {
        throw new Error("The latest options frame is still synchronising.");
      }
        return candidate;
      } catch (error) {
        lastError = error;
        const status = Number((error as { status?: number } | null)?.status);
        const retriable = !Number.isFinite(status) || status === 408 || status === 429 || status >= 500;
        if (!retriable || attempt === 2) throw error;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 500 * (2 ** attempt)));
      } finally {
        window.clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Kwant Levels could not refresh.");
  };
  const promise = requestPayload()
    .then((payload) => {
      const current = gammaPayloadCache.get(cacheKey);
      if (current?.promise === promise) {
        current.expiresAt = Date.now() + gammaRefreshDelay(payload.refreshAfterMs);
        current.payload = payload;
      }
      writeGammaSessionPayload(conversion, options.calibrated === true, payload);
      return payload;
    })
    .catch((error) => {
      if (gammaPayloadCache.get(cacheKey)?.promise === promise) {
        if (previous?.payload) {
          gammaPayloadCache.set(cacheKey, {
            ...previous,
            expiresAt: Date.now() + 5_000,
          });
        } else {
          gammaPayloadCache.delete(cacheKey);
        }
      }
      throw error;
    });

  gammaPayloadCache.set(cacheKey, {
    expiresAt: Date.now() + 5_000,
    promise,
    payload: previous?.payload,
  });
  if (options.allowStale && previous?.payload) {
    void promise.catch(() => undefined);
    return Promise.resolve(previous.payload);
  }
  return promise;
}

function gammaLevelColor(kind: string, settings: ChartSettings) {
  if (
    kind === "CALL_WALL"
    || kind === "POSITIVE_GEX"
    || kind === "MAJOR_POSITIVE_OI"
    || kind === "MAJOR_POSITIVE_VOLUME"
  ) return settings.upColor;
  if (kind === "PUT_WALL" || kind === "NEGATIVE_GEX") return settings.downColor;
  if (kind === "GAMMA_CENTRE") return "#06B6D4";
  if (kind === "ZERO_GAMMA") return "#F8FAFC";
  if (kind === "HIGH_VOL_LEVEL") return "#F59E0B";
  if (kind === "EXPECTED_MOVE_MAX" || kind === "EXPECTED_MOVE_MIN") return "#F59E0B";
  return "#8B5CF6";
}

function buildGammaChartOverlay(args: {
  payload: ChartGammaLevelsPayload;
  conversion: GammaConversionDefinition;
  candles: Candle[];
  futuresPrice: number | null;
  futuresAsOfMs: number | null;
  futuresContract: string;
  tickSize: number;
  settings: ChartSettings;
}): GammaChartOverlay | null {
  const { payload, conversion } = args;
  if (payload.root !== conversion.futuresRoot || payload.requestedSource !== conversion.source) return null;
  const source = payload.sources.find((candidate) => candidate.symbol === conversion.source);
  if (!source) return null;

  let calibration = loadChartGammaCalibration(conversion);
  if (isNativeGammaConversion(conversion)) {
    calibration = identityGammaCalibration(
      conversion,
      payload.sessionDate,
      args.futuresContract,
      Date.now(),
    );
  } else {
    const contractRolled = Boolean(
      calibration
      && args.futuresContract
      && calibration.futuresContract !== args.futuresContract,
    );
    if (contractRolled) calibration = null;

    const quoteIsFresh = args.futuresAsOfMs !== null && Date.now() - args.futuresAsOfMs <= 60_000;
    const cashCloseCandle = payload.marketOpen
      ? null
      : findCashCloseFuturesCandle(args.candles, payload.sessionDate);
    const calibrationDue = !calibration
      || calibration.sessionDate !== payload.sessionDate
      || Date.now() - calibration.calibratedAtMs >= 10 * 60_000;
    const calibrationFuturePrice = payload.marketOpen && quoteIsFresh
      ? args.futuresPrice
      : cashCloseCandle?.close ?? null;
    const calibrationFutureAsOfMs = payload.marketOpen && quoteIsFresh
      ? args.futuresAsOfMs
      : cashCloseCandle?.timestamp ?? null;
    const liveFuturesPrice = args.futuresPrice ?? args.candles.at(-1)?.close ?? null;

    if (
      calibrationDue
      && args.futuresContract
      && calibrationFuturePrice !== null
      && calibrationFutureAsOfMs !== null
      && liveFuturesPrice !== null
    ) {
      const candidate = buildChartGammaCalibration({
        conversion,
        futuresContract: args.futuresContract,
        sessionDate: payload.sessionDate,
        futuresPrice: calibrationFuturePrice,
        futuresAsOfMs: calibrationFutureAsOfMs,
        cashPrice: source.stockPrice,
        cashAsOfMs: payload.marketOpen ? Date.parse(payload.checkedAt) : calibrationFutureAsOfMs,
        sourceLevels: source.validationStrikes,
        liveFuturesPrice,
      });
      if (candidate) {
        calibration = candidate;
        saveChartGammaCalibration(candidate);
      }
    }
  }

  if (!calibration) return null;

  const levels = mergeGammaLevelsAtSamePrice(source.levels
    .map((level) => ({
      ...level,
      price: roundedGammaPrice(level.price, calibration.scale, args.tickSize),
    })), args.tickSize)
    .sort((left, right) => {
      const leftPrimary = ["CALL_WALL", "PUT_WALL", "GAMMA_MAGNET", "GAMMA_CENTRE", "HIGH_VOL_LEVEL", "ZERO_GAMMA", "MAJOR_POSITIVE_OI", "MAJOR_POSITIVE_VOLUME"].includes(left.kind) ? 0 : 1;
      const rightPrimary = ["CALL_WALL", "PUT_WALL", "GAMMA_MAGNET", "GAMMA_CENTRE", "HIGH_VOL_LEVEL", "ZERO_GAMMA", "MAJOR_POSITIVE_OI", "MAJOR_POSITIVE_VOLUME"].includes(right.kind) ? 0 : 1;
      return leftPrimary - rightPrimary || left.rank - right.rank;
    })
    .slice(0, 24)
    .map((level): ChartLevel => ({
      id: `gamma-${conversion.id}-${level.id}`,
      price: level.price,
      color: gammaLevelColor(level.kind, args.settings),
      label: level.label,
      kind: level.kind,
      lineStyle: level.kind === "MAJOR_POSITIVE_VOLUME" || /(^| \/ )MPV($| \/ )/.test(level.label)
        ? "solid"
        : level.kind === "POSITIVE_GEX" || level.kind === "NEGATIVE_GEX"
          ? "dotted"
          : "dashed",
      lineWidth: level.kind === "CALL_WALL" || level.kind === "PUT_WALL" || level.kind === "MAJOR_POSITIVE_VOLUME" || /(^| \/ )MPV($| \/ )/.test(level.label) ? 2 : 1,
      axisLabelVisible: true,
    }));

  if (!levels.length) return null;
  return {
    instrument: conversion.target,
    levels,
    calibration,
    label: payload.environment.gammaStateLabel,
    regime: payload.environment.gammaRegime,
    checkedAt: payload.checkedAt,
    sourceLabel: isNativeGammaConversion(conversion)
      ? `Kwant levels · Databento futures options · ${payload.marketOpen ? "LIVE NY OPTIONS" : "STALE"}`
      : `Kwant levels · ${payload.marketOpen ? "LIVE NY OPTIONS" : "STALE"} · ${calibration.scale.toFixed(6)}×`,
    stale: !payload.marketOpen,
  };
}

function isGammaRegimeTransitionLevel(level: ChartLevel) {
  return level.label.startsWith("Zero Gamma ") || level.label.startsWith("HVL ");
}

function mergeNativeGammaTransitions(
  base: GammaChartOverlay,
  native: GammaChartOverlay | null,
): GammaChartOverlay {
  if (!native) return base;
  const transitions = native.levels.filter(isGammaRegimeTransitionLevel);
  if (!transitions.length) return base;
  return {
    ...base,
    levels: [
      ...base.levels.filter((level) => !isGammaRegimeTransitionLevel(level)),
      ...transitions,
    ],
    checkedAt: Date.parse(native.checkedAt) > Date.parse(base.checkedAt)
      ? native.checkedAt
      : base.checkedAt,
    sourceLabel: `${base.sourceLabel} · native Zero Gamma/HVL`,
  };
}

function WorkspaceChartPane({
  pane,
  active,
  embedded = false,
  period,
  settings,
  trades,
  indicators,
  onActivate,
  onOpenSettings,
  onCreateAlertAtPrice,
  onRemoveAllIndicators,
  onUpdateIndicatorSetting,
  onSelectPeriod,
  onSelectTimeframe,
  onDetach,
  detachDisabled,
  onClose,
  closeDisabled,
  chartDragEnabled,
  onChartDragStart,
  gammaLevelsEnabled,
  onToggleGammaLevels,
  kwantLevelsEnabled,
  kwantLevelsAvailable,
  kwantLevelsLoading,
  onToggleKwantLevels,
  historicalStructureEnabled,
  onToggleHistoricalStructure,
  valueAreaLevelsEnabled,
  onToggleValueAreaLevels,
  levelExportRequested,
  onGammaExportSnapshot,
  gameplanOverlay,
  onRemoveGameplanOverlay,
  loadingMessage,
  onInitialSettled,
  paperPositions,
  paperFills,
  onUpdatePaperProtection,
  onClosePaperPosition,
}: {
  pane: WorkspacePane;
  active: boolean;
  embedded?: boolean;
  period: string;
  settings: ChartSettings;
  trades?: (Trade & { markerVisible?: boolean })[];
  indicators: ChartIndicatorInstance[];
  onActivate: () => void;
  onOpenSettings: () => void;
  onCreateAlertAtPrice: (price: string) => void;
  onRemoveAllIndicators: () => void;
  onUpdateIndicatorSetting: (instanceId: string, key: string, value: number | string | boolean) => void;
  onSelectPeriod: (period: string) => void;
  onSelectTimeframe: (timeframe: string) => boolean;
  onDetach?: () => void;
  detachDisabled?: boolean;
  onClose?: () => void;
  closeDisabled?: boolean;
  chartDragEnabled?: boolean;
  onChartDragStart?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  gammaLevelsEnabled: boolean;
  onToggleGammaLevels: () => void;
  kwantLevelsEnabled: boolean;
  kwantLevelsAvailable: boolean;
  kwantLevelsLoading: boolean;
  onToggleKwantLevels: () => void;
  historicalStructureEnabled: boolean;
  onToggleHistoricalStructure: () => void;
  valueAreaLevelsEnabled: boolean;
  onToggleValueAreaLevels: () => void;
  levelExportRequested: boolean;
  onGammaExportSnapshot: (paneId: string, snapshot: GammaLevelExportSnapshot | null) => void;
  gameplanOverlay: GameplanChartOverlay | null;
  onRemoveGameplanOverlay: () => void;
  loadingMessage?: string;
  onInitialSettled?: () => void;
  paperPositions?: PaperPosition[];
  paperFills?: PaperTradeFill[];
  onUpdatePaperProtection?: (
    accountId: string,
    positionId: string,
    update:
      | { kind: "stop_loss"; price: number | null }
      | { kind: "take_profit"; targetId: string; price: number; quantity?: number },
  ) => void;
  onClosePaperPosition?: (position: PaperPosition) => void;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lowerIndicatorHeight, setLowerIndicatorHeight] = useState(0);
  const [marketTrades, setMarketTrades] = useState<InstitutionalTrade[]>([]);
  const [orderFlowHistoryReady, setOrderFlowHistoryReady] = useState(false);
  const [volumeProfiles, setVolumeProfiles] = useState<InstitutionalVolumeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveFeedError, setLiveFeedError] = useState<string | null>(null);
  const [resolvedContractSymbol, setResolvedContractSymbol] = useState<string | null>(() =>
    pane.broker === "Databento" ? currentCmeContract(pane.symbol) : null);
  const [marketIsActive, setMarketIsActive] = useState(false);
  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);
  const [intervalCommandOpen, setIntervalCommandOpen] = useState(false);
  const [intervalCommandDraft, setIntervalCommandDraft] = useState("");
  const [intervalCommandError, setIntervalCommandError] = useState("");
  const [gammaOverlay, setGammaOverlay] = useState<GammaChartOverlay | null>(null);
  const [expectedMoveCalibration, setExpectedMoveCalibration] = useState<ChartGammaCalibration | null>(null);
  const [gammaLevelsLoading, setGammaLevelsLoading] = useState(false);
  const [gammaLevelsError, setGammaLevelsError] = useState<string | null>(null);
  const [classicGexProfile, setClassicGexProfile] = useState<ClassicGexProfilePayload | null>(null);
  const [classicGexHistory, setClassicGexHistory] = useState<ClassicGexHistorySnapshot[]>([]);
  const [classicGexLoading, setClassicGexLoading] = useState(false);
  const [classicGexError, setClassicGexError] = useState<string | null>(null);
  const [valueAreaOverlay, setValueAreaOverlay] = useState<ValueAreaChartOverlay | null>(null);
  const [valueAreaLevelsLoading, setValueAreaLevelsLoading] = useState(false);
  const [valueAreaLevelsError, setValueAreaLevelsError] = useState<string | null>(null);
  const intervalCommandInputRef = useRef<HTMLInputElement>(null);
  const intervalCommandPanelRef = useRef<HTMLDivElement>(null);
  const latestCandlesRef = useRef<Candle[]>([]);
  const latestMarketTradesRef = useRef<InstitutionalTrade[]>([]);
  const latestOrderFlowCandlesRef = useRef<Candle[]>([]);
  const lastCandleStateSyncRef = useRef(0);
  const lastMarketTradeStateSyncRef = useRef(0);
  const classicGexHistoryRef = useRef<ClassicGexHistorySnapshot[]>([]);
  const rithmicConnectedRef = useRef(false);
  const historyHydratedRef = useRef(false);
  const requestTailReconciliationRef = useRef<(() => void) | null>(null);
  const liveInstrumentIdentityRef = useRef(`${pane.broker}:${pane.symbol}`);
  const liveTailStartTimestampRef = useRef<number | null>(null);
  const latestFuturesRef = useRef<{
    price: number | null;
    asOfMs: number | null;
    contractSymbol: string | null;
    tickSize: number;
  }>({
    price: null,
    asOfMs: null,
    contractSymbol: currentCmeContract(pane.symbol),
    tickSize: futuresTickSize(pane.symbol),
  });
  const pendingLiveTicksRef = useRef<QueuedLiveTick[]>([]);
  const liveOutlierCandidateRef = useRef<LiveOutlierCandidate | null>(null);
  const liveFrameRef = useRef<number | null>(null);
  const marketActiveRef = useRef(false);
  const marketInactiveTimerRef = useRef<number | null>(null);
  const gammaInstrument = displayCmeSymbol(pane.symbol);
  const gexBotFlow = useGexBotFlow(
    gammaInstrument === "NQ" || gammaInstrument === "MNQ",
  ).payload;
  const classicGexIndicator = indicators.find((instance) =>
    instance.enabled && instance.indicatorId === "classic-gex-profile") ?? null;
  const expectedMoveIndicator = indicators.find((instance) =>
    instance.enabled && instance.indicatorId === "expected-move") ?? null;
  const classicGexSettings = classicGexIndicator?.settings ?? {};
  const classicGexSettingsSignature = classicGexIndicator
    ? JSON.stringify(classicGexSettings)
    : "";
  const needsOrderFlowHistory = indicators.some((instance) =>
    instance.enabled && CHART_INDICATOR_BY_ID.get(instance.indicatorId)?.requiresOrderFlow);
  const dailyProfileInstance = indicators.find((instance) =>
    instance.enabled
    && [
      "kwant-profile",
      "daily-volume-profile",
      "ask-bid-volume-profile",
      "delta-profile",
    ].includes(instance.indicatorId));
  const weeklyProfileInstance = indicators.find((instance) =>
    instance.enabled && instance.indicatorId === "weekly-volume-profile");
  const dailyProfileSettings = dailyProfileInstance?.settings ?? {};
  const weeklyProfileSettings = weeklyProfileInstance?.settings ?? {};
  const dailyTradingDates = useMemo(() => {
    const dates = new Set<string>();
    candles.forEach((candle) => dates.add(chicagoTradingDate(candle.timestamp)));
    return [...dates].slice(-6);
  }, [candles]);
  const dailyTradingDateSignature = dailyTradingDates.join(",");
  const gammaLevelsAvailable =
    pane.broker === "Databento" && isGammaChartInstrument(gammaInstrument);
  const valueAreaLevelsAvailable =
    pane.broker === "Databento" && isContinuousFuture(pane.symbol);
  const primaryGammaConversion = gammaLevelsAvailable
    ? cashFallbackGammaConversion(gammaInstrument)
    : null;
  const fallbackGammaConversion = gammaLevelsAvailable
    ? resolveGammaConversion(undefined, gammaInstrument)
    : null;
  const expectedMoveSource = String(expectedMoveIndicator?.settings?.mappingSource ?? "QQQ") === "NDX"
    ? "NDX"
    : "QQQ";
  const expectedMoveConversion = expectedMoveIndicator && (gammaInstrument === "NQ" || gammaInstrument === "MNQ")
    ? resolveGammaConversion(`${expectedMoveSource}-${gammaInstrument}`, gammaInstrument)
    : null;
  const expectedGammaContract =
    pane.broker === "Databento" ? currentCmeContract(pane.symbol) : null;

  useEffect(() => {
    if (!loading) onInitialSettled?.();
  }, [loading, onInitialSettled]);
  const gammaDataReady = Boolean(
    expectedGammaContract
    && contractMatchesChartInstrument(pane.symbol, resolvedContractSymbol)
    && candles.length,
  );
  const currentGammaOverlay =
    gammaOverlay?.instrument === gammaInstrument ? gammaOverlay : null;
  const flowConfirmedGammaLevels = useMemo(() => {
    const base = currentGammaOverlay?.levels ?? [];
    if (gexBotFlow?.status !== "LIVE" || !gexBotFlow.sample) return base;
    const comparable = base.filter((level): level is ChartLevel & { kind: string } => Boolean(level.kind));
    const merged = mergeOneFamilyPositioning(
      comparable,
      gexBotFlow.sample,
      gexBotFlow.matchingBand,
      (object, nearest) => ({
        ...nearest,
        id: `gexbot-flow-${object.kind.toLowerCase()}-${object.price}`,
        price: object.price,
        label: `GEX Bot ${object.name} · contested`,
        lineStyle: "dotted" as const,
        lineWidth: 1 as const,
        axisLabelVisible: true,
      }),
    );
    const untouched = base.filter((level) => !level.kind);
    return [...untouched, ...merged].sort((left, right) => left.price - right.price || left.id.localeCompare(right.id));
  }, [currentGammaOverlay?.levels, gexBotFlow]);
  const classicGexProfileWithZero = useMemo(() => {
    if (!classicGexProfile || classicGexProfile.zeroGamma) return classicGexProfile;
    const zero = currentGammaOverlay?.levels.find((level) => level.label.startsWith("Zero Gamma"));
    if (!zero) return classicGexProfile;
    const strike = (zero.price - classicGexProfile.mapping.offset) / classicGexProfile.mapping.scale;
    return {
      ...classicGexProfile,
      zeroGamma: {
        strike,
        mappedPrice: zero.price,
        value: 0,
      },
    };
  }, [classicGexProfile, currentGammaOverlay]);
  const gameplanDecorations = useMemo(
    () => buildGameplanChartDecorations(gameplanOverlay, settings),
    [gameplanOverlay, settings],
  );
  const structure = useStructureLevels({
    enabled: pane.broker === "Databento" && (historicalStructureEnabled || levelExportRequested),
    symbol: pane.symbol,
    instrument: gammaInstrument,
    contractSymbol: resolvedContractSymbol,
    upColor: settings.upColor,
    downColor: settings.downColor,
  });
  const chartLevels = useMemo(
    () => {
      const gammaLevels = gammaLevelsEnabled
        ? flowConfirmedGammaLevels.filter((level) =>
            !expectedMoveIndicator || !level.id.toLowerCase().includes("expected-move"))
        : [];
      const valueAreaLevels = valueAreaLevelsEnabled && valueAreaOverlay?.instrument === pane.symbol
        ? valueAreaOverlay.levels
        : [];
      return [
        ...(currentGammaOverlay?.stale
          ? markLevelsStale(gammaLevels, currentGammaOverlay.checkedAt)
          : gammaLevels),
        ...(valueAreaOverlay?.stale
          ? markLevelsStale(valueAreaLevels, valueAreaOverlay.generatedAt)
          : valueAreaLevels),
        ...(historicalStructureEnabled ? structure.snapshot.levels : []),
      ];
    },
    [
      currentGammaOverlay,
      expectedMoveIndicator,
      flowConfirmedGammaLevels,
      gammaLevelsEnabled,
      pane.symbol,
      historicalStructureEnabled,
      structure.snapshot.levels,
      valueAreaLevelsEnabled,
      valueAreaOverlay,
    ],
  );
  const markMarketActive = useCallback(() => {
    if (!marketActiveRef.current) {
      marketActiveRef.current = true;
      setMarketIsActive(true);
    }
    if (marketInactiveTimerRef.current !== null) {
      window.clearTimeout(marketInactiveTimerRef.current);
    }
    marketInactiveTimerRef.current = window.setTimeout(() => {
      marketInactiveTimerRef.current = null;
      marketActiveRef.current = false;
      setMarketIsActive(false);
    }, 15_000);
  }, []);

  useEffect(() => {
    marketActiveRef.current = false;
    rithmicConnectedRef.current = false;
    setMarketIsActive(false);
    if (marketInactiveTimerRef.current !== null) {
      window.clearTimeout(marketInactiveTimerRef.current);
      marketInactiveTimerRef.current = null;
    }
  }, [pane.broker, pane.symbol, pane.timeframe]);

  useEffect(() => {
    if (
      pane.broker !== "Databento"
      || !resolvedContractSymbol
    ) {
      rithmicConnectedRef.current = false;
      return;
    }

    return subscribeRithmicIndicatorTrades({
      symbol: displayCmeSymbol(pane.symbol),
      contractSymbol: resolvedContractSymbol,
      onStatus: (status) => {
        if (status === "connected") rithmicConnectedRef.current = true;
        if (status === "unavailable") rithmicConnectedRef.current = false;
      },
      onSeed: (records) => {
        if (!records.length) return;
        rithmicConnectedRef.current = true;
        const firstRithmicTimestamp = records[0].timestamp;
        const historical = latestMarketTradesRef.current.filter(
          (record) => record.timestamp < firstRithmicTimestamp,
        );
        const next = mergeInstitutionalTradeTape(historical, records);
        latestMarketTradesRef.current = next;
        workspaceExecutionTape.set(workspaceOrderFlowKey(pane.symbol, pane.timeframe), next);
        setMarketTrades(next);

        // A collector reconnect commonly provides a session seed before the
        // separate historical HTTP backfill completes. Previously that seed
        // was stored only for Big Trades, leaving the chart candles without
        // aggressor fields and keeping CVD locked indefinitely. Fold the seed
        // into the exact chart boundaries immediately; the later historical
        // response still merges and supersedes it without double counting.
        const seededCandles = isEventBasedChartInterval(pane.timeframe)
          ? applyMarketTradesToEventBars(
              latestCandlesRef.current,
              records.map((record) => ({
                timestamp: record.timestamp,
                price: record.close,
                size: Math.max(0, Number(record.volume ?? 0)),
                trades: Math.max(1, Number(record.trades ?? 1)),
                delta: Number(record.delta ?? 0),
              })),
              pane.timeframe,
              pane.symbol,
            )
          : enrichCandlesWithInstitutionalTrades(
              latestCandlesRef.current,
              records,
              latestCandlesRef.current.length,
            );
        if (seededCandles !== latestCandlesRef.current && seededCandles.length) {
          latestCandlesRef.current = seededCandles;
          setCandles(seededCandles);
          if (hasRenderableOrderFlow(seededCandles)) {
            setOrderFlowHistoryReady(true);
          }
        }
      },
      onTrades: (records) => {
        rithmicConnectedRef.current = true;
        const next = mergeInstitutionalTradeTape(latestMarketTradesRef.current, records);
        latestMarketTradesRef.current = next;
        workspaceExecutionTape.set(workspaceOrderFlowKey(pane.symbol, pane.timeframe), next);
        const now = Date.now();
        if (now - lastMarketTradeStateSyncRef.current >= 400) {
          lastMarketTradeStateSyncRef.current = now;
          setMarketTrades(next);
        }
        // Keep the exact profiles live between refetches, as the original
        // Kwantify build did: each print batch is folded straight into the
        // gateway-built profiles, so the POC/VA develop in real time instead
        // of stepping every 15 seconds. Provisional chart profiles carry a
        // coverage watermark, so newer Rithmic prints can safely develop the
        // active session without counting candle volume twice.
        setVolumeProfiles((current) => current.length
          ? current.map((profile) => applyInstitutionalTradesToVolumeProfile(profile, records))
          : current);

        // CVD is rendered from the chart candles, not from the compact trade
        // marker tape. Fold each authoritative Rithmic execution into those
        // candles immediately so live delta continues from the restored
        // historical CVD instead of freezing at the history boundary.
        const previousCandles = latestCandlesRef.current;
        const nextCandles = isEventBasedChartInterval(pane.timeframe)
          ? applyMarketTradesToEventBars(
              previousCandles,
              records.map((record) => ({
                timestamp: record.timestamp,
                price: record.close,
                size: Math.max(0, Number(record.volume ?? 0)),
                trades: Math.max(1, Number(record.trades ?? 1)),
                delta: Number(record.delta ?? 0),
              })),
              pane.timeframe,
              pane.symbol,
            )
          : records.reduce((current, record) => mergeLiveMidIntoCandles(
              current,
              record.close,
              pane.symbol,
              pane.timeframe,
              record.timestamp,
              {
                isTrade: true,
                size: Math.max(0, Number(record.volume ?? 0)),
                trades: Math.max(1, Number(record.trades ?? 1)),
                delta: Number(record.delta ?? 0),
              },
            ), previousCandles);
        if (nextCandles !== previousCandles && nextCandles.length) {
          latestCandlesRef.current = nextCandles;
          // Do not leave a functioning live CVD hidden merely because the
          // older archive request is unavailable. Two or more verified chart
          // buckets establish a real cumulative baseline and are safe to
          // display while the full backfill continues in the background.
          if (hasRenderableOrderFlow(nextCandles)) {
            setOrderFlowHistoryReady(true);
          }
          const latest = nextCandles.at(-1)!;
          window.dispatchEvent(new CustomEvent(LIVE_CHART_CANDLE_EVENT, {
            detail: { key: pane.id, candle: latest },
          }));
          const now = Date.now();
          const newBar = previousCandles.at(-1)?.timestamp !== latest.timestamp;
          if (newBar || now - lastCandleStateSyncRef.current >= 250) {
            lastCandleStateSyncRef.current = now;
            setCandles(nextCandles);
          }
        }
      },
    });
  }, [pane.broker, pane.symbol, pane.timeframe, resolvedContractSymbol]);

  useEffect(() => () => {
    if (marketInactiveTimerRef.current !== null) {
      window.clearTimeout(marketInactiveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    onGammaExportSnapshot(pane.id, {
      paneId: pane.id,
      instrument: gammaInstrument,
      sourceSymbol: pane.symbol,
      contractSymbol: resolvedContractSymbol,
      checkedAt: currentGammaOverlay?.checkedAt ?? null,
      regime: currentGammaOverlay?.regime ?? null,
      sourceLabel: currentGammaOverlay?.sourceLabel ?? "",
      levels: currentGammaOverlay?.levels ?? [],
      valueArea: valueAreaOverlay
        ? {
            checkedAt: valueAreaOverlay.generatedAt,
            sourceLabel: `Value Area${valueAreaOverlay.currentLabel ? " · current session" : ""} · Previous Day Value Area · ${valueAreaOverlay.weeklyLabel}`,
            levels: valueAreaOverlay.levels,
          }
        : null,
      structure: structure.snapshot.zones.length
        ? {
            checkedAt: structure.snapshot.asOf ?? "",
            sourceLabel: structure.snapshot.source,
            levels: structure.snapshot.levels,
            zones: structure.snapshot.zones,
          }
        : null,
    });
    return () => onGammaExportSnapshot(pane.id, null);
  }, [
    currentGammaOverlay,
    gammaInstrument,
    onGammaExportSnapshot,
    pane.id,
    pane.symbol,
    resolvedContractSymbol,
    structure.snapshot,
    valueAreaOverlay,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestController = new AbortController();
    let reconciliationTimer: number | null = null;
    const requestedFrom = requestedChartHistoryStart(period);
    const immediateCache = pane.broker === "Databento"
      ? peekCompatibleChartHistoryCache(pane.symbol, pane.timeframe)
      : null;
    const observedTail = pane.broker === "Databento"
      ? readDatabentoLiveTail(pane.symbol)
      : [];
    const immediateHistory = trimDisconnectedActiveTail(
      trimCandlesAfterActiveBucket(
        sanitizeCandles(immediateCache?.candles ?? [], pane.symbol),
        pane.timeframe,
      ),
      pane.timeframe,
    );
    const immediateHistoryForPeriod = trimChartHistoryForPeriod(
      immediateHistory,
      period,
      requestedFrom,
    );
    const immediateCandles = pane.broker === "Databento"
      ? mergeObservedDatabentoTail(immediateHistoryForPeriod, observedTail, pane.timeframe)
      : immediateHistoryForPeriod;
    const hasImmediateHistory = immediateHistoryForPeriod.length > 0;
    const immediateOrderFlowHistoryReady = !needsOrderFlowHistory
      || hasUsableOrderFlowHistory(immediateCandles);
    const immediateTailNeedsReconciliation = pane.broker === "Databento"
      && cmeChartTailNeedsReconciliation(immediateCandles, pane.timeframe);
    const liveSeamRequest = pane.broker === "Databento" && resolvedContractSymbol
      ? fetchWorkspaceLiveSeam(pane.symbol, pane.timeframe, resolvedContractSymbol)
      : Promise.resolve([] as Candle[]);
    const memoryTape = needsOrderFlowHistory
      ? peekExecutionTapeCache(pane.symbol, pane.timeframe)?.records ?? []
      : [];
    const immediateMarketTrades = needsOrderFlowHistory
      ? workspaceExecutionTape.get(workspaceOrderFlowKey(pane.symbol, pane.timeframe)) ?? memoryTape
      : [];
    if (immediateMarketTrades.length) {
      workspaceExecutionTape.set(
        workspaceOrderFlowKey(pane.symbol, pane.timeframe),
        immediateMarketTrades,
      );
    }
    // A usable cached chart must paint immediately. Seam reconciliation is a
    // background data-quality task, not permission to cover valid candles with
    // a full-page loader for tens of seconds. Live ticks remain buffered until
    // the missing buckets are repaired, so revealing history cannot create a
    // fabricated join.
    setLoading(!hasImmediateHistory);
    setError(null);
    setCandles(hasImmediateHistory ? immediateCandles : []);
    setMarketTrades(immediateMarketTrades);
    setOrderFlowHistoryReady(immediateOrderFlowHistoryReady);
    latestCandlesRef.current = hasImmediateHistory ? immediateCandles : [];
    latestMarketTradesRef.current = immediateMarketTrades;
    latestOrderFlowCandlesRef.current = [];
    historyHydratedRef.current = hasImmediateHistory && !immediateTailNeedsReconciliation;
    liveTailStartTimestampRef.current = observedTail[0]?.timestamp ?? null;
    pendingLiveTicksRef.current = [];
    if (liveFrameRef.current !== null) {
      window.cancelAnimationFrame(liveFrameRef.current);
      liveFrameRef.current = null;
    }

    // Order-flow is an enrichment, never a prerequisite for drawing ordinary
    // CME history. Fetch it independently so a slow local bridge cannot leave
    // a newly selected 1m/5m chart empty. Exact event bars can still paint as
    // soon as the bridge answers while their longer CME backfill runs below.
    if (
      pane.broker === "Databento"
      && needsOrderFlowHistory
      && resolvedContractSymbol
    ) {
      void fetchWorkspaceOrderFlow(
        pane.symbol,
        pane.timeframe,
        resolvedContractSymbol,
      ).then((result) => {
        if (cancelled || !result) return;
        const exactTape = compactIndicatorExecutionHistory(
          result.records.length ? result.records : result.trades,
        );
        const mergedTape = mergeInstitutionalTradeTape(
          latestMarketTradesRef.current,
          exactTape,
        );
        latestMarketTradesRef.current = mergedTape;
        if (mergedTape.length) {
          workspaceExecutionTape.set(
            workspaceOrderFlowKey(pane.symbol, pane.timeframe),
            mergedTape,
          );
          setMarketTrades(mergedTape);
          void writeExecutionTapeCache(pane.symbol, pane.timeframe, mergedTape);
        }

        const orderFlowCandles = sanitizeCandles(result.candles, pane.symbol);
        latestOrderFlowCandlesRef.current = orderFlowCandles;
        // Keep the completed response even if base OHLC is still opening. The
        // history loader below reapplies this snapshot when its candles land;
        // previously this early return permanently lost CVD hydration.
        if (!latestCandlesRef.current.length) return;
        // Preserve the authoritative chart OHLC. Time bars receive the
        // gateway's aggregated bid/ask fields; event bars are enriched from
        // the exact execution tape because a clock bucket cannot replace a
        // range/volume/Renko bar without corrupting its geometry.
        const mergedCandles = applyAvailableOrderFlowHistory(
          latestCandlesRef.current,
          pane.timeframe,
          orderFlowCandles,
          mergedTape,
        );
        latestCandlesRef.current = mergedCandles;
        setOrderFlowHistoryReady(hasUsableOrderFlowHistory(mergedCandles));
        historyHydratedRef.current = !cmeChartTailNeedsReconciliation(mergedCandles, pane.timeframe);
        setCandles(mergedCandles);
        setMarketTrades(mergedTape);
        setLoading(false);
        setError(null);
        void writeChartHistoryCache(pane.symbol, pane.timeframe, mergedCandles);
      }).catch(() => {
        // Base OHLC history remains usable if optional order-flow is offline.
      });
    }

    const loadHistory = async () => {
      const [cached, storedTape, liveSeam] = await Promise.all([
        pane.broker === "Databento"
          ? readCompatibleChartHistoryCache(pane.symbol, pane.timeframe)
          : Promise.resolve(null),
        pane.broker === "Databento" && needsOrderFlowHistory
          ? readExecutionTapeCache(pane.symbol, pane.timeframe)
          : Promise.resolve(null),
        liveSeamRequest,
      ]);
      if (cancelled) return;
      const cachedMarketTrades = needsOrderFlowHistory
        ? mergeInstitutionalTradeTape(
            latestMarketTradesRef.current,
            storedTape?.records ?? [],
          )
        : [];
      if (cachedMarketTrades.length) {
        latestMarketTradesRef.current = cachedMarketTrades;
        workspaceExecutionTape.set(
          workspaceOrderFlowKey(pane.symbol, pane.timeframe),
          cachedMarketTrades,
        );
        setMarketTrades(cachedMarketTrades);
      }
      const cachedHistory = trimDisconnectedActiveTail(
        trimCandlesAfterActiveBucket(
          sanitizeCandles(
            mergeChartHistory(cached?.candles ?? [], liveSeam),
            pane.symbol,
          ),
          pane.timeframe,
        ),
        pane.timeframe,
      );
      const cachedBase = trimChartHistoryForPeriod(cachedHistory, period, requestedFrom);
      const latestObservedTail = pane.broker === "Databento"
        ? readDatabentoLiveTail(pane.symbol)
        : [];
      if (latestObservedTail.length) {
        const firstObserved = latestObservedTail[0].timestamp;
        liveTailStartTimestampRef.current = liveTailStartTimestampRef.current === null
          ? firstObserved
          : Math.min(liveTailStartTimestampRef.current, firstObserved);
      }
      const cachedWithObserved = pane.broker === "Databento"
        ? mergeObservedDatabentoTail(cachedBase, latestObservedTail, pane.timeframe)
        : cachedBase;
      let cachedCandles = pane.broker === "Databento"
        ? mergeHistoricalWithLiveTail(
            cachedWithObserved,
            latestCandlesRef.current,
            pane.timeframe,
            liveTailStartTimestampRef.current,
          )
        : cachedWithObserved;
      cachedCandles = needsOrderFlowHistory
        ? applyAvailableOrderFlowHistory(
            cachedCandles,
            pane.timeframe,
            latestOrderFlowCandlesRef.current,
            cachedMarketTrades,
          )
        : cachedCandles;
      const needsFiveDayBackfill = pane.broker === "Databento";
      const cachedTailIsFresh = Boolean(
        cached?.updatedAt
        && Date.now() - cached.updatedAt <= (
          isEventBasedChartInterval(pane.timeframe) ? 15 * 60_000 : 20_000
        ),
      );
      const cachedIsHydrated = cachedCandles.length > 0
        && cachedTailIsFresh
        && !cmeChartTailNeedsReconciliation(cachedCandles, pane.timeframe)
        && (!needsFiveDayBackfill || hasFiveDayHistory(cachedHistory, pane.timeframe))
        && (!needsOrderFlowHistory || hasUsableOrderFlowHistory(cachedCandles));
      if (cachedBase.length) {
        latestCandlesRef.current = cachedCandles;
        historyHydratedRef.current = !cmeChartTailNeedsReconciliation(cachedCandles, pane.timeframe);
        setCandles(cachedCandles);
        if (hasUsableOrderFlowHistory(cachedCandles)) setOrderFlowHistoryReady(true);
        setLoading(false);
        setError(null);
      }
      if (cachedIsHydrated) {
        historyHydratedRef.current = true;
        setOrderFlowHistoryReady(true);
        setLoading(false);
        return;
      }

      // Ordinary Volume is available from base OHLCV history; exact CVD
      // enrichment is the expensive part. Paint the chart and Volume first
      // on every CME interval instead of holding both panes behind the
      // aggressor-tape reconstruction. The durable flow request below then
      // merges into the same chart-bar boundaries.
      if (
        pane.broker === "Databento"
        && needsOrderFlowHistory
        && !cachedBase.length
      ) {
        try {
          const baseHistory = await fetchWorkspaceCandles(
            pane.symbol,
            pane.timeframe,
            pane.broker,
            period,
            500,
            false,
            requestController.signal,
          );
          if (cancelled) return;
          let baseCandles = trimChartHistoryForPeriod(
            trimCandlesAfterActiveBucket(
              sanitizeCandles(baseHistory, pane.symbol),
              pane.timeframe,
            ),
            period,
            requestedFrom,
          );
          baseCandles = applyAvailableOrderFlowHistory(
            baseCandles,
            pane.timeframe,
            latestOrderFlowCandlesRef.current,
            latestMarketTradesRef.current,
          );
          if (baseCandles.length) {
            cachedCandles = mergeHistoricalWithLiveTail(
              mergeChartHistory(mergeChartHistory(cachedCandles, baseCandles), liveSeam),
              latestCandlesRef.current,
              pane.timeframe,
              liveTailStartTimestampRef.current,
            );
            latestCandlesRef.current = cachedCandles;
            historyHydratedRef.current = !cmeChartTailNeedsReconciliation(cachedCandles, pane.timeframe);
            setCandles(cachedCandles);
            if (hasUsableOrderFlowHistory(cachedCandles)) {
              setOrderFlowHistoryReady(true);
            }
            setLoading(false);
            setError(null);
            // If the independent Rithmic history request won the race, this is
            // already a complete OHLC + flow snapshot. Persist that exact
            // first paint so the next refresh restores price, Volume and CVD
            // together without another network round trip.
            void writeChartHistoryCache(pane.symbol, pane.timeframe, cachedCandles);
          }
        } catch (baseError) {
          if (baseError instanceof DOMException && baseError.name === "AbortError") return;
          // The enriched request below remains the authoritative fallback.
        }
      }

      try {
        const nextCandles = await fetchWorkspaceCandles(
          pane.symbol,
          pane.timeframe,
          pane.broker,
          period,
          500,
          needsOrderFlowHistory,
          requestController.signal,
        );
        if (cancelled) return;
        const downloadedMarketTrades = needsOrderFlowHistory
          ? workspaceExecutionTape.get(workspaceOrderFlowKey(pane.symbol, pane.timeframe)) ?? []
          : [];
        const nextMarketTrades = needsOrderFlowHistory
          ? mergeInstitutionalTradeTape(latestMarketTradesRef.current, downloadedMarketTrades)
          : [];
        const downloaded = trimCandlesAfterActiveBucket(
          sanitizeCandles(nextCandles, pane.symbol),
          pane.timeframe,
        );
        const clean = pane.broker === "Databento"
          ? trimChartHistoryForPeriod(downloaded, period, requestedFrom)
          : downloaded;
        const mergedHistory = pane.broker === "Databento"
          ? mergeChartHistory(mergeChartHistory(cachedCandles, clean), liveSeam)
          : clean;
        if (!mergedHistory.length) throw new Error("CME returned no usable candles.");
        const latestObserved = pane.broker === "Databento"
          ? readDatabentoLiveTail(pane.symbol)
          : [];
        if (latestObserved.length) {
          const firstObserved = latestObserved[0].timestamp;
          liveTailStartTimestampRef.current = liveTailStartTimestampRef.current === null
            ? firstObserved
            : Math.min(liveTailStartTimestampRef.current, firstObserved);
        }
        const historyWithObserved = pane.broker === "Databento"
          ? mergeObservedDatabentoTail(mergedHistory, latestObserved, pane.timeframe)
          : mergedHistory;
        const mergedBase = pane.broker === "Databento"
          ? mergeHistoricalWithLiveTail(
              historyWithObserved,
              latestCandlesRef.current,
              pane.timeframe,
              liveTailStartTimestampRef.current,
            )
          : clean;
        const merged = needsOrderFlowHistory
          ? isEventBasedChartInterval(pane.timeframe)
            ? enrichCandlesWithInstitutionalTrades(
                mergedBase,
                nextMarketTrades,
                mergedBase.length,
              )
            : enrichCandlesWithInstitutionalCandleFlow(
                mergedBase,
                latestOrderFlowCandlesRef.current,
              )
          : mergedBase;
        const tailNeedsReconciliation = pane.broker === "Databento"
          && cmeChartTailNeedsReconciliation(merged, pane.timeframe);
        latestCandlesRef.current = merged;
        latestMarketTradesRef.current = nextMarketTrades;
        if (nextMarketTrades.length) {
          workspaceExecutionTape.set(
            workspaceOrderFlowKey(pane.symbol, pane.timeframe),
            nextMarketTrades,
          );
        }
        historyHydratedRef.current = !tailNeedsReconciliation;
        setOrderFlowHistoryReady(
          !needsOrderFlowHistory || hasUsableOrderFlowHistory(merged),
        );
        setCandles(merged);
        setMarketTrades(nextMarketTrades);
        setError(null);
        setLoading(false);
        if (tailNeedsReconciliation && !isEventBasedChartInterval(pane.timeframe)) {
          reconciliationTimer = window.setTimeout(() => {
            reconciliationTimer = null;
            void reconcileTail();
          }, 2_000);
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        if (!cachedCandles.length && !immediateCandles.length) {
          historyHydratedRef.current = false;
          setError("CME history is temporarily unavailable.");
        }
        const tailNeedsReconciliation = cmeChartTailNeedsReconciliation(
          latestCandlesRef.current.length ? latestCandlesRef.current : cachedCandles,
          pane.timeframe,
        );
        setLoading(!(latestCandlesRef.current.length || cachedCandles.length));
        if (tailNeedsReconciliation && !isEventBasedChartInterval(pane.timeframe)) {
          reconciliationTimer = window.setTimeout(() => {
            reconciliationTimer = null;
            void reconcileTail();
          }, 2_000);
        }
      }
    };

    const reconcileTail = async () => {
      if (cancelled || historyHydratedRef.current || pane.broker !== "Databento") return;
      try {
        const [historical, seam] = await Promise.all([
          fetchWorkspaceCandles(
            pane.symbol,
            pane.timeframe,
            pane.broker,
            period,
            500,
            false,
            requestController.signal,
            true,
          ),
          resolvedContractSymbol
            ? fetchWorkspaceLiveSeam(pane.symbol, pane.timeframe, resolvedContractSymbol)
            : Promise.resolve([] as Candle[]),
        ]);
        if (cancelled) return;
        let repaired = trimChartHistoryForPeriod(
          trimCandlesAfterActiveBucket(
            sanitizeCandles(
              mergeChartHistory(
                mergeChartHistory(latestCandlesRef.current, historical),
                seam,
              ),
              pane.symbol,
            ),
            pane.timeframe,
          ),
          period,
          requestedFrom,
        );
        repaired = needsOrderFlowHistory
          ? applyAvailableOrderFlowHistory(
              repaired,
              pane.timeframe,
              latestOrderFlowCandlesRef.current,
              latestMarketTradesRef.current,
            )
          : repaired;
        const stillBroken = cmeChartTailNeedsReconciliation(repaired, pane.timeframe);
        latestCandlesRef.current = repaired;
        historyHydratedRef.current = !stillBroken;
        if (!stillBroken) {
          setCandles(repaired);
          if (hasUsableOrderFlowHistory(repaired)) {
            setOrderFlowHistoryReady(true);
          }
          setLoading(false);
          setError(null);
          void writeChartHistoryCache(pane.symbol, pane.timeframe, repaired);
          return;
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
      }
      if (!cancelled) {
        reconciliationTimer = window.setTimeout(() => {
          reconciliationTimer = null;
          void reconcileTail();
        }, 2_000);
      }
    };

    const requestTailReconciliation = () => {
      if (cancelled || reconciliationTimer !== null || pane.broker !== "Databento") return;
      historyHydratedRef.current = false;
      reconciliationTimer = window.setTimeout(() => {
        reconciliationTimer = null;
        void reconcileTail();
      }, 0);
    };
    requestTailReconciliationRef.current = requestTailReconciliation;

    void loadHistory();

    return () => {
      cancelled = true;
      requestController.abort();
      if (reconciliationTimer !== null) window.clearTimeout(reconciliationTimer);
      if (requestTailReconciliationRef.current === requestTailReconciliation) {
        requestTailReconciliationRef.current = null;
      }
    };
  }, [
    pane.broker,
    pane.symbol,
    pane.timeframe,
    period,
    resolvedContractSymbol,
  ]);

  // Adding an order-flow study must never restart the base candle loader.
  // Hydrate the already-visible chart from memory first, then merge the full
  // execution archive silently. The request is shared/deduplicated across
  // panes by fetchWorkspaceOrderFlow.
  useEffect(() => {
    if (
      pane.broker !== "Databento"
      || !needsOrderFlowHistory
      || !resolvedContractSymbol
    ) return;

    let cancelled = false;
    const applyFlow = (
      flowCandles: Candle[],
      records: InstitutionalTrade[],
    ) => {
      if (cancelled) return;
      const mergedTape = mergeInstitutionalTradeTape(
        latestMarketTradesRef.current,
        compactIndicatorExecutionHistory(records),
      );
      const mergedCandles = applyAvailableOrderFlowHistory(
        latestCandlesRef.current,
        pane.timeframe,
        flowCandles,
        mergedTape,
      );
      latestMarketTradesRef.current = mergedTape;
      latestOrderFlowCandlesRef.current = flowCandles;
      if (mergedTape.length) {
        workspaceExecutionTape.set(
          workspaceOrderFlowKey(pane.symbol, pane.timeframe),
          mergedTape,
        );
        setMarketTrades(mergedTape);
      }
      if (mergedCandles.length) {
        latestCandlesRef.current = mergedCandles;
        setCandles(mergedCandles);
      }
      if (hasRenderableOrderFlow(mergedCandles)) {
        setOrderFlowHistoryReady(true);
      }
    };

    const memoryTape = workspaceExecutionTape.get(
      workspaceOrderFlowKey(pane.symbol, pane.timeframe),
    ) ?? peekExecutionTapeCache(pane.symbol, pane.timeframe)?.records ?? [];
    if (memoryTape.length) {
      applyFlow(latestOrderFlowCandlesRef.current, memoryTape);
    }

    void fetchWorkspaceOrderFlow(
      pane.symbol,
      pane.timeframe,
      resolvedContractSymbol,
    ).then((result) => {
      if (!result) return;
      applyFlow(
        sanitizeCandles(result.candles, pane.symbol),
        result.records.length ? result.records : result.trades,
      );
      const tape = latestMarketTradesRef.current;
      if (tape.length) void writeExecutionTapeCache(pane.symbol, pane.timeframe, tape);
      const enriched = latestCandlesRef.current;
      if (enriched.length) void writeChartHistoryCache(pane.symbol, pane.timeframe, enriched);
    }).catch(() => {
      // The live Rithmic subscription continues populating Delta while an
      // optional historical archive is temporarily unavailable.
    });

    return () => {
      cancelled = true;
    };
  }, [needsOrderFlowHistory, pane.broker, pane.symbol, pane.timeframe, resolvedContractSymbol]);

  useEffect(() => {
    if (pane.broker !== "Databento") return;
    const interval = window.setInterval(() => {
      if (latestCandlesRef.current.length) {
        void writeChartHistoryCache(pane.symbol, pane.timeframe, latestCandlesRef.current);
      }
      if (latestMarketTradesRef.current.length) {
        void writeExecutionTapeCache(pane.symbol, pane.timeframe, latestMarketTradesRef.current);
      }
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      if (latestCandlesRef.current.length) {
        void writeChartHistoryCache(pane.symbol, pane.timeframe, latestCandlesRef.current);
      }
      if (latestMarketTradesRef.current.length) {
        void writeExecutionTapeCache(pane.symbol, pane.timeframe, latestMarketTradesRef.current);
      }
    };
  }, [pane.broker, pane.symbol, pane.timeframe]);

  useEffect(() => {
    latestCandlesRef.current = candles;
    const latest = candles.at(-1);
    if (latest && (
      latestFuturesRef.current.asOfMs === null
      || latest.timestamp >= latestFuturesRef.current.asOfMs
    )) {
      latestFuturesRef.current = {
        ...latestFuturesRef.current,
        price: latest.close,
        // A candle timestamp is a bucket label, not necessarily the precise
        // market-event time. Never let an ahead-labelled higher-timeframe bar
        // reject the first real tick as out of order.
        asOfMs: Math.min(latest.timestamp, Date.now()),
      };
    }
  }, [candles]);

  useEffect(() => {
    const contractSymbol = pane.broker === "Databento" ? currentCmeContract(pane.symbol) : null;
    liveInstrumentIdentityRef.current = `${pane.broker}:${pane.symbol}`;
    setResolvedContractSymbol(contractSymbol);
    latestFuturesRef.current = {
      price: null,
      asOfMs: null,
      contractSymbol,
      tickSize: futuresTickSize(pane.symbol),
    };
    liveOutlierCandidateRef.current = null;
    pendingLiveTicksRef.current = [];
    if (liveFrameRef.current !== null) {
      window.cancelAnimationFrame(liveFrameRef.current);
      liveFrameRef.current = null;
    }
    const cachedGammaPayload = primaryGammaConversion
      ? readGammaSessionPayload(primaryGammaConversion)
      : null;
    const restoredGammaOverlay = cachedGammaPayload && primaryGammaConversion
      ? buildGammaChartOverlay({
          payload: cachedGammaPayload,
          conversion: primaryGammaConversion,
          candles: latestCandlesRef.current,
          futuresPrice: latestFuturesRef.current.price,
          futuresAsOfMs: latestFuturesRef.current.asOfMs,
          futuresContract: contractSymbol ?? primaryGammaConversion.futuresRoot,
          tickSize: futuresTickSize(pane.symbol),
          settings,
        })
      : null;
    const cachedGammaCheckedAt = cachedGammaPayload
      ? Date.parse(cachedGammaPayload.checkedAt)
      : Number.NaN;
    const cachedGammaOverlay = restoredGammaOverlay
      ? {
          ...restoredGammaOverlay,
          // A stored frame is an immediate visual bridge, not permission to
          // label old options data live. Fresh responses replace it silently.
          stale: !Number.isFinite(cachedGammaCheckedAt)
            || Date.now() - cachedGammaCheckedAt > Math.max(60_000, gammaRefreshDelay(cachedGammaPayload?.refreshAfterMs) * 2),
        }
      : null;
    setGammaOverlay(cachedGammaOverlay);
    setGammaLevelsError(null);
    setGammaLevelsLoading(gammaLevelsEnabled && gammaLevelsAvailable && !cachedGammaOverlay);
    const cachedValueAreaPayload = valueAreaLevelsAvailable
      ? readValueAreaSessionPayload(pane.symbol.toUpperCase())
      : null;
    const cachedValueAreaOverlay = cachedValueAreaPayload
      ? buildValueAreaChartOverlay(cachedValueAreaPayload, pane.symbol, settings)
      : null;
    setValueAreaOverlay(cachedValueAreaOverlay);
    setValueAreaLevelsError(null);
    setValueAreaLevelsLoading(valueAreaLevelsEnabled && valueAreaLevelsAvailable && !cachedValueAreaOverlay);
  }, [pane.broker, pane.symbol]);

  useEffect(() => {
    const supported = pane.broker === "Databento" && (gammaInstrument === "NQ" || gammaInstrument === "MNQ");
    if (!classicGexIndicator || !supported) {
      setClassicGexLoading(false);
      setClassicGexError(classicGexIndicator && !supported ? "Classic GEX is available on NQ and MNQ charts." : null);
      setClassicGexProfile(null);
      setClassicGexHistory([]);
      classicGexHistoryRef.current = [];
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    const refreshIntervalMs = Math.max(1_000, Number(classicGexSettings.refreshIntervalMs ?? 1_000));
    const source = String(classicGexSettings.mappingSource ?? "QQQ") === "NDX" ? "NDX" : "QQQ";
    const expiry = ["ZERO_DTE", "NEXT_EXPIRY", "ALL"].includes(String(classicGexSettings.expiry))
      ? String(classicGexSettings.expiry)
      : "ZERO_DTE";
    const profileSource = String(classicGexSettings.profileSource) === "OPEN_INTEREST" ? "OPEN_INTEREST" : "VOLUME";
    const mapping = String(classicGexSettings.mappingMode) === "MANUAL" ? "MANUAL" : "AUTO";
    setClassicGexProfile(null);
    setClassicGexHistory([]);
    classicGexHistoryRef.current = [];

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => void load(), delay);
    };
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      setClassicGexLoading((current) => current || !classicGexProfile);
      const query = new URLSearchParams({
        source,
        expiry,
        profileSource,
        mapping,
        multiplier: String(Number(classicGexSettings.manualMultiplier ?? 1)),
        offset: String(Number(classicGexSettings.premiumOffset ?? 0)),
      });
      const futuresPrice = latestFuturesRef.current.price;
      if (futuresPrice && Number.isFinite(futuresPrice)) query.set("futuresPrice", String(futuresPrice));
      try {
        const response = await fetch(`/api/chart-gex-profile?${query.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const raw = await response.text();
        let candidate: unknown = null;
        try { candidate = JSON.parse(raw); } catch { candidate = null; }
        if (!response.ok || !candidate || typeof candidate !== "object" || !("rows" in candidate)) {
          const message = candidate && typeof candidate === "object" && "error" in candidate
            ? String(candidate.error)
            : "Classic GEX returned an invalid response.";
          throw new Error(message);
        }
        if (cancelled) return;
        const payload = candidate as ClassicGexProfilePayload;
        setClassicGexProfile(payload);
        setClassicGexError(null);
        setClassicGexLoading(false);
        const timestamp = Date.parse(payload.asOf);
        if (Number.isFinite(timestamp)) {
          const previous = classicGexHistoryRef.current.at(-1);
          if (shouldPublishClassicGex(previous?.timestamp ?? null, timestamp, 55_000)) {
            const next = appendClassicGexHistory(
              classicGexHistoryRef.current,
              { timestamp, rows: payload.rows },
            );
            classicGexHistoryRef.current = next;
            setClassicGexHistory(next);
          }
        }
      } catch (loadError) {
        if (cancelled || (loadError instanceof Error && loadError.name === "AbortError")) return;
        setClassicGexLoading(false);
        setClassicGexError(loadError instanceof Error ? loadError.message : "Classic GEX is temporarily unavailable.");
        setClassicGexProfile((current) => current ? { ...current, stale: true, status: "STALE" } : current);
      } finally {
        schedule(refreshIntervalMs);
      }
    };

    setClassicGexLoading(!classicGexProfile);
    schedule(20);
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  // Settings are intentionally represented by a stable serialized signature.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classicGexIndicator?.instanceId, classicGexSettingsSignature, gammaInstrument, pane.broker]);

  useEffect(() => {
    if ((!gammaLevelsEnabled && !levelExportRequested && !classicGexIndicator && !expectedMoveIndicator) || !gammaLevelsAvailable || !primaryGammaConversion) {
      setGammaLevelsLoading(false);
      setGammaLevelsError(null);
      if (!gammaLevelsAvailable) setGammaOverlay(null);
      if (!expectedMoveIndicator || !expectedMoveConversion) setExpectedMoveCalibration(null);
      return;
    }
    if (!gammaDataReady) {
      setGammaLevelsLoading(gammaLevelsEnabled);
      setGammaLevelsError(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let primaryApplied = false;
    let retainedOverlay = currentGammaOverlay;
    let nativeTransitionOverlay: GammaChartOverlay | null = null;

    const applyConversion = async (conversion: GammaConversionDefinition) => {
      const payload = await fetchGammaPayload(conversion);
      if (cancelled) return null;
      const future = latestFuturesRef.current;
      const overlay = buildGammaChartOverlay({
        payload,
        conversion,
        candles: latestCandlesRef.current,
        futuresPrice: future.price,
        futuresAsOfMs: future.asOfMs,
        futuresContract: future.contractSymbol ?? currentCmeContract(pane.symbol) ?? conversion.futuresRoot,
        tickSize: future.tickSize,
        settings,
      });
      if (!overlay) throw new Error(
        isNativeGammaConversion(conversion)
          ? "Native futures gamma is building."
          : "Waiting for a valid futures calibration.",
      );
      const isPrimary = conversion.id === primaryGammaConversion.id;
      const isNative = isNativeGammaConversion(conversion);
      const isExpectedMove = conversion.id === expectedMoveConversion?.id;
      if (isExpectedMove) setExpectedMoveCalibration(overlay.calibration);
      if (!isPrimary && !isNative) return payload;
      if (isNative) nativeTransitionOverlay = overlay;
      if (isPrimary) primaryApplied = true;
      const nextOverlay = isPrimary
        ? mergeNativeGammaTransitions(overlay, nativeTransitionOverlay)
        : primaryApplied && retainedOverlay
          ? mergeNativeGammaTransitions(retainedOverlay, overlay)
          : overlay;
      retainedOverlay = nextOverlay;
      setGammaOverlay(nextOverlay);
      setGammaLevelsError(null);
      setGammaLevelsLoading(false);
      return payload;
    };

    const loadGamma = async () => {
      setGammaLevelsLoading(gammaLevelsEnabled && !retainedOverlay);
      const conversions = [
        fallbackGammaConversion,
        primaryGammaConversion,
        expectedMoveConversion,
      ].filter((conversion): conversion is GammaConversionDefinition => Boolean(conversion))
        .filter((conversion, index, rows) => rows.findIndex((candidate) => candidate.id === conversion.id) === index);
      const results = await Promise.allSettled(conversions.map((conversion) => applyConversion(conversion)));
      if (cancelled) return;

      const fulfilled = results
        .filter((result): result is PromiseFulfilledResult<ChartGammaLevelsPayload | null> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((payload): payload is ChartGammaLevelsPayload => Boolean(payload));
      if (!retainedOverlay) {
        const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
        setGammaLevelsError(firstFailure?.reason instanceof Error
          ? firstFailure.reason.message
          : "Gamma levels are unavailable.");
        setGammaLevelsLoading(false);
      } else if (!fulfilled.length) {
        setGammaOverlay((current) => current ? { ...current, stale: true } : current);
      }

      const refreshAfterMs = fulfilled.length
        ? Math.min(...fulfilled.map((payload) => payload.refreshAfterMs))
        : 10_000;
      timer = window.setTimeout(() => void loadGamma(), gammaRefreshDelay(refreshAfterMs));
    };

    timer = window.setTimeout(() => void loadGamma(), 50);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [
    fallbackGammaConversion?.id,
    gammaDataReady,
    gammaLevelsAvailable,
    gammaLevelsEnabled,
    classicGexIndicator?.instanceId,
    expectedMoveConversion?.id,
    expectedMoveIndicator?.instanceId,
    levelExportRequested,
    primaryGammaConversion?.id,
    pane.symbol,
    resolvedContractSymbol,
    settings.downColor,
    settings.upColor,
  ]);

  useEffect(() => {
    if ((!valueAreaLevelsEnabled && !levelExportRequested) || !valueAreaLevelsAvailable) {
      setValueAreaLevelsLoading(false);
      setValueAreaLevelsError(null);
      if (!valueAreaLevelsAvailable) setValueAreaOverlay(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let running = false;
    let developingRunning = false;
    let failureStreak = 0;
    let retainedDeveloping: InstitutionalVolumeProfile | null = null;
    let retainedOverlay = valueAreaOverlay && valueAreaPayloadIsCurrent(valueAreaOverlay)
      ? valueAreaOverlay
      : null;
    if (valueAreaOverlay && !retainedOverlay) {
      // A completed-session level set stops being authoritative at the next
      // CME profile close. Clear it before requesting the replacement so an
      // old Thursday profile can never remain visible as Monday's "PD" set.
      setValueAreaOverlay(null);
    }

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadValueArea(), delay);
    };

    const loadValueArea = async () => {
      if (cancelled || running) return;
      if (retainedOverlay && !valueAreaPayloadIsCurrent(retainedOverlay)) {
        retainedOverlay = null;
        retainedDeveloping = null;
        setValueAreaOverlay(null);
      }
      running = true;
      setValueAreaLevelsLoading(!retainedOverlay);
      let nextDelay = 15_000;
      try {
        const sourceSymbol = valueAreaSourceSymbol(pane.symbol);
        const sourcePayload = await fetchValueAreaPayload(sourceSymbol);
        // Micro charts deliberately consume their parent book on the VPS. Use
        // the same parent profile, but retain the selected chart identity so
        // overlay validation and exports remain attached to MES/MNQ/etc.
        const payload = sourcePayload.symbol.toUpperCase() === pane.symbol.toUpperCase()
          ? sourcePayload
          : { ...sourcePayload, symbol: pane.symbol };
        if (cancelled) return;
        const overlay = buildValueAreaChartOverlay(
          payload,
          pane.symbol,
          settings,
          retainedDeveloping,
        );
        if (!overlay) throw new Error("CME returned an invalid completed-period profile.");
        retainedOverlay = overlay;
        setValueAreaOverlay(overlay);
        setValueAreaLevelsError(null);
        setValueAreaLevelsLoading(false);
        failureStreak = 0;

        // The developing profile is useful, but it is not allowed to hold the
        // completed prior-session/prior-week levels hostage. Fetch it in the
        // background and merge it when ready.
        if (resolvedContractSymbol && !developingRunning) {
          developingRunning = true;
          void fetchInstitutionalVolumeProfile({
            symbol: displayCmeSymbol(pane.symbol),
            contractSymbol: resolvedContractSymbol,
            period: "daily",
            tradingDate: chicagoTradingDate(Date.now()),
            groupTicks: 1,
            valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
          })
            .then((developing) => {
              if (cancelled || !developing) return;
              const updated = buildValueAreaChartOverlay(
                payload,
                pane.symbol,
                settings,
                developing,
              );
              if (!updated) return;
              retainedDeveloping = developing;
              retainedOverlay = updated;
              setValueAreaOverlay(updated);
            })
            .catch(() => undefined)
            .finally(() => {
              developingRunning = false;
            });
        }
      } catch (loadError) {
        if (cancelled) return;
        failureStreak += 1;
        if (!retainedOverlay) {
          setValueAreaLevelsError(
            loadError instanceof Error
              ? loadError.message
              : "CME value-area levels are unavailable.",
          );
        } else if (!retainedOverlay.stale) {
          // Last-good levels may stay on the chart only with an explicit
          // stale badge — a failed refresh must never keep painting them
          // fresh-looking.
          retainedOverlay = { ...retainedOverlay, stale: true };
          setValueAreaOverlay(retainedOverlay);
        }
        setValueAreaLevelsLoading(false);
        // A reload used to appear to fix this because the first failure waited
        // a full minute. Recover here instead: 2s, 4s, 8s, 16s, then cap.
        nextDelay = Math.min(60_000, 2_000 * (2 ** Math.min(5, failureStreak - 1)));
      } finally {
        running = false;
        schedule(nextDelay);
      }
    };

    schedule(25);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [
    pane.symbol,
    levelExportRequested,
    resolvedContractSymbol,
    settings.upColor,
    valueAreaLevelsAvailable,
    valueAreaLevelsEnabled,
  ]);

  useEffect(() => {
    const usingCTraderFeed = FALLBACK_CTRADER_BROKER_NAMES.includes(pane.broker as (typeof FALLBACK_CTRADER_BROKER_NAMES)[number]);
    const usingMassivePaneFeed = pane.broker === "Massive" || isMassiveFuturesSymbol(pane.symbol);
    const usingMarketIndexPaneFeed = pane.broker === "Market Index" || isMarketIndexSymbol(pane.symbol);
    const usingDatabentoPaneFeed = pane.broker === "Databento";
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

    if (usingMassivePaneFeed || usingMarketIndexPaneFeed) {
      return;
    }

    const clearPendingFrame = () => {
      pendingLiveTicksRef.current = [];
      if (liveFrameRef.current !== null) {
        window.cancelAnimationFrame(liveFrameRef.current);
        liveFrameRef.current = null;
      }
    };

    const consumeLivePrice = (price: LiveFeedPrice) => {
      if (price.error) {
        setLiveFeedError(price.error);
        return;
      }

      const displayName = usingDatabentoPaneFeed || usingCTraderFeed
        ? price.instrument
        : (nameMap[price.instrument] || price.instrument);
      if (displayName !== pane.symbol) return;

      const instrumentIdentity = `${pane.broker}:${pane.symbol}`;
      if (liveInstrumentIdentityRef.current !== instrumentIdentity) {
        // Pane components are reused when the user switches symbols. Never
        // validate the first ES/MES tick against an NQ/MNQ reference (or vice
        // versa), otherwise a legitimate new instrument can be quarantined as
        // an outlier and look frozen until enough distinct timestamps arrive.
        liveInstrumentIdentityRef.current = instrumentIdentity;
        latestFuturesRef.current = {
          price: null,
          asOfMs: null,
          contractSymbol: currentCmeContract(pane.symbol),
          tickSize: futuresTickSize(pane.symbol),
        };
        liveOutlierCandidateRef.current = null;
        pendingLiveTicksRef.current = [];
      }

      const tickTimestamp = marketTimestamp(price.timestamp);
      const latestFuture = latestFuturesRef.current;
      const validation = validateLiveTick({
        candles: latestCandlesRef.current,
        symbol: pane.symbol,
        price: Number(price.mid),
        timestamp: tickTimestamp,
        referencePrice: latestFuture.price,
        referenceTimestamp: latestFuture.asOfMs,
        candidate: liveOutlierCandidateRef.current,
      });
      liveOutlierCandidateRef.current = validation.candidate;
      if (!validation.accepted) return;

      if (!price.cached) {
        liveTailStartTimestampRef.current = liveTailStartTimestampRef.current === null
          ? tickTimestamp
          : Math.min(liveTailStartTimestampRef.current, tickTimestamp);
      }
      if (usingDatabentoPaneFeed && price.contractSymbol) {
        setResolvedContractSymbol(price.contractSymbol);
      }
      latestFuturesRef.current = {
        price: price.mid,
        asOfMs: tickTimestamp,
        contractSymbol: price.contractSymbol ?? latestFuturesRef.current.contractSymbol,
        tickSize: futuresTickSize(pane.symbol),
      };
      pendingLiveTicksRef.current.push({
        mid: price.mid,
        timestamp: tickTimestamp,
        isTrade: price.isTrade,
        size: price.size,
        trades: price.trades,
        delta: price.delta,
        cached: price.cached,
      });
      if (usingDatabentoPaneFeed && isEventBasedChartInterval(pane.timeframe)) {
        if (pendingLiveTicksRef.current.length > 10_000) {
          pendingLiveTicksRef.current.splice(0, pendingLiveTicksRef.current.length - 10_000);
        }
      } else if (pendingLiveTicksRef.current.length > 512) {
        pendingLiveTicksRef.current = compactTimeBasedTicks(
          pendingLiveTicksRef.current,
          pane.timeframe,
        );
      }
      if (liveFrameRef.current !== null) return;

      liveFrameRef.current = window.requestAnimationFrame(() => {
        const queuedTicks = pendingLiveTicksRef.current.splice(0);
        liveFrameRef.current = null;
        const ticks = usingDatabentoPaneFeed && isEventBasedChartInterval(pane.timeframe)
          ? queuedTicks
          : compactTimeBasedTicks(queuedTicks, pane.timeframe);
        if (!ticks.length) return;
        if (usingDatabentoPaneFeed && needsOrderFlowHistory) {
          const liveExecutions = ticks.flatMap((tick, index): InstitutionalTrade[] => {
            const volume = Math.max(0, Number(tick.size ?? 0));
            const delta = Number(tick.delta ?? 0);
            if (!tick.isTrade || volume <= 0 || delta === 0) return [];
            return [{
              eventId: `live-${tick.timestamp}-${index}`,
              recordIndex: tick.timestamp * 10 + (index % 10),
              timestamp: tick.timestamp,
              open: tick.mid,
              high: tick.mid,
              low: tick.mid,
              close: tick.mid,
              trades: Math.max(1, Number(tick.trades ?? 1)),
              volume,
              bidVolume: delta < 0 ? volume : 0,
              askVolume: delta > 0 ? volume : 0,
              delta,
              aggressor: delta > 0 ? "BUY" : "SELL",
              sideSemanticsVersion: 2,
            }];
          });
          if (liveExecutions.length && !rithmicConnectedRef.current) {
            const nextTape = [...latestMarketTradesRef.current, ...liveExecutions].slice(-50_000);
            latestMarketTradesRef.current = nextTape;
            workspaceExecutionTape.set(workspaceOrderFlowKey(pane.symbol, pane.timeframe), nextTape);
            const now = Date.now();
            if (now - lastMarketTradeStateSyncRef.current >= 250) {
              lastMarketTradeStateSyncRef.current = now;
              setMarketTrades(nextTape);
            }
          }
        }
        const hasRenderableTick = !(
          usingDatabentoPaneFeed
          && isEventBasedChartInterval(pane.timeframe)
        ) || ticks.some((tick) => tick.isTrade);
        if (hasRenderableTick && historyHydratedRef.current) {
          setLoading(false);
          setError(null);
        }
        if (ticks.some((tick) => !tick.cached)) markMarketActive();
        setLiveFeedError(null);
        const previous = latestCandlesRef.current;
        if (
          usingDatabentoPaneFeed
          && !isEventBasedChartInterval(pane.timeframe)
          && cmeChartTailNeedsReconciliation(previous, pane.timeframe)
        ) {
          // A stale history seam must never stop the live chart. The old path
          // returned here on every subsequent tick, but did not actually start
          // reconciliation, leaving price frozen until a page refresh. Repair
          // the seam in the background while the current candle keeps painting.
          requestTailReconciliationRef.current?.();
        }
        const next = usingDatabentoPaneFeed && isEventBasedChartInterval(pane.timeframe)
          ? (() => {
              // Rithmic is the authoritative execution source whenever it is
              // connected. Its subscription already builds event bars above;
              // replaying the shared CME trades here would double the flow.
              if (rithmicConnectedRef.current) return previous;
              const trades = ticks
                .filter((tick) => tick.isTrade)
                .map((tick) => ({
                  timestamp: tick.timestamp,
                  price: tick.mid,
                  size: Number(tick.size ?? 0),
                  trades: Number(tick.trades ?? 1),
                  delta: Number(tick.delta ?? 0),
                }));
              return trades.length
                ? applyMarketTradesToEventBars(previous, trades, pane.timeframe, pane.symbol)
                : previous;
            })()
          : ticks.reduce((current, tick) => mergeLiveMidIntoCandles(
              current,
              tick.mid,
              pane.symbol,
              pane.timeframe,
              tick.timestamp,
              // Keep Databento as the uninterrupted price source, but do not
              // count its execution fields on top of the Rithmic prints.
              rithmicConnectedRef.current ? undefined : tick,
            ), previous);
        if (next === previous || !next.length) return;
        latestCandlesRef.current = next;
        const latest = next.at(-1)!;
        window.dispatchEvent(new CustomEvent(LIVE_CHART_CANDLE_EVENT, {
          detail: { key: pane.id, candle: latest },
        }));
        const newBar = previous.at(-1)?.timestamp !== latest.timestamp;
        const now = Date.now();
        if (newBar || now - lastCandleStateSyncRef.current >= 500) {
          lastCandleStateSyncRef.current = now;
          setCandles(next);
        }
      });
    };

    if (usingDatabentoPaneFeed) {
      const receiveSharedDatabentoTick = (event: Event) => {
        const price = (event as CustomEvent<LiveFeedPrice>).detail;
        if (price) consumeLivePrice(price);
      };
      window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveSharedDatabentoTick);
      return () => {
        window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveSharedDatabentoTick);
        clearPendingFrame();
      };
    }

    const stream = new EventSource(
      usingCTraderFeed
        ? `/api/ctrader/stream?broker=${encodeURIComponent(pane.broker)}&symbols=${encodeURIComponent(pane.symbol)}`
        : "/api/oanda/stream",
    );

    stream.onmessage = (event) => {
      try {
        consumeLivePrice(JSON.parse(event.data) as LiveFeedPrice);
      } catch {
        // Ignore malformed stream payloads.
      }
    };

    stream.onerror = () => {
      stream.close();
      setLiveFeedError(`${displayMarketSource(pane.broker)} reconnecting`);
      window.setTimeout(() => setStreamReconnectNonce((value) => value + 1), 1200);
    };

    return () => {
      stream.close();
      clearPendingFrame();
    };
  }, [markMarketActive, needsOrderFlowHistory, pane.broker, pane.symbol, pane.timeframe, streamReconnectNonce]);

  useEffect(() => {
    const usingMassivePaneFeed = pane.broker === "Massive" || isMassiveFuturesSymbol(pane.symbol);
    const usingMarketIndexPaneFeed = pane.broker === "Market Index" || isMarketIndexSymbol(pane.symbol);
    if (!usingMassivePaneFeed && !usingMarketIndexPaneFeed) return;

    let cancelled = false;
    let requestInFlight = false;

    const loadSnapshots = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(usingMarketIndexPaneFeed
          ? `/api/market-indices?snapshot=1&symbols=${encodeURIComponent(pane.symbol)}`
          : `/api/massive-futures/snapshot?symbols=${encodeURIComponent(pane.symbol)}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        const snapshot = Array.isArray(payload.snapshots) ? payload.snapshots[0] : null;
        if (cancelled || !snapshot || typeof snapshot.lastPrice !== "number") return;
        setLiveFeedError(null);
        if (usingMarketIndexPaneFeed && snapshot.marketOpen !== true) return;
        const tickTimestamp = marketTimestamp(snapshot.timestamp);
        const previousTimestamp = latestFuturesRef.current.asOfMs;
        if (previousTimestamp !== null && tickTimestamp < previousTimestamp) return;
        latestFuturesRef.current = {
          ...latestFuturesRef.current,
          price: snapshot.lastPrice,
          asOfMs: tickTimestamp,
        };
        markMarketActive();
        setCandles((prev) => mergeLiveMidIntoCandles(
          prev,
          snapshot.lastPrice,
          pane.symbol,
          pane.timeframe,
          tickTimestamp,
        ));
      } catch {
        if (!cancelled) {
          setLiveFeedError(usingMarketIndexPaneFeed
            ? "Cboe index snapshot is unavailable right now."
            : "Massive delayed futures snapshot is unavailable right now.");
        }
      } finally {
        requestInFlight = false;
      }
    };

    void loadSnapshots();
    const interval = window.setInterval(loadSnapshots, usingMarketIndexPaneFeed ? 2_000 : 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [markMarketActive, pane.broker, pane.symbol, pane.timeframe]);

  useEffect(() => {
    if (!dailyProfileInstance && !weeklyProfileInstance) {
      setVolumeProfiles([]);
      return;
    }
    if (!resolvedContractSymbol || candles.length === 0) return;

    let cancelled = false;
    let refreshTimer: number | null = null;
    const chartStepMs = Math.max(1, getTimeframeMs(pane.timeframe));
    const tickSize = futuresTickSize(pane.symbol);
    // Fold the live execution tape onto the bars before building the profile.
    // An OHLCV bar carries no buy/sell information at all, so a profile built
    // straight from candles has bidVolume === askVolume and every level's
    // delta is exactly zero — the delta bars then clamp to a half-pixel
    // sliver and read as "not rendering". The tape has a real aggressor per
    // print, so this makes the delta genuine rather than inferred from candle
    // direction, which is a guess dressed up as order flow.
    const profileCandles = marketTrades.length
      ? enrichCandlesWithInstitutionalTrades(candles, marketTrades, candles.length)
      : candles;
    const tradingDates = dailyTradingDateSignature
      ? dailyTradingDateSignature.split(",")
      : [];
    const provisionalProfiles: InstitutionalVolumeProfile[] = [];

    if (dailyProfileInstance) {
      tradingDates.forEach((tradingDate) => {
        const sessionCandles = profileCandles.filter((candle) =>
          chicagoTradingDate(candle.timestamp) === tradingDate);
        if (!sessionCandles.length) return;
        const sessionWindow = cmeSessionWindowForDate(tradingDate);
        const profile = buildChartVolumeProfile({
          candles: sessionCandles,
          root: displayCmeSymbol(pane.symbol),
          contractSymbol: resolvedContractSymbol,
          startMs: sessionWindow?.startMs ?? sessionCandles[0].timestamp,
          endMs: Math.min(
            sessionWindow?.endMs ?? Number.POSITIVE_INFINITY,
            sessionCandles[sessionCandles.length - 1].timestamp + chartStepMs,
          ),
          tickSize,
          groupTicks: dailyProfileSettings.groupingMode === "manual"
            ? Number(dailyProfileSettings.groupTicks ?? 1)
            : 1,
          valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
          minTradeVolume: Number(dailyProfileSettings.minTradeVolume ?? 0),
          maxTradeVolume: Number(dailyProfileSettings.maxTradeVolume ?? 0),
        });
        if (profile) {
          provisionalProfiles.push({
            ...profile,
            period: "daily",
            tradingDate,
            coverageStartMs: profile.startMs,
            // The candle reconstruction already contains volume through the
            // build instant. Only later executions should be appended live.
            coverageEndMs: Math.min(Date.now(), profile.endMs - 1),
          });
        }
      });
    }

    if (weeklyProfileInstance) {
      const weeklyDates = new Set(tradingDates.slice(-5));
      const weeklyCandles = profileCandles.filter((candle) =>
        weeklyDates.has(chicagoTradingDate(candle.timestamp)));
      if (weeklyCandles.length) {
        const profile = buildChartVolumeProfile({
          candles: weeklyCandles,
          root: displayCmeSymbol(pane.symbol),
          contractSymbol: resolvedContractSymbol,
          startMs: weeklyCandles[0].timestamp,
          endMs: weeklyCandles[weeklyCandles.length - 1].timestamp + chartStepMs,
          tickSize,
          groupTicks: weeklyProfileSettings.groupingMode === "manual"
            ? Number(weeklyProfileSettings.groupTicks ?? 4)
            : 1,
          valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
          minTradeVolume: Number(weeklyProfileSettings.minTradeVolume ?? 0),
          maxTradeVolume: Number(weeklyProfileSettings.maxTradeVolume ?? 0),
        });
        if (profile) provisionalProfiles.push({ ...profile, period: "weekly" });
      }
    }

    // Keep every visible session populated immediately while its exact
    // execution request is in flight. Exact profiles always win and remain in
    // state; the candle/tape reconstruction only fills sessions that have no
    // authoritative response yet. This preserves the historical daily
    // profiles without allowing a later effect pass to downgrade real data.
    const activeRoot = displayCmeSymbol(pane.symbol);
    const activeTradingDates = new Set(tradingDates);
    const profileSessionKey = (profile: InstitutionalVolumeProfile) =>
      `${profile.period}:${profile.period === "daily" ? chicagoTradingDate(profile.startMs) : "weekly"}`;
    setVolumeProfiles((current) => {
      const exact = current
        .filter((profile) =>
          profile.provider !== "Chart"
          && profile.root === activeRoot
          && (
            profile.period !== "daily"
            || activeTradingDates.has(chicagoTradingDate(profile.startMs))
          ));
      const exactSessions = new Set(exact.map(profileSessionKey));
      const fallback = provisionalProfiles.filter((profile) =>
        !exactSessions.has(profileSessionKey(profile)));
      return [...exact, ...fallback].sort((left, right) => left.startMs - right.startMs);
    });

    const replaceExactProfile = (
      profile: InstitutionalVolumeProfile | null,
      expectedTradingDate?: string,
    ) => {
      if (
        !profile
        || cancelled
        || !Number.isFinite(profile.startMs)
        || profile.startMs <= 0
        || !Number.isFinite(profile.endMs)
        || profile.endMs <= profile.startMs
        || !profile.levels.length
        || (
          expectedTradingDate
          && chicagoTradingDate(profile.startMs) !== expectedTradingDate
        )
      ) return;
      let replacement = profile;
      const coverageStartMs = Number(profile.coverageStartMs);
      if (
        profile.period === "daily"
        && expectedTradingDate
        && Number.isFinite(coverageStartMs)
        && coverageStartMs > profile.startMs + 60_000
      ) {
        const earlierSessionCandles = candles.filter((candle) =>
          chicagoTradingDate(candle.timestamp) === expectedTradingDate
          && candle.timestamp < coverageStartMs);
        const historicalHead = buildChartVolumeProfile({
          candles: earlierSessionCandles,
          root: profile.root,
          contractSymbol: profile.contractSymbol,
          startMs: profile.startMs,
          endMs: coverageStartMs,
          tickSize: profile.tickSize,
          groupTicks: profile.groupTicks,
          valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
          minTradeVolume: profile.minTradeVolume,
          maxTradeVolume: profile.maxTradeVolume,
        });
        if (historicalHead) {
          replacement = mergeInstitutionalVolumeProfiles(historicalHead, profile);
        }
      }
      // Databento's historical edge trails live Rithmic. Reapply the current
      // execution tape before replacing the profile so a 15-second refresh
      // cannot erase prints that have already developed the live session.
      replacement = applyInstitutionalTradesToVolumeProfile(
        replacement,
        latestMarketTradesRef.current,
      );
      setVolumeProfiles((current) => {
        const next = current.filter((candidate) => {
          if (candidate.period !== replacement.period) return true;
          if (replacement.period === "daily") {
            return chicagoTradingDate(candidate.startMs) !== chicagoTradingDate(replacement.startMs);
          }
          return false;
        });
        next.push(replacement);
        return next.sort((left, right) => left.startMs - right.startMs);
      });
    };

    const refreshExactProfiles = async () => {
      const requests: Promise<unknown>[] = [];
      if (dailyProfileInstance) {
        tradingDates.forEach((tradingDate) => {
          requests.push(fetchInstitutionalVolumeProfile({
            symbol: displayCmeSymbol(pane.symbol),
            contractSymbol: resolvedContractSymbol,
            period: "daily",
            tradingDate,
            groupTicks: dailyProfileSettings.groupingMode === "manual"
              ? Number(dailyProfileSettings.groupTicks ?? 1)
              : 1,
            valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
            minTradeVolume: Number(dailyProfileSettings.minTradeVolume ?? 0),
            maxTradeVolume: Number(dailyProfileSettings.maxTradeVolume ?? 0),
          }).then((profile) => replaceExactProfile(profile, tradingDate)));
        });
      }
      if (weeklyProfileInstance) {
        const weeklyProfile = provisionalProfiles.find((profile) => profile.period === "weekly");
        requests.push(fetchInstitutionalVolumeProfile({
          symbol: displayCmeSymbol(pane.symbol),
          contractSymbol: resolvedContractSymbol,
          period: "weekly",
          startMs: weeklyProfile?.startMs,
          endMs: weeklyProfile?.endMs,
          groupTicks: weeklyProfileSettings.groupingMode === "manual"
            ? Number(weeklyProfileSettings.groupTicks ?? 4)
            : 1,
          valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
          minTradeVolume: Number(weeklyProfileSettings.minTradeVolume ?? 0),
          maxTradeVolume: Number(weeklyProfileSettings.maxTradeVolume ?? 0),
        }).then(replaceExactProfile));
      }
      await Promise.allSettled(requests);
      if (!cancelled) {
        refreshTimer = window.setTimeout(() => void refreshExactProfiles(), 15_000);
      }
    };
    void refreshExactProfiles();

    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [
    dailyProfileInstance?.instanceId,
    dailyProfileSettings.groupTicks,
    dailyProfileSettings.groupingMode,
    dailyProfileSettings.maxTradeVolume,
    dailyProfileSettings.minTradeVolume,
    dailyTradingDateSignature,
    // Coarse tape signal: rebuild the provisional profile as executions
    // accumulate so its delta fills in, without re-running this effect (and
    // its 15s refresh loop) on every print.
    Math.floor(marketTrades.length / 250),
    pane.symbol,
    pane.timeframe,
    resolvedContractSymbol,
    weeklyProfileInstance?.instanceId,
    weeklyProfileSettings.groupTicks,
    weeklyProfileSettings.groupingMode,
    weeklyProfileSettings.maxTradeVolume,
    weeklyProfileSettings.minTradeVolume,
  ]);

  useEffect(() => {
    if (!active) {
      setIntervalCommandOpen(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && intervalCommandOpen) {
        event.preventDefault();
        setIntervalCommandOpen(false);
        setIntervalCommandDraft("");
        setIntervalCommandError("");
        return;
      }
      const target = event.target as HTMLElement | null;
      const editingText = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable;
      if (editingText || event.code !== "Space" || event.repeat) return;

      event.preventDefault();
      setIntervalCommandOpen(true);
      setIntervalCommandDraft("");
      setIntervalCommandError("");
      window.requestAnimationFrame(() => intervalCommandInputRef.current?.focus());
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, intervalCommandOpen]);

  useEffect(() => {
    if (!intervalCommandOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && intervalCommandPanelRef.current?.contains(target)) return;
      setIntervalCommandOpen(false);
      setIntervalCommandDraft("");
      setIntervalCommandError("");
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [intervalCommandOpen]);

  const submitIntervalCommand = () => {
    const interval = parseChartIntervalInput(intervalCommandDraft);
    if (!interval) {
      setIntervalCommandError("Try 5m, 5 min, 30s, 2h, 1D, 500v or 40r");
      return;
    }
    if (!onSelectTimeframe(interval)) {
      setIntervalCommandError(`${formatChartInterval(interval)} is unavailable for this feed`);
      return;
    }
    setIntervalCommandOpen(false);
    setIntervalCommandDraft("");
    setIntervalCommandError("");
  };

  return (
    <div
      onMouseDown={onActivate}
      className={`relative h-full overflow-hidden bg-panel ${embedded
        ? active ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent)]" : ""
        : `rounded-2xl border ${active ? "border-primary/50 shadow-[0_0_0_1px_rgba(236,72,153,0.28)]" : "border-border"}`}`}
    >
      {!embedded && (onDetach || onClose) && (
        <div className="absolute right-2 top-2 z-[70] flex items-center gap-1">
          {onDetach && (
            <button
              type="button"
              disabled={detachDisabled}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (!detachDisabled) onDetach();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-panel/90 text-muted shadow-lg backdrop-blur transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
              title={detachDisabled ? "Unlock the workspace to detach this chart" : "Detach into a floating window"}
              aria-label="Detach chart"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
          <button
            type="button"
            disabled={closeDisabled}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-panel/90 text-muted shadow-lg backdrop-blur transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-35"
            title={closeDisabled ? "A workspace must keep one chart" : "Remove chart"}
            aria-label="Remove chart"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          )}
        </div>
      )}
      {loading ? (
        <div className="absolute inset-0 z-10" style={{ backgroundColor: settings.backgroundColor }}>
          <KwantLoader
            className="h-full w-full"
            style={{ backgroundColor: settings.backgroundColor }}
            icon={BarChart3}
            title="Loading chart"
            detail={`${displayCmeSymbol(pane.symbol)} · restoring ${formatChartInterval(pane.timeframe)} candles`}
          />
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center text-[13px] text-muted">{error}</div>
      ) : (
        <Chart
          candles={candles}
          marketTrades={marketTrades}
          trades={trades}
          levels={chartLevels}
          zones={historicalStructureEnabled ? structure.snapshot.zones : []}
          backgroundLevels={gameplanDecorations.levels}
          backgroundZones={gameplanDecorations.zones}
          instrument={displayCmeSymbol(pane.symbol)}
          contractSymbol={resolvedContractSymbol}
          timeframe={pane.timeframe}
          marketIsActive={marketIsActive}
          orderFlowHistoryReady={orderFlowHistoryReady}
          settings={settings}
          onOpenSettings={onOpenSettings}
          onCreateAlertAtPrice={onCreateAlertAtPrice}
          onRemoveAllIndicators={onRemoveAllIndicators}
          indicators={indicators}
          classicGexProfile={classicGexProfileWithZero}
          classicGexHistory={classicGexHistory}
          classicGexLoading={classicGexLoading}
          classicGexError={classicGexError}
          expectedMoveCalibration={expectedMoveCalibration}
          volumeProfiles={volumeProfiles}
          onUpdateIndicatorSetting={onUpdateIndicatorSetting}
          toolbarEnabled
          chartDragEnabled={chartDragEnabled}
          onChartDragStart={onChartDragStart}
          gammaLevelsEnabled={gammaLevelsEnabled}
          gammaLevelsAvailable={gammaLevelsAvailable}
          gammaLevelsLoading={gammaLevelsLoading}
          gammaLevelsError={gammaLevelsError}
          onToggleGammaLevels={onToggleGammaLevels}
          kwantLevelsEnabled={kwantLevelsEnabled}
          kwantLevelsAvailable={kwantLevelsAvailable}
          kwantLevelsLoading={kwantLevelsLoading}
          onToggleKwantLevels={onToggleKwantLevels}
          historicalStructureEnabled={historicalStructureEnabled}
          historicalStructureAvailable={pane.broker === "Databento" && isContinuousFuture(pane.symbol)}
          historicalStructureLoading={structure.loading}
          historicalStructureError={structure.error}
          historicalStructureDescription={structure.snapshot.note}
          onToggleHistoricalStructure={onToggleHistoricalStructure}
          valueAreaLevelsEnabled={valueAreaLevelsEnabled}
          valueAreaLevelsAvailable={valueAreaLevelsAvailable}
          valueAreaLevelsLoading={valueAreaLevelsLoading}
          valueAreaLevelsError={valueAreaLevelsError}
          valueAreaLevelsDescription={
            valueAreaOverlay
              ? `${valueAreaOverlay.currentLabel ? `${valueAreaOverlay.currentLabel} · ` : ""}Prior session ${valueAreaOverlay.dailyLabel} · Prior week ${valueAreaOverlay.weeklyLabel}`
              : ""
          }
          onToggleValueAreaLevels={onToggleValueAreaLevels}
          onRemoveGameplanOverlay={gameplanOverlay ? onRemoveGameplanOverlay : undefined}
          liveCandleEventKey={pane.id}
          gexBotFlow={gammaInstrument === "NQ" || gammaInstrument === "MNQ" ? gexBotFlow : null}
          onIndicatorPaneHeightChange={setLowerIndicatorHeight}
          paperPositions={paperPositions}
          paperFills={paperFills}
          onUpdatePaperProtection={onUpdatePaperProtection}
          onClosePaperPosition={onClosePaperPosition}
        />
      )}
      {loadingMessage ? (
        <div
          className="pointer-events-none absolute left-1/2 z-30 max-w-[calc(100%-32px)] -translate-x-1/2 truncate rounded-lg border border-border bg-panel/92 px-3 py-1.5 text-[10px] text-muted shadow-lg shadow-black/25 backdrop-blur"
          style={{ bottom: 86 + lowerIndicatorHeight }}
        >
          {loadingMessage}
        </div>
      ) : null}
      <div
        className="absolute left-3 z-20 flex h-8 items-center gap-0.5 rounded-lg border border-border bg-panel/80 px-1 backdrop-blur"
        style={{ bottom: 56 + lowerIndicatorHeight }}
      >
        {["1D", "5D", "1W", "1M", "3M", "6M", "1Y", "All"].map((range) => (
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
      {intervalCommandOpen && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div
            ref={intervalCommandPanelRef}
            className="pointer-events-auto w-[300px] max-w-[calc(100%-32px)] rounded-2xl border border-border bg-panel/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <Search className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium text-foreground">Change interval</span>
              <span className="ml-auto rounded-md border border-border bg-surface px-1.5 py-0.5 text-[9px] text-muted">ESC</span>
            </div>
            <input
              ref={intervalCommandInputRef}
              value={intervalCommandDraft}
              onChange={(event) => {
                setIntervalCommandDraft(event.target.value);
                setIntervalCommandError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitIntervalCommand();
                }
              }}
              autoFocus
              spellCheck={false}
              placeholder="Type 5m, 40 range or 500 volume"
              aria-label="Chart interval"
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 font-mono text-[15px] text-foreground outline-none transition-colors placeholder:text-muted/55 focus:border-primary/60"
            />
            <div className={`mt-2 px-1 text-[10px] ${intervalCommandError ? "text-danger" : "text-muted"}`}>
              {intervalCommandError || "Seconds · minutes · hours · days · weeks · event bars"}
            </div>
          </div>
        </div>
      )}
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

function KwantBotAvatar({
  compact = false,
  speaking = false,
}: {
  compact?: boolean;
  speaking?: boolean;
}) {
  if (compact) {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-primary/30 bg-background shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--primary)_24%,transparent),transparent_68%)]" />
        <div className={speaking ? "kwantbot-avatar-speaking" : ""}>
          <Image
            src="/images/kwantbot-avatar.png"
            alt=""
            width={82}
            height={82}
            className="absolute -top-px left-1/2 h-[82px] w-[82px] max-w-none -translate-x-1/2 object-contain grayscale"
          />
        </div>
        <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border-2 border-panel bg-primary shadow-[0_0_8px_var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="kwantbot-avatar-float relative h-[108px] w-[108px] shrink-0">
      <div className="absolute inset-3 rounded-full bg-primary/15 blur-2xl" />
      <Image
        src="/images/kwantbot-avatar.png"
        alt="Kwant Bot"
        width={108}
        height={108}
        priority
        className="relative h-full w-full object-contain grayscale contrast-[1.1] drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: "var(--primary)",
          WebkitMaskImage: "url('/images/kwantbot-avatar.png')",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskImage: "url('/images/kwantbot-avatar.png')",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
        }}
      />
    </div>
  );
}

function formatKwantBotMessageTime(value: string) {
  if (!value) return "Now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Now";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function kwantBotId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeKwantBotMessages(value: unknown): KwantBotMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const message = entry as Partial<KwantBotMessage>;
      if (
        typeof message.id !== "string"
        || message.id === "kwantbot-incoming-only"
        || typeof message.text !== "string"
      ) {
        return [];
      }
      const attachments = Array.isArray(message.attachments)
        ? message.attachments.filter((attachment): attachment is KwantBotAttachment => Boolean(
            attachment
            && typeof attachment.id === "string"
            && typeof attachment.name === "string"
            && typeof attachment.type === "string"
            && typeof attachment.size === "number"
            && typeof attachment.dataUrl === "string"
            && attachment.dataUrl,
          ))
        : [];
      return [{
        id: message.id,
        text: message.text.slice(0, 4_000),
        receivedAt: typeof message.receivedAt === "string" ? message.receivedAt : "",
        sender: message.sender === "user" ? "user" as const : "bot" as const,
        attachments: attachments.length ? attachments.slice(0, 4) : undefined,
      }];
    })
    .filter((message) => message.text.trim() || message.attachments?.length)
    .slice(-100);
}

function readAttachment(file: File) {
  return new Promise<KwantBotAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: kwantBotId("attachment"),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: String(reader.result ?? ""),
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isImageAttachment(attachment: KwantBotAttachment) {
  return attachment.type.startsWith("image/");
}

function KwantBotAttachments({
  attachments,
  compact = false,
  onRemove,
}: {
  attachments: KwantBotAttachment[];
  compact?: boolean;
  onRemove?: (id: string) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className={`grid gap-1.5 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className={`group relative min-w-0 overflow-hidden rounded-xl border border-border/80 bg-background/35 ${compact ? "h-14" : ""}`}
        >
          {isImageAttachment(attachment) ? (
            <a href={attachment.dataUrl} download={attachment.name} className="block h-full">
              <Image
                src={attachment.dataUrl}
                alt={attachment.name}
                width={240}
                height={160}
                unoptimized
                className={`${compact ? "h-14" : "max-h-48 min-h-24"} w-full object-cover`}
              />
            </a>
          ) : (
            <a href={attachment.dataUrl} download={attachment.name} className={`flex items-center gap-2 px-2.5 ${compact ? "h-14" : "min-h-14 py-2.5"}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-medium text-foreground">{attachment.name}</span>
                <span className="block text-[9px] text-muted">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
              </span>
            </a>
          )}
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/85 text-muted shadow-md backdrop-blur transition-colors hover:text-foreground"
              title={`Remove ${attachment.name}`}
              aria-label={`Remove ${attachment.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function KwantifyWorkspace({
  section = "charts",
  socialProfileHandle = "",
}: {
  section?: PrimaryWorkspaceSection;
  socialProfileHandle?: string;
}) {
  const router = useRouter();
  const [optimisticWorkspaceSection, setOptimisticWorkspaceSection] = useState(section);
  const [visitedWorkspaceSections, setVisitedWorkspaceSections] = useState<Set<PrimaryWorkspaceSection>>(
    () => new Set([section]),
  );
  const activeWorkspaceSectionRef = useRef<PrimaryWorkspaceSection | null>(section);
  const pendingWorkspaceNavigationRef = useRef<PrimaryWorkspaceSection | null>(null);
  useEffect(() => {
    // Route state must never wait behind a dynamic import. On a busy live
    // chart the order-flow engine can occupy the main thread in short bursts;
    // waiting for a bundle here made a valid navigation look like a dead
    // button. Switch first so the chart unmounts, then warm the destination.
    const pendingSection = pendingWorkspaceNavigationRef.current;
    if (pendingSection && section !== pendingSection) {
      // A passive route effect from initial hydration can arrive after a fast
      // user click. It represents the page we are leaving, so it must never
      // overwrite the newer optimistic destination.
      return;
    }
    pendingWorkspaceNavigationRef.current = null;
    activeWorkspaceSectionRef.current = section;
    setOptimisticWorkspaceSection(section);
    setVisitedWorkspaceSections((current) => {
      if (current.has(section)) return current;
      const next = new Set(current);
      next.add(section);
      return next;
    });
    void preloadWorkspaceModule(section).catch(() => null);
  }, [section]);
  const supabase = useMemo(() => createClient(), []);
  const [authChecked, setAuthChecked] = useState(false);
  const warmWorkspaceSection = useCallback((target: string) => {
    void preloadWorkspaceModule(target).catch(() => null);
    void preloadWorkspaceData(target).catch(() => null);
  }, []);
  const [preferenceUserId, setPreferenceUserId] = useState("");
  const [preferencesReady, setPreferencesReady] = useState(false);
  useAccountPreferenceSync({
    supabase,
    userId: preferenceUserId,
    enabled: preferencesReady,
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState("");
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
  const [selectedInstrument, setSelectedInstrument] = useState("ES.v.0");
  const [selectedLiquidityMapInstrument, setSelectedLiquidityMapInstrument] = useState(() => {
    if (typeof window === "undefined") return "NQ.v.0";
    const saved = window.localStorage.getItem(LIQUIDITY_MAP_INSTRUMENT_STORAGE_KEY) || "NQ.v.0";
    return liquidityMapInstrument(saved) || "NQ.v.0";
  });
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(() => {
    if (typeof window === "undefined") return "single";
    try {
      const saved = window.localStorage.getItem("olisa-chart-workspace-layout") as WorkspaceLayout | null;
      return saved === "split-vertical" || saved === "split-horizontal" || saved === "quad" || saved === "single" || saved === "custom" ? saved : "single";
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
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceLayoutNode>(() => {
    const fallbackLayout = workspaceLayout === "custom" ? "single" : workspaceLayout;
    if (typeof window === "undefined") return createWorkspaceLayoutTree(fallbackLayout, workspacePanes);
    try {
      const parsed = JSON.parse(window.localStorage.getItem("olisa-chart-workspace-tree") ?? "null");
      return normalizeWorkspaceLayoutNode(parsed, new Set(workspacePanes.map((pane) => pane.id)))
        ?? createWorkspaceLayoutTree(fallbackLayout, workspacePanes);
    } catch {
      return createWorkspaceLayoutTree(fallbackLayout, workspacePanes);
    }
  });
  const [workspaceFloatingWindows, setWorkspaceFloatingWindows] = useState<WorkspaceFloatingWindow[]>(() =>
    loadWorkspaceFloatingWindows(new Set(workspacePanes.map((pane) => pane.id))));
  const [workspacePresets, setWorkspacePresets] = useState<WorkspacePreset[]>(loadLocalWorkspacePresets);
  const [activeWorkspacePresetId, setActiveWorkspacePresetId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_WORKSPACE_PRESET_STORAGE_KEY);
  });
  const [workspaceImportDragging, setWorkspaceImportDragging] = useState(false);
  const [workspaceDeleteCandidate, setWorkspaceDeleteCandidate] = useState<WorkspacePreset | null>(null);
  const [showWorkspacePresetMenu, setShowWorkspacePresetMenu] = useState(false);
  const [showSaveWorkspacePreset, setShowSaveWorkspacePreset] = useState(false);
  const [workspacePresetName, setWorkspacePresetName] = useState("");
  const [workspacePresetMenuPosition, setWorkspacePresetMenuPosition] = useState({ top: 48, left: 12 });
  const workspacePresetButtonRef = useRef<HTMLButtonElement>(null);
  const workspacePresetMenuRef = useRef<HTMLDivElement>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement>(null);
  const workspaceAreaRef = useRef<HTMLDivElement>(null);
  const workspaceDragGhostRef = useRef<HTMLDivElement>(null);
  const workspaceHeaderDragConsumedRef = useRef(false);
  const [activePaneId, setActivePaneId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANES[0].id;
    return window.localStorage.getItem("olisa-chart-workspace-active-pane") ?? DEFAULT_WORKSPACE_PANES[0].id;
  });
  const [workspacePanelPickerPaneId, setWorkspacePanelPickerPaneId] = useState<string | null>(null);
  const [workspacePanelTransition, setWorkspacePanelTransition] = useState<{
    paneId: string;
    content: WorkspacePanelKind;
  } | null>(null);
  const [draggedWorkspacePaneId, setDraggedWorkspacePaneId] = useState<string | null>(null);
  const [workspaceDropTargetPaneId, setWorkspaceDropTargetPaneId] = useState<string | null>(null);
  const [workspaceDropZone, setWorkspaceDropZone] = useState<WorkspaceDropZone>("center");
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    ...DATABENTO_DEFAULT_SYMBOLS.map((symbol) => createWatchlistItem(symbol, "Databento")),
    ...MARKET_INDEX_DEFINITIONS.map((index) => createWatchlistItem(index.symbol, "Market Index")),
  ]);
  const [watchlistContextMenu, setWatchlistContextMenu] = useState<{ x: number; y: number; key: string; symbol: string } | null>(null);
  const [watchlistPanelContextMenu, setWatchlistPanelContextMenu] = useState<{ x: number; y: number } | null>(null);
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
      const containsLegacyMarket = Array.isArray(saved) && saved.some((section) =>
        Array.isArray(section?.symbols) && section.symbols.some((key: unknown) =>
          typeof key !== "string"
          || (!key.startsWith("Databento::") && !key.startsWith("Market Index::"))),
      );
      if (!Array.isArray(saved) || saved.length === 0 || containsLegacyMarket) return defaultWatchlistSections;
      const hasMarketIndices = saved.some((section) =>
        Array.isArray(section?.symbols)
        && section.symbols.some((key: unknown) => typeof key === "string" && key.startsWith("Market Index::")),
      );
      return hasMarketIndices
        ? saved
        : [...saved, defaultWatchlistSections.find((section) => section.id === "macro")!];
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
  const [databentoOptions, setDatabentoOptions] = useState<DatabentoInstrument[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedWatchlistKey, setSelectedWatchlistKey] = useState<string>(makeWatchlistKey("ES.v.0", "Databento"));
  const [selectedTimeframe, setSelectedTimeframe] = useState("5m");
  const [selectedPeriod, setSelectedPeriod] = useState(DEFAULT_WORKSPACE_PANES[0].period);
  const [chartLoadingMessage, setChartLoadingMessage] = useState("");
  const [feedErrorByBroker, setFeedErrorByBroker] = useState<Record<string, string>>({});
  const [streamHealthyByBroker, setStreamHealthyByBroker] = useState<Record<string, boolean>>({});
  const lastStreamTickAtByBrokerRef = useRef<Record<string, number>>({});
  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [rightPanel, setRightPanel] = useState<RightPanel | null>(() => {
    if (typeof window === "undefined") return "watchlist";
    const saved = window.localStorage.getItem("kwantdesk-right-panel-state");
    return saved === "order"
      || saved === "watchlist"
      || saved === "gex"
      || saved === "zyon"
      || saved === "kwantbot"
      || saved === "optionstape"
      || saved === "alerts"
      || saved === "alertslog"
      || saved === "friends"
      || saved === "messages"
      ? saved
      : saved === ""
        ? null
        : "watchlist";
  });
  const [friendsInitialFriendId, setFriendsInitialFriendId] = useState("");
  const [lastOpenRightPanel, setLastOpenRightPanel] = useState<RightPanel>(() => {
    if (typeof window === "undefined") return "watchlist";
    const saved = window.localStorage.getItem("kwantdesk-right-panel-state");
    return saved === "order"
      || saved === "watchlist"
      || saved === "gex"
      || saved === "zyon"
      || saved === "kwantbot"
      || saved === "optionstape"
      || saved === "alerts"
      || saved === "alertslog"
      || saved === "friends"
      || saved === "messages"
      ? saved
      : "watchlist";
  });
  const [kwantBotMessages, setKwantBotMessages] = useState<KwantBotMessage[]>(() => {
    if (typeof window === "undefined") return DEFAULT_KWANTBOT_MESSAGES;
    try {
      const clean = normalizeKwantBotMessages(
        JSON.parse(window.localStorage.getItem(KWANTBOT_MESSAGES_STORAGE_KEY) ?? "[]"),
      );
      return clean.length ? clean : DEFAULT_KWANTBOT_MESSAGES;
    } catch {
      return DEFAULT_KWANTBOT_MESSAGES;
    }
  });
  const [kwantBotStoreReady, setKwantBotStoreReady] = useState(false);
  const [kwantBotDraft, setKwantBotDraft] = useState("");
  const [kwantBotDraftAttachments, setKwantBotDraftAttachments] = useState<KwantBotAttachment[]>([]);
  const [kwantBotAttachmentError, setKwantBotAttachmentError] = useState("");
  const [kwantBotAttaching, setKwantBotAttaching] = useState(false);
  const [kwantBotReplying, setKwantBotReplying] = useState(false);
  const [kwantBotSendError, setKwantBotSendError] = useState("");
  const [kwantBotUnreadCount, setKwantBotUnreadCount] = useState(0);
  const [showChartAlertModal, setShowChartAlertModal] = useState(false);
  const [chartAlertPriceDraft, setChartAlertPriceDraft] = useState<string>("");
  const [chartAlerts, setChartAlerts] = useState<ChartAlertRecord[]>([]);
  const [editingChartAlert, setEditingChartAlert] = useState<ChartAlertRecord | null>(null);
  const [pendingAlertDelete, setPendingAlertDelete] = useState<ChartAlertRecord | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_DEFAULT_WIDTH);
  const kwantBotInterpreter = useKwantBotInterpreter({
    initialRoot: gameplanChartRootForInstrument(selectedInstrument) ?? "NQ",
    panelOpen: rightPanel === "kwantbot",
    optionsPanelOpen: rightPanel === "optionstape",
    enabled: section === "kwantbot"
      || section === "zyon"
      || (
        section === "charts"
        && (rightPanel === "kwantbot" || rightPanel === "optionstape" || rightPanel === "zyon")
      ),
  });
  const [alertLogCount, setAlertLogCount] = useState(5);
  const [alertsPanelTab, setAlertsPanelTab] = useState<AlertsPanelTab>("social");
  const socialNotifications = useSocialNotifications();
  const [friendsUnreadCount, setFriendsUnreadCount] = useState(0);
  const [friendMessageUnreadCount, setFriendMessageUnreadCount] = useState(0);
  const [friendsOnlineCount, setFriendsOnlineCount] = useState(0);
  const [friendMessageToast, setFriendMessageToast] = useState<FriendMessageToast | null>(null);
  const [showTradesMenu, setShowTradesMenu] = useState(false);
  const [tradesMenuView, setTradesMenuView] = useState<"root" | "paper">("root");
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [brokerSearch, setBrokerSearch] = useState("");
  const [brokerFavourites, setBrokerFavourites] = useState<string[]>([]);
  const [connectedBroker, setConnectedBroker] = useState<string | null>("Databento");
  const [brokerConnections, setBrokerConnections] = useState<Record<string, BrokerConnectionState>>({});
  const [linkedCTraderAccounts, setLinkedCTraderAccounts] = useState<CTraderStatusAccount[]>([]);
  const [paperTradingAccounts, setPaperTradingAccounts] = useState<PaperTradingAccountRecord[]>([]);
  const [selectedPaperAccountId, setSelectedPaperAccountId] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("kwantify-selected-paper-account") ?? "");
  const [paperLedger, setPaperLedger] = useState<PaperTradingLedger>(() =>
    typeof window === "undefined" ? emptyPaperTradingLedger() : loadPaperTradingLedger());
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [brokerMode, setBrokerMode] = useState<"Live" | "Demo">("Demo");
  const [showQuickPaperAccountForm, setShowQuickPaperAccountForm] = useState(false);
  const [paperAccountName, setPaperAccountName] = useState("");
  const [paperAccountBalance, setPaperAccountBalance] = useState("$10,000");
  const [paperAccountInstrument, setPaperAccountInstrument] = useState("All CME Futures");
  const [paperAccountLeverage, setPaperAccountLeverage] = useState("1:30");
  const [paperAccountStrategy, setPaperAccountStrategy] = useState("Manual / No Strategy");
  const [orderUnits, setOrderUnits] = useState("1");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderTP, setOrderTP] = useState("");
  const [orderSL, setOrderSL] = useState("");
  const [orderTicketMessage, setOrderTicketMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [showExits, setShowExits] = useState(true);
  const [unitsType, setUnitsType] = useState<"units" | "lots" | "usd" | "pctBalance">("units");
  const [tpType, setTpType] = useState<"price" | "ticks" | "pctPrice" | "rewardUsd" | "rewardPct">("price");
  const [slType, setSlType] = useState<"price" | "ticks" | "pctPrice" | "riskUsd" | "riskPct">("price");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(BOTTOM_PANEL_DEFAULT_HEIGHT);
  const [bottomMinimized, setBottomMinimized] = useState(true);
  const bottomWorkspaceSection = optimisticWorkspaceSection;
  const [equityPeriod, setEquityPeriod] = useState("365d");
  const [favTFs, setFavTFs] = useState<string[]>(() => {
    const defaults = ["1m", "5m", "15m", "1h", "4h", "1D"];
    if (typeof window === "undefined") return defaults;
    try {
      const saved = JSON.parse(window.localStorage.getItem("olisa-chart-favourite-intervals") ?? "null");
      return Array.isArray(saved) && saved.every((item) => typeof item === "string")
        ? saved
        : defaults;
    } catch {
      return defaults;
    }
  });
  const [showAllTF, setShowAllTF] = useState(false);
  const timeframeMenuRef = useRef<HTMLDivElement>(null);
  const [intervalDrafts, setIntervalDrafts] = useState<Record<ChartIntervalKind, { primary: number; secondary: number }>>({
    second: { primary: 1, secondary: 1 },
    minute: { primary: 1, secondary: 1 },
    time: { primary: 1, secondary: 1 },
    "volume-bars": { primary: 4, secondary: 2 },
    range: { primary: 40, secondary: 1 },
    volume: { primary: 500, secondary: 1 },
    trade: { primary: 100, secondary: 1 },
    renko: { primary: 8, secondary: 1 },
    "point-figure": { primary: 1, secondary: 27 },
    delta: { primary: 100, secondary: 1 },
  });
  const [showMiniAI, setShowMiniAI] = useState(false);
  const [miniExpanded, setMiniExpanded] = useState(false);
  const [miniMessages, setMiniMessages] = useState<Message[]>([]);
  const [miniInput, setMiniInput] = useState("");
  const [miniLoading, setMiniLoading] = useState(false);
  const [strategies, setStrategies] = useState<StrategyItem[]>(demoStrategies);
  const [chartIndicatorsSuppressed, setChartIndicatorsSuppressed] = useState(false);
  const [paneIndicators, setPaneIndicators] = useState<Record<string, ChartIndicatorInstance[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const current = window.localStorage.getItem(CHART_INDICATORS_STORAGE_KEY);
      const legacy = window.localStorage.getItem("olisa-chart-pane-indicators");
      return normalizePaneIndicatorState(JSON.parse(current ?? legacy ?? "{}"));
    } catch {
      return {};
    }
  });
  const [paneLevelVisibility, setPaneLevelVisibility] = useState<Record<string, PaneLevelVisibility>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(PANE_LEVEL_VISIBILITY_STORAGE_KEY);
      if (stored) return normalizePaneLevelVisibility(JSON.parse(stored));
    } catch {
      // Migrate the former workspace-wide toggles onto the selected chart below.
    }
    const legacyVisibility: PaneLevelVisibility = {
      gamma: window.localStorage.getItem(GAMMA_LEVELS_ENABLED_STORAGE_KEY) === "true",
      kwant: false,
      structure: window.localStorage.getItem(HISTORICAL_STRUCTURE_ENABLED_STORAGE_KEY) === "true",
      valueArea: window.localStorage.getItem(VALUE_AREA_LEVELS_ENABLED_STORAGE_KEY) === "true",
    };
    return Object.values(legacyVisibility).some(Boolean) ? { [activePaneId]: legacyVisibility } : {};
  });
  const [liveGexSnapshot, setLiveGexSnapshot] = useState<ChartGammaLevelsPayload | null>(null);
  const [liveGexLoading, setLiveGexLoading] = useState(false);
  const [liveGexError, setLiveGexError] = useState("");
  const liveGexCalibrationPriceRef = useRef<number | null>(null);
  const [showLevelsExport, setShowLevelsExport] = useState(false);
  const [levelExportTypes, setLevelExportTypes] = useState<Record<LevelExportType, boolean>>({
    gamma: true,
    gameplan: true,
    valueArea: false,
    historicalStructure: false,
  });
  const [levelExportFormat, setLevelExportFormat] = useState<PlatformLevelExportFormat>("deepcharts");
  const [selectedLevelExportInstruments, setSelectedLevelExportInstruments] = useState<string[]>([]);
  const [levelExportError, setLevelExportError] = useState("");
  const [gammaLevelExportsByPane, setGammaLevelExportsByPane] = useState<Record<string, GammaLevelExportSnapshot>>({});
  const [gameplanChartOverlays, setGameplanChartOverlays] = useState<GameplanChartOverlayStore>(() =>
    loadGameplanChartOverlays());
  const [quickGameplanLoading, setQuickGameplanLoading] = useState(false);
  const [quickGameplanLoadingRoot, setQuickGameplanLoadingRoot] = useState<"NQ" | "ES" | null>(null);
  const quickGameplanRequestRef = useRef(false);
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
  const friendMessageToastTimeoutRef = useRef<number | null>(null);
  const seenIncomingFriendMessageIdsRef = useRef(new Set<string>());
  const chartLaunchAppliedRef = useRef(false);
  const chartLaunchRunRef = useRef(false);
  const kwantBotMessagesEndRef = useRef<HTMLDivElement>(null);
  const kwantBotAttachmentInputRef = useRef<HTMLInputElement>(null);
  const kwantBotComposerRef = useRef<HTMLTextAreaElement>(null);
  const pendingWatchlistPricesRef = useRef<Map<string, LiveFeedPrice>>(new Map());
  const pendingLiveQuoteCacheRef = useRef<Map<string, LiveFeedPrice & { openPrice?: number }>>(new Map());
  const watchlistLiveFrameRef = useRef<number | null>(null);
  const liveQuoteCacheTimerRef = useRef<number | null>(null);
  const watchlistRef = useRef(watchlist);

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let viewerId = "";
    let refreshTimer: number | null = null;
    let presenceTimer: number | null = null;

    let friendIds = new Set<string>();
    let friendProfiles = new Map<string, FriendsPayload["friends"][number]>();

    const refreshFriendBadge = async () => {
      try {
        const response = await fetch("/api/friends", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = await response.json() as FriendsPayload;
        friendIds = new Set(next.friends.map((friend) => friend.userId));
        friendProfiles = new Map(next.friends.map((friend) => [friend.userId, friend]));
        const messageUnread = next.friends.reduce((total, friend) => total + friend.unreadCount, 0)
          + next.groups.reduce((total, group) => total + (group.muted ? 0 : group.unreadCount), 0);
        const unread = next.incoming.length
          + messageUnread;
        const online = next.friends.filter((friend) => friend.isOnline).length;
        if (!cancelled) {
          setFriendsUnreadCount(unread);
          setFriendMessageUnreadCount(messageUnread);
          setFriendsOnlineCount(online);
        }
      } catch {
        // Friends remain available from the rail if this background badge refresh fails.
      }
    };

    const heartbeat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "heartbeat",
            lightweight: true,
            timeZone: ACTIVITY_STREAK_TIME_ZONE,
          }),
        });
        if (response.ok) {
          const result = await response.json() as { streak?: Record<string, unknown> | null };
          if (result.streak) {
            window.dispatchEvent(new CustomEvent("kwantdesk:activity-streak-changed", { detail: result.streak }));
          }
        }
      } catch {
        // Presence catches up on the next heartbeat.
      }
    };

    void supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (cancelled || !data.user) return;
      viewerId = data.user.id;
      void heartbeat();
      void refreshFriendBadge();
      presenceTimer = window.setInterval(() => {
        void heartbeat();
        void refreshFriendBadge();
      }, 60_000);
    });

    const channel = supabase
      .channel("kwantdesk-friends-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_objects" },
        (event: { eventType?: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const nextRow = event.new as { id?: string; user_id?: string; author_label?: string; object_type?: string; payload?: Record<string, unknown> };
          const previousRow = event.old as { user_id?: string; payload?: Record<string, unknown> };
          const row = nextRow.user_id ? nextRow : previousRow;
          const rowPayload = row.payload ?? {};
          const relevant = Boolean(
            viewerId
            && (
              row.user_id === viewerId
              || friendIds.has(row.user_id ?? "")
              || rowPayload.targetUserId === viewerId
              || rowPayload.recipientUserId === viewerId
            )
          );
          if (!relevant) return;
          const messageId = String(nextRow.id ?? "");
          const isIncomingFriendMessage = event.eventType === "INSERT"
            && nextRow.object_type === "comment"
            && rowPayload.kind === "friend-message"
            && rowPayload.recipientUserId === viewerId
            && nextRow.user_id !== viewerId
            && messageId.length > 0;
          if (isIncomingFriendMessage && !seenIncomingFriendMessageIdsRef.current.has(messageId)) {
            seenIncomingFriendMessageIdsRef.current.add(messageId);
            const sender = friendProfiles.get(nextRow.user_id ?? "");
            const body = String(rowPayload.body ?? "").trim();
            const attachments = Array.isArray(rowPayload.attachments) ? rowPayload.attachments : [];
            const preview = body
              || (attachments.length > 0 ? "Sent you a photo" : rowPayload.sharedTrade ? "Shared a trade" : "Sent you a message");
            setFriendMessageToast({
              id: messageId,
              senderUserId: nextRow.user_id ?? "",
              senderName: sender?.displayName || nextRow.author_label || "A friend",
              senderHandle: sender?.handle ?? "",
              avatarUrl: sender?.avatarUrl ?? "",
              preview,
            });
            if (friendMessageToastTimeoutRef.current) window.clearTimeout(friendMessageToastTimeoutRef.current);
            friendMessageToastTimeoutRef.current = window.setTimeout(() => {
              setFriendMessageToast(null);
              friendMessageToastTimeoutRef.current = null;
            }, 6_500);
          }
          if (refreshTimer) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void refreshFriendBadge(), 300);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (presenceTimer) window.clearInterval(presenceTimer);
      if (friendMessageToastTimeoutRef.current) window.clearTimeout(friendMessageToastTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

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
  const usingMarketIndexFeed = connectedBroker === "Market Index" || isMarketIndexSymbol(selectedInstrument);
  const usingDatabentoFeed = connectedBroker === "Databento";
  const activeChartBrokerLabel = usingDatabentoFeed
    ? "Databento"
    : usingMarketIndexFeed
      ? "Market Index"
      : usingCTraderFeed && connectedBroker
        ? connectedBroker
        : usingMassiveFeed
          ? "Massive"
          : "OANDA";
  const availableChartIntervalGroups = useMemo(
    () => CHART_INTERVAL_GROUPS
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => supportsChartInterval(option.id, activeChartBrokerLabel)),
      }))
      .filter((group) => group.options.length > 0),
    [activeChartBrokerLabel],
  );
  const visibleFavouriteIntervals = useMemo(
    () => favTFs.filter((interval) => supportsChartInterval(interval, activeChartBrokerLabel)),
    [activeChartBrokerLabel, favTFs],
  );
  const watchlistSymbolsCsv = useMemo(() => {
    const unique = new Set<string>();
    if (selectedInstrument) unique.add(selectedInstrument);
    workspacePanes
      .filter((pane) => pane.broker === activeChartBrokerLabel)
      .forEach((pane) => unique.add(pane.symbol));
    watchlist
      .filter((item) => item.broker === activeChartBrokerLabel)
      .forEach((item) => unique.add(item.symbol));
    return Array.from(unique).join(",");
  }, [activeChartBrokerLabel, selectedInstrument, watchlist, workspacePanes]);
  const priorityLiveSymbolsCsv = useMemo(() => {
    const unique = new Set<string>();
    if (selectedInstrument) unique.add(selectedInstrument);
    workspacePanes
      .filter((pane) => pane.broker === activeChartBrokerLabel)
      .forEach((pane) => unique.add(pane.symbol));
    return Array.from(unique).join(",");
  }, [activeChartBrokerLabel, selectedInstrument, workspacePanes]);
  const instrumentCategories = [
    {
      category: "CME Futures",
      broker: "Databento",
      items: DATABENTO_FUTURES.map((instrument) => [instrument.symbol, `${instrument.label} · ${instrument.venue}`]),
    },
    {
      category: "CME Options",
      broker: "Databento",
      items: databentoOptions.map((instrument) => [instrument.symbol, `${instrument.label} · ${instrument.group}`]),
    },
    {
      category: "Volatility Indices",
      broker: "Market Index",
      items: MARKET_INDEX_DEFINITIONS.map((index) => [index.symbol, `${index.displayName} · ${index.exchange}`]),
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
  liveGexCalibrationPriceRef.current = currentLivePrice.mid > 0 ? currentLivePrice.mid : null;
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
  const activeBrokerFeedError = feedErrorByBroker[activeChartBrokerLabel] ?? null;

  const activeWorkspacePane = useMemo(
    () => workspacePanes.find((pane) => pane.id === activePaneId) ?? workspacePanes[0] ?? DEFAULT_WORKSPACE_PANES[0],
    [activePaneId, workspacePanes],
  );
  const activePaneIsChart = activeWorkspacePane.content === "charts";
  const activePaneLevelVisibility = paneLevelVisibility[activePaneId] ?? EMPTY_PANE_LEVEL_VISIBILITY;
  const gammaLevelsEnabled = activePaneLevelVisibility.gamma;
  const historicalStructureEnabled = activePaneLevelVisibility.structure;
  const valueAreaLevelsEnabled = activePaneLevelVisibility.valueArea;
  const activeLiveGexConversion = useMemo(
    () => cashFallbackGammaConversion(displayCmeSymbol(activeWorkspacePane.symbol)),
    [activeWorkspacePane.symbol],
  );

  useEffect(() => {
    if (rightPanel !== "gex") return;
    if (!activeLiveGexConversion) {
      setLiveGexSnapshot(null);
      setLiveGexLoading(false);
      setLiveGexError("Live GEX is available for NQ, MNQ, ES and MES charts.");
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    const conversion = activeLiveGexConversion;
    const retainedSnapshot = lastVerifiedGammaPayload(conversion);
    setLiveGexSnapshot((current) => (
      current?.root === conversion.futuresRoot && current.requestedSource === conversion.futuresRoot
        ? current
        : retainedSnapshot
    ));
    setLiveGexLoading(!retainedSnapshot);
    setLiveGexError("");

    const loadLiveGex = async () => {
      try {
        const payload = await fetchGammaPayload(conversion, {
          allowStale: true,
          calibrated: true,
          calibrationPrice: liveGexCalibrationPriceRef.current,
        });
        if (cancelled) return;
        if (!payload.positioning || !isRenderableGammaPositioning(payload.positioning)) {
          throw new Error("The latest options frame is still synchronising.");
        }
        setLiveGexSnapshot(payload);
        setLiveGexError("");
        setLiveGexLoading(false);
        timer = window.setTimeout(
          () => void loadLiveGex(),
          gammaRefreshDelay(payload.refreshAfterMs),
        );
      } catch (loadError) {
        if (cancelled) return;
        setLiveGexError(retainedSnapshot
          ? ""
          : loadError instanceof Error ? loadError.message : "Live GEX is synchronising.");
        setLiveGexLoading(false);
        timer = window.setTimeout(() => void loadLiveGex(), 5_000);
      }
    };

    void loadLiveGex();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activeLiveGexConversion, rightPanel]);

  const activeGameplanRoot = gameplanChartRootForInstrument(activeWorkspacePane.symbol);
  const enabledKwantRootKey = [
    gameplanChartOverlays.NQ ? "NQ" : "",
    gameplanChartOverlays.ES ? "ES" : "",
  ].filter(Boolean).join("|");

  useEffect(() => {
    if (!activeGameplanRoot) return;
    const session = currentGameplanSession();
    const cacheKey = gameplanCacheKey(activeGameplanRoot, session);
    readWorkspaceData<GameplanPayload>(cacheKey);
    void requestKwantGameplan(activeGameplanRoot, session, {
      force: false,
      attempts: 1,
    }).catch(() => undefined);
  }, [activeGameplanRoot]);
  const visibleWorkspacePaneIds = useMemo(
    () => collectWorkspacePaneIds(workspaceTree),
    [workspaceTree],
  );
  const handleGammaExportSnapshot = useCallback((
    paneId: string,
    snapshot: GammaLevelExportSnapshot | null,
  ) => {
    setGammaLevelExportsByPane((current) => {
      if (!snapshot) {
        if (!current[paneId]) return current;
        const next = { ...current };
        delete next[paneId];
        return next;
      }
      return { ...current, [paneId]: snapshot };
    });
  }, []);
  const availableLevelExportInstruments = useMemo(() => {
    const options = new Map<string, {
      instrument: string;
      sourceSymbol: string;
      contractSymbol: string;
      gamma: GammaLevelExportSnapshot | null;
      gameplan: GameplanChartOverlay | null;
      valueArea: ValueAreaLevelExportSnapshot | null;
      structure: StructureLevelExportSnapshot | null;
    }>();

    for (const paneId of visibleWorkspacePaneIds) {
      const pane = workspacePanes.find((candidate) => candidate.id === paneId);
      if (!pane) continue;
      const instrument = displayCmeSymbol(pane.symbol);
      const snapshot = gammaLevelExportsByPane[pane.id] ?? null;
      const gameplanRoot = gameplanChartRootForInstrument(pane.symbol);
      const gameplan = gameplanRoot ? gameplanChartOverlays[gameplanRoot] ?? null : null;
      const existing = options.get(instrument);
      if (!existing) {
        options.set(instrument, {
          instrument,
          sourceSymbol: pane.symbol,
          contractSymbol: snapshot?.contractSymbol ?? currentCmeContract(pane.symbol) ?? "",
          gamma: snapshot,
          gameplan,
          valueArea: snapshot?.valueArea ?? null,
          structure: snapshot?.structure ?? null,
        });
      } else {
        if ((snapshot?.levels.length ?? 0) > (existing.gamma?.levels.length ?? 0)) {
          existing.gamma = snapshot;
          existing.contractSymbol = snapshot?.contractSymbol ?? existing.contractSymbol;
        }
        if (!existing.gameplan && gameplan) existing.gameplan = gameplan;
        if ((snapshot?.valueArea?.levels.length ?? 0) > (existing.valueArea?.levels.length ?? 0)) {
          existing.valueArea = snapshot?.valueArea ?? existing.valueArea;
        }
        if ((snapshot?.structure?.zones.length ?? 0) > (existing.structure?.zones.length ?? 0)) {
          existing.structure = snapshot?.structure ?? existing.structure;
        }
      }
    }

    return Array.from(options.values());
  }, [
    gammaLevelExportsByPane,
    gameplanChartOverlays,
    visibleWorkspacePaneIds,
    workspacePanes,
  ]);
  const selectedLevelExportCount = useMemo(
    () => availableLevelExportInstruments
      .filter((option) => selectedLevelExportInstruments.includes(option.instrument))
      .reduce((total, option) =>
        total
        + (levelExportTypes.gamma ? option.gamma?.levels.length ?? 0 : 0)
        + (levelExportTypes.gameplan ? option.gameplan?.levels.length ?? 0 : 0)
        + (levelExportTypes.valueArea ? option.valueArea?.levels.length ?? 0 : 0)
        + (levelExportTypes.historicalStructure ? option.structure?.zones.length ?? 0 : 0), 0),
    [
      availableLevelExportInstruments,
      levelExportTypes,
      selectedLevelExportInstruments,
    ],
  );
  const activeLevelExportOption = PLATFORM_LEVEL_EXPORT_OPTIONS.find((option) => option.id === levelExportFormat)
    ?? PLATFORM_LEVEL_EXPORT_OPTIONS[0];
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
    paperTradingAccounts.find((account) => account.id === selectedPaperAccountId) ??
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
  const paperExecutionRequested = Boolean(selectedPaperTradingAccount) && (
    brokerMode === "Demo"
    || currentBrokerConnection.ownership === "paper"
    || currentBrokerConnection.mode === "Demo"
  );
  // Only expose an actionable submit button when the selected account has a
  // verified execution adapter. Paper execution is complete; broker routing is
  // deliberately gated until its submit/cancel/liquidate adapter is wired.
  const tradingUnlocked = paperExecutionRequested;
  const selectedPaperSummary = selectedPaperTradingAccount
    ? summarizePaperAccount(paperLedger, selectedPaperTradingAccount)
    : null;
  const selectedPaperContract = paperContractSpec(selectedInstrument);
  const selectedOrderQuantity = paperOrderQuantity(selectedInstrument, orderUnits);
  const selectedPaperLeverage = selectedPaperTradingAccount
    ? parseLeverage(selectedPaperTradingAccount.leverage)
    : 1;
  const selectedOrderQuantityLabel = selectedPaperContract.isMicro
    ? `${selectedOrderQuantity} ${selectedInstrument} micro${selectedOrderQuantity === 1 ? "" : "s"}`
    : selectedPaperContract.isFutures
      ? `${selectedOrderQuantity} ${selectedInstrument} contract${selectedOrderQuantity === 1 ? "" : "s"}`
      : `${selectedOrderQuantity} ${selectedInstrument} unit${selectedOrderQuantity === 1 ? "" : "s"}`;
  const orderPanelMarginUsd = selectedMidPrice > 0
    ? paperContractNotional(selectedInstrument, selectedMidPrice, selectedOrderQuantity) / selectedPaperLeverage
    : 0;
  const orderPanelTradeValueUsd = selectedMidPrice > 0
    ? paperContractNotional(selectedInstrument, selectedMidPrice, selectedOrderQuantity)
    : 0;
  const activeBrokerHealth = paperExecutionRequested ? {
    state: "connected" as const,
    label: "Ready",
    dotClassName: "bg-primary",
    detail: selectedPaperTradingAccount?.name ?? "Paper simulator ready",
  } : activeTradingBroker ? getBrokerHealth(activeTradingBroker) : {
    state: "not_ready" as const,
    label: "Not ready",
    dotClassName: "bg-orange-400",
    detail: "No broker selected",
  };
  const orderPanelAccountSummary = paperExecutionRequested && selectedPaperSummary
    ? {
        status: "Ready",
        balance: formatDollar(selectedPaperSummary.balance),
        equity: formatDollar(selectedPaperSummary.equity),
        unrealized: formatDollar(selectedPaperSummary.unrealizedPnl),
        realized: formatDollar(selectedPaperSummary.realizedPnl),
        margin: `${formatDollar(selectedPaperSummary.marginUsed)} / ${formatDollar(selectedPaperSummary.availableFunds)} free`,
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
  const selectedPaperAccountLedger = selectedPaperTradingAccount
    ? paperLedger.accounts[selectedPaperTradingAccount.id] ?? null
    : null;
  const selectedPaperOpenPositions = selectedPaperAccountLedger?.positions.filter((position) => position.status === "open") ?? [];
  const selectedPaperWorkingOrders = selectedPaperAccountLedger?.orders.filter((order) => order.status === "working") ?? [];
  const selectedPaperRecentFills = selectedPaperAccountLedger?.fills.slice(-12).reverse() ?? [];
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
              : currentBrokerConnection.connectionState === "connected"
                ? "This account is connected for data, but verified order routing is not available yet. Choose Paper Trading to execute safely."
                : "Connect a broker account and choose the account you want to route orders through.",
        };
  const instrumentPickerItems = useMemo<InstrumentPickerItem[]>(
    () =>
      instrumentCategories.flatMap((group) =>
        group.items.map(([symbol, fullName]) => ({
              key: `${group.broker}::${symbol}`,
              symbol,
              fullName,
              category: group.category,
              broker: group.broker,
            })),
      ),
    [instrumentCategories],
  );
  const filteredInstrumentPickerItems = useMemo(() => {
    const query = instrumentSearch.trim().toLowerCase();
    if (!query) return instrumentPickerItems;
    return instrumentPickerItems.filter((item) =>
      `${displayCmeSymbol(item.symbol)} ${currentCmeContract(item.symbol) ?? ""} ${item.fullName} ${displayMarketSource(item.broker)} ${item.category}`.toLowerCase().includes(query),
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

  async function requestKwantGameplan(
    root: "NQ" | "ES",
    session: GameplanSession,
    options: { force: boolean; attempts?: number },
  ) {
    const attempts = Math.max(1, options.attempts ?? 1);
    const cacheKey = gameplanCacheKey(root, session);
    let lastError: unknown = new Error("The latest KWANT levels could not be loaded.");

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await fetchWorkspaceData<GameplanPayload>(
          cacheKey,
          `/api/gameplan?root=${root}&session=${session}`,
          {
            force: options.force || attempt > 0,
            validate: isGameplanPayload,
            invalidMessage: "The latest KWANT level edition was incomplete.",
          },
        );
      } catch (reason) {
        lastError = reason;
        if (attempt + 1 < attempts) {
          await new Promise((resolve) => window.setTimeout(resolve, 650 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  async function refreshKwantLevelsForInstrument(instrument: string, silent = false) {
    if (quickGameplanRequestRef.current) return;
    const root = gameplanChartRootForInstrument(instrument);
    const displaySymbol = displayCmeSymbol(instrument);
    if (!root) {
      if (!silent) showReportToast("error", "KWANT levels are available for NQ, MNQ, ES and MES charts.", 3_000);
      return;
    }

    const session = currentGameplanSession();
    const cacheKey = gameplanCacheKey(root, session);
    const cachedPayload = readWorkspaceData<GameplanPayload>(cacheKey);
    const cachedPlanMatches = Boolean(
      cachedPayload
      && cachedPayload.instrument === root
      && cachedPayload.plan.edition.session === session
      && cachedPayload.plan.ladder.length,
    );
    quickGameplanRequestRef.current = true;
    setQuickGameplanLoading(!cachedPlanMatches);
    setQuickGameplanLoadingRoot(root);

    if (cachedPlanMatches && cachedPayload) {
      const nextStore = saveGameplanChartOverlay(createGameplanChartOverlay(root, cachedPayload.plan));
      setGameplanChartOverlays(nextStore);
      if (!silent) showReportToast(
        "success",
        `${displaySymbol} ${gameplanSessionLabel(session)} KWANT levels added. Refreshing quietly…`,
        2_000,
      );
    } else if (!silent) {
      showReportToast("loading", `Loading the latest ${displaySymbol} KWANT levels…`);
    }

    try {
      const payload = await requestKwantGameplan(root, session, {
        force: true,
        attempts: cachedPlanMatches ? 1 : 3,
      });
      if (payload.instrument !== root || payload.plan.edition.session !== session || !payload.plan.ladder.length) {
        throw new Error("The latest Gameplan response did not match this chart.");
      }

      const nextStore = saveGameplanChartOverlay(createGameplanChartOverlay(root, payload.plan));
      setGameplanChartOverlays(nextStore);
      if (!silent) showReportToast(
        "success",
        `${displaySymbol} ${gameplanSessionLabel(session)} KWANT levels replaced with the latest edition.`,
        2_800,
      );
    } catch (reason) {
      if (!cachedPlanMatches && !silent) {
        showReportToast(
          "error",
          reason instanceof Error ? reason.message : "The latest KWANT levels could not be loaded.",
          4_000,
        );
      }
    } finally {
      quickGameplanRequestRef.current = false;
      setQuickGameplanLoading(false);
      setQuickGameplanLoadingRoot((current) => current === root ? null : current);
    }
  }

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

  async function applyChartSettings() {
    setChartSettings(draftChartSettings);
    setChartSettingsSnapshot(draftChartSettings);
    saveStoredChartSettings(draftChartSettings);
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

  function changeChartTimeZone(timeZone: string) {
    const normalized = normalizeTimeZone(timeZone);
    const next = { ...chartSettings, timezone: normalized };
    setChartSettings(next);
    setDraftChartSettings(next);
    setChartSettingsSnapshot(next);
    saveStoredChartSettings(next);
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
    if (!preferenceUserId) return;
    let active = true;
    setKwantBotStoreReady(false);
    loadKwantBotConversation<unknown>(preferenceUserId)
      .then((saved) => {
        if (!active) return;
        const clean = normalizeKwantBotMessages(saved);
        if (clean.length) setKwantBotMessages(clean);
      })
      .catch(() => {
        // Local storage remains available as the lightweight fallback.
      })
      .finally(() => {
        if (active) setKwantBotStoreReady(true);
      });
    return () => {
      active = false;
    };
  }, [preferenceUserId]);

  useEffect(() => {
    if (!kwantBotStoreReady || !preferenceUserId) return;
    const messages = kwantBotMessages.slice(-100);
    void saveKwantBotConversation(preferenceUserId, messages).catch(() => {
      // Keep the active chat usable even if browser storage is unavailable.
    });
    try {
      const lightweight = messages.map(({ attachments: _attachments, ...message }) => message);
      window.localStorage.setItem(KWANTBOT_MESSAGES_STORAGE_KEY, JSON.stringify(lightweight));
    } catch {
      // IndexedDB remains the full attachment store.
    }
  }, [kwantBotMessages, kwantBotStoreReady, preferenceUserId]);

  useEffect(() => {
    const receiveKwantBotMessage = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: unknown }>).detail;
      const text = typeof detail?.text === "string" ? detail.text.trim().slice(0, 1_200) : "";
      if (!text) return;
      const message: KwantBotMessage = {
        id: kwantBotId("kwantbot"),
        text,
        receivedAt: new Date().toISOString(),
        sender: "bot",
      };
      setKwantBotMessages((current) => [...current.slice(-99), message]);
      if (rightPanel !== "kwantbot") {
        setKwantBotUnreadCount((current) => Math.min(99, current + 1));
      }
    };

    window.addEventListener("kwantbot:message", receiveKwantBotMessage);
    return () => window.removeEventListener("kwantbot:message", receiveKwantBotMessage);
  }, [rightPanel]);

  const handleKwantBotAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    setKwantBotAttachmentError("");
    const remainingSlots = Math.max(0, 4 - kwantBotDraftAttachments.length);
    const selected = Array.from(files).slice(0, remainingSlots);
    if (!remainingSlots) {
      setKwantBotAttachmentError("Remove an attachment before adding another.");
      return;
    }
    const oversized = selected.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      setKwantBotAttachmentError(`${oversized.name} is larger than 10 MB.`);
      return;
    }
    setKwantBotAttaching(true);
    try {
      const attachments = await Promise.all(selected.map(readAttachment));
      setKwantBotDraftAttachments((current) => [...current, ...attachments].slice(0, 4));
      if (files.length > remainingSlots) {
        setKwantBotAttachmentError("You can attach up to four files to one message.");
      }
    } catch {
      setKwantBotAttachmentError("One of those files could not be attached.");
    } finally {
      setKwantBotAttaching(false);
      if (kwantBotAttachmentInputRef.current) kwantBotAttachmentInputRef.current.value = "";
    }
  };

  const handleSendKwantBotMessage = async () => {
    const text = kwantBotDraft.trim().slice(0, 4_000);
    if (
      (!text && !kwantBotDraftAttachments.length)
      || kwantBotAttaching
      || kwantBotReplying
    ) return;
    const message: KwantBotMessage = {
      id: kwantBotId("message"),
      text,
      receivedAt: new Date().toISOString(),
      sender: "user",
      attachments: kwantBotDraftAttachments.length ? kwantBotDraftAttachments : undefined,
    };
    const conversation = [...kwantBotMessages.slice(-23), message];
    setKwantBotMessages((current) => [...current.slice(-99), message]);
    setKwantBotDraft("");
    setKwantBotDraftAttachments([]);
    setKwantBotAttachmentError("");
    setKwantBotSendError("");
    setKwantBotReplying(true);
    window.dispatchEvent(new CustomEvent("kwantbot:send", {
      detail: {
        id: message.id,
        text: message.text,
        attachments: message.attachments?.map(({ id, name, type, size }) => ({ id, name, type, size })) ?? [],
        sentAt: message.receivedAt,
      },
    }));
    try {
      const response = await fetch("/api/kwantbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map((entry) => ({
            role: entry.sender === "bot" ? "assistant" : "user",
            content: entry.text,
            attachments: entry.id === message.id
              ? entry.attachments?.map(({ name, type, size, dataUrl }) => ({ name, type, size, dataUrl }))
              : undefined,
          })),
        }),
      });
      const payload = await response.json().catch(() => null) as { text?: unknown; error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Kwant Bot could not reply.",
        );
      }
      const replyText = typeof payload?.text === "string" ? payload.text.trim().slice(0, 8_000) : "";
      if (!replyText) throw new Error("Kwant Bot returned an empty reply.");
      const reply: KwantBotMessage = {
        id: kwantBotId("kwantbot"),
        text: replyText,
        receivedAt: new Date().toISOString(),
        sender: "bot",
      };
      setKwantBotMessages((current) => [...current.slice(-99), reply]);
    } catch (error) {
      setKwantBotSendError(
        error instanceof Error && error.message
          ? error.message
          : "Kwant Bot could not reply.",
      );
    } finally {
      setKwantBotReplying(false);
      window.requestAnimationFrame(() => kwantBotComposerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (rightPanel !== "kwantbot") return;
    setKwantBotUnreadCount(0);
    const frame = window.requestAnimationFrame(() => {
      kwantBotMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [kwantBotMessages.length, kwantBotReplying, rightPanel]);

  useEffect(() => {
    if (rightPanel) {
      setLastOpenRightPanel(rightPanel);
    }
  }, [rightPanel]);

  useEffect(() => {
    const savedRightPanelWidth = window.localStorage.getItem("olisa-right-panel-width");
    if (savedRightPanelWidth !== null) {
      const width = Number(savedRightPanelWidth);
      if (Number.isFinite(width)) {
        const viewportMaximum = Math.max(RIGHT_PANEL_MIN_WIDTH, window.innerWidth - 96);
        setRightPanelWidth(Math.min(RIGHT_PANEL_MAX_WIDTH, viewportMaximum, Math.max(RIGHT_PANEL_MIN_WIDTH, width)));
      }
    }

    const savedBottomPanelHeight = window.localStorage.getItem("olisa-bottom-panel-height");
    if (savedBottomPanelHeight !== null) {
      const height = Number(savedBottomPanelHeight);
      if (Number.isFinite(height)) {
        const maximum = Math.max(BOTTOM_PANEL_DEFAULT_HEIGHT, window.innerHeight - 120);
        setBottomPanelHeight(Math.min(maximum, Math.max(BOTTOM_PANEL_MIN_HEIGHT, height)));
      }
    }

    setBottomMinimized(
      window.localStorage.getItem("kwantdesk-bottom-panel-minimized") !== "false",
    );
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk-right-panel-state", rightPanel ?? "");
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [rightPanel]);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk-bottom-panel-minimized", String(bottomMinimized));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [bottomMinimized]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-favourite-intervals", JSON.stringify(favTFs));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [favTFs]);

  useEffect(() => {
    if (!showAllTF) return;

    const closeTimeframeMenuOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || timeframeMenuRef.current?.contains(target)) return;
      setShowAllTF(false);
    };

    document.addEventListener("pointerdown", closeTimeframeMenuOutside);
    return () => document.removeEventListener("pointerdown", closeTimeframeMenuOutside);
  }, [showAllTF]);

  useEffect(() => {
    window.localStorage.setItem(
      CHART_INDICATORS_STORAGE_KEY,
      JSON.stringify(clonePaneIndicatorState(paneIndicators)),
    );
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [paneIndicators]);

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
  }, [rightPanel, rightPanelWidth]);

  useEffect(() => {
    try {
      setBrokerFavourites(JSON.parse(window.localStorage.getItem("olisa-broker-favourites") ?? "[]"));
      setConnectedBroker("Databento");
      window.localStorage.setItem("olisa-connected-broker", "Databento");
      setBrokerConnections(JSON.parse(window.localStorage.getItem("olisa-broker-connections") ?? "{}"));
      setPaperTradingAccounts(loadPaperTradingAccounts());
    } catch {
      setBrokerFavourites([]);
      setBrokerConnections({});
      setPaperTradingAccounts([]);
    }
  }, []);

  useEffect(() => {
    if (section !== "charts" || !authChecked || databentoOptions.length > 0) return;
    let active = true;
    setOptionsLoading(true);
    fetch("/api/databento/options", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load options.");
        if (active && Array.isArray(payload.instruments)) setDatabentoOptions(payload.instruments);
      })
      .catch(() => {
        if (active) setDatabentoOptions([]);
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authChecked, databentoOptions.length, section]);

  useEffect(() => {
    if (!authChecked) return;
    const timers = [
      window.setTimeout(() => warmWorkspaceSection("charts"), 100),
      // ZYON is also a chart-side panel. Fetch its module while this deployment
      // is known-good so a long-lived trading tab never requests it lazily
      // across a later production rollout.
      window.setTimeout(() => warmWorkspaceSection("zyon"), 300),
      window.setTimeout(() => warmWorkspaceSection("gamma"), 650),
      window.setTimeout(() => warmWorkspaceSection("gexdesk"), 1_300),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [authChecked, warmWorkspaceSection]);

  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    let warmupTimer: number | null = null;
    const visiblePaneIds = collectWorkspacePaneIds(workspaceTree);
    const visiblePanes = visiblePaneIds
      .map((paneId) => workspacePanes.find((pane) => pane.id === paneId))
      .filter((pane): pane is WorkspacePane => Boolean(pane && pane.broker === "Databento"));
    const prioritizedPanes = [
      ...visiblePanes.filter((pane) => pane.id === activePaneId),
      ...visiblePanes.filter((pane) => pane.id !== activePaneId),
    ];
    const requests = prioritizedPanes
      .map((pane) => ({ symbol: pane.symbol, timeframe: "1m" }))
      .filter((request, index, source) =>
      source.findIndex((candidate) =>
        candidate.symbol === request.symbol && candidate.timeframe === request.timeframe) === index);
    let cursor = 0;

    const warmNext = async () => {
      while (!cancelled && cursor < requests.length) {
        const request = requests[cursor++];
        try {
          await warmDatabentoChartHistory(request.symbol, request.timeframe);
        } catch {
          if (cancelled) return;
        }
        if (!cancelled) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
        }
      }
    };

    // Warm only the saved/visible workspace's 1m source so all standard higher
    // intervals can be derived locally without downloading the full catalogue.
    warmupTimer = window.setTimeout(
      () => void warmNext(),
      section === "charts" ? 600 : 1_200,
    );
    return () => {
      cancelled = true;
      if (warmupTimer !== null) window.clearTimeout(warmupTimer);
    };
  }, [activePaneId, authChecked, section, workspacePanes, workspaceTree]);

  useEffect(() => {
    savePaperTradingAccounts(paperTradingAccounts);
  }, [paperTradingAccounts]);

  useEffect(() => {
    savePaperTradingLedger(paperLedger);
  }, [paperLedger]);

  useEffect(() => {
    if (selectedPaperTradingAccount?.id) {
      window.localStorage.setItem("kwantify-selected-paper-account", selectedPaperTradingAccount.id);
    }
  }, [selectedPaperTradingAccount?.id]);

  useEffect(() => {
    if (!paperTradingAccounts.length) return;
    const timestamp = Date.now();
    setPaperLedger((current) => {
      let next = current;
      for (const item of watchlist) {
        if (!(item.bid > 0 && item.ask > 0)) continue;
        next = processPaperQuote(next, paperTradingAccounts, item.symbol, {
          bid: item.bid,
          ask: item.ask,
          timestamp,
        });
      }
      if (
        currentLivePrice.bid > 0
        && currentLivePrice.ask > 0
        && !watchlist.some((item) => normalizePaperSymbol(item.symbol) === normalizePaperSymbol(selectedInstrument))
      ) {
        next = processPaperQuote(next, paperTradingAccounts, selectedInstrument, {
          bid: currentLivePrice.bid,
          ask: currentLivePrice.ask,
          timestamp,
        });
      }
      return next;
    });
  }, [currentLivePrice.ask, currentLivePrice.bid, paperTradingAccounts, selectedInstrument, watchlist]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key) {
        if (event.key === "kwantify-paper-trading-accounts") {
          setPaperTradingAccounts(loadPaperTradingAccounts());
        }
        if (event.key === "kwantify-paper-trading-ledger-v1") {
          setPaperLedger(loadPaperTradingLedger());
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
    window.localStorage.setItem("olisa-chart-workspace-tree", JSON.stringify(workspaceTree));
  }, [workspaceTree]);

  useEffect(() => {
    if (!preferencesReady) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        WORKSPACE_FLOATING_WINDOWS_STORAGE_KEY,
        JSON.stringify(workspaceFloatingWindows),
      );
      window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [preferencesReady, workspaceFloatingWindows]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_PRESETS_STORAGE_KEY, JSON.stringify(workspacePresets));
  }, [workspacePresets]);

  useEffect(() => {
    if (
      activeWorkspacePresetId
      && workspacePresets.some((preset) => preset.id === activeWorkspacePresetId)
    ) {
      window.localStorage.setItem(ACTIVE_WORKSPACE_PRESET_STORAGE_KEY, activeWorkspacePresetId);
      return;
    }
    window.localStorage.removeItem(ACTIVE_WORKSPACE_PRESET_STORAGE_KEY);
    if (activeWorkspacePresetId) setActiveWorkspacePresetId(null);
  }, [activeWorkspacePresetId, workspacePresets]);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-workspace-active-pane", activePaneId);
  }, [activePaneId]);

  useEffect(() => {
    if (
      visibleWorkspacePaneIds.includes(activePaneId)
      || workspaceFloatingWindows.some((entry) => entry.paneId === activePaneId)
    ) return;
    setActivePaneId(visibleWorkspacePaneIds[0] ?? DEFAULT_WORKSPACE_PANES[0].id);
  }, [activePaneId, visibleWorkspacePaneIds, workspaceFloatingWindows]);

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
    window.localStorage.setItem(
      PANE_LEVEL_VISIBILITY_STORAGE_KEY,
      JSON.stringify(clonePaneLevelVisibility(paneLevelVisibility)),
    );
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [paneLevelVisibility]);

  useEffect(() => {
    const syncOverlays = () => setGameplanChartOverlays(loadGameplanChartOverlays());
    const syncStorage = (event: StorageEvent) => {
      if (event.key === GAMEPLAN_CHART_OVERLAYS_STORAGE_KEY) syncOverlays();
    };
    window.addEventListener(GAMEPLAN_CHART_OVERLAYS_EVENT, syncOverlays);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(GAMEPLAN_CHART_OVERLAYS_EVENT, syncOverlays);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  useEffect(() => {
    const roots = enabledKwantRootKey
      .split("|")
      .filter((root): root is "NQ" | "ES" => root === "NQ" || root === "ES");
    if (!roots.length) return;

    let cancelled = false;
    let running = false;
    let timer: number | null = null;
    let consecutiveFailures = 0;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), delay);
    };
    const refresh = async () => {
      if (cancelled || running) return;
      if (document.visibilityState !== "visible") {
        schedule(20_000);
        return;
      }

      running = true;
      let nextDelay = 20_000;
      let refreshedAny = false;
      try {
        for (const root of roots) {
          const session = currentGameplanSession();
          try {
            const payload = await requestKwantGameplan(root, session, {
              force: true,
              attempts: 1,
            });
            if (cancelled) return;
            if (
              payload.instrument !== root
              || payload.plan.edition.session !== session
              || !payload.plan.ladder.length
            ) {
              throw new Error("The refreshed KWANT levels did not match the enabled chart.");
            }
            const nextOverlay = createGameplanChartOverlay(root, payload.plan);
            const currentOverlay = loadGameplanChartOverlays()[root];
            if (
              currentOverlay?.publishedAt !== nextOverlay.publishedAt
              || currentOverlay.session !== nextOverlay.session
              || currentOverlay.editionDate !== nextOverlay.editionDate
            ) {
              setGameplanChartOverlays(saveGameplanChartOverlay(nextOverlay));
            }
            refreshedAny = true;
            nextDelay = Math.max(nextDelay, Math.min(60_000, payload.refresh_after_ms));
          } catch {
            // Keep the last verified overlay visible and retry with bounded
            // backoff. A provider interruption must not create a 5-second
            // request storm across every open chart.
          }
        }
        if (refreshedAny) {
          consecutiveFailures = 0;
        } else {
          consecutiveFailures += 1;
          nextDelay = Math.min(120_000, 5_000 * (2 ** Math.min(4, consecutiveFailures - 1)));
        }
      } finally {
        running = false;
        schedule(nextDelay);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      void refresh();
    };

    // The explicit add action has just fetched this exact edition. Do not
    // immediately duplicate that expensive options request one second later.
    schedule(20_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [enabledKwantRootKey]);

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
    if (!watchlistPanelContextMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWatchlistPanelContextMenu(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [watchlistPanelContextMenu]);

  useEffect(() => {
    if (
      !usingDatabentoFeed
      || (bottomWorkspaceSection !== "charts" && bottomWorkspaceSection !== "gameplan" && bottomWorkspaceSection !== "heatmap")
    ) return;
    let cancelled = false;
    let animationFrame: number | null = null;

    const hydrateImmediateMarketState = async () => {
      const quotes = readLiveQuoteCache();
      const requestedSymbols = watchlistSymbolsCsv.split(",").filter(Boolean);
      const missingSymbols = requestedSymbols.filter((symbol) => !quotes.has(symbol));

      const histories = await Promise.all(missingSymbols.map(async (symbol) => {
        const history = await readChartHistoryCache(symbol, "5m");
        const candles = history?.candles ?? [];
        const latest = candles.at(-1);
        if (!latest) return null;
        const sessionStart = Date.now() - 24 * 60 * 60_000;
        const sessionOpen = candles.find((candle) => candle.timestamp >= sessionStart)?.open ?? latest.open;
        return {
          instrument: symbol,
          bid: latest.close,
          ask: latest.close,
          mid: latest.close,
          openPrice: sessionOpen,
          broker: "Databento",
          contractSymbol: currentCmeContract(symbol) ?? undefined,
          timestamp: latest.timestamp,
          cachedAt: history?.updatedAt ?? latest.timestamp,
        };
      }));
      for (const quote of histories) {
        if (quote) quotes.set(quote.instrument, quote);
      }
      if (cancelled || !quotes.size) return;

      setWatchlist((current) => current.map((item) => {
        if (item.broker !== "Databento") return item;
        const quote = quotes.get(item.symbol);
        if (!quote) return item;
        const openPrice = quote.openPrice || item.openPrice || quote.mid;
        return {
          ...item,
          contractSymbol: quote.contractSymbol || item.contractSymbol,
          lastPrice: quote.mid,
          openPrice,
          bid: quote.bid,
          ask: quote.ask,
          mid: quote.mid,
          change: quote.mid - openPrice,
          changePercent: openPrice ? ((quote.mid - openPrice) / openPrice) * 100 : 0,
          flash: null,
        };
      }));

      animationFrame = window.requestAnimationFrame(() => {
        for (const quote of quotes.values()) {
          recordDatabentoLiveTick(quote);
          window.dispatchEvent(new CustomEvent(DATABENTO_LIVE_TICK_EVENT, {
            detail: { ...quote, cached: true } satisfies LiveFeedPrice,
          }));
        }
      });
    };

    void hydrateImmediateMarketState();
    return () => {
      cancelled = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [bottomWorkspaceSection, usingDatabentoFeed, watchlistSymbolsCsv]);

  useEffect(() => {
    if (bottomWorkspaceSection !== "charts" && bottomWorkspaceSection !== "gameplan" && bottomWorkspaceSection !== "heatmap") return;
    if (activeChartBrokerLabel === "Market Index" || activeChartBrokerLabel === "Massive") return;
    const priorityLiveSymbols = new Set(priorityLiveSymbolsCsv.split(",").filter(Boolean));
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

    const streamUrl = usingDatabentoFeed
      ? `/api/databento/live?symbols=${encodeURIComponent(watchlistSymbolsCsv)}&priority=${encodeURIComponent(priorityLiveSymbolsCsv)}`
      : usingCTraderFeed
      ? `/api/ctrader/stream?broker=${encodeURIComponent(activeChartBrokerLabel)}&symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
      : "/api/oanda/stream";
    let activeEventSource: EventSource | null = null;
    let warmingEventSource: EventSource | null = null;
    let disposed = false;
    let lastServerSignalAt = Date.now();
    let lastPriceMessageAt = Date.now();
    const streamOpenedAt = Date.now();
    const lastPriceMessageAtBySymbol = new Map<string, number>();
    let receivedPriceMessage = false;
    let reconnecting = false;
    let streamMarkedHealthy = false;
    let reconnectTimer: number | null = null;
    let warmHandoffTimer: number | null = null;
    let warmReadyTimer: number | null = null;
    let warmingAuthenticated = false;
    const publishDatabentoStatus = (status: DatabentoLiveStatus) => {
      if (!usingDatabentoFeed) return;
      publishDatabentoLiveStatus(status);
    };
    const markStreamAlive = () => {
      lastServerSignalAt = Date.now();
      publishDatabentoStatus("live");
      if (streamMarkedHealthy) return;
      streamMarkedHealthy = true;
      setStreamHealthyByBroker((current) => current[activeChartBrokerLabel]
        ? current
        : { ...current, [activeChartBrokerLabel]: true });
      setFeedErrorByBroker((current) => {
        if (!current[activeChartBrokerLabel]) return current;
        const next = { ...current };
        delete next[activeChartBrokerLabel];
        return next;
      });
    };
    const reconnect = () => {
      if (reconnecting || disposed) return;
      reconnecting = true;
      activeEventSource?.close();
      warmingEventSource?.close();
      activeEventSource = null;
      warmingEventSource = null;
      if (warmHandoffTimer !== null) window.clearTimeout(warmHandoffTimer);
      if (warmReadyTimer !== null) window.clearTimeout(warmReadyTimer);
      publishDatabentoStatus("reconnecting");
      setStreamHealthyByBroker((current) => ({ ...current, [activeChartBrokerLabel]: false }));
      setFeedErrorByBroker((current) => ({
        ...current,
        [activeChartBrokerLabel]: `${displayMarketSource(activeChartBrokerLabel)} live feed is reconnecting.`,
      }));
      reconnectTimer = window.setTimeout(() => setStreamReconnectNonce((value) => value + 1), 1_200);
    };
    const healthTimer = window.setInterval(() => {
      if (!usingDatabentoFeed || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (
        now - lastServerSignalAt > 18_000
        || (receivedPriceMessage && now - lastPriceMessageAt > 24_000)
        || (
          now - streamOpenedAt > 24_000
          && [...priorityLiveSymbols].some((symbol) => {
            const lastSymbolTick = lastPriceMessageAtBySymbol.get(symbol);
            return lastSymbolTick !== undefined && now - lastSymbolTick > 24_000;
          })
        )
      ) reconnect();
    }, 3_000);
    const handlePriceMessage = (event: MessageEvent<string>) => {
      try {
        const price = JSON.parse(event.data) as LiveFeedPrice;
        markStreamAlive();
        if (price.error) {
          setFeedErrorByBroker((current) => ({ ...current, [activeChartBrokerLabel]: price.error as string }));
          return;
        }

        const displayName = usingDatabentoFeed || usingCTraderFeed ? price.instrument : (nameMap[price.instrument] || price.instrument);
        const previousItem = watchlistRef.current.find(
          (item) => item.broker === activeChartBrokerLabel && item.symbol === displayName,
        );
        publishLiveWatchlistQuote(
          makeWatchlistKey(displayName, activeChartBrokerLabel),
          price,
          previousItem?.openPrice,
        );
        lastStreamTickAtByBrokerRef.current[activeChartBrokerLabel] = Date.now();
        if (priorityLiveSymbols.has(displayName)) {
          lastPriceMessageAt = Date.now();
          lastPriceMessageAtBySymbol.set(displayName, lastPriceMessageAt);
          receivedPriceMessage = true;
        }
        if (usingDatabentoFeed) {
          recordDatabentoLiveTick(price);
          pendingLiveQuoteCacheRef.current.set(displayName, {
            ...price,
            openPrice: previousItem?.openPrice || price.mid,
          });
          if (liveQuoteCacheTimerRef.current === null) {
            liveQuoteCacheTimerRef.current = window.setTimeout(() => {
              liveQuoteCacheTimerRef.current = null;
              const quotes = [...pendingLiveQuoteCacheRef.current.values()];
              pendingLiveQuoteCacheRef.current.clear();
              if (quotes.length) writeLiveQuoteCache(quotes);
            }, 5_000);
          }
          // Gameplan's moving Session Ladder consumes the same authoritative
          // futures stream as Charts. Publishing it here prevents delayed REST
          // snapshots from briefly displacing the live "You are here" marker.
          if (activeWorkspaceSectionRef.current !== "charts" && activeWorkspaceSectionRef.current !== "gameplan" && activeWorkspaceSectionRef.current !== "heatmap") return;
          if (priorityLiveSymbols.has(displayName)) {
            window.dispatchEvent(new CustomEvent(DATABENTO_LIVE_TICK_EVENT, { detail: price }));
          }
        }
        pendingWatchlistPricesRef.current.set(displayName, price);
        if (watchlistLiveFrameRef.current !== null) return;

        watchlistLiveFrameRef.current = window.setTimeout(() => {
          const updates = new Map(pendingWatchlistPricesRef.current);
          pendingWatchlistPricesRef.current.clear();
          watchlistLiveFrameRef.current = null;

          startTransition(() => {
            setWatchlist((current) => {
              let changed = false;
              const next = current.map((item) => {
                if (item.broker !== activeChartBrokerLabel) return item;
                const nextPrice = updates.get(item.symbol);
                if (!nextPrice) return item;
                const prevMid = item.lastPrice || nextPrice.mid;
                const moveRatio = prevMid > 0 ? Math.abs(nextPrice.mid - prevMid) / prevMid : 0;
                if (moveRatio > 0.2) return item;
                const openPrice = item.openPrice || nextPrice.mid;
                const nextBroker = nextPrice.broker || activeChartBrokerLabel;
                const nextContractSymbol = nextPrice.contractSymbol || item.contractSymbol;
                const nextChange = nextPrice.mid - openPrice;
                const nextChangePercent = openPrice ? (nextChange / openPrice) * 100 : 0;
                if (
                  item.broker === nextBroker
                  && item.contractSymbol === nextContractSymbol
                  && item.lastPrice === nextPrice.mid
                  && item.openPrice === openPrice
                  && item.bid === nextPrice.bid
                  && item.ask === nextPrice.ask
                  && item.mid === nextPrice.mid
                  && item.change === nextChange
                  && item.changePercent === nextChangePercent
                  && item.flash === null
                ) {
                  return item;
                }
                changed = true;
                return {
                  ...item,
                  broker: nextBroker,
                  contractSymbol: nextContractSymbol,
                  lastPrice: nextPrice.mid,
                  openPrice,
                  bid: nextPrice.bid,
                  ask: nextPrice.ask,
                  mid: nextPrice.mid,
                  change: nextChange,
                  changePercent: nextChangePercent,
                  // Fast up/down painting is isolated in LiveWatchlistNumbers;
                  // keeping it out of parent state avoids a second shell render.
                  flash: null,
                };
              });
              return changed ? next : current;
            });
          });

        }, 1_000);
      } catch {}
    };

    const scheduleWarmHandoff = (delayMs = 210_000) => {
      if (!usingDatabentoFeed || disposed || reconnecting) return;
      if (warmHandoffTimer !== null) window.clearTimeout(warmHandoffTimer);
      warmHandoffTimer = window.setTimeout(() => {
        warmHandoffTimer = null;
        if (!warmingEventSource && activeEventSource) openEventSource(true);
      }, delayMs);
    };

    const discardWarmingSource = (source: EventSource, retry = true) => {
      if (warmingEventSource !== source) return;
      source.close();
      warmingEventSource = null;
      warmingAuthenticated = false;
      if (warmReadyTimer !== null) {
        window.clearTimeout(warmReadyTimer);
        warmReadyTimer = null;
      }
      if (retry && activeEventSource && !disposed) scheduleWarmHandoff(5_000);
    };

    const promoteWarmingSource = (source: EventSource) => {
      if (warmingEventSource !== source || disposed) return;
      const previousSource = activeEventSource;
      activeEventSource = source;
      warmingEventSource = null;
      warmingAuthenticated = false;
      if (warmReadyTimer !== null) {
        window.clearTimeout(warmReadyTimer);
        warmReadyTimer = null;
      }
      previousSource?.close();
      markStreamAlive();
      scheduleWarmHandoff();
    };

    function openEventSource(warming: boolean) {
      if (disposed || reconnecting) return;
      const source = new EventSource(streamUrl);
      if (warming) {
        warmingEventSource?.close();
        warmingEventSource = source;
        warmingAuthenticated = false;
        warmReadyTimer = window.setTimeout(() => discardWarmingSource(source), 20_000);
      } else {
        activeEventSource?.close();
        activeEventSource = source;
      }

      source.addEventListener("open", () => {
        if (source === activeEventSource) lastServerSignalAt = Date.now();
      });
      source.addEventListener("status", () => {
        if (source === warmingEventSource) warmingAuthenticated = true;
        else if (source === activeEventSource) markStreamAlive();
      });
      source.addEventListener("heartbeat", () => {
        if (source === activeEventSource) markStreamAlive();
      });
      source.addEventListener("rotate", () => {
        if (source !== activeEventSource) return;
        // A warm replacement should normally already have been promoted. If it
        // has not, force a clean retry rather than leaving a dead chart stream.
        reconnect();
      });
      source.addEventListener("feed-error", (event) => {
        if (source === warmingEventSource) {
          discardWarmingSource(source);
          return;
        }
        if (source !== activeEventSource) return;
        lastServerSignalAt = Date.now();
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as { error?: string };
          if (payload.error) {
            streamMarkedHealthy = false;
            setFeedErrorByBroker((current) => ({ ...current, [activeChartBrokerLabel]: payload.error as string }));
          }
        } catch {
          // The EventSource error handler reconnects malformed failures.
        }
      });
      source.onmessage = (event) => {
        if (source === warmingEventSource) {
          // The route can replay one cached quote before Databento has
          // authenticated. Only promote after status + a subsequent market
          // payload prove that the replacement is genuinely producing ticks.
          if (!warmingAuthenticated) return;
          promoteWarmingSource(source);
        }
        if (source === activeEventSource) handlePriceMessage(event);
      };
      source.onerror = () => {
        if (source === warmingEventSource) {
          discardWarmingSource(source);
          return;
        }
        if (source !== activeEventSource) return;
        reconnect();
        console.log(`${activeChartBrokerLabel} stream disconnected, reconnecting...`);
      };
    }

    publishDatabentoStatus("connecting");
    openEventSource(false);
    scheduleWarmHandoff();

    return () => {
      disposed = true;
      activeEventSource?.close();
      warmingEventSource?.close();
      window.clearInterval(healthTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (warmHandoffTimer !== null) window.clearTimeout(warmHandoffTimer);
      if (warmReadyTimer !== null) window.clearTimeout(warmReadyTimer);
      pendingWatchlistPricesRef.current.clear();
      if (liveQuoteCacheTimerRef.current !== null) {
        window.clearTimeout(liveQuoteCacheTimerRef.current);
        liveQuoteCacheTimerRef.current = null;
      }
      if (pendingLiveQuoteCacheRef.current.size) {
        writeLiveQuoteCache(pendingLiveQuoteCacheRef.current.values());
        pendingLiveQuoteCacheRef.current.clear();
      }
      if (watchlistLiveFrameRef.current !== null) {
        window.clearTimeout(watchlistLiveFrameRef.current);
        watchlistLiveFrameRef.current = null;
      }
    };
  }, [activeChartBrokerLabel, bottomWorkspaceSection, priorityLiveSymbolsCsv, streamReconnectNonce, usingCTraderFeed, usingDatabentoFeed, watchlistSymbolsCsv]);

  useEffect(() => {
    if (section !== "charts") return;
    if (activeChartBrokerLabel === "Massive" || activeChartBrokerLabel === "Databento") {
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

    let requestInFlight = false;

    const fetchPrices = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        if (usingCTraderFeed) {
          const lastTickAt = lastStreamTickAtByBrokerRef.current[activeChartBrokerLabel] ?? 0;
          const streamRecentlyAlive = streamHealthyByBroker[activeChartBrokerLabel] && Date.now() - lastTickAt < 3000;
          if (streamRecentlyAlive) return;
        }
        const res = await fetch(
          activeChartBrokerLabel === "Market Index"
            ? `/api/market-indices?snapshot=1&symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
          : activeChartBrokerLabel === "Massive"
            ? `/api/massive-futures/snapshot?symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
            : usingCTraderFeed
              ? `/api/ctrader?action=pricing&broker=${encodeURIComponent(activeChartBrokerLabel)}&symbols=${encodeURIComponent(watchlistSymbolsCsv)}`
              : "/api/oanda?action=pricing",
          { cache: "no-store" },
        );
        const data = await res.json();
        const usingSnapshotPrices = activeChartBrokerLabel === "Massive" || activeChartBrokerLabel === "Market Index";
        const prices = usingSnapshotPrices ? data.snapshots : data.prices;
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

        prices.forEach((price: { instrument?: string; symbol?: string; bid?: number; ask?: number; mid?: number; broker?: string; lastPrice?: number; openPrice?: number; timestamp?: number; delayed?: boolean; marketOpen?: boolean }) => {
          const displayName =
            usingSnapshotPrices
              ? price.symbol || ""
              : usingCTraderFeed
                ? price.instrument || ""
                : (nameMap[price.instrument || ""] || price.instrument || "");
          const mid = usingSnapshotPrices ? Number(price.lastPrice ?? 0) : Number(price.mid ?? 0);
          const bid = usingSnapshotPrices ? mid : Number(price.bid ?? mid);
          const ask = usingSnapshotPrices ? mid : Number(price.ask ?? mid);
          const openPriceFromFeed = usingSnapshotPrices ? Number(price.openPrice ?? mid) : undefined;

          setWatchlist((current) => current.map((item) => {
            if (item.symbol !== displayName || item.broker !== activeChartBrokerLabel) return item;
            const prevMid = item.lastPrice || mid;
            const moveRatio = prevMid > 0 ? Math.abs(mid - prevMid) / prevMid : 0;
            if (moveRatio > 0.2) return item;
            const openPrice = openPriceFromFeed || item.openPrice || mid;
            return {
              ...item,
              broker: price.broker || activeChartBrokerLabel,
              delayed: price.delayed ?? item.delayed,
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

          if (
            displayName === selectedInstrument
            && chartTrades.length === 0
            && (activeChartBrokerLabel !== "Market Index" || price.marketOpen === true)
          ) {
            setChartCandles((prev) => mergeLiveMidIntoCandles(
              prev,
              mid,
              selectedInstrument,
              selectedTimeframe,
              marketTimestamp(price.timestamp),
            ));
          }
        });

        window.setTimeout(() => {
          setWatchlist((current) => current.some((item) => item.flash)
            ? current.map((item) => item.flash ? { ...item, flash: null } : item)
            : current);
        }, 300);
      } catch (err) {
        console.error("Price fetch error:", err);
      } finally {
        requestInFlight = false;
      }
    };

    fetchPrices();
    const interval = window.setInterval(fetchPrices, activeChartBrokerLabel === "Market Index" ? 2_000 : 500);
    return () => window.clearInterval(interval);
  }, [activeChartBrokerLabel, chartTrades.length, section, selectedInstrument, selectedTimeframe, streamHealthyByBroker, usingCTraderFeed, watchlistSymbolsCsv]);

  useEffect(() => {
    if (section !== "charts") return;
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
      if (brokers.length === 0) return;
      await Promise.all(
        brokers.map(async (broker) => {
          const symbols = watchlistBrokerSymbols[broker];
          if (!symbols || symbols.length === 0) return;
          const isCTrader = cTraderBrokerNameSet.has(broker);
          const usesSnapshotPrices = broker === "Massive" || broker === "Market Index";
          const url = broker === "Market Index"
            ? `/api/market-indices?snapshot=1&symbols=${encodeURIComponent(symbols.join(","))}`
            : broker === "Massive"
            ? `/api/massive-futures/snapshot?symbols=${encodeURIComponent(symbols.join(","))}`
            : isCTrader
              ? `/api/ctrader?action=pricing&broker=${encodeURIComponent(broker)}&symbols=${encodeURIComponent(symbols.join(","))}`
              : "/api/oanda?action=pricing";

          try {
            const res = await fetch(url);
            const data = await res.json();
            const prices = usesSnapshotPrices ? data.snapshots : data.prices;
            if (!res.ok || data.error || !Array.isArray(prices)) return;

            prices.forEach((price: { instrument?: string; symbol?: string; bid?: number; ask?: number; mid?: number; broker?: string; lastPrice?: number; openPrice?: number; delayed?: boolean }) => {
              const displayName = usesSnapshotPrices ? price.symbol || "" : isCTrader ? price.instrument || "" : (nameMap[price.instrument || ""] || price.instrument || "");
              const mid = usesSnapshotPrices ? Number(price.lastPrice ?? 0) : Number(price.mid ?? 0);
              const bid = usesSnapshotPrices ? mid : Number(price.bid ?? mid);
              const ask = usesSnapshotPrices ? mid : Number(price.ask ?? mid);
              const openPriceFromFeed = usesSnapshotPrices ? Number(price.openPrice ?? mid) : undefined;
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
                    delayed: price.delayed ?? item.delayed,
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
        setWatchlist((current) => current.some((item) => item.flash)
          ? current.map((item) => item.flash ? { ...item, flash: null } : item)
          : current);
      }, 250);
    };

    updateInactiveFeeds();
    const interval = window.setInterval(updateInactiveFeeds, 5_000);
    return () => window.clearInterval(interval);
  }, [activeChartBrokerLabel, cTraderBrokerNameSet, section, watchlistBrokerSymbols]);

  async function fetchChartCandles(
    outputsize = 500,
    period = selectedPeriod,
    signal?: AbortSignal,
  ) {
    const periodConfig = getPeriodConfig(period);
    const oandaInstrument = OANDA_INSTRUMENT_MAP[selectedInstrument];
    const oandaGranularity = OANDA_GRANULARITY_MAP[selectedTimeframe] || "M5";
    const from = Date.parse(periodConfig.from);
    const to = Date.now();
    const historicalLimit = getHistoricalCandleLimit(period, selectedTimeframe, outputsize);

    if (activeChartBrokerLabel === "Databento") {
      const cached = await readCompatibleChartHistoryCache(selectedInstrument, selectedTimeframe);
      if (signal?.aborted) throw new DOMException("Chart request cancelled.", "AbortError");
      try {
        const downloaded = await fetchWorkspaceCandles(
          selectedInstrument,
          selectedTimeframe,
          "Databento",
          period,
          outputsize,
          false,
          signal,
        );
        const merged = mergeChartHistory(cached?.candles ?? [], downloaded);
        return merged.filter((candle) => candle.timestamp >= from);
      } catch (error) {
        const fallback = (cached?.candles ?? []).filter((candle) => candle.timestamp >= from);
        if (fallback.length) return sanitizeCandles(fallback, selectedInstrument);
        throw error;
      }
    }

    if (activeChartBrokerLabel === "Market Index") {
      const response = await fetch(
        `/api/market-indices?symbol=${encodeURIComponent(selectedInstrument)}&timeframe=${encodeURIComponent(selectedTimeframe)}&from=${from}&to=${to}`,
        { cache: "no-store", signal },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `${selectedInstrument} index history is unavailable.`);
      return sanitizeCandles((payload.candles ?? []) as Candle[], selectedInstrument);
    }

    try {
      const storedUrl = `/api/market-data/history?broker=${encodeURIComponent(activeChartBrokerLabel)}&symbol=${encodeURIComponent(selectedInstrument)}&timeframe=${encodeURIComponent(selectedTimeframe)}&from=${from}&to=${to}&limit=${historicalLimit}`;
      const storedRes = await fetch(storedUrl, { cache: "no-store", signal });
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
          { signal },
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
        { cache: "no-store", signal },
      );
      const data = await res.json();
      return sanitizeCandles((data.candles || []) as Candle[], selectedInstrument);
    }

    if (oandaInstrument) {
      try {
        let url = `/api/oanda?action=candles&instrument=${oandaInstrument}&granularity=${oandaGranularity}`;
        url += `&from=${encodeURIComponent(periodConfig.from)}&to=${encodeURIComponent(new Date(to).toISOString())}&maxCandles=${historicalLimit}`;
        const res = await fetch(url, { signal });
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          return sanitizeCandles(data.candles as Candle[], selectedInstrument);
        }
      } catch {
        // Fall back to the existing market-data route when OANDA is unavailable.
      }
    }

    const res = await fetch(
      `/api/market-data?symbol=${selectedInstrument}&interval=${selectedTimeframe}&outputsize=${outputsize}`,
      { signal },
    );
    const data = await res.json();
    return sanitizeCandles((data.candles || []) as Candle[], selectedInstrument);
  }

  useEffect(() => {
    if (section !== "charts") return;
    if (!selectedInstrument) return;
    if (chartTrades.length > 0) return;

    let requestInFlight = false;

    const checkNewCandle = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const oandaInst = OANDA_INSTRUMENT_MAP[selectedInstrument];
        const oandaGran = OANDA_GRANULARITY_MAP[selectedTimeframe] || "M5";
        const url = usingCTraderFeed
          ? `/api/ctrader?action=candles&broker=${encodeURIComponent(activeChartBrokerLabel)}&symbol=${encodeURIComponent(selectedInstrument)}&interval=${encodeURIComponent(selectedTimeframe)}&count=3`
          : activeChartBrokerLabel === "Databento"
            ? null
          : activeChartBrokerLabel === "Market Index"
            ? `/api/market-indices?snapshot=1&symbols=${encodeURIComponent(selectedInstrument)}`
          : activeChartBrokerLabel === "Massive"
            ? `/api/massive-futures/snapshot?symbols=${encodeURIComponent(selectedInstrument)}`
          : oandaInst
            ? `/api/oanda?action=candles&instrument=${oandaInst}&granularity=${oandaGran}&count=3`
            : null;

        if (!url) return;

        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if ((activeChartBrokerLabel === "Massive" || activeChartBrokerLabel === "Market Index") && Array.isArray(data.snapshots) && data.snapshots[0]?.lastPrice) {
          const snapshot = data.snapshots[0];
          if (activeChartBrokerLabel !== "Market Index" || snapshot.marketOpen === true) {
            setChartCandles((prev) => mergeLiveMidIntoCandles(
              prev,
              Number(snapshot.lastPrice),
              selectedInstrument,
              selectedTimeframe,
              marketTimestamp(snapshot.timestamp),
            ));
          }
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
      } catch {
        // Keep the last valid bar until the next scheduled snapshot retry.
      } finally {
        requestInFlight = false;
      }
    };

    const interval = window.setInterval(checkNewCandle, 5000);
    return () => window.clearInterval(interval);
  }, [activeChartBrokerLabel, chartTrades.length, section, selectedInstrument, selectedTimeframe, usingCTraderFeed]);

  useEffect(() => {
    if (section !== "charts") return;
    let cancelled = false;
    const requestController = new AbortController();
    let clearMessageTimer: number | null = null;

    const loadData = async () => {
      try {
        showReportToast("loading", "Updating report...");
        const periodConfig = getPeriodConfig(selectedPeriod);
        if (isTooManyCandles(selectedPeriod, selectedTimeframe)) {
          setChartLoadingMessage("Too many candles for this timeframe/period combination. Reduce the period or increase the timeframe.");
          return;
        }
        setChartLoadingMessage(`Loading ${periodConfig.label} of ${selectedTimeframe} data... this may take a moment`);
        const candles = await fetchChartCandles(
          getHistoricalCandleLimit(selectedPeriod, selectedTimeframe, 500),
          selectedPeriod,
          requestController.signal,
        );
        if (cancelled) return;
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
          showReportToast("success", `Report updated — ${displayCmeSymbol(selectedInstrument)} ${selectedTimeframe}`, 2000);
          setChartLoadingMessage(`Loaded ${candles.length.toLocaleString()} candles`);
        } else {
          // Never substitute fabricated candles for a feed that returned
          // nothing. An empty feed is reported as exactly that; whatever real
          // candles are already on screen stay untouched.
          setChartLoadingMessage(`${activeChartBrokerLabel} returned no ${selectedTimeframe} candles for this window.`);
          showReportToast("error", `No candles from ${activeChartBrokerLabel} — chart not updated`, 3000);
        }
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === "AbortError")) return;
        setChartLoadingMessage(activeChartBrokerLabel === "Databento" ? "Connecting to CME history…" : "");
        showReportToast("error", activeChartBrokerLabel === "Databento" ? "CME history is reconnecting" : "Failed to update report", 3000);
      } finally {
        if (!cancelled) {
          clearMessageTimer = window.setTimeout(() => setChartLoadingMessage(""), 3500);
        }
      }
    };
    void loadData();
    return () => {
      cancelled = true;
      requestController.abort();
      if (clearMessageTimer !== null) window.clearTimeout(clearMessageTimer);
    };
  }, [section, selectedInstrument, selectedTimeframe, selectedPeriod]);

  useEffect(() => {
    if (!backtestResult || backtestResult.error) {
      showReportToast("loading", "Updating report...");
      window.setTimeout(() => showReportToast("success", `Report updated — ${displayCmeSymbol(selectedInstrument)} ${selectedTimeframe}`, 2000), 300);
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
          showReportToast("success", `Report updated — ${displayCmeSymbol(selectedInstrument)} ${selectedTimeframe}`, 2000);
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
      const existingDisplayName = (
        (user?.user_metadata?.display_name as string | undefined)
        ?? (user?.user_metadata?.full_name as string | undefined)
        ?? existingUsername
        ?? user.email?.split("@")[0]
        ?? "Trader"
      ).trim();
      setCurrentUsername(existingUsername ?? "Account");
      setCurrentDisplayName(existingDisplayName || "Trader");
      let hydrated: Awaited<ReturnType<typeof hydrateUserPreferences>> | null = null;
      try {
        hydrated = await hydrateUserPreferences(supabase, user);
        if (hydrated.changed) {
          // Account preferences are applied to localStorage by the hydrator.
          // Reconcile the chart shell in place before it is allowed to mount.
          // The previous hard reload mounted the chart with stale local state,
          // downloaded its history, then tore everything down and repeated the
          // entire load once the cloud snapshot arrived.
          const nextLayoutValue = window.localStorage.getItem("olisa-chart-workspace-layout");
          const nextLayout: WorkspaceLayout = nextLayoutValue === "split-vertical"
            || nextLayoutValue === "split-horizontal"
            || nextLayoutValue === "quad"
            || nextLayoutValue === "custom"
            || nextLayoutValue === "single"
            ? nextLayoutValue
            : "single";

          let nextPanes = DEFAULT_WORKSPACE_PANES;
          try {
            const parsed = JSON.parse(window.localStorage.getItem("olisa-chart-workspace-panes") ?? "null") as Partial<WorkspacePane>[] | null;
            if (parsed?.length) {
              nextPanes = parsed.map((pane, index) =>
                normalizeWorkspacePane(pane, DEFAULT_WORKSPACE_PANES[index] ?? DEFAULT_WORKSPACE_PANES[0]));
            }
          } catch {
            nextPanes = DEFAULT_WORKSPACE_PANES;
          }

          let nextTree: WorkspaceLayoutNode;
          try {
            nextTree = normalizeWorkspaceLayoutNode(
              JSON.parse(window.localStorage.getItem("olisa-chart-workspace-tree") ?? "null"),
              new Set(nextPanes.map((pane) => pane.id)),
            ) ?? createWorkspaceLayoutTree(nextLayout === "custom" ? "single" : nextLayout, nextPanes);
          } catch {
            nextTree = createWorkspaceLayoutTree(nextLayout === "custom" ? "single" : nextLayout, nextPanes);
          }

          const requestedActivePaneId = window.localStorage.getItem("olisa-chart-workspace-active-pane");
          const nextActivePane = nextPanes.find((pane) => pane.id === requestedActivePaneId)
            ?? nextPanes[0]
            ?? DEFAULT_WORKSPACE_PANES[0];

          setWorkspaceLayout(nextLayout);
          setWorkspacePanes(nextPanes);
          setWorkspaceTree(nextTree);
          setWorkspaceFloatingWindows(loadWorkspaceFloatingWindows(new Set(nextPanes.map((pane) => pane.id))));
          setActivePaneId(nextActivePane.id);
          setSelectedInstrument(nextActivePane.symbol);
          setSelectedTimeframe(nextActivePane.timeframe);
          setSelectedPeriod(nextActivePane.period);
          setSelectedWatchlistKey(nextActivePane.watchlistKey);
          setConnectedBroker(nextActivePane.broker);

          const nextChartSettings = loadStoredChartSettings();
          setChartSettings(nextChartSettings);
          setDraftChartSettings(nextChartSettings);
          setChartSettingsSnapshot(nextChartSettings);

          try {
            const current = window.localStorage.getItem(CHART_INDICATORS_STORAGE_KEY);
            const legacy = window.localStorage.getItem("olisa-chart-pane-indicators");
            setPaneIndicators(normalizePaneIndicatorState(JSON.parse(current ?? legacy ?? "{}")));
          } catch {
            setPaneIndicators({});
          }

          try {
            const savedIntervals = JSON.parse(window.localStorage.getItem("olisa-chart-favourite-intervals") ?? "null");
            if (Array.isArray(savedIntervals) && savedIntervals.every((item) => typeof item === "string")) {
              setFavTFs(savedIntervals);
            }
          } catch {
            // Keep the already-normalized interval defaults.
          }

          try {
            const storedVisibility = window.localStorage.getItem(PANE_LEVEL_VISIBILITY_STORAGE_KEY);
            if (storedVisibility) {
              setPaneLevelVisibility(normalizePaneLevelVisibility(JSON.parse(storedVisibility)));
            } else {
              const legacyVisibility: PaneLevelVisibility = {
                gamma: window.localStorage.getItem(GAMMA_LEVELS_ENABLED_STORAGE_KEY) === "true",
                kwant: false,
                structure: window.localStorage.getItem(HISTORICAL_STRUCTURE_ENABLED_STORAGE_KEY) === "true",
                valueArea: window.localStorage.getItem(VALUE_AREA_LEVELS_ENABLED_STORAGE_KEY) === "true",
              };
              setPaneLevelVisibility(Object.values(legacyVisibility).some(Boolean)
                ? { [nextActivePane.id]: legacyVisibility }
                : {});
            }
          } catch {
            setPaneLevelVisibility({});
          }
          setGameplanChartOverlays(loadGameplanChartOverlays());
        }
      } catch {
        // Keep the authenticated workspace available if preference sync is temporarily offline.
      }
      setPreferenceUserId(user.id);
      setPreferencesReady(true);
      const hasStoredChartSettings = hydrated
        ? Object.prototype.hasOwnProperty.call(
            hydrated.snapshot.values,
            "olisa-chart-settings",
          )
        : false;
      const profileChartSettings = hasStoredChartSettings ? null : extractUserChartSettings(user);
      if (!hasStoredChartSettings && profileChartSettings) {
        setChartSettings(profileChartSettings);
        setDraftChartSettings(profileChartSettings);
        setChartSettingsSnapshot(profileChartSettings);
        saveStoredChartSettings(profileChartSettings);
      }
      void compactLegacyAuthPreferenceMetadata(supabase, user).catch(() => {
        // Database/local preference sync remains authoritative. A later
        // authenticated mount retries this one-time metadata compaction.
      });
      setAuthChecked(true);
    };

    checkUsername();
  }, [router, supabase]);

  useEffect(() => {
    if (!authChecked || !preferenceUserId) return;
    let active = true;
    const cachedIdentity = readProfileIdentityCache(preferenceUserId);
    if (cachedIdentity) {
      setCurrentAvatarUrl(cachedIdentity.avatarUrl);
      if (cachedIdentity.displayName) setCurrentDisplayName(cachedIdentity.displayName);
      if (cachedIdentity.handle) setCurrentUsername(cachedIdentity.handle);
    }
    const loadAvatar = async () => {
      try {
        const response = await fetch("/api/friends", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as FriendsPayload;
        if (active) {
          setCurrentAvatarUrl(payload.viewer?.avatarUrl ?? "");
          if (payload.viewer?.displayName) setCurrentDisplayName(payload.viewer.displayName);
          cacheProfileIdentity(preferenceUserId, {
            avatarUrl: payload.viewer?.avatarUrl ?? "",
            displayName: payload.viewer?.displayName ?? "",
            handle: payload.viewer?.handle ?? "",
          });
        }
      } catch {
        // Keep the account control available with its initials fallback.
      }
    };
    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl?: string; displayName?: string; handle?: string }>).detail;
      setCurrentAvatarUrl(detail?.avatarUrl ?? "");
      cacheProfileIdentity(preferenceUserId, {
        avatarUrl: detail?.avatarUrl ?? "",
        displayName: detail?.displayName,
        handle: detail?.handle,
      });
    };
    const handleIdentityUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ displayName?: string; handle?: string }>).detail;
      if (detail?.displayName) setCurrentDisplayName(detail.displayName);
      if (detail?.handle) setCurrentUsername(detail.handle);
      cacheProfileIdentity(preferenceUserId, {
        displayName: detail?.displayName,
        handle: detail?.handle,
      });
    };
    void loadAvatar();
    window.addEventListener("kwantdesk:profile-updated", handleProfileUpdated);
    window.addEventListener("kwantdesk:identity-updated", handleIdentityUpdated);
    return () => {
      active = false;
      window.removeEventListener("kwantdesk:profile-updated", handleProfileUpdated);
      window.removeEventListener("kwantdesk:identity-updated", handleIdentityUpdated);
    };
  }, [authChecked, preferenceUserId]);

  useEffect(() => {
    saveStoredChartSettings(chartSettings);
  }, [chartSettings]);

  useEffect(() => {
    if (!authChecked || typeof window === "undefined") return;
    const migrationKey = "kwantdesk:midnight-cockpit-chart:v1";
    if (window.localStorage.getItem(migrationKey) === "applied") return;

    const migrated: ChartSettings = {
      ...chartSettings,
      colorBarsPreviousClose: defaultChartSettings.colorBarsPreviousClose,
      upColor: defaultChartSettings.upColor,
      downColor: defaultChartSettings.downColor,
      borderUpColor: defaultChartSettings.borderUpColor,
      borderDownColor: defaultChartSettings.borderDownColor,
      wickUpColor: defaultChartSettings.wickUpColor,
      wickDownColor: defaultChartSettings.wickDownColor,
      backgroundColor: defaultChartSettings.backgroundColor,
      gridColor: defaultChartSettings.gridColor,
    };
    window.localStorage.setItem(migrationKey, "applied");
    setChartSettings(migrated);
    setDraftChartSettings(migrated);
    setChartSettingsSnapshot(migrated);
    saveStoredChartSettings(migrated);
  }, [authChecked, chartSettings]);

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

  const signOut = useCallback(async () => {
    await supabase?.auth?.signOut();
    setCurrentUsername("Account");
    setCurrentDisplayName("");
    setShowUsernameModal(false);
    router.replace("/login?returnTo=/");
  }, [router, supabase]);

  const handleWorkspaceNavigationStart = useCallback((target: string) => {
    const nextSection = BOTTOM_WORKSPACE_SECTIONS.some(({ id }) => id === target)
      ? target as PrimaryWorkspaceSection
      : null;
    const previousSection = activeWorkspaceSectionRef.current;

    if (nextSection) {
      pendingWorkspaceNavigationRef.current = nextSection;
    }

    if (!nextSection) {
      // Settings/Home leave the persistent shell. Stop publishing live ticks
      // as soon as the pointer goes down so the Next route transition is never
      // competing with chart reconciliation while it starts.
      activeWorkspaceSectionRef.current = null;
      setRightPanel(null);
      return;
    }

    if (nextSection && nextSection !== previousSection) {
      // Treat a navigation click as urgent UI work. Updating the visible
      // section and active ref synchronously unmounts Charts and closes its
      // streams before Next's route transition or a lazy bundle can be
      // delayed by accumulated order-flow calculations.
      activeWorkspaceSectionRef.current = nextSection;
      setOptimisticWorkspaceSection(nextSection);
      setVisitedWorkspaceSections((current) => {
        if (current.has(nextSection)) return current;
        const next = new Set(current);
        next.add(nextSection);
        return next;
      });
      setRightPanel(null);
      warmWorkspaceSection(nextSection);
    }
  }, [warmWorkspaceSection]);

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
    setCurrentDisplayName(newUsername);
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
  const ratio = (value: number) => value === Infinity || value >= 999 ? "∞" : value.toFixed(2);
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

  const setIndicatorsForPane = useCallback((paneId: string, next: ChartIndicatorInstance[]) => {
    setChartIndicatorsSuppressed(false);
    setPaneIndicators((current) => ({
      ...current,
      [paneId]: next.map((instance) => ({
        ...instance,
        settings: instance.settings ? { ...instance.settings } : undefined,
      })),
    }));
  }, []);

  const togglePaneLevelVisibility = useCallback((
    paneId: string,
    key: keyof PaneLevelVisibility,
  ) => {
    setPaneLevelVisibility((current) => {
      const visibility = current[paneId] ?? EMPTY_PANE_LEVEL_VISIBILITY;
      return {
        ...current,
        [paneId]: { ...visibility, [key]: !visibility[key] },
      };
    });
  }, []);

  const setPaneLevelVisible = useCallback((
    paneId: string,
    key: keyof PaneLevelVisibility,
    visible: boolean,
  ) => {
    setPaneLevelVisibility((current) => ({
      ...current,
      [paneId]: {
        ...(current[paneId] ?? EMPTY_PANE_LEVEL_VISIBILITY),
        [key]: visible,
      },
    }));
  }, []);

  const updatePaneIndicatorSetting = useCallback((
    paneId: string,
    instanceId: string,
    key: string,
    value: number | string | boolean,
  ) => {
    setPaneIndicators((current) => ({
      ...current,
      [paneId]: (current[paneId] ?? []).map((instance) =>
        instance.instanceId === instanceId
          ? { ...instance, settings: { ...(instance.settings ?? {}), [key]: value } }
          : instance),
    }));
  }, []);

  const handleRemoveAllIndicatorsFromChart = useCallback(() => {
    if (!activePaneIsChart) return;
    setChartIndicatorsSuppressed(true);
    setPaneIndicators((current) => ({ ...current, [activePaneId]: [] }));
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
  }, [activePaneId, activePaneIsChart]);

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
    setWatchlistPanelContextMenu(null);
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
    const isDropTarget = watchlistDropTarget?.sectionId === section.id && watchlistDropTarget.symbol === row.key;
    const isFavorite = watchlistFavorites.includes(row.key);
    const isSelected = bottomWorkspaceSection === "liqmap"
      ? liquidityMapInstrument(row.symbol) === selectedLiquidityMapInstrument
      : selectedWatchlistKey === row.key;
    return (
      <button
        key={row.key}
        draggable
        onClick={() => selectInstrument(row.symbol, row.broker, row.key)}
        onContextMenu={(event) => {
          event.preventDefault();
          setWatchlistPanelContextMenu(null);
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
        className={`grid w-full min-w-[340px] grid-cols-[minmax(92px,1fr)_74px_54px_54px] items-center gap-2 border-t-2 px-3 py-2 text-left transition-colors hover:bg-surface/60 ${isDropTarget ? "border-blue-500" : "border-transparent"} ${isSelected ? "bg-surface" : ""}`}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {watchlistFlags[row.key] && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: watchlistFlags[row.key] }} />}
            <span className="block truncate text-[9px] uppercase tracking-wider text-muted">{displayMarketSource(row.broker)}</span>
            {row.delayed && (
              <AlertTriangle className="h-3 w-3 shrink-0 text-orange-300/90" aria-label="Delayed market data" />
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="block truncate text-[13px] font-medium text-foreground">{displayCmeSymbol(row.symbol)}</span>
            {row.contractSymbol ? <span className="shrink-0 font-mono text-[9px] text-muted">{row.contractSymbol}</span> : null}
            {isFavorite && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${displayCmeSymbol(row.symbol)} from favorites`}
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
        <LiveWatchlistNumbers row={row} />
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

  const applyWorkspaceLayoutTemplate = (layout: Exclude<WorkspaceLayout, "custom">) => {
    const requiredPaneCount = layout === "quad" ? 4 : layout === "single" ? 1 : 2;
    const nextPanes = [...workspacePanes];
    for (const defaultPane of DEFAULT_WORKSPACE_PANES) {
      if (nextPanes.length >= requiredPaneCount) break;
      if (!nextPanes.some((pane) => pane.id === defaultPane.id)) {
        nextPanes.push({ ...defaultPane });
      }
    }
    while (nextPanes.length < requiredPaneCount) {
      const source = DEFAULT_WORKSPACE_PANES[nextPanes.length] ?? DEFAULT_WORKSPACE_PANES[0];
      nextPanes.push({
        ...source,
        id: `pane-${Date.now()}-${nextPanes.length + 1}`,
      });
    }
    const currentlyVisible = new Set(collectWorkspacePaneIds(workspaceTree));
    const orderedPanes = [
      activeWorkspacePane,
      ...nextPanes.filter((pane) => pane.id !== activeWorkspacePane.id),
    ].map((pane, index) => (
      index === 0 || currentlyVisible.has(pane.id)
        ? pane
        : { ...pane, content: null }
    ));
    setWorkspacePanes(orderedPanes);
    setWorkspaceLayout(layout);
    setWorkspaceTree(createWorkspaceLayoutTree(layout, orderedPanes));
    setWorkspaceFloatingWindows([]);
    const firstEmptyPane = orderedPanes.slice(0, requiredPaneCount).find((pane) => pane.content === null);
    setWorkspacePanelPickerPaneId(firstEmptyPane?.id ?? null);
  };

  const addChartToWorkspace = () => {
    if (workspaceLocked) {
      showReportToast("error", "Unlock the workspace before adding a chart", 2200);
      return;
    }
    if (workspacePanes.length >= 12) {
      showReportToast("error", "This workspace already has the maximum of 12 panels", 2200);
      return;
    }
    const paneElement = workspaceAreaRef.current?.querySelector<HTMLElement>(
      `[data-workspace-pane-id="${activePaneId}"]`,
    );
    const paneRect = paneElement?.getBoundingClientRect();
    const splitAxis: "x" | "y" = !paneRect || paneRect.width >= paneRect.height ? "x" : "y";
    const nextPaneId = `pane-${crypto.randomUUID()}`;
    const nextPane: WorkspacePane = {
      ...activeWorkspacePane,
      id: nextPaneId,
      period: "1W",
      content: null,
    };
    setWorkspacePanes((current) => [...current, nextPane]);
    setWorkspaceTree((current) =>
      insertWorkspacePane(current, activePaneId, nextPaneId, splitAxis, `split-${crypto.randomUUID()}`));
    setWorkspaceLayout("custom");
    setActivePaneId(nextPaneId);
    setWorkspacePanelPickerPaneId(nextPaneId);
    setShowWorkspacePresetMenu(false);
    showReportToast("success", "Panel added — choose what to open", 1600);
  };

  const detachWorkspacePane = (paneId: string) => {
    if (workspaceLocked) {
      showReportToast("error", "Unlock the workspace before detaching a panel", 2200);
      return;
    }
    if (workspaceFloatingWindows.some((entry) => entry.paneId === paneId)) return;
    const areaRect = workspaceAreaRef.current?.getBoundingClientRect();
    const paneRect = workspaceAreaRef.current
      ?.querySelector<HTMLElement>(`[data-workspace-pane-id="${paneId}"]`)
      ?.getBoundingClientRect();
    const width = areaRect && paneRect
      ? Math.min(0.96, Math.max(0.16, paneRect.width / areaRect.width))
      : 0.58;
    const height = areaRect && paneRect
      ? Math.min(0.96, Math.max(0.2, paneRect.height / areaRect.height))
      : 0.62;
    const x = areaRect && paneRect
      ? Math.min(1 - width, Math.max(0, (paneRect.left - areaRect.left) / areaRect.width))
      : 0.18;
    const y = areaRect && paneRect
      ? Math.min(1 - height, Math.max(0, (paneRect.top - areaRect.top) / areaRect.height))
      : 0.12;
    setWorkspaceFloatingWindows((current) => [
      ...current,
      { paneId, x, y, width, height, locked: false },
    ]);
    // Preserve this pane's grid slot while it floats. Removing the slot makes
    // the neighbouring pane expand into it, so moving one detached window
    // visibly pushes unrelated panels around the workspace.
    setActivePaneId(paneId);
    showReportToast("success", "Panel detached â€” move, resize or lock it", 1800);
  };

  const dockWorkspacePane = (paneId: string) => {
    if (workspaceLocked) {
      showReportToast("error", "Unlock the workspace before docking a panel", 2200);
      return;
    }
    setWorkspaceFloatingWindows((current) => current.filter((entry) => entry.paneId !== paneId));
    const visibleIds = collectWorkspacePaneIds(workspaceTree);
    if (!visibleIds.includes(paneId)) {
      const targetPaneId = visibleIds.includes(activePaneId) && activePaneId !== paneId
        ? activePaneId
        : visibleIds[0];
      if (targetPaneId) {
        const targetRect = workspaceAreaRef.current
          ?.querySelector<HTMLElement>(`[data-workspace-pane-id="${targetPaneId}"]`)
          ?.getBoundingClientRect();
        const splitAxis: "x" | "y" = !targetRect || targetRect.width >= targetRect.height ? "x" : "y";
        setWorkspaceTree((current) => insertWorkspacePane(
          current,
          targetPaneId,
          paneId,
          splitAxis,
          `split-${crypto.randomUUID()}`,
        ));
        setWorkspaceLayout("custom");
      }
    }
    setActivePaneId(paneId);
    showReportToast("success", "Panel returned to the workspace grid", 1500);
  };

  const toggleFloatingWorkspaceLock = (paneId: string) => {
    setWorkspaceFloatingWindows((current) => current.map((entry) =>
      entry.paneId === paneId ? { ...entry, locked: !entry.locked } : entry));
  };

  const activateFloatingWorkspacePane = (paneId: string) => {
    activateWorkspacePane(paneId);
    setWorkspaceFloatingWindows((current) => {
      if (current.at(-1)?.paneId === paneId) return current;
      const selected = current.find((entry) => entry.paneId === paneId);
      return selected ? [...current.filter((entry) => entry.paneId !== paneId), selected] : current;
    });
  };

  const startFloatingWorkspaceMove = (
    paneId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const floating = workspaceFloatingWindows.find((entry) => entry.paneId === paneId);
    const areaRect = workspaceAreaRef.current?.getBoundingClientRect();
    if (!floating || floating.locked || !areaRect) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const handleMove = (moveEvent: PointerEvent) => {
      const x = Math.min(1 - floating.width, Math.max(0, floating.x + (moveEvent.clientX - startX) / areaRect.width));
      const y = Math.min(1 - floating.height, Math.max(0, floating.y + (moveEvent.clientY - startY) / areaRect.height));
      setWorkspaceFloatingWindows((current) => current.map((entry) =>
        entry.paneId === paneId ? { ...entry, x, y } : entry));
    };
    const finishMove = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishMove);
      window.removeEventListener("pointercancel", finishMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finishMove);
    window.addEventListener("pointercancel", finishMove);
  };

  const startFloatingWorkspaceResize = (
    paneId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const floating = workspaceFloatingWindows.find((entry) => entry.paneId === paneId);
    const areaRect = workspaceAreaRef.current?.getBoundingClientRect();
    if (!floating || floating.locked || !areaRect) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    // Floating panels are terminal tiles rather than desktop pages. Keep a
    // small pixel floor, then let their contents reflow inside the pane.
    const minimumWidth = Math.min(0.92, Math.max(0.1, 180 / areaRect.width));
    const minimumHeight = Math.min(0.92, Math.max(0.16, 160 / areaRect.height));
    const handleResize = (moveEvent: PointerEvent) => {
      const width = Math.min(1 - floating.x, Math.max(minimumWidth, floating.width + (moveEvent.clientX - startX) / areaRect.width));
      const height = Math.min(1 - floating.y, Math.max(minimumHeight, floating.height + (moveEvent.clientY - startY) / areaRect.height));
      setWorkspaceFloatingWindows((current) => current.map((entry) =>
        entry.paneId === paneId ? { ...entry, width, height } : entry));
    };
    const finishResize = () => {
      window.removeEventListener("pointermove", handleResize);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleResize);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  };

  const closeWorkspacePane = (paneId: string) => {
    const visibleIds = collectWorkspacePaneIds(workspaceTree);
    if (workspacePanes.length <= 1) {
      showReportToast("error", "A workspace must keep at least one panel", 2000);
      return;
    }
    if (!visibleIds.includes(paneId)) {
      setWorkspaceFloatingWindows((current) => current.filter((entry) => entry.paneId !== paneId));
      setWorkspacePanes((current) => current.filter((pane) => pane.id !== paneId));
      const nextActiveId = visibleIds[0] ?? workspacePanes.find((pane) => pane.id !== paneId)?.id;
      if (nextActiveId) setActivePaneId(nextActiveId);
      showReportToast("success", "Floating panel removed", 1400);
      return;
    }
    if (visibleIds.length <= 1) {
      const replacement = workspacePanes.find((pane) => pane.id !== paneId);
      if (!replacement) return;
      setWorkspaceTree({ type: "pane", paneId: replacement.id });
      setWorkspacePanes((current) => current.filter((pane) => pane.id !== paneId));
      setWorkspaceFloatingWindows((current) => current.filter((entry) => entry.paneId !== paneId));
      setActivePaneId(replacement.id);
      setWorkspaceLayout("single");
      showReportToast("success", "Workspace panel removed", 1400);
      return;
    }
    const nextTree = removeWorkspacePane(workspaceTree, paneId);
    if (!nextTree) return;
    const remainingIds = collectWorkspacePaneIds(nextTree);
    const nextActiveId = activePaneId === paneId ? remainingIds[0] : activePaneId;
    const nextActivePane = workspacePanes.find((pane) => pane.id === nextActiveId)
      ?? workspacePanes.find((pane) => remainingIds.includes(pane.id));

    setWorkspaceTree(nextTree);
    setWorkspaceLayout(remainingIds.length === 1 ? "single" : "custom");
    setWorkspacePanes((current) => current.filter((pane) => pane.id !== paneId));
    setWorkspaceFloatingWindows((current) => current.filter((entry) => entry.paneId !== paneId));
    setDraggedWorkspacePaneId((current) => current === paneId ? null : current);
    setWorkspaceDropTargetPaneId((current) => current === paneId ? null : current);
    if (nextActivePane && activePaneId === paneId) {
      setActivePaneId(nextActivePane.id);
      setSelectedInstrument(nextActivePane.symbol);
      setSelectedTimeframe(nextActivePane.timeframe);
      setSelectedPeriod(nextActivePane.period);
      setConnectedBroker(nextActivePane.broker);
      setSelectedWatchlistKey(nextActivePane.watchlistKey);
    }
    showReportToast("success", "Workspace chart removed", 1400);
  };

  const startWorkspaceResize = (
    splitId: string,
    axis: "x" | "y",
    initialRatio: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (workspaceLocked) return;
    event.preventDefault();
    event.stopPropagation();
    const divider = event.currentTarget;
    const pointerId = event.pointerId;
    const splitContainer = divider.parentElement;
    if (!splitContainer) return;
    const firstPanel = splitContainer.children.item(0) as HTMLElement | null;
    const secondPanel = splitContainer.children.item(2) as HTMLElement | null;
    if (!firstPanel || !secondPanel) return;
    divider.setPointerCapture(pointerId);
    const rect = splitContainer.getBoundingClientRect();
    let visualRatio = initialRatio;
    let targetRatio = initialRatio;
    let dragActive = true;
    let animationFrame: number | null = null;
    const axisSize = Math.max(axis === "x" ? rect.width : rect.height, 1);
    const minimumRatio = Math.min(18, Math.max(4, 80 / axisSize * 100));
    const maximumRatio = 100 - minimumRatio;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const paintTargetedSplit = () => {
      animationFrame = null;
      const difference = targetRatio - visualRatio;
      visualRatio = Math.abs(difference) < 0.04
        ? targetRatio
        : visualRatio + difference * 0.68;
      if (axis === "x") {
        firstPanel.style.width = `calc(${visualRatio}% - 3px)`;
        divider.style.left = `${visualRatio}%`;
        secondPanel.style.width = `calc(${100 - visualRatio}% - 3px)`;
      } else {
        firstPanel.style.height = `calc(${visualRatio}% - 3px)`;
        divider.style.top = `${visualRatio}%`;
        secondPanel.style.height = `calc(${100 - visualRatio}% - 3px)`;
      }
      if (dragActive && Math.abs(targetRatio - visualRatio) >= 0.04) {
        animationFrame = window.requestAnimationFrame(paintTargetedSplit);
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextRatio = axis === "x"
        ? ((moveEvent.clientX - rect.left) / Math.max(rect.width, 1)) * 100
        : ((moveEvent.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
      targetRatio = Math.min(maximumRatio, Math.max(minimumRatio, nextRatio));
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(paintTargetedSplit);
    };

    const finishResize = () => {
      dragActive = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      if (divider.hasPointerCapture(pointerId)) divider.releasePointerCapture(pointerId);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      visualRatio = targetRatio;
      paintTargetedSplit();
      setWorkspaceTree((current) => updateWorkspaceSplitRatio(current, splitId, visualRatio));
      setWorkspaceLayout("custom");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  };

  const persistWorkspacePresets = (nextPresets: WorkspacePreset[]) => {
    const normalizedPresets = normalizeWorkspacePresets(nextPresets);
    setWorkspacePresets(normalizedPresets);
    window.localStorage.setItem(WORKSPACE_PRESETS_STORAGE_KEY, JSON.stringify(normalizedPresets));
    return normalizedPresets;
  };

  const createCurrentWorkspaceSnapshot = (
    name: string,
    id = crypto.randomUUID(),
  ): WorkspacePreset => ({
    id,
    name,
    layout: workspaceTree,
    panes: workspacePanes,
    chartSettings,
    indicators: clonePaneIndicatorState(paneIndicators),
    levelVisibility: clonePaneLevelVisibility(paneLevelVisibility),
    floatingWindows: workspaceFloatingWindows,
    updatedAt: new Date().toISOString(),
  });

  const saveCurrentWorkspacePreset = () => {
    const name = workspacePresetName.trim();
    if (!name) return;
    const duplicate = workspacePresets.find(
      (preset) => preset.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      showReportToast("error", "That workspace name already exists. Use Quick Save to update it.", 3200);
      return;
    }
    const nextPreset = createCurrentWorkspaceSnapshot(name);
    persistWorkspacePresets([...workspacePresets, nextPreset]);
    setActiveWorkspacePresetId(nextPreset.id);
    setWorkspacePresetName("");
    setShowSaveWorkspacePreset(false);
    setShowWorkspacePresetMenu(false);
    showReportToast("success", `Workspace "${name}" saved`, 2200);
  };

  const quickSaveWorkspacePreset = () => {
    const activePreset = workspacePresets.find(
      (preset) => preset.id === activeWorkspacePresetId,
    );
    if (!activePreset) {
      setShowSaveWorkspacePreset(true);
      showReportToast("error", "Choose Save As first to name this workspace", 2600);
      return;
    }
    const nextPreset = createCurrentWorkspaceSnapshot(activePreset.name, activePreset.id);
    persistWorkspacePresets(
      workspacePresets.map((preset) => preset.id === nextPreset.id ? nextPreset : preset),
    );
    showReportToast("success", `Workspace "${activePreset.name}" updated`, 2000);
  };

  const applyWorkspacePreset = (preset: WorkspacePreset) => {
    const panes = preset.panes.length ? preset.panes : DEFAULT_WORKSPACE_PANES;
    const normalizedTree = normalizeWorkspaceLayoutNode(
      preset.layout,
      new Set(panes.map((pane) => pane.id)),
    ) ?? createWorkspaceLayoutTree("single", panes);
    setWorkspacePanes(panes);
    setWorkspaceTree(normalizedTree);
    setWorkspaceFloatingWindows(normalizeWorkspaceFloatingWindows(
      preset.floatingWindows,
      new Set(panes.map((pane) => pane.id)),
    ));
    setWorkspaceLayout("custom");
    if (preset.chartSettings) {
      setChartSettings(preset.chartSettings);
      setDraftChartSettings(preset.chartSettings);
      setChartSettingsSnapshot(preset.chartSettings);
      saveStoredChartSettings(preset.chartSettings);
    }
    if (preset.indicators) {
      setPaneIndicators(clonePaneIndicatorState(preset.indicators));
    }
    setPaneLevelVisibility(clonePaneLevelVisibility(preset.levelVisibility ?? {}));
    const firstPaneId = collectWorkspacePaneIds(normalizedTree)[0];
    if (firstPaneId) setActivePaneId(firstPaneId);
    setActiveWorkspacePresetId(preset.id);
    setShowWorkspacePresetMenu(false);
  };

  const deleteWorkspacePreset = (presetId: string) => {
    const preset = workspacePresets.find((candidate) => candidate.id === presetId);
    persistWorkspacePresets(workspacePresets.filter((candidate) => candidate.id !== presetId));
    if (activeWorkspacePresetId === presetId) setActiveWorkspacePresetId(null);
    setWorkspaceDeleteCandidate(null);
    showReportToast("success", `Workspace "${preset?.name ?? "preset"}" deleted`, 1800);
  };

  const downloadWorkspaceBackup = (
    presets: WorkspacePreset[],
    fileName: string,
    successMessage: string,
  ) => {
    const backup: WorkspaceBackupFile = {
      format: WORKSPACE_BACKUP_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      presets,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showReportToast("success", successMessage, 2000);
  };

  const exportCurrentWorkspace = () => {
    const activePreset = workspacePresets.find((preset) => preset.id === activeWorkspacePresetId);
    const snapshot = createCurrentWorkspaceSnapshot(
      activePreset?.name ?? "Shared workspace",
      activePreset?.id,
    );
    const safeName = snapshot.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
      || "workspace";
    downloadWorkspaceBackup([snapshot], `kwantdesk-${safeName}.json`, `Workspace "${snapshot.name}" exported`);
  };

  const exportAllWorkspaceBackups = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadWorkspaceBackup(
      workspacePresets,
      `kwantdesk-workspaces-${date}.json`,
      `${workspacePresets.length} workspace${workspacePresets.length === 1 ? "" : "s"} exported`,
    );
  };

  const exportSavedWorkspace = (preset: WorkspacePreset) => {
    const safeName = preset.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
      || "workspace";
    downloadWorkspaceBackup([preset], `kwantdesk-${safeName}.json`, `Workspace "${preset.name}" exported`);
  };

  const importWorkspaceBackup = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_WORKSPACE_BACKUP_BYTES) {
      showReportToast("error", "Workspace backup is larger than 2 MB", 3000);
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as Partial<WorkspaceBackupFile>;
      if (
        parsed.format !== WORKSPACE_BACKUP_FORMAT
        || parsed.version !== 1
        || !Array.isArray(parsed.presets)
      ) {
        throw new Error("This is not a valid Kwant Desk workspace backup.");
      }
      const importedPresets = normalizeWorkspacePresets(parsed.presets);
      if (importedPresets.length !== parsed.presets.length) {
        throw new Error("The backup contains an invalid workspace.");
      }
      const merged = new Map(workspacePresets.map((preset) => [preset.id, preset]));
      importedPresets.forEach((preset) => merged.set(preset.id, preset));
      persistWorkspacePresets([...merged.values()]);
      const importedWorkspace = importedPresets[0];
      if (importedWorkspace) applyWorkspacePreset(importedWorkspace);
      showReportToast(
        "success",
        importedPresets.length === 1
          ? `Workspace "${importedWorkspace.name}" loaded`
          : `${importedPresets.length} workspaces restored`,
        2600,
      );
    } catch (error) {
      showReportToast(
        "error",
        error instanceof Error ? error.message : "Workspace backup could not be imported.",
        3600,
      );
    } finally {
      if (workspaceImportInputRef.current) workspaceImportInputRef.current.value = "";
    }
  };

  const commitWorkspacePaneDrop = (
    movingPaneId: string,
    targetPaneId: string,
    zone: WorkspaceDropZone,
  ) => {
    if (workspaceLocked || movingPaneId === targetPaneId) return;
    setWorkspaceTree((current) => {
      if (zone === "center") return swapWorkspacePaneIds(current, movingPaneId, targetPaneId);
      const withoutMovingPane = removeWorkspacePane(current, movingPaneId);
      if (!withoutMovingPane) return current;
      return insertWorkspacePaneAtEdge(
        withoutMovingPane,
        targetPaneId,
        movingPaneId,
        zone,
        `split-${crypto.randomUUID()}`,
      );
    });
    setWorkspaceLayout("custom");
    setActivePaneId(movingPaneId);
  };

  const beginWorkspacePaneDrag = (
    paneId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (workspaceLocked || visibleWorkspacePaneIds.length <= 1 || event.button !== 0) return;
    const source = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;
    let targetPaneId: string | null = null;
    let targetZone: WorkspaceDropZone = "center";
    let previewFrame: number | null = null;
    let previewX = startX;
    let previewY = startY;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    workspaceHeaderDragConsumedRef.current = false;

    const paintPreview = () => {
      previewFrame = null;
      if (!workspaceDragGhostRef.current) return;
      workspaceDragGhostRef.current.style.transform = `translate3d(${previewX + 14}px, ${previewY + 14}px, 0)`;
    };

    const updateDropTarget = (clientX: number, clientY: number) => {
      const pointedElement = document.elementFromPoint(clientX, clientY);
      const paneElement = pointedElement?.closest<HTMLElement>("[data-workspace-pane-id]");
      const nextPaneId = paneElement?.dataset.workspacePaneId ?? null;
      if (!paneElement || !nextPaneId || nextPaneId === paneId) {
        if (targetPaneId !== null) {
          targetPaneId = null;
          targetZone = "center";
          setWorkspaceDropTargetPaneId(null);
          setWorkspaceDropZone("center");
        }
        return;
      }
      const nextZone = workspaceDropZoneAtPoint(paneElement, clientX, clientY);
      if (nextPaneId !== targetPaneId) {
        targetPaneId = nextPaneId;
        setWorkspaceDropTargetPaneId(nextPaneId);
      }
      if (nextZone !== targetZone) {
        targetZone = nextZone;
        setWorkspaceDropZone(nextZone);
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!dragStarted) {
        const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (distance < 6) return;
        dragStarted = true;
        workspaceHeaderDragConsumedRef.current = true;
        source.setPointerCapture(pointerId);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        setDraggedWorkspacePaneId(paneId);
        setWorkspaceDropTargetPaneId(null);
        setWorkspaceDropZone("center");
        setActivePaneId(paneId);
      }
      moveEvent.preventDefault();
      previewX = moveEvent.clientX;
      previewY = moveEvent.clientY;
      if (previewFrame === null) previewFrame = window.requestAnimationFrame(paintPreview);
      updateDropTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const finishPointerDrag = (commit: boolean) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (previewFrame !== null) window.cancelAnimationFrame(previewFrame);
      if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (dragStarted && commit && targetPaneId) {
        commitWorkspacePaneDrop(paneId, targetPaneId, targetZone);
      }
      if (dragStarted) {
        setDraggedWorkspacePaneId(null);
        setWorkspaceDropTargetPaneId(null);
        setWorkspaceDropZone("center");
        window.setTimeout(() => {
          workspaceHeaderDragConsumedRef.current = false;
        }, 0);
      }
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === pointerId) finishPointerDrag(true);
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) finishPointerDrag(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  };

  const positionWorkspacePresetMenu = useCallback(() => {
    const trigger = workspacePresetButtonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 340;
    setWorkspacePresetMenuPosition({
      top: Math.min(window.innerHeight - 24, rect.bottom + 8),
      left: Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2)),
    });
  }, []);

  useEffect(() => {
    if (!showWorkspacePresetMenu) return;
    positionWorkspacePresetMenu();
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        workspacePresetButtonRef.current?.contains(target)
        || workspacePresetMenuRef.current?.contains(target)
      ) return;
      setShowWorkspacePresetMenu(false);
      setShowSaveWorkspacePreset(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowWorkspacePresetMenu(false);
      setShowSaveWorkspacePreset(false);
    };
    window.addEventListener("resize", positionWorkspacePresetMenu);
    window.addEventListener("scroll", positionWorkspacePresetMenu, true);
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", positionWorkspacePresetMenu);
      window.removeEventListener("scroll", positionWorkspacePresetMenu, true);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [positionWorkspacePresetMenu, showWorkspacePresetMenu]);

  const startRightPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rawWidth = window.innerWidth - moveEvent.clientX - 44;
      const viewportMaximum = Math.max(RIGHT_PANEL_MIN_WIDTH, window.innerWidth - 96);
      const nextWidth = Math.min(RIGHT_PANEL_MAX_WIDTH, viewportMaximum, Math.max(RIGHT_PANEL_MIN_WIDTH, rawWidth));
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

  const toggleRightPanel = (panel: RightPanel) => {
    if (panel === "gex") {
      setRightPanelWidth((current) => Math.max(360, current));
    }
    if (panel === "messages") setFriendsInitialFriendId("");
    setRightPanel((current) => current === panel ? null : panel);
  };

  const reopenRightPanel = () => {
    if (lastOpenRightPanel === "gex") {
      setRightPanelWidth((current) => Math.max(360, current));
    }
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
    if (paperAccount?.id) setSelectedPaperAccountId(paperAccount.id);
    setConnectedBroker(brokerName);
    window.localStorage.setItem("olisa-connected-broker", brokerName);
    window.sessionStorage.setItem("olisa-broker-session", JSON.stringify(nextConnection));
    setSelectedBroker(null);
    setShowBrokerModal(false);
  };

  const selectPaperTradingAccount = (accountId: string) => {
    const nextAccount = paperTradingAccounts.find((account) => account.id === accountId);
    if (!nextAccount) return;
    setSelectedPaperAccountId(nextAccount.id);
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

  const openLevelsExport = () => {
    const activeInstrument = displayCmeSymbol(activeWorkspacePane.symbol);
    const fallbackInstrument = availableLevelExportInstruments[0]?.instrument;
    setSelectedLevelExportInstruments(
      availableLevelExportInstruments.some((option) => option.instrument === activeInstrument)
        ? [activeInstrument]
        : fallbackInstrument
          ? [fallbackInstrument]
          : [],
    );
    setLevelExportTypes({
      gamma: true,
      gameplan: true,
      valueArea: false,
      historicalStructure: false,
    });
    setLevelExportError("");
    setShowLevelsExport(true);
  };

  const toggleLevelExportInstrument = (instrument: string) => {
    setSelectedLevelExportInstruments((current) =>
      current.includes(instrument)
        ? current.filter((candidate) => candidate !== instrument)
        : [...current, instrument]);
    setLevelExportError("");
  };

  const exportSelectedLevels = () => {
    const selectedOptions = availableLevelExportInstruments.filter((option) =>
      selectedLevelExportInstruments.includes(option.instrument));
    const exportOption = PLATFORM_LEVEL_EXPORT_OPTIONS.find((option) => option.id === levelExportFormat)
      ?? PLATFORM_LEVEL_EXPORT_OPTIONS[0];
    const rows: LevelExportRow[] = [];
    const gameplanColors = {
      magnet: chartSettings.upColor,
      wall: chartSettings.downColor,
      accelerant: mixChartColor(chartSettings.upColor, "#F59E0B", 0.62),
      decision: mixChartColor(chartSettings.upColor, "#38BDF8", 0.62),
    } satisfies Record<GameplanChartOverlay["levels"][number]["role"], string>;

    for (const option of selectedOptions) {
      if (levelExportTypes.gamma && option.gamma) {
        for (const level of option.gamma.levels) {
          rows.push({
            levelType: "Gamma Levels",
            instrument: option.instrument,
            sourceSymbol: option.sourceSymbol,
            contractSymbol: option.contractSymbol,
            id: level.id,
            name: level.label,
            role: "gamma",
            price: level.price,
            zoneLow: level.price,
            zoneHigh: level.price,
            strength: null,
            color: level.color,
            lineStyle: level.lineStyle ?? "solid",
            lineWidth: level.lineWidth ?? 2,
            source: option.gamma.sourceLabel,
            asOf: option.gamma.checkedAt ?? "",
          });
        }
      }

      if (levelExportTypes.gameplan && option.gameplan) {
        for (const level of option.gameplan.levels) {
          rows.push({
            levelType: "Kwant Levels",
            instrument: option.instrument,
            sourceSymbol: option.sourceSymbol,
            contractSymbol: option.contractSymbol,
            id: level.id,
            name: level.name,
            role: level.role,
            price: (level.zone[0] + level.zone[1]) / 2,
            zoneLow: level.zone[0],
            zoneHigh: level.zone[1],
            strength: level.strength,
            color: gameplanColors[level.role],
            lineStyle: level.role === "decision" ? "solid" : level.role === "accelerant" ? "dotted" : "dashed",
            lineWidth: level.strength >= 4 || level.role === "decision" ? 3 : 2,
            source: `Kwant Desk Gameplan · ${option.gameplan.session} · ${option.gameplan.editionDate}`,
            asOf: option.gameplan.publishedAt,
          });
        }
      }

      if (levelExportTypes.valueArea && option.valueArea) {
        for (const level of option.valueArea.levels) {
          rows.push({
            levelType: "Value Area Levels",
            instrument: option.instrument,
            sourceSymbol: option.sourceSymbol,
            contractSymbol: option.contractSymbol,
            id: level.id,
            name: level.label,
            role: level.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            price: level.price,
            zoneLow: level.price,
            zoneHigh: level.price,
            strength: null,
            color: level.color,
            lineStyle: level.lineStyle ?? "solid",
            lineWidth: level.lineWidth ?? 2,
            source: option.valueArea.sourceLabel,
            asOf: option.valueArea.checkedAt,
          });
        }
      }

      if (levelExportTypes.historicalStructure && option.structure) {
        for (const zone of option.structure.zones) {
          const centre = (zone.low + zone.high) / 2;
          const level = option.structure.levels.find((candidate) =>
            candidate.id === `${zone.id}-centre`
            || Math.abs(candidate.price - centre) <= futuresTickSize(option.sourceSymbol) / 2,
          );
          rows.push({
            levelType: "Historical Supply/Demand + S/R",
            instrument: option.instrument,
            sourceSymbol: option.sourceSymbol,
            contractSymbol: option.contractSymbol,
            id: zone.id,
            name: zone.label,
            role: zone.role.toLowerCase(),
            price: centre,
            zoneLow: zone.low,
            zoneHigh: zone.high,
            strength: zone.confidence,
            color: zone.color,
            lineStyle: level?.lineStyle ?? "dashed",
            lineWidth: level?.lineWidth ?? 2,
            source: option.structure.sourceLabel,
            asOf: option.structure.checkedAt,
          });
        }
      }
    }

    if (!selectedOptions.length) {
      setLevelExportError("Select at least one instrument.");
      return;
    }
    if (!levelExportTypes.gamma && !levelExportTypes.gameplan && !levelExportTypes.valueArea && !levelExportTypes.historicalStructure) {
      setLevelExportError("Select Gamma Levels, Kwant Levels, Value Area Levels, or Historical Supply/Demand + S/R.");
      return;
    }
    if (levelExportTypes.valueArea) {
      const missingValueArea = selectedOptions
        .filter((option) => !(option.valueArea?.levels.length))
        .map((option) => option.instrument);
      if (missingValueArea.length) {
        setLevelExportError(`Value Area levels are still preparing for ${missingValueArea.join(", ")}.`);
        return;
      }
    }
    if (levelExportTypes.historicalStructure) {
      const missingStructure = selectedOptions
        .filter((option) => !(option.structure?.zones.length))
        .map((option) => option.instrument);
      if (missingStructure.length) {
        setLevelExportError(`Historical Supply/Demand + S/R zones are still preparing for ${missingStructure.join(", ")}.`);
        return;
      }
    }
    if (exportOption.oneInstrument && selectedOptions.length !== 1) {
      setLevelExportError(`${exportOption.label} requires exactly one instrument so levels cannot be placed on the wrong chart.`);
      return;
    }
    if (!rows.length) {
      setLevelExportError("The selected levels are still preparing or have not been added for this instrument.");
      return;
    }

    const exportedAt = new Date().toISOString();
    const filenameInstruments = selectedOptions
      .map((option) => option.instrument)
      .join("-")
      .replace(/[^a-z0-9-]+/gi, "-")
      .toLowerCase();
    const baseFilename = `kwantdesk-levels-${filenameInstruments || "export"}-${exportedAt.slice(0, 10)}`;

    if (levelExportFormat === "json") {
      downloadLevelFile(
        JSON.stringify({
          format: "kwantdesk-chart-levels",
          version: 1,
          exportedAt,
          instruments: selectedOptions.map((option) => ({
            instrument: option.instrument,
            sourceSymbol: option.sourceSymbol,
            contractSymbol: option.contractSymbol,
          })),
          levelTypes: (Object.entries(levelExportTypes) as Array<[LevelExportType, boolean]>)
            .filter(([, enabled]) => enabled)
            .map(([type]) => type),
          levels: rows,
        }, null, 2),
        `${baseFilename}.json`,
        "application/json;charset=utf-8",
      );
    } else if (levelExportFormat === "csv") {
      const columns: Array<keyof LevelExportRow> = [
        "levelType",
        "instrument",
        "sourceSymbol",
        "contractSymbol",
        "id",
        "name",
        "role",
        "price",
        "zoneLow",
        "zoneHigh",
        "strength",
        "color",
        "lineStyle",
        "lineWidth",
        "source",
        "asOf",
      ];
      const csv = [
        columns.map((column) => csvCell(column)).join(","),
        ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
      ].join("\r\n");
      downloadLevelFile(csv, `${baseFilename}.csv`, "text/csv;charset=utf-8");
    } else if (levelExportFormat === "deepcharts") {
      downloadLevelFile(
        serializeDeepChartsXml(rows, new Date(exportedAt)),
        `${baseFilename}.xml`,
        "application/json;charset=utf-8",
      );
    } else {
      const source = serializePlatformLevels(levelExportFormat, rows);
      downloadLevelFile(
        source,
        `${baseFilename}-${levelExportFormat}.${exportOption.extension}`,
        exportOption.mimeType,
      );
    }

    setLevelExportError("");
    setShowLevelsExport(false);
  };

  const clearBacktest = () => {
    setChartTrades([]);
    setBacktestResult(null);
  };

  const selectInstrument = (symbol: string, broker?: string, watchlistKey?: string) => {
    if (bottomWorkspaceSection === "liqmap") {
      const nextLiquidityInstrument = liquidityMapInstrument(symbol);
      if (!nextLiquidityInstrument) return;
      setSelectedLiquidityMapInstrument(nextLiquidityInstrument);
      window.localStorage.setItem(LIQUIDITY_MAP_INSTRUMENT_STORAGE_KEY, nextLiquidityInstrument);
      if (watchlistKey) setSelectedWatchlistKey(watchlistKey);
      return;
    }
    clearBacktest();
    const nextBroker = broker ?? connectedBroker ?? "OANDA";
    const nextTimeframe = nextBroker === "Market Index" && !supportsChartInterval(selectedTimeframe, nextBroker)
      ? "1D"
      : selectedTimeframe;
    if (nextBroker === "Databento") {
      void warmDatabentoChartHistory(symbol, "1m");
      if (selectedTimeframe !== "1m") {
        void warmDatabentoChartHistory(symbol, selectedTimeframe);
      }
    }
    updateWorkspacePane(activePaneId, {
      symbol,
      broker: nextBroker,
      timeframe: nextTimeframe,
      watchlistKey: watchlistKey ?? makeWatchlistKey(symbol, nextBroker),
    });
    setSelectedInstrument(symbol);
    if (nextTimeframe !== selectedTimeframe) setSelectedTimeframe(nextTimeframe);
    if (watchlistKey) setSelectedWatchlistKey(watchlistKey);
    if (broker && broker !== connectedBroker) {
      setConnectedBroker(broker);
      window.localStorage.setItem("olisa-connected-broker", broker);
      window.sessionStorage.setItem("olisa-broker-session", JSON.stringify({ broker, mode: brokerMode, connectedAt: new Date().toISOString() }));
    }
  };

  const selectTimeframe = (timeframe: string) => {
    clearBacktest();
    if (activeWorkspacePane.broker === "Databento") {
      void warmDatabentoChartHistory(activeWorkspacePane.symbol, timeframe);
    }
    updateWorkspacePane(activePaneId, { timeframe });
    setSelectedTimeframe(timeframe);
  };

  const selectWorkspacePaneTimeframe = (paneId: string, timeframe: string) => {
    const pane = workspacePanes.find((candidate) => candidate.id === paneId);
    if (!pane || !supportsChartInterval(timeframe, pane.broker)) return false;
    clearBacktest();
    if (pane.broker === "Databento") {
      void warmDatabentoChartHistory(pane.symbol, timeframe);
    }
    updateWorkspacePane(paneId, { timeframe });
    if (paneId === activePaneId) setSelectedTimeframe(timeframe);
    return true;
  };

  const applyCustomInterval = (kind: ChartIntervalKind) => {
    const draft = intervalDrafts[kind];
    const interval = makeCustomChartInterval(kind, draft.primary, draft.secondary);
    if (!supportsChartInterval(interval, activeChartBrokerLabel)) return;
    selectTimeframe(interval);
    setShowAllTF(false);
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
    setSelectedPaperAccountId(nextAccount.id);
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
    setPaperAccountInstrument("All CME Futures");
    setPaperAccountLeverage("1:30");
    setPaperAccountStrategy("Manual / No Strategy");
    setShowQuickPaperAccountForm(false);
  };

  const openPaperAccountLinker = () => {
    const paperBroker = brokerByName["Paper Trading"];
    if (!paperBroker) return;
    setShowTradesMenu(false);
    setTradesMenuView("root");
    setSelectedBroker(paperBroker);
    setBrokerMode("Demo");
    setShowQuickPaperAccountForm(paperTradingAccounts.length === 0);
    setShowBrokerModal(true);
  };

  const openPaperOrderTicket = () => {
    const account = selectedPaperTradingAccount ?? paperTradingAccounts[0] ?? null;
    if (!account) {
      openPaperAccountLinker();
      return;
    }
    selectPaperTradingAccount(account.id);
    setConnectedBroker("Paper Trading");
    window.localStorage.setItem("olisa-connected-broker", "Paper Trading");
    setBrokerMode("Demo");
    setShowTradesMenu(false);
    setTradesMenuView("root");
    setRightPanel("order");
  };

  const showPaperOrderMessage = (tone: "success" | "error", text: string) => {
    setOrderTicketMessage({ tone, text });
    window.setTimeout(() => {
      setOrderTicketMessage((current) => current?.text === text ? null : current);
    }, 3_200);
  };

  const resolvePaperProtectionPrice = (
    kind: "tp" | "sl",
    rawValue: string,
    entryPrice: number,
    quantity: number,
  ) => {
    const value = Number(rawValue);
    if (!(value > 0)) return null;
    const direction = orderSide === "buy" ? 1 : -1;
    const favorableDirection = kind === "tp" ? direction : -direction;
    const type = kind === "tp" ? tpType : slType;
    if (type === "price") return snapPaperPrice(selectedInstrument, value);
    if (type === "ticks") {
      return snapPaperPrice(selectedInstrument, entryPrice + favorableDirection * value * paperTickSize(selectedInstrument));
    }
    if (type === "pctPrice") {
      return snapPaperPrice(selectedInstrument, entryPrice * (1 + favorableDirection * value / 100));
    }
    const accountRiskBase = selectedPaperSummary?.equity ?? 0;
    const cashAmount = type === "rewardPct" || type === "riskPct"
      ? accountRiskBase * value / 100
      : value;
    const priceDistance = cashAmount / Math.max(paperPointValue(selectedInstrument) * quantity, Number.EPSILON);
    return snapPaperPrice(selectedInstrument, entryPrice + favorableDirection * priceDistance);
  };

  const orderPreviewEntryPrice = orderType === "market"
    ? orderSide === "buy" ? currentLivePrice.ask : currentLivePrice.bid
    : Number(orderPrice || selectedMidPrice);
  const orderPreviewTakeProfitPrice = tpEnabled && orderPreviewEntryPrice > 0
    ? resolvePaperProtectionPrice("tp", orderTP, orderPreviewEntryPrice, selectedOrderQuantity)
    : null;
  const orderPreviewStopLossPrice = slEnabled && orderPreviewEntryPrice > 0
    ? resolvePaperProtectionPrice("sl", orderSL, orderPreviewEntryPrice, selectedOrderQuantity)
    : null;
  const orderPreviewRewardUsd = orderPreviewTakeProfitPrice && orderPreviewEntryPrice > 0
    ? Math.abs(orderPreviewTakeProfitPrice - orderPreviewEntryPrice) * paperPointValue(selectedInstrument) * selectedOrderQuantity
    : 0;
  const orderPreviewRiskUsd = orderPreviewStopLossPrice && orderPreviewEntryPrice > 0
    ? Math.abs(orderPreviewStopLossPrice - orderPreviewEntryPrice) * paperPointValue(selectedInstrument) * selectedOrderQuantity
    : 0;
  const orderPreviewRiskReward = orderPreviewRiskUsd > 0 && orderPreviewRewardUsd > 0
    ? orderPreviewRewardUsd / orderPreviewRiskUsd
    : 0;
  const orderPreviewTakeProfitTicks = orderPreviewTakeProfitPrice && orderPreviewEntryPrice > 0
    ? Math.round(Math.abs(orderPreviewTakeProfitPrice - orderPreviewEntryPrice) / selectedPaperContract.tickSize)
    : 0;
  const orderPreviewStopLossTicks = orderPreviewStopLossPrice && orderPreviewEntryPrice > 0
    ? Math.round(Math.abs(orderPreviewStopLossPrice - orderPreviewEntryPrice) / selectedPaperContract.tickSize)
    : 0;
  const orderTakeProfitPreviewLabel = orderPreviewTakeProfitPrice
    ? `${formatPrice(orderPreviewTakeProfitPrice, selectedInstrument)} · +${formatDollar(orderPreviewRewardUsd)}`
    : "--";
  const orderStopLossPreviewLabel = orderPreviewStopLossPrice
    ? `${formatPrice(orderPreviewStopLossPrice, selectedInstrument)} · -${formatDollar(orderPreviewRiskUsd)}`
    : "--";

  const submitPaperOrder = () => {
    if (!selectedPaperTradingAccount) {
      showPaperOrderMessage("error", "Create or select a demo account first.");
      return;
    }
    const quote = { bid: currentLivePrice.bid, ask: currentLivePrice.ask, timestamp: Date.now() };
    const entryPrice = orderType === "market"
      ? orderSide === "buy" ? quote.ask : quote.bid
      : Number(orderPrice || selectedMidPrice);
    if (!(entryPrice > 0)) {
      showPaperOrderMessage("error", "A live price is required before placing this order.");
      return;
    }
    const takeProfitPrice = tpEnabled
      ? resolvePaperProtectionPrice("tp", orderTP, entryPrice, selectedOrderQuantity)
      : null;
    const stopLossPrice = slEnabled
      ? resolvePaperProtectionPrice("sl", orderSL, entryPrice, selectedOrderQuantity)
      : null;
    const result = placePaperOrder(
      paperLedger,
      paperTradingAccounts,
      {
        accountId: selectedPaperTradingAccount.id,
        symbol: selectedInstrument,
        side: orderSide,
        type: orderType,
        quantity: selectedOrderQuantity,
        price: orderType === "market" ? null : entryPrice,
        stopLoss: stopLossPrice,
        takeProfits: takeProfitPrice ? [{ price: takeProfitPrice, quantity: selectedOrderQuantity }] : [],
      },
      quote,
    );
    setPaperLedger(result.ledger);
    if (result.error) {
      showPaperOrderMessage("error", result.error);
      return;
    }
    showPaperOrderMessage(
      "success",
      `${orderSide === "buy" ? "Buy" : "Sell"} ${selectedOrderQuantity} ${displayCmeSymbol(selectedInstrument)} ${orderType === "market" ? "filled" : "working"}.`,
    );
  };

  const handlePaperProtectionUpdate = (
    accountId: string,
    positionId: string,
    update:
      | { kind: "stop_loss"; price: number | null }
      | { kind: "take_profit"; targetId: string; price: number; quantity?: number },
  ) => {
    const result = updatePaperProtection(paperLedger, accountId, positionId, update);
    setPaperLedger(result.ledger);
    if (result.error) showPaperOrderMessage("error", result.error);
  };

  const resolvePaperExecutionQuote = (symbol: string) => {
    const normalized = normalizePaperSymbol(symbol);
    if (normalized === normalizePaperSymbol(selectedInstrument) && currentLivePrice.bid > 0 && currentLivePrice.ask > 0) {
      return { bid: currentLivePrice.bid, ask: currentLivePrice.ask, timestamp: Date.now() };
    }
    const watchQuote = watchlist.find((item) =>
      normalizePaperSymbol(item.symbol) === normalized && item.bid > 0 && item.ask > 0);
    return watchQuote
      ? { bid: watchQuote.bid, ask: watchQuote.ask, timestamp: Date.now() }
      : null;
  };

  const handleFlattenPaperPosition = (position: PaperPosition) => {
    const quote = resolvePaperExecutionQuote(position.symbol);
    if (!quote) {
      showPaperOrderMessage("error", `${position.symbol} live bid/ask is unavailable.`);
      return;
    }
    const result = closePaperPosition(paperLedger, position.accountId, position.id, quote);
    setPaperLedger(result.ledger);
    showPaperOrderMessage(result.error ? "error" : "success", result.error ?? `${position.symbol} position flattened.`);
  };

  const handleFlattenPaperAccount = () => {
    if (!selectedPaperTradingAccount) return;
    const result = flattenPaperAccount(
      paperLedger,
      selectedPaperTradingAccount.id,
      resolvePaperExecutionQuote,
    );
    setPaperLedger(result.ledger);
    if (result.errors.length > 0) {
      showPaperOrderMessage(
        "error",
        `${result.closed} position${result.closed === 1 ? "" : "s"} closed; ${result.errors.join(" · ")}`,
      );
      return;
    }
    showPaperOrderMessage(
      "success",
      `Account flattened · ${result.closed} position${result.closed === 1 ? "" : "s"} closed · ${result.cancelled} order${result.cancelled === 1 ? "" : "s"} cancelled.`,
    );
  };

  const handleCancelPaperOrder = (accountId: string, orderId: string) => {
    setPaperLedger(cancelPaperOrder(paperLedger, accountId, orderId));
    showPaperOrderMessage("success", "Working order cancelled.");
  };

  const handleChartPeriod = (paneId: string, period: string) => {
    clearBacktest();
    updateWorkspacePane(paneId, { period });
    if (paneId === activePaneId) {
      setSelectedPeriod(period);
    }
  };

  const selectWorkspacePanelContent = async (paneId: string, content: WorkspacePanelKind) => {
    setWorkspacePanelTransition({ paneId, content });
    setActivePaneId(paneId);
    await preloadWorkspaceModule(content).catch(() => null);
    updateWorkspacePane(paneId, { content });
    if (content !== "charts") {
      setWorkspacePanelPickerPaneId(null);
      setWorkspacePanelTransition(null);
    }
  };

  const cancelWorkspacePanelPicker = (pane: WorkspacePane) => {
    if (workspacePanelTransition?.paneId === pane.id) return;
    setWorkspacePanelPickerPaneId(null);
    if (pane.content === null) closeWorkspacePane(pane.id);
  };

  function renderWorkspacePanelPicker(pane: WorkspacePane, overlay = false) {
    return (
      <div className={`${overlay ? "absolute inset-0 z-[100]" : "h-full"} flex min-h-0 items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-xl`}>
        <div className="my-auto w-full max-w-[620px] rounded-2xl border border-border bg-panel/95 p-4 shadow-2xl shadow-black/40 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Plus className="h-4 w-4" />
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.13em]">Add to workspace</h3>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-muted">Choose a live KwantDesk workspace for this panel.</p>
            </div>
            <button
              type="button"
              onClick={() => cancelWorkspacePanelPicker(pane)}
              disabled={workspacePanelTransition?.paneId === pane.id}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface hover:text-foreground disabled:cursor-wait disabled:opacity-40"
              aria-label={pane.content === null ? "Cancel adding workspace panel" : "Close workspace picker"}
              title={pane.content === null ? "Cancel and restore previous workspace" : "Close workspace picker"}
            >
                <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2 min-[760px]:grid-cols-3">
            {WORKSPACE_PANEL_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onPointerEnter={() => void preloadWorkspaceModule(option.id).catch(() => null)}
                  onClick={() => void selectWorkspacePanelContent(pane.id, option.id)}
                  disabled={workspacePanelTransition?.paneId === pane.id}
                  className={`group flex min-h-[72px] items-center gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/[0.07] disabled:pointer-events-none ${pane.content === option.id || workspacePanelTransition?.content === option.id ? "border-primary/40 bg-primary/[0.08]" : "border-border bg-surface/60"}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block truncate text-[8px] text-muted">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderEmbeddedWorkspace(pane: WorkspacePane) {
    switch (pane.content) {
      case "zyon":
        return (
          <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-zyon`} label="Zyon">
            <ZyonPanelBoundary variant="workspace" resetKey={`${preferenceUserId || "anonymous"}:${kwantBotInterpreter.selectedRoot}`}>
              <ZyonWorkspace interpreter={kwantBotInterpreter} viewerName={currentDisplayName || currentUsername} accountKey={preferenceUserId} />
            </ZyonPanelBoundary>
          </WorkspaceFailureBoundary>
        );
      case "gameplan":
        return <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-gameplan`} label="Game Plan"><GameplanWorkspace initialInstrument={displayCmeSymbol(pane.symbol)} /></WorkspaceFailureBoundary>;
      case "gamma":
        return <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-gamma`} label="Gamma"><GammaWorkspace /></WorkspaceFailureBoundary>;
      case "gexmap": {
        const gexMarket = ["ES", "MES"].includes(normalizePaperSymbol(pane.symbol)) ? "ES" : "NQ";
        return <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-gexmap-${gexMarket}`} label="GEX Map"><GexMapWorkspace key={`${pane.id}-${gexMarket}`} market={gexMarket} /></WorkspaceFailureBoundary>;
      }
      case "liqmap":
        return <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-liqmap`} label="Liquidity Map"><LiquidityMapWorkspace instrument={selectedLiquidityMapInstrument} onInstrumentChange={setSelectedLiquidityMapInstrument} onActivate={() => activateWorkspacePane(pane.id)} /></WorkspaceFailureBoundary>;
      case "news":
        return <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-news`} label="News"><NewsWorkspace /></WorkspaceFailureBoundary>;
      case "socials":
        return (
          <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-socials`} label="Socials">
            <SocialsWorkspace
              accountKey={preferenceUserId || currentUsername || "local"}
              accountLabel={currentUsername || "Kwant Trader"}
              initialProfileHandle={socialProfileHandle}
              onOpenProfile={(handle) => router.push(`/socials/${encodeURIComponent(handle)}`)}
              onMessageProfile={(userId) => { setFriendsInitialFriendId(userId); setRightPanel("messages"); }}
              onOpenGameplanScoring={() => router.push("/gameplan?tab=scoring")}
            />
          </WorkspaceFailureBoundary>
        );
      case "journal":
        return <WorkspaceFailureBoundary resetKey={`workspace-${pane.id}-journal`} label="Journal"><JournalWorkspace accountKey={preferenceUserId || currentUsername || "local"} /></WorkspaceFailureBoundary>;
      default:
        return null;
    }
  }

  function renderWorkspacePane(paneId: string, floating = false) {
    const pane = workspacePanes.find((candidate) => candidate.id === paneId)
      ?? activeWorkspacePane;
    if (pane.content === null) return renderWorkspacePanelPicker(pane);
    if (pane.content !== "charts") {
      const option = WORKSPACE_PANEL_OPTIONS.find((candidate) => candidate.id === pane.content);
      const Icon = option?.icon ?? Layers3;
      return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel">
          <div className="kwant-workspace-pane-header flex shrink-0 items-center justify-between border-b border-border bg-panel/95 px-2.5">
            <button
              type="button"
              onPointerDown={(event) => beginWorkspacePaneDrag(pane.id, event)}
              onClick={() => {
                if (workspaceHeaderDragConsumedRef.current) {
                  workspaceHeaderDragConsumedRef.current = false;
                  return;
                }
                setWorkspacePanelPickerPaneId(pane.id);
              }}
              className={`flex h-7 min-w-0 flex-1 items-center justify-start gap-2 rounded-lg px-2 text-[9px] font-semibold text-foreground hover:bg-surface ${workspaceLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
              title={workspaceLocked ? "Workspace locked" : "Drag to dock this panel, or click to change it"}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{option?.label ?? "Workspace"}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted" />
            </button>
            {!floating ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setWorkspaceLocked((current) => !current)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${workspaceLocked ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-primary"}`}
                  title={workspaceLocked ? "Unlock workspace layout" : "Lock workspace layout"}
                  aria-label={workspaceLocked ? "Unlock workspace layout" : "Lock workspace layout"}
                >
                  {workspaceLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => detachWorkspacePane(pane.id)} disabled={workspaceLocked} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary disabled:opacity-30" title="Detach into a floating window" aria-label={`Detach ${option?.label ?? "workspace"} panel`}>
                  <PictureInPicture2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => closeWorkspacePane(pane.id)} disabled={workspaceLocked || workspacePanes.length <= 1} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger disabled:opacity-30" aria-label={`Close ${option?.label ?? "workspace"} panel`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="relative h-full min-h-0 min-w-0 overflow-hidden">{renderEmbeddedWorkspace(pane)}</div>
          </div>
          {workspacePanelPickerPaneId === pane.id ? renderWorkspacePanelPicker(pane, true) : null}
        </div>
      );
    }
    const gameplanRoot = gameplanChartRootForInstrument(pane.symbol);
    const paneLevelState = paneLevelVisibility[pane.id] ?? EMPTY_PANE_LEVEL_VISIBILITY;
    const chartPane = (
      <WorkspaceChartPane
        pane={pane}
        active={activePaneId === pane.id}
        embedded
        period={pane.period}
        settings={chartSettings}
        trades={activePaneId === pane.id ? chartTrades : []}
        indicators={paneIndicators[pane.id] ?? []}
        paperPositions={selectedPaperAccountLedger?.positions ?? []}
        paperFills={selectedPaperAccountLedger?.fills ?? []}
        onUpdatePaperProtection={handlePaperProtectionUpdate}
        onClosePaperPosition={handleFlattenPaperPosition}
        onActivate={() => activateWorkspacePane(pane.id)}
        onOpenSettings={openChartSettings}
        onCreateAlertAtPrice={openCreateAlert}
        onRemoveAllIndicators={handleRemoveAllIndicatorsFromChart}
        onUpdateIndicatorSetting={(instanceId, key, value) =>
          updatePaneIndicatorSetting(pane.id, instanceId, key, value)}
        onSelectPeriod={(period) => handleChartPeriod(pane.id, period)}
        onSelectTimeframe={(timeframe) => selectWorkspacePaneTimeframe(pane.id, timeframe)}
        chartDragEnabled={!floating && !workspaceLocked && visibleWorkspacePaneIds.length > 1}
        gammaLevelsEnabled={paneLevelState.gamma}
        onToggleGammaLevels={() => togglePaneLevelVisibility(pane.id, "gamma")}
        kwantLevelsEnabled={Boolean(paneLevelState.kwant && gameplanRoot && gameplanChartOverlays[gameplanRoot]?.levels.length)}
        kwantLevelsAvailable={Boolean(gameplanRoot)}
        kwantLevelsLoading={Boolean(gameplanRoot && quickGameplanLoading && quickGameplanLoadingRoot === gameplanRoot)}
        onToggleKwantLevels={() => {
          if (!gameplanRoot) return;
          if (paneLevelState.kwant) {
            setPaneLevelVisible(pane.id, "kwant", false);
            return;
          }
          setPaneLevelVisible(pane.id, "kwant", true);
          if (gameplanChartOverlays[gameplanRoot]?.levels.length) return;
          void refreshKwantLevelsForInstrument(pane.symbol);
        }}
        historicalStructureEnabled={paneLevelState.structure}
        onToggleHistoricalStructure={() => togglePaneLevelVisibility(pane.id, "structure")}
        valueAreaLevelsEnabled={paneLevelState.valueArea}
        onToggleValueAreaLevels={() => togglePaneLevelVisibility(pane.id, "valueArea")}
        levelExportRequested={showLevelsExport}
        onGammaExportSnapshot={handleGammaExportSnapshot}
        gameplanOverlay={gameplanRoot ? gameplanChartOverlays[gameplanRoot] ?? null : null}
        loadingMessage={activePaneId === pane.id ? chartLoadingMessage : ""}
        onInitialSettled={workspacePanelTransition?.paneId === pane.id
          && workspacePanelTransition.content === "charts"
          ? () => {
              setWorkspacePanelTransition(null);
              setWorkspacePanelPickerPaneId((openPaneId) => openPaneId === pane.id ? null : openPaneId);
            }
          : undefined}
        onRemoveGameplanOverlay={() => {
          if (!gameplanRoot) return;
          setPaneLevelVisible(pane.id, "kwant", false);
          setGameplanChartOverlays(removeGameplanChartOverlay(gameplanRoot));
        }}
        onChartDragStart={(event) => beginWorkspacePaneDrag(pane.id, event)}
      />
    );
    if (floating) return chartPane;
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel">
        <div className="kwant-workspace-pane-header flex shrink-0 items-center justify-between border-b border-border bg-panel/95 px-2.5">
          <button
            type="button"
            onPointerDown={(event) => beginWorkspacePaneDrag(pane.id, event)}
            onClick={() => {
              if (workspaceHeaderDragConsumedRef.current) {
                workspaceHeaderDragConsumedRef.current = false;
                return;
              }
              setWorkspacePanelPickerPaneId(pane.id);
            }}
            className={`flex h-7 min-w-0 flex-1 items-center justify-start gap-2 rounded-lg px-2 text-[9px] font-semibold text-foreground hover:bg-surface ${workspaceLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
            title={workspaceLocked ? "Workspace locked" : "Drag to dock this chart, or click to change it"}
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">CHARTS</span>
            <span className="hidden truncate font-mono text-[8px] font-normal text-muted sm:inline">
              {displayCmeSymbol(pane.symbol)} · {formatChartInterval(pane.timeframe)}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWorkspaceLocked((current) => !current)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${workspaceLocked ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-primary"}`}
              title={workspaceLocked ? "Unlock workspace layout" : "Lock workspace layout"}
              aria-label={workspaceLocked ? "Unlock workspace layout" : "Lock workspace layout"}
            >
              {workspaceLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => detachWorkspacePane(pane.id)}
              disabled={workspaceLocked}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary disabled:opacity-30"
              title={workspaceLocked ? "Unlock the workspace to detach this chart" : "Detach into a floating window"}
              aria-label="Detach chart"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => closeWorkspacePane(pane.id)}
              disabled={workspaceLocked || workspacePanes.length <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger disabled:opacity-30"
              title={workspacePanes.length <= 1 ? "A workspace must keep one panel" : "Close chart"}
              aria-label="Close chart"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">{chartPane}</div>
      </div>
    );
  }

  function renderFloatingWorkspaceWindow(
    floating: WorkspaceFloatingWindow,
    stackIndex: number,
  ) {
    const pane = workspacePanes.find((candidate) => candidate.id === floating.paneId);
    if (!pane) return null;
    const option = pane.content
      ? WORKSPACE_PANEL_OPTIONS.find((candidate) => candidate.id === pane.content)
      : null;
    const Icon = option?.icon ?? BarChart3;
    return (
      <div
        key={floating.paneId}
        data-floating-workspace-pane-id={floating.paneId}
        onPointerDown={() => activateFloatingWorkspacePane(floating.paneId)}
        className={`absolute overflow-hidden border bg-panel shadow-[0_18px_70px_rgba(0,0,0,0.68)] ${
          activePaneId === floating.paneId ? "border-primary/70" : "border-border"
        }`}
        style={{
          left: `${floating.x * 100}%`,
          top: `${floating.y * 100}%`,
          width: `${floating.width * 100}%`,
          height: `${floating.height * 100}%`,
          zIndex: 100 + stackIndex,
          contain: "layout paint size",
        }}
      >
        <div
          onPointerDown={(event) => startFloatingWorkspaceMove(floating.paneId, event)}
          className={`kwant-workspace-pane-header flex shrink-0 touch-none items-center border-b border-border bg-background/95 px-2 ${
            floating.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground">
              {option?.label ?? displayCmeSymbol(pane.symbol)}
            </span>
            <span className="hidden truncate font-mono text-[8px] text-muted sm:inline">
              {pane.content === "charts" ? `${displayCmeSymbol(pane.symbol)} · ${formatChartInterval(pane.timeframe)}` : "FLOATING WINDOW"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => toggleFloatingWorkspaceLock(floating.paneId)}
              className={`flex h-6 w-6 items-center justify-center border transition-colors ${
                floating.locked
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-transparent text-muted hover:border-border hover:text-foreground"
              }`}
              title={floating.locked ? "Unlock floating window" : "Lock floating window here"}
              aria-label={floating.locked ? "Unlock floating window" : "Lock floating window"}
            >
              {floating.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => dockWorkspacePane(floating.paneId)}
              disabled={workspaceLocked}
              className="flex h-6 w-6 items-center justify-center border border-transparent text-muted transition-colors hover:border-border hover:text-primary disabled:opacity-30"
              title="Return to workspace grid"
              aria-label="Dock floating window"
            >
              <PictureInPicture2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => closeWorkspacePane(floating.paneId)}
              disabled={workspacePanes.length <= 1}
              className="flex h-6 w-6 items-center justify-center border border-transparent text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-30"
              title="Close floating panel"
              aria-label="Close floating panel"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 min-h-0 overflow-hidden"
          style={{ top: "var(--kwant-shell-bar-height)" }}
        >
          {renderWorkspacePane(floating.paneId, true)}
        </div>
        {!floating.locked ? (
          <div
            onPointerDown={(event) => startFloatingWorkspaceResize(floating.paneId, event)}
            className="absolute bottom-0 right-0 z-[180] flex h-7 w-7 touch-none cursor-nwse-resize items-end justify-end p-1 text-muted/70 hover:text-primary"
            title="Resize floating window"
          >
            <MoveDiagonal2 className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
    );
  }

  function renderWorkspaceNode(node: WorkspaceLayoutNode): React.ReactNode {
    if (node.type === "pane") {
      const nodePane = workspacePanes.find((pane) => pane.id === node.paneId);
      const nodeIsFloating = workspaceFloatingWindows.some((entry) => entry.paneId === node.paneId);
      if (nodeIsFloating) {
        return (
          <div
            key={node.paneId}
            data-workspace-pane-id={node.paneId}
            className="flex h-full min-h-0 min-w-0 items-center justify-center border border-dashed border-border bg-background/35"
          >
            <button
              type="button"
              onClick={() => dockWorkspacePane(node.paneId)}
              disabled={workspaceLocked}
              className="flex items-center gap-2 border border-border bg-panel px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted hover:border-primary/40 hover:text-primary disabled:opacity-30"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
              Window detached
            </button>
          </div>
        );
      }
      return (
        <div
          key={node.paneId}
          data-workspace-pane-id={node.paneId}
          onPointerDownCapture={() => {
            if (activePaneId !== node.paneId) activateWorkspacePane(node.paneId);
          }}
          className={`relative h-full min-h-0 min-w-0 overflow-hidden transition-[box-shadow,opacity] duration-150 ${
            draggedWorkspacePaneId === node.paneId
              ? "opacity-[0.55]"
              : workspaceDropTargetPaneId === node.paneId
                ? "z-20 rounded-2xl shadow-[inset_0_0_0_2px_var(--primary)]"
                : activePaneId === node.paneId
                  ? "z-10 shadow-[inset_0_0_0_1px_var(--primary),0_0_16px_color-mix(in_srgb,var(--primary)_14%,transparent)]"
                  : "opacity-[0.94]"
          }`}
        >
          {renderWorkspacePane(node.paneId)}
          {nodePane?.content === "charts" && workspacePanelPickerPaneId === node.paneId
            ? renderWorkspacePanelPicker(nodePane, true)
            : null}
          {draggedWorkspacePaneId && draggedWorkspacePaneId !== node.paneId ? (
            <div
              className={`pointer-events-none absolute inset-0 z-[90] grid grid-cols-3 grid-rows-3 gap-2 rounded-2xl p-[7%] backdrop-blur-[2px] transition-colors ${workspaceDropTargetPaneId === node.paneId ? "bg-background/48" : "bg-background/28"}`}
              aria-label="Workspace docking positions"
            >
              {([
                ["top", "TOP", "col-start-2 row-start-1"],
                ["left", "LEFT", "col-start-1 row-start-2"],
                ["center", "SWAP", "col-start-2 row-start-2"],
                ["right", "RIGHT", "col-start-3 row-start-2"],
                ["bottom", "BOTTOM", "col-start-2 row-start-3"],
              ] as const).map(([zone, label, position]) => {
                const selected = workspaceDropTargetPaneId === node.paneId && workspaceDropZone === zone;
                return (
                  <div
                    key={zone}
                    className={`${position} pointer-events-none flex min-h-10 items-center justify-center rounded-[4px] border text-[8px] font-semibold uppercase tracking-[0.12em] shadow-lg transition-all ${selected ? "scale-[1.04] border-primary bg-primary text-background shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_30%,transparent)]" : "border-border/80 bg-panel/88 text-muted"}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    const firstStyle: CSSProperties = node.axis === "x"
      ? { width: `calc(${node.ratio}% - 3px)`, left: 0, top: 0, bottom: 0 }
      : { height: `calc(${node.ratio}% - 3px)`, left: 0, right: 0, top: 0 };
    const secondStyle: CSSProperties = node.axis === "x"
      ? { width: `calc(${100 - node.ratio}% - 3px)`, right: 0, top: 0, bottom: 0 }
      : { height: `calc(${100 - node.ratio}% - 3px)`, left: 0, right: 0, bottom: 0 };

    return (
      <div
        key={node.id}
        data-workspace-split-id={node.id}
        className="relative h-full min-h-0 w-full min-w-0 overflow-hidden [contain:layout_paint]"
      >
        <div className="absolute min-h-0 min-w-0 overflow-hidden" style={firstStyle}>
          {renderWorkspaceNode(node.first)}
        </div>
        <div
          onPointerDown={(event) => startWorkspaceResize(node.id, node.axis, node.ratio, event)}
          className={`group absolute z-30 flex touch-none select-none items-center justify-center ${
            node.axis === "x"
              ? `inset-y-0 w-2 -translate-x-1/2 ${workspaceLocked ? "cursor-default" : "cursor-col-resize"}`
              : `inset-x-0 h-2 -translate-y-1/2 ${workspaceLocked ? "cursor-default" : "cursor-row-resize"}`
          }`}
          style={node.axis === "x" ? { left: `${node.ratio}%` } : { top: `${node.ratio}%` }}
          aria-label={node.axis === "x" ? "Resize chart columns" : "Resize chart rows"}
        >
          <div className={`${node.axis === "x" ? "h-12 w-1" : "h-1 w-12"} rounded-full bg-border/80 shadow-sm transition-all group-hover:bg-primary/70`} />
        </div>
        <div className="absolute min-h-0 min-w-0 overflow-hidden" style={secondStyle}>
          {renderWorkspaceNode(node.second)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen select-none overflow-hidden bg-background text-foreground">
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

      <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden" ref={mainRef}>
        <AppSidebar
          activeItem={bottomWorkspaceSection}
          accountLabel="Account"
          accountTitle={currentUsername ? `Sign out @${currentUsername}` : "Account"}
          navigationMode="persistent"
          onAccountClick={signOut}
          onTradesClick={() => {
            setShowTradesMenu((current) => {
              if (current) setTradesMenuView("root");
              return !current;
            });
          }}
          onNavigateIntent={warmWorkspaceSection}
          onNavigateStart={handleWorkspaceNavigationStart}
          orientation="horizontal"
          tradesActive={showTradesMenu || rightPanel === "order"}
        />

        {showTradesMenu && (
          <>
            <button
              type="button"
              aria-label="Close trades menu"
              onClick={() => {
                setShowTradesMenu(false);
                setTradesMenuView("root");
              }}
              className="fixed inset-0 z-[78] cursor-default bg-transparent"
            />
            <section className="fixed right-2 top-[35px] z-[79] w-[330px] overflow-hidden rounded-[5px] border border-border bg-panel shadow-[0_18px_55px_rgba(0,0,0,0.62)]">
              <header className="flex h-9 items-center justify-between border-b border-border px-3">
                <div className="flex items-center gap-2">
                  {tradesMenuView === "paper" && (
                    <button
                      type="button"
                      onClick={() => setTradesMenuView("root")}
                      className="flex h-6 w-6 items-center justify-center rounded-[3px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                      aria-label="Back to trades menu"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <BarChart3 className="h-3.5 w-3.5 text-primary" strokeWidth={1.55} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground">
                    {tradesMenuView === "paper" ? "Paper trading" : "Trades"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowTradesMenu(false);
                    setTradesMenuView("root");
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-[3px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                  aria-label="Close trades menu"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </header>

              {tradesMenuView === "root" ? (
                <div className="p-2.5">
                  <button
                    type="button"
                    onClick={() => setTradesMenuView("paper")}
                    className="group flex w-full items-center gap-3 rounded-[4px] border border-border bg-background/35 p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.045]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-primary/25 bg-primary/[0.08] text-primary">
                      <Wallet className="h-4 w-4" strokeWidth={1.55} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">Paper trading</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${selectedPaperTradingAccount ? "bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-muted/50"}`} />
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-muted">
                        {selectedPaperTradingAccount
                          ? `${selectedPaperTradingAccount.name} linked · ${formatDollar(selectedPaperSummary?.equity ?? 0)} equity`
                          : "Create or link a simulated futures account"}
                      </span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                  <p className="px-1 pb-0.5 pt-2.5 text-[9px] leading-4 text-muted">
                    Paper orders use live chart prices, CME contract specifications, margin, and attached stop-loss and take-profit logic.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 p-2.5">
                  {paperTradingAccounts.length > 0 ? (
                    <>
                      <div className="rounded-[4px] border border-border bg-background/35 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Trading account</label>
                          <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
                            Linked
                          </span>
                        </div>
                        <KwantSelect
                          value={String(selectedPaperTradingAccount?.id ?? paperTradingAccounts[0]?.id ?? "")}
                          onChange={(event) => selectPaperTradingAccount(event.target.value)}
                          className="h-8 w-full rounded-[3px] border border-border bg-surface px-2.5 text-[10px] text-foreground outline-none focus:border-primary/40"
                        >
                          {paperTradingAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {`${account.name} · ${account.balance} · ${account.leverage}`}
                            </option>
                          ))}
                        </KwantSelect>
                        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[3px] border border-border bg-border">
                          {[
                            ["Balance", formatDollar(selectedPaperSummary?.balance ?? 0)],
                            ["Equity", formatDollar(selectedPaperSummary?.equity ?? 0)],
                            ["Available", formatDollar(selectedPaperSummary?.availableFunds ?? 0)],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-panel px-2 py-2">
                              <div className="text-[8px] font-medium uppercase tracking-[0.1em] text-muted">{label}</div>
                              <div className="mt-1 truncate font-mono text-[10px] text-foreground">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={openPaperOrderTicket}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-[4px] border border-primary/40 bg-primary text-[10px] font-bold uppercase tracking-[0.11em] text-background transition-[filter] hover:brightness-110"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Open order ticket
                      </button>
                    </>
                  ) : (
                    <div className="rounded-[4px] border border-border bg-background/35 p-4 text-center">
                      <Wallet className="mx-auto h-5 w-5 text-primary" strokeWidth={1.55} />
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">No paper account linked</div>
                      <p className="mt-1 text-[10px] leading-4 text-muted">Create a simulated futures account, then it will be available in every order ticket.</p>
                      <button
                        type="button"
                        onClick={openPaperAccountLinker}
                        className="mt-3 h-8 rounded-[3px] border border-primary/35 bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-background"
                      >
                        Create paper account
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-2.5">
                    <button
                      type="button"
                      onClick={openPaperAccountLinker}
                      className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground"
                    >
                      {paperTradingAccounts.length > 0 ? "Link another account" : "Account setup"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTradesMenu(false);
                        setTradesMenuView("root");
                        router.push("/accounts");
                      }}
                      className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-primary"
                    >
                      Manage accounts <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {bottomWorkspaceSection === "charts" && (
        <header className="kwant-chart-command-deck relative grid shrink-0 grid-cols-[minmax(0,1fr)_auto] border-b border-border bg-panel">
          <div
            aria-disabled={!activePaneIsChart}
            title={activePaneIsChart ? "Controls apply to the selected chart" : `${WORKSPACE_PANEL_OPTIONS.find((option) => option.id === activeWorkspacePane.content)?.label ?? "Panel"} selected — choose a chart to use chart controls`}
            className={`relative col-start-1 row-start-2 flex min-w-0 items-center gap-2 px-3 ${!activePaneIsChart ? "pointer-events-none opacity-30" : ""} ${
            showAllTF
              ? "overflow-visible"
              : "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          }`}>
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
          <div ref={timeframeMenuRef} className="relative flex items-center gap-0.5">
            {visibleFavouriteIntervals.map((tf) => (
              <button
                key={tf}
                onPointerEnter={() => {
                  if (activeWorkspacePane.broker === "Databento") {
                    void warmDatabentoChartHistory(activeWorkspacePane.symbol, tf);
                  }
                }}
                onClick={() => selectTimeframe(tf)}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] transition-all ${selectedTimeframe === tf ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}
              >
                {formatChartInterval(tf)}
              </button>
            ))}
            <button
              type="button"
              aria-label="Chart intervals"
              aria-expanded={showAllTF}
              onClick={() => setShowAllTF(!showAllTF)}
              className={`ml-1 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${showAllTF ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface/50 text-muted hover:text-foreground"}`}
            >
              <span>{formatChartInterval(selectedTimeframe)}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllTF ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => toggleFavTF(selectedTimeframe)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary"
              aria-label={`${favTFs.includes(selectedTimeframe) ? "Remove" : "Add"} ${formatChartInterval(selectedTimeframe)} ${favTFs.includes(selectedTimeframe) ? "from" : "to"} favourites`}
              title={favTFs.includes(selectedTimeframe) ? "Remove interval from top bar" : "Pin interval to top bar"}
            >
              <Star className={`h-3.5 w-3.5 ${favTFs.includes(selectedTimeframe) ? "fill-primary text-primary" : ""}`} />
            </button>
            {showAllTF && (
              <div className="absolute left-0 top-[38px] z-50 w-[720px] max-w-[calc(100vw-120px)] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">Chart intervals</div>
                    <div className="mt-0.5 text-[10px] text-muted">
                      {activeChartBrokerLabel === "Databento"
                        ? "Time, volume and order-flow bars from CME market data"
                        : `Time intervals supported by ${displayMarketSource(activeChartBrokerLabel)}; futures-only modes are hidden`}
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowAllTF(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Close chart intervals">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-[560px] overflow-y-auto p-2">
                  {availableChartIntervalGroups.map((group) => {
                    const draft = intervalDrafts[group.kind];
                    return (
                      <div key={group.kind} className="grid grid-cols-[128px_138px_minmax(0,1fr)] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface/40">
                        <div className="flex items-center gap-2 text-[12px] font-medium text-foreground">
                          <Settings2 className="h-4 w-4 text-muted" />
                          <span>{group.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {activeChartBrokerLabel === "Databento" ? (
                            <>
                              <input
                                aria-label={`${group.label} interval value`}
                                type="number"
                                min={1}
                                step={1}
                                value={draft.primary}
                                onChange={(event) => setIntervalDrafts((current) => ({
                                  ...current,
                                  [group.kind]: { ...current[group.kind], primary: Math.max(1, Number(event.target.value) || 1) },
                                }))}
                                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-primary/40"
                              />
                              {group.secondaryDefault !== undefined && (
                                <input
                                  aria-label={`${group.label} secondary interval value`}
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={draft.secondary}
                                  onChange={(event) => setIntervalDrafts((current) => ({
                                    ...current,
                                    [group.kind]: { ...current[group.kind], secondary: Math.max(1, Number(event.target.value) || 1) },
                                  }))}
                                  className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-primary/40"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => applyCustomInterval(group.kind)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-primary/30 hover:text-primary"
                                aria-label={`Apply custom ${group.label} interval`}
                                title="Apply custom interval"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] text-muted">Standard intervals</span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          {group.options.map((option) => (
                            <div key={option.id} className={`flex items-center rounded-lg border transition-colors ${selectedTimeframe === option.id ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border hover:bg-surface"}`}>
                              <button
                                type="button"
                                onPointerEnter={() => {
                                  if (activeWorkspacePane.broker === "Databento") {
                                    void warmDatabentoChartHistory(activeWorkspacePane.symbol, option.id);
                                  }
                                }}
                                onClick={() => {
                                  selectTimeframe(option.id);
                                  setShowAllTF(false);
                                }}
                                className={`px-2 py-1.5 font-mono text-[11px] ${selectedTimeframe === option.id ? "text-primary" : "text-foreground"}`}
                              >
                                {option.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavTF(option.id)}
                                className="pr-1.5 text-muted hover:text-primary"
                                aria-label={`${favTFs.includes(option.id) ? "Remove" : "Add"} ${option.label} ${favTFs.includes(option.id) ? "from" : "to"} favourites`}
                              >
                                <Star className={`h-3 w-3 ${favTFs.includes(option.id) ? "fill-primary text-primary" : ""}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {activeChartBrokerLabel === "Databento" && (
                  <div className="border-t border-border px-4 py-2.5 text-[10px] leading-4 text-muted">
                    Range and Renko use the contract&apos;s tick size. Volume, trade and delta bars use native CME executions.
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
          <div className="col-span-2 col-start-1 row-start-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 overflow-x-auto border-b border-border/70 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="col-start-2 flex h-7 shrink-0 items-center gap-1">
            {[
              {
                layout: "single" as Exclude<WorkspaceLayout, "custom">,
                title: "Single panel",
                icon: (
                  <span className="grid h-4 w-4 grid-cols-1 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
              {
                layout: "split-vertical" as Exclude<WorkspaceLayout, "custom">,
                title: "Two panels side by side",
                icon: (
                  <span className="grid h-4 w-4 grid-cols-2 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
              {
                layout: "split-horizontal" as Exclude<WorkspaceLayout, "custom">,
                title: "Two panels stacked",
                icon: (
                  <span className="grid h-4 w-4 grid-rows-2 gap-0.5">
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                    <span className="rounded-[2px] border border-current/70 bg-current/15" />
                  </span>
                ),
              },
              {
                layout: "quad" as Exclude<WorkspaceLayout, "custom">,
                title: "Four-panel grid",
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
                onClick={() => applyWorkspaceLayoutTemplate(layout)}
                title={title}
                aria-label={title}
                className={`flex h-7 w-7 items-center justify-center rounded-[3px] border text-[10px] font-semibold uppercase tracking-[0.075em] transition-colors ${workspaceLayout === layout ? "border-primary/35 bg-primary/[0.08] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
              >
                {icon}
              </button>
            ))}
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={addChartToWorkspace}
              disabled={workspaceLocked}
              title={workspaceLocked ? "Unlock the workspace to add a panel" : "Add a new panel"}
              aria-label="Add panel to workspace"
              className={`flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[3px] border px-2.5 text-[10px] font-semibold uppercase tracking-[0.075em] transition-colors ${
                workspaceLocked
                  ? "cursor-not-allowed border-border text-muted/40"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-background"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>PANEL</span>
            </button>
            <button
              onClick={() => setWorkspaceLocked((current) => !current)}
              className={`ml-1 flex h-7 w-7 items-center justify-center rounded-[3px] border text-[10px] font-semibold uppercase tracking-[0.075em] transition-colors ${workspaceLocked ? "border-primary/35 bg-primary/[0.08] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
              title={workspaceLocked ? "Unlock layout" : "Lock layout"}
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
            <div className="relative">
              <button
                ref={workspacePresetButtonRef}
                type="button"
                onClick={() => {
                  positionWorkspacePresetMenu();
                  setShowWorkspacePresetMenu((current) => !current);
                  setShowSaveWorkspacePreset(false);
                }}
                className={`flex h-7 items-center gap-1.5 rounded-[3px] border px-2.5 text-[10px] font-semibold uppercase tracking-[0.075em] transition-colors ${
                  showWorkspacePresetMenu ? "border-primary/35 bg-primary/[0.08] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"
                }`}
                title="Saved workspaces"
              >
                <Save className="h-3.5 w-3.5" strokeWidth={1.55} />
                <span>WORKSPACES</span>
              </button>
              {showWorkspacePresetMenu && typeof document !== "undefined" ? createPortal(
                <div
                  ref={workspacePresetMenuRef}
                  className="fixed z-[1000] w-[340px] rounded-2xl border border-border bg-panel p-2 shadow-2xl shadow-black/50"
                  style={workspacePresetMenuPosition}
                >
                  <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Saved workspaces
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Saved locally
                    </span>
                  </div>
                  <div className="mb-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={quickSaveWorkspacePreset}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary text-[10px] font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Quick Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveWorkspacePreset(true)}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-[10px] font-semibold text-foreground hover:border-primary/40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Save As
                    </button>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {workspacePresets.length ? workspacePresets.map((preset) => (
                      <div
                        key={preset.id}
                        className={`group flex items-center gap-1 rounded-xl ${
                          activeWorkspacePresetId === preset.id
                            ? "bg-primary/10 ring-1 ring-inset ring-primary/25"
                            : "hover:bg-surface"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => applyWorkspacePreset(preset)}
                          className="min-w-0 flex-1 px-3 py-2 text-left"
                        >
                          <div className="truncate text-[12px] font-medium text-foreground">{preset.name}</div>
                          <div className="mt-0.5 text-[9px] text-muted">
                            {activeWorkspacePresetId === preset.id ? "Active · " : ""}
                            {collectWorkspacePaneIds(preset.layout).length} charts · {new Date(preset.updatedAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSavedWorkspace(preset)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                          aria-label={`Export ${preset.name}`}
                          title="Export this workspace"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWorkspaceDeleteCandidate(preset);
                            if (window.confirm(`Delete workspace "${preset.name}"?`)) {
                              deleteWorkspacePreset(preset.id);
                            } else {
                              setWorkspaceDeleteCandidate(null);
                            }
                          }}
                          className="mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                          aria-label={`Delete ${preset.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[10px] text-muted">
                        No saved workspaces yet
                      </div>
                    )}
                  </div>
                  <div className="mt-2 border-t border-border pt-2">
                    {showSaveWorkspacePreset && (
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          autoFocus
                          value={workspacePresetName}
                          onChange={(event) => setWorkspacePresetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveCurrentWorkspacePreset();
                            if (event.key === "Escape") setShowSaveWorkspacePreset(false);
                          }}
                          placeholder="Name this workspace"
                          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-[11px] text-foreground outline-none focus:border-primary/60"
                        />
                        <button
                          type="button"
                          onClick={saveCurrentWorkspacePreset}
                          disabled={!workspacePresetName.trim()}
                          className="h-8 rounded-lg bg-primary px-3 text-[10px] font-semibold text-background disabled:opacity-40"
                        >
                          Save As
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={exportCurrentWorkspace}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export Current
                      </button>
                      <button
                        type="button"
                        onClick={exportAllWorkspaceBackups}
                        disabled={!workspacePresets.length}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-medium text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export All
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => workspaceImportInputRef.current?.click()}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setWorkspaceImportDragging(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setWorkspaceImportDragging(true);
                      }}
                      onDragLeave={() => setWorkspaceImportDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setWorkspaceImportDragging(false);
                        void importWorkspaceBackup(event.dataTransfer.files?.[0]);
                      }}
                      className={`mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[10px] font-medium transition-colors ${
                        workspaceImportDragging
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import workspace JSON
                    </button>
                    <input
                      ref={workspaceImportInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(event) => void importWorkspaceBackup(event.target.files?.[0])}
                    />
                  </div>
                </div>,
                document.body,
              ) : null}
            </div>
          </div>
          <TimeZoneSelect
            value={chartSettings.timezone}
            onChange={changeChartTimeZone}
            menuLabel="Chart timezone"
            compact
            className={`col-start-3 ml-1 max-w-[36px] shrink-0 justify-self-end px-2 sm:max-w-[190px] sm:px-2.5 [&>span]:hidden sm:[&>span]:block [&>svg:last-child]:hidden sm:[&>svg:last-child]:block ${!activePaneIsChart ? "pointer-events-none opacity-30" : ""}`}
          />
          </div>
          <div
            aria-disabled={!activePaneIsChart}
            className={`col-start-2 row-start-2 flex min-w-0 items-center justify-end gap-2 px-3 ${!activePaneIsChart ? "pointer-events-none opacity-30" : ""}`}
          >
          <ChartIndicatorsControl
            instrument={displayCmeSymbol(activeWorkspacePane.symbol)}
            timeframe={formatChartInterval(activeWorkspacePane.timeframe)}
            indicators={paneIndicators[activePaneId] ?? []}
            chartSettings={chartSettings}
            levelControls={[
              {
                id: "gamma",
                label: "Kwant levels",
                description: "Live options positioning and gamma levels",
                badge: "Γ",
                enabled: gammaLevelsEnabled,
                available: activeWorkspacePane.broker === "Databento"
                  && isGammaChartInstrument(displayCmeSymbol(activeWorkspacePane.symbol)),
                onToggle: () => togglePaneLevelVisibility(activePaneId, "gamma"),
              },
              {
                id: "kwant",
                label: "Kwant zones",
                description: "Proprietary session zones from the Gameplan engine",
                badge: "K",
                enabled: Boolean(activePaneLevelVisibility.kwant && activeGameplanRoot && gameplanChartOverlays[activeGameplanRoot]?.levels.length),
                available: Boolean(activeGameplanRoot),
                loading: Boolean(activeGameplanRoot && quickGameplanLoading && quickGameplanLoadingRoot === activeGameplanRoot),
                onToggle: () => {
                  if (!activeGameplanRoot) return;
                  if (activePaneLevelVisibility.kwant) {
                    setPaneLevelVisible(activePaneId, "kwant", false);
                    return;
                  }
                  setPaneLevelVisible(activePaneId, "kwant", true);
                  if (gameplanChartOverlays[activeGameplanRoot]?.levels.length) return;
                  void refreshKwantLevelsForInstrument(activeWorkspacePane.symbol);
                },
              },
              {
                id: "structure",
                label: "Structure zones",
                description: "Supply, demand, support and resistance",
                badge: "S",
                enabled: historicalStructureEnabled,
                available: activeWorkspacePane.broker === "Databento"
                  && isContinuousFuture(activeWorkspacePane.symbol),
                onToggle: () => togglePaneLevelVisibility(activePaneId, "structure"),
              },
              {
                id: "value-area",
                label: "Value area",
                description: "VAH, VAL, POC and VWAP levels",
                badge: "VA",
                enabled: valueAreaLevelsEnabled,
                available: activeWorkspacePane.broker === "Databento"
                  && isContinuousFuture(activeWorkspacePane.symbol),
                onToggle: () => togglePaneLevelVisibility(activePaneId, "valueArea"),
              },
            ]}
            onChange={(next) => setIndicatorsForPane(activePaneId, next)}
          />
          <SourceCodeIndicatorsControl
            instrument={displayCmeSymbol(activeWorkspacePane.symbol)}
            timeframe={formatChartInterval(activeWorkspacePane.timeframe)}
            indicators={paneIndicators[activePaneId] ?? []}
            onChange={(next) => setIndicatorsForPane(activePaneId, next)}
          />
          <button
            type="button"
            onClick={openLevelsExport}
            title="Export chart levels"
            aria-label="Export chart levels"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-primary/30 hover:bg-card hover:text-primary"
          >
            <Download className="h-4 w-4" />
          </button>
          <button onClick={signOut} title={currentUsername ? `@${currentUsername}` : "Account"} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface transition-colors hover:bg-card"><UserAvatar label={currentUsername || "Kwant Trader"} avatarUrl={currentAvatarUrl} size="sm" /></button>
          </div>
        </header>
        )}

        {showLevelsExport && typeof document !== "undefined"
          ? createPortal(
            <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                onClick={() => setShowLevelsExport(false)}
                aria-label="Close levels export"
              />
              <div className="relative z-10 flex max-h-[calc(100vh-32px)] w-full max-w-[680px] flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_28px_100px_rgba(0,0,0,.7)]">
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Download className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-foreground">Export chart levels</div>
                    <div className="mt-0.5 text-[10px] text-muted">Choose levels, instrument and the destination platform.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLevelsExport(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground"
                    aria-label="Close levels export"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                  <section>
                    <div className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">Level type</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["gamma", "Gamma Levels", "Live options chart levels", false],
                        ["gameplan", "Kwant Levels", "Proprietary named levels and price zones", false],
                        ["valueArea", "Value Area Levels", "Prior-day and prior-week VAH, VAL, POC and VWAP", false],
                        ["historicalStructure", "Historical Supply/Demand + S/R", "Five-day structure zones with live Rithmic MBO confirmation", false],
                      ] as const).map(([type, label, description, disabled]) => {
                        const active = levelExportTypes[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={disabled}
                            aria-disabled={disabled}
                            aria-pressed={active}
                            onClick={() => {
                              if (disabled) return;
                              setLevelExportTypes((current) => ({ ...current, [type]: !current[type] }));
                              setLevelExportError("");
                            }}
                            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                              disabled
                                ? "cursor-not-allowed border-border bg-surface/15 opacity-50"
                                : active
                                ? "border-primary/35 bg-primary/[0.08]"
                                : "border-border bg-surface/35 hover:bg-surface"
                            }`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              active ? "border-primary bg-primary text-background" : "border-border bg-background"
                            }`}>
                              {active ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`flex items-center gap-2 text-[11px] font-semibold ${active ? "text-foreground" : "text-muted"}`}>
                                {label}
                                {disabled ? <span className="rounded-md border border-border px-1.5 py-0.5 text-[7px] uppercase tracking-[0.08em] text-muted">Preparing</span> : null}
                              </span>
                              <span className="mt-0.5 block text-[9px] text-muted">{description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">Instruments</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLevelExportInstruments(
                            selectedLevelExportInstruments.length === availableLevelExportInstruments.length
                              ? []
                              : availableLevelExportInstruments.map((option) => option.instrument),
                          );
                          setLevelExportError("");
                        }}
                        className="text-[9px] font-semibold text-primary hover:text-foreground"
                      >
                        {selectedLevelExportInstruments.length === availableLevelExportInstruments.length ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-1.5 rounded-2xl border border-border bg-background/35 p-2">
                      {availableLevelExportInstruments.map((option) => {
                        const active = selectedLevelExportInstruments.includes(option.instrument);
                        const gammaCount = option.gamma?.levels.length ?? 0;
                        const gameplanCount = option.gameplan?.levels.length ?? 0;
                        const valueAreaCount = option.valueArea?.levels.length ?? 0;
                        const gammaPreparing = isGammaChartInstrument(option.instrument) && showLevelsExport && gammaCount === 0;
                        const valueAreaPreparing = showLevelsExport && valueAreaCount === 0;
                        return (
                          <button
                            key={option.instrument}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleLevelExportInstrument(option.instrument)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              active
                                ? "border-primary/25 bg-primary/[0.07]"
                                : "border-transparent hover:border-border hover:bg-surface/50"
                            }`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              active ? "border-primary bg-primary text-background" : "border-border bg-surface"
                            }`}>
                              {active ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-[12px] font-semibold text-foreground">{option.instrument}</span>
                                {option.contractSymbol ? <span className="font-mono text-[9px] text-muted">{option.contractSymbol}</span> : null}
                              </span>
                              <span className="mt-0.5 block text-[9px] text-muted">
                                {gammaPreparing ? "Preparing Gamma" : `${gammaCount} Gamma`}
                                {" · "}{gameplanCount} Gameplan
                                {" · "}{valueAreaPreparing ? "Preparing Value Area" : `${valueAreaCount} Value Area`}
                              </span>
                            </span>
                            <span className="font-mono text-[10px] text-muted">{gammaCount + gameplanCount + valueAreaCount}</span>
                          </button>
                        );
                      })}
                      {!availableLevelExportInstruments.length ? (
                        <div className="px-3 py-8 text-center text-[10px] text-muted">Open a chart to prepare its levels for export.</div>
                      ) : null}
                    </div>
                  </section>

                  <section>
                    <div className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">Destination platform</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PLATFORM_LEVEL_EXPORT_OPTIONS.map((option) => {
                        const active = levelExportFormat === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setLevelExportFormat(option.id);
                              setLevelExportError("");
                            }}
                            className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                              active
                                ? "border-primary/35 bg-primary/[0.08]"
                                : "border-border bg-surface/35 hover:bg-surface"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{option.label}</span>
                              <span className="ml-auto rounded-md border border-border bg-background/50 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.08em] text-muted">{option.delivery}</span>
                            </span>
                            <span className="mt-1 block text-[8px] text-muted">{option.detail} · .{option.extension}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
                      <div className="flex items-center gap-2 text-[8px] font-semibold text-primary">
                        {activeLevelExportOption.label}
                        <span className="rounded-md border border-primary/20 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.08em]">{activeLevelExportOption.delivery}</span>
                      </div>
                      <p className="mt-1.5 text-[8px] leading-4 text-muted">{activeLevelExportOption.instructions}</p>
                      {activeLevelExportOption.oneInstrument ? (
                        <p className="mt-1 text-[7px] font-semibold text-foreground">Select exactly one instrument for this platform.</p>
                      ) : null}
                    </div>
                  </section>

                  {levelExportError ? (
                    <div className="rounded-xl border border-danger/20 bg-danger/[0.08] px-3 py-2.5 text-[10px] text-danger">
                      {levelExportError}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 border-t border-border bg-background/25 px-5 py-4">
                  <div className="mr-auto">
                    <div className="font-mono text-[11px] font-semibold text-foreground">{selectedLevelExportCount} levels ready</div>
                    <div className="mt-0.5 text-[8px] text-muted">The download is generated locally in your browser.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLevelsExport(false)}
                    className="h-9 rounded-xl border border-border px-4 text-[10px] font-semibold text-muted hover:bg-surface hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={exportSelectedLevels}
                    className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-semibold text-background hover:brightness-110"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
          : null}

        {visitedWorkspaceSections.has("charts") ? (
        <ReactActivity mode={bottomWorkspaceSection === "charts" ? "visible" : "hidden"}>
        <WorkspaceFailureBoundary resetKey="charts" label="Charts">
        {!preferencesReady ? (
          workspaceLoader("Opening charts", "Restoring your saved workspace before the market feed starts.")
        ) : <div className="min-h-0 flex-1 overflow-hidden">
          <div ref={workspaceAreaRef} className="relative h-full min-w-0">
            {renderWorkspaceNode(workspaceTree)}
            {workspaceFloatingWindows.map((floating, index) =>
              renderFloatingWorkspaceWindow(floating, index))}
          </div>
          {false && rightPanel && (
            <div style={{ width: rightPanelWidth }} className="relative flex min-w-0 shrink-0 flex-col overflow-hidden border-l border-border bg-panel">
              <div onMouseDown={startRightPanelResize} className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:w-1.5 hover:bg-primary/30" />
              {rightPanel === "order" && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-primary"><Zap className="h-3.5 w-3.5" /></div><div><div className="text-[13px] font-semibold text-foreground">{displayCmeSymbol(selectedInstrument)}</div><div className="text-[11px] text-muted">Order ticket</div></div></div>
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
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Units</span><KwantSelect value={unitsType} onChange={(e) => setUnitsType(e.target.value as typeof unitsType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="units">Units</option><option value="lots">Lots</option><option value="usd">USD</option><option value="pctBalance">% Balance</option></KwantSelect></div><div className="flex items-center gap-1 text-[12px] text-muted"><span className="font-mono text-foreground">581.92 USD</span><ChevronDown className="h-3 w-3" /></div></div>
                    <div className="flex items-center gap-2"><input value={orderUnits} onChange={(e) => setOrderUnits(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button></div>
                  </div>
                  <div className="mb-4 rounded-xl border border-border bg-background/30">
                    <button onClick={() => setShowExits((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-[13px] font-medium">Exits{showExits ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}</button>
                    {showExits && <div className="space-y-4 border-t border-border p-3"><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Take profit</span><KwantSelect value={tpType} onChange={(e) => setTpType(e.target.value as typeof tpType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="rewardUsd">reward USD</option><option value="rewardPct">reward % balance</option></KwantSelect></div><button onClick={() => setTpEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${tpEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${tpEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!tpEnabled} value={orderTP} onChange={(e) => setOrderTP(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">{orderPreviewTakeProfitTicks ? `${orderPreviewTakeProfitTicks} ticks` : "--"}</span></div></div><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Stop loss</span><KwantSelect value={slType} onChange={(e) => setSlType(e.target.value as typeof slType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="riskUsd">risk USD</option><option value="riskPct">risk % balance</option></KwantSelect></div><button onClick={() => setSlEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${slEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${slEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!slEnabled} value={orderSL} onChange={(e) => setOrderSL(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">{orderPreviewStopLossTicks ? `${orderPreviewStopLossTicks} ticks` : "--"}</span></div></div></div>}
                  </div>
                  <div className="mb-4 space-y-2 text-[13px]"><h3 className="font-semibold text-primary">Order info</h3><div className="flex justify-between"><span className="text-muted">Margin</span><span className="font-mono">581.92 / 81,682.73</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full w-[18%] rounded-full bg-primary" /></div><div className="flex justify-between"><span className="text-muted">Leverage</span><span className="font-mono">50:1</span></div><div className="flex justify-between"><span className="text-muted">Tick value</span><span className="font-mono">0.1 USD</span></div><div className="flex justify-between"><span className="text-muted">Trade value</span><span className="font-mono">29,096.20 USD</span></div></div>
                  <button className={`w-full rounded-xl py-3 font-semibold text-background ${orderSide === "buy" ? "bg-primary" : "bg-danger"}`}>{orderSide === "buy" ? "Buy" : "Sell"} {orderUnits || "1"} {displayCmeSymbol(selectedInstrument)} {orderType.toUpperCase()}</button>
                </div>
              )}
              {rightPanel === "watchlist" && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4"><button className="flex items-center gap-1 text-[14px] font-semibold">Watchlist <ChevronDown className="h-3.5 w-3.5 text-muted" /></button><div className="flex items-center gap-1"><button onClick={() => setShowInstrumentSearch(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Grid3X3 className="h-3.5 w-3.5" /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button></div></div>
                  <div className="grid grid-cols-[minmax(92px,1fr)_74px_54px_54px] gap-2 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted"><span>Symbol</span><span className="text-right">Last</span><span className="text-right">Chg</span><span className="text-right">Chg%</span></div>
                  <div className="flex-1 overflow-y-auto">{watchlist.map((row) => { const item = getStaticWatchlistDetail(row.symbol, row.broker, watchlistDetails); const displayPrice = item?.price ?? (row.mid ? row.mid.toLocaleString(undefined, { maximumFractionDigits: 5 }) : "--"); const change = item ? Number(item.change.replace("%", "")) : row.change; const changePercent = item ? Number(item.change.replace("%", "")) : row.changePercent; const up = changePercent >= 0; return <button key={row.key} onClick={() => selectInstrument(row.symbol, row.broker, row.key)} className={`grid w-full grid-cols-[minmax(92px,1fr)_74px_54px_54px] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface/60 ${selectedWatchlistKey === row.key ? "bg-surface" : ""}`}><span className="min-w-0"><span className="block truncate text-[9px] uppercase tracking-wider text-muted">{displayMarketSource(row.broker)}</span><span className="flex min-w-0 items-center gap-1.5"><span className="block truncate text-[13px] font-medium text-foreground">{displayCmeSymbol(row.symbol)}</span>{row.contractSymbol ? <span className="shrink-0 font-mono text-[9px] text-muted">{row.contractSymbol}</span> : null}</span></span><span className="text-right font-mono text-[12px] text-foreground">{displayPrice}</span><span className={`text-right font-mono text-[11px] ${up ? "text-primary" : "text-danger"}`}>{up ? "+" : "-"}{Math.abs(change).toFixed(2)}</span><span className={`text-right font-mono text-[11px] ${up ? "text-primary" : "text-danger"}`}>{up ? "+" : ""}{changePercent.toFixed(2)}%</span></button>; })}</div>
                </div>
              )}
              {rightPanel === "alerts" && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4"><h3 className="text-[14px] font-semibold">Alerts</h3><button onClick={() => openCreateAlert()} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button></div>
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
                                      <div className="text-[13px] text-foreground">{displayCmeText(alert.conditionLabel)}</div>
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

                      ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">No alerts for {displayCmeSymbol(selectedInstrument)}. Create one from the chart or press +.</div>
                    ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">Choose a market to create an alert.</div>}
                  </div>
                  <div className="border-t border-border p-4"><button onClick={() => { window.location.href = "/alerts"; }} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted hover:text-foreground">Manage All Alerts</button></div>
                </div>
              )}
              {rightPanel === "alertslog" && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
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
              { id: "watchlist" as const, title: "Watchlist", icon: List },
              { id: "order" as const, title: "Trade", icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              const active = rightPanel === item.id;
              return (
                <button key={item.id} title={item.title} onClick={() => setRightPanel(active ? null : item.id)} className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </button>
              );
            })}
          </div>
        </div>}
        </WorkspaceFailureBoundary>
        </ReactActivity>
        ) : null}
        <ReactActivity mode={bottomWorkspaceSection === "charts" ? "hidden" : "visible"}>
          <section
            className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden bg-panel"
            aria-label={`${BOTTOM_WORKSPACE_SECTIONS.find((section) => section.id === bottomWorkspaceSection)?.label ?? "Workspace"} workspace`}
          >
            {visitedWorkspaceSections.has("gamma") ? (
              <ReactActivity mode={bottomWorkspaceSection === "gamma" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="gamma" label="Gamma">
                  <GammaWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("levelz") ? (
              <ReactActivity mode={bottomWorkspaceSection === "levelz" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="levelz" label="Levelz">
                  <LevelzWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("gexmap") ? (
              <ReactActivity mode={bottomWorkspaceSection === "gexmap" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="gexmap" label="GEX Map">
                  <GexMapWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {bottomWorkspaceSection === "liqmap" ? (
              <WorkspaceFailureBoundary resetKey="liqmap" label="Liquidity Map">
                <LiquidityMapWorkspace
                  instrument={selectedLiquidityMapInstrument}
                  onInstrumentChange={setSelectedLiquidityMapInstrument}
                />
              </WorkspaceFailureBoundary>
            ) : null}
            {visitedWorkspaceSections.has("heatmap") ? (
              <ReactActivity mode={bottomWorkspaceSection === "heatmap" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="heatmap" label="Heat Map">
                  <OptionsHeatmapWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("gexbot") ? (
              <ReactActivity mode={bottomWorkspaceSection === "gexbot" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="gexbot" label="GEX Bot">
                  <GexBotWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("gexdesk") ? (
              <ReactActivity mode={bottomWorkspaceSection === "gexdesk" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="gexdesk" label="GEX Desk">
                  <GexDeskWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("gameplan") ? (
              <ReactActivity mode={bottomWorkspaceSection === "gameplan" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="gameplan" label="Game Plan">
                  <GameplanWorkspace initialInstrument={displayCmeSymbol(selectedInstrument)} />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("kwantbot") ? (
              <ReactActivity mode={bottomWorkspaceSection === "kwantbot" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="kwantbot" label="KwantBot">
                  <KwantBotIntelligenceWorkspace interpreter={kwantBotInterpreter} />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("news") ? (
              <ReactActivity mode={bottomWorkspaceSection === "news" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="news" label="News">
                  <NewsWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("zyon") ? (
              <ReactActivity mode={bottomWorkspaceSection === "zyon" ? "visible" : "hidden"}>
              <WorkspaceFailureBoundary resetKey="zyon" label="Zyon">
              <ZyonPanelBoundary
                variant="workspace"
                resetKey={`${preferenceUserId || "anonymous"}:${kwantBotInterpreter.selectedRoot}:${kwantBotInterpreter.contexts[kwantBotInterpreter.selectedRoot]?.generatedAt ?? "pending"}`}
              >
                <ZyonWorkspace
                  interpreter={kwantBotInterpreter}
                  viewerName={currentDisplayName || currentUsername}
                  accountKey={preferenceUserId}
                />
              </ZyonPanelBoundary>
              </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("journal") ? (
              <ReactActivity mode={bottomWorkspaceSection === "journal" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="journal" label="Journal">
                  <JournalWorkspace accountKey={preferenceUserId || currentUsername || "local"} />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("backtesting") ? (
              <ReactActivity mode={bottomWorkspaceSection === "backtesting" ? "visible" : "hidden"}>
                <WorkspaceFailureBoundary resetKey="backtesting" label="Backtesting">
                  <BacktestingWorkspace />
                </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
            {visitedWorkspaceSections.has("socials") ? (
              <ReactActivity mode={bottomWorkspaceSection === "socials" ? "visible" : "hidden"}>
              <WorkspaceFailureBoundary resetKey="socials" label="Socials">
              <SocialsWorkspace
                accountKey={preferenceUserId || currentUsername || "local"}
                accountLabel={currentUsername || "Kwant Trader"}
                initialProfileHandle={socialProfileHandle}
                onOpenProfile={(handle) => router.push(`/socials/${encodeURIComponent(handle)}`)}
                onCloseProfile={() => router.push("/socials")}
                onMessageProfile={(userId) => {
                  setFriendsInitialFriendId(userId);
                  setRightPanel("messages");
                }}
                onOpenGameplanScoring={() => router.push("/gameplan?tab=scoring")}
              />
              </WorkspaceFailureBoundary>
              </ReactActivity>
            ) : null}
          </section>
        </ReactActivity>

        {false && !bottomMinimized && (
          <div onMouseDown={startBottomResize} className="relative h-4 flex-shrink-0 cursor-row-resize bg-transparent">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors group-hover:bg-primary/30" />
            <div className="flex h-full items-center justify-center">
              <div className="h-1 w-12 rounded-full bg-muted/40 shadow-[0_0_0_1px_rgba(24,24,27,0.45)]" />
            </div>
          </div>
        )}
        <div style={{ height: bottomMinimized ? BOTTOM_PANEL_COLLAPSED_HEIGHT : bottomPanelHeight }} className="hidden flex-shrink-0 flex-col overflow-hidden border-t border-border bg-panel">
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
          <KwantSelect value={equityPeriod} onChange={(e) => setEquityPeriod(e.target.value)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] text-muted outline-none"><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="365d">365 days</option><option value="all">All</option></KwantSelect>
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
                            {profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}
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
                        <div className="flex items-center gap-3"><h3 className="text-[15px] font-semibold">{selectedStrategyItem.name}</h3><KwantSelect value={viewedVersionNumber} onChange={(e) => setSelectedVersion(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none">{selectedStrategyVersions.map((version) => <option key={version.version} value={version.version}>v{version.version} ? {formatStrategyDate(version.timestamp)}</option>)}</KwantSelect><span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted">{selectedStrategyItem.language}</span></div>
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

      {bottomWorkspaceSection !== "backtesting" && rightPanel && (
        <div style={{ width: rightPanelWidth }} className="relative flex min-w-0 shrink-0 flex-col overflow-hidden border-l border-border bg-panel">
          <div onMouseDown={startRightPanelResize} className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:w-1.5 hover:bg-primary/30" />
          {(rightPanel === "friends" || rightPanel === "messages") && (
            <FriendsPanel
              mode={rightPanel === "messages" ? "messages" : "friends"}
              onClose={() => setRightPanel(null)}
              onUnreadCountChange={setFriendsUnreadCount}
              onMessageUnreadCountChange={setFriendMessageUnreadCount}
              initialFriendId={friendsInitialFriendId}
              onInitialFriendConsumed={() => setFriendsInitialFriendId("")}
              onViewProfile={(handle) => {
                setRightPanel(null);
                router.push(`/socials/${encodeURIComponent(handle)}`);
              }}
            />
          )}
          {rightPanel === "order" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-primary"><Zap className="h-3.5 w-3.5" /></div>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">{displayCmeSymbol(selectedInstrument)}</div>
                    <div className="text-[11px] text-muted">{paperExecutionRequested ? "Paper Trading" : activeTradingBrokerLabel} order ticket</div>
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
                {orderType !== "market" && <div className="mb-4 space-y-1.5"><label className="text-[12px] text-muted">{orderType === "limit" ? "Limit price" : "Stop price"}</label><input value={orderPrice} onChange={(event) => setOrderPrice(event.target.value)} placeholder={selectedMidPrice ? formatPrice(selectedMidPrice, selectedInstrument) : "Price"} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /></div>}
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">{selectedPaperContract.isMicro ? "Micros" : selectedPaperContract.isFutures ? "Contracts" : "Units"}</span>{!selectedPaperContract.isFutures && <KwantSelect value={unitsType} onChange={(e) => setUnitsType(e.target.value as typeof unitsType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="units">Units</option><option value="lots">Lots</option><option value="usd">USD</option><option value="pctBalance">% Balance</option></KwantSelect>}</div><div className="flex items-center gap-1 text-[12px] text-muted"><span className="font-mono text-foreground">{formatDollar(orderPanelMarginUsd)}</span><ChevronDown className="h-3 w-3" /></div></div>
                  <div className="flex items-center gap-2"><input value={orderUnits} onChange={(e) => setOrderUnits(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-primary/40" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button></div>
                </div>
              </div>
              <div className="mb-4 rounded-xl border border-border bg-background/30">
                <button onClick={() => setShowExits((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-[13px] font-medium">Exits{showExits ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}</button>
                {showExits && <div className={`space-y-4 border-t border-border p-3 ${tradingUnlocked ? "" : "pointer-events-none opacity-60"}`}><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Take profit</span><KwantSelect value={tpType} onChange={(e) => setTpType(e.target.value as typeof tpType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="rewardUsd">reward USD</option><option value="rewardPct">reward % balance</option></KwantSelect></div><button onClick={() => setTpEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${tpEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${tpEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!tpEnabled} value={orderTP} onChange={(e) => setOrderTP(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">{orderPreviewTakeProfitTicks ? `${orderPreviewTakeProfitTicks} ticks` : "--"}</span></div></div><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[13px] text-muted">Stop loss</span><KwantSelect value={slType} onChange={(e) => setSlType(e.target.value as typeof slType)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted outline-none"><option value="price">price</option><option value="ticks">ticks</option><option value="pctPrice">% of price</option><option value="riskUsd">risk USD</option><option value="riskPct">risk % balance</option></KwantSelect></div><button onClick={() => setSlEnabled((value) => !value)} className={`h-5 w-10 rounded-full transition-all ${slEnabled ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${slEnabled ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><div className="flex items-center gap-2"><input disabled={!slEnabled} value={orderSL} onChange={(e) => setOrderSL(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none disabled:opacity-50" /><button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"><ArrowLeftRight className="h-4 w-4" /></button><span className="w-14 text-right font-mono text-[11px] text-muted">{orderPreviewStopLossTicks ? `${orderPreviewStopLossTicks} ticks` : "--"}</span></div></div></div>}
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
                  <div className="flex justify-between"><span className="text-muted">Broker</span><span className="font-mono text-right">{paperExecutionRequested ? "Paper Trading" : activeTradingBrokerLabel}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Mode</span><span className="font-mono text-right">{paperExecutionRequested ? "Demo" : currentBrokerConnection.mode}</span></div>
                  {paperTradingAccounts.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted">Account</span><span className="text-[11px] text-muted">{activeBrokerHealth.detail}</span></div>
                      <KwantSelect
                        value={String(selectedPaperTradingAccount?.id ?? paperTradingAccounts[0]?.id ?? "")}
                        onChange={(event) => selectPaperTradingAccount(event.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] outline-none focus:border-primary/40"
                      >
                        {paperTradingAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {`${account.name} - ${account.balance} - ${account.leverage}`}
                          </option>
                        ))}
                      </KwantSelect>
                    </div>
                  ) : activeBrokerAccounts.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted">Account</span><span className="text-[11px] text-muted">{activeBrokerHealth.detail}</span></div>
                      <KwantSelect
                        value={String(currentBrokerConnection.accountId ?? activeBrokerAccounts[0]?.accountId ?? "")}
                        onChange={(event) => selectBrokerAccount(activeTradingBrokerLabel, Number(event.target.value))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] outline-none focus:border-primary/40"
                      >
                        {activeBrokerAccounts.map((account) => (
                          <option key={account.accountId} value={account.accountId}>
                            {formatCTraderAccountLabel(account)}
                          </option>
                        ))}
                      </KwantSelect>
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
                  <div className="flex justify-between"><span className="text-muted">Leverage</span><span className="font-mono">{tradingUnlocked ? paperExecutionRequested ? selectedPaperTradingAccount?.leverage ?? "--" : "50:1" : "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Tick size</span><span className="font-mono">{selectedPaperContract.tickSize}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Tick value</span><span className="font-mono">{formatDollar(selectedPaperContract.tickValue * selectedOrderQuantity)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">1-point value</span><span className="font-mono">{formatDollar(selectedPaperContract.pointValue * selectedOrderQuantity)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Trade value</span><span className="font-mono">{formatDollar(orderPanelTradeValueUsd)}</span></div>
                </div>
              </div>
              <button onClick={tradingUnlocked ? submitPaperOrder : undefined} disabled={!tradingUnlocked} className={`w-full rounded-xl py-3 font-semibold text-background ${tradingUnlocked ? orderSide === "buy" ? "bg-primary" : "bg-danger" : "cursor-not-allowed bg-muted/30 text-muted"}`}>{tradingUnlocked ? `${orderSide === "buy" ? "Buy" : "Sell"} ${selectedOrderQuantityLabel} ${orderType.toUpperCase()}` : currentBrokerConnection.connectionState === "connected" ? "Order routing unavailable" : "Connect Your Broker To Trade"}</button>
              {orderTicketMessage && <div className={`mt-2 rounded-xl border px-3 py-2 text-[11px] ${orderTicketMessage.tone === "success" ? "border-primary/25 bg-primary/10 text-primary" : "border-danger/25 bg-danger/10 text-danger"}`}>{orderTicketMessage.text}</div>}
              {selectedPaperOpenPositions.length > 0 && <div className="mt-4 space-y-2"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Open positions</div><button onClick={handleFlattenPaperAccount} className="rounded-md border border-danger/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-danger hover:bg-danger/10">Flatten all</button></div>{selectedPaperOpenPositions.map((position) => <div key={position.id} className="rounded-xl border border-border bg-background/40 p-3"><div className="flex items-center justify-between"><span className="text-[12px] font-semibold">{position.side === "buy" ? "Long" : "Short"} {position.remainingQuantity} {position.symbol}</span><span className={`font-mono text-[11px] ${position.unrealizedPnl >= 0 ? "text-primary" : "text-danger"}`}>{formatDollar(position.unrealizedPnl)}</span></div><div className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>Entry {formatPrice(position.entryPrice, position.symbol)}</span><span>Mark {formatPrice(position.markPrice, position.symbol)}</span></div><div className="mt-1 flex justify-between font-mono text-[9px] text-muted"><span>{position.stopLoss == null ? "SL not set" : `SL ${formatPrice(position.stopLoss, position.symbol)}`}</span><span>{position.takeProfits.filter((target) => target.quantity > target.filledQuantity).length} active TP</span></div><div className="mt-2 flex gap-2"><button onClick={() => handleFlattenPaperPosition(position)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-danger/25 px-2 py-1.5 text-[10px] font-semibold text-danger hover:bg-danger/10"><X className="h-3 w-3" /> Close position</button></div></div>)}</div>}
              {selectedPaperWorkingOrders.length > 0 && <div className="mt-4 space-y-2"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Working orders</div>{selectedPaperWorkingOrders.map((order) => <div key={order.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3"><div><div className="text-[11px] font-semibold">{order.side.toUpperCase()} {order.quantity} {order.symbol}</div><div className="font-mono text-[10px] text-muted">{order.type.toUpperCase()} {order.price ? formatPrice(order.price, order.symbol) : "MARKET"}</div></div><button onClick={() => handleCancelPaperOrder(order.accountId, order.id)} className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted hover:text-danger">Cancel</button></div>)}</div>}
              {selectedPaperRecentFills.length > 0 && <div className="mt-4 space-y-2"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Recent fills</div>{selectedPaperRecentFills.slice(0, 5).map((fill) => <div key={fill.id} className="flex items-center justify-between text-[10px]"><span>{fill.side.toUpperCase()} {fill.quantity} {fill.symbol}</span><span className="font-mono text-muted">{formatPrice(fill.price, fill.symbol)}</span></div>)}</div>}
              {!tradingUnlocked && (
                <button onClick={() => setShowBrokerModal(true)} className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted transition-colors hover:text-foreground">
                  Link Your Own Broker
                </button>
              )}
            </div>
          )}
          {rightPanel === "watchlist" && (
            <div
              className="flex min-w-0 flex-1 flex-col overflow-hidden"
              onContextMenu={(event) => {
                if (event.defaultPrevented) return;
                event.preventDefault();
                setWatchlistContextMenu(null);
                setSectionContextMenu(null);
                setWatchlistPanelContextMenu({
                  x: Math.max(12, Math.min(event.clientX, window.innerWidth - 224)),
                  y: Math.max(12, Math.min(event.clientY, window.innerHeight - 240)),
                });
              }}
            >
              <div className="flex h-14 min-w-[340px] shrink-0 items-center justify-between border-b border-border px-4">
                <button className="flex items-center gap-1 text-[14px] font-semibold">Watchlist <ChevronDown className="h-3.5 w-3.5 text-muted" /></button>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowInstrumentSearch(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Grid3X3 className="h-3.5 w-3.5" /></button>
                  <button
                    onClick={(event) => {
                      const bounds = event.currentTarget.getBoundingClientRect();
                      setWatchlistContextMenu(null);
                      setSectionContextMenu(null);
                      setWatchlistPanelContextMenu({
                        x: Math.max(12, bounds.right - 208),
                        y: bounds.bottom + 6,
                      });
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
                    aria-label="Watchlist options"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid min-w-[340px] grid-cols-[minmax(92px,1fr)_74px_54px_54px] gap-2 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted"><span>Symbol</span><span className="text-right">Last</span><span className="text-right">Chg</span><span className="text-right">Chg%</span></div>
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                {watchlistSections.map((section) => {
                  const symbols = sortSectionSymbols(section.symbols).filter((symbol) => (
                    bottomWorkspaceSection !== "liqmap"
                    || Boolean(liquidityMapInstrument(watchlistBySymbol.get(symbol)?.symbol || symbol))
                  ));
                  const sectionDropTarget = watchlistDropTarget?.sectionId === section.id && !watchlistDropTarget.symbol;
                  return (
                    <div key={section.id}>
                      <div
                        className={`flex items-center justify-between border-t-2 px-3 py-2 ${sectionDropTarget ? "border-blue-500" : "border-transparent"}`}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setWatchlistPanelContextMenu(null);
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
          {rightPanel === "gex" && (
            <LiveGexPanelBoundary
              resetKey={`${activeWorkspacePane.symbol}:${liveGexSnapshot?.checkedAt ?? "pending"}`}
              onClose={() => setRightPanel(null)}
            >
              <LiveGexPanel
                snapshot={liveGexSnapshot}
                loading={liveGexLoading}
                error={liveGexError}
                releaseState={liveGexError
                  ? "RELEASED"
                  : liveGexSnapshot?.positioning
                    ? "RELEASED"
                    : liveGexSnapshot?.marketOpen ? "OPENING" : "PREOPEN"}
                sessionDate={liveGexSnapshot?.sessionDate ?? "Current session"}
                variant="live"
                onClose={() => setRightPanel(null)}
              />
            </LiveGexPanelBoundary>
          )}
          {rightPanel === "kwantbot" && (
            <KwantBotInterpreterPanel interpreter={kwantBotInterpreter} />
          )}
          {rightPanel === "zyon" && (
            <ZyonPanelBoundary
              resetKey={`${preferenceUserId || "anonymous"}:${activeWorkspacePane.symbol}`}
              onClose={() => setRightPanel(null)}
            >
              <ZyonWorkspace
                interpreter={kwantBotInterpreter}
                compact
                viewerName={currentDisplayName || currentUsername}
                accountKey={preferenceUserId}
              />
            </ZyonPanelBoundary>
          )}
          {rightPanel === "optionstape" && (
            <OptionsTapePanel interpreter={kwantBotInterpreter} />
          )}
          {false && rightPanel === "kwantbot" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="relative h-[138px] shrink-0 overflow-hidden border-b border-border bg-background/45 px-4 py-4">
                <div className="pointer-events-none absolute -right-8 -top-14 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <div className="relative z-10 flex h-full items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-primary">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                      Chat
                    </div>
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">Kwant Bot</h3>
                    <p className="mt-1 max-w-[145px] text-[10px] leading-4 text-muted">Messages, screenshots, photos, and research files.</p>
                  </div>
                  <KwantBotAvatar />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_68%,transparent),var(--panel))] px-3 py-4">
                <div className="flex min-h-full flex-col justify-end">
                  <div className="mb-4 flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.12em] text-muted/70">
                    <span className="h-px flex-1 bg-border" />
                    Today
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-4">
                    {kwantBotMessages.map((message, index) => {
                      const newest = index === kwantBotMessages.length - 1;
                      if (message.sender === "user") {
                        return (
                          <div key={message.id} className="kwantbot-message-out flex justify-end">
                            <div className="min-w-0 max-w-[84%]">
                              <div className="mb-1 flex items-center justify-end gap-2 px-1">
                                <span className="text-[9px] text-muted">{formatKwantBotMessageTime(message.receivedAt)}</span>
                                <span className="text-[10px] font-semibold text-foreground">You</span>
                              </div>
                              <div className="relative rounded-[18px] rounded-br-[6px] border border-primary/30 bg-primary px-3.5 py-2.5 text-background shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                                <span
                                  aria-hidden="true"
                                  className="absolute -right-[5px] bottom-0 h-3 w-3 bg-primary [clip-path:polygon(0_0,100%_100%,0_100%)]"
                                />
                                {message.attachments?.length ? (
                                  <div className={message.text ? "mb-2" : ""}>
                                    <KwantBotAttachments attachments={message.attachments} />
                                  </div>
                                ) : null}
                                {message.text ? <p className="relative whitespace-pre-wrap text-[12px] leading-[1.55]">{message.text}</p> : null}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={message.id} className="kwantbot-message-in flex items-end gap-2">
                          <KwantBotAvatar compact speaking={newest} />
                          <div className="min-w-0 max-w-[calc(100%-44px)]">
                            <div className="mb-1 flex items-center gap-2 px-1">
                              <span className="text-[10px] font-semibold text-foreground">Kwant Bot</span>
                              <span className="text-[9px] text-muted">{formatKwantBotMessageTime(message.receivedAt)}</span>
                            </div>
                            <div className="relative rounded-[18px] rounded-bl-[6px] border border-border/80 bg-surface px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                              <span
                                aria-hidden="true"
                                className="absolute -left-[5px] bottom-0 h-3 w-3 bg-surface [clip-path:polygon(100%_0,100%_100%,0_100%)]"
                              />
                              {message.attachments?.length ? (
                                <div className={message.text ? "mb-2" : ""}>
                                  <KwantBotAttachments attachments={message.attachments} />
                                </div>
                              ) : null}
                              {message.text ? <p className="relative whitespace-pre-wrap text-[12px] leading-[1.55] text-foreground">{message.text}</p> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {kwantBotReplying ? (
                      <div className="kwantbot-message-in flex items-end gap-2" aria-live="polite">
                        <KwantBotAvatar compact speaking />
                        <div className="min-w-0">
                          <div className="mb-1 px-1 text-[10px] font-semibold text-foreground">Kwant Bot</div>
                          <div className="relative flex h-10 items-center gap-1 rounded-[18px] rounded-bl-[6px] border border-border/80 bg-surface px-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[5px] bottom-0 h-3 w-3 bg-surface [clip-path:polygon(100%_0,100%_100%,0_100%)]"
                            />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-240ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-120ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                            <span className="sr-only">Kwant Bot is typing</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div ref={kwantBotMessagesEndRef} />
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-panel p-2">
                {kwantBotDraftAttachments.length ? (
                  <div className="mb-2">
                    <KwantBotAttachments
                      attachments={kwantBotDraftAttachments}
                      compact
                      onRemove={(id) => setKwantBotDraftAttachments((current) => current.filter((attachment) => attachment.id !== id))}
                    />
                  </div>
                ) : null}
                {kwantBotAttachmentError ? <div className="mb-1.5 px-2 text-[9px] text-danger">{kwantBotAttachmentError}</div> : null}
                {kwantBotSendError ? (
                  <div className="mb-1.5 rounded-lg border border-danger/20 bg-danger/8 px-2.5 py-2 text-[10px] leading-4 text-danger" role="alert">
                    {kwantBotSendError}
                  </div>
                ) : null}
                <div className="flex items-end gap-1.5 rounded-[18px] border border-border bg-surface p-1.5 transition-colors focus-within:border-primary/50">
                  <input
                    ref={kwantBotAttachmentInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.csv,.json,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(event) => void handleKwantBotAttachments(event.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => kwantBotAttachmentInputRef.current?.click()}
                    disabled={kwantBotAttaching}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background/60 hover:text-primary disabled:opacity-45"
                    title="Attach photos or files"
                    aria-label="Attach photos or files"
                  >
                    {kwantBotAttaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <textarea
                    ref={kwantBotComposerRef}
                    value={kwantBotDraft}
                    onChange={(event) => setKwantBotDraft(event.target.value.slice(0, 4_000))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void handleSendKwantBotMessage();
                      }
                    }}
                    rows={1}
                    placeholder="Message Kwant Bot"
                    aria-label="Message Kwant Bot"
                    className="max-h-24 min-h-8 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-[12px] leading-5 text-foreground outline-none placeholder:text-muted/65"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendKwantBotMessage()}
                    disabled={kwantBotAttaching || kwantBotReplying || (!kwantBotDraft.trim() && !kwantBotDraftAttachments.length)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-background shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_24%,transparent)] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
                    title={kwantBotReplying ? "Kwant Bot is replying" : "Send message"}
                    aria-label={kwantBotReplying ? "Kwant Bot is replying" : "Send message"}
                  >
                    {kwantBotReplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 px-2 text-[9px] text-muted/75">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_7px_var(--primary)]" />
                  Enter to send · Shift+Enter for a new line
                </div>
              </div>
            </div>
          )}
          {rightPanel === "alerts" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold">Alerts</h3>
                  {socialNotifications.unreadCount > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-background">
                      {Math.min(99, socialNotifications.unreadCount)}
                    </span>
                  ) : null}
                </div>
                {alertsPanelTab === "market" ? (
                  <button onClick={() => openCreateAlert()} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" title="Create market alert">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="grid h-10 shrink-0 grid-cols-2 gap-1 border-b border-border bg-background/25 p-1">
                <button
                  type="button"
                  onClick={() => setAlertsPanelTab("social")}
                  className={`relative rounded-lg text-[8px] font-semibold transition-colors ${
                    alertsPanelTab === "social" ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  Social
                  {socialNotifications.unreadCount > 0 ? (
                    <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setAlertsPanelTab("market")}
                  className={`rounded-lg text-[8px] font-semibold transition-colors ${
                    alertsPanelTab === "market" ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  Market alerts
                </button>
              </div>
              {alertsPanelTab === "social" ? (
                <SocialNotificationsPanel
                  items={socialNotifications.items}
                  configured={socialNotifications.configured}
                  loading={socialNotifications.loading}
                  loadingMore={socialNotifications.loadingMore}
                  error={socialNotifications.error}
                  nextOffset={socialNotifications.nextOffset}
                  onLoadMore={() => void socialNotifications.loadMore()}
                  onMarkAllRead={() => void socialNotifications.markAllRead()}
                  onOpen={(item) => {
                    void socialNotifications.markRead([item.id]);
                    setRightPanel(null);
                    if (item.sourceHandle) router.push(`/socials/${encodeURIComponent(item.sourceHandle)}`);
                    else router.push("/socials");
                  }}
                />
              ) : (
                <>
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
                                      <div className="text-[13px] text-foreground">{displayCmeText(alert.conditionLabel)}</div>
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
                      ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">No alerts for {displayCmeSymbol(selectedInstrument)}. Create one from the chart or press +.</div>
                    ) : <div className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted">Choose a market to create an alert.</div>}
                  </div>
                  <div className="border-t border-border p-4"><button onClick={() => { window.location.href = "/alerts"; }} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] text-muted hover:text-foreground">Manage Market Alerts</button></div>
                </>
              )}
            </div>
          )}
          {rightPanel === "alertslog" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
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
      <div className={`relative z-40 w-[44px] shrink-0 flex-col items-center gap-2 border-l border-border bg-panel py-3 ${bottomWorkspaceSection === "backtesting" ? "hidden" : "flex"}`}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-14 z-10 h-px -translate-y-px bg-border" />
        {!rightPanel && (
          <button
            title={`Reopen ${
              lastOpenRightPanel === "alertslog"
                ? "Alerts Log"
                : lastOpenRightPanel === "gex"
                  ? "Live GEX"
                : lastOpenRightPanel === "zyon"
                  ? "ZYON"
                : lastOpenRightPanel === "kwantbot"
                  ? "Kwant Bot"
                  : lastOpenRightPanel === "optionstape"
                    ? "Options Tape"
                  : lastOpenRightPanel === "friends"
                    ? "Friends"
                  : lastOpenRightPanel === "messages"
                    ? "Messages"
                  : lastOpenRightPanel.charAt(0).toUpperCase() + lastOpenRightPanel.slice(1)
            }`}
            onClick={reopenRightPanel}
            className="absolute -left-3 top-1/2 z-20 flex h-12 w-3 -translate-y-1/2 items-center justify-center rounded-l-full border border-r-0 border-border bg-panel text-muted shadow-lg transition-colors hover:bg-surface hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
        )}
        {[
          { id: "watchlist" as const, title: "Watchlist", icon: List },
          { id: "order" as const, title: "Trade", icon: BarChart3 },
          { id: "gex" as const, title: "Live GEX", icon: Layers3 },
          { id: "zyon" as const, title: "ZYON", icon: Sparkles },
          { id: "kwantbot" as const, title: "Kwant Bot", icon: Bot },
          { id: "optionstape" as const, title: "Options Tape", icon: FileText },
          { id: "friends" as const, title: "Friends", icon: UsersRound },
          { id: "messages" as const, title: "Messages", icon: MessageCircle },
        ].map((item) => {
          const Icon = item.icon;
          const active = rightPanel === item.id;
          return (
            <button
              key={item.id}
              title={item.id === "friends"
                ? `${friendsOnlineCount} friends online`
                : item.id === "messages"
                  ? `${friendMessageUnreadCount} unread messages`
                  : item.title}
              onPointerEnter={() => {
                if (item.id === "zyon") warmWorkspaceSection("zyon");
              }}
              onFocus={() => {
                if (item.id === "zyon") warmWorkspaceSection("zyon");
              }}
              onClick={() => toggleRightPanel(item.id)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.id === "kwantbot" && kwantBotInterpreter.unreadTotal > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-background">{Math.min(99, kwantBotInterpreter.unreadTotal)}</span>}
              {item.id === "optionstape" && kwantBotInterpreter.optionsUnreadTotal > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-background">{Math.min(99, kwantBotInterpreter.optionsUnreadTotal)}</span>}
              {item.id === "friends" && friendsOnlineCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[9px] font-semibold text-background shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_45%,transparent)]" aria-label={`${friendsOnlineCount} friends online`}>{Math.min(99, friendsOnlineCount)}</span>}
              {item.id === "friends" && friendsUnreadCount > 0 && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-danger" aria-label={`${friendsUnreadCount} unread friend notifications`} />}
              {item.id === "messages" && friendMessageUnreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[9px] font-semibold text-background shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_45%,transparent)]" aria-label={`${friendMessageUnreadCount} unread messages`}>{Math.min(99, friendMessageUnreadCount)}</span>}
            </button>
          );
        })}
      </div>

      {friendMessageToast && (
        <div className="fixed bottom-6 right-[60px] z-[80] flex w-[min(360px,calc(100vw-84px))] items-center gap-2 rounded-2xl border border-primary/25 bg-panel/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45),0_0_28px_color-mix(in_srgb,var(--primary)_12%,transparent)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              setFriendsInitialFriendId(friendMessageToast.senderUserId);
              setRightPanel("messages");
              setFriendMessageToast(null);
              if (friendMessageToastTimeoutRef.current) window.clearTimeout(friendMessageToastTimeoutRef.current);
              friendMessageToastTimeoutRef.current = null;
            }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface"
          >
            <UserAvatar
              avatarUrl={friendMessageToast.avatarUrl}
              label={friendMessageToast.senderName}
              className="h-10 w-10 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[12px] font-semibold text-foreground">{friendMessageToast.senderName}</span>
                {friendMessageToast.senderHandle && <span className="truncate text-[10px] text-muted">@{friendMessageToast.senderHandle}</span>}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">{friendMessageToast.preview}</span>
            </span>
          </button>
          <button
            type="button"
            title="Dismiss message notification"
            onClick={() => {
              setFriendMessageToast(null);
              if (friendMessageToastTimeoutRef.current) window.clearTimeout(friendMessageToastTimeoutRef.current);
              friendMessageToastTimeoutRef.current = null;
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
                          <KwantSelect
                            value={String(brokerConnections[selectedBroker.name]?.accountId ?? selectedBrokerPaperAccounts[0]?.id ?? "")}
                            onChange={(event) => selectPaperTradingAccount(event.target.value)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary/40"
                          >
                            {selectedBrokerPaperAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {`${account.name} - ${account.balance} - ${account.leverage}`}
                              </option>
                            ))}
                          </KwantSelect>
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
                            <KwantSelect value={paperAccountBalance} onChange={(event) => setPaperAccountBalance(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>$1,000</option><option>$5,000</option><option>$10,000</option><option>$25,000</option><option>$50,000</option><option>$100,000</option>
                            </KwantSelect>
                            <KwantSelect value={paperAccountLeverage} onChange={(event) => setPaperAccountLeverage(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>1:1</option><option>1:10</option><option>1:30</option><option>1:50</option><option>1:100</option><option>1:200</option><option>1:500</option>
                            </KwantSelect>
                            <KwantSelect value={paperAccountInstrument} onChange={(event) => setPaperAccountInstrument(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>All CME Futures</option><option>NQ / MNQ</option><option>ES / MES</option><option>RTY / M2K</option><option>YM / MYM</option><option>GC / MGC</option><option>CL / MCL</option><option>BTC / MBT</option><option>ETH / MET</option>
                            </KwantSelect>
                            <KwantSelect value={paperAccountStrategy} onChange={(event) => setPaperAccountStrategy(event.target.value)} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                              <option>Manual / No Strategy</option>
                              {strategies.map((strategy) => <option key={strategy.id} value={strategy.name}>{strategy.name}</option>)}
                            </KwantSelect>
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
                          <KwantSelect
                            value={brokerConnections[selectedBroker.name]?.accountId ?? selectedBrokerAccounts[0]?.accountId ?? ""}
                            onChange={(event) => selectBrokerAccount(selectedBroker.name, Number(event.target.value))}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary/40"
                          >
                            {selectedBrokerAccounts.map((account) => (
                              <option key={account.accountId} value={account.accountId}>
                                {formatCTraderAccountLabel(account)}
                              </option>
                            ))}
                          </KwantSelect>
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

      {watchlistPanelContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setWatchlistPanelContextMenu(null)} />
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="fixed z-50 w-[208px] rounded-xl border border-border bg-panel py-1.5 shadow-2xl"
            style={{ left: watchlistPanelContextMenu.x, top: watchlistPanelContextMenu.y }}
          >
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
                setWatchlistPanelContextMenu(null);
                setShowInstrumentSearch(true);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <Plus className="h-4 w-4 text-muted" />
              <span>Add instrument</span>
            </button>
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
                addWatchlistSection();
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <FolderPlus className="h-4 w-4 text-muted" />
              <span>Add section</span>
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
                setCollapsedWatchlistSections(
                  Object.fromEntries(watchlistSections.map((section) => [section.id, true])),
                );
                setWatchlistPanelContextMenu(null);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <ChevronUp className="h-4 w-4 text-muted" />
              <span>Collapse all sections</span>
            </button>
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
                setCollapsedWatchlistSections({});
                setWatchlistPanelContextMenu(null);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface"
            >
              <ChevronDown className="h-4 w-4 text-muted" />
              <span>Expand all sections</span>
            </button>
            <button
              type="button"
              disabled={Object.keys(watchlistFlags).length === 0}
              onMouseDown={(event) => {
                event.stopPropagation();
                setWatchlistFlags({});
                setWatchlistPanelContextMenu(null);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-muted hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Settings2 className="h-4 w-4" />
              <span>Clear all flags</span>
            </button>
          </div>
        </>
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
        displayInstrument={displayCmeSymbol(selectedInstrument)}
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
                  Are you sure you want to delete <span className="font-medium text-foreground">{displayCmeText(pendingAlertDelete.conditionLabel)}</span>? This will remove the alert from your chart.
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
      {draggedWorkspacePaneId && typeof document !== "undefined" ? createPortal(
        <div
          ref={workspaceDragGhostRef}
          className="pointer-events-none fixed left-0 top-0 z-[500] flex h-9 max-w-[240px] items-center gap-2 border border-primary/65 bg-panel/95 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground shadow-[0_14px_45px_rgba(0,0,0,0.62),0_0_24px_color-mix(in_srgb,var(--primary)_24%,transparent)] backdrop-blur"
          style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
        >
          <Grid3X3 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">
            {WORKSPACE_PANEL_OPTIONS.find((option) => option.id === workspacePanes.find((pane) => pane.id === draggedWorkspacePaneId)?.content)?.label ?? "CHARTS"}
          </span>
          <span className="ml-auto text-[7px] text-primary">SNAP</span>
        </div>,
        document.body,
      ) : null}
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
                <label className="block space-y-1.5"><span className="text-[12px] text-muted">Base Currency</span><KwantSelect value={backtestSettingsDraft.baseCurrency} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, baseCurrency: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{["USD", "EUR", "GBP", "AUD", "JPY"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}</KwantSelect></label>
                <div className="grid grid-cols-[1fr_120px] gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Order Size</span><KwantSelect value={backtestSettingsDraft.orderSizeType} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, orderSizeType: e.target.value, orderSizeValue: e.target.value === "percent_equity" ? 10 : e.target.value === "fixed_quantity" ? 1 : 1000 }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="percent_equity">% of Equity</option><option value="fixed_quantity">Fixed Quantity</option><option value="fixed_usd">Fixed USD</option></KwantSelect></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">Value</span><input type="number" value={backtestSettingsDraft.orderSizeValue} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, orderSizeValue: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label></div>
                <div className="grid grid-cols-[1fr_120px] gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Commission</span><KwantSelect value={backtestSettingsDraft.commissionType} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, commissionType: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="percent">% of Position</option><option value="fixed_contract">Fixed per Contract</option><option value="fixed_order">Fixed per Order</option></KwantSelect></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">Value</span><input type="number" step="0.01" value={backtestSettingsDraft.commissionValue} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, commissionValue: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label></div>
                <div className="grid grid-cols-2 gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Margin Long (%)</span><input type="number" value={backtestSettingsDraft.marginLong} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, marginLong: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">Margin Short (%)</span><input type="number" value={backtestSettingsDraft.marginShort} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, marginShort: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[13px] outline-none" /></label></div>
                <label className="block space-y-1.5"><span className="text-[12px] text-muted">Fill Orders</span><KwantSelect value={backtestSettingsDraft.fillOrders} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, fillOrders: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="next_bar_open">On Next Bar Open</option><option value="bar_close">On Bar Close</option></KwantSelect></label>
                <div className="grid grid-cols-3 gap-3"><label className="block space-y-1.5"><span className="text-[12px] text-muted">Date Range</span><KwantSelect value={backtestSettingsDraft.datePreset} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, datePreset: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="365d">Last 365 days</option><option value="all">All available</option></KwantSelect></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">From</span><input type="date" value={backtestSettingsDraft.dateFrom} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, dateFrom: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px] outline-none" /></label><label className="block space-y-1.5"><span className="text-[12px] text-muted">To</span><input type="date" value={backtestSettingsDraft.dateTo} onChange={(e) => setBacktestSettingsDraft((current) => ({ ...current, dateTo: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px] outline-none" /></label></div>
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
                    <section className="space-y-3"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Data</h3><TimeZoneSelect value={draftChartSettings.timezone} onChange={(timeZone) => setDraftChartSettings((current) => ({ ...current, timezone: timeZone }))} menuLabel="Chart timezone" /><KwantSelect value={draftChartSettings.precision} onChange={(event) => setDraftChartSettings((current) => ({ ...current, precision: event.target.value }))} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"><option>Default</option><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></KwantSelect></section>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => {
            setShowInstrumentSearch(false);
            setInstrumentSearch("");
          }}
        >
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
                          {displayMarketSource(entry.broker)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[14px] font-medium text-foreground">{displayCmeSymbol(entry.symbol)}</span>
                          {currentCmeContract(entry.symbol) ? (
                            <span className="shrink-0 font-mono text-[9px] text-muted">{currentCmeContract(entry.symbol)}</span>
                          ) : null}
                        </div>
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
    </div>
  );
}
