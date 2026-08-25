import { GEX_MAP_PALETTE_PRESETS, hexLerp } from "@/lib/gexMapPalette";

/**
 * Colour schemes for the Kwant Stats table.
 *
 * The five colours can already be set one at a time, which is fine for a
 * tweak and tedious for a look: matching a positive, a negative, a neutral, a
 * text and a header tone by eye is five pickers and a lot of guessing.
 *
 * The schemes are the desk's existing palettes rather than a new set invented
 * here, so a trader who knows a palette from the GEX Map or a volume profile
 * gets the same colours, and a scheme added later appears everywhere at once
 * instead of in one place.
 */

export type StatsPaletteRoles = {
  id: string;
  label: string;
  positiveColor: string;
  negativeColor: string;
  neutralColor: string;
  textColor: string;
  headerColor: string;
};

/**
 * Text and headers have to stay READABLE on the panel whatever the scheme
 * does, so both are pulled toward the desk's own text tones rather than taken
 * raw. A scheme whose every colour is dark would otherwise print its own
 * numbers invisibly.
 */
const NEUTRAL_TEXT = "#E5E7EB";
const MUTED_TEXT = "#94A3B8";
const HEADER_BASE = "#27272A";

export const STATS_PALETTES: StatsPaletteRoles[] = GEX_MAP_PALETTE_PRESETS.map((preset) => {
  const scale = preset.scale && preset.scale.length
    ? preset.scale
    : [preset.negative, preset.negativeSoft, preset.positiveSoft, preset.positive];
  const bright = scale[scale.length - 1];
  const middle = scale[Math.floor(scale.length / 2)];
  return {
    id: preset.id,
    label: preset.label,
    positiveColor: preset.positive,
    negativeColor: preset.negative,
    // The scheme's midpoint is what "neither side" looks like in it.
    neutralColor: hexLerp(middle, MUTED_TEXT, 0.55),
    textColor: hexLerp(bright, NEUTRAL_TEXT, 0.72),
    // Headers are a background, so they stay dark and only take a hint of the
    // scheme — a bright header behind bright text is unreadable.
    headerColor: hexLerp(HEADER_BASE, middle, 0.22),
  };
});

export const STATS_PALETTE_IDS = STATS_PALETTES.map((palette) => palette.id);

export function resolveStatsPalette(id: string | undefined): StatsPaletteRoles | null {
  if (!id) return null;
  return STATS_PALETTES.find((palette) => palette.id === id) ?? null;
}

/**
 * The settings a palette writes.
 *
 * `useThemeColors` goes off with it: leaving it on would keep the chart theme
 * in charge and the chosen scheme would do nothing at all, which is exactly
 * the sort of control that looks broken.
 */
export function statsPaletteSettings(palette: StatsPaletteRoles): Record<string, string | boolean> {
  return {
    useThemeColors: false,
    statsPaletteId: palette.id,
    positiveColor: palette.positiveColor,
    negativeColor: palette.negativeColor,
    neutralColor: palette.neutralColor,
    textColor: palette.textColor,
    headerColor: palette.headerColor,
  };
}
