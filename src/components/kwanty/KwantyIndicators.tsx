"use client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import ChartIndicatorsControl from "@/components/ChartIndicatorsControl";
import ChartIndicatorPanes from "@/components/ChartIndicatorPanes";
import { loadStoredChartSettings } from "@/lib/chartSettings";
import { calculateKwantyStudies, kwantyIndicatorReason } from "@/lib/kwantyIndicatorAdapter";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { StateDrawingApi, StateDrawingFrame } from "@/lib/kwantyStateDrawingAdapter";

export default function KwantyIndicators({ element, api, getFrame, subscribe }: {
  element: HTMLElement; api: StateDrawingApi; getFrame: () => StateDrawingFrame;
  subscribe: (listener: () => void) => () => void;
}) {
  const [, redraw] = useState(0), [request, setRequest] = useState(0);
  const frame = getFrame();
  const [instances, setInstances] = useState<ChartIndicatorInstance[]>(() => api.readIndicators?.(frame.ticker) ?? []);
  const [heights, setHeights] = useState<Record<string, number>>({}), [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [layout, setLayout] = useState<Record<string, { dock: "top" | "bottom" | "left" | "right"; order: number }>>({});
  const [settingsRequest, setSettingsRequest] = useState<{ instanceId: string; requestId: number } | null>(null);
  useEffect(() => subscribe(() => redraw(value => value + 1)), [subscribe]);
  useEffect(() => { const open = () => setRequest(value => value + 1); element.addEventListener("kwanty-open-indicators", open); return () => element.removeEventListener("kwanty-open-indicators", open); }, [element]);
  const settings = useMemo(() => ({ ...loadStoredChartSettings(), upColor: frame.bullish, downColor: frame.bearish }), [frame.bullish, frame.bearish]);
  const candles = useMemo(() => frame.candles.map(candle => ({ timestamp: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close, ...(typeof candle.volume === "number" ? { volume: candle.volume } : {}) })), [frame.candles]);
  // Inputs already contain only revealed authoritative candles. Round the replay
  // cutoff down to the last complete minute; no future offset plot can sneak in.
  const cutoff = frame.replayTimestampMs == null ? null : Math.floor(frame.replayTimestampMs / 60000) * 60000;
  const studies = useMemo(() => calculateKwantyStudies(instances, candles, { primary: settings.upColor, secondary: settings.wickUpColor, positive: frame.bullish, negative: frame.bearish, muted: settings.borderDownColor }, frame.ticker, cutoff), [instances, candles, settings.upColor, settings.wickUpColor, settings.borderDownColor, frame.bullish, frame.bearish, frame.ticker, cutoff]);
  const change = (next: ChartIndicatorInstance[]) => { setInstances(next); api.writeIndicators?.(next, frame.ticker); };
  const groups = studies.filter(study => study.reason || study.series.some(series => series.placement === "pane")).map(study => ({ key: study.instance.instanceId, title: study.title, indicatorId: study.instance.indicatorId, settings: study.instance.settings, series: study.series.filter(series => series.placement === "pane"), ...(study.reason ? { unavailableReason: study.reason } : {}) }));
  const paneHeight = Math.min(300, groups.reduce((total, group) => total + (collapsed[group.key] ? 30 : heights[group.key] ?? 88), 0));
  useEffect(() => { api.reserveIndicatorHeight?.(paneHeight); }, [api, paneHeight]);
  useEffect(() => () => api.reserveIndicatorHeight?.(0), [api]);
  const g = frame.geometry, clipId = `kwanty-study-${frame.panelId ?? frame.ticker}`.replace(/[^a-zA-Z0-9_-]/g, "");
  const timeToX = (time: number) => getFrame().geometry?.timeX(time * 1000) ?? null;
  const openSettings = (instanceId: string) => setSettingsRequest({ instanceId, requestId: Date.now() });
  const anchor = element.ownerDocument.querySelector<HTMLElement>('.workspace-header-actions [aria-label="Chart indicators"]');
  return <>
    <div style={{ display: "none" }}><ChartIndicatorsControl chartInstanceId={frame.panelId} instrument={frame.ticker} timeframe={`${frame.interval / 60000}m`} indicators={instances} chartSettings={settings} onChange={change} openRequest={request} externalAnchor={anchor} unavailableReason={id => kwantyIndicatorReason(id, candles)} settingsOpenRequest={settingsRequest} candlesVisible={frame.candlesVisible !== false} onToggleCandles={visible => api.setPriceVisible?.(visible)} /></div>
    {g && <svg style={{ position: "absolute", inset: "0 0 0 36px", pointerEvents: "none", overflow: "hidden" }} width={frame.width} height={frame.height} aria-label="Chart indicator overlays">
      <defs><clipPath id={clipId}><rect x={g.left} y={g.top} width={g.right - g.left} height={g.bottom - g.top} /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>{studies.flatMap(study => study.series.filter(series => series.placement === "overlay").map(series => {
        let path = "", active = false, previousY = 0;
        for (const point of series.data) {
          const x = g.timeX(point.time * 1000), y = g.priceY(point.value * frame.multiplier + frame.offset);
          if (!Number.isFinite(x) || !Number.isFinite(y)) { active = false; continue; }
          path += active && !point.breakBefore ? series.lineType === "with-steps" ? `L${x},${previousY}L${x},${y}` : `L${x},${y}` : `M${x},${y}`; active = true; previousY = y;
        }
        return <g key={study.instance.instanceId + series.key}>{series.lineVisible !== false && <path d={path} fill="none" stroke={series.color} strokeWidth={series.lineWidth ?? 1} strokeDasharray={series.lineStyle === "dashed" ? "6 4" : series.lineStyle === "dotted" ? "2 3" : undefined} />}{series.pointMarkersVisible && series.data.filter(point => Number.isFinite(point.value)).map(point => <circle key={point.time} cx={g.timeX(point.time * 1000)} cy={g.priceY(point.value * frame.multiplier + frame.offset)} r={2} fill={point.color ?? series.color} />)}</g>;
      }))}</g>
    </svg>}
    {frame.indicatorPaneHost && paneHeight > 0 && createPortal(<ChartIndicatorPanes groups={groups} coordinateScope={`${frame.panelId}:${frame.ticker}:${frame.interval}:${cutoff == null ? "live" : new Date(cutoff).toISOString().slice(0, 10)}`} width={frame.width} priceScaleWidth={frame.width - (g?.right ?? frame.width - 60)} height={paneHeight} chartHeight={paneHeight} bottom={0} viewportVersion={request + (g?.startTime ?? 0) + (g?.endTime ?? 0)} paneHeights={heights} collapsedPanes={collapsed} paneLayout={layout} timeToX={timeToX} onResizePane={(id, height) => setHeights(current => ({ ...current, [id]: Math.max(40, Math.min(200, height)) }))} onTogglePane={id => setCollapsed(current => ({ ...current, [id]: !current[id] }))} onMovePane={(id, dock, order) => setLayout(current => ({ ...current, [id]: { dock, order } }))} onOpenSettings={openSettings} onUpdateSetting={(id, key, value) => change(instances.map(instance => instance.instanceId === id ? { ...instance, settings: { ...instance.settings, [key]: value } } : instance))} />, frame.indicatorPaneHost)}
  </>;
}
