import { DEFAULT_GEX_MAP_EXPIRY_SCOPE, DEFAULT_GEX_MAP_REPRESENTATION, gexMapProviderTicker, type GexMapExpiryScope, type GexMapRepresentation } from "@/lib/gexMap";
import { RECOMMENDED_GEX_MAP_STAR_SETTINGS, normalizeGexMapViewMode, type GexMapStarSettings, type GexMapViewMode } from "@/lib/gexMapStar";
import type { GreekMode } from "@/lib/optionsFlow";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

export const GEX_MAP_LINKED_SETTINGS_KEY = "kwantdesk:gex-map-linked-settings:v1";
export const GEX_MAP_LINKED_SETTINGS_EVENT = "kwantdesk:gex-map-linked-settings-change";
export type LinkedGexMapPanel = { id: string; symbol: string; greekMode: GreekMode };
export type LinkedGexMapSettings = {
  version: 1; expiryScope: GexMapExpiryScope; representation: GexMapRepresentation;
  exposureModel: "STRUCTURAL_OI" | "DEALER_INVENTORY"; viewMode: GexMapViewMode;
  stepMinutes: number; starSettings: GexMapStarSettings; panels: LinkedGexMapPanel[];
};
export const DEFAULT_LINKED_GEX_MAP_SETTINGS: LinkedGexMapSettings = {
  version: 1, expiryScope: DEFAULT_GEX_MAP_EXPIRY_SCOPE, representation: DEFAULT_GEX_MAP_REPRESENTATION,
  exposureModel: "STRUCTURAL_OI", viewMode: "star", stepMinutes: 1,
  starSettings: { ...RECOMMENDED_GEX_MAP_STAR_SETTINGS },
  panels: [{ id: "left", symbol: "SPX", greekMode: "GAMMA" }, { id: "centre", symbol: "SPY", greekMode: "GAMMA" }, { id: "right", symbol: "QQQ", greekMode: "GAMMA" }],
};
const GREEKS = ["GAMMA", "DELTA", "VANNA", "CHARM"];
const bounded = (v: unknown, min: number, max: number, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function normalizeLinkedGexMapSettings(value: unknown): LinkedGexMapSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<LinkedGexMapSettings>;
  const s: Partial<GexMapStarSettings> = v.starSettings ?? {};
  const d = RECOMMENDED_GEX_MAP_STAR_SETTINGS;
  const settings: GexMapStarSettings = {
    highlightedNodes: Math.round(bounded(s.highlightedNodes, 2, 8, d.highlightedNodes)),
    selectionStrategy: ["structural", "magnitude", "velocity"].includes(s.selectionStrategy ?? "") ? s.selectionStrategy! : d.selectionStrategy,
    dimOpacity: bounded(s.dimOpacity, 0, 1, d.dimOpacity),
    showRawValues: typeof s.showRawValues === "boolean" ? s.showRawValues : d.showRawValues,
    showRoleLabels: typeof s.showRoleLabels === "boolean" ? s.showRoleLabels : d.showRoleLabels,
    showAirPocketLabels: typeof s.showAirPocketLabels === "boolean" ? s.showAirPocketLabels : d.showAirPocketLabels,
    animateChanges: typeof s.animateChanges === "boolean" ? s.animateChanges : d.animateChanges,
    minimumControlPct: s.minimumControlPct === null || s.minimumControlPct === undefined ? null : bounded(s.minimumControlPct, 0, 100, 0),
    promotionMargin: bounded(s.promotionMargin, 0, 1, d.promotionMargin),
    starReplacementMargin: bounded(s.starReplacementMargin, 0, 1, d.starReplacementMargin),
    airPocketRowThresholdPct: bounded(s.airPocketRowThresholdPct, 0, 100, d.airPocketRowThresholdPct),
    airPocketCombinedThresholdPct: bounded(s.airPocketCombinedThresholdPct, 0, 100, d.airPocketCombinedThresholdPct),
    proximityWeight: bounded(s.proximityWeight, 0, 1, d.proximityWeight),
    valueMode: s.valueMode === "star-percent" ? "star-percent" : "signed",
  };
  const panels = Array.isArray(v.panels) ? v.panels.filter((p) => p && typeof p.id === "string" && typeof p.symbol === "string" && /^[A-Z0-9.^-]{1,16}$/.test(p.symbol) && GREEKS.includes(p.greekMode)).map((p) => ({ id: p.id, symbol: p.symbol, greekMode: p.greekMode })) : [];
  return { version: 1, expiryScope: v.expiryScope === "ALL_EXPIRIES" ? "ALL_EXPIRIES" : "FRONT_EXPIRY",
    representation: v.representation === "PER_ONE_PERCENT_MOVE" ? "PER_ONE_PERCENT_MOVE" : "PER_ONE_DOLLAR_MOVE",
    exposureModel: v.exposureModel === "DEALER_INVENTORY" ? "DEALER_INVENTORY" : "STRUCTURAL_OI",
    viewMode: v.viewMode === undefined ? "star" : normalizeGexMapViewMode(v.viewMode),
    stepMinutes: [1, 2, 5, 10].includes(v.stepMinutes ?? 0) ? v.stepMinutes! : 1,
    starSettings: settings, panels: panels.length ? panels : DEFAULT_LINKED_GEX_MAP_SETTINGS.panels.map((p) => ({ ...p })) };
}
export function readLocalGexMapStarSettings(value: unknown, fallback: GexMapStarSettings) {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as GexMapStarSettings; } catch { return fallback; }
}
export function hasLinkedGexMapSettings() {
  try { return typeof window !== "undefined" && window.localStorage.getItem(GEX_MAP_LINKED_SETTINGS_KEY) !== null; } catch { return false; }
}
/** Remember a source's last column settings even after its map is closed. */
export function mergeLinkedGexMapPanels(local: LinkedGexMapSettings, shared: LinkedGexMapSettings): LinkedGexMapSettings {
  return normalizeLinkedGexMapSettings({ ...local, panels: [...local.panels, ...shared.panels.filter((p) =>
    !local.panels.some((v) => v.id === p.id && gexMapProviderTicker(v.symbol) === gexMapProviderTicker(p.symbol)))] });
}
export function readLinkedGexMapSettings(): LinkedGexMapSettings {
  if (typeof window === "undefined") return DEFAULT_LINKED_GEX_MAP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(GEX_MAP_LINKED_SETTINGS_KEY);
    if (raw) return normalizeLinkedGexMapSettings(JSON.parse(raw));
    const legacy = JSON.parse(window.localStorage.getItem("kwantdesk:gex-map:star-preferences:v1") ?? "null");
    return normalizeLinkedGexMapSettings({ ...DEFAULT_LINKED_GEX_MAP_SETTINGS, viewMode: legacy?.viewMode ?? "star", starSettings: legacy?.settings ?? RECOMMENDED_GEX_MAP_STAR_SETTINGS });
  } catch { return DEFAULT_LINKED_GEX_MAP_SETTINGS; }
}
export function publishLinkedGexMapSettings(value: LinkedGexMapSettings) {
  const next = normalizeLinkedGexMapSettings(value), json = JSON.stringify(next);
  if (typeof window !== "undefined" && window.localStorage.getItem(GEX_MAP_LINKED_SETTINGS_KEY) !== json) {
    writeProtectedItem(GEX_MAP_LINKED_SETTINGS_KEY, json);
    window.dispatchEvent(new CustomEvent(GEX_MAP_LINKED_SETTINGS_EVENT));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }
  return next;
}
export function linkedGexMapPanel(settings: LinkedGexMapSettings, source: string, preferredId?: string) {
  const candidates = settings.panels.filter((p) => gexMapProviderTicker(p.symbol) === gexMapProviderTicker(source));
  return candidates.find((p) => p.id === preferredId) ?? candidates[0] ?? null;
}
export function effectiveLinkedGexMapModel(settings: LinkedGexMapSettings, greek: GreekMode) {
  return greek === "GAMMA" ? settings.exposureModel : "STRUCTURAL_OI";
}
