"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
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
  RotateCcw,
  Ruler,
  ScanLine,
  Settings2,
  Shapes,
  ShoppingCart,
  Slash,
  SmilePlus,
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
  LIVE_CHART_CANDLE_EVENT,
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
import ChartIndicatorPanes, { type IndicatorPaneGroup } from "@/components/ChartIndicatorPanes";
import DepthOfMarketPanel from "@/components/DepthOfMarketPanel";
import GexBotFlowStrip from "@/components/GexBotFlowStrip";
import KwantLoader from "@/components/KwantLoader";
import { calculateBigTradePrints, type BigTradePrint } from "@/lib/bigTrades";
import {
  BigTradesPrimitive,
  type BigTradePrimitiveMarker,
  type BigTradesPrimitiveOptions,
} from "@/lib/bigTradesPrimitive";
import {
  buildFootprintBars,
  type FootprintImbalanceMode,
} from "@/lib/footprint";
import {
  FootprintPrimitive,
  type FootprintPrimitiveOptions,
  type FootprintRenderBar,
} from "@/lib/footprintPrimitive";
import { calculateDeepEffort } from "@/lib/deepEffort";
import { calculateImbalanceRejectorSignals } from "@/lib/imbalanceRejector";
import { calculateImbalanceZones } from "@/lib/imbalanceTracker";
import {
  type InstitutionalTrade,
  type InstitutionalVolumeProfile,
} from "@/lib/institutionalMarketData";
import {
  NativeVolumeProfilePrimitive,
  type NativeVolumeProfileModel,
} from "@/lib/nativeVolumeProfilePrimitive";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";
import {
  buildMarketSessionWindows,
  buildPreviousSessionHighLowLevels,
} from "@/lib/marketSessions";
import { calculateKwantStats } from "@/lib/kwantStats";
import { defaultChartSettings, type ChartSettings } from "@/lib/chartSettings";
import {
  DrawingManager,
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
  snapPaperPrice,
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

interface ChartProps {
  candles: Candle[];
  marketTrades?: InstitutionalTrade[];
  trades?: (Trade & { markerVisible?: boolean })[];
  levels?: ChartLevel[];
  zones?: ChartZone[];
  backgroundLevels?: ChartLevel[];
  backgroundZones?: ChartZone[];
  instrument?: string;
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
    update:
      | { kind: "stop_loss"; price: number | null }
      | { kind: "take_profit"; targetId: string; price: number; quantity?: number },
  ) => void;
  onClosePaperPosition?: (position: PaperPosition) => void;
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

type DrawingToolId =
  | "cursor"
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
  | "regressionTrend"
  | "flatTopBottom"
  | "disjointChannel"
  | "pitchfork"
  | "schiffPitchfork"
  | "modifiedSchiffPitchfork"
  | "insidePitchfork"
  | "anchoredVwap"
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
  | "measure"
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

const ALL_DRAWING_TOOLS = DRAWING_TOOLBAR_GROUPS.flatMap((group) => group.tools);
const DRAWING_TOOL_FAVORITES_STORAGE_KEY = "kwantify-chart-tool-favorites";
const DRAWING_TOOL_FAVORITES_EVENT = "kwantify-chart-tool-favorites-change";

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

function drawingsStorageKey(instrument: string) {
  return `kwantify-chart-drawings:${instrument}`;
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
      className="pointer-events-none absolute z-10 flex h-7 w-[54px] items-center justify-center rounded-lg bg-primary px-1.5 font-mono text-[10px] font-semibold leading-none text-background shadow-lg shadow-black/25"
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
  valueAreaLevelsError = null,
  valueAreaLevelsDescription = "",
  onToggleValueAreaLevels,
  onRemoveGameplanOverlay,
  liveCandleEventKey,
  gexBotFlow = null,
  onIndicatorPaneHeightChange,
  paperPositions = [],
  paperFills = [],
  onUpdatePaperProtection,
  onClosePaperPosition,
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
  const hedgeLevelsPrimitiveRef = useRef<HedgeLevelsPrimitive | null>(null);
  const sessionHighLowRenderDataRef = useRef<SessionHighLowRenderLevel[]>([]);
  const volumeProfilePrimitiveRef = useRef<NativeVolumeProfilePrimitive | null>(null);
  const bigTradesPrimitiveRef = useRef<BigTradesPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const footprintActiveRef = useRef(false);
  const footprintBarWidthRef = useRef<number | null>(null);
  const [paperDragPreview, setPaperDragPreview] = useState<{ id: string; price: number } | null>(null);
  const horzLineRef = useRef<HTMLDivElement>(null);
  const priceLabelRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: string } | null>(null);
  const [copiedPrice, setCopiedPrice] = useState(false);
  const [selectedTool, setSelectedTool] = useState<DrawingToolId>("cursor");
  const [openToolbarGroup, setOpenToolbarGroup] = useState<ToolbarGroupId | null>(null);
  const [favoriteToolIds, setFavoriteToolIds] = useState<DrawingToolId[]>([]);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const drawingsHydrationRef = useRef<{ instrument: string; ready: boolean }>({ instrument: "", ready: false });
  const [professionalDrawings, setProfessionalDrawings] = useState<ProfessionalDrawingRecord[]>([]);
  const professionalDrawingsRef = useRef<ProfessionalDrawingRecord[]>([]);
  const professionalDrawingsHydrationRef = useRef<{ instrument: string; ready: boolean }>({ instrument: "", ready: false });
  const professionalDrawingManagerRef = useRef<DrawingManager | null>(null);
  const professionalDrawingPreviewRef = useRef<ProfessionalDrawing | null>(null);
  const professionalPendingAnchorsRef = useRef<ProfessionalDrawingAnchor[]>([]);
  const professionalSyncSuppressedRef = useRef(false);
  const selectedToolRef = useRef<DrawingToolId>("cursor");
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [positionSettingsDrawingId, setPositionSettingsDrawingId] = useState<string | null>(null);
  const [drawingInteraction, setDrawingInteraction] = useState<DrawingInteraction | null>(null);
  const [hideDrawings, setHideDrawings] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [magnetMode, setMagnetMode] = useState<"off" | "weak" | "strong">("weak");
  const [toolbarDock, setToolbarDock] = useState<ToolbarDock>("left");
  const [toolbarDragPosition, setToolbarDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [showObjectsPanel, setShowObjectsPanel] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [textEditor, setTextEditor] = useState<{ x: number; y: number; time: number; price: number; value: string; tool: DrawingToolId } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
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
  const [indicatorPaneHeights, setIndicatorPaneHeights] = useState<Record<string, number>>({});
  const [collapsedIndicatorPanes, setCollapsedIndicatorPanes] = useState<Record<string, boolean>>({});
  const overlayRef = useRef<SVGSVGElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const viewportFrameRef = useRef<number | null>(null);
  const toolbarDragStateRef = useRef<{ offsetX: number; offsetY: number; startClientX: number; startClientY: number; hasMoved: boolean } | null>(null);
  const toolbarToggleSuppressedRef = useRef(false);
  const latestCandleRef = useRef<Candle | null>(candles.at(-1) ?? null);
  const lastRenderedCandleTimeRef = useRef<number | null>(
    candles.length ? Math.floor(candles[candles.length - 1].timestamp / 1_000) : null,
  );
  const lastRenderedSourceTimestampRef = useRef<number | null>(
    candles.at(-1)?.timestamp ?? null,
  );
  const eventSourceTimeByChartTimeRef = useRef(new Map<number, number>());
  const eventChartTimeBySourceTimeRef = useRef(new Map<number, number>());
  const indicatorSampleTimerRef = useRef<number | null>(null);
  const viewportResetFrameRef = useRef<number | null>(null);
  const chartVisualReadyTokenRef = useRef(0);
  const pendingIndicatorCandlesRef = useRef(candles);
  const pendingIndicatorMarketTradesRef = useRef(marketTrades);
  const sampledOrderFlowHistoryReadyRef = useRef(orderFlowHistoryReady);
  const updateIndicatorSettingRef = useRef(onUpdateIndicatorSetting);
  const openIndicatorSettingsRef = useRef(onOpenIndicatorSettings);

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

  useEffect(() => {
    const handleThemeChange = () => setThemeVersion((version) => version + 1);
    window.addEventListener("kwantdesk:theme-change", handleThemeChange);
    return () => window.removeEventListener("kwantdesk:theme-change", handleThemeChange);
  }, []);

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
      if (frame === null) frame = window.requestAnimationFrame(flush);
    };
    window.addEventListener(LIVE_CHART_CANDLE_EVENT, receive);
    return () => {
      window.removeEventListener(LIVE_CHART_CANDLE_EVENT, receive);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [liveCandleEventKey, timeframe]);

  useEffect(() => {
    updateIndicatorSettingRef.current = onUpdateIndicatorSetting;
    openIndicatorSettingsRef.current = onOpenIndicatorSettings;
  }, [onOpenIndicatorSettings, onUpdateIndicatorSetting]);

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
      setSampledIndicatorMarketTrades(marketTrades);
      return;
    }
    if (indicatorSampleTimerRef.current !== null) return;
    indicatorSampleTimerRef.current = window.setTimeout(() => {
      indicatorSampleTimerRef.current = null;
      setSampledIndicatorCandles(pendingIndicatorCandlesRef.current);
      setSampledIndicatorMarketTrades(pendingIndicatorMarketTradesRef.current);
    // The candle itself continues to render tick-by-tick. Expensive order-flow
    // studies only need a smooth sub-second sample; recalculating every 120 ms
    // across a growing execution tape eventually monopolises navigation.
    }, 400);
  }, [candles, marketTrades, orderFlowHistoryReady]);

  useEffect(() => () => {
    if (indicatorSampleTimerRef.current !== null) {
      window.clearTimeout(indicatorSampleTimerRef.current);
      indicatorSampleTimerRef.current = null;
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
  const resolvedLevelLayers = useMemo(
    () => resolveChartLevelOverlaps(levels ?? [], backgroundLevels, priceFormat.minMove),
    [backgroundLevels, levels, priceFormat.minMove],
  );
  const indicatorSignature = useMemo(() => JSON.stringify(indicators), [indicators]);
  const indicatorHistoryLimit = useMemo(
    () => indicators.some((instance) =>
      instance.enabled && CHART_INDICATOR_BY_ID.get(instance.indicatorId)?.requiresOrderFlow)
      ? 10_000
      : 1_500,
    [indicatorSignature, indicators],
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
  const footprintIndicator = useMemo(
    () => indicators.find((instance) =>
      instance.enabled && instance.indicatorId === "deep-print-footprint") ?? null,
    [indicatorSignature, indicators],
  );
  const footprintSettings = footprintIndicator?.settings ?? {};
  const footprintVisibleCandles = useMemo(() => {
    if (!footprintIndicator || !indicatorCandles.length) return [];
    const logical = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (!logical) return indicatorCandles.slice(-160);
    const sourceOffset = candles.length - indicatorCandles.length;
    const first = Math.max(0, Math.floor(Number(logical.from)) - sourceOffset - 8);
    const last = Math.min(indicatorCandles.length, Math.ceil(Number(logical.to)) - sourceOffset + 9);
    return first < last ? indicatorCandles.slice(first, last) : indicatorCandles.slice(-160);
  }, [candles.length, footprintIndicator, indicatorCandles, viewportVersion]);
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
    if (!footprintIndicator || !footprintVisibleCandles.length) return [];
    const start = footprintVisibleCandles[0].timestamp;
    const finalCandle = footprintVisibleCandles.at(-1)!;
    const approximateInterval = timeframeToMs(timeframe)
      ?? Math.max(1, finalCandle.timestamp - (footprintVisibleCandles.at(-2)?.timestamp ?? finalCandle.timestamp - 60_000));
    const end = finalCandle.timestamp + approximateInterval;
    const visibleTrades = indicatorMarketTrades.filter((record) =>
      record.timestamp >= start && record.timestamp < end);
    return buildFootprintBars(footprintVisibleCandles, visibleTrades, {
      tickSize: priceFormat.minMove,
      groupTicks: resolvedFootprintGroupTicks,
      minimumTradeVolume: Number(footprintSettings.minimumTradeVolume ?? 0),
      maximumTradeVolume: Number(footprintSettings.maximumTradeVolume ?? 0),
      imbalanceMode: (["diagonal", "horizontal", "delta-percent"].includes(String(footprintSettings.imbalanceMode))
        ? String(footprintSettings.imbalanceMode)
        : "diagonal") as FootprintImbalanceMode,
      minimumImbalancePercent: Number(footprintSettings.minimumImbalancePercent ?? 300),
      minimumDelta: Number(footprintSettings.minimumDelta ?? 10),
      includeZero: footprintSettings.includeZero === true,
    });
  }, [
    footprintIndicator,
    footprintSettings.imbalanceMode,
    footprintSettings.includeZero,
    footprintSettings.maximumTradeVolume,
    footprintSettings.minimumDelta,
    footprintSettings.minimumImbalancePercent,
    footprintSettings.minimumTradeVolume,
    footprintVisibleCandles,
    indicatorMarketTrades,
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
  const footprintPrimitiveOptions = useMemo((): FootprintPrimitiveOptions => {
    const useThemeColors = footprintSettings.useThemeColors !== false;
    const option = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) =>
      allowed.includes(String(value) as T) ? String(value) as T : fallback;
    return {
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
      barWidth: clamp(Number(footprintSettings.barWidth ?? 88), 44, 180),
      borderWidth: clamp(Number(footprintSettings.borderWidth ?? 1), 0.5, 4),
      opacity: clamp(Number(footprintSettings.backgroundOpacity ?? 74) / 100, 0, 1),
      fontSize: clamp(Number(footprintSettings.fontSize ?? 10), 6, 16),
      dynamicTextSize: footprintSettings.dynamicTextSize !== false,
      dynamicTextIncrease: clamp(Number(footprintSettings.dynamicTextIncrease ?? 1), 0, 2),
      showZeros: footprintSettings.showZeros === true,
      colorOnlyDominantSide: footprintSettings.colorOnlyDominantSide === true,
      showVolumePoc: footprintSettings.showVolumePoc !== false,
      showDeltaPoc: footprintSettings.showDeltaPoc === true,
      showValueArea: footprintSettings.showValueArea !== false,
      showSinglePrints: footprintSettings.showSinglePrints === true,
      singlePrintMaximum: Math.max(1, Number(footprintSettings.singlePrintMaximum ?? 1)),
      singlePrintExtremesOnly: footprintSettings.singlePrintExtremesOnly !== false,
      showRatio: footprintSettings.showRatio === true,
      minimumRatio: Math.max(0, Number(footprintSettings.minimumRatio ?? 1.5)),
      maximumRatio: Math.max(1, Number(footprintSettings.maximumRatio ?? 100)),
      showVolumeClusters: footprintSettings.showVolumeClusters === true,
      clusterMinimumVolume: Math.max(1, Number(footprintSettings.clusterMinimumVolume ?? 100)),
      showBarDelta: footprintSettings.showBarDelta !== false,
      outsideBarStyle: option(footprintSettings.outsideBarStyle, ["bar", "body"], "bar"),
      markerAlignment: option(footprintSettings.markerAlignment, ["center", "right"], "center"),
      outerEdgeMode: footprintSettings.outerEdgeMode !== false,
      askColor: useThemeColors ? settings.upColor : String(footprintSettings.askColor ?? settings.upColor),
      bidColor: useThemeColors ? settings.downColor : String(footprintSettings.bidColor ?? settings.downColor),
      neutralColor: useThemeColors ? settings.gridColor : String(footprintSettings.neutralColor ?? settings.gridColor),
      textColor: String(footprintSettings.textColor ?? "#F5F5F5"),
      pocColor: useThemeColors ? settings.borderUpColor : String(footprintSettings.pocColor ?? settings.borderUpColor),
      deltaPocColor: useThemeColors ? settings.borderDownColor : String(footprintSettings.deltaPocColor ?? settings.borderDownColor),
      clusterColor: String(footprintSettings.clusterColor ?? "#F59E0B"),
      singlePrintColor: String(footprintSettings.singlePrintColor ?? "#F4F4F5"),
      backgroundColor: settings.backgroundColor,
    };
  }, [footprintSettings, settings]);
  const footprintHasPriceLevelFlow = footprintRenderBars.some((bar) => bar.hasPriceLevelFlow);

  useEffect(() => {
    const primitive = footprintPrimitiveRef.current;
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!primitive || !series || !chart) return;
    primitive.update(
      footprintIndicator && footprintHasPriceLevelFlow ? footprintRenderBars : [],
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
      if (
        !footprintActiveRef.current
        || footprintBarWidthRef.current !== footprintPrimitiveOptions.barWidth
      ) {
        chart.timeScale().applyOptions({
          barSpacing: footprintPrimitiveOptions.barWidth,
          minBarSpacing: 12,
        });
        footprintActiveRef.current = true;
        footprintBarWidthRef.current = footprintPrimitiveOptions.barWidth;
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
    footprintRenderBars,
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
          title: instance.indicatorId === "delta-bar" ? "Delta" : "Cumulative Delta",
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
  const indicatorPaneHeight = useMemo(
    () => calculatedIndicatorPanes.reduce(
      (total, group) => total + (
        collapsedIndicatorPanes[group.key] ? 30 : resolvedIndicatorPaneHeights[group.key]
      ),
      0,
    ),
    [calculatedIndicatorPanes, collapsedIndicatorPanes, resolvedIndicatorPaneHeights],
  );
  useEffect(() => {
    onIndicatorPaneHeightChange?.(indicatorPaneHeight);
  }, [indicatorPaneHeight, onIndicatorPaneHeightChange]);
  useEffect(
    () => () => onIndicatorPaneHeightChange?.(0),
    [onIndicatorPaneHeightChange],
  );
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
    const lines = [
      majorLine(profileSettings.showMajorPositiveVolume !== false, liveMajors?.volPositive, classicGexProfile.majors.positiveVolume, "Major + Vol", "#22C55E", "7 5"),
      majorLine(profileSettings.showMajorNegativeVolume !== false, liveMajors?.volNegative, classicGexProfile.majors.negativeVolume, "Major - Vol", "#EF4444", "7 5"),
      majorLine(profileSettings.showMajorPositiveOpenInterest !== false, liveMajors?.oiPositive, classicGexProfile.majors.positiveOpenInterest, "Major + OI", "#4ADE80", "2 4"),
      majorLine(profileSettings.showMajorNegativeOpenInterest !== false, liveMajors?.oiNegative, classicGexProfile.majors.negativeOpenInterest, "Major - OI", "#FB7185", "2 4"),
      majorLine(profileSettings.showZeroGamma !== false, liveMajors?.zeroGamma, classicGexProfile.zeroGamma, "Zero Gamma", String(profileSettings.zeroGammaColor ?? "#F4F4F5"), "9 5"),
    ].filter((line): line is NonNullable<typeof line> => Boolean(line)).flatMap((line) => {
      const y = candleSeriesRef.current?.priceToCoordinate(line.mappedPrice) ?? null;
      return y === null || y < 2 || y > plotHeight ? [] : [{ ...line, y }];
    });
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
    viewportVersion,
  ]);
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
  const indicatorTimeToX = useCallback(
    (time: number) => chartRef.current?.timeScale().timeToCoordinate(time as Time) ?? null,
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
    type AnchoredBigTradePrint = BigTradePrint & { chartTimestamp: number };
    const anchored = bigTradePrints.flatMap((print): AnchoredBigTradePrint[] => {
      if (print.timestamp < indicatorCandles[0].timestamp) return [];
      let low = 0;
      let high = indicatorCandles.length - 1;
      let anchorIndex = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (indicatorCandles[middle].timestamp <= print.timestamp) {
          anchorIndex = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      return [{ ...print, chartTimestamp: indicatorCandles[anchorIndex].timestamp }];
    });
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
  const positionedEffortZones = useMemo(() => {
    if (!deepEffort || deepEffortIndicator?.settings?.showZones === false) return [];
    return deepEffort.zones.flatMap((zone) => {
      const startCandle = indicatorCandles[zone.startIndex];
      if (!startCandle) return [];
      const endCandle = indicatorCandles[Math.min(zone.endIndex, indicatorCandles.length - 1)];
      const startX = indicatorTimestampToX(startCandle.timestamp);
      const endX = endCandle
        ? indicatorTimestampToX(endCandle.timestamp)
        : null;
      const topY = candleSeriesRef.current?.priceToCoordinate(zone.top) ?? null;
      const bottomY = candleSeriesRef.current?.priceToCoordinate(zone.bottom) ?? null;
      if (startX === null || topY === null || bottomY === null) return [];
      const left = Math.max(-2, startX);
      const right = Math.min(
        Math.max(overlaySize.width - 58, 0),
        endX ?? Math.max(overlaySize.width - 58, 0),
      );
      if (right <= left) return [];
      return [{
        ...zone,
        x: left,
        width: right - left,
        y: Math.min(topY, bottomY),
        height: Math.max(2, Math.abs(bottomY - topY)),
      }];
    });
  }, [
    chartReadyRevision,
    deepEffort,
    deepEffortIndicator?.settings?.showZones,
    indicatorCandles,
    indicatorTimestampToX,
    overlaySize.width,
    viewportVersion,
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
  const positionedSessionWindows = useMemo(() => marketSessionWindows.flatMap((session) => {
    const startX = indicatorTimeToX(Math.floor(session.startTimestamp / 1_000));
    const endX = indicatorTimeToX(Math.floor(session.endTimestamp / 1_000));
    const topY = candleSeriesRef.current?.priceToCoordinate(session.high) ?? null;
    const bottomY = candleSeriesRef.current?.priceToCoordinate(session.low) ?? null;
    if (startX === null || endX === null || topY === null || bottomY === null) return [];
    return [{
      ...session,
      x: startX,
      width: Math.max(2, endX - startX),
      y: Math.min(topY, bottomY),
      height: Math.max(2, Math.abs(bottomY - topY)),
    }];
  }), [
    chartReadyRevision,
    indicatorTimeToX,
    marketSessionWindows,
    viewportVersion,
  ]);
  const toolbarMetrics = useMemo(() => {
    const availableWidth = overlaySize.width > 0 ? Math.max(180, overlaySize.width - 16) : 920;
    const availableHeight = overlaySize.height > 0 ? Math.max(150, overlaySize.height - 16) : 700;
    const widthScale = availableWidth / 884;
    const heightScale = availableHeight / 684;
    const scale = clamp(Math.min(widthScale, heightScale), 0.3, 1);
    const smooth = (value: number, minimum: number) =>
      Math.max(minimum, Number((value * scale).toFixed(2)));
    const buttonSize = smooth(38, 13.2);
    const iconSize = smooth(17, 7);
    const gap = smooth(3, 1.5);
    return {
      scale,
      buttonSize,
      iconSize,
      gap,
      radius: smooth(7, 3),
      dockOffset: smooth(12, 3),
      dockStart: Math.max(buttonSize + 3, smooth(64, 20)),
      menuWidth: Math.max(180, Number((420 * scale).toFixed(2))),
      menuMaxHeight: `${Number((46 + 28 * scale).toFixed(2))}vh`,
      objectsPanelWidth: Math.max(170, Number((288 * scale).toFixed(2))),
      dragDotSize: smooth(6, 2.5),
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
    for (const group of DRAWING_TOOLBAR_GROUPS) {
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
    professionalDrawingsRef.current = records;
    const manager = professionalDrawingManagerRef.current;
    if (!manager) return;
    professionalSyncSuppressedRef.current = true;
    manager.clearAll();
    records.forEach((record) => {
      const drawing = drawingFromSerialized(record);
      if (drawing) manager.addDrawing(drawing);
    });
    professionalSyncSuppressedRef.current = false;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    professionalDrawingsHydrationRef.current = { instrument, ready: false };
    let cached: ProfessionalDrawingRecord[] = [];
    try {
      const raw = window.localStorage.getItem(drawingsStorageKey(instrument));
      cached = normalizeProfessionalDrawings(raw ? JSON.parse(raw) : []);
    } catch {
      cached = [];
    }
    setDrawings([]);
    setProfessionalDrawings(cached);
    replaceProfessionalManagerDrawings(cached);

    void fetch(`/api/chart-drawings?instrument=${encodeURIComponent(instrument)}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => response.ok ? response.json() as Promise<{ configured?: boolean; drawings?: unknown }> : null)
      .then((payload) => {
        if (cancelled || !payload?.configured || !Array.isArray(payload.drawings)) return;
        const records = normalizeProfessionalDrawings(payload.drawings);
        setProfessionalDrawings(records);
        replaceProfessionalManagerDrawings(records);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) professionalDrawingsHydrationRef.current = { instrument, ready: true };
      });
    return () => { cancelled = true; };
  // Manager replacement reads refs intentionally; the instrument owns hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument]);

  useEffect(() => {
    professionalDrawingsRef.current = professionalDrawings;
    if (typeof window === "undefined") return;
    if (!professionalDrawingsHydrationRef.current.ready || professionalDrawingsHydrationRef.current.instrument !== instrument) return;
    try {
      window.localStorage.setItem(drawingsStorageKey(instrument), JSON.stringify(professionalDrawings));
    } catch {
      // Keep drawing responsive when browser storage is unavailable.
    }
    const timeout = window.setTimeout(() => {
      void fetch("/api/chart-drawings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument, drawings: professionalDrawings }),
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [instrument, professionalDrawings]);

  useEffect(() => {
    selectedToolRef.current = selectedTool;
    const manager = professionalDrawingManagerRef.current;
    const activeType = professionalDrawingType(selectedTool);
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
      setSelectedTool("cursor");
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
    const hedgeLevelsPrimitive = new HedgeLevelsPrimitive();
    candleSeries.attachPrimitive(hedgeLevelsPrimitive);
    hedgeLevelsPrimitiveRef.current = hedgeLevelsPrimitive;
    const volumeProfilePrimitive = new NativeVolumeProfilePrimitive();
    candleSeries.attachPrimitive(volumeProfilePrimitive);
    volumeProfilePrimitiveRef.current = volumeProfilePrimitive;
    const bigTradesPrimitive = new BigTradesPrimitive();
    candleSeries.attachPrimitive(bigTradesPrimitive);
    bigTradesPrimitiveRef.current = bigTradesPrimitive;
    const footprintPrimitive = new FootprintPrimitive();
    candleSeries.attachPrimitive(footprintPrimitive);
    footprintPrimitiveRef.current = footprintPrimitive;

    const chartData = buildSafeChartData(
      candles,
      timeframeToMs(timeframe) === null,
      eventSourceTimeByChartTimeRef.current,
      eventChartTimeBySourceTimeRef.current,
    );

    candleSeries.setData(chartData);
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
    drawingManager.setActiveTool(professionalDrawingType(selectedToolRef.current));

    const syncProfessionalDrawingState = () => {
      if (professionalSyncSuppressedRef.current) return;
      const records = drawingManager.exportDrawings().filter((record) => record.id !== "__kwantdesk_drawing_preview__");
      professionalDrawingsRef.current = records;
      setProfessionalDrawings(records);
    };
    const drawingUnsubscribers = [
      drawingManager.on("drawing:added", syncProfessionalDrawingState),
      drawingManager.on("drawing:removed", syncProfessionalDrawingState),
      drawingManager.on("drawing:updated", syncProfessionalDrawingState),
      drawingManager.on("drawing:cleared", syncProfessionalDrawingState),
    ];
    replaceProfessionalManagerDrawings(professionalDrawingsRef.current);

    const drawingPointFromMouse = (event: MouseEvent): ProfessionalDrawingAnchor | null => {
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const time = chart.timeScale().coordinateToTime(x);
      const price = candleSeries.coordinateToPrice(y);
      return time === null || price === null ? null : { time, price };
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
      const pending = professionalPendingAnchorsRef.current;
      pending.push(point);
      const required = requiredProfessionalAnchors(tool);
      if (pending.length < required) {
        removeProfessionalPreview();
        const previewAnchors = [...pending];
        while (previewAnchors.length < required) previewAnchors.push({ ...point });
        const preview = createProfessionalDrawing({
          tool,
          id: "__kwantdesk_drawing_preview__",
          anchors: previewAnchors,
          style: drawingStyle,
        });
        if (preview) {
          professionalDrawingPreviewRef.current = preview;
          drawingManager.addDrawing(preview);
        }
        return;
      }

      removeProfessionalPreview();
      const drawing = createProfessionalDrawing({
        tool,
        id: createId("drawing"),
        anchors: pending.slice(0, required),
        style: drawingStyle,
      });
      professionalPendingAnchorsRef.current = [];
      if (drawing) {
        drawingManager.addDrawing(drawing);
        drawingManager.selectDrawing(drawing.id);
      }
      setSelectedTool("cursor");
    };

    const handleProfessionalDrawingMove = (event: MouseEvent) => {
      const tool = selectedToolRef.current;
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
      event.preventDefault();
      event.stopPropagation();
    };

    chartContainerRef.current.addEventListener("click", handleProfessionalDrawingClick, true);
    chartContainerRef.current.addEventListener("mousemove", handleProfessionalDrawingMove, true);
    chartContainerRef.current.addEventListener("mousedown", handleProfessionalDrawingPointerDown, true);
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
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;

      if (event.buttons !== 0) {
        scheduleViewportRefresh();
      }

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

      setContextMenu({ x, y, price });
    };

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
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

    const scheduleViewportRefresh = () => {
      if (viewportFrameRef.current != null) return;
      viewportFrameRef.current = window.requestAnimationFrame(() => {
        viewportFrameRef.current = null;
        syncNativePriceScaleWidth();
        setViewportVersion((current) => current + 1);
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
      removeProfessionalPreview();
      drawingUnsubscribers.forEach((unsubscribe) => unsubscribe());
      drawingManager.detach();
      if (professionalDrawingManagerRef.current === drawingManager) professionalDrawingManagerRef.current = null;
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("contextmenu", handleContextMenu);
      container.removeEventListener("wheel", handlePriceScaleWheel, { capture: true });
      window.removeEventListener("resize", handleResize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleViewportRefresh);
      resizeObserver.disconnect();
      if (viewportFrameRef.current != null) {
        window.cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
      }
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
        if (candleSeriesRef.current && hedgeLevelsPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(hedgeLevelsPrimitiveRef.current);
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
        if (candleSeriesRef.current && footprintPrimitiveRef.current) {
          try {
            candleSeriesRef.current.detachPrimitive(footprintPrimitiveRef.current);
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
      hedgeLevelsPrimitiveRef.current = null;
      volumeProfilePrimitiveRef.current = null;
      bigTradesPrimitiveRef.current = null;
      footprintPrimitiveRef.current = null;
      footprintActiveRef.current = false;
      footprintBarWidthRef.current = null;
      indicatorSeriesRefs.current = [];
      priceLinesRef.current = [];
      prevCandlesLengthRef.current = 0;
      prevFirstTimestampRef.current = null;
      prevDataRef.current = "";
      lastRenderedCandleTimeRef.current = null;
    };
  }, [instrument, priceFormat, settings, themeVersion]);

  useEffect(() => {
    const primitive = volumeProfilePrimitiveRef.current;
    if (!primitive) return;
    const dailyInstance = indicators.find((instance) =>
      instance.enabled
      && [
        "daily-volume-profile",
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
          snapMode: profile.period === "daily" && requestedSnapMode === "right"
            ? "off"
            : requestedSnapMode,
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
    series.priceScale().applyOptions({
      scaleMargins: {
        top: 0.08,
        bottom: indicatorPaneHeight > 0 ? Math.min(0.72, 0.04 + paneRatio) : 0.08,
      },
    });
  }, [chartReadyRevision, indicatorPaneHeight, overlaySize.height]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingContext =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable;

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
      if (!isTypingContext && (event.key === "Delete" || event.key === "Backspace")) {
        const selected = professionalDrawingManagerRef.current?.getSelectedDrawing();
        if (selected) {
          event.preventDefault();
          professionalDrawingManagerRef.current?.removeDrawing(selected.id);
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
  }, [drawings.length, selectedDrawingId, showObjectsPanel]);

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
  const toolbarGroups = useMemo(
    () => [
      {
        id: "favorites" as const,
        label: "Favourite Tools",
        icon: Star,
        tools: favoriteTools,
        isActive: favoriteToolIds.includes(selectedTool),
      },
      ...DRAWING_TOOLBAR_GROUPS.map((group) => ({
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

  void viewportVersion;
  const visiblePaperPositions = paperPositions.filter((position) =>
    position.status === "open"
    && position.remainingQuantity > 0
    && normalizePaperSymbol(position.symbol) === normalizePaperSymbol(instrument));
  const paperOverlayLevels = visiblePaperPositions.flatMap((position) => {
    const entry = [{
      id: `${position.id}-entry`,
      kind: "entry" as const,
      price: position.entryPrice,
      label: `${position.side === "buy" ? "LONG" : "SHORT"} ${position.remainingQuantity} @ ${position.entryPrice.toFixed(priceFormat.precision)} · ${position.unrealizedPnl >= 0 ? "+" : "-"}$${Math.abs(position.unrealizedPnl).toFixed(2)}`,
      color: position.side === "buy" ? settings.upColor : settings.downColor,
      position,
      targetId: null as string | null,
    }];
    const stop = position.stopLoss === null ? [] : [{
      id: `${position.id}-sl`,
      kind: "stop_loss" as const,
      price: position.stopLoss,
      label: `SL ${position.stopLoss.toFixed(priceFormat.precision)}`,
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
        label: `TP${index + 1} ${target.price.toFixed(priceFormat.precision)} · ${target.quantity - target.filledQuantity}`,
        color: settings.upColor,
        position,
        targetId: target.id,
      }));
    return [...entry, ...stop, ...targets];
  }).map((level) => {
    const displayPrice = paperDragPreview?.id === level.id ? paperDragPreview.price : level.price;
    return {
    ...level,
    price: displayPrice,
    label: paperDragPreview?.id === level.id
      ? `${level.kind === "stop_loss" ? "SL" : "TP"} ${displayPrice.toFixed(priceFormat.precision)}`
      : level.label,
    y: candleSeriesRef.current?.priceToCoordinate(displayPrice) ?? null,
    };
  }).filter((level): level is typeof level & { y: number } => Number.isFinite(level.y));
  const visiblePaperFills = paperFills
    .filter((fill) => normalizePaperSymbol(fill.symbol) === normalizePaperSymbol(instrument))
    .map((fill) => ({
      fill,
      x: chartRef.current?.timeScale().timeToCoordinate(Math.floor(fill.timestamp / 1_000) as Time) ?? null,
      y: candleSeriesRef.current?.priceToCoordinate(fill.price) ?? null,
    }))
    .filter((marker): marker is typeof marker & { x: number; y: number } => Number.isFinite(marker.x) && Number.isFinite(marker.y));

  const startPaperProtectionDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    level: (typeof paperOverlayLevels)[number],
  ) => {
    if (level.kind === "entry" || !onUpdatePaperProtection) return;
    event.preventDefault();
    event.stopPropagation();
    const container = chartContainerRef.current;
    const series = candleSeriesRef.current;
    if (!container || !series) return;
    let latestPrice = level.price;
    const updatePreview = (clientY: number) => {
      const bounds = container.getBoundingClientRect();
      const price = series.coordinateToPrice(clientY - bounds.top);
      if (price === null || !Number.isFinite(price)) return;
      latestPrice = snapPaperPrice(level.position.symbol, price);
      setPaperDragPreview({ id: level.id, price: latestPrice });
    };
    const handleMove = (moveEvent: PointerEvent) => updatePreview(moveEvent.clientY);
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      setPaperDragPreview(null);
      if (level.kind === "stop_loss") {
        onUpdatePaperProtection(level.position.accountId, level.position.id, { kind: "stop_loss", price: latestPrice });
      } else if (level.targetId) {
        onUpdatePaperProtection(level.position.accountId, level.position.id, {
          kind: "take_profit",
          targetId: level.targetId,
          price: latestPrice,
        });
      }
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp, { once: true });
  };

  return (
    <div className="flex h-full w-full min-w-0 overflow-hidden">
      <div
        ref={chartContainerRef}
        className="relative h-full min-w-0 flex-1 overflow-hidden"
        data-volume-profile-count={volumeProfiles.length}
        data-volume-profile-provider={volumeProfiles.at(-1)?.provider ?? "none"}
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
          className="pointer-events-none absolute left-0 z-[31] border-t"
          style={{
            right: nativePriceScaleWidth,
            top: level.y,
            borderColor: level.color,
            borderTopStyle: level.kind === "entry" ? "solid" : "dashed",
            opacity: 0.92,
          }}
        >
          {level.kind === "entry" ? (
            <div
              className="pointer-events-auto absolute right-2 flex -translate-y-1/2 items-center overflow-hidden rounded-md border bg-panel/95 font-mono text-[9px] font-semibold shadow-lg backdrop-blur"
              style={{ borderColor: level.color, color: level.color }}
              title={`Unrealized ${level.position.unrealizedPnl.toFixed(2)}`}
            >
              <span className="px-2 py-1">{level.label}</span>
              {onClosePaperPosition ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClosePaperPosition(level.position);
                  }}
                  className="flex self-stretch items-center border-l px-1.5 transition-colors hover:bg-danger/15 hover:text-danger"
                  style={{ borderColor: level.color }}
                  title="Close this position at the live bid/ask"
                  aria-label={`Close ${level.position.symbol} position`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onPointerDown={(event) => startPaperProtectionDrag(event, level)}
              className="pointer-events-auto absolute right-2 -translate-y-1/2 cursor-ns-resize rounded-md border bg-panel/95 px-2 py-1 font-mono text-[9px] font-semibold shadow-lg backdrop-blur hover:brightness-125"
              style={{ borderColor: level.color, color: level.color }}
              title="Drag to adjust protection"
            >
              {level.label}
            </button>
          )}
        </div>
      ))}
      {visiblePaperFills.map(({ fill, x, y }) => (
        <div
          key={fill.id}
          className="pointer-events-none absolute z-[32] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-panel/95 px-1.5 py-0.5 font-mono text-[8px] font-bold shadow-lg"
          style={{ left: x, top: y, borderColor: fill.side === "buy" ? settings.upColor : settings.downColor, color: fill.side === "buy" ? settings.upColor : settings.downColor }}
          title={`${fill.label} · ${fill.quantity} @ ${fill.price}`}
        >
          {fill.side === "buy" ? "▲" : "▼"}
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

      {(gammaLevelsError || valueAreaLevelsError || historicalStructureError) ? (
        <div className="pointer-events-none absolute right-[70px] top-[138px] z-[15] flex max-w-[430px] flex-col items-end gap-1">
          {[
            gammaLevelsError ? `Kwant Levels · ${gammaLevelsError}` : null,
            valueAreaLevelsError ? `Value Area · ${valueAreaLevelsError}` : null,
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
          style={{ opacity: classicGexProfile?.stale ? 0.42 : 1 }}
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
        positionedSessionWindows.length > 0
        || positionedEffortZones.length > 0
        || positionedImbalanceZones.length > 0
        || positionedImbalanceSignals.length > 0
      ) ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[8] h-full w-full overflow-hidden"
          viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
          preserveAspectRatio="none"
        >
          {positionedSessionWindows.map((session) => {
            const sessionSettings = sessionsIndicator?.settings ?? {};
            const fillOpacity = clamp(Number(sessionSettings.fillOpacity ?? 10) / 100, 0, 1);
            const lineOpacity = clamp(Number(sessionSettings.lineOpacity ?? 65) / 100, 0, 1);
            const labelSize = String(sessionSettings.labelSize ?? "small");
            const fontSize = labelSize === "tiny" ? 8 : labelSize === "normal" ? 11 : 9;
            const change = session.close - session.open;
            const suffix = sessionSettings.showPercentChange === true && session.open
              ? ` ${(change / session.open * 100).toFixed(2)}%`
              : sessionSettings.showPointChange === true
                ? ` ${change >= 0 ? "+" : ""}${change.toFixed(priceFormat.precision)}`
                : "";
            return (
              <g key={`${session.key}-${session.startTimestamp}`}>
                {sessionSettings.showBackground !== false ? (
                  <rect
                    x={session.x}
                    y={session.y}
                    width={session.width}
                    height={session.height}
                    fill={session.color}
                    fillOpacity={fillOpacity}
                  />
                ) : null}
                {sessionSettings.showBorders !== false ? (
                  <rect
                    x={session.x}
                    y={session.y}
                    width={session.width}
                    height={session.height}
                    fill="none"
                    stroke={session.color}
                    strokeOpacity={lineOpacity}
                    strokeWidth={clamp(Number(sessionSettings.borderWidth ?? 1), 0, 4)}
                    strokeDasharray={String(sessionSettings.lineStyle ?? "dashed") === "dotted"
                      ? "1 4"
                      : String(sessionSettings.lineStyle ?? "dashed") === "solid" ? undefined : "6 5"}
                  />
                ) : null}
                {sessionSettings.showOpenClose !== false ? (
                  <>
                    {([session.open, session.close] as const).map((price, index) => {
                      const y = candleSeriesRef.current?.priceToCoordinate(price) ?? null;
                      return y === null ? null : (
                        <line
                          key={index}
                          x1={session.x}
                          x2={session.x + session.width}
                          y1={y}
                          y2={y}
                          stroke={session.color}
                          strokeOpacity={lineOpacity * 0.72}
                          strokeDasharray="3 4"
                        />
                      );
                    })}
                  </>
                ) : null}
                {sessionSettings.showLabels !== false ? (
                  <text
                    x={session.x + 5}
                    y={Math.max(11, session.y + 12)}
                    fill={session.color}
                    fontFamily="'JetBrains Mono', monospace"
                    fontSize={fontSize}
                    fontWeight={700}
                  >
                    {session.label}{suffix}
                  </text>
                ) : null}
              </g>
            );
          })}
          {positionedEffortZones.map((zone) => {
            const effortSettings = deepEffortIndicator?.settings ?? {};
            const useThemeColors = effortSettings.useThemeColors !== false;
            const color = zone.side === "ASK"
              ? useThemeColors ? settings.upColor : String(effortSettings.askColor ?? settings.upColor)
              : useThemeColors ? settings.downColor : String(effortSettings.bidColor ?? settings.downColor);
            const opacity = clamp(Number(effortSettings.zoneOpacity ?? 20) / 100, 0.01, 1);
            return (
              <g key={zone.id}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  rx={1.5}
                  fill={color}
                  fillOpacity={opacity}
                  stroke={color}
                  strokeOpacity={Math.min(1, opacity + 0.35)}
                  strokeWidth={clamp(Number(effortSettings.zoneLineWidth ?? 1), 0, 4)}
                />
              </g>
            );
          })}
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
        groups={calculatedIndicatorPanes}
        width={overlaySize.width}
        priceScaleWidth={nativePriceScaleWidth}
        height={indicatorPaneHeight}
        bottom={24}
        viewportVersion={viewportVersion}
        paneHeights={resolvedIndicatorPaneHeights}
        collapsedPanes={collapsedIndicatorPanes}
        timeToX={indicatorTimeToX}
        onResizePane={resizeIndicatorPane}
        onTogglePane={toggleIndicatorPane}
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

      {toolbarEnabled && (
      <div
        ref={toolbarRef}
        className={`absolute z-20 flex rounded-lg border border-border/80 bg-panel/92 p-[3px] shadow-xl backdrop-blur-xl ${toolbarDock === "top" || toolbarDock === "bottom" ? "flex-row items-center" : "flex-col"}`}
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
          <span className="grid grid-cols-2 gap-[3px]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="h-[3px] w-[3px] rounded-full bg-current" />
            ))}
          </span>
        </button>
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
                          const implemented = tool.id === "cursor" || tool.id === "eraser" || isProfessionalDrawingTool(tool.id);
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
              onClick={() => setMagnetMode((current) => (current === "off" ? "weak" : current === "weak" ? "strong" : "off"))}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(magnetMode !== "off")}`}
              style={toolbarButtonStyle}
              title={`Magnet: ${magnetMode}`}
            >
              <Magnet className={toolbarIconClassName} />
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
              onClick={() => setClearConfirm(true)}
              className="flex items-center justify-center border border-transparent bg-transparent text-muted transition-all hover:bg-danger/10 hover:text-danger"
              style={toolbarButtonStyle}
              title="Clear drawings"
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
                      onClick={() => professionalDrawingManagerRef.current?.selectDrawing(drawing.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
                      aria-label={`Select ${label}`}
                    >
                      <MousePointer2 className="h-4 w-4" />
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
                finishDraft({
                  id: createId("drawing"),
                  tool: textEditor.tool,
                  points: [{ time: textEditor.time, price: textEditor.price }],
                  text: textEditor.value.trim(),
                  color: chrome.stroke,
                });
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

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 w-[280px] rounded-xl border border-border bg-panel py-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
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
            <span className="flex-1 text-left">Clear drawings</span>
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
            <div className="mb-2 text-[16px] font-semibold text-foreground">Clear drawings?</div>
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
                  professionalDrawingManagerRef.current?.clearAll();
                  setDraftDrawing(null);
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
