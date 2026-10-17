export type LevelFamily = "gamma" | "gameplan" | "structure" | "value-area";
export type LevelPanel = { id: string; instrument: "NQ" | "MNQ" | "ES" | "MES"; family: LevelFamily; timeframe: "1m" | "5m" | "15m" };
export type LevelLayout = "single" | "split" | "stacked" | "quad" | "columns";
export type LevelDesk = {
  panels: LevelPanel[]; layout: LevelLayout; split: number; locked: boolean;
  linked: boolean; intelligenceCollapsed: boolean; activePanelId: string;
};
export type LevelPreset = { id: string; name: string; desk: LevelDesk; updatedAt: string };
export const LEVELZ_WORKSPACES_KEY = "kwantdesk:levelz-workspaces:v1";
export const DEFAULT_LEVEL_PANELS: LevelPanel[] = [
  { id: "levelz-1", instrument: "NQ", family: "gamma", timeframe: "5m" },
  { id: "levelz-2", instrument: "NQ", family: "gameplan", timeframe: "5m" },
  { id: "levelz-3", instrument: "NQ", family: "value-area", timeframe: "5m" },
  { id: "levelz-4", instrument: "NQ", family: "structure", timeframe: "5m" },
];
export function normalizeLevelDesk(value: unknown): LevelDesk {
  const input = (value && typeof value === "object" ? value : {}) as Partial<LevelDesk>;
  const ids = new Set<string>();
  const panels: LevelPanel[] = [];
  for (const raw of Array.isArray(input.panels) ? input.panels.slice(0, 8) : DEFAULT_LEVEL_PANELS) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id.trim()) continue;
    const id = raw.id.trim().slice(0, 100);
    if (ids.has(id)) continue;
    ids.add(id);
    panels.push({ id,
      instrument: (["NQ", "MNQ", "ES", "MES"] as unknown[]).includes(raw.instrument) ? raw.instrument : "NQ",
      family: (["gamma", "gameplan", "structure", "value-area"] as unknown[]).includes(raw.family) ? raw.family : "gamma",
      timeframe: (["1m", "5m", "15m"] as unknown[]).includes(raw.timeframe) ? raw.timeframe : "5m" });
  }
  if (!panels.length) panels.push({ ...DEFAULT_LEVEL_PANELS[0] });
  return { panels, layout: (["single", "split", "stacked", "quad", "columns"] as unknown[]).includes(input.layout) ? input.layout! : "quad",
    split: typeof input.split === "number" && Number.isFinite(input.split) ? Math.max(20, Math.min(80, input.split)) : 50,
    locked: input.locked === true, linked: input.linked === true, intelligenceCollapsed: input.intelligenceCollapsed === true,
    activePanelId: panels.some(p => p.id === input.activePanelId) ? input.activePanelId! : panels[0].id };
}
export function normalizeLevelPresets(value: unknown): LevelPreset[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 50).flatMap(raw => {
    if (!raw || typeof raw.id !== "string" || !raw.id || ids.has(raw.id) || typeof raw.name !== "string" || !raw.name.trim()) return [];
    ids.add(raw.id);
    return [{ id: raw.id.slice(0, 100), name: raw.name.trim().slice(0, 80), desk: normalizeLevelDesk(raw.desk),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString() }];
  });
}
export function moveLevelPanel(desk: LevelDesk, sourceId: string, targetId: string): LevelDesk {
  if (desk.locked || sourceId === targetId) return desk;
  const source = desk.panels.findIndex(p => p.id === sourceId), target = desk.panels.findIndex(p => p.id === targetId);
  if (source < 0 || target < 0) return desk;
  const panels = [...desk.panels];
  [panels[source], panels[target]] = [panels[target], panels[source]];
  return { ...desk, panels };
}
