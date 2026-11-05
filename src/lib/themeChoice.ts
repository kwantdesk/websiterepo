import { CHART_SETTINGS_STORAGE_KEY, normalizeChartSettings, retainLocalChartAppearance, type ChartSettings } from "./chartSettings.ts";

export const THEME_CHOICE_KEY = "kwantdesk:theme-choice:v1";
const THEME_KEY = "olisa-theme";

type ThemeChoice = {
  at: number;
  theme: string | null;
  chart: ChartSettings;
};

function readChoice(raw?: string | null): ThemeChoice | null {
  if (!raw) return null;
  try {
    const choice = JSON.parse(raw) as ThemeChoice;
    if (!Number.isSafeInteger(choice.at) || choice.at <= 0
      || (choice.theme !== null && typeof choice.theme !== "string")
      || !choice.chart || typeof choice.chart !== "object") return null;
    return choice;
  } catch {
    return null;
  }
}

export function serializeThemeChoice(previous: string | null, theme: string | null, chart: ChartSettings) {
  const at = Math.max(Date.now(), (readChoice(previous)?.at ?? 0) + 1);
  return JSON.stringify({ at, theme, chart } satisfies ThemeChoice);
}

/** Resolve explicit choices by their own revision, independent of workspace edits. */
export function reconcileThemeChoice(values: Record<string, string>, ...sources: Record<string, string>[]) {
  let winner: ThemeChoice | null = null;
  let winningValue: string | undefined;
  for (const source of sources) {
    const raw = source[THEME_CHOICE_KEY];
    const choice = readChoice(raw);
    if (choice && (!winner || choice.at > winner.at
      || (choice.at === winner.at && raw > (winningValue ?? "")))) {
      winner = choice;
      winningValue = raw;
    }
  }
  if (!winner || !winningValue) return values;
  const next = retainLocalChartAppearance(values, {
    [CHART_SETTINGS_STORAGE_KEY]: JSON.stringify(normalizeChartSettings(winner.chart)),
  });
  next[THEME_CHOICE_KEY] = winningValue;
  if (winner.theme === null) delete next[THEME_KEY];
  else next[THEME_KEY] = winner.theme;
  return next;
}
