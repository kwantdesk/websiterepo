import type { ExposureStrike } from "@/lib/optionsFlow";

// Full = every strike with raw exposure (the old "raw"). Ninja = the
// structural node view (the old "star"). Star = only the Star node itself is
// highlighted; everything else fades to the dim floor.
export type GexMapViewMode = "full" | "ninja" | "star";

export function normalizeGexMapViewMode(value: unknown): GexMapViewMode {
  if (value === "full" || value === "raw") return "full";
  if (value === "ninja") return "ninja";
  return "star";
}

// Controls the numbers printed beside each strike: raw signed exposure, or
// each node's exposure as a percentage of the Star node's magnitude.
export type GexMapValueMode = "signed" | "star-percent";
export type GexMapSelectionStrategy = "structural" | "magnitude" | "velocity";
export type GexMapNodeRole = "star" | "floor" | "ceiling" | "gatekeeper" | "fast" | "significant" | "normal";

export type GexMapStarSettings = {
  highlightedNodes: number;
  selectionStrategy: GexMapSelectionStrategy;
  dimOpacity: number;
  showRawValues: boolean;
  showRoleLabels: boolean;
  showAirPocketLabels: boolean;
  animateChanges: boolean;
  minimumControlPct: number | null;
  promotionMargin: number;
  starReplacementMargin: number;
  airPocketRowThresholdPct: number;
  airPocketCombinedThresholdPct: number;
  proximityWeight: number;
  valueMode: GexMapValueMode;
};

export const RECOMMENDED_GEX_MAP_STAR_SETTINGS: GexMapStarSettings = {
  highlightedNodes: 4,
  selectionStrategy: "structural",
  dimOpacity: 0.08,
  showRawValues: false,
  showRoleLabels: true,
  showAirPocketLabels: false,
  animateChanges: true,
  minimumControlPct: null,
  promotionMargin: 0.08,
  starReplacementMargin: 0.05,
  airPocketRowThresholdPct: 0.75,
  airPocketCombinedThresholdPct: 3,
  proximityWeight: 0.1,
  valueMode: "signed",
};

export type GexMapAirPocket = {
  fromStrike: number;
  toStrike: number;
  rowCount: number;
  combinedControlPct: number;
};

export type GexMapDerivedNode = ExposureStrike & {
  absValue: number;
  polarity: "positive" | "negative" | "neutral";
  mapControlPct: number;
  distanceFromSpotPct: number;
  magnitudeVelocityPct: number | null;
  signedDelta: number | null;
  previousValue: number | null;
  isNew: boolean;
  absoluteRank: number;
  localPeakRatio: number;
  importanceScore: number;
  roles: GexMapNodeRole[];
  isHighlighted: boolean;
  highlightReason: string[];
};

export type GexMapStarModel = {
  totalAbsoluteExposure: number;
  starStrike: number | null;
  highlightedStrikes: number[];
  rows: GexMapDerivedNode[];
  airPockets: GexMapAirPocket[];
  minimumControlPct: number;
};

type DeriveGexMapStarInput = {
  rows: readonly ExposureStrike[];
  previous: ReadonlyMap<number, ExposureStrike>;
  spot: number | null;
  settings?: GexMapStarSettings;
};

const finite = (value: number) => Number.isFinite(value);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function aggregateRows(rows: readonly ExposureStrike[]) {
  const aggregated = new Map<number, ExposureStrike>();
  for (const row of rows) {
    if (!finite(row.strike) || !finite(row.call) || !finite(row.put) || !finite(row.net)) continue;
    const current = aggregated.get(row.strike);
    aggregated.set(row.strike, current ? {
      strike: row.strike,
      call: current.call + row.call,
      put: current.put + row.put,
      net: current.net + row.net,
    } : { ...row });
  }
  return [...aggregated.values()].sort((left, right) => left.strike - right.strike);
}

function strongest<T>(rows: readonly T[], score: (row: T) => number, strike: (row: T) => number) {
  return [...rows].sort((left, right) => score(right) - score(left) || strike(left) - strike(right))[0] ?? null;
}

function addRole(node: GexMapDerivedNode | null, role: GexMapNodeRole, reason: string) {
  if (!node) return;
  if (!node.roles.includes(role)) node.roles.push(role);
  if (!node.highlightReason.includes(reason)) node.highlightReason.push(reason);
}

function chooseLocalPeak(rows: readonly GexMapDerivedNode[]) {
  const local = rows.filter((row) => row.localPeakRatio >= 1);
  return strongest(local.length ? local : rows, (row) => row.absValue, (row) => row.strike);
}

function detectAirPockets(rows: readonly GexMapDerivedNode[], settings: GexMapStarSettings) {
  const pockets: GexMapAirPocket[] = [];
  let run: GexMapDerivedNode[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const combinedControlPct = run.reduce((sum, row) => sum + row.mapControlPct, 0);
      if (combinedControlPct <= settings.airPocketCombinedThresholdPct) {
        pockets.push({
          fromStrike: run[0].strike,
          toStrike: run[run.length - 1].strike,
          rowCount: run.length,
          combinedControlPct,
        });
      }
    }
    run = [];
  };
  for (const row of rows) {
    const weak = !row.isHighlighted
      && row.localPeakRatio <= 1
      && row.mapControlPct < settings.airPocketRowThresholdPct;
    if (weak) run.push(row);
    else flush();
  }
  flush();
  return pockets;
}

/**
 * Build the decision-focused STAR model from the exact complete strike surface
 * already used by the raw ladder. This function never mutates or fetches data.
 */
export function deriveGexMapStarModel({
  rows: sourceRows,
  previous,
  spot,
  settings = RECOMMENDED_GEX_MAP_STAR_SETTINGS,
}: DeriveGexMapStarInput): GexMapStarModel {
  const rows = aggregateRows(sourceRows);
  const totalAbsoluteExposure = rows.reduce((sum, row) => sum + Math.abs(row.net), 0);
  if (!rows.length || totalAbsoluteExposure <= 0) {
    return { totalAbsoluteExposure: 0, starStrike: null, highlightedStrikes: [], rows: [], airPockets: [], minimumControlPct: 0 };
  }

  const magnitudes = rows.map((row) => Math.abs(row.net)).sort((a, b) => a - b);
  const medianMagnitude = magnitudes[Math.floor((magnitudes.length - 1) / 2)] ?? 0;
  const maxMagnitude = magnitudes[magnitudes.length - 1] || 1;
  const baselineFloor = Math.max(Number.EPSILON, medianMagnitude * 0.05);
  const automaticMinimumControl = Math.max(0.05, 100 / Math.max(1, rows.length) * 0.35);
  const minimumControlPct = settings.minimumControlPct ?? automaticMinimumControl;
  const maxDistance = Math.max(1, ...rows.map((row) => spot === null ? 0 : Math.abs(row.strike - spot)));

  const derived: GexMapDerivedNode[] = rows.map((row, index) => {
    const absValue = Math.abs(row.net);
    const prior = previous.get(row.strike);
    const previousValue = prior && finite(prior.net) ? prior.net : null;
    const previousMagnitude = previousValue === null ? null : Math.abs(previousValue);
    const isNew = previousMagnitude !== null && previousMagnitude < baselineFloor && absValue >= baselineFloor;
    const magnitudeVelocityPct = previousMagnitude === null || previousMagnitude < baselineFloor
      ? null
      : ((absValue - previousMagnitude) / previousMagnitude) * 100;
    const left = rows[index - 1] ? Math.abs(rows[index - 1].net) : absValue;
    const right = rows[index + 1] ? Math.abs(rows[index + 1].net) : absValue;
    const neighborMagnitude = Math.max(Number.EPSILON, left, right);
    const localPeakRatio = absValue / neighborMagnitude;
    const mapControlPct = absValue / totalAbsoluteExposure * 100;
    const normalizedMagnitude = absValue / maxMagnitude;
    const normalizedVelocity = magnitudeVelocityPct === null ? 0 : clamp01(Math.max(0, magnitudeVelocityPct) / 100);
    const proximityToSpotScore = spot === null ? 0 : 1 - clamp01(Math.abs(row.strike - spot) / maxDistance);
    const localPeakScore = clamp01(localPeakRatio);
    const importanceScore = 0.5 * normalizedMagnitude
      + 0.2 * (mapControlPct / 100)
      + 0.15 * normalizedVelocity
      + settings.proximityWeight * proximityToSpotScore
      + 0.05 * localPeakScore;
    return {
      ...row,
      absValue,
      polarity: row.net > 0 ? "positive" : row.net < 0 ? "negative" : "neutral",
      mapControlPct,
      distanceFromSpotPct: spot ? ((row.strike - spot) / spot) * 100 : 0,
      magnitudeVelocityPct,
      signedDelta: previousValue === null ? null : row.net - previousValue,
      previousValue,
      isNew,
      absoluteRank: 0,
      localPeakRatio,
      importanceScore,
      roles: [],
      isHighlighted: false,
      highlightReason: [],
    };
  });

  [...derived]
    .sort((left, right) => right.absValue - left.absValue || Math.abs(left.distanceFromSpotPct) - Math.abs(right.distanceFromSpotPct) || left.strike - right.strike)
    .forEach((row, index) => { row.absoluteRank = index + 1; });

  const star = strongest(derived, (row) => row.absValue, (row) => row.strike);
  addRole(star, "star", "Largest absolute exposure on the complete active map");

  const below = spot === null ? [] : derived.filter((row) => row.strike < spot);
  const above = spot === null ? [] : derived.filter((row) => row.strike > spot);
  const floor = chooseLocalPeak(below);
  const ceiling = chooseLocalPeak(above);
  addRole(floor, "floor", "Strongest local exposure peak below spot");
  addRole(ceiling, "ceiling", "Strongest local exposure peak above spot");

  const between = spot === null || !star ? [] : derived.filter((row) => (
    star.strike > spot
      ? row.strike > spot && row.strike < star.strike
      : row.strike < spot && row.strike > star.strike
  ));
  const gatekeeper = strongest(
    between.filter((row) => row.localPeakRatio >= 1 && row.mapControlPct >= minimumControlPct),
    (row) => 0.55 * (row.absValue / maxMagnitude)
      + 0.2 * (row.mapControlPct / 100)
      + 0.15 * (1 - clamp01(Math.abs(row.distanceFromSpotPct) / 100))
      + 0.1 * clamp01(Math.max(0, row.magnitudeVelocityPct ?? 0) / 100),
    (row) => row.strike,
  );
  addRole(gatekeeper, "gatekeeper", "Local peak between spot and the Star node");

  const fast = strongest(
    derived.filter((row) => row.mapControlPct >= minimumControlPct && (row.magnitudeVelocityPct ?? 0) > 0),
    (row) => row.magnitudeVelocityPct ?? 0,
    (row) => row.strike,
  );
  addRole(fast, "fast", "Fastest reliable significant magnitude growth");

  let candidates: GexMapDerivedNode[];
  if (settings.selectionStrategy === "magnitude") {
    candidates = [...derived].filter((row) => row.localPeakRatio >= 1).sort((a, b) => b.absValue - a.absValue);
  } else if (settings.selectionStrategy === "velocity") {
    candidates = [...derived].filter((row) => row.mapControlPct >= minimumControlPct && row.magnitudeVelocityPct !== null)
      .sort((a, b) => (b.magnitudeVelocityPct ?? -Infinity) - (a.magnitudeVelocityPct ?? -Infinity));
  } else {
    candidates = [star, floor, ceiling, gatekeeper, fast].filter((row): row is GexMapDerivedNode => row !== null);
  }
  const fillCandidates = [...derived].filter((row) => row.localPeakRatio >= 1 || row.mapControlPct >= minimumControlPct)
    .sort((a, b) => b.importanceScore - a.importanceScore || a.strike - b.strike);
  const highlighted: GexMapDerivedNode[] = [];
  for (const candidate of [...candidates, ...fillCandidates]) {
    if (highlighted.some((row) => row.strike === candidate.strike)) continue;
    highlighted.push(candidate);
    if (highlighted.length >= Math.max(2, Math.min(8, settings.highlightedNodes))) break;
  }
  for (const row of highlighted) {
    row.isHighlighted = true;
    if (!row.roles.length) addRole(row, "significant", "Highest remaining deterministic importance score");
  }
  for (const row of derived) if (!row.roles.length) row.roles.push("normal");

  return {
    totalAbsoluteExposure,
    starStrike: star?.strike ?? null,
    highlightedStrikes: highlighted.map((row) => row.strike),
    rows: derived,
    airPockets: detectAirPockets(derived, settings),
    minimumControlPct,
  };
}

export function formatMapControl(value: number) {
  if (value < 0.1) return `${value.toFixed(2)}% MAP`;
  return `${value.toFixed(1)}% MAP`;
}

export function formatMagnitudeVelocity(node: Pick<GexMapDerivedNode, "isNew" | "magnitudeVelocityPct">, minutes: number) {
  if (node.isNew) return "NEW";
  if (node.magnitudeVelocityPct === null) return "—";
  const direction = node.magnitudeVelocityPct >= 0 ? "▲" : "▼";
  return `${direction} ${node.magnitudeVelocityPct >= 0 ? "+" : ""}${node.magnitudeVelocityPct.toFixed(1)}% ${minutes}m`;
}

/** Retain incumbents for marginal changes; clear winners still replace them. */
export function stabilizeHighlightedStrikes(
  previous: readonly number[],
  next: GexMapStarModel,
  settings: GexMapStarSettings,
) {
  if (!previous.length) return next.highlightedStrikes;
  const rows = new Map(next.rows.map((row) => [row.strike, row]));
  const targetCount = Math.max(2, Math.min(8, settings.highlightedNodes));
  const result = next.highlightedStrikes.slice(0, targetCount);
  for (const incumbentStrike of previous) {
    if (result.includes(incumbentStrike)) continue;
    const incumbent = rows.get(incumbentStrike);
    if (!incumbent) continue;
    const replaceIndex = result.findIndex((strike) => {
      const challenger = rows.get(strike);
      return challenger && challenger.roles.includes("significant")
        && challenger.importanceScore < incumbent.importanceScore * (1 + settings.promotionMargin);
    });
    if (replaceIndex >= 0) result[replaceIndex] = incumbentStrike;
  }
  return [...new Set(result)].slice(0, targetCount);
}
