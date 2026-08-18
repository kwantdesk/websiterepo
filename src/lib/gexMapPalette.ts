export type GexMapPalette = {
  useThemeColors: boolean;
  /** Strongest positive-exposure tone. */
  positive: string;
  /** Weak positive tone — the gradient's low-intensity call-side stop. */
  positiveSoft: string;
  /** Strongest negative-exposure tone. */
  negative: string;
  /** Weak negative tone — the gradient's low-intensity put-side stop. */
  negativeSoft: string;
  star: string;
};

export const DEFAULT_GEX_MAP_PALETTE: GexMapPalette = {
  useThemeColors: true,
  positive: "#22C55E",
  positiveSoft: "#15803D",
  negative: "#EF4444",
  negativeSoft: "#991B1B",
  star: "#F5D90A",
};

export const GEX_MAP_PALETTE_STORAGE_KEY = "kwantdesk:gex-map-palette:v1";
export const GEX_MAP_PALETTE_CHANGE_EVENT = "kwantdesk:gexmap-palette-change";

export function normalizeGexMapPalette(value: unknown): GexMapPalette {
  if (!value || typeof value !== "object") return { ...DEFAULT_GEX_MAP_PALETTE };
  const parsed = value as Partial<GexMapPalette>;
  const hex = (candidate: unknown, fallback: string) =>
    typeof candidate === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback;
  const positive = hex(parsed.positive, DEFAULT_GEX_MAP_PALETTE.positive);
  const negative = hex(parsed.negative, DEFAULT_GEX_MAP_PALETTE.negative);
  return {
    useThemeColors: parsed.useThemeColors !== false,
    positive,
    // Palettes saved before the five-colour gradient carry no soft stops;
    // falling back to the strong tone reproduces their exact old rendering.
    positiveSoft: hex(parsed.positiveSoft, positive),
    negative,
    negativeSoft: hex(parsed.negativeSoft, negative),
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
 * Curated five-colour gradient palettes following classic scientific heat
 * colormaps. Each side of the surface ramps from its soft stop at low heat
 * to its strong stop at full heat, with the Star accent as the fifth colour.
 */
export const GEX_MAP_PALETTE_PRESETS: Array<{
  id: string;
  label: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  star: string;
}> = [
  { id: "ultraviolet", label: "Ultraviolet", positive: "#A3E635", positiveSoft: "#4D7C0F", negative: "#A855F7", negativeSoft: "#6B21A8", star: "#F5F3FF" },
  { id: "forest", label: "Forest", positive: "#22C55E", positiveSoft: "#15803D", negative: "#FB923C", negativeSoft: "#C2410C", star: "#FEF08A" },
  { id: "rocket", label: "Rocket", positive: "#F37651", positiveSoft: "#C9366F", negative: "#701F57", negativeSoft: "#43123B", star: "#F6B48F" },
  { id: "inferno", label: "Inferno", positive: "#FCA50A", positiveSoft: "#DD513A", negative: "#932667", negativeSoft: "#4A0C6B", star: "#FCFFA4" },
  { id: "icefire", label: "Icefire", positive: "#E64A45", positiveSoft: "#8E2043", negative: "#4DD0E1", negativeSoft: "#1A6FA8", star: "#F8FAFC" },
  { id: "spectrum", label: "Spectrum", positive: "#E53935", positiveSoft: "#F9A825", negative: "#1E88E5", negativeSoft: "#26C6DA", star: "#FFEB3B" },
  { id: "amethyst", label: "Amethyst", positive: "#6D28D9", positiveSoft: "#8B5CF6", negative: "#A78BFA", negativeSoft: "#DDD6FE", star: "#FFFFFF" },
  { id: "thermal", label: "Thermal", positive: "#E4572E", positiveSoft: "#F9C74F", negative: "#2E86C1", negativeSoft: "#7FBFDF", star: "#F9C74F" },
  { id: "solar", label: "Solar", positive: "#F59E0B", positiveSoft: "#B45309", negative: "#6A0DAD", negativeSoft: "#3B0764", star: "#FFD54F" },
];

export type GexMapHeatTones = {
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
};

/** Resolved exposure tones: theme-linked palettes follow the live theme vars. */
export function gexMapPaletteTones(palette: GexMapPalette): GexMapHeatTones {
  return palette.useThemeColors
    ? {
        positive: "var(--primary)",
        positiveSoft: "var(--primary)",
        negative: "var(--danger)",
        negativeSoft: "var(--danger)",
      }
    : {
        positive: palette.positive,
        positiveSoft: palette.positiveSoft,
        negative: palette.negative,
        negativeSoft: palette.negativeSoft,
      };
}

export function gexMapPalettesEqual(left: GexMapPalette, right: GexMapPalette) {
  return left.useThemeColors === right.useThemeColors
    && left.positive === right.positive
    && left.positiveSoft === right.positiveSoft
    && left.negative === right.negative
    && left.negativeSoft === right.negativeSoft
    && left.star === right.star;
}
