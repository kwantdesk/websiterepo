"use client";

import KwantSelect from "@/components/ui/KwantSelect";
import { normalizeAuctionGapSettings } from "@/lib/auctionGapSettings";

export default function AuctionGapIndicatorSettings({ settings, section, onChange }: {
  settings: Record<string, unknown>; section: "Inputs" | "Style" | "Alerts";
  onChange: (patch: Record<string, number | string | boolean>) => void;
}) {
  const s = normalizeAuctionGapSettings(settings);
  const select = (key: string, label: string, choices: string[][]) => (
    <label className="block space-y-1 text-[10px] text-muted">
      <span>{label}</span>
      <KwantSelect value={String(s[key])} menuLabel={`Auction Gap ${label}`}
        onChange={event => onChange({ [key]: event.target.value })}
        className="h-9 w-full border border-border bg-background px-3 text-foreground">
        {choices.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
      </KwantSelect>
    </label>
  );
  const time = (key: string, label: string) => {
    const minute = Number(s[key]);
    return <label key={key} className="block space-y-1 text-[10px] text-muted">
      <span>{label} · exchange time</span>
      <input type="time" aria-label={`Auction Gap ${label}`} step={60}
        value={`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`}
        onChange={event => {
          const match = /^(\d{2}):(\d{2})$/.exec(event.target.value);
          if (match) onChange({ [key]: Number(match[1]) * 60 + Number(match[2]) });
        }} className="h-9 w-full border border-border bg-background px-3 text-foreground" />
    </label>;
  };
  return <div className="space-y-3">
    {section === "Inputs" ? <>
      {select("includeMode", "Include levels", [["intrabar", "Intrabar"], ["all", "All"], ["extreme-only", "Extremes only"], ["high-only", "High only"], ["low-only", "Low only"], ["wick-only", "Wicks only"]])}
      {select("resetMode", "Reset zones", [["none", "None"], ["session-open", "Session open"], ["eth-and-rth-open", "Session and RTH open"]])}
      {select("filterTime", "Detection window", [["none", "All session times"], ["eth", "Outside RTH"], ["rth", "RTH"], ["custom", "Custom"]])}
      {s.filterTime === "custom" ? <div className="grid grid-cols-2 gap-3">
        {time("customStartMinutes", "Window start")}{time("customEndMinutes", "Window end")}
      </div> : null}
      {select("retestMode", "Mark zone retested when", [["touch", "A trade touches the zone"], ["cross", "A trade touches and the bar closes beyond it"]])}
    </> : null}
    {section === "Style" ? <>
      {select("plotMode", "Plot", [["zones", "Zones"], ["marker", "Markers"], ["marker-and-zones", "Markers and zones"]])}
      {s.plotMode !== "zones" ? select("markerPlacement", "Marker location", [["bar-direction", "Below rising / above falling candle"], ["low", "Candle low"], ["high", "Candle high"]]) : null}
    </> : null}
    {section === "Alerts" ? (["alertName", "alertMessage"] as const).map(key => (
      <label key={key} className="block space-y-1 text-[10px] text-muted">
        <span>{key === "alertName" ? "Alert name" : "Alert message"}</span>
        <input type="text" maxLength={key === "alertName" ? 80 : 200} aria-label={`Auction Gap ${key === "alertName" ? "alert name" : "alert message"}`}
          value={String(settings[key] ?? s[key])} onChange={event => onChange({ [key]: event.target.value })}
          className="h-9 w-full border border-border bg-background px-3 text-foreground" />
      </label>
    )) : null}
  </div>;
}
