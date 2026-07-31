"use client";

import { Flame } from "lucide-react";

type ActivityStreakBadgeProps = {
  streak?: number | null;
  compact?: boolean;
  className?: string;
};

export default function ActivityStreakBadge({
  streak,
  compact = false,
  className = "",
}: ActivityStreakBadgeProps) {
  const days = Number.isFinite(Number(streak)) ? Math.max(0, Math.floor(Number(streak))) : 0;
  const label = compact ? `${days}D` : `${days} DAY${days === 1 ? "" : "S"}`;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.08] font-semibold uppercase tracking-[0.08em] text-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_10%,transparent)] ${
        compact ? "px-1.5 py-0.5 text-[6px]" : "px-2 py-1 text-[7px]"
      } ${className}`}
      title={`${days}-day weekday activity streak. Weekends do not count or break it.`}
      aria-label={`${days}-day activity streak`}
    >
      <Flame className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
