"use client";

import { useMemo, type ComponentProps } from "react";
import KwantDatePicker from "@/components/ui/KwantDatePicker";
import { gexReplayCalendar } from "@/lib/gexMapReplayTime";
import { timeZoneCity } from "@/lib/timeZones";

export default function ReplaySessionDatePicker({ timeZone, value, min, max, onChange, showSessionLabel = true, ...props }:
  Omit<ComponentProps<typeof KwantDatePicker>, "isDateSelectable"> & { timeZone?: string; showSessionLabel?: boolean }) {
  const calendar = useMemo(() => timeZone ? gexReplayCalendar(timeZone) : null, [timeZone]);
  if (!calendar || !timeZone) return <KwantDatePicker {...props} value={value} min={min} max={max} onChange={onChange} />;

  return (
    <div className="inline-flex shrink-0 flex-col items-start gap-0.5" title={`Date of the US cash open in ${timeZoneCity(timeZone)}`}>
      <KwantDatePicker
        {...props}
        value={calendar.localOpenDate(value)}
        min={min ? calendar.localOpenDate(min) : undefined}
        max={max ? calendar.localOpenDate(max) : undefined}
        isDateSelectable={(date) => calendar.exchangeDate(date) !== null}
        onChange={(date) => {
          const sessionDate = calendar.exchangeDate(date);
          if (sessionDate) onChange(sessionDate);
        }}
      />
      {showSessionLabel && value ? <span className="px-1 font-mono text-[8px] text-muted">NY session {value}</span> : null}
    </div>
  );
}
