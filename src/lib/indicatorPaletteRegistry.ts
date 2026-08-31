import { defaultIndicatorSettings } from "@/lib/chartIndicatorConfig";
import type { ChartSettings } from "@/lib/chartSettings";
import {
  INDICATOR_COLOR_ROLES,
  INDICATOR_GRADIENT_KEY,
  inferIndicatorColorRoles,
  resolveIndicatorPalette,
  type IndicatorColorRole,
  type IndicatorPaletteTheme,
} from "@/lib/indicatorPalettes";

/**
 * The one place that answers "what colours does this study have".
 *
 * There are three kinds and they were being treated as one. A series study
 * declares its colours in the plot registry; a canvas study keeps them in its
 * own settings; a couple are hand-named because a key alone reads badly. The
 * first pass only generated roles from the plot registry, so twenty-six studies
 * gained schemes and forty-two did not - imbalance tracker, big trades, the
 * footprint, the TPOs, the profiles, the DOM and the levels among them.
 *
 * This joins the three so a study cannot be missed for being the wrong kind.
 */
export function paletteRolesFor(indicatorId: string): readonly IndicatorColorRole[] {
  const cached = merged.get(indicatorId);
  if (cached) return cached;

  let defaults: Record<string, unknown> = {};
  try {
    defaults = (defaultIndicatorSettings(indicatorId) ?? {}) as Record<string, unknown>;
  } catch {
    // A study whose defaults throw has nothing to offer; it simply gets none.
    return [];
  }

  /*
   * Declared roles first, then every colour the study declares that they did
   * not cover.
   *
   * A declared list used to win outright, which quietly capped a study at the
   * colours someone had written down: cumulative volume delta declares one plot
   * colour and carries eight, so a scheme recoloured one of its eight and left
   * the rest. Hand-written entries exist to give a better LABEL than a key
   * does - "Bullish divergence" rather than "Bullish" - not to decide how much
   * of a study a scheme reaches.
   */
  const declared = INDICATOR_COLOR_ROLES[indicatorId] ?? [];
  const seen = new Set(declared.map((role) => role.key));
  const roles = [
    ...declared,
    ...inferIndicatorColorRoles(indicatorId, defaults).filter((role) => !seen.has(role.key)),
  ];
  merged.set(indicatorId, roles);
  return roles;
}

const merged = new Map<string, IndicatorColorRole[]>();

export function supportsPalette(indicatorId: string): boolean {
  return paletteRolesFor(indicatorId).length > 0;
}

/**
 * A study's settings with its chosen scheme resolved into them.
 *
 * Applied once where the indicator list enters the chart, so every renderer
 * downstream reads scheme colours without knowing schemes exist. A canvas
 * study reads `settings.askColor` directly and there is no single drawing seam
 * to intercept the way the series engine has one - the settings ARE the seam.
 *
 * Returns the SAME object when no scheme is set, so React sees no change and
 * nothing rerenders for a feature nobody turned on.
 */
export function settingsWithPalette<T extends { indicatorId: string; settings?: Record<string, unknown> | null }>(
  instance: T,
  theme: IndicatorPaletteTheme,
): T {
  const settings = instance.settings;
  if (!settings || !settings[INDICATOR_GRADIENT_KEY]) return instance;
  // The roles are looked up here rather than left to a cache the dialog fills,
  // so a scheme works on a chart whose settings have never been opened.
  const resolved = resolveIndicatorPalette(
    instance.indicatorId,
    settings,
    theme,
    settings.useThemeColors === true,
    paletteRolesFor(instance.indicatorId),
  );
  if (!Object.keys(resolved).length) return instance;
  return { ...instance, settings: { ...settings, ...resolved } };
}

/*
 * Two themes that disagree on every colour they carry.
 *
 * Which of a study's colour keys actually come from the theme is discovered by
 * building its own defaults under both and seeing which ones move. That is
 * better than reading the key names: `tokyoColor` and `londonColor` are
 * session identities that must stay distinct, `neutralColor` genuinely should
 * follow the theme, and no naming rule separates those two cases reliably. The
 * study's own default derivation already knows, so it is asked.
 */
const PROBE_THEME_A = {
  upColor: "#111111", downColor: "#222222", borderUpColor: "#333333",
  borderDownColor: "#444444", wickUpColor: "#555555", wickDownColor: "#666666",
  gridColor: "#777777", chartBackground: "#888888", textColor: "#999999",
} as unknown as ChartSettings;
const PROBE_THEME_B = {
  upColor: "#aa1111", downColor: "#bb2222", borderUpColor: "#cc3333",
  borderDownColor: "#dd4444", wickUpColor: "#ee5555", wickDownColor: "#ff6666",
  gridColor: "#a17777", chartBackground: "#b18888", textColor: "#c19999",
} as unknown as ChartSettings;

const themeDerivedByIndicator = new Map<string, ReadonlySet<string>>();

/** The colour keys a study derives from the theme rather than fixing itself. */
export function themeDerivedColorKeys(indicatorId: string): ReadonlySet<string> {
  const cached = themeDerivedByIndicator.get(indicatorId);
  if (cached) return cached;
  let keys: Set<string>;
  try {
    const a = defaultIndicatorSettings(indicatorId, PROBE_THEME_A) as Record<string, unknown>;
    const b = defaultIndicatorSettings(indicatorId, PROBE_THEME_B) as Record<string, unknown>;
    keys = new Set(
      Object.keys(a).filter((key) => /colou?r$/i.test(key) && a[key] !== b[key]),
    );
  } catch {
    // A study whose defaults throw keeps whatever it was given.
    keys = new Set();
  }
  themeDerivedByIndicator.set(indicatorId, keys);
  return keys;
}

/**
 * A study's settings with the current theme's colours in them.
 *
 * Colours were seeded from the theme ONCE, when the indicator was added, and
 * never re-derived. Changing theme afterwards moved the candles and left every
 * study behind - Volume and CVD among them - because the only studies that
 * followed were the handful with a hand-written block in `Chart.tsx`. The
 * generic seam below could not do it: it returned early unless a gradient
 * scheme was set, so with the scheme Off, which is the normal state, it did
 * nothing at all.
 *
 * Only the keys the study itself derives from the theme are rewritten, so
 * session identities and regime colours keep their meaning. `useThemeColors:
 * false` - which picking a colour sets - opts an instance out entirely.
 *
 * Returns the SAME object when nothing changes, so a chart already on the
 * right theme rerenders exactly as often as it did before.
 */
export function settingsWithThemeColours<T extends { indicatorId: string; settings?: Record<string, unknown> | null }>(
  instance: T,
  chartSettings: ChartSettings,
): T {
  const settings = instance.settings;
  if (!settings || settings.useThemeColors === false) return instance;
  const keys = themeDerivedColorKeys(instance.indicatorId);
  if (!keys.size) return instance;
  let next: Record<string, unknown> | null = null;
  try {
    const themed = defaultIndicatorSettings(instance.indicatorId, chartSettings) as Record<string, unknown>;
    for (const key of keys) {
      const colour = themed[key];
      if (typeof colour !== "string" || settings[key] === colour) continue;
      next = next ?? { ...settings };
      next[key] = colour;
    }
  } catch {
    return instance;
  }
  return next ? { ...instance, settings: next } : instance;
}
