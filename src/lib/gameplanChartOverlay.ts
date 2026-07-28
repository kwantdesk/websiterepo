"use client";

import type { GameplanEdition, GameplanRole, GameplanSession } from "@/lib/gameplan";

export type GameplanChartRoot = "NQ" | "ES";

export type GameplanChartOverlayLevel = {
  id: string;
  name: string;
  role: GameplanRole;
  strength: number;
  zone: [number, number];
};

export type GameplanChartOverlay = {
  version: 1;
  root: GameplanChartRoot;
  session: GameplanSession;
  editionDate: string;
  publishedAt: string;
  addedAt: string;
  levels: GameplanChartOverlayLevel[];
};

export type GameplanChartOverlayStore = Partial<Record<GameplanChartRoot, GameplanChartOverlay>>;

export const GAMEPLAN_CHART_OVERLAYS_STORAGE_KEY = "kwantdesk:gameplan-chart-overlays:v1";
export const GAMEPLAN_CHART_OVERLAYS_EVENT = "kwantdesk:gameplan-chart-overlays-change";

function isFiniteZone(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function normalizeOverlay(value: unknown): GameplanChartOverlay | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GameplanChartOverlay>;
  if (
    candidate.version !== 1
    || (candidate.root !== "NQ" && candidate.root !== "ES")
    || (candidate.session !== "globex" && candidate.session !== "newyork")
    || typeof candidate.editionDate !== "string"
    || typeof candidate.publishedAt !== "string"
    || typeof candidate.addedAt !== "string"
    || !Array.isArray(candidate.levels)
  ) {
    return null;
  }

  const levels = candidate.levels.flatMap((level) => {
    if (!level || typeof level !== "object") return [];
    const row = level as Partial<GameplanChartOverlayLevel>;
    if (
      typeof row.id !== "string"
      || typeof row.name !== "string"
      || !["magnet", "wall", "accelerant", "decision"].includes(row.role ?? "")
      || typeof row.strength !== "number"
      || !isFiniteZone(row.zone)
    ) {
      return [];
    }
    return [{
      id: row.id,
      name: row.name,
      role: row.role as GameplanRole,
      strength: row.strength,
      zone: [Math.min(...row.zone), Math.max(...row.zone)] as [number, number],
    }];
  });

  if (!levels.length) return null;
  return {
    version: 1,
    root: candidate.root,
    session: candidate.session,
    editionDate: candidate.editionDate,
    publishedAt: candidate.publishedAt,
    addedAt: candidate.addedAt,
    levels,
  };
}

export function loadGameplanChartOverlays(): GameplanChartOverlayStore {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GAMEPLAN_CHART_OVERLAYS_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const nq = normalizeOverlay(parsed.NQ);
    const es = normalizeOverlay(parsed.ES);
    return {
      ...(nq ? { NQ: nq } : {}),
      ...(es ? { ES: es } : {}),
    };
  } catch {
    return {};
  }
}

function publishOverlayStore(store: GameplanChartOverlayStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GAMEPLAN_CHART_OVERLAYS_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(GAMEPLAN_CHART_OVERLAYS_EVENT, { detail: store }));
}

export function createGameplanChartOverlay(
  root: GameplanChartRoot,
  plan: GameplanEdition,
): GameplanChartOverlay {
  return {
    version: 1,
    root,
    session: plan.edition.session,
    editionDate: plan.edition.date,
    publishedAt: plan.edition.published_at,
    addedAt: new Date().toISOString(),
    levels: plan.ladder.map((level, index) => ({
      id: `${root}-${plan.edition.date}-${plan.edition.session}-${index}-${level.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: level.name,
      role: level.role,
      strength: level.strength,
      zone: [Math.min(...level.zone), Math.max(...level.zone)],
    })),
  };
}

export function saveGameplanChartOverlay(overlay: GameplanChartOverlay) {
  const next = {
    ...loadGameplanChartOverlays(),
    [overlay.root]: overlay,
  };
  publishOverlayStore(next);
  return next;
}

export function removeGameplanChartOverlay(root: GameplanChartRoot) {
  const current = loadGameplanChartOverlays();
  delete current[root];
  publishOverlayStore(current);
  return current;
}

export function gameplanChartRootForInstrument(instrument: string): GameplanChartRoot | null {
  const root = instrument.toUpperCase().replace(/\.[VNC]\.\d+$/i, "");
  if (root === "NQ" || root === "MNQ") return "NQ";
  if (root === "ES" || root === "MES") return "ES";
  return null;
}
