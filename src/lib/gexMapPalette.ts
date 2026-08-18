export type GexMapPalette = {
  useThemeColors: boolean;
  positive: string;
  negative: string;
  star: string;
};

export const DEFAULT_GEX_MAP_PALETTE: GexMapPalette = {
  useThemeColors: true,
  positive: "#22C55E",
  negative: "#EF4444",
  star: "#F5D90A",
};

export const GEX_MAP_PALETTE_STORAGE_KEY = "kwantdesk:gex-map-palette:v1";
export const GEX_MAP_PALETTE_CHANGE_EVENT = "kwantdesk:gexmap-palette-change";

export function normalizeGexMapPalette(value: unknown): GexMapPalette {
  if (!value || typeof value !== "object") return { ...DEFAULT_GEX_MAP_PALETTE };
  const parsed = value as Partial<GexMapPalette>;
  const hex = (candidate: unknown, fallback: string) =>
    typeof candidate === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback;
  return {
    useThemeColors: parsed.useThemeColors !== false,
    positive: hex(parsed.positive, DEFAULT_GEX_MAP_PALETTE.positive),
    negative: hex(parsed.negative, DEFAULT_GEX_MAP_PALETTE.negative),
    star: hex(parsed.star, DEFAULT_GEX_MAP_PALETTE.star),
  };
}

export function loadGexMapPalette(): GexMapPalette {
  if (typeof window === "undefined") return { ...DEFAULT_GEX_MAP_PALETTE };
  try {
    return normalizeGexMapPalette(JSON.parse(window.localStorage.getItem(GEX_MAP_PALETTE_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_GEX_MAP_PALETTE };
  }
}

export function saveGexMapPalette(palette: GexMapPalette) {
  if (typeof window === "undefined") return;
  const normalized = normalizeGexMapPalette(palette);
  window.localStorage.setItem(GEX_MAP_PALETTE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(GEX_MAP_PALETTE_CHANGE_EVENT, { detail: normalized }));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

/** Resolved exposure tones: theme-linked palettes follow the live theme vars. */
export function gexMapPaletteTones(palette: GexMapPalette) {
  return palette.useThemeColors
    ? { positive: "var(--primary)", negative: "var(--danger)" }
    : { positive: palette.positive, negative: palette.negative };
}

export function gexMapPalettesEqual(left: GexMapPalette, right: GexMapPalette) {
  return left.useThemeColors === right.useThemeColors
    && left.positive === right.positive
    && left.negative === right.negative
    && left.star === right.star;
}
