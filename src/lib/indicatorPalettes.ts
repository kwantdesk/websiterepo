import {
  VOLUME_PROFILE_GRADIENTS,
  VOLUME_PROFILE_GRADIENT_OFF,
  mixHexColors,
  resolveVolumeProfileGradient,
  type VolumeProfileGradient,
} from "@/lib/volumeProfileGradients";
import { INDICATOR_PLOT_COLOR_SLOTS, type IndicatorThemeRole } from "@/lib/indicatorPlotColors";

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
/** The theme colour each plot-slot role falls back to. */
const THEME_FOR_ROLE: Record<IndicatorThemeRole, (theme: IndicatorPaletteTheme) => string> = {
  primary: (t) => t.up,
  secondary: (t) => t.accent,
  positive: (t) => t.up,
  negative: (t) => t.down,
  muted: (t) => t.neutral,
};

/**
 * "upper1Color" reads as "Upper 1"; "plotColor" as "Plot".
 *
 * The keys are already derived from the series the engine returns, so a label
 * built from the key names the same thing the study plots - and a study that
 * gains a series gets a labelled picker without anyone writing one.
 */
function labelForKey(key: string): string {
  const words = key
    .replace(/Color$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/(\d+)/g, " $1")
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1).toLowerCase() : "Colour";
}

/*
 * Roles for every study that plots a series, GENERATED from the same registry
 * the engine paints from.
 *
 * Hand-listing them was the mistake this replaces: three studies were given
 * schemes and the other twenty-three were not, which is exactly the drift a
 * second list invites. Generating them means an indicator cannot have a
 * picker the engine ignores, or a plotted series with no picker.
 */
const GENERATED_ROLES: Record<string, IndicatorColorRole[]> = Object.fromEntries(
  Object.entries(INDICATOR_PLOT_COLOR_SLOTS).map(([indicatorId, slots]) => [
    indicatorId,
    slots.map((slot) => ({
      key: slot.key,
      label: labelForKey(slot.key),
      fallback: THEME_FOR_ROLE[slot.role],
    })),
  ]),
);

/*
 * Studies that paint through a canvas primitive rather than the series engine.
 * They have no plot slots, so their roles are named here.
 */
const PRIMITIVE_ROLES: Record<string, IndicatorColorRole[]> = {
  /*
   * The price series itself. Ordered falling-then-rising so a scheme reads the
   * way it does everywhere else, and keyed to match `CANDLE_SETTING_KEYS` - the
   * candle resolver reads the same settings object this writes.
   */
  candles: [
    { key: "candleDownColor", label: "Down body", fallback: (t) => t.down },
    { key: "candleBorderDownColor", label: "Down border", fallback: (t) => t.down },
    { key: "candleWickDownColor", label: "Down wick", fallback: (t) => t.down },
    { key: "candleWickUpColor", label: "Up wick", fallback: (t) => t.up },
    { key: "candleBorderUpColor", label: "Up border", fallback: (t) => t.up },
    { key: "candleUpColor", label: "Up body", fallback: (t) => t.up },
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

export const INDICATOR_COLOR_ROLES: Readonly<Record<string, readonly IndicatorColorRole[]>> = {
  ...GENERATED_ROLES,
  // A hand-written entry wins, so a study can carry better labels than the key
  // alone gives - "Bullish divergence" rather than "Bullish".
  ...PRIMITIVE_ROLES,
  "cvd-divergence": [
    { key: "plotColor", label: "CVD line", fallback: (t) => t.up },
    { key: "bullishColor", label: "Bullish divergence", fallback: (t) => t.up },
    { key: "bearishColor", label: "Bearish divergence", fallback: (t) => t.down },
  ],
};

/**
 * The theme colour a settings key is asking for, read from its own name.
 *
 * Studies drawn on a canvas keep their colours in their own settings rather
 * than in the plot registry - imbalance tracker, big trades, footprint, TPO,
 * the profiles, the DOM, the levels. Forty-two of them had no scheme at all
 * because the generated roles only covered the series studies.
 *
 * The names are consistent enough to read: an askColor is the buying side, a
 * bidColor the selling side. Anything unrecognised falls to neutral, which is
 * what an untouched study already painted.
 */
function inferredFallback(key: string): (theme: IndicatorPaletteTheme) => string {
  const name = key.toLowerCase();
  if (/(up|positive|buy|ask|bull|call|support|gain|profit|high)/.test(name)) return (t) => t.up;
  if (/(down|negative|sell|bid|bear|put|resist|loss|low)/.test(name)) return (t) => t.down;
  if (/(text|label|font)/.test(name)) return (t) => t.text;
  if (/(accent|highlight|star|king|poc|marker)/.test(name)) return (t) => t.accent;
  return (t) => t.neutral;
}

const inferredRoles = new Map<string, IndicatorColorRole[]>();

/**
 * Roles for a study that keeps its colours in its own settings.
 *
 * Derived on first use from the keys the study actually declares, so a study
 * gains a scheme by having colours rather than by being remembered - which is
 * the whole reason forty-two of them were missed the first time.
 */
export function inferIndicatorColorRoles(
  indicatorId: string,
  defaultSettings: Record<string, unknown>,
): readonly IndicatorColorRole[] {
  const cached = inferredRoles.get(indicatorId);
  if (cached) return cached;
  const roles = Object.keys(defaultSettings)
    .filter((key) => /colou?r$/i.test(key))
    .map((key) => ({ key, label: labelForKey(key), fallback: inferredFallback(key) }));
  inferredRoles.set(indicatorId, roles);
  return roles;
}

/** Every indicator that has declared roles, for the settings UI to ask about. */
export function indicatorColorRoles(indicatorId: string): readonly IndicatorColorRole[] {
  return INDICATOR_COLOR_ROLES[indicatorId] ?? inferredRoles.get(indicatorId) ?? [];
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
  /*
   * The study's roles, when the caller already knows them.
   *
   * Without this the resolver read a lazily-filled cache that only the settings
   * dialog warmed, so a scheme resolved to nothing on any chart whose dialog
   * had not been opened - the picker was there and did nothing, which is the
   * exact failure this work exists to remove.
   */
  knownRoles?: readonly IndicatorColorRole[],
): Record<string, string> {
  const roles = knownRoles ?? indicatorColorRoles(indicatorId);
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
  // A study that plots ONE series takes the scheme's finishing colour, not its
  // starting one. Picking "Red -> Terminal Green" for a lone VWAP line and
  // getting the dark red reads as the wrong scheme entirely; the end of the
  // ramp is what a trader means by "that colour".
  if (count <= 1) return gradient.to;
  if (index <= 0) return gradient.from;
  if (index >= count - 1) return gradient.to;
  return mixHexColors(gradient.from, gradient.to, index / (count - 1));
}

function hexOrNull(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : null;
}
