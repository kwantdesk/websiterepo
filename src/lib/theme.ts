export const defaultTheme = {
  background: "#131722",
  foreground: "#D1D4DC",
  primary: "#2962FF",
  secondary: "#5B9CF6",
  accent: "#2962FF",
  muted: "#787B86",
  border: "#2A2E39",
  card: "#1E222D",
  danger: "#F23645",
  panel: "#171B26",
  surface: "#2A2E39",
  chartBackground: "#131722",
  gridColor: "#1E222D",
  crosshairColor: "rgba(117, 134, 150, 0.45)",
  candleUp: "#089981",
  candleDown: "#F23645",
};

export type ThemeColors = typeof defaultTheme;

export function cssVarName(key: string) {
  return `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

export function applyTheme(theme?: Partial<ThemeColors>) {
  if (typeof window === "undefined") return;
  const saved = theme ?? JSON.parse(localStorage.getItem("olisa-theme") ?? "null");
  if (!saved) return;
  const root = document.documentElement;
  Object.entries(saved).forEach(([key, value]) => {
    root.style.setProperty(cssVarName(key), value as string);
  });
}

export function saveTheme(theme: ThemeColors) {
  if (typeof window === "undefined") return;
  localStorage.setItem("olisa-theme", JSON.stringify(theme));
  applyTheme(theme);
}

export function resetTheme() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("olisa-theme");
  applyTheme(defaultTheme);
}
