export const defaultTheme = {
  background: "#0C0D0F",
  foreground: "#F3F0E8",
  primary: "#C9A45C",
  secondary: "#E2C985",
  accent: "#C9A45C",
  muted: "#958F84",
  border: "#292824",
  card: "#161615",
  danger: "#D96C5F",
  panel: "#111110",
  surface: "#22211F",
  chartBackground: "#0C0D0F",
  gridColor: "#1D1D1B",
  crosshairColor: "rgba(201,164,92,.38)",
  candleUp: "#46B99A",
  candleDown: "#D96C5F",
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
