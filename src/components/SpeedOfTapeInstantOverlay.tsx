"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LIVE_CHART_EXECUTION_EVENT, type LiveChartExecutionDetail } from "@/lib/chartLiveEvents";
import {
  buildSpeedOfTapeInstantFrame,
  SPEED_OF_TAPE_PLOT_TOP_MARGIN_PERCENT,
  type SpeedOfTapeInstantFrame,
  type SpeedOfTapeInstantSettings,
} from "@/lib/speedOfTapeInstant";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

type Props = {
  frame: SpeedOfTapeInstantFrame;
  settings: SpeedOfTapeInstantSettings;
  trades: readonly InstitutionalTrade[];
  top: number;
  bottom: number;
  width: number;
  backgroundColor: string;
  eventKey?: string | null;
};

export default function SpeedOfTapeInstantOverlay({
  frame,
  settings,
  trades,
  top,
  bottom,
  width,
  backgroundColor,
  eventKey,
}: Props) {
  const [retainedLiveFrame, setLiveFrame] = useState(frame);
  const liveFrame = eventKey ? retainedLiveFrame : frame;
  useEffect(() => {
    if (!eventKey) return;
    let tape = trades;
    let timeout: number | undefined;
    const update = () => {
      window.clearTimeout(timeout);
      const now = Date.now();
      const next = buildSpeedOfTapeInstantFrame(tape, settings, now);
      setLiveFrame(next);
      if (next.nextChangeMs !== undefined) {
        timeout = window.setTimeout(update, Math.max(1, next.nextChangeMs - now));
      }
    };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<LiveChartExecutionDetail>).detail;
      if (detail?.key !== eventKey) return;
      tape = detail.tape;
      update();
    };
    window.addEventListener(LIVE_CHART_EXECUTION_EVENT, receive);
    update();
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener(LIVE_CHART_EXECUTION_EVENT, receive);
    };
  }, [eventKey, settings, trades, frame]);

  if (!liveFrame.bars.length) return null;
  const sd2 = liveFrame.mean + liveFrame.standardDeviation * 2;
  const upper = Math.max(settings.scaleMinValue, settings.showStandardDeviations ? sd2 : 0,
    ...liveFrame.bars.map(bar => bar.high), 1);
  const lower = Math.min(0, ...liveFrame.bars.map(bar => bar.low));
  const padding = SPEED_OF_TAPE_PLOT_TOP_MARGIN_PERCENT;
  const yFor = (value: number) => padding + (upper - value) / (upper - lower) * (100 - padding);
  const label = `${settings.numberOfSeconds}s ${settings.inputData === "trades" ? "T" : "V"}`;
  return (
    <div
      aria-label={`Speed of Tape (Vertical), ${label}`}
      data-speed-of-tape-instant="true"
      className="pointer-events-none absolute right-0 overflow-hidden border-x border-border/70 font-mono"
      style={{ top, bottom, width, backgroundColor: `color-mix(in srgb, ${backgroundColor} 94%, transparent)` }}
    >
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ bottom: settings.textEnabled ? 16 : 0 }}
      >
        {settings.showStandardDeviations && liveFrame.standardDeviation > 0 ? [1, 2].map((multiple) => {
          const value = liveFrame.mean + liveFrame.standardDeviation * multiple;
          const y = yFor(value);
          return (
            <div
              key={multiple}
              className="absolute left-0 right-0 border-t border-dashed"
              style={{ top: `${y}%`, borderColor: settings.positiveBorderColor }}
            >
              {settings.textEnabled ? (
                <span
                  className="absolute left-0 top-0 -translate-y-full bg-background/85 px-px font-semibold leading-none"
                  style={{ color: settings.positiveBorderColor, fontSize: settings.textSize }}
                >
                  SD+{multiple}
                </span>
              ) : null}
            </div>
          );
        }) : null}
        <div className="absolute inset-0 flex gap-0.5 px-0.5">
          {liveFrame.bars.map((bar) => {
            const positive = bar.positive;
            const borderColor = positive ? settings.positiveBorderColor : settings.negativeBorderColor;
            const fillColor = positive ? settings.positiveFillColor : settings.negativeFillColor;
            const bodyTop = yFor(Math.max(bar.open, bar.value));
            const bodyBottom = yFor(Math.min(bar.open, bar.value));
            const wickTop = yFor(bar.high);
            const wickBottom = yFor(bar.low);
            const style: CSSProperties = {
              top: bodyTop + "%", height: "max(1px, " + (bodyBottom - bodyTop) + "%)",
              borderColor, backgroundColor: fillColor, borderWidth: settings.lineWidth, boxSizing: "border-box",
            };
            return (
              <div key={bar.startMs} className="relative h-full min-w-0 flex-1">
                {bar.high !== bar.low && <i data-tape-wick className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: wickTop + "%", height: (wickBottom - wickTop) + "%", width: Math.min(2, settings.lineWidth), backgroundColor: borderColor }} />}
                {(bar.high !== 0 || bar.low !== 0) && <i className="absolute inset-x-0 border-solid" style={style} />}
              </div>
            );
          })}
        </div>
      </div>
      {settings.textEnabled ? (
        <div
          className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center bg-background/94 font-semibold leading-none"
          style={{ color: settings.textColor, fontSize: settings.textSize }}
        >
          S-T({settings.numberOfSeconds}) {settings.displayValue.slice(0, 1).toUpperCase()}
        </div>
      ) : null}
    </div>
  );
}
