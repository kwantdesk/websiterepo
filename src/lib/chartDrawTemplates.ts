import { DEFAULT_DRAW_STYLE, type DrawStyle, type DrawToolId } from "@/lib/chartDrawTools";

/**
 * Named style templates for the charting tools, saved per tool type and synced
 * to the account through the tracked preferences key. A template captures only
 * the reusable appearance (colour, width, line style, fill, font, labels) — not
 * a drawing's coordinates — exactly like TradingView's "save as default" /
 * template lists.
 */
export const DRAW_TEMPLATES_STORAGE_KEY = "kwantdesk:chart-drawtool-templates:v1";

export type DrawTemplateStore = Record<string, Record<string, DrawStyle>>;

function normalizeStyle(value: unknown): DrawStyle {
  const style = value && typeof value === "object" ? value as Partial<DrawStyle> : {};
  return {
    color: typeof style.color === "string" ? style.color : DEFAULT_DRAW_STYLE.color,
    width: Number.isFinite(Number(style.width)) ? Number(style.width) : DEFAULT_DRAW_STYLE.width,
    lineStyle: style.lineStyle === "dashed" || style.lineStyle === "dotted" ? style.lineStyle : "solid",
    fillOpacity: Number.isFinite(Number(style.fillOpacity)) ? Number(style.fillOpacity) : DEFAULT_DRAW_STYLE.fillOpacity,
    showLabels: style.showLabels !== false,
    fontSize: Number.isFinite(Number(style.fontSize)) ? Number(style.fontSize) : DEFAULT_DRAW_STYLE.fontSize,
    visible: style.visible !== false,
  };
}

export function loadDrawTemplates(): DrawTemplateStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(DRAW_TEMPLATES_STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    const out: DrawTemplateStore = {};
    for (const [tool, templates] of Object.entries(raw as Record<string, unknown>)) {
      if (!templates || typeof templates !== "object") continue;
      out[tool] = {};
      for (const [name, style] of Object.entries(templates as Record<string, unknown>)) {
        out[tool][name] = normalizeStyle(style);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persist(store: DrawTemplateStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAW_TEMPLATES_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  } catch {
    // Templates still apply this session without persistence.
  }
}

export function saveDrawTemplate(tool: DrawToolId, name: string, style: DrawStyle): DrawTemplateStore {
  const store = loadDrawTemplates();
  const next = { ...store, [tool]: { ...(store[tool] ?? {}), [name]: normalizeStyle(style) } };
  persist(next);
  return next;
}

export function deleteDrawTemplate(tool: DrawToolId, name: string): DrawTemplateStore {
  const store = loadDrawTemplates();
  if (store[tool]) {
    const rest = { ...store[tool] };
    delete rest[name];
    const next = { ...store, [tool]: rest };
    persist(next);
    return next;
  }
  return store;
}
