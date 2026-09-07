"use client";

import { useEffect, useState } from "react";
import { LIVE_CHART_EXECUTION_EVENT, type LiveChartExecutionDetail } from "@/lib/chartLiveEvents";
import {
  buildSpeedOfTapeInstantFrame,
  speedOfTapeMeterHeightPercent,
  speedOfTapeMeterTopPercent,
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
  const largest = Math.max(settings.scaleMinValue, sd2, ...liveFrame.bars.map((bar) => bar.wickValue), 1);
  const label = `${settings.numberOfSeconds}s ${settings.inputData === "trades" ? "T" : "V"}`;
  return (
    <div
      aria-label={`Speed of Tape instant, ${label}`}
      data-speed-of-tape-instant="true"
      className="pointer-events-none absolute z-[7] overflow-hidden border-x border-border/70 font-mono"
      style={{ right, top, bottom, width, backgroundColor: `color-mix(in srgb, ${backgroundColor} 94%, transparent)` }}
    >
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ bottom: settings.textEnabled ? 16 : 0 }}
      >
        {settings.showStandardDeviations && liveFrame.standardDeviation > 0 ? [1, 2].map((multiple) => {
          const value = liveFrame.mean + liveFrame.standardDeviation * multiple;
          const y = settings.plotReversed
            ? speedOfTapeMeterHeightPercent(value, largest)
            : speedOfTapeMeterTopPercent(value, largest);
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
        <div className={`absolute inset-0 flex gap-0.5 px-0.5 ${settings.plotReversed ? "items-start" : "items-end"}`}>
          {liveFrame.bars.map((bar) => {
            const positive = bar.positive;
            const shadowColor = positive ? settings.positiveBorderColor : settings.negativeBorderColor;
            const bodyColor = positive ? settings.positiveFillColor : settings.negativeFillColor;
            const wickHeight = speedOfTapeMeterHeightPercent(bar.wickValue, largest);
            const bodyHeight = speedOfTapeMeterHeightPercent(bar.bodyValue, largest);
            return (
              <i key={bar.startMs} className="relative block h-full min-w-0 flex-1" data-tape-meter-candle="true">
                {bar.wickValue > 0 ? (
                  <span
                    className={`absolute left-1/2 w-0 -translate-x-1/2 border-l ${settings.plotReversed ? "top-0" : "bottom-0"}`}
                    style={{ height: `${wickHeight}%`, borderColor: shadowColor, borderLeftWidth: settings.lineWidth }}
                  />
                ) : null}
                {bar.bodyValue > 0 ? (
                  <span
                    className={`absolute left-[12%] right-[12%] border-solid ${settings.plotReversed ? "top-0" : "bottom-0"}`}
                    style={{
                      height: `max(2px, ${bodyHeight}%)`,
                      borderColor: shadowColor,
                      backgroundColor: bodyColor,
                      borderWidth: settings.lineWidth,
                      boxSizing: "border-box",
                    }}
                  />
                ) : null}
              </i>
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
