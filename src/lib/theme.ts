import { relinkGexMapPaletteToTheme } from "./gexMapPalette";

export const defaultTheme = {
  background: "#000000",
  foreground: "#FFFFFF",
  primary: "#FFFFFF",
  secondary: "#9A9A9A",
  accent: "#9A9A9A",
  muted: "#777777",
  border: "#333333",
  card: "#0E0E0E",
  danger: "#6B6B6B",
  panel: "#080808",
  surface: "#151515",
  chartBackground: "#000000",
  gridColor: "#1F1F1F",
  crosshairColor: "rgba(255,255,255,.72)",
  candleUp: "#FFFFFF",
  candleDown: "#737373",
};

export type ThemeColors = typeof defaultTheme;

export const THEME_STORAGE_KEY = "olisa-theme";
const THEME_UPDATING_ATTRIBUTE = "themeUpdating";

export function cssVarName(key: string) {
  return `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

function normalizeTheme(value: unknown): ThemeColors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultTheme;
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(defaultTheme).map(([key, fallback]) => [
      key,
      typeof candidate[key] === "string" && candidate[key] ? candidate[key] : fallback,
    ]),
  ) as ThemeColors;
}

export function readStoredTheme() {
  if (typeof window === "undefined") return defaultTheme;
  try {
    return normalizeTheme(JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY) ?? "null"));
  } catch {
    return defaultTheme;
  }
}

export function themeBootstrapScript() {
  const fallback = JSON.stringify(defaultTheme).replace(/</g, "\\u003c");
  return `(()=>{const r=document.documentElement;r.dataset.${THEME_UPDATING_ATTRIBUTE}="true";try{const d=${fallback};const v=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"null");const t=v&&typeof v==="object"&&!Array.isArray(v)?{...d,...v}:d;for(const [k,x] of Object.entries(t)){if(typeof x!=="string"||!x)continue;r.style.setProperty("--"+k.replace(/([A-Z])/g,"-$1").toLowerCase(),x)}r.style.backgroundColor=t.background;r.style.color=t.foreground;const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t.background);r.dataset.themeReady="true"}catch{r.dataset.themeReady="true"}requestAnimationFrame(()=>requestAnimationFrame(()=>delete r.dataset.${THEME_UPDATING_ATTRIBUTE}))})()`;
}

function finishThemeUpdate(root: HTMLElement) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      delete root.dataset[THEME_UPDATING_ATTRIBUTE];
    });
  });
}

export function applyTheme(theme?: Partial<ThemeColors>) {
  if (typeof window === "undefined") return;
  const saved = theme ? normalizeTheme(theme) : readStoredTheme();
  const root = document.documentElement;
  root.dataset[THEME_UPDATING_ATTRIBUTE] = "true";
  Object.entries(saved).forEach(([key, value]) => {
    root.style.setProperty(cssVarName(key), value as string);
  });
  // Keep the browser canvas itself on the active skin while React replaces a
  // route or a recovery reload briefly removes the page body.
  root.style.backgroundColor = saved.background;
  root.style.color = saved.foreground;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", saved.background);
  root.dataset.themeReady = "true";
  finishThemeUpdate(root);
  window.dispatchEvent(new CustomEvent<ThemeColors>("kwantdesk:theme-change", {
    detail: saved,
  }));
}

export function saveTheme(theme: ThemeColors) {
  if (typeof window === "undefined") return;
  const normalized = normalizeTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalized));
  applyTheme(normalized);
  // A deliberate theme choice overrides every themed surface, including a
  // custom GEX Map palette (which stays theme-linked until re-customised).
  relinkGexMapPaletteToTheme();
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

export function resetTheme() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(THEME_STORAGE_KEY);
  applyTheme(defaultTheme);
  relinkGexMapPaletteToTheme();
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}
