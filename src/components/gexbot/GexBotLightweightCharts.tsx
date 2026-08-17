"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEventParams, Time } from "lightweight-charts";

import { createChart, LineStyle, type IChartApi, type ISeriesApi } from "@/lib/lightweightChartsCompat";
import type { GexBotOrderflowFrame, GexBotProfileFrame, GexBotStrike } from "@/lib/gexBotTypes";

type SpotSample = { timestamp: number; spot: number; zeroGamma?: number | null };
type Dataset = "volume" | "oi" | "both";
type LineStyleName = "solid" | "short" | "dash" | "dot";
export type GexBotStateMetric = "gex" | "gamma" | "delta" | "vanna" | "charm" | "convexity" | "negative_vanna" | "open_interest";

type Appearance = {
  positive: string; negative: string; oiPositive: string; oiNegative: string;
  prior: string; prior2: string; prior3: string; spot: string;
  showPositive: boolean; showNegative: boolean; showPriors: boolean; showSpot: boolean;
  showZero: boolean; showMajors: boolean; showVolumeMajors: boolean; showOiMajors: boolean;
  lineStyle: LineStyleName; zeroLineStyle: LineStyleName; majorLineStyle: LineStyleName;
  chartType: "line" | "candles"; profileAlignment: "left" | "center" | "right";
  dotSize: number; lookbackCount: number; multiplier: number; timeZone: string;
};

export type OrderflowMetricConfig = { id: string; one: string; label: string; color: string; description: string };
export type OrderflowPanelConfig = OrderflowMetricConfig & {
  expiry: "latest" | "next"; combine: boolean; showSpot: boolean; windowMinutes: 5 | 15 | 30 | 60 | 390;
};

const BG = "#050607";
const GRID = "rgba(121,132,151,.14)";
const TEXT = "#9ba4b2";

function time(timestamp: number): Time { return Math.floor(timestamp / 1000) as Time; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function lwLineStyle(value: LineStyleName) {
  if (value === "dot") return LineStyle.Dotted;
  if (value === "dash" || value === "short") return LineStyle.Dashed;
  return LineStyle.Solid;
}

function visibleStrikes(frame: GexBotProfileFrame, count = 76) {
  const ordered = [...frame.strikes].sort((a, b) => a[0] - b[0]);
  if (ordered.length <= count) return ordered;
  const center = ordered.reduce((best, entry, index) => Math.abs(entry[0] - frame.spot) < Math.abs(ordered[best][0] - frame.spot) ? index : best, 0);
  const start = Math.max(0, Math.min(ordered.length - count, center - Math.floor(count / 2)));
  return ordered.slice(start, start + count);
}

function candles(samples: SpotSample[]) {
  const buckets = new Map<number, number[]>();
  samples.forEach((sample) => {
    const bucket = Math.floor(sample.timestamp / 60_000) * 60_000;
    const values = buckets.get(bucket) ?? [];
    values.push(sample.spot);
    buckets.set(bucket, values);
  });
  return [...buckets.entries()].slice(-720).map(([timestamp, values]) => ({
    time: time(timestamp), open: values[0], high: Math.max(...values), low: Math.min(...values), close: values.at(-1)!,
  }));
}

function ProfileCanvas({
  frame, strikes, dataset, appearance, priceSeries, chart, palette,
}: {
  frame: GexBotProfileFrame; strikes: GexBotStrike[]; dataset: Dataset; appearance: Appearance;
  priceSeries: ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> | null; chart: IChartApi | null;
  palette?: { primary: string; secondary: string; call: string; put: string };
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !priceSeries) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    let raf = 0;
    const draw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = parent.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);
        const plotRight = Math.max(40, rect.width - 58);
        const origin = appearance.profileAlignment === "left" ? rect.width * .20 : appearance.profileAlignment === "right" ? rect.width * .80 : rect.width * .50;
        const available = Math.max(80, Math.min(origin - 10, plotRight - origin - 10));
        const values = strikes.flatMap((row) => dataset === "volume" ? [row[1]] : dataset === "oi" ? [row[2]] : [row[1], row[2]]);
        const max = Math.max(1, ...values.map((value) => Math.abs(value * appearance.multiplier)));
        const yCoords = strikes.map((row) => priceSeries.priceToCoordinate(row[0]));
        const validGaps = yCoords.slice(1).flatMap((next, index) => next !== null && yCoords[index] !== null ? [Math.abs(next - yCoords[index]!)] : []);
        const rowHeight = Math.max(3, Math.min(14, (Math.min(...validGaps, 16) || 10) * .62));
        const drawBar = (value: number, strike: number, colorUp: string, colorDown: string, height: number, alpha: number) => {
          if ((value >= 0 && !appearance.showPositive) || (value < 0 && !appearance.showNegative)) return;
          const y = priceSeries.priceToCoordinate(strike);
          if (y === null || y < -20 || y > rect.height + 20) return;
          const width = Math.max(1, Math.abs(value * appearance.multiplier) / max * available);
          const x = value >= 0 ? origin : origin - width;
          const color = value >= 0 ? colorUp : colorDown;
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 7;
          ctx.shadowColor = color;
          ctx.fillStyle = color;
          ctx.fillRect(x, y - height / 2, width, height);
        };
        strikes.forEach((row) => {
          if (dataset === "volume" || dataset === "both") drawBar(row[1], row[0], palette?.primary ?? appearance.positive, palette?.secondary ?? appearance.negative, dataset === "both" ? rowHeight * .62 : rowHeight, .9);
          if (dataset === "oi" || dataset === "both") drawBar(row[2], row[0], palette?.call ?? appearance.oiPositive, palette?.put ?? appearance.oiNegative, dataset === "both" ? rowHeight * .28 : rowHeight, dataset === "both" ? .58 : .9);
          if (appearance.showPriors) row[3].slice(0, appearance.lookbackCount).forEach((prior, index) => {
            const y = priceSeries.priceToCoordinate(row[0]);
            if (y === null) return;
            const x = origin + (prior * appearance.multiplier / max) * available;
            ctx.beginPath(); ctx.globalAlpha = Math.max(.18, .7 - index * .12); ctx.fillStyle = [appearance.prior, appearance.prior2, appearance.prior3][index] ?? appearance.prior;
            ctx.arc(x, y, Math.max(1.5, appearance.dotSize * .52), 0, Math.PI * 2); ctx.fill();
          });
        });
        ctx.globalAlpha = .7; ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(238,242,247,.55)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(origin, 0); ctx.lineTo(origin, rect.height - 26); ctx.stroke();
      });
    };
    const resize = new ResizeObserver(draw);
    resize.observe(parent);
    chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
    let pointerDown = false;
    const startPointer = () => { pointerDown = true; draw(); };
    const movePointer = () => { if (pointerDown) draw(); };
    const endPointer = () => { pointerDown = false; draw(); };
    parent.addEventListener("wheel", draw, { passive: true });
    parent.addEventListener("pointerdown", startPointer, { passive: true });
    parent.addEventListener("pointermove", movePointer, { passive: true });
    window.addEventListener("pointerup", endPointer, { passive: true });
    draw();
    return () => {
      cancelAnimationFrame(raf); resize.disconnect(); chart.timeScale().unsubscribeVisibleLogicalRangeChange(draw);
      parent.removeEventListener("wheel", draw);
      parent.removeEventListener("pointerdown", startPointer);
      parent.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", endPointer);
    };
  }, [appearance, chart, dataset, frame.timestamp, palette, priceSeries, strikes]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true" />;
}

function LightweightProfile({
  frame, dataset, appearance, spotTape, onHover, palette,
}: {
  frame: GexBotProfileFrame; dataset: Dataset; appearance: Appearance; spotTape: SpotSample[];
  onHover: (strike: GexBotStrike | null) => void; palette?: { primary: string; secondary: string; call: string; put: string };
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const zeroRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [surface, setSurface] = useState<{ chart: IChartApi; series: ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> } | null>(null);
  const strikes = useMemo(() => visibleStrikes(frame), [frame]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      autoSize: true, layout: { background: { color: BG }, textColor: TEXT, fontFamily: "JetBrains Mono, monospace", fontSize: 10 },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: 0, vertLine: { color: "rgba(235,240,248,.5)", style: LineStyle.Dashed }, horzLine: { color: "rgba(235,240,248,.5)", style: LineStyle.Dashed } },
      rightPriceScale: { visible: true, borderColor: "rgba(121,132,151,.28)", autoScale: true },
      timeScale: { borderColor: "rgba(121,132,151,.28)", timeVisible: true, secondsVisible: false, rightOffset: 14, barSpacing: 7, shiftVisibleRangeOnNewBar: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    const line = chart.addLineSeries({ color: "#f4f6f8", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: true });
    const candle = chart.addCandlestickSeries({ upColor: appearance.positive, downColor: appearance.negative, wickUpColor: appearance.positive, wickDownColor: appearance.negative, borderVisible: false, priceLineVisible: false, lastValueVisible: false });
    const zero = chart.addLineSeries({ color: "#d4ad45", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chartRef.current = chart; lineRef.current = line; candleRef.current = candle; zeroRef.current = zero;
    setSurface({ chart, series: appearance.chartType === "candles" ? candle : line });
    const crosshair = (param: MouseEventParams<Time>) => {
      if (!param.point) return onHover(null);
      const hoveredPrice = (appearance.chartType === "candles" ? candle : line).coordinateToPrice(param.point.y);
      if (!finite(hoveredPrice)) return onHover(null);
      onHover(strikes.reduce((best, row) => Math.abs(row[0] - hoveredPrice) < Math.abs(best[0] - hoveredPrice) ? row : best, strikes[0]));
    };
    chart.subscribeCrosshairMove(crosshair);
    return () => { chart.unsubscribeCrosshairMove(crosshair); chart.remove(); chartRef.current = null; lineRef.current = null; candleRef.current = null; zeroRef.current = null; };
  // Renderer is deliberately stable; data/options update below without rebuilding the chart.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current, line = lineRef.current, candle = candleRef.current, zero = zeroRef.current;
    if (!chart || !line || !candle || !zero) return;
    const samples = spotTape.length ? spotTape.slice(-720) : [{ timestamp: frame.timestamp, spot: frame.spot }];
    line.setData(samples.map((sample) => ({ time: time(sample.timestamp), value: sample.spot })));
    candle.setData(candles(samples));
    zero.setData(appearance.showZero ? samples.flatMap((sample) => finite(sample.zeroGamma) ? [{ time: time(sample.timestamp), value: sample.zeroGamma }] : []) : []);
    line.applyOptions({ visible: appearance.chartType === "line", color: "#f4f6f8" });
    candle.applyOptions({ visible: appearance.chartType === "candles", upColor: appearance.positive, downColor: appearance.negative, wickUpColor: appearance.positive, wickDownColor: appearance.negative });
    zero.applyOptions({ visible: appearance.showZero, lineStyle: lwLineStyle(appearance.zeroLineStyle) });
    const active = appearance.chartType === "candles" ? candle : line;
    const priceLines = [
      appearance.showSpot ? { price: frame.spot, color: appearance.spot, title: "SPOT", style: LineStyle.Solid, width: 2 } : null,
      appearance.showZero && finite(frame.zero_gamma) ? { price: frame.zero_gamma, color: "#d4ad45", title: "ZERO", style: lwLineStyle(appearance.zeroLineStyle), width: 1 } : null,
      appearance.showMajors && appearance.showVolumeMajors && dataset !== "oi" && finite(frame.major_pos_vol) ? { price: frame.major_pos_vol, color: appearance.positive, title: "", style: lwLineStyle(appearance.majorLineStyle), width: 1 } : null,
      appearance.showMajors && appearance.showVolumeMajors && dataset !== "oi" && finite(frame.major_neg_vol) ? { price: frame.major_neg_vol, color: appearance.negative, title: "", style: lwLineStyle(appearance.majorLineStyle), width: 1 } : null,
      appearance.showMajors && appearance.showOiMajors && dataset !== "volume" && finite(frame.major_pos_oi) ? { price: frame.major_pos_oi, color: appearance.oiPositive, title: "", style: lwLineStyle(appearance.majorLineStyle), width: 1 } : null,
      appearance.showMajors && appearance.showOiMajors && dataset !== "volume" && finite(frame.major_neg_oi) ? { price: frame.major_neg_oi, color: appearance.oiNegative, title: "", style: lwLineStyle(appearance.majorLineStyle), width: 1 } : null,
    ].filter(Boolean) as Array<{ price: number; color: string; title: string; style: LineStyle; width: number }>;
    const created = priceLines.map((item) => active.createPriceLine({ price: item.price, color: item.color, title: item.title, lineStyle: item.style, lineWidth: item.width as 1 | 2, axisLabelVisible: Boolean(item.title) }));
    return () => created.forEach((priceLine) => active.removePriceLine(priceLine));
  }, [appearance, dataset, frame, spotTape]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = appearance.chartType === "candles" ? candleRef.current : lineRef.current;
    if (chart && series) setSurface({ chart, series });
  }, [appearance.chartType]);

  return <div className="relative min-h-[600px] w-full" data-gex-box-chart="true">
    <div ref={hostRef} className="absolute inset-0" />
    <ProfileCanvas frame={frame} strikes={strikes} dataset={dataset} appearance={appearance} priceSeries={surface?.series ?? null} chart={surface?.chart ?? null} palette={palette} />
    <div className="pointer-events-none absolute left-3 top-3 z-[3] border border-white/10 bg-black/70 px-2 py-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/65">Lightweight Charts · native pan / zoom / crosshair</div>
  </div>;
}

const STATE_PALETTES: Record<GexBotStateMetric, { primary: string; secondary: string; call: string; put: string }> = {
  gex: { primary: "#42df84", secondary: "#ff5268", call: "#42df84", put: "#ff5268" }, gamma: { primary: "#f0a52c", secondary: "#8c61ff", call: "#52df91", put: "#ff5f72" },
  delta: { primary: "#38d3ee", secondary: "#ff667a", call: "#38d3ee", put: "#ff667a" }, vanna: { primary: "#87ed58", secondary: "#cb72ff", call: "#87ed58", put: "#cb72ff" },
  charm: { primary: "#ffc557", secondary: "#778bff", call: "#ffc557", put: "#778bff" }, convexity: { primary: "#bd8cff", secondary: "#ff79bf", call: "#bd8cff", put: "#ff79bf" },
  negative_vanna: { primary: "#59d9b4", secondary: "#ef668b", call: "#59d9b4", put: "#ef668b" }, open_interest: { primary: "#73b7ff", secondary: "#ffb347", call: "#73b7ff", put: "#ffb347" },
};

export function ProfessionalProfileChart(props: { frame: GexBotProfileFrame; dataset: Dataset; appearance: Appearance; spotTape: SpotSample[]; priorIndex: number; maxChange?: Array<{ label: string; value: [number, number] }>; onHover: (strike: GexBotStrike | null) => void }) {
  return <LightweightProfile {...props} />;
}
export function ProfessionalStateChart(props: { frame: GexBotProfileFrame; metric: GexBotStateMetric; appearance: Appearance; spotTape: SpotSample[]; priorIndex: number; onHover: (strike: GexBotStrike | null) => void }) {
  return <LightweightProfile {...props} dataset="both" palette={STATE_PALETTES[props.metric]} />;
}

function OrderflowPanel({ panel, points }: { panel: OrderflowPanelConfig; points: GexBotOrderflowFrame[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, { autoSize: true, layout: { background: { color: BG }, textColor: TEXT, fontFamily: "JetBrains Mono, monospace", fontSize: 9 }, grid: { vertLines: { color: GRID }, horzLines: { color: GRID } }, crosshair: { mode: 0 }, rightPriceScale: { borderColor: GRID }, timeScale: { timeVisible: true, secondsVisible: true, borderColor: GRID, barSpacing: 6 }, handleScroll: true, handleScale: true });
    const exposure = chart.addLineSeries({ color: panel.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: panel.label });
    const spot = chart.addLineSeries({ color: "rgba(245,247,250,.78)", lineWidth: 1, priceScaleId: "spot", priceLineVisible: false, lastValueVisible: false });
    const value = (point: GexBotOrderflowFrame, field: string) => finite(point[field as keyof GexBotOrderflowFrame]) ? point[field as keyof GexBotOrderflowFrame] as number : null;
    const selected = (point: GexBotOrderflowFrame) => {
      const latest = value(point, panel.id), next = value(point, panel.one);
      if (panel.combine) return latest === null && next === null ? null : (latest ?? 0) + (next ?? 0);
      return panel.expiry === "next" ? next : latest;
    };
    exposure.setData(points.flatMap((point) => { const next = selected(point); return next === null ? [] : [{ time: time(point.timestamp), value: next }]; }));
    spot.setData(panel.showSpot ? points.map((point) => ({ time: time(point.timestamp), value: point.spot })) : []);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [panel, points]);
  return <section className="relative h-[220px] min-w-[640px] border-b border-border"><div className="pointer-events-none absolute left-3 top-2 z-[2] font-mono text-[9px] font-semibold uppercase tracking-[.14em]" style={{ color: panel.color }}>{panel.label}</div><div ref={hostRef} className="absolute inset-0" data-gex-box-chart="true" /></section>;
}

export function ProfessionalOrderflowChart({ panels, points }: { panels: OrderflowPanelConfig[]; points: GexBotOrderflowFrame[] }) {
  return <div className="min-w-[720px] overflow-hidden border border-border bg-black">{panels.map((panel) => <OrderflowPanel key={panel.id} panel={panel} points={points} />)}</div>;
}
