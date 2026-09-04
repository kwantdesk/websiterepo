"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LIVE_CHART_EXECUTION_EVENT, type LiveChartExecutionDetail } from "@/lib/chartLiveEvents";
import {
  buildSpeedOfTapeInstantFrame,
  type SpeedOfTapeInstantFrame,
  type SpeedOfTapeInstantSettings,
} from "@/lib/speedOfTapeInstant";

type Props = {
  frame: SpeedOfTapeInstantFrame;
  settings: SpeedOfTapeInstantSettings;
  right: number;
  top: number;
  bottom: number;
  width: number;
  backgroundColor: string;
  eventKey?: string | null;
};

const bounded = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export default function SpeedOfTapeInstantOverlay({
  frame,
  settings,
  right,
  top,
  bottom,
  width,
  backgroundColor,
  eventKey,
}: Props) {
  const [liveFrame, setLiveFrame] = useState(frame);
  useEffect(() => setLiveFrame(frame), [frame]);
  useEffect(() => {
    if (!eventKey) return;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<LiveChartExecutionDetail>).detail;
      if (!detail || detail.key !== eventKey) return;
      setLiveFrame(buildSpeedOfTapeInstantFrame(detail.tape, settings));
    };
    window.addEventListener(LIVE_CHART_EXECUTION_EVENT, receive);
    return () => window.removeEventListener(LIVE_CHART_EXECUTION_EVENT, receive);
  }, [eventKey, settings]);

  if (!liveFrame.bars.length) return null;
  const sd2 = liveFrame.mean + liveFrame.standardDeviation * 2;
  const largest = Math.max(settings.scaleMinValue, sd2, ...liveFrame.bars.map((bar) => Math.abs(bar.value)), 1);
  const label = `${settings.numberOfSeconds}s ${settings.inputData === "trades" ? "T" : "V"}`;
  return (
    <div
      aria-label={`Speed of Tape instant, ${label}`}
      data-speed-of-tape-instant="true"
      className="pointer-events-none absolute z-[7] overflow-hidden border-l border-border/70 font-mono"
      style={{ right, top, bottom, width, backgroundColor: `color-mix(in srgb, ${backgroundColor} 90%, transparent)` }}
    >
      {settings.showStandardDeviations && liveFrame.standardDeviation > 0 ? [1, 2].map((multiple) => {
        const value = liveFrame.mean + liveFrame.standardDeviation * multiple;
        const y = bounded(100 - (value / largest) * 100, 0, 100);
        return (
          <div key={multiple} className="absolute left-0 right-0 border-t border-dashed border-primary/70" style={{ top: `${y}%` }}>
            <span className="absolute left-0 top-0 -translate-y-full bg-background/80 px-0.5 text-[6px] font-semibold text-primary">SD+{multiple}</span>
          </div>
        );
      }) : null}
      <div className="absolute inset-x-0 bottom-3 top-0 flex items-end justify-evenly gap-px px-0.5">
        {liveFrame.bars.map((bar) => {
          const positive = bar.positive;
          const borderColor = positive ? settings.positiveBorderColor : settings.negativeBorderColor;
          const fillColor = positive ? settings.positiveFillColor : settings.negativeFillColor;
          const style: CSSProperties = {
            height: `${bounded((Math.abs(bar.value) / largest) * 100, bar.value === 0 ? 0 : 0.8, 100)}%`,
            borderColor,
            backgroundColor: fillColor,
            borderWidth: settings.lineWidth,
          };
          return <i key={bar.startMs} className="block min-w-0 flex-1 border-solid" style={style} />;
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-3 items-center justify-center bg-background/90 text-[6px] font-semibold text-foreground">
        S-T({settings.numberOfSeconds}) {settings.displayValue.slice(0, 1).toUpperCase()}
      </div>
    </div>
  );
}
