"use client";
import { useEffect, useRef } from "react";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { IChartApi } from "@/lib/lightweightChartsCompat";
import type { ChartSettings } from "@/lib/chartSettings";
import { BigOptionsTape, normalizeBigOptionsSettings } from "@/lib/bigBlocksOptions";
import { BigBlocksOptionsPrimitive } from "@/lib/bigBlocksOptionsPrimitive";
import { bigOptionsFeed } from "@/lib/bigBlocksOptionsFeed";

export function useBigBlocksOptions(args: {
  seriesRef: { current: ReturnType<IChartApi["addCandlestickSeries"]> | null };
  revision: number; instrument: string; replayTimestampMs: number | null;
  indicators: readonly ChartIndicatorInstance[]; theme: ChartSettings;
}) {
  const instances = args.indicators.filter(instance => instance.enabled && instance.indicatorId === "big-blocks-options");
  const signature = JSON.stringify(instances);
  const latest = useRef({ instances, theme: args.theme });
  latest.current = { instances, theme: args.theme };
  const redraw = useRef<(() => void) | null>(null);
  // Chart primitives are recreated on theme/precision changes. The observed
  // execution ledger must not reset to the latest100 prints along with them.
  const ledger = useRef({ symbol: "", tape: new BigOptionsTape() });
  const enabled = instances.length > 0;
  useEffect(() => {
    const series = args.seriesRef.current;
    if (!enabled || !series) return;
    const primitive = new BigBlocksOptionsPrimitive();
    // One visual instance per enabled study; each retains independent settings.
    const primitives = new Map<string, BigBlocksOptionsPrimitive>();
    const symbol = args.instrument.trim().toUpperCase();
    if (ledger.current.symbol !== symbol) ledger.current = { symbol, tape: new BigOptionsTape() };
    const tape = ledger.current.tape;
    let status = "Loading observed executions", clock = Date.now(), active = true;
    const paint = () => {
      if (!active) return;
      const ids = new Set(latest.current.instances.map(instance => instance.instanceId));
      for (const [id, item] of primitives) if (!ids.has(id)) { series.detachPrimitive(item); primitives.delete(id); }
      for (const instance of latest.current.instances) {
        let item = primitives.get(instance.instanceId);
        if (!item) { item = primitives.size ? new BigBlocksOptionsPrimitive() : primitive; primitives.set(instance.instanceId, item); series.attachPrimitive(item); }
        const settings = normalizeBigOptionsSettings(instance.settings);
        const theme = latest.current.theme;
        item.update({ levels: args.replayTimestampMs !== null ? [] : tape.levels(symbol, settings, clock), settings,
          callColor: settings.useThemeColors ? theme.upColor : settings.callColor,
          putColor: settings.useThemeColors ? theme.downColor : settings.putColor,
          textColor: window.getComputedStyle(document.body).color, fontFamily: "'Aleph', sans-serif",
          status: `${status}${tape.truncated ? " · 5K retention limit" : ""}` });
      }
    };
    redraw.current = paint;
    let release: (() => void) | undefined;
    // No unverified ETF->futures mapping or live data painted during replay.
    if (args.replayTimestampMs !== null) status = "Unavailable in replay";
    else if (!/^[A-Z][A-Z.\-]{0,11}$/.test(symbol) || /^(ES|MES|NQ|MNQ|RTY|M2K|YM|MYM|CL|GC|SI|ZN|ZB|6E)$/.test(symbol)) status = "Options underlying chart required";
    else release = bigOptionsFeed.subscribe(symbol, (payload, error) => {
      if (!active) return;
      if (payload) {
        clock = Date.parse(payload.asOf);
        tape.update(payload.sessionDate, payload.rows);
      }
      status = error ? payload ? "Refresh delayed · last observed flow" : "Options flow unavailable" : payload
        ? `${payload.stale ? "STALE" : payload.status.replaceAll("_", " ")} · observed tape · latest 100 per refresh`
        : "Options flow unavailable";
      paint();
    });
    paint();
    return () => {
      active = false; release?.(); redraw.current = null;
      for (const item of primitives.values()) { try { series.detachPrimitive(item); } catch { /* Chart already disposed. */ } }
    };
  }, [enabled, args.instrument, args.replayTimestampMs, args.revision, args.seriesRef]);
  useEffect(() => { redraw.current?.(); }, [signature, args.theme]);
}
