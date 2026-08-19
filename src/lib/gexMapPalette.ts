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
  positiveSoft: "#14532D",
  negative: "#EF4444",
  negativeSoft: "#7F1D1D",
  star: "#F5D90A",
};

export const GEX_MAP_PALETTE_STORAGE_KEY = "kwantdesk:gex-map-palette:v1";
export const GEX_MAP_PALETTE_CHANGE_EVENT = "kwantdesk:gexmap-palette-change";

// Saved copies of retired curated stop-sets upgrade to the corrected
// dark→bright ramps automatically. Hand-picked custom colours never match a
// legacy signature and pass through untouched.
const LEGACY_PRESET_SIGNATURES: Record<string, string> = {
  "#A3E635|#4D7C0F|#A855F7|#6B21A8": "ultraviolet",
  "#22C55E|#15803D|#FB923C|#C2410C": "forest",
  "#F37651|#C9366F|#701F57|#43123B": "rocket",
  "#FCA50A|#DD513A|#932667|#4A0C6B": "inferno",
  "#E64A45|#8E2043|#4DD0E1|#1A6FA8": "icefire",
  "#E53935|#F9A825|#1E88E5|#26C6DA": "spectrum",
  "#6D28D9|#8B5CF6|#A78BFA|#DDD6FE": "amethyst",
  "#E4572E|#F9C74F|#2E86C1|#7FBFDF": "thermal",
  "#F59E0B|#B45309|#6A0DAD|#3B0764": "solar",
};

export function normalizeGexMapPalette(value: unknown): GexMapPalette {
  if (!value || typeof value !== "object") return { ...DEFAULT_GEX_MAP_PALETTE };
  const parsed = value as Partial<GexMapPalette>;
  const hex = (candidate: unknown, fallback: string) =>
    typeof candidate === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback;
  const positive = hex(parsed.positive, DEFAULT_GEX_MAP_PALETTE.positive);
  const negative = hex(parsed.negative, DEFAULT_GEX_MAP_PALETTE.negative);
  const positiveSoft = hex(parsed.positiveSoft, positive);
  const negativeSoft = hex(parsed.negativeSoft, negative);
  const star = hex(parsed.star, DEFAULT_GEX_MAP_PALETTE.star);
  const legacyId = LEGACY_PRESET_SIGNATURES[`${positive}|${positiveSoft}|${negative}|${negativeSoft}`];
  const upgraded = legacyId ? GEX_MAP_PALETTE_PRESETS.find((preset) => preset.id === legacyId) : undefined;
  if (upgraded) {
    return {
      useThemeColors: parsed.useThemeColors !== false,
      positive: upgraded.positive,
      positiveSoft: upgraded.positiveSoft,
      negative: upgraded.negative,
      negativeSoft: upgraded.negativeSoft,
      star,
    };
  }
  return {
    useThemeColors: parsed.useThemeColors !== false,
    positive,
    positiveSoft,
    negative,
    negativeSoft,
    star,
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
 * Curated gradient palettes following classic scientific heat colormaps.
 * Every side of the surface is a strict brightness ramp: the soft stop is the
 * DARK shade the lowest signed exposure sits at, the strong stop is the
 * BRIGHT tone reserved for the highest exposure, and the renderer anchors the
 * very bottom of each ramp near black — so magnitude always reads as
 * dark → bright regardless of palette or theme.
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
  { id: "ultraviolet", label: "Ultraviolet", positive: "#A3E635", positiveSoft: "#365314", negative: "#A855F7", negativeSoft: "#4C1D95", star: "#F5F3FF" },
  { id: "forest", label: "Forest", positive: "#22C55E", positiveSoft: "#14532D", negative: "#FB923C", negativeSoft: "#7C2D12", star: "#FEF08A" },
  { id: "rocket", label: "Rocket", positive: "#F37651", positiveSoft: "#7A1E48", negative: "#C9366F", negativeSoft: "#43123B", star: "#F6B48F" },
  { id: "inferno", label: "Inferno", positive: "#FCA50A", positiveSoft: "#78240B", negative: "#B63679", negativeSoft: "#2A0A4A", star: "#FCFFA4" },
  { id: "icefire", label: "Icefire", positive: "#E64A45", positiveSoft: "#5C1130", negative: "#4DD0E1", negativeSoft: "#123F63", star: "#F8FAFC" },
  { id: "spectrum", label: "Spectrum", positive: "#FF5252", positiveSoft: "#7F1D1D", negative: "#42A5F5", negativeSoft: "#0D3B66", star: "#FFEB3B" },
  { id: "amethyst", label: "Amethyst", positive: "#A78BFA", positiveSoft: "#3B0764", negative: "#F0ABFC", negativeSoft: "#701A75", star: "#FFFFFF" },
  { id: "thermal", label: "Thermal", positive: "#F97316", positiveSoft: "#7C2D12", negative: "#4FC3F7", negativeSoft: "#0C4A6E", star: "#F9C74F" },
  { id: "solar", label: "Solar", positive: "#FBBF24", positiveSoft: "#78350F", negative: "#A855F7", negativeSoft: "#3B0764", star: "#FFD54F" },
];

export type GexMapHeatTones = {
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
};

/** Resolved exposure tones: theme-linked palettes follow the live theme vars.
 * Theme mode derives its dark low stops from the theme accents so the surface
 * still ramps dark → bright with exposure on every theme. */
export function gexMapPaletteTones(palette: GexMapPalette): GexMapHeatTones {
  return palette.useThemeColors
    ? {
        positive: "var(--primary)",
        positiveSoft: "color-mix(in srgb, var(--primary) 34%, black)",
        negative: "var(--danger)",
        negativeSoft: "color-mix(in srgb, var(--danger) 34%, black)",
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
