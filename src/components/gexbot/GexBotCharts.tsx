"use client";

import { CustomChart, LineChart, ScatterChart } from "echarts/charts";
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
import { useEffect, useMemo, useRef } from "react";

import type { GexBotOrderflowFrame, GexBotProfileFrame, GexBotStrike } from "@/lib/gexBotTypes";

echarts.use([
  AxisPointerComponent,
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

type SpotSample = { timestamp: number; spot: number };
type Dataset = "volume" | "oi" | "both";
type LineStyle = "solid" | "short" | "dash" | "dot";

type Appearance = {
  positive: string;
  negative: string;
  prior: string;
  spot: string;
  showPositive: boolean;
  showNegative: boolean;
  showPriors: boolean;
  showSpot: boolean;
  showZero: boolean;
  showMajors: boolean;
  lineStyle: LineStyle;
  dotSize: number;
  multiplier: number;
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

  useEffect(() => {
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

  return <div ref={elementRef} className={`w-full ${className}`} style={{ height }} />;
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
  const positive = dataset === "oi" ? frame.major_pos_oi : frame.major_pos_vol;
  const negative = dataset === "oi" ? frame.major_neg_oi : frame.major_neg_vol;
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
  if (appearance.showMajors && positive !== null) data.push({
    name: "Major positive",
    yAxis: positive,
    lineStyle: { color: appearance.positive, width: 1.1, type: echartsLineStyle(appearance.lineStyle), opacity: 0.78 },
    label: { show: false },
  });
  if (appearance.showMajors && negative !== null) data.push({
    name: "Major negative",
    yAxis: negative,
    lineStyle: { color: appearance.negative, width: 1.1, type: echartsLineStyle(appearance.lineStyle), opacity: 0.78 },
    label: { show: false },
  });
  return data;
}

export function ProfessionalProfileChart({
  frame,
  dataset,
  appearance,
  spotTape,
  priorIndex,
  onHover,
}: {
  frame: GexBotProfileFrame;
  dataset: Dataset;
  appearance: Appearance;
  spotTape: SpotSample[];
  priorIndex: number;
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
      .slice(-420)
      .map((entry) => [entry.timestamp, entry.spot]);
    if (!priceData.length) priceData.push([frame.timestamp, frame.spot]);
    const lines = levelLines(frame, dataset, appearance);
    const series: Record<string, unknown>[] = [];
    series.push({
      name: "Price",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: priceData,
      showSymbol: priceData.length < 2,
      symbolSize: 5,
      smooth: 0.12,
      sampling: "lttb",
      lineStyle: { color: "#d8e6f1", width: 1.7, shadowBlur: 7, shadowColor: "rgba(160,220,255,.28)" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(126,220,255,.13)" }, { offset: 1, color: "rgba(126,220,255,0)" }] } },
      markLine: { silent: true, symbol: "none", animation: false, data: lines },
      emphasis: { focus: "series" },
    });
    const exposureData = (field: 1 | 2) => strikes
      .filter((entry) => (entry[field] >= 0 ? appearance.showPositive : appearance.showNegative))
      .map((entry, index) => ({ name: price(entry[0]), value: [entry[field] * appearance.multiplier, entry[0], field, index, step] }));
    if (dataset === "volume" || dataset === "both") series.push({
      name: "Volume GEX",
      type: "custom",
      xAxisIndex: 1,
      yAxisIndex: 1,
      renderItem: exposureRenderer(appearance.positive, appearance.negative, 0.52, 0.94),
      data: exposureData(1),
      encode: { x: 0, y: 1, tooltip: [1, 0] },
      clip: true,
      z: 4,
    });
    if (dataset === "oi" || dataset === "both") series.push({
      name: "Open interest GEX",
      type: "custom",
      xAxisIndex: 1,
      yAxisIndex: 1,
      renderItem: exposureRenderer(appearance.positive, appearance.negative, dataset === "both" ? 0.2 : 0.52, dataset === "both" ? 0.38 : 0.94),
      data: exposureData(2),
      encode: { x: 0, y: 1, tooltip: [1, 0] },
      clip: true,
      z: dataset === "both" ? 3 : 4,
    });
    if (appearance.showPriors) {
      const priorCount = Math.max(0, ...strikes.map((entry) => entry[3].length));
      for (let index = 0; index < priorCount; index += 1) {
        series.push({
          name: `Lookback ${index + 1}`,
          type: "scatter",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: strikes.flatMap((entry, strikeIndex) => entry[3][index] === undefined ? [] : [{ name: price(entry[0]), value: [entry[3][index] * appearance.multiplier, entry[0], index, strikeIndex] }]),
          symbol: "circle",
          symbolSize: index === priorIndex ? appearance.dotSize * 2.4 : appearance.dotSize * 1.7,
          itemStyle: { color: index === priorIndex ? "#ffffff" : appearance.prior, opacity: index === priorIndex ? 1 : Math.max(0.2, 0.7 - index * 0.08), shadowBlur: index === priorIndex ? 9 : 2, shadowColor: appearance.prior },
          z: index === priorIndex ? 8 : 5,
        });
      }
    }
    series.push({
      name: "Reference levels",
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: [[-exposureMax, minStrike], [exposureMax, maxStrike]],
      lineStyle: { opacity: 0 },
      symbol: "none",
      silent: true,
      markLine: {
        silent: true,
        symbol: "none",
        animation: false,
        data: [{ xAxis: 0, lineStyle: { color: GRID_STRONG, type: "dashed", width: 1 }, label: { show: false } }, ...lines],
      },
      z: 2,
    });
    return {
      backgroundColor: "transparent",
      animationDuration: 260,
      animationDurationUpdate: 180,
      animationEasingUpdate: "cubicOut",
      textStyle: { fontFamily: UI, color: TEXT },
      title: [
        { text: "UNDERLYING PATH", left: "3.5%", top: 9, textStyle: { color: MUTED, fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: 2 } },
        { text: "EXPOSURE BY STRIKE", left: "51%", top: 9, textStyle: { color: MUTED, fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: 2 } },
      ],
      grid: [
        { left: "3.5%", right: "54%", top: 42, bottom: 50, containLabel: true, show: true, borderColor: GRID_STRONG, backgroundColor: "rgba(4,6,9,.28)" },
        { left: "50%", right: 56, top: 42, bottom: 50, containLabel: false, show: true, borderColor: GRID_STRONG, backgroundColor: "rgba(4,6,9,.38)" },
      ],
      tooltip: { trigger: "item", confine: true, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [10, 12], textStyle: { color: TEXT, fontFamily: UI, fontSize: 10 }, extraCssText: "box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(12px);border-radius:10px", formatter: profileTooltip },
      axisPointer: { link: [{ yAxisIndex: [0, 1] }], label: { show: true, color: "#080a0d", backgroundColor: "#e9edf3", fontFamily: MONO, fontSize: 9 }, lineStyle: { color: "rgba(226,232,240,.62)", width: 1, type: "dashed" } },
      xAxis: [
        { gridIndex: 0, type: "time", boundaryGap: false, axisLine: { lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, hideOverlap: true }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true, snap: false } },
        { gridIndex: 1, type: "value", min: -exposureMax, max: exposureMax, axisLine: { show: true, onZero: true, lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, formatter: (value: number) => compact(value) }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true, snap: false } },
      ],
      yAxis: [
        { gridIndex: 0, type: "value", min: minStrike - step, max: maxStrike + step, scale: true, position: "left", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, formatter: (value: number) => value.toFixed(0) }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true, snap: false } },
        { gridIndex: 1, type: "value", min: minStrike - step, max: maxStrike + step, scale: true, position: "right", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, margin: 9, formatter: (value: number) => value.toFixed(0) }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true, snap: false } },
      ],
      dataZoom: [
        { type: "inside", yAxisIndex: [0, 1], filterMode: "none", zoomOnMouseWheel: "shift", moveOnMouseWheel: true, moveOnMouseMove: true },
        { type: "slider", yAxisIndex: [0, 1], orient: "vertical", right: 4, top: 42, bottom: 50, width: 8, showDetail: false, borderColor: GRID_STRONG, backgroundColor: "rgba(0,0,0,.25)", fillerColor: "rgba(255,255,255,.09)", handleStyle: { color: TEXT, borderColor: TEXT }, moveHandleStyle: { color: TEXT } },
      ],
      series,
    };
  }, [appearance, dataset, frame, priorIndex, spotTape, strikes]);

  return (
    <EChartSurface
      option={option}
      height="clamp(600px, calc(100vh - 235px), 860px)"
      className="min-h-[600px]"
      onMouseOver={(event) => {
        const source = Array.isArray(event.data) ? event.data : event.data?.value ?? event.value;
        const strike = finite(source?.[1]);
        if (strike === null) return;
        onHover(strikes.find((entry) => entry[0] === strike) ?? null);
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
  const height = Math.max(430, metrics.length * 224 + 52);
  const option = useMemo<EChartsCoreOption>(() => {
    const panelHeight = 150;
    const panelGap = 72;
    const grids: Record<string, unknown>[] = [];
    const titles: Record<string, unknown>[] = [];
    const xAxes: Record<string, unknown>[] = [];
    const yAxes: Record<string, unknown>[] = [];
    const series: Record<string, unknown>[] = [];
    metrics.forEach((metric, index) => {
      const top = 43 + index * (panelHeight + panelGap);
      grids.push({ left: 80, right: 70, top, height: panelHeight, containLabel: false, show: true, borderColor: GRID_STRONG, backgroundColor: "rgba(4,6,9,.3)" });
      titles.push({ text: metric.label.toUpperCase(), subtext: metric.description, left: 80, top: top - 34, textStyle: { color: metric.color, fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }, subtextStyle: { color: MUTED, fontFamily: UI, fontSize: 9, lineHeight: 14 } });
      xAxes.push({ gridIndex: index, type: "time", boundaryGap: false, axisLine: { lineStyle: { color: GRID_STRONG } }, axisTick: { show: false }, axisLabel: { show: index === metrics.length - 1, color: MUTED, fontFamily: MONO, fontSize: 9, hideOverlap: true }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true } });
      yAxes.push({ gridIndex: index, type: "value", scale: true, position: "left", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: MUTED, fontFamily: MONO, fontSize: 9, formatter: (value: number) => compact(value) }, splitLine: { show: true, lineStyle: { color: GRID } }, axisPointer: { show: true } });
      yAxes.push({ gridIndex: index, type: "value", scale: true, position: "right", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "rgba(220,226,235,.45)", fontFamily: MONO, fontSize: 8, formatter: (value: number) => value.toFixed(0) }, splitLine: { show: false }, axisPointer: { show: false } });
      const value = (point: GexBotOrderflowFrame, field: string) => finite(point[field as keyof GexBotOrderflowFrame]);
      series.push({
        name: `${metric.label} · 0DTE`, type: "line", xAxisIndex: index, yAxisIndex: index * 2,
        data: points.flatMap((point) => { const next = value(point, metric.id); return next === null ? [] : [[point.timestamp, next]]; }),
        showSymbol: false, smooth: 0.08, connectNulls: false, sampling: "lttb",
        lineStyle: { color: metric.color, width: 2, shadowBlur: 7, shadowColor: `${metric.color}50` },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${metric.color}20` }, { offset: 1, color: `${metric.color}00` }] } },
        markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: GRID_STRONG, width: 1 }, label: { show: false } }] },
        emphasis: { focus: "series" }, z: 4,
      });
      series.push({
        name: `${metric.label} · 1DTE`, type: "line", xAxisIndex: index, yAxisIndex: index * 2,
        data: points.flatMap((point) => { const next = value(point, metric.one); return next === null ? [] : [[point.timestamp, next]]; }),
        showSymbol: false, smooth: 0.08, connectNulls: false, sampling: "lttb",
        lineStyle: { color: "#d6b4ff", width: 1.35, type: "dashed", opacity: 0.82 }, emphasis: { focus: "series" }, z: 5,
      });
      series.push({
        name: "Underlying", type: "line", xAxisIndex: index, yAxisIndex: index * 2 + 1,
        data: points.map((point) => [point.timestamp, point.spot]), showSymbol: false, smooth: 0.05,
        lineStyle: { color: "rgba(238,242,247,.48)", width: 1 }, emphasis: { disabled: true }, silent: true, z: 2,
      });
    });
    return {
      backgroundColor: "transparent",
      animationDuration: 240,
      animationDurationUpdate: 160,
      animationEasingUpdate: "cubicOut",
      textStyle: { color: TEXT, fontFamily: UI },
      title: titles,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      tooltip: { trigger: "axis", confine: true, axisPointer: { type: "cross" }, backgroundColor: TOOLTIP_BG, borderColor: GRID_STRONG, borderWidth: 1, padding: [10, 12], textStyle: { color: TEXT, fontFamily: UI, fontSize: 10 }, extraCssText: "box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(12px);border-radius:10px", formatter: orderflowTooltip },
      axisPointer: { link: [{ xAxisIndex: "all" }], label: { show: true, color: "#080a0d", backgroundColor: "#e9edf3", fontFamily: MONO, fontSize: 9 }, lineStyle: { color: "rgba(226,232,240,.58)", width: 1, type: "dashed" } },
      dataZoom: [
        { type: "inside", xAxisIndex: metrics.map((_, index) => index), filterMode: "none", zoomOnMouseWheel: true, moveOnMouseWheel: true, moveOnMouseMove: true },
        { type: "slider", xAxisIndex: metrics.map((_, index) => index), left: 80, right: 70, bottom: 10, height: 14, showDetail: false, borderColor: GRID_STRONG, backgroundColor: "rgba(0,0,0,.28)", fillerColor: "rgba(255,255,255,.08)", handleStyle: { color: TEXT, borderColor: TEXT }, moveHandleStyle: { color: TEXT } },
      ],
      series,
    };
  }, [metrics, points]);

  return <EChartSurface option={option} height={height} className="min-w-[720px]" />;
}
