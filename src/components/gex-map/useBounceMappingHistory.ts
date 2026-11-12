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
  const latestFrame = useRef(input.latestFrame); latestFrame.current = input.latestFrame;
  useEffect(() => {
    if (!input.enabled || !/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)) return;
    let cancelled = false, retry: ReturnType<typeof setTimeout> | null = null;
    let coveredMinute = -Infinity;
    const sessionEnd = newYorkSessionTimestamp(input.sessionDate, 17 * 60);
    const load = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") { retry = setTimeout(load, 60_000); return; }
      const from = newYorkSessionTimestamp(input.sessionDate, 8 * 60);
      // The owned-history API rejects future range ends. During the session,
      // asking through 17:00 ET left futures mapping permanently empty.
      const to = Math.min(Date.now(), sessionEnd);
      if (to <= from) return;
      const frameMinute = Math.floor(latestFrame.current / 60_000);
      if (!input.historical && frameMinute <= coveredMinute) {
        if (to < sessionEnd) retry = setTimeout(load, 5_000);
        return;
      }
      const query = new URLSearchParams({ symbol: input.instrument, timeframe: "1m", days: "1", from: String(from), to: String(to) });
      try {
        const response = await fetchWorkspaceData<{ candles: PricePoint[] }>(key, "/api/cme-history?" + query, {
          maxAgeMs: input.historical ? 6 * 60 * 60_000 : 12_000, timeoutMs: 45_000,
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
        if (prior.key !== current.current.key || revised || next.points.length !== prior.points.length) {
          current.current = next;
          setState(next);
        }
        if (!input.historical && to < sessionEnd) {
          const through = (next.points.at(-1)?.timestamp ?? -Infinity) + 59_999;
          coveredMinute = Math.floor(through / 60_000);
          // Let an in-flight read finish even if exposure advances. Retry
          // missing minutes at the shared history cache cadence.
          retry = setTimeout(load, through < latestFrame.current ? 12_000 : 5_000);
        }
      } catch { if (!cancelled) retry = setTimeout(load, 60_000); }
    };
    void load();
    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [input.enabled, input.instrument, input.sessionDate, input.historical, key]);
  const scoped = state.key === key ? state : null;
  return { key: key + ":" + (scoped?.epoch ?? 0), points: scoped?.points ?? EMPTY_POINTS, through: (scoped?.points.at(-1)?.timestamp ?? -Infinity) + 59_999 };
}
