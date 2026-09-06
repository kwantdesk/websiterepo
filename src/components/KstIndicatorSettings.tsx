"use client";

import KwantSelect from "@/components/ui/KwantSelect";
import { normalizeKstSettings } from "@/lib/knowSureThingSettings";

/** Shared indicator-dialog sections, not a separate modal or persistence key. */
export default function KstIndicatorSettings({ settings, onChange, section }: {
  section: "Inputs" | "Style";
  settings: Record<string, unknown>;
  onChange: (patch: Record<string, number | string | boolean>) => void;
}) {
  const s = normalizeKstSettings(settings);
  const select = (key: string, label: string, choices: readonly (readonly [string, string])[]) => (
    <label key={key} className="block space-y-1 text-[10px] text-muted">
      <span>{label}</span>
      <KwantSelect value={String(s[key])} onChange={event => onChange({ [key]: event.target.value })}
        menuLabel={label} className="h-9 w-full border border-border bg-background px-3 text-foreground">
        {choices.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
      </KwantSelect>
    </label>
  );
  return <>
    {section === "Inputs" ? <div className="space-y-3">
      {select("averageType", "Average type", [["simple", "Simple"], ["exponential", "Exponential"], ["triangular", "Triangular"], ["weighted", "Weighted"]])}
      <p className="text-[10px] text-muted">Uses the chart&apos;s closing prices. Raw mode measures price changes; percent mode measures percentage changes. Each of the four momentum windows must finish warming up before KST appears, followed by the signal window.</p>
    </div> : null}
    {section === "Style" ? (["kst", "signal"] as const).map(prefix => <div key={prefix} className="space-y-3 border border-border p-3">
      <h4 className="text-xs text-foreground">{prefix === "kst" ? "KST" : "Signal"}</h4>
      {select(`${prefix}ColorMode`, `${prefix === "kst" ? "KST" : "Signal"} auto colour`, [["none", "None"], ["slope", "Slope"]])}
      {select(`${prefix}DisplayStyle`, `${prefix === "kst" ? "KST" : "Signal"} display style`, [["line", "Line"], ["points", "Points"], ["line-points", "Line and points"]])}
      {select(`${prefix}LineStyle`, `${prefix === "kst" ? "KST" : "Signal"} line style`, [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]])}
      <label className="block space-y-1 text-[10px] text-muted">
        <span>{prefix === "kst" ? "KST" : "Signal"} short name</span>
        <input aria-label={`${prefix === "kst" ? "KST" : "Signal"} short name`} type="text" maxLength={24}
          value={String(settings[`${prefix}ShortName`] ?? s[`${prefix}ShortName`])}
          onChange={event => onChange({ [`${prefix}ShortName`]: event.target.value })}
          className="h-9 w-full border border-border bg-background px-3 text-foreground" />
      </label>
    </div>) : null}
  </>;
}
