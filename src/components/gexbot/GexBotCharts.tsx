"use client";

import { BarChart, CustomChart, LineChart, ScatterChart } from "echarts/charts";
import {
  AxisPointerComponent,
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type {
  CustomSeriesRenderItem,
  EChartsCoreOption,
  EChartsType,
} from "echarts";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { GexBotOrderflowFrame, GexBotProfileFrame, GexBotStrike } from "@/lib/gexBotTypes";

echarts.use([
  AxisPointerComponent,
  BarChart,
  CanvasRenderer,
  CustomChart,
  DataZoomComponent,
  GridComponent,
  LineChart,
  MarkLineComponent,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
]);

type SpotSample = { timestamp: number; spot: number; zeroGamma?: number | null };
type Dataset = "volume" | "oi" | "both";
type LineStyle = "solid" | "short" | "dash" | "dot";
export type GexBotStateMetric = "gex" | "gamma" | "delta" | "vanna" | "charm" | "convexity" | "negative_vanna" | "open_interest";

type Appearance = {
  positive: string;
  negative: string;
  oiPositive: string;
  oiNegative: string;
  prior: string;
  prior2: string;
  prior3: string;
  spot: string;
  showPositive: boolean;
  showNegative: boolean;
  showPriors: boolean;
  showSpot: boolean;
  showZero: boolean;
  showMajors: boolean;
  showVolumeMajors: boolean;
  showOiMajors: boolean;
  lineStyle: LineStyle;
  dotSize: number;
  lookbackCount: number;
  multiplier: number;
  timeZone: string;
};

export type OrderflowMetricConfig = {
  id: string;
  one: string;
  label: string;
  color: string;
  description: string;
};

type ChartEvent = {
  seriesName?: string;
  data?: { value?: unknown[] } | unknown[];
  value?: unknown[];
};

const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";
const UI = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const TEXT = "#dce2eb";
const MUTED = "#737c8b";
const GRID = "rgba(121, 132, 151, 0.12)";
const GRID_STRONG = "rgba(121, 132, 151, 0.24)";
const TOOLTIP_BG = "rgba(8, 10, 14, 0.96)";

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return absolute >= 1 ? value.toFixed(2) : value.toPrecision(3);
}

function price(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function echartsLineStyle(style: LineStyle) {
  if (style === "short" || style === "dash") return "dashed" as const;
  if (style === "dot") return "dotted" as const;
  return "solid" as const;
}

function EChartSurface({
  option,
  height,
  className = "",
  onMouseOver,
  onMouseOut,
}: {
  option: EChartsCoreOption;
  height: number | string;
  className?: string;
  onMouseOver?: (event: ChartEvent) => void;
  onMouseOut?: () => void;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const handlersRef = useRef({ onMouseOver, onMouseOut });
  handlersRef.current = { onMouseOver, onMouseOut };

  useLayoutEffect(() => {
    if (!elementRef.current) return;
    const chart = echarts.init(elementRef.current, undefined, {
      renderer: "canvas",
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      useDirtyRect: true,
    });
    chartRef.current = chart;
    chart.on("mouseover", (event) => handlersRef.current.onMouseOver?.(event as ChartEvent));
    chart.on("mouseout", () => handlersRef.current.onMouseOut?.());
    const observer = new ResizeObserver(() => chart.resize({ animation: { duration: 140 } }));
    observer.observe(elementRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return <div ref={elementRef} data-gex-box-chart="true" className={`w-full ${className}`} style={{ height }} />;
}

function profileTooltip(raw: unknown) {
  const params = raw as { seriesName?: string; name?: string; value?: unknown[] };
  const values = params.value ?? [];
  if (params.seriesName === "Price") {
    const timestamp = finite(values[0]);
    const spot = finite(values[1]);
    return `<div style="min-width:150px"><b style="color:${TEXT}">Underlying price</b><br/><span style="color:${MUTED}">${timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</span><br/><span style="font:600 13px ${MONO};color:#fff">${spot === null ? "—" : price(spot)}</span></div>`;
  }
  const exposure = finite(values[0]);
  const strike = finite(values[1]);
  return `<div style="min-width:170px"><b style="color:${TEXT}">${params.seriesName ?? "Exposure"}</b><br/><span style="color:${MUTED}">Strike</span> <span style="float:right;font:600 12px ${MONO};color:#fff">${strike === null ? "—" : price(strike)}</span><br/><span style="color:${MUTED}">Exposure</span> <span style="float:right;font:600 12px ${MONO};color:#fff">${exposure === null ? "—" : compact(exposure)}</span></div>`;
}

function exposureRenderer(colorPositive: string, colorNegative: string, heightRatio: number, opacity: number): CustomSeriesRenderItem {
  return (params, api) => {
    const exposure = finite(api.value(0)) ?? 0;
    const strike = finite(api.value(1)) ?? 0;
    const start = api.coord([0, strike]);
    const end = api.coord([exposure, strike]);
    const strikeStep = finite(api.value(4)) ?? 1;
    const size = api.size?.([0, strikeStep]) ?? [0, 8];
    const verticalSize = Array.isArray(size) ? size[1] : size;
    const height = Math.max(3, Math.min(13, Math.abs(verticalSize) * heightRatio));
    return {
      type: "rect",
      transition: ["shape"],
      shape: {
        x: Math.min(start[0], end[0]),
        y: start[1] - height / 2,
        width: Math.max(1, Math.abs(end[0] - start[0])),
        height,
        r: 2,
      },
      style: {
        fill: exposure >= 0 ? colorPositive : colorNegative,
        opacity,
        shadowBlur: exposure === 0 ? 0 : 5,
        shadowColor: exposure >= 0 ? `${colorPositive}40` : `${colorNegative}40`,
      },
    };
  };
}

function levelLines(frame: GexBotProfileFrame, dataset: Dataset, appearance: Appearance) {
  const data: Array<Record<string, unknown>> = [];
  if (appearance.showSpot) data.push({
    name: "Spot",
    yAxis: frame.spot,
    lineStyle: { color: appearance.spot, width: 1.4, type: "solid", shadowBlur: 8, shadowColor: `${appearance.spot}70` },
    label: { show: true, formatter: `SPOT  ${price(frame.spot)}`, color: "#080a0d", backgroundColor: appearance.spot, borderRadius: 4, padding: [4, 7], fontFamily: MONO, fontWeight: 700, fontSize: 9 },
  });
  if (appearance.showZero && frame.zero_gamma !== null) data.push({
    name: "Zero gamma",
    yAxis: frame.zero_gamma,
    lineStyle: { color: "#e5b94b", width: 1.2, type: echartsLineStyle(appearance.lineStyle) },
    label: { show: true, formatter: `ZERO  ${price(frame.zero_gamma)}`, color: "#080a0d", backgroundColor: "#e5b94b", borderRadius: 4, padding: [4, 7], fontFamily: MONO, fontWeight: 700, fontSize: 9 },
  });
  const addMajor = (name: string, value: number | null, color: string, width: number) => {
    if (value === null) return;
    data.push({ name, yAxis: value, lineStyle: { color, width, type: echartsLineStyle(appearance.lineStyle), opacity: 0.84 }, label: { show: false } });
  };
  if (appearance.showMajors && appearance.showVolumeMajors && dataset !== "oi") {
    addMajor("Volume major positive", frame.major_pos_vol, appearance.positive, 1.25);
    addMajor("Volume major negative", frame.major_neg_vol, appearance.negative, 1.25);
  }
  if (appearance.showMajors && appearance.showOiMajors && dataset !== "volume") {
    addMajor("OI major positive", frame.major_pos_oi, appearance.oiPositive, 1);
    addMajor("OI major negative", frame.major_neg_oi, appearance.oiNegative, 1);
  }
  return data;
}

export function ProfessionalProfileChart({
  frame,
  dataset,
  appearance,
  spotTape,
  priorIndex,
  maxChange,
  onHover,
}: {
  frame: GexBotProfileFrame;
  dataset: Dataset;
  appearance: Appearance;
  spotTape: SpotSample[];
  priorIndex: number;
  maxChange?: Array<{ label: string; value: [number, number] }>;
  onHover: (strike: GexBotStrike | null) => void;
}) {
  const strikes = useMemo(() => {
    const ordered = [...frame.strikes].sort((a, b) => a[0] - b[0]);
    if (ordered.length <= 72) return ordered;
    const center = ordered.reduce((best, entry, index) => (
      Math.abs(entry[0] - frame.spot) < Math.abs(ordered[best][0] - frame.spot) ? index : best
    ), 0);
    const start = Math.max(0, Math.min(ordered.length - 72, center - 36));
    return ordered.slice(start, start + 72);
  }, [frame.spot, frame.strikes]);

  const option = useMemo<EChartsCoreOption>(() => {
    const minStrike = strikes[0]?.[0] ?? frame.spot - 1;
    const maxStrike = strikes.at(-1)?.[0] ?? frame.spot + 1;
    const step = Math.max(1, strikes.length > 1 ? Math.abs(strikes[1][0] - strikes[0][0]) : 1);
    const sourceValues = strikes.flatMap((entry) => dataset === "volume" ? [entry[1]] : dataset === "oi" ? [entry[2]] : [entry[1], entry[2]]);
    const exposureMax = Math.max(1, ...sourceValues.map((value) => Math.abs(value * appearance.multiplier))) * 1.12;
    const priceData = spotTape
      .filter((entry) => entry.spot >= minStrike && entry.spot <= maxStrike)
      .slice(-480)
      .map((entry) => [entry.timestamp, entry.spot]);
    if (!priceData.length) priceData.push([frame.timestamp, frame.spot]);

    const firstTime = finite(priceData[0]?.[0]) ?? frame.timestamp - 3 * 60 * 60 * 1000;
    const lastTime = finite(priceData.at(-1)?.[0]) ?? frame.timestamp;
    const elapsed = Math.max(60 * 60 * 1000, lastTime - firstTime);
    const futureEdge = lastTime + elapsed;
    const lines = levelLines(frame, dataset, appearance);
    const series: Record<string, unknown>[] = [];

    series.push({
      name: "Price",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: priceData,
      showSymbol: priceData.length < 2,
      symbolSize: 4,
      smooth: 0.04,
      sampling: "lttb",
      lineStyle: { color: "#f4f6f8", width: 1.65, shadowBlur: 5, shadowColor: "rgba(255,255,255,.32)" },
      markLine: { silent: true, symbol: "none", animation: false, data: lines },
      emphasis: { focus: "series" },
      z: 9,
    });
    const zeroGammaPath = spotTape.flatMap((entry) => finite(entry.zeroGamma) === null ? [] : [[entry.timestamp, entry.zeroGamma]]);
    if (appearance.showZero && zeroGammaPath.length > 1) series.push({
      name: "Zero gamma path",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: zeroGammaPath,
      showSymbol: false,
      smooth: 0.03,
      connectNulls: false,
      lineStyle: { color: "#d4ad45", width: 1.05, opacity: 0.86 },
      z: 7,
    });

    const exposureData = (field: 1 | 2) => strikes
      .filter((entry) => (entry[field] >= 0 ? appearance.showPositive : appearance.showNegative))
      .map((entry, index) => ({ name: price(entry[0]), value: [entry[field] * appearance.multiplier, entry[0], field, index, step] }));

    if (dataset === "volume" || dataset === "both") series.push({
      name: "Volume GEX",
      type: "custom",
      xAxisIndex: 1,
      yAxisIndex: 0,
      renderItem: exposureRenderer(appearance.positive, appearance.negative, dataset === "both" ? 0.48 : 0.64, 0.95),
      data: exposureData(1),
      encode: { x: 0, y: 1, tooltip: [1, 0] },
      clip: true,
      z: 5,
    });
    if (dataset === "oi" || dataset === "both") series.push({
      name: "Open interest GEX",
      type: "custom",
      xAxisIndex: 1,
      yAxisIndex: 0,
      renderItem: exposureRenderer(appearance.oiPositive, appearance.oiNegative, dataset === "both" ? 0.18 : 0.64, dataset === "both" ? 0.44 : 0.95),
      data: exposureData(2),
      encode: { x: 0, y: 1, tooltip: [1, 0] },
      clip: true,
      z: dataset === "both" ? 4 : 5,
    });

    if (appearance.showPriors) {
      const priorCount = Math.min(appearance.lookbackCount, Math.max(0, ...strikes.map((entry) => entry[3].length)));
      const trailColors = [appearance.prior, appearance.prior2, appearance.prior3];
      for (let index = 0; index < priorCount; index += 1) {
        series.push({
          name: `Lookback ${index + 1}`,
          type: "scatter",
          xAxisIndex: 1,
          yAxisIndex: 0,
          data: strikes.flatMap((entry, strikeIndex) => entry[3][index] === undefined ? [] : [{ name: price(entry[0]), value: [entry[3][index] * appearance.multiplier, entry[0], index, strikeIndex] }]),
          symbol: "circle",
          symbolSize: index === priorIndex ? appearance.dotSize * 2.2 : appearance.dotSize * 1.5,
          itemStyle: { color: index === priorIndex ? "#ffffff" : trailColors[index] ?? appearance.prior, opacity: index === priorIndex ? 1 : Math.max(0.18, 0.62 - index * 0.08), shadowBlur: index === priorIndex ? 8 : 2, shadowColor: trailColors[index] ?? appearance.prior },
          z: index === priorIndex ? 8 : 6,
        });
      }
    }

    if (maxChange?.length) {
      series.push({
        name: "Max change GEX",
        type: "scatter",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: maxChange.map((entry, index) => ({ name: entry.label, value: [lastTime + elapsed * (0.06 + index * 0.035), entry.value[0], entry.value[1]] })),
        symbol: "circle",
        symbolSize: (value: unknown[]) => Math.max(5, Math.min(14, 5 + Math.log10(Math.abs(Number(value?.[2])) + 1))),
        itemStyle: { color: (params: { value?: unknown[] }) => Number(params.value?.[2]) >= 0 ? appearance.positive : appearance.negative, borderColor: "#050607", borderWidth: 1, shadowBlur: 8 },
        label: { show: true, position: "right", formatter: (params: { name?: string }) => params.name ?? "", color: "#dce2eb", fontFamily: MONO, fontSize: 8 },
        z: 12,
      });
    }

    series.push({
      name: "Exposure origin",
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 0,
      data: [[0, minStrike], [0, maxStrike]],
      symbol: "none",
      silent: true,
      lineStyle: { color: "rgba(242,245,249,.56)", width: 1.1 },
      z: 3,
    });

    return {
      backgroundColor: "#050607",
      animationDuration: 220,
      animationDurationUpdate: 140,
      animationEasingUpdate: "cubicOut",
      textStyle: { fontFamily: UI, color: TEXT },
      grid: { left: 54, right: 18, top: 48, bottom: 44, containLabel: false, show: true, borderColor: GRID_STRONG, backgroundColor: "#050607" },
      tooltip: { trigger: "item", confine: true, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [10, 12], textStyle: { color: TEXT, fontFamily: UI, fontSize: 10 }, extraCssText: "box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(12px);border-radius:8px", formatter: profileTooltip },
      axisPointer: { label: { show: true, color: "#080a0d", backgroundColor: "#e9edf3", fontFamily: MONO, fontSize: 9 }, lineStyle: { color: "rgba(226,232,240,.56)", width: 1, type: "dashed" } },
      xAxis: [
        {
          gridIndex: 0, type: "time", min: firstTime, max: futureEdge, position: "bottom", boundaryGap: false,
          axisLine: { show: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false },
          axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, hideOverlap: true, formatter: (value: number) => new Intl.DateTimeFormat("en-US", { timeZone: appearance.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) },
          splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true, snap: false },
        },
        {
          gridIndex: 0, type: "value", min: -exposureMax, max: exposureMax, position: "top",
          axisLine: { show: true, onZero: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false },
          axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, formatter: (value: number) => value === 0 ? "NOW / 0" : compact(value) },
          splitLine: { show: false }, axisPointer: { show: true, snap: false },
        },
      ],
      yAxis: {
        gridIndex: 0, type: "value", min: minStrike - step, max: maxStrike + step, scale: true, position: "right",
        axisLine: { show: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false },
        axisLabel: { color: "#9ba4b2", fontFamily: MONO, fontSize: 9, margin: 8, formatter: (value: number) => value.toFixed(0) },
        splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true, snap: false },
      },
      dataZoom: [{ type: "inside", yAxisIndex: 0, filterMode: "none", zoomOnMouseWheel: "shift", moveOnMouseWheel: true, moveOnMouseMove: true }],
      series,
    };
  }, [appearance, dataset, frame, maxChange, priorIndex, spotTape, strikes]);

  return (
    <EChartSurface
      option={option}
      height="clamp(600px, calc(100vh - 235px), 860px)"
      className="min-h-[600px]"
      onMouseOver={(event) => {
        const source = Array.isArray(event.data) ? event.data : event.data?.value ?? event.value;
        if (event.seriesName === "Price" || event.seriesName === "Exposure origin") return;
        const strike = finite(source?.[1]);
        if (strike === null) return;
        onHover(strikes.find((entry) => entry[0] === strike) ?? null);
      }}
      onMouseOut={() => onHover(null)}
    />
  );
}

const STATE_PALETTES: Record<GexBotStateMetric, { primary: string; secondary: string; call: string; put: string }> = {
  gex: { primary: "#42df84", secondary: "#ff5268", call: "#42df84", put: "#ff5268" },
  gamma: { primary: "#f0a52c", secondary: "#8c61ff", call: "#52df91", put: "#ff5f72" },
  delta: { primary: "#38d3ee", secondary: "#ff667a", call: "#38d3ee", put: "#ff667a" },
  vanna: { primary: "#87ed58", secondary: "#cb72ff", call: "#87ed58", put: "#cb72ff" },
  charm: { primary: "#ffc557", secondary: "#778bff", call: "#ffc557", put: "#778bff" },
  convexity: { primary: "#bd8cff", secondary: "#ff79bf", call: "#bd8cff", put: "#ff79bf" },
  negative_vanna: { primary: "#59d9b4", secondary: "#ef668b", call: "#59d9b4", put: "#ef668b" },
  open_interest: { primary: "#73b7ff", secondary: "#ffb347", call: "#73b7ff", put: "#ffb347" },
};

/** State has its own strike-state grammar; it is not a recoloured Classic chart. */
export function ProfessionalStateChart({
  frame,
  metric,
  appearance,
  spotTape,
  priorIndex,
  onHover,
}: {
  frame: GexBotProfileFrame;
  metric: GexBotStateMetric;
  appearance: Appearance;
  spotTape: SpotSample[];
  priorIndex: number;
  onHover: (strike: GexBotStrike | null) => void;
}) {
  const strikes = useMemo(() => {
    const ordered = [...frame.strikes].sort((a, b) => a[0] - b[0]);
    if (ordered.length <= 76) return ordered;
    const center = ordered.reduce((best, entry, index) => (
      Math.abs(entry[0] - frame.spot) < Math.abs(ordered[best][0] - frame.spot) ? index : best
    ), 0);
    const start = Math.max(0, Math.min(ordered.length - 76, center - 38));
    return ordered.slice(start, start + 76);
  }, [frame.spot, frame.strikes]);
  const palette = STATE_PALETTES[metric];

  const option = useMemo<EChartsCoreOption>(() => {
    const minStrike = strikes[0]?.[0] ?? frame.spot - 1;
    const maxStrike = strikes.at(-1)?.[0] ?? frame.spot + 1;
    const step = Math.max(1, strikes.length > 1 ? Math.abs(strikes[1][0] - strikes[0][0]) : 1);
    const magnitude = Math.max(1, ...strikes.flatMap((entry) => [Math.abs(entry[1]), Math.abs(entry[2])])) * appearance.multiplier;
    const exposureMax = magnitude * 1.18;
    const priceData = spotTape
      .filter((entry) => entry.spot >= minStrike && entry.spot <= maxStrike)
      .slice(-520)
      .map((entry) => [entry.timestamp, entry.spot]);
    if (!priceData.length) priceData.push([frame.timestamp, frame.spot]);
    const firstTime = finite(priceData[0]?.[0]) ?? frame.timestamp - 3 * 60 * 60 * 1000;
    const lastTime = finite(priceData.at(-1)?.[0]) ?? frame.timestamp;
    const elapsed = Math.max(60 * 60 * 1000, lastTime - firstTime);
    const series: Record<string, unknown>[] = [
      {
        name: "Underlying",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: priceData,
        showSymbol: false,
        smooth: 0.025,
        sampling: "lttb",
        lineStyle: { color: "#f5f7fa", width: 1.65, shadowBlur: 6, shadowColor: "rgba(255,255,255,.3)" },
        markLine: { silent: true, symbol: "none", animation: false, data: levelLines(frame, "both", appearance) },
        z: 10,
      },
      {
        name: `${metric.toUpperCase()} volume state`,
        type: "custom",
        xAxisIndex: 1,
        yAxisIndex: 0,
        renderItem: exposureRenderer(palette.primary, palette.secondary, 0.54, 0.78),
        data: strikes.map((entry, index) => [entry[1] * appearance.multiplier, entry[0], 1, index, step]),
        z: 5,
      },
      {
        name: `${metric.toUpperCase()} open-interest state`,
        type: "custom",
        xAxisIndex: 1,
        yAxisIndex: 0,
        renderItem: exposureRenderer(palette.call, palette.put, 0.24, 0.48),
        data: strikes.map((entry, index) => [entry[2] * appearance.multiplier, entry[0], 2, index, step]),
        z: 6,
      },
      {
        name: "Volume contour",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 0,
        data: strikes.map((entry) => [entry[1] * appearance.multiplier, entry[0]]),
        showSymbol: true,
        symbol: "circle",
        symbolSize: 3.2,
        smooth: 0.16,
        lineStyle: { color: palette.primary, width: 1, opacity: 0.74 },
        itemStyle: { color: palette.primary, borderColor: "#050607", borderWidth: 1 },
        z: 8,
      },
      {
        name: "Open-interest contour",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 0,
        data: strikes.map((entry) => [entry[2] * appearance.multiplier, entry[0]]),
        showSymbol: true,
        symbol: "circle",
        symbolSize: 2.8,
        smooth: 0.16,
        lineStyle: { color: palette.secondary, width: 1, opacity: 0.68 },
        itemStyle: { color: palette.secondary, borderColor: "#050607", borderWidth: 1 },
        z: 8,
      },
    ];

    if (appearance.showPriors) {
      const priorCount = Math.max(0, ...strikes.map((entry) => entry[3].length));
      for (let index = 0; index < priorCount; index += 1) {
        const active = index === priorIndex;
        series.push({
          name: `Prior ${index + 1}`,
          type: "scatter",
          xAxisIndex: 1,
          yAxisIndex: 0,
          data: strikes.flatMap((entry) => entry[3][index] === undefined ? [] : [[entry[3][index] * appearance.multiplier, entry[0]]]),
          symbolSize: active ? appearance.dotSize + 1 : Math.max(1.8, appearance.dotSize - 1),
          itemStyle: { color: appearance.prior, opacity: active ? 0.92 : 0.25 },
          z: active ? 9 : 3,
        });
      }
    }

    return {
      backgroundColor: "#050607",
      animationDuration: 180,
      animationDurationUpdate: 100,
      textStyle: { color: TEXT, fontFamily: UI },
      title: {
        text: `${metric.toUpperCase()} STATE`,
        subtext: "VOLUME STATE  /  OPEN-INTEREST STATE",
        left: 18,
        top: 14,
        textStyle: { color: palette.primary, fontFamily: UI, fontSize: 11, fontWeight: 800 },
        subtextStyle: { color: MUTED, fontFamily: MONO, fontSize: 8, lineHeight: 18 },
      },
      grid: { left: 48, right: 70, top: 70, bottom: 42, show: true, borderColor: GRID_STRONG, backgroundColor: "#050607" },
      tooltip: { trigger: "item", confine: true, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [10, 12], textStyle: { color: TEXT, fontFamily: UI, fontSize: 10 }, extraCssText: "box-shadow:0 18px 60px rgba(0,0,0,.45);border-radius:8px", formatter: profileTooltip },
      axisPointer: { label: { show: true, color: "#080a0d", backgroundColor: "#e9edf3", fontFamily: MONO, fontSize: 9 }, lineStyle: { color: "rgba(226,232,240,.52)", type: "dashed" } },
      xAxis: [
        { gridIndex: 0, type: "time", min: firstTime, max: lastTime + elapsed, position: "bottom", boundaryGap: false, axisLine: { lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, hideOverlap: true, formatter: (value: number) => new Intl.DateTimeFormat("en-US", { timeZone: appearance.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) }, splitLine: { show: true, lineStyle: { color: GRID } } },
        { gridIndex: 0, type: "value", min: -exposureMax, max: exposureMax, position: "top", axisLine: { show: true, onZero: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, formatter: (value: number) => value === 0 ? "NOW / 0" : compact(value) }, splitLine: { show: false } },
      ],
      yAxis: { gridIndex: 0, type: "value", min: minStrike - step, max: maxStrike + step, scale: true, position: "right", axisLine: { show: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: "#a5adba", fontFamily: MONO, fontSize: 9, formatter: (value: number) => value.toFixed(0) }, splitLine: { show: true, lineStyle: { color: GRID } } },
      dataZoom: [{ type: "inside", yAxisIndex: 0, filterMode: "none", zoomOnMouseWheel: "shift", moveOnMouseWheel: true, moveOnMouseMove: true }],
      series,
    };
  }, [appearance, frame, metric, palette, priorIndex, spotTape, strikes]);

  return (
    <EChartSurface
      option={option}
      height="clamp(600px, calc(100vh - 235px), 860px)"
      className="min-h-[600px]"
      onMouseOver={(event) => {
        const source = Array.isArray(event.data) ? event.data : event.data?.value ?? event.value;
        if (event.seriesName === "Underlying") return;
        const strike = finite(source?.[1]);
        if (strike !== null) onHover(strikes.find((entry) => entry[0] === strike) ?? null);
      }}
      onMouseOut={() => onHover(null)}
    />
  );
}

function orderflowTooltip(raw: unknown) {
  const params = (Array.isArray(raw) ? raw : [raw]) as Array<{ seriesName?: string; axisValue?: number; value?: unknown[]; color?: string }>;
  const timestamp = finite(params[0]?.axisValue ?? params[0]?.value?.[0]);
  const rows = params.map((item) => {
    const value = finite(item.value?.[1]);
    if (value === null) return "";
    return `<div style="display:flex;gap:18px;justify-content:space-between;margin-top:5px"><span style="color:${item.color ?? MUTED}">${item.seriesName ?? "Series"}</span><b style="font:600 11px ${MONO};color:#fff">${compact(value)}</b></div>`;
  }).join("");
  return `<div style="min-width:210px"><b style="color:${TEXT}">${timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Exposure frame"}</b>${rows}</div>`;
}

export function ProfessionalOrderflowChart({
  metrics,
  points,
}: {
  metrics: readonly OrderflowMetricConfig[];
  points: GexBotOrderflowFrame[];
}) {
  const height = Math.max(430, metrics.length * 204 + 32);
  const option = useMemo<EChartsCoreOption>(() => {
    const panelHeight = 164;
    const panelGap = 40;
    const grids: Record<string, unknown>[] = [];
    const titles: Record<string, unknown>[] = [];
    const xAxes: Record<string, unknown>[] = [];
    const yAxes: Record<string, unknown>[] = [];
    const series: Record<string, unknown>[] = [];
    metrics.forEach((metric, index) => {
      const top = 24 + index * (panelHeight + panelGap);
      grids.push({ left: 64, right: 58, top, height: panelHeight, containLabel: false, show: true, borderColor: GRID_STRONG, backgroundColor: "#050607" });
      titles.push({ text: metric.label.toUpperCase(), left: 66, top: top + 7, textStyle: { color: metric.color, fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: 1.3 } });
      xAxes.push({ gridIndex: index, type: "time", boundaryGap: true, axisLine: { lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { show: true, color: MUTED, fontFamily: MONO, fontSize: 8, hideOverlap: true, formatter: (value: number) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true } });
      yAxes.push({ gridIndex: index, type: "value", scale: true, position: "left", axisLine: { show: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 8, formatter: (value: number) => compact(value) }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true } });
      yAxes.push({ gridIndex: index, type: "value", scale: true, position: "right", axisLine: { show: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: "rgba(230,234,241,.56)", fontFamily: MONO, fontSize: 8, formatter: (value: number) => value.toFixed(0) }, splitLine: { show: false }, axisPointer: { show: false } });
      const value = (point: GexBotOrderflowFrame, field: string) => finite(point[field as keyof GexBotOrderflowFrame]);
      const eventBars = metric.id === "dexoflow" || metric.id === "gexoflow" || metric.id === "cvroflow";
      if (eventBars) {
        series.push({
          name: `${metric.label} · 0DTE`, type: "bar", xAxisIndex: index, yAxisIndex: index * 2,
          data: points.flatMap((point) => { const next = value(point, metric.id); return next === null ? [] : [[point.timestamp, next]]; }),
          barWidth: 2, barGap: "-100%", itemStyle: { color: metric.color, opacity: 0.92, shadowBlur: 3, shadowColor: `${metric.color}48` },
          markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(236,240,246,.34)", width: 1 }, label: { show: false } }] },
          emphasis: { itemStyle: { opacity: 1, shadowBlur: 7 } }, z: 5,
        });
        series.push({
          name: `${metric.label} · 1DTE`, type: "bar", xAxisIndex: index, yAxisIndex: index * 2,
          data: points.flatMap((point) => { const next = value(point, metric.one); return next === null ? [] : [[point.timestamp, next]]; }),
          barWidth: 1, barGap: "-100%", itemStyle: { color: "#e0baff", opacity: 0.52 }, z: 6,
        });
      } else {
        series.push({
          name: `${metric.label} · 0DTE`, type: "line", xAxisIndex: index, yAxisIndex: index * 2,
          data: points.flatMap((point) => { const next = value(point, metric.id); return next === null ? [] : [[point.timestamp, next]]; }),
          showSymbol: false, smooth: false, connectNulls: false, sampling: "lttb",
          lineStyle: { color: metric.color, width: 1.5, shadowBlur: 4, shadowColor: `${metric.color}46` },
          markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(236,240,246,.30)", width: 1 }, label: { show: false } }] },
          emphasis: { focus: "series" }, z: 5,
        });
        series.push({
          name: `${metric.label} · 1DTE`, type: "line", xAxisIndex: index, yAxisIndex: index * 2,
          data: points.flatMap((point) => { const next = value(point, metric.one); return next === null ? [] : [[point.timestamp, next]]; }),
          showSymbol: false, smooth: false, connectNulls: false, sampling: "lttb",
          lineStyle: { color: "#e0baff", width: 1.05, type: "dashed", opacity: 0.74 }, emphasis: { focus: "series" }, z: 6,
        });
      }
      if (metric.id === "agg_dex") {
        [
          { field: "agg_call_dex", name: "Call DEX", color: "#63e6be" },
          { field: "agg_put_dex", name: "Put DEX", color: "#ff6b81" },
          { field: "net_dex", name: "Net DEX", color: "#ffffff" },
        ].forEach((item) => series.push({
          name: item.name, type: "line", xAxisIndex: index, yAxisIndex: index * 2,
          data: points.flatMap((point) => { const next = value(point, item.field); return next === null ? [] : [[point.timestamp, next]]; }),
          showSymbol: false, smooth: false, connectNulls: false,
          lineStyle: { color: item.color, width: item.field === "net_dex" ? 1.25 : 1, opacity: 0.8 }, z: 6,
        }));
      }
      series.push({
        name: "Underlying", type: "line", xAxisIndex: index, yAxisIndex: index * 2 + 1,
        data: points.map((point) => [point.timestamp, point.spot]), showSymbol: false, smooth: false,
        lineStyle: { color: "rgba(247,249,252,.78)", width: 1.15, shadowBlur: 3, shadowColor: "rgba(255,255,255,.22)" }, emphasis: { disabled: true }, silent: true, z: 3,
      });
    });
    return {
      backgroundColor: "#050607",
      animationDuration: 200,
      animationDurationUpdate: 120,
      animationEasingUpdate: "cubicOut",
      textStyle: { color: TEXT, fontFamily: UI },
      title: titles,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      tooltip: { trigger: "axis", confine: true, axisPointer: { type: "cross" }, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [10, 12], textStyle: { color: TEXT, fontFamily: UI, fontSize: 10 }, extraCssText: "box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(12px);border-radius:10px", formatter: orderflowTooltip },
      axisPointer: { link: [{ xAxisIndex: "all" }], label: { show: true, color: "#080a0d", backgroundColor: "#e9edf3", fontFamily: MONO, fontSize: 9 }, lineStyle: { color: "rgba(226,232,240,.58)", width: 1, type: "dashed" } },
      dataZoom: [{ type: "inside", xAxisIndex: metrics.map((_, index) => index), filterMode: "none", zoomOnMouseWheel: true, moveOnMouseWheel: true, moveOnMouseMove: true }],
      series,
    };
  }, [metrics, points]);

  return <EChartSurface option={option} height={height} className="min-w-[720px]" />;
}

/**
 * Metric-specific Orderflow terminal. Aggregate DEX, state ratios, signed
 * event flow and convexity intentionally use different visual recipes.
 */
export function ProfessionalOrderflowTerminal({
  metrics,
  points,
}: {
  metrics: readonly OrderflowMetricConfig[];
  points: GexBotOrderflowFrame[];
}) {
  const height = Math.max(460, metrics.length * 218 + 24);
  const option = useMemo<EChartsCoreOption>(() => {
    const panelHeight = 188;
    const panelGap = 30;
    const grids: Record<string, unknown>[] = [];
    const titles: Record<string, unknown>[] = [];
    const xAxes: Record<string, unknown>[] = [];
    const yAxes: Record<string, unknown>[] = [];
    const series: Record<string, unknown>[] = [];
    const value = (point: GexBotOrderflowFrame, field: string) => finite(point[field as keyof GexBotOrderflowFrame]);
    const lineData = (field: string) => points.flatMap((point) => {
      const next = value(point, field);
      return next === null ? [] : [[point.timestamp, next]];
    });

    metrics.forEach((metric, index) => {
      const top = 18 + index * (panelHeight + panelGap);
      const latest = points.at(-1);
      const current = latest ? value(latest, metric.id) : null;
      const oneCurrent = latest ? value(latest, metric.one) : null;
      grids.push({ left: 76, right: 72, top, height: panelHeight, containLabel: false, show: true, borderColor: GRID_STRONG, backgroundColor: "#050607" });
      titles.push({
        text: metric.label.toUpperCase(),
        subtext: `0DTE  ${current === null ? "—" : compact(current)}     1DTE  ${oneCurrent === null ? "—" : compact(oneCurrent)}`,
        left: 80,
        top: top + 7,
        textStyle: { color: metric.color, fontFamily: UI, fontSize: 10, fontWeight: 800, letterSpacing: 1.2 },
        subtextStyle: { color: MUTED, fontFamily: MONO, fontSize: 8, lineHeight: 17 },
      });
      xAxes.push({
        gridIndex: index,
        type: "time",
        boundaryGap: true,
        axisLine: { lineStyle: { color: GRID_STRONG } },
        axisTick: { show: false },
        axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 8, hideOverlap: true, formatter: (next: number) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(next)) },
        splitLine: { show: true, lineStyle: { color: GRID } },
        axisPointer: { show: true },
      });
      yAxes.push({
        gridIndex: index,
        type: "value",
        scale: true,
        position: "left",
        axisLine: { show: true, lineStyle: { color: GRID_STRONG } },
        axisTick: { show: false },
        axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 8, formatter: (next: number) => compact(next) },
        splitLine: { show: true, lineStyle: { color: GRID } },
        axisPointer: { show: true },
      });
      yAxes.push({
        gridIndex: index,
        type: "value",
        scale: true,
        position: "right",
        axisLine: { show: true, lineStyle: { color: GRID_STRONG } },
        axisTick: { show: false },
        axisLabel: { color: "rgba(230,234,241,.56)", fontFamily: MONO, fontSize: 8, formatter: (next: number) => next.toFixed(0) },
        splitLine: { show: false },
        axisPointer: { show: false },
      });

      if (metric.id === "agg_dex") {
        [
          { field: "agg_call_dex", name: "CALL DEX", color: "#4be0a1", width: 1.5, dash: false },
          { field: "agg_put_dex", name: "PUT DEX", color: "#ff5e72", width: 1.5, dash: false },
          { field: "net_dex", name: "NET DEX", color: "#72c9ff", width: 2, dash: false },
          { field: "one_net_dex", name: "1DTE NET", color: "#d8b6ff", width: 1.1, dash: true },
        ].forEach((item) => series.push({
          name: item.name,
          type: "line",
          xAxisIndex: index,
          yAxisIndex: index * 2,
          data: lineData(item.field),
          showSymbol: false,
          smooth: 0.035,
          connectNulls: false,
          sampling: "lttb",
          lineStyle: { color: item.color, width: item.width, type: item.dash ? "dashed" : "solid", opacity: item.dash ? 0.7 : 0.94, shadowBlur: 4, shadowColor: `${item.color}42` },
          markLine: item.field === "net_dex" ? { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(236,240,246,.28)", width: 1 }, label: { show: false } }] } : undefined,
          z: item.field === "net_dex" ? 8 : 6,
        }));
      } else if (metric.id === "zgr" || metric.id === "zcvr") {
        series.push({
          name: `${metric.label} · 0DTE`,
          type: "line",
          xAxisIndex: index,
          yAxisIndex: index * 2,
          data: lineData(metric.id),
          showSymbol: false,
          smooth: 0.08,
          connectNulls: false,
          sampling: "lttb",
          lineStyle: { color: metric.color, width: 2, shadowBlur: 5, shadowColor: `${metric.color}50` },
          areaStyle: { color: `${metric.color}16`, opacity: 1 },
          markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(236,240,246,.30)", width: 1 }, label: { show: false } }] },
          z: 7,
        });
        series.push({
          name: `${metric.label} · 1DTE`,
          type: "line",
          xAxisIndex: index,
          yAxisIndex: index * 2,
          data: lineData(metric.one),
          showSymbol: false,
          smooth: 0.08,
          connectNulls: false,
          sampling: "lttb",
          lineStyle: { color: "#d8b6ff", width: 1.15, type: "dashed", opacity: 0.82 },
          z: 8,
        });
      } else if (metric.id === "cvroflow") {
        series.push({
          name: "CONVEXITY · 0DTE",
          type: "line",
          xAxisIndex: index,
          yAxisIndex: index * 2,
          data: lineData(metric.id),
          showSymbol: true,
          symbol: "circle",
          symbolSize: 3.5,
          smooth: false,
          connectNulls: false,
          lineStyle: { color: metric.color, width: 1, opacity: 0.68 },
          itemStyle: { color: metric.color, shadowBlur: 6, shadowColor: `${metric.color}70` },
          markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(236,240,246,.30)", width: 1 }, label: { show: false } }] },
          z: 7,
        });
        series.push({ name: "CONVEXITY · 1DTE", type: "scatter", xAxisIndex: index, yAxisIndex: index * 2, data: lineData(metric.one), symbolSize: 2.6, itemStyle: { color: "#d8b6ff", opacity: 0.72 }, z: 8 });
      } else {
        const positive = metric.id === "dexoflow" ? "#4ddfb0" : "#8cef66";
        const negative = "#ff5d72";
        series.push({
          name: `${metric.label} · 0DTE`,
          type: "bar",
          xAxisIndex: index,
          yAxisIndex: index * 2,
          data: lineData(metric.id),
          barWidth: 2,
          barGap: "-100%",
          itemStyle: { color: (params: { value?: unknown[] }) => (finite(params.value?.[1]) ?? 0) >= 0 ? positive : negative, opacity: 0.94 },
          markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(236,240,246,.34)", width: 1 }, label: { show: false } }] },
          z: 7,
        });
        series.push({
          name: `${metric.label} · 1DTE`,
          type: "bar",
          xAxisIndex: index,
          yAxisIndex: index * 2,
          data: lineData(metric.one),
          barWidth: 1,
          barGap: "-100%",
          itemStyle: { color: "#d8b6ff", opacity: 0.5 },
          z: 8,
        });
      }

      series.push({
        name: "UNDERLYING",
        type: "line",
        xAxisIndex: index,
        yAxisIndex: index * 2 + 1,
        data: points.map((point) => [point.timestamp, point.spot]),
        showSymbol: false,
        smooth: 0.02,
        lineStyle: { color: "rgba(247,249,252,.9)", width: 1.2, shadowBlur: 3, shadowColor: "rgba(255,255,255,.22)" },
        emphasis: { disabled: true },
        silent: true,
        z: 4,
      });
    });

    return {
      backgroundColor: "#050607",
      animationDuration: 180,
      animationDurationUpdate: 100,
      animationEasingUpdate: "cubicOut",
      textStyle: { color: TEXT, fontFamily: UI },
      title: titles,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      tooltip: { trigger: "axis", confine: true, axisPointer: { type: "cross" }, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [10, 12], textStyle: { color: TEXT, fontFamily: UI, fontSize: 10 }, extraCssText: "box-shadow:0 18px 60px rgba(0,0,0,.45);border-radius:10px", formatter: orderflowTooltip },
      axisPointer: { link: [{ xAxisIndex: "all" }], label: { show: true, color: "#080a0d", backgroundColor: "#e9edf3", fontFamily: MONO, fontSize: 9 }, lineStyle: { color: "rgba(226,232,240,.58)", width: 1, type: "dashed" } },
      dataZoom: [{ type: "inside", xAxisIndex: metrics.map((_, index) => index), filterMode: "none", zoomOnMouseWheel: true, moveOnMouseWheel: true, moveOnMouseMove: true }],
      series,
    };
  }, [metrics, points]);

  return <EChartSurface option={option} height={height} className="min-w-[820px]" />;
}

type OrderflowDeskPanel = "aggregate" | "gex" | "convexity";

const ORDERFLOW_DESK_META: Record<OrderflowDeskPanel, { title: string; accent: string; metric: string; one: string }> = {
  aggregate: { title: "Aggregate DEX", accent: "#48d9cf", metric: "net_dex", one: "one_net_dex" },
  gex: { title: "Net GEX", accent: "#7ee35c", metric: "gexoflow", one: "one_gexoflow" },
  convexity: { title: "Convexity Orderflow", accent: "#6bb9e8", metric: "cvroflow", one: "one_cvroflow" },
};

function deskPanelOption(panel: OrderflowDeskPanel, points: GexBotOrderflowFrame[]): EChartsCoreOption {
  const field = (name: string) => points.flatMap((point) => {
    const next = finite(point[name as keyof GexBotOrderflowFrame]);
    return next === null ? [] : [[point.timestamp, next]];
  });
  const spot = points.map((point) => [point.timestamp, point.spot]);
  const zeroLine = { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(220,228,238,.24)", width: 1 }, label: { show: false } }] };
  const series: Record<string, unknown>[] = [];

  if (panel === "aggregate") {
    [
      { name: "CALL DEX", field: "agg_call_dex", color: "#4ed7d0", width: 1.35 },
      { name: "PUT DEX", field: "agg_put_dex", color: "#e55c70", width: 1.25 },
      { name: "NET DEX", field: "net_dex", color: "#7ee35c", width: 1.65 },
      { name: "1DTE NET", field: "one_net_dex", color: "#8193a7", width: 1.0 },
    ].forEach((item) => series.push({
      name: item.name,
      type: "line",
      data: field(item.field),
      showSymbol: false,
      smooth: false,
      sampling: "lttb",
      connectNulls: false,
      lineStyle: { color: item.color, width: item.width, type: item.name === "1DTE NET" ? "dashed" : "solid", opacity: item.name === "1DTE NET" ? 0.72 : 0.96 },
      markLine: item.name === "NET DEX" ? zeroLine : undefined,
      z: item.name === "NET DEX" ? 8 : 6,
    }));
  } else if (panel === "gex") {
    series.push({
      name: "NET GEX · VOLUME",
      type: "line",
      data: field("sum_gex_vol"),
      showSymbol: false,
      smooth: false,
      sampling: "lttb",
      lineStyle: { color: "#7ee35c", width: 1.65 },
      markLine: zeroLine,
      z: 7,
    });
    series.push({
      name: "NET GEX · OI",
      type: "line",
      data: field("sum_gex_oi"),
      showSymbol: false,
      smooth: false,
      sampling: "lttb",
      lineStyle: { color: "#3e7650", width: 1.05, opacity: 0.78 },
      z: 6,
    });
    series.push({
      name: "GEX FLOW · 0DTE",
      type: "bar",
      data: field("gexoflow"),
      barWidth: 1.5,
      itemStyle: { color: (params: { value?: unknown[] }) => (finite(params.value?.[1]) ?? 0) >= 0 ? "#e4d65e" : "#ca5c72", opacity: 0.86 },
      z: 8,
    });
    series.push({
      name: "GEX FLOW · 1DTE",
      type: "scatter",
      data: field("one_gexoflow"),
      symbolSize: 2.2,
      itemStyle: { color: "#a9b7c6", opacity: 0.58 },
      z: 9,
    });
  } else {
    series.push({
      name: "CONVEXITY STATE",
      type: "line",
      data: field("zcvr"),
      showSymbol: false,
      smooth: false,
      sampling: "lttb",
      lineStyle: { color: "#4e8eb9", width: 1.35 },
      markLine: zeroLine,
      z: 6,
    });
    series.push({
      name: "CONVEXITY FLOW · 0DTE",
      type: "line",
      data: field("cvroflow"),
      showSymbol: true,
      symbol: "circle",
      symbolSize: 2.4,
      smooth: false,
      lineStyle: { color: "#73d9de", width: 0.8, opacity: 0.72 },
      itemStyle: { color: "#73d9de", opacity: 0.92 },
      z: 8,
    });
    series.push({
      name: "CONVEXITY FLOW · 1DTE",
      type: "scatter",
      data: field("one_cvroflow"),
      symbolSize: 2,
      itemStyle: { color: "#7f8fa4", opacity: 0.62 },
      z: 9,
    });
  }

  series.push({
    name: "SPOT",
    type: "line",
    yAxisIndex: 1,
    data: spot,
    showSymbol: false,
    smooth: false,
    sampling: "lttb",
    lineStyle: { color: "rgba(247,249,252,.92)", width: 1.15 },
    silent: true,
    z: 5,
  });

  return {
    backgroundColor: "#070809",
    animationDuration: 140,
    animationDurationUpdate: 80,
    textStyle: { color: TEXT, fontFamily: UI },
    grid: { left: 62, right: 56, top: 16, bottom: 34, containLabel: false, show: true, borderColor: "rgba(116,128,145,.2)", backgroundColor: "#070809" },
    xAxis: {
      type: "time",
      boundaryGap: false,
      axisLine: { show: true, lineStyle: { color: "rgba(116,128,145,.32)" } },
      axisTick: { show: false },
      axisLabel: { color: "#798391", fontFamily: MONO, fontSize: 8, hideOverlap: true, formatter: (next: number) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(next)).toLowerCase() },
      splitLine: { show: true, lineStyle: { color: "rgba(116,128,145,.11)" } },
      axisPointer: { show: true },
    },
    yAxis: [
      { type: "value", scale: true, position: "left", axisLine: { show: true, lineStyle: { color: "rgba(116,128,145,.28)" } }, axisTick: { show: false }, axisLabel: { color: "#778291", fontFamily: MONO, fontSize: 8, formatter: (next: number) => compact(next) }, splitLine: { show: true, lineStyle: { color: "rgba(116,128,145,.11)" } }, axisPointer: { show: true } },
      { type: "value", scale: true, position: "right", axisLine: { show: true, lineStyle: { color: "rgba(116,128,145,.28)" } }, axisTick: { show: false }, axisLabel: { color: "#aab2bd", fontFamily: MONO, fontSize: 8, formatter: (next: number) => next.toFixed(0) }, splitLine: { show: false }, axisPointer: { show: false } },
    ],
    tooltip: { trigger: "axis", confine: true, axisPointer: { type: "cross" }, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [9, 11], textStyle: { color: TEXT, fontFamily: UI, fontSize: 9 }, extraCssText: "box-shadow:0 14px 45px rgba(0,0,0,.48);border-radius:7px", formatter: orderflowTooltip },
    dataZoom: [{ type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseWheel: true, moveOnMouseMove: true }],
    series,
  };
}

function OrderflowMetricRail({ panel, frame }: { panel: OrderflowDeskPanel; frame: GexBotOrderflowFrame | undefined }) {
  const meta = ORDERFLOW_DESK_META[panel];
  const current = frame ? finite(frame[meta.metric as keyof GexBotOrderflowFrame]) : null;
  const one = frame ? finite(frame[meta.one as keyof GexBotOrderflowFrame]) : null;
  return (
    <aside className="flex w-[168px] shrink-0 flex-col border-l border-[#24282e] bg-[#0b0c0e] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-[7px] uppercase tracking-[.18em] text-[#6f7782]">Metric</p><h3 className="mt-1 text-[10px] font-semibold text-[#d9dee5]">{meta.title}</h3></div>
        <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.accent, boxShadow: `0 0 9px ${meta.accent}` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#252a31] bg-[#252a31]">
        <div className="bg-[#0d0f12] px-2 py-2"><p className="text-[6px] uppercase tracking-wider text-[#606975]">0DTE</p><b className="mt-1 block truncate font-mono text-[8px] text-[#dce2e9]">{current === null ? "—" : compact(current)}</b></div>
        <div className="bg-[#0d0f12] px-2 py-2"><p className="text-[6px] uppercase tracking-wider text-[#606975]">1DTE</p><b className="mt-1 block truncate font-mono text-[8px] text-[#aab3bf]">{one === null ? "—" : compact(one)}</b></div>
      </div>
      <div className="mt-3 space-y-2 text-[7px] uppercase tracking-[.12em] text-[#737c88]">
        <div className="flex items-center justify-between"><span>Spot overlay</span><span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,.65)]" /></div>
        <div className="flex items-center justify-between"><span>Expiry split</span><span className="text-[#b8c0ca]">Combined</span></div>
        <div className="flex items-center justify-between"><span>Window</span><span className="text-[#b8c0ca]">Full day</span></div>
      </div>
      <div className="mt-auto pt-3">
        <div className="h-px w-full bg-[#252a31]" />
        <p className="mt-2 font-mono text-[6px] uppercase tracking-[.12em] text-[#535c67]">Eastern time · live frame</p>
      </div>
    </aside>
  );
}

export function ProfessionalOrderflowDesk({
  metrics,
  points,
}: {
  metrics: readonly OrderflowMetricConfig[];
  points: GexBotOrderflowFrame[];
}) {
  const enabled = new Set(metrics.map((metric) => metric.id));
  const panels: OrderflowDeskPanel[] = [];
  if (enabled.has("agg_dex") || enabled.has("dexoflow")) panels.push("aggregate");
  if (enabled.has("gexoflow") || enabled.has("zgr")) panels.push("gex");
  if (enabled.has("cvroflow") || enabled.has("zcvr")) panels.push("convexity");
  const visiblePanels: OrderflowDeskPanel[] = panels.length ? panels : ["aggregate", "gex", "convexity"];
  const frame = points.at(-1);
  return (
    <div className="min-w-[900px] overflow-hidden rounded-sm border border-[#25292f] bg-[#070809] shadow-[0_20px_70px_rgba(0,0,0,.34)]">
      {visiblePanels.map((panel, index) => (
        <section key={panel} className={`flex h-[224px] min-w-0 ${index ? "border-t border-[#25292f]" : ""}`}>
          <div className="min-w-0 flex-1"><EChartSurface option={deskPanelOption(panel, points)} height={223} /></div>
          <OrderflowMetricRail panel={panel} frame={frame} />
        </section>
      ))}
    </div>
  );
}
