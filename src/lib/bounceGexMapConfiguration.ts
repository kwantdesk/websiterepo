import { effectiveLinkedGexMapModel, linkedGexMapPanel, normalizeLinkedGexMapSettings, readLocalGexMapStarSettings, type LinkedGexMapSettings } from "./gexMapLinkedSettings";
import { resolveBounceGexMapSource } from "./bounceGexMapSource";
import type { GreekMode } from "./optionsFlow";

type Settings = Record<string, string | number | boolean>;

/** The settings editor and renderer must resolve the same source and metric. */
export function resolveBounceGexMapConfiguration(instrument: string, cfg: Settings, shared: LinkedGexMapSettings) {
  const linked = cfg.linkGexMapSettings !== false;
  let panels = shared.panels;
  if (!linked && typeof cfg.mapPanels === "string") {
    try { const saved: unknown = JSON.parse(cfg.mapPanels); if (Array.isArray(saved)) panels = saved; } catch { /* Legacy/malformed snapshots retain the existing fallback. */ }
  }
  const profile = linked ? shared : normalizeLinkedGexMapSettings({
    ...shared, panels, expiryScope: cfg.mapExpiryScope, representation: cfg.mapRepresentation,
    exposureModel: cfg.mapExposureModel, viewMode: cfg.mapViewMode ?? shared.viewMode,
    stepMinutes: cfg.mapStepMinutes ?? shared.stepMinutes,
    starSettings: readLocalGexMapStarSettings(cfg.mapStarSettings, shared.starSettings),
  });
  const { display, source } = resolveBounceGexMapSource(instrument, profile, cfg.sourceTicker);
  const panel = linkedGexMapPanel(profile, source, String(cfg.mapColumnId ?? ""));
  const localGreek = ["GAMMA", "DELTA", "VANNA", "CHARM"].includes(String(cfg.greekMode)) ? cfg.greekMode as GreekMode : "GAMMA";
  const greek = linked ? panel?.greekMode ?? localGreek : localGreek;
  const symbol = linked ? panel?.symbol ?? source : source;
  return { linked, profile, display, source, panel, greek, symbol, model: effectiveLinkedGexMapModel(profile, greek) };
}

/** Unlink the exact active measurement, including an AUTO-resolved source. */
export function bounceGexMapFollowPatch(configuration: ReturnType<typeof resolveBounceGexMapConfiguration>, follow: boolean): Settings {
  if (follow) return { linkGexMapSettings: true, priceMode: "live" };
  const { profile, panel, symbol, greek } = configuration;
  return {
    linkGexMapSettings: false, priceMode: "live", sourceTicker: symbol || "AUTO", mapColumnId: panel?.id ?? "", greekMode: greek,
    mapExpiryScope: profile.expiryScope, mapRepresentation: profile.representation,
    mapExposureModel: profile.exposureModel, mapViewMode: profile.viewMode, mapStepMinutes: profile.stepMinutes,
    mapStarSettings: JSON.stringify(profile.starSettings), mapPanels: JSON.stringify(profile.panels),
  };
}
