import { defaultIndicatorSettings } from "@/lib/chartIndicatorConfig";
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
