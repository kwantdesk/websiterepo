"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import { OPTIONS_FLOW_INSTRUMENTS } from "@/lib/optionsFlow";
import { GEX_MAP_PALETTE_CHANGE_EVENT, gexMapPalettesEqual, loadGexMapPalette, saveGexMapPalette, type GexMapPalette } from "@/lib/gexMapPalette";
import { linkedGexMapPanel, normalizeLinkedGexMapSettings, publishLinkedGexMapSettings, readLocalGexMapStarSettings, type LinkedGexMapSettings } from "@/lib/gexMapLinkedSettings";
import GexMapSettingsDialog from "./GexMapSettingsDialog";
import { useLinkedGexMapSettings } from "./useLinkedGexMapSettings";
import { resolveBounceGexMapSource } from "@/lib/bounceGexMapSource";

type Settings = Record<string, string | number | boolean>;
const coreFields = {
  expiryScope: "mapExpiryScope", representation: "mapRepresentation",
  exposureModel: "mapExposureModel", viewMode: "mapViewMode", stepMinutes: "mapStepMinutes",
} as const;

/** The linked projection has no separate relevance, expiry or node-count filters. */
export function isBounceMirrorPresentationKey(key: string) {
  return ["lineOpacity", "minimumNodeThickness", "maximumNodeThickness", "glowStrength",
    "microOrbTexture", "tooltipsEnabled", "showHeader", "enableAlerts", "inAppSound", "chartMarkers"].includes(key)
    || key.startsWith("alert") || key.endsWith("Notifications");
}

export default function BounceGexMapSettings({ instrument = "", settings, onChange }: {
  instrument?: string; settings: Settings; onChange: (patch: Settings) => void;
}) {
  const shared = useLinkedGexMapSettings();
  const linked = settings.linkGexMapSettings !== false;
  const profile = normalizeLinkedGexMapSettings(linked ? shared : {
    ...shared, expiryScope: settings.mapExpiryScope, representation: settings.mapRepresentation,
    exposureModel: settings.mapExposureModel, viewMode: settings.mapViewMode, stepMinutes: settings.mapStepMinutes,
    starSettings: readLocalGexMapStarSettings(settings.mapStarSettings, shared.starSettings),
  });
  const [appearance, setAppearance] = useState(false);
  const [savedPalette, setSavedPalette] = useState<GexMapPalette>(() => loadGexMapPalette());
  const [previewPalette, setPreviewPalette] = useState<GexMapPalette | null>(null);
  useEffect(() => {
    const update = () => { setSavedPalette(loadGexMapPalette()); setPreviewPalette(null); };
    window.addEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, update);
    return () => window.removeEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, update);
  }, []);
  const source = String(settings.sourceTicker ?? "AUTO");
  const resolved = resolveBounceGexMapSource(instrument, profile, source);
  const column = linkedGexMapPanel(profile, resolved.source, String(settings.mapColumnId ?? ""));
  const metric = linked ? column?.greekMode ?? "GAMMA"
    : String(settings.greekMode ?? "GAMMA");
  const update = (patch: Partial<LinkedGexMapSettings>) => {
    const next = normalizeLinkedGexMapSettings({ ...profile, ...patch });
    if (linked) publishLinkedGexMapSettings(next);
    else {
      const local: Settings = {};
      for (const [key, localKey] of Object.entries(coreFields)) local[localKey] = next[key as keyof typeof coreFields];
      local.mapStarSettings = JSON.stringify(next.starSettings);
      onChange(local);
    }
  };
  const inputClass = "h-9 w-full rounded-lg border border-border bg-background px-3 text-[11px] normal-case tracking-normal text-foreground";
  const select = (label: string, value: string, options: [string, string][], change: (v: string) => void, disabled = false) => (
    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
      <span>{label}</span>
      <KwantSelect value={value} onChange={(e) => change(e.target.value)} className={inputClass} menuLabel={label} disabled={disabled}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </KwantSelect>
    </label>
  );
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3" data-bounce-gex-settings>
      <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/15 px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/25"
        onClick={() => onChange({
          gexMapMirror: true, linkGexMapSettings: true, priceMode: "live", greekMode: column?.greekMode ?? "GAMMA",
          mapExpiryScope: shared.expiryScope, mapRepresentation: shared.representation,
          mapExposureModel: shared.exposureModel, mapViewMode: shared.viewMode, mapStepMinutes: shared.stepMinutes,
          mapStarSettings: JSON.stringify(shared.starSettings),
        })}>
        <Link2 className="h-4 w-4 shrink-0" /> Import &amp; Link GEX Map Settings
      </button>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
        <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={linked} onChange={(e) => onChange({
          linkGexMapSettings: e.target.checked,
          greekMode: column?.greekMode ?? "GAMMA",
          mapExpiryScope: profile.expiryScope, mapRepresentation: profile.representation,
          mapExposureModel: profile.exposureModel, mapViewMode: profile.viewMode, mapStepMinutes: profile.stepMinutes,
          mapStarSettings: JSON.stringify(profile.starSettings),
        })} />
        Follow GEX Map automatically
      </label>
      <p className="text-[11px] leading-5 text-muted">
        {linked ? "Shared settings update GEX Map and every linked Bounce Levels chart. All map nodes remain available; the chosen view controls their emphasis."
          : "This chart uses its own map settings. Import & Link reconnects it to GEX Map."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {select("Options source", source, [["AUTO", resolved.source ? "Auto — " + resolved.source : "Auto — match chart"], ...OPTIONS_FLOW_INSTRUMENTS.map((p): [string, string] => [p.symbol, p.symbol + " — " + p.label])],
          (v) => onChange({ sourceTicker: v, mapColumnId: "" }))}
        {select("GEX Map column", String(settings.mapColumnId ?? ""), [["", "Auto — match options source"],
          ...profile.panels.map((p): [string, string] => [p.id, p.symbol + " · " + p.greekMode])],
          (v) => { const p = profile.panels.find((p) => p.id === v); onChange({ mapColumnId: v, ...(p ? { sourceTicker: p.symbol, greekMode: p.greekMode } : {}) }); })}
        {select("Metric", metric, [["GAMMA", "Gamma (GEX)"], ["DELTA", "Delta (DEX)"], ["VANNA", "Vanna"], ["CHARM", "Charm"]],
          (v) => {
            if (linked) {
              const p = column ?? { id: "bounce-" + resolved.source, symbol: resolved.source, greekMode: v };
              const panels = column ? profile.panels.map((x) => x.id === column.id ? { ...x, greekMode: v } : x) : [...profile.panels, p];
              update({ panels: panels as LinkedGexMapSettings["panels"] });
            } else onChange({ greekMode: v });
          }, !resolved.source)}
        {select("Exposure model", profile.exposureModel, [["STRUCTURAL_OI", "Structural OI"], ["DEALER_INVENTORY", "Dealer inventory"]],
          (v) => update({ exposureModel: v as LinkedGexMapSettings["exposureModel"] }))}
        {select("Expirations", profile.expiryScope, [["FRONT_EXPIRY", "Front expiry"], ["ALL_EXPIRIES", "All expirations"]],
          (v) => update({ expiryScope: v as LinkedGexMapSettings["expiryScope"] }))}
        {select("Exposure units", profile.representation, [["PER_ONE_DOLLAR_MOVE", "Per $1 move"], ["PER_ONE_PERCENT_MOVE", "Per 1% move"]],
          (v) => update({ representation: v as LinkedGexMapSettings["representation"] }))}
        {select("Interval", String(profile.stepMinutes), [[1, "1 minute"], [2, "2 minutes"], [5, "5 minutes"], [10, "10 minutes"]].map(([v, label]) => [String(v), String(label)]),
          (v) => update({ stepMinutes: Number(v) }))}
        {!linked ? select("Data time", String(settings.priceMode ?? "live"), [["live", "Live / chart replay"], ["eod", "Last completed session"]],
          (v) => onChange({ priceMode: v })) : null}
        <button type="button" className={inputClass + " mt-auto text-left hover:bg-primary/10"} onClick={() => setAppearance((v) => !v)} aria-expanded={appearance}>
          {appearance ? "Hide" : "Open"} GEX Map view, nodes &amp; colours
        </button>
      </div>
      {profile.exposureModel === "DEALER_INVENTORY" && metric !== "AUTO" && metric !== "GAMMA" ? (
        <p className="text-[11px] leading-5 text-muted">Dealer inventory applies to Gamma. {metric} uses Structural OI, matching GEX Map.</p>
      ) : null}
      {appearance ? <GexMapSettingsDialog embedded open settings={profile.starSettings} palette={previewPalette ?? savedPalette}
        paletteDirty={previewPalette !== null && !gexMapPalettesEqual(previewPalette, savedPalette)} viewMode={profile.viewMode}
        onViewModeChange={(viewMode) => update({ viewMode })} onChange={(starSettings) => update({ starSettings })}
        onPaletteChange={setPreviewPalette}
        onPaletteSave={() => { if (previewPalette) saveGexMapPalette(previewPalette); setPreviewPalette(null); }}
        onClose={() => { setAppearance(false); setPreviewPalette(null); }} /> : null}
    </div>
  );
}
