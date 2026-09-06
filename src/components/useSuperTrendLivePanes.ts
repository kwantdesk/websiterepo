"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";
import { SUPER_TREND_LIVE_PLOT_EVENT, SuperTrendPlotBuffer, type SuperTrendLivePlotDetail } from "@/lib/superTrendLivePlot";

type Group = { key: string; indicatorId: string; series: CalculatedIndicatorSeries[] };

/** Local pane-only rerender, never the Chart calculation/footprint/profile tree. */
export function useSuperTrendLivePanes<T extends Group>(groups: T[], chartKey?: string): T[] {
  const buffers = useRef(new Map<string, SuperTrendPlotBuffer>());
  const activeChart = useRef<string | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  const ids = groups.filter(g => g.indicatorId === "super-trend-difference" || g.indicatorId === "super-trend").map(g => g.key).join("\u0000");
  useEffect(() => {
    const activeBuffers = buffers.current;
    activeChart.current = chartKey;
    activeBuffers.clear();
    if (!chartKey || !ids) return;
    const accepted = new Set(ids.split("\u0000"));
    let frame: number | null = null;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<SuperTrendLivePlotDetail>).detail;
      if (!detail || detail.chartKey !== chartKey || !accepted.has(detail.instanceId)) return;
      if (detail.reset) activeBuffers.delete(detail.instanceId);
      else if (detail.series) {
        let buffer = activeBuffers.get(detail.instanceId);
        if (!buffer) { buffer = new SuperTrendPlotBuffer(); activeBuffers.set(detail.instanceId, buffer); }
        buffer.push(detail.series);
      } else return;
      if (frame === null) frame = requestAnimationFrame(() => { frame = null; setRevision(v => v + 1); });
    };
    window.addEventListener(SUPER_TREND_LIVE_PLOT_EVENT, receive);
    return () => { window.removeEventListener(SUPER_TREND_LIVE_PLOT_EVENT, receive); if (frame !== null) cancelAnimationFrame(frame); activeBuffers.clear(); };
  }, [chartKey, ids]);
  return useMemo(() => { void revision;
    if (!chartKey || activeChart.current !== chartKey) return groups;
    return groups.map(group => {
    const buffer = buffers.current.get(group.key);
    return buffer ? { ...group, series: group.series.map(series => buffer.merge(series)) } : group;
  }); }, [groups, revision, chartKey]);
}
