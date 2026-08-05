"use client";

import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { activityStreakLifecycle } from "@/lib/activityStreak";

type ActivityStreakBadgeProps = {
  streak?: number | null;
  compact?: boolean;
  className?: string;
  lastSeenAt?: string | null;
  timeZone?: string | null;
  showTimer?: boolean;
};

function countdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function ActivityStreakBadge({
  streak,
  compact = false,
  className = "",
  lastSeenAt,
  timeZone,
  showTimer = false,
}: ActivityStreakBadgeProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!showTimer) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [showTimer]);
  const lifecycle = activityStreakLifecycle({ streak, lastSeenAt, timeZone, now });
  const days = lifecycle.effectiveStreak;
  const baseLabel = compact ? `${days}D` : `${days} DAY${days === 1 ? "" : "S"}`;
  const label = lifecycle.state === "recovery"
    ? showTimer ? `${baseLabel} · ${countdown(lifecycle.secondsUntilReset)}` : baseLabel
    : lifecycle.state === "expired"
      ? "STREAK RESET"
      : lifecycle.state === "weekend"
        ? showTimer ? `${baseLabel} · WEEKEND` : baseLabel
        : showTimer && lifecycle.state === "active"
          ? `${baseLabel} · ${countdown(lifecycle.secondsUntilReset)}`
          : baseLabel;
  const title = lifecycle.state === "recovery"
    ? `${days}-day streak remains active. Return within ${countdown(lifecycle.secondsUntilReset)} to continue it.`
    : lifecycle.state === "expired"
      ? "More than 48 weekday hours passed without activity. The next login starts a new streak."
      : lifecycle.state === "weekend"
        ? `${days}-day streak. A weekend login adds one day; missing the weekend never breaks it.`
        : `${days}-day activity streak. ${countdown(lifecycle.secondsUntilReset)} remains before the 48-hour weekday window expires.`;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.08] font-semibold uppercase tracking-[0.08em] text-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_10%,transparent)] ${
        compact ? "px-1.5 py-0.5 text-[6px]" : "px-2 py-1 text-[7px]"
      } ${className}`}
      title={title}
      aria-label={title}
    >
      <Flame className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
