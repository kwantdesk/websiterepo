import {
  VOLUME_PROFILE_GRADIENTS,
  VOLUME_PROFILE_GRADIENT_OFF,
  mixHexColors,
  resolveVolumeProfileGradient,
  type VolumeProfileGradient,
} from "@/lib/volumeProfileGradients";

/**
 * One-click colour schemes for every indicator, not just the profiles.
 *
 * The volume profile and the footprint each grew their own Colours block:
 * a gradient picker, a theme toggle, and a column of individual pickers, all
 * hand-written against that one indicator's option names. Repeating that
 * sixty-five times would be sixty-five chances to spell a key differently, and
 * every new indicator would start with no colour control at all until someone
 * remembered to write another one.
 *
 * So an indicator does not describe its Colours UI. It declares the colour
 * ROLES it paints with - what each one is called, and what it should be when
 * nobody has chosen - and the shared section and the shared resolver do the
 * rest. Adding colour control to a new indicator is then one entry here.
 *
 * The schemes are deliberately the SAME list the profiles use. The owner asked
 * for the palettes already on the footprint, and a second list that drifted
 * from the first would be worse than no list at all.
 */

export type IndicatorColorRole = {
  /** Settings key the chosen colour is stored under. */
  key: string;
  /** What the trader is colouring, in their words. */
  label: string;
  /**
   * The colour when nothing is chosen and no scheme is on.
   *
   * Resolved from the live theme at call time rather than baked in, so an
   * indicator with no explicit choice keeps following the theme exactly as it
   * did before it gained a palette.
   */
  fallback: (theme: IndicatorPaletteTheme) => string;
};

/** The theme values an indicator's default colours are allowed to come from. */
export type IndicatorPaletteTheme = {
  up: string;
  down: string;
  neutral: string;
  accent: string;
  text: string;
};

/**
 * The key every indicator stores its chosen scheme under.
 *
 * Shared with the profiles on purpose: a workspace saved before this existed
 * already carries `gradientPreset` for its profile and footprint panes, and
 * those must keep resolving to the same scheme they always did.
 */
export const INDICATOR_GRADIENT_KEY = "gradientPreset";

export const INDICATOR_GRADIENTS = VOLUME_PROFILE_GRADIENTS;
export const INDICATOR_GRADIENT_OFF = VOLUME_PROFILE_GRADIENT_OFF;

/*
 * Roles per indicator.
 *
 * Ordered as the trader reads them, because that order is what a scheme is
 * spread across: the first role takes the scheme's `from`, the last takes its
 * `to`, and anything between is mixed. Putting "sell" before "buy" would
 * silently invert every scheme on that indicator.
 */
export const INDICATOR_COLOR_ROLES: Readonly<Record<string, readonly IndicatorColorRole[]>> = {
  "cvd-divergence": [
    { key: "bullishColor", label: "Bullish divergence", fallback: (t) => t.up },
    { key: "bearishColor", label: "Bearish divergence", fallback: (t) => t.down },
  ],
  "big-contracts": [
    { key: "bidColor", label: "Sell aggressor", fallback: (t) => t.down },
    { key: "askColor", label: "Buy aggressor", fallback: (t) => t.up },
  ],
  "big-blocks": [
    { key: "bidColor", label: "Sell block", fallback: (t) => t.down },
    { key: "askColor", label: "Buy block", fallback: (t) => t.up },
  ],
};

/** Every indicator that has declared roles, for the settings UI to ask about. */
export function indicatorColorRoles(indicatorId: string): readonly IndicatorColorRole[] {
  return INDICATOR_COLOR_ROLES[indicatorId] ?? [];
}

export function indicatorSupportsPalette(indicatorId: string): boolean {
  return indicatorColorRoles(indicatorId).length > 0;
}

/**
 * The colour for each role, in priority order: scheme, then explicit choice,
 * then the theme.
 *
 * A scheme wins over the individual pickers rather than blending with them.
 * Letting both apply produces an indicator that half-follows the scheme, which
 * reads as a bug every time - the profiles already learned this, and the
 * pickers there are locked while a scheme is on. The same rule holds here so
 * the two behave alike.
 */
export function resolveIndicatorPalette(
  indicatorId: string,
  settings: Record<string, unknown> | null | undefined,
  theme: IndicatorPaletteTheme,
  /**
   * Whether the indicator's own "Theme colours" toggle is currently on.
   *
   * Several indicators shipped with that toggle long before schemes existed,
   * and while it is on their explicit colours are deliberately ignored. The
   * call site knows which of them has one, so it says; guessing from the
   * presence of the key would silently change behaviour for every indicator
   * that has never had the toggle.
   */
  themeLocked = false,
): Record<string, string> {
  const roles = indicatorColorRoles(indicatorId);
  if (!roles.length) return {};
  const gradient = resolveVolumeProfileGradient(settings?.[INDICATOR_GRADIENT_KEY]);
  const resolved: Record<string, string> = {};
  for (const [index, role] of roles.entries()) {
    // A scheme outranks the theme toggle as well: picking one is a deliberate
    // act, and having it silently do nothing because a toggle is on elsewhere
    // in the dialog is the kind of dead control this work exists to remove.
    resolved[role.key] = gradient
      ? gradientStop(gradient, index, roles.length)
      : themeLocked
        ? role.fallback(theme)
        : hexOrNull(settings?.[role.key]) ?? role.fallback(theme);
  }
  return resolved;
}

/**
 * Where a role sits along the scheme.
 *
 * A single-role indicator takes the scheme's `from` rather than dividing by
 * zero, and a two-role one takes the endpoints exactly - which is what makes a
 * scheme on a bid/ask indicator look like the scheme rather than like two
 * muddy midpoints.
 */
export function gradientStop(gradient: VolumeProfileGradient, index: number, count: number): string {
  if (count <= 1 || index <= 0) return gradient.from;
  if (index >= count - 1) return gradient.to;
  return mixHexColors(gradient.from, gradient.to, index / (count - 1));
}

function hexOrNull(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : null;
}
