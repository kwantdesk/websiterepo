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
  { id: "ultraviolet", label: "Ultraviolet", positive: "#A3E635", negative: "#A855F7", star: "#F5F3FF" },
  { id: "forest", label: "Forest", positive: "#22C55E", negative: "#FB923C", star: "#FEF08A" },
  // The presets below follow classic scientific heat colormaps: rocket,
  // inferno, icefire, jet/rainbow, mono-purples, RdYlBu thermal and the
  // gnuplot purple-to-orange ramp.
  { id: "rocket", label: "Rocket", positive: "#F37651", negative: "#701F57", star: "#F6B48F" },
  { id: "inferno", label: "Inferno", positive: "#FCA50A", negative: "#932667", star: "#FCFFA4" },
  { id: "icefire", label: "Icefire", positive: "#E64A45", negative: "#4DD0E1", star: "#F8FAFC" },
  { id: "spectrum", label: "Spectrum", positive: "#E53935", negative: "#1E88E5", star: "#FFEB3B" },
  { id: "amethyst", label: "Amethyst", positive: "#6D28D9", negative: "#A78BFA", star: "#FFFFFF" },
  { id: "thermal", label: "Thermal", positive: "#E4572E", negative: "#2E86C1", star: "#F9C74F" },
  { id: "solar", label: "Solar", positive: "#F59E0B", negative: "#6A0DAD", star: "#FFD54F" },
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
