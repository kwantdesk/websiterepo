/**
 * Gradient schemes for volume profiles.
 *
 * A scheme overrides every body colour on the daily and weekly profiles and
 * fades the whole profile vertically from one colour to another, so the
 * auction reads as a single graded shape rather than a stack of same-coloured
 * rows. While a scheme is active the individual colour pickers are locked —
 * the two endpoints ARE the colour setting, and letting both apply at once
 * would only produce a profile that half-follows a gradient.
 */
export type VolumeProfileGradient = {
  id: string;
  label: string;
  /** Painted at the low end of the profile. */
  from: string;
  /** Painted at the high end, and used for POC and value-area lines. */
  to: string;
};

export const VOLUME_PROFILE_GRADIENT_OFF = "off";

export const VOLUME_PROFILE_GRADIENTS: readonly VolumeProfileGradient[] = [
  /*
   * The DeepChart scheme, matching the "Deep Terminal" theme.
   *
   * Red at the low end and high-voltage green at the high end, so a profile,
   * a footprint cell and an indicator all fade the way that terminal reads:
   * what is being sold at the bottom of the scale, what is being bought at the
   * top, and nothing in between competing for attention.
   */
  { id: "red-terminal-green", label: "Red → Terminal Green", from: "#FF2A2A", to: "#00FF41" },
  { id: "pink-blue", label: "Pink → Blue", from: "#FF2D95", to: "#2D9BFF" },
  { id: "yellow-blue", label: "Yellow → Blue", from: "#FFE83D", to: "#2D6BFF" },
  { id: "orange-green", label: "Orange → Green", from: "#FF7A1A", to: "#22E06B" },
  { id: "red-yellow", label: "Red → Yellow", from: "#FF2D2D", to: "#FFD93D" },
  { id: "black-white", label: "Black → White", from: "#0A0A0A", to: "#FFFFFF" },
  { id: "pink-purple", label: "Pink → Purple", from: "#FF4FD8", to: "#7B2DFF" },
  { id: "cyan-magenta", label: "Cyan → Magenta", from: "#00E5FF", to: "#FF00C8" },
  { id: "lime-teal", label: "Lime → Teal", from: "#C6FF3D", to: "#00C2A8" },
  { id: "violet-amber", label: "Violet → Amber", from: "#8B5CF6", to: "#FFB020" },
  { id: "crimson-indigo", label: "Crimson → Indigo", from: "#FF1F5A", to: "#4B32FF" },
  // Requested by the desk. `from` is the LOW end, so red sits at the bottom of
  // the profile and lime at the top, which is the direction the labels read.
  { id: "red-lime", label: "Red → Lime", from: "#FF0000", to: "#48FF03" },
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const parseHex = (value: string): [number, number, number] | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

/**
 * Blends two hex colours. `amount` is how far to travel from `base` toward
 * `towards`, so 0 returns `base` unchanged. Used to derive a value-area colour
 * that belongs to a gradient scheme without landing on either raw endpoint —
 * black-to-white would otherwise put the value area in near-black on a dark
 * chart. Anything unparseable falls back to `base` rather than throwing.
 */
export function mixHexColors(base: string, towards: string, amount: number): string {
  const a = parseHex(base);
  const b = parseHex(towards);
  if (!a || !b) return base;
  const t = clamp01(amount);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * t);
  return `#${[0, 1, 2].map((index) => channel(index).toString(16).padStart(2, "0")).join("")}`;
}

const BY_ID = new Map(VOLUME_PROFILE_GRADIENTS.map((gradient) => [gradient.id, gradient]));

/** Resolves a stored setting to a scheme, or null when gradients are off. */
export function resolveVolumeProfileGradient(value: unknown): VolumeProfileGradient | null {
  const id = String(value ?? VOLUME_PROFILE_GRADIENT_OFF).trim();
  if (!id || id === VOLUME_PROFILE_GRADIENT_OFF) return null;
  return BY_ID.get(id) ?? null;
}

export function isVolumeProfileGradientActive(value: unknown): boolean {
  return resolveVolumeProfileGradient(value) !== null;
}
