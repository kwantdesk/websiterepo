export const defaultTheme = {
  background: "#030304",
  foreground: "#F4F1E8",
  primary: "#D6B45F",
  secondary: "#F0D58A",
  accent: "#D6B45F",
  muted: "#79776F",
  border: "#1D1D20",
  card: "#0B0B0D",
  danger: "#FF626C",
  panel: "#070708",
  surface: "#111113",
  chartBackground: "#030304",
  gridColor: "#0B0B0D",
  crosshairColor: "rgba(214,180,95,.42)",
  candleUp: "#D6B45F",
  candleDown: "#FF626C",
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
  window.dispatchEvent(new CustomEvent("kwantdesk:theme-change"));
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
