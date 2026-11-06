"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import {
  ECONOMIC_CALENDAR_TIME_ZONE_CHANGE_EVENT,
  ECONOMIC_CALENDAR_TIME_ZONE_KEY,
  type EconomicCalendarEvent,
} from "@/lib/economicCalendar";
import {
  CHART_SETTINGS_CHANGE_EVENT,
  CHART_SETTINGS_STORAGE_KEY,
  chartSettingsFromChangeEvent,
  defaultChartSettings,
} from "@/lib/chartSettings";
import { GEX_DATA_TIME_ZONE_CHANGE_EVENT, normalizeTimeZone } from "@/lib/timeZones";
import { PREFERENCES_HYDRATED_EVENT } from "@/lib/userPreferences";

const REFRESH_MS = 5 * 60_000;
const HOUR_MS = 60 * 60_000;
const CRITICAL_WINDOW_MS = 10 * 60_000;

type NewsEvent = Pick<EconomicCalendarEvent, "name" | "currency" | "status"> & {
  key: string;
  timeMs: number;
};

function highImpactEvents(rows: unknown[]): NewsEvent[] {
  const events = new Map<string, NewsEvent>();
  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const row = value as Partial<EconomicCalendarEvent>;
    if (row.impact !== "High" || typeof row.name !== "string" || typeof row.currency !== "string" || typeof row.date !== "string") continue;
    const timeMs = Date.parse(row.date);
    if (!Number.isFinite(timeMs)) continue;
    // Keep the notification minimized even if a refresh switches calendar providers.
    const key = JSON.stringify([row.currency, row.name, timeMs]);
    events.set(key, { key, name: row.name, currency: row.currency, timeMs, status: row.status === "released" ? "released" : "scheduled" });
  }
  return [...events.values()].sort((a, b) => a.timeMs - b.timeMs);
}

function formatCountdown(deltaMs: number) {
  const totalSeconds = Math.ceil(deltaMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes === 60) return "In 1h";
  if (minutes >= 10) return `In ${minutes}m`;
  return `In ${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function HighImpactNewsChip({ path }: { path: string }) {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timeZone, setTimeZone] = useState(defaultChartSettings.timezone);
  const [minimized, setMinimized] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const sync = (event?: Event) => {
      const chartTimeZone = chartSettingsFromChangeEvent(event?.type === CHART_SETTINGS_CHANGE_EVENT ? event : undefined).timezone;
      let selected = chartTimeZone;
      if (path === "/news") {
        const detail = event?.type === ECONOMIC_CALENDAR_TIME_ZONE_CHANGE_EVENT ? (event as CustomEvent<string>).detail : undefined;
        try { selected = detail || localStorage.getItem(ECONOMIC_CALENDAR_TIME_ZONE_KEY) || chartTimeZone; } catch { selected = detail || chartTimeZone; }
      } else if (path === "/gex-data") {
        selected = window.__kwantGexDataHost?.read("gex-data-timezone") || chartTimeZone;
      }
      setTimeZone(normalizeTimeZone(selected));
    };
    const storage = (event: StorageEvent) => {
      if (event.key === CHART_SETTINGS_STORAGE_KEY || event.key === ECONOMIC_CALENDAR_TIME_ZONE_KEY || event.key === null) sync();
    };
    sync();
    window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, sync);
    window.addEventListener(GEX_DATA_TIME_ZONE_CHANGE_EVENT, sync);
    window.addEventListener(PREFERENCES_HYDRATED_EVENT, sync);
    window.addEventListener(ECONOMIC_CALENDAR_TIME_ZONE_CHANGE_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(CHART_SETTINGS_CHANGE_EVENT, sync);
      window.removeEventListener(GEX_DATA_TIME_ZONE_CHANGE_EVENT, sync);
      window.removeEventListener(PREFERENCES_HYDRATED_EVENT, sync);
      window.removeEventListener(ECONOMIC_CALENDAR_TIME_ZONE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, [path]);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    let lastRequestMs = -Infinity;
    const refresh = async () => {
      if (document.hidden || pending || Date.now() - lastRequestMs < REFRESH_MS) return;
      pending = true;
      lastRequestMs = Date.now();
      try {
        // Include both sides of midnight so recent releases and the next
        // warning window remain covered even when the UTC date changes.
        const from = new Date(lastRequestMs - HOUR_MS).toISOString().slice(0, 10);
        const to = new Date(lastRequestMs + 24 * HOUR_MS).toISOString().slice(0, 10);
        const response = await fetch(`/api/economic-calendar?from=${from}&to=${to}`, { signal: controller.signal });
        if (!response.ok) return;
        const { events: rows } = await response.json() as { events?: unknown[] };
        if (!Array.isArray(rows) || controller.signal.aborted) return;
        setEvents(highImpactEvents(rows));
        setNowMs(Date.now());
      } catch {
        // Retain the previous calendar through a transient failure.
      } finally {
        pending = false;
      }
    };
    const resume = () => {
      if (document.hidden) return;
      setNowMs(Date.now());
      void refresh();
    };
    resume();
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", resume);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  const active = events.filter(({ timeMs }) => nowMs >= timeMs - HOUR_MS && nowMs < timeMs + HOUR_MS);
  const collapsed = active.length > 0 && active.every(({ key }) => minimized.has(key));
  const formatter = useMemo(() => new Intl.DateTimeFormat("en-AU", {
    timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23", timeZoneName: "short",
  }), [timeZone]);

  useEffect(() => {
    let next = Infinity;
    for (const { timeMs } of events) {
      for (const boundary of [timeMs - HOUR_MS, timeMs - CRITICAL_WINDOW_MS, timeMs, timeMs + HOUR_MS]) {
        if (boundary > nowMs) next = Math.min(next, boundary);
      }
      if (!collapsed && nowMs >= timeMs - HOUR_MS && nowMs < timeMs) next = Math.min(next, nowMs + 1_000);
    }
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(() => setNowMs(Date.now()), Math.max(1, next - Date.now()));
    return () => window.clearTimeout(timer);
  }, [events, nowMs, collapsed]);

  if (!active.length) return null;

  return (
    <aside aria-label="High-impact news" className="absolute bottom-full right-0 mb-2 w-80 max-w-[calc(100vw_-_24px_-_env(safe-area-inset-left)_-_env(safe-area-inset-right))] rounded-2xl border border-danger/45 bg-panel text-foreground shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle size={16} className="shrink-0 text-danger" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-xs font-semibold">High-impact news <span className="text-muted">· {active.length}</span></span>
        <button
          type="button"
          aria-label={collapsed ? "Expand news warnings" : "Minimize news warnings"}
          aria-expanded={!collapsed}
          aria-controls="high-impact-news-events"
          className="flex size-7 items-center justify-center rounded-lg text-foreground hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setMinimized(new Set(collapsed ? [] : active.map(({ key }) => key)))}
        >
          {collapsed ? <Plus size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
        </button>
      </div>
      <ul id="high-impact-news-events" hidden={collapsed} className="max-h-[min(42dvh,18rem)] overflow-y-auto overscroll-contain border-t border-border px-3">
        {active.map((event) => {
          const untilMs = event.timeMs - nowMs;
          const status = untilMs > 0 ? formatCountdown(untilMs) : event.status === "released" ? "Released" : "Release time passed";
          return (
            <li key={event.key} className="border-b border-border py-2.5 last:border-b-0">
              <a href="/news?view=calendar" className="block rounded-md hover:underline">
                <span className="block break-words text-xs font-semibold">{event.currency} · {event.name}</span>
                <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px]">
                  <time className="text-muted" dateTime={new Date(event.timeMs).toISOString()}>{formatter.format(event.timeMs)}</time>
                  <span className={untilMs <= CRITICAL_WINDOW_MS ? "font-semibold text-danger" : "font-semibold text-warning"}>{status}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <span aria-hidden="true" className="absolute -bottom-1 right-7 size-2 rotate-45 border-b border-r border-danger/45 bg-panel" />
    </aside>
  );
}

export default memo(HighImpactNewsChip);
