"use client";

import { Camera, Maximize2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEventParams, Time } from "lightweight-charts";

import { createChart, LineStyle, type IChartApi, type ISeriesApi } from "@/lib/lightweightChartsCompat";
import type { RithmicClassicCandle } from "@/lib/gex-box/rithmicCandles";
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
  classicElements: Record<string, { enabled: boolean; color: string; size: number; lineStyle: LineStyleName }>;
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

function element(appearance: Appearance, id: string, fallback: { enabled: boolean; color: string; size?: number; lineStyle?: LineStyleName }) {
  return appearance.classicElements?.[id] ?? { ...fallback, size: fallback.size ?? 1, lineStyle: fallback.lineStyle ?? "solid" };
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
  frame, frames, strikes, dataset, appearance, priceSeries, chart, palette, profileScale,
}: {
  frame: GexBotProfileFrame; frames: GexBotProfileFrame[]; strikes: GexBotStrike[]; dataset: Dataset; appearance: Appearance;
  priceSeries: ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> | null; chart: IChartApi | null;
  palette?: { primary: string; secondary: string; call: string; put: string };
  profileScale: number;
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
        const spotHistory = element(appearance, "spotHistory", { enabled: true, color: appearance.spot });
        const latestX = chart.timeScale().timeToCoordinate(time(frame.timestamp));
        const fallbackOrigin = appearance.profileAlignment === "left" ? rect.width * .20 : appearance.profileAlignment === "right" ? rect.width * .80 : rect.width * .68;
        const origin = latestX === null ? fallbackOrigin : Math.max(80, Math.min(plotRight - 40, latestX));
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
          const width = Math.max(1, Math.abs(value * appearance.multiplier) / max * available * profileScale);
          const x = value >= 0 ? origin : origin - width;
          const color = value >= 0 ? colorUp : colorDown;
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 7;
          ctx.shadowColor = color;
          ctx.fillStyle = color;
          ctx.fillRect(x, y - height / 2, width, height);
        };
        const rawHistory = frames.length ? frames : [frame];
        // Preserve the full time domain while bounding per-frame canvas work.
        const stride = Math.max(1, Math.ceil(rawHistory.length / 1_200));
        const history = rawHistory.filter((_, index) => index % stride === 0 || index === rawHistory.length - 1);
        const trail = (field: "zero_gamma" | "major_pos_vol" | "major_neg_vol", settingId: string, fallbackColor: string, enabled: boolean) => {
          const setting = element(appearance, settingId, { enabled, color: fallbackColor });
          if (!setting.enabled) return;
          const points = history.flatMap((entry) => {
            const value = entry[field];
            const x = chart.timeScale().timeToCoordinate(time(entry.timestamp));
            const y = finite(value) ? priceSeries.priceToCoordinate(value) : null;
            return x === null || y === null ? [] : [{ x, y }];
          });
          if (points.length < 2) return;
          ctx.globalAlpha = .82; ctx.shadowBlur = 0; ctx.strokeStyle = setting.color; ctx.lineWidth = setting.size;
          ctx.setLineDash(setting.lineStyle === "dot" ? [1, 3] : setting.lineStyle === "dash" ? [7, 5] : setting.lineStyle === "short" ? [3, 3] : []);
          ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((point, index) => { const previous = points[index]; ctx.lineTo(point.x, previous.y); ctx.lineTo(point.x, point.y); });
          ctx.stroke();
          ctx.setLineDash([]);
        };
        trail("zero_gamma", "zeroGammaHistory", "#f59e0b", appearance.showZero);
        trail("major_pos_vol", "majorPositiveHistory", palette?.primary ?? appearance.positive, appearance.showMajors && appearance.showVolumeMajors);
        trail("major_neg_vol", "majorNegativeHistory", palette?.secondary ?? appearance.negative, appearance.showMajors && appearance.showVolumeMajors);

        if (appearance.showPriors) history.forEach((entry) => {
          const x = chart.timeScale().timeToCoordinate(time(entry.timestamp));
          if (x === null) return;
          const windows = [0, 1, 2, 3, 4];
          windows.forEach((windowIndex) => {
            const lookback = element(appearance, `lookback${[1, 5, 10, 15, 30][windowIndex]}`, { enabled: true, color: ["#d9f2ff", "#a8dcff", "#73b7ff", "#438fe2", "#245a9e"][windowIndex], size: appearance.dotSize });
            if (!lookback.enabled) return;
            const candidate = entry.strikes.reduce<GexBotStrike | null>((best, row) => {
              const value = Math.abs(row[3]?.[windowIndex] ?? 0);
              const bestValue = Math.abs(best?.[3]?.[windowIndex] ?? 0);
              return value > bestValue ? row : best;
            }, null);
            if (!candidate) return;
            const y = priceSeries.priceToCoordinate(candidate[0]);
            if (y === null) return;
            ctx.beginPath(); ctx.globalAlpha = .7; ctx.fillStyle = lookback.color;
            ctx.arc(x, y, Math.max(1.2, lookback.size), 0, Math.PI * 2); ctx.fill();
          });
        });

        strikes.forEach((row) => {
          const showVolume = element(appearance, "showGexVolume", { enabled: true, color: appearance.positive }).enabled;
          const showOi = element(appearance, "showGexOi", { enabled: true, color: appearance.oiPositive }).enabled;
          const posVolume = element(appearance, "positiveGexVolume", { enabled: true, color: palette?.primary ?? appearance.positive });
          const negVolume = element(appearance, "negativeGexVolume", { enabled: true, color: palette?.secondary ?? appearance.negative });
          const posOi = element(appearance, "positiveGexOi", { enabled: true, color: palette?.call ?? appearance.oiPositive });
          const negOi = element(appearance, "negativeGexOi", { enabled: true, color: palette?.put ?? appearance.oiNegative });
          if (showVolume && (dataset === "volume" || dataset === "both") && (row[1] >= 0 ? posVolume.enabled : negVolume.enabled)) drawBar(row[1], row[0], posVolume.color, negVolume.color, (dataset === "both" ? rowHeight * .62 : rowHeight) * posVolume.size, .9);
          if (showOi && (dataset === "oi" || dataset === "both") && (row[2] >= 0 ? posOi.enabled : negOi.enabled)) drawBar(row[2], row[0], posOi.color, negOi.color, (dataset === "both" ? rowHeight * .28 : rowHeight) * posOi.size, dataset === "both" ? .58 : .9);
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
        ctx.globalAlpha = .8; ctx.strokeStyle = palette?.primary ?? appearance.positive; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(origin, 0); ctx.lineTo(origin, rect.height - 26); ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = spotHistory.color; ctx.globalAlpha = .7;
        ctx.beginPath(); ctx.moveTo(Math.min(plotRight, origin + 2), 0); ctx.lineTo(Math.min(plotRight, origin + 2), rect.height - 26); ctx.stroke();

        const chip = (value: number | null | undefined, color: string, side: "left" | "right") => {
          if (!finite(value)) return;
          const y = priceSeries.priceToCoordinate(value);
          if (y === null || y < 12 || y > rect.height - 30) return;
          const label = value.toFixed(2); ctx.font = "700 9px JetBrains Mono, monospace";
          const width = ctx.measureText(label).width + 12; const x = side === "left" ? 2 : rect.width - width - 2;
          ctx.globalAlpha = .96; ctx.fillStyle = color; ctx.fillRect(x, y - 9, width, 18);
          ctx.fillStyle = "#050607"; ctx.textBaseline = "middle"; ctx.fillText(label, x + 6, y);
        };
        if (appearance.showMajors && appearance.showVolumeMajors) {
          const majorPositive = element(appearance, "majorPositiveVolume", { enabled: true, color: palette?.primary ?? appearance.positive });
          const majorNegative = element(appearance, "majorNegativeVolume", { enabled: true, color: palette?.secondary ?? appearance.negative });
          if (majorPositive.enabled) chip(frame.major_pos_vol, majorPositive.color, "left");
          if (majorNegative.enabled) chip(frame.major_neg_vol, majorNegative.color, "left");
        }
        const zeroGamma = element(appearance, "zeroGamma", { enabled: true, color: "#f59e0b" });
        if (appearance.showZero && zeroGamma.enabled) chip(frame.zero_gamma, zeroGamma.color, "right");
        if (appearance.showSpot && spotHistory.enabled) chip(frame.spot, spotHistory.color, "right");

        ctx.globalAlpha = .65; ctx.fillStyle = TEXT; ctx.font = "8px JetBrains Mono, monospace"; ctx.textBaseline = "top";
        ctx.fillText(`${(-max / profileScale).toFixed(0)}.00`, Math.max(4, origin - available), 4);
        ctx.fillText("0.00", origin - 10, 4);
        ctx.fillText(`${(max / profileScale).toFixed(0)}.00`, Math.min(rect.width - 76, origin + available - 48), 4);
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
  }, [appearance, chart, dataset, frame, frames, palette, priceSeries, profileScale, strikes]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true" />;
}

function LightweightProfile({
  frame, frames = [], dataset, appearance, spotTape, priceCandles = [], onHover, palette,
}: {
  frame: GexBotProfileFrame; frames?: GexBotProfileFrame[]; dataset: Dataset; appearance: Appearance; spotTape: SpotSample[];
  priceCandles?: RithmicClassicCandle[];
  onHover: (strike: GexBotStrike | null) => void; palette?: { primary: string; secondary: string; call: string; put: string };
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const zeroRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [surface, setSurface] = useState<{ chart: IChartApi; series: ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> } | null>(null);
  const [profileScale, setProfileScale] = useState(1);
  const strikes = useMemo(() => visibleStrikes(frame), [frame]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      autoSize: true, layout: { background: { color: BG }, textColor: TEXT, fontFamily: "JetBrains Mono, monospace", fontSize: 10 },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: 0, vertLine: { color: "rgba(235,240,248,.5)", style: LineStyle.Dashed }, horzLine: { color: "rgba(235,240,248,.5)", style: LineStyle.Dashed } },
      leftPriceScale: { visible: true, borderColor: "rgba(121,132,151,.28)", autoScale: true },
      rightPriceScale: { visible: false },
      timeScale: { borderColor: "rgba(121,132,151,.28)", timeVisible: true, secondsVisible: false, rightOffset: 90, barSpacing: 7, shiftVisibleRangeOnNewBar: true },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
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
    const background = element(appearance, "chartBackground", { enabled: false, color: BG });
    const spotHistory = element(appearance, "spotHistory", { enabled: true, color: appearance.spot, size: 1 });
    const candleUp = element(appearance, "candleUp", { enabled: true, color: appearance.positive });
    const candleDown = element(appearance, "candleDown", { enabled: true, color: appearance.negative });
    const zeroHistory = element(appearance, "zeroGammaHistory", { enabled: true, color: "#f59e0b", size: 1, lineStyle: appearance.zeroLineStyle });
    chart.applyOptions({ layout: { background: { color: background.enabled ? background.color : BG }, textColor: TEXT } });
    const samples = spotTape.length ? spotTape.slice(-12_000) : [{ timestamp: frame.timestamp, spot: frame.spot }];
    line.setData(samples.map((sample) => ({ time: time(sample.timestamp), value: sample.spot })));
    candle.setData(priceCandles.length
      ? priceCandles.map((entry) => ({ time: time(entry.timestamp), open: entry.open, high: entry.high, low: entry.low, close: entry.close }))
      : candles(samples));
    zero.setData(appearance.showZero && zeroHistory.enabled ? samples.flatMap((sample) => finite(sample.zeroGamma) ? [{ time: time(sample.timestamp), value: sample.zeroGamma }] : []) : []);
    line.applyOptions({ visible: appearance.chartType === "line" && spotHistory.enabled, color: spotHistory.color, lineWidth: Math.max(1, Math.min(4, Math.round(spotHistory.size))) as 1 | 2 | 3 | 4 });
    candle.applyOptions({ visible: appearance.chartType === "candles" && (candleUp.enabled || candleDown.enabled), upColor: candleUp.color, downColor: candleDown.color, wickUpColor: candleUp.color, wickDownColor: candleDown.color });
    zero.applyOptions({ visible: appearance.showZero && zeroHistory.enabled, color: zeroHistory.color, lineWidth: Math.max(1, Math.min(4, Math.round(zeroHistory.size))) as 1 | 2 | 3 | 4, lineStyle: lwLineStyle(zeroHistory.lineStyle) });
    const active = appearance.chartType === "candles" ? candle : line;
    const spotLive = element(appearance, "spotHistory", { enabled: true, color: appearance.spot, size: 2 });
    const zeroLive = element(appearance, "zeroGamma", { enabled: true, color: "#f59e0b", size: 1, lineStyle: appearance.zeroLineStyle });
    const posVol = element(appearance, "majorPositiveVolume", { enabled: true, color: appearance.positive, size: 1, lineStyle: appearance.majorLineStyle });
    const negVol = element(appearance, "majorNegativeVolume", { enabled: true, color: appearance.negative, size: 1, lineStyle: appearance.majorLineStyle });
    const posOi = element(appearance, "majorPositiveOi", { enabled: false, color: appearance.oiPositive, size: 1, lineStyle: appearance.majorLineStyle });
    const negOi = element(appearance, "majorNegativeOi", { enabled: false, color: appearance.oiNegative, size: 1, lineStyle: appearance.majorLineStyle });
    const priceLines = [
      appearance.showSpot && spotLive.enabled ? { price: frame.spot, color: spotLive.color, title: "SPOT", style: LineStyle.Solid, width: spotLive.size } : null,
      appearance.showZero && zeroLive.enabled && finite(frame.zero_gamma) ? { price: frame.zero_gamma, color: zeroLive.color, title: "ZERO", style: lwLineStyle(zeroLive.lineStyle), width: zeroLive.size } : null,
      appearance.showMajors && appearance.showVolumeMajors && dataset !== "oi" && posVol.enabled && finite(frame.major_pos_vol) ? { price: frame.major_pos_vol, color: posVol.color, title: "", style: lwLineStyle(posVol.lineStyle), width: posVol.size } : null,
      appearance.showMajors && appearance.showVolumeMajors && dataset !== "oi" && negVol.enabled && finite(frame.major_neg_vol) ? { price: frame.major_neg_vol, color: negVol.color, title: "", style: lwLineStyle(negVol.lineStyle), width: negVol.size } : null,
      appearance.showMajors && appearance.showOiMajors && dataset !== "volume" && posOi.enabled && finite(frame.major_pos_oi) ? { price: frame.major_pos_oi, color: posOi.color, title: "", style: lwLineStyle(posOi.lineStyle), width: posOi.size } : null,
      appearance.showMajors && appearance.showOiMajors && dataset !== "volume" && negOi.enabled && finite(frame.major_neg_oi) ? { price: frame.major_neg_oi, color: negOi.color, title: "", style: lwLineStyle(negOi.lineStyle), width: negOi.size } : null,
    ].filter(Boolean) as Array<{ price: number; color: string; title: string; style: LineStyle; width: number }>;
    const created = priceLines.map((item) => active.createPriceLine({ price: item.price, color: item.color, title: item.title, lineStyle: item.style, lineWidth: Math.max(1, Math.min(4, Math.round(item.width))) as 1 | 2 | 3 | 4, axisLabelVisible: Boolean(item.title) }));
    return () => created.forEach((priceLine) => active.removePriceLine(priceLine));
  }, [appearance, dataset, frame, priceCandles, spotTape]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = appearance.chartType === "candles" ? candleRef.current : lineRef.current;
    if (chart && series) setSurface({ chart, series });
  }, [appearance.chartType]);

  const reset = useCallback(() => { chartRef.current?.timeScale().fitContent(); setProfileScale(1); }, []);
  const snapshot = useCallback(() => {
    const root = hostRef.current?.parentElement; if (!root) return;
    const layers = [...root.querySelectorAll("canvas")]; if (!layers.length) return;
    const rect = root.getBoundingClientRect(); const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(rect.width * devicePixelRatio)); output.height = Math.max(1, Math.round(rect.height * devicePixelRatio));
    const context = output.getContext("2d"); if (!context) return;
    layers.forEach((layer) => context.drawImage(layer, 0, 0, output.width, output.height));
    const link = document.createElement("a"); link.download = `gex-box-classic-${frame.ticker}-${frame.timestamp}.png`; link.href = output.toDataURL("image/png"); link.click();
  }, [frame]);
  return <div className="relative h-full min-h-0 w-full flex-1 bg-black" data-gex-box-chart="true" onDoubleClick={reset}>
    <div ref={hostRef} className="absolute inset-0" />
    <ProfileCanvas frame={frame} frames={frames} strikes={strikes} dataset={dataset} appearance={appearance} priceSeries={surface?.series ?? null} chart={surface?.chart ?? null} palette={palette} profileScale={profileScale} />
    <div aria-label="GEX magnitude axis" className="absolute inset-x-0 top-0 z-[4] h-6 cursor-ew-resize" onWheel={(event) => { event.preventDefault(); setProfileScale((value) => Math.max(.25, Math.min(5, value * (event.deltaY < 0 ? 1.12 : .89)))); }} />
    <div className="absolute right-3 top-3 z-[6] flex flex-col gap-1">
      <button type="button" onClick={() => hostRef.current?.parentElement?.requestFullscreen()} className="flex h-7 w-7 items-center justify-center border border-white/15 bg-black/75 text-white/65 hover:text-white" aria-label="Fullscreen Classic chart"><Maximize2 className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={snapshot} className="flex h-7 w-7 items-center justify-center border border-white/15 bg-black/75 text-white/65 hover:text-white" aria-label="Snapshot Classic chart"><Camera className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={reset} className="flex h-7 w-7 items-center justify-center border border-white/15 bg-black/75 text-white/65 hover:text-white" aria-label="Reset Classic chart"><RotateCcw className="h-3.5 w-3.5" /></button>
      <span className="flex h-7 min-w-7 items-center justify-center border border-white/15 bg-black/75 px-1.5 font-mono text-[8px] text-white/65">1m</span>
    </div>
  </div>;
}

const STATE_PALETTES: Record<GexBotStateMetric, { primary: string; secondary: string; call: string; put: string }> = {
  gex: { primary: "#42df84", secondary: "#ff5268", call: "#42df84", put: "#ff5268" }, gamma: { primary: "#f0a52c", secondary: "#8c61ff", call: "#52df91", put: "#ff5f72" },
  delta: { primary: "#38d3ee", secondary: "#ff667a", call: "#38d3ee", put: "#ff667a" }, vanna: { primary: "#87ed58", secondary: "#cb72ff", call: "#87ed58", put: "#cb72ff" },
  charm: { primary: "#ffc557", secondary: "#778bff", call: "#ffc557", put: "#778bff" }, convexity: { primary: "#bd8cff", secondary: "#ff79bf", call: "#bd8cff", put: "#ff79bf" },
  negative_vanna: { primary: "#59d9b4", secondary: "#ef668b", call: "#59d9b4", put: "#ef668b" }, open_interest: { primary: "#73b7ff", secondary: "#ffb347", call: "#73b7ff", put: "#ffb347" },
};

export function ProfessionalProfileChart(props: { frame: GexBotProfileFrame; frames?: GexBotProfileFrame[]; dataset: Dataset; appearance: Appearance; spotTape: SpotSample[]; priceCandles?: RithmicClassicCandle[]; priorIndex: number; maxChange?: Array<{ label: string; value: [number, number] }>; onHover: (strike: GexBotStrike | null) => void }) {
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
