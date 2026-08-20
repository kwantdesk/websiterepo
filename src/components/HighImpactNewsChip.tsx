"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { EconomicCalendarEvent } from "@/lib/economicCalendar";

// Site-wide "never miss high-impact news" chip. Lives in the top bar on every
// workspace, watching the same authoritative economic-calendar API as the News
// page (TradingView calendar primary, the Forex Factory weekly feed as
// fallback). When a high-impact USD release is inside the warning window it
// shows a live countdown — amber inside 90 minutes, red and pulsing inside 10
// minutes, and "LIVE" for the first minutes after the print.
const REFRESH_MS = 5 * 60_000;
const WARNING_WINDOW_MS = 90 * 60_000;
const CRITICAL_WINDOW_MS = 10 * 60_000;
const RELEASED_LINGER_MS = 3 * 60_000;

type ChipEvent = { name: string; timeMs: number };

function isCalendarEvent(value: unknown): value is EconomicCalendarEvent {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<EconomicCalendarEvent>;
  return typeof row.name === "string" && typeof row.date === "string" && typeof row.impact === "string";
}

function formatCountdown(deltaMs: number) {
  const totalSeconds = Math.max(0, Math.floor(deltaMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes >= 10) return `${minutes}m`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function HighImpactNewsChip() {
  const [events, setEvents] = useState<ChipEvent[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const today = new Date();
        const from = today.toISOString().slice(0, 10);
        const to = new Date(today.getTime() + 24 * 3_600_000).toISOString().slice(0, 10);
        const response = await fetch(`/api/economic-calendar?from=${from}&to=${to}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        const rows = (payload as { events?: unknown[] })?.events;
        if (!Array.isArray(rows) || cancelled) return;
        const upcoming = rows
          .filter(isCalendarEvent)
          .filter((event) => event.impact === "High" && event.currency === "USD")
          .map((event) => ({ name: event.name, timeMs: Date.parse(event.date) }))
          .filter((event) => Number.isFinite(event.timeMs))
          .sort((a, b) => a.timeMs - b.timeMs);
        setEvents(upcoming);
      } catch {
        // The chip is an alerting aid; a fetch failure silently retries on the
        // next cycle rather than adding noise to the trading chrome.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const next = useMemo(
    () => events.find((event) => event.timeMs + RELEASED_LINGER_MS > nowMs) ?? null,
    [events, nowMs],
  );
  const untilMs = next ? next.timeMs - nowMs : Number.POSITIVE_INFINITY;
  const visible = next !== null && untilMs <= WARNING_WINDOW_MS;

  // Tick the countdown only while the chip is on screen.
  useEffect(() => {
    if (!visible) {
      const idle = window.setInterval(() => setNowMs(Date.now()), 60_000);
      return () => window.clearInterval(idle);
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [visible]);

  if (!next || !visible) return null;
  const released = untilMs <= 0;
  const critical = untilMs <= CRITICAL_WINDOW_MS;
  const tone = released || critical
    ? "border-danger/45 bg-danger/15 text-danger"
    : "border-warning/45 bg-warning/10 text-warning";
  const label = next.name.length > 26 ? `${next.name.slice(0, 25)}…` : next.name;
  return (
    <a
      href="/news"
      title={`High-impact USD release: ${next.name}`}
      className={`flex h-6 shrink-0 items-center gap-1.5 border px-2 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors hover:brightness-110 ${tone} ${critical && !released ? "animate-pulse" : ""}`}
    >
      <AlertTriangle className="h-3 w-3" strokeWidth={2} />
      <span className="max-w-[180px] truncate">{label}</span>
      <span className="font-mono">{released ? "LIVE" : formatCountdown(untilMs)}</span>
    </a>
  );
}

export default memo(HighImpactNewsChip);
