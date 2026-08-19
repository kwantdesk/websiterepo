/**
 * Crosshair styling shared by every chart pane: thickness down to a 0.25px
 * hairline plus a visibility level, edited from Chart Settings → Scales and
 * lines. Changes broadcast live so all open charts restyle together.
 */

export const CROSSHAIR_STYLE_STORAGE_KEY = "kwantdesk:chart-crosshair-style:v1";
export const CROSSHAIR_STYLE_EVENT = "kwantdesk:crosshair-style-change";

export type CrosshairStyle = { width: number; opacity: number };

export const DEFAULT_CROSSHAIR_STYLE: CrosshairStyle = { width: 1, opacity: 1 };

export function normalizeCrosshairStyle(value: unknown): CrosshairStyle {
  const parsed = value && typeof value === "object" ? value as Partial<CrosshairStyle> : {};
  const width = Number(parsed.width);
  const opacity = Number(parsed.opacity);
  return {
    width: Number.isFinite(width) ? Math.min(3, Math.max(0.25, width)) : DEFAULT_CROSSHAIR_STYLE.width,
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.1, opacity)) : DEFAULT_CROSSHAIR_STYLE.opacity,
  };
}

export function loadCrosshairStyle(): CrosshairStyle {
  if (typeof window === "undefined") return { ...DEFAULT_CROSSHAIR_STYLE };
  try {
    return normalizeCrosshairStyle(JSON.parse(window.localStorage.getItem(CROSSHAIR_STYLE_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_CROSSHAIR_STYLE };
  }
}

export function saveCrosshairStyle(style: CrosshairStyle) {
  if (typeof window === "undefined") return;
  const normalized = normalizeCrosshairStyle(style);
  try {
    window.localStorage.setItem(CROSSHAIR_STYLE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The style still applies this session without storage.
  }
  window.dispatchEvent(new CustomEvent(CROSSHAIR_STYLE_EVENT, { detail: normalized }));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}
