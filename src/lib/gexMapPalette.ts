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
  /** Ten explicit call-side colours, index 0 = 10th percentile (darkest) through index 9 = 100th (brightest). */
  positiveStops?: string[];
  /** Ten explicit put-side colours, same percentile ordering. */
  negativeStops?: string[];
  /**
   * Ten explicit colours forming one diverging signed-exposure scale:
   * index 0 = most extreme negative (darkest) … index 9 = most extreme
   * positive (lightest), with the middle slots holding the average noise.
   */
  scaleStops?: string[];
};

export const GEX_MAP_STOP_COUNT = 10;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function channelHex(value: number) {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0").toUpperCase();
}

export function hexLerp(from: string, to: string, ratio: number): string {
  const parse = (hex: string) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
  const t = clamp01(ratio);
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  return `#${channelHex(r1 + (r2 - r1) * t)}${channelHex(g1 + (g2 - g1) * t)}${channelHex(b1 + (b2 - b1) * t)}`;
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = clamp01(saturation / 100);
  const l = clamp01(lightness / 100);
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${channelHex(channel(0) * 255)}${channelHex(channel(8) * 255)}${channelHex(channel(4) * 255)}`;
}

/**
 * Colour for a position on the drag bar: black at the far left, a full hue
 * sweep through the middle, white at the far right — every colour reachable
 * with one horizontal drag.
 */
export function gexMapDragBarColor(ratio: number): string {
  const r = clamp01(ratio);
  if (r < 0.08) return hexLerp("#000000", hslToHex(0, 95, 52), r / 0.08);
  if (r > 0.92) return hexLerp(hslToHex(300, 95, 52), "#FFFFFF", (r - 0.92) / 0.08);
  return hslToHex(((r - 0.08) / 0.84) * 300, 95, 52);
}

/** CSS track background matching gexMapDragBarColor's mapping. */
export const GEX_MAP_DRAG_BAR_TRACK =
  "linear-gradient(90deg, #000000 0%, #F62D2D 8%, #F6F62D 24.8%, #2DF62D 41.6%, #2DF6F6 58.4%, #2D2DF6 75.2%, #F62DF6 92%, #FFFFFF 100%)";

/**
 * One diverging ten-colour scale across signed exposure. Slot one is the
 * most extreme negative — the darkest colour on the map, barely off black.
 * Slots ramp brighter toward the middle where average/noise exposure sits
 * muted, then the positive side climbs to the palette's full bright tone,
 * and slot ten is lifted toward white so the most extreme positive is
 * unmistakably the lightest thing on the surface.
 */
export function buildGexMapSignedScale(negative: string, positive: string): string[] {
  return [
    hexLerp("#000000", negative, 0.26),
    hexLerp("#000000", negative, 0.42),
    hexLerp("#000000", negative, 0.58),
    hexLerp("#000000", negative, 0.72),
    hexLerp("#000000", negative, 0.86),
    hexLerp("#000000", positive, 0.58),
    hexLerp("#000000", positive, 0.72),
    hexLerp("#000000", positive, 0.86),
    positive.toUpperCase(),
    hexLerp(positive, "#FFFFFF", 0.38),
  ];
}

/**
 * The ten renderable signed-scale colours. Custom-edited slots win; otherwise
 * the scale is generated from the palette's strong tones. Theme mode derives
 * the same shape from the live theme accents.
 */
export function gexMapSignedScale(palette: GexMapPalette): string[] {
  if (palette.useThemeColors) {
    return [
      "color-mix(in srgb, var(--danger) 26%, black)",
      "color-mix(in srgb, var(--danger) 42%, black)",
      "color-mix(in srgb, var(--danger) 58%, black)",
      "color-mix(in srgb, var(--danger) 72%, black)",
      "color-mix(in srgb, var(--danger) 86%, black)",
      "color-mix(in srgb, var(--primary) 58%, black)",
      "color-mix(in srgb, var(--primary) 72%, black)",
      "color-mix(in srgb, var(--primary) 86%, black)",
      "var(--primary)",
      "color-mix(in srgb, var(--primary) 62%, white)",
    ];
  }
  const explicit = Array.isArray(palette.scaleStops)
    && palette.scaleStops.length === GEX_MAP_STOP_COUNT
    && palette.scaleStops.every((stop) => /^#[0-9a-fA-F]{6}$/.test(stop))
    ? palette.scaleStops.map((stop) => stop.toUpperCase())
    : null;
  return explicit ?? buildGexMapSignedScale(palette.negative, palette.positive);
}

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
  const stops = (candidate: unknown): string[] | undefined =>
    Array.isArray(candidate)
      && candidate.length === GEX_MAP_STOP_COUNT
      && candidate.every((stop) => typeof stop === "string" && /^#[0-9a-fA-F]{6}$/.test(stop))
      ? candidate.map((stop) => (stop as string).toUpperCase())
      : undefined;
  const positiveStops = stops(parsed.positiveStops);
  const negativeStops = stops(parsed.negativeStops);
  const scaleStops = stops(parsed.scaleStops);
  const legacyId = LEGACY_PRESET_SIGNATURES[`${positive}|${positiveSoft}|${negative}|${negativeSoft}`];
  const upgraded = !positiveStops && !negativeStops && !scaleStops && legacyId
    ? GEX_MAP_PALETTE_PRESETS.find((preset) => preset.id === legacyId)
    : undefined;
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
    ...(positiveStops ? { positiveStops } : {}),
    ...(negativeStops ? { negativeStops } : {}),
    ...(scaleStops ? { scaleStops } : {}),
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
  /** Explicit ten-anchor signed scale for colormaps the two-tone generator cannot reproduce. */
  scale?: string[];
}> = [
  {
    id: "viridis",
    label: "Viridis",
    positive: "#FDE725",
    positiveSoft: "#35B779",
    negative: "#31688E",
    negativeSoft: "#440154",
    star: "#FFFFFF",
    scale: ["#440154", "#482878", "#3E4989", "#31688E", "#26828E", "#1F9E89", "#35B779", "#6DCD59", "#B4DE2C", "#FDE725"],
  },
  { id: "ultraviolet", label: "Ultraviolet", positive: "#A3E635", positiveSoft: "#365314", negative: "#A855F7", negativeSoft: "#4C1D95", star: "#F5F3FF" },
  { id: "forest", label: "Forest", positive: "#22C55E", positiveSoft: "#14532D", negative: "#FB923C", negativeSoft: "#7C2D12", star: "#FEF08A" },
  { id: "rocket", label: "Rocket", positive: "#F37651", positiveSoft: "#7A1E48", negative: "#C9366F", negativeSoft: "#43123B", star: "#F6B48F" },
  { id: "inferno", label: "Inferno", positive: "#FCA50A", positiveSoft: "#78240B", negative: "#B63679", negativeSoft: "#2A0A4A", star: "#FCFFA4" },
  { id: "icefire", label: "Icefire", positive: "#E64A45", positiveSoft: "#5C1130", negative: "#4DD0E1", negativeSoft: "#123F63", star: "#F8FAFC" },
  { id: "spectrum", label: "Spectrum", positive: "#FF5252", positiveSoft: "#7F1D1D", negative: "#42A5F5", negativeSoft: "#0D3B66", star: "#FFEB3B" },
  { id: "amethyst", label: "Amethyst", positive: "#A78BFA", positiveSoft: "#3B0764", negative: "#F0ABFC", negativeSoft: "#701A75", star: "#FFFFFF" },
  { id: "thermal", label: "Thermal", positive: "#F97316", positiveSoft: "#7C2D12", negative: "#4FC3F7", negativeSoft: "#0C4A6E", star: "#F9C74F" },
  { id: "solar", label: "Solar", positive: "#FBBF24", positiveSoft: "#78350F", negative: "#A855F7", negativeSoft: "#3B0764", star: "#FFD54F" },
  { id: "magma", label: "Magma", positive: "#FCFDBF", positiveSoft: "#DE4968", negative: "#3B0F70", negativeSoft: "#000004", star: "#FFFFFF",
    scale: ["#000004", "#140E36", "#3B0F70", "#641A80", "#8C2981", "#B73779", "#DE4968", "#F7705C", "#FE9F6D", "#FCFDBF"] },
  { id: "plasma", label: "Plasma", positive: "#F0F921", positiveSoft: "#CC4778", negative: "#8F0DA4", negativeSoft: "#0D0887", star: "#FFFFFF",
    scale: ["#0D0887", "#41049D", "#6A00A8", "#8F0DA4", "#B12A90", "#CC4778", "#E16462", "#F1834B", "#FCA636", "#F0F921"] },
  { id: "inferno-deep", label: "Inferno Deep", positive: "#F6D746", positiveSoft: "#DD513A", negative: "#6A176E", negativeSoft: "#000004", star: "#FFFFFF",
    scale: ["#000004", "#160B39", "#420A68", "#6A176E", "#932667", "#BC3754", "#DD513A", "#F37819", "#FCA50A", "#F6D746"] },
  { id: "cividis", label: "Cividis", positive: "#FDEA45", positiveSoft: "#A59C74", negative: "#3B496C", negativeSoft: "#00224E", star: "#FFFFFF",
    scale: ["#00224E", "#123570", "#3B496C", "#575D6D", "#707173", "#8A8678", "#A59C74", "#C3B369", "#E1CC55", "#FDEA45"] },
  { id: "mako", label: "Mako", positive: "#DEF5E5", positiveSoft: "#48A2B3", negative: "#3B2D59", negativeSoft: "#0B0405", star: "#FFFFFF",
    scale: ["#0B0405", "#241832", "#3B2D59", "#43427E", "#3F5EA9", "#3D7CB8", "#48A2B3", "#63C4A6", "#9BDDB2", "#DEF5E5"] },
  { id: "rocket-deep", label: "Rocket Deep", positive: "#FAEBDD", positiveSoft: "#E8715F", negative: "#58163B", negativeSoft: "#03051A", star: "#FFFFFF",
    scale: ["#03051A", "#2A1636", "#58163B", "#841E3C", "#AF2A35", "#D24644", "#E8715F", "#F49A80", "#FAC4A6", "#FAEBDD"] },
  { id: "ember", label: "Ember", positive: "#FFF3B0", positiveSoft: "#F08A2C", negative: "#5C1A0F", negativeSoft: "#0A0302", star: "#FFFFFF",
    scale: ["#0A0302", "#33110B", "#5C1A0F", "#8A2A10", "#B54413", "#D9651C", "#F08A2C", "#FBAF44", "#FFD166", "#FFF3B0"] },
  { id: "ocean", label: "Ocean", positive: "#F0FDFF", positiveSoft: "#90E0EF", negative: "#0077B6", negativeSoft: "#03045E", star: "#FFD166",
    scale: ["#03045E", "#023E8A", "#0077B6", "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF", "#ADE8F4", "#CAF0F8", "#F0FDFF"] },
  { id: "arctic", label: "Arctic", positive: "#FFFFFF", positiveSoft: "#9ED4EA", negative: "#1D5A8A", negativeSoft: "#0B1D3A", star: "#FFD166",
    scale: ["#0B1D3A", "#123A63", "#1D5A8A", "#2E7BAE", "#4C9CC9", "#74BCDD", "#9ED4EA", "#C4E6F3", "#E2F3FA", "#FFFFFF"] },
  { id: "matrix", label: "Matrix", positive: "#EFFFEF", positiveSoft: "#5CF08D", negative: "#076235", negativeSoft: "#01100A", star: "#FFFFFF",
    scale: ["#01100A", "#04331D", "#076235", "#0B8F4B", "#17B45F", "#2ED874", "#5CF08D", "#94F7AC", "#C6FBCB", "#EFFFEF"] },
  { id: "hot-pink", label: "Hot Pink", positive: "#FFE9F3", positiveSoft: "#F75E9C", negative: "#6B0E3E", negativeSoft: "#1B0210", star: "#FFFFFF",
    scale: ["#1B0210", "#3F0725", "#6B0E3E", "#970F55", "#C31768", "#E7307E", "#F75E9C", "#FC8DBB", "#FEBCD8", "#FFE9F3"] },
  { id: "royal", label: "Royal", positive: "#FFE45C", positiveSoft: "#C87FB4", negative: "#3A2087", negativeSoft: "#120A2E", star: "#FFFFFF",
    scale: ["#120A2E", "#241458", "#3A2087", "#5530AE", "#7C46C4", "#A560C9", "#C87FB4", "#E5A17F", "#F7C452", "#FFE45C"] },
  { id: "copper", label: "Copper", positive: "#FCD597", positiveSoft: "#BD7231", negative: "#421F12", negativeSoft: "#0A0604", star: "#FFFFFF",
    scale: ["#0A0604", "#26150C", "#421F12", "#603118", "#7F441F", "#9E5926", "#BD7231", "#D98E44", "#EFAF63", "#FCD597"] },
  { id: "steel", label: "Steel", positive: "#EDF0F3", positiveSoft: "#87939F", negative: "#2C343D", negativeSoft: "#0B0D10", star: "#F5D90A",
    scale: ["#0B0D10", "#1B2026", "#2C343D", "#3F4A55", "#545F6C", "#6C7885", "#87939F", "#A5AFB9", "#C6CDD4", "#EDF0F3"] },
  { id: "crimson-jade", label: "Crimson Jade", positive: "#9FF0A6", positiveSoft: "#5FA349", negative: "#9E2432", negativeSoft: "#450A12", star: "#FFFFFF",
    scale: ["#450A12", "#73121F", "#9E2430", "#C93F41", "#C96F4B", "#9C8B44", "#5FA349", "#2FB456", "#4FD077", "#9FF0A6"] },
  { id: "sunset", label: "Sunset", positive: "#FEE08B", positiveSoft: "#F06A5B", negative: "#6B1F8A", negativeSoft: "#1F0B3E", star: "#FFFFFF",
    scale: ["#1F0B3E", "#43156B", "#6B1F8A", "#951F92", "#BC2E88", "#DB4A74", "#F06A5B", "#FA8F49", "#FEB63E", "#FEE08B"] },
  { id: "gold", label: "Gold", positive: "#FFF2A6", positiveSoft: "#D0A827", negative: "#4C3D0D", negativeSoft: "#131006", star: "#FFFFFF",
    scale: ["#131006", "#2E2609", "#4C3D0D", "#6C5511", "#8E7016", "#B08C1D", "#D0A827", "#E9C336", "#F9DC4F", "#FFF2A6"] },
  { id: "lagoon", label: "Lagoon", positive: "#E9FBF0", positiveSoft: "#52C7AA", negative: "#0B5750", negativeSoft: "#04201F", star: "#FFD166",
    scale: ["#04201F", "#073B37", "#0B5750", "#117368", "#1B9080", "#2FAC96", "#52C7AA", "#82DDBE", "#B7EED5", "#E9FBF0"] },
  { id: "violet-storm", label: "Violet Storm", positive: "#F6E9FF", positiveSoft: "#AC71E9", negative: "#3E1173", negativeSoft: "#100323", star: "#F5D90A",
    scale: ["#100323", "#26094B", "#3E1173", "#571C9A", "#7230BE", "#8F4DD9", "#AC71E9", "#C898F4", "#E1C1FB", "#F6E9FF"] },
  { id: "flare", label: "Flare", positive: "#F9DA95", positiveSoft: "#EE7E51", negative: "#7A2248", negativeSoft: "#25131C", star: "#FFFFFF",
    scale: ["#25131C", "#4E1A34", "#7A2248", "#A62E51", "#CB4154", "#E25D50", "#EE7E51", "#F49E5C", "#F7BD72", "#F9DA95"] },
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
  const stopsEqual = (a?: string[], b?: string[]) =>
    (a === undefined && b === undefined)
    || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((stop, index) => stop === b[index]));
  return left.useThemeColors === right.useThemeColors
    && left.positive === right.positive
    && left.positiveSoft === right.positiveSoft
    && left.negative === right.negative
    && left.negativeSoft === right.negativeSoft
    && left.star === right.star
    && stopsEqual(left.positiveStops, right.positiveStops)
    && stopsEqual(left.negativeStops, right.negativeStops)
    && stopsEqual(left.scaleStops, right.scaleStops);
}
