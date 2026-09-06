"use client";

import KwantSelect from "@/components/ui/KwantSelect";
import { normalizeSuperTrendSettings } from "@/lib/superTrendSettings";

export default function SuperTrendIndicatorSettings({ settings, difference, onChange }: {
  settings: Record<string, unknown>; difference: boolean;
  onChange: (patch: Record<string, number | string | boolean>) => void;
}) {
  const s = normalizeSuperTrendSettings(settings, difference);
  const fields = [
    { key: "displayStyle", label: "Display style", choices: difference
      ? [["histogram", "Histogram"], ["line", "Line"]]
      : [["line", "Line"], ["points", "Points"], ["line-points", "Line and points"]] },
    { key: "colorMode", label: "Auto colour", choices: [
      [difference ? "sign" : "direction", difference ? "Positive / negative" : "Trend direction"],
      ["none", "None"], ["slope", "Slope"]] },
    { key: "lineStyle", label: "Line style", choices: [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]] },
  ];
  return <div className="space-y-3">
    {fields.filter(field => !(field.key === "lineStyle" && difference && s.displayStyle === "histogram")).map(field => (
      <label key={field.key} className="block space-y-1 text-[10px] text-muted">
        <span>{field.label}</span>
        <KwantSelect value={String(s[field.key])} onChange={event => onChange({ [field.key]: event.target.value })}
          menuLabel={`Super Trend ${field.label}`} className="h-9 w-full border border-border bg-background px-3 text-foreground">
          {field.choices.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
        </KwantSelect>
      </label>
    ))}
    <label className="block space-y-1 text-[10px] text-muted">
      <span>Short name</span>
      <input aria-label="Super Trend short name" maxLength={40} type="text"
        value={String(settings.shortName ?? s.shortName)} onChange={event => onChange({ shortName: event.target.value })}
        className="h-9 w-full border border-border bg-background px-3 text-foreground" />
    </label>
    {!difference ? <label className="block space-y-1 text-[10px] text-muted">
      <span>Alert name</span>
      <input aria-label="Super Trend alert name" maxLength={80} type="text"
        value={String(settings.alertName ?? s.alertName)} onChange={event => onChange({ alertName: event.target.value })}
        className="h-9 w-full border border-border bg-background px-3 text-foreground" />
    </label> : null}
  </div>;
}
