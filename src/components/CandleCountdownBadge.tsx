"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Candle } from "@/lib/backtester";
import { candleCountdownRemainingMs, chartActivityRemainingMs } from "@/lib/chartCountdown";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";

function formatDuration(ms: number, elapsed = false) {
  const seconds = Math.max(0, elapsed ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
    : `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function CandleCountdownBadge({ candleIntervalMs, timeframe, hasCandles, latestCandleRef, marketIsActive, replayTimestampMs }: {
  candleIntervalMs: number | null;
  timeframe?: string;
  hasCandles: boolean;
  latestCandleRef: RefObject<Candle | null>;
  marketIsActive?: boolean;
  replayTimestampMs?: number | null;
}) {
  const [label, setLabel] = useState<string | null>(null);
  const eventBased = Boolean(timeframe && isEventBasedChartInterval(timeframe));
  useEffect(() => {
    const update = () => {
      const candle = latestCandleRef.current;
      if (!hasCandles || !candle || !Number.isFinite(candle.timestamp)) {
        setLabel(null);
        return;
      }
      const replay = replayTimestampMs != null && replayTimestampMs > 0;
      const now = replay ? replayTimestampMs : Date.now();
      const live = marketIsActive === true || chartActivityRemainingMs(candle.sourceEndTimestamp ?? NaN, now) > 0;
      if (eventBased) {
        // Event bars have no scheduled close. Show actual elapsed time rather
        // than inventing a seconds-remaining estimate for range/volume/etc.
        const end = replay || live ? now : candle.sourceEndTimestamp ?? candle.timestamp;
        setLabel(`${formatDuration(Math.max(0, end - (candle.sourceStartTimestamp ?? candle.timestamp)), true)} elapsed`);
        return;
      }
      const remaining = candleCountdownRemainingMs(candle.timestamp, candleIntervalMs ?? 0, now, replay || live, timeframe);
      setLabel(remaining == null ? "–" : formatDuration(remaining));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [candleIntervalMs, eventBased, hasCandles, latestCandleRef, marketIsActive, replayTimestampMs, timeframe]);
  if (!label) return null;
  return <div
    data-candle-timer
    className="pointer-events-none flex h-3.5 min-w-[27px] items-center justify-center whitespace-nowrap rounded-[3px] bg-primary px-0.5 font-mono text-[6px] font-semibold leading-none text-on-primary shadow-sm shadow-black/25"
    title={eventBased ? "Elapsed time in this execution-based candle; it has no fixed closing time" : label === "–" ? "Market closed, feed inactive or awaiting the next candle" : "Time until the next candle opens"}
  >{label}</div>;
}
