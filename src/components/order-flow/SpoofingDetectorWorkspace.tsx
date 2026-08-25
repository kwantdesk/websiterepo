"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { HelpCircle, RotateCcw, Save, Settings2 } from "lucide-react";
import FloatingSettingsWindow from "@/components/ui/FloatingSettingsWindow";
import KwantLoader from "@/components/KwantLoader";
import {
  subscribeRithmicLiquidity,
  type RithmicLiquidityStatus,
} from "@/lib/rithmicLiquidityStream";
import type { RithmicLiquiditySnapshot } from "@/lib/structureLevels";
import {
  appendSpoofingCandles,
  DEFAULT_SPOOFING_DETECTOR_SETTINGS,
  normalizeSpoofingDetectorSettings,
  SpoofingDetectorEngine,
  type SpoofingCandle,
  type SpoofingDetectorFrame,
  type SpoofingDetectorRow,
  type SpoofingDetectorSettings,
} from "@/lib/spoofingDetector";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

type SpoofingDetectorWorkspaceProps = {
  workspaceId: string;
  instrument: string;
  active?: boolean;
};

type Palette = {
  background: string;
  panel: string;
  surface: string;
  border: string;
  foreground: string;
  muted: string;
  primary: string;
  danger: string;
  warning: string;
};

type HoveredRow = SpoofingDetectorRow & { x: number; y: number };

const MICRO_PARENT_ROOTS: Record<string, string> = {
  MNQ: "NQ",
  MES: "ES",
  MYM: "YM",
  M2K: "RTY",
  MGC: "GC",
  MCL: "CL",
  MBT: "BTC",
  MET: "ETH",
};

function instrumentIdentity(value: string) {
  const normalized = String(value || "NQ")
    .trim()
    .toUpperCase()
    .replace(/\.[VNC]\.\d+$/i, "");
  const explicitContract = /[FGHJKMNQUVXZ]\d{1,2}$/i.test(normalized) ? normalized : "";
  const chartRoot = normalized.replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
  return {
    chartRoot: chartRoot || "NQ",
    bookRoot: MICRO_PARENT_ROOTS[chartRoot] || chartRoot || "NQ",
    contractSymbol: explicitContract,
  };
}

function cssColor(style: CSSStyleDeclaration, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback;
}

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  return {
    background: cssColor(style, "--chart-background", "#050608"),
    panel: cssColor(style, "--panel", "#090b0f"),
    surface: cssColor(style, "--surface", "#11141a"),
    border: cssColor(style, "--border", "#262b33"),
    foreground: cssColor(style, "--foreground", "#f4f6f8"),
    muted: cssColor(style, "--muted", "#7e8794"),
    primary: cssColor(style, "--primary", "#00d4c8"),
    danger: cssColor(style, "--danger", "#ff3f77"),
    warning: "#f5b942",
  };
}

function alpha(color: string, amount: number) {
  if (color.startsWith("#")) {
    const raw = color.slice(1);
    const expanded = raw.length === 3 ? raw.split("").map((value) => value + value).join("") : raw;
    if (expanded.length === 6) {
      const value = Number.parseInt(expanded, 16);
      return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${amount})`;
    }
  }
  return `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, transparent)`;
}

function priceDecimals(tickSize: number) {
  if (tickSize >= 1) return 0;
  const text = String(tickSize);
  return text.includes(".") ? Math.min(6, text.split(".")[1].length) : 2;
}

function visibleRows(frame: SpoofingDetectorFrame, count: number) {
  const tickSize = frame.tickSize || 0.25;
  const reference = frame.lastPrice ?? frame.bestBid ?? frame.bestAsk ?? 0;
  const centerTick = Math.round(reference / tickSize);
  const topTick = centerTick + Math.ceil(count / 2) - 1;
  const rowMap = new Map(frame.rows.map((row) => [Math.round(row.price / tickSize), row]));
  return Array.from({ length: count }, (_, index) => {
    const tick = topTick - index;
    const price = tick * tickSize;
    const tracked = rowMap.get(tick);
    const side: "BID" | "ASK" = tracked?.side
      ?? (frame.bestBid !== null && price <= frame.bestBid ? "BID" : "ASK");
    return tracked ?? {
      key: `${side}:${tick}`,
      side,
      price,
      liveContracts: 0,
      orderCount: 0,
      peakCandidateSize: 0,
      cancelledContracts: 0,
      aggressiveContracts: 0,
      score: 0,
      state: "QUIET" as const,
      layered: false,
      reposted: false,
      lastEventAt: 0,
    };
  });
}

function drawSpoofingChart(
  canvas: HTMLCanvasElement,
  frame: SpoofingDetectorFrame | null,
  candles: SpoofingCandle[],
  settings: SpoofingDetectorSettings,
  palette: Palette,
) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);
  if (!frame || !frame.bookValid || height < 40) return;

  const rows = visibleRows(frame, settings.visibleRows);
  const rowHeight = height / rows.length;
  const railLeft = Math.max(width * 0.72, width - 260);
  const priceLeft = Math.max(railLeft + 4, width - 174);
  const contractsLeft = Math.max(priceLeft + 64, width - 90);
  const maximumDepth = Math.max(1, ...rows.map((row) => row.liveContracts));
  const decimals = priceDecimals(frame.tickSize);
  const currentTick = Math.round((frame.lastPrice ?? 0) / frame.tickSize);

  context.fillStyle = alpha(palette.panel, 0.94);
  context.fillRect(railLeft, 0, width - railLeft, height);
  context.strokeStyle = palette.border;
  context.beginPath();
  context.moveTo(railLeft + 0.5, 0);
  context.lineTo(railLeft + 0.5, height);
  context.moveTo(contractsLeft - 10.5, 0);
  context.lineTo(contractsLeft - 10.5, height);
  context.stroke();

  context.font = "500 10px var(--font-mono, ui-monospace, SFMono-Regular, monospace)";
  context.textBaseline = "middle";
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const top = index * rowHeight;
    const center = top + rowHeight / 2;
    const rowTick = Math.round(row.price / frame.tickSize);
    const sideColor = row.side === "BID" ? palette.primary : palette.danger;
    const depthStrength = Math.log1p(row.liveContracts) / Math.log1p(maximumDepth);
    const stripWidth = depthStrength * Math.max(20, railLeft - 8);
    const gradient = context.createLinearGradient(0, 0, Math.max(1, stripWidth), 0);
    gradient.addColorStop(0, alpha(sideColor, 0.06));
    gradient.addColorStop(1, alpha(sideColor, 0.34));
    context.fillStyle = gradient;
    context.fillRect(0, top + 1, stripWidth, Math.max(1, rowHeight - 2));

    if (row.state === "SUSPECT") {
      context.fillStyle = alpha(palette.warning, 0.09);
      context.fillRect(0, top + 1, width, Math.max(1, rowHeight - 2));
    } else if (row.state === "PULLED") {
      context.fillStyle = alpha(palette.danger, 0.12);
      context.fillRect(0, top + 1, width, Math.max(1, rowHeight - 2));
    } else if (row.state === "DUMPED") {
      context.fillStyle = alpha(palette.primary, 0.1);
      context.fillRect(0, top + 1, width, Math.max(1, rowHeight - 2));
    }

    context.strokeStyle = alpha(palette.border, 0.6);
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, Math.round(top) + 0.5);
    context.lineTo(width, Math.round(top) + 0.5);
    context.stroke();

    if (rowTick === currentTick) {
      context.strokeStyle = palette.foreground;
      context.setLineDash([5, 5]);
      context.beginPath();
      context.moveTo(0, center + 0.5);
      context.lineTo(width, center + 0.5);
      context.stroke();
      context.setLineDash([]);
    }

    if (row.state !== "QUIET") {
      const label = row.state + (row.score > 0 ? ` ${row.score}` : "");
      context.font = "700 9px var(--font-mono, ui-monospace, monospace)";
      const labelWidth = context.measureText(label).width + 12;
      context.fillStyle = row.state === "SUSPECT"
        ? alpha(palette.warning, 0.18)
        : row.state === "PULLED"
          ? alpha(palette.danger, 0.22)
          : alpha(palette.primary, 0.2);
      context.fillRect(Math.max(6, railLeft - labelWidth - 8), center - 8, labelWidth, 16);
      context.fillStyle = row.state === "SUSPECT" ? palette.warning : row.state === "PULLED" ? palette.danger : palette.primary;
      context.fillText(label, Math.max(12, railLeft - labelWidth - 2), center);
    }

    context.font = "600 9px var(--font-mono, ui-monospace, monospace)";
    if (row.cancelledContracts > 0) {
      context.fillStyle = palette.danger;
      context.textAlign = "right";
      context.fillText(`(-${Math.round(row.cancelledContracts)})`, railLeft - 12, center);
    }
    if (row.aggressiveContracts > 0) {
      context.fillStyle = palette.primary;
      context.textAlign = "right";
      context.fillText(`(+${Math.round(row.aggressiveContracts)})`, railLeft - 84, center);
    }
    context.textAlign = "left";
    context.font = "500 10px var(--font-mono, ui-monospace, monospace)";
    context.fillStyle = rowTick === currentTick ? palette.foreground : palette.muted;
    context.fillText(row.price.toFixed(decimals), priceLeft, center);
    context.textAlign = "right";
    context.fillStyle = row.liveContracts > 0 ? sideColor : alpha(palette.muted, 0.55);
    context.fillText(row.liveContracts > 0 ? Math.round(row.liveContracts).toLocaleString() : "—", width - 10, center);
    context.textAlign = "left";
  }

  if (candles.length > 1) {
    const shown = candles.slice(-Math.max(12, Math.min(80, Math.floor(width / 11))));
    const chartLeft = 20;
    const chartRight = railLeft - 18;
    const candleStep = (chartRight - chartLeft) / Math.max(1, shown.length);
    const topPrice = rows[0].price + frame.tickSize / 2;
    const bottomPrice = rows.at(-1)!.price - frame.tickSize / 2;
    const yFor = (price: number) => ((topPrice - price) / Math.max(frame.tickSize, topPrice - bottomPrice)) * height;
    context.save();
    context.beginPath();
    context.rect(0, 0, railLeft, height);
    context.clip();
    shown.forEach((candle, index) => {
      const x = chartLeft + index * candleStep + candleStep / 2;
      const bullish = candle.close >= candle.open;
      const color = bullish ? palette.primary : palette.danger;
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, yFor(candle.high));
      context.lineTo(x, yFor(candle.low));
      context.stroke();
      const bodyTop = yFor(Math.max(candle.open, candle.close));
      const bodyBottom = yFor(Math.min(candle.open, candle.close));
      const bodyWidth = Math.max(2, Math.min(8, candleStep * 0.62));
      context.fillStyle = color;
      context.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, Math.max(1.5, bodyBottom - bodyTop));
    });
    context.restore();
  }

  context.fillStyle = alpha(palette.panel, 0.94);
  context.fillRect(railLeft, 0, width - railLeft, Math.min(22, height));
  context.font = "700 8px var(--font-mono, ui-monospace, monospace)";
  context.fillStyle = palette.muted;
  context.fillText("PRICE", priceLeft, 11);
  context.textAlign = "right";
  context.fillText("LIVE CONTRACTS", width - 10, 11);
  context.textAlign = "left";
}

function SettingRange({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (next) => String(next),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.1em] text-muted">
        <span>{label}</span>
        <span className="font-mono text-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}

export default function SpoofingDetectorWorkspace({
  workspaceId,
  instrument,
}: SpoofingDetectorWorkspaceProps) {
  const identity = useMemo(() => instrumentIdentity(instrument), [instrument]);
  const storageKey = `kwantdesk:spoofing-detector:${workspaceId}:v1`;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef(new SpoofingDetectorEngine());
  const frameRef = useRef<SpoofingDetectorFrame | null>(null);
  const snapshotRef = useRef<RithmicLiquiditySnapshot | null>(null);
  const candlesRef = useRef<SpoofingCandle[]>([]);
  const seenTradeIdsRef = useRef(new Set<number>());
  const renderFrameRef = useRef<number | null>(null);
  const lastSummaryAtRef = useRef(0);
  const summaryTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<RithmicLiquidityStatus>("checking");
  const [frameSummary, setFrameSummary] = useState<SpoofingDetectorFrame | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hovered, setHovered] = useState<HoveredRow | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [settings, setSettings] = useState(DEFAULT_SPOOFING_DETECTOR_SETTINGS);
  const [draft, setDraft] = useState(DEFAULT_SPOOFING_DETECTOR_SETTINGS);

  const scheduleDraw = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      drawSpoofingChart(canvas, frameRef.current, candlesRef.current, settings, readPalette(container));
    });
  }, [settings]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null") as Partial<SpoofingDetectorSettings> | null;
      const restored = normalizeSpoofingDetectorSettings(parsed);
      setSettings(restored);
      setDraft(restored);
    } catch {
      setSettings(DEFAULT_SPOOFING_DETECTOR_SETTINGS);
      setDraft(DEFAULT_SPOOFING_DETECTOR_SETTINGS);
    }
  }, [storageKey]);

  useEffect(() => {
    engineRef.current.reset();
    frameRef.current = null;
    snapshotRef.current = null;
    candlesRef.current = [];
    seenTradeIdsRef.current.clear();
    setFrameSummary(null);
    setStatus("checking");
    return subscribeRithmicLiquidity({
      root: identity.bookRoot,
      contractSymbol: identity.contractSymbol || null,
      replayHistory: true,
      onStatus: setStatus,
      onSnapshot: (snapshot) => {
        snapshotRef.current = snapshot;
        appendSpoofingCandles(
          candlesRef.current,
          snapshot.trades ?? [],
          settings.candleIntervalMs,
          seenTradeIdsRef.current,
        );
        const frame = engineRef.current.apply(snapshot, settings);
        frameRef.current = frame;
        const now = performance.now();
        if (now - lastSummaryAtRef.current >= 240 || lastSummaryAtRef.current === 0) {
          lastSummaryAtRef.current = now;
          setFrameSummary(frame);
        } else if (summaryTimerRef.current === null) {
          summaryTimerRef.current = window.setTimeout(() => {
            summaryTimerRef.current = null;
            lastSummaryAtRef.current = performance.now();
            setFrameSummary(frameRef.current);
          }, Math.max(16, 240 - (now - lastSummaryAtRef.current)));
        }
        scheduleDraw();
      },
    });
  }, [identity.bookRoot, identity.contractSymbol, scheduleDraw, settings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(container);
    const redraw = () => scheduleDraw();
    window.addEventListener("kwantdesk:theme-change", redraw);
    scheduleDraw();
    return () => {
      observer.disconnect();
      window.removeEventListener("kwantdesk:theme-change", redraw);
      if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
      if (summaryTimerRef.current !== null) window.clearTimeout(summaryTimerRef.current);
      renderFrameRef.current = null;
      summaryTimerRef.current = null;
    };
  }, [scheduleDraw]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const saveSettings = () => {
    const next = normalizeSpoofingDetectorSettings(draft);
    writeProtectedItem(storageKey, JSON.stringify(next));
    setSettings(next);
    setDraft(next);
    engineRef.current.reset();
    if (snapshotRef.current) frameRef.current = engineRef.current.apply(snapshotRef.current, next);
    setFrameSummary(frameRef.current);
    setSettingsOpen(false);
    scheduleDraw();
  };

  const resetSettings = () => {
    setDraft(DEFAULT_SPOOFING_DETECTOR_SETTINGS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return setHovered(null);
    const rect = canvas.getBoundingClientRect();
    const index = Math.floor(((event.clientY - rect.top) / Math.max(1, rect.height)) * settings.visibleRows);
    const row = visibleRows(frame, settings.visibleRows)[index];
    if (!row) return setHovered(null);
    setHovered({ ...row, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const stale = frameSummary && (
    status === "unavailable"
    || !frameSummary.bookValid
    || (snapshotRef.current?.ageMs ?? 0) > 15_000
    || clock - frameSummary.timestamp > 15_000
  );
  const individualUnavailable = settings.detectionMode === "INDIVIDUAL_ORDER" && frameSummary?.individualOrders !== true;
  const suspectCount = frameSummary?.rows.filter((row) => row.state === "SUSPECT").length ?? 0;
  const pulledCount = frameSummary?.rows.filter((row) => row.state === "PULLED").length ?? 0;

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-chart-background text-foreground">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-panel/95 px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground">PHANTOM ORDERS</span>
          <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[8px] text-muted">
            {identity.chartRoot}{identity.chartRoot !== identity.bookRoot ? ` · ${identity.bookRoot} BOOK` : ""}
          </span>
          <span className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-yellow-400" : status === "connected" ? "bg-primary" : "bg-muted"}`} />
          <span className="hidden font-mono text-[8px] uppercase tracking-[0.08em] text-muted sm:inline">
            {stale ? "STALE BOOK" : status === "connected" ? "LIVE MBO" : "CONNECTING"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden font-mono text-[8px] text-warning sm:inline">SUSPECT {suspectCount}</span>
          <span className="hidden font-mono text-[8px] text-danger sm:inline">PULLED {pulledCount}</span>
          <button
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
            className={`flex h-7 w-7 items-center justify-center border transition-colors ${settingsOpen ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
            aria-label="Spoofing detector settings"
            title="Detector settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHovered(null)}
          aria-label="Live suspected spoofing order-book chart"
        />
        {!frameSummary && status === "checking" ? (
          <KwantLoader className="absolute inset-0 h-full w-full bg-chart-background" compact title="Loading PHANTOM ORDERS" detail="Restoring the shared Rithmic order book." />
        ) : null}
        {!frameSummary && status === "unavailable" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-chart-background/95 p-6 text-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-danger">LEVEL 3 DATA UNAVAILABLE</div>
              <p className="mt-2 max-w-sm text-[9px] leading-4 text-muted">No valid full-depth book is available for this instrument. No suspected patterns are being calculated.</p>
            </div>
          </div>
        ) : null}
        {individualUnavailable ? (
          <div className="pointer-events-none absolute left-2 top-2 border border-warning/35 bg-panel/90 px-2 py-1 font-mono text-[8px] text-warning">
            INDIVIDUAL ORDER MODE WAITING FOR NATIVE DBO · PRICE-LEVEL BOOK REMAINS VISIBLE
          </div>
        ) : null}
        {stale && frameSummary ? (
          <div className="pointer-events-none absolute bottom-2 left-2 border border-warning/35 bg-panel/90 px-2 py-1 font-mono text-[8px] text-warning">
            LAST VALID BOOK · DETECTION PAUSED UNTIL FRESH DEPTH RESUMES
          </div>
        ) : null}
        {hovered ? (
          <div
            className="pointer-events-none absolute z-20 w-[230px] border border-border bg-panel/95 p-2 shadow-2xl backdrop-blur-md"
            style={{ left: Math.min(hovered.x + 12, Math.max(4, (containerRef.current?.clientWidth ?? 260) - 238)), top: Math.max(4, hovered.y - 42) }}
          >
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-foreground">
              <span>{hovered.side} {hovered.price.toFixed(priceDecimals(frameSummary?.tickSize ?? 0.25))}</span>
              <span>{hovered.state}{hovered.score ? ` ${hovered.score}` : ""}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[8px] text-muted">
              <span>Live contracts</span><span className="text-right text-foreground">{hovered.liveContracts.toLocaleString()}</span>
              <span>Orders</span><span className="text-right text-foreground">{hovered.orderCount.toLocaleString()}</span>
              <span>Cancelled</span><span className="text-right text-danger">{hovered.cancelledContracts ? `-${hovered.cancelledContracts}` : "—"}</span>
              <span>Aggressive</span><span className="text-right text-primary">{hovered.aggressiveContracts ? `+${hovered.aggressiveContracts}` : "—"}</span>
            </div>
            <p className="mt-1.5 text-[8px] leading-3 text-muted">Pattern score describes observed book behaviour only; it does not establish identity or intent.</p>
          </div>
        ) : null}
      </div>

      <FloatingSettingsWindow
        open={settingsOpen}
        title="Spoofing Detector Settings"
        subtitle="Live chart remains interactive behind this window"
        onClose={() => setSettingsOpen(false)}
        widthClassName="w-[min(440px,calc(100vw-24px))]"
        contentClassName="space-y-4 p-3"
        footer={(
          <div className="flex gap-2">
            <button type="button" onClick={resetSettings} className="flex h-8 items-center gap-1.5 border border-border px-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-foreground"><RotateCcw className="h-3 w-3" /> Reset</button>
            <button type="button" onClick={saveSettings} className="flex h-8 flex-1 items-center justify-center gap-1.5 bg-primary px-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-background"><Save className="h-3 w-3" /> Save to workspace</button>
          </div>
        )}
      >
            <label className="block space-y-1.5 text-[9px] uppercase tracking-[0.1em] text-muted">
              <span>Detection mode</span>
              <select
                value={draft.detectionMode}
                onChange={(event) => setDraft((current) => ({ ...current, detectionMode: event.target.value as SpoofingDetectorSettings["detectionMode"] }))}
                className="h-8 w-full border border-border bg-surface px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/40"
              >
                <option value="PRICE_LEVEL">PRICE LEVEL</option>
                <option value="INDIVIDUAL_ORDER">INDIVIDUAL ORDER (NATIVE DBO)</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-[9px] uppercase tracking-[0.1em] text-muted">
              <span>Candle interval</span>
              <select
                value={draft.candleIntervalMs}
                onChange={(event) => setDraft((current) => ({ ...current, candleIntervalMs: Number(event.target.value) }))}
                className="h-8 w-full border border-border bg-surface px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/40"
              >
                <option value={1_000}>1 SECOND</option>
                <option value={2_000}>2 SECONDS</option>
                <option value={5_000}>5 SECONDS</option>
                <option value={10_000}>10 SECONDS</option>
              </select>
            </label>
            <SettingRange label="Visible price rows" value={draft.visibleRows} min={10} max={40} step={1} onChange={(value) => setDraft((current) => ({ ...current, visibleRows: value }))} />
            <SettingRange label="Minimum candidate" value={draft.minimumCandidateContracts} min={1} max={2_000} step={1} onChange={(value) => setDraft((current) => ({ ...current, minimumCandidateContracts: value }))} format={(value) => `${value} ct`} />
            <SettingRange label="Size multiple" value={draft.sizeMultiple} min={1} max={10} step={0.1} onChange={(value) => setDraft((current) => ({ ...current, sizeMultiple: value }))} format={(value) => `${value.toFixed(1)}×`} />
            <SettingRange label="Cancellation ratio" value={draft.cancellationRatio} min={0.05} max={1} step={0.01} onChange={(value) => setDraft((current) => ({ ...current, cancellationRatio: value }))} format={(value) => `${Math.round(value * 100)}%`} />
            <SettingRange label="Maximum lifetime" value={draft.maximumLifetimeMs} min={250} max={30_000} step={250} onChange={(value) => setDraft((current) => ({ ...current, maximumLifetimeMs: value }))} format={(value) => `${(value / 1_000).toFixed(2)}s`} />
            <SettingRange label="Maximum executed ratio" value={draft.maximumExecutionRatio} min={0} max={1} step={0.01} onChange={(value) => setDraft((current) => ({ ...current, maximumExecutionRatio: value }))} format={(value) => `${Math.round(value * 100)}%`} />
            <SettingRange label="Pattern score threshold" value={draft.scoreThreshold} min={1} max={100} step={1} onChange={(value) => setDraft((current) => ({ ...current, scoreThreshold: value }))} />
            <SettingRange label="Aggressive dump minimum" value={draft.minimumAggressiveContracts} min={1} max={2_000} step={1} onChange={(value) => setDraft((current) => ({ ...current, minimumAggressiveContracts: value }))} format={(value) => `${value} ct`} />
            <SettingRange label="Marker retention" value={draft.markerRetentionMs} min={1_000} max={300_000} step={1_000} onChange={(value) => setDraft((current) => ({ ...current, markerRetentionMs: value }))} format={(value) => `${Math.round(value / 1_000)}s`} />
            <SettingRange label="Pull / repost window" value={draft.pullRepostWindowMs} min={250} max={30_000} step={250} onChange={(value) => setDraft((current) => ({ ...current, pullRepostWindowMs: value }))} format={(value) => `${(value / 1_000).toFixed(2)}s`} />
            <div className="space-y-2 border-t border-border pt-3">
              {([
                ["layeringEnabled", "Layering detection"],
                ["pullRepostEnabled", "Pull / repost detection"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.1em] text-muted">
                  <span>{label}</span>
                  <input type="checkbox" checked={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))} className="h-3.5 w-3.5 accent-primary" />
                </label>
              ))}
            </div>
            <div className="flex gap-2 border border-border bg-surface/55 p-2 text-[8px] leading-3 text-muted">
              <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>This tool flags suspicious order-book behaviour. It does not determine trader identity or legally establish intent.</span>
            </div>
      </FloatingSettingsWindow>
    </div>
  );
}
