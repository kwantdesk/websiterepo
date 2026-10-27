import { INDICATOR_GRADIENT_SCHEMES } from "../../public/shared/indicator-gradients.js";

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

export const VOLUME_PROFILE_GRADIENTS: readonly VolumeProfileGradient[] = INDICATOR_GRADIENT_SCHEMES;

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
