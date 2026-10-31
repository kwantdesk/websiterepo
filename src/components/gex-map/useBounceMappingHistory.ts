"use client";
import { useEffect, useRef, useState } from "react";
import { fetchWorkspaceData } from "@/lib/workspaceDataCache";
import { newYorkSessionTimestamp } from "@/lib/gexVueReplay";

type PricePoint = { timestamp: number; open: number };
const EMPTY_POINTS: PricePoint[] = [];
type MappingState = { key: string; points: PricePoint[]; epoch: number };
/** Paired futures prices must not depend on whether the host chart is 1m or 1h. */
export function useBounceMappingHistory(input: {
  enabled: boolean; instrument: string; sessionDate: string; latestFrame: number; historical: boolean;
}) {
  const key = "bounce-map-1m-price:" + input.instrument + ":" + input.sessionDate;
  const [state, setState] = useState<MappingState>({ key: "", points: [], epoch: 0 });
  const current = useRef(state); current.current = state;
  useEffect(() => {
    if (!input.enabled || !/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)) return;
    let cancelled = false, retry: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") { retry = setTimeout(load, 60_000); return; }
      const from = newYorkSessionTimestamp(input.sessionDate, 8 * 60), to = newYorkSessionTimestamp(input.sessionDate, 17 * 60);
      const query = new URLSearchParams({ symbol: input.instrument, timeframe: "1m", days: "1", from: String(from), to: String(to) });
      try {
        const response = await fetchWorkspaceData<{ candles: PricePoint[] }>(key, "/api/cme-history?" + query, {
          maxAgeMs: input.historical ? 6 * 60 * 60_000 : 45_000, timeoutMs: 45_000,
          validate: (p) => Boolean(p && typeof p === "object" && Array.isArray((p as { candles?: unknown }).candles)),
        });
        if (cancelled) return;
        const prior = current.current.key === key ? current.current : { key, points: [], epoch: 0 };
        const merged = new Map(prior.points.map((p) => [p.timestamp, p]));
        const oldThrough = prior.points.at(-1)?.timestamp ?? -Infinity;
        let revised = false;
        for (const row of response.candles) {
          const rawTime = Number(row.timestamp), timestamp = rawTime < 1e12 ? rawTime * 1000 : rawTime, open = Number(row.open);
          if (!Number.isFinite(timestamp) || !Number.isFinite(open) || open <= 0 || timestamp < from || timestamp > to) continue;
          const old = merged.get(timestamp);
          if ((old && old.open !== open) || (!old && timestamp <= oldThrough)) revised = true;
          merged.set(timestamp, { timestamp, open });
        }
        const next = { key, points: [...merged.values()].sort((a, b) => a.timestamp - b.timestamp), epoch: prior.epoch + Number(revised) };
        current.current = next; setState(next);
      } catch { if (!cancelled) retry = setTimeout(load, 60_000); }
    };
    void load();
    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [input.enabled, input.instrument, input.sessionDate, input.latestFrame, input.historical, key]);
  const scoped = state.key === key ? state : null;
  return { key: key + ":" + (scoped?.epoch ?? 0), points: scoped?.points ?? EMPTY_POINTS, through: (scoped?.points.at(-1)?.timestamp ?? -Infinity) + 59_999 };
}
