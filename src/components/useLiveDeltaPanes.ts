"use client";
import { useEffect, useRef, useState } from "react";
import { LIVE_CHART_CANDLE_EVENT, LIVE_CHART_EXECUTION_EVENT, type LiveChartCandleDetail, type LiveChartExecutionDetail } from "@/lib/chartLiveEvents";
import { deltaPaneIdentity, isLiveDeltaPane, LIVE_DELTA_PANE_INTERVAL_MS, LiveDeltaPaneModel, type LiveDeltaGroup, type LiveDeltaInputs } from "@/lib/liveDeltaPanes";

/** Only the lower panes rerender. Busy profile/footprint transitions in Chart
 * cannot defer an execution update for multiple bars. No extra network calls. */
export function useLiveDeltaPanes<T extends LiveDeltaGroup>(groups: T[], scope: string, chartKey?: string, inputs?: LiveDeltaInputs, mode: "delta" | "volume" = "delta"): T[] {
  const accepts = (id: string) => mode === "volume" ? id === "volume" : isLiveDeltaPane(id);
  const state = useRef({ scope, model: new LiveDeltaPaneModel() });
  if (state.current.scope !== scope) state.current = { scope, model: new LiveDeltaPaneModel() };
  const current = useRef({ groups, inputs });
  current.current = { groups, inputs };
  const [paint, setPaint] = useState<{ scope: string; key: string; values: Map<string, { identity: string; series: T["series"] }> } | null>(null);
  const ids = groups.filter(group => accepts(group.indicatorId)).map(group => group.key).join("\0");
  const hydrate = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!chartKey || !inputs || !ids) return;
    const model = state.current.model;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frame: number | null = null;
    const schedule = () => {
      if (timer !== null || frame !== null) return;
      const paintNow = () => {
        timer = null;
        frame = null;
        const latest = current.current;
        if (!latest.inputs) return;
        model.hydrate(latest.inputs.candles);
        const values = new Map(latest.groups.filter(group => accepts(group.indicatorId)).map(group => [group.key,
          { identity: deltaPaneIdentity(group), series: model.calculate(group, latest.inputs!) }]));
        // Deliberately urgent and local: never startTransition through Chart.
        setPaint({ scope, key: chartKey, values });
      };
      // Volume follows the price paint frame, without recomputing CVD or other
      // studies at frame rate and without opening another feed subscription.
      if (mode === "volume") frame = requestAnimationFrame(paintNow);
      else timer = setTimeout(paintNow, LIVE_DELTA_PANE_INTERVAL_MS);
    };
    hydrate.current = schedule;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<LiveChartCandleDetail>).detail;
      if (!detail || detail.key !== chartKey) return;
      const latest = current.current.inputs;
      if (!latest) return;
      model.hydrate(latest.candles);
      model.observe(detail.candle);
      schedule();
    };
    const receiveExecutions = (event: Event) => {
      const detail = (event as CustomEvent<LiveChartExecutionDetail>).detail;
      if (!detail || detail.key !== chartKey || !detail.candles?.length) return;
      // Use canonical execution-backed bars, independently of price-paint
      // coalescing. Do not reconstruct delta from price or add the tape twice.
      const latest = current.current.inputs;
      if (!latest) return;
      model.hydrate(latest.candles);
      model.observeSnapshot(detail.candles);
      schedule();
    };
    window.addEventListener(LIVE_CHART_CANDLE_EVENT, receive);
    window.addEventListener(LIVE_CHART_EXECUTION_EVENT, receiveExecutions);
    schedule();
    return () => {
      window.removeEventListener(LIVE_CHART_CANDLE_EVENT, receive);
      window.removeEventListener(LIVE_CHART_EXECUTION_EVENT, receiveExecutions);
      if (timer !== null) clearTimeout(timer);
      if (frame !== null) cancelAnimationFrame(frame);
      hydrate.current = null;
    };
  // Inputs are read through current: normal parent renders cannot postpone the timer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey, scope, ids, mode]);
  const configuration = JSON.stringify(groups.filter(group => accepts(group.indicatorId)).map(group => [group.key, deltaPaneIdentity(group)]));
  const theme = JSON.stringify(inputs?.theme);
  useEffect(() => { hydrate.current?.(); }, [inputs?.candles, configuration, theme]);
  if (!chartKey || !inputs || paint?.scope !== scope || paint.key !== chartKey) return groups;
  return groups.map(group => {
    const live = paint.values.get(group.key);
    if (!live || live.identity !== deltaPaneIdentity(group) || !live.series.length || (mode !== "volume" && !live.series.some(series => series.data.length))) return group;
    return { ...group, series: live.series, unavailableReason: undefined, statusLabel: undefined };
  });
}
