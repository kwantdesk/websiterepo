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

/**
 * Curated full-map palettes. Each recolours the complete exposure surface —
 * positive heat, negative heat and the Star accent — with combinations that
 * stay readable against the dark chart background at every heat intensity.
 */
export const GEX_MAP_PALETTE_PRESETS: Array<{
  id: string;
  label: string;
  positive: string;
  negative: string;
  star: string;
}> = [
  { id: "aurora", label: "Aurora", positive: "#2DD4BF", negative: "#FB7185", star: "#FBBF24" },
  { id: "ocean", label: "Ocean", positive: "#38BDF8", negative: "#F59E0B", star: "#F1F5F9" },
  { id: "ember", label: "Ember", positive: "#FACC15", negative: "#EF4444", star: "#FDE68A" },
  { id: "ultraviolet", label: "Ultraviolet", positive: "#A3E635", negative: "#A855F7", star: "#F5F3FF" },
  { id: "forest", label: "Forest", positive: "#22C55E", negative: "#FB923C", star: "#FEF08A" },
];

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
