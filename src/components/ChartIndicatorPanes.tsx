"use client";

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronDown, GripHorizontal, Minus, Plus, RefreshCw, Settings2 } from "lucide-react";
import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";
import type { KwantStatsTable } from "@/lib/kwantStats";
import { chartCandleBodyWidth, paneBarSpacing } from "@/lib/chartBarWidth";
import { sampledPanePoints, sampledVerticalPanePoints } from "@/lib/chartIndicatorPaneSampling";

type IndicatorPaneGroup = {
  key: string;
  title: string;
  indicatorId: string;
  settings?: Record<string, number | string | boolean>;
  series: CalculatedIndicatorSeries[];
  stats?: KwantStatsTable;
  unavailableReason?: string;
  fixedDomain?: IndicatorPaneDomain;
  statusLabel?: string;
  currentBadge?: string;
  currentBadgeValue?: number;
  bands?: Array<{ from: number; to: number; color: string; opacity?: number }>;
  percentageAxis?: boolean;
  secondaryAxisSeriesKey?: string;
  secondaryAxisLabel?: string;
  showHeader?: boolean;
  showLegend?: boolean;
  defaultHeight?: number;
  minimumHeight?: number;
  maximumHeight?: number;
  tooltipPoints?: Array<{ time: number; rows: Array<{ label: string; value: string }> }>;
};

type IndicatorPaneDock = "top" | "bottom" | "left" | "right";

type IndicatorPanePlacement = {
  dock: IndicatorPaneDock;
  order: number;
};

type IndicatorPaneLayoutMap = Record<string, IndicatorPanePlacement>;

type IndicatorPaneDomain = { min: number; max: number };

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatStatValue(value: number, format: "number" | "percent" | "seconds" | "ratio", autoFormat: boolean) {
  if (!Number.isFinite(value)) return "—";
  if (format === "percent") return `${value.toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;
  if (format === "seconds") return `${value < 10 ? value.toFixed(1) : value.toFixed(0)}s`;
  if (format === "ratio") return `${value.toFixed(Math.abs(value) >= 100 ? 0 : 2)}x`;
  if (autoFormat) return compact(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function seriesDomain(series: CalculatedIndicatorSeries[]) {
  const values = series.flatMap((definition) => definition.data.flatMap((point) => [
    point.value,
    point.open,
    point.high,
    point.low,
    point.close,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value))));
  if (series.some((definition) => definition.includeZeroInScale)) values.push(0);
  if (!values.length) return { min: -1, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.05);
    min -= padding;
    max += padding;
  } else {
    const padding = (max - min) * 0.08;
    min -= padding;
    max += padding;
  }
  return { min, max };
}

function scaleDomain(domain: { min: number; max: number }, scale: number, verticalPan = 0) {
  const halfSpan = Math.max(1e-9, (domain.max - domain.min) / 2) * scale;
  const center = (domain.min + domain.max) / 2 + verticalPan * halfSpan * 2;
  return { min: center - halfSpan, max: center + halfSpan };
}

function isCvdIndicator(indicatorId: string) {
  return [
    "cumulative-volume-delta",
    "delta-cumulative-candlestick",
    "delta-cumulative-histogram",
  ].includes(indicatorId);
}

function ChartIndicatorPaneSurface({
  groups,
  width,
  priceScaleWidth,
  height,
  viewportVersion,
  paneHeights,
  collapsedPanes,
  timeToX,
  onResizePane,
  onTogglePane,
  onUpdateSetting,
  onOpenSettings,
  placementStyle,
  onPaneHandlePointerDown,
}: {
  groups: IndicatorPaneGroup[];
  width: number;
  priceScaleWidth: number;
  height: number;
  viewportVersion: number;
  paneHeights: Record<string, number>;
  collapsedPanes: Record<string, boolean>;
  timeToX: (time: number) => number | null;
  onResizePane: (instanceId: string, height: number) => void;
  onTogglePane: (instanceId: string) => void;
  onUpdateSetting?: (instanceId: string, key: string, value: number | string | boolean) => void;
  onOpenSettings?: (instanceId: string) => void;
  placementStyle: CSSProperties;
  onPaneHandlePointerDown: (instanceId: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  // The native chart moves independently of React. This value deliberately
  // participates in memoized renders so pane plots follow pan and zoom.
  void viewportVersion;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [verticalScaleByPane, setVerticalScaleByPane] = useState<Record<string, number>>({});
  const [verticalPanByPane, setVerticalPanByPane] = useState<Record<string, number>>({});
  // Once a trader manually scales or pans a lower pane, keep its absolute
  // value domain. The main chart still owns the shared horizontal time range,
  // but chart navigation must not rebuild the pane's vertical framing from a
  // different subset of visible values.
  const [lockedVerticalDomainByPane, setLockedVerticalDomainByPane] = useState<Record<string, IndicatorPaneDomain>>({});
  const renderedVerticalDomainByPaneRef = useRef<Record<string, IndicatorPaneDomain>>({});
  const [draggingPane, setDraggingPane] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ groupKey: string; x: number; y: number; rows: Array<{ label: string; value: string }> } | null>(null);
  const paneRootRef = useRef<HTMLDivElement>(null);

  function scalePaneFromWheel(groupKey: string, deltaY: number, deltaMode: number) {
    const normalizedDelta = deltaMode === 1
      ? deltaY * 16
      : deltaMode === 2
        ? deltaY * 120
        : deltaY;
    const multiplier = Math.exp(Math.max(-120, Math.min(120, normalizedDelta)) * 0.0025);
    const renderedDomain = renderedVerticalDomainByPaneRef.current[groupKey];
    if (renderedDomain) {
      const center = (renderedDomain.min + renderedDomain.max) / 2;
      const halfSpan = Math.max(1e-9, (renderedDomain.max - renderedDomain.min) / 2) * multiplier;
      setLockedVerticalDomainByPane((current) => ({
        ...current,
        [groupKey]: { min: center - halfSpan, max: center + halfSpan },
      }));
    }
    setVerticalScaleByPane((current) => ({
      ...current,
      [groupKey]: Math.max(0.2, Math.min(8, (current[groupKey] ?? 1) * multiplier)),
    }));
  }

  useEffect(() => {
    const paneRoot = paneRootRef.current;
    const chartContainer = paneRoot?.parentElement;
    if (!paneRoot || !chartContainer) return;

    // Lightweight Charts owns a native wheel listener on the parent chart
    // container. React's onWheel fires too late to stop it, so lower-pane
    // wheels must be consumed during native capture.
    const captureIndicatorWheel = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const wheelZone = target?.closest<HTMLElement>("[data-indicator-pane-wheel-zone]");
      if (!wheelZone || !paneRoot.contains(wheelZone)) return;
      const groupKey = wheelZone.dataset.indicatorPaneWheelZone;
      if (!groupKey || event.deltaY === 0) return;
      const fixedScale = wheelZone.dataset.indicatorPaneFixedScale === "true";

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!fixedScale) {
        scalePaneFromWheel(groupKey, event.deltaY, event.deltaMode);
      }
    };

    chartContainer.addEventListener("wheel", captureIndicatorWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      chartContainer.removeEventListener("wheel", captureIndicatorWheel, { capture: true });
    };
  }, [groups.length, height, width]);

  useEffect(() => {
    if (!openMenu) return;
    const dismissMenu = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && paneRootRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    const dismissMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", dismissMenu, true);
    document.addEventListener("keydown", dismissMenuWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", dismissMenu, true);
      document.removeEventListener("keydown", dismissMenuWithKeyboard);
    };
  }, [openMenu]);

  if (!groups.length || width <= 0 || height <= 0) return null;
  const valueScaleWidth = Math.max(44, Math.min(width, Math.round(priceScaleWidth)));
  const plotWidth = Math.max(0, width - valueScaleWidth);
  const fallbackPaneHeight = Math.max(64, height / Math.max(1, groups.length));
  let paneTop = 0;
  const paneLayouts = groups.map((group) => {
    const collapsed = Boolean(collapsedPanes[group.key]);
    const paneHeight = collapsed ? 30 : paneHeights[group.key] ?? group.defaultHeight ?? fallbackPaneHeight;
    const layout = { group, top: paneTop, height: paneHeight, collapsed };
    paneTop += paneHeight;
    return layout;
  });

  return (
    <div
      ref={paneRootRef}
      className={`pointer-events-none absolute ${openMenu ? "z-[80]" : "z-[9]"}`}
      style={{ width, height, ...placementStyle }}
    >
    <svg
      className="absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-label="Chart indicator panes"
    >
      <defs>
        {paneLayouts.map(({ group, top, height: paneHeight }, index) => (
          <clipPath id={`indicator-pane-${group.key.replace(/[^a-z0-9-]/gi, "")}-${index}`} key={group.key}>
            <rect x={group.percentageAxis ? 52 : 0} y={top + (group.percentageAxis ? 26 : 0)} width={Math.max(0, plotWidth - (group.percentageAxis ? 52 : 0))} height={Math.max(0, paneHeight - (group.percentageAxis ? 48 : 0))} />
          </clipPath>
        ))}
      </defs>
      {groups.map((group, groupIndex) => {
        const layout = paneLayouts[groupIndex];
        const top = layout.top;
        const paneHeight = layout.height;
        const collapsed = layout.collapsed;
        const leftAxisWidth = group.percentageAxis ? 52 : 0;
        const innerTop = top + (group.percentageAxis ? 34 : 24);
        const innerBottom = top + paneHeight - (group.percentageAxis ? 22 : 9);
        const innerPlotWidth = Math.max(1, plotWidth - leftAxisWidth);
        // CVD is calculated from the chart's exact candle boundaries, so it
        // must share the chart time scale. Stretching its own tape across the
        // pane detached range-chart CVD candles from their parent 40r bars.
        const independentCvdTape = false;
        const tapeTimes = independentCvdTape
          ? group.series.flatMap((definition) => definition.data.map((point) => point.time))
          : [];
        const tapeStart = tapeTimes.length ? Math.min(...tapeTimes) : 0;
        const tapeEnd = tapeTimes.length ? Math.max(...tapeTimes) : 0;
        const tapeSpan = Math.max(1, tapeEnd - tapeStart);
        const xForTime = (time: number) => {
          const raw = independentCvdTape
            ? ((time - tapeStart) / tapeSpan) * Math.max(1, plotWidth - 2) + 1
            : timeToX(time);
          if (raw === null || !group.percentageAxis) return raw;
          return leftAxisWidth + (raw / Math.max(1, plotWidth)) * innerPlotWidth;
        };
        // Scale against the currently visible chart range. Using the whole
        // loaded history makes a live CVD tape look flat after one large move.
        const visibleSeries = group.series.map((definition) => ({
          ...definition,
          data: definition.data.filter((point) => {
            const x = xForTime(point.time);
            return x !== null && x >= -10 && x <= plotWidth + 10;
          }),
        }));
        const sharedSeries = visibleSeries.filter((series) => !series.independentScale);
        const verticalScale = verticalScaleByPane[group.key] ?? 1;
        const verticalPan = verticalPanByPane[group.key] ?? 0;
        const automaticSharedDomain = scaleDomain(
          group.fixedDomain ?? seriesDomain(sharedSeries.length ? sharedSeries : visibleSeries),
          verticalScale,
          verticalPan,
        );
        const sharedDomain = lockedVerticalDomainByPane[group.key] ?? automaticSharedDomain;
        renderedVerticalDomainByPaneRef.current[group.key] = sharedDomain;
        const independentDomains = new Map(
          visibleSeries
            .filter((series) => series.independentScale)
            .map((series) => [series.key, scaleDomain(seriesDomain([series]), verticalScale, verticalPan)] as const),
        );
        const secondarySeries = group.secondaryAxisSeriesKey
          ? visibleSeries.find((series) => series.key === group.secondaryAxisSeriesKey)
          : undefined;
        const secondaryDomain = secondarySeries ? independentDomains.get(secondarySeries.key) : undefined;
        const yFor = (value: number, definition: CalculatedIndicatorSeries) => {
          const domain = definition.independentScale
            ? independentDomains.get(definition.key) ?? sharedDomain
            : sharedDomain;
          return innerBottom - ((value - domain.min) / (domain.max - domain.min)) * (innerBottom - innerTop);
        };
        const zeroSeries = group.series.find((series) => series.showZeroLine);
        const zeroY = zeroSeries ? yFor(0, zeroSeries) : null;
        const clipId = `indicator-pane-${group.key.replace(/[^a-z0-9-]/gi, "")}-${groupIndex}`;
        const stats = group.stats;
        const statsHeaderWidth = stats?.showHeader ? 72 : 0;
        const statsInnerTop = top + 24;
        const statsRowHeight = stats?.metrics.length
          ? Math.max(9, (paneHeight - 27) / stats.metrics.length)
          : 0;
        const rawStatsBars = stats?.bars
          .map((bar) => ({ ...bar, x: timeToX(bar.time) }))
          .filter((bar): bar is typeof bar & { x: number } =>
            bar.x !== null && bar.x >= -80 && bar.x <= plotWidth + 80)
          ?? [];
        const maximumStatsColumns = Math.max(80, Math.floor(plotWidth / 5));
        const statsBars = rawStatsBars.length <= maximumStatsColumns
          ? rawStatsBars
          : [...rawStatsBars.reduce((buckets, bar) => {
            const bucket = Math.floor(Math.max(0, bar.x) / Math.max(1, plotWidth / maximumStatsColumns));
            buckets.set(bucket, bar);
            return buckets;
          }, new Map<number, (typeof rawStatsBars)[number]>()).values()].sort((left, right) => left.x - right.x);
        const statsColumnWidth = statsBars.length > 1
          ? Math.max(5, Math.min(64, Math.abs(statsBars[1].x - statsBars[0].x) * 0.9))
          : 18;
        const metricDistributions = new Map(
          (stats?.metrics ?? []).map((metric) => {
            const values = statsBars
              .map((bar) => bar.values[metric.key])
              .filter((value): value is number => value != null && Number.isFinite(value));
            const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
            const variance = values.length
              ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
              : 0;
            return [metric.key, { mean, deviation: Math.sqrt(variance) }] as const;
          }),
        );

        return (
          <g key={group.key}>
            <rect x="0" y={top} width={width} height={paneHeight} fill="var(--chart-background)" fillOpacity="0.97" />
            <line x1="0" y1={top + 0.5} x2={width} y2={top + 0.5} stroke="var(--grid-color)" strokeWidth="1" />
            <line x1={plotWidth + 0.5} y1={top} x2={plotWidth + 0.5} y2={top + paneHeight} stroke="var(--grid-color)" strokeWidth="1" />
            {group.showHeader !== false ? <text x={group.percentageAxis ? leftAxisWidth + 8 : 10} y={top + 16} fill="var(--foreground)" fontSize="11" fontWeight="600" fontFamily="var(--font-mono), monospace">
              {group.title.length > (width < 620 ? 45 : 100) ? `${group.title.slice(0, width < 620 ? 42 : 97)}…` : group.title}
            </text> : null}
            {group.statusLabel && group.showHeader !== false ? (
              <text x={Math.max(170, plotWidth - 118)} y={top + 15} fill="var(--muted)" fontSize="8" fontFamily="monospace" textAnchor="end">
                {group.statusLabel}
              </text>
            ) : null}
            {!collapsed && group.unavailableReason ? (
              <g>
                {/* A restoring pane must read as LOADING, not as broken: the
                    pulsing dot makes the difference obvious while history
                    streams in. Terminal states (no volume on this feed) are
                    left as plain text. */}
                {/^(Restoring|Loading|Waiting)/i.test(group.unavailableReason) ? (
                  <circle cx="14" cy={top + 30.5} r="3" fill="var(--primary)">
                    <animate attributeName="opacity" values="0.25;1;0.25" dur="1.1s" repeatCount="indefinite" />
                  </circle>
                ) : null}
                <text
                  x={/^(Restoring|Loading|Waiting)/i.test(group.unavailableReason) ? 24 : 10}
                  y={top + 34}
                  fill="var(--muted)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {group.unavailableReason}
                </text>
              </g>
            ) : null}
            {!collapsed && stats ? (
              <g clipPath={`url(#${clipId})`}>
                {stats.metrics.map((metric, metricIndex) => {
                  const rowTop = statsInnerTop + metricIndex * statsRowHeight;
                  const distribution = metricDistributions.get(metric.key) ?? { mean: 0, deviation: 0 };
                  const cellHeight = Math.max(1, statsRowHeight - 1);
                  const cellPaths = new Map<string, { fill: string; opacity: number; commands: string[] }>();
                  const textCells: Array<{ x: number; value: number }> = [];
                  statsBars.forEach((bar) => {
                    const value = bar.values[metric.key];
                    if (value == null || !Number.isFinite(value)) return;
                    const signedPositive = value >= 0;
                    const fill = metric.tone === "positive"
                      ? stats.positiveColor
                      : metric.tone === "negative"
                        ? stats.negativeColor
                        : metric.tone === "signed"
                          ? signedPositive ? stats.positiveColor : stats.negativeColor
                          : stats.neutralColor;
                    const magnitude = distribution.deviation > 0
                      ? Math.abs(value - distribution.mean) / distribution.deviation
                      : Math.abs(value) > 0 ? 1 : 0;
                    const rawOpacity = metric.threshold > 0 && Math.abs(value) >= metric.threshold
                      ? 0.82
                      : Math.min(0.68, 0.08 + magnitude / Math.max(0.1, stats.coloringDeviation) * 0.38);
                    const opacity = Math.max(0.1, Math.round(rawOpacity * 20) / 20);
                    const key = `${fill}:${opacity}`;
                    const group = cellPaths.get(key) ?? { fill, opacity, commands: [] };
                    group.commands.push(
                      `M${(bar.x - statsColumnWidth / 2).toFixed(2)},${(rowTop + 0.5).toFixed(2)}`
                      + `h${statsColumnWidth.toFixed(2)}v${cellHeight.toFixed(2)}h-${statsColumnWidth.toFixed(2)}Z`,
                    );
                    cellPaths.set(key, group);
                    if (statsColumnWidth >= 25 && statsRowHeight >= 10) textCells.push({ x: bar.x, value });
                  });
                  return (
                    <g key={metric.key}>
                      <line
                        x1="0"
                        y1={rowTop + statsRowHeight}
                        x2={plotWidth}
                        y2={rowTop + statsRowHeight}
                        stroke="var(--grid-color)"
                        strokeOpacity="0.55"
                      />
                      {[...cellPaths.values()].map((path, pathIndex) => (
                        <path
                          key={`${metric.key}-cells-${pathIndex}`}
                          d={path.commands.join("")}
                          fill={path.fill}
                          fillOpacity={path.opacity}
                        />
                      ))}
                      {textCells.map((cell, textIndex) => (
                        <text
                          key={`${metric.key}-text-${textIndex}`}
                          x={cell.x}
                          y={rowTop + statsRowHeight * 0.68}
                          fill={stats.textColor}
                          fontSize={Math.max(7, Math.min(9, statsRowHeight * 0.58))}
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {formatStatValue(cell.value, metric.format, stats.autoFormat)}
                        </text>
                      ))}
                    </g>
                  );
                })}
                {stats.showHeader ? (
                  <g>
                    <rect
                      x="0"
                      y={statsInnerTop}
                      width={statsHeaderWidth}
                      height={Math.max(0, stats.metrics.length * statsRowHeight)}
                      fill={stats.headerColor}
                      fillOpacity="0.96"
                    />
                    <line
                      x1={statsHeaderWidth}
                      y1={statsInnerTop}
                      x2={statsHeaderWidth}
                      y2={statsInnerTop + stats.metrics.length * statsRowHeight}
                      stroke="var(--grid-color)"
                    />
                    {stats.metrics.map((metric, metricIndex) => (
                      <text
                        key={`header-${metric.key}`}
                        x={statsHeaderWidth - 5}
                        y={statsInnerTop + metricIndex * statsRowHeight + statsRowHeight * 0.68}
                        fill={stats.textColor}
                        fontSize={Math.max(7, Math.min(9, statsRowHeight * 0.56))}
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {metric.label}
                      </text>
                    ))}
                  </g>
                ) : null}
              </g>
            ) : null}
            {!collapsed && !stats && zeroSeries && zeroY !== null && zeroY >= innerTop && zeroY <= innerBottom ? (
              <line
                x1="0"
                y1={zeroY}
                x2={plotWidth}
                y2={zeroY}
                stroke={zeroSeries.zeroLineColor ?? "var(--muted)"}
                strokeWidth={zeroSeries.zeroLineWidth ?? 1}
                strokeDasharray="4 4"
                opacity="0.72"
              />
            ) : null}
            {!collapsed && !stats && group.percentageAxis ? (
              <g aria-label="IV Rank percentage scale">
                {[0, 20, 40, 60, 80, 100].map((tick) => {
                  const reference = group.series.find((series) => !series.independentScale) ?? group.series[0];
                  if (!reference) return null;
                  const y = yFor(tick, reference);
                  return (
                    <g key={`${group.key}-percentage-tick-${tick}`}>
                      <line x1={leftAxisWidth} y1={Math.round(y) + 0.5} x2={plotWidth} y2={Math.round(y) + 0.5} stroke="var(--grid-color)" strokeOpacity="0.18" vectorEffect="non-scaling-stroke" />
                      <text x={leftAxisWidth - 7} y={y + 3} fill="var(--muted)" fontSize="8" fontFamily="var(--font-mono), monospace" textAnchor="end">{tick}%</text>
                    </g>
                  );
                })}
                <text x={leftAxisWidth - 7} y={innerTop + 4} fill="var(--muted)" fontSize="7" fontFamily="var(--font-mono), monospace" textAnchor="end">IVR %</text>
              </g>
            ) : null}
            {!collapsed && !stats ? <g clipPath={`url(#${clipId})`}>
              {(group.bands ?? []).map((band, bandIndex) => {
                const reference = group.series.find((series) => !series.independentScale) ?? group.series[0];
                if (!reference) return null;
                const y1 = yFor(band.to, reference);
                const y2 = yFor(band.from, reference);
                return <rect key={`${group.key}-band-${bandIndex}`} x={leftAxisWidth} y={Math.min(y1, y2)} width={innerPlotWidth} height={Math.abs(y2 - y1)} fill={band.color} fillOpacity={band.opacity ?? 0.055} />;
              })}
              {group.series.map((definition) => {
                const visible = sampledPanePoints(definition, xForTime, plotWidth);
                if (!visible.length) return null;
                if (definition.kind === "histogram") {
                  // The same width the candle above it is drawn at. A flat
                  // 72% capped at twelve pixels meant that past that cap the
                  // candles kept growing and the histogram stayed narrow, so a
                  // bar and its delta stopped being the same width — the one
                  // thing that makes a lower pane readable against price.
                  const barWidth = chartCandleBodyWidth(paneBarSpacing(visible));
                  const zero = Math.max(innerTop, Math.min(innerBottom, yFor(0, definition)));
                  const pathsByColor = new Map<string, string[]>();
                  visible.forEach((point) => {
                    const y = yFor(point.value, definition);
                    const color = point.color ?? definition.color;
                    const commands = pathsByColor.get(color) ?? [];
                    const topY = Math.min(y, zero);
                    const barHeight = Math.max(1, Math.abs(zero - y));
                    commands.push(
                      `M${(point.x - barWidth / 2).toFixed(2)},${topY.toFixed(2)}`
                      + `h${barWidth.toFixed(2)}v${barHeight.toFixed(2)}h-${barWidth.toFixed(2)}Z`,
                    );
                    pathsByColor.set(color, commands);
                  });
                  return (
                    <g key={definition.key}>
                      {[...pathsByColor.entries()].map(([color, commands]) => (
                        <path
                          key={`${definition.key}-${color}`}
                          d={commands.join("")}
                          fill={color}
                          stroke={definition.histogramOutlineWidth ? color : undefined}
                          strokeWidth={definition.histogramOutlineWidth}
                          opacity="0.88"
                        />
                      ))}
                    </g>
                  );
                }
                if (definition.kind === "candlestick") {
                  // A candle in a pane is still a candle: same width as the
                  // one it sits under.
                  const barWidth = chartCandleBodyWidth(paneBarSpacing(visible));
                  return (
                    <g key={definition.key}>
                      {visible.map((point) => {
                        const open = point.open ?? point.value;
                        const close = point.close ?? point.value;
                        const high = point.high ?? Math.max(open, close);
                        const low = point.low ?? Math.min(open, close);
                        const color = point.color ?? definition.color;
                        const openY = yFor(open, definition);
                        const closeY = yFor(close, definition);
                        const candleStyle = definition.candleStyle ?? "candlestick";
                        return (
                          <g key={`${definition.key}-${point.time}`}>
                            {candleStyle !== "candle-body" ? (
                              <line
                                x1={point.x}
                                x2={point.x}
                                y1={yFor(high, definition)}
                                y2={yFor(low, definition)}
                                stroke={color}
                                strokeWidth={definition.lineWidth ?? 1}
                                vectorEffect="non-scaling-stroke"
                              />
                            ) : null}
                            {candleStyle === "wick-only" ? null : candleStyle === "ohlc" ? (
                              <path
                                d={`M ${point.x - barWidth / 2} ${openY} H ${point.x} M ${point.x} ${closeY} H ${point.x + barWidth / 2}`}
                                fill="none"
                                stroke={color}
                                strokeWidth={definition.lineWidth ?? 1}
                                vectorEffect="non-scaling-stroke"
                              />
                            ) : (
                              <rect
                                x={point.x - barWidth / 2}
                                y={Math.min(openY, closeY)}
                                width={barWidth}
                                height={Math.max(2, Math.abs(openY - closeY))}
                                fill={color}
                                opacity="0.96"
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                }
                const segments: Array<{ color: string; path: string }> = [];
                visible.forEach((point, index) => {
                  const color = point.color ?? definition.color;
                  const command = `${index === 0 || point.breakBefore ? "M" : "L"} ${point.x} ${yFor(point.value, definition)}`;
                  const previous = visible[index - 1];
                  const active = segments.at(-1);
                  if (!active || active.color !== color || point.breakBefore) {
                    const bridge = index > 0 && !point.breakBefore && previous
                      ? `M ${previous.x} ${yFor(previous.value, definition)} `
                      : "";
                    segments.push({ color, path: `${bridge}${command}` });
                  } else active.path += ` ${command}`;
                });
                return segments.map((segment, segmentIndex) => (
                  <path
                    key={`${definition.key}-${segmentIndex}`}
                    d={segment.path}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={definition.lineWidth ?? 2}
                    strokeDasharray={definition.lineStyle === "dashed" ? "6 4" : definition.lineStyle === "dotted" ? "2 3" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ));
              })}
            </g> : null}
            {!collapsed && !stats && !group.percentageAxis ? <text x={plotWidth + 6} y={innerTop + 2} fill="var(--muted)" fontSize="8" fontFamily="monospace">{compact(sharedDomain.max)}</text> : null}
            {!collapsed && !stats && !group.percentageAxis ? <text x={plotWidth + 6} y={innerBottom} fill="var(--muted)" fontSize="8" fontFamily="monospace">{compact(sharedDomain.min)}</text> : null}
            {!collapsed && group.percentageAxis && secondaryDomain && group.secondaryAxisLabel ? (
              <g aria-label={`${group.secondaryAxisLabel} price scale`}>
                <text x={plotWidth + 6} y={innerTop + 2} fill="var(--muted)" fontSize="8" fontFamily="var(--font-mono), monospace">{secondaryDomain.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text>
                <text x={plotWidth + 6} y={innerBottom} fill="var(--muted)" fontSize="8" fontFamily="var(--font-mono), monospace">{secondaryDomain.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text>
                <text x={plotWidth + 6} y={top + 16} fill="var(--muted)" fontSize="7" fontFamily="var(--font-mono), monospace">{group.secondaryAxisLabel}</text>
              </g>
            ) : null}
            {!collapsed && independentCvdTape && tapeTimes.length ? (
              <>
                <text x="8" y={innerBottom} fill="var(--muted)" fontSize="8" fontFamily="monospace">
                  {new Date(tapeStart * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </text>
                <text x={Math.max(8, plotWidth - 42)} y={innerBottom} fill="var(--muted)" fontSize="8" fontFamily="monospace">
                  live
                </text>
              </>
            ) : null}
            {!collapsed && !stats && group.showLegend !== false && width >= 620 ? <g transform={`translate(${Math.min(plotWidth - 8, group.indicatorId === "cumulative-volume-delta" ? 210 : group.percentageAxis ? 330 : 190)}, ${top + 9})`}>
              {group.series.slice(group.indicatorId === "cumulative-volume-delta" ? 1 : 0).map((definition, index) => (
                <g key={definition.key} transform={`translate(${index * 88}, 0)`}>
                  <line x1="0" y1="3" x2="12" y2="3" stroke={definition.color} strokeWidth={definition.lineWidth ?? 2} />
                  <text x="16" y="6" fill="var(--muted)" fontSize="8" fontFamily="monospace">
                    {definition.label}
                  </text>
                </g>
              ))}
            </g> : null}
            {!collapsed && group.currentBadge && typeof group.currentBadgeValue === "number" && group.series.length ? (() => {
              const reference = group.series.find((series) => !series.independentScale) ?? group.series[0];
              const badgeY = Math.max(innerTop + 9, Math.min(innerBottom - 9, yFor(group.currentBadgeValue, reference)));
              const badgeWidth = Math.min(132, Math.max(92, group.currentBadge.length * 5.4 + 14));
              return (
                <g aria-label={group.currentBadge}>
                  <rect x={plotWidth - badgeWidth - 4} y={badgeY - 9} width={badgeWidth} height="18" rx="2" fill="var(--panel)" stroke="var(--primary)" strokeOpacity="0.7" />
                  <text x={plotWidth - 10} y={badgeY + 3} fill="var(--primary)" fontSize="8" fontWeight="700" fontFamily="var(--font-mono), monospace" textAnchor="end">{group.currentBadge}</text>
                </g>
              );
            })() : null}
          </g>
        );
      })}
    </svg>
      {paneLayouts.map(({ group, top, height: paneHeight, collapsed }) => (
        <div key={`pane-shell-controls-${group.key}`}>
          {!collapsed ? (
            <button
              type="button"
              aria-label={`Resize ${group.title} pane`}
              title={`Drag to resize ${group.title}`}
              className="pointer-events-auto absolute left-1/2 z-30 flex h-3 w-14 -translate-x-1/2 -translate-y-1/2 touch-none select-none cursor-ns-resize items-center justify-center rounded-full border border-border bg-panel/95 text-muted shadow-sm hover:text-foreground"
              style={{ top }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const handle = event.currentTarget;
                const pointerId = event.pointerId;
                handle.setPointerCapture(pointerId);
                const startY = event.clientY;
                const startHeight = paneHeight;
                const move = (moveEvent: PointerEvent) => {
                  if (moveEvent.pointerId !== pointerId) return;
                  onResizePane(group.key, startHeight - (moveEvent.clientY - startY));
                };
                const finish = (upEvent: PointerEvent) => {
                  if (upEvent.pointerId !== pointerId) return;
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", finish);
                  window.removeEventListener("pointercancel", finish);
                  if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", finish);
                window.addEventListener("pointercancel", finish);
              }}
            >
              <GripHorizontal className="h-3 w-3" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={collapsed ? `Expand ${group.title} pane` : `Minimize ${group.title} pane`}
            title={collapsed ? `Expand ${group.title}` : `Click to minimize · drag to reorder or dock ${group.title}`}
            onPointerDown={(event) => onPaneHandlePointerDown(group.key, event)}
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenu(null);
              onTogglePane(group.key);
            }}
            className="pointer-events-auto absolute right-[66px] z-30 flex h-6 w-6 cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-panel/95 text-muted shadow-sm hover:text-foreground active:cursor-grabbing"
            style={{ top: top + 4 }}
          >
            {collapsed ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </button>
          {!collapsed ? (
            <button
              type="button"
              aria-label={`Recenter ${group.title} pane`}
              title={`Recenter ${group.title} · resets manual scale and drag`}
              onClick={(event) => {
                event.stopPropagation();
                setOpenMenu(null);
                const drop = (current: Record<string, number>) => {
                  if (!(group.key in current)) return current;
                  const next = { ...current };
                  delete next[group.key];
                  return next;
                };
                setVerticalScaleByPane(drop);
                setVerticalPanByPane(drop);
                setLockedVerticalDomainByPane((current) => {
                  if (!(group.key in current)) return current;
                  const next = { ...current };
                  delete next[group.key];
                  return next;
                });
              }}
              className="pointer-events-auto absolute right-[66px] z-30 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-panel/95 text-muted shadow-sm hover:text-foreground"
              style={{ top: top + 32 }}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          ) : null}
          {!collapsed && group.indicatorId === "kwant-stats" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenSettings?.(group.key);
              }}
              className="pointer-events-auto absolute right-[96px] z-30 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-panel/95 text-muted shadow-sm hover:text-foreground"
              style={{ top: top + 4 }}
              title="KWANT STATS settings"
              aria-label="Open KWANT STATS settings"
            >
              <Settings2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ))}
      {paneLayouts.map(({ group, top, height: paneHeight, collapsed }) => {
        if (collapsed) return null;
        const fixedVolumePane = group.indicatorId === "volume";
        return (
          <div
            key={`indicator-pane-wheel-zone-${group.key}`}
            data-testid={`indicator-pane-wheel-zone-${group.key}`}
            data-indicator-pane-wheel-zone={group.key}
            data-indicator-pane-fixed-scale={fixedVolumePane ? "true" : undefined}
            aria-label={fixedVolumePane ? "Volume pane" : `Scale ${group.title} pane vertically`}
            title={fixedVolumePane ? "Volume scale is fixed" : `Scroll to scale ${group.title} · Drag up or down to move it`}
            className={`pointer-events-auto absolute left-0 z-[8] touch-none ${fixedVolumePane ? "cursor-default" : draggingPane === group.key ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ top: top + 25, width, height: Math.max(20, paneHeight - 34) }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.button !== 0 || fixedVolumePane) return;
              const target = event.currentTarget;
              const pointerId = event.pointerId;
              const startY = event.clientY;
              const startPan = verticalPanByPane[group.key] ?? 0;
              const startDomain = renderedVerticalDomainByPaneRef.current[group.key];
              const plotHeight = Math.max(20, paneHeight - 34);
              target.setPointerCapture(pointerId);
              setDraggingPane(group.key);
              const move = (moveEvent: PointerEvent) => {
                if (moveEvent.pointerId !== pointerId) return;
                moveEvent.preventDefault();
                const verticalDelta = (moveEvent.clientY - startY) / plotHeight;
                const nextPan = startPan + verticalDelta;
                if (startDomain) {
                  const domainSpan = Math.max(1e-9, startDomain.max - startDomain.min);
                  const valueDelta = verticalDelta * domainSpan;
                  setLockedVerticalDomainByPane((current) => ({
                    ...current,
                    [group.key]: {
                      min: startDomain.min + valueDelta,
                      max: startDomain.max + valueDelta,
                    },
                  }));
                }
                setVerticalPanByPane((current) => ({
                  ...current,
                  [group.key]: Math.max(-4, Math.min(4, nextPan)),
                }));
              };
              const finish = (upEvent: PointerEvent) => {
                if (upEvent.pointerId !== pointerId) return;
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", finish);
                window.removeEventListener("pointercancel", finish);
                if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
                setDraggingPane((current) => current === group.key ? null : current);
              };
              window.addEventListener("pointermove", move, { passive: false });
              window.addEventListener("pointerup", finish);
              window.addEventListener("pointercancel", finish);
            }}
            onPointerMove={(event) => {
              if (!group.tooltipPoints?.length || draggingPane === group.key) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const localX = event.clientX - bounds.left;
              const nearest = group.tooltipPoints.reduce<{ point: (typeof group.tooltipPoints)[number]; distance: number } | null>((best, point) => {
                const pointX = timeToX(point.time);
                if (pointX === null) return best;
                const distance = Math.abs(pointX - localX);
                return !best || distance < best.distance ? { point, distance } : best;
              }, null);
              if (!nearest || nearest.distance > 42) {
                setHoverTooltip((current) => current?.groupKey === group.key ? null : current);
                return;
              }
              setHoverTooltip({
                groupKey: group.key,
                x: Math.max(8, Math.min(width - 320, localX + 14)),
                y: Math.max(top + 30, Math.min(top + paneHeight - 190, event.clientY - bounds.top + top + 12)),
                rows: nearest.point.rows,
              });
            }}
            onPointerLeave={() => setHoverTooltip((current) => current?.groupKey === group.key ? null : current)}
            onWheel={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!fixedVolumePane) {
                scalePaneFromWheel(group.key, event.deltaY, event.deltaMode);
              }
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (fixedVolumePane) return;
              setVerticalPanByPane((current) => {
                if (current[group.key] === undefined) return current;
                const next = { ...current };
                delete next[group.key];
                return next;
              });
              setLockedVerticalDomainByPane((current) => {
                if (current[group.key] === undefined) return current;
                const next = { ...current };
                delete next[group.key];
                return next;
              });
            }}
          />
        );
      })}
      {hoverTooltip ? (
        <div
          className="pointer-events-none absolute z-[95] w-[300px] max-w-[calc(100%-16px)] border border-border bg-panel/95 px-3 py-2 shadow-2xl backdrop-blur-md"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
          role="tooltip"
        >
          {hoverTooltip.rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-0.5 text-[9px] leading-4">
              <span className="text-muted">{row.label}</span>
              <span className="max-w-[190px] text-right font-mono tabular-nums text-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {paneLayouts.map(({ group, top, height: paneHeight, collapsed }) => {
        if (collapsed || !isCvdIndicator(group.indicatorId)) return null;
        const verticalScale = verticalScaleByPane[group.key] ?? 1;
        return (
          <div
            key={`cvd-price-scale-${group.key}`}
            role="slider"
            aria-label="Scale CVD vertically"
            aria-valuemin={20}
            aria-valuemax={800}
            aria-valuenow={Math.round(verticalScale * 100)}
            data-indicator-pane-wheel-zone={group.key}
            title="Scroll to expand or squeeze CVD · Double-click to reset"
            className="pointer-events-auto absolute right-0 z-10 cursor-ns-resize touch-none"
            style={{ top: top + 25, width: valueScaleWidth, height: Math.max(20, paneHeight - 34) }}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.preventDefault();
              event.stopPropagation();
              scalePaneFromWheel(group.key, event.deltaY, event.deltaMode);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setVerticalScaleByPane((current) => {
                if (current[group.key] === undefined) return current;
                const next = { ...current };
                delete next[group.key];
                return next;
              });
              setVerticalPanByPane((current) => {
                if (current[group.key] === undefined) return current;
                const next = { ...current };
                delete next[group.key];
                return next;
              });
              setLockedVerticalDomainByPane((current) => {
                if (current[group.key] === undefined) return current;
                const next = { ...current };
                delete next[group.key];
                return next;
              });
            }}
          />
        );
      })}
      {/* The on-pane CVD display-style dropdown and settings gear were
          removed: those controls live in the indicator's own settings dialog
          (Indicators menu → CVD → settings) now. */}
    </div>
  );
}

function ChartVerticalIndicatorPaneSurface({
  groups,
  width,
  height,
  globalPlotWidth,
  viewportVersion,
  collapsedPanes,
  timeToX,
  onTogglePane,
  onOpenSettings,
  placementStyle,
  onPaneHandlePointerDown,
}: {
  groups: IndicatorPaneGroup[];
  width: number;
  height: number;
  globalPlotWidth: number;
  viewportVersion: number;
  collapsedPanes: Record<string, boolean>;
  timeToX: (time: number) => number | null;
  onTogglePane: (instanceId: string) => void;
  onOpenSettings?: (instanceId: string) => void;
  placementStyle: CSSProperties;
  onPaneHandlePointerDown: (instanceId: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  void viewportVersion;
  const [scaleByPane, setScaleByPane] = useState<Record<string, number>>({});
  const paneRootRef = useRef<HTMLDivElement>(null);
  const scaleSidePane = (groupKey: string, deltaY: number, deltaMode = 0) => {
    const normalizedDelta = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 120 : deltaY;
    const multiplier = Math.exp(Math.max(-120, Math.min(120, normalizedDelta)) * 0.0025);
    setScaleByPane((current) => ({
      ...current,
      [groupKey]: Math.max(0.2, Math.min(8, (current[groupKey] ?? 1) * multiplier)),
    }));
  };

  useEffect(() => {
    const paneRoot = paneRootRef.current;
    const chartContainer = paneRoot?.parentElement;
    if (!paneRoot || !chartContainer) return;
    const captureSidePaneWheel = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const wheelZone = target?.closest<HTMLElement>("[data-indicator-pane-wheel-zone]");
      if (!wheelZone || !paneRoot.contains(wheelZone)) return;
      const groupKey = wheelZone.dataset.indicatorPaneWheelZone;
      if (!groupKey || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (wheelZone.dataset.indicatorPaneFixedScale !== "true") {
        scaleSidePane(groupKey, event.deltaY, event.deltaMode);
      }
    };
    chartContainer.addEventListener("wheel", captureSidePaneWheel, { capture: true, passive: false });
    return () => chartContainer.removeEventListener("wheel", captureSidePaneWheel, { capture: true });
  }, [groups.length, height, width]);

  if (!groups.length || width <= 0 || height <= 0) return null;

  const columnWidth = width / groups.length;
  const headerHeight = 25;
  const plotTop = headerHeight;
  const plotBottom = Math.max(plotTop + 20, height - 8);
  const plotHeight = Math.max(20, plotBottom - plotTop);

  return (
    <div
      ref={paneRootRef}
      className="pointer-events-none absolute z-[9] overflow-hidden border border-border bg-[var(--chart-background)]"
      style={{ width, height, ...placementStyle }}
      data-indicator-side-rail="true"
    >
      <svg
        className="absolute inset-0"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-label="Vertical chart indicator panes"
      >
        {groups.map((group, groupIndex) => {
          const collapsed = Boolean(collapsedPanes[group.key]);
          const columnLeft = groupIndex * columnWidth;
          const innerLeft = columnLeft + 6;
          const innerRight = columnLeft + columnWidth - 7;
          const innerWidth = Math.max(12, innerRight - innerLeft);
          const visibleSeries = group.series.map((definition) => ({
            ...definition,
            data: definition.data.filter((point) => {
              const x = timeToX(point.time);
              return x !== null && x >= -10 && x <= globalPlotWidth + 10;
            }),
          }));
          const sharedSeries = visibleSeries.filter((series) => !series.independentScale);
          const domain = scaleDomain(
            seriesDomain(sharedSeries.length ? sharedSeries : visibleSeries),
            scaleByPane[group.key] ?? 1,
          );
          const xForValue = (value: number) =>
            innerLeft + ((value - domain.min) / Math.max(1e-9, domain.max - domain.min)) * innerWidth;
          const yForTime = (time: number) => {
            const x = timeToX(time);
            if (x === null) return null;
            return (x / Math.max(1, globalPlotWidth)) * plotHeight;
          };
          const zeroX = Math.max(innerLeft, Math.min(innerRight, xForValue(0)));
          return (
            <g key={group.key}>
              <rect
                x={columnLeft}
                y="0"
                width={columnWidth}
                height={height}
                fill="var(--chart-background)"
                fillOpacity="0.98"
              />
              {groupIndex > 0 ? (
                <line x1={columnLeft + 0.5} x2={columnLeft + 0.5} y1="0" y2={height} stroke="var(--grid-color)" />
              ) : null}
              <line x1={columnLeft} x2={columnLeft + columnWidth} y1={headerHeight - 0.5} y2={headerHeight - 0.5} stroke="var(--grid-color)" />
              <text x={columnLeft + 7} y="16" fill="var(--foreground)" fontSize="9" fontWeight="600" fontFamily="monospace">
                {group.title}
              </text>
              {!collapsed && group.unavailableReason ? (
                <text x={columnLeft + 7} y={plotTop + 16} fill="var(--muted)" fontSize="8" fontFamily="monospace">
                  Waiting for data
                </text>
              ) : null}
              {!collapsed ? (
                <>
                  <line x1={zeroX} x2={zeroX} y1={plotTop} y2={plotBottom} stroke="var(--grid-color)" strokeDasharray="3 4" opacity="0.72" />
                  {group.series.map((definition) => {
                    const visible = sampledVerticalPanePoints(definition, yForTime, plotHeight)
                      .map((point) => ({ ...point, y: point.y + plotTop }));
                    if (!visible.length) return null;
                    if (definition.kind === "histogram") {
                      // Rotated pane: bars run along price, so the same rule
                      // applies to their height.
                      const barHeight = chartCandleBodyWidth(
                        paneBarSpacing(visible.map((point) => ({ x: point.y }))),
                      );
                      const pathsByColor = new Map<string, string[]>();
                      visible.forEach((point) => {
                        const valueX = xForValue(point.value);
                        const color = point.color ?? definition.color;
                        const commands = pathsByColor.get(color) ?? [];
                        commands.push(
                          `M${Math.min(zeroX, valueX).toFixed(2)},${(point.y - barHeight / 2).toFixed(2)}`
                          + `h${Math.max(1, Math.abs(valueX - zeroX)).toFixed(2)}v${barHeight.toFixed(2)}`
                          + `h-${Math.max(1, Math.abs(valueX - zeroX)).toFixed(2)}Z`,
                        );
                        pathsByColor.set(color, commands);
                      });
                      return (
                        <g key={definition.key}>
                          {[...pathsByColor.entries()].map(([color, commands]) => (
                            <path key={`${definition.key}-${color}`} d={commands.join("")} fill={color} stroke={definition.histogramOutlineWidth ? color : undefined} strokeWidth={definition.histogramOutlineWidth} opacity="0.9" />
                          ))}
                        </g>
                      );
                    }
                    if (definition.kind === "candlestick") {
                      const barHeight = visible.length > 1
                        ? Math.max(2, Math.min(8, Math.abs(visible[1].y - visible[0].y) * 0.62))
                        : 4;
                      return (
                        <g key={definition.key}>
                          {visible.map((point) => {
                            const open = point.open ?? point.value;
                            const close = point.close ?? point.value;
                            const high = point.high ?? Math.max(open, close);
                            const low = point.low ?? Math.min(open, close);
                            const color = point.color ?? definition.color;
                            const openX = xForValue(open);
                            const closeX = xForValue(close);
                            const candleStyle = definition.candleStyle ?? "candlestick";
                            return (
                              <g key={`${definition.key}-${point.time}`}>
                                {candleStyle !== "candle-body" ? <line x1={xForValue(low)} x2={xForValue(high)} y1={point.y} y2={point.y} stroke={color} strokeWidth={definition.lineWidth ?? 1} /> : null}
                                {candleStyle === "wick-only" ? null : (
                                  <rect
                                    x={Math.min(openX, closeX)}
                                    y={point.y - barHeight / 2}
                                    width={Math.max(2, Math.abs(openX - closeX))}
                                    height={barHeight}
                                    fill={color}
                                  />
                                )}
                              </g>
                            );
                          })}
                        </g>
                      );
                    }
                    const path = visible.map((point, index) =>
                      `${index === 0 || point.breakBefore ? "M" : "L"} ${xForValue(point.value)} ${point.y}`,
                    ).join(" ");
                    return (
                      <path
                        key={definition.key}
                        d={path}
                        fill="none"
                        stroke={definition.color}
                        strokeWidth={definition.lineWidth ?? 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  <text x={innerLeft} y={height - 1} fill="var(--muted)" fontSize="7" fontFamily="monospace">{compact(domain.min)}</text>
                  <text x={innerRight} y={height - 1} fill="var(--muted)" fontSize="7" fontFamily="monospace" textAnchor="end">{compact(domain.max)}</text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      {groups.map((group, groupIndex) => {
        const columnLeft = groupIndex * columnWidth;
        return (
          <div key={`vertical-controls-${group.key}`}>
            <div
              data-indicator-pane-wheel-zone={group.key}
              data-indicator-pane-fixed-scale={group.indicatorId === "volume" ? "true" : undefined}
              className="pointer-events-auto absolute cursor-ew-resize"
              style={{ left: columnLeft, top: headerHeight, width: columnWidth, height: plotHeight }}
              title={`Scroll to expand or squeeze ${group.title}`}
              onWheel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (group.indicatorId !== "volume") {
                  scaleSidePane(group.key, event.deltaY, event.deltaMode);
                }
              }}
            />
            {onOpenSettings ? (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onOpenSettings(group.key); }}
                className="pointer-events-auto absolute top-1 flex h-5 w-5 items-center justify-center rounded-[2px] border border-border bg-panel/95 text-muted hover:text-foreground"
                style={{ left: columnLeft + columnWidth - 46 }}
                title={`${group.title} settings`}
              >
                <Settings2 className="h-2.5 w-2.5" />
              </button>
            ) : null}
            <button
              type="button"
              onPointerDown={(event) => onPaneHandlePointerDown(group.key, event)}
              onClick={(event) => { event.stopPropagation(); onTogglePane(group.key); }}
              className="pointer-events-auto absolute top-1 flex h-5 w-5 cursor-grab items-center justify-center rounded-[2px] border border-border bg-panel/95 text-muted hover:text-foreground active:cursor-grabbing"
              style={{ left: columnLeft + columnWidth - 23 }}
              title={`Click to minimize · drag to move ${group.title}`}
            >
              {collapsedPanes[group.key] ? <Plus className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ChartIndicatorPanes({
  groups,
  width,
  leftInset = 0,
  priceScaleWidth,
  height,
  chartHeight,
  bottom,
  viewportVersion,
  paneHeights,
  collapsedPanes,
  paneLayout,
  timeToX,
  onResizePane,
  onTogglePane,
  onMovePane,
  onUpdateSetting,
  onOpenSettings,
}: {
  groups: IndicatorPaneGroup[];
  width: number;
  leftInset?: number;
  priceScaleWidth: number;
  height: number;
  chartHeight: number;
  bottom: number;
  viewportVersion: number;
  paneHeights: Record<string, number>;
  collapsedPanes: Record<string, boolean>;
  paneLayout: IndicatorPaneLayoutMap;
  timeToX: (time: number) => number | null;
  onResizePane: (instanceId: string, height: number) => void;
  onTogglePane: (instanceId: string) => void;
  onMovePane: (instanceId: string, dock: IndicatorPaneDock, targetIndex: number) => void;
  onUpdateSetting?: (instanceId: string, key: string, value: number | string | boolean) => void;
  onOpenSettings?: (instanceId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const suppressToggleRef = useRef<string | null>(null);
  const [drag, setDrag] = useState<{
    key: string;
    dock: IndicatorPaneDock;
    targetIndex: number;
    x: number;
    y: number;
  } | null>(null);
  const groupsByDock = useMemo(() => {
    const result: Record<IndicatorPaneDock, IndicatorPaneGroup[]> = {
      top: [],
      bottom: [],
      left: [],
      right: [],
    };
    groups.forEach((group, sourceIndex) => {
      const placement = paneLayout[group.key] ?? { dock: "bottom" as const, order: sourceIndex };
      result[placement.dock].push(group);
    });
    (Object.keys(result) as IndicatorPaneDock[]).forEach((dock) => {
      result[dock].sort((left, right) =>
        (paneLayout[left.key]?.order ?? groups.indexOf(left))
        - (paneLayout[right.key]?.order ?? groups.indexOf(right)));
    });
    return result;
  }, [groups, paneLayout]);

  const surfaceHeight = (surfaceGroups: IndicatorPaneGroup[]) => surfaceGroups.reduce(
    (total, group) => total + (collapsedPanes[group.key] ? 30 : paneHeights[group.key] ?? 88),
    0,
  );
  const topHeight = surfaceHeight(groupsByDock.top);
  const bottomHeight = surfaceHeight(groupsByDock.bottom) || height;
  const availableSideHeight = Math.max(80, chartHeight - topHeight - bottomHeight - bottom - 4);
  const leftHeight = groupsByDock.left.length ? availableSideHeight : 0;
  const rightHeight = groupsByDock.right.length ? availableSideHeight : 0;
  const sideWidthFor = (count: number) => Math.min(
    Math.max(150, width - priceScaleWidth - 80),
    Math.max(150, Math.min(width * 0.42, count * 180)),
  );
  const boundedLeftInset = Math.max(0, Math.min(leftInset, Math.max(0, width - priceScaleWidth - 1)));
  const horizontalPaneWidth = Math.max(1, width - boundedLeftInset);

  const guardedToggle = (key: string) => {
    if (suppressToggleRef.current === key) {
      suppressToggleRef.current = null;
      return;
    }
    onTogglePane(key);
  };

  const targetIndexFor = (dock: IndicatorPaneDock, clientX: number, clientY: number, movingKey: string) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return groupsByDock[dock].length;
    const dockGroups = groupsByDock[dock].filter((group) => group.key !== movingKey);
    const count = dockGroups.length;
    if (!count) return 0;
    const startY = dock === "bottom"
      ? rect.height - bottom - bottomHeight
      : dock === "top"
        ? 0
        : topHeight;
    const dockHeight = dock === "bottom"
      ? bottomHeight
      : dock === "top"
        ? topHeight
        : dock === "left"
          ? leftHeight
          : rightHeight;
    const localY = Math.max(0, Math.min(dockHeight, clientY - rect.top - startY));
    return Math.max(0, Math.min(count, Math.floor((localY / Math.max(1, dockHeight)) * (count + 1))));
  };

  const dockForPoint = (clientX: number, clientY: number, currentDock: IndicatorPaneDock) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return currentDock;
    const x = (clientX - rect.left) / Math.max(1, rect.width);
    const y = (clientY - rect.top) / Math.max(1, rect.height);
    if (y <= 0.22) return "top" as const;
    if (x <= 0.18) return "left" as const;
    if (x >= 0.82) return "right" as const;
    if (y >= 0.66) return "bottom" as const;
    return currentDock;
  };

  const beginPaneDrag = (key: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const originClientX = event.clientX;
    const originClientY = event.clientY;
    const currentDock = paneLayout[key]?.dock ?? "bottom";
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const distance = Math.hypot(moveEvent.clientX - originClientX, moveEvent.clientY - originClientY);
      if (!moved && distance < 5) return;
      moved = true;
      suppressToggleRef.current = key;
      const dock = dockForPoint(moveEvent.clientX, moveEvent.clientY, currentDock);
      setDrag({
        key,
        dock,
        targetIndex: targetIndexFor(dock, moveEvent.clientX, moveEvent.clientY, key),
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
    };
    const finish = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (moved) {
        const dock = dockForPoint(upEvent.clientX, upEvent.clientY, currentDock);
        onMovePane(key, dock, targetIndexFor(dock, upEvent.clientX, upEvent.clientY, key));
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const renderSurface = (
    dock: IndicatorPaneDock,
    surfaceGroups: IndicatorPaneGroup[],
    surfaceWidth: number,
    surfacePaneHeight: number,
    placementStyle: CSSProperties,
  ) => {
    if (!surfaceGroups.length || surfacePaneHeight <= 0) return null;
    const localValueScaleWidth = Math.min(priceScaleWidth, Math.max(44, surfaceWidth * 0.24));
    const surfaceTimeToX = (time: number) => {
      const globalX = timeToX(time);
      // Top and bottom panes share the native chart's horizontal coordinates.
      // Their DOM surface begins at the drawing rail's right edge, so translate
      // the coordinate into that local surface instead of stretching the tape.
      return globalX === null ? null : globalX - boundedLeftInset;
    };
    return <ChartIndicatorPaneSurface
      key={dock}
      groups={surfaceGroups}
      width={surfaceWidth}
      priceScaleWidth={localValueScaleWidth}
      height={surfacePaneHeight}
      viewportVersion={viewportVersion}
      paneHeights={paneHeights}
      collapsedPanes={collapsedPanes}
      timeToX={surfaceTimeToX}
      onResizePane={onResizePane}
      onTogglePane={guardedToggle}
      onUpdateSetting={onUpdateSetting}
      onOpenSettings={onOpenSettings}
      placementStyle={placementStyle}
      onPaneHandlePointerDown={beginPaneDrag}
    />;
  };

  const renderSideSurface = (
    dock: "left" | "right",
    surfaceGroups: IndicatorPaneGroup[],
    surfaceHeight: number,
    placementStyle: CSSProperties,
  ) => {
    if (!surfaceGroups.length || surfaceHeight <= 0) return null;
    return (
      <ChartVerticalIndicatorPaneSurface
        key={dock}
        groups={surfaceGroups}
        width={sideWidthFor(surfaceGroups.length)}
        height={surfaceHeight}
        globalPlotWidth={Math.max(1, width - priceScaleWidth)}
        viewportVersion={viewportVersion}
        collapsedPanes={collapsedPanes}
        timeToX={timeToX}
        onTogglePane={guardedToggle}
        onOpenSettings={onOpenSettings}
        placementStyle={placementStyle}
        onPaneHandlePointerDown={beginPaneDrag}
      />
    );
  };

  if (!groups.length || width <= 0 || chartHeight <= 0) return null;

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[9] overflow-hidden" data-testid="indicator-pane-dock-root">
      {renderSurface("top", groupsByDock.top, horizontalPaneWidth, topHeight, { left: boundedLeftInset, top: 0 })}
      {renderSurface("bottom", groupsByDock.bottom, horizontalPaneWidth, bottomHeight, { left: boundedLeftInset, bottom })}
      {renderSideSurface("left", groupsByDock.left, leftHeight, { left: boundedLeftInset, top: topHeight })}
      {renderSideSurface("right", groupsByDock.right, rightHeight, { right: priceScaleWidth, top: topHeight })}
      {drag ? (
        <div className="pointer-events-none absolute inset-0 z-[120] bg-background/10" aria-label="Indicator docking targets">
          {([
            ["top", "TOP", "left-[22%] right-[22%] top-2 h-[20%]"],
            ["bottom", "BOTTOM", "bottom-7 left-[22%] right-[22%] h-[22%]"],
            ["left", "LEFT", "bottom-[24%] left-2 top-[24%] w-[17%]"],
            ["right", "RIGHT", "bottom-[24%] right-2 top-[24%] w-[17%]"],
          ] as const).map(([dock, label, position]) => (
            <div
              key={dock}
              className={`absolute ${position} flex items-center justify-center rounded-md border text-[8px] font-semibold tracking-[0.16em] transition ${drag.dock === dock ? "border-primary bg-primary/15 text-primary" : "border-border bg-panel/65 text-muted"}`}
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default memo(ChartIndicatorPanes);

export type { IndicatorPaneDock, IndicatorPaneGroup, IndicatorPaneLayoutMap, IndicatorPanePlacement };
