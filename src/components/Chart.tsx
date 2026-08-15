"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesPrimitive,
  type ISeriesPrimitivePaneRenderer,
  type ISeriesPrimitivePaneView,
  type SeriesAttachedParameter,
  type Time,
} from "@/lib/lightweightChartsCompat";
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowDown,
  ArrowUp,
  Bell,
  Brush,
  Calculator,
  ChartColumnIncreasing,
  Circle,
  Copy,
  Crosshair,
  Dot,
  Eraser,
  Eye,
  Flag,
  Frown,
  Highlighter,
  Image as ImageIcon,
  Info,
  KanbanSquare,
  Layers3,
  Link2,
  Lock,
  Magnet,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoveHorizontal,
  MoveVertical,
  MousePointer2,
  Paintbrush2,
  PencilLine,
  PenLine,
  Pin,
  Plus,
  Radar,
  RectangleHorizontal,
  Redo2,
  RotateCcw,
  Ruler,
  ScanLine,
  Settings2,
  Shapes,
  ShoppingCart,
  Slash,
  SmilePlus,
  Square,
  Sparkles,
  Star,
  StickyNote,
  Table2,
  Tag,
  Trash2,
  Type,
  Undo2,
  Waypoints,
  Waves,
  X,
} from "lucide-react";
import { Candle, Trade } from "@/lib/backtester";
import {
  DATABENTO_LIVE_TICK_EVENT,
  LIVE_CHART_CANDLE_EVENT,
  mergeLiveIndicatorCandle,
  type DatabentoLiveTick,
  type LiveChartCandleDetail,
} from "@/lib/chartLiveEvents";
import {
  CHART_INDICATOR_BY_ID,
  type ChartIndicatorInstance,
} from "@/lib/chartIndicatorCatalog";
import {
  calculateDeltaPercentHighlights,
  calculateIndicatorSeries,
  type CalculatedIndicatorSeries,
} from "@/lib/chartIndicatorEngine";
import ChartIndicatorPanes, {
  type IndicatorPaneDock,
  type IndicatorPaneGroup,
  type IndicatorPaneLayoutMap,
} from "@/components/ChartIndicatorPanes";
import DepthOfMarketPanel from "@/components/DepthOfMarketPanel";
import GexBotFlowStrip from "@/components/GexBotFlowStrip";
import KwantLoader from "@/components/KwantLoader";
import {
  anchorBigTradePrintsToCandles,
  calculateBigTradePrints,
  type AnchoredBigTradePrint,
} from "@/lib/bigTrades";
import {
  BigTradesPrimitive,
  type BigTradePrimitiveMarker,
  type BigTradesPrimitiveOptions,
} from "@/lib/bigTradesPrimitive";
import {
  BigBlocksPrimitive,
  type BigBlockRenderZone,
} from "@/lib/bigBlocksPrimitive";
import {
  buildFootprintBars,
  type FootprintImbalanceMode,
} from "@/lib/footprint";
import {
  FootprintPrimitive,
  type FootprintPrimitiveOptions,
  type FootprintRenderBar,
} from "@/lib/footprintPrimitive";
import { retainLiveFootprintRows } from "@/lib/footprintLive";
import { FOOTPRINT_DATA_REFRESH_INTERVAL_MS, ORDER_FLOW_DATA_REFRESH_INTERVAL_MS } from "@/lib/footprintRuntime";
import { calculateDeepEffort } from "@/lib/deepEffort";
import { calculateImbalanceRejectorSignals } from "@/lib/imbalanceRejector";
import { calculateImbalanceZones } from "@/lib/imbalanceTracker";
import {
  fetchInstitutionalSnapshot,
  isExecutionBackedVolumeProfile,
  type InstitutionalTrade,
  type InstitutionalVolumeProfile,
} from "@/lib/institutionalMarketData";
import {
  NativeVolumeProfilePrimitive,
  type NativeVolumeProfileModel,
} from "@/lib/nativeVolumeProfilePrimitive";
import { buildTpoProfiles } from "@/lib/tpo/engine";
import { tpoCalculationSettingsKey, validateTpoSettings } from "@/lib/tpo/settings";
import { TpoProfilePrimitive, type TpoPrimitiveModel } from "@/lib/tpo/primitive";
import type { TpoBar, TpoMergeRecord, TpoProfileModel, TpoTrade } from "@/lib/tpo/types";
import {
  ClassicGexProfilePrimitive,
  type ClassicGexPrimitiveData,
} from "@/lib/classicGexProfilePrimitive";
import {
  GammaHeatmapPrimitive,
  type GammaHeatmapHit,
  type GammaHeatmapPrimitiveData,
} from "@/lib/gammaHeatmapPrimitive";
import {
  defaultGammaHeatmapSource,
  isGammaHeatmapPayload,
  normalizeGammaHeatmapInstrument,
  type GammaHeatmapPayload,
  type GammaHeatmapViewMode,
} from "@/lib/gammaHeatmap";
import {
  NetGammaExposurePrimitive,
  type NetGammaExposureHit,
  type NetGammaExposurePrimitiveData,
} from "@/lib/netGammaExposurePrimitive";
import {
  buildNetGammaChangeSnapshot,
  defaultNetGammaSource,
  formatGammaValue,
  isNetGammaProfileSnapshot,
  type GammaBarVisualMode,
  type GammaProfileContentMode,
  type GammaProfilePlacement,
  type GammaScaleMode,
  type GammaScaleTransform,
  type MappedStrikeAggregationMode,
  type NetGammaProfileSnapshot,
} from "@/lib/netGammaExposureByStrike";
import {
  defaultDarkPoolSource,
  isDarkPoolMapPayload,
  normalizeDarkPoolInstrument,
  type DarkPoolMapPayload,
  type DarkPoolVisualMode,
} from "@/lib/darkPoolMap";
import {
  DarkPoolMapPrimitive,
  type DarkPoolMapHit,
  type DarkPoolMapPrimitiveData,
} from "@/lib/darkPoolMapPrimitive";
import { fetchWorkspaceData } from "@/lib/workspaceDataCache";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";
import {
  buildMarketSessionWindows,
  buildPreviousSessionHighLowLevels,
} from "@/lib/marketSessions";
import { calculateKwantStats } from "@/lib/kwantStats";
import { defaultChartSettings, type ChartSettings } from "@/lib/chartSettings";
import {
  DrawingManager,
  configureProfessionalDrawingMarketData,
  createProfessionalDrawing,
  drawingFromSerialized,
  isProfessionalDrawingTool,
  normalizeProfessionalDrawings,
  professionalDrawingType,
  professionalToolbarTool,
  requiredProfessionalAnchors,
  type Anchor as ProfessionalDrawingAnchor,
  type IDrawing as ProfessionalDrawing,
  type SerializedDrawing as ProfessionalDrawingRecord,
  type KwantMarketDataSource,
} from "@/lib/professionalDrawingEngine";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";
import { compactTimeZoneLabel, normalizeTimeZone } from "@/lib/timeZones";
import { resolveChartLevelOverlaps } from "@/lib/chartLevelOverlap";
import type {
  ClassicGexHistorySnapshot,
  ClassicGexProfilePayload,
  ClassicGexProfileRow,
} from "@/lib/classicGexProfile";
import {
  applyTpoDisplayCap,
  type TpoLevelsPayload,
  type TpoZone,
} from "@/lib/tpoLevels";
import type { ChartGammaCalibration } from "@/lib/chartGammaConversion";
import { isOptionsFuturesRatioSane } from "@/lib/optionsFlow";
import type { GexBotFlowPayload } from "@/lib/gexBotFlow";
import {
  normalizePaperSymbol,
  paperContractSpec,
  paperFillCandleTimestamp,
  paperProjectedPnl,
  snapPaperPrice,
  type PaperProtectionUpdate,
  type PaperPosition,
  type PaperTradeFill,
} from "@/lib/paperTrading";
import {
  EXPECTED_MOVE_SEMANTICS,
  buildExpectedMoveBand,
  expectedMoveLabel,
  expectedMoveSigmaRails,
  isExpectedMoveCalibrationUsable,
  staleExpectedMovePayload,
  type ExpectedMoveApiPayload,
  type ExpectedMoveBand,
  type ExpectedMoveSourceSymbol,
} from "@/lib/expectedMove";
import {
  hedgeFreshnessPill,
  hedgeLevelMovement,
  renderableHedgeLevels,
  staggerHedgeLabels,
  staleHedgeLevelsPayload,
  type HedgeChartLevel,
  type HedgeLevelsPayload,
} from "@/lib/hedgeLevels";
import PrecisionToolsLayer from "@/chart/precision-tools/PrecisionToolsLayer";
import PrecisionToolsBoundary from "@/chart/precision-tools/PrecisionToolsBoundary";
import type { PrecisionChartAdapter, PrecisionTheme, PrecisionToolId } from "@/chart/precision-tools/types";
import { claimChartInteraction, subscribeChartInteractionOwner } from "@/lib/chartInteractionArbiter";
import {
  calculateSmtDivergences,
  comparisonSmtMarket,
  resolveSmtMarket,
  type SmtDivergenceSettings,
} from "@/lib/smtDivergence";
import {
  SmtDivergencePrimitive,
  type SmtDivergencePrimitiveOptions,
} from "@/lib/smtDivergencePrimitive";
import {
  CHART_CROSSHAIR_SYNC_MOVE_EVENT,
  CHART_CROSSHAIR_SYNC_TOGGLE_EVENT,
  chartCrosshairInstrumentKey,
  readChartCrosshairSyncEnabled,
  resolveSyncedChartTime,
  saveChartCrosshairSyncEnabled,
  type ChartCrosshairSyncMove,
} from "@/lib/chartCrosshairSync";

interface ChartProps {
  candles: Candle[];
  marketTrades?: InstitutionalTrade[];
  trades?: (Trade & { markerVisible?: boolean })[];
  levels?: ChartLevel[];
  zones?: ChartZone[];
  backgroundLevels?: ChartLevel[];
  backgroundZones?: ChartZone[];
  instrument?: string;
  chartInstanceId?: string;
  keyboardActive?: boolean;
  workspaceId?: string;
  contractSymbol?: string | null;
  timeframe?: string;
  marketIsActive?: boolean;
  orderFlowHistoryReady?: boolean;
  onOpenSettings?: () => void;
  onCreateAlertAtPrice?: (price: string) => void;
  onRemoveAllIndicators?: () => void;
  indicators?: ChartIndicatorInstance[];
  classicGexProfile?: ClassicGexProfilePayload | null;
  classicGexHistory?: ClassicGexHistorySnapshot[];
  classicGexLoading?: boolean;
  classicGexError?: string | null;
  expectedMoveCalibration?: ChartGammaCalibration | null;
  volumeProfiles?: InstitutionalVolumeProfile[];
  onUpdateIndicatorSetting?: (instanceId: string, key: string, value: number | string | boolean) => void;
  onOpenIndicatorSettings?: (instanceId: string) => void;
  settings?: ChartSettings;
  toolbarEnabled?: boolean;
  chartDragEnabled?: boolean;
  onChartDragStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  gammaLevelsEnabled?: boolean;
  gammaLevelsAvailable?: boolean;
  gammaLevelsLoading?: boolean;
  gammaLevelsError?: string | null;
  onToggleGammaLevels?: () => void;
  kwantLevelsEnabled?: boolean;
  kwantLevelsAvailable?: boolean;
  kwantLevelsLoading?: boolean;
  onToggleKwantLevels?: () => void;
  historicalStructureEnabled?: boolean;
  historicalStructureAvailable?: boolean;
  historicalStructureLoading?: boolean;
  historicalStructureError?: string | null;
  historicalStructureDescription?: string;
  onToggleHistoricalStructure?: () => void;
  valueAreaLevelsEnabled?: boolean;
  valueAreaLevelsAvailable?: boolean;
  valueAreaLevelsLoading?: boolean;
  valueAreaLevelsError?: string | null;
  valueAreaLevelsDescription?: string;
  onToggleValueAreaLevels?: () => void;
  onRemoveGameplanOverlay?: () => void;
  liveCandleEventKey?: string | null;
  gexBotFlow?: GexBotFlowPayload | null;
  onIndicatorPaneHeightChange?: (height: number) => void;
  paperPositions?: PaperPosition[];
  paperFills?: PaperTradeFill[];
  onUpdatePaperProtection?: (
    accountId: string,
    positionId: string,
    update: PaperProtectionUpdate,
  ) => void;
  onPaperProtectionDragStateChange?: (positionId: string, dragging: boolean) => void;
  onClosePaperPosition?: (position: PaperPosition) => void;
  onRemovePaperFills?: (fillIds: string[]) => void;
  onResetPaperTrading?: () => void;
}

export interface ChartLevel {
  id: string;
  price: number;
  color: string;
  label: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  lineWidth?: 1 | 2 | 3 | 4;
  axisLabelVisible?: boolean;
  axisTitleVisible?: boolean;
  kind?: string;
  crossConfirmed?: boolean;
  contested?: boolean;
  confidenceBoost?: number;
  flowComparison?: {
    object: string;
    kwantPrice: number;
    gexBotPrice: number;
    distance: number;
    matchingBand: number;
    sources: ["Kwant", "GEX Bot"];
  };
}

export interface ChartZone {
  id: string;
  low: number;
  high: number;
  color: string;
  fillColor: string;
  label: string;
  labelAlign?: "left" | "right";
}

const HEDGE_LEVEL_COLORS: Record<HedgeChartLevel["kind"], string> = {
  MAJOR_CALL: "#B4233B",
  ACCELERATOR: "#14B8A6",
  MAGNET: "#D946EF",
  FLIP: "#E5E7EB",
  MAJOR_PUT: "#22C55E",
};

const EMPTY_CHART_LEVELS: ChartLevel[] = [];

const smtComparisonSnapshotCache = new Map<string, { candles: Candle[]; storedAt: number }>();
const smtComparisonSnapshotRequests = new Map<string, Promise<Candle[]>>();

async function loadSmtComparisonCandles(
  symbol: "ES" | "NQ",
  timeframe: string,
  lookbackBars: number,
) {
  const key = `${symbol}:${timeframe}:${lookbackBars}`;
  const cached = smtComparisonSnapshotCache.get(key);
  if (cached && Date.now() - cached.storedAt < 10_000) return cached.candles;
  const existing = smtComparisonSnapshotRequests.get(key);
  if (existing) return existing;
  const request = fetchInstitutionalSnapshot({
    symbol,
    timeframe,
    lookbackBars,
    timeoutMs: 15_000,
  }).then((snapshot) => {
    const candles = snapshot?.candles ?? [];
    if (candles.length) smtComparisonSnapshotCache.set(key, { candles, storedAt: Date.now() });
    return candles;
  }).finally(() => {
    smtComparisonSnapshotRequests.delete(key);
  });
  smtComparisonSnapshotRequests.set(key, request);
  return request;
}

type CandleSeriesApi = ReturnType<IChartApi["addCandlestickSeries"]>;

function formatClassicGexValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function formatTpoAge(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const TPO_LEVEL_QUERY_KEYS = [
  "rowSize",
  "minimumTrades",
  "tailMinimumRows",
  "singlePrintMinimumRows",
  "ledgeMinimumBrackets",
  "ledgeToleranceRows",
  "failedAuctionMinimumRows",
  "failedAuctionMaximumTpo",
  "edgeSmoothingRows",
  "edgeDropPercent",
  "edgeMaximumWidthRows",
  "acceptedBasePercent",
  "seamTroughPercent",
  "volumeLvnPercent",
  "acceptanceBrackets",
  "partialFillPercent",
  "expireAfterSessions",
  "expireStrength",
] as const;

type SessionHighLowRenderLevel = {
  id: string;
  startTime: Time;
  price: number;
  label: string;
  color: string;
  opacity: number;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  fontSize: number;
  precision: number;
};

class SessionHighLowRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: SessionHighLowPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!chart || !series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.textBaseline = "alphabetic";

      for (const level of this.primitive.levels()) {
        const rawX = chart.timeScale().timeToCoordinate(level.startTime);
        const y = series.priceToCoordinate(level.price);
        if (rawX === null || y === null) continue;

        const startX = Math.max(-2, rawX);
        context.save();
        context.globalAlpha = level.opacity;
        context.strokeStyle = level.color;
        context.lineWidth = level.lineWidth;
        context.setLineDash(
          level.lineStyle === "dotted"
            ? [1, 4]
            : level.lineStyle === "dashed"
              ? [6, 5]
              : [],
        );
        context.beginPath();
        context.moveTo(startX, y + 0.5);
        context.lineTo(mediaSize.width, y + 0.5);
        context.stroke();

        if (level.label) {
          const labelX = 7;
          const labelY = Math.max(10, y - 4);
          context.setLineDash([]);
          context.fillStyle = level.color;
          context.font = `700 ${level.fontSize}px 'JetBrains Mono', monospace`;
          context.fillText(
            `${level.label} ${level.price.toFixed(level.precision)}`,
            labelX,
            labelY,
            Math.max(40, mediaSize.width - labelX - 6),
          );
        }
        context.restore();
      }

      context.restore();
    });
  }
}

class SessionHighLowView implements ISeriesPrimitivePaneView {
  private readonly sessionRenderer: SessionHighLowRenderer;

  constructor(primitive: SessionHighLowPrimitive) {
    this.sessionRenderer = new SessionHighLowRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.sessionRenderer;
  }
}

class SessionHighLowPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderLevels: SessionHighLowRenderLevel[] = [];
  private readonly sessionView = new SessionHighLowView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chartApi = param.chart as IChartApi;
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.chartApi = null;
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(levels: SessionHighLowRenderLevel[]) {
    this.renderLevels = levels;
    this.requestRedraw?.();
  }

  chart() {
    return this.chartApi;
  }

  series() {
    return this.candleSeries;
  }

  levels() {
    return this.renderLevels;
  }

  paneViews() {
    return [this.sessionView];
  }
}

type SessionWindowRenderData = {
  id: string;
  startTime: Time;
  endTime: Time;
  high: number;
  low: number;
  open: number;
  close: number;
  label: string;
  color: string;
  fillOpacity: number;
  lineOpacity: number;
  borderWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  fontSize: number;
  showBackground: boolean;
  showBorders: boolean;
  showOpenClose: boolean;
  showLabel: boolean;
};

class SessionWindowRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: SessionWindowPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!chart || !series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      for (const session of this.primitive.sessions()) {
        const startX = chart.timeScale().timeToCoordinate(session.startTime);
        const endX = chart.timeScale().timeToCoordinate(session.endTime);
        const highY = series.priceToCoordinate(session.high);
        const lowY = series.priceToCoordinate(session.low);
        if (startX === null || endX === null || highY === null || lowY === null) continue;

        // Session windows store an exclusive end timestamp. The active session's
        // next candle does not exist yet, so render from its latest real candle
        // and extend by one native bar width instead of dropping the whole box.
        const barSpacing = Math.max(1, Number(chart.timeScale().options().barSpacing ?? 1));
        const left = Math.min(startX, endX);
        const right = Math.max(startX, endX) + barSpacing;
        const top = Math.min(highY, lowY);
        const bottom = Math.max(highY, lowY);
        const width = Math.max(2, right - left);
        const height = Math.max(2, bottom - top);
        if (right < 0 || left > mediaSize.width || bottom < 0 || top > mediaSize.height) continue;

        context.save();
        if (session.showBackground && session.fillOpacity > 0) {
          context.globalAlpha = session.fillOpacity;
          context.fillStyle = session.color;
          context.fillRect(left, top, width, height);
        }
        if (session.showBorders && session.borderWidth > 0) {
          context.globalAlpha = session.lineOpacity;
          context.strokeStyle = session.color;
          context.lineWidth = session.borderWidth;
          context.setLineDash(
            session.lineStyle === "dotted"
              ? [1, 4]
              : session.lineStyle === "dashed"
                ? [6, 5]
                : [],
          );
          context.strokeRect(left + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
        }
        if (session.showOpenClose) {
          context.globalAlpha = session.lineOpacity * 0.72;
          context.strokeStyle = session.color;
          context.lineWidth = 1;
          context.setLineDash([3, 4]);
          for (const price of [session.open, session.close]) {
            const y = series.priceToCoordinate(price);
            if (y === null) continue;
            context.beginPath();
            context.moveTo(left, y + 0.5);
            context.lineTo(right, y + 0.5);
            context.stroke();
          }
        }
        if (session.showLabel && session.label) {
          context.globalAlpha = Math.max(session.lineOpacity, 0.72);
          context.setLineDash([]);
          context.fillStyle = session.color;
          context.font = `700 ${session.fontSize}px 'JetBrains Mono', monospace`;
          context.textBaseline = "alphabetic";
          context.fillText(
            session.label,
            left + 5,
            Math.max(11, top + 12),
            Math.max(24, width - 10),
          );
        }
        context.restore();
      }

      context.restore();
    });
  }
}

class SessionWindowView implements ISeriesPrimitivePaneView {
  private readonly sessionRenderer: SessionWindowRenderer;

  constructor(primitive: SessionWindowPrimitive) {
    this.sessionRenderer = new SessionWindowRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.sessionRenderer;
  }
}

class SessionWindowPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderSessions: SessionWindowRenderData[] = [];
  private readonly sessionView = new SessionWindowView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chartApi = param.chart as IChartApi;
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
    this.requestRedraw();
  }

  detached() {
    this.chartApi = null;
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(sessions: SessionWindowRenderData[]) {
    this.renderSessions = sessions;
    this.requestRedraw?.();
  }

  chart() {
    return this.chartApi;
  }

  series() {
    return this.candleSeries;
  }

  sessions() {
    return this.renderSessions;
  }

  paneViews() {
    return [this.sessionView];
  }
}

type HedgeLevelsPrimitiveOptions = {
  showBelowFlip: boolean;
  showLabels: boolean;
  fillOpacity: number;
  lineOpacity: number;
  stale: boolean;
  pulseIds: string[];
  backgroundColor: string;
};

const DEFAULT_HEDGE_LEVELS_PRIMITIVE_OPTIONS: HedgeLevelsPrimitiveOptions = {
  showBelowFlip: true,
  showLabels: true,
  fillOpacity: 0.05,
  lineOpacity: 0.62,
  stale: false,
  pulseIds: [],
  backgroundColor: "#050505",
};

class HedgeLevelsRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: HedgeLevelsPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    if (!series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const options = this.primitive.options();
      const opacityScale = options.stale ? 0.52 : 1;
      const positioned = this.primitive.levels().flatMap((level) => {
        const price = this.primitive.displayPrice(level);
        const centreY = series.priceToCoordinate(price);
        if (centreY === null || centreY < -16 || centreY > mediaSize.height + 16) return [];
        if (level.kind === "FLIP") {
          return [{ level, centreY, y: centreY, height: 1 }];
        }
        const offsetLow = level.zoneLow - level.price;
        const offsetHigh = level.zoneHigh - level.price;
        const highY = series.priceToCoordinate(price + offsetHigh);
        const lowY = series.priceToCoordinate(price + offsetLow);
        if (highY === null || lowY === null) return [];
        return [{
          level,
          centreY,
          y: Math.min(highY, lowY),
          height: Math.max(2, Math.abs(lowY - highY)),
        }];
      });

      const flip = positioned.find((item) => item.level.kind === "FLIP") ?? null;
      context.save();
      if (options.showBelowFlip && flip) {
        context.globalAlpha = 0.045 * opacityScale;
        context.fillStyle = "#000000";
        context.fillRect(0, Math.max(0, flip.centreY), mediaSize.width, Math.max(0, mediaSize.height - flip.centreY));
      }

      for (const item of positioned) {
        const color = HEDGE_LEVEL_COLORS[item.level.kind];
        const isFlip = item.level.kind === "FLIP";
        const pulse = options.pulseIds.includes(item.level.id);
        context.save();
        if (!isFlip) {
          context.globalAlpha = options.fillOpacity * opacityScale;
          context.fillStyle = color;
          if (pulse) {
            context.shadowColor = color;
            context.shadowBlur = 16;
          }
          context.fillRect(0, item.y, mediaSize.width, item.height);
        }
        context.globalAlpha = options.lineOpacity * opacityScale;
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.setLineDash(isFlip ? [4, 4] : []);
        context.beginPath();
        context.moveTo(0, item.y + 0.5);
        context.lineTo(mediaSize.width, item.y + 0.5);
        context.stroke();
        if (!isFlip) {
          context.beginPath();
          context.moveTo(0, item.y + item.height - 0.5);
          context.lineTo(mediaSize.width, item.y + item.height - 0.5);
          context.stroke();
        }
        context.restore();
      }

      if (options.showLabels) {
        const labelRows = staggerHedgeLabels(
          positioned.map((item) => ({ id: item.level.id, y: item.centreY })),
          12,
        );
        const labelY = new Map(labelRows.map((row) => [row.id, Math.max(7, Math.min(mediaSize.height - 6, row.labelY))]));
        context.font = "700 7px 'JetBrains Mono', monospace";
        context.textBaseline = "middle";
        for (const item of positioned) {
          const color = HEDGE_LEVEL_COLORS[item.level.kind];
          const text = item.level.label;
          const width = Math.min(140, Math.max(24, context.measureText(text).width + 10));
          const x = 4;
          const y = labelY.get(item.level.id) ?? item.centreY;
          context.save();
          context.globalAlpha = 0.86 * opacityScale;
          context.fillStyle = options.backgroundColor;
          context.beginPath();
          context.roundRect(x, y - 6, width, 12, 1);
          context.fill();
          context.globalAlpha = 0.34 * opacityScale;
          context.strokeStyle = color;
          context.lineWidth = 1;
          context.stroke();
          context.globalAlpha = 0.9 * opacityScale;
          context.fillStyle = color;
          context.fillText(text, x + 5, y, width - 10);
          context.restore();
        }
      }
      context.restore();
    });
  }
}

class HedgeLevelsView implements ISeriesPrimitivePaneView {
  private readonly hedgeRenderer: HedgeLevelsRenderer;

  constructor(primitive: HedgeLevelsPrimitive) {
    this.hedgeRenderer = new HedgeLevelsRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.hedgeRenderer;
  }
}

class HedgeLevelsPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderLevels: HedgeChartLevel[] = [];
  private renderOptions = DEFAULT_HEDGE_LEVELS_PRIMITIVE_OPTIONS;
  private previousPrices = new Map<string, number>();
  private animationStartedAt = 0;
  private animationFrame: number | null = null;
  private readonly hedgeView = new HedgeLevelsView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
    this.requestRedraw();
  }

  detached() {
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(levels: HedgeChartLevel[], options: HedgeLevelsPrimitiveOptions) {
    const oldPrices = new Map(this.renderLevels.map((level) => [level.id, this.displayPrice(level)]));
    const moved = levels.some((level) => {
      const previous = oldPrices.get(level.id);
      return previous !== undefined && Math.abs(previous - level.price) > 0.0001;
    });
    this.previousPrices = oldPrices;
    this.renderLevels = levels;
    this.renderOptions = options;
    if (moved) {
      this.animationStartedAt = performance.now();
      this.scheduleAnimation();
    }
    this.requestRedraw?.();
  }

  private scheduleAnimation() {
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
    const tick = () => {
      this.requestRedraw?.();
      if (performance.now() - this.animationStartedAt < 220) {
        this.animationFrame = window.requestAnimationFrame(tick);
      } else {
        this.animationFrame = null;
        this.previousPrices.clear();
      }
    };
    this.animationFrame = window.requestAnimationFrame(tick);
  }

  displayPrice(level: HedgeChartLevel) {
    const previous = this.previousPrices.get(level.id);
    if (previous === undefined || this.animationStartedAt <= 0) return level.price;
    const progress = Math.max(0, Math.min(1, (performance.now() - this.animationStartedAt) / 220));
    const eased = 1 - (1 - progress) ** 3;
    return previous + (level.price - previous) * eased;
  }

  series() {
    return this.candleSeries;
  }

  levels() {
    return this.renderLevels;
  }

  options() {
    return this.renderOptions;
  }

  paneViews() {
    return [this.hedgeView];
  }
}

class GameplanUnderlayRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: GameplanUnderlayPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    if (!series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();

      for (const zone of this.primitive.zones()) {
        const highY = series.priceToCoordinate(zone.high);
        const lowY = series.priceToCoordinate(zone.low);
        if (highY === null || lowY === null) continue;
        const top = Math.min(highY, lowY);
        const height = Math.max(3, Math.abs(lowY - highY));
        context.fillStyle = zone.fillColor;
        context.fillRect(0, top, mediaSize.width, height);
        context.strokeStyle = zone.color;
        context.lineWidth = 1;
        context.setLineDash([6, 4]);
        context.strokeRect(0.5, top + 0.5, Math.max(0, mediaSize.width - 1), Math.max(2, height - 1));
      }

      for (const level of this.primitive.levels()) {
        const y = series.priceToCoordinate(level.price);
        if (y === null) continue;
        context.strokeStyle = level.color;
        context.lineWidth = level.lineWidth ?? 1;
        context.setLineDash(
          level.lineStyle === "dashed"
            ? [7, 5]
            : level.lineStyle === "dotted"
              ? [2, 4]
              : [],
        );
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(mediaSize.width, y + 0.5);
        context.stroke();

        // Keep Gameplan labels anchored to their real price coordinate. Levels
        // outside the visible price range should remain off-screen instead of
        // being clamped into a stack above the chart controls.
        if (y < 9 || y > mediaSize.height - 9) continue;

        const label = level.label;
        context.font = "700 8px 'JetBrains Mono', monospace";
        const labelWidth = Math.min(220, Math.max(70, context.measureText(label).width + 14));
        const labelTop = y - 9;
        // Chips anchor to the left edge of the pane; on the right they sat on
        // top of the price axis and the Classic GEX profile panel.
        const labelLeft = 4;
        context.setLineDash([]);
        context.fillStyle = this.primitive.backgroundColor();
        context.strokeStyle = level.color;
        context.lineWidth = 0.8;
        context.beginPath();
        context.roundRect(labelLeft, labelTop, labelWidth, 17, 1);
        context.fill();
        context.stroke();
        context.fillStyle = level.color;
        context.fillText(label, labelLeft + 7, labelTop + 11.5, labelWidth - 14);
      }

      context.restore();
    });
  }
}

class GameplanUnderlayView implements ISeriesPrimitivePaneView {
  private readonly underlayRenderer: GameplanUnderlayRenderer;

  constructor(primitive: GameplanUnderlayPrimitive) {
    this.underlayRenderer = new GameplanUnderlayRenderer(primitive);
  }

  zOrder() {
    return "bottom" as const;
  }

  renderer() {
    return this.underlayRenderer;
  }
}

class GameplanUnderlayPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private priceLevels: ChartLevel[] = [];
  private priceZones: ChartZone[] = [];
  private chartBackground = "rgba(8, 10, 12, 0.88)";
  private readonly underlayView = new GameplanUnderlayView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(levels: ChartLevel[], zones: ChartZone[], backgroundColor: string) {
    this.priceLevels = levels;
    this.priceZones = zones;
    this.chartBackground = backgroundColor;
    this.requestRedraw?.();
  }

  series() {
    return this.candleSeries;
  }

  levels() {
    return this.priceLevels;
  }

  zones() {
    return this.priceZones;
  }

  backgroundColor() {
    return this.chartBackground;
  }

  paneViews() {
    return [this.underlayView];
  }
}

class FixedPriceLevelLabelsRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: FixedPriceLevelLabelsPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    if (!series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.font = "700 8px 'JetBrains Mono', monospace";
      context.textBaseline = "middle";

      for (const level of this.primitive.levels()) {
        if (level.axisLabelVisible === false) continue;
        const y = series.priceToCoordinate(level.price);
        if (y === null || y < 8 || y > mediaSize.height - 8) continue;

        const price = level.price.toFixed(this.primitive.precision());
        const label = level.axisTitleVisible === false
          ? price
          : `${level.label}  ${price}`;
        const width = Math.min(320, Math.max(58, context.measureText(label).width + 14));
        const left = 4;

        // Deliberately draw at the exact price coordinate. Native price-axis
        // labels are collision-resolved by moving the level chip whenever the
        // live-price marker crosses it, which makes fixed GEX levels wobble.
        context.fillStyle = this.primitive.backgroundColor();
        context.strokeStyle = level.color;
        context.lineWidth = 0.9;
        context.beginPath();
        context.roundRect(left, y - 8, width, 16, 1);
        context.fill();
        context.stroke();
        context.fillStyle = level.color;
        context.fillText(label, left + 7, y, width - 14);
      }

      context.restore();
    });
  }
}

class FixedPriceLevelLabelsView implements ISeriesPrimitivePaneView {
  private readonly levelRenderer: FixedPriceLevelLabelsRenderer;

  constructor(primitive: FixedPriceLevelLabelsPrimitive) {
    this.levelRenderer = new FixedPriceLevelLabelsRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.levelRenderer;
  }
}

class FixedPriceLevelLabelsPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderLevels: ChartLevel[] = [];
  private chartBackground = "rgba(8, 10, 12, 0.94)";
  private pricePrecision = 2;
  private readonly levelView = new FixedPriceLevelLabelsView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(levels: ChartLevel[], backgroundColor: string, precision: number) {
    this.renderLevels = levels;
    this.chartBackground = backgroundColor;
    this.pricePrecision = precision;
    this.requestRedraw?.();
  }

  series() {
    return this.candleSeries;
  }

  levels() {
    return this.renderLevels;
  }

  backgroundColor() {
    return this.chartBackground;
  }

  precision() {
    return this.pricePrecision;
  }

  paneViews() {
    return [this.levelView];
  }
}

type PaperFillMarkerRenderData = {
  id: string;
  time: Time;
  price: number;
  side: PaperTradeFill["side"];
  role: PaperTradeFill["role"];
};

class PaperFillMarkersRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: PaperFillMarkersPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    if (!chart || !series) return;

    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      for (const marker of this.primitive.markers()) {
        const x = chart.timeScale().timeToCoordinate(marker.time);
        const y = series.priceToCoordinate(marker.price);
        if (x === null || y === null) continue;
        const entry = marker.role === "entry";
        context.beginPath();
        if (entry) {
          context.moveTo(x - 6, y - 4);
          context.lineTo(x + 6, y);
          context.lineTo(x - 6, y + 4);
        } else {
          context.moveTo(x + 6, y - 4);
          context.lineTo(x - 6, y);
          context.lineTo(x + 6, y + 4);
        }
        context.closePath();
        context.fillStyle = marker.side === "buy" ? "#22e887" : "#ff3b5c";
        context.fill();
      }
      context.restore();
    });
  }
}

class PaperFillMarkersView implements ISeriesPrimitivePaneView {
  private readonly markerRenderer: PaperFillMarkersRenderer;

  constructor(primitive: PaperFillMarkersPrimitive) {
    this.markerRenderer = new PaperFillMarkersRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.markerRenderer;
  }
}

class PaperFillMarkersPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: IChartApi | null = null;
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderMarkers: PaperFillMarkerRenderData[] = [];
  private readonly markerView = new PaperFillMarkersView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chartApi = param.chart as IChartApi;
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.chartApi = null;
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(markers: PaperFillMarkerRenderData[]) {
    this.renderMarkers = markers;
    this.requestRedraw?.();
  }

  chart() { return this.chartApi; }
  series() { return this.candleSeries; }
  markers() { return this.renderMarkers; }
  paneViews() { return [this.markerView]; }
}

type PaperPositionOverlayRenderLevel = {
  id: string;
  price: number;
  label: string;
  color: string;
  kind: "entry" | "stop_loss" | "take_profit";
  showStopHandle?: boolean;
  showTakeProfitHandle?: boolean;
  showClose?: boolean;
  stopColor?: string;
  takeProfitColor?: string;
  livePosition?: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    entryPrice: number;
  };
};

function paperPositionSizeLabel(side: "buy" | "sell", quantity: number) {
  const absoluteQuantity = Math.max(0, Math.abs(quantity));
  return `${side === "buy" ? "+" : "-"}${absoluteQuantity.toLocaleString("en-US")}`;
}

function paperProtectionSizeLabel(positionSide: "buy" | "sell", quantity: number) {
  return paperPositionSizeLabel(positionSide === "buy" ? "sell" : "buy", quantity);
}

class PaperPositionOverlayRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: PaperPositionOverlayPrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    if (!series) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.font = "700 8px 'JetBrains Mono', monospace";
      context.textBaseline = "middle";
      const labelWidth = 164;
      const labelHeight = 16;
      const labelX = Math.max(0, mediaSize.width - labelWidth - 4);

      for (const level of this.primitive.levels()) {
        const y = series.priceToCoordinate(level.price);
        if (y === null || y < -labelHeight || y > mediaSize.height + labelHeight) continue;
        const markPrice = this.primitive.markPrice();
        const livePnl = level.kind === "entry" && level.livePosition && markPrice !== null
          ? paperProjectedPnl(
              level.livePosition.symbol,
              level.livePosition.side,
              level.livePosition.entryPrice,
              markPrice,
              level.livePosition.quantity,
            )
          : null;
        const renderedLabel = livePnl === null || !level.livePosition
          ? level.label
          : `${paperPositionSizeLabel(level.livePosition.side, level.livePosition.quantity)} · ${livePnl > 0 ? "+" : livePnl < 0 ? "-" : ""}$${Math.abs(livePnl).toFixed(2)}`;

        context.save();
        context.globalAlpha = 0.92;
        context.strokeStyle = level.color;
        context.lineWidth = 1;
        context.setLineDash(level.kind === "entry" ? [] : [5, 4]);
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(mediaSize.width, y + 0.5);
        context.stroke();
        context.restore();

        const labelTop = y - labelHeight / 2;
        context.save();
        context.globalAlpha = 0.96;
        context.fillStyle = this.primitive.backgroundColor();
        context.fillRect(labelX, labelTop, labelWidth, labelHeight);
        context.globalAlpha = 1;
        context.strokeStyle = level.color;
        context.lineWidth = 1;
        context.strokeRect(labelX + 0.5, labelTop + 0.5, labelWidth - 1, labelHeight - 1);
        let textLeft = labelX + 7;
        if (level.kind === "entry" && level.showStopHandle) {
          context.fillStyle = level.stopColor ?? level.color;
          context.fillText("SL", labelX + 5, y, 15);
          context.strokeStyle = level.color;
          context.beginPath();
          context.moveTo(labelX + 20.5, labelTop + 1);
          context.lineTo(labelX + 20.5, labelTop + labelHeight - 1);
          context.stroke();
          textLeft += 20;
        }
        if (level.kind === "entry" && level.showTakeProfitHandle) {
          context.fillStyle = level.takeProfitColor ?? level.color;
          context.fillText("TP", textLeft - 2, y, 15);
          context.strokeStyle = level.color;
          context.beginPath();
          context.moveTo(textLeft + 13.5, labelTop + 1);
          context.lineTo(textLeft + 13.5, labelTop + labelHeight - 1);
          context.stroke();
          textLeft += 20;
        }
        const closeWidth = level.showClose ? 16 : 0;
        if (closeWidth) {
          context.strokeStyle = level.color;
          context.beginPath();
          context.moveTo(labelX + labelWidth - closeWidth - 0.5, labelTop + 1);
          context.lineTo(labelX + labelWidth - closeWidth - 0.5, labelTop + labelHeight - 1);
          context.stroke();
          context.fillStyle = level.color;
          context.fillText("×", labelX + labelWidth - 12, y, 10);
        }
        context.beginPath();
        context.rect(textLeft, labelTop + 1, labelX + labelWidth - closeWidth - textLeft - 2, labelHeight - 2);
        context.clip();
        context.fillStyle = level.color;
        context.fillText(renderedLabel, textLeft, y, labelX + labelWidth - closeWidth - textLeft - 4);
        context.restore();
      }
      context.restore();
    });
  }
}

class PaperPositionOverlayView implements ISeriesPrimitivePaneView {
  private readonly overlayRenderer: PaperPositionOverlayRenderer;

  constructor(primitive: PaperPositionOverlayPrimitive) {
    this.overlayRenderer = new PaperPositionOverlayRenderer(primitive);
  }

  zOrder() { return "top" as const; }
  renderer() { return this.overlayRenderer; }
}

class PaperPositionOverlayPrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderLevels: PaperPositionOverlayRenderLevel[] = [];
  private chartBackground = "#050608";
  private liveMarkPrice: number | null = null;
  private readonly overlayView = new PaperPositionOverlayView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series as CandleSeriesApi;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(levels: PaperPositionOverlayRenderLevel[], backgroundColor: string) {
    this.renderLevels = levels;
    this.chartBackground = backgroundColor;
    this.requestRedraw?.();
  }

  updateMarkPrice(price: number) {
    if (!Number.isFinite(price) || price <= 0 || this.liveMarkPrice === price) return;
    this.liveMarkPrice = price;
    this.requestRedraw?.();
  }

  series() { return this.candleSeries; }
  levels() { return this.renderLevels; }
  markPrice() { return this.liveMarkPrice; }
  backgroundColor() { return this.chartBackground; }
  paneViews() { return [this.overlayView]; }
}

type DrawingToolId =
  | "cursor"
  | "selection"
  | "dot"
  | "arrowCursor"
  | "demonstration"
  | "magic"
  | "eraser"
  | "trendLine"
  | "ray"
  | "infoLine"
  | "extendedLine"
  | "trendAngle"
  | "horizontalLine"
  | "horizontalRay"
  | "verticalLine"
  | "crossLine"
  | "parallelChannel"
  | "priceChannel"
  | "highlightX"
  | "highlightY"
  | "regressionTrend"
  | "flatTopBottom"
  | "disjointChannel"
  | "pitchfork"
  | "schiffPitchfork"
  | "modifiedSchiffPitchfork"
  | "insidePitchfork"
  | "anchoredVwap"
  | "dynamicPoc"
  | "cvdCorrelation"
  | "marketProfile"
  | "zigzagTpoProfile"
  | "fibRetracement"
  | "trendBasedFibExtension"
  | "fibChannel"
  | "fibTimeZone"
  | "fibSpeedResistanceFan"
  | "trendBasedFibTime"
  | "fibCircles"
  | "fibSpiral"
  | "fibSpeedResistanceArcs"
  | "fibWedge"
  | "pitchfan"
  | "fibFan"
  | "gannBox"
  | "gannSquareFixed"
  | "gannSquare"
  | "gannFan"
  | "xabcdPattern"
  | "cypherPattern"
  | "headAndShoulders"
  | "abcdPattern"
  | "trianglePattern"
  | "threeDrivesPattern"
  | "elliottImpulseWave"
  | "elliottCorrectionWave"
  | "elliottTriangleWave"
  | "elliottDoubleComboWave"
  | "elliottTripleComboWave"
  | "cyclicLines"
  | "timeCycles"
  | "sineLine"
  | "rectangle"
  | "rotatedRectangle"
  | "ellipse"
  | "circle"
  | "path"
  | "polyline"
  | "triangle"
  | "arc"
  | "curve"
  | "doubleCurve"
  | "brush"
  | "highlighter"
  | "arrowMarker"
  | "arrow"
  | "arrowMarkUp"
  | "arrowMarkDown"
  | "text"
  | "label"
  | "rightPriceLabel"
  | "leftPriceLabel"
  | "anchoredText"
  | "note"
  | "priceNote"
  | "pin"
  | "table"
  | "callout"
  | "comment"
  | "priceLabel"
  | "signpost"
  | "flagMark"
  | "diamond"
  | "square"
  | "upArrow"
  | "downArrow"
  | "image"
  | "post"
  | "idea"
  | "emoji"
  | "longPosition"
  | "shortPosition"
  | "positionForecast"
  | "projection"
  | "barPattern"
  | "ghostFeed"
  | "sector"
  | "fixedRangeVolumeProfile"
  | "anchoredVolumeProfile"
  | "volumeProfile"
  | "measure"
  | "ruler"
  | "priceRange"
  | "dateRange"
  | "datePriceRange"
  | "zoomIn"
  | "zoomOut";

type ToolbarGroupId =
  | "favorites"
  | "cursorTools"
  | "trend"
  | "fib"
  | "patterns"
  | "shapes"
  | "forecast"
  | "annotation"
  | "icons"
  | "measure"
  | "zoom";

type ToolbarDock = "left" | "right" | "top" | "bottom";

type DrawingPoint = {
  time: number;
  price: number;
};

type PositionVisualSettings = {
  targetColor?: string;
  stopColor?: string;
  entryLineColor?: string;
  textColor?: string;
  fillOpacity?: number;
  borderOpacity?: number;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  showLabels?: boolean;
};

type ChartDrawing = {
  id: string;
  tool: DrawingToolId;
  points: DrawingPoint[];
  text?: string;
  color?: string;
  positionStyle?: PositionVisualSettings;
};

type DrawingInteraction =
  | {
      drawingId: string;
      mode: "move";
      startPointer: DrawingPoint;
      originalPoints: DrawingPoint[];
    }
  | {
      drawingId: string;
      mode: "anchor0" | "anchor1" | "positionTargetLeft" | "positionTargetRight" | "positionStopLeft" | "positionStopRight";
      startPointer: DrawingPoint;
      originalPoints: DrawingPoint[];
    };

type ToolbarTool = {
  id: DrawingToolId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: string;
  shortcut?: string;
  implemented?: boolean;
};

type ToolbarGroup = {
  id: ToolbarGroupId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tools: ToolbarTool[];
};

type DrawingTemplate = {
  id: string;
  name: string;
  toolType: string;
  style: ProfessionalDrawingRecord["style"];
  options: ProfessionalDrawingRecord["options"];
  createdAt: number;
  isDefault?: boolean;
};

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const TEXT_TOOLS: DrawingToolId[] = ["text", "note", "priceNote", "callout", "comment", "priceLabel", "pin", "signpost", "flagMark"];

const DRAWING_TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    id: "cursorTools",
    label: "Cursor Tools",
    icon: Crosshair,
    tools: [
      { id: "cursor", label: "Cross", icon: Crosshair, implemented: true },
      { id: "dot", label: "Dot", icon: Dot },
      { id: "arrowCursor", label: "Arrow", icon: MousePointer2 },
      { id: "demonstration", label: "Demonstration", icon: MoveHorizontal },
      { id: "magic", label: "Magic", icon: Sparkles },
      { id: "eraser", label: "Eraser", icon: Eraser, implemented: true },
    ],
  },
  {
    id: "trend",
    label: "Trend Line Tools",
    icon: Slash,
    tools: [
      { id: "trendLine", label: "Trendline", icon: Slash, section: "Lines", shortcut: "Alt + T", implemented: true },
      { id: "ray", label: "Ray", icon: PencilLine, section: "Lines", implemented: true },
      { id: "infoLine", label: "Info line", icon: Info, section: "Lines", implemented: true },
      { id: "extendedLine", label: "Extended line", icon: MoveHorizontal, section: "Lines", implemented: true },
      { id: "trendAngle", label: "Trend angle", icon: MoveVertical, section: "Lines" },
      { id: "horizontalLine", label: "Horizontal line", icon: MoveHorizontal, section: "Lines", shortcut: "Alt + H", implemented: true },
      { id: "horizontalRay", label: "Horizontal ray", icon: ArrowRightIconShim, section: "Lines", implemented: true },
      { id: "verticalLine", label: "Vertical line", icon: MoveVertical, section: "Lines", shortcut: "Alt + V", implemented: true },
      { id: "crossLine", label: "Cross line", icon: Crosshair, section: "Lines", shortcut: "Alt + C", implemented: true },
      { id: "parallelChannel", label: "Parallel channel", icon: KanbanSquare, section: "Channels" },
      { id: "regressionTrend", label: "Regression trend", icon: ChartColumnIncreasing, section: "Channels" },
      { id: "flatTopBottom", label: "Flat top/bottom", icon: RectangleHorizontal, section: "Channels" },
      { id: "disjointChannel", label: "Disjoint channel", icon: Shapes, section: "Channels" },
      { id: "pitchfork", label: "Pitchfork", icon: Waypoints, section: "Pitchforks" },
      { id: "schiffPitchfork", label: "Schiff pitchfork", icon: Waypoints, section: "Pitchforks" },
      { id: "modifiedSchiffPitchfork", label: "Modified Schiff pitchfork", icon: Waypoints, section: "Pitchforks" },
      { id: "insidePitchfork", label: "Inside pitchfork", icon: Waypoints, section: "Pitchforks" },
    ],
  },
  {
    id: "fib",
    label: "Gann and Fibonacci Tools",
    icon: Waypoints,
    tools: [
      { id: "fibRetracement", label: "Fib retracement", icon: Waypoints, section: "Fibonacci", shortcut: "Alt + F", implemented: true },
      { id: "trendBasedFibExtension", label: "Trend-based fib extension", icon: ChartColumnIncreasing, section: "Fibonacci" },
      { id: "fibChannel", label: "Fib channel", icon: KanbanSquare, section: "Fibonacci" },
      { id: "fibTimeZone", label: "Fib time zone", icon: MoveVertical, section: "Fibonacci" },
      { id: "fibSpeedResistanceFan", label: "Fib speed resistance fan", icon: Radar, section: "Fibonacci" },
      { id: "trendBasedFibTime", label: "Trend-based fib time", icon: MoveHorizontal, section: "Fibonacci" },
      { id: "fibCircles", label: "Fib circles", icon: Circle, section: "Fibonacci" },
      { id: "fibSpiral", label: "Fib spiral", icon: RotateCcw, section: "Fibonacci" },
      { id: "fibSpeedResistanceArcs", label: "Fib speed resistance arcs", icon: Waves, section: "Fibonacci" },
      { id: "fibWedge", label: "Fib wedge", icon: TriangleIconShim, section: "Fibonacci" },
      { id: "pitchfan", label: "Pitchfan", icon: Radar, section: "Fibonacci" },
      { id: "gannBox", label: "Gann box", icon: RectangleHorizontal, section: "Gann" },
      { id: "gannSquareFixed", label: "Gann square fixed", icon: RectangleHorizontal, section: "Gann" },
      { id: "gannSquare", label: "Gann square", icon: RectangleHorizontal, section: "Gann" },
      { id: "gannFan", label: "Gann fan", icon: Radar, section: "Gann" },
    ],
  },
  {
    id: "patterns",
    label: "Patterns and Cycles",
    icon: Waypoints,
    tools: [
      { id: "xabcdPattern", label: "XABCD pattern", icon: Waypoints, section: "Chart Patterns" },
      { id: "cypherPattern", label: "Cypher pattern", icon: Waypoints, section: "Chart Patterns" },
      { id: "headAndShoulders", label: "Head and shoulders", icon: Waypoints, section: "Chart Patterns" },
      { id: "abcdPattern", label: "ABCD pattern", icon: Shapes, section: "Chart Patterns" },
      { id: "trianglePattern", label: "Triangle pattern", icon: TriangleIconShim, section: "Chart Patterns" },
      { id: "threeDrivesPattern", label: "Three drives pattern", icon: Waypoints, section: "Chart Patterns" },
      { id: "elliottImpulseWave", label: "Elliott impulse wave (1·2·3·4·5)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottCorrectionWave", label: "Elliott correction wave (A·B·C)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottTriangleWave", label: "Elliott triangle wave (A·B·C·D·E)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottDoubleComboWave", label: "Elliott double combo wave (W·X·Y)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottTripleComboWave", label: "Elliott triple combo wave (W·X·Y·X·Z)", icon: Waves, section: "Elliott Waves" },
      { id: "cyclicLines", label: "Cyclic lines", icon: MoveVertical, section: "Cycles" },
      { id: "timeCycles", label: "Time cycles", icon: MoveHorizontal, section: "Cycles" },
      { id: "sineLine", label: "Sine line", icon: Waves, section: "Cycles" },
    ],
  },
  {
    id: "shapes",
    label: "Brushes, Arrows and Shapes",
    icon: Brush,
    tools: [
      { id: "brush", label: "Brush", icon: Brush, section: "Brushes" },
      { id: "highlighter", label: "Highlighter", icon: Highlighter, section: "Brushes" },
      { id: "arrowMarker", label: "Arrow marker", icon: ArrowUp, section: "Arrows" },
      { id: "arrow", label: "Arrow", icon: ArrowUp, section: "Arrows" },
      { id: "arrowMarkUp", label: "Arrow mark up", icon: ArrowBigUp, section: "Arrows" },
      { id: "arrowMarkDown", label: "Arrow mark down", icon: ArrowBigDown, section: "Arrows" },
      { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal, section: "Shapes", shortcut: "Alt + Shift + R", implemented: true },
      { id: "rotatedRectangle", label: "Rotated rectangle", icon: RectangleHorizontal, section: "Shapes" },
      { id: "path", label: "Path", icon: PencilLine, section: "Shapes", implemented: true },
      { id: "circle", label: "Circle", icon: Circle, section: "Shapes", implemented: true },
      { id: "ellipse", label: "Ellipse", icon: Circle, section: "Shapes", implemented: true },
      { id: "polyline", label: "Polyline", icon: PencilLine, section: "Shapes" },
      { id: "triangle", label: "Triangle", icon: TriangleIconShim, section: "Shapes" },
      { id: "arc", label: "Arc", icon: RotateCcw, section: "Shapes" },
      { id: "curve", label: "Curve", icon: PenLine, section: "Shapes" },
      { id: "doubleCurve", label: "Double curve", icon: PenLine, section: "Shapes" },
    ],
  },
  {
    id: "forecast",
    label: "Forecasting",
    icon: ChartColumnIncreasing,
    tools: [
      { id: "longPosition", label: "Long position", icon: MoveHorizontal, section: "Forecasting", implemented: true },
      { id: "shortPosition", label: "Short position", icon: MoveHorizontal, section: "Forecasting", implemented: true },
      { id: "positionForecast", label: "Position forecast", icon: ChartColumnIncreasing, section: "Forecasting" },
      { id: "projection", label: "Projection", icon: Waypoints, section: "Forecasting" },
      { id: "barPattern", label: "Bar pattern", icon: ChartColumnIncreasing, section: "Forecasting" },
      { id: "ghostFeed", label: "Ghost feed", icon: Waves, section: "Forecasting" },
      { id: "sector", label: "Sector", icon: Radar, section: "Forecasting" },
      { id: "anchoredVwap", label: "Anchored VWAP", icon: ChartColumnIncreasing, section: "Volume-Based", implemented: true },
      { id: "fixedRangeVolumeProfile", label: "Fixed range volume profile", icon: KanbanSquare, section: "Volume-Based" },
      { id: "anchoredVolumeProfile", label: "Anchored volume profile", icon: KanbanSquare, section: "Volume-Based" },
      { id: "priceRange", label: "Price range", icon: Ruler, section: "Measurers", implemented: true },
      { id: "dateRange", label: "Date range", icon: Ruler, section: "Measurers", implemented: true },
      { id: "datePriceRange", label: "Date and price range", icon: Calculator, section: "Measurers", implemented: true },
    ],
  },
  {
    id: "annotation",
    label: "Text and Notes",
    icon: Type,
    tools: [
      { id: "text", label: "Text", icon: Type, section: "Text and Notes", implemented: true },
      { id: "anchoredText", label: "Anchored text", icon: Type, section: "Text and Notes" },
      { id: "note", label: "Note", icon: StickyNote, section: "Text and Notes", implemented: true },
      { id: "priceNote", label: "Price note", icon: Tag, section: "Text and Notes", implemented: true },
      { id: "pin", label: "Pin", icon: Pin, section: "Text and Notes", implemented: true },
      { id: "table", label: "Table", icon: Table2, section: "Text and Notes" },
      { id: "callout", label: "Callout", icon: MessageSquare, section: "Text and Notes", implemented: true },
      { id: "comment", label: "Comment", icon: MessageCircle, section: "Text and Notes", implemented: true },
      { id: "priceLabel", label: "Price label", icon: Tag, section: "Text and Notes", implemented: true },
      { id: "signpost", label: "Signpost", icon: Flag, section: "Text and Notes", implemented: true },
      { id: "flagMark", label: "Flag mark", icon: Flag, section: "Text and Notes", implemented: true },
      { id: "image", label: "Image", icon: ImageIcon, section: "Content" },
      { id: "post", label: "Post", icon: MessageSquare, section: "Content" },
      { id: "idea", label: "Idea", icon: LightbulbIconShim, section: "Content" },
    ],
  },
  {
    id: "icons",
    label: "Icons and Emojis",
    icon: SmilePlus,
    tools: [{ id: "emoji", label: "Emoji", icon: SmilePlus, section: "Icons" }],
  },
  {
    id: "measure",
    label: "Measurers",
    icon: Ruler,
    tools: [{ id: "measure", label: "Measure", icon: Ruler, section: "Measure", implemented: true }],
  },
  {
    id: "zoom",
    label: "Zoom Tools",
    icon: Plus,
    tools: [
      { id: "zoomIn", label: "Zoom in", icon: Plus, section: "Zoom" },
      { id: "zoomOut", label: "Zoom out", icon: Undo2, section: "Zoom" },
    ],
  },
];

const LEGACY_DRAWING_TOOL_BY_ID = new Map(
  DRAWING_TOOLBAR_GROUPS.flatMap((group) => group.tools).map((tool) => [tool.id, tool] as const),
);

function activeDrawingTool(
  id: DrawingToolId,
  label: string,
  icon: ComponentType<{ className?: string }>,
  section: string,
  shortcut?: string,
): ToolbarTool {
  return {
    ...LEGACY_DRAWING_TOOL_BY_ID.get(id),
    id,
    label,
    icon,
    section,
    shortcut,
    implemented: true,
  };
}

/** The bounded, production drawing surface specified for KwantDesk. */
const ACTIVE_DRAWING_TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    id: "cursorTools",
    label: "Lines",
    icon: Slash,
    tools: [
      activeDrawingTool("trendLine", "Trend Line", Slash, "Lines", "Alt + T"),
      activeDrawingTool("trendAngle", "Angle", MoveVertical, "Lines"),
      activeDrawingTool("verticalLine", "Vertical Line", MoveVertical, "Lines", "Alt + V"),
      activeDrawingTool("horizontalLine", "Horizontal Line", MoveHorizontal, "Lines", "Alt + H"),
      activeDrawingTool("horizontalRay", "Horizontal Ray", ArrowRightIconShim, "Lines"),
      activeDrawingTool("crossLine", "Cross Line", Crosshair, "Lines", "Alt + C"),
      activeDrawingTool("brush", "Pencil", PencilLine, "Lines"),
    ],
  },
  {
    id: "shapes",
    label: "Shapes",
    icon: Shapes,
    tools: [
      activeDrawingTool("triangle", "Triangle", TriangleIconShim, "Shapes"),
      activeDrawingTool("rectangle", "Rectangle", RectangleHorizontal, "Shapes"),
      activeDrawingTool("ellipse", "Ellipse", Circle, "Shapes"),
      activeDrawingTool("priceChannel", "Price Channel", KanbanSquare, "Shapes"),
      activeDrawingTool("highlightY", "Highlight Y", Highlighter, "Highlights"),
      activeDrawingTool("highlightX", "Highlight X", Highlighter, "Highlights"),
    ],
  },
  {
    id: "forecast",
    label: "Volume Analysis",
    icon: ChartColumnIncreasing,
    tools: [
      activeDrawingTool("marketProfile", "Market Profile", KanbanSquare, "Profiles"),
      activeDrawingTool("fixedRangeVolumeProfile", "Fixed Market Profile", KanbanSquare, "Profiles"),
      activeDrawingTool("anchoredVolumeProfile", "Anchored Market Profile", KanbanSquare, "Profiles"),
      activeDrawingTool("zigzagTpoProfile", "ZigZag TPO & Profile", Waves, "Profiles"),
      activeDrawingTool("anchoredVwap", "Anchored VWAP", ChartColumnIncreasing, "Analytics"),
      activeDrawingTool("dynamicPoc", "Dynamic POC", MoveHorizontal, "Analytics"),
      activeDrawingTool("cvdCorrelation", "CVD Correlation", Waves, "Analytics"),
    ],
  },
  {
    id: "fib",
    label: "Fibonacci",
    icon: Waypoints,
    tools: [
      activeDrawingTool("fibRetracement", "Fibonacci Retracements", Waypoints, "Fibonacci"),
      activeDrawingTool("trendBasedFibExtension", "Fibonacci Extensions", ChartColumnIncreasing, "Fibonacci"),
      activeDrawingTool("fibFan", "Fibo Fan", Radar, "Fibonacci"),
    ],
  },
  {
    id: "patterns",
    label: "Elliott",
    icon: Waves,
    tools: [
      activeDrawingTool("elliottImpulseWave", "Impulse (12345)", Waves, "Elliott"),
      activeDrawingTool("elliottCorrectionWave", "Correction (ABC)", Waves, "Elliott"),
      activeDrawingTool("elliottTriangleWave", "Triangle (ABCDE)", Waves, "Elliott"),
      activeDrawingTool("elliottDoubleComboWave", "Double Combo (WXY)", Waves, "Elliott"),
      activeDrawingTool("elliottTripleComboWave", "Triple Combo (WXYXZ)", Waves, "Elliott"),
    ],
  },
  {
    id: "measure",
    label: "Measurement",
    icon: Ruler,
    tools: [
      activeDrawingTool("ruler", "Ruler", Ruler, "Measurement"),
      activeDrawingTool("measure", "Measure", Calculator, "Measurement"),
    ],
  },
  {
    id: "zoom",
    label: "Position",
    icon: ChartColumnIncreasing,
    tools: [
      activeDrawingTool("longPosition", "Buy Calculator", ArrowBigUp, "Position"),
      activeDrawingTool("shortPosition", "Sell Calculator", ArrowBigDown, "Position"),
      activeDrawingTool("volumeProfile", "Volume Profile", KanbanSquare, "Position"),
    ],
  },
  {
    id: "annotation",
    label: "Text",
    icon: Type,
    tools: [
      activeDrawingTool("text", "Text", Type, "Text"),
      activeDrawingTool("label", "Label", Tag, "Text"),
      activeDrawingTool("rightPriceLabel", "Right Price Label", Tag, "Price Labels"),
      activeDrawingTool("leftPriceLabel", "Left Price Label", Tag, "Price Labels"),
    ],
  },
  {
    id: "icons",
    label: "Markers",
    icon: Dot,
    tools: [
      activeDrawingTool("dot", "Dot", Dot, "Markers"),
      activeDrawingTool("diamond", "Diamond", Shapes, "Markers"),
      activeDrawingTool("square", "Square", Square, "Markers"),
      activeDrawingTool("upArrow", "Up Arrow", ArrowBigUp, "Markers"),
      activeDrawingTool("downArrow", "Down Arrow", ArrowBigDown, "Markers"),
    ],
  },
];

const ALL_DRAWING_TOOLS = ACTIVE_DRAWING_TOOLBAR_GROUPS.flatMap((group) => group.tools);
const DOUBLE_CLICK_STYLE_DRAWING_TYPES = new Set([
  "trend-line",
  "trend-angle",
  "vertical-line",
  "horizontal-line",
  "horizontal-ray",
  "cross-line",
  "brush",
]);
const PRECISION_TOOL_BY_DRAWING_TOOL: Partial<Record<DrawingToolId, PrecisionToolId>> = {
  brush: "precision-pencil",
  longPosition: "precision-buy-calculator",
  shortPosition: "precision-sell-calculator",
  volumeProfile: "precision-volume-profile",
};

function precisionToolForDrawingTool(tool: DrawingToolId): PrecisionToolId | null {
  return PRECISION_TOOL_BY_DRAWING_TOOL[tool] ?? null;
}
const DRAWING_TOOL_FAVORITES_STORAGE_KEY = "kwantdesk:drawing-favourites:v1";
const DRAWING_TOOL_FAVORITES_EVENT = "kwantify-chart-tool-favorites-change";
const DRAWING_TEMPLATES_STORAGE_KEY = "kwantdesk:drawing-templates:v1";

const TOOLBAR_ICON_MAP: Record<ToolbarGroupId, ComponentType<{ className?: string }>> = {
  favorites: Star,
  cursorTools: Crosshair,
  trend: Slash,
  fib: Waypoints,
  patterns: Waypoints,
  shapes: Brush,
  forecast: ChartColumnIncreasing,
  annotation: Type,
  icons: SmilePlus,
  measure: Ruler,
  zoom: Plus,
};

function ArrowRightIconShim({ className }: { className?: string }) {
  return <ArrowUp className={className} style={{ transform: "rotate(90deg)" }} />;
}

function TriangleIconShim({ className }: { className?: string }) {
  return <Shapes className={className} />;
}

function LightbulbIconShim({ className }: { className?: string }) {
  return <Bell className={className} />;
}

function getPriceFormat(instrument: string) {
  const normalized = instrument.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const fiveDecimal = ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"];
  const threeDecimalForex = ["USDJPY"];
  const threeDecimal = ["XAUUSD", "OIL"];
  const oneDecimal = ["NAS100", "S&P500", "GER40", "UK100", "DOW30", "NIKKEI"];

  if (/^10Y/.test(normalized)) return { type: "price" as const, precision: 3, minMove: 0.001 };
  if (["VIX", "VXN"].includes(normalized)) return { type: "price" as const, precision: 2, minMove: 0.01 };
  if (/^(MNQ|NQ|MES|ES|M2K|RTY)/.test(normalized)) return { type: "price" as const, precision: 2, minMove: 0.25 };
  if (/^(MYM|YM)/.test(normalized)) return { type: "price" as const, precision: 0, minMove: 1 };
  if (/^(MGC|GC)/.test(normalized)) return { type: "price" as const, precision: 1, minMove: 0.1 };
  if (/^(MCL|CL)/.test(normalized)) return { type: "price" as const, precision: 2, minMove: 0.01 };
  if (fiveDecimal.includes(normalized)) return { type: "price" as const, precision: 5, minMove: 0.00001 };
  if (threeDecimalForex.includes(normalized)) return { type: "price" as const, precision: 3, minMove: 0.001 };
  if (threeDecimal.includes(normalized)) return { type: "price" as const, precision: 3, minMove: 0.001 };
  if (oneDecimal.includes(normalized)) return { type: "price" as const, precision: 1, minMove: 0.1 };
  return { type: "price" as const, precision: 2, minMove: 0.01 };
}

function withAlpha(color: string, alpha: number) {
  const match = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return color;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

const DEFAULT_VISIBLE_CANDLE_COUNT = 140;
const DEFAULT_RIGHT_CANDLE_PADDING = 8;
// Lightweight Charts already moves its canvases at the browser refresh rate.
// React only needs a bounded refresh cadence for the SVG/HTML studies that
// read coordinates from that native viewport. Re-rendering this very large
// component for every raw pan/zoom event makes pointer input monopolise the
// main thread, especially with several workspace charts mounted.
const VIEWPORT_REACT_REFRESH_INTERVAL_MS = 64;
let activeChartKeyboardTargetId: string | null = null;

function resetChartViewport(
  chart: IChartApi,
  candleSeries: CandleSeriesApi,
  candleCount: number,
  onSettled?: () => void,
) {
  candleSeries.priceScale().applyOptions({ autoScale: true });
  if (candleCount <= DEFAULT_VISIBLE_CANDLE_COUNT) {
    chart.timeScale().fitContent();
  } else {
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, candleCount - DEFAULT_VISIBLE_CANDLE_COUNT),
      to: candleCount + DEFAULT_RIGHT_CANDLE_PADDING,
    });
  }

  return window.requestAnimationFrame(() => {
    candleSeries.priceScale().applyOptions({ autoScale: false });
    onSettled?.();
  });
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function drawingsStorageKey(instrument: string, chartInstanceId: string) {
  return `kwantdesk:chart-drawings:v1:${chartInstanceId}:${instrument}`;
}

function toolbarDockStorageKey() {
  return "kwantdesk-chart-toolbar-dock-v2";
}

function toolbarCollapsedStorageKey() {
  return "kwantdesk-chart-toolbar-collapsed-v2";
}

function normalizeTimeValue(value: Time | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "year" in value) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
  }
  return null;
}

function formatChartTimestamp(
  value: Time,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  const timestamp = normalizeTimeValue(value);
  if (timestamp === null) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: normalizeTimeZone(timeZone),
    hour12: false,
    ...options,
  }).format(new Date(timestamp * 1_000));
}

function formatChartTick(value: Time, timeZone: string, timeframe?: string) {
  const intervalMs = timeframeToMs(timeframe);
  if (intervalMs && intervalMs >= 24 * 60 * 60_000) {
    return formatChartTimestamp(value, timeZone, {
      day: "2-digit",
      month: "short",
    });
  }
  return formatChartTimestamp(value, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDateRangeLabel(a: number, b: number) {
  const diffSeconds = Math.abs(b - a);
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = diffMinutes / 60;
  if (diffHours < 24) return `${diffHours.toFixed(diffHours >= 10 ? 0 : 1)}h`;
  const diffDays = diffHours / 24;
  return `${diffDays.toFixed(diffDays >= 10 ? 0 : 1)}d`;
}

function timeframeToMs(timeframe?: string) {
  const match = timeframe?.trim().match(/^(\d+)\s*(s|m|h|d|w|M|y|D|W|Y)$/);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2];
  if (unit === "s") return value * 1_000;
  if (unit === "m") return value * 60_000;
  if (unit === "h") return value * 60 * 60_000;
  if (unit === "d" || unit === "D") return value * 24 * 60 * 60_000;
  if (unit === "w" || unit === "W") return value * 7 * 24 * 60 * 60_000;
  if (unit === "M") return value * 30 * 24 * 60 * 60_000;
  if (unit === "y" || unit === "Y") return value * 365 * 24 * 60 * 60_000;
  return null;
}

function buildSafeChartData(
  candles: Candle[],
  preserveEventBars = false,
  sourceTimeByChartTime?: Map<number, number>,
  chartTimeBySourceTime?: Map<number, number>,
) {
  const byTime = new Map<number, {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
  }>();

  let previousChartTime = Number.NEGATIVE_INFINITY;
  sourceTimeByChartTime?.clear();
  chartTimeBySourceTime?.clear();

  for (const candle of candles) {
    const naturalTime = Math.floor(Number(candle.timestamp) / 1_000);
    const time = preserveEventBars
      ? Math.max(naturalTime, previousChartTime + 1)
      : naturalTime;
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    if (
      !Number.isFinite(time)
      || ![open, high, low, close].every(Number.isFinite)
    ) continue;
    previousChartTime = time;
    sourceTimeByChartTime?.set(time, Number(candle.timestamp));
    chartTimeBySourceTime?.set(Number(candle.timestamp), time);
    byTime.set(time, {
      time: time as Time,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
    });
  }

  return [...byTime.values()].sort(
    (left, right) => Number(left.time) - Number(right.time),
  );
}

function inferCandleIntervalMs(candles: Candle[]) {
  const diffs = candles
    .slice(-30)
    .map((candle, index, rows) => {
      if (index === 0) return 0;
      return candle.timestamp - rows[index - 1].timestamp;
    })
    .filter((diff) => Number.isFinite(diff) && diff > 0)
    .sort((a, b) => a - b);

  if (diffs.length === 0) return null;
  return diffs[Math.floor(diffs.length / 2)];
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function CandleCountdownBadge({
  candleIntervalMs,
  hasCandles,
  latestCandleRef,
  chartRef,
  marketIsActive,
  bottom = 56,
}: {
  candleIntervalMs: number | null;
  hasCandles: boolean;
  latestCandleRef: RefObject<Candle | null>;
  chartRef: RefObject<IChartApi | null>;
  marketIsActive?: boolean;
  bottom?: number;
}) {
  const [label, setLabel] = useState<string | null>(null);
  const [rightInset, setRightInset] = useState(76);

  useEffect(() => {
    if (!candleIntervalMs || candleIntervalMs <= 0 || !hasCandles) {
      setLabel(null);
      return;
    }

    const updateCountdown = () => {
      const lastCandle = latestCandleRef.current;
      if (!lastCandle || !Number.isFinite(lastCandle.timestamp)) {
        setLabel(null);
        return;
      }

      const now = Date.now();
      const nextFromLastCandle = lastCandle.timestamp + candleIntervalMs;
      const remainingMs =
        now <= nextFromLastCandle + candleIntervalMs
          ? Math.max(0, nextFromLastCandle - now)
          : candleIntervalMs - (now % candleIntervalMs || candleIntervalMs);
      const priceScaleWidth = chartRef.current?.priceScale("right").width() ?? 64;
      // Match the range selector's `left-3` inset: keep twelve pixels of
      // breathing room between this badge and the live right price scale.
      setRightInset(Math.max(76, Math.ceil(priceScaleWidth) + 12));
      setLabel(marketIsActive === false ? "-" : formatCountdown(remainingMs));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [candleIntervalMs, chartRef, hasCandles, latestCandleRef, marketIsActive]);

  if (!label) return null;

  return (
    <div
      className="pointer-events-none absolute z-10 flex h-3.5 w-[27px] items-center justify-center rounded-[3px] bg-primary px-0.5 font-mono text-[6px] font-semibold leading-none text-background shadow-sm shadow-black/25"
      style={{ bottom, right: rightInset }}
      title="Time until next candle opens"
    >
      {label}
    </div>
  );
}

function formatPriceDistance(entry: number, other: number, precision: number) {
  const diff = other - entry;
  const absolute = Math.abs(diff);
  const percent = entry !== 0 ? (absolute / entry) * 100 : 0;
  const sign = diff >= 0 ? "+" : "-";
  return `${sign}${absolute.toFixed(precision)} (${percent.toFixed(2)}%)`;
}

function groupToolsBySection(tools: ToolbarTool[]) {
  const grouped: Array<{ section: string; tools: ToolbarTool[] }> = [];
  for (const tool of tools) {
    const section = tool.section ?? "Tools";
    const current = grouped[grouped.length - 1];
    if (current && current.section === section) {
      current.tools.push(tool);
    } else {
      grouped.push({ section, tools: [tool] });
    }
  }
  return grouped;
}

function getToolbarButtonTone(active: boolean) {
  return active
    ? "border-primary/50 bg-primary/15 text-primary"
    : "border-transparent bg-transparent text-muted hover:bg-surface hover:text-foreground";
}

function getToolbarDockStyle(dock: ToolbarDock): CSSProperties {
  switch (dock) {
    case "right":
      return { right: 12, top: 64 };
    case "top":
      return { top: 12, left: "50%", transform: "translateX(-50%)" };
    case "bottom":
      return { bottom: 12, left: "50%", transform: "translateX(-50%)" };
    default:
      return { left: 12, top: 64 };
  }
}

function getToolbarMenuPositionClasses(dock: ToolbarDock) {
  switch (dock) {
    case "right":
      return "right-14 top-0";
    case "top":
      return "left-0 top-14";
    case "bottom":
      return "left-0 bottom-14";
    default:
      return "left-14 top-0";
  }
}

function getObjectsPanelStyle(dock: ToolbarDock): CSSProperties {
  switch (dock) {
    case "right":
      return { right: 64, top: 64 };
    case "top":
      return { left: 16, top: 72 };
    case "bottom":
      return { left: 16, bottom: 72 };
    default:
      return { left: 64, top: 64 };
  }
}

function getTextToolChrome(tool: DrawingToolId) {
  switch (tool) {
    case "note":
      return { title: "Add note", placeholder: "Write note...", fill: "rgba(245, 158, 11, 0.16)", stroke: "rgba(245, 158, 11, 0.8)", text: "#FEF3C7" };
    case "priceNote":
      return { title: "Add price note", placeholder: "Price note...", fill: "rgba(59, 130, 246, 0.16)", stroke: "rgba(59, 130, 246, 0.78)", text: "#DBEAFE" };
    case "callout":
      return { title: "Add callout", placeholder: "Callout...", fill: "rgba(16, 185, 129, 0.14)", stroke: "rgba(16, 185, 129, 0.78)", text: "#D1FAE5" };
    case "comment":
      return { title: "Add comment", placeholder: "Comment...", fill: "rgba(168, 85, 247, 0.14)", stroke: "rgba(168, 85, 247, 0.78)", text: "#F3E8FF" };
    case "priceLabel":
      return { title: "Add price label", placeholder: "Label...", fill: "rgba(99, 102, 241, 0.14)", stroke: "rgba(99, 102, 241, 0.78)", text: "#E0E7FF" };
    case "pin":
      return { title: "Add pin", placeholder: "Pinned note...", fill: "rgba(236, 72, 153, 0.14)", stroke: "rgba(236, 72, 153, 0.82)", text: "#FCE7F3" };
    case "signpost":
      return { title: "Add signpost", placeholder: "Signpost...", fill: "rgba(234, 179, 8, 0.14)", stroke: "rgba(234, 179, 8, 0.82)", text: "#FEF9C3" };
    case "flagMark":
      return { title: "Add flag mark", placeholder: "Flag note...", fill: "rgba(248, 113, 113, 0.14)", stroke: "rgba(248, 113, 113, 0.82)", text: "#FEE2E2" };
    default:
      return { title: "Add text", placeholder: "Add text...", fill: "rgba(24, 24, 27, 0.92)", stroke: "rgba(255, 255, 255, 0.12)", text: "#F4F4F5" };
  }
}

function lightweightIndicatorData(definition: CalculatedIndicatorSeries) {
  if (definition.kind !== "line") return definition.data as any[];
  return definition.data.map((point, index) => {
    const { breakBefore: _breakBefore, ...linePoint } = point;
    return definition.data[index + 1]?.breakBefore
      ? { ...linePoint, color: "rgba(0, 0, 0, 0)" }
      : linePoint;
  }) as any[];
}

export default function Chart({
  candles,
  marketTrades = [],
  trades,
  levels,
  zones = [],
  backgroundLevels = EMPTY_CHART_LEVELS,
  backgroundZones = [],
  instrument = "Instrument",
  chartInstanceId = "primary",
  keyboardActive = true,
  workspaceId = "default-workspace",
  contractSymbol = null,
  timeframe,
  marketIsActive,
  orderFlowHistoryReady = true,
  onOpenSettings,
  onCreateAlertAtPrice,
  onRemoveAllIndicators,
  indicators = [],
  classicGexProfile = null,
  classicGexHistory = [],
  classicGexLoading = false,
  classicGexError = null,
  expectedMoveCalibration = null,
  volumeProfiles = [],
  onUpdateIndicatorSetting,
  onOpenIndicatorSettings,
  settings = defaultChartSettings,
  toolbarEnabled = true,
  chartDragEnabled = false,
  onChartDragStart,
  gammaLevelsEnabled = false,
  gammaLevelsAvailable = false,
  gammaLevelsLoading = false,
  gammaLevelsError = null,
  onToggleGammaLevels,
  kwantLevelsEnabled = false,
  kwantLevelsAvailable = false,
  kwantLevelsLoading = false,
  onToggleKwantLevels,
  historicalStructureEnabled = false,
  historicalStructureAvailable = false,
  historicalStructureLoading = false,
  historicalStructureError = null,
  historicalStructureDescription = "",
  onToggleHistoricalStructure,
  valueAreaLevelsEnabled = false,
  valueAreaLevelsAvailable = false,
  valueAreaLevelsLoading = false,
  valueAreaLevelsDescription = "",
  onToggleValueAreaLevels,
  onRemoveGameplanOverlay,
  liveCandleEventKey,
  gexBotFlow = null,
  onIndicatorPaneHeightChange,
  paperPositions = [],
  paperFills = [],
  onUpdatePaperProtection,
  onPaperProtectionDragStateChange,
  onClosePaperPosition,
  onRemovePaperFills,
  onResetPaperTrading,
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);
  const prevCandlesLengthRef = useRef<number>(0);
  const prevDataRef = useRef<string>("");
  const prevFirstTimestampRef = useRef<number | null>(null);
  const tradesRef = useRef<(Trade & { markerVisible?: boolean })[]>([]);
  const levelsRef = useRef<ChartLevel[]>([]);
  const priceLinesRef = useRef<any[]>([]);
  const indicatorSeriesRefs = useRef<Array<{
    key: string;
    kind: "line" | "histogram";
    series: {
      setData: (data: any[]) => void;
      applyOptions: (options: Record<string, unknown>) => void;
    };
  }>>([]);
  const backgroundLevelsRef = useRef<ChartLevel[]>([]);
  const backgroundZonesRef = useRef<ChartZone[]>([]);
  const gameplanUnderlayRef = useRef<GameplanUnderlayPrimitive | null>(null);
  const fixedPriceLevelLabelsRef = useRef<FixedPriceLevelLabelsPrimitive | null>(null);
  const sessionHighLowPrimitiveRef = useRef<SessionHighLowPrimitive | null>(null);
  const sessionWindowPrimitiveRef = useRef<SessionWindowPrimitive | null>(null);
  const hedgeLevelsPrimitiveRef = useRef<HedgeLevelsPrimitive | null>(null);
  const sessionHighLowRenderDataRef = useRef<SessionHighLowRenderLevel[]>([]);
  const sessionWindowRenderDataRef = useRef<SessionWindowRenderData[]>([]);
  const volumeProfilePrimitiveRef = useRef<NativeVolumeProfilePrimitive | null>(null);
  const tpoProfilePrimitiveRef = useRef<TpoProfilePrimitive | null>(null);
  const classicGexProfilePrimitiveRef = useRef<ClassicGexProfilePrimitive | null>(null);
  const gammaHeatmapPrimitiveRef = useRef<GammaHeatmapPrimitive | null>(null);
  const netGammaExposurePrimitiveRef = useRef<NetGammaExposurePrimitive | null>(null);
  const previousNetGammaSnapshotRef = useRef<NetGammaProfileSnapshot | null>(null);
  const netGammaReservedRightOffsetRef = useRef<number | null>(null);
  const darkPoolMapPrimitiveRef = useRef<DarkPoolMapPrimitive | null>(null);
  const darkPoolAlertStateRef = useRef<{
    key: string;
    printIds: Set<string>;
    levelIds: Set<string>;
    zoneStates: Map<string, string>;
    lastFired: Map<string, number>;
  }>({ key: "", printIds: new Set(), levelIds: new Set(), zoneStates: new Map(), lastFired: new Map() });
  const bigTradesPrimitiveRef = useRef<BigTradesPrimitive | null>(null);
  const bigBlocksPrimitiveRef = useRef<BigBlocksPrimitive | null>(null);
  const smtDivergencePrimitiveRef = useRef<SmtDivergencePrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const retainedFootprintBarsRef = useRef<{ key: string; bars: FootprintRenderBar[] } | null>(null);
  const paperFillMarkersPrimitiveRef = useRef<PaperFillMarkersPrimitive | null>(null);
  const paperPositionOverlayPrimitiveRef = useRef<PaperPositionOverlayPrimitive | null>(null);
  const footprintActiveRef = useRef(false);
  const footprintBarWidthRef = useRef<number | null>(null);
  const [paperDragPreview, setPaperDragPreview] = useState<{ id: string; price: number } | null>(null);
  const [paperDraftProtection, setPaperDraftProtection] = useState<{
    id: string;
    kind: "stop_loss" | "take_profit";
    price: number;
    position: PaperPosition;
  } | null>(null);
  const horzLineRef = useRef<HTMLDivElement>(null);
  const priceLabelRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    price: string;
    tpoHit?: { instanceId: string; profileId: string };
  } | null>(null);
  const tpoBaseModelsRef = useRef<TpoPrimitiveModel[]>([]);
  const [tpoMergeRecords, setTpoMergeRecords] = useState<TpoMergeRecord[]>([]);
  const [tpoMergeHydratedKey, setTpoMergeHydratedKey] = useState<string | null>(null);
  const [tpoMergeSelection, setTpoMergeSelection] = useState<{
    instanceId: string;
    anchorProfileId: string;
  } | null>(null);
  const [tpoDataStatus, setTpoDataStatus] = useState<string | null>(null);
  const tpoProfileCacheRef = useRef(new Map<string, {
    trades: TpoTrade[];
    bars: TpoBar[];
    calculationKey: string;
    profiles: TpoProfileModel[];
  }>());
  const tpoMergeSelectionRef = useRef(tpoMergeSelection);
  const tpoMergeStorageKey = `kwantdesk:tpo-merges:v1:${chartInstanceId}:${instrument}`;
  const drawingPersistenceInstrument = `${instrument}::${chartInstanceId.slice(-16)}`;
  const [copiedPrice, setCopiedPrice] = useState(false);
  const [selectedTool, setSelectedTool] = useState<DrawingToolId>("cursor");
  const [crosshairSyncEnabled, setCrosshairSyncEnabled] = useState(false);
  const [openToolbarGroup, setOpenToolbarGroup] = useState<ToolbarGroupId | null>(null);
  const [favoriteToolIds, setFavoriteToolIds] = useState<DrawingToolId[]>([]);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const drawingsHydrationRef = useRef<{ instrument: string; ready: boolean }>({ instrument: "", ready: false });
  const [professionalDrawings, setProfessionalDrawings] = useState<ProfessionalDrawingRecord[]>([]);
  const professionalDrawingsRef = useRef<ProfessionalDrawingRecord[]>([]);
  const professionalDrawingsHydrationRef = useRef<{ instrument: string; ready: boolean }>({ instrument: "", ready: false });
  const professionalDrawingsLoadGenerationRef = useRef(0);
  const professionalDrawingManagerRef = useRef<DrawingManager | null>(null);
  const professionalDrawingPreviewRef = useRef<ProfessionalDrawing | null>(null);
  const professionalBrushDrawingRef = useRef<ProfessionalDrawing | null>(null);
  const professionalSuppressNextClickRef = useRef(false);
  const professionalPendingAnchorsRef = useRef<ProfessionalDrawingAnchor[]>([]);
  const professionalSyncSuppressedRef = useRef(false);
  const professionalUndoStackRef = useRef<ProfessionalDrawingRecord[][]>([]);
  const professionalRedoStackRef = useRef<ProfessionalDrawingRecord[][]>([]);
  const professionalClipboardRef = useRef<ProfessionalDrawingRecord | null>(null);
  const professionalUpdateHistoryOpenRef = useRef(false);
  const professionalUpdateHistoryTimerRef = useRef<number | null>(null);
  const selectedToolRef = useRef<DrawingToolId>("cursor");
  const crosshairSyncEnabledRef = useRef(crosshairSyncEnabled);
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [positionSettingsDrawingId, setPositionSettingsDrawingId] = useState<string | null>(null);
  const [drawingInteraction, setDrawingInteraction] = useState<DrawingInteraction | null>(null);
  const [hideDrawings, setHideDrawings] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [magnetMode, setMagnetMode] = useState<"off" | "weak" | "medium" | "strong">("medium");
  const magnetModeRef = useRef<"off" | "weak" | "medium" | "strong">("medium");
  const [keepDrawingMode, setKeepDrawingMode] = useState(false);
  const keepDrawingModeRef = useRef(false);
  const [selectedProfessionalDrawingId, setSelectedProfessionalDrawingId] = useState<string | null>(null);
  const [showDrawingSettings, setShowDrawingSettings] = useState(false);
  const [drawingTemplates, setDrawingTemplates] = useState<DrawingTemplate[]>([]);
  const drawingTemplatesRef = useRef<DrawingTemplate[]>([]);
  const [renamingDrawingTemplateId, setRenamingDrawingTemplateId] = useState<string | null>(null);
  const [drawingTemplateNameDraft, setDrawingTemplateNameDraft] = useState("");
  const [drawingHistoryRevision, setDrawingHistoryRevision] = useState(0);
  const [precisionClearRevision, setPrecisionClearRevision] = useState(0);
  const [toolbarDock, setToolbarDock] = useState<ToolbarDock>("left");
  const [toolbarDragPosition, setToolbarDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [showObjectsPanel, setShowObjectsPanel] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [textEditor, setTextEditor] = useState<{ x: number; y: number; time: number; price: number; value: string; tool: DrawingToolId } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [resetPaperTradingConfirm, setResetPaperTradingConfirm] = useState(false);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [nativePriceScaleWidth, setNativePriceScaleWidth] = useState(64);
  const [viewportVersion, setViewportVersion] = useState(0);
  const [chartVisualReady, setChartVisualReady] = useState(false);
  const [themeVersion, setThemeVersion] = useState(0);
  const [classicGexTooltip, setClassicGexTooltip] = useState<{
    x: number;
    y: number;
    row: ClassicGexProfileRow;
  } | null>(null);
  const [gammaHeatmapPayload, setGammaHeatmapPayload] = useState<GammaHeatmapPayload | null>(null);
  const [gammaHeatmapLoading, setGammaHeatmapLoading] = useState(false);
  const [gammaHeatmapError, setGammaHeatmapError] = useState<string | null>(null);
  const [gammaHeatmapTooltip, setGammaHeatmapTooltip] = useState<GammaHeatmapHit | null>(null);
  const [netGammaProfile, setNetGammaProfile] = useState<NetGammaProfileSnapshot | null>(null);
  const [netGammaLoading, setNetGammaLoading] = useState(false);
  const [netGammaError, setNetGammaError] = useState<string | null>(null);
  const [netGammaTooltip, setNetGammaTooltip] = useState<NetGammaExposureHit | null>(null);
  const [darkPoolMapPayload, setDarkPoolMapPayload] = useState<DarkPoolMapPayload | null>(null);
  const [darkPoolMapLoading, setDarkPoolMapLoading] = useState(false);
  const [darkPoolMapError, setDarkPoolMapError] = useState<string | null>(null);
  const [darkPoolMapTooltip, setDarkPoolMapTooltip] = useState<DarkPoolMapHit | null>(null);
  const [tpoPayload, setTpoPayload] = useState<TpoLevelsPayload | null>(null);
  const [tpoLoading, setTpoLoading] = useState(false);
  const [tpoError, setTpoError] = useState<string | null>(null);
  const [tpoTooltip, setTpoTooltip] = useState<{ x: number; y: number; zone: TpoZone } | null>(null);
  const [expectedMovePayload, setExpectedMovePayload] = useState<ExpectedMoveApiPayload | null>(null);
  const [expectedMoveLoading, setExpectedMoveLoading] = useState(false);
  const [expectedMoveError, setExpectedMoveError] = useState<string | null>(null);
  const [expectedMoveNow, setExpectedMoveNow] = useState(() => Date.now());
  const [expectedMoveLiveAnchor, setExpectedMoveLiveAnchor] = useState<number | null>(() => candles.at(-1)?.close ?? null);
  const [expectedMoveTooltip, setExpectedMoveTooltip] = useState<{ x: number; y: number; band: ExpectedMoveBand } | null>(null);
  const [hedgeLevelsPayload, setHedgeLevelsPayload] = useState<HedgeLevelsPayload | null>(null);
  const [hedgeLevelsLoading, setHedgeLevelsLoading] = useState(false);
  const [hedgeLevelsError, setHedgeLevelsError] = useState<string | null>(null);
  const [hedgeLevelsNow, setHedgeLevelsNow] = useState(() => Date.now());
  const [hedgeLevelsPulseIds, setHedgeLevelsPulseIds] = useState<string[]>([]);
  const [hedgeLevelsTooltip, setHedgeLevelsTooltip] = useState<{ x: number; y: number; level: HedgeChartLevel } | null>(null);
  const previousHedgeLevelsRef = useRef<HedgeChartLevel[] | null>(null);
  const [chartReadyRevision, setChartReadyRevision] = useState(0);
  const [sampledIndicatorCandles, setSampledIndicatorCandles] = useState(candles);
  const [sampledIndicatorMarketTrades, setSampledIndicatorMarketTrades] = useState(marketTrades);
  const [smtComparisonCandles, setSmtComparisonCandles] = useState<Candle[]>([]);
  const [indicatorPaneHeights, setIndicatorPaneHeights] = useState<Record<string, number>>({});
  const [collapsedIndicatorPanes, setCollapsedIndicatorPanes] = useState<Record<string, boolean>>({});
  const [indicatorPaneLayout, setIndicatorPaneLayout] = useState<IndicatorPaneLayoutMap>(() => {
    if (typeof window === "undefined" || !liveCandleEventKey) return {};
    try {
      const stored = window.localStorage.getItem(`kwantdesk:indicator-pane-layout:${liveCandleEventKey}`);
      return stored ? JSON.parse(stored) as IndicatorPaneLayoutMap : {};
    } catch {
      return {};
    }
  });
  const overlayRef = useRef<SVGSVGElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const viewportFrameRef = useRef<number | null>(null);
  const viewportRefreshTimerRef = useRef<number | null>(null);
  const viewportRefreshLastAtRef = useRef(0);
  const toolbarDragStateRef = useRef<{ offsetX: number; offsetY: number; startClientX: number; startClientY: number; hasMoved: boolean } | null>(null);
  const toolbarToggleSuppressedRef = useRef(false);
  const latestCandleRef = useRef<Candle | null>(candles.at(-1) ?? null);
  const drawingCandlesRef = useRef(candles);
  const drawingMarketTradesRef = useRef(marketTrades);
  const lastRenderedCandleTimeRef = useRef<number | null>(
    candles.length ? Math.floor(candles[candles.length - 1].timestamp / 1_000) : null,
  );
  const lastRenderedSourceTimestampRef = useRef<number | null>(
    candles.at(-1)?.timestamp ?? null,
  );
  const eventSourceTimeByChartTimeRef = useRef(new Map<number, number>());
  const eventChartTimeBySourceTimeRef = useRef(new Map<number, number>());
  const indicatorSampleTimerRef = useRef<number | null>(null);
  const liveVolumeSampleTimerRef = useRef<number | null>(null);
  const pendingLiveVolumeCandleRef = useRef<Candle | null>(null);
  const viewportResetFrameRef = useRef<number | null>(null);
  const chartVisualReadyTokenRef = useRef(0);
  const pendingIndicatorCandlesRef = useRef(candles);
  const pendingIndicatorMarketTradesRef = useRef(marketTrades);
  const sampledOrderFlowHistoryReadyRef = useRef(orderFlowHistoryReady);
  const updateIndicatorSettingRef = useRef(onUpdateIndicatorSetting);
  const openIndicatorSettingsRef = useRef(onOpenIndicatorSettings);
  const crosshairSyncInstrumentKey = chartCrosshairInstrumentKey(contractSymbol ?? instrument);
  const volumeIndicatorEnabled = useMemo(
    () => indicators.some((instance) => instance.enabled && instance.indicatorId === "volume"),
    [indicators],
  );
  const indicatorSamplingEnabled = useMemo(
    () => indicators.some((instance) => instance.enabled),
    [indicators],
  );
  const orderFlowIndicatorEnabled = useMemo(
    () => indicators.some((instance) =>
      instance.enabled && CHART_INDICATOR_BY_ID.get(instance.indicatorId)?.requiresOrderFlow),
    [indicators],
  );
  const footprintSamplingEnabled = useMemo(
    () => indicators.some((instance) =>
      instance.enabled && instance.indicatorId === "deep-print-footprint"),
    [indicators],
  );
  function resetViewportBeforeReveal(
    chart: IChartApi,
    candleSeries: CandleSeriesApi,
    candleCount: number,
  ) {
    const readyToken = chartVisualReadyTokenRef.current + 1;
    chartVisualReadyTokenRef.current = readyToken;
    setChartVisualReady(false);
    if (viewportResetFrameRef.current !== null) {
      window.cancelAnimationFrame(viewportResetFrameRef.current);
    }
    viewportResetFrameRef.current = resetChartViewport(
      chart,
      candleSeries,
      candleCount,
      () => {
        viewportResetFrameRef.current = null;
        if (chartVisualReadyTokenRef.current === readyToken) {
          setChartVisualReady(true);
        }
      },
    );
  }

  const returnToLiveViewport = useCallback(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;
    if (viewportResetFrameRef.current !== null) {
      window.cancelAnimationFrame(viewportResetFrameRef.current);
    }
    viewportResetFrameRef.current = resetChartViewport(
      chart,
      candleSeries,
      drawingCandlesRef.current.length,
      () => {
        viewportResetFrameRef.current = null;
        setViewportVersion((current) => current + 1);
      },
    );
  }, []);

  useEffect(() => {
    drawingCandlesRef.current = candles;
    drawingMarketTradesRef.current = marketTrades;
    professionalDrawingManagerRef.current?.getAllDrawings().forEach((drawing) => drawing.requestUpdate());
  }, [candles, marketTrades]);

  useEffect(() => {
    const handleThemeChange = () => setThemeVersion((version) => version + 1);
    window.addEventListener("kwantdesk:theme-change", handleThemeChange);
    return () => window.removeEventListener("kwantdesk:theme-change", handleThemeChange);
  }, []);

  useEffect(() => {
    const handleToggle = (event: Event) => {
      setCrosshairSyncEnabled(Boolean((event as CustomEvent<boolean>).detail));
    };
    setCrosshairSyncEnabled(readChartCrosshairSyncEnabled());
    window.addEventListener(CHART_CROSSHAIR_SYNC_TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(CHART_CROSSHAIR_SYNC_TOGGLE_EVENT, handleToggle);
  }, []);

  useEffect(() => {
    crosshairSyncEnabledRef.current = crosshairSyncEnabled;
    if (!crosshairSyncEnabled) {
      chartRef.current?.clearCrosshairPosition();
      if (horzLineRef.current) horzLineRef.current.style.display = "none";
      if (priceLabelRef.current) priceLabelRef.current.style.display = "none";
    }
  }, [crosshairSyncEnabled]);

  useEffect(() => {
    if (selectedTool !== "cursor" && selectedTool !== "selection" && !precisionToolForDrawingTool(selectedTool)) {
      claimChartInteraction("legacy-tools");
    }
  }, [selectedTool]);

  useEffect(() => subscribeChartInteractionOwner((owner) => {
    if (owner !== "precision-tools") return;
    setDraftDrawing(null);
    setDrawingInteraction(null);
    setTextEditor(null);
    setOpenToolbarGroup(null);
    professionalPendingAnchorsRef.current = [];
    professionalBrushDrawingRef.current = null;
    professionalDrawingPreviewRef.current = null;
    professionalDrawingManagerRef.current?.removeDrawing("__kwantdesk_drawing_preview__");
    setSelectedTool("cursor");
  }), []);

  useEffect(() => {
    if (!liveCandleEventKey) return;
    let pendingCandle: Candle | null = null;
    let frame: number | null = null;
    const flush = () => {
      frame = null;
      const candle = pendingCandle;
      pendingCandle = null;
      if (!candle || !candleSeriesRef.current) return;
      const eventBased = timeframeToMs(timeframe) === null;
      const naturalTime = Math.floor(candle.timestamp / 1_000);
      const sameSourceBar = lastRenderedSourceTimestampRef.current === candle.timestamp;
      const candleTime = eventBased && lastRenderedCandleTimeRef.current !== null
        ? sameSourceBar
          ? lastRenderedCandleTimeRef.current
          : Math.max(naturalTime, lastRenderedCandleTimeRef.current + 1)
        : naturalTime;
      if (
        lastRenderedCandleTimeRef.current !== null
        && candleTime < lastRenderedCandleTimeRef.current
      ) return;
      try {
        candleSeriesRef.current.update({
          time: candleTime as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        });
        paperPositionOverlayPrimitiveRef.current?.updateMarkPrice(candle.close);
        footprintPrimitiveRef.current?.updateLiveCandle({
          time: candleTime as Time,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          tickSize: getPriceFormat(instrument).minMove,
        });
        lastRenderedCandleTimeRef.current = candleTime;
        lastRenderedSourceTimestampRef.current = candle.timestamp;
        if (eventBased) {
          eventSourceTimeByChartTimeRef.current.set(candleTime, candle.timestamp);
          eventChartTimeBySourceTimeRef.current.set(candle.timestamp, candleTime);
        }
      } catch {
        // A late tick from a cancelled timeframe must never take down the chart.
      }
    };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<LiveChartCandleDetail>).detail;
      if (!detail || detail.key !== liveCandleEventKey) return;
      pendingCandle = detail.candle;
      latestCandleRef.current = detail.candle;
      if (volumeIndicatorEnabled || footprintSamplingEnabled) {
        pendingLiveVolumeCandleRef.current = detail.candle;
        if (liveVolumeSampleTimerRef.current === null) {
          // Volume and footprint geometry should visibly develop with the
          // live candle, while heavier tape aggregation stays independently sampled.
          liveVolumeSampleTimerRef.current = window.setTimeout(() => {
            liveVolumeSampleTimerRef.current = null;
            const liveVolumeCandle = pendingLiveVolumeCandleRef.current;
            pendingLiveVolumeCandleRef.current = null;
            if (liveVolumeCandle) {
              setSampledIndicatorCandles((current) =>
                mergeLiveIndicatorCandle(current, liveVolumeCandle));
            }
          }, 80);
        }
      }
      if (frame === null) frame = window.requestAnimationFrame(flush);
    };
    window.addEventListener(LIVE_CHART_CANDLE_EVENT, receive);
    return () => {
      window.removeEventListener(LIVE_CHART_CANDLE_EVENT, receive);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (liveVolumeSampleTimerRef.current !== null) {
        window.clearTimeout(liveVolumeSampleTimerRef.current);
        liveVolumeSampleTimerRef.current = null;
      }
      pendingLiveVolumeCandleRef.current = null;
    };
  }, [footprintSamplingEnabled, instrument, liveCandleEventKey, timeframe, volumeIndicatorEnabled]);

  useEffect(() => {
    updateIndicatorSettingRef.current = onUpdateIndicatorSetting;
    openIndicatorSettingsRef.current = onOpenIndicatorSettings;
  }, [onOpenIndicatorSettings, onUpdateIndicatorSetting]);

  useEffect(() => {
    tpoMergeSelectionRef.current = tpoMergeSelection;
  }, [tpoMergeSelection]);

  useEffect(() => {
    setTpoMergeHydratedKey(null);
    try {
      const raw = window.localStorage.getItem(tpoMergeStorageKey);
      if (!raw) {
        setTpoMergeRecords([]);
        setTpoMergeHydratedKey(tpoMergeStorageKey);
        return;
      }
      const parsed = JSON.parse(raw) as TpoMergeRecord[];
      setTpoMergeRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTpoMergeRecords([]);
    }
    setTpoMergeHydratedKey(tpoMergeStorageKey);
  }, [tpoMergeStorageKey]);

  useEffect(() => {
    if (tpoMergeHydratedKey !== tpoMergeStorageKey) return;
    try {
      if (tpoMergeRecords.length) {
        window.localStorage.setItem(tpoMergeStorageKey, JSON.stringify(tpoMergeRecords));
      } else {
        window.localStorage.removeItem(tpoMergeStorageKey);
      }
    } catch {
      // Workspace storage is best-effort; the live profile must remain usable.
    }
  }, [tpoMergeHydratedKey, tpoMergeRecords, tpoMergeStorageKey]);

  useEffect(() => {
    const previousCandles = pendingIndicatorCandlesRef.current;
    const historyShapeChanged = (
      previousCandles.length !== candles.length
      || previousCandles[0]?.timestamp !== candles[0]?.timestamp
    );
    const orderFlowHydrated = (
      orderFlowHistoryReady
      && !sampledOrderFlowHistoryReadyRef.current
    );
    pendingIndicatorCandlesRef.current = candles;
    pendingIndicatorMarketTradesRef.current = marketTrades;
    sampledOrderFlowHistoryReadyRef.current = orderFlowHistoryReady;
    if (!indicatorSamplingEnabled) return;
    // Historical hydration is not a live-tick update. Paint Volume/CVD from
    // the same completed candle snapshot immediately, otherwise the price
    // chart appears first and CVD remains as its old flat/live-only sample for
    // another timer cycle after refresh.
    if (historyShapeChanged || orderFlowHydrated) {
      if (indicatorSampleTimerRef.current !== null) {
        window.clearTimeout(indicatorSampleTimerRef.current);
        indicatorSampleTimerRef.current = null;
      }
      setSampledIndicatorCandles(candles);
      if (orderFlowIndicatorEnabled) setSampledIndicatorMarketTrades(marketTrades);
      return;
    }
    if (indicatorSampleTimerRef.current !== null) return;
    indicatorSampleTimerRef.current = window.setTimeout(() => {
      indicatorSampleTimerRef.current = null;
      const pendingCandles = pendingIndicatorCandlesRef.current;
      const liveIndicatorCandle = volumeIndicatorEnabled || footprintSamplingEnabled
        ? latestCandleRef.current
        : null;
      setSampledIndicatorCandles(liveIndicatorCandle
        ? mergeLiveIndicatorCandle(pendingCandles, liveIndicatorCandle)
        : pendingCandles);
      if (orderFlowIndicatorEnabled) {
        setSampledIndicatorMarketTrades(pendingIndicatorMarketTradesRef.current);
      }
    // The candle itself continues to render tick-by-tick. Footprint FPS is a
    // canvas paint preference, not permission to copy and aggregate a 55k
    // execution tape 30/60/120 times per second.
    }, footprintSamplingEnabled
      ? FOOTPRINT_DATA_REFRESH_INTERVAL_MS
      : ORDER_FLOW_DATA_REFRESH_INTERVAL_MS);
  }, [
    candles,
    footprintSamplingEnabled,
    indicatorSamplingEnabled,
    marketTrades,
    orderFlowHistoryReady,
    orderFlowIndicatorEnabled,
    volumeIndicatorEnabled,
  ]);

  useEffect(() => () => {
    if (indicatorSampleTimerRef.current !== null) {
      window.clearTimeout(indicatorSampleTimerRef.current);
      indicatorSampleTimerRef.current = null;
    }
    if (professionalUpdateHistoryTimerRef.current !== null) {
      window.clearTimeout(professionalUpdateHistoryTimerRef.current);
      professionalUpdateHistoryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!openToolbarGroup) return;
    const dismissToolbarMenu = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && toolbarRef.current?.contains(target)) return;
      setOpenToolbarGroup(null);
    };
    const dismissToolbarMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenToolbarGroup(null);
    };
    document.addEventListener("pointerdown", dismissToolbarMenu, true);
    document.addEventListener("keydown", dismissToolbarMenuWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", dismissToolbarMenu, true);
      document.removeEventListener("keydown", dismissToolbarMenuWithKeyboard);
    };
  }, [openToolbarGroup]);

  const priceFormat = useMemo(() => getPriceFormat(instrument), [instrument]);
  const drawingMarketDataSource = useMemo<KwantMarketDataSource>(() => ({
    bars: () => drawingCandlesRef.current.map((bar) => ({
      ...bar,
      timestamp: (eventChartTimeBySourceTimeRef.current.get(bar.timestamp)
        ?? eventChartTimeBySourceTimeRef.current.get(Math.floor(bar.timestamp / 1_000))
        ?? Math.floor(bar.timestamp / 1_000)) * 1_000,
    })),
    trades: () => drawingMarketTradesRef.current.map((trade) => ({
      timestamp: (eventChartTimeBySourceTimeRef.current.get(trade.timestamp)
        ?? eventChartTimeBySourceTimeRef.current.get(Math.floor(trade.timestamp / 1_000))
        ?? Math.floor(trade.timestamp / 1_000)) * 1_000,
      price: trade.close,
      volume: trade.volume,
      bidVolume: trade.bidVolume,
      askVolume: trade.askVolume,
    })),
    tickSize: priceFormat.minMove,
    upColor: settings.upColor,
    downColor: settings.downColor,
  }), [priceFormat.minMove, settings.downColor, settings.upColor]);
  const resolvedLevelLayers = useMemo(
    () => resolveChartLevelOverlaps(levels ?? [], backgroundLevels, priceFormat.minMove),
    [backgroundLevels, levels, priceFormat.minMove],
  );
  const indicatorSignature = useMemo(() => JSON.stringify(indicators), [indicators]);
  const smtDivergenceIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "divergence-detector") ?? null,
    [indicators],
  );
  const smtDivergenceEnabled = smtDivergenceIndicator !== null;
  const smtDivergenceSettings = useMemo<SmtDivergenceSettings>(() => {
    const source = smtDivergenceIndicator?.settings ?? {};
    return {
      pivotStrength: Math.max(1, Math.round(Number(source.pivotStrength ?? 3))),
      synchronizationBars: Math.max(1, Math.round(Number(source.synchronizationBars ?? 3))),
      minimumSwingBars: Math.max(1, Math.round(Number(source.minimumSwingBars ?? 3))),
      maximumLookbackBars: Math.max(100, Math.round(Number(source.maximumLookbackBars ?? 1200))),
      minimumMoveTicks: Math.max(0, Number(source.minimumMoveTicks ?? 1)),
      maximumSignals: Math.max(1, Math.round(Number(source.maximumSignals ?? 24))),
      includeNonConfirmation: source.includeNonConfirmation !== false,
      showBullish: source.showBullish !== false,
      showBearish: source.showBearish !== false,
    };
  }, [smtDivergenceIndicator]);
  const smtPrimaryMarket = useMemo(() => resolveSmtMarket(instrument), [instrument]);
  const smtComparisonMarket = useMemo(() => comparisonSmtMarket(instrument), [instrument]);

  useEffect(() => {
    if (!smtDivergenceEnabled || !smtPrimaryMarket || !smtComparisonMarket) {
      setSmtComparisonCandles([]);
      return;
    }
    setSmtComparisonCandles([]);
    let cancelled = false;
    let requestInFlight = false;
    const selectedTimeframe = timeframe ?? "1m";
    const hydrateComparison = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      const comparisonCandles = await loadSmtComparisonCandles(
        smtComparisonMarket,
        selectedTimeframe,
        smtDivergenceSettings.maximumLookbackBars + smtDivergenceSettings.pivotStrength * 2 + 20,
      );
      requestInFlight = false;
      if (cancelled || !comparisonCandles.length) return;
      setSmtComparisonCandles((current) => {
        const hydratedLast = comparisonCandles.at(-1);
        const currentLast = current.at(-1);
        if (!hydratedLast || !currentLast || currentLast.timestamp < hydratedLast.timestamp) return comparisonCandles;
        if (currentLast.timestamp === hydratedLast.timestamp) {
          return [
            ...comparisonCandles.slice(0, -1),
            {
              ...hydratedLast,
              high: Math.max(hydratedLast.high, currentLast.high),
              low: Math.min(hydratedLast.low, currentLast.low),
              close: currentLast.close,
            },
          ];
        }
        return [
          ...comparisonCandles,
          ...current.filter((candle) => candle.timestamp > hydratedLast.timestamp),
        ].slice(-(smtDivergenceSettings.maximumLookbackBars + 40));
      });
    };

    void hydrateComparison();
    const refreshTimer = window.setInterval(
      () => void hydrateComparison(),
      marketIsActive === false ? 60_000 : 12_000,
    );
    let pendingComparisonUpdate: { bucket: number; high: number; low: number; close: number } | null = null;
    let comparisonSampleTimer: number | null = null;
    const flushComparisonTick = () => {
      comparisonSampleTimer = null;
      const pending = pendingComparisonUpdate;
      pendingComparisonUpdate = null;
      if (!pending) return;
      const { bucket, high, low, close } = pending;
      setSmtComparisonCandles((current) => {
        const latest = current.at(-1);
        if (!latest) return [{ timestamp: bucket, open: close, high, low, close, volume: 0 }];
        if (bucket < latest.timestamp) return current;
        if (bucket > latest.timestamp) {
          return [...current, {
            timestamp: bucket,
            open: latest.close,
            high: Math.max(latest.close, high),
            low: Math.min(latest.close, low),
            close,
            volume: 0,
          }].slice(-(smtDivergenceSettings.maximumLookbackBars + 40));
        }
        return [
          ...current.slice(0, -1),
          {
            ...latest,
            high: Math.max(latest.high, high),
            low: Math.min(latest.low, low),
            close,
          },
        ];
      });
    };
    const receiveComparisonTick = (event: Event) => {
      const detail = (event as CustomEvent<DatabentoLiveTick>).detail;
      if (!detail || resolveSmtMarket(detail.instrument) !== smtComparisonMarket) return;
      const price = Number(detail.mid);
      const intervalMs = timeframeToMs(selectedTimeframe);
      if (!Number.isFinite(price) || price <= 0 || intervalMs === null || intervalMs >= 24 * 60 * 60_000) return;
      const timestampText = String(detail.timestamp ?? "").trim();
      const rawTimestamp = typeof detail.timestamp === "number"
        ? detail.timestamp
        : /^\d+$/.test(timestampText)
          ? Number(timestampText)
          : Date.parse(timestampText);
      if (!Number.isFinite(rawTimestamp)) return;
      const timestampMs = rawTimestamp < 10_000_000_000
        ? rawTimestamp * 1_000
        : rawTimestamp > 10_000_000_000_000_000
          ? Math.floor(rawTimestamp / 1_000_000)
          : rawTimestamp > 10_000_000_000_000
            ? Math.floor(rawTimestamp / 1_000)
            : rawTimestamp;
      const bucket = Math.floor(timestampMs / intervalMs) * intervalMs;
      if (pendingComparisonUpdate && pendingComparisonUpdate.bucket !== bucket) {
        if (comparisonSampleTimer !== null) window.clearTimeout(comparisonSampleTimer);
        flushComparisonTick();
      }
      pendingComparisonUpdate = pendingComparisonUpdate?.bucket === bucket
        ? {
            bucket,
            high: Math.max(pendingComparisonUpdate.high, price),
            low: Math.min(pendingComparisonUpdate.low, price),
            close: price,
          }
        : { bucket, high: price, low: price, close: price };
      if (comparisonSampleTimer === null) comparisonSampleTimer = window.setTimeout(flushComparisonTick, 120);
    };
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveComparisonTick);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      if (comparisonSampleTimer !== null) window.clearTimeout(comparisonSampleTimer);
      comparisonSampleTimer = null;
      pendingComparisonUpdate = null;
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveComparisonTick);
    };
  }, [
    marketIsActive,
    smtComparisonMarket,
    smtDivergenceEnabled,
    smtDivergenceSettings.maximumLookbackBars,
    smtDivergenceSettings.pivotStrength,
    smtPrimaryMarket,
    timeframe,
  ]);

  const smtDivergenceSignals = useMemo(() => {
    if (!smtDivergenceEnabled || !smtPrimaryMarket || !smtComparisonMarket) return [];
    return calculateSmtDivergences({
      primaryCandles: sampledIndicatorCandles,
      comparisonCandles: smtComparisonCandles,
      primaryMarket: smtPrimaryMarket,
      comparisonMarket: smtComparisonMarket,
      tickSize: priceFormat.minMove,
      settings: smtDivergenceSettings,
    });
  }, [
    priceFormat.minMove,
    sampledIndicatorCandles,
    smtComparisonCandles,
    smtComparisonMarket,
    smtDivergenceEnabled,
    smtDivergenceSettings,
    smtPrimaryMarket,
  ]);
  const smtDivergencePrimitiveOptions = useMemo<SmtDivergencePrimitiveOptions>(() => {
    const source = smtDivergenceIndicator?.settings ?? {};
    const useThemeColors = source.useThemeColors !== false;
    return {
      bullishColor: useThemeColors ? settings.upColor : String(source.bullishColor ?? settings.upColor),
      bearishColor: useThemeColors ? settings.downColor : String(source.bearishColor ?? settings.downColor),
      lineWidth: Math.max(1, Number(source.lineWidth ?? 2)),
      opacity: Math.max(0.1, Math.min(1, Number(source.opacity ?? 92) / 100)),
      showLabels: source.showLabels !== false,
      showPivotDots: source.showPivotDots !== false,
      labelFontSize: Math.max(8, Number(source.labelFontSize ?? 10)),
      dashedLines: source.dashedLines === true,
    };
  }, [settings.downColor, settings.upColor, smtDivergenceIndicator]);
  const tpoCalculationSignature = useMemo(() => JSON.stringify(indicators
    .filter((instance) => instance.indicatorId === "tpo-chart" || instance.indicatorId === "weekly-tpo")
    .map((instance) => {
      const variant = instance.indicatorId === "weekly-tpo" ? "weekly-tpo" : "daily-tpo";
      return {
        instanceId: instance.instanceId,
        enabled: instance.enabled,
        settings: tpoCalculationSettingsKey(validateTpoSettings(instance.settings, variant)),
      };
    })), [indicators]);
  const [settledTpoIndicators, setSettledTpoIndicators] = useState(indicators);
  const latestIndicatorsRef = useRef(indicators);
  latestIndicatorsRef.current = indicators;
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledTpoIndicators(latestIndicatorsRef.current), 90);
    return () => window.clearTimeout(timer);
  }, [tpoCalculationSignature]);
  const indicatorHistoryLimit = useMemo(
    () => indicators.some((instance) =>
      instance.enabled && CHART_INDICATOR_BY_ID.get(instance.indicatorId)?.requiresOrderFlow)
      ? 10_000
      : smtDivergenceEnabled
        ? Math.max(1_500, Math.min(5_000, smtDivergenceSettings.maximumLookbackBars))
        : 1_500,
    [indicators, smtDivergenceEnabled, smtDivergenceSettings.maximumLookbackBars],
  );
  const indicatorWindowCandles = useMemo(
    () => sampledIndicatorCandles.slice(-indicatorHistoryLimit),
    [indicatorHistoryLimit, sampledIndicatorCandles],
  );
  const indicatorMarketTrades = useMemo(() => {
    if (!indicatorWindowCandles.length || !sampledIndicatorMarketTrades.length) return [];
    const firstTimestamp = indicatorWindowCandles[0].timestamp;
    // Execution tapes can contain tens of thousands of prints after Charts
    // has been open for a while. Every study only needs prints that can map to
    // the retained indicator candles, so discard the unreachable prefix with
    // one binary search before running Big Trades, CVD, imbalances and stats.
    let low = 0;
    let high = sampledIndicatorMarketTrades.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (sampledIndicatorMarketTrades[middle].timestamp < firstTimestamp) low = middle + 1;
      else high = middle;
    }
    return sampledIndicatorMarketTrades.slice(low);
  }, [indicatorWindowCandles, sampledIndicatorMarketTrades]);
  // Time bars arrive with exact aggressor-volume fields and are updated from
  // every live execution by the workspace feed. The separate execution tape
  // is intentionally sampled for print-based studies such as Big Trades; it
  // must never be folded back into CVD or it will replace exact history with a
  // biased subset of large prints.
  const indicatorCandles = indicatorWindowCandles;
  const tpoSourceTrades = useMemo<TpoTrade[]>(() => {
    const tickSize = priceFormat.minMove;
    return sampledIndicatorMarketTrades
      .filter((trade) => !trade.flowOnly && Number.isFinite(trade.close) && trade.volume > 0)
      .map((trade) => ({
        instrumentId: instrument,
        timestampMs: trade.timestamp,
        sequence: trade.eventId ?? trade.recordIndex,
        price: trade.close,
        size: trade.volume,
        aggressorSide: trade.aggressor === "BUY" ? "buy" as const : trade.aggressor === "SELL" ? "sell" as const : "unknown" as const,
        tickSize,
      }));
  }, [instrument, priceFormat.minMove, sampledIndicatorMarketTrades]);
  const footprintIndicator = useMemo(
    () => indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "deep-print-footprint") ?? null,
    [indicatorSignature, indicators],
  );
  const footprintSettings = useMemo(
    () => footprintIndicator?.settings ?? {},
    [footprintIndicator],
  );
  const footprintCandles = useMemo(
    () => footprintIndicator ? sampledIndicatorCandles.slice(-indicatorHistoryLimit) : [],
    [footprintIndicator, indicatorHistoryLimit, sampledIndicatorCandles],
  );
  const footprintVisibleCandles = useMemo(() => {
    if (!footprintIndicator || !footprintCandles.length) return [];
    const logical = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (!logical) return footprintCandles.slice(-160);
    const sourceOffset = candles.length - footprintCandles.length;
    const first = Math.max(0, Math.floor(Number(logical.from)) - sourceOffset - 8);
    const last = Math.min(footprintCandles.length, Math.ceil(Number(logical.to)) - sourceOffset + 9);
    return first < last ? footprintCandles.slice(first, last) : footprintCandles.slice(-160);
  }, [candles.length, footprintCandles, footprintIndicator, viewportVersion]);
  const footprintSourceCandles = useMemo(() => {
    if (!footprintIndicator) return [];
    return footprintVisibleCandles;
  }, [footprintIndicator, footprintVisibleCandles]);
  const footprintMarketTrades = useMemo(() => {
    if (!footprintSourceCandles.length || !sampledIndicatorMarketTrades.length) return [];
    const start = footprintSourceCandles[0].timestamp;
    const finalCandle = footprintSourceCandles.at(-1)!;
    const approximateInterval = timeframeToMs(timeframe)
      ?? Math.max(1, finalCandle.timestamp - (footprintSourceCandles.at(-2)?.timestamp ?? finalCandle.timestamp - 60_000));
    const end = finalCandle.timestamp + approximateInterval;
    const lowerBound = (timestamp: number) => {
      let low = 0;
      let high = sampledIndicatorMarketTrades.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (sampledIndicatorMarketTrades[middle].timestamp < timestamp) low = middle + 1;
        else high = middle;
      }
      return low;
    };
    return sampledIndicatorMarketTrades.slice(lowerBound(start), lowerBound(end));
  }, [footprintSourceCandles, sampledIndicatorMarketTrades, timeframe]);
  const resolvedFootprintGroupTicks = useMemo(() => {
    const manual = Math.max(1, Math.round(Number(footprintSettings.manualTicks ?? 1)));
    if (footprintSettings.groupingMode === "manual") return manual;
    const series = candleSeriesRef.current;
    const reference = footprintVisibleCandles.at(-1)?.close;
    if (!series || !reference || !Number.isFinite(reference)) return manual;
    const firstY = series.priceToCoordinate(reference);
    const secondY = series.priceToCoordinate(reference + priceFormat.minMove);
    if (firstY === null || secondY === null) return manual;
    const pixelsPerTick = Math.max(0.01, Math.abs(secondY - firstY));
    const targetPixels = Math.max(8, Number(footprintSettings.fontSize ?? 10) * 1.05);
    const factor = Math.max(0.5, Math.min(4, Number(footprintSettings.autoGroupFactor ?? 1)));
    let grouped = Math.max(1, Math.ceil(targetPixels / pixelsPerTick * factor));
    if (footprintSettings.groupMode === "open-close") {
      const latest = footprintVisibleCandles.at(-1);
      if (latest) {
        const bodyTicks = Math.abs(latest.close - latest.open) / Math.max(priceFormat.minMove, 0.000001);
        grouped = Math.max(grouped, Math.ceil(bodyTicks / 18));
      }
    }
    return Math.min(100, grouped);
  }, [
    chartReadyRevision,
    footprintSettings.autoGroupFactor,
    footprintSettings.fontSize,
    footprintSettings.groupMode,
    footprintSettings.groupingMode,
    footprintSettings.manualTicks,
    footprintVisibleCandles,
    priceFormat.minMove,
    viewportVersion,
  ]);
  const footprintBars = useMemo(() => {
    if (!footprintIndicator || !footprintSourceCandles.length) return [];
    return buildFootprintBars(footprintSourceCandles, footprintMarketTrades, {
      tickSize: priceFormat.minMove,
      groupTicks: resolvedFootprintGroupTicks,
      instrument,
      minimumTradeVolume: Number(footprintSettings.minimumTradeVolume ?? 0),
      maximumTradeVolume: Number(footprintSettings.maximumTradeVolume ?? 0),
      imbalanceMode: (["diagonal", "horizontal", "delta-percent"].includes(String(footprintSettings.imbalanceMode))
        ? String(footprintSettings.imbalanceMode)
        : "diagonal") as FootprintImbalanceMode,
      minimumImbalancePercent: Number(footprintSettings.minimumImbalancePercent ?? 300),
      minimumDelta: Number(footprintSettings.minimumDelta ?? 0),
      includeZero: footprintSettings.includeZero === true,
      showEmptyPriceRows: footprintSettings.showEmptyPriceRows === true,
      valueAreaPercent: Number(footprintSettings.valueAreaPercent ?? 0.7),
      minimumDominantVolume: Number(footprintSettings.minimumDominantVolume ?? 10),
      stackedImbalanceLevels: Number(footprintSettings.stackedImbalanceLevels ?? 3),
      unfinishedAuctionEnabled: footprintSettings.unfinishedAuctionEnabled === true,
      unfinishedAuctionMinimumVolume: Number(footprintSettings.unfinishedAuctionMinimumVolume ?? 1),
    });
  }, [
    footprintIndicator,
    footprintSettings.imbalanceMode,
    footprintSettings.includeZero,
    footprintSettings.showEmptyPriceRows,
    footprintSettings.maximumTradeVolume,
    footprintSettings.minimumDelta,
    footprintSettings.minimumDominantVolume,
    footprintSettings.minimumImbalancePercent,
    footprintSettings.minimumTradeVolume,
    footprintSettings.stackedImbalanceLevels,
    footprintSettings.unfinishedAuctionEnabled,
    footprintSettings.unfinishedAuctionMinimumVolume,
    footprintSettings.valueAreaPercent,
    footprintSourceCandles,
    footprintMarketTrades,
    instrument,
    priceFormat.minMove,
    resolvedFootprintGroupTicks,
    timeframe,
  ]);
  const footprintRenderBars = useMemo((): FootprintRenderBar[] =>
    footprintBars.map((bar) => ({
      ...bar,
      time: (eventChartTimeBySourceTimeRef.current.get(bar.timestamp)
        ?? Math.floor(bar.timestamp / 1_000)) as Time,
    })), [footprintBars]);
  const footprintDataKey = `${instrument}:${timeframe}`;
  const liveFootprintRenderBars = useMemo(
    () => retainLiveFootprintRows(
      footprintRenderBars,
      retainedFootprintBarsRef.current?.key === footprintDataKey
        ? retainedFootprintBarsRef.current.bars
        : [],
    ),
    [footprintDataKey, footprintRenderBars],
  );
  useEffect(() => {
    if (!footprintIndicator) {
      retainedFootprintBarsRef.current = null;
      return;
    }
    if (liveFootprintRenderBars.some((bar) => bar.hasPriceLevelFlow)) {
      retainedFootprintBarsRef.current = { key: footprintDataKey, bars: liveFootprintRenderBars };
    }
  }, [footprintDataKey, footprintIndicator, liveFootprintRenderBars]);
  const footprintPrimitiveOptions = useMemo((): FootprintPrimitiveOptions => {
    const useThemeColors = footprintSettings.useThemeColors !== false;
    const option = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) =>
      allowed.includes(String(value) as T) ? String(value) as T : fallback;
    return {
      contentMode: option(
        footprintSettings.contentMode ?? footprintSettings.type,
        ["bid-ask", "delta", "volume", "volume-delta", "trades", "bid-ask-histogram", "volume-histogram", "delta-histogram", "ladder"],
        "bid-ask",
      ),
      visualizationMode: option(
        footprintSettings.visualizationMode,
        ["solid", "heatmap", "histogram", "heatmap-histogram", "text-only"],
        "heatmap-histogram",
      ),
      scaleMode: option(
        footprintSettings.scaleMode,
        ["per-bar", "all-loaded", "visible-region", "fixed-maximum"],
        "visible-region",
      ),
      numberFormat: option(
        footprintSettings.numberFormat ?? footprintSettings.textFormat,
        ["full", "compact", "automatic"],
        "automatic",
      ),
      type: option(footprintSettings.type, ["ask-bid", "volume", "delta", "delta-total"], "ask-bid"),
      mode: option(footprintSettings.mode, ["profile", "box"], "profile"),
      inputType: option(footprintSettings.inputType, ["volume", "num-trades"], "volume"),
      textFormat: option(footprintSettings.textFormat, ["automatic", "normal", "thousands"], "automatic"),
      colorMode: option(footprintSettings.colorMode, ["none", "fixed", "fading"], "fading"),
      colorCalculation: option(
        footprintSettings.colorCalculation,
        ["volume", "delta", "imbalance", "dominant", "dominant-delta"],
        "imbalance",
      ),
      showPerBarVolumeProfile: footprintSettings.showPerBarVolumeProfile === true,
      showPerBarDeltaProfile: footprintSettings.showPerBarDeltaProfile === true,
      perBarProfileScaleMode: option(
        footprintSettings.perBarProfileScaleMode,
        ["independent", "shared"],
        "independent",
      ),
      perBarProfileWidthPercent: clamp(Number(footprintSettings.perBarProfileWidthPercent ?? 92), 10, 100),
      perBarProfileGap: clamp(Number(footprintSettings.perBarProfileGap ?? 2), 0, 12),
      perBarProfileExtraSpacing: clamp(Number(footprintSettings.perBarProfileExtraSpacing ?? 18), 0, 48),
      perBarProfileOpacity: clamp(Number(footprintSettings.perBarProfileOpacity ?? 58) / 100, 0.05, 1),
      showPerBarProfilePoc: footprintSettings.showPerBarProfilePoc !== false,
      perBarProfilePocSize: clamp(Number(footprintSettings.perBarProfilePocSize ?? 5), 2, 12),
      perBarProfileOutline: footprintSettings.perBarProfileOutline === true,
      barWidth: clamp(Number(footprintSettings.barWidth ?? 92), 28, 180),
      candleSpacing: clamp(Number(footprintSettings.candleSpacing ?? 6), 1, 24),
      borderWidth: clamp(Number(footprintSettings.borderWidth ?? 1), 0.5, 4),
      opacity: clamp(Number(footprintSettings.backgroundOpacity ?? 74) / 100, 0, 1),
      minimumOpacity: clamp(Number(footprintSettings.minimumOpacity ?? 8) / 100, 0, 1),
      maximumOpacity: clamp(Number(footprintSettings.maximumOpacity ?? 72) / 100, 0, 1),
      gradientExponent: clamp(Number(footprintSettings.gradientExponent ?? 0.72), 0.1, 3),
      visibleRegionPercentile: clamp(Number(footprintSettings.visibleRegionPercentile ?? 0.95), 0.5, 1),
      fixedMaximum: Math.max(0, Number(footprintSettings.fixedMaximum ?? 0)),
      fontSize: clamp(Number(footprintSettings.fontSize ?? 10), 6, 16),
      fontWeight: clamp(Number(footprintSettings.fontWeight ?? 500), 400, 800),
      minimumWidthToShowText: clamp(Number(footprintSettings.minimumWidthToShowText ?? 32), 18, 180),
      minimumRowHeightToShowText: clamp(Number(footprintSettings.minimumRowHeightToShowText ?? 9), 7, 34),
      dynamicTextSize: footprintSettings.dynamicTextSize !== false,
      dynamicTextIncrease: clamp(Number(footprintSettings.dynamicTextIncrease ?? 1), 0, 2),
      showZeros: footprintSettings.showZeros === true,
      colorOnlyDominantSide: footprintSettings.colorOnlyDominantSide === true,
      showImbalances: footprintSettings.showImbalances !== false,
      showVolumePoc: footprintSettings.showVolumePoc !== false,
      showDeltaPoc: footprintSettings.showDeltaPoc === true,
      showValueArea: footprintSettings.showValueArea !== false,
      showVah: footprintSettings.showVah === true,
      showVal: footprintSettings.showVal === true,
      showSinglePrints: footprintSettings.showSinglePrints === true,
      singlePrintMaximum: Math.max(1, Number(footprintSettings.singlePrintMaximum ?? 1)),
      singlePrintExtremesOnly: footprintSettings.singlePrintExtremesOnly !== false,
      showRatio: footprintSettings.showRatio === true,
      minimumRatio: Math.max(0, Number(footprintSettings.minimumRatio ?? 1.5)),
      maximumRatio: Math.max(1, Number(footprintSettings.maximumRatio ?? 100)),
      showVolumeClusters: footprintSettings.showVolumeClusters === true,
      clusterMinimumVolume: Math.max(1, Number(footprintSettings.clusterMinimumVolume ?? 100)),
      showBarDelta: footprintSettings.showBarDelta !== false,
      showSummary: footprintSettings.showSummary !== false,
      showCentreDivider: footprintSettings.showCentreDivider !== false,
      showWick: footprintSettings.showWick !== false,
      showBodyOutline: footprintSettings.showBodyOutline !== false,
      showBodyFill: footprintSettings.showBodyFill === true,
      showBetweenVolume: footprintSettings.showBetweenVolume === true,
      showVwap: footprintSettings.showVwap === true,
      showStackedImbalances: footprintSettings.showStackedImbalances !== false,
      showMaxBid: footprintSettings.showMaxBid === true,
      showMaxAsk: footprintSettings.showMaxAsk === true,
      showMaxPositiveDelta: footprintSettings.showMaxPositiveDelta === true,
      showMaxNegativeDelta: footprintSettings.showMaxNegativeDelta === true,
      showMaxTrades: footprintSettings.showMaxTrades === true,
      outsideBarStyle: option(footprintSettings.outsideBarStyle, ["bar", "body"], "bar"),
      markerAlignment: option(footprintSettings.markerAlignment, ["center", "right"], "center"),
      outerEdgeMode: footprintSettings.outerEdgeMode !== false,
      maximumRetainedBars: clamp(Number(footprintSettings.maximumRetainedBars ?? 5_000), 100, 5_000),
      maximumDetailedVisibleBars: clamp(Number(footprintSettings.maximumDetailedVisibleBars ?? 180), 20, 350),
      allLoadedScaleMaximum: 0,
      fpsLimit: ([30, 60, 120].includes(Number(footprintSettings.fpsLimit))
        ? Number(footprintSettings.fpsLimit)
        : 60) as 30 | 60 | 120,
      askColor: useThemeColors ? settings.upColor : String(footprintSettings.askColor ?? settings.upColor),
      bidColor: useThemeColors ? settings.downColor : String(footprintSettings.bidColor ?? settings.downColor),
      betweenColor: String(footprintSettings.betweenColor ?? "#A1A1AA"),
      neutralColor: useThemeColors ? settings.gridColor : String(footprintSettings.neutralColor ?? settings.gridColor),
      textColor: String(footprintSettings.textColor ?? "#F5F5F5"),
      pocColor: useThemeColors ? settings.borderUpColor : String(footprintSettings.pocColor ?? settings.borderUpColor),
      valueAreaColor: String(footprintSettings.valueAreaColor ?? "#647BA8"),
      deltaPocColor: useThemeColors ? settings.borderDownColor : String(footprintSettings.deltaPocColor ?? settings.borderDownColor),
      clusterColor: String(footprintSettings.clusterColor ?? "#F59E0B"),
      singlePrintColor: String(footprintSettings.singlePrintColor ?? "#F4F4F5"),
      stackedAskColor: useThemeColors ? settings.upColor : String(footprintSettings.stackedAskColor ?? settings.upColor),
      stackedBidColor: useThemeColors ? settings.downColor : String(footprintSettings.stackedBidColor ?? settings.downColor),
      unfinishedAuctionColor: String(footprintSettings.unfinishedAuctionColor ?? "#E4BF5A"),
      vwapColor: String(footprintSettings.vwapColor ?? "#22D3EE"),
      perBarVolumeColor: useThemeColors
        ? settings.upColor
        : String(footprintSettings.perBarVolumeColor ?? settings.upColor),
      perBarPositiveDeltaColor: useThemeColors
        ? settings.upColor
        : String(footprintSettings.perBarPositiveDeltaColor ?? settings.upColor),
      perBarNegativeDeltaColor: useThemeColors
        ? settings.downColor
        : String(footprintSettings.perBarNegativeDeltaColor ?? settings.downColor),
      perBarProfilePocColor: useThemeColors
        ? settings.borderUpColor
        : String(footprintSettings.perBarProfilePocColor ?? settings.borderUpColor),
      backgroundColor: settings.backgroundColor,
    };
  }, [footprintSettings, settings]);
  const footprintHasPriceLevelFlow = liveFootprintRenderBars.some((bar) => bar.hasPriceLevelFlow);
  const footprintHasClassifiedFlow = liveFootprintRenderBars.some((bar) =>
    bar.classifiedVolume > 0);

  useEffect(() => {
    const primitive = footprintPrimitiveRef.current;
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!primitive || !series || !chart) return;
    primitive.update(
      footprintIndicator && footprintHasPriceLevelFlow ? liveFootprintRenderBars : [],
      footprintPrimitiveOptions,
    );

    const replaceCandles = Boolean(footprintIndicator && footprintHasPriceLevelFlow);
    series.applyOptions(replaceCandles ? {
      upColor: "rgba(0,0,0,0)",
      downColor: "rgba(0,0,0,0)",
      borderUpColor: "rgba(0,0,0,0)",
      borderDownColor: "rgba(0,0,0,0)",
      wickUpColor: "rgba(0,0,0,0)",
      wickDownColor: "rgba(0,0,0,0)",
    } : {
      upColor: settings.upColor,
      downColor: settings.downColor,
      borderUpColor: settings.borderUpColor,
      borderDownColor: settings.borderDownColor,
      wickUpColor: settings.wickUpColor,
      wickDownColor: settings.wickDownColor,
    });

    if (footprintIndicator) {
      const profileLayerEnabled = footprintPrimitiveOptions.showPerBarVolumeProfile
        || footprintPrimitiveOptions.showPerBarDeltaProfile;
      const profileSideCount = Number(footprintPrimitiveOptions.showPerBarVolumeProfile)
        + Number(footprintPrimitiveOptions.showPerBarDeltaProfile);
      const profileSideWidth = footprintPrimitiveOptions.barWidth
        * (footprintPrimitiveOptions.perBarProfileWidthPercent / 100);
      // Start at a useful information density. The renderer expands the two
      // profile wings as space becomes available instead of forcing every
      // candle to reserve three full footprint widths up front.
      const adaptiveProfileSpan = profileLayerEnabled
        ? Math.min(
          42,
          profileSideWidth * profileSideCount
            + footprintPrimitiveOptions.perBarProfileGap * profileSideCount
            + Math.min(10, footprintPrimitiveOptions.perBarProfileExtraSpacing),
        )
        : 0;
      const renderedBarSpacing = Math.min(
        128,
        Math.max(
          40,
          Math.min(86, footprintPrimitiveOptions.barWidth)
            + footprintPrimitiveOptions.candleSpacing
            + adaptiveProfileSpan,
        ),
      );
      if (
        !footprintActiveRef.current
        || footprintBarWidthRef.current !== renderedBarSpacing
      ) {
        chart.timeScale().applyOptions({
          barSpacing: renderedBarSpacing,
          minBarSpacing: 8,
        });
        footprintActiveRef.current = true;
        footprintBarWidthRef.current = renderedBarSpacing;
      }
    } else if (footprintActiveRef.current) {
      chart.timeScale().applyOptions({ barSpacing: 6, minBarSpacing: 0.5 });
      footprintActiveRef.current = false;
      footprintBarWidthRef.current = null;
    }
  }, [
    chartReadyRevision,
    footprintHasPriceLevelFlow,
    footprintIndicator,
    footprintPrimitiveOptions,
    liveFootprintRenderBars,
    settings.borderDownColor,
    settings.borderUpColor,
    settings.downColor,
    settings.upColor,
    settings.wickDownColor,
    settings.wickUpColor,
  ]);
  const calculatedIndicatorSeries = useMemo(
    () => indicators.flatMap((instance) => {
      if (
        !orderFlowHistoryReady
        && [
          "cumulative-volume-delta",
          "delta-cumulative-candlestick",
          "delta-cumulative-histogram",
          "delta-bar",
        ].includes(instance.indicatorId)
      ) return [];
      return calculateIndicatorSeries(
        instance,
        indicatorCandles,
        {
          primary: settings.upColor,
          secondary: settings.borderUpColor,
          positive: settings.upColor,
          negative: settings.downColor,
          muted: settings.gridColor,
        },
        { instrument, tickSize: priceFormat.minMove },
      ).map((series) => ({ ...series, groupKey: instance.instanceId }));
    }),
    [
      indicatorCandles,
      indicatorSignature,
      indicators,
      instrument,
      orderFlowHistoryReady,
      priceFormat.minMove,
      settings.borderUpColor,
      settings.downColor,
      settings.gridColor,
      settings.upColor,
    ],
  );
  const calculatedIndicatorPanes = useMemo(() => {
    return indicators.flatMap((instance): IndicatorPaneGroup[] => {
      if (!instance.enabled) return [];
      if (instance.indicatorId === "kwant-stats") {
        return [{
          key: instance.instanceId,
          title: "KWANT STATS",
          indicatorId: instance.indicatorId,
          settings: instance.settings,
          series: [],
          stats: indicatorCandles.length
            ? calculateKwantStats(
              indicatorCandles,
              indicatorMarketTrades,
              instance,
              priceFormat.minMove,
              {
                positive: settings.upColor,
                negative: settings.downColor,
                neutral: settings.borderUpColor,
                text: "var(--foreground)",
                header: settings.gridColor,
              },
            )
            : undefined,
          unavailableReason: indicatorCandles.length ? undefined : "Waiting for chart history.",
        }];
      }
      const series = calculatedIndicatorSeries.filter((definition) =>
        definition.groupKey === instance.instanceId && definition.placement === "pane");
      if (series.length) {
        return [{
          key: instance.instanceId,
          title: series[0].label,
          indicatorId: instance.indicatorId,
          settings: instance.settings,
          series,
        }];
      }
      if ([
        "cumulative-volume-delta",
        "delta-cumulative-candlestick",
        "delta-cumulative-histogram",
        "delta-bar",
      ].includes(instance.indicatorId)) {
        return [{
          key: instance.instanceId,
          title: "Cumulative Volume Delta",
          indicatorId: instance.indicatorId,
          settings: instance.settings,
          series: [],
          unavailableReason: orderFlowHistoryReady
            ? "Waiting for executed CME bid/ask volume."
            : "Restoring cumulative volume delta history.",
        }];
      }
      return [];
    });
  }, [
    calculatedIndicatorSeries,
    indicatorCandles,
    indicatorSignature,
    indicators,
    priceFormat.minMove,
    indicatorMarketTrades,
    orderFlowHistoryReady,
    settings.borderUpColor,
    settings.downColor,
    settings.gridColor,
    settings.upColor,
  ]);
  const defaultIndicatorPaneHeight = Math.max(88, Math.min(140, overlaySize.height * 0.18));
  const resolvedIndicatorPaneHeights = useMemo(
    () => Object.fromEntries(calculatedIndicatorPanes.map((group) => [
      group.key,
      indicatorPaneHeights[group.key] ?? defaultIndicatorPaneHeight,
    ])),
    [calculatedIndicatorPanes, defaultIndicatorPaneHeight, indicatorPaneHeights],
  );
  const orderedIndicatorPanes = useMemo(() => [...calculatedIndicatorPanes].sort((left, right) => {
    const leftPlacement = indicatorPaneLayout[left.key] ?? {
      dock: "bottom" as const,
      order: calculatedIndicatorPanes.indexOf(left),
    };
    const rightPlacement = indicatorPaneLayout[right.key] ?? {
      dock: "bottom" as const,
      order: calculatedIndicatorPanes.indexOf(right),
    };
    if (leftPlacement.dock !== rightPlacement.dock) {
      return (["top", "left", "right", "bottom"] as IndicatorPaneDock[]).indexOf(leftPlacement.dock)
        - (["top", "left", "right", "bottom"] as IndicatorPaneDock[]).indexOf(rightPlacement.dock);
    }
    return leftPlacement.order - rightPlacement.order;
  }), [calculatedIndicatorPanes, indicatorPaneLayout]);
  const paneStackHeight = useCallback((dock: IndicatorPaneDock) => orderedIndicatorPanes.reduce(
    (total, group, sourceIndex) => {
      const placement = indicatorPaneLayout[group.key] ?? { dock: "bottom" as const, order: sourceIndex };
      if (placement.dock !== dock) return total;
      return total + (collapsedIndicatorPanes[group.key] ? 30 : resolvedIndicatorPaneHeights[group.key]);
    },
    0,
  ), [collapsedIndicatorPanes, indicatorPaneLayout, orderedIndicatorPanes, resolvedIndicatorPaneHeights]);
  const indicatorPaneHeight = useMemo(
    () => paneStackHeight("bottom"),
    [paneStackHeight],
  );
  const topIndicatorPaneHeight = useMemo(() => paneStackHeight("top"), [paneStackHeight]);
  useEffect(() => {
    onIndicatorPaneHeightChange?.(indicatorPaneHeight);
  }, [indicatorPaneHeight, onIndicatorPaneHeightChange]);
  useEffect(() => {
    if (typeof window === "undefined" || !liveCandleEventKey) return;
    window.localStorage.setItem(
      `kwantdesk:indicator-pane-layout:${liveCandleEventKey}`,
      JSON.stringify(indicatorPaneLayout),
    );
  }, [indicatorPaneLayout, liveCandleEventKey]);
  useEffect(
    () => () => onIndicatorPaneHeightChange?.(0),
    [onIndicatorPaneHeightChange],
  );
  const gammaHeatmapIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "gamma-heatmap") ?? null,
    [indicators],
  );
  useEffect(() => {
    if (!gammaHeatmapIndicator) {
      setGammaHeatmapPayload(null);
      setGammaHeatmapLoading(false);
      setGammaHeatmapError(null);
      return;
    }
    const display = normalizeGammaHeatmapInstrument(instrument);
    if (!/^(NQ|MNQ|ES|MES)$/.test(display)) {
      setGammaHeatmapPayload(null);
      setGammaHeatmapLoading(false);
      setGammaHeatmapError("Gamma Heatmap supports NQ, MNQ, ES and MES charts.");
      return;
    }
    const indicatorSettings = gammaHeatmapIndicator.settings ?? {};
    const sourceSetting = String(indicatorSettings.optionsSource ?? "AUTO").toUpperCase();
    const source = sourceSetting === "AUTO" ? defaultGammaHeatmapSource(display) : sourceSetting;
    const metric = String(indicatorSettings.metric ?? "GAMMA").toUpperCase();
    const sourceMode = String(indicatorSettings.sourceMode ?? "hybrid");
    const historyHours = Math.max(1, Number(indicatorSettings.historyHours ?? 24));
    const binSize = Math.max(0.25, Number(indicatorSettings.binSize ?? (display === "ES" || display === "MES" ? 1 : 5)));
    const refreshMs = Math.max(2_000, Number(indicatorSettings.refreshSeconds ?? 5) * 1_000);
    let cancelled = false;
    let timer: number | null = null;
    const load = async (force = false) => {
      const displayPrice = drawingCandlesRef.current.at(-1)?.close;
      if (!(displayPrice && displayPrice > 0)) return;
      if (!force) setGammaHeatmapLoading(true);
      const query = new URLSearchParams({
        display,
        source,
        metric,
        sourceMode,
        historyHours: String(historyHours),
        binSize: String(binSize),
        displayPrice: String(displayPrice),
      });
      const cacheKey = `gamma-heatmap:${display}:${source}:${metric}:${sourceMode}:${historyHours}:${binSize}`;
      try {
        const payload = await fetchWorkspaceData<GammaHeatmapPayload>(cacheKey, `/api/gamma-heatmap?${query}`, {
          force,
          maxAgeMs: refreshMs,
          timeoutMs: 35_000,
          validate: isGammaHeatmapPayload,
          invalidMessage: "Gamma Heatmap returned an incomplete exposure surface.",
        });
        if (cancelled) return;
        setGammaHeatmapPayload(payload);
        setGammaHeatmapError(null);
      } catch (error) {
        if (!cancelled) setGammaHeatmapError(error instanceof Error ? error.message : "Gamma Heatmap could not refresh.");
      } finally {
        if (!cancelled) {
          setGammaHeatmapLoading(false);
          timer = window.setTimeout(() => void load(true), refreshMs);
        }
      }
    };
    void load(false);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [gammaHeatmapIndicator, instrument]);

  const gammaHeatmapPrimitiveData = useMemo<GammaHeatmapPrimitiveData | null>(() => {
    if (!gammaHeatmapIndicator || !gammaHeatmapPayload) return null;
    const indicatorSettings = gammaHeatmapIndicator.settings ?? {};
    const useThemeColors = indicatorSettings.useThemeColors !== false;
    return {
      snapshots: gammaHeatmapPayload.snapshots,
      levels: gammaHeatmapPayload.levels,
      viewMode: String(indicatorSettings.viewMode ?? "net") as GammaHeatmapViewMode,
      opacity: Math.max(0.05, Math.min(1, Number(indicatorSettings.opacity ?? 68) / 100)),
      intensity: Math.max(0.25, Math.min(4, Number(indicatorSettings.intensity ?? 1))),
      showHistorical: indicatorSettings.showHistorical !== false,
      showLevels: indicatorSettings.showLevels !== false,
      carryForwardFade: indicatorSettings.carryForwardFade !== false,
      positiveColor: useThemeColors ? settings.upColor : String(indicatorSettings.positiveColor ?? settings.upColor),
      negativeColor: useThemeColors ? settings.downColor : String(indicatorSettings.negativeColor ?? settings.downColor),
      neutralColor: useThemeColors ? settings.gridColor : String(indicatorSettings.neutralColor ?? settings.gridColor),
      backgroundColor: settings.backgroundColor,
      precision: priceFormat.precision,
    };
  }, [gammaHeatmapIndicator, gammaHeatmapPayload, priceFormat.precision, settings.backgroundColor, settings.downColor, settings.gridColor, settings.upColor]);
  useEffect(() => {
    gammaHeatmapPrimitiveRef.current?.update(gammaHeatmapPrimitiveData);
  }, [gammaHeatmapPrimitiveData, viewportVersion]);
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !gammaHeatmapIndicator) {
      setGammaHeatmapTooltip(null);
      return;
    }
    let frame: number | null = null;
    const move = (event: PointerEvent) => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setGammaHeatmapTooltip(gammaHeatmapPrimitiveRef.current?.queryHit(x, y) ?? null);
      });
    };
    const leave = () => setGammaHeatmapTooltip(null);
    container.addEventListener("pointermove", move, { passive: true });
    container.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", leave);
    };
  }, [gammaHeatmapIndicator]);

  const netGammaIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "net-gamma-exposure-by-strike") ?? null,
    [indicators],
  );
  const netGammaDataSettingsSignature = netGammaIndicator ? JSON.stringify({
      instanceId: netGammaIndicator.instanceId,
      provider: String(netGammaIndicator.settings?.provider ?? "quantdata"),
      sourceTicker: String(netGammaIndicator.settings?.sourceTicker ?? "AUTO"),
      refreshSeconds: Number(netGammaIndicator.settings?.refreshSeconds ?? 5),
      expirationMode: String(netGammaIndicator.settings?.expirationMode ?? "zero-to-one-dte"),
      expirationDates: String(netGammaIndicator.settings?.expirationDates ?? ""),
      includeWeeklies: netGammaIndicator.settings?.includeWeeklies !== false,
      includeMonthlies: netGammaIndicator.settings?.includeMonthlies !== false,
      includeQuarterlies: netGammaIndicator.settings?.includeQuarterlies !== false,
      aggregationMode: String(netGammaIndicator.settings?.aggregationMode ?? "auto-bin"),
      customBinSizePoints: Number(netGammaIndicator.settings?.customBinSizePoints ?? 1),
      minimumDte: Number(netGammaIndicator.settings?.minimumDte ?? 0),
      maximumDte: Number(netGammaIndicator.settings?.maximumDte ?? 7),
    }) : "";
  const netGammaDataSettings = useMemo(() => netGammaDataSettingsSignature
    ? JSON.parse(netGammaDataSettingsSignature) as {
        instanceId: string;
        provider: string;
        sourceTicker: string;
        refreshSeconds: number;
        expirationMode: string;
        expirationDates: string;
        includeWeeklies: boolean;
        includeMonthlies: boolean;
        includeQuarterlies: boolean;
        aggregationMode: string;
        customBinSizePoints: number;
        minimumDte: number;
        maximumDte: number;
      }
    : null, [netGammaDataSettingsSignature]);
  useEffect(() => {
    if (!netGammaDataSettings) {
      setNetGammaProfile(null);
      setNetGammaLoading(false);
      setNetGammaError(null);
      previousNetGammaSnapshotRef.current = null;
      return;
    }
    const display = normalizeGammaHeatmapInstrument(instrument);
    if (!/^(NQ|MNQ|ES|MES)$/.test(display)) {
      setNetGammaProfile(null);
      setNetGammaLoading(false);
      setNetGammaError("Net Gamma Exposure supports NQ, MNQ, ES and MES charts.");
      return;
    }
    const indicatorSettings = netGammaDataSettings;
    const requestedSource = indicatorSettings.sourceTicker.toUpperCase();
    const source = requestedSource === "AUTO" ? defaultNetGammaSource(display) : requestedSource;
    const refreshMs = Math.max(2_000, Math.min(60_000, Number(indicatorSettings.refreshSeconds ?? 5) * 1_000));
    let cancelled = false;
    let timer: number | null = null;
    const load = async (force = false) => {
      const displayPrice = drawingCandlesRef.current.at(-1)?.close;
      if (!(displayPrice && displayPrice > 0)) {
        setNetGammaLoading(true);
        timer = window.setTimeout(() => void load(force), 300);
        return;
      }
      if (!force) setNetGammaLoading(true);
      const query = new URLSearchParams({
        display,
        source,
        provider: indicatorSettings.provider,
        displayPrice: String(displayPrice),
        expirationMode: indicatorSettings.expirationMode,
        expirationDates: indicatorSettings.expirationDates,
        includeWeeklies: String(indicatorSettings.includeWeeklies),
        includeMonthlies: String(indicatorSettings.includeMonthlies),
        includeQuarterlies: String(indicatorSettings.includeQuarterlies),
        aggregationMode: indicatorSettings.aggregationMode,
        customBinSizePoints: String(indicatorSettings.customBinSizePoints),
        minimumDte: String(indicatorSettings.minimumDte),
        maximumDte: String(indicatorSettings.maximumDte),
      });
      const settingsKey = [source, indicatorSettings.provider, indicatorSettings.expirationMode, indicatorSettings.expirationDates, indicatorSettings.includeWeeklies, indicatorSettings.includeMonthlies, indicatorSettings.includeQuarterlies, indicatorSettings.aggregationMode, indicatorSettings.customBinSizePoints].join(":");
      try {
        const payload = await fetchWorkspaceData<NetGammaProfileSnapshot>(
          `net-gamma-exposure-by-strike:${display}:${settingsKey}`,
          `/api/net-gamma-exposure-by-strike?${query}`,
          {
            force,
            maxAgeMs: refreshMs,
            timeoutMs: 35_000,
            validate: isNetGammaProfileSnapshot,
            invalidMessage: "Net Gamma Exposure returned an incomplete strike profile.",
          },
        );
        if (cancelled) return;
        setNetGammaProfile((current) => {
          if (current && current.id !== payload.id) previousNetGammaSnapshotRef.current = current;
          return payload;
        });
        setNetGammaError(null);
      } catch (error) {
        if (!cancelled) setNetGammaError(error instanceof Error ? error.message : "Net Gamma Exposure could not refresh.");
      } finally {
        if (!cancelled) {
          setNetGammaLoading(false);
          timer = window.setTimeout(() => void load(true), refreshMs);
        }
      }
    };
    void load(false);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [instrument, netGammaDataSettings]);

  const netGammaPrimitiveData = useMemo<NetGammaExposurePrimitiveData | null>(() => {
    if (!netGammaIndicator || !netGammaProfile) return null;
    const indicatorSettings = netGammaIndicator.settings ?? {};
    const useThemeColors = indicatorSettings.useThemeColors !== false;
    const contentMode = String(indicatorSettings.contentMode ?? "net") as GammaProfileContentMode;
    const renderedSnapshot = contentMode === "net-change"
      ? buildNetGammaChangeSnapshot(netGammaProfile, previousNetGammaSnapshotRef.current)
      : netGammaProfile;
    return {
      snapshot: renderedSnapshot,
      placement: String(indicatorSettings.placement ?? "right") as GammaProfilePlacement,
      laneWidthPercent: Number(indicatorSettings.laneWidthPercent ?? 24),
      minimumLaneWidthPx: Number(indicatorSettings.minimumLaneWidthPx ?? 220),
      maximumLaneWidthPx: Number(indicatorSettings.maximumLaneWidthPx ?? 420),
      floatingXPercent: Number(indicatorSettings.floatingXPercent ?? 72),
      zeroSpinePercent: Number(indicatorSettings.zeroSpinePercent ?? 50),
      reverseDirections: indicatorSettings.reverseDirections === true,
      minimumBarHeightPx: Number(indicatorSettings.minimumBarHeightPx ?? 3),
      maximumBarHeightPx: Number(indicatorSettings.maximumBarHeightPx ?? 24),
      fixedBarHeightPx: Number(indicatorSettings.fixedBarHeightPx ?? 9),
      barHeightMode: String(indicatorSettings.barHeightMode ?? "automatic") as NetGammaExposurePrimitiveData["barHeightMode"],
      barGapPx: Number(indicatorSettings.barGapPx ?? 1),
      horizontalPaddingPx: Number(indicatorSettings.horizontalPaddingPx ?? 8),
      scaleMode: String(indicatorSettings.scaleMode ?? "visible-percentile") as GammaScaleMode,
      scaleTransform: String(indicatorSettings.scaleTransform ?? "square-root") as GammaScaleTransform,
      scalePercentile: Number(indicatorSettings.scalePercentile ?? 98) / 100,
      fixedMaximum: Number(indicatorSettings.fixedMaximum ?? 0) || null,
      logarithmicStrength: Number(indicatorSettings.logarithmicStrength ?? 9),
      sharePositiveNegativeScale: indicatorSettings.sharePositiveNegativeScale !== false,
      contentMode,
      visualMode: String(indicatorSettings.visualMode ?? "gradient") as GammaBarVisualMode,
      opacity: Number(indicatorSettings.barOpacity ?? 52) / 100,
      borderOpacity: Number(indicatorSettings.borderOpacity ?? 75) / 100,
      borderWidth: Number(indicatorSettings.borderWidth ?? 1),
      gradientStrength: Number(indicatorSettings.gradientStrength ?? 25) / 100,
      showZeroSpine: indicatorSettings.showZeroSpine !== false,
      showValues: indicatorSettings.showValues === true,
      showMappedPrice: indicatorSettings.showMappedPrice === true,
      showMaxPositive: indicatorSettings.showMaxPositive !== false,
      showMaxNegative: indicatorSettings.showMaxNegative !== false,
      showDominantAbsolute: indicatorSettings.showDominantAbsolute === true,
      showCallWall: indicatorSettings.showCallWall === true,
      showPutWall: indicatorSettings.showPutWall === true,
      showCurrentPrice: indicatorSettings.showCurrentPrice !== false,
      maximumDisplayedRows: Math.max(5, Number(indicatorSettings.maximumDisplayedRows ?? 80)),
      minimumPercentageOfTotal: Math.max(0, Number(indicatorSettings.minimumPercentageOfTotal ?? 0.1) / 100),
      minimumAbsoluteExposure: Math.max(0, Number(indicatorSettings.minimumAbsoluteExposure ?? 0)),
      maximumDistanceFromSourceSpot: Math.max(0, Number(indicatorSettings.maximumDistanceFromSourceSpot ?? 0)),
      minimumMappingConfidence: Number(indicatorSettings.minimumMappingConfidence ?? 70),
      fadeWhenBelowMinimum: indicatorSettings.fadeWhenBelowMinimum !== false,
      hideWhenBelowMinimum: indicatorSettings.hideWhenBelowMinimum === true,
      positiveColor: useThemeColors ? settings.upColor : String(indicatorSettings.positiveColor ?? settings.upColor),
      negativeColor: useThemeColors ? settings.downColor : String(indicatorSettings.negativeColor ?? settings.downColor),
      callColor: useThemeColors ? settings.upColor : String(indicatorSettings.callColor ?? settings.upColor),
      putColor: useThemeColors ? settings.downColor : String(indicatorSettings.putColor ?? settings.downColor),
      absoluteColor: useThemeColors ? settings.borderUpColor : String(indicatorSettings.absoluteColor ?? settings.borderUpColor),
      zeroSpineColor: useThemeColors ? settings.gridColor : String(indicatorSettings.zeroSpineColor ?? settings.gridColor),
      backgroundColor: settings.backgroundColor,
      borderColor: settings.gridColor,
      textColor: "#F5F5F5",
      mutedTextColor: settings.gridColor,
      warningColor: String(indicatorSettings.warningColor ?? "#F59E0B"),
      currentPriceColor: settings.borderUpColor,
      precision: priceFormat.precision,
    };
  }, [netGammaIndicator, netGammaProfile, priceFormat.precision, settings.backgroundColor, settings.borderUpColor, settings.downColor, settings.gridColor, settings.upColor]);
  useEffect(() => {
    netGammaExposurePrimitiveRef.current?.update(netGammaPrimitiveData);
  }, [netGammaPrimitiveData, viewportVersion]);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const settingsRecord = netGammaIndicator?.settings ?? {};
    const reserveRight = Boolean(
      netGammaIndicator
      && settingsRecord.spaceMode === "reserved"
      && String(settingsRecord.placement ?? "right") === "right",
    );
    if (!reserveRight) {
      if (netGammaReservedRightOffsetRef.current !== null) {
        timeScale.applyOptions({ rightOffset: netGammaReservedRightOffsetRef.current });
        netGammaReservedRightOffsetRef.current = null;
      }
      return;
    }
    const options = timeScale.options();
    if (netGammaReservedRightOffsetRef.current === null) {
      netGammaReservedRightOffsetRef.current = Number(options.rightOffset ?? 0);
    }
    const laneWidth = Math.max(
      Number(settingsRecord.minimumLaneWidthPx ?? 220),
      Math.min(
        Number(settingsRecord.maximumLaneWidthPx ?? 420),
        overlaySize.width * Number(settingsRecord.laneWidthPercent ?? 24) / 100,
      ),
    );
    const barsToReserve = laneWidth / Math.max(1, Number(options.barSpacing ?? 6));
    timeScale.applyOptions({ rightOffset: Math.max(netGammaReservedRightOffsetRef.current, barsToReserve) });
  }, [
    netGammaIndicator,
    overlaySize.width,
  ]);
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !netGammaIndicator || netGammaIndicator.settings?.tooltipsEnabled === false) {
      setNetGammaTooltip(null);
      return;
    }
    let frame: number | null = null;
    const move = (event: PointerEvent) => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      const rect = container.getBoundingClientRect();
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setNetGammaTooltip(netGammaExposurePrimitiveRef.current?.queryHit(event.clientX - rect.left, event.clientY - rect.top) ?? null);
      });
    };
    const leave = () => setNetGammaTooltip(null);
    container.addEventListener("pointermove", move, { passive: true });
    container.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", leave);
    };
  }, [netGammaIndicator]);

  const darkPoolMapIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "dark-pool-map") ?? null,
    [indicators],
  );
  useEffect(() => {
    if (!darkPoolMapIndicator) {
      setDarkPoolMapPayload(null);
      setDarkPoolMapLoading(false);
      setDarkPoolMapError(null);
      return;
    }
    const display = normalizeDarkPoolInstrument(instrument);
    const indicatorSettings = darkPoolMapIndicator.settings ?? {};
    const requestedSource = String(indicatorSettings.sourceTicker ?? "AUTO").toUpperCase();
    const source = requestedSource === "AUTO" ? defaultDarkPoolSource(display) : requestedSource;
    const refreshMs = Math.max(1_000, Math.min(30_000, Number(indicatorSettings.pollSeconds ?? 2) * 1_000));
    const querySettings = [
      "historyDays", "pollSeconds", "minimumPrintNotional", "maximumPrintNotional", "minimumPrintShares", "maximumPrintShares",
      "minimumLevelNotional", "minimumLevelShares", "minimumTradeCount", "topLevels", "minimumStrengthScore", "mappedBinPoints",
      "sourceBinCents", "displayTickMultiple", "mergeTolerancePoints", "maximumZoneWidthPoints", "recencyHalfLifeHours",
      "sessionsForFullPersistenceScore", "maximumHistoricalPrints", "manualAlpha", "manualBeta", "staleAllowanceSeconds",
      "mappingWindowMinutes", "minimumMappingSamples", "minimumMappingR2",
    ];
    const booleanSettings = ["mergeNearbyLevels", "showDelayedPrints", "includeDelayedInLevels", "includeAskSide", "includeBidSide", "includeMid", "includeUnknown"];
    let cancelled = false;
    let timer: number | null = null;
    const load = async (force = false) => {
      const displayPrice = drawingCandlesRef.current.at(-1)?.close;
      if (!(displayPrice && displayPrice > 0)) {
        setDarkPoolMapLoading(true);
        timer = window.setTimeout(() => void load(force), 500);
        return;
      }
      if (!force) setDarkPoolMapLoading(true);
      const query = new URLSearchParams({
        display,
        source,
        displayPrice: String(displayPrice),
        mappingMode: String(indicatorSettings.mappingMode ?? "rolling-affine"),
        priceBinMode: String(indicatorSettings.priceBinMode ?? "mapped-points"),
      });
      querySettings.forEach((key) => {
        const value = indicatorSettings[key];
        if (typeof value === "number" && Number.isFinite(value)) query.set(key, String(value));
      });
      booleanSettings.forEach((key) => {
        if (typeof indicatorSettings[key] === "boolean") query.set(key, String(indicatorSettings[key]));
      });
      const cacheKey = `dark-pool-map:${display}:${source}:${String(indicatorSettings.mappingMode ?? "rolling-affine")}:${String(indicatorSettings.priceBinMode ?? "mapped-points")}:${querySettings.map((key) => String(indicatorSettings[key] ?? "")).join(":")}:${booleanSettings.map((key) => String(indicatorSettings[key] ?? "")).join(":")}`;
      try {
        const payload = await fetchWorkspaceData<DarkPoolMapPayload>(cacheKey, `/api/dark-pool-map?${query}`, {
          force,
          maxAgeMs: refreshMs,
          timeoutMs: 40_000,
          validate: isDarkPoolMapPayload,
          invalidMessage: "Dark Pool Map returned an incomplete provider snapshot.",
        });
        if (cancelled) return;
        setDarkPoolMapPayload(payload);
        setDarkPoolMapError(null);
      } catch (error) {
        if (!cancelled) setDarkPoolMapError(error instanceof Error ? error.message : "Dark Pool Map could not refresh.");
      } finally {
        if (!cancelled) {
          setDarkPoolMapLoading(false);
          timer = window.setTimeout(() => void load(true), refreshMs);
        }
      }
    };
    void load(false);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [darkPoolMapIndicator, instrument]);

  const darkPoolMapPrimitiveData = useMemo<DarkPoolMapPrimitiveData | null>(() => {
    if (!darkPoolMapIndicator || !darkPoolMapPayload) return null;
    const indicatorSettings = darkPoolMapIndicator.settings ?? {};
    const useThemeColors = indicatorSettings.useThemeColors !== false;
    return {
      prints: darkPoolMapPayload.prints,
      levels: darkPoolMapPayload.levels,
      zones: darkPoolMapPayload.zones,
      visualMode: String(indicatorSettings.visualMode ?? "circles-and-zones") as DarkPoolVisualMode,
      maximumVisibleCircles: Math.max(50, Number(indicatorSettings.maximumVisibleCircles ?? 2_000)),
      maximumVisibleZones: Math.max(1, Number(indicatorSettings.maximumVisibleZones ?? 100)),
      minimumRadius: Math.max(1, Number(indicatorSettings.minimumRadius ?? 3)),
      maximumRadius: Math.max(4, Number(indicatorSettings.maximumRadius ?? 18)),
      opacity: Math.max(0.05, Math.min(1, Number(indicatorSettings.opacity ?? 58) / 100)),
      zoneOpacity: Math.max(0, Math.min(0.8, Number(indicatorSettings.zoneOpacity ?? 16) / 100)),
      showLevelLabels: indicatorSettings.showLevelLabels !== false,
      neutralColor: useThemeColors ? settings.gridColor : String(indicatorSettings.neutralColor ?? settings.gridColor),
      askSideColor: useThemeColors ? settings.upColor : String(indicatorSettings.askSideColor ?? settings.upColor),
      bidSideColor: useThemeColors ? settings.downColor : String(indicatorSettings.bidSideColor ?? settings.downColor),
      midColor: useThemeColors ? settings.gridColor : String(indicatorSettings.midColor ?? settings.gridColor),
      delayedColor: String(indicatorSettings.delayedColor ?? "#F59E0B"),
      backgroundColor: settings.backgroundColor,
      precision: priceFormat.precision,
    };
  }, [darkPoolMapIndicator, darkPoolMapPayload, priceFormat.precision, settings.backgroundColor, settings.downColor, settings.gridColor, settings.upColor]);
  useEffect(() => {
    darkPoolMapPrimitiveRef.current?.update(darkPoolMapPrimitiveData);
  }, [darkPoolMapPrimitiveData, viewportVersion]);
  useEffect(() => {
    if (!darkPoolMapIndicator || !darkPoolMapPayload || darkPoolMapIndicator.settings?.enableAlerts !== true) return;
    if (darkPoolMapPayload.status === "MAPPING_STALE" || darkPoolMapPayload.status === "UNAVAILABLE" || darkPoolMapPayload.status === "RATE_LIMITED") return;
    const indicatorSettings = darkPoolMapIndicator.settings ?? {};
    const state = darkPoolAlertStateRef.current;
    const key = `${darkPoolMapIndicator.instanceId}:${darkPoolMapPayload.sourceTicker}:${darkPoolMapPayload.displayInstrument}`;
    if (state.key !== key) {
      darkPoolAlertStateRef.current = {
        key,
        printIds: new Set(darkPoolMapPayload.prints.map((print) => print.id)),
        levelIds: new Set(darkPoolMapPayload.levels.map((level) => level.id)),
        zoneStates: new Map(),
        lastFired: new Map(),
      };
      return;
    }
    const cooldownMs = Math.max(5_000, Number(indicatorSettings.alertCooldownSeconds ?? 60) * 1_000);
    const emit = (eventKey: string, title: string, message: string) => {
      const now = Date.now();
      if (now - (state.lastFired.get(eventKey) ?? 0) < cooldownMs) return;
      state.lastFired.set(eventKey, now);
      const detail = { indicatorId: "dark-pool-map", instanceId: darkPoolMapIndicator.instanceId, instrument: darkPoolMapPayload.displayInstrument, sourceTicker: darkPoolMapPayload.sourceTicker, title, message, checkedAtMs: darkPoolMapPayload.checkedAtMs };
      window.dispatchEvent(new CustomEvent("kwantdesk:dark-pool-alert", { detail }));
      window.dispatchEvent(new CustomEvent("kwantdesk:precision-alert", { detail: { objectId: eventKey, message, price: drawingCandlesRef.current.at(-1)?.close ?? null, condition: title } }));
      if (indicatorSettings.browserNotifications === true && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body: message });
    };
    for (const print of darkPoolMapPayload.prints) {
      if (state.printIds.has(print.id)) continue;
      state.printIds.add(print.id);
      if (state.printIds.size > 100_000) state.printIds.delete(state.printIds.values().next().value as string);
      if (print.isDelayedPrint) continue;
      if (indicatorSettings.alertNewLargePrint !== false && print.notionalValue >= Number(indicatorSettings.alertPrintNotional ?? 5_000_000)) {
        emit(`print:${print.id}`, `${print.ticker} Dark Pool Print`, `${print.notionalValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} reported at ${print.price.toFixed(2)}, mapped to ${print.displayInstrument} ${print.mappedPrice.toFixed(priceFormat.precision)}.`);
      }
    }
    for (const level of darkPoolMapPayload.levels) {
      const newLevel = !state.levelIds.has(level.id);
      state.levelIds.add(level.id);
      if (newLevel && indicatorSettings.alertNewLargeLevel !== false && level.totalNotional >= Number(indicatorSettings.alertLevelNotional ?? 25_000_000)) emit(`level:${level.id}`, "New Dark Pool Level", `${level.totalNotional.toLocaleString("en-US", { notation: "compact", style: "currency", currency: "USD" })} concentrated near ${level.displayInstrument} ${level.mappedPrice.toFixed(priceFormat.precision)}.`);
      if (indicatorSettings.alertScoreThreshold !== false && level.strengthScore >= Number(indicatorSettings.alertScore ?? 80)) emit(`score:${level.id}`, "Dark Pool Score Threshold", `${level.displayInstrument} ${level.mappedPrice.toFixed(priceFormat.precision)} reached score ${Math.round(level.strengthScore)}.`);
    }
    const currentPrice = drawingCandlesRef.current.at(-1)?.close;
    if (currentPrice && (indicatorSettings.alertPriceApproach === true || indicatorSettings.alertPriceTouch === true)) {
      const approachDistance = Math.max(0.01, Number(indicatorSettings.alertDistancePoints ?? 5));
      for (const zone of darkPoolMapPayload.zones) {
        const distance = currentPrice < zone.lowerPrice ? zone.lowerPrice - currentPrice : currentPrice > zone.upperPrice ? currentPrice - zone.upperPrice : 0;
        const nextState = distance === 0 ? "inside" : distance <= approachDistance ? "approach" : "outside";
        const previousState = state.zoneStates.get(zone.id) ?? "outside";
        state.zoneStates.set(zone.id, nextState);
        if (nextState === previousState) continue;
        if (nextState === "inside" && indicatorSettings.alertPriceTouch === true) emit(`touch:${zone.id}`, "Price Touched Dark Pool Zone", `${darkPoolMapPayload.displayInstrument} entered ${zone.lowerPrice.toFixed(priceFormat.precision)}–${zone.upperPrice.toFixed(priceFormat.precision)}.`);
        else if (nextState === "approach" && indicatorSettings.alertPriceApproach === true) emit(`approach:${zone.id}`, "Price Approaching Dark Pool Zone", `${darkPoolMapPayload.displayInstrument} is ${distance.toFixed(priceFormat.precision)} points from ${zone.weightedPrice.toFixed(priceFormat.precision)}.`);
      }
    }
  }, [darkPoolMapIndicator, darkPoolMapPayload, priceFormat.precision]);
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !darkPoolMapIndicator) {
      setDarkPoolMapTooltip(null);
      return;
    }
    let frame: number | null = null;
    const move = (event: PointerEvent) => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      const rect = container.getBoundingClientRect();
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setDarkPoolMapTooltip(darkPoolMapPrimitiveRef.current?.queryHit(event.clientX - rect.left, event.clientY - rect.top) ?? null);
      });
    };
    const leave = () => setDarkPoolMapTooltip(null);
    container.addEventListener("pointermove", move, { passive: true });
    container.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", leave);
    };
  }, [darkPoolMapIndicator]);

  const classicGexIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "classic-gex-profile") ?? null,
    [indicatorSignature, indicators],
  );
  const classicGexOverlay = useMemo(() => {
    if (!classicGexIndicator || !classicGexProfile || !candleSeriesRef.current) return null;
    const profileSettings = classicGexIndicator.settings ?? {};
    const plotWidth = Math.max(0, overlaySize.width - 64);
    const plotHeight = Math.max(0, overlaySize.height - 26 - indicatorPaneHeight);
    if (plotWidth < 160 || plotHeight < 80) return null;
    const profileWidth = Math.min(
      plotWidth * 0.45,
      Math.max(90, plotWidth * Math.max(8, Math.min(45, Number(profileSettings.profileWidth ?? 24))) / 100),
    );
    const halfWidth = Math.max(42, profileWidth / 2);
    const right = String(profileSettings.panelPosition ?? "RIGHT") !== "LEFT";
    const spineX = right ? plotWidth - halfWidth - 5 : halfWidth + 5;
    const logarithmic = profileSettings.logarithmicScaling === true;
    const minBarWidth = Math.max(1, Number(profileSettings.minBarWidth ?? 5));
    const contrast = Math.max(0.15, Math.min(1, Number(profileSettings.contrast ?? 70) / 100));
    const maxMagnitude = Math.max(
      1,
      ...classicGexProfile.rows.flatMap((row) => [Math.abs(row.call), Math.abs(row.put)]),
      ...classicGexHistory.flatMap((snapshot) => snapshot.rows.map((row) => Math.abs(row.net))),
    );
    const scale = (value: number) => {
      if (!value) return 0;
      const ratio = logarithmic
        ? Math.log1p(Math.abs(value)) / Math.log1p(maxMagnitude)
        : Math.abs(value) / maxMagnitude;
      return Math.max(minBarWidth, ratio * halfWidth);
    };
    const positioned = classicGexProfile.rows.flatMap((row) => {
      const y = candleSeriesRef.current?.priceToCoordinate(row.mappedPrice) ?? null;
      return y === null || y < 2 || y > plotHeight ? [] : [{ row, y }];
    }).sort((left, rightRow) => left.y - rightRow.y);
    const minimumGap = positioned.reduce((gap, row, index) => {
      if (!index) return gap;
      return Math.min(gap, Math.abs(row.y - positioned[index - 1].y));
    }, 12);
    const rowHeight = Math.max(2, Math.min(10, minimumGap * 0.68));
    const historyTargets = [1, 5, 15, 30].map((minutes) => {
      const target = Date.parse(classicGexProfile.asOf) - minutes * 60_000;
      const snapshot = classicGexHistory.reduce<ClassicGexHistorySnapshot | null>((best, candidate) => (
        !best || Math.abs(candidate.timestamp - target) < Math.abs(best.timestamp - target) ? candidate : best
      ), null);
      return snapshot && Math.abs(snapshot.timestamp - target) <= 90_000 ? { minutes, snapshot } : null;
    }).filter((value): value is { minutes: number; snapshot: ClassicGexHistorySnapshot } => Boolean(value));
    // Majors policy: the live GEX Bot values (already NQ basis, no mapping)
    // are the source of truth for these lines whenever they are fresh, so the
    // chart always matches the provider in real time. The QuantData-mapped
    // majors are the fallback only, and they are labelled as such. A mapping
    // that degenerated to scale 1 would draw raw index strikes on a futures
    // chart, so that fallback is suppressed entirely.
    const liveMajors = gexBotFlow?.status === "LIVE" ? gexBotFlow.majors : null;
    const mappingDegenerate = classicGexProfile.mapping.mode === "AUTO"
      && classicGexProfile.mapping.scale === 1
      && (classicGexProfile.sourceSymbol === "NDX" || classicGexProfile.sourceSymbol === "QQQ");
    const majorLine = (
      show: boolean,
      livePrice: number | null | undefined,
      mapped: { strike: number; mappedPrice: number; value: number } | null,
      label: string,
      color: string,
      dash: string,
    ) => {
      if (!show) return null;
      if (typeof livePrice === "number" && Number.isFinite(livePrice) && livePrice > 0) {
        return { strike: livePrice, mappedPrice: livePrice, value: livePrice, label: `${label} · GB live`, color, dash };
      }
      if (!mapped || mappingDegenerate) return null;
      const mappingChip = classicGexProfile.mapping.mode === "MANUAL"
        ? "QD manual map"
        : classicGexProfile.mapping.basis === "PINNED"
          ? "QD map · frozen basis"
          : "QD map";
      return { ...mapped, label: `${label} · ${mappingChip}`, color, dash };
    };
    const primitiveLines = [
      majorLine(profileSettings.showMajorPositiveVolume !== false, liveMajors?.volPositive, classicGexProfile.majors.positiveVolume, "Major + Vol", "#22C55E", "7 5"),
      majorLine(profileSettings.showMajorNegativeVolume !== false, liveMajors?.volNegative, classicGexProfile.majors.negativeVolume, "Major - Vol", "#EF4444", "7 5"),
      majorLine(profileSettings.showMajorPositiveOpenInterest !== false, liveMajors?.oiPositive, classicGexProfile.majors.positiveOpenInterest, "Major + OI", "#4ADE80", "2 4"),
      majorLine(profileSettings.showMajorNegativeOpenInterest !== false, liveMajors?.oiNegative, classicGexProfile.majors.negativeOpenInterest, "Major - OI", "#FB7185", "2 4"),
      majorLine(profileSettings.showZeroGamma !== false, liveMajors?.zeroGamma, classicGexProfile.zeroGamma, "Zero Gamma", String(profileSettings.zeroGammaColor ?? "#F4F4F5"), "9 5"),
    ].filter((line): line is NonNullable<typeof line> => Boolean(line));
    const lines = primitiveLines.flatMap((line) => {
      const y = candleSeriesRef.current?.priceToCoordinate(line.mappedPrice) ?? null;
      return y === null || y < 2 || y > plotHeight ? [] : [{ ...line, y }];
    });
    const primitiveData: ClassicGexPrimitiveData = {
      rows: classicGexProfile.rows,
      lines: primitiveLines,
      historyTargets,
      widthPercent: Math.max(8, Math.min(45, Number(profileSettings.profileWidth ?? 24))),
      logarithmic,
      minBarWidth,
      maxMagnitude,
      contrast,
      right,
      showLookbackDots: profileSettings.showLookbackDots !== false,
      showLabels: profileSettings.showLabels !== false,
      positiveColor: String(profileSettings.positiveColor ?? "#22C55E"),
      negativeColor: String(profileSettings.negativeColor ?? "#EF4444"),
      backgroundColor: settings.backgroundColor,
      foregroundColor: "#F4F4F5",
      precision: priceFormat.precision,
    };
    return {
      plotWidth,
      plotHeight,
      spineX,
      halfWidth,
      rowHeight,
      positioned,
      historyTargets,
      lines,
      scale,
      contrast,
      right,
      showLookbackDots: profileSettings.showLookbackDots !== false,
      showLabels: profileSettings.showLabels !== false,
      positiveColor: String(profileSettings.positiveColor ?? "#22C55E"),
      negativeColor: String(profileSettings.negativeColor ?? "#EF4444"),
      primitiveData,
    };
  }, [
    chartReadyRevision,
    classicGexHistory,
    classicGexIndicator,
    classicGexProfile,
    gexBotFlow,
    indicatorPaneHeight,
    overlaySize.height,
    overlaySize.width,
    priceFormat.precision,
    settings.backgroundColor,
    viewportVersion,
  ]);

  useEffect(() => {
    classicGexProfilePrimitiveRef.current?.update(classicGexOverlay?.primitiveData ?? null);
  }, [classicGexOverlay]);
  // D9: a MANUAL mapping is a user-frozen ratio with no staleness of its own,
  // so it is compared against the live-implied ratio on every payload and
  // badged with the drift in NQ points. It never renders as a verified map.
  const classicGexManualBadge = useMemo(() => {
    if (!classicGexProfile || classicGexProfile.mapping.mode !== "MANUAL") return null;
    const { scale, referenceScale } = classicGexProfile.mapping;
    const shortScale = scale.toFixed(6);
    if (!referenceScale || !classicGexProfile.sourcePrice) {
      return { tone: "danger" as const, text: `Manual map ×${shortScale} · no live ratio to verify` };
    }
    const pointsOff = Math.abs(scale - referenceScale) * classicGexProfile.sourcePrice;
    return pointsOff <= 15
      ? { tone: "warning" as const, text: `Manual map ×${shortScale} · ~${pointsOff.toFixed(0)}pt vs live` }
      : { tone: "danger" as const, text: `Manual map ×${shortScale} · ${pointsOff.toFixed(0)}pt OFF LIVE` };
  }, [classicGexProfile]);
  const expectedMoveIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "expected-move") ?? null,
    [indicatorSignature, indicators],
  );
  const expectedMoveSource = String(expectedMoveIndicator?.settings?.mappingSource ?? "QQQ") === "NDX"
    ? "NDX"
    : "QQQ";

  useEffect(() => {
    if (!expectedMoveIndicator) {
      setExpectedMovePayload(null);
      setExpectedMoveLoading(false);
      setExpectedMoveError(null);
      setExpectedMoveTooltip(null);
      return;
    }
    const normalizedInstrument = instrument.trim().toUpperCase();
    if (normalizedInstrument !== "NQ" && normalizedInstrument !== "MNQ") {
      setExpectedMovePayload(null);
      setExpectedMoveLoading(false);
      setExpectedMoveError("Expected Move is calibrated for NQ and MNQ.");
      return;
    }
    const source = expectedMoveSource;
    const storageKey = `kwantdesk:expected-move:last-good:v1:${source}`;
    let cancelled = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    const schedule = (payload: ExpectedMoveApiPayload | null, fallbackMs = 60_000) => {
      if (cancelled) return;
      const target = payload && !payload.stale
        ? Date.parse(payload.nextRefreshAt) + 1_000
        : Date.now() + fallbackMs;
      const delay = Math.max(30_000, Math.min(24 * 60 * 60_000, target - Date.now()));
      timer = window.setTimeout(load, delay);
    };
    const cachedFallback = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const cached = JSON.parse(raw) as ExpectedMoveApiPayload;
        if (!cached.generatedAt || !cached.range || cached.sourceSymbol !== source) return null;
        return staleExpectedMovePayload(cached, Date.now());
      } catch {
        return null;
      }
    };
    let retainedPayload = cachedFallback() ?? expectedMovePayload;
    if (retainedPayload) {
      setExpectedMovePayload(retainedPayload);
      setExpectedMoveLoading(false);
    }
    async function load() {
      if (cancelled) return;
      controller?.abort();
      controller = new AbortController();
      setExpectedMoveLoading(!retainedPayload);
      try {
        const response = await fetch(`/api/expected-move?source=${source}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const text = await response.text();
        let candidate: (ExpectedMoveApiPayload & { error?: string }) | null = null;
        try {
          candidate = JSON.parse(text) as ExpectedMoveApiPayload & { error?: string };
        } catch {
          throw new Error("Expected Move received a non-JSON data-source response.");
        }
        if (!response.ok || !candidate?.range || candidate.sourceSymbol !== source) {
          throw new Error(candidate?.error || "Expected Move is unavailable.");
        }
        if (cancelled) return;
        retainedPayload = candidate;
        setExpectedMovePayload(candidate);
        setExpectedMoveError(null);
        if (!candidate.stale) window.localStorage.setItem(storageKey, JSON.stringify(candidate));
        schedule(candidate, candidate.stale ? 60_000 : 5 * 60_000);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        const message = error instanceof Error ? error.message : "Expected Move is unavailable.";
        const fallbackSource = cachedFallback() ?? retainedPayload;
        const fallback = fallbackSource ? staleExpectedMovePayload(fallbackSource, Date.now()) : null;
        retainedPayload = fallback;
        setExpectedMovePayload(fallback);
        setExpectedMoveError(message);
        schedule(fallback, 60_000);
      } finally {
        if (!cancelled) setExpectedMoveLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  // Only the selected options book restarts the request, never chart ticks or
  // display-only settings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedMoveIndicator?.instanceId, expectedMoveSource, instrument]);

  useEffect(() => {
    if (!expectedMoveIndicator) return;
    const sample = () => {
      setExpectedMoveNow(Date.now());
      setExpectedMoveLiveAnchor(latestCandleRef.current?.close ?? candles.at(-1)?.close ?? null);
    };
    sample();
    const timer = window.setInterval(sample, 30_000);
    return () => window.clearInterval(timer);
  }, [expectedMoveIndicator?.instanceId]);

  const expectedMoveOverlay = useMemo(() => {
    if (!expectedMoveIndicator || !expectedMovePayload || !expectedMoveCalibration || !candleSeriesRef.current) return null;
    const normalizedInstrument = instrument.trim().toUpperCase();
    if (normalizedInstrument !== "NQ" && normalizedInstrument !== "MNQ") return null;
    const source = expectedMovePayload.sourceSymbol as ExpectedMoveSourceSymbol;
    const calibration = {
      sourceSymbol: source,
      targetInstrument: normalizedInstrument,
      sessionDate: expectedMoveCalibration.sessionDate,
      scale: expectedMoveCalibration.scale,
      calibratedAtMs: expectedMoveCalibration.calibratedAtMs,
    } as const;
    if (!isExpectedMoveCalibrationUsable({
      calibration,
      sourceSymbol: source,
      targetInstrument: normalizedInstrument,
      sessionDate: expectedMovePayload.sessionDate,
      marketOpen: expectedMovePayload.marketOpen,
      now: expectedMoveNow,
      ratioIsSane: isOptionsFuturesRatioSane(source, expectedMoveCalibration.scale),
    })) return null;
    const mode = String(expectedMoveIndicator.settings?.mode ?? "SESSION") === "LIVE" ? "LIVE" : "SESSION";
    const currentPrice = expectedMoveLiveAnchor ?? candles.at(-1)?.close ?? 0;
    const band = buildExpectedMoveBand({
      mode,
      range: expectedMovePayload.range,
      scale: expectedMoveCalibration.scale,
      currentPrice,
      now: expectedMoveNow,
      sessionDate: expectedMovePayload.sessionDate,
      tickSize: priceFormat.minMove,
    });
    if (!band) return null;
    const plotWidth = Math.max(0, overlaySize.width - 64);
    const plotHeight = Math.max(0, overlaySize.height - 26 - indicatorPaneHeight);
    if (plotWidth < 160 || plotHeight < 80) return null;
    const showTwoSigma = expectedMoveIndicator.settings?.showTwoSigma === true;
    const rails = [
      { key: "high", sigma: 1 as const, price: band.high },
      { key: "low", sigma: 1 as const, price: band.low },
      ...(showTwoSigma
        ? [
            { key: "high-2", sigma: 2 as const, price: expectedMoveSigmaRails(band, 2).high },
            { key: "low-2", sigma: 2 as const, price: expectedMoveSigmaRails(band, 2).low },
          ]
        : []),
    ].flatMap((rail) => {
      const y = candleSeriesRef.current?.priceToCoordinate(rail.price) ?? null;
      return y === null || y < 0 || y > plotHeight
        ? []
        : [{ ...rail, y: Number(y), labelY: Number(y) + 3 }];
    });
    const occupied: number[] = [
      ...resolvedLevelLayers.foreground,
      ...resolvedLevelLayers.background,
    ].flatMap((level) => {
      const y = candleSeriesRef.current?.priceToCoordinate(level.price) ?? null;
      return y === null ? [] : [y];
    });
    const ordered = rails.slice().sort((left, right) => left.y - right.y);
    const minimumGap = 11;
    ordered.forEach((rail, index) => {
      let labelY = Math.max(9, Math.min(plotHeight - 4, rail.labelY));
      while (occupied.some((y) => Math.abs(y - labelY) < minimumGap)) labelY += minimumGap;
      if (index && labelY - ordered[index - 1].labelY < minimumGap) {
        labelY = ordered[index - 1].labelY + minimumGap;
      }
      rail.labelY = Math.max(9, Math.min(plotHeight - 4, labelY));
      occupied.push(rail.labelY);
    });
    const oneHighY = candleSeriesRef.current?.priceToCoordinate(band.high) ?? null;
    const oneLowY = candleSeriesRef.current?.priceToCoordinate(band.low) ?? null;
    const settingsForExpectedMove = expectedMoveIndicator.settings ?? {};
    return {
      band,
      rails,
      plotWidth,
      plotHeight,
      oneHighY,
      oneLowY,
      showLabels: settingsForExpectedMove.showLabels !== false,
      showBandFill: settingsForExpectedMove.showBandFill === true,
      fillOpacity: Math.min(0.04, Math.max(0, Number(settingsForExpectedMove.fillOpacity ?? 3) / 100)),
      lineOpacity: Math.max(0.15, Math.min(1, Number(settingsForExpectedMove.lineOpacity ?? 72) / 100)),
      color: settingsForExpectedMove.useThemeColors === true
        ? settings.borderUpColor
        : String(settingsForExpectedMove.neutralColor ?? "#D6A84B"),
    };
  }, [
    candles,
    chartReadyRevision,
    expectedMoveCalibration,
    expectedMoveIndicator,
    expectedMoveLiveAnchor,
    expectedMoveNow,
    expectedMovePayload,
    indicatorPaneHeight,
    instrument,
    overlaySize.height,
    overlaySize.width,
    priceFormat.minMove,
    resolvedLevelLayers.background,
    resolvedLevelLayers.foreground,
    settings.borderUpColor,
    viewportVersion,
  ]);
  const hedgeLevelsIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "hedge-levels") ?? null,
    [indicatorSignature, indicators],
  );
  const hedgeLevelsInstrument = instrument.trim().toUpperCase().includes("MNQ")
    ? "MNQ" as const
    : instrument.trim().toUpperCase().includes("NQ")
      ? "NQ" as const
      : null;

  useEffect(() => {
    if (!hedgeLevelsIndicator) {
      setHedgeLevelsPayload(null);
      setHedgeLevelsLoading(false);
      setHedgeLevelsError(null);
      setHedgeLevelsTooltip(null);
      setHedgeLevelsPulseIds([]);
      previousHedgeLevelsRef.current = null;
      return;
    }
    if (!hedgeLevelsInstrument) {
      setHedgeLevelsPayload(null);
      setHedgeLevelsLoading(false);
      setHedgeLevelsError("Hedge Levels is available on NQ and MNQ.");
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let pulseTimer: number | null = null;
    let controller: AbortController | null = null;
    const storageKey = `kwantdesk:hedge-levels:last-good:v1:${hedgeLevelsInstrument}`;
    const readCached = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as HedgeLevelsPayload;
        if (!Array.isArray(parsed.levels) || !parsed.generatedAt || parsed.instrument !== hedgeLevelsInstrument) return null;
        return staleHedgeLevelsPayload(parsed, Date.now());
      } catch {
        return null;
      }
    };
    let retained = readCached() ?? hedgeLevelsPayload;
    if (retained) {
      setHedgeLevelsPayload(retained);
      previousHedgeLevelsRef.current = retained.levels;
      setHedgeLevelsLoading(false);
    }
    const schedule = (payload: HedgeLevelsPayload | null, fallbackMs = 60_000) => {
      if (cancelled) return;
      const delay = Math.max(30_000, Math.min(5 * 60_000, payload?.refreshAfterMs ?? fallbackMs));
      timer = window.setTimeout(load, delay);
    };
    async function load() {
      if (cancelled) return;
      controller?.abort();
      controller = new AbortController();
      setHedgeLevelsLoading(!retained);
      try {
        const response = await fetch(`/api/hedge-levels?instrument=${hedgeLevelsInstrument}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const text = await response.text();
        let candidate: (HedgeLevelsPayload & { error?: string }) | null = null;
        try {
          candidate = JSON.parse(text) as HedgeLevelsPayload & { error?: string };
        } catch {
          throw new Error("Hedge Levels received a non-JSON data-source response.");
        }
        if (!response.ok || !candidate || !Array.isArray(candidate.levels)) {
          throw new Error(candidate?.error || "Hedge Levels is temporarily unavailable.");
        }
        if (cancelled) return;
        const movement = hedgeLevelMovement(
          previousHedgeLevelsRef.current,
          candidate.levels,
          candidate.strikeInterval > 0 ? candidate.strikeInterval : 25,
        );
        previousHedgeLevelsRef.current = movement.levels;
        if (movement.pulseIds.length) {
          setHedgeLevelsPulseIds(movement.pulseIds);
          if (pulseTimer !== null) window.clearTimeout(pulseTimer);
          pulseTimer = window.setTimeout(() => setHedgeLevelsPulseIds([]), 900);
        }
        retained = candidate;
        setHedgeLevelsPayload(candidate);
        setHedgeLevelsError(null);
        if (!candidate.stale) window.localStorage.setItem(storageKey, JSON.stringify(candidate));
        schedule(candidate);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        const message = error instanceof Error ? error.message : "Hedge Levels is temporarily unavailable.";
        const fallbackSource = readCached() ?? retained;
        const fallback = fallbackSource ? staleHedgeLevelsPayload(fallbackSource, Date.now()) : null;
        retained = fallback;
        setHedgeLevelsPayload(fallback);
        setHedgeLevelsError(message);
        schedule(fallback);
      } finally {
        if (!cancelled) setHedgeLevelsLoading(false);
      }
    }
    void load();
    const ageTimer = window.setInterval(() => setHedgeLevelsNow(Date.now()), 1_000);
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
      if (pulseTimer !== null) window.clearTimeout(pulseTimer);
      window.clearInterval(ageTimer);
    };
  // A display setting never restarts the network request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hedgeLevelsIndicator?.instanceId, hedgeLevelsInstrument]);

  const hedgeLevelsOverlay = useMemo(() => {
    if (!hedgeLevelsIndicator || !hedgeLevelsPayload || !candleSeriesRef.current) return null;
    const plotWidth = Math.max(0, overlaySize.width - 64);
    const plotHeight = Math.max(0, overlaySize.height - 26 - indicatorPaneHeight);
    if (plotWidth < 160 || plotHeight < 80) return null;
    const positioned = renderableHedgeLevels(true, hedgeLevelsPayload.levels).flatMap((level) => {
      const centreY = candleSeriesRef.current?.priceToCoordinate(level.price) ?? null;
      if (centreY === null || centreY < -16 || centreY > plotHeight + 16) return [];
      if (level.kind === "FLIP") {
        return [{ level, centreY: Number(centreY), y: Number(centreY), height: 1 }];
      }
      const highY = candleSeriesRef.current?.priceToCoordinate(level.zoneHigh) ?? null;
      const lowY = candleSeriesRef.current?.priceToCoordinate(level.zoneLow) ?? null;
      if (highY === null || lowY === null) return [];
      return [{
        level,
        centreY: Number(centreY),
        y: Math.min(Number(highY), Number(lowY)),
        height: Math.max(2, Math.abs(Number(lowY) - Number(highY))),
      }];
    });
    const labelRows = staggerHedgeLabels(positioned.map(({ level, centreY }) => ({ id: level.id, y: centreY })), 14);
    const labelY = new Map(labelRows.map((row) => [row.id, Math.max(10, Math.min(plotHeight - 5, row.labelY))]));
    const flip = positioned.find((row) => row.level.kind === "FLIP") ?? null;
    const indicatorSettings = hedgeLevelsIndicator.settings ?? {};
    return {
      positioned,
      labelY,
      flipY: flip?.centreY ?? null,
      plotWidth,
      plotHeight,
      showBelowFlip: indicatorSettings.showBelowFlip !== false,
      showLabels: indicatorSettings.showLabels !== false,
      fillOpacity: Math.max(0.01, Math.min(0.1, Number(indicatorSettings.fillOpacity ?? 5) / 100)),
      lineOpacity: Math.max(0.1, Math.min(1, Number(indicatorSettings.lineOpacity ?? 62) / 100)),
    };
  }, [
    chartReadyRevision,
    hedgeLevelsIndicator,
    hedgeLevelsPayload,
    indicatorPaneHeight,
    overlaySize.height,
    overlaySize.width,
    viewportVersion,
  ]);

  useEffect(() => {
    const primitive = hedgeLevelsPrimitiveRef.current;
    if (!primitive) return;
    const indicatorSettings = hedgeLevelsIndicator?.settings ?? {};
    primitive.update(
      hedgeLevelsIndicator && hedgeLevelsPayload
        ? renderableHedgeLevels(true, hedgeLevelsPayload.levels)
        : [],
      {
        showBelowFlip: indicatorSettings.showBelowFlip !== false,
        showLabels: indicatorSettings.showLabels !== false,
        fillOpacity: Math.max(0.01, Math.min(0.1, Number(indicatorSettings.fillOpacity ?? 5) / 100)),
        lineOpacity: Math.max(0.1, Math.min(1, Number(indicatorSettings.lineOpacity ?? 62) / 100)),
        stale: hedgeLevelsPayload?.stale ?? false,
        pulseIds: hedgeLevelsPulseIds,
        backgroundColor: settings.backgroundColor,
      },
    );
  }, [
    chartReadyRevision,
    hedgeLevelsIndicator,
    hedgeLevelsPayload,
    hedgeLevelsPulseIds,
    settings.backgroundColor,
  ]);
  const tpoIndicator = useMemo(
    () => indicators.find((instance) => instance.enabled && instance.indicatorId === "tpo-levels") ?? null,
    [indicatorSignature, indicators],
  );
  const tpoSettingsSignature = JSON.stringify(tpoIndicator?.settings ?? {});
  const tpoDataSignature = useMemo(() => {
    const params = new URLSearchParams();
    const settingsForTpo = tpoIndicator?.settings ?? {};
    TPO_LEVEL_QUERY_KEYS.forEach((key) => {
      const value = Number(settingsForTpo[key]);
      if (Number.isFinite(value)) params.set(key, String(value));
    });
    return params.toString();
  }, [tpoSettingsSignature, tpoIndicator]);
  const tpoSupportsInstrument = /(^|[^A-Z])M?NQ([^A-Z]|$)/.test(instrument.trim().toUpperCase());

  useEffect(() => {
    if (!tpoIndicator) {
      setTpoPayload(null);
      setTpoLoading(false);
      setTpoError(null);
      setTpoTooltip(null);
      return;
    }
    if (!tpoSupportsInstrument) {
      setTpoPayload(null);
      setTpoLoading(false);
      setTpoError("TPO Levels are calculated on NQ and displayed identically on MNQ.");
      return;
    }
    let cancelled = false;
    let timer: number | null = null;
    const controller = new AbortController();
    const params = new URLSearchParams(tpoDataSignature);
    const storageKey = `kwantdesk:tpo-levels:last-good:v2:${tpoDataSignature || "default"}`;
    const latestStorageKey = "kwantdesk:tpo-levels:last-good:v2:latest";
    const schedule = (payload: TpoLevelsPayload | null, fallbackMs = 60_000) => {
      if (cancelled) return;
      const target = payload && !payload.stale
        ? Date.parse(payload.nextRefreshAt) + 1_000
        : Date.now() + fallbackMs;
      const delay = Math.max(30_000, Math.min(24 * 60 * 60_000, target - Date.now()));
      timer = window.setTimeout(load, delay);
    };
    const readCachedPayload = () => {
      const legacyKeys = Object.keys(window.localStorage)
        .filter((key) => key.startsWith("kwantdesk:tpo-levels:last-good:v1:"));
      for (const key of [storageKey, latestStorageKey, ...legacyKeys]) {
        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          const cached = JSON.parse(raw) as TpoLevelsPayload;
          if (!Array.isArray(cached.zones) || !cached.generatedAt) continue;
          const refreshAt = Date.parse(cached.nextRefreshAt);
          const stale = cached.stale || !Number.isFinite(refreshAt) || refreshAt <= Date.now();
          return {
            ...cached,
            stale,
            dataAge: stale ? Math.max(0, Date.now() - Date.parse(cached.generatedAt)) : cached.dataAge,
          } satisfies TpoLevelsPayload;
        } catch {
          // A single malformed legacy cache must not hide another valid copy.
        }
      }
      return null;
    };
    let retainedPayload = readCachedPayload() ?? tpoPayload;
    if (retainedPayload) {
      setTpoPayload(retainedPayload);
      setTpoLoading(false);
    }
    async function load() {
      setTpoLoading(!retainedPayload);
      try {
        const response = await fetch(`/api/databento/tpo-levels?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const text = await response.text();
        let candidate: (TpoLevelsPayload & { error?: string }) | null = null;
        try {
          candidate = JSON.parse(text) as TpoLevelsPayload & { error?: string };
        } catch {
          throw new Error("TPO Levels received a non-JSON data-source response.");
        }
        if (!response.ok || !candidate || !Array.isArray(candidate.zones)) {
          throw new Error(candidate?.error || "TPO Levels are unavailable.");
        }
        if (cancelled) return;
        retainedPayload = candidate;
        setTpoPayload(candidate);
        setTpoError(null);
        if (!candidate.stale) {
          const serialized = JSON.stringify(candidate);
          window.localStorage.setItem(storageKey, serialized);
          window.localStorage.setItem(latestStorageKey, serialized);
        }
        schedule(candidate, candidate.stale ? 60_000 : 5 * 60_000);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        const message = error instanceof Error ? error.message : "TPO Levels are unavailable.";
        const cached = readCachedPayload();
        const fallbackSource = cached ?? retainedPayload;
        const fallback = fallbackSource ? {
          ...fallbackSource,
          stale: true,
          dataAge: Math.max(0, Date.now() - Date.parse(fallbackSource.generatedAt)),
        } satisfies TpoLevelsPayload : null;
        if (fallback) {
          retainedPayload = fallback;
          setTpoPayload(fallback);
          setTpoError(message);
        } else {
          setTpoPayload(null);
          setTpoError(message);
        }
        schedule(fallback, 60_000);
      } finally {
        if (!cancelled) setTpoLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  // Only calculation settings belong in the data signature. Visual changes
  // must never abort a completed-session request or discard a valid profile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpoDataSignature, tpoIndicator?.instanceId, tpoSupportsInstrument]);

  const tpoOverlay = useMemo(() => {
    if (!tpoIndicator || !tpoPayload || !candleSeriesRef.current || !chartRef.current) return null;
    const plotWidth = Math.max(0, overlaySize.width - 64);
    const plotHeight = Math.max(0, overlaySize.height - 26 - indicatorPaneHeight);
    if (plotWidth < 160 || plotHeight < 80) return null;
    const latestPrice = candles.at(-1)?.close ?? tpoPayload.currentPrice;
    const settingsForTpo = tpoIndicator.settings ?? {};
    const existingLevels = levels ?? [];
    const prioritized = tpoPayload.zones.map((zone) => {
      const centre = (zone.low + zone.high) / 2;
      const distanceRows = latestPrice == null
        ? 0
        : Math.abs(latestPrice - centre) / Math.max(0.25, tpoPayload.source.rowSize);
      const confluence = existingLevels.filter((level) => level.price >= zone.low && level.price <= zone.high);
      const boostedStrength = Math.min(100, zone.strength + Math.min(15, confluence.length * 5));
      const priority = boostedStrength
        * (0.8 ** zone.touches)
        * (0.92 ** zone.ageSessions)
        / (1 + distanceRows / 100);
      return {
        ...zone,
        strength: boostedStrength,
        currentPriority: priority,
        confluenceReasons: [...new Set([
          ...zone.confluenceReasons,
          ...confluence.map((level) => `Automatic level: ${level.label}`),
        ])],
      };
    });
    const displayed = applyTpoDisplayCap(prioritized, latestPrice, 3).filter((zone) => zone.displayed && zone.active);
    const useThemeColors = settingsForTpo.useThemeColors !== false;
    const colors = {
      support: useThemeColors ? settings.upColor : String(settingsForTpo.supportColor ?? settings.upColor),
      resistance: useThemeColors ? settings.downColor : String(settingsForTpo.resistanceColor ?? settings.downColor),
      neutral: useThemeColors ? settings.borderUpColor : String(settingsForTpo.neutralColor ?? settings.borderUpColor),
    };
    const maxOpacity = clamp(Number(settingsForTpo.fillOpacity ?? 15) / 100, 0.03, 0.35);
    const borderOpacity = clamp(Number(settingsForTpo.borderOpacity ?? 58) / 100, 0.1, 1);
    const latestCandle = candles.at(-1) ?? null;
    const latestChartTime = latestCandle
      ? eventChartTimeBySourceTimeRef.current.get(latestCandle.timestamp) ?? Math.floor(latestCandle.timestamp / 1_000)
      : null;
    const latestCandleX = latestChartTime == null
      ? null
      : chartRef.current.timeScale().timeToCoordinate(latestChartTime as Time);
    const zoneRightEdge = latestCandleX == null
      ? plotWidth
      : Math.max(4, Math.min(plotWidth, latestCandleX));
    const positioned = displayed.flatMap((zone) => {
      const highY = candleSeriesRef.current?.priceToCoordinate(zone.high) ?? null;
      const lowY = candleSeriesRef.current?.priceToCoordinate(zone.low) ?? null;
      if (highY === null || lowY === null) return [];
      const rawTop = Math.min(highY, lowY);
      const rawBottom = Math.max(highY, lowY);
      if (rawBottom < 0 || rawTop > plotHeight) return [];
      const top = Math.max(0, rawTop);
      const bottom = Math.min(plotHeight, rawBottom);
      const color = zone.side === "SUPPORT" ? colors.support
        : zone.side === "RESISTANCE" ? colors.resistance
          : colors.neutral;
      return [{
        zone,
        x: 0,
        y: top,
        width: zoneRightEdge,
        height: Math.max(3, bottom - top),
        centreY: (top + bottom) / 2,
        color,
        opacity: maxOpacity * (0.35 + 0.65 * zone.strength / 100),
      }];
    });
    const labelY = new Map<string, number>();
    const orderedLabels = positioned.slice().sort((left, right) => left.centreY - right.centreY);
    const minimumY = 9;
    const maximumY = plotHeight - 4;
    const labelGap = orderedLabels.length > 1
      ? Math.min(13, (maximumY - minimumY) / (orderedLabels.length - 1))
      : 13;
    const resolvedLabels = orderedLabels.map((item) => ({
      item,
      y: Math.max(minimumY, Math.min(maximumY, item.centreY + 3)),
    }));
    for (let index = 1; index < resolvedLabels.length; index += 1) {
      resolvedLabels[index].y = Math.max(resolvedLabels[index].y, resolvedLabels[index - 1].y + labelGap);
    }
    for (let index = resolvedLabels.length - 2; index >= 0; index -= 1) {
      resolvedLabels[index].y = Math.min(resolvedLabels[index].y, resolvedLabels[index + 1].y - labelGap);
    }
    if (resolvedLabels.length && resolvedLabels[0].y < minimumY) {
      const shift = minimumY - resolvedLabels[0].y;
      resolvedLabels.forEach((entry) => { entry.y += shift; });
    }
    if (resolvedLabels.length && resolvedLabels.at(-1)!.y > maximumY) {
      const shift = resolvedLabels.at(-1)!.y - maximumY;
      resolvedLabels.forEach((entry) => { entry.y -= shift; });
    }
    resolvedLabels.forEach(({ item, y }) => labelY.set(item.zone.id, y));
    return {
      plotWidth,
      plotHeight,
      positioned,
      labelY,
      showLabels: settingsForTpo.showLabels !== false,
      borderOpacity,
    };
  }, [
    candles,
    chartReadyRevision,
    indicatorPaneHeight,
    levels,
    overlaySize.height,
    overlaySize.width,
    settings.borderUpColor,
    settings.downColor,
    settings.upColor,
    tpoIndicator,
    tpoPayload,
    viewportVersion,
  ]);
  const resizeIndicatorPane = useCallback((key: string, nextHeight: number) => {
    setIndicatorPaneHeights((current) => ({
      ...current,
      [key]: Math.max(64, Math.min(420, Math.round(nextHeight))),
    }));
  }, []);
  const toggleIndicatorPane = useCallback((key: string) => {
    setCollapsedIndicatorPanes((current) => ({ ...current, [key]: !current[key] }));
  }, []);
  const moveIndicatorPane = useCallback((
    key: string,
    dock: IndicatorPaneDock,
    targetIndex: number,
  ) => {
    setIndicatorPaneLayout((current) => {
      const placements = new Map(calculatedIndicatorPanes.map((group, sourceIndex) => [
        group.key,
        current[group.key] ?? { dock: "bottom" as const, order: sourceIndex },
      ] as const));
      const targetKeys = calculatedIndicatorPanes
        .filter((group) => group.key !== key && placements.get(group.key)?.dock === dock)
        .sort((left, right) =>
          (placements.get(left.key)?.order ?? 0) - (placements.get(right.key)?.order ?? 0))
        .map((group) => group.key);
      targetKeys.splice(Math.max(0, Math.min(targetKeys.length, targetIndex)), 0, key);
      const next: IndicatorPaneLayoutMap = { ...current };
      targetKeys.forEach((paneKey, order) => {
        next[paneKey] = { dock, order };
      });
      (Object.keys(next) as string[]).forEach((paneKey) => {
        if (paneKey !== key && next[paneKey].dock !== dock) return;
        if (!targetKeys.includes(paneKey)) delete next[paneKey];
      });
      return next;
    });
  }, [calculatedIndicatorPanes]);
  const indicatorTimeToX = useCallback(
    (time: number) => {
      // Time-based candles can use their epoch second directly. Event-based
      // candles (volume, range, Renko, ticks) cannot: several bars may finish
      // inside the same second, so the price series gives each one a synthetic
      // sequential chart time. Resolve the original millisecond timestamp back
      // to that synthetic time so pane indicators stay one-to-one with price.
      const sourceTimestamp = Math.round(time * 1_000);
      const eventChartTime = eventChartTimeBySourceTimeRef.current.get(sourceTimestamp);
      const chartTime = eventChartTime ?? time;
      return chartRef.current?.timeScale().timeToCoordinate(chartTime as Time) ?? null;
    },
    [],
  );
  const indicatorTimestampToX = useCallback(
    (timestamp: number) => {
      const eventChartTime = eventChartTimeBySourceTimeRef.current.get(timestamp);
      const chartTime = eventChartTime ?? Math.floor(timestamp / 1_000);
      return chartRef.current?.timeScale().timeToCoordinate(chartTime as Time) ?? null;
    },
    [],
  );
  const deltaHighlightInstance = useMemo(
    () => indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "delta-highlight") ?? null,
    [indicatorSignature, indicators],
  );
  const deltaHighlightMarkers = useMemo(() => {
    if (!deltaHighlightInstance || !candleSeriesRef.current) return [];
    const candleByTime = new Map(
      indicatorCandles.map((candle) => [Math.floor(candle.timestamp / 1_000), candle]),
    );
    const settingsForIndicator = deltaHighlightInstance.settings ?? {};
    const useThemeColors = settingsForIndicator.useThemeColors !== false;
    const askColor = useThemeColors
      ? settings.upColor
      : String(settingsForIndicator.askColor ?? settings.upColor);
    const bidColor = useThemeColors
      ? settings.downColor
      : String(settingsForIndicator.bidColor ?? settings.downColor);
    const markerPosition = String(settingsForIndicator.markerPosition ?? "inBar");
    const size = Math.max(4, Math.min(18, Number(settingsForIndicator.markerSize ?? 1) * 7));
    const opacity = Math.max(0.05, Math.min(1, Number(settingsForIndicator.opacity ?? 82) / 100));
    const showValue = settingsForIndicator.showValue !== false;
    const shape = String(settingsForIndicator.markerShape ?? "square");

    return calculateDeltaPercentHighlights(deltaHighlightInstance, indicatorCandles)
      .flatMap((point) => {
        const candle = candleByTime.get(point.time);
        if (!candle) return [];
        const x = indicatorTimeToX(point.time);
        const markerPrice = markerPosition === "aboveBar"
          ? candle.high + priceFormat.minMove * 2
          : markerPosition === "belowBar"
            ? candle.low - priceFormat.minMove * 2
            : markerPosition === "outside"
              ? point.side === "ask"
                ? candle.high + priceFormat.minMove * 2
                : candle.low - priceFormat.minMove * 2
              : (candle.open + candle.close) / 2;
        const y = candleSeriesRef.current?.priceToCoordinate(markerPrice) ?? null;
        if (x === null || y === null) return [];
        return [{
          ...point,
          x,
          y,
          size,
          opacity,
          showValue,
          shape,
          color: point.side === "ask" ? askColor : bidColor,
        }];
      });
  }, [
    chartReadyRevision,
    deltaHighlightInstance,
    indicatorCandles,
    indicatorTimeToX,
    priceFormat.minMove,
    settings.downColor,
    settings.upColor,
    viewportVersion,
  ]);
  const updateIndicatorPaneSetting = useCallback(
    (instanceId: string, key: string, value: number | string | boolean) =>
      updateIndicatorSettingRef.current?.(instanceId, key, value),
    [],
  );
  const openIndicatorPaneSettings = useCallback(
    (instanceId: string) => openIndicatorSettingsRef.current?.(instanceId),
    [],
  );
  const candleIntervalMs = useMemo(
    () => timeframe && isEventBasedChartInterval(timeframe)
      ? null
      : timeframeToMs(timeframe) ?? inferCandleIntervalMs(candles),
    [candles, timeframe],
  );
  const tpoSourceBars = useMemo<TpoBar[]>(() => {
    const tickSize = priceFormat.minMove;
    return sampledIndicatorCandles.map((candle, index) => ({
      instrumentId: instrument,
      startTimeMs: candle.timestamp,
      endTimeMs: sampledIndicatorCandles[index + 1]?.timestamp
        ?? candle.timestamp + (candleIntervalMs ?? 60_000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      bidVolume: candle.bidVolume,
      askVolume: candle.askVolume,
      tradeCount: candle.trades,
      tickSize,
    }));
  }, [candleIntervalMs, instrument, priceFormat.minMove, sampledIndicatorCandles]);
  const deepEffortIndicator = useMemo(
    () => indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "deep-m-effort-nq") ?? null,
    [indicatorSignature, indicators],
  );
  const deepEffort = useMemo(
    () => deepEffortIndicator
      ? calculateDeepEffort(indicatorCandles, {
          zoneBars: Number(deepEffortIndicator.settings?.zoneBars ?? 22),
          tickSize: priceFormat.minMove,
          instrument,
        })
      : null,
    [deepEffortIndicator, indicatorCandles, instrument, priceFormat.minMove],
  );
  const bigTradesIndicator = useMemo(
    () => indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "big-trades") ?? null,
    [indicatorSignature, indicators],
  );
  const depthOfMarketIndicator = useMemo(
    () => indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "depth-of-market") ?? null,
    [indicatorSignature, indicators],
  );
  const bigTradePrints = useMemo(
    () => bigTradesIndicator
      ? calculateBigTradePrints(
          indicatorCandles,
          indicatorMarketTrades,
          { ...(bigTradesIndicator.settings ?? {}), tickSize: priceFormat.minMove },
        )
      : [],
    [bigTradesIndicator, indicatorCandles, indicatorMarketTrades, priceFormat.minMove],
  );
  const anchoredBigTradePrints = useMemo(() => {
    if (!indicatorCandles.length || !bigTradePrints.length) return [];
    const anchored = anchorBigTradePrintsToCandles(bigTradePrints, indicatorCandles);
    const indicatorSettings = bigTradesIndicator?.settings ?? {};
    const combineByCandle = indicatorSettings.combineByCandle !== false;
    const isTimeAggregation = combineByCandle && candleIntervalMs != null && candleIntervalMs >= 60_000;
    // Kwantify's execution view never collapses a range/volume/Renko bar into
    // one same-side bubble. Those bars are defined by market events rather
    // than clock time, so preserving their strongest individual prints is the
    // visual behaviour traders expect from 40 Range.
    if (!isTimeAggregation) {
      const maxPerBar = Math.max(1, Math.min(50, Number(indicatorSettings.maxMarkersPerBar ?? 6)));
      const byBar = new Map<number, AnchoredBigTradePrint[]>();
      anchored.forEach((print) => {
        const group = byBar.get(print.chartTimestamp) ?? [];
        group.push(print);
        byBar.set(print.chartTimestamp, group);
      });
      return Array.from(byBar.values())
        .flatMap((group) => group.sort((left, right) => right.volume - left.volume).slice(0, maxPerBar))
        .sort((left, right) => left.timestamp - right.timestamp);
    }

    const grouped = new Map<string, AnchoredBigTradePrint>();
    anchored.forEach((print) => {
      const key = `${print.chartTimestamp}:${print.side}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, { ...print, id: `bar-${print.chartTimestamp}-${print.side}` });
        return;
      }
      existing.volume += print.volume;
      existing.executions += print.executions;
      // Match Kwantify: the first qualified execution owns the marker's exact
      // price. Later same-side executions grow it without sliding it.
    });
    const aggregates = Array.from(grouped.values());
    const intervalMinutes = candleIntervalMs / 60_000;
    const historical = aggregates.filter((print) =>
      print.chartTimestamp !== indicatorCandles.at(-1)?.timestamp);
    let adaptiveThreshold = 0;
    if (indicatorSettings.adaptiveTimeframeFilter !== false && historical.length >= 6) {
      const percentile = intervalMinutes >= 240
        ? 0.97
        : intervalMinutes >= 60
          ? 0.94
          : intervalMinutes >= 15
            ? 0.9
            : intervalMinutes >= 5
              ? 0.8
              : 0.65;
      const sortedVolumes = historical.map((print) => print.volume).sort((a, b) => a - b);
      const position = percentile * (sortedVolumes.length - 1);
      const lower = Math.floor(position);
      const upper = Math.ceil(position);
      const weight = position - lower;
      adaptiveThreshold = sortedVolumes[lower] * (1 - weight) + sortedVolumes[upper] * weight;
    }
    const latestTimestamp = indicatorCandles.at(-1)?.timestamp;
    const visible = aggregates.filter((print) =>
      print.chartTimestamp === latestTimestamp || print.volume >= adaptiveThreshold);
    if (!visible.length) return [];
    const volumes = visible.map((print) => print.volume);
    const minimumVolume = Math.min(...volumes);
    const maximumVolume = Math.max(...volumes);
    const visualRange = Math.max(1, maximumVolume - minimumVolume);
    const minimumSize = clamp(Number(indicatorSettings.minimumSize ?? 6), 1, 80);
    const maximumSize = Math.max(
      minimumSize,
      clamp(Number(indicatorSettings.maximumSize ?? 32), 1, 160),
    );
    const minimumOpacity = clamp(Number(indicatorSettings.minimumOpacity ?? 25) / 100, 0, 1);
    const maximumOpacity = Math.max(
      minimumOpacity,
      clamp(Number(indicatorSettings.maximumOpacity ?? 90) / 100, 0, 1),
    );
    return visible.map((print) => {
      const visualWeight = Math.sqrt(clamp(
        (print.volume - minimumVolume) / visualRange,
        0,
        1,
      ));
      return {
        ...print,
        radius: minimumSize + (maximumSize - minimumSize) * visualWeight,
        opacity: minimumOpacity + (maximumOpacity - minimumOpacity) * visualWeight,
      };
    }).sort((left, right) => left.timestamp - right.timestamp);
  }, [bigTradePrints, bigTradesIndicator?.settings, candleIntervalMs, indicatorCandles]);
  const bigTradePrimitiveMarkers = useMemo<BigTradePrimitiveMarker[]>(() =>
    anchoredBigTradePrints.map((print) => ({
      ...print,
      time: (
        eventChartTimeBySourceTimeRef.current.get(print.chartTimestamp)
        ?? Math.floor(print.chartTimestamp / 1_000)
      ) as Time,
    })), [anchoredBigTradePrints, chartReadyRevision]);

  useEffect(() => {
    const primitive = bigTradesPrimitiveRef.current;
    if (!primitive) return;
    const tradeSettings = bigTradesIndicator?.settings ?? {};
    const useThemeColors = tradeSettings.useThemeColors !== false;
    const rawMarkerType = String(tradeSettings.markerType ?? "circle");
    const markerType: BigTradesPrimitiveOptions["markerType"] =
      rawMarkerType === "square" || rawMarkerType === "diamond" || rawMarkerType === "text"
        ? rawMarkerType
        : "circle";
    const rawInformationMode = String(tradeSettings.informationMode ?? "volume");
    const informationMode: BigTradesPrimitiveOptions["informationMode"] =
      rawInformationMode === "side-volume"
      || rawInformationMode === "executions"
      || rawInformationMode === "full"
        ? rawInformationMode
        : "volume";
    const themeStyles = window.getComputedStyle(document.documentElement);
    primitive.update(
      bigTradesIndicator ? bigTradePrimitiveMarkers : [],
      {
        askColor: useThemeColors
          ? settings.upColor
          : String(tradeSettings.askColor ?? settings.upColor),
        bidColor: useThemeColors
          ? settings.downColor
          : String(tradeSettings.bidColor ?? settings.downColor),
        markerType,
        hollowFill: tradeSettings.hollowFill === true,
        informationMode,
        showLabels: tradeSettings.showLabels !== false,
        labelMinSize: Number(tradeSettings.labelMinSize ?? 14),
        textColor: themeStyles.getPropertyValue("--foreground").trim() || "#F5F5F5",
        backgroundColor: settings.backgroundColor,
      },
    );
  }, [
    bigTradePrimitiveMarkers,
    bigTradesIndicator,
    chartReadyRevision,
    settings.backgroundColor,
    settings.downColor,
    settings.upColor,
    themeVersion,
  ]);
  const bigBlockRenderZones = useMemo<BigBlockRenderZone[]>(() => {
    if (!deepEffort || deepEffortIndicator?.settings?.showZones === false) return [];
    return deepEffort.zones.flatMap((zone) => {
      const startCandle = indicatorCandles[zone.startIndex];
      if (!startCandle) return [];
      const endCandle = indicatorCandles[Math.min(zone.endIndex, indicatorCandles.length - 1)];
      if (!endCandle) return [];
      return [{
        id: zone.id,
        startTime: (
          eventChartTimeBySourceTimeRef.current.get(startCandle.timestamp)
          ?? Math.floor(startCandle.timestamp / 1_000)
        ) as Time,
        endTime: (
          eventChartTimeBySourceTimeRef.current.get(endCandle.timestamp)
          ?? Math.floor(endCandle.timestamp / 1_000)
        ) as Time,
        top: zone.top,
        bottom: zone.bottom,
        side: zone.side,
      }];
    });
  }, [
    chartReadyRevision,
    deepEffort,
    deepEffortIndicator?.settings?.showZones,
    indicatorCandles,
  ]);

  useEffect(() => {
    const effortSettings = deepEffortIndicator?.settings ?? {};
    const useThemeColors = effortSettings.useThemeColors !== false;
    bigBlocksPrimitiveRef.current?.update(
      deepEffortIndicator ? bigBlockRenderZones : [],
      {
        askColor: useThemeColors
          ? settings.upColor
          : String(effortSettings.askColor ?? settings.upColor),
        bidColor: useThemeColors
          ? settings.downColor
          : String(effortSettings.bidColor ?? settings.downColor),
        opacity: clamp(Number(effortSettings.zoneOpacity ?? 20) / 100, 0.01, 1),
        lineWidth: clamp(Number(effortSettings.zoneLineWidth ?? 1), 0, 4),
      },
    );
  }, [
    bigBlockRenderZones,
    chartReadyRevision,
    deepEffortIndicator,
    settings.downColor,
    settings.upColor,
    themeVersion,
  ]);
  const imbalanceTracker = useMemo(() => {
    const instance = indicators.find((candidate) =>
      candidate.enabled && candidate.indicatorId === "imbalance-tracker");
    if (!instance) return null;
    return {
      instance,
      zones: calculateImbalanceZones(
        indicatorCandles,
        indicatorMarketTrades,
        instance,
        priceFormat.minMove,
      ),
    };
  }, [
    indicatorCandles,
    indicatorSignature,
    indicators,
    priceFormat.minMove,
    indicatorMarketTrades,
  ]);
  const imbalanceRejector = useMemo(() => {
    const instance = indicators.find((candidate) =>
      candidate.enabled && candidate.indicatorId === "imbalance-rejector");
    if (!instance) return null;
    return {
      instance,
      signals: calculateImbalanceRejectorSignals(
        indicatorCandles,
        indicatorMarketTrades,
        instance,
        priceFormat.minMove,
      ),
    };
  }, [
    indicatorCandles,
    indicatorSignature,
    indicators,
    priceFormat.minMove,
    indicatorMarketTrades,
  ]);
  const positionedImbalanceZones = useMemo(() =>
    (imbalanceTracker?.zones ?? []).flatMap((zone) => {
      const startCandle = indicatorCandles[zone.startIndex];
      const endCandle = indicatorCandles[Math.min(zone.endIndex, indicatorCandles.length - 1)];
      if (!startCandle || !endCandle) return [];
      const startX = indicatorTimeToX(Math.floor(startCandle.timestamp / 1_000));
      const endX = indicatorTimeToX(Math.floor(endCandle.timestamp / 1_000));
      const topY = candleSeriesRef.current?.priceToCoordinate(zone.top) ?? null;
      const bottomY = candleSeriesRef.current?.priceToCoordinate(zone.bottom) ?? null;
      if (startX === null || endX === null || topY === null || bottomY === null) return [];
      return [{
        ...zone,
        x: startX,
        width: Math.max(2, endX - startX),
        y: Math.min(topY, bottomY),
        height: Math.max(2, Math.abs(bottomY - topY)),
      }];
    }), [
    chartReadyRevision,
    imbalanceTracker,
    indicatorCandles,
    indicatorTimeToX,
    viewportVersion,
  ]);
  const positionedImbalanceSignals = useMemo(() =>
    (imbalanceRejector?.signals ?? []).flatMap((signal) => {
      const x = indicatorTimeToX(Math.floor(signal.timestamp / 1_000));
      const y = candleSeriesRef.current?.priceToCoordinate(signal.price) ?? null;
      return x === null || y === null ? [] : [{ ...signal, x, y }];
    }), [
    chartReadyRevision,
    imbalanceRejector,
    indicatorTimeToX,
    viewportVersion,
  ]);
  const sessionsIndicator = useMemo(
    () => indicators.find((candidate) =>
      candidate.enabled && candidate.indicatorId === "sessions") ?? null,
    [indicatorSignature, indicators],
  );
  const sessionHighLowIndicator = useMemo(
    () => indicators.find((candidate) =>
      candidate.enabled && candidate.indicatorId === "session-highs-lows") ?? null,
    [indicatorSignature, indicators],
  );
  const sessionHighLowSettings = useMemo(() => {
    const own = sessionHighLowIndicator?.settings ?? {};
    if (!sessionHighLowIndicator || own.followSessionsStudy === false || !sessionsIndicator) return own;
    const linked = sessionsIndicator.settings ?? {};
    const keys = [
      "showTokyo", "showLondon", "showNewYork", "showSydney",
      "tokyoLabel", "tokyoStart", "tokyoEnd", "tokyoColor",
      "londonLabel", "londonStart", "londonEnd", "londonColor",
      "newYorkLabel", "newYorkStart", "newYorkEnd", "newYorkColor",
      "sydneyLabel", "sydneyStart", "sydneyEnd", "sydneyColor",
      "hideWeekends",
    ] as const;
    return keys.reduce<Record<string, number | string | boolean>>((result, key) => {
      if (linked[key] !== undefined) result[key] = linked[key]!;
      return result;
    }, { ...own });
  }, [sessionHighLowIndicator, sessionsIndicator]);
  const marketSessionWindows = useMemo(
    () => sessionsIndicator
      ? buildMarketSessionWindows(
          indicatorCandles,
          sessionsIndicator.settings ?? {},
          candleIntervalMs ?? 60_000,
        )
      : [],
    [candleIntervalMs, indicatorCandles, sessionsIndicator],
  );
  const previousSessionLevels = useMemo(
    () => sessionHighLowIndicator
      ? buildPreviousSessionHighLowLevels(
          indicatorCandles,
          sessionHighLowSettings,
          candleIntervalMs ?? 60_000,
        )
      : [],
    [candleIntervalMs, indicatorCandles, sessionHighLowIndicator, sessionHighLowSettings],
  );
  const sessionHighLowRenderData = useMemo<SessionHighLowRenderLevel[]>(() => {
    const useSessionColors = sessionHighLowSettings.useSessionColors !== false;
    const opacity = clamp(Number(sessionHighLowSettings.lineOpacity ?? 82) / 100, 0.05, 1);
    const labelSize = String(sessionHighLowSettings.labelSize ?? "small");
    const fontSize = labelSize === "tiny" ? 8 : labelSize === "normal" ? 11 : 9;
    const requestedStyle = String(sessionHighLowSettings.lineStyle ?? "dashed");
    const lineStyle = requestedStyle === "dotted" || requestedStyle === "solid"
      ? requestedStyle
      : "dashed";

    return previousSessionLevels.map((level) => ({
      id: level.id,
      startTime: (
        eventChartTimeBySourceTimeRef.current.get(level.startTimestamp)
        ?? Math.floor(level.startTimestamp / 1_000)
      ) as Time,
      price: level.price,
      label: sessionHighLowSettings.showLabels === false ? "" : level.label,
      color: useSessionColors
        ? level.session.color
        : level.side === "high"
          ? String(sessionHighLowSettings.highColor ?? settings.upColor)
          : String(sessionHighLowSettings.lowColor ?? settings.downColor),
      opacity,
      lineWidth: clamp(Number(sessionHighLowSettings.lineWidth ?? 1), 1, 4),
      lineStyle,
      fontSize,
      precision: priceFormat.precision,
    }));
  }, [
    chartReadyRevision,
    previousSessionLevels,
    priceFormat.precision,
    sessionHighLowSettings,
    settings.downColor,
    settings.upColor,
  ]);
  sessionHighLowRenderDataRef.current = sessionHighLowRenderData;
  const sessionWindowRenderData = useMemo<SessionWindowRenderData[]>(() => {
    const sessionSettings = sessionsIndicator?.settings ?? {};
    const sessionIntervalMs = candleIntervalMs ?? 60_000;
    const fillOpacity = clamp(Number(sessionSettings.fillOpacity ?? 10) / 100, 0, 1);
    const lineOpacity = clamp(Number(sessionSettings.lineOpacity ?? 65) / 100, 0, 1);
    const labelSize = String(sessionSettings.labelSize ?? "small");
    const fontSize = labelSize === "tiny" ? 8 : labelSize === "normal" ? 11 : 9;
    const requestedLineStyle = String(sessionSettings.lineStyle ?? "dashed");
    const lineStyle = requestedLineStyle === "dotted" || requestedLineStyle === "solid"
      ? requestedLineStyle
      : "dashed";
    const chartTimeForTimestamp = (timestamp: number) => (
      eventChartTimeBySourceTimeRef.current.get(timestamp)
      ?? Math.floor(timestamp / 1_000)
    ) as Time;

    return marketSessionWindows.map((session) => {
      const change = session.close - session.open;
      const suffix = sessionSettings.showPercentChange === true && session.open
        ? ` ${(change / session.open * 100).toFixed(2)}%`
        : sessionSettings.showPointChange === true
          ? ` ${change >= 0 ? "+" : ""}${change.toFixed(priceFormat.precision)}`
          : "";
      return {
        id: `${session.key}-${session.startTimestamp}`,
        startTime: chartTimeForTimestamp(session.startTimestamp),
        // endTimestamp is exclusive and can point at a future candle while a
        // session is developing. Anchor to the latest candle that really exists.
        endTime: chartTimeForTimestamp(Math.max(
          session.startTimestamp,
          session.endTimestamp - sessionIntervalMs,
        )),
        high: session.high,
        low: session.low,
        open: session.open,
        close: session.close,
        label: `${session.label}${suffix}`,
        color: session.color,
        fillOpacity,
        lineOpacity,
        borderWidth: clamp(Number(sessionSettings.borderWidth ?? 1), 0, 4),
        lineStyle,
        fontSize,
        showBackground: sessionSettings.showBackground !== false,
        showBorders: sessionSettings.showBorders !== false,
        showOpenClose: sessionSettings.showOpenClose !== false,
        showLabel: sessionSettings.showLabels !== false,
      };
    });
  }, [
    candleIntervalMs,
    chartReadyRevision,
    marketSessionWindows,
    priceFormat.precision,
    sessionsIndicator,
  ]);
  sessionWindowRenderDataRef.current = sessionWindowRenderData;
  const toolbarMetrics = useMemo(() => {
    const availableWidth = overlaySize.width > 0 ? Math.max(180, overlaySize.width - 16) : 920;
    const availableHeight = overlaySize.height > 0 ? Math.max(150, overlaySize.height - 16) : 700;
    const widthScale = availableWidth / 884;
    const heightScale = availableHeight / 684;
    const scale = clamp(Math.min(widthScale, heightScale), 0.3, 1);
    const smooth = (value: number, minimum: number) =>
      Math.max(minimum, Number((value * scale).toFixed(2)));
    // Keep the drawing rail compact enough to live on every chart pane without
    // covering useful price action. These dimensions are 25% smaller than the
    // original 38px / 17px toolbar while preserving the responsive scale-down.
    const buttonSize = smooth(28.5, 9.9);
    const iconSize = smooth(12.75, 5.25);
    const gap = smooth(2.25, 1.1);
    return {
      scale,
      buttonSize,
      iconSize,
      gap,
      radius: smooth(5.25, 2.25),
      dockOffset: smooth(9, 2.25),
      dockStart: Math.max(buttonSize + 2, smooth(48, 15)),
      menuWidth: Math.max(180, Number((420 * scale).toFixed(2))),
      menuMaxHeight: `${Number((46 + 28 * scale).toFixed(2))}vh`,
      objectsPanelWidth: Math.max(170, Number((288 * scale).toFixed(2))),
      dragDotSize: smooth(4.5, 1.9),
    };
  }, [overlaySize.height, overlaySize.width]);
  const toolbarButtonStyle = {
    width: toolbarMetrics.buttonSize,
    height: toolbarMetrics.buttonSize,
    borderRadius: toolbarMetrics.radius,
    transition: "width 70ms linear, height 70ms linear, border-radius 70ms linear",
  } as CSSProperties;
  const toolbarIconClassName = "h-[var(--chart-toolbar-icon)] w-[var(--chart-toolbar-icon)]";
  const toolbarToolIconClassName = "h-[var(--chart-toolbar-tool-icon)] w-[var(--chart-toolbar-tool-icon)]";
  const toolbarDockStyle = toolbarDragPosition
    ? { left: toolbarDragPosition.x, top: toolbarDragPosition.y }
    : (() => {
        switch (toolbarDock) {
          case "right":
            return { right: toolbarMetrics.dockOffset, top: toolbarMetrics.dockStart };
          case "top":
            return { top: toolbarMetrics.dockOffset, left: "50%", transform: "translateX(-50%)" };
          case "bottom":
            return { bottom: toolbarMetrics.dockOffset, left: "50%", transform: "translateX(-50%)" };
          default:
            return { left: toolbarMetrics.dockOffset, top: toolbarMetrics.dockStart };
        }
      })();
  const toolbarMenuStyle = {
    width: toolbarMetrics.menuWidth,
    maxHeight: toolbarMetrics.menuMaxHeight,
    transition: "width 70ms linear, max-height 70ms linear",
  } as CSSProperties;
  const objectsPanelStyle = {
    ...getObjectsPanelStyle(toolbarDock),
    width: toolbarMetrics.objectsPanelWidth,
  } as CSSProperties;

  const activeToolbarTool = useMemo(() => {
    for (const group of ACTIVE_DRAWING_TOOLBAR_GROUPS) {
      const tool = group.tools.find((item) => item.id === selectedTool);
      if (tool) {
        return { groupId: group.id, label: tool.label };
      }
    }
    return null;
  }, [selectedTool]);
  const positionSettingsDrawing = drawings.find((drawing) =>
    drawing.id === positionSettingsDrawingId
    && (drawing.tool === "longPosition" || drawing.tool === "shortPosition")
  ) ?? null;
  const positionStyleDefaults: Required<PositionVisualSettings> = {
    targetColor: settings.upColor,
    stopColor: settings.downColor,
    entryLineColor: "#A1A1AA",
    textColor: "#050505",
    fillOpacity: 0.14,
    borderOpacity: 0.72,
    lineWidth: 1.25,
    lineStyle: "solid",
    showLabels: true,
  };
  const activePositionStyle: Required<PositionVisualSettings> = {
    targetColor: positionSettingsDrawing?.positionStyle?.targetColor ?? positionStyleDefaults.targetColor,
    stopColor: positionSettingsDrawing?.positionStyle?.stopColor ?? positionStyleDefaults.stopColor,
    entryLineColor: positionSettingsDrawing?.positionStyle?.entryLineColor ?? positionStyleDefaults.entryLineColor,
    textColor: positionSettingsDrawing?.positionStyle?.textColor ?? positionStyleDefaults.textColor,
    fillOpacity: positionSettingsDrawing?.positionStyle?.fillOpacity ?? positionStyleDefaults.fillOpacity,
    borderOpacity: positionSettingsDrawing?.positionStyle?.borderOpacity ?? positionStyleDefaults.borderOpacity,
    lineWidth: positionSettingsDrawing?.positionStyle?.lineWidth ?? positionStyleDefaults.lineWidth,
    lineStyle: positionSettingsDrawing?.positionStyle?.lineStyle ?? positionStyleDefaults.lineStyle,
    showLabels: positionSettingsDrawing?.positionStyle?.showLabels ?? positionStyleDefaults.showLabels,
  };

  function updatePositionVisualSettings(patch: Partial<PositionVisualSettings>) {
    if (!positionSettingsDrawingId) return;
    setDrawings((current) => current.map((drawing) => drawing.id === positionSettingsDrawingId
      ? { ...drawing, positionStyle: { ...drawing.positionStyle, ...patch } }
      : drawing));
  }

  function replaceProfessionalManagerDrawings(records: ProfessionalDrawingRecord[]) {
    const orderedRecords = [...records].sort((a, b) => (a.options.zIndex ?? 0) - (b.options.zIndex ?? 0));
    professionalDrawingsRef.current = orderedRecords;
    const manager = professionalDrawingManagerRef.current;
    if (!manager) return;
    professionalSyncSuppressedRef.current = true;
    manager.clearAll();
    orderedRecords.forEach((record) => {
      const drawing = drawingFromSerialized(record);
      if (drawing) configureProfessionalDrawingMarketData(drawing, drawingMarketDataSource);
      if (drawing) manager.addDrawing(drawing);
    });
    professionalSyncSuppressedRef.current = false;
  }

  function restoreProfessionalDrawingSnapshot(records: ProfessionalDrawingRecord[]) {
    replaceProfessionalManagerDrawings(records);
    professionalDrawingsRef.current = records;
    setProfessionalDrawings(records);
    setSelectedProfessionalDrawingId(null);
    setDrawingHistoryRevision((revision) => revision + 1);
  }

  function undoProfessionalDrawing() {
    const snapshot = professionalUndoStackRef.current.pop();
    if (!snapshot) return;
    professionalRedoStackRef.current.push(professionalDrawingsRef.current);
    restoreProfessionalDrawingSnapshot(snapshot);
  }

  function redoProfessionalDrawing() {
    const snapshot = professionalRedoStackRef.current.pop();
    if (!snapshot) return;
    professionalUndoStackRef.current.push(professionalDrawingsRef.current);
    restoreProfessionalDrawingSnapshot(snapshot);
  }

  function copySelectedProfessionalDrawing() {
    const selected = professionalDrawingManagerRef.current?.getSelectedDrawing();
    if (selected) professionalClipboardRef.current = selected.toJSON();
  }

  function pasteProfessionalDrawing() {
    const source = professionalClipboardRef.current;
    const manager = professionalDrawingManagerRef.current;
    if (!source || !manager) return;
    const intervalSeconds = Math.max(1, Math.round((candleIntervalMs ?? 60_000) / 1_000));
    const record: ProfessionalDrawingRecord = {
      ...source,
      id: createId("drawing"),
      anchors: source.anchors.map((anchor) => ({
        ...anchor,
        time: typeof anchor.time === "number" ? (anchor.time + intervalSeconds) as Time : anchor.time,
        price: anchor.price + priceFormat.minMove * 4,
      })),
      style: { ...source.style },
      options: { ...source.options },
    };
    const drawing = drawingFromSerialized(record);
    if (!drawing) return;
    configureProfessionalDrawingMarketData(drawing, drawingMarketDataSource);
    manager.addDrawing(drawing);
    manager.selectDrawing(drawing.id);
    setSelectedProfessionalDrawingId(drawing.id);
  }

  function duplicateSelectedProfessionalDrawing() {
    copySelectedProfessionalDrawing();
    pasteProfessionalDrawing();
  }

  function syncProfessionalManagerNow() {
    const manager = professionalDrawingManagerRef.current;
    if (!manager) return;
    const records = manager.exportDrawings().filter((record) => record.id !== "__kwantdesk_drawing_preview__");
    professionalDrawingsRef.current = records;
    setProfessionalDrawings(records);
    setDrawingHistoryRevision((revision) => revision + 1);
  }

  function updateSelectedProfessionalDrawing(
    stylePatch: Partial<ProfessionalDrawingRecord["style"]> = {},
    optionsPatch: Partial<ProfessionalDrawingRecord["options"]> = {},
  ) {
    const selected = professionalDrawingManagerRef.current?.getSelectedDrawing();
    if (!selected) return;
    if (!professionalUpdateHistoryOpenRef.current) {
      professionalUndoStackRef.current.push(professionalDrawingsRef.current);
      if (professionalUndoStackRef.current.length > 100) professionalUndoStackRef.current.shift();
      professionalRedoStackRef.current = [];
      professionalUpdateHistoryOpenRef.current = true;
    }
    if (professionalUpdateHistoryTimerRef.current !== null) window.clearTimeout(professionalUpdateHistoryTimerRef.current);
    professionalUpdateHistoryTimerRef.current = window.setTimeout(() => {
      professionalUpdateHistoryOpenRef.current = false;
      professionalUpdateHistoryTimerRef.current = null;
    }, 250);
    selected.updateStyle(stylePatch);
    selected.updateOptions(optionsPatch);
    syncProfessionalManagerNow();
    if (optionsPatch.zIndex !== undefined) {
      const selectedId = selected.id;
      replaceProfessionalManagerDrawings(professionalDrawingsRef.current);
      professionalDrawingManagerRef.current?.selectDrawing(selectedId);
    }
  }

  function saveSelectedDrawingTemplate() {
    const selected = professionalDrawingManagerRef.current?.getSelectedDrawing();
    if (!selected) return;
    const label = ALL_DRAWING_TOOLS.find((tool) => professionalDrawingType(tool.id) === selected.type)?.label ?? selected.type;
    setDrawingTemplates((current) => [
      ...current,
      {
        id: createId("drawing-template"),
        name: `${label} ${current.filter((template) => template.toolType === selected.type).length + 1}`,
        toolType: selected.type,
        style: { ...selected.style },
        options: { ...selected.options },
        createdAt: Date.now(),
      },
    ]);
  }

  function applyDrawingTemplate(template: DrawingTemplate) {
    const selected = professionalDrawingManagerRef.current?.getSelectedDrawing();
    if (!selected || selected.type !== template.toolType) return;
    updateSelectedProfessionalDrawing(template.style, template.options);
  }

  function beginRenameDrawingTemplate(template: DrawingTemplate) {
    setRenamingDrawingTemplateId(template.id);
    setDrawingTemplateNameDraft(template.name);
  }

  function commitDrawingTemplateRename(template: DrawingTemplate) {
    const name = drawingTemplateNameDraft.trim();
    setRenamingDrawingTemplateId(null);
    setDrawingTemplateNameDraft("");
    if (!name || name === template.name) return;
    setDrawingTemplates((current) => current.map((candidate) =>
      candidate.id === template.id ? { ...candidate, name } : candidate));
  }

  function makeDefaultDrawingTemplate(template: DrawingTemplate) {
    setDrawingTemplates((current) => current.map((candidate) => ({
      ...candidate,
      isDefault: candidate.toolType === template.toolType ? candidate.id === template.id : candidate.isDefault,
    })));
  }

  function clearAllChartDrawings() {
    // Invalidate any in-flight hydration before clearing so an older server response
    // cannot restore drawings after the user has removed them.
    professionalDrawingsLoadGenerationRef.current += 1;
    professionalDrawingsHydrationRef.current = { instrument, ready: true };

    if (professionalUpdateHistoryTimerRef.current !== null) {
      window.clearTimeout(professionalUpdateHistoryTimerRef.current);
      professionalUpdateHistoryTimerRef.current = null;
    }
    professionalUpdateHistoryOpenRef.current = false;
    professionalUndoStackRef.current = [];
    professionalRedoStackRef.current = [];
    professionalClipboardRef.current = null;
    professionalPendingAnchorsRef.current = [];
    professionalDrawingPreviewRef.current = null;
    professionalBrushDrawingRef.current = null;
    professionalSuppressNextClickRef.current = false;

    professionalSyncSuppressedRef.current = true;
    professionalDrawingManagerRef.current?.clearAll();
    professionalSyncSuppressedRef.current = false;
    professionalDrawingsRef.current = [];

    setProfessionalDrawings([]);
    setDrawings([]);
    setDraftDrawing(null);
    setDrawingInteraction(null);
    setTextEditor(null);
    setSelectedDrawingId(null);
    setSelectedProfessionalDrawingId(null);
    setPositionSettingsDrawingId(null);
    setShowDrawingSettings(false);
    setDrawingHistoryRevision((revision) => revision + 1);
    setPrecisionClearRevision((revision) => revision + 1);

    try {
      window.localStorage.setItem(drawingsStorageKey(instrument, chartInstanceId), "[]");
    } catch {
      // The account-backed save below remains authoritative when local storage is unavailable.
    }
    void fetch("/api/chart-drawings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrument: drawingPersistenceInstrument, drawings: [] }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const loadGeneration = ++professionalDrawingsLoadGenerationRef.current;
    professionalDrawingsHydrationRef.current = { instrument, ready: false };
    let cached: ProfessionalDrawingRecord[] = [];
    const migrationClaimKey = `kwantdesk:chart-drawings:migrated:v1:${instrument}`;
    let ownsLegacyMigration = false;
    try {
      const raw = window.localStorage.getItem(drawingsStorageKey(instrument, chartInstanceId));
      cached = normalizeProfessionalDrawings(raw ? JSON.parse(raw) : []);
      if (!cached.length && !window.localStorage.getItem(migrationClaimKey)) {
        ownsLegacyMigration = true;
        window.localStorage.setItem(migrationClaimKey, chartInstanceId);
        const legacyRaw = window.localStorage.getItem(`kwantify-chart-drawings:${instrument}`);
        cached = normalizeProfessionalDrawings(legacyRaw ? JSON.parse(legacyRaw) : []);
      }
    } catch {
      cached = [];
    }
    setDrawings([]);
    setProfessionalDrawings(cached);
    replaceProfessionalManagerDrawings(cached);

    const loadPersistedDrawings = async () => {
      const response = await fetch(`/api/chart-drawings?instrument=${encodeURIComponent(drawingPersistenceInstrument)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = response.ok ? await response.json() as { configured?: boolean; drawings?: unknown } : null;
      let records = payload?.configured && Array.isArray(payload.drawings)
        ? normalizeProfessionalDrawings(payload.drawings)
        : [];
      if (!records.length && ownsLegacyMigration) {
        const legacyResponse = await fetch(`/api/chart-drawings?instrument=${encodeURIComponent(instrument)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const legacyPayload = legacyResponse.ok
          ? await legacyResponse.json() as { configured?: boolean; drawings?: unknown }
          : null;
        if (legacyPayload?.configured && Array.isArray(legacyPayload.drawings)) {
          records = normalizeProfessionalDrawings(legacyPayload.drawings);
        }
      }
      return records;
    };

    void loadPersistedDrawings()
      .then((records) => {
        if (cancelled || professionalDrawingsLoadGenerationRef.current !== loadGeneration || !records.length) return;
        setProfessionalDrawings(records);
        replaceProfessionalManagerDrawings(records);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled && professionalDrawingsLoadGenerationRef.current === loadGeneration) {
          professionalDrawingsHydrationRef.current = { instrument, ready: true };
        }
      });
    return () => { cancelled = true; };
  // Manager replacement reads refs intentionally; the instrument owns hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartInstanceId, drawingPersistenceInstrument, instrument]);

  useEffect(() => {
    professionalDrawingsRef.current = professionalDrawings;
    if (typeof window === "undefined") return;
    if (!professionalDrawingsHydrationRef.current.ready || professionalDrawingsHydrationRef.current.instrument !== instrument) return;
    try {
      window.localStorage.setItem(drawingsStorageKey(instrument, chartInstanceId), JSON.stringify(professionalDrawings));
    } catch {
      // Keep drawing responsive when browser storage is unavailable.
    }
    const timeout = window.setTimeout(() => {
      void fetch("/api/chart-drawings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: drawingPersistenceInstrument, drawings: professionalDrawings }),
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [chartInstanceId, drawingPersistenceInstrument, instrument, professionalDrawings]);

  useEffect(() => {
    selectedToolRef.current = selectedTool;
    const manager = professionalDrawingManagerRef.current;
    const activeType = selectedTool === "selection" || precisionToolForDrawingTool(selectedTool)
      ? null
      : professionalDrawingType(selectedTool);
    manager?.setActiveTool(activeType);
    if (!activeType) {
      professionalPendingAnchorsRef.current = [];
      if (professionalDrawingPreviewRef.current && manager) {
        manager.removeDrawing(professionalDrawingPreviewRef.current.id);
      }
      professionalDrawingPreviewRef.current = null;
    }
  }, [selectedTool]);

  useEffect(() => {
    keepDrawingModeRef.current = keepDrawingMode;
  }, [keepDrawingMode]);

  useEffect(() => {
    magnetModeRef.current = magnetMode;
  }, [magnetMode]);

  useEffect(() => {
    const manager = professionalDrawingManagerRef.current;
    if (!manager) return;
    manager.getAllDrawings().forEach((drawing) => {
      const allowed = drawing.options.timeframes;
      const baseVisible = drawing.options.baseVisible ?? drawing.options.visible !== false;
      drawing.updateOptions({
        baseVisible,
        visible: baseVisible && (!allowed?.length || allowed.includes(timeframe ?? "")),
      });
    });
  }, [professionalDrawings, timeframe]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(toolbarDockStorageKey()) as ToolbarDock | null;
      if (raw === "left" || raw === "right" || raw === "top" || raw === "bottom") {
        setToolbarDock(raw);
        return;
      }
      setToolbarDock("left");
    } catch {
      setToolbarDock("left");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(toolbarDockStorageKey(), toolbarDock);
    } catch {
      // ignore storage limits
    }
  }, [toolbarDock]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setToolbarCollapsed(window.localStorage.getItem(toolbarCollapsedStorageKey()) === "true");
    } catch {
      setToolbarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(toolbarCollapsedStorageKey(), toolbarCollapsed ? "true" : "false");
    } catch {
      // ignore storage limits
    }
  }, [toolbarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFavorites = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== DRAWING_TOOL_FAVORITES_STORAGE_KEY) return;
      try {
        const raw = window.localStorage.getItem(DRAWING_TOOL_FAVORITES_STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : [];
        const validIds = new Set(ALL_DRAWING_TOOLS.map((tool) => tool.id));
        setFavoriteToolIds(
          Array.isArray(stored)
            ? stored.filter((id): id is DrawingToolId =>
                typeof id === "string" && validIds.has(id as DrawingToolId))
            : [],
        );
      } catch {
        setFavoriteToolIds([]);
      }
    };

    syncFavorites();
    window.addEventListener("storage", syncFavorites);
    window.addEventListener(DRAWING_TOOL_FAVORITES_EVENT, syncFavorites);
    return () => {
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener(DRAWING_TOOL_FAVORITES_EVENT, syncFavorites);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(DRAWING_TEMPLATES_STORAGE_KEY) ?? "[]") as unknown;
      if (!Array.isArray(parsed)) return;
      setDrawingTemplates(parsed.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const candidate = value as Partial<DrawingTemplate>;
        if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || typeof candidate.toolType !== "string") return [];
        if (!candidate.style || typeof candidate.style.lineColor !== "string" || typeof candidate.style.lineWidth !== "number") return [];
        return [{
          id: candidate.id,
          name: candidate.name,
          toolType: candidate.toolType,
          style: candidate.style,
          options: candidate.options ?? {},
          createdAt: Number(candidate.createdAt) || Date.now(),
          isDefault: candidate.isDefault === true,
        } satisfies DrawingTemplate];
      }));
    } catch {
      setDrawingTemplates([]);
    }
  }, []);

  useEffect(() => {
    drawingTemplatesRef.current = drawingTemplates;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DRAWING_TEMPLATES_STORAGE_KEY, JSON.stringify(drawingTemplates));
    } catch {
      // Templates remain available in memory when storage is unavailable.
    }
  }, [drawingTemplates]);

  function toggleFavoriteTool(toolId: DrawingToolId) {
    const next = favoriteToolIds.includes(toolId)
      ? favoriteToolIds.filter((id) => id !== toolId)
      : [...favoriteToolIds, toolId];
    setFavoriteToolIds(next);
    try {
      window.localStorage.setItem(DRAWING_TOOL_FAVORITES_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(DRAWING_TOOL_FAVORITES_EVENT));
    } catch {
      // Keep the chart responsive if browser storage is unavailable.
    }
  }

  const applyMarkers = (tradeRows: (Trade & { markerVisible?: boolean })[]) => {
    if (!candleSeriesRef.current || !tradeRows || tradeRows.length === 0) {
      candleSeriesRef.current?.setMarkers([]);
      return;
    }

    const markers = tradeRows
      .filter((trade) => trade.markerVisible !== false)
      .flatMap((trade) => {
        const entryTime = Math.floor(trade.entryTime / 1000);
        const exitTime = Math.floor(trade.exitTime / 1000);
        const isLong = trade.direction === "LONG";
        const color = isLong ? "#22C55E" : "#EF4444";
        const isWin = trade.result === "WIN";

        return [
          {
            time: entryTime as Time,
            position: (isLong ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
            color,
            shape: (isLong ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
            text: isLong ? "BUY" : "SELL",
          },
          {
            time: exitTime as Time,
            position: (isLong ? "aboveBar" : "belowBar") as "aboveBar" | "belowBar",
            color,
            shape: (isLong ? "arrowDown" : "arrowUp") as "arrowDown" | "arrowUp",
            text: isWin ? "TP" : "SL",
          },
        ];
      });

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    candleSeriesRef.current.setMarkers(markers);
  };

  const applyLevels = (priceLevels: ChartLevel[]) => {
    if (!candleSeriesRef.current) return;

    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {
        // ignore stale line handles
      }
    });
    priceLinesRef.current = [];

    if (!priceLevels.length) return;

    priceLevels.forEach((level) => {
      const line = candleSeriesRef.current?.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: level.lineWidth ?? 1,
        lineStyle:
          level.lineStyle === "dashed"
            ? LineStyle.Dashed
            : level.lineStyle === "dotted"
              ? LineStyle.Dotted
              : LineStyle.Solid,
        // The native chart library moves price-line labels to avoid its live
        // price marker. Fixed market levels must never change screen position,
        // so their labels are rendered by FixedPriceLevelLabelsPrimitive.
        axisLabelVisible: false,
        title: "",
      });

      if (line) {
        priceLinesRef.current.push(line);
      }
    });
  };

  function timeToX(time: number) {
    return chartRef.current?.timeScale().timeToCoordinate(time as Time) ?? null;
  }

  function xToTime(x: number) {
    const timeScale = chartRef.current?.timeScale();
    if (!timeScale) return null;

    const directTime = normalizeTimeValue(timeScale.coordinateToTime(x));
    if (directTime != null) return directTime;

    const lastCandle = candles[candles.length - 1];
    const intervalSeconds = candleIntervalMs ? candleIntervalMs / 1000 : null;
    if (!lastCandle || !intervalSeconds || intervalSeconds <= 0) return null;

    const lastTime = Math.floor(lastCandle.timestamp / 1000);
    const lastCoordinate = timeScale.timeToCoordinate(lastTime as Time);
    const pointerLogical = timeScale.coordinateToLogical(x);
    if (lastCoordinate == null || pointerLogical == null) return null;

    const lastLogical = timeScale.coordinateToLogical(lastCoordinate);
    if (lastLogical == null) return null;

    return Math.round(lastTime + (Number(pointerLogical) - Number(lastLogical)) * intervalSeconds);
  }

  function priceToY(price: number) {
    return candleSeriesRef.current?.priceToCoordinate(price) ?? null;
  }

  function snapPositionPrice(price: number) {
    const snapped = Math.round(price / priceFormat.minMove) * priceFormat.minMove;
    return Number(snapped.toFixed(priceFormat.precision));
  }

  function getPointerPoint(clientX: number, clientY: number, applyMagnet = true) {
    if (!chartContainerRef.current) return null;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const rawTime = xToTime(localX);
    const rawPrice = candleSeriesRef.current?.coordinateToPrice(localY) ?? null;

    if (rawTime == null || rawPrice == null) return null;

    let point: DrawingPoint = { time: rawTime, price: rawPrice };

    if (applyMagnet && magnetMode !== "off") {
      const nearest = candles.reduce<Candle | null>((best, candle) => {
        if (!best) return candle;
        return Math.abs(candle.timestamp / 1000 - point.time) < Math.abs(best.timestamp / 1000 - point.time) ? candle : best;
      }, null);

      if (nearest) {
        const snappedPrices = [nearest.open, nearest.high, nearest.low, nearest.close];
        const bestPrice = snappedPrices.reduce((best, value) =>
          Math.abs(value - point.price) < Math.abs(best - point.price) ? value : best
        );
        point = {
          time: Math.floor(nearest.timestamp / 1000),
          price:
            magnetMode === "strong"
              ? bestPrice
              : Math.abs(bestPrice - point.price) < Math.max(0.6, point.price * 0.00003)
                ? bestPrice
                : point.price,
        };
      }
    }

    return point;
  }

  function finishDraft(next: ChartDrawing | null) {
    if (!next) return;
    setDrawings((current) => [...current, next]);
    setSelectedDrawingId(next.id);
    setDraftDrawing(null);
    if (selectedTool !== "cursor" && selectedTool !== "text") {
      if (!keepDrawingModeRef.current) setSelectedTool("cursor");
    }
  }

  function getLongShortGeometry(drawing: ChartDrawing) {
    const [a, b, targetPoint] = drawing.points;
    if (!a || !b) return null;
    const ax = timeToX(a.time);
    const ay = priceToY(a.price);
    const bx = timeToX(b.time);
    const by = priceToY(b.price);
    if (ax == null || ay == null || bx == null || by == null) return null;

    const isLong = drawing.tool === "longPosition";
    const entryPrice = a.price;
    const stopPrice = b.price;
    const risk = Math.max(Math.abs(entryPrice - stopPrice), priceFormat.minMove);
    const targetPrice = targetPoint?.price ?? (isLong ? entryPrice + risk * 2 : entryPrice - risk * 2);
    const targetY = priceToY(targetPrice);
    const entryY = priceToY(entryPrice);
    const stopY = priceToY(stopPrice);
    if (targetY == null || entryY == null || stopY == null) return null;

    const x = Math.min(ax, bx);
    const boxWidth = Math.max(24, Math.abs(bx - ax));
    const profitTop = isLong ? targetY : entryY;
    const profitBottom = isLong ? entryY : targetY;
    const riskTop = isLong ? entryY : stopY;
    const riskBottom = isLong ? stopY : entryY;

    return {
      ax,
      ay,
      bx,
      by,
      x,
      boxWidth,
      entryY,
      stopY,
      targetY,
      targetPrice,
      stopPrice,
      profitTop,
      profitBottom,
      riskTop,
      riskBottom,
      targetLeftHandle: { x, y: targetY },
      targetRightHandle: { x: x + boxWidth, y: targetY },
      stopLeftHandle: { x, y: stopY },
      stopRightHandle: { x: x + boxWidth, y: stopY },
      bounds: {
        left: x,
        right: x + boxWidth,
        top: Math.min(profitTop, profitBottom, riskTop, riskBottom),
        bottom: Math.max(profitTop, profitBottom, riskTop, riskBottom),
      },
    };
  }

  function getLongShortInteraction(drawing: ChartDrawing, point: DrawingPoint) {
    const geometry = getLongShortGeometry(drawing);
    if (!geometry) return null;
    const px = timeToX(point.time);
    const py = priceToY(point.price);
    if (px == null || py == null) return null;

    if (Math.hypot(px - geometry.targetLeftHandle.x, py - geometry.targetLeftHandle.y) <= 14) return { mode: "positionTargetLeft" as const };
    if (Math.hypot(px - geometry.targetRightHandle.x, py - geometry.targetRightHandle.y) <= 14) return { mode: "positionTargetRight" as const };
    if (Math.hypot(px - geometry.stopLeftHandle.x, py - geometry.stopLeftHandle.y) <= 14) return { mode: "positionStopLeft" as const };
    if (Math.hypot(px - geometry.stopRightHandle.x, py - geometry.stopRightHandle.y) <= 14) return { mode: "positionStopRight" as const };

    if (
      px >= geometry.bounds.left &&
      px <= geometry.bounds.right &&
      py >= geometry.bounds.top &&
      py <= geometry.bounds.bottom
    ) {
      return { mode: "move" as const };
    }

    return null;
  }

  function findInteractiveDrawing(point: DrawingPoint) {
    const interactive = [...drawings]
      .reverse()
      .filter((drawing) => drawing.tool === "longPosition" || drawing.tool === "shortPosition")
      .map((drawing) => {
        const hit = getLongShortInteraction(drawing, point);
        if (!hit) return null;
        return { drawing, hit };
      })
      .filter(Boolean) as {
        drawing: ChartDrawing;
        hit: { mode: "move" | "positionTargetLeft" | "positionTargetRight" | "positionStopLeft" | "positionStopRight" };
      }[];

    return interactive[0] ?? null;
  }

  function buildAnchoredVwap(anchor: DrawingPoint) {
    const anchorIndex = candles.findIndex((candle) => Math.floor(candle.timestamp / 1000) >= anchor.time);
    if (anchorIndex < 0) return null;
    return {
      id: createId("drawing"),
      tool: "anchoredVwap" as const,
      points: [anchor],
      color: "#EAB308",
    };
  }

  function removeNearestDrawing(point: DrawingPoint) {
    const chartWidth = chartContainerRef.current?.clientWidth ?? 0;
    const chartHeight = chartContainerRef.current?.clientHeight ?? 0;
    const targetX = timeToX(point.time);
    const targetY = priceToY(point.price);
    if (targetX == null || targetY == null) return;

    const scored = drawings
      .map((drawing) => {
        const primary = drawing.points[0];
        const secondary = drawing.points[1] ?? drawing.points[0];
        const px = timeToX(primary.time) ?? targetX;
        const py = priceToY(primary.price) ?? targetY;
        const sx = timeToX(secondary.time) ?? px;
        const sy = priceToY(secondary.price) ?? py;
        const anchorDistance = Math.hypot(px - targetX, py - targetY);
        const secondaryDistance = Math.hypot(sx - targetX, sy - targetY);
        const horizontalDistance = drawing.tool === "horizontalLine" || drawing.tool === "horizontalRay" ? Math.abs(py - targetY) : Number.POSITIVE_INFINITY;
        const verticalDistance = drawing.tool === "verticalLine" ? Math.abs(px - targetX) : Number.POSITIVE_INFINITY;
        const boxDistance =
          drawing.tool === "rectangle" || drawing.tool === "ellipse" || drawing.tool === "circle"
            ? Math.min(
                Math.abs(Math.min(px, sx) - targetX),
                Math.abs(Math.max(px, sx) - targetX),
                Math.abs(Math.min(py, sy) - targetY),
                Math.abs(Math.max(py, sy) - targetY)
              )
            : Number.POSITIVE_INFINITY;
        const viewportDistance = Math.min(anchorDistance, secondaryDistance, horizontalDistance, verticalDistance, boxDistance);
        return { id: drawing.id, distance: viewportDistance };
      })
      .sort((a, b) => a.distance - b.distance);

    if (scored[0] && scored[0].distance < Math.max(14, Math.min(chartWidth, chartHeight) * 0.03)) {
      removeDrawing(scored[0].id);
    }
  }

  function handleDrawingPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;

    const point = getPointerPoint(event.clientX, event.clientY, selectedTool !== "cursor");
    if (!point) return;

    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    setOpenToolbarGroup(null);
    setContextMenu(null);

    if (selectedTool === "cursor") {
      const interactive = findInteractiveDrawing(point);
      if (interactive) {
        setSelectedDrawingId(interactive.drawing.id);
        setPositionSettingsDrawingId((current) => current && current !== interactive.drawing.id ? null : current);
        if (!drawingsLocked) {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrawingInteraction({
            drawingId: interactive.drawing.id,
            mode: interactive.hit.mode,
            startPointer: point,
            originalPoints: interactive.drawing.points.map((currentPoint) => ({ ...currentPoint })),
          });
        }
      } else {
        setSelectedDrawingId(null);
        setPositionSettingsDrawingId(null);
      }
      return;
    }

    if (drawingsLocked) return;

    if (selectedTool === "eraser") {
      removeNearestDrawing(point);
      return;
    }

    if (selectedTool === "horizontalLine" || selectedTool === "verticalLine" || selectedTool === "crossLine") {
      finishDraft({
        id: createId("drawing"),
        tool: selectedTool,
        points: [point],
        color: "#9CA3AF",
      });
      return;
    }

    if (TEXT_TOOLS.includes(selectedTool)) {
      if (!chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      setTextEditor({
        x: clamp(event.clientX - rect.left, 80, rect.width - 260),
        y: clamp(event.clientY - rect.top, 40, rect.height - 120),
        time: point.time,
        price: point.price,
        value: "",
        tool: selectedTool,
      });
      return;
    }

    if (selectedTool === "anchoredVwap") {
      const next = buildAnchoredVwap(point);
      if (next) finishDraft(next);
      return;
    }

    setDraftDrawing({
      id: createId("draft"),
      tool: selectedTool,
      points: [point, point],
      color: "#60A5FA",
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDrawingPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    if (drawingInteraction) {
      const point = getPointerPoint(event.clientX, event.clientY, false);
      if (!point) return;
      setDrawings((current) =>
        current.map((drawing) => {
          if (drawing.id !== drawingInteraction.drawingId) return drawing;
          const basePoints = drawingInteraction.originalPoints.map((currentPoint) => ({ ...currentPoint }));
          if (drawingInteraction.mode === "move") {
            const timeDelta = point.time - drawingInteraction.startPointer.time;
            const nextEntryPrice = snapPositionPrice(
              basePoints[0].price + point.price - drawingInteraction.startPointer.price
            );
            const priceDelta = nextEntryPrice - basePoints[0].price;
            return {
              ...drawing,
              points: basePoints.map((currentPoint) => ({
                time: Math.round(currentPoint.time + timeDelta),
                price: snapPositionPrice(currentPoint.price + priceDelta),
              })),
            };
          }
          if (
            drawingInteraction.mode === "positionTargetLeft"
            || drawingInteraction.mode === "positionTargetRight"
            || drawingInteraction.mode === "positionStopLeft"
            || drawingInteraction.mode === "positionStopRight"
          ) {
            const isLong = drawing.tool === "longPosition";
            const isTarget = drawingInteraction.mode === "positionTargetLeft" || drawingInteraction.mode === "positionTargetRight";
            const isLeft = drawingInteraction.mode === "positionTargetLeft" || drawingInteraction.mode === "positionStopLeft";
            const minimumTimeSpan = Math.max(
              1,
              candles.length > 1 ? Math.round(Math.abs(candles[1].timestamp - candles[0].timestamp) / 1000) : 60
            );
            const startTime = basePoints[0].time;
            const endTime = basePoints[1].time;
            const nextTime = isLeft
              ? Math.min(Math.round(point.time), endTime - minimumTimeSpan)
              : Math.max(Math.round(point.time), startTime + minimumTimeSpan);
            if (isLeft) {
              basePoints[0] = { ...basePoints[0], time: nextTime };
            } else {
              basePoints[1] = { ...basePoints[1], time: nextTime };
              if (basePoints[2]) basePoints[2] = { ...basePoints[2], time: nextTime };
            }

            if (isTarget) {
              const targetPrice = snapPositionPrice(isLong
                ? Math.max(point.price, basePoints[0].price + priceFormat.minMove)
                : Math.min(point.price, basePoints[0].price - priceFormat.minMove));
              if (basePoints[2]) basePoints[2] = { ...basePoints[2], price: targetPrice };
              else basePoints.push({ time: basePoints[1].time, price: targetPrice });
            } else {
              basePoints[1] = {
                ...basePoints[1],
                price: snapPositionPrice(isLong
                  ? Math.min(point.price, basePoints[0].price - priceFormat.minMove)
                  : Math.max(point.price, basePoints[0].price + priceFormat.minMove)),
              };
            }
            return { ...drawing, points: basePoints };
          }
          const anchorIndex = drawingInteraction.mode === "anchor0" ? 0 : 1;
          basePoints[anchorIndex] = point;
          return {
            ...drawing,
            points: basePoints,
          };
        })
      );
      return;
    }
    if (!draftDrawing) return;
    const isPositionDraft = draftDrawing.tool === "longPosition" || draftDrawing.tool === "shortPosition";
    const point = getPointerPoint(event.clientX, event.clientY, !isPositionDraft);
    if (!point) return;
    setDraftDrawing((current) => (current ? { ...current, points: [current.points[0], point] } : current));
  }

  function handleDrawingPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drawingInteraction) {
      setDrawingInteraction(null);
      return;
    }
    if (!draftDrawing) return;
    const isPositionDraft = draftDrawing.tool === "longPosition" || draftDrawing.tool === "shortPosition";
    const point = getPointerPoint(event.clientX, event.clientY, !isPositionDraft);
    if (!point) {
      setDraftDrawing(null);
      return;
    }

    let finalized = { ...draftDrawing, points: [draftDrawing.points[0], point] };
    const [a, b] = finalized.points;
    const timeDiff = Math.abs(a.time - b.time);
    const priceDiff = Math.abs(a.price - b.price);
    const shouldDiscard = timeDiff < 1 && priceDiff < priceFormat.minMove * 0.5;
    if (shouldDiscard && finalized.tool !== "path") {
      setDraftDrawing(null);
      return;
    }
    if (finalized.tool === "longPosition" || finalized.tool === "shortPosition") {
      const isLong = finalized.tool === "longPosition";
      const entryPrice = snapPositionPrice(a.price);
      const startTime = Math.min(a.time, b.time);
      const endTime = Math.max(a.time, b.time);
      const stopPrice = snapPositionPrice(isLong
        ? Math.min(b.price, entryPrice - priceFormat.minMove)
        : Math.max(b.price, entryPrice + priceFormat.minMove));
      const riskDistance = Math.max(Math.abs(entryPrice - stopPrice), priceFormat.minMove);
      const targetPrice = snapPositionPrice(isLong ? entryPrice + riskDistance * 2 : entryPrice - riskDistance * 2);
      finalized = {
        ...finalized,
        points: [
          { time: startTime, price: entryPrice },
          { time: endTime, price: stopPrice },
          { time: endTime, price: targetPrice },
        ],
      };
    }
    finishDraft(finalized);
  }

  function handleDrawingPointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrawingInteraction(null);
    setDraftDrawing(null);
  }

  function handleDrawingDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (selectedTool !== "cursor") return;
    const point = getPointerPoint(event.clientX, event.clientY, false);
    if (!point) return;
    const interactive = findInteractiveDrawing(point);
    if (!interactive) return;
    event.preventDefault();
    event.stopPropagation();
    setDrawingInteraction(null);
    setSelectedDrawingId(interactive.drawing.id);
    setPositionSettingsDrawingId(interactive.drawing.id);
  }

  function removeDrawing(drawingId: string) {
    setDrawings((current) => current.filter((drawing) => drawing.id !== drawingId));
    setSelectedDrawingId((current) => (current === drawingId ? null : current));
    setPositionSettingsDrawingId((current) => (current === drawingId ? null : current));
  }

  const renderableDrawings = useMemo(() => (hideDrawings ? [] : drawings), [drawings, hideDrawings]);

  function renderChartZone(zone: ChartZone) {
    const highY = priceToY(zone.high);
    const lowY = priceToY(zone.low);
    if (highY == null || lowY == null) return null;
    const top = Math.min(highY, lowY);
    const height = Math.max(4, Math.abs(lowY - highY));
    const plotWidth = Math.max(0, overlaySize.width - 64);
    const naturalLabelY = Math.max(13, Math.min(overlaySize.height - 8, top + Math.min(height / 2, 14)));
    const rawRightAlignedLabelY = (highY + lowY) / 2;
    const rightAlignedLabelY = rightAlignedZoneLabelYs.get(zone.id)
      ?? (rawRightAlignedLabelY >= 14 && rawRightAlignedLabelY <= overlaySize.height - 36
        ? rawRightAlignedLabelY
        : undefined);
    const labelY = rightAlignedLabelY ?? naturalLabelY;
    const labelWidth = Math.min(260, Math.max(70, zone.label.length * 5.7 + 14));
    const labelX = 10;

    return (
      <g key={`chart-zone-${zone.id}`} aria-label={zone.label}>
        <rect
          x={0}
          y={top}
          width={plotWidth}
          height={height}
          fill={zone.fillColor}
          stroke={zone.color}
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <>
          <rect
            x={labelX}
            y={labelY - 9}
            width={labelWidth}
            height={17}
            rx={1}
            fill="var(--panel)"
            stroke={zone.color}
            strokeWidth={0.8}
          />
          <text
            x={labelX + 7}
            y={labelY + 3}
            fill={zone.color}
            fontSize="8"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
            textAnchor="start"
          >
            {zone.label}
          </text>
        </>
      </g>
    );
  }

  function renderDrawing(drawing: ChartDrawing, keyPrefix = "drawing") {
    const [a, b] = drawing.points;
    const ax = a ? timeToX(a.time) : null;
    const ay = a ? priceToY(a.price) : null;
    const bx = b ? timeToX(b.time) : null;
    const by = b ? priceToY(b.price) : null;
    const color = drawing.color ?? "#60A5FA";
    const commonStroke = { stroke: color, strokeWidth: 1.6, fill: "none" as const };

    if (ax == null || ay == null) return null;

    switch (drawing.tool) {
      case "horizontalLine":
        return <line key={`${keyPrefix}-${drawing.id}`} x1={0} y1={ay} x2={chartContainerRef.current?.clientWidth ?? 0} y2={ay} {...commonStroke} strokeDasharray="5 4" />;
      case "verticalLine":
        return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={0} x2={ax} y2={chartContainerRef.current?.clientHeight ?? 0} {...commonStroke} strokeDasharray="5 4" />;
      case "crossLine":
        return (
          <g key={`${keyPrefix}-${drawing.id}`}>
            <line x1={0} y1={ay} x2={chartContainerRef.current?.clientWidth ?? 0} y2={ay} {...commonStroke} strokeDasharray="5 4" />
            <line x1={ax} y1={0} x2={ax} y2={chartContainerRef.current?.clientHeight ?? 0} {...commonStroke} strokeDasharray="5 4" />
          </g>
        );
      case "trendLine":
        if (bx == null || by == null) return null;
        return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={ay} x2={bx} y2={by} {...commonStroke} />;
      case "infoLine":
        if (bx == null || by == null) return null;
        return (
          <g key={`${keyPrefix}-${drawing.id}`}>
            <line x1={ax} y1={ay} x2={bx} y2={by} {...commonStroke} />
            <rect
              x={(ax + bx) / 2 - 52}
              y={(ay + by) / 2 - 28}
              width={104}
              height={34}
              rx={8}
              fill="rgba(24,24,27,0.92)"
              stroke="rgba(255,255,255,0.14)"
            />
            <text x={(ax + bx) / 2} y={(ay + by) / 2 - 10} fill="#F4F4F5" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
              {formatPriceDistance(a.price, b.price, priceFormat.precision)}
            </text>
            <text x={(ax + bx) / 2} y={(ay + by) / 2 + 6} fill="#A1A1AA" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
              {formatDateRangeLabel(a.time, b.time)}
            </text>
          </g>
        );
      case "ray":
        if (bx == null || by == null) return null;
        {
          const width = chartContainerRef.current?.clientWidth ?? 0;
          const slope = bx === ax ? 0 : (by - ay) / (bx - ax);
          const endX = width;
          const endY = ay + slope * (endX - ax);
          return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={ay} x2={endX} y2={endY} {...commonStroke} />;
        }
      case "horizontalRay":
        return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={ay} x2={chartContainerRef.current?.clientWidth ?? 0} y2={ay} {...commonStroke} />;
      case "extendedLine":
        if (bx == null || by == null) return null;
        {
          const width = chartContainerRef.current?.clientWidth ?? 0;
          if (bx === ax) {
            return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={0} x2={ax} y2={chartContainerRef.current?.clientHeight ?? 0} {...commonStroke} />;
          }
          const slope = (by - ay) / (bx - ax);
          const startX = 0;
          const endX = width;
          const startY = ay + slope * (startX - ax);
          const endY = ay + slope * (endX - ax);
          return <line key={`${keyPrefix}-${drawing.id}`} x1={startX} y1={startY} x2={endX} y2={endY} {...commonStroke} />;
        }
      case "rectangle":
      case "measure":
      case "datePriceRange":
        if (bx == null || by == null) return null;
        {
          const x = Math.min(ax, bx);
          const y = Math.min(ay, by);
          const width = Math.abs(bx - ax);
          const height = Math.abs(by - ay);
          const measurement = drawing.tool !== "rectangle";
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <rect x={x} y={y} width={Math.max(width, 1)} height={Math.max(height, 1)} stroke={color} strokeWidth={1.5} fill={measurement ? "rgba(96,165,250,0.08)" : "rgba(96,165,250,0.10)"} strokeDasharray={measurement ? "6 4" : undefined} />
              {measurement && (
                <>
                  <text x={x + 8} y={y + 18} fill="#E4E4E7" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                    {formatPriceDistance(a.price, b.price, priceFormat.precision)}
                  </text>
                  <text x={x + 8} y={y + 34} fill="#A1A1AA" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                    {formatDateRangeLabel(a.time, b.time)}
                  </text>
                </>
              )}
            </g>
          );
        }
      case "ellipse":
        if (bx == null || by == null) return null;
        return (
          <ellipse
            key={`${keyPrefix}-${drawing.id}`}
            cx={(ax + bx) / 2}
            cy={(ay + by) / 2}
            rx={Math.abs(bx - ax) / 2}
            ry={Math.abs(by - ay) / 2}
            stroke={color}
            strokeWidth={1.5}
            fill="rgba(56,189,248,0.08)"
          />
        );
      case "circle":
        if (bx == null || by == null) return null;
        {
          const radius = Math.max(8, Math.min(Math.abs(bx - ax), Math.abs(by - ay)));
          return (
            <circle
              key={`${keyPrefix}-${drawing.id}`}
              cx={ax}
              cy={ay}
              r={radius}
              stroke={color}
              strokeWidth={1.5}
              fill="rgba(56,189,248,0.08)"
            />
          );
        }
      case "path":
        if (bx == null || by == null) return null;
        return <path key={`${keyPrefix}-${drawing.id}`} d={`M ${ax} ${ay} Q ${(ax + bx) / 2} ${Math.min(ay, by) - 36} ${bx} ${by}`} {...commonStroke} />;
      case "fibRetracement":
        if (bx == null || by == null) return null;
        {
          const x1 = Math.min(ax, bx);
          const x2 = Math.max(ax, bx);
          const minPrice = Math.min(a.price, b.price);
          const maxPrice = Math.max(a.price, b.price);
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              {FIB_LEVELS.map((level) => {
                const levelPrice = maxPrice - (maxPrice - minPrice) * level;
                const y = priceToY(levelPrice);
                if (y == null) return null;
                return (
                  <g key={level}>
                    <line x1={x1} y1={y} x2={x2} y2={y} stroke={level === 0.5 ? "#FBBF24" : color} strokeWidth={level === 0.5 ? 1.8 : 1.2} strokeDasharray={level === 0.5 ? "3 2" : undefined} />
                    <text x={x2 + 6} y={y + 3} fill="#E4E4E7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                      {level.toFixed(level === 0 || level === 1 ? 0 : 3)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }
      case "text":
      case "note":
      case "priceNote":
      case "callout":
      case "comment":
      case "priceLabel":
      case "pin":
      case "signpost":
      case "flagMark":
        {
          const chrome = getTextToolChrome(drawing.tool);
          const text = drawing.tool === "priceLabel" || drawing.tool === "priceNote"
            ? `${drawing.text || "Label"} ${a.price.toFixed(priceFormat.precision)}`
            : drawing.text || "Text";
          const width = Math.max(108, text.length * 7.1 + 18);
          const height = drawing.tool === "callout" || drawing.tool === "comment" || drawing.tool === "note" ? 42 : 26;
          const boxX = ax - 4;
          const boxY = ay - height + 6;
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              {drawing.tool === "pin" ? <circle cx={ax - 6} cy={ay - 8} r={5} fill={chrome.stroke} /> : null}
              {drawing.tool === "signpost" || drawing.tool === "flagMark" ? <line x1={ax - 8} y1={ay - 16} x2={ax - 8} y2={ay + 8} stroke={chrome.stroke} strokeWidth={1.4} /> : null}
              <rect x={boxX} y={boxY} width={width} height={height} rx={8} fill={chrome.fill} stroke={chrome.stroke} />
              {drawing.tool === "callout" || drawing.tool === "comment" ? (
                <path d={`M ${ax + 10} ${boxY + height} L ${ax + 18} ${boxY + height + 10} L ${ax + 26} ${boxY + height}`} fill={chrome.fill} stroke={chrome.stroke} />
              ) : null}
              <text x={ax + 8} y={boxY + (height > 30 ? 18 : 17)} fill={chrome.text} fontSize="12" fontFamily="'Inter', sans-serif">
                {text}
              </text>
            </g>
          );
        }
      case "longPosition":
      case "shortPosition":
        if (bx == null || by == null) return null;
        {
          const geometry = getLongShortGeometry(drawing);
          if (!geometry) return null;
          const isSelected = selectedDrawingId === drawing.id;
          const stopDistance = Math.max(Math.abs(a.price - geometry.stopPrice), priceFormat.minMove);
          const targetDistance = Math.max(Math.abs(geometry.targetPrice - a.price), priceFormat.minMove);
          const targetTicks = Math.round(targetDistance / priceFormat.minMove);
          const stopTicks = Math.round(stopDistance / priceFormat.minMove);
          const targetText = `Target ${targetDistance.toFixed(priceFormat.precision)} pts · ${targetTicks} ticks`;
          const stopText = `Stop ${stopDistance.toFixed(priceFormat.precision)} pts · ${stopTicks} ticks`;
          const rewardRisk = targetDistance / stopDistance;
          const rewardRiskLabel = (rewardRisk >= 10 ? rewardRisk.toFixed(1) : rewardRisk.toFixed(2))
            .replace(/\.0+$/, "")
            .replace(/(\.\d*[1-9])0+$/, "$1");
          const rewardRiskText = `1:${rewardRiskLabel} R:R`;
          const targetLabelWidth = Math.min(Math.max(156, targetText.length * 6.15 + 18), Math.max(156, overlaySize.width - geometry.x - 8));
          const stopLabelWidth = Math.min(Math.max(156, stopText.length * 6.15 + 18), Math.max(156, overlaySize.width - geometry.x - 8));
          const rewardRiskLabelWidth = Math.max(76, rewardRiskText.length * 6.4 + 20);
          const profitTop = Math.min(geometry.profitTop, geometry.profitBottom);
          const centredLabelX = (labelWidth: number) => clamp(
            geometry.x + geometry.boxWidth / 2 - labelWidth / 2,
            4,
            Math.max(4, overlaySize.width - labelWidth - 4),
          );
          const targetLabelX = centredLabelX(targetLabelWidth);
          const stopLabelX = centredLabelX(stopLabelWidth);
          const rewardRiskLabelX = centredLabelX(rewardRiskLabelWidth);
          const targetLabelY = clamp(geometry.targetY - 10.5, 4, Math.max(4, overlaySize.height - 25));
          const stopLabelY = clamp(geometry.stopY - 10.5, 4, Math.max(4, overlaySize.height - 25));
          const rewardRiskLabelY = clamp(geometry.entryY - 10.5, 4, Math.max(4, overlaySize.height - 25));
          const visualStyle = drawing.positionStyle ?? {};
          const profitColor = visualStyle.targetColor ?? settings.upColor;
          const lossColor = visualStyle.stopColor ?? settings.downColor;
          const entryLineColor = visualStyle.entryLineColor ?? "var(--foreground)";
          const labelTextColor = visualStyle.textColor ?? "var(--background)";
          const fillOpacity = clamp(visualStyle.fillOpacity ?? 0.14, 0, 0.6);
          const borderOpacity = clamp(visualStyle.borderOpacity ?? 0.72, 0.1, 1);
          const lineWidth = clamp(visualStyle.lineWidth ?? 1.25, 0.5, 4);
          const lineDash = visualStyle.lineStyle === "dashed"
            ? "7 5"
            : visualStyle.lineStyle === "dotted"
              ? "2 4"
              : undefined;
          const showLabels = visualStyle.showLabels ?? true;
          return (
            <g
              key={`${keyPrefix}-${drawing.id}`}
              data-position-drawing-id={drawing.id}
              style={{ pointerEvents: "all", cursor: drawingsLocked ? "default" : "move" }}
            >
              <rect
                x={geometry.x}
                y={profitTop}
                width={geometry.boxWidth}
                height={Math.abs(geometry.profitBottom - geometry.profitTop)}
                fill={withAlpha(profitColor, fillOpacity)}
                stroke={withAlpha(profitColor, borderOpacity)}
                strokeWidth={lineWidth}
                strokeDasharray={lineDash}
              />
              <rect
                x={geometry.x}
                y={Math.min(geometry.riskTop, geometry.riskBottom)}
                width={geometry.boxWidth}
                height={Math.abs(geometry.riskBottom - geometry.riskTop)}
                fill={withAlpha(lossColor, fillOpacity)}
                stroke={withAlpha(lossColor, borderOpacity)}
                strokeWidth={lineWidth}
                strokeDasharray={lineDash}
              />
              <line x1={geometry.x} y1={geometry.targetY} x2={geometry.x + geometry.boxWidth} y2={geometry.targetY} stroke={profitColor} strokeWidth={lineWidth} strokeDasharray={lineDash} />
              <line x1={geometry.x} y1={geometry.entryY} x2={geometry.x + geometry.boxWidth} y2={geometry.entryY} stroke={entryLineColor} strokeOpacity={borderOpacity} strokeWidth={lineWidth} strokeDasharray={lineDash ?? "4 3"} />
              <line x1={geometry.x} y1={geometry.stopY} x2={geometry.x + geometry.boxWidth} y2={geometry.stopY} stroke={lossColor} strokeWidth={lineWidth} strokeDasharray={lineDash} />

              {showLabels && isSelected ? <g pointerEvents="none">
                <rect x={targetLabelX} y={targetLabelY} width={targetLabelWidth} height={21} rx={10.5} fill={profitColor} />
                <text x={targetLabelX + targetLabelWidth / 2} y={targetLabelY + 14} textAnchor="middle" fill={labelTextColor} fontSize="10" fontWeight="650" fontFamily="'JetBrains Mono', monospace">
                  {targetText}
                </text>
                <rect x={stopLabelX} y={stopLabelY} width={stopLabelWidth} height={21} rx={10.5} fill={lossColor} />
                <text x={stopLabelX + stopLabelWidth / 2} y={stopLabelY + 14} textAnchor="middle" fill={labelTextColor} fontSize="10" fontWeight="650" fontFamily="'JetBrains Mono', monospace">
                  {stopText}
                </text>
                <rect x={rewardRiskLabelX} y={rewardRiskLabelY} width={rewardRiskLabelWidth} height={21} rx={10.5} fill={entryLineColor} />
                <text x={rewardRiskLabelX + rewardRiskLabelWidth / 2} y={rewardRiskLabelY + 14} textAnchor="middle" fill={labelTextColor} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                  {rewardRiskText}
                </text>
              </g> : null}
              {isSelected ? (
                <g>
                  {[
                    geometry.targetLeftHandle,
                    geometry.targetRightHandle,
                    geometry.stopLeftHandle,
                    geometry.stopRightHandle,
                  ].map((handle, index) => (
                    <rect
                      key={index}
                      x={handle.x - 4.5}
                      y={handle.y - 4.5}
                      width={9}
                      height={9}
                      rx={2}
                      fill="var(--panel)"
                      stroke="var(--primary)"
                      strokeWidth={1.5}
                      style={{ cursor: index === 0 || index === 3 ? "nwse-resize" : "nesw-resize" }}
                    />
                  ))}
                </g>
              ) : null}
            </g>
          );
        }
      case "priceRange":
        if (by == null) return null;
        {
          const y1 = ay;
          const y2 = by;
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <line x1={ax} y1={y1} x2={ax} y2={y2} {...commonStroke} />
              <line x1={ax - 10} y1={y1} x2={ax + 10} y2={y1} {...commonStroke} />
              <line x1={ax - 10} y1={y2} x2={ax + 10} y2={y2} {...commonStroke} />
              <text x={ax + 14} y={(y1 + y2) / 2} fill="#E4E4E7" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                {formatPriceDistance(a.price, b.price, priceFormat.precision)}
              </text>
            </g>
          );
        }
      case "dateRange":
        if (bx == null) return null;
        {
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <line x1={ax} y1={ay} x2={bx} y2={ay} {...commonStroke} />
              <line x1={ax} y1={ay - 10} x2={ax} y2={ay + 10} {...commonStroke} />
              <line x1={bx} y1={ay - 10} x2={bx} y2={ay + 10} {...commonStroke} />
              <text x={(ax + bx) / 2} y={ay - 10} fill="#E4E4E7" fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                {formatDateRangeLabel(a.time, b.time)}
              </text>
            </g>
          );
        }
      case "anchoredVwap":
        {
          const anchorIndex = candles.findIndex((candle) => Math.floor(candle.timestamp / 1000) >= a.time);
          if (anchorIndex < 0) return null;
          let cumulativePv = 0;
          let cumulativeVolume = 0;
          const points = candles.slice(anchorIndex).map((candle) => {
            const typical = (candle.high + candle.low + candle.close) / 3;
            const volume = candle.volume ?? 1;
            cumulativePv += typical * volume;
            cumulativeVolume += volume;
            return {
              x: timeToX(Math.floor(candle.timestamp / 1000)),
              y: priceToY(cumulativeVolume > 0 ? cumulativePv / cumulativeVolume : candle.close),
            };
          }).filter((point) => point.x != null && point.y != null) as { x: number; y: number }[];
          if (points.length < 2) return null;
          const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <path d={d} stroke="#EAB308" strokeWidth={1.8} fill="none" />
              <circle cx={ax} cy={ay} r={4} fill="#EAB308" />
            </g>
          );
        }
      default:
        return null;
    }
  }

  useEffect(() => {
    if (candles.length === 0) {
      latestCandleRef.current = null;
      chartVisualReadyTokenRef.current += 1;
      setChartVisualReady(false);
      return;
    }
    const lastSourceCandle = candles[candles.length - 1];
    latestCandleRef.current = lastSourceCandle;
    if (!candleSeriesRef.current || !chartRef.current) return;
    const lastCandleKey = `${lastSourceCandle.timestamp}-${lastSourceCandle.open}-${lastSourceCandle.high}-${lastSourceCandle.low}-${lastSourceCandle.close}`;
    if (lastCandleKey === prevDataRef.current) return;
    prevDataRef.current = lastCandleKey;

    const previousCandleCount = prevCandlesLengthRef.current;
    const needsFullRedraw =
      prevCandlesLengthRef.current === 0 ||
      Math.abs(candles.length - prevCandlesLengthRef.current) > 5 ||
      (prevFirstTimestampRef.current !== null && candles[0]?.timestamp !== prevFirstTimestampRef.current);

    if (needsFullRedraw) {
      const chartData = buildSafeChartData(
        candles,
        timeframeToMs(timeframe) === null,
        eventSourceTimeByChartTimeRef.current,
        eventChartTimeBySourceTimeRef.current,
      );
      candleSeriesRef.current.setData(chartData);
      lastRenderedCandleTimeRef.current = chartData.length
        ? Number(chartData[chartData.length - 1].time)
        : null;
      lastRenderedSourceTimestampRef.current = lastSourceCandle.timestamp;
      const historyExpanded =
        previousCandleCount <= 5
        || candles.length >= Math.max(50, previousCandleCount * 1.5);
      if (historyExpanded) {
        resetViewportBeforeReveal(
          chartRef.current,
          candleSeriesRef.current,
          candles.length,
        );
      }
      applyMarkers(tradesRef.current);
      setTimeout(() => {
        if (tradesRef.current.length > 0) {
          applyMarkers(tradesRef.current);
        }
      }, 100);
      prevCandlesLengthRef.current = candles.length;
      prevFirstTimestampRef.current = candles[0]?.timestamp ?? null;
      return;
    }

    const naturalTime = Math.floor(lastSourceCandle.timestamp / 1_000);
    const eventBased = timeframeToMs(timeframe) === null;
    const sameSourceBar = lastRenderedSourceTimestampRef.current === lastSourceCandle.timestamp;
    const incrementalTime = eventBased && lastRenderedCandleTimeRef.current !== null
      ? sameSourceBar
        ? lastRenderedCandleTimeRef.current
        : Math.max(naturalTime, lastRenderedCandleTimeRef.current + 1)
      : naturalTime;
    const lastCandle = {
      time: incrementalTime as Time,
      open: lastSourceCandle.open,
      high: lastSourceCandle.high,
      low: lastSourceCandle.low,
      close: lastSourceCandle.close,
    };
    if (lastCandle) {
      const candleTime = Number(lastCandle.time);
      if (
        lastRenderedCandleTimeRef.current === null
        || candleTime >= lastRenderedCandleTimeRef.current
      ) {
        try {
          candleSeriesRef.current.update(lastCandle);
          lastRenderedCandleTimeRef.current = candleTime;
          lastRenderedSourceTimestampRef.current = lastSourceCandle.timestamp;
          if (eventBased) {
            eventSourceTimeByChartTimeRef.current.set(candleTime, lastSourceCandle.timestamp);
            eventChartTimeBySourceTimeRef.current.set(lastSourceCandle.timestamp, candleTime);
          }
        } catch {
          // A superseded history request can finish after a timeframe switch.
        }
      }
    }

    if (candles.length > prevCandlesLengthRef.current) {
      prevCandlesLengthRef.current = candles.length;
    }
  }, [candles]);

  const hasCandles = candles.length > 0;
  useEffect(() => {
    tradesRef.current = trades || [];
    applyMarkers(tradesRef.current);
  }, [trades]);

  useEffect(() => {
    levelsRef.current = resolvedLevelLayers.foreground;
    applyLevels(levelsRef.current);
    fixedPriceLevelLabelsRef.current?.update(
      levelsRef.current,
      settings.backgroundColor,
      priceFormat.precision,
    );
  }, [priceFormat.precision, resolvedLevelLayers.foreground, settings.backgroundColor]);

  useEffect(() => {
    backgroundLevelsRef.current = resolvedLevelLayers.background;
    backgroundZonesRef.current = backgroundZones;
    gameplanUnderlayRef.current?.update(
      backgroundLevelsRef.current,
      backgroundZonesRef.current,
      settings.backgroundColor,
    );
  }, [backgroundZones, resolvedLevelLayers.background, settings.backgroundColor]);

  useEffect(() => {
    sessionHighLowPrimitiveRef.current?.update(sessionHighLowRenderData);
  }, [sessionHighLowRenderData]);

  useEffect(() => {
    sessionWindowPrimitiveRef.current?.update(sessionWindowRenderData);
  }, [sessionWindowRenderData]);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const themeStyles = window.getComputedStyle(document.documentElement);
    const crosshairColor =
      themeStyles.getPropertyValue("--crosshair-color").trim()
      || "rgba(182,255,0,.78)";
    const crosshairLabelColor =
      themeStyles.getPropertyValue("--surface").trim()
      || "#18181B";
    const chartTimeZone = normalizeTimeZone(settings.timezone);
    const displayEventTime = (time: Time) => {
      const sourceTimestamp = eventSourceTimeByChartTimeRef.current.get(Number(time));
      return sourceTimestamp === undefined
        ? time
        : (Math.floor(sourceTimestamp / 1_000) as Time);
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: settings.backgroundColor },
        textColor: "#9CA3AF",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        attributionLogo: false,
      },
      localization: {
        locale: "en-AU",
        timeFormatter: (time: Time) =>
          `${formatChartTimestamp(displayEventTime(time), chartTimeZone, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })} · ${compactTimeZoneLabel(chartTimeZone)}`,
      },
      grid: {
        vertLines: { color: settings.gridLines ? settings.gridColor : "transparent" },
        horzLines: { color: settings.gridLines ? settings.gridColor : "transparent" },
      },
      rightPriceScale: {
        borderColor: "#1A1A1D",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#1A1A1D",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) =>
          formatChartTick(displayEventTime(time), chartTimeZone, timeframe),
      },
      crosshair: {
        mode: 0,
        vertLine: {
          visible: true,
          width: 1,
          color: crosshairColor,
          style: 0,
          labelVisible: true,
          labelBackgroundColor: crosshairLabelColor,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    setOverlaySize({
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    chartRef.current = chart;
    const syncNativePriceScaleWidth = () => {
      const nextWidth = Math.max(44, Math.ceil(chart.priceScale("right").width() || 64));
      setNativePriceScaleWidth((current) => current === nextWidth ? current : nextWidth);
    };
    window.requestAnimationFrame(syncNativePriceScaleWidth);
    setChartReadyRevision((current) => current + 1);

    const candleSeries = chart.addCandlestickSeries({
      upColor: settings.upColor,
      downColor: settings.downColor,
      borderUpColor: settings.borderUpColor,
      borderDownColor: settings.borderDownColor,
      wickUpColor: settings.wickUpColor,
      wickDownColor: settings.wickDownColor,
      priceFormat,
      crosshairMarkerVisible: false,
    } as Parameters<typeof chart.addCandlestickSeries>[0] & { crosshairMarkerVisible: boolean });
    candleSeriesRef.current = candleSeries;
    const gameplanUnderlay = new GameplanUnderlayPrimitive();
    gameplanUnderlay.update(
      backgroundLevelsRef.current,
      backgroundZonesRef.current,
      settings.backgroundColor,
    );
    candleSeries.attachPrimitive(gameplanUnderlay);
    gameplanUnderlayRef.current = gameplanUnderlay;
    const fixedPriceLevelLabels = new FixedPriceLevelLabelsPrimitive();
    fixedPriceLevelLabels.update(
      levelsRef.current,
      settings.backgroundColor,
      priceFormat.precision,
    );
    candleSeries.attachPrimitive(fixedPriceLevelLabels);
    fixedPriceLevelLabelsRef.current = fixedPriceLevelLabels;
    const sessionHighLowPrimitive = new SessionHighLowPrimitive();
    sessionHighLowPrimitive.update(sessionHighLowRenderDataRef.current);
    candleSeries.attachPrimitive(sessionHighLowPrimitive);
    sessionHighLowPrimitiveRef.current = sessionHighLowPrimitive;
    const sessionWindowPrimitive = new SessionWindowPrimitive();
    sessionWindowPrimitive.update(sessionWindowRenderDataRef.current);
    candleSeries.attachPrimitive(sessionWindowPrimitive);
    sessionWindowPrimitiveRef.current = sessionWindowPrimitive;
    const hedgeLevelsPrimitive = new HedgeLevelsPrimitive();
    candleSeries.attachPrimitive(hedgeLevelsPrimitive);
    hedgeLevelsPrimitiveRef.current = hedgeLevelsPrimitive;
    const classicGexProfilePrimitive = new ClassicGexProfilePrimitive();
    candleSeries.attachPrimitive(classicGexProfilePrimitive);
    classicGexProfilePrimitiveRef.current = classicGexProfilePrimitive;
    const gammaHeatmapPrimitive = new GammaHeatmapPrimitive();
    candleSeries.attachPrimitive(gammaHeatmapPrimitive);
    gammaHeatmapPrimitiveRef.current = gammaHeatmapPrimitive;
    const netGammaExposurePrimitive = new NetGammaExposurePrimitive();
    candleSeries.attachPrimitive(netGammaExposurePrimitive);
    netGammaExposurePrimitiveRef.current = netGammaExposurePrimitive;
    const darkPoolMapPrimitive = new DarkPoolMapPrimitive();
    candleSeries.attachPrimitive(darkPoolMapPrimitive);
    darkPoolMapPrimitiveRef.current = darkPoolMapPrimitive;
    const volumeProfilePrimitive = new NativeVolumeProfilePrimitive();
    candleSeries.attachPrimitive(volumeProfilePrimitive);
    volumeProfilePrimitiveRef.current = volumeProfilePrimitive;
    const tpoProfilePrimitive = new TpoProfilePrimitive();
    candleSeries.attachPrimitive(tpoProfilePrimitive);
    tpoProfilePrimitiveRef.current = tpoProfilePrimitive;
    const bigTradesPrimitive = new BigTradesPrimitive();
    candleSeries.attachPrimitive(bigTradesPrimitive);
    bigTradesPrimitiveRef.current = bigTradesPrimitive;
    const bigBlocksPrimitive = new BigBlocksPrimitive();
    candleSeries.attachPrimitive(bigBlocksPrimitive);
    bigBlocksPrimitiveRef.current = bigBlocksPrimitive;
    const smtDivergencePrimitive = new SmtDivergencePrimitive();
    candleSeries.attachPrimitive(smtDivergencePrimitive);
    smtDivergencePrimitiveRef.current = smtDivergencePrimitive;
    const footprintPrimitive = new FootprintPrimitive();
    candleSeries.attachPrimitive(footprintPrimitive);
    footprintPrimitiveRef.current = footprintPrimitive;
    const paperFillMarkersPrimitive = new PaperFillMarkersPrimitive();
    candleSeries.attachPrimitive(paperFillMarkersPrimitive);
    paperFillMarkersPrimitiveRef.current = paperFillMarkersPrimitive;
    const paperPositionOverlayPrimitive = new PaperPositionOverlayPrimitive();
    candleSeries.attachPrimitive(paperPositionOverlayPrimitive);
    paperPositionOverlayPrimitiveRef.current = paperPositionOverlayPrimitive;

    const chartData = buildSafeChartData(
      candles,
      timeframeToMs(timeframe) === null,
      eventSourceTimeByChartTimeRef.current,
      eventChartTimeBySourceTimeRef.current,
    );

    candleSeries.setData(chartData);
    let applyingSynchronizedCrosshair = false;
    let synchronizedCrosshairReleaseFrame: number | null = null;
    let crosshairDispatchFrame: number | null = null;
    let pendingCrosshairMove: ChartCrosshairSyncMove | null = null;
    const dispatchPendingCrosshairMove = () => {
      crosshairDispatchFrame = null;
      const detail = pendingCrosshairMove;
      pendingCrosshairMove = null;
      if (!detail || !crosshairSyncEnabledRef.current) return;
      window.dispatchEvent(new CustomEvent<ChartCrosshairSyncMove>(CHART_CROSSHAIR_SYNC_MOVE_EVENT, {
        detail,
      }));
    };
    const queueCrosshairMove = (detail: ChartCrosshairSyncMove) => {
      pendingCrosshairMove = detail;
      if (crosshairDispatchFrame === null) {
        crosshairDispatchFrame = window.requestAnimationFrame(dispatchPendingCrosshairMove);
      }
    };
    const handleNativeCrosshairMove: Parameters<IChartApi["subscribeCrosshairMove"]>[0] = (param) => {
      if (!crosshairSyncEnabledRef.current || applyingSynchronizedCrosshair) return;
      if (!param.point || param.time === undefined) {
        queueCrosshairMove({
          sourceChartId: chartInstanceId,
          instrumentKey: crosshairSyncInstrumentKey,
          sourceTimestampMs: null,
          price: null,
          visible: false,
        });
        return;
      }
      const chartTime = Number(param.time);
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (!Number.isFinite(chartTime) || price === null || !Number.isFinite(price)) return;
      queueCrosshairMove({
        sourceChartId: chartInstanceId,
        instrumentKey: crosshairSyncInstrumentKey,
        sourceTimestampMs: eventSourceTimeByChartTimeRef.current.get(chartTime) ?? chartTime * 1_000,
        price,
        visible: true,
      });
    };
    const hideSynchronizedPriceGuide = () => {
      if (horzLineRef.current) horzLineRef.current.style.display = "none";
      if (priceLabelRef.current) priceLabelRef.current.style.display = "none";
    };
    const handleSynchronizedCrosshair = (event: Event) => {
      if (!crosshairSyncEnabledRef.current) return;
      const detail = (event as CustomEvent<ChartCrosshairSyncMove>).detail;
      if (
        !detail
        || detail.sourceChartId === chartInstanceId
        || detail.instrumentKey !== crosshairSyncInstrumentKey
      ) return;

      applyingSynchronizedCrosshair = true;
      if (synchronizedCrosshairReleaseFrame !== null) {
        window.cancelAnimationFrame(synchronizedCrosshairReleaseFrame);
        synchronizedCrosshairReleaseFrame = null;
      }
      try {
        if (
          !detail.visible
          || detail.sourceTimestampMs === null
          || detail.price === null
        ) {
          chart.clearCrosshairPosition();
          hideSynchronizedPriceGuide();
          return;
        }
        const targetTime = resolveSyncedChartTime(
          detail.sourceTimestampMs,
          drawingCandlesRef.current,
          eventChartTimeBySourceTimeRef.current,
        );
        if (targetTime === null) {
          chart.clearCrosshairPosition();
          hideSynchronizedPriceGuide();
          return;
        }
        chart.setCrosshairPosition(detail.price, targetTime as Time, candleSeries);
        const y = candleSeries.priceToCoordinate(detail.price);
        if (y !== null) {
          if (horzLineRef.current) {
            horzLineRef.current.style.top = `${y}px`;
            horzLineRef.current.style.display = "block";
          }
          if (priceLabelRef.current) {
            priceLabelRef.current.style.top = `${y - 10}px`;
            priceLabelRef.current.style.display = "block";
            priceLabelRef.current.textContent = detail.price.toFixed(priceFormat.precision);
          }
        }
      } finally {
        synchronizedCrosshairReleaseFrame = window.requestAnimationFrame(() => {
          applyingSynchronizedCrosshair = false;
          synchronizedCrosshairReleaseFrame = null;
        });
      }
    };
    chart.subscribeCrosshairMove(handleNativeCrosshairMove);
    window.addEventListener(CHART_CROSSHAIR_SYNC_MOVE_EVENT, handleSynchronizedCrosshair);
    const drawingColor = themeStyles.getPropertyValue("--primary").trim() || settings.upColor;
    const drawingStyle = {
      lineColor: drawingColor,
      lineWidth: 2,
      lineDash: [] as number[],
      fillColor: withAlpha(drawingColor, 0.12),
      fillOpacity: 0.12,
      showLabels: true,
      labelFont: "12px 'JetBrains Mono', monospace",
      labelColor: drawingColor,
    };
    const drawingManager = new DrawingManager();
    drawingManager.attach(chart, candleSeries, chartContainerRef.current);
    professionalDrawingManagerRef.current = drawingManager;
    drawingManager.setActiveTool(
      selectedToolRef.current === "selection" || precisionToolForDrawingTool(selectedToolRef.current)
        ? null
        : professionalDrawingType(selectedToolRef.current),
    );

    const syncProfessionalDrawingState = () => {
      if (professionalSyncSuppressedRef.current) return;
      const records = drawingManager.exportDrawings().filter((record) => record.id !== "__kwantdesk_drawing_preview__");
      const previous = professionalDrawingsRef.current;
      if (JSON.stringify(previous) === JSON.stringify(records)) return;
      if (!professionalUpdateHistoryOpenRef.current) {
        professionalUndoStackRef.current.push(previous);
        if (professionalUndoStackRef.current.length > 100) professionalUndoStackRef.current.shift();
        professionalRedoStackRef.current = [];
        professionalUpdateHistoryOpenRef.current = true;
      }
      if (professionalUpdateHistoryTimerRef.current !== null) window.clearTimeout(professionalUpdateHistoryTimerRef.current);
      professionalUpdateHistoryTimerRef.current = window.setTimeout(() => {
        professionalUpdateHistoryOpenRef.current = false;
        professionalUpdateHistoryTimerRef.current = null;
      }, 250);
      professionalDrawingsRef.current = records;
      setProfessionalDrawings(records);
      setDrawingHistoryRevision((revision) => revision + 1);
    };
    const drawingUnsubscribers = [
      drawingManager.on("drawing:added", syncProfessionalDrawingState),
      drawingManager.on("drawing:removed", syncProfessionalDrawingState),
      drawingManager.on("drawing:updated", syncProfessionalDrawingState),
      drawingManager.on("drawing:cleared", syncProfessionalDrawingState),
      drawingManager.on("drawing:selected", (event) => setSelectedProfessionalDrawingId(event.drawingId ?? null)),
      drawingManager.on("drawing:double-clicked", (event) => {
        if (!event.drawing || !DOUBLE_CLICK_STYLE_DRAWING_TYPES.has(event.drawing.type)) return;
        setSelectedProfessionalDrawingId(event.drawing.id);
        setShowDrawingSettings(true);
      }),
      drawingManager.on("drawing:deselected", () => setSelectedProfessionalDrawingId(null)),
    ];
    replaceProfessionalManagerDrawings(professionalDrawingsRef.current);

    const drawingPointFromMouse = (event: MouseEvent): ProfessionalDrawingAnchor | null => {
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const time = chart.timeScale().coordinateToTime(x);
      const price = candleSeries.coordinateToPrice(y);
      if (time === null || price === null) return null;
      const activeMagnet = magnetModeRef.current;
      if (event.altKey || activeMagnet === "off") return { time, price };

      const radius = activeMagnet === "weak" ? 6 : activeMagnet === "medium" ? 12 : 20;
      let best: { anchor: ProfessionalDrawingAnchor; distance: number } | null = null;
      for (const candle of candles) {
        const sourceTime = Math.floor(candle.timestamp / 1_000);
        const chartTime = eventChartTimeBySourceTimeRef.current.get(sourceTime) ?? sourceTime;
        const candidateX = chart.timeScale().timeToCoordinate(chartTime as Time);
        if (candidateX === null || Math.abs(candidateX - x) > radius) continue;
        for (const candidatePrice of [candle.open, candle.high, candle.low, candle.close]) {
          const candidateY = candleSeries.priceToCoordinate(candidatePrice);
          if (candidateY === null) continue;
          const distance = Math.hypot(candidateX - x, candidateY - y);
          if (distance <= radius && (!best || distance < best.distance)) {
            best = { anchor: { time: chartTime as Time, price: candidatePrice }, distance };
          }
        }
      }
      return best?.anchor ?? { time, price };
    };

    const isDrawingUiTarget = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      return Boolean(target?.closest("button,input,select,textarea,[role='menu'],[data-chart-drawing-ui]"));
    };

    const removeProfessionalPreview = () => {
      const preview = professionalDrawingPreviewRef.current;
      if (preview) drawingManager.removeDrawing(preview.id);
      professionalDrawingPreviewRef.current = null;
    };

    const handleProfessionalDrawingClick = (event: MouseEvent) => {
      if (isDrawingUiTarget(event)) return;
      const tool = selectedToolRef.current;
      if (tool === "brush") {
        if (professionalSuppressNextClickRef.current) professionalSuppressNextClickRef.current = false;
        return;
      }
      const point = drawingPointFromMouse(event);
      if (!point) return;
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pixelPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      if (tool === "eraser") {
        const hit = drawingManager.hitTest(pixelPoint);
        if (hit) drawingManager.removeDrawing(hit.id);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (!isProfessionalDrawingTool(tool)) return;
      event.preventDefault();
      event.stopPropagation();
      if (["text", "label", "rightPriceLabel", "leftPriceLabel"].includes(tool)) {
        setTextEditor({
          x: clamp(pixelPoint.x, 80, Math.max(80, rect.width - 260)),
          y: clamp(pixelPoint.y, 40, Math.max(40, rect.height - 150)),
          time: Number(point.time),
          price: point.price,
          value: "",
          tool,
        });
        return;
      }
      const pending = professionalPendingAnchorsRef.current;
      pending.push(point);
      const required = requiredProfessionalAnchors(tool);
      if (pending.length < required) {
        removeProfessionalPreview();
        const previewAnchors = [...pending];
        while (previewAnchors.length < required) previewAnchors.push({ ...point });
        const defaultTemplate = drawingTemplatesRef.current.find((template) =>
          template.isDefault && template.toolType === professionalDrawingType(tool));
        const preview = createProfessionalDrawing({
          tool,
          id: "__kwantdesk_drawing_preview__",
          anchors: previewAnchors,
          style: defaultTemplate?.style ?? drawingStyle,
          options: defaultTemplate ? { ...defaultTemplate.options, templateId: defaultTemplate.id } : undefined,
        });
        if (preview) {
          configureProfessionalDrawingMarketData(preview, drawingMarketDataSource);
          professionalDrawingPreviewRef.current = preview;
          drawingManager.addDrawing(preview);
        }
        return;
      }

      removeProfessionalPreview();
      const defaultTemplate = drawingTemplatesRef.current.find((template) =>
        template.isDefault && template.toolType === professionalDrawingType(tool));
      const drawing = createProfessionalDrawing({
        tool,
        id: createId("drawing"),
        anchors: pending.slice(0, required),
        style: defaultTemplate?.style ?? drawingStyle,
        options: defaultTemplate ? { ...defaultTemplate.options, templateId: defaultTemplate.id } : undefined,
      });
      professionalPendingAnchorsRef.current = [];
      if (drawing) {
        configureProfessionalDrawingMarketData(drawing, drawingMarketDataSource);
        drawingManager.addDrawing(drawing);
        drawingManager.selectDrawing(drawing.id);
      }
      if (!keepDrawingModeRef.current) setSelectedTool("cursor");
    };

    const handleProfessionalDrawingMove = (event: MouseEvent) => {
      const tool = selectedToolRef.current;
      const brush = professionalBrushDrawingRef.current;
      if (tool === "brush" && brush) {
        const point = drawingPointFromMouse(event);
        if (!point) return;
        const last = brush.anchors.at(-1);
        if (last && last.time === point.time && Math.abs(last.price - point.price) < priceFormat.minMove) return;
        brush.anchors = [...brush.anchors, point];
        return;
      }
      const preview = professionalDrawingPreviewRef.current;
      const pending = professionalPendingAnchorsRef.current;
      if (!preview || !pending.length || !isProfessionalDrawingTool(tool)) return;
      const point = drawingPointFromMouse(event);
      if (!point) return;
      const required = requiredProfessionalAnchors(tool);
      const updateIndex = Math.min(pending.length, required - 1);
      preview.updateAnchor(updateIndex, point);
    };

    const handleProfessionalDrawingPointerDown = (event: MouseEvent) => {
      const tool = selectedToolRef.current;
      if (isDrawingUiTarget(event) || (tool !== "eraser" && !isProfessionalDrawingTool(tool))) return;
      if (tool === "brush") {
        const point = drawingPointFromMouse(event);
        if (!point) return;
        const defaultTemplate = drawingTemplatesRef.current.find((template) =>
          template.isDefault && template.toolType === professionalDrawingType(tool));
        const brush = createProfessionalDrawing({
          tool,
          id: createId("drawing"),
          anchors: [point, { ...point }],
          style: defaultTemplate?.style ?? drawingStyle,
          options: defaultTemplate ? { ...defaultTemplate.options, templateId: defaultTemplate.id } : undefined,
        });
        if (brush) {
          drawingManager.addDrawing(brush);
          professionalBrushDrawingRef.current = brush;
          professionalSuppressNextClickRef.current = true;
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const handleProfessionalDrawingPointerUp = (event: MouseEvent) => {
      const brush = professionalBrushDrawingRef.current;
      if (!brush) return;
      const point = drawingPointFromMouse(event);
      if (point) brush.anchors = [...brush.anchors, point];
      professionalBrushDrawingRef.current = null;
      drawingManager.selectDrawing(brush.id);
      if (!keepDrawingModeRef.current) setSelectedTool("cursor");
      event.preventDefault();
      event.stopPropagation();
    };

    chartContainerRef.current.addEventListener("click", handleProfessionalDrawingClick, true);
    chartContainerRef.current.addEventListener("mousemove", handleProfessionalDrawingMove, true);
    chartContainerRef.current.addEventListener("mousedown", handleProfessionalDrawingPointerDown, true);
    window.addEventListener("mouseup", handleProfessionalDrawingPointerUp, true);
    lastRenderedCandleTimeRef.current = chartData.length
      ? Number(chartData[chartData.length - 1].time)
      : null;
    lastRenderedSourceTimestampRef.current = candles.at(-1)?.timestamp ?? null;
    applyMarkers(tradesRef.current);
    applyLevels(levelsRef.current);
    setTimeout(() => {
      if (tradesRef.current.length > 0) {
        applyMarkers(tradesRef.current);
      }
      if (levelsRef.current.length > 0) {
        applyLevels(levelsRef.current);
      }
    }, 100);
    resetViewportBeforeReveal(chart, candleSeries, chartData.length);
    prevCandlesLengthRef.current = candles.length;
    prevFirstTimestampRef.current = candles[0]?.timestamp ?? null;
    const lastCandle = candles[candles.length - 1];
    prevDataRef.current = lastCandle ? `${lastCandle.timestamp}-${lastCandle.close}` : "";

    const container = chartContainerRef.current;
    let mouseMoveFrame: number | null = null;
    let pendingMouseMove: { clientY: number; buttons: number } | null = null;
    let cachedContainerRect = container.getBoundingClientRect();
    const flushMouseMove = () => {
      mouseMoveFrame = null;
      const pending = pendingMouseMove;
      pendingMouseMove = null;
      if (!pending) return;
      const y = pending.clientY - cachedContainerRect.top;

      if (pending.buttons !== 0) scheduleViewportRefresh();

      if (horzLineRef.current) {
        horzLineRef.current.style.top = `${y}px`;
        horzLineRef.current.style.display = "block";
      }

      if (priceLabelRef.current) {
        const price = candleSeries.coordinateToPrice(y);
        if (price !== null) {
          priceLabelRef.current.style.top = `${y - 10}px`;
          priceLabelRef.current.style.display = "block";
          priceLabelRef.current.textContent = price.toFixed(priceFormat.precision);
        }
      }
    };
    const handleMouseMove = (event: MouseEvent) => {
      pendingMouseMove = { clientY: event.clientY, buttons: event.buttons };
      if (mouseMoveFrame === null) mouseMoveFrame = window.requestAnimationFrame(flushMouseMove);
    };

    const handleMouseLeave = () => {
      if (horzLineRef.current) horzLineRef.current.style.display = "none";
      if (priceLabelRef.current) priceLabelRef.current.style.display = "none";
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = chartContainerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let price = "";

      try {
        const priceValue = candleSeriesRef.current?.coordinateToPrice(y);
        price = priceValue ? priceValue.toFixed(priceFormat.precision) : "";
      } catch {
        price = "";
      }

      const tpoHit = tpoProfilePrimitiveRef.current?.profileHitTest(x, y);
      setContextMenu({
        x,
        y,
        price,
        tpoHit: tpoHit ? { instanceId: tpoHit.instanceId, profileId: tpoHit.profileId } : undefined,
      });
    };

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        cachedContainerRect = container.getBoundingClientRect();
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        chartRef.current.applyOptions({
          width,
          height,
        });
        setOverlaySize({ width, height });
        window.requestAnimationFrame(syncNativePriceScaleWidth);
      }
    };

    const commitViewportRefresh = () => {
      viewportRefreshTimerRef.current = null;
      viewportRefreshLastAtRef.current = performance.now();
      // Coordinate overlays are non-urgent visual work. A transition lets the
      // native canvas keep accepting pan/zoom input before React reconciles
      // footprint, CVD and optional exposure overlays.
      startTransition(() => {
        setViewportVersion((current) => current + 1);
      });
    };

    const scheduleViewportRefresh = () => {
      if (viewportFrameRef.current != null) return;
      viewportFrameRef.current = window.requestAnimationFrame(() => {
        viewportFrameRef.current = null;
        syncNativePriceScaleWidth();
        const elapsed = performance.now() - viewportRefreshLastAtRef.current;
        if (elapsed >= VIEWPORT_REACT_REFRESH_INTERVAL_MS) {
          if (viewportRefreshTimerRef.current !== null) {
            window.clearTimeout(viewportRefreshTimerRef.current);
            viewportRefreshTimerRef.current = null;
          }
          commitViewportRefresh();
          return;
        }
        // Keep one trailing refresh so all coordinate overlays finish exactly
        // on the viewport where the trader releases the mouse.
        if (viewportRefreshTimerRef.current === null) {
          viewportRefreshTimerRef.current = window.setTimeout(
            commitViewportRefresh,
            Math.max(0, VIEWPORT_REACT_REFRESH_INTERVAL_MS - elapsed),
          );
        }
      });
    };

    const handlePriceScaleWheel = (event: WheelEvent) => {
      const wheelTarget = event.target instanceof Element ? event.target : null;
      // Lower indicator panes own independent vertical scales. Their right
      // rail must never be treated as the main candle price rail.
      if (wheelTarget?.closest("[data-indicator-pane-wheel-zone]")) return;
      const containerRect = container.getBoundingClientRect();
      const priceScaleWidth = chart.priceScale("right").width();
      const localX = event.clientX - containerRect.left;
      const localY = event.clientY - containerRect.top;
      const isOverRightPriceScale =
        priceScaleWidth > 0
        && localX >= containerRect.width - priceScaleWidth
        && localX <= containerRect.width
        && localY >= 0
        && localY <= containerRect.height;

      if (!isOverRightPriceScale || event.deltaY === 0) return;

      const priceScaleCanvas = Array.from(container.querySelectorAll("canvas"))
        .reverse()
        .find((canvas) => {
          const rect = canvas.getBoundingClientRect();
          return (
            rect.width >= priceScaleWidth - 2
            && rect.width <= priceScaleWidth + 2
            && rect.height > containerRect.height * 0.5
            && event.clientX >= rect.left
            && event.clientX <= rect.right
            && event.clientY >= rect.top
            && event.clientY <= rect.bottom
          );
        });

      if (!priceScaleCanvas) return;

      event.preventDefault();
      event.stopPropagation();

      const axisRect = priceScaleCanvas.getBoundingClientRect();
      const wheelDelta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * axisRect.height
            : event.deltaY;
      const dragDistance =
        Math.sign(wheelDelta)
        * Math.max(6, Math.min(42, Math.abs(wheelDelta) * 0.18));
      const startY = Math.max(
        axisRect.top + 44,
        Math.min(axisRect.bottom - 44, event.clientY),
      );
      const endY = Math.max(
        axisRect.top + 2,
        Math.min(axisRect.bottom - 2, startY + dragDistance),
      );
      const axisX = Math.max(
        axisRect.left + 2,
        Math.min(axisRect.right - 2, event.clientX),
      );
      const eventInit = {
        bubbles: true,
        cancelable: true,
        clientX: axisX,
        button: 0,
        buttons: 1,
        view: window,
      };

      priceScaleCanvas.dispatchEvent(new MouseEvent("mousedown", {
        ...eventInit,
        clientY: startY,
      }));
      document.documentElement.dispatchEvent(new MouseEvent("mousemove", {
        ...eventInit,
        clientY: endY,
      }));
      document.documentElement.dispatchEvent(new MouseEvent("mouseup", {
        ...eventInit,
        buttons: 0,
        clientY: endY,
      }));
      scheduleViewportRefresh();
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("contextmenu", handleContextMenu);
    container.addEventListener("wheel", handlePriceScaleWheel, { capture: true, passive: false });
    window.addEventListener("resize", handleResize);
    chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleViewportRefresh);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      chartContainerRef.current?.removeEventListener("click", handleProfessionalDrawingClick, true);
      chartContainerRef.current?.removeEventListener("mousemove", handleProfessionalDrawingMove, true);
      chartContainerRef.current?.removeEventListener("mousedown", handleProfessionalDrawingPointerDown, true);
      window.removeEventListener("mouseup", handleProfessionalDrawingPointerUp, true);
      professionalBrushDrawingRef.current = null;
      removeProfessionalPreview();
      drawingUnsubscribers.forEach((unsubscribe) => unsubscribe());
      drawingManager.detach();
      if (professionalDrawingManagerRef.current === drawingManager) professionalDrawingManagerRef.current = null;
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("contextmenu", handleContextMenu);
      container.removeEventListener("wheel", handlePriceScaleWheel, { capture: true });
      window.removeEventListener("resize", handleResize);
      chart.unsubscribeCrosshairMove(handleNativeCrosshairMove);
      window.removeEventListener(CHART_CROSSHAIR_SYNC_MOVE_EVENT, handleSynchronizedCrosshair);
      if (crosshairDispatchFrame !== null) {
        window.cancelAnimationFrame(crosshairDispatchFrame);
        crosshairDispatchFrame = null;
      }
      if (synchronizedCrosshairReleaseFrame !== null) {
        window.cancelAnimationFrame(synchronizedCrosshairReleaseFrame);
        synchronizedCrosshairReleaseFrame = null;
      }
      pendingCrosshairMove = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleViewportRefresh);
      resizeObserver.disconnect();
      if (viewportFrameRef.current != null) {
        window.cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
      }
      if (viewportRefreshTimerRef.current !== null) {
        window.clearTimeout(viewportRefreshTimerRef.current);
        viewportRefreshTimerRef.current = null;
      }
      if (mouseMoveFrame !== null) {
        window.cancelAnimationFrame(mouseMoveFrame);
        mouseMoveFrame = null;
      }
      pendingMouseMove = null;
      if (viewportResetFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportResetFrameRef.current);
        viewportResetFrameRef.current = null;
      }
      chartVisualReadyTokenRef.current += 1;
      if (chartRef.current) {
        if (candleSeriesRef.current && gameplanUnderlayRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(gameplanUnderlayRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && fixedPriceLevelLabelsRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(fixedPriceLevelLabelsRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && volumeProfilePrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(volumeProfilePrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && sessionHighLowPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(sessionHighLowPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && sessionWindowPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(sessionWindowPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && hedgeLevelsPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(hedgeLevelsPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && classicGexProfilePrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(classicGexProfilePrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && gammaHeatmapPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(gammaHeatmapPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && netGammaExposurePrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(netGammaExposurePrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && darkPoolMapPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(darkPoolMapPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && bigTradesPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(bigTradesPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && bigBlocksPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(bigBlocksPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && smtDivergencePrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(smtDivergencePrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && footprintPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(footprintPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && paperFillMarkersPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(paperFillMarkersPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        if (candleSeriesRef.current && paperPositionOverlayPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(paperPositionOverlayPrimitiveRef.current);
          } catch {
            // Chart teardown can detach primitives before React cleanup runs.
          }
        }
        chartRef.current.remove();
        chartRef.current = null;
      }
      candleSeriesRef.current = null;
      gameplanUnderlayRef.current = null;
      fixedPriceLevelLabelsRef.current = null;
      sessionHighLowPrimitiveRef.current = null;
      sessionWindowPrimitiveRef.current = null;
      hedgeLevelsPrimitiveRef.current = null;
      classicGexProfilePrimitiveRef.current = null;
      gammaHeatmapPrimitiveRef.current = null;
      netGammaExposurePrimitiveRef.current = null;
      netGammaReservedRightOffsetRef.current = null;
      darkPoolMapPrimitiveRef.current = null;
      volumeProfilePrimitiveRef.current = null;
      bigTradesPrimitiveRef.current = null;
      bigBlocksPrimitiveRef.current = null;
      smtDivergencePrimitiveRef.current = null;
      footprintPrimitiveRef.current = null;
      paperFillMarkersPrimitiveRef.current = null;
      paperPositionOverlayPrimitiveRef.current = null;
      footprintActiveRef.current = false;
      footprintBarWidthRef.current = null;
      indicatorSeriesRefs.current = [];
      priceLinesRef.current = [];
      prevCandlesLengthRef.current = 0;
      prevFirstTimestampRef.current = null;
      prevDataRef.current = "";
      lastRenderedCandleTimeRef.current = null;
    };
  }, [chartInstanceId, crosshairSyncInstrumentKey, instrument, priceFormat, settings, themeVersion]);

  useEffect(() => {
    smtDivergencePrimitiveRef.current?.update(
      smtDivergenceEnabled ? smtDivergenceSignals : [],
      smtDivergencePrimitiveOptions,
    );
  }, [chartReadyRevision, smtDivergenceEnabled, smtDivergencePrimitiveOptions, smtDivergenceSignals]);

  useEffect(() => {
    const primitive = paperFillMarkersPrimitiveRef.current;
    if (!primitive) return;
    primitive.update(
      paperFills
        .filter((fill) => normalizePaperSymbol(fill.symbol) === normalizePaperSymbol(instrument))
        .map((fill) => {
          const timestamp = paperFillCandleTimestamp(candles, fill.timestamp);
          return timestamp === null
            ? null
            : {
                id: fill.id,
                time: timestamp as Time,
                price: fill.price,
                side: fill.side,
                role: fill.role,
              };
        })
        .filter((marker): marker is PaperFillMarkerRenderData => marker !== null),
    );
  }, [candles, instrument, paperFills]);

  useEffect(() => {
    const primitive = volumeProfilePrimitiveRef.current;
    if (!primitive) return;
    const dailyInstance = indicators.find((instance) =>
      instance.enabled
      && [
        "kwant-profile",
        "ask-bid-volume-profile",
        "delta-profile",
      ].includes(instance.indicatorId));
    const weeklyInstance = indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "weekly-volume-profile");
    const lastCandleTime = candles.length
      ? Math.floor(candles[candles.length - 1].timestamp / 1_000)
      : null;
    const intervalSeconds = candleIntervalMs ? candleIntervalMs / 1_000 : null;
    const models = volumeProfiles.flatMap((profile): NativeVolumeProfileModel[] => {
      const instance = profile.period === "weekly" ? weeklyInstance : dailyInstance;
      if (!instance || profile.period === "custom" || profile.levels.length === 0) return [];
      // No native volume-profile mode may render a candle-distributed proxy.
      // It has neither true traded-at-price volume nor aggressor-side delta.
      if (!isExecutionBackedVolumeProfile(profile)) return [];
      const profileSettings = instance.settings ?? {};
      const useThemeColors = profileSettings.useThemeColors !== false;
      const requestedSnapMode = (
        ["off", "left", "right"].includes(String(profileSettings.snapMode))
          ? String(profileSettings.snapMode)
          : profile.period === "weekly" ? "left" : "off"
      ) as "off" | "left" | "right";
      const requestedProfileMode = String(profileSettings.profileMode);
      const profileMode = (
        ["delta-volume", "bid-ask", "delta"].includes(requestedProfileMode)
          ? requestedProfileMode
          : "delta-volume"
      ) as "delta-volume" | "bid-ask" | "delta";
      return [{
        id: `${profile.root}:${profile.period}:${profile.startMs}`,
        profile,
        lastCandleTime,
        intervalSeconds,
        maxVolume: Math.max(1, ...profile.levels.map((level) => level.volume)),
        maxAbsDelta: Math.max(1, ...profile.levels.map((level) => Math.abs(level.delta))),
        lowPrice: profile.levels[0]?.price ?? Number.POSITIVE_INFINITY,
        highPrice: profile.levels[profile.levels.length - 1]?.price ?? Number.NEGATIVE_INFINITY,
        style: {
          mode: profileMode,
          widthBasis: "chart",
          widthPercent: clamp(Number(profileSettings.profileWidth ?? (profile.period === "weekly" ? 18 : 9)), 0, 100),
          opacity: clamp(Number(profileSettings.opacity ?? (profile.period === "weekly" ? 42 : 68)) / 100, 0.1, 1),
          positiveDeltaColor: useThemeColors ? settings.upColor : String(profileSettings.askColor ?? settings.upColor),
          negativeDeltaColor: useThemeColors ? settings.downColor : String(profileSettings.bidColor ?? settings.downColor),
          outsideValueAreaColor: useThemeColors ? settings.borderDownColor : String(profileSettings.volumeColor ?? settings.borderDownColor),
          valueAreaColor: useThemeColors ? settings.borderUpColor : String(profileSettings.valueAreaColor ?? settings.borderUpColor),
          pocColor: useThemeColors ? settings.upColor : String(profileSettings.pocColor ?? settings.upColor),
          showValueArea: profileSettings.showValueArea !== false,
          showDelta: profileSettings.showDelta !== false,
          showProfileSpine: profileSettings.showProfileSpine !== false,
          showPocLine: profileSettings.showPocLine !== false,
          showValueAreaLines: profileSettings.showValueAreaLines !== false,
          showText: profileSettings.showText === true,
          showPocHighlight: profileSettings.showPocHighlight !== false,
          showProfileOutline: profileSettings.showProfileOutline !== false,
          automaticGrouping: profileSettings.groupingMode !== "manual",
          autoGroupFactor: clamp(Number(profileSettings.autoGroupFactor ?? 1), 0.5, 4),
          valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
          snapMode: requestedSnapMode,
        },
      }];
    });
    primitive.setModels(models);
  }, [
    candleIntervalMs,
    candles,
    chartReadyRevision,
    indicatorSignature,
    indicators,
    settings.borderDownColor,
    settings.borderUpColor,
    settings.downColor,
    settings.upColor,
    volumeProfiles,
  ]);

  useEffect(() => {
    const primitive = tpoProfilePrimitiveRef.current;
    if (!primitive) return;
    const instances = indicators.filter((instance) =>
      instance.enabled && (instance.indicatorId === "tpo-chart" || instance.indicatorId === "weekly-tpo"));
    if (!instances.length) {
      primitive.setModels([]);
      setTpoDataStatus(null);
      return;
    }
    const sourceTrades = tpoSourceTrades;
    const sourceBars = tpoSourceBars;
    const requestsExactTrades = instances.some((instance) => instance.settings?.visitSource === "exact-trades");
    if (!sourceTrades.length && requestsExactTrades) {
      primitive.setModels([]);
      setTpoDataStatus("TPO · WAITING FOR EXACT EXECUTIONS");
      return;
    }
    if (!sourceTrades.length && !sourceBars.length) {
      primitive.setModels([]);
      setTpoDataStatus("TPO · WAITING FOR MARKET DATA");
      return;
    }
    const themeStyles = getComputedStyle(document.documentElement);
    const theme = {
      background: settings.backgroundColor,
      foreground: themeStyles.getPropertyValue("--foreground").trim() || "#F5F7FA",
      muted: themeStyles.getPropertyValue("--muted").trim() || "#7F8DA1",
      profile: themeStyles.getPropertyValue("--primary").trim() || settings.upColor,
      bullish: settings.upColor,
      bearish: settings.downColor,
      poc: themeStyles.getPropertyValue("--warning").trim() || "#F5B83B",
      valueArea: settings.borderUpColor,
      singlePrint: settings.downColor,
      peak: settings.upColor,
      valley: themeStyles.getPropertyValue("--secondary").trim() || "#8B5CF6",
      selection: themeStyles.getPropertyValue("--primary").trim() || settings.upColor,
    };
    const lastCandleTime = sourceBars.length
      ? Math.floor(sourceBars.at(-1)!.startTimeMs / 1_000)
      : null;
    const intervalSeconds = candleIntervalMs ? candleIntervalMs / 1_000 : null;
    const settledInstances = new Map(settledTpoIndicators.map((instance) => [instance.instanceId, instance]));
    const activeInstanceIds = new Set(instances.map((instance) => instance.instanceId));
    for (const cachedInstanceId of tpoProfileCacheRef.current.keys()) {
      if (!activeInstanceIds.has(cachedInstanceId)) tpoProfileCacheRef.current.delete(cachedInstanceId);
    }
    const baseModels = instances.flatMap((instance): TpoPrimitiveModel[] => {
      const variant = instance.indicatorId === "weekly-tpo" ? "weekly-tpo" : "daily-tpo";
      const renderSettings = validateTpoSettings(instance.settings, variant, settings);
      const calculationSource = settledInstances.get(instance.instanceId) ?? instance;
      const calculationSettings = validateTpoSettings(calculationSource.settings, variant);
      const calculationKey = tpoCalculationSettingsKey(calculationSettings);
      const cached = tpoProfileCacheRef.current.get(instance.instanceId);
      const profiles = cached
        && cached.trades === sourceTrades
        && cached.bars === sourceBars
        && cached.calculationKey === calculationKey
        ? cached.profiles
        : buildTpoProfiles({ trades: sourceTrades, bars: sourceBars, settings: calculationSettings });
      if (profiles !== cached?.profiles) {
        tpoProfileCacheRef.current.set(instance.instanceId, {
          trades: sourceTrades,
          bars: sourceBars,
          calculationKey,
          profiles,
        });
      }
      return profiles.map((profile) => ({
        instanceId: instance.instanceId,
        profile,
        settings: renderSettings,
        theme,
        lastCandleTime,
        intervalSeconds,
      }));
    });
    tpoBaseModelsRef.current = baseModels;
    const hiddenProfileIds = new Set<string>();
    const compositeModels: TpoPrimitiveModel[] = [];
    tpoMergeRecords.forEach((record) => {
      const members = record.memberProfileIds
        .map((profileId) => baseModels.find((model) =>
          model.instanceId === record.indicatorInstanceId && model.profile.id === profileId))
        .filter((model): model is TpoPrimitiveModel => Boolean(model))
        .sort((left, right) => left.profile.startTimeMs - right.profile.startTimeMs);
      if (members.length < 2) return;
      const anchor = members.find((model) => model.profile.id === record.anchorProfileId) ?? members.at(-1)!;
      const first = members[0].profile;
      const last = members.at(-1)!.profile;
      const compositeSettings = {
        ...anchor.settings,
        scheduleKind: "custom-range" as const,
        periodMode: "custom-range" as const,
        customStartMs: first.startTimeMs,
        customEndMs: last.endTimeMs,
        customEndFollowsLatest: last.developing,
        profileCount: 1,
      };
      const rebuilt = buildTpoProfiles({
        trades: sourceTrades,
        bars: sourceBars,
        settings: compositeSettings,
      })[0];
      if (!rebuilt) return;
      record.memberProfileIds.forEach((profileId) => hiddenProfileIds.add(`${record.indicatorInstanceId}:${profileId}`));
      compositeModels.push({
        ...anchor,
        settings: compositeSettings,
        profile: {
          ...rebuilt,
          id: `composite:${record.id}`,
          memberProfileIds: record.memberProfileIds,
          anchorProfileId: record.anchorProfileId,
        },
      });
    });
    const models = [...baseModels.filter((model) =>
      !hiddenProfileIds.has(`${model.instanceId}:${model.profile.id}`)), ...compositeModels]
      .map((model) => ({
        ...model,
        selected: tpoMergeSelection?.instanceId === model.instanceId
          && tpoMergeSelection.anchorProfileId === model.profile.id,
        mergeEligible: Boolean(tpoMergeSelection)
          && tpoMergeSelection?.instanceId === model.instanceId
          && !model.profile.id.startsWith("composite:"),
      }));
    primitive.setModels(models);
    setTpoDataStatus(models.length ? null : "TPO · NO PROFILE IN THE SELECTED RANGE");
  }, [
    candleIntervalMs,
    chartReadyRevision,
    indicators,
    instrument,
    settledTpoIndicators,
    settings,
    themeVersion,
    tpoSourceBars,
    tpoSourceTrades,
    tpoMergeRecords,
    tpoMergeSelection,
  ]);

  useEffect(() => {
    if (!tpoMergeSelection) return;
    const container = chartContainerRef.current;
    if (!container) return;
    const completeMerge = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const hit = tpoProfilePrimitiveRef.current?.profileHitTest(
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      if (!hit || hit.instanceId !== tpoMergeSelection.instanceId) return;
      const candidates = tpoBaseModelsRef.current
        .filter((model) => model.instanceId === hit.instanceId && !model.profile.id.startsWith("composite:"))
        .sort((left, right) => left.profile.startTimeMs - right.profile.startTimeMs);
      const anchorIndex = candidates.findIndex((model) => model.profile.id === tpoMergeSelection.anchorProfileId);
      const targetIndex = candidates.findIndex((model) => model.profile.id === hit.profileId);
      if (anchorIndex < 0 || targetIndex < 0 || anchorIndex === targetIndex) return;
      const from = Math.min(anchorIndex, targetIndex);
      const to = Math.max(anchorIndex, targetIndex);
      const anchor = candidates[anchorIndex];
      const members = candidates.slice(from, to + 1);
      if (members.length > anchor.settings.maximumMergeMembers) return;
      const now = Date.now();
      setTpoMergeRecords((current) => [...current, {
        id: `${hit.instanceId}:${now}`,
        indicatorInstanceId: hit.instanceId,
        instrumentId: instrument,
        anchorProfileId: anchor.profile.id,
        memberProfileIds: members.map((model) => model.profile.id),
        createdAtMs: now,
        visualAnchor: {
          anchorTimeMs: anchor.profile.startTimeMs,
          side: anchor.settings.showOnRight ? "right" : "left",
          widthMode: anchor.settings.widthMode,
          widthValue: anchor.settings.currentWidth,
          offsetValue: anchor.settings.currentOffset,
        },
        markerSequenceMode: "continuous",
        groupingMode: "recalculate-from-source",
      }]);
      setTpoMergeSelection(null);
      event.preventDefault();
      event.stopPropagation();
    };
    container.addEventListener("click", completeMerge, true);
    return () => container.removeEventListener("click", completeMerge, true);
  }, [instrument, tpoMergeSelection]);

  useEffect(() => {
    if (!tpoMergeSelection) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTpoMergeSelection(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [tpoMergeSelection]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const overlayDefinitions = calculatedIndicatorSeries.filter(
      (definition) => definition.placement === "overlay",
    );
    const nextKeys = new Set(overlayDefinitions.map((definition) => definition.key));
    const reusable = new Map(indicatorSeriesRefs.current.map((entry) => [entry.key, entry]));

    indicatorSeriesRefs.current.forEach((entry) => {
      const definition = overlayDefinitions.find((candidate) => candidate.key === entry.key);
      const expectedKind = definition?.kind === "histogram" ? "histogram" : "line";
      if (nextKeys.has(entry.key) && entry.kind === expectedKind) return;
      try {
        chart.removeSeries(entry.series as never);
      } catch {
        // Chart recreation may dispose its studies before this effect runs.
      }
      reusable.delete(entry.key);
    });

    indicatorSeriesRefs.current = overlayDefinitions.map((definition) => {
      const kind = definition.kind === "histogram" ? "histogram" : "line";
      const existing = reusable.get(definition.key);
      const options = kind === "histogram"
        ? {
            color: definition.color,
            lastValueVisible: false,
            priceLineVisible: false,
          }
        : {
            color: definition.color,
            lineWidth: definition.lineWidth ?? 2,
            lineStyle: definition.lineStyle === "dashed"
              ? LineStyle.Dashed
              : definition.lineStyle === "dotted"
                ? LineStyle.Dotted
                : LineStyle.Solid,
            lastValueVisible: definition.lastValueVisible !== false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          };
      if (existing && existing.kind === kind) {
        existing.series.applyOptions(options);
        existing.series.setData(lightweightIndicatorData(definition));
        return existing;
      }
      const series = kind === "histogram"
        ? chart.addHistogramSeries({
            ...options,
            priceScaleId: "right",
            priceFormat: { type: "volume" },
          })
        : chart.addLineSeries({
            ...options,
            priceScaleId: "right",
          });
      series.setData(lightweightIndicatorData(definition));
      return {
        key: definition.key,
        kind,
        series: series as unknown as {
          setData: (data: any[]) => void;
          applyOptions: (options: Record<string, unknown>) => void;
        },
      };
    });
  }, [calculatedIndicatorSeries, chartReadyRevision]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const paneRatio = overlaySize.height > 0 ? indicatorPaneHeight / overlaySize.height : 0;
    const topPaneRatio = overlaySize.height > 0 ? topIndicatorPaneHeight / overlaySize.height : 0;
    const desiredTopMargin = topIndicatorPaneHeight > 0 ? Math.min(0.72, 0.04 + topPaneRatio) : 0.08;
    const desiredBottomMargin = indicatorPaneHeight > 0 ? Math.min(0.72, 0.04 + paneRatio) : 0.08;
    const marginScale = desiredTopMargin + desiredBottomMargin > 0.9
      ? 0.9 / (desiredTopMargin + desiredBottomMargin)
      : 1;
    series.priceScale().applyOptions({
      scaleMargins: {
        top: desiredTopMargin * marginScale,
        bottom: desiredBottomMargin * marginScale,
      },
    });
  }, [chartReadyRevision, indicatorPaneHeight, overlaySize.height, topIndicatorPaneHeight]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingContext =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable;

      if (
        keyboardActive
        && !isTypingContext
        && event.key === "End"
        && activeChartKeyboardTargetId === chartInstanceId
      ) {
        event.preventDefault();
        returnToLiveViewport();
        return;
      }

      const commandKey = event.ctrlKey || event.metaKey;
      if (!isTypingContext && commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoProfessionalDrawing();
        else undoProfessionalDrawing();
        return;
      }
      if (!isTypingContext && commandKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoProfessionalDrawing();
        return;
      }
      if (!isTypingContext && commandKey && event.key.toLowerCase() === "c") {
        copySelectedProfessionalDrawing();
        return;
      }
      if (!isTypingContext && commandKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteProfessionalDrawing();
        return;
      }
      if (!isTypingContext && commandKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedProfessionalDrawing();
        return;
      }

      if (event.key === "Escape") {
        const manager = professionalDrawingManagerRef.current;
        if (professionalDrawingPreviewRef.current && manager) {
          manager.removeDrawing(professionalDrawingPreviewRef.current.id);
        }
        professionalDrawingPreviewRef.current = null;
        professionalPendingAnchorsRef.current = [];
        manager?.deselectAll();
        setSelectedTool("cursor");
        setContextMenu(null);
        setOpenToolbarGroup(null);
        setDraftDrawing(null);
        setTextEditor(null);
        setDrawingInteraction(null);
        setSelectedDrawingId(null);
        setPositionSettingsDrawingId(null);
      }
      if (!isTypingContext && event.key === "Backspace" && professionalPendingAnchorsRef.current.length > 0) {
        event.preventDefault();
        professionalPendingAnchorsRef.current.pop();
        const manager = professionalDrawingManagerRef.current;
        if (professionalDrawingPreviewRef.current && manager) {
          manager.removeDrawing(professionalDrawingPreviewRef.current.id);
          professionalDrawingPreviewRef.current = null;
        }
        return;
      }
      if (!isTypingContext && (event.key === "Delete" || event.key === "Backspace")) {
        const manager = professionalDrawingManagerRef.current;
        const selected = manager?.getSelectedDrawings() ?? [];
        if (selected.length > 0) {
          event.preventDefault();
          selected.forEach((drawing) => manager?.removeDrawing(drawing.id));
          return;
        }
      }
      if (!isTypingContext && (event.key === "Delete" || event.key === "Backspace") && selectedDrawingId) {
        event.preventDefault();
        removeDrawing(selectedDrawingId);
        return;
      }
      if (!isTypingContext && (event.key === "Delete" || event.key === "Backspace") && showObjectsPanel && drawings.length > 0) {
        event.preventDefault();
        setDrawings((current) => current.slice(0, -1));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [chartInstanceId, drawingHistoryRevision, drawings.length, keyboardActive, returnToLiveViewport, selectedDrawingId, showObjectsPanel]);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current?.contains(target)) return;
      setContextMenu(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!selectedDrawingId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-position-drawing-id]")) return;
      if (target.closest("[data-position-settings-panel]")) return;
      setSelectedDrawingId(null);
      setPositionSettingsDrawingId(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [selectedDrawingId]);

  const favoriteTools = useMemo(
    () =>
      favoriteToolIds
        .map((id) => ALL_DRAWING_TOOLS.find((tool) => tool.id === id))
        .filter((tool): tool is ToolbarTool => Boolean(tool)),
    [favoriteToolIds],
  );
  const selectedProfessionalDrawing = professionalDrawings.find((drawing) => drawing.id === selectedProfessionalDrawingId) ?? null;
  const toolbarGroups = useMemo(
    () => [
      {
        id: "favorites" as const,
        label: "Favourite Tools",
        icon: Star,
        tools: favoriteTools,
        isActive: favoriteToolIds.includes(selectedTool),
      },
      ...ACTIVE_DRAWING_TOOLBAR_GROUPS.map((group) => ({
        ...group,
        isActive: activeToolbarTool?.groupId === group.id,
      })),
    ],
    [activeToolbarTool, favoriteToolIds, favoriteTools, selectedTool],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = toolbarDragStateRef.current;
      const container = chartContainerRef.current;
      if (!drag || !container) return;
      const movedX = event.clientX - drag.startClientX;
      const movedY = event.clientY - drag.startClientY;
      if (!drag.hasMoved && Math.hypot(movedX, movedY) < 4) return;
      if (!drag.hasMoved) {
        drag.hasMoved = true;
        toolbarToggleSuppressedRef.current = true;
      }
      const rect = container.getBoundingClientRect();
      setToolbarDragPosition({
        x: event.clientX - rect.left - drag.offsetX,
        y: event.clientY - rect.top - drag.offsetY,
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = toolbarDragStateRef.current;
      const container = chartContainerRef.current;
      if (!drag || !container) return;
      if (!drag.hasMoved) {
        toolbarDragStateRef.current = null;
        setToolbarDragPosition(null);
        return;
      }
      const rect = container.getBoundingClientRect();
      const distances: Record<ToolbarDock, number> = {
        left: Math.abs(event.clientX - rect.left),
        right: Math.abs(rect.right - event.clientX),
        top: Math.abs(event.clientY - rect.top),
        bottom: Math.abs(rect.bottom - event.clientY),
      };
      const nextDock = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "left") as ToolbarDock;
      toolbarDragStateRef.current = null;
      setToolbarDragPosition(null);
      setToolbarDock(nextDock);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const rightAlignedZoneLabelYs = new Map<string, number>();
  const rightAlignedZoneLabels = zones
    .filter((zone) => zone.labelAlign === "right")
    .map((zone) => {
      const highY = priceToY(zone.high);
      const lowY = priceToY(zone.low);
      if (highY == null || lowY == null) return null;
      const naturalY = (highY + lowY) / 2;
      return {
        id: zone.id,
        naturalY,
      };
    })
    .filter((item): item is { id: string; naturalY: number } => item !== null)
    .sort((a, b) => a.naturalY - b.naturalY);

  if (rightAlignedZoneLabels.length > 0) {
    const minY = 14;
    // Reserve the lower status rail so the final cage caption cannot collide
    // with freshness/source badges on compact Levelz charts.
    const maxY = Math.max(minY, overlaySize.height - 36);
    const gap = rightAlignedZoneLabels.length > 1
      ? Math.min(24, (maxY - minY) / (rightAlignedZoneLabels.length - 1))
      : 0;
    const laidOut = rightAlignedZoneLabels
      .filter((item) => item.naturalY >= minY && item.naturalY <= maxY)
      .map((item) => ({
      ...item,
      y: item.naturalY,
    }));

    for (let index = 1; index < laidOut.length; index += 1) {
      laidOut[index].y = Math.max(laidOut[index].y, laidOut[index - 1].y + gap);
    }
    if (laidOut.at(-1)!.y > maxY) {
      laidOut[laidOut.length - 1].y = maxY;
      for (let index = laidOut.length - 2; index >= 0; index -= 1) {
        laidOut[index].y = Math.min(laidOut[index].y, laidOut[index + 1].y - gap);
      }
    }
    for (const item of laidOut) rightAlignedZoneLabelYs.set(item.id, item.y);
  }

  const flowVerdictY = gexBotFlow?.status === "LIVE" && gexBotFlow.sponsorship.active
    ? candleSeriesRef.current?.priceToCoordinate(candles.at(-1)?.close ?? gexBotFlow.sample?.spot ?? 0) ?? null
    : null;

  const precisionTheme = useMemo<PrecisionTheme>(() => ({
    background: settings.backgroundColor,
    panel: "#090f17",
    surface: "#111b29",
    border: "#304158",
    foreground: "#e7edf5",
    muted: "#7f8da1",
    primary: settings.upColor,
    bullish: settings.upColor,
    bearish: settings.downColor,
  }), [settings.backgroundColor, settings.downColor, settings.upColor]);

  // xToTime is a local chart-coordinate adapter whose closure is intentionally
  // refreshed by the concrete market/viewport dependencies below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const precisionAdapter = useMemo<PrecisionChartAdapter>(() => {
    const contract = paperContractSpec(contractSymbol ?? instrument);
    return {
      width: overlaySize.width,
      height: overlaySize.height,
      priceScaleWidth: nativePriceScaleWidth,
      timeScaleHeight: 24 + indicatorPaneHeight,
      minMove: priceFormat.minMove,
      precision: priceFormat.precision,
      pointValue: contract.pointValue,
      instrument,
      timeframe: timeframe ?? "1m",
      pixelsPerBar: (() => {
        const logicalRange = chartRef.current?.timeScale().getVisibleLogicalRange();
        if (!logicalRange || logicalRange.to <= logicalRange.from) return 0;
        return Math.max(0, (overlaySize.width - nativePriceScaleWidth) / (logicalRange.to - logicalRange.from));
      })(),
      candles,
      trades: marketTrades,
      timeToX: (timeMs, logicalIndex) => {
        const timeScale = chartRef.current?.timeScale();
        if (!timeScale) return null;
        const direct = timeScale.timeToCoordinate(Math.floor(timeMs / 1_000) as Time);
        if (direct != null) return direct;
        if (logicalIndex == null || !Number.isFinite(logicalIndex)) return null;
        return timeScale.logicalToCoordinate(logicalIndex as never);
      },
      xToAnchor: (x, y) => {
        const timeScale = chartRef.current?.timeScale();
        const series = candleSeriesRef.current;
        if (!timeScale || !series) return null;
        const seconds = xToTime(x);
        const logical = timeScale.coordinateToLogical(x);
        const price = series.coordinateToPrice(y);
        if (seconds == null || logical == null || price == null) return null;
        return { time: seconds * 1_000, logicalIndex: Number(logical), price };
      },
      priceToY: (price) => candleSeriesRef.current?.priceToCoordinate(price) ?? null,
      yToPrice: (y) => candleSeriesRef.current?.coordinateToPrice(y) ?? null,
      setVisibleTimeRange: (startMs, endMs) => chartRef.current?.timeScale().setVisibleRange({
        from: Math.floor(Math.min(startMs, endMs) / 1_000) as Time,
        to: Math.floor(Math.max(startMs, endMs) / 1_000) as Time,
      }),
      requestChartRender: () => setViewportVersion((current) => current + 1),
    };
  }, [candles, candleIntervalMs, contractSymbol, indicatorPaneHeight, instrument, marketTrades, nativePriceScaleWidth, overlaySize.height, overlaySize.width, priceFormat.minMove, priceFormat.precision, timeframe, viewportVersion]);

  const selectProfessionalDrawingInScreenBox = useCallback((bounds: { left: number; right: number; top: number; bottom: number }) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const manager = professionalDrawingManagerRef.current;
    if (!chart || !series || !manager) return false;

    const selected = [...professionalDrawings]
      .sort((a, b) => (b.options.zIndex ?? 0) - (a.options.zIndex ?? 0))
      .find((drawing) => {
        if (drawing.options.visible === false || drawing.options.locked === true) return false;
        const points = drawing.anchors.flatMap((anchor) => {
          if (typeof anchor.time !== "number") return [];
          const x = chart.timeScale().timeToCoordinate(anchor.time as Time);
          const y = series.priceToCoordinate(anchor.price);
          return x == null || y == null ? [] : [{ x, y }];
        });
        if (!points.length) return false;
        if (points.some((point) => point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom)) return true;
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        return Math.max(...xs) >= bounds.left
          && Math.min(...xs) <= bounds.right
          && Math.max(...ys) >= bounds.top
          && Math.min(...ys) <= bounds.bottom;
      });

    if (!selected) return false;
    manager.selectDrawing(selected.id);
    setSelectedProfessionalDrawingId(selected.id);
    setSelectedTool("cursor");
    return true;
  }, [professionalDrawings]);

  const visiblePaperPositions = paperPositions.filter((position) =>
    position.status === "open"
    && position.remainingQuantity > 0
    && normalizePaperSymbol(position.symbol) === normalizePaperSymbol(instrument));
  const formatPaperMoney = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
  const paperMarkPrice = candles.at(-1)?.close ?? null;
  const paperOverlayLevels = visiblePaperPositions.flatMap((position) => {
    const livePositionPnl = paperMarkPrice === null
      ? position.unrealizedPnl
      : paperProjectedPnl(
          position.symbol,
          position.side,
          position.entryPrice,
          paperMarkPrice,
          position.remainingQuantity,
        );
    const entry = [{
      id: `${position.id}-entry`,
      kind: "entry" as const,
      price: position.entryPrice,
      label: `${paperPositionSizeLabel(position.side, position.remainingQuantity)} · ${formatPaperMoney(livePositionPnl)}`,
      color: position.side === "buy" ? settings.upColor : settings.downColor,
      position,
      targetId: null as string | null,
    }];
    const stop = position.stopLoss === null ? [] : [{
      id: `${position.id}-sl`,
      kind: "stop_loss" as const,
      price: position.stopLoss,
      label: `SL · ${paperProtectionSizeLabel(position.side, position.remainingQuantity)} · ${position.stopLoss.toFixed(priceFormat.precision)} · ${formatPaperMoney(paperProjectedPnl(
        position.symbol,
        position.side,
        position.entryPrice,
        position.stopLoss,
        position.remainingQuantity,
      ))}`,
      color: settings.downColor,
      position,
      targetId: null as string | null,
    }];
    const targets = position.takeProfits
      .filter((target) => target.quantity > target.filledQuantity)
      .map((target, index) => ({
        id: `${position.id}-${target.id}`,
        kind: "take_profit" as const,
        price: target.price,
        label: `TP${position.takeProfits.length > 1 ? index + 1 : ""} · ${paperProtectionSizeLabel(position.side, target.quantity - target.filledQuantity)} · ${target.price.toFixed(priceFormat.precision)} · ${formatPaperMoney(paperProjectedPnl(
          position.symbol,
          position.side,
          position.entryPrice,
          target.price,
          target.quantity - target.filledQuantity,
        ))}`,
        color: settings.upColor,
        position,
        targetId: target.id,
      }));
    return [...entry, ...stop, ...targets];
  }).map((level) => {
    const displayPrice = paperDragPreview?.id === level.id ? paperDragPreview.price : level.price;
    const protectedQuantity = level.kind === "take_profit" && level.targetId
      ? (() => {
          const target = level.position.takeProfits.find((candidate) => candidate.id === level.targetId);
          return target ? Math.max(0, target.quantity - target.filledQuantity) : level.position.remainingQuantity;
        })()
      : level.position.remainingQuantity;
    const projectedPnl = level.kind === "entry"
      ? (paperMarkPrice === null
          ? level.position.unrealizedPnl
          : paperProjectedPnl(
              level.position.symbol,
              level.position.side,
              level.position.entryPrice,
              paperMarkPrice,
              level.position.remainingQuantity,
            ))
      : paperProjectedPnl(
          level.position.symbol,
          level.position.side,
          level.position.entryPrice,
          displayPrice,
          protectedQuantity,
        );
    return {
    ...level,
    price: displayPrice,
    label: paperDragPreview?.id === level.id
      ? `${level.kind === "stop_loss" ? "SL" : "TP"} · ${paperProtectionSizeLabel(level.position.side, protectedQuantity)} · ${displayPrice.toFixed(priceFormat.precision)} · ${formatPaperMoney(projectedPnl)}`
      : level.label,
    y: candleSeriesRef.current?.priceToCoordinate(displayPrice) ?? null,
    };
  }).filter((level): level is typeof level & { y: number } => Number.isFinite(level.y));
  const paperDraftOverlayLevel = paperDraftProtection
    ? (() => {
        const y = candleSeriesRef.current?.priceToCoordinate(paperDraftProtection.price) ?? null;
        if (y === null || !Number.isFinite(y)) return null;
        const projectedPnl = paperProjectedPnl(
          paperDraftProtection.position.symbol,
          paperDraftProtection.position.side,
          paperDraftProtection.position.entryPrice,
          paperDraftProtection.price,
          paperDraftProtection.position.remainingQuantity,
        );
        return {
          ...paperDraftProtection,
          y,
          color: paperDraftProtection.kind === "stop_loss" ? settings.downColor : settings.upColor,
          label: `${paperDraftProtection.kind === "stop_loss" ? "SL" : "TP"} · ${paperProtectionSizeLabel(paperDraftProtection.position.side, paperDraftProtection.position.remainingQuantity)} · ${paperDraftProtection.price.toFixed(priceFormat.precision)} · ${formatPaperMoney(projectedPnl)}`,
        };
      })()
    : null;
  useEffect(() => {
    const primitive = paperPositionOverlayPrimitiveRef.current;
    if (!primitive) return;
    const levels: PaperPositionOverlayRenderLevel[] = paperOverlayLevels.map((level) => ({
      id: level.id,
      price: level.price,
      label: level.label,
      color: level.color,
      kind: level.kind,
      showStopHandle: level.kind === "entry" && Boolean(onUpdatePaperProtection) && level.position.stopLoss === null,
      showTakeProfitHandle: level.kind === "entry"
        && Boolean(onUpdatePaperProtection)
        && !level.position.takeProfits.some((target) => target.quantity > target.filledQuantity),
      showClose: level.kind === "entry"
        ? Boolean(onClosePaperPosition)
        : Boolean(onUpdatePaperProtection),
      stopColor: settings.downColor,
      takeProfitColor: settings.upColor,
      livePosition: level.kind === "entry" ? {
        symbol: level.position.symbol,
        side: level.position.side,
        quantity: level.position.remainingQuantity,
        entryPrice: level.position.entryPrice,
      } : undefined,
    }));
    if (paperDraftOverlayLevel) {
      levels.push({
        id: paperDraftOverlayLevel.id,
        price: paperDraftOverlayLevel.price,
        label: paperDraftOverlayLevel.label,
        color: paperDraftOverlayLevel.color,
        kind: paperDraftOverlayLevel.kind,
      });
    }
    primitive.update(levels, settings.backgroundColor);
    const latestMark = latestCandleRef.current?.close ?? candles.at(-1)?.close;
    if (latestMark) primitive.updateMarkPrice(latestMark);
  }, [candles, onClosePaperPosition, onUpdatePaperProtection, paperDraftOverlayLevel, paperOverlayLevels, settings.backgroundColor, settings.downColor, settings.upColor]);
  const matchingPaperFills = paperFills
    .filter((fill) => normalizePaperSymbol(fill.symbol) === normalizePaperSymbol(instrument));
  const constrainedPaperProtectionPrice = (
    position: PaperPosition,
    _kind: "stop_loss" | "take_profit",
    rawPrice: number,
  ) => {
    const snapped = snapPaperPrice(position.symbol, rawPrice);
    return snapped > 0 ? snapped : snapPaperPrice(position.symbol, position.entryPrice);
  };

  const startPaperProtectionDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    level: (typeof paperOverlayLevels)[number],
  ) => {
    if (level.kind === "entry" || !onUpdatePaperProtection) return;
    const protectionKind = level.kind;
    event.preventDefault();
    event.stopPropagation();
    const container = chartContainerRef.current;
    const series = candleSeriesRef.current;
    if (!container || !series) return;
    const pointerId = event.pointerId;
    onPaperProtectionDragStateChange?.(level.position.id, true);
    let latestPrice = level.price;
    let pendingClientY = event.clientY;
    let animationFrame: number | null = null;
    const updatePreview = (clientY: number) => {
      const bounds = container.getBoundingClientRect();
      const price = series.coordinateToPrice(clientY - bounds.top);
      if (price === null || !Number.isFinite(price)) return;
      latestPrice = constrainedPaperProtectionPrice(level.position, protectionKind, price);
      setPaperDragPreview({ id: level.id, price: latestPrice });
    };
    const flushPreview = () => {
      animationFrame = null;
      updatePreview(pendingClientY);
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      pendingClientY = moveEvent.clientY;
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(flushPreview);
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleCancel);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      setPaperDragPreview(null);
    };
    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      pendingClientY = upEvent.clientY;
      updatePreview(upEvent.clientY);
      cleanup();
      if (level.kind === "stop_loss") {
        onUpdatePaperProtection(level.position.accountId, level.position.id, { kind: "stop_loss", price: latestPrice });
      } else if (level.targetId) {
        onUpdatePaperProtection(level.position.accountId, level.position.id, {
          kind: "take_profit",
          targetId: level.targetId,
          price: latestPrice,
        });
      }
      onPaperProtectionDragStateChange?.(level.position.id, false);
    };
    const handleCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanup();
      onPaperProtectionDragStateChange?.(level.position.id, false);
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleCancel);
  };

  const startNewPaperProtectionDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    position: PaperPosition,
    kind: "stop_loss" | "take_profit",
  ) => {
    if (!onUpdatePaperProtection) return;
    event.preventDefault();
    event.stopPropagation();
    const container = chartContainerRef.current;
    const series = candleSeriesRef.current;
    if (!container || !series) return;

    const pointerId = event.pointerId;
    onPaperProtectionDragStateChange?.(position.id, true);
    const draftId = `${position.id}-new-${kind}`;
    let latestPrice = constrainedPaperProtectionPrice(position, kind, position.entryPrice);
    let pendingClientY = event.clientY;
    let animationFrame: number | null = null;
    const updatePreview = (clientY: number) => {
      const bounds = container.getBoundingClientRect();
      const price = series.coordinateToPrice(clientY - bounds.top);
      if (price === null || !Number.isFinite(price)) return;
      latestPrice = constrainedPaperProtectionPrice(position, kind, price);
      setPaperDraftProtection({ id: draftId, kind, price: latestPrice, position });
    };
    const flushPreview = () => {
      animationFrame = null;
      updatePreview(pendingClientY);
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      pendingClientY = moveEvent.clientY;
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(flushPreview);
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleCancel);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      setPaperDraftProtection(null);
    };
    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      pendingClientY = upEvent.clientY;
      updatePreview(upEvent.clientY);
      cleanup();
      if (kind === "stop_loss") {
        onUpdatePaperProtection(position.accountId, position.id, { kind: "stop_loss", price: latestPrice });
      } else {
        onUpdatePaperProtection(position.accountId, position.id, {
          kind: "take_profit",
          price: latestPrice,
          quantity: position.remainingQuantity,
        });
      }
      onPaperProtectionDragStateChange?.(position.id, false);
    };
    const handleCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanup();
      onPaperProtectionDragStateChange?.(position.id, false);
    };

    updatePreview(event.clientY);
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleCancel);
  };

  const removePaperProtection = (level: (typeof paperOverlayLevels)[number]) => {
    if (!onUpdatePaperProtection || level.kind === "entry") return;
    if (level.kind === "stop_loss") {
      onUpdatePaperProtection(level.position.accountId, level.position.id, {
        kind: "stop_loss",
        price: null,
      });
      return;
    }
    if (level.targetId) {
      onUpdatePaperProtection(level.position.accountId, level.position.id, {
        kind: "take_profit",
        targetId: level.targetId,
        price: null,
      });
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 overflow-hidden">
      <div
        ref={chartContainerRef}
        className="relative h-full min-w-0 flex-1 overflow-hidden"
        data-chart-instance-id={chartInstanceId}
        data-volume-profile-count={volumeProfiles.length}
        data-volume-profile-provider={volumeProfiles.at(-1)?.provider ?? "none"}
        onPointerDownCapture={() => {
          activeChartKeyboardTargetId = chartInstanceId;
        }}
      >
      {!chartVisualReady ? (
        <div className="pointer-events-auto absolute inset-0 z-[90]" style={{ backgroundColor: settings.backgroundColor }}>
          <KwantLoader
            className="h-full w-full"
            style={{ backgroundColor: settings.backgroundColor }}
            icon={ChartColumnIncreasing}
            title="Loading chart"
            detail={`${instrument} · fitting history and price scale`}
          />
        </div>
      ) : null}
      {gammaHeatmapIndicator ? (
        <div
          className="pointer-events-none absolute left-2 top-2 z-[24] flex max-w-[min(520px,calc(100%-80px))] items-center gap-2 border border-border bg-panel/92 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-muted shadow-lg backdrop-blur"
          title={gammaHeatmapPayload?.limitations.join(" ") ?? gammaHeatmapError ?? "Loading options exposure history"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${gammaHeatmapError && !gammaHeatmapPayload ? "bg-danger" : gammaHeatmapLoading ? "animate-pulse bg-warning" : "bg-primary"}`} />
          <span className="text-foreground">Gamma Heatmap</span>
          {gammaHeatmapPayload ? (
            <>
              <span>{gammaHeatmapPayload.sourceInstrument}→{gammaHeatmapPayload.displayInstrument}</span>
              <span>{gammaHeatmapPayload.greekMode}</span>
              <span className={gammaHeatmapPayload.status === "LIVE" ? "text-primary" : "text-warning"}>{gammaHeatmapPayload.status.replace("_", " ")}</span>
              <span>{gammaHeatmapPayload.current?.mapping.method.replace("-", " ")}</span>
              <span>{Math.round((gammaHeatmapPayload.current?.mapping.confidence ?? 0) * 100)}%</span>
            </>
          ) : gammaHeatmapLoading ? <span>Loading exposure history…</span> : <span className="text-danger">{gammaHeatmapError ?? "Exposure unavailable"}</span>}
          {gammaHeatmapError && gammaHeatmapPayload ? <span className="text-warning">Refresh delayed · last good surface</span> : null}
        </div>
      ) : null}
      {gammaHeatmapTooltip ? (
        <div
          className="pointer-events-none absolute z-[62] min-w-[210px] border border-border bg-panel/96 p-2 font-mono text-[8px] shadow-2xl backdrop-blur"
          style={{
            left: Math.min(Math.max(8, gammaHeatmapTooltip.x + 14), Math.max(8, overlaySize.width - 230)),
            top: Math.min(Math.max(34, gammaHeatmapTooltip.y + 14), Math.max(34, overlaySize.height - 154)),
          }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border pb-1 text-foreground">
            <span>{gammaHeatmapTooltip.bin.price.toFixed(priceFormat.precision)}</span>
            <span>{new Date(gammaHeatmapTooltip.snapshot.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-muted">
            <span>Net</span><span className={gammaHeatmapTooltip.bin.net >= 0 ? "text-primary" : "text-danger"}>{gammaHeatmapTooltip.bin.net.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Call</span><span className="text-foreground">{gammaHeatmapTooltip.bin.call.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Put</span><span className="text-foreground">{gammaHeatmapTooltip.bin.put.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Change</span><span className="text-foreground">{gammaHeatmapTooltip.bin.change.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Mapping</span><span className="text-foreground">{gammaHeatmapTooltip.snapshot.mapping.method.replace("-", " ")} · {Math.round(gammaHeatmapTooltip.snapshot.mapping.confidence * 100)}%</span>
            <span>Status</span><span className="text-foreground">{gammaHeatmapTooltip.snapshot.status.replace("_", " ")}</span>
          </div>
        </div>
      ) : null}
      {netGammaIndicator && netGammaIndicator.settings?.showHeader !== false ? (
        <div
          className="pointer-events-none absolute left-2 z-[25] flex max-w-[min(720px,calc(100%-80px))] items-center gap-2 border border-border bg-panel/92 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-muted shadow-lg backdrop-blur"
          style={{ top: gammaHeatmapIndicator ? 38 : 8 }}
          title={netGammaProfile?.limitations.join(" ") ?? netGammaError ?? "Loading Net Gamma Exposure by strike"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${netGammaError && !netGammaProfile ? "bg-danger" : netGammaLoading ? "animate-pulse bg-warning" : "bg-primary"}`} />
          <span className="text-foreground">Net GEX</span>
          {netGammaProfile ? (
            <>
              <span>{netGammaProfile.sourceTicker}→{netGammaProfile.displayInstrument}</span>
              <span>{netGammaProfile.expirationLabel}</span>
              <span>{netGammaProfile.representation === "per-one-percent-move" ? "$/1% MOVE" : netGammaProfile.representation === "per-one-dollar-move" ? "$/1$ MOVE" : "RAW"}</span>
              <span className={netGammaProfile.status === "live" ? "text-primary" : "text-warning"}>{netGammaProfile.status.replaceAll("-", " ")}</span>
              <span>
                {netGammaProfile.mapping.method === "live-ratio" ? "LIVE RATIO FALLBACK" : netGammaProfile.mapping.method.replaceAll("-", " ")}
                {netGammaIndicator.settings?.showMappingConfidence !== false ? ` · ${Math.round(netGammaProfile.mapping.mappingConfidence)}%` : ""}
              </span>
              {netGammaProfile.rows.length ? (
                <>
                  <span className={netGammaProfile.totalRegime === "positive" ? "text-primary" : netGammaProfile.totalRegime === "negative" ? "text-danger" : "text-warning"}>{netGammaProfile.totalRegime} regime</span>
                  <span className={netGammaProfile.totalNetExposure >= 0 ? "text-primary" : "text-danger"}>{formatGammaValue(netGammaProfile.totalNetExposure, netGammaProfile.representation)}</span>
                </>
              ) : <span className="text-warning">No qualifying rows</span>}
            </>
          ) : netGammaLoading ? <span>Loading strike profile…</span> : <span className="text-danger">{netGammaError ?? "Exposure unavailable"}</span>}
          {netGammaError && netGammaProfile ? <span className="text-warning">Refresh delayed · last valid profile</span> : null}
        </div>
      ) : null}
      {netGammaTooltip ? (
        <div
          className="pointer-events-none absolute z-[63] min-w-[290px] max-w-[380px] border border-border bg-panel/96 p-2 font-mono text-[8px] shadow-2xl backdrop-blur"
          style={{
            left: Math.min(Math.max(8, netGammaTooltip.x + 14), Math.max(8, overlaySize.width - 400)),
            top: Math.min(Math.max(34, netGammaTooltip.y + 14), Math.max(34, overlaySize.height - 330)),
          }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border pb-1 text-foreground">
            <span>{netGammaTooltip.snapshot.sourceTicker} {netGammaTooltip.row.sourceStrikes.length > 1 ? `${netGammaTooltip.row.sourceStrikes[0]}–${netGammaTooltip.row.sourceStrikes.at(-1)}` : netGammaTooltip.row.sourceStrike.toFixed(2)}</span>
            <span>{netGammaTooltip.snapshot.displayInstrument} {netGammaTooltip.row.mappedDisplayPrice.toFixed(priceFormat.precision)}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-muted">
            <span>Call GEX</span><span className="text-foreground">{formatGammaValue(netGammaTooltip.row.callExposure, netGammaTooltip.snapshot.representation, false)}</span>
            <span>Put GEX</span><span className="text-foreground">{formatGammaValue(netGammaTooltip.row.putExposure, netGammaTooltip.snapshot.representation, false)}</span>
            <span>Net GEX</span><span className={netGammaTooltip.row.netExposure >= 0 ? "text-primary" : "text-danger"}>{formatGammaValue(netGammaTooltip.row.netExposure, netGammaTooltip.snapshot.representation, false)}</span>
            <span>Absolute</span><span className="text-foreground">{formatGammaValue(netGammaTooltip.row.absoluteTotalExposure, netGammaTooltip.snapshot.representation, false)}</span>
            <span>Total share</span><span className="text-foreground">{(netGammaTooltip.row.percentageOfTotalAbsoluteExposure * 100).toFixed(2)}%</span>
            <span>Visible share</span><span className="text-foreground">{(netGammaTooltip.row.percentageOfVisibleAbsoluteExposure * 100).toFixed(2)}%</span>
            <span>Expirations</span><span className="text-foreground">{[...new Set(netGammaTooltip.row.expirationContributions.map((item) => item.expirationDate))].join(", ") || "—"}</span>
            <span>Source / display</span><span className="text-foreground">{netGammaTooltip.snapshot.sourceSpotPrice.toFixed(2)} / {netGammaTooltip.snapshot.displayPrice.toFixed(priceFormat.precision)}</span>
            <span>Mapping</span><span className="text-foreground">{netGammaTooltip.row.mapping.method.replaceAll("-", " ")}</span>
            <span>Alpha / beta</span><span className="text-foreground">{netGammaTooltip.row.mapping.alpha.toFixed(4)} / {netGammaTooltip.row.mapping.beta.toFixed(6)}</span>
            <span>R² / samples</span><span className="text-foreground">{netGammaTooltip.row.mapping.rSquared?.toFixed(3) ?? "—"} / {netGammaTooltip.row.mapping.sampleCount ?? "—"}</span>
            <span>Confidence</span><span className="text-foreground">{Math.round(netGammaTooltip.row.mapping.mappingConfidence)}%</span>
            <span>Provider / mode</span><span className="text-foreground">{netGammaTooltip.snapshot.provider} / {netGammaTooltip.snapshot.representation}</span>
            <span>Snapshot</span><span className="text-foreground">{new Date(netGammaTooltip.snapshot.snapshotTimeMs).toLocaleString()}</span>
            <span>Snapshot age</span><span className="text-foreground">{Math.max(0, Math.round((netGammaTooltip.snapshot.receivedTimeMs - netGammaTooltip.snapshot.snapshotTimeMs) / 1_000))}s at receipt</span>
            <span>Status</span><span className="text-foreground">{netGammaTooltip.snapshot.status.replaceAll("-", " ")}</span>
          </div>
          {netGammaTooltip.row.expirationContributions.length ? (
            <div className="mt-2 border-t border-border pt-1 text-muted">
              <div className="mb-1 uppercase tracking-[0.08em]">Expiration contributions</div>
              {netGammaTooltip.row.expirationContributions.slice(0, 5).map((item) => (
                <div key={`${item.expirationDate}:${item.sourceStrike}`} className="flex justify-between gap-3 text-foreground">
                  <span>{item.expirationDate} · {item.daysToExpiration}D · {item.sourceStrike}</span>
                  <span className={item.netExposure >= 0 ? "text-primary" : "text-danger"}>{formatGammaValue(item.netExposure, netGammaTooltip.snapshot.representation, false)}</span>
                </div>
              ))}
              {netGammaTooltip.row.expirationContributions.length > 5 ? <div>+{netGammaTooltip.row.expirationContributions.length - 5} more contributors</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {darkPoolMapIndicator ? (
        <div
          className="pointer-events-none absolute left-2 z-[25] flex max-w-[min(720px,calc(100%-80px))] items-center gap-2 border border-border bg-panel/92 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-muted shadow-lg backdrop-blur"
          style={{ top: 8 + (gammaHeatmapIndicator ? 30 : 0) + (netGammaIndicator ? 30 : 0) }}
          title={darkPoolMapPayload?.limitations.join(" ") ?? darkPoolMapError ?? "Loading real off-exchange prints"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${darkPoolMapError && !darkPoolMapPayload ? "bg-danger" : darkPoolMapLoading ? "animate-pulse bg-warning" : "bg-primary"}`} />
          <span className="text-foreground">Dark Pool Map</span>
          {darkPoolMapPayload ? (
            <>
              <span>{darkPoolMapPayload.sourceTicker} dark pool→{darkPoolMapPayload.displayInstrument}</span>
              <span className={darkPoolMapPayload.status === "LIVE" ? "text-primary" : "text-warning"}>{darkPoolMapPayload.status.replaceAll("_", " ")}</span>
              <span>{Math.round(darkPoolMapPayload.pollIntervalMs / 1_000)}s poll</span>
              {darkPoolMapPayload.mapping ? <span>{darkPoolMapPayload.mapping.method.replaceAll("-", " ")}</span> : null}
              {darkPoolMapIndicator.settings?.showMappingConfidence !== false && darkPoolMapPayload.mapping ? <span>{Math.round(darkPoolMapPayload.mapping.confidence * 100)}%</span> : null}
              <span>{darkPoolMapPayload.prints.length.toLocaleString()} prints</span>
              <span>{darkPoolMapPayload.zones.length} zones</span>
            </>
          ) : darkPoolMapLoading ? <span>Loading dark-pool prints…</span> : <span className="text-danger">{darkPoolMapError ?? "Dark-pool data unavailable"}</span>}
          {darkPoolMapError && darkPoolMapPayload ? <span className="text-warning">Refresh delayed · last valid map</span> : null}
        </div>
      ) : null}
      {darkPoolMapTooltip ? (
        <div
          className="pointer-events-none absolute z-[64] min-w-[250px] border border-border bg-panel/96 p-2 font-mono text-[8px] shadow-2xl backdrop-blur"
          style={{
            left: Math.min(Math.max(8, darkPoolMapTooltip.x + 14), Math.max(8, overlaySize.width - 272)),
            top: Math.min(Math.max(34, darkPoolMapTooltip.y + 14), Math.max(34, overlaySize.height - 236)),
          }}
        >
          {darkPoolMapTooltip.print ? (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-1 text-foreground">
                <span>{darkPoolMapTooltip.print.ticker} Dark Pool Print</span>
                <span>{darkPoolMapTooltip.print.isDelayedPrint ? "DELAYED" : "REPORTED"}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-muted">
                <span>Trade time</span><span className="text-foreground">{new Date(darkPoolMapTooltip.print.tradeTimeMs).toLocaleString()}</span>
                <span>Source price</span><span className="text-foreground">{darkPoolMapTooltip.print.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                <span>Mapped {darkPoolMapTooltip.print.displayInstrument}</span><span className="text-foreground">{darkPoolMapTooltip.print.mappedPrice.toFixed(priceFormat.precision)}</span>
                <span>Shares</span><span className="text-foreground">{darkPoolMapTooltip.print.size.toLocaleString()}</span>
                <span>Notional</span><span className="text-foreground">{darkPoolMapTooltip.print.notionalValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
                <span>Location</span><span className="text-foreground">{darkPoolMapTooltip.print.tradeSide === "ASK" || darkPoolMapTooltip.print.tradeSide === "ABOVE_ASK" ? "Executed at/above ask" : darkPoolMapTooltip.print.tradeSide === "BID" || darkPoolMapTooltip.print.tradeSide === "BELOW_BID" ? "Executed at/below bid" : darkPoolMapTooltip.print.tradeSide === "MID_MARKET" ? "Executed near midpoint" : "Unknown quote location"}</span>
                <span>Bid / ask</span><span className="text-foreground">{darkPoolMapTooltip.print.bidPrice ?? "—"} / {darkPoolMapTooltip.print.askPrice ?? "—"}</span>
                <span>Mapping</span><span className="text-foreground">{darkPoolMapTooltip.print.mapping.method.replaceAll("-", " ")} · {Math.round(darkPoolMapTooltip.print.mapping.confidence * 100)}%</span>
              </div>
            </>
          ) : darkPoolMapTooltip.zone ? (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-1 text-foreground"><span>Dark Pool Zone</span><span>Score {Math.round(darkPoolMapTooltip.zone.strengthScore)}</span></div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-muted">
                <span>Mapped range</span><span className="text-foreground">{darkPoolMapTooltip.zone.lowerPrice.toFixed(priceFormat.precision)}–{darkPoolMapTooltip.zone.upperPrice.toFixed(priceFormat.precision)}</span>
                <span>Weighted price</span><span className="text-foreground">{darkPoolMapTooltip.zone.weightedPrice.toFixed(priceFormat.precision)}</span>
                <span>Total notional</span><span className="text-foreground">{darkPoolMapTooltip.zone.totalNotional.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
                <span>Total shares</span><span className="text-foreground">{darkPoolMapTooltip.zone.totalShares.toLocaleString()}</span>
                <span>Prints / sessions</span><span className="text-foreground">{darkPoolMapTooltip.zone.tradeCount} / {darkPoolMapTooltip.zone.sessionCount}</span>
                <span>First / last</span><span className="text-foreground">{darkPoolMapTooltip.zone.firstPrintTimeMs ? new Date(darkPoolMapTooltip.zone.firstPrintTimeMs).toLocaleDateString() : "—"} / {darkPoolMapTooltip.zone.lastPrintTimeMs ? new Date(darkPoolMapTooltip.zone.lastPrintTimeMs).toLocaleTimeString() : "—"}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {darkPoolMapIndicator?.settings?.showLevelTable === true && darkPoolMapPayload?.levels.length ? (
        <div className="absolute bottom-10 right-[68px] z-[26] max-h-[38%] w-[min(420px,42%)] overflow-auto border border-border bg-panel/94 font-mono text-[8px] shadow-2xl backdrop-blur">
          <div className="sticky top-0 grid grid-cols-[26px_1fr_1fr_56px_44px] gap-2 border-b border-border bg-panel px-2 py-1 uppercase tracking-[0.08em] text-muted"><span>#</span><span>Mapped</span><span>Notional</span><span>Prints</span><span>Score</span></div>
          {darkPoolMapPayload.levels.map((level, index) => (
            <div key={level.id} className="grid grid-cols-[26px_1fr_1fr_56px_44px] gap-2 border-b border-border/45 px-2 py-1 text-foreground"><span>{index + 1}</span><span>{level.mappedPrice.toFixed(priceFormat.precision)}</span><span>{level.totalNotional.toLocaleString("en-US", { notation: "compact", style: "currency", currency: "USD" })}</span><span>{level.tradeCount}</span><span>{Math.round(level.strengthScore)}</span></div>
          ))}
        </div>
      ) : null}
      {gexBotFlow ? <GexBotFlowStrip payload={gexBotFlow} /> : null}
      {flowVerdictY !== null && gexBotFlow?.sponsorship.active ? (
        <div
          className={`pointer-events-none absolute right-[70px] z-[25] rounded-md border bg-panel/94 px-2 py-1 font-mono text-[8px] font-semibold shadow-lg backdrop-blur ${gexBotFlow.sponsorship.active.state === "SPONSORED" ? "border-primary/40 text-primary" : "border-warning/40 text-warning"}`}
          style={{ top: Math.max(8, Math.min(overlaySize.height - 64, flowVerdictY - 12)) }}
          title={`Price ${(gexBotFlow.sponsorship.active.priceChangePercent * 100).toFixed(3)}% · ΔDEX ${gexBotFlow.sponsorship.active.dexChange.toLocaleString("en-US", { maximumFractionDigits: 0 })} · age ${Math.round((gexBotFlow.dataAgeMs ?? 0) / 1_000)}s`}
        >
          {gexBotFlow.sponsorship.active.label}
        </div>
      ) : null}
      {paperOverlayLevels.map((level) => (
        <div
          key={level.id}
          className="pointer-events-none absolute left-0 z-[31]"
          style={{
            right: nativePriceScaleWidth,
            top: level.y,
          }}
        >
          {level.kind === "entry" ? (
            <div
              className="paper-position-overlay-label pointer-events-auto absolute right-1 flex h-4 w-[164px] -translate-y-1/2 items-center overflow-hidden opacity-0"
              style={{ borderColor: level.color, color: level.color }}
              title={`Unrealized ${level.position.unrealizedPnl.toFixed(2)}`}
            >
              {onUpdatePaperProtection && level.position.stopLoss === null ? (
                <button
                  type="button"
                  onPointerDown={(event) => startNewPaperProtectionDrag(event, level.position, "stop_loss")}
                  className="flex w-5 touch-none cursor-ns-resize self-stretch items-center justify-center border-r font-mono text-[8px] font-bold transition-colors hover:bg-danger/15 active:cursor-grabbing"
                  style={{ borderColor: level.color, color: settings.downColor }}
                  title="Hold and drag to place a working stop loss"
                  aria-label={`Add stop loss to ${level.position.symbol} position`}
                >
                  SL
                </button>
              ) : null}
              {onUpdatePaperProtection && !level.position.takeProfits.some((target) => target.quantity > target.filledQuantity) ? (
                <button
                  type="button"
                  onPointerDown={(event) => startNewPaperProtectionDrag(event, level.position, "take_profit")}
                  className="flex w-5 touch-none cursor-ns-resize self-stretch items-center justify-center border-r font-mono text-[8px] font-bold transition-colors hover:bg-success/15 active:cursor-grabbing"
                  style={{ borderColor: level.color, color: settings.upColor }}
                  title="Hold and drag to place a working take profit"
                  aria-label={`Add take profit to ${level.position.symbol} position`}
                >
                  TP
                </button>
              ) : null}
              <span className="min-w-0 flex-1 truncate px-[7px]">{level.label}</span>
              {onClosePaperPosition ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClosePaperPosition(level.position);
                  }}
                  className="flex w-4 self-stretch items-center justify-center border-l transition-colors hover:bg-danger/15 hover:text-danger"
                  style={{ borderColor: level.color }}
                  title="Close this position at the live bid/ask"
                  aria-label={`Close ${level.position.symbol} position`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </div>
          ) : (
            <div
              className="paper-protection-overlay-label pointer-events-auto absolute right-1 flex h-4 w-[164px] -translate-y-1/2 items-stretch overflow-hidden opacity-0"
              style={{ borderColor: level.color, color: level.color }}
            >
              <button
                type="button"
                onPointerDown={(event) => startPaperProtectionDrag(event, level)}
                className="min-w-0 flex-1 cursor-ns-resize touch-none truncate px-[7px] text-left active:cursor-grabbing"
                title="Drag to adjust protection"
              >
                {level.label}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removePaperProtection(level);
                }}
                className="flex w-4 shrink-0 items-center justify-center border-l transition-colors hover:bg-danger/15 hover:text-danger"
                style={{ borderColor: level.color }}
                title={`Remove ${level.kind === "stop_loss" ? "stop loss" : "take profit"}`}
                aria-label={`Remove ${level.kind === "stop_loss" ? "stop loss" : "take profit"} from ${level.position.symbol} position`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      ))}
      {paperOverlayLevels.filter((level) => level.kind === "entry").map((level) => (
        <div
          key={`${level.id}-price-scale`}
          className="pointer-events-none absolute right-0 z-[32] flex h-5 -translate-y-1/2 items-center justify-center font-mono text-[9px] font-bold tabular-nums"
          style={{
            top: level.y,
            width: nativePriceScaleWidth,
            backgroundColor: level.color,
            color: settings.backgroundColor,
          }}
          aria-label={`Entry price ${level.position.entryPrice.toFixed(priceFormat.precision)}`}
        >
          {level.position.entryPrice.toFixed(priceFormat.precision)}
        </div>
      ))}
      {gammaLevelsEnabled && gammaLevelsLoading ? (
        <div
          className="pointer-events-none absolute right-[76px] top-3 z-[19] flex items-center gap-2 rounded-full border border-border/70 bg-background/88 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground shadow-lg backdrop-blur"
          role="status"
        >
          <ScanLine className="h-3.5 w-3.5 animate-pulse text-primary" />
          <span>Syncing {instrument} Gamma</span>
        </div>
      ) : null}
      {footprintIndicator && !footprintHasPriceLevelFlow ? (
        <div
          className="pointer-events-none absolute right-[76px] top-3 z-[19] max-w-[360px] border border-border/70 bg-background/92 px-3 py-2 font-mono text-[9px] leading-4 text-muted-foreground shadow-lg backdrop-blur"
          role="status"
        >
          <div className="font-semibold uppercase tracking-[0.08em] text-foreground">
            {orderFlowHistoryReady ? "No executed trade data" : "Loading executed trade history"}
          </div>
          {orderFlowHistoryReady ? "No executed trade data is available for this visible period." : "The Footprint will paint as classified executions arrive."}
        </div>
      ) : footprintIndicator && footprintHasPriceLevelFlow && !footprintHasClassifiedFlow ? (
        <div
          className="pointer-events-none absolute right-[76px] top-3 z-[19] max-w-[390px] border border-border/70 bg-background/92 px-3 py-2 font-mono text-[9px] leading-4 text-muted-foreground shadow-lg backdrop-blur"
          role="status"
        >
          <div className="font-semibold uppercase tracking-[0.08em] text-foreground">Limited execution classification</div>
          Bid × Ask requires aggressor-side classification. Unclassified volume is retained in total volume and POC, but is not assigned to Bid, Ask, Delta or imbalances.
        </div>
      ) : null}
      <div
        ref={horzLineRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          right: 60,
          height: "1px",
          backgroundColor: "var(--crosshair-color)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
      <div
        ref={priceLabelRef}
        style={{
          display: "none",
          position: "absolute",
          right: 0,
          width: 60,
          height: 20,
          backgroundColor: "var(--surface)",
          color: "var(--muted)",
          fontSize: "11px",
          fontFamily: "monospace",
          textAlign: "center",
          lineHeight: "20px",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      <CandleCountdownBadge
        candleIntervalMs={candleIntervalMs}
        hasCandles={hasCandles}
        latestCandleRef={latestCandleRef}
        chartRef={chartRef}
        marketIsActive={marketIsActive}
        bottom={56 + indicatorPaneHeight}
      />

      {hedgeLevelsIndicator ? (
        <div className="pointer-events-none absolute right-[70px] top-3 z-[18] flex max-w-[370px] items-center gap-1.5 rounded-full border border-border bg-panel/92 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted shadow-lg backdrop-blur">
          <span className="font-semibold text-foreground">Hedge Levels</span>
          {hedgeLevelsLoading && !hedgeLevelsPayload ? <span className="text-primary">Loading</span> : null}
          {hedgeLevelsPayload ? (
            <span className={hedgeLevelsPayload.stale ? "text-warning" : hedgeLevelsPayload.frozen ? "text-muted" : "text-primary"}>
              {hedgeFreshnessPill(hedgeLevelsPayload, hedgeLevelsNow)}
            </span>
          ) : null}
          {hedgeLevelsPayload?.contested ? <span className="text-warning">Contested</span> : null}
          {hedgeLevelsError && !hedgeLevelsPayload ? (
            <span className="max-w-[255px] truncate text-danger">{hedgeLevelsError}</span>
          ) : null}
        </div>
      ) : null}

      {hedgeLevelsOverlay && hedgeLevelsPayload ? (
        <div
          className="pointer-events-none absolute inset-0 z-[13] overflow-hidden"
          aria-label="Hedge Levels dealer-hedging bands"
          // The chart primitive owns all visible pixels so bands share the
          // candle renderer's exact price-scale frame. This transparent layer
          // remains only for pointer hit-testing and tooltip positioning.
          style={{ opacity: 0 }}
        >
          {hedgeLevelsOverlay.showBelowFlip && hedgeLevelsOverlay.flipY !== null ? (
            <div
              className="absolute left-0"
              style={{
                top: Math.max(0, hedgeLevelsOverlay.flipY),
                width: hedgeLevelsOverlay.plotWidth,
                height: Math.max(0, hedgeLevelsOverlay.plotHeight - hedgeLevelsOverlay.flipY),
                backgroundColor: "#000000",
                opacity: 0.045,
              }}
            />
          ) : null}
          {hedgeLevelsOverlay.positioned.map((item) => {
            const color = HEDGE_LEVEL_COLORS[item.level.kind];
            const pulse = hedgeLevelsPulseIds.includes(item.level.id);
            const flip = item.level.kind === "FLIP";
            return (
              <div key={item.level.id}>
                <div
                  className={pulse ? "animate-pulse" : ""}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: item.y,
                    width: hedgeLevelsOverlay.plotWidth,
                    height: flip ? 1 : item.height,
                    backgroundColor: flip
                      ? "transparent"
                      : `color-mix(in srgb, ${color} ${hedgeLevelsOverlay.fillOpacity * 100}%, transparent)`,
                    borderTop: `1px ${flip ? "dashed" : "solid"} color-mix(in srgb, ${color} ${hedgeLevelsOverlay.lineOpacity * 100}%, transparent)`,
                    borderBottom: flip
                      ? "none"
                      : `1px solid color-mix(in srgb, ${color} ${hedgeLevelsOverlay.lineOpacity * 100}%, transparent)`,
                    boxShadow: pulse ? `0 0 16px ${color}99` : "none",
                    transition: "top 220ms ease, height 220ms ease, box-shadow 220ms ease",
                    pointerEvents: "auto",
                    cursor: "crosshair",
                  }}
                  onMouseMove={(event) => {
                    const rect = chartContainerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHedgeLevelsTooltip({
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                      level: item.level,
                    });
                  }}
                  onMouseLeave={() => setHedgeLevelsTooltip(null)}
                />
                {hedgeLevelsOverlay.showLabels ? (
                  <div
                    className="absolute -translate-y-1/2 rounded bg-panel/86 px-1.5 py-0.5 font-mono text-[8px] font-semibold lowercase tracking-[0.02em] backdrop-blur-sm"
                    style={{
                      right: Math.max(66, overlaySize.width - hedgeLevelsOverlay.plotWidth + 5),
                      top: hedgeLevelsOverlay.labelY.get(item.level.id) ?? item.centreY,
                      color,
                      border: `1px solid ${color}55`,
                      transition: "top 220ms ease",
                    }}
                  >
                    {item.level.label}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {hedgeLevelsTooltip && hedgeLevelsPayload ? (
        <div
          className="pointer-events-none absolute z-[84] w-[316px] rounded-xl border border-border bg-panel/97 p-3 font-mono text-[9px] leading-4 text-muted shadow-2xl backdrop-blur"
          style={{
            left: Math.max(8, Math.min(overlaySize.width - 326, hedgeLevelsTooltip.x + 14)),
            top: Math.max(8, Math.min(overlaySize.height - 300, hedgeLevelsTooltip.y + 12)),
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-foreground">
            <span className="font-semibold">{hedgeLevelsTooltip.level.kind.replace(/_/g, " ")}</span>
            <span>{hedgeLevelsTooltip.level.price.toFixed(priceFormat.precision)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <span>Band</span><span className="text-foreground">{hedgeLevelsTooltip.level.zoneLow.toFixed(priceFormat.precision)} - {hedgeLevelsTooltip.level.zoneHigh.toFixed(priceFormat.precision)}</span>
            <span>Net gamma</span><span className="text-foreground">{hedgeLevelsTooltip.level.net.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Regime</span><span className="text-foreground">{hedgeLevelsPayload.regime}</span>
            <span>Expiry scope</span><span className="text-foreground">{hedgeLevelsPayload.expiryScope}</span>
            <span>Dominant expiry</span><span className="text-foreground">{hedgeLevelsTooltip.level.dominantExpiry ?? "Not available"}</span>
            <span>Conversion</span><span className="text-foreground">converted · live-calibrated</span>
            <span>Generated at</span><span className="text-foreground">{new Date(hedgeLevelsPayload.generatedAt).toLocaleString()}</span>
            <span>Data age</span><span className="text-foreground">{formatTpoAge(Math.max(hedgeLevelsPayload.dataAge, hedgeLevelsNow - Date.parse(hedgeLevelsPayload.generatedAt)))}</span>
          </div>
          <div className="mt-2 border-t border-border pt-2 text-[8px] leading-3.5 text-foreground/85">
            {hedgeLevelsTooltip.level.signLine}
          </div>
          {hedgeLevelsTooltip.level.kind === "FLIP" && hedgeLevelsPayload.contested ? (
            <div className="mt-2 border-t border-border pt-2 text-[8px] leading-3.5">
              Crossings: {hedgeLevelsPayload.allCrossings.map((price) => price.toFixed(priceFormat.precision)).join(" · ")}
            </div>
          ) : null}
          <div className="mt-2 border-t border-border pt-2 text-[8px] leading-3.5">
            {hedgeLevelsPayload.signConvention}
          </div>
        </div>
      ) : null}

      {expectedMoveIndicator ? (
        <div className="pointer-events-none absolute right-[70px] top-[70px] z-[17] flex max-w-[330px] items-center gap-1.5 rounded-full border border-border bg-panel/90 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted shadow-lg backdrop-blur">
          <span className="font-semibold text-foreground">Expected Move</span>
          {expectedMoveLoading && !expectedMovePayload ? <span className="text-primary">Loading</span> : null}
          {expectedMovePayload?.stale ? (
            <span className="text-warning">EM STALE {formatTpoAge(Math.max(expectedMovePayload.dataAge, expectedMoveNow - Date.parse(expectedMovePayload.generatedAt)))}</span>
          ) : null}
          {expectedMoveError && !expectedMovePayload ? (
            <span className="max-w-[240px] truncate text-danger">{expectedMoveError}</span>
          ) : null}
          {expectedMovePayload && !expectedMovePayload.stale && !expectedMoveOverlay ? (
            <span>Calibrating {expectedMovePayload.sourceSymbol}</span>
          ) : null}
        </div>
      ) : null}

      {classicGexIndicator ? (
        <div className="pointer-events-none absolute right-[70px] top-[104px] z-[16] flex max-w-[430px] items-center gap-1.5 rounded-full border border-border bg-panel/90 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted shadow-lg backdrop-blur">
          <span className="font-semibold text-foreground">Classic GEX</span>
          {classicGexProfile ? (
            <span className={classicGexProfile.stale ? "text-warning" : "text-primary"}>
              {classicGexProfile.stale
                ? `Stale ${formatTpoAge(classicGexProfile.dataAgeMs)}`
                : classicGexProfile.status}
            </span>
          ) : null}
          {classicGexManualBadge ? (
            <span className={classicGexManualBadge.tone === "danger" ? "text-danger" : "text-warning"}>
              {classicGexManualBadge.text}
            </span>
          ) : null}
          {classicGexError && !classicGexProfile ? (
            <span className="max-w-[250px] truncate text-danger">{classicGexError}</span>
          ) : null}
        </div>
      ) : null}

      {(gammaLevelsError || historicalStructureError) ? (
        <div className="pointer-events-none absolute right-[70px] top-[138px] z-[15] flex max-w-[430px] flex-col items-end gap-1">
          {[
            gammaLevelsError ? `Kwant Levels · ${gammaLevelsError}` : null,
            // Value-area refresh failures stay silent here. The workspace keeps
            // retrying in the background and restores the next completed CME
            // profile without covering the chart with an expected window notice.
            historicalStructureError ? `Structure · ${historicalStructureError}` : null,
          ].filter((message): message is string => Boolean(message)).map((message) => (
            <span
              key={message}
              className="max-w-full truncate rounded-full border border-border bg-panel/92 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-danger shadow-lg backdrop-blur"
            >
              {message}
            </span>
          ))}
        </div>
      ) : null}

      {expectedMoveOverlay ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[12] h-full w-full overflow-hidden"
          viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
          preserveAspectRatio="none"
          aria-label="Expected Move one-sigma rails"
          style={{ opacity: expectedMovePayload?.stale ? 0.55 : 1 }}
        >
          {expectedMoveOverlay.showBandFill
            && expectedMoveOverlay.oneHighY !== null
            && expectedMoveOverlay.oneLowY !== null ? (
              <rect
                x={0}
                y={Math.min(expectedMoveOverlay.oneHighY, expectedMoveOverlay.oneLowY)}
                width={expectedMoveOverlay.plotWidth}
                height={Math.abs(expectedMoveOverlay.oneLowY - expectedMoveOverlay.oneHighY)}
                fill={expectedMoveOverlay.color}
                fillOpacity={expectedMoveOverlay.fillOpacity}
              />
            ) : null}
          {expectedMoveOverlay.rails.map((rail) => (
            <g key={rail.key}>
              <line
                x1={0}
                x2={expectedMoveOverlay.plotWidth}
                y1={rail.y}
                y2={rail.y}
                stroke={expectedMoveOverlay.color}
                strokeOpacity={expectedMoveOverlay.lineOpacity * (rail.sigma === 2 ? 0.55 : 1)}
                strokeWidth={1}
                strokeDasharray={rail.sigma === 2 ? "2 5" : "6 5"}
              />
              <line
                x1={0}
                x2={expectedMoveOverlay.plotWidth}
                y1={rail.y}
                y2={rail.y}
                stroke="transparent"
                strokeWidth={12}
                style={{ pointerEvents: "stroke", cursor: "crosshair" }}
                onMouseMove={(event) => {
                  const rect = chartContainerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setExpectedMoveTooltip({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    band: expectedMoveOverlay.band,
                  });
                }}
                onMouseLeave={() => setExpectedMoveTooltip(null)}
              />
              {expectedMoveOverlay.showLabels ? (
                <text
                  x={expectedMoveOverlay.plotWidth - 7}
                  y={rail.labelY}
                  textAnchor="end"
                  fill={expectedMoveOverlay.color}
                  fillOpacity={rail.sigma === 2 ? 0.7 : 1}
                  fontFamily="'JetBrains Mono', monospace"
                  fontSize={8}
                  fontWeight={800}
                  paintOrder="stroke"
                  stroke={settings.backgroundColor}
                  strokeWidth={3}
                >
                  {expectedMoveLabel({
                    approximate: expectedMoveOverlay.band.approximate,
                    side: rail.key.startsWith("high") ? "high" : "low",
                    sigma: rail.sigma,
                  })}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      ) : null}

      {expectedMoveTooltip && expectedMovePayload ? (
        <div
          className="pointer-events-none absolute z-[83] w-[310px] rounded-xl border border-border bg-panel/96 p-3 font-mono text-[9px] leading-4 text-muted shadow-2xl backdrop-blur"
          style={{
            left: Math.max(8, Math.min(overlaySize.width - 320, expectedMoveTooltip.x + 14)),
            top: Math.max(8, Math.min(overlaySize.height - 282, expectedMoveTooltip.y + 12)),
          }}
        >
          <div className="mb-2 flex items-center justify-between text-foreground">
            <span className="font-semibold">Expected Move</span>
            <span>{expectedMoveTooltip.band.mode}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <span>Anchor</span><span className="text-foreground">{expectedMoveTooltip.band.anchor.toFixed(priceFormat.precision)}</span>
            <span>Anchor label</span><span className="text-foreground">{expectedMoveTooltip.band.anchorLabel}</span>
            <span>IV used</span><span className="text-foreground">{expectedMovePayload.range.approximate ? `Unavailable (~${(expectedMovePayload.range.annualizedIv * 100).toFixed(2)}% realized)` : `${(expectedMovePayload.range.annualizedIv * 100).toFixed(2)}%`}</span>
            <span>Expiry</span><span className="text-foreground">{expectedMovePayload.range.sourceExpiration ?? "Nearest available"}</span>
            <span>Method</span><span className="text-foreground">{expectedMovePayload.range.method}</span>
            <span>Move percent</span><span className="text-foreground">{(expectedMoveTooltip.band.movePercent * 100).toFixed(3)}%</span>
            <span>Move in points</span><span className="text-foreground">{expectedMoveTooltip.band.movePoints.toFixed(priceFormat.precision)}</span>
            <span>Generated at</span><span className="text-foreground">{new Date(expectedMovePayload.generatedAt).toLocaleString()}</span>
            <span>Data age</span><span className="text-foreground">{formatTpoAge(Math.max(expectedMovePayload.dataAge, expectedMoveNow - Date.parse(expectedMovePayload.generatedAt)))}</span>
          </div>
          <div className="mt-2 border-t border-border pt-2 text-[8px] leading-3.5 text-foreground/80">
            {EXPECTED_MOVE_SEMANTICS}
          </div>
        </div>
      ) : null}

      {tpoOverlay ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[10] h-full w-full overflow-hidden"
          viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
          preserveAspectRatio="none"
          aria-label="TPO Levels zones"
        >
          {tpoOverlay.positioned.map((item) => (
            <g key={item.zone.id}>
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                rx={2}
                fill={item.color}
                fillOpacity={item.opacity}
                stroke={item.color}
                strokeOpacity={tpoOverlay.borderOpacity}
                strokeWidth={1}
                style={{ pointerEvents: "all", cursor: "crosshair" }}
                onMouseMove={(event) => {
                  const rect = chartContainerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTpoTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, zone: item.zone });
                }}
                onMouseLeave={() => setTpoTooltip(null)}
              />
              {tpoOverlay.showLabels ? (
                <text
                  x={tpoOverlay.plotWidth - 6}
                  y={tpoOverlay.labelY.get(item.zone.id) ?? item.centreY}
                  textAnchor="end"
                  fill={item.color}
                  fontFamily="'JetBrains Mono', monospace"
                  fontSize={8}
                  fontWeight={800}
                  paintOrder="stroke"
                  stroke={settings.backgroundColor}
                  strokeWidth={3}
                >
                  {item.zone.label}{item.zone.state === "VIRGIN" ? "*" : ""}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      ) : null}

      {tpoTooltip && tpoPayload ? (
        <div
          className="pointer-events-none absolute z-[82] w-[272px] rounded-xl border border-border bg-panel/96 p-3 font-mono text-[9px] leading-4 text-muted shadow-2xl backdrop-blur"
          style={{
            left: Math.max(8, Math.min(overlaySize.width - 282, tpoTooltip.x + 14)),
            top: Math.max(8, Math.min(overlaySize.height - 250, tpoTooltip.y + 12)),
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-foreground">
            <span className="font-semibold">{tpoTooltip.zone.label}</span>
            <span>{tpoTooltip.zone.state}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <span>Formation</span><span className="text-foreground">{tpoTooltip.zone.formationSession}</span>
            <span>Price range</span><span className="text-foreground">{tpoTooltip.zone.low.toFixed(priceFormat.precision)} - {tpoTooltip.zone.high.toFixed(priceFormat.precision)}</span>
            <span>TPO count</span><span className="text-foreground">{tpoTooltip.zone.tpoCount}</span>
            <span>Volume confirmation</span><span className="text-foreground">{tpoTooltip.zone.volumeConfirmation ? `Yes · LVN ${tpoTooltip.zone.lvnValue?.toFixed(0) ?? "n/a"}` : "No"}</span>
            <span>Touches</span><span className="text-foreground">{tpoTooltip.zone.touches}</span>
            <span>Fill</span><span className="text-foreground">{tpoTooltip.zone.fillPercent}%</span>
            <span>Strength</span><span className="text-foreground">{tpoTooltip.zone.strength}</span>
            <span>Current priority</span><span className="text-foreground">{tpoTooltip.zone.currentPriority.toFixed(1)}</span>
            <span>Data age</span><span className="text-foreground">{formatTpoAge(tpoPayload.stale ? tpoPayload.dataAge : Date.now() - Date.parse(tpoPayload.generatedAt))}</span>
          </div>
          {tpoTooltip.zone.confluenceReasons.length > 1 ? (
            <div className="mt-2 border-t border-border pt-2 text-[8px] leading-3.5">
              {tpoTooltip.zone.confluenceReasons.join(" · ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {classicGexOverlay ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[11] h-full w-full overflow-hidden"
          viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
          preserveAspectRatio="none"
          aria-label="Classic GEX profile"
          // Visible GEX geometry is rendered by ClassicGexProfilePrimitive so
          // it shares the chart's exact price transform. This transparent SVG
          // remains only as the existing tooltip hit layer.
          style={{ opacity: 0 }}
        >
          <line
            x1={classicGexOverlay.spineX}
            x2={classicGexOverlay.spineX}
            y1={0}
            y2={classicGexOverlay.plotHeight}
            stroke="var(--muted)"
            strokeOpacity={0.34}
            strokeWidth={1}
          />
          {classicGexOverlay.lines.map((line) => (
            <g key={`${line.label}-${line.mappedPrice}`}>
              <line
                x1={0}
                x2={classicGexOverlay.plotWidth}
                y1={line.y}
                y2={line.y}
                stroke={line.color}
                strokeOpacity={0.72}
                strokeWidth={1.2}
                strokeDasharray={line.dash}
              />
              {classicGexOverlay.showLabels ? (
                <text
                  x={classicGexOverlay.right ? 7 : classicGexOverlay.plotWidth - 7}
                  y={Math.max(10, line.y - 4)}
                  fill={line.color}
                  fontFamily="'JetBrains Mono', monospace"
                  fontSize={8}
                  fontWeight={800}
                  textAnchor={classicGexOverlay.right ? "start" : "end"}
                  paintOrder="stroke"
                  stroke={settings.backgroundColor}
                  strokeWidth={3}
                >
                  {line.label} {line.mappedPrice.toFixed(priceFormat.precision)}
                </text>
              ) : null}
            </g>
          ))}
          {classicGexOverlay.positioned.map(({ row, y }) => {
            const callWidth = classicGexOverlay.scale(row.call);
            const putWidth = classicGexOverlay.scale(row.put);
            return (
              <g key={row.strike}>
                {row.put !== 0 ? (
                  <rect
                    x={classicGexOverlay.spineX - putWidth}
                    y={y - classicGexOverlay.rowHeight / 2}
                    width={putWidth}
                    height={classicGexOverlay.rowHeight}
                    rx={1}
                    fill={classicGexOverlay.negativeColor}
                    fillOpacity={classicGexOverlay.contrast}
                    style={{ pointerEvents: "all", cursor: "crosshair" }}
                    onMouseMove={(event) => {
                      const rect = chartContainerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setClassicGexTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, row });
                    }}
                    onMouseLeave={() => setClassicGexTooltip(null)}
                  />
                ) : null}
                {row.call !== 0 ? (
                  <rect
                    x={classicGexOverlay.spineX}
                    y={y - classicGexOverlay.rowHeight / 2}
                    width={callWidth}
                    height={classicGexOverlay.rowHeight}
                    rx={1}
                    fill={classicGexOverlay.positiveColor}
                    fillOpacity={classicGexOverlay.contrast}
                    style={{ pointerEvents: "all", cursor: "crosshair" }}
                    onMouseMove={(event) => {
                      const rect = chartContainerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setClassicGexTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, row });
                    }}
                    onMouseLeave={() => setClassicGexTooltip(null)}
                  />
                ) : null}
                {classicGexOverlay.showLookbackDots ? classicGexOverlay.historyTargets.map(({ minutes, snapshot }) => {
                  const historical = snapshot.rows.find((candidate) => candidate.strike === row.strike);
                  if (!historical?.net) return null;
                  const x = classicGexOverlay.spineX
                    + (historical.net > 0 ? 1 : -1) * classicGexOverlay.scale(historical.net);
                  return (
                    <circle
                      key={`${row.strike}-${minutes}`}
                      cx={x}
                      cy={y}
                      r={minutes === 1 ? 2.1 : 1.55}
                      fill="var(--foreground)"
                      fillOpacity={minutes === 1 ? 0.9 : 0.52}
                      stroke={settings.backgroundColor}
                      strokeWidth={0.8}
                    />
                  );
                }) : null}
              </g>
            );
          })}
        </svg>
      ) : null}

      {classicGexTooltip && classicGexProfile ? (
        <div
          className="pointer-events-none absolute z-[80] w-[248px] rounded-xl border border-border bg-panel/96 p-3 font-mono text-[9px] leading-4 text-muted shadow-2xl backdrop-blur"
          style={{
            left: Math.max(8, Math.min(overlaySize.width - 258, classicGexTooltip.x + 14)),
            top: Math.max(8, Math.min(overlaySize.height - 196, classicGexTooltip.y + 12)),
          }}
        >
          <div className="mb-2 flex items-center justify-between text-foreground">
            <span className="font-semibold">Classic GEX</span>
            <span>{classicGexProfile.status}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <span>Mapping</span><span className="text-foreground">NQ / {classicGexProfile.sourceSymbol}</span>
            <span>Source strike</span><span className="text-foreground">{classicGexTooltip.row.strike.toFixed(2)}</span>
            <span>Mapped NQ</span><span className="text-foreground">{classicGexTooltip.row.mappedPrice.toFixed(priceFormat.precision)}</span>
            <span>Expiry</span><span className="text-foreground">{classicGexProfile.expiration ?? "All"}</span>
            <span>Call GEX / 1%</span><span style={{ color: classicGexOverlay?.positiveColor }}>{formatClassicGexValue(classicGexTooltip.row.call)}</span>
            <span>Put GEX / 1%</span><span style={{ color: classicGexOverlay?.negativeColor }}>{formatClassicGexValue(classicGexTooltip.row.put)}</span>
            <span>Net GEX / 1%</span><span className="text-foreground">{formatClassicGexValue(classicGexTooltip.row.net)}</span>
            <span>Contracts C / P</span><span className="text-foreground">{classicGexTooltip.row.callContracts ?? "—"} / {classicGexTooltip.row.putContracts ?? "—"}</span>
            <span>Gamma</span><span className="text-foreground">{classicGexTooltip.row.gamma ?? "provider aggregate"}</span>
            <span>Timestamp</span><span className="text-foreground">{new Date(classicGexProfile.asOf).toLocaleTimeString()}</span>
            <span>Data age</span><span className="text-foreground">{Math.round(classicGexProfile.dataAgeMs / 1000)}s</span>
          </div>
        </div>
      ) : null}

      {(
        positionedImbalanceZones.length > 0
        || positionedImbalanceSignals.length > 0
      ) ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[8] h-full w-full overflow-hidden"
          viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
          preserveAspectRatio="none"
        >
          {positionedImbalanceZones.map((zone) => {
            const trackerSettings = imbalanceTracker?.instance.settings ?? {};
            const useThemeColors = trackerSettings.useThemeColors !== false;
            const color = zone.side === "BUY"
              ? zone.triggered
                ? useThemeColors ? settings.borderUpColor : String(trackerSettings.buyTriggeredColor ?? settings.borderUpColor)
                : useThemeColors ? settings.upColor : String(trackerSettings.buyColor ?? settings.upColor)
              : zone.triggered
                ? useThemeColors ? settings.borderDownColor : String(trackerSettings.sellTriggeredColor ?? settings.borderDownColor)
                : useThemeColors ? settings.downColor : String(trackerSettings.sellColor ?? settings.downColor);
            const opacity = clamp(Number(trackerSettings.opacity ?? 78) / 100, 0.05, 1);
            return (
              <rect
                key={zone.id}
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill={color}
                fillOpacity={opacity * 0.14}
                stroke={color}
                strokeOpacity={opacity}
                strokeWidth={clamp(Number(trackerSettings.lineWidth ?? 1.5), 0.5, 5)}
                strokeDasharray={zone.triggered ? "3 4" : undefined}
              />
            );
          })}
          {positionedImbalanceSignals.map((signal) => {
            const rejectorSettings = imbalanceRejector?.instance.settings ?? {};
            const useThemeColors = rejectorSettings.useThemeColors !== false;
            const color = signal.side === "BULLISH"
              ? useThemeColors ? settings.upColor : String(rejectorSettings.bullishColor ?? settings.upColor)
              : useThemeColors ? settings.downColor : String(rejectorSettings.bearishColor ?? settings.downColor);
            const size = clamp(Number(rejectorSettings.markerSize ?? 8), 3, 24);
            const opacity = clamp(Number(rejectorSettings.opacity ?? 90) / 100, 0.1, 1);
            const points = signal.side === "BULLISH"
              ? `${signal.x},${signal.y - size} ${signal.x + size},${signal.y + size} ${signal.x - size},${signal.y + size}`
              : `${signal.x},${signal.y + size} ${signal.x + size},${signal.y - size} ${signal.x - size},${signal.y - size}`;
            return (
              <polygon
                key={signal.id}
                points={points}
                fill={color}
                fillOpacity={opacity * 0.35}
                stroke={color}
                strokeOpacity={opacity}
                strokeWidth={clamp(Number(rejectorSettings.markerThickness ?? 2), 0.5, 6)}
              />
            );
          })}
        </svg>
      ) : null}

      <ChartIndicatorPanes
        groups={orderedIndicatorPanes}
        width={overlaySize.width}
        priceScaleWidth={nativePriceScaleWidth}
        height={indicatorPaneHeight}
        chartHeight={overlaySize.height}
        bottom={24}
        viewportVersion={viewportVersion}
        paneHeights={resolvedIndicatorPaneHeights}
        collapsedPanes={collapsedIndicatorPanes}
        paneLayout={indicatorPaneLayout}
        timeToX={indicatorTimeToX}
        onResizePane={resizeIndicatorPane}
        onTogglePane={toggleIndicatorPane}
        onMovePane={moveIndicatorPane}
        onUpdateSetting={updateIndicatorPaneSetting}
        onOpenSettings={openIndicatorPaneSettings}
      />

      {deltaHighlightMarkers.length ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[9] h-full w-full overflow-visible"
        >
          {deltaHighlightMarkers.map((marker) => (
            <g
              key={`${marker.time}-${marker.side}`}
              transform={`translate(${marker.x} ${marker.y})`}
              opacity={marker.opacity}
            >
              {marker.shape === "circle" ? (
                <circle r={marker.size / 2} fill={marker.color} />
              ) : marker.shape === "diamond" ? (
                <rect
                  x={-marker.size / 2}
                  y={-marker.size / 2}
                  width={marker.size}
                  height={marker.size}
                  rx={1}
                  fill={marker.color}
                  transform="rotate(45)"
                />
              ) : (
                <rect
                  x={-marker.size / 2}
                  y={-marker.size / 2}
                  width={marker.size}
                  height={marker.size}
                  rx={Math.max(1, marker.size * 0.12)}
                  fill={marker.color}
                />
              )}
              {marker.showValue ? (
                <text
                  x={marker.size / 2 + 3}
                  y={3}
                  fill={marker.color}
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fontWeight="700"
                >
                  {`${marker.deltaPercent >= 0 ? "+" : ""}${marker.deltaPercent.toFixed(0)}%`}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      ) : null}

      {toolbarEnabled && chartVisualReady ? (
        <PrecisionToolsBoundary>
          <PrecisionToolsLayer
            workspaceId={workspaceId}
            chartId={`${chartInstanceId}:${normalizePaperSymbol(contractSymbol ?? instrument)}`}
            adapter={precisionAdapter}
            theme={precisionTheme}
            showChrome={false}
            externalActiveTool={precisionToolForDrawingTool(selectedTool)}
            externalSelectionMode={selectedTool === "selection"}
            externalKeepDrawing={keepDrawingMode}
            clearRevision={precisionClearRevision}
            onExternalToolComplete={() => setSelectedTool("cursor")}
            onExternalSelectionBox={selectProfessionalDrawingInScreenBox}
          />
        </PrecisionToolsBoundary>
      ) : null}

      {toolbarEnabled && (
      <div
        ref={toolbarRef}
        className={`absolute z-20 flex rounded-md border border-border/80 bg-panel/92 p-[2px] shadow-xl backdrop-blur-xl ${toolbarDock === "top" || toolbarDock === "bottom" ? "flex-row items-center" : "flex-col"}`}
        style={{
          ...toolbarDockStyle,
          gap: toolbarMetrics.gap,
          transition: "gap 70ms linear",
          "--chart-toolbar-icon": `${toolbarMetrics.iconSize}px`,
          "--chart-toolbar-tool-icon": `${Math.max(8, Math.round(toolbarMetrics.iconSize * 0.9))}px`,
        } as CSSProperties & Record<"--chart-toolbar-icon" | "--chart-toolbar-tool-icon", string>}
      >
        <button
          type="button"
          onClick={() => {
            if (toolbarToggleSuppressedRef.current) {
              toolbarToggleSuppressedRef.current = false;
              return;
            }
            setOpenToolbarGroup(null);
            setShowObjectsPanel(false);
            setToolbarCollapsed((current) => !current);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const container = chartContainerRef.current;
            const toolbar = toolbarRef.current;
            if (!container || !toolbar) return;
            const rect = container.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            const currentStyle = {
              x: toolbarRect.left - rect.left,
              y: toolbarRect.top - rect.top,
            };
            toolbarDragStateRef.current = {
              offsetX: event.clientX - toolbarRect.left,
              offsetY: event.clientY - toolbarRect.top,
              startClientX: event.clientX,
              startClientY: event.clientY,
              hasMoved: false,
            };
            setOpenToolbarGroup(null);
            setToolbarDragPosition({
              x: currentStyle.x,
              y: currentStyle.y,
            });
          }}
          className="flex items-center justify-center border border-transparent bg-transparent text-muted transition-all hover:bg-surface hover:text-foreground"
          style={toolbarButtonStyle}
          title={toolbarCollapsed ? "Expand toolbar" : "Collapse toolbar. Drag to dock on another chart edge"}
          aria-pressed={toolbarCollapsed}
        >
          <span className="grid grid-cols-2" style={{ gap: Math.max(2, Math.round(toolbarMetrics.gap / 2)) }} aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="rounded-full bg-current/85"
                style={{ width: toolbarMetrics.dragDotSize, height: toolbarMetrics.dragDotSize }}
              />
            ))}
          </span>
        </button>
        <button
          type="button"
          onPointerDown={chartDragEnabled ? onChartDragStart : undefined}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={`flex items-center justify-center border backdrop-blur transition-all ${
            chartDragEnabled
              ? "cursor-grab border-transparent bg-transparent text-muted hover:bg-surface hover:text-primary active:cursor-grabbing"
              : "cursor-not-allowed border-transparent bg-transparent text-muted/30"
          }`}
          style={toolbarButtonStyle}
          title={chartDragEnabled ? "Drag to dock left, right, above, below, or swap with another panel" : "Unlock the workspace and add another panel to arrange it"}
          aria-label="Move and dock chart"
        >
          <span className="grid grid-cols-2 gap-[2px]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="h-[2px] w-[2px] rounded-full bg-current" />
            ))}
          </span>
        </button>
        {!toolbarCollapsed && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenToolbarGroup(null);
              setShowObjectsPanel(false);
              setSelectedTool((current) => current === "selection" ? "cursor" : "selection");
            }}
            className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(selectedTool === "selection")}`}
            style={toolbarButtonStyle}
            title="Select drawings with a drag box"
            aria-pressed={selectedTool === "selection"}
          >
            <MousePointer2 className={toolbarIconClassName} />
          </button>
        )}
        {!toolbarCollapsed && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenToolbarGroup(null);
              setShowObjectsPanel(false);
              saveChartCrosshairSyncEnabled(!crosshairSyncEnabled);
            }}
            className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(crosshairSyncEnabled)}`}
            style={toolbarButtonStyle}
            title={crosshairSyncEnabled
              ? "Linked crosshair on: matching instruments move together"
              : "Link the crosshair across charts using the same instrument"}
            aria-label="Link crosshair across matching charts"
            aria-pressed={crosshairSyncEnabled}
          >
            <Crosshair className={toolbarIconClassName} />
          </button>
        )}
        {!toolbarCollapsed &&
          toolbarGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupedSections = groupToolsBySection(group.tools);
          return (
            <div key={group.id} className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowObjectsPanel(false);
                  setOpenToolbarGroup((current) => (current === group.id ? null : group.id));
                }}
                className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(group.isActive || openToolbarGroup === group.id)}`}
                style={toolbarButtonStyle}
                title={group.label}
              >
                <GroupIcon
                  className={`${toolbarIconClassName} ${
                    group.id === "favorites"
                      ? favoriteToolIds.length > 0
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-yellow-400"
                      : ""
                  }`}
                />
              </button>
              {openToolbarGroup === group.id && (
                <div
                  className={`absolute z-30 overflow-hidden rounded-2xl border border-border bg-panel/95 shadow-2xl backdrop-blur ${getToolbarMenuPositionClasses(toolbarDock)}`}
                  style={toolbarMenuStyle}
                >
                  <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {group.label}
                  </div>
                  <div className="overflow-y-auto p-2" style={{ maxHeight: toolbarMetrics.menuMaxHeight }}>
                    {group.id === "favorites" && group.tools.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                        <Star className="mx-auto h-5 w-5 text-yellow-400" />
                        <div className="mt-2 text-[12px] font-medium text-foreground">No favourite tools yet</div>
                        <div className="mt-1 text-[10px] leading-4 text-muted">
                          Open any tool group and select its star for quick access here.
                        </div>
                      </div>
                    ) : groupedSections.map((section, sectionIndex) => (
                      <div key={`${group.id}-${section.section}`} className={sectionIndex > 0 ? "mt-2 border-t border-border pt-2" : ""}>
                        {section.section.toLowerCase() !== group.label.toLowerCase() ? (
                          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                            {section.section}
                          </div>
                        ) : null}
                        {section.tools.map((tool) => {
                          const ToolIcon = tool.icon;
                          const active = selectedTool === tool.id;
                          const implemented = tool.id === "cursor"
                            || tool.id === "eraser"
                            || Boolean(precisionToolForDrawingTool(tool.id))
                            || isProfessionalDrawingTool(tool.id);
                          return (
                            <div
                              key={tool.id}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition-all ${
                                active
                                  ? "bg-primary/12 text-foreground"
                                  : implemented
                                    ? "text-muted hover:bg-surface hover:text-foreground"
                                    : "cursor-not-allowed text-muted/55"
                              }`}
                            >
                              <button
                                type="button"
                                aria-disabled={!implemented}
                                onClick={() => {
                                  if (!implemented) return;
                                  setSelectedTool(tool.id);
                                  setOpenToolbarGroup(null);
                                }}
                                className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
                                  implemented ? "" : "cursor-not-allowed"
                                }`}
                              >
                                <ToolIcon className={`${toolbarToolIconClassName} shrink-0 ${active ? "text-primary" : implemented ? "text-muted" : "text-muted/45"}`} />
                                <span className="min-w-0 flex-1 truncate font-medium">{tool.label}</span>
                                {tool.shortcut ? <span className="shrink-0 text-[12px] text-muted">{tool.shortcut}</span> : null}
                                {!implemented && !tool.shortcut ? <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-muted/50">Soon</span> : null}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavoriteTool(tool.id);
                                }}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-yellow-400/10 hover:text-yellow-300 ${
                                  favoriteToolIds.includes(tool.id) ? "text-yellow-400" : "text-muted/60"
                                }`}
                                aria-label={`${favoriteToolIds.includes(tool.id) ? "Remove" : "Add"} ${tool.label} ${favoriteToolIds.includes(tool.id) ? "from" : "to"} favourites`}
                                title={`${favoriteToolIds.includes(tool.id) ? "Remove from" : "Add to"} favourites`}
                              >
                                <Star className={`h-3.5 w-3.5 ${favoriteToolIds.includes(tool.id) ? "fill-current" : ""}`} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          })}

        {!toolbarCollapsed && (
          <div
            className="bg-border/70"
            style={
              toolbarDock === "top" || toolbarDock === "bottom"
                ? { width: 1, height: toolbarMetrics.buttonSize, marginInline: Math.max(2, Math.round(toolbarMetrics.gap / 2)) }
                : { height: 1, width: toolbarMetrics.buttonSize, marginBlock: Math.max(2, Math.round(toolbarMetrics.gap / 2)) }
            }
          />
        )}

        {!toolbarCollapsed && (
          <>
            <button
              type="button"
              onClick={() => setMagnetMode((current) => (
                current === "off" ? "weak" : current === "weak" ? "medium" : current === "medium" ? "strong" : "off"
              ))}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(magnetMode !== "off")}`}
              style={toolbarButtonStyle}
              title={`Magnet: ${magnetMode}`}
            >
              <Magnet className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setKeepDrawingMode((current) => !current)}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(keepDrawingMode)}`}
              style={toolbarButtonStyle}
              title={keepDrawingMode ? "Keep Drawing Mode on" : "Keep Drawing Mode off"}
              aria-pressed={keepDrawingMode}
            >
              <Pin className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={undoProfessionalDrawing}
              disabled={professionalUndoStackRef.current.length === 0}
              className="flex items-center justify-center border border-transparent bg-transparent text-muted transition-all hover:bg-surface hover:text-foreground disabled:opacity-30"
              style={toolbarButtonStyle}
              title="Undo drawing (Ctrl/Cmd+Z)"
            >
              <Undo2 className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={redoProfessionalDrawing}
              disabled={professionalRedoStackRef.current.length === 0}
              className="flex items-center justify-center border border-transparent bg-transparent text-muted transition-all hover:bg-surface hover:text-foreground disabled:opacity-30"
              style={toolbarButtonStyle}
              title="Redo drawing (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={duplicateSelectedProfessionalDrawing}
              disabled={!selectedProfessionalDrawingId}
              className="flex items-center justify-center border border-transparent bg-transparent text-muted transition-all hover:bg-surface hover:text-foreground disabled:opacity-30"
              style={toolbarButtonStyle}
              title="Duplicate selected drawing (Ctrl/Cmd+D)"
            >
              <Copy className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setDrawingsLocked((current) => {
                const next = !current;
                const manager = professionalDrawingManagerRef.current;
                manager?.getAllDrawings().forEach((drawing) => drawing.updateOptions({ locked: next }));
                if (manager) setProfessionalDrawings(manager.exportDrawings().filter((record) => record.id !== "__kwantdesk_drawing_preview__"));
                return next;
              })}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(drawingsLocked)}`}
              style={toolbarButtonStyle}
              title={drawingsLocked ? "Unlock drawings" : "Lock drawings"}
            >
              <Lock className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setHideDrawings((current) => {
                const next = !current;
                const manager = professionalDrawingManagerRef.current;
                manager?.getAllDrawings().forEach((drawing) => drawing.updateOptions({ visible: !next }));
                if (manager) setProfessionalDrawings(manager.exportDrawings().filter((record) => record.id !== "__kwantdesk_drawing_preview__"));
                return next;
              })}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(hideDrawings)}`}
              style={toolbarButtonStyle}
              title={hideDrawings ? "Show drawings" : "Hide drawings"}
            >
              <Eye className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setShowObjectsPanel((current) => !current)}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(showObjectsPanel)}`}
              style={toolbarButtonStyle}
              title="Object list"
            >
              <Link2 className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setShowDrawingSettings((current) => !current)}
              disabled={!selectedProfessionalDrawingId}
              className={`flex items-center justify-center border backdrop-blur disabled:opacity-30 ${getToolbarButtonTone(showDrawingSettings)}`}
              style={toolbarButtonStyle}
              title="Drawing settings and templates"
            >
              <Settings2 className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setClearConfirm(true)}
              className="flex items-center justify-center border border-transparent bg-transparent text-muted transition-all hover:bg-danger/10 hover:text-danger"
              style={toolbarButtonStyle}
              title="Clear all drawings"
            >
              <Trash2 className={toolbarIconClassName} />
            </button>
          </>
        )}
      </div>
      )}

      {toolbarEnabled && !toolbarCollapsed && showObjectsPanel && (
        <div className="absolute z-20 overflow-hidden rounded-2xl border border-border bg-panel/96 shadow-2xl backdrop-blur" style={objectsPanelStyle}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Objects</div>
              <div className="mt-1 text-[13px] text-foreground">{professionalDrawings.length} drawing{professionalDrawings.length === 1 ? "" : "s"}</div>
            </div>
            <button type="button" onClick={() => setShowObjectsPanel(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {professionalDrawings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                No drawings yet
              </div>
            ) : (
              professionalDrawings.map((drawing) => {
                const toolbarTool = professionalToolbarTool(drawing.type);
                const label = ALL_DRAWING_TOOLS.find((tool) => tool.id === toolbarTool)?.label ?? drawing.type;
                return (
                <div key={drawing.id} className="mb-2 flex items-center justify-between rounded-xl border border-border bg-surface/70 px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{label}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {drawing.anchors.length} anchor{drawing.anchors.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        professionalDrawingManagerRef.current?.selectDrawing(drawing.id);
                        setSelectedProfessionalDrawingId(drawing.id);
                      }}
                      className="rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
                      aria-label={`Select ${label}`}
                    >
                      <MousePointer2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = professionalDrawingManagerRef.current?.getDrawing(drawing.id);
                        target?.updateOptions({ visible: drawing.options.visible === false });
                        syncProfessionalManagerNow();
                      }}
                      className="rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
                      aria-label={`${drawing.options.visible === false ? "Show" : "Hide"} ${label}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = professionalDrawingManagerRef.current?.getDrawing(drawing.id);
                        target?.updateOptions({ locked: drawing.options.locked !== true });
                        syncProfessionalManagerNow();
                      }}
                      className="rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
                      aria-label={`${drawing.options.locked ? "Unlock" : "Lock"} ${label}`}
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => professionalDrawingManagerRef.current?.removeDrawing(drawing.id)} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {toolbarEnabled && showDrawingSettings && selectedProfessionalDrawing && (
        <aside
          data-chart-drawing-ui
          className="absolute bottom-0 right-0 top-0 z-40 w-[360px] overflow-y-auto border-l border-border bg-panel/98 shadow-2xl"
          aria-label="Drawing settings"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-panel px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Drawing settings</div>
              <div className="mt-1 text-[13px] font-medium text-foreground">
                {ALL_DRAWING_TOOLS.find((tool) => professionalDrawingType(tool.id) === selectedProfessionalDrawing.type)?.label ?? selectedProfessionalDrawing.type}
              </div>
            </div>
            <button type="button" onClick={() => setShowDrawingSettings(false)} className="p-1.5 text-muted hover:text-foreground" aria-label="Close drawing settings">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 p-4">
            <section className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Style</div>
              <label className="flex items-center justify-between gap-4 text-[12px] text-muted">
                Line colour
                <input
                  type="color"
                  value={selectedProfessionalDrawing.style.lineColor}
                  onChange={(event) => updateSelectedProfessionalDrawing({ lineColor: event.target.value, labelColor: event.target.value })}
                  className="h-8 w-12 border border-border bg-surface"
                />
              </label>
              <label className="block text-[12px] text-muted">
                <span className="mb-2 flex justify-between"><span>Line width</span><span>{selectedProfessionalDrawing.style.lineWidth.toFixed(1)} px</span></span>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.5}
                  value={selectedProfessionalDrawing.style.lineWidth}
                  onChange={(event) => updateSelectedProfessionalDrawing({ lineWidth: Number(event.target.value) })}
                  className="w-full accent-primary"
                />
              </label>
              <label className="block text-[12px] text-muted">
                <span className="mb-2 flex justify-between"><span>Fill opacity</span><span>{Math.round((selectedProfessionalDrawing.style.fillOpacity ?? 0.12) * 100)}%</span></span>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.01}
                  value={selectedProfessionalDrawing.style.fillOpacity ?? 0.12}
                  onChange={(event) => updateSelectedProfessionalDrawing({ fillOpacity: Number(event.target.value) })}
                  className="w-full accent-primary"
                />
              </label>
              <label className="block text-[12px] text-muted">
                <span className="mb-2 block">Line style</span>
                <select
                  value={(selectedProfessionalDrawing.style.lineDash ?? []).join(",")}
                  onChange={(event) => updateSelectedProfessionalDrawing({ lineDash: event.target.value ? event.target.value.split(",").map(Number) : [] })}
                  className="h-9 w-full border border-border bg-surface px-3 text-[12px] text-foreground outline-none focus:border-primary"
                >
                  <option value="">Solid</option>
                  <option value="6,4">Dashed</option>
                  <option value="2,3">Dotted</option>
                  <option value="10,4,2,4">Dash-dot</option>
                </select>
              </label>
            </section>

            <section className="space-y-2 border-t border-border pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Visibility and lock</div>
              <label className="flex items-center justify-between text-[12px] text-muted">
                Visible
                <input type="checkbox" checked={(selectedProfessionalDrawing.options.baseVisible ?? selectedProfessionalDrawing.options.visible) !== false} onChange={(event) => updateSelectedProfessionalDrawing({}, { baseVisible: event.target.checked, visible: event.target.checked })} className="accent-primary" />
              </label>
              <label className="flex items-center justify-between text-[12px] text-muted">
                Locked
                <input type="checkbox" checked={selectedProfessionalDrawing.options.locked === true} onChange={(event) => updateSelectedProfessionalDrawing({}, { locked: event.target.checked })} className="accent-primary" />
              </label>
              <label className="flex items-center justify-between text-[12px] text-muted">
                Extend left
                <input type="checkbox" checked={selectedProfessionalDrawing.options.extendLeft === true} onChange={(event) => updateSelectedProfessionalDrawing({}, { extendLeft: event.target.checked })} className="accent-primary" />
              </label>
              <label className="flex items-center justify-between text-[12px] text-muted">
                Extend right
                <input type="checkbox" checked={selectedProfessionalDrawing.options.extendRight === true} onChange={(event) => updateSelectedProfessionalDrawing({}, { extendRight: event.target.checked })} className="accent-primary" />
              </label>
              <label className="block text-[12px] text-muted">
                <span className="mb-2 block">Timeframe visibility</span>
                <select
                  value={!selectedProfessionalDrawing.options.timeframes?.length
                    ? "all"
                    : selectedProfessionalDrawing.options.timeframes.length === 1 && selectedProfessionalDrawing.options.timeframes[0] === timeframe
                      ? "current"
                      : selectedProfessionalDrawing.options.timeframes.join(",")}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateSelectedProfessionalDrawing({}, {
                      timeframes: value === "all"
                        ? []
                        : value === "current"
                          ? [timeframe ?? "1m"]
                          : value.split(","),
                    });
                  }}
                  className="h-9 w-full border border-border bg-surface px-3 text-[12px] text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All timeframes</option>
                  <option value="current">Current timeframe only</option>
                  <option value="1m,2m,3m,5m,10m,15m,30m,45m,1h">Intraday</option>
                  <option value="4h,1D,1W">Higher timeframes</option>
                </select>
              </label>
              <label className="block text-[12px] text-muted">
                <span className="mb-2 flex justify-between"><span>Layer order</span><span>{selectedProfessionalDrawing.options.zIndex ?? 0}</span></span>
                <input type="range" min={-10} max={10} step={1} value={selectedProfessionalDrawing.options.zIndex ?? 0} onChange={(event) => updateSelectedProfessionalDrawing({}, { zIndex: Number(event.target.value) })} className="w-full accent-primary" />
              </label>
            </section>

            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Templates</div>
                <button type="button" onClick={saveSelectedDrawingTemplate} className="border border-border bg-surface px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground hover:border-primary/50">
                  Save template
                </button>
              </div>
              {drawingTemplates.filter((template) => template.toolType === selectedProfessionalDrawing.type).length === 0 ? (
                <div className="border border-dashed border-border px-3 py-5 text-center text-[11px] text-muted">No saved templates for this tool.</div>
              ) : drawingTemplates.filter((template) => template.toolType === selectedProfessionalDrawing.type).map((template) => (
                <div key={template.id} className="flex items-center justify-between border border-border bg-surface/70 px-3 py-2">
                  <button type="button" onClick={() => makeDefaultDrawingTemplate(template)} className={template.isDefault ? "mr-2 text-primary" : "mr-2 text-muted hover:text-foreground"} aria-label={`Make ${template.name} the default`} title="Use as the default for new drawings">
                    <Star className="h-3.5 w-3.5" fill={template.isDefault ? "currentColor" : "none"} />
                  </button>
                  {renamingDrawingTemplateId === template.id ? (
                    <input
                      autoFocus
                      value={drawingTemplateNameDraft}
                      onChange={(event) => setDrawingTemplateNameDraft(event.target.value)}
                      onBlur={() => commitDrawingTemplateRename(template)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setRenamingDrawingTemplateId(null);
                          setDrawingTemplateNameDraft("");
                        }
                      }}
                      aria-label="Template name"
                      className="min-w-0 flex-1 border border-primary/50 bg-background px-2 py-1 text-[12px] text-foreground outline-none"
                    />
                  ) : (
                    <button type="button" onClick={() => applyDrawingTemplate(template)} onDoubleClick={() => beginRenameDrawingTemplate(template)} className="min-w-0 flex-1 truncate text-left text-[12px] text-foreground" title="Apply. Double-click to rename.">{template.name}</button>
                  )}
                  <button type="button" onClick={() => setDrawingTemplates((current) => current.filter((candidate) => candidate.id !== template.id))} className="p-1 text-muted hover:text-danger" aria-label={`Delete ${template.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </section>
          </div>
        </aside>
      )}

      {textEditor && (
        <div
          className="absolute z-30 w-64 rounded-2xl border border-border bg-panel/96 p-3 shadow-2xl backdrop-blur"
          style={{ left: textEditor.x, top: textEditor.y }}
        >
          {(() => {
            const chrome = getTextToolChrome(textEditor.tool);
            return (
              <>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Type className="h-3.5 w-3.5" />
            {chrome.title}
          </div>
          <textarea
            autoFocus
            value={textEditor.value}
            onChange={(event) => setTextEditor((current) => (current ? { ...current, value: event.target.value } : current))}
            placeholder={chrome.placeholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/40"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTextEditor(null)}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!textEditor.value.trim()) {
                  setTextEditor(null);
                  return;
                }
                const drawing = createProfessionalDrawing({
                  id: createId("drawing"),
                  tool: textEditor.tool,
                  anchors: [{ time: textEditor.time as Time, price: textEditor.price }],
                  style: {
                    lineColor: chrome.stroke,
                    lineWidth: 2,
                    lineDash: [],
                    fillColor: withAlpha(chrome.stroke, 0.12),
                    fillOpacity: 0.12,
                    showLabels: true,
                    labelFont: "12px 'JetBrains Mono', monospace",
                    labelColor: chrome.stroke,
                  },
                  options: { text: textEditor.value.trim() },
                });
                if (drawing) {
                  configureProfessionalDrawingMarketData(drawing, drawingMarketDataSource);
                  professionalDrawingManagerRef.current?.addDrawing(drawing);
                  professionalDrawingManagerRef.current?.selectDrawing(drawing.id);
                  if (!keepDrawingModeRef.current) setSelectedTool("cursor");
                }
                setTextEditor(null);
              }}
              className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-background"
            >
              Add
            </button>
          </div>
              </>
            );
          })()}
        </div>
      )}

      {positionSettingsDrawing && (
        <div
          data-position-settings-panel
          className="absolute right-3 top-16 z-30 w-[286px] overflow-hidden rounded-2xl border border-border bg-panel/96 shadow-2xl backdrop-blur-xl"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <div className="flex h-11 items-center border-b border-border px-3.5">
            <div>
              <div className="text-[11px] font-semibold text-foreground">Position style</div>
              <div className="text-[8px] uppercase tracking-[0.12em] text-muted">
                {positionSettingsDrawing.tool === "longPosition" ? "Long position" : "Short position"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPositionSettingsDrawingId(null)}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
              aria-label="Close position style"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-4 p-3.5">
            <div className="grid grid-cols-2 gap-2">
              {([
                ["Target", "targetColor"],
                ["Stop", "stopColor"],
                ["Entry line", "entryLineColor"],
                ["Label text", "textColor"],
              ] as const).map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-border bg-background/45 px-2.5 py-2">
                  <input
                    type="color"
                    value={activePositionStyle[key]}
                    onChange={(event) => updatePositionVisualSettings({ [key]: event.target.value })}
                    className="h-6 w-6 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    aria-label={`${label} color`}
                  />
                  <span>
                    <span className="block text-[9px] font-medium text-foreground">{label}</span>
                    <span className="block font-mono text-[8px] uppercase text-muted">{activePositionStyle[key]}</span>
                  </span>
                </label>
              ))}
            </div>

            {([
              ["Fill opacity", "fillOpacity", 0, 0.6, 0.01],
              ["Border opacity", "borderOpacity", 0.1, 1, 0.01],
              ["Line width", "lineWidth", 0.5, 4, 0.25],
            ] as const).map(([label, key, min, max, step]) => (
              <label key={key} className="block">
                <span className="mb-1.5 flex items-center justify-between text-[9px] font-medium text-muted">
                  <span>{label}</span>
                  <span className="font-mono text-foreground">
                    {key === "lineWidth" ? `${activePositionStyle[key].toFixed(2)} px` : `${Math.round(activePositionStyle[key] * 100)}%`}
                  </span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={activePositionStyle[key]}
                  onChange={(event) => updatePositionVisualSettings({ [key]: Number(event.target.value) })}
                  className="w-full accent-primary"
                />
              </label>
            ))}

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <label>
                <span className="mb-1.5 block text-[9px] font-medium text-muted">Line style</span>
                <select
                  value={activePositionStyle.lineStyle}
                  onChange={(event) => updatePositionVisualSettings({ lineStyle: event.target.value as PositionVisualSettings["lineStyle"] })}
                  className="h-9 w-full rounded-xl border border-border bg-surface px-2.5 text-[11px] text-foreground outline-none"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-[10px] text-foreground">
                <input
                  type="checkbox"
                  checked={activePositionStyle.showLabels}
                  onChange={(event) => updatePositionVisualSettings({ showLabels: event.target.checked })}
                  className="accent-primary"
                />
                Labels
              </label>
            </div>
          </div>

          <div className="flex items-center border-t border-border px-3.5 py-2.5">
            <span className="text-[8px] text-muted">Double-click the position to reopen</span>
            <button
              type="button"
              onClick={() => updatePositionVisualSettings({
                targetColor: undefined,
                stopColor: undefined,
                entryLineColor: undefined,
                textColor: undefined,
                fillOpacity: undefined,
                borderOpacity: undefined,
                lineWidth: undefined,
                lineStyle: undefined,
                showLabels: undefined,
              })}
              className="ml-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[9px] font-medium text-muted hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <svg
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-[12]"
        width={overlaySize.width || undefined}
        height={overlaySize.height || undefined}
        viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
        preserveAspectRatio="none"
        style={{ touchAction: "none" }}
      >
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="transparent"
          pointerEvents="none"
        />
        {zones.map((zone) => renderChartZone(zone))}
      </svg>

      {toolbarEnabled && activeToolbarTool && selectedTool !== "cursor" && (
        <div className="absolute left-16 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-panel/92 px-3 py-2 text-[12px] text-muted shadow-lg backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{activeToolbarTool.label}</span>
          <span>Click or drag on chart</span>
        </div>
      )}

      {tpoMergeSelection ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 border border-primary/45 bg-panel/95 px-3 py-2 text-[11px] font-medium text-foreground shadow-xl backdrop-blur">
          Select the other end of the TPO range <span className="ml-2 text-muted">Esc to cancel</span>
        </div>
      ) : null}

      {tpoDataStatus ? (
        <div className="pointer-events-none absolute bottom-8 left-3 z-20 border border-border bg-panel/92 px-2 py-1 font-mono text-[9px] font-semibold tracking-[0.08em] text-muted shadow-lg backdrop-blur">
          {tpoDataStatus}
        </div>
      ) : null}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 w-[280px] rounded-xl border border-border bg-panel py-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.tpoHit ? (
            <>
              <div className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                TPO profile
              </div>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.stopPropagation();
                  openIndicatorSettingsRef.current?.(contextMenu.tpoHit!.instanceId);
                  setContextMenu(null);
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
              >
                <Settings2 className="h-4 w-4 text-muted" />
                <span className="flex-1 text-left">TPO settings...</span>
              </button>
              {!contextMenu.tpoHit.profileId.startsWith("composite:") ? (
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setTpoMergeSelection({
                      instanceId: contextMenu.tpoHit!.instanceId,
                      anchorProfileId: contextMenu.tpoHit!.profileId,
                    });
                    setContextMenu(null);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
                >
                  <Layers3 className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-left">Merge profile range...</span>
                </button>
              ) : (
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    const mergeId = contextMenu.tpoHit!.profileId.slice("composite:".length);
                    setTpoMergeRecords((current) => current.filter((record) => record.id !== mergeId));
                    setContextMenu(null);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
                >
                  <Undo2 className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-left">Unmerge composite</span>
                </button>
              )}
              {tpoMergeRecords.some((record) => record.indicatorInstanceId === contextMenu.tpoHit!.instanceId) ? (
                <>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setTpoMergeRecords((current) => {
                        const candidates = current.filter((record) => record.indicatorInstanceId === contextMenu.tpoHit!.instanceId);
                        const last = candidates.sort((left, right) => right.createdAtMs - left.createdAtMs)[0];
                        return last ? current.filter((record) => record.id !== last.id) : current;
                      });
                      setContextMenu(null);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
                  >
                    <Undo2 className="h-4 w-4 text-muted" />
                    <span className="flex-1 text-left">Undo last TPO merge</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setTpoMergeRecords((current) => current.filter((record) => record.indicatorInstanceId !== contextMenu.tpoHit!.instanceId));
                      setContextMenu(null);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
                  >
                    <RotateCcw className="h-4 w-4 text-muted" />
                    <span className="flex-1 text-left">Unmerge all TPO profiles</span>
                  </button>
                </>
              ) : null}
              <div className="my-1 border-t border-border" />
            </>
          ) : null}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              chartRef.current?.timeScale().fitContent();
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Reset chart view</span>
            <span className="text-[11px] text-muted">Alt+R</span>
          </button>
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(contextMenu.price);
              setCopiedPrice(true);
              setTimeout(() => setCopiedPrice(false), 1000);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Copy className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">{copiedPrice ? "Copied!" : "Copy price " + contextMenu.price}</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              if (contextMenu.price) {
                onCreateAlertAtPrice?.(contextMenu.price);
              }
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Bell className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Add alert at {contextMenu.price}...</span>
          </button>
          {indicators.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemoveAllIndicators?.();
                window.dispatchEvent(new CustomEvent("kwantify:remove-all-indicators"));
                setContextMenu(null);
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
            >
              <Trash2 className="h-4 w-4 text-muted" />
              <span className="flex-1 text-left">Remove all indicators from chart</span>
            </button>
          ) : null}
          {matchingPaperFills.length > 0 && onRemovePaperFills ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onRemovePaperFills(matchingPaperFills.map((fill) => fill.id));
                setContextMenu(null);
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
            >
              <Trash2 className="h-4 w-4 text-muted" />
              <span className="flex-1 text-left">Remove all fills</span>
            </button>
          ) : null}
          {onResetPaperTrading ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                setResetPaperTradingConfirm(true);
                setContextMenu(null);
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4 text-danger" />
              <span className="flex-1 text-left">Reset all trades and fills</span>
            </button>
          ) : null}
          {(zones.length > 0 || backgroundZones.length > 0) && onRemoveGameplanOverlay ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemoveGameplanOverlay();
                setContextMenu(null);
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
            >
              <Layers3 className="h-4 w-4 text-primary" />
              <span className="flex-1 text-left">Remove all Kwant zones</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setClearConfirm(true);
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Trash2 className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Clear all drawings</span>
          </button>
          <button onMouseDown={(e) => e.stopPropagation()} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="flex-1 text-left">Buy 1 {instrument} @ {contextMenu.price}</span>
          </button>
          <button onMouseDown={(e) => e.stopPropagation()} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface">
            <ShoppingCart className="h-4 w-4 text-danger" />
            <span className="flex-1 text-left">Sell 1 {instrument} @ {contextMenu.price}</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              setContextMenu(null);
              onOpenSettings?.();
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Settings2 className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Chart settings...</span>
          </button>
        </div>
      )}

      {clearConfirm && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[320px] rounded-2xl border border-border bg-panel p-5 shadow-2xl">
            <div className="mb-2 text-[16px] font-semibold text-foreground">Clear all drawings?</div>
            <div className="text-[13px] leading-6 text-muted">
              This will remove all chart drawings for <span className="font-medium text-foreground">{instrument}</span>.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setClearConfirm(false)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllChartDrawings();
                  setClearConfirm(false);
                }}
                className="rounded-xl bg-danger px-4 py-2 text-[13px] font-semibold text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
      {resetPaperTradingConfirm && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[360px] rounded-2xl border border-danger/30 bg-panel p-5 shadow-2xl">
            <div className="mb-2 text-[16px] font-semibold text-foreground">Reset all trades and fills?</div>
            <div className="text-[13px] leading-6 text-muted">
              This permanently clears every open position, working order and fill in the selected sim account. Open and daily P&amp;L will return to zero.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setResetPaperTradingConfirm(false)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetPaperTrading?.();
                  setResetPaperTradingConfirm(false);
                }}
                className="rounded-xl bg-danger px-4 py-2 text-[13px] font-semibold text-white"
              >
                Reset everything
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {depthOfMarketIndicator ? (
        <DepthOfMarketPanel
          instrument={instrument}
          contractSymbol={contractSymbol}
          latestPrice={candles.at(-1)?.close ?? null}
          indicator={depthOfMarketIndicator}
          chartSettings={settings}
          onUpdateSetting={(key, value) =>
            onUpdateIndicatorSetting?.(depthOfMarketIndicator.instanceId, key, value)}
        />
      ) : null}
    </div>
  );
}
