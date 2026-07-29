export const defaultTheme = {
  background: "#000000",
  foreground: "#FFFFFF",
  primary: "#B6FF00",
  secondary: "#4361FF",
  accent: "#4361FF",
  muted: "#7E8980",
  border: "#142019",
  card: "#020905",
  danger: "#4361FF",
  panel: "#030604",
  surface: "#07100A",
  chartBackground: "#000000",
  gridColor: "#0A140C",
  crosshairColor: "rgba(182,255,0,.78)",
  candleUp: "#B6FF00",
  candleDown: "#FFFFFF",
};

export type ThemeColors = typeof defaultTheme;

export function cssVarName(key: string) {
  return `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

export function applyTheme(theme?: Partial<ThemeColors>) {
  if (typeof window === "undefined") return;
  const saved = theme ?? JSON.parse(localStorage.getItem("olisa-theme") ?? "null") ?? defaultTheme;
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
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

export function resetTheme() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("olisa-theme");
  applyTheme(defaultTheme);
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}
