"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CircleGauge,
  Crosshair,
  Eye,
  Flame,
  Layers3,
  LocateFixed,
  Radio,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import {
  DATABENTO_LIVE_STATUS_EVENT,
  DATABENTO_LIVE_TICK_EVENT,
  readDatabentoLiveStatus,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";
import type {
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskZeroGammaPayload,
} from "@/lib/gexDesk";
import {
  adaptiveIntensity,
  buildOptionsHeatmapModel,
  clamp,
  type HeatmapExpiry,
  type HeatmapNormalization,
  type HeatmapPricePoint,
  type HeatmapSource,
  type HeatmapZone,
  type OptionsHeatmapModel,
  validateOptionsHeatmapInputs,
} from "@/lib/optionsHeatmap";
import {
  fetchWorkspaceData,
  gexdeskHistoryCacheKey,
  readWorkspaceData,
  writeWorkspaceData,
} from "@/lib/workspaceDataCache";

type LayerKey = "POSITIONING" | "RAIL" | "PRESSURE" | "HEDGE" | "FUTURES";
type LiveTick = HeatmapPricePoint & { delta: number; size: number };
type HoverPoint = { x: number; y: number } | null;
type Viewport = {
  priceCenter: number | null;
  priceSpan: number | null;
  timeSpan: number | null;
  timeOffset: number;
  autoFollow: boolean;
};

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  POSITIONING: true,
  RAIL: true,
  PRESSURE: true,
  HEDGE: true,
  FUTURES: true,
};
const MAX_LIVE_TICKS = 3_600;
const HEATMAP_MODEL_REFRESH_MS = 500;
const HEATMAP_MAX_PIXEL_COUNT = 3_000_000;
const NEW_YORK_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatPrice(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1e12) return `${sign}${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(1)}M`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function timeLabel(timestamp: number) {
  try {
    return NEW_YORK_TIME.format(new Date(timestamp));
  } catch {
    return "--:--:--";
  }
}

function relativeAge(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "unknown";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3_600)}h ago`;
}

function alpha(color: string, opacity: number) {
  const normalized = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  }
  return normalized;
}

function cssColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function layerLabel(layer: LayerKey) {
  if (layer === "POSITIONING") return "Gamma positioning";
  if (layer === "RAIL") return "Gamma Rail";
  if (layer === "PRESSURE") return "Options pressure";
  if (layer === "HEDGE") return "Hedge ribbon";
  return "Futures confirmation";
}

function regimeCopy(model: OptionsHeatmapModel) {
  if (model.regime.behaviour === "STABILISING") {
    return "Positive positioning is dominant. Expect more pinning and two-way trade unless live pressure breaks a major zone.";
  }
  if (model.regime.behaviour === "AMPLIFYING") {
    return "Negative positioning is dominant. Hedging can reinforce direction and increase expansion through weak zones.";
  }
  return "Positioning is near transition. Treat zero gamma and the closest high-confidence zones as decision points.";
}

function zoneCopy(zone: HeatmapZone, currentPrice: number | null) {
  const location = currentPrice === null
    ? "near the current futures price"
    : zone.center >= currentPrice
      ? `${Math.abs(zone.center - currentPrice).toFixed(0)} points above price`
      : `${Math.abs(zone.center - currentPrice).toFixed(0)} points below price`;
  const behaviour = zone.behaviour === "STABILISING"
    ? "Dealer hedging is more likely to oppose a move and encourage rotation or pinning."
    : zone.behaviour === "AMPLIFYING"
      ? "Dealer hedging may travel with price, so acceptance can accelerate rather than mean-revert."
      : "The local book is balanced enough that tape confirmation matters more than the sign alone.";
  return `${zone.state.toLowerCase()} ${zone.behaviour.toLowerCase()} concentration ${location}. ${behaviour}`;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: string;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-panel px-3.5 py-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.15em] text-muted">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className={`mt-2 truncate font-mono text-[16px] font-semibold tracking-[-0.03em] ${tone}`}>{value}</div>
      <div className="mt-1 truncate text-[7px] text-muted">{detail}</div>
    </div>
  );
}

function OptionsHeatmapCanvas({
  model,
  layers,
  liveTicksRef,
  latestPriceRef,
  selectedZone,
  onSelectZone,
}: {
  model: OptionsHeatmapModel;
  layers: Record<LayerKey, boolean>;
  liveTicksRef: { current: LiveTick[] };
  latestPriceRef: { current: number | null };
  selectedZone: HeatmapZone | null;
  onSelectZone: (zone: HeatmapZone | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; width: number; height: number; viewport: Viewport } | null>(null);
  const hoverRef = useRef<HoverPoint>(null);
  const renderRef = useRef(0);
  const dragFrameRef = useRef(0);
  const pendingViewportRef = useRef<Viewport | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    priceCenter: null,
    priceSpan: null,
    timeSpan: null,
    timeOffset: 0,
    autoFollow: true,
  });

  const requestRender = useCallback(() => {
    if (renderRef.current) return;
    renderRef.current = window.requestAnimationFrame(() => {
      renderRef.current = 0;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const requestedRatio = Math.min(1.5, window.devicePixelRatio || 1);
      const areaRatio = Math.sqrt(HEATMAP_MAX_PIXEL_COUNT / Math.max(1, width * height));
      const ratio = Math.max(0.75, Math.min(requestedRatio, areaRatio));
      const pixelWidth = Math.max(1, Math.round(width * ratio));
      const pixelHeight = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const background = cssColor("--background", "#000000");
      const foreground = cssColor("--foreground", "#ffffff");
      const muted = cssColor("--muted", "#7f858d");
      const border = cssColor("--border", "#1a1d22");
      const primary = cssColor("--primary", "#b6ff00");
      const accent = cssColor("--accent", "#4361ff");
      const warning = cssColor("--warning", "#f5b942");
      const plotRight = Math.max(180, width - 82);
      const plotBottom = Math.max(120, height - 30);
      const plotWidth = plotRight;
      const plotHeight = plotBottom;
      const liveTicks = liveTicksRef.current;
      const displayPrice = latestPriceRef.current ?? model.currentPrice;
      const dataEnd = Math.max(
        model.timestamps.at(-1) ?? 0,
        model.pricePath.at(-1)?.timestamp ?? 0,
        liveTicks.at(-1)?.timestamp ?? 0,
        Date.now(),
      );
      const dataStart = Math.min(
        model.timestamps[0] ?? dataEnd - 3 * 60 * 60_000,
        model.pricePath[0]?.timestamp ?? dataEnd,
      );
      const defaultTimeSpan = Math.max(30 * 60_000, Math.min(6 * 60 * 60_000, dataEnd - dataStart || 3 * 60 * 60_000));
      const timeSpan = clamp(viewport.timeSpan ?? defaultTimeSpan, 5 * 60_000, 5 * 24 * 60 * 60_000);
      const endTime = viewport.autoFollow ? dataEnd : dataEnd + viewport.timeOffset;
      const startTime = endTime - timeSpan;
      const defaultPriceSpan = Math.max(200, model.priceHigh - model.priceLow);
      const priceSpan = clamp(viewport.priceSpan ?? defaultPriceSpan, 80, 8_000);
      const priceCenter = viewport.autoFollow
        ? displayPrice ?? viewport.priceCenter ?? (model.priceLow + model.priceHigh) / 2
        : viewport.priceCenter ?? displayPrice ?? (model.priceLow + model.priceHigh) / 2;
      const priceLow = priceCenter - priceSpan / 2;
      const priceHigh = priceCenter + priceSpan / 2;
      const xForTime = (timestamp: number) => (timestamp - startTime) / Math.max(1, endTime - startTime) * plotWidth;
      const yForPrice = (price: number) => (priceHigh - price) / Math.max(1, priceHigh - priceLow) * plotHeight;
      const priceForY = (y: number) => priceHigh - y / Math.max(1, plotHeight) * (priceHigh - priceLow);
      const timeForX = (x: number) => startTime + x / Math.max(1, plotWidth) * (endTime - startTime);

      context.clearRect(0, 0, width, height);
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      const glow = context.createRadialGradient(plotWidth * 0.72, plotHeight * 0.45, 0, plotWidth * 0.72, plotHeight * 0.45, plotWidth * 0.7);
      glow.addColorStop(0, alpha(primary, 0.055));
      glow.addColorStop(1, alpha(background, 0));
      context.fillStyle = glow;
      context.fillRect(0, 0, plotWidth, plotHeight);

      context.save();
      context.beginPath();
      context.rect(0, 0, plotWidth, plotHeight);
      context.clip();
      context.lineWidth = 1;
      context.strokeStyle = alpha(border, 0.88);
      context.setLineDash([2, 6]);
      context.font = "500 10px 'JetBrains Mono', monospace";
      context.fillStyle = muted;
      for (let index = 0; index <= 8; index += 1) {
        const ratioY = index / 8;
        const y = ratioY * plotHeight;
        context.beginPath();
        context.moveTo(0, Math.round(y) + 0.5);
        context.lineTo(plotWidth, Math.round(y) + 0.5);
        context.stroke();
      }
      for (let index = 0; index <= 6; index += 1) {
        const x = index / 6 * plotWidth;
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, 0);
        context.lineTo(Math.round(x) + 0.5, plotHeight);
        context.stroke();
      }
      context.setLineDash([]);

      if (layers.POSITIONING) {
        for (const zone of model.zones) {
          if (zone.high < priceLow || zone.low > priceHigh) continue;
          const top = yForPrice(zone.high);
          const bottom = yForPrice(zone.low);
          const zoneColor = zone.behaviour === "AMPLIFYING" ? accent : primary;
          const opacity = 0.025 + zone.strength / 100 * 0.09;
          const zoneGradient = context.createLinearGradient(0, 0, plotWidth, 0);
          zoneGradient.addColorStop(0, alpha(zoneColor, opacity * 0.35));
          zoneGradient.addColorStop(0.72, alpha(zoneColor, opacity));
          zoneGradient.addColorStop(1, alpha(zoneColor, opacity * 0.15));
          context.fillStyle = zoneGradient;
          context.fillRect(0, top, plotWidth, Math.max(2, bottom - top));
          context.strokeStyle = alpha(zoneColor, selectedZone?.id === zone.id ? 0.85 : 0.25);
          context.lineWidth = selectedZone?.id === zone.id ? 1.5 : 1;
          context.strokeRect(0.5, top + 0.5, plotWidth - 1, Math.max(2, bottom - top) - 1);
        }
        const visibleCells = model.cells.filter((cell) => (
          cell.timestamp >= startTime
          && cell.timestamp <= endTime
          && cell.price >= priceLow
          && cell.price <= priceHigh
        ));
        const cellDuration = model.timestamps.length > 1
          ? Math.max(20_000, model.timestamps[1] - model.timestamps[0])
          : 60_000;
        const rowHeight = Math.max(2, Math.abs(yForPrice(priceLow + 10) - yForPrice(priceLow)));
        for (const cell of visibleCells) {
          const x = xForTime(cell.timestamp);
          const nextX = xForTime(cell.timestamp + cellDuration);
          const y = yForPrice(cell.price);
          const callIntensity = adaptiveIntensity(cell.call, model.heatCeiling);
          const putIntensity = adaptiveIntensity(cell.put, model.heatCeiling);
          if (callIntensity > 0) {
            context.fillStyle = alpha(primary, 0.035 + callIntensity * 0.62);
            context.fillRect(x, y - rowHeight, Math.max(1.5, nextX - x + 0.5), rowHeight);
          }
          if (putIntensity > 0) {
            context.fillStyle = alpha(accent, 0.035 + putIntensity * 0.62);
            context.fillRect(x, y, Math.max(1.5, nextX - x + 0.5), rowHeight);
          }
        }
      }

      if (layers.PRESSURE) {
        const flowCeiling = Math.max(1, ...model.flowCells.map((cell) => cell.gross));
        for (const cell of model.flowCells) {
          if (cell.timestamp < startTime || cell.timestamp > endTime || cell.price < priceLow || cell.price > priceHigh) continue;
          const intensity = adaptiveIntensity(cell.gross, flowCeiling);
          const x = xForTime(cell.timestamp);
          const y = yForPrice(cell.price);
          const color = cell.net >= 0 ? primary : accent;
          const radius = 2 + intensity * 7;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = alpha(color, 0.16 + intensity * 0.54);
          context.shadowColor = color;
          context.shadowBlur = intensity * 9;
          context.fill();
          context.shadowBlur = 0;
        }
      }

      const pricePoints = [...model.pricePath, ...liveTicks]
        .filter((point) => point.timestamp >= startTime && point.timestamp <= endTime && point.price >= priceLow - 50 && point.price <= priceHigh + 50)
        .sort((left, right) => left.timestamp - right.timestamp);
      if (pricePoints.length > 1) {
        const pricePath = new Path2D();
        for (let index = 0; index < pricePoints.length; index += 1) {
          const point = pricePoints[index];
          const x = xForTime(point.timestamp);
          const y = yForPrice(point.price);
          if (index === 0) pricePath.moveTo(x, y);
          else pricePath.lineTo(x, y);
        }
        if (layers.HEDGE) {
          const hedgeColor = model.pressureScore >= 0 ? primary : accent;
          context.strokeStyle = alpha(hedgeColor, 0.12 + Math.min(0.24, Math.abs(model.pressureScore) / 260));
          context.lineWidth = 10;
          context.lineJoin = "round";
          context.lineCap = "round";
          context.stroke(pricePath);
        }
        context.strokeStyle = alpha(background, 0.94);
        context.lineWidth = 5;
        context.stroke(pricePath);
        context.strokeStyle = foreground;
        context.shadowColor = alpha(foreground, 0.45);
        context.shadowBlur = 5;
        context.lineWidth = 1.8;
        context.stroke(pricePath);
        context.shadowBlur = 0;
      }

      if (layers.FUTURES) {
        const executions = liveTicks.filter((tick) => (
          tick.timestamp >= startTime
          && tick.timestamp <= endTime
          && Math.abs(tick.delta) > 0
          && tick.price >= priceLow
          && tick.price <= priceHigh
        ));
        const maximumDelta = Math.max(1, ...executions.map((tick) => Math.abs(tick.delta)));
        for (const tick of executions.slice(-480)) {
          const ratioDelta = Math.sqrt(Math.abs(tick.delta) / maximumDelta);
          const radius = 1.5 + ratioDelta * 5;
          const color = tick.delta >= 0 ? primary : accent;
          context.beginPath();
          context.arc(xForTime(tick.timestamp), yForPrice(tick.price), radius, 0, Math.PI * 2);
          context.fillStyle = alpha(color, 0.18 + ratioDelta * 0.52);
          context.fill();
        }
      }

      if (model.zeroGamma !== null && model.zeroGamma >= priceLow && model.zeroGamma <= priceHigh) {
        const y = yForPrice(model.zeroGamma);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(plotWidth, y);
        context.strokeStyle = alpha(warning, 0.78);
        context.lineWidth = 1.2;
        context.setLineDash([7, 5]);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = warning;
        context.font = "700 9px 'JetBrains Mono', monospace";
        context.fillText(`ZERO GAMMA ${formatPrice(model.zeroGamma, 0)}`, 10, Math.max(12, y - 6));
      }

      if (displayPrice !== null && displayPrice >= priceLow && displayPrice <= priceHigh) {
        const y = yForPrice(displayPrice);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(plotRight, y);
        context.strokeStyle = alpha(foreground, 0.72);
        context.lineWidth = 1;
        context.setLineDash([4, 4]);
        context.stroke();
        context.setLineDash([]);
      }

      const pointer = hoverRef.current;
      if (pointer && pointer.x >= 0 && pointer.x <= plotWidth && pointer.y >= 0 && pointer.y <= plotHeight) {
        context.strokeStyle = alpha(primary, 0.44);
        context.lineWidth = 1;
        context.setLineDash([3, 4]);
        context.beginPath();
        context.moveTo(pointer.x, 0);
        context.lineTo(pointer.x, plotHeight);
        context.moveTo(0, pointer.y);
        context.lineTo(plotWidth, pointer.y);
        context.stroke();
        context.setLineDash([]);
        const tooltipPrice = priceForY(pointer.y);
        const tooltipTime = timeForX(pointer.x);
        const boxX = Math.min(plotWidth - 150, pointer.x + 12);
        const boxY = Math.max(8, Math.min(plotHeight - 52, pointer.y - 48));
        context.fillStyle = alpha(background, 0.92);
        context.strokeStyle = alpha(border, 1);
        context.beginPath();
        context.roundRect(boxX, boxY, 140, 42, 7);
        context.fill();
        context.stroke();
        context.fillStyle = foreground;
        context.font = "600 10px 'JetBrains Mono', monospace";
        context.fillText(formatPrice(tooltipPrice), boxX + 10, boxY + 16);
        context.fillStyle = muted;
        context.font = "500 9px 'JetBrains Mono', monospace";
        context.fillText(`${timeLabel(tooltipTime)} ET`, boxX + 10, boxY + 31);
      }
      context.restore();

      context.fillStyle = background;
      context.fillRect(plotRight, 0, width - plotRight, height);
      context.fillRect(0, plotBottom, width, height - plotBottom);
      context.strokeStyle = border;
      context.beginPath();
      context.moveTo(plotRight + 0.5, 0);
      context.lineTo(plotRight + 0.5, plotBottom);
      context.moveTo(0, plotBottom + 0.5);
      context.lineTo(width, plotBottom + 0.5);
      context.stroke();
      context.font = "500 10px 'JetBrains Mono', monospace";
      context.fillStyle = muted;
      context.textBaseline = "middle";
      for (let index = 0; index <= 8; index += 1) {
        const ratioY = index / 8;
        const y = ratioY * plotHeight;
        context.fillText(formatPrice(priceHigh - ratioY * priceSpan, 0), plotRight + 9, y);
      }
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      for (let index = 0; index <= 6; index += 1) {
        const x = index / 6 * plotWidth;
        context.fillText(timeLabel(startTime + index / 6 * timeSpan).slice(0, 5), x, height - 8);
      }
      context.textAlign = "left";
      if (displayPrice !== null && displayPrice >= priceLow && displayPrice <= priceHigh) {
        const y = yForPrice(displayPrice);
        context.fillStyle = primary;
        context.beginPath();
        context.roundRect(plotRight + 3, y - 11, width - plotRight - 6, 22, 5);
        context.fill();
        context.fillStyle = background;
        context.font = "700 10px 'JetBrains Mono', monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(formatPrice(displayPrice), plotRight + (width - plotRight) / 2, y);
      }
    });
  }, [layers, latestPriceRef, liveTicksRef, model, selectedZone, viewport]);

  useEffect(() => {
    requestRender();
    const observer = new ResizeObserver(requestRender);
    const container = containerRef.current;
    if (container) observer.observe(container);
    const mutation = new MutationObserver(requestRender);
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    let livePaintTimer: number | null = null;
    let lastLivePaintAt = 0;
    const requestLivePaint = () => {
      const now = performance.now();
      const remaining = 50 - (now - lastLivePaintAt);
      if (remaining <= 0) {
        lastLivePaintAt = now;
        requestRender();
        return;
      }
      if (livePaintTimer !== null) return;
      livePaintTimer = window.setTimeout(() => {
        livePaintTimer = null;
        lastLivePaintAt = performance.now();
        requestRender();
      }, remaining);
    };
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, requestLivePaint);
    return () => {
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, requestLivePaint);
      if (livePaintTimer !== null) window.clearTimeout(livePaintTimer);
      if (renderRef.current) window.cancelAnimationFrame(renderRef.current);
      if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current);
    };
  }, [requestRender]);

  useEffect(() => {
    if (!viewport.autoFollow) return;
    setViewport((current) => ({
      ...current,
      priceCenter: model.currentPrice ?? current.priceCenter,
      priceSpan: current.priceSpan ?? Math.max(200, model.priceHigh - model.priceLow),
      timeSpan: current.timeSpan ?? Math.max(30 * 60_000, (model.timestamps.at(-1) ?? Date.now()) - (model.timestamps[0] ?? Date.now() - 3 * 60 * 60_000)),
      timeOffset: 0,
    }));
  }, [model.currentPrice, model.priceHigh, model.priceLow, model.timestamps, viewport.autoFollow]);

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    hoverRef.current = point;
    const drag = dragRef.current;
    if (drag) {
      const priceSpan = drag.viewport.priceSpan ?? Math.max(200, model.priceHigh - model.priceLow);
      const timeSpan = drag.viewport.timeSpan ?? 3 * 60 * 60_000;
      pendingViewportRef.current = {
        ...drag.viewport,
        autoFollow: false,
        priceCenter: (drag.viewport.priceCenter ?? latestPriceRef.current ?? model.currentPrice ?? (model.priceLow + model.priceHigh) / 2) + (point.y - drag.y) / drag.height * priceSpan,
        timeOffset: drag.viewport.timeOffset - (point.x - drag.x) / drag.width * timeSpan,
      };
      if (!dragFrameRef.current) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = 0;
          const nextViewport = pendingViewportRef.current;
          pendingViewportRef.current = null;
          if (nextViewport) setViewport(nextViewport);
        });
      }
    } else {
      requestRender();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = canvasPoint(event);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      ...point,
      width: Math.max(1, rect.width - 82),
      height: Math.max(1, rect.height - 30),
      viewport,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    const drag = dragRef.current;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    if (!drag || Math.hypot(point.x - drag.x, point.y - drag.y) > 5) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const plotHeight = Math.max(1, rect.height - 30);
    const priceSpan = viewport.priceSpan ?? Math.max(200, model.priceHigh - model.priceLow);
    const center = viewport.priceCenter ?? model.currentPrice ?? (model.priceLow + model.priceHigh) / 2;
    const price = center + priceSpan / 2 - point.y / plotHeight * priceSpan;
    const nearest = [...model.zones].sort((left, right) => Math.abs(left.center - price) - Math.abs(right.center - price))[0] ?? null;
    onSelectZone(nearest && price >= nearest.low - 20 && price <= nearest.high + 20 ? nearest : null);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const overPriceAxis = point.x >= rect.width - 82;
    const scale = Math.exp(clamp(event.deltaY, -220, 220) * 0.0015);
    setViewport((current) => ({
      ...current,
      autoFollow: false,
      ...(overPriceAxis || event.shiftKey
        ? { priceSpan: clamp((current.priceSpan ?? Math.max(200, model.priceHigh - model.priceLow)) * scale, 80, 8_000) }
        : { timeSpan: clamp((current.timeSpan ?? 3 * 60 * 60_000) * scale, 5 * 60_000, 5 * 24 * 60 * 60_000) }),
    }));
  };

  return (
    <div ref={containerRef} className="relative h-full min-h-[560px] overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair touch-none select-none"
        aria-label="NQ options positioning and hedging heatmap"
        onPointerEnter={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          hoverRef.current = null;
          requestRender();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={handleWheel}
        onDoubleClick={() => setViewport({ priceCenter: model.currentPrice, priceSpan: null, timeSpan: null, timeOffset: 0, autoFollow: true })}
      />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-border bg-background/82 px-2.5 py-1.5 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
        Time × NQ price · {model.source} · {model.expiry}
      </div>
      {!viewport.autoFollow ? (
        <button
          type="button"
          onClick={() => setViewport({ priceCenter: model.currentPrice, priceSpan: null, timeSpan: null, timeOffset: 0, autoFollow: true })}
          className="absolute right-[92px] top-3 flex items-center gap-1.5 rounded-xl border border-primary/25 bg-background/90 px-2.5 py-1.5 text-[7px] font-semibold text-primary backdrop-blur transition-colors hover:bg-primary/10"
        >
          <LocateFixed className="h-3 w-3" />Return live
        </button>
      ) : null}
    </div>
  );
}

export default function OptionsHeatmapWorkspace() {
  const initialPayloadRef = useRef(readWorkspaceData<GexDeskPayload>("gexdesk:map"));
  const initialHistoryRef = useRef(readWorkspaceData<GexDeskHistoryPayload>(gexdeskHistoryCacheKey("COMBINED", "NQ")));
  const [payload, setPayload] = useState<GexDeskPayload | null>(initialPayloadRef.current);
  const [history, setHistory] = useState<GexDeskHistoryPayload | null>(initialHistoryRef.current);
  const [zeroGammaPayload, setZeroGammaPayload] = useState<GexDeskZeroGammaPayload | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<HeatmapSource>("COMBINED");
  const [expiry, setExpiry] = useState<HeatmapExpiry>("ALL");
  const [normalization, setNormalization] = useState<HeatmapNormalization>("PERCENTILE");
  const [clusterDistance, setClusterDistance] = useState(25);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [feedStatus, setFeedStatus] = useState<DatabentoLiveStatus>(() => readDatabentoLiveStatus() ?? "connecting");
  const [livePrice, setLivePrice] = useState<number | null>(initialPayloadRef.current?.nqPrice ?? null);
  const liveTicksRef = useRef<LiveTick[]>([]);
  const latestPriceRef = useRef<number | null>(initialPayloadRef.current?.nqPrice ?? null);
  const uiTimerRef = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [nextPayload, nextHistory, zeroResponse] = await Promise.all([
        fetchWorkspaceData<GexDeskPayload>("gexdesk:map", "/api/gexdesk", {
          force: true,
          validate: (value) => validateOptionsHeatmapInputs(value, null).payloadValid,
          invalidMessage: "The options positioning snapshot was incomplete.",
        }),
        fetchWorkspaceData<GexDeskHistoryPayload>(
          gexdeskHistoryCacheKey(source, "NQ"),
          `/api/gexdesk/history?instrument=NQ&source=${source}`,
          {
            force: true,
            validate: (value) => validateOptionsHeatmapInputs(initialPayloadRef.current, value).historyValid,
            invalidMessage: "The gamma history response was incomplete.",
          },
        ),
        fetch("/api/gexdesk/zero-gamma", { cache: "no-store" }).catch(() => null),
      ]);
      setPayload(nextPayload);
      setHistory(nextHistory);
      writeWorkspaceData("gexdesk:map", nextPayload);
      writeWorkspaceData(gexdeskHistoryCacheKey(source, "NQ"), nextHistory);
      if (latestPriceRef.current === null && nextPayload.nqPrice) {
        latestPriceRef.current = nextPayload.nqPrice;
        setLivePrice(nextPayload.nqPrice);
      }
      if (zeroResponse?.ok) setZeroGammaPayload(await zeroResponse.json() as GexDeskZeroGammaPayload);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The options heatmap could not be refreshed.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [source]);

  useEffect(() => {
    const cached = readWorkspaceData<GexDeskHistoryPayload>(gexdeskHistoryCacheKey(source, "NQ"));
    if (cached) setHistory(cached);
    void load(Boolean(initialPayloadRef.current));
  }, [load, source]);

  useEffect(() => {
    if (!payload?.marketOpen) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, Math.max(10_000, payload.refreshAfterMs));
    return () => window.clearInterval(interval);
  }, [load, payload?.marketOpen, payload?.refreshAfterMs]);

  useEffect(() => {
    const receiveTick = (event: Event) => {
      const detail = (event as CustomEvent<{
        instrument?: string;
        mid?: number;
        timestamp?: string | number;
        delta?: number;
        size?: number;
        isTrade?: boolean;
      }>).detail;
      const instrument = String(detail.instrument ?? "").toUpperCase();
      if (!instrument.startsWith("MNQ") && !instrument.startsWith("NQ")) return;
      const price = Number(detail.mid);
      if (!(price > 0)) return;
      const rawTimestamp = typeof detail.timestamp === "string" ? Date.parse(detail.timestamp) : Number(detail.timestamp);
      const timestamp = Number.isFinite(rawTimestamp)
        ? rawTimestamp < 10_000_000_000 ? rawTimestamp * 1_000 : rawTimestamp
        : Date.now();
      const tick = {
        timestamp,
        price,
        delta: Number(detail.delta ?? 0),
        size: Math.max(0, Number(detail.size ?? 0)),
      };
      latestPriceRef.current = price;
      const ticks = liveTicksRef.current;
      const latest = ticks.at(-1);
      if (latest && Math.floor(latest.timestamp / 250) === Math.floor(timestamp / 250)) ticks[ticks.length - 1] = tick;
      else ticks.push(tick);
      const cutoff = timestamp - 6 * 60 * 60_000;
      while (ticks.length && ticks[0].timestamp < cutoff) ticks.shift();
      if (ticks.length > MAX_LIVE_TICKS) ticks.splice(0, ticks.length - MAX_LIVE_TICKS);
      if (uiTimerRef.current !== null) return;
      uiTimerRef.current = window.setTimeout(() => {
        uiTimerRef.current = null;
        setLivePrice(latestPriceRef.current);
        setFeedStatus("live");
      }, HEATMAP_MODEL_REFRESH_MS);
    };
    const receiveStatus = (event: Event) => setFeedStatus((event as CustomEvent<DatabentoLiveStatus>).detail);
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
    window.addEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    return () => {
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
      window.removeEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
      if (uiTimerRef.current !== null) window.clearTimeout(uiTimerRef.current);
    };
  }, []);

  const model = useMemo(() => payload ? buildOptionsHeatmapModel({
    payload,
    history,
    source,
    expiry,
    normalization,
    clusterDistance,
    currentPrice: livePrice,
    livePricePath: [],
  }) : null, [clusterDistance, expiry, history, livePrice, normalization, payload, source]);
  const zeroGamma = zeroGammaPayload?.trueGammaFlip ?? model?.zeroGamma ?? null;
  const resolvedModel = model ? { ...model, zeroGamma } : null;
  const selectedZone = resolvedModel?.zones.find((zone) => zone.id === selectedZoneId)
    ?? resolvedModel?.zones
      .slice()
      .sort((left, right) => Math.abs(left.center - (resolvedModel.currentPrice ?? left.center)) - Math.abs(right.center - (resolvedModel.currentPrice ?? right.center)))[0]
    ?? null;
  const upperZone = resolvedModel?.zones.filter((zone) => resolvedModel.currentPrice !== null && zone.center > resolvedModel.currentPrice).sort((left, right) => left.center - right.center)[0] ?? null;
  const lowerZone = resolvedModel?.zones.filter((zone) => resolvedModel.currentPrice !== null && zone.center < resolvedModel.currentPrice).sort((left, right) => right.center - left.center)[0] ?? null;

  if (!payload && !error) {
    return <KwantLoader page icon={Flame} title="Opening Heat Map" detail="Restoring mapped NDX and QQQ positioning with the shared NQ tape." />;
  }

  if (!resolvedModel) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-3xl border border-danger/25 bg-panel p-6 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-danger" />
          <h2 className="mt-4 text-[13px] font-semibold">Heat Map could not open</h2>
          <p className="mt-2 text-[9px] leading-5 text-muted">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-on-primary"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
        </div>
      </div>
    );
  }

  const regimeTone = resolvedModel.regime.behaviour === "STABILISING" ? "text-primary" : resolvedModel.regime.behaviour === "AMPLIFYING" ? "text-accent" : "text-foreground";
  const pressureTone = resolvedModel.pressureScore > 10 ? "text-primary" : resolvedModel.pressureScore < -10 ? "text-accent" : "text-foreground";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Flame className="h-4 w-4" /></span>
        <div className="mr-2 min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase">Heat Map</div>
          <div className="truncate text-[6px] uppercase tracking-[0.14em] text-muted">Options positioning · hedging pressure · NQ</div>
        </div>
        <KwantSelect value={source} onChange={(event) => setSource(event.target.value as HeatmapSource)} menuLabel="Positioning source" className="h-8 min-w-32 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
          <option value="COMBINED">NDX + QQQ</option>
          <option value="NDX">NDX / NDXP</option>
          <option value="QQQ">QQQ</option>
        </KwantSelect>
        <KwantSelect value={expiry} onChange={(event) => setExpiry(event.target.value as HeatmapExpiry)} menuLabel="Expiry layer" className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
          <option value="ALL">All expiries</option>
          <option value="0DTE">0DTE</option>
          <option value="1DTE">1DTE flow</option>
        </KwantSelect>
        <KwantSelect value={normalization} onChange={(event) => setNormalization(event.target.value as HeatmapNormalization)} menuLabel="Heat normalization" className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
          <option value="PERCENTILE">Adaptive percentile</option>
          <option value="VISIBLE">Visible window</option>
          <option value="GLOBAL">Session maximum</option>
        </KwantSelect>
        <KwantSelect value={String(clusterDistance)} onChange={(event) => setClusterDistance(Number(event.target.value))} menuLabel="Strike clustering" className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
          <option value="10">Tight · 10 pt</option>
          <option value="25">Balanced · 25 pt</option>
          <option value="50">Broad · 50 pt</option>
        </KwantSelect>
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[7px] font-semibold ${feedStatus === "live" ? "border-primary/25 bg-primary/[0.06] text-primary" : "border-border bg-surface text-muted"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${feedStatus === "live" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
            NQ {feedStatus.toUpperCase()}
          </span>
          <button type="button" onClick={() => void load()} disabled={refreshing} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:text-foreground disabled:opacity-40" title="Refresh positioning"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-panel px-3 py-2">
        {(Object.keys(layers) as LayerKey[]).map((layer) => (
          <button
            key={layer}
            type="button"
            onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
            className={`rounded-xl border px-3 py-1.5 text-[7px] font-semibold transition-colors ${layers[layer] ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}
          >
            {layerLabel(layer)}
          </button>
        ))}
        <span className="ml-auto hidden text-[6px] text-muted xl:block">Wheel = time zoom · Shift+wheel/right rail = price zoom · Drag = pan · Double-click = live</span>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto max-w-[1800px] space-y-3">
          {error ? <div className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/[0.05] px-3 py-2 text-[7px] text-warning"><AlertTriangle className="h-3.5 w-3.5" />The last verified heatmap remains visible. {error}</div> : null}
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <MetricCard label="Regime" value={resolvedModel.regime.behaviour} detail={`Net / gross ${resolvedModel.regime.ratio >= 0 ? "+" : ""}${resolvedModel.regime.ratio.toFixed(3)}`} icon={CircleGauge} tone={regimeTone} />
            <MetricCard label="NQ live" value={formatPrice(resolvedModel.currentPrice)} detail={`${feedStatus} · ${timeLabel(Date.now())} ET`} icon={Radio} />
            <MetricCard label="Zone above" value={formatPrice(upperZone?.center ?? null, 0)} detail={upperZone ? `${upperZone.behaviour.toLowerCase()} · ${upperZone.strength}%` : "No mapped zone"} icon={ScanLine} />
            <MetricCard label="Zone below" value={formatPrice(lowerZone?.center ?? null, 0)} detail={lowerZone ? `${lowerZone.behaviour.toLowerCase()} · ${lowerZone.strength}%` : "No mapped zone"} icon={ScanLine} />
            <MetricCard label="Zero gamma" value={formatPrice(resolvedModel.zeroGamma, 0)} detail={zeroGammaPayload?.method === "TRUE_OI_SCENARIO" ? "Scenario crossing" : "Nearest profile crossing"} icon={Crosshair} tone="text-warning" />
            <MetricCard label="0DTE weight" value={`${(resolvedModel.regime.zeroDteShare * 100).toFixed(0)}%`} detail="Share of mapped gross exposure" icon={Activity} />
            <MetricCard label="Hedge pressure" value={`${resolvedModel.pressureScore >= 0 ? "+" : ""}${resolvedModel.pressureScore.toFixed(0)}`} detail={`${(resolvedModel.pressureConfidence * 100).toFixed(0)}% classified confidence`} icon={Waves} tone={pressureTone} />
          </section>

          <section className="grid min-h-[650px] overflow-hidden rounded-2xl border border-border bg-panel xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
              <OptionsHeatmapCanvas
                model={resolvedModel}
                layers={layers}
                liveTicksRef={liveTicksRef}
                latestPriceRef={latestPriceRef}
                selectedZone={selectedZone}
                onSelectZone={(zone) => setSelectedZoneId(zone?.id ?? "")}
              />
            </div>
            <aside className="flex min-h-0 flex-col bg-panel">
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2 text-[9px] font-semibold"><BarChart3 className="h-3.5 w-3.5 text-primary" />Gamma Rail</div>
                <div className="mt-1 text-[6px] leading-4 text-muted">Strongest mapped concentrations. Select a row or click its band on the heatmap.</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-background/35 p-2"><div className="text-[6px] uppercase text-muted">Agreement</div><div className="mt-1 font-mono text-[10px] font-semibold text-primary">{resolvedModel.agreement.score}%</div></div>
                  <div className="rounded-xl border border-border bg-background/35 p-2"><div className="text-[6px] uppercase text-muted">Mapping</div><div className="mt-1 font-mono text-[10px] font-semibold">{(resolvedModel.mappingCoverage * 100).toFixed(0)}%</div></div>
                  <div className="rounded-xl border border-border bg-background/35 p-2"><div className="text-[6px] uppercase text-muted">State</div><div className="mt-1 truncate text-[8px] font-semibold">{resolvedModel.status.replace("_", " ")}</div></div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {resolvedModel.zones.slice().sort((left, right) => right.center - left.center).map((zone) => {
                  const active = selectedZone?.id === zone.id;
                  const positive = zone.behaviour === "STABILISING";
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`grid w-full grid-cols-[74px_1fr_48px] items-center gap-2 border-b border-border/55 px-3 py-2.5 text-left transition-colors ${active ? "bg-primary/[0.06]" : "hover:bg-surface/55"}`}
                    >
                      <span className={`font-mono text-[10px] font-semibold ${positive ? "text-primary" : zone.behaviour === "AMPLIFYING" ? "text-accent" : "text-foreground"}`}>{formatPrice(zone.center, 0)}</span>
                      <span className="min-w-0"><span className="block truncate text-[7px] font-semibold">{zone.behaviour} · {zone.state}</span><span className="mt-0.5 block truncate text-[6px] text-muted">{compact(zone.gross)} · {(zone.confidence * 100).toFixed(0)}% confidence</span></span>
                      <span className="font-mono text-[8px] text-muted">{zone.strength}%</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2 border-t border-border p-3">
                <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
                  <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.12em] text-primary"><Eye className="h-3 w-3" />Selected level</div>
                  <div className="mt-2 flex items-end justify-between gap-2"><span className="font-mono text-[17px] font-semibold">{formatPrice(selectedZone?.center ?? null, 0)}</span><span className="text-[6px] text-muted">{selectedZone ? `${selectedZone.callShare >= 0.5 ? "CALL" : "PUT"} ${Math.max(selectedZone.callShare, 1 - selectedZone.callShare) * 100 >= 50 ? (Math.max(selectedZone.callShare, 1 - selectedZone.callShare) * 100).toFixed(0) : "50"}%` : "No selection"}</span></div>
                  {selectedZone ? <p className="mt-2 text-[7px] leading-5 text-foreground">{zoneCopy(selectedZone, resolvedModel.currentPrice)}</p> : null}
                </div>
                <div className="rounded-xl border border-border bg-background/30 p-3">
                  <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted"><Sparkles className="h-3 w-3 text-primary" />Beginner read</div>
                  <p className="mt-2 text-[7px] leading-5 text-foreground">{regimeCopy(resolvedModel)}</p>
                </div>
              </div>
            </aside>
          </section>

          <section className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-panel p-4"><div className="flex items-center gap-2 text-[8px] font-semibold"><Layers3 className="h-3.5 w-3.5 text-primary" />What the heat means</div><p className="mt-2 text-[7px] leading-5 text-muted">Brightness is mapped options exposure or classified flow at a price and time. It is not resting CME liquidity. Persistent bands show structural concentration; glowing prints show current-session change.</p></div>
            <div className="rounded-2xl border border-border bg-panel p-4"><div className="flex items-center gap-2 text-[8px] font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Conversion integrity</div><p className="mt-2 text-[7px] leading-5 text-muted">NDX and QQQ strikes are translated into NQ-equivalent prices using timestamp-aligned underlier and futures prices. Original strikes, mapping confidence and source agreement remain available in the rail.</p></div>
            <div className="rounded-2xl border border-border bg-panel p-4"><div className="flex items-center gap-2 text-[8px] font-semibold"><Activity className="h-3.5 w-3.5 text-primary" />Confirmation</div><p className="mt-2 text-[7px] leading-5 text-muted">The white path is observed CME NQ/MNQ. Trade-delta dots and the hedge ribbon provide confirmation context; they do not convert an estimated options position into a guaranteed trade signal.</p></div>
          </section>

          <footer className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-[6px] leading-4 text-muted">
            <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
            <span>{payload?.disclosure ?? "Estimated options positioning and hedging pressure; not a guaranteed trading signal."}</span>
            <span className="ml-auto">KwantData positioning · CME futures confirmation · snapshot {relativeAge(resolvedModel.asOf)}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
