import type { GexIntervalProviderBucket, GexIntervalProviderSurface } from "@/lib/gexIntervalMap";
import type { NetGammaProfileSnapshot, NetGammaStrikeRow } from "@/lib/netGammaExposureByStrike";
import { expirationMatchesFilter } from "@/lib/netGammaExposureMath";

export const BOUNCE_LEVELS_ID = "bounce-levels";
export const BOUNCE_LEVELS_SCHEMA_VERSION = 3;
export const BOUNCE_LEVELS_HISTORY_DAYS = 7;
export const BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT = 1_440;

export type BounceGreekMode = "GAMMA" | "DELTA" | "VANNA" | "CHARM";
export type BounceLevelRole = "KING" | "FLOOR" | "CEILING" | "GATEKEEPER" | "MAJOR" | "CLUSTER" | "DEVELOPING" | "WEAKENING" | "RETIRED" | "AIR_POCKET";

export type BounceLevel = {
  id: string;
  role: BounceLevelRole;
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  callExposure: number;
  putExposure: number;
  magnitudePercentile: number;
  magnitudeScore: number;
  percentOfKing: number;
  distancePoints: number;
  distancePercent: number;
  rateOfChangeAbsolute: number;
  rateOfChangePercent: number;
  shortRateOfChange: number;
  mediumRateOfChange: number;
  longRateOfChange: number;
  accumulationScore: number;
  persistenceScore: number;
  persistenceSnapshots: number;
  freshnessScore: number;
  clusterScore: number;
  relevanceScore: number;
  dataQuality: number;
  momentum: number;
  touches: number;
  isClusterMember: boolean;
  clusterId?: string;
  explanation: string;
  snapshotTimeMs: number;
};

export type BounceAirPocket = { id: string; lowerPrice: number; upperPrice: number; magnitudeRatio: number };
export type BounceVisualStrengthBasis = "absolute-exposure" | "percent-of-king" | "hybrid";
export type BounceExposureSample = {
  nodeKey: string;
  timestamp: number;
  strike: number;
  signedExposure: number;
  absoluteExposure: number;
  percentOfKing: number;
};
export type BounceExposureSeries = {
  nodeKey: string;
  underlying: string;
  greek: BounceGreekMode;
  expiryScopeSignature: string;
  strike: number;
  samples: BounceExposureSample[];
};
export type BounceExposureRoll = {
  id: string;
  timestamp: number;
  fromNodeKey: string;
  toNodeKey: string;
  fromStrike: number;
  toStrike: number;
  direction: "UP" | "DOWN";
  weakeningRate: number;
  buildingRate: number;
  score: number;
};
export type BounceExposureNode = {
  id: string;
  nodeKey: string;
  timestamp: number;
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  callExposure: number;
  putExposure: number;
  strength: number;
  percentOfKing: number;
  normalizedAbsoluteMagnitude: number;
  visualStrength: number;
  bucketShare: number;
  rateOfChangePercent: number;
  shortRateOfChange: number;
  oneMinuteRateOfChange: number;
  fiveMinuteRateOfChange: number;
  fifteenMinuteRateOfChange: number;
  rollWindowRateOfChange: number;
  active: boolean;
  retirementCount: number;
};
export type BounceExposureSlice = {
  timestamp: number;
  sourcePrice: number | null;
  mappedSourcePrice: number | null;
  maximumAbsoluteExposure: number;
  totalAbsoluteExposure: number;
  kingStrike: number | null;
  nodes: BounceExposureNode[];
};
export type BounceLevelsSnapshot = {
  schemaVersion: 3;
  id: string;
  sourceTicker: string;
  displayInstrument: string;
  displayPrice: number;
  greekMode: BounceGreekMode;
  status: NetGammaProfileSnapshot["status"];
  snapshotTimeMs: number;
  receivedTimeMs: number;
  refreshAfterMs: number;
  expirationLabel: string;
  representation: "per-one-percent-move";
  mapping: NetGammaProfileSnapshot["mapping"];
  exposureField: BounceExposureSlice[];
  exposureSeries: BounceExposureSeries[];
  exposureRefreshIntervalMs: number | null;
  visualStrengthBasis: BounceVisualStrengthBasis;
  rolls: BounceExposureRoll[];
  levels: BounceLevel[];
  king: BounceLevel | null;
  floor: BounceLevel | null;
  ceiling: BounceLevel | null;
  gatekeepers: BounceLevel[];
  airPockets: BounceAirPocket[];
  mapSignature: string;
  limitations: string[];
};

export type BounceLevelsBuildSettings = {
  greekMode: BounceGreekMode;
  expirationMode: "zero-dte" | "zero-to-one-dte" | "zero-to-seven-dte" | "front-expiration" | "all-expirations" | "custom-dte-range" | "specific-expirations";
  minimumDte: number;
  maximumDte: number;
  expirationDates: string[];
  includeWeeklies: boolean;
  includeMonthlies: boolean;
  includeQuarterlies: boolean;
  maximumLevels: number;
  maximumGatekeepers: number;
  maximumMajorNodes: number;
  minimumExposurePercentile: number;
  minimumPercentOfKing: number;
  minimumRelevanceScore: number;
  maximumDistancePoints: number;
  clusterDistancePoints: number;
  minimumClusterNodes: number;
  airPocketRatio: number;
  minimumAirPocketWidthPercent: number;
  historyBuckets: number;
  maximumNodesPerSlice: number;
  magnitudeWeight: number;
  proximityWeight: number;
  accumulationWeight: number;
  persistenceWeight: number;
  freshnessWeight: number;
  clusterWeight: number;
  proximityDecayPercent: number;
  developingMinimumPercentile: number;
  developingMinimumGrowthPercent: number;
  weakeningThresholdPercent: number;
  weakeningRelevanceThreshold: number;
  retirementRelevanceThreshold: number;
  retirementExposurePercentile: number;
  minimumGatekeeperRelevance: number;
  minimumGatekeeperPercentOfKing: number;
  touchTolerancePercent: number;
  touchDecayFactor: number;
  activeEnterThreshold: number;
  activeExitThreshold: number;
  retirementConfirmationSnapshots: number;
  visualStrengthBasis: BounceVisualStrengthBasis;
  absoluteExposureScale: number;
  rollDetectionEnabled: boolean;
  rollVisualizationEnabled: boolean;
  rollWeakeningThreshold: number;
  rollBuildingThreshold: number;
  maxRollDistance: number;
  rollWindowMs: number;
};

export const DEFAULT_BOUNCE_LEVELS_SETTINGS: BounceLevelsBuildSettings = {
  greekMode: "GAMMA",
  expirationMode: "zero-to-one-dte",
  minimumDte: 0,
  maximumDte: 7,
  expirationDates: [],
  includeWeeklies: true,
  includeMonthlies: true,
  includeQuarterlies: true,
  maximumLevels: 8,
  maximumGatekeepers: 2,
  maximumMajorNodes: 4,
  minimumExposurePercentile: 0.9,
  minimumPercentOfKing: 0.15,
  minimumRelevanceScore: 55,
  maximumDistancePoints: 0,
  clusterDistancePoints: 0,
  minimumClusterNodes: 2,
  airPocketRatio: 0.2,
  minimumAirPocketWidthPercent: 0.003,
  historyBuckets: BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT,
  maximumNodesPerSlice: 24,
  magnitudeWeight: 0.45,
  proximityWeight: 0.15,
  accumulationWeight: 0.15,
  persistenceWeight: 0.10,
  freshnessWeight: 0.10,
  clusterWeight: 0.05,
  proximityDecayPercent: 0.03,
  developingMinimumPercentile: 0.75,
  developingMinimumGrowthPercent: 10,
  weakeningThresholdPercent: -10,
  weakeningRelevanceThreshold: 45,
  retirementRelevanceThreshold: 30,
  retirementExposurePercentile: 0.65,
  minimumGatekeeperRelevance: 60,
  minimumGatekeeperPercentOfKing: 0.2,
  touchTolerancePercent: 0.0005,
  touchDecayFactor: 0.85,
  activeEnterThreshold: 0.15,
  activeExitThreshold: 0.08,
  retirementConfirmationSnapshots: 3,
  visualStrengthBasis: "percent-of-king",
  absoluteExposureScale: 1_000_000_000,
  rollDetectionEnabled: true,
  rollVisualizationEnabled: false,
  rollWeakeningThreshold: 40,
  rollBuildingThreshold: 40,
  maxRollDistance: 5,
  rollWindowMs: 120_000,
};

type StrikeHistory = { values: number[]; timestamps: number[]; sourcePrices: Array<number | null> };
type Candidate = Omit<BounceLevel, "role" | "explanation"> & { active: boolean; developing: boolean; weakening: boolean; retired: boolean };
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const NEW_YORK_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const newYorkSessionDate = (timestamp: number) => {
  const parts = Object.fromEntries(NEW_YORK_DATE.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const rowsForExpirationScope = <T extends { expirationDate?: string }>(
  rows: T[],
  timestamp: number,
  settings: BounceLevelsBuildSettings,
) => {
  const sessionDate = newYorkSessionDate(timestamp);
  const availableExpirations = [...new Set(rows.map((row) => row.expirationDate).filter((value): value is string => Boolean(value)))];
  const frontExpiration = availableExpirations.filter((expiration) => expiration >= sessionDate).sort()[0] ?? null;
  return rows.filter((row) => !row.expirationDate || expirationMatchesFilter(row.expirationDate, sessionDate, {
    mode: settings.expirationMode,
    minimumDte: settings.minimumDte,
    maximumDte: settings.maximumDte,
    expirationDates: settings.expirationDates,
    includeWeeklies: settings.includeWeeklies,
    includeMonthlies: settings.includeMonthlies,
    includeQuarterlies: settings.includeQuarterlies,
  }, frontExpiration));
};

function buildExposureField(
  profile: NetGammaProfileSnapshot,
  surface: GexIntervalProviderSurface | null,
  settings: BounceLevelsBuildSettings,
) {
  const maximumBuckets = Math.max(2, Math.round(settings.historyBuckets));
  const maximumNodes = Math.max(4, Math.min(64, Math.round(settings.maximumNodesPerSlice)));
  const displayTick = /^(NQ|MNQ|ES|MES|RTY|M2K)$/.test(profile.displayInstrument) ? 0.25 : 0.01;
  const mapPrice = (sourceStrike: number) => Math.round((profile.mapping.alpha + profile.mapping.beta * sourceStrike) / displayTick) * displayTick;
  const eligibleBuckets = (surface?.buckets ?? [])
    .filter((bucket) => bucket.timestamp <= profile.snapshotTimeMs)
    .slice(-maximumBuckets);
  const expiryScopeSignature = [
    settings.expirationMode,
    settings.minimumDte,
    settings.maximumDte,
    [...settings.expirationDates].sort().join(","),
    settings.includeWeeklies ? "W" : "",
    settings.includeMonthlies ? "M" : "",
    settings.includeQuarterlies ? "Q" : "",
  ].join(":");
  const nodeKeyFor = (strike: number) => `${profile.sourceTicker}|${settings.greekMode}|${expiryScopeSignature}|${strike}`;
  const seriesByStrike = new Map<number, BounceExposureSeries>();
  const activeByStrike = new Map<number, { active: boolean; belowExitCount: number }>();
  const slices: BounceExposureSlice[] = [];
  const rolls: BounceExposureRoll[] = [];
  const snapshotTimes: number[] = [];

  const priorSample = (series: BounceExposureSeries | undefined, timestamp: number, windowMs: number, lastSnapshot = false) => {
    if (!series?.samples.length) return null;
    if (lastSnapshot) return series.samples.at(-1) ?? null;
    const target = timestamp - windowMs;
    let result = series.samples[0];
    for (const sample of series.samples) {
      if (sample.timestamp > target) break;
      result = sample;
    }
    return result ?? null;
  };
  const magnitudeRoc = (current: number, previous: BounceExposureSample | null) => previous
    ? 100 * (current - previous.absoluteExposure) / Math.max(1, previous.absoluteExposure)
    : 0;

  const buildSlice = (
    timestamp: number,
    sourcePrice: number | null,
    rows: Array<{ sourceStrike: number; callExposure: number; putExposure: number; expirationDate?: string }>,
  ) => {
    const aggregate = new Map<number, { call: number; put: number }>();
    for (const row of rowsForExpirationScope(rows, timestamp, settings)) {
      const current = aggregate.get(row.sourceStrike) ?? { call: 0, put: 0 };
      current.call += Number(row.callExposure) || 0;
      current.put += Number(row.putExposure) || 0;
      aggregate.set(row.sourceStrike, current);
    }
    // A complete snapshot that omits a previously active strike represents a
    // zero observation for retirement purposes; keep it long enough to taper.
    for (const [strike, state] of activeByStrike) if (state.active && !aggregate.has(strike)) aggregate.set(strike, { call: 0, put: 0 });
    const ranked = [...aggregate.entries()]
      .map(([sourceStrike, exposure]) => ({
        sourceStrike,
        callExposure: exposure.call,
        putExposure: exposure.put,
        signedExposure: exposure.call + exposure.put,
      }))
      .filter((row) => Number.isFinite(row.signedExposure))
      .sort((left, right) => Math.abs(right.signedExposure) - Math.abs(left.signedExposure));
    const maximumAbsoluteExposure = Math.max(0, ...ranked.map((row) => Math.abs(row.signedExposure)));
    const totalAbsoluteExposure = ranked.reduce((sum, row) => sum + Math.abs(row.signedExposure), 0);
    if (!ranked.length) return;
    snapshotTimes.push(timestamp);
    const allNodes = ranked.map((row, rank): BounceExposureNode => {
      const absoluteExposure = Math.abs(row.signedExposure);
      const percentOfKing = maximumAbsoluteExposure > 0 ? absoluteExposure / maximumAbsoluteExposure : 0;
      const nodeKey = nodeKeyFor(row.sourceStrike);
      const series = seriesByStrike.get(row.sourceStrike) ?? {
        nodeKey,
        underlying: profile.sourceTicker,
        greek: settings.greekMode,
        expiryScopeSignature,
        strike: row.sourceStrike,
        samples: [],
      };
      if (series.samples.at(-1)?.timestamp === timestamp) series.samples.pop();
      const shortRateOfChange = magnitudeRoc(absoluteExposure, priorSample(series, timestamp, 0, true));
      const oneMinuteRateOfChange = magnitudeRoc(absoluteExposure, priorSample(series, timestamp, 60_000));
      const fiveMinuteRateOfChange = magnitudeRoc(absoluteExposure, priorSample(series, timestamp, 300_000));
      const fifteenMinuteRateOfChange = magnitudeRoc(absoluteExposure, priorSample(series, timestamp, 900_000));
      const rollWindowRateOfChange = magnitudeRoc(absoluteExposure, priorSample(series, timestamp, settings.rollWindowMs));
      const sample: BounceExposureSample = { nodeKey, timestamp, strike: row.sourceStrike, signedExposure: row.signedExposure, absoluteExposure, percentOfKing };
      series.samples.push(sample);
      seriesByStrike.set(row.sourceStrike, series);

      const state = activeByStrike.get(row.sourceStrike) ?? { active: false, belowExitCount: 0 };
      if (!state.active && rank < maximumNodes && percentOfKing >= settings.activeEnterThreshold) {
        state.active = true;
        state.belowExitCount = 0;
      } else if (state.active && percentOfKing < settings.activeExitThreshold) {
        state.belowExitCount += 1;
      } else if (state.active) {
        state.belowExitCount = 0;
      }
      const visible = state.active;
      if (state.active && state.belowExitCount >= Math.max(1, Math.round(settings.retirementConfirmationSnapshots))) state.active = false;
      activeByStrike.set(row.sourceStrike, state);
      const normalizedAbsoluteMagnitude = absoluteExposure / Math.max(1, absoluteExposure + settings.absoluteExposureScale);
      const visualStrength = settings.visualStrengthBasis === "absolute-exposure"
        ? normalizedAbsoluteMagnitude
        : settings.visualStrengthBasis === "hybrid"
          ? Math.sqrt(normalizedAbsoluteMagnitude * percentOfKing)
          : percentOfKing;
      return {
        id: `${timestamp}:${row.sourceStrike}`,
        nodeKey,
        timestamp,
        sourceStrike: row.sourceStrike,
        mappedPrice: mapPrice(row.sourceStrike),
        signedExposure: row.signedExposure,
        absoluteExposure,
        callExposure: row.callExposure,
        putExposure: row.putExposure,
        strength: percentOfKing,
        percentOfKing,
        normalizedAbsoluteMagnitude,
        visualStrength,
        bucketShare: totalAbsoluteExposure > 0 ? absoluteExposure / totalAbsoluteExposure : 0,
        rateOfChangePercent: shortRateOfChange,
        shortRateOfChange,
        oneMinuteRateOfChange,
        fiveMinuteRateOfChange,
        fifteenMinuteRateOfChange,
        rollWindowRateOfChange,
        active: visible,
        retirementCount: state.belowExitCount,
      };
    });
    const nodes = allNodes.filter((node) => node.active);
    if (!nodes.length) return;
    slices.push({
      timestamp,
      sourcePrice,
      mappedSourcePrice: sourcePrice && sourcePrice > 0 ? mapPrice(sourcePrice) : null,
      maximumAbsoluteExposure,
      totalAbsoluteExposure,
      kingStrike: ranked[0]?.sourceStrike ?? null,
      nodes,
    });

    if (settings.rollDetectionEnabled) {
      const weakening = allNodes.filter((node) => node.rollWindowRateOfChange <= -Math.abs(settings.rollWeakeningThreshold));
      const building = allNodes.filter((node) => node.rollWindowRateOfChange >= Math.abs(settings.rollBuildingThreshold));
      for (const from of weakening) for (const to of building) {
        const distance = Math.abs(to.sourceStrike - from.sourceStrike);
        if (from.nodeKey === to.nodeKey || distance > settings.maxRollDistance) continue;
        const weakeningMagnitude = clamp01(Math.abs(from.rollWindowRateOfChange) / Math.max(1, settings.rollWeakeningThreshold));
        const strengtheningMagnitude = clamp01(to.rollWindowRateOfChange / Math.max(1, settings.rollBuildingThreshold));
        const proximityScore = clamp01(1 - distance / Math.max(0.000001, settings.maxRollDistance));
        rolls.push({
          id: `${timestamp}:${from.nodeKey}:${to.nodeKey}`,
          timestamp,
          fromNodeKey: from.nodeKey,
          toNodeKey: to.nodeKey,
          fromStrike: from.sourceStrike,
          toStrike: to.sourceStrike,
          direction: to.sourceStrike > from.sourceStrike ? "UP" : "DOWN",
          weakeningRate: from.rollWindowRateOfChange,
          buildingRate: to.rollWindowRateOfChange,
          score: clamp01(0.4 * weakeningMagnitude + 0.4 * strengtheningMagnitude + 0.2 * proximityScore),
        });
      }
    }
  };

  for (const bucket of eligibleBuckets) buildSlice(bucket.timestamp, bucket.sourcePrice, bucket.rows);
  const latestRows = profile.rows.flatMap((row) => row.expirationContributions.length
    ? row.expirationContributions.map((contribution) => ({
      sourceStrike: contribution.sourceStrike,
      callExposure: contribution.callExposure,
      putExposure: contribution.putExposure,
      expirationDate: contribution.expirationDate,
    }))
    : [{ sourceStrike: row.sourceStrike, callExposure: row.callExposure, putExposure: row.putExposure }]);
  if (latestRows.length) {
    const finalTimestamp = Math.max(profile.snapshotTimeMs, slices.at(-1)?.timestamp ?? 0);
    if (slices.at(-1)?.timestamp === finalTimestamp) slices.pop();
    buildSlice(finalTimestamp, profile.sourceSpotPrice, latestRows);
  }
  const cadenceDeltas = snapshotTimes.slice(1).map((timestamp, index) => timestamp - snapshotTimes[index]).filter((value) => value > 0).sort((a, b) => a - b);
  const exposureRefreshIntervalMs = cadenceDeltas.length ? cadenceDeltas[Math.floor(cadenceDeltas.length / 2)] : null;
  return {
    slices,
    exposureSeries: [...seriesByStrike.values()],
    exposureRefreshIntervalMs,
    rolls,
  };
}

export function selectLookaheadSafeBounceBucket(surface: GexIntervalProviderSurface, asOfMs: number): GexIntervalProviderBucket | null {
  if (!Number.isFinite(asOfMs)) return null;
  let selected: GexIntervalProviderBucket | null = null;
  for (const bucket of [...surface.buckets].sort((left, right) => left.timestamp - right.timestamp)) {
    if (bucket.timestamp > asOfMs) break;
    selected = bucket;
  }
  return selected;
}

/**
 * Provider refreshes frequently return a new object containing the same live
 * head. Treat that as a no-op so multi-panel workspaces do not rebuild every
 * retained exposure canvas at the polling cadence.
 */
export function bounceLevelsSnapshotsHaveSameHead(
  previous: BounceLevelsSnapshot | null,
  next: BounceLevelsSnapshot | null,
) {
  if (!previous || !next) return previous === next;
  return previous.sourceTicker === next.sourceTicker
    && previous.displayInstrument === next.displayInstrument
    && previous.greekMode === next.greekMode
    && previous.expirationLabel === next.expirationLabel
    && previous.snapshotTimeMs === next.snapshotTimeMs
    && previous.mapSignature === next.mapSignature;
}

/**
 * Preserves every valid live head returned to this browser between provider
 * history refreshes. Samples with the same identity and timestamp are treated
 * as provider corrections; the newer payload wins without touching any other
 * finalized historical sample.
 */
export function mergeBounceLevelsSnapshots(previous: BounceLevelsSnapshot | null, next: BounceLevelsSnapshot): BounceLevelsSnapshot {
  if (!previous || previous.sourceTicker !== next.sourceTicker || previous.displayInstrument !== next.displayInstrument || previous.greekMode !== next.greekMode || previous.expirationLabel !== next.expirationLabel) return next;
  const historyCutoff = next.snapshotTimeMs - BOUNCE_LEVELS_HISTORY_DAYS * 24 * 60 * 60_000;
  const slices = new Map(previous.exposureField.map((slice) => [slice.timestamp, slice]));
  for (const slice of next.exposureField) slices.set(slice.timestamp, slice);
  const exposureField = [...slices.values()]
    .filter((slice) => slice.timestamp >= historyCutoff && slice.timestamp <= next.snapshotTimeMs)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT);
  const series = new Map(previous.exposureSeries.map((item) => [item.nodeKey, { ...item, samples: [...item.samples] }]));
  for (const incoming of next.exposureSeries) {
    const current = series.get(incoming.nodeKey) ?? { ...incoming, samples: [] };
    const samples = new Map(current.samples.map((sample) => [sample.timestamp, sample]));
    for (const sample of incoming.samples) samples.set(sample.timestamp, sample);
    series.set(incoming.nodeKey, {
      ...incoming,
      samples: [...samples.values()]
        .filter((sample) => sample.timestamp >= historyCutoff && sample.timestamp <= next.snapshotTimeMs)
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(-BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT),
    });
  }
  const rolls = new Map(previous.rolls.map((roll) => [roll.id, roll]));
  for (const roll of next.rolls) rolls.set(roll.id, roll);
  const deltas = exposureField.slice(1).map((slice, index) => slice.timestamp - exposureField[index].timestamp).filter((value) => value > 0).sort((a, b) => a - b);
  const exposureSeries = [...series.values()]
    .map((item) => ({
      ...item,
      samples: item.samples.filter((sample) => sample.timestamp >= historyCutoff && sample.timestamp <= next.snapshotTimeMs),
    }))
    .filter((item) => item.samples.length > 0);
  return {
    ...next,
    exposureField,
    exposureSeries,
    exposureRefreshIntervalMs: deltas.length ? deltas[Math.floor(deltas.length / 2)] : next.exposureRefreshIntervalMs,
    rolls: [...rolls.values()]
      .filter((roll) => roll.timestamp >= historyCutoff && roll.timestamp <= next.snapshotTimeMs)
      .sort((left, right) => left.timestamp - right.timestamp),
  };
}

/**
 * Applies display-only role controls without mutating the provider snapshot.
 * Historical strikes that are no longer present in the current ranked surface
 * are retired history, rather than silently bypassing the retired toggle.
 */
export function filterBounceLevelsSnapshot(
  snapshot: BounceLevelsSnapshot,
  visibility: Partial<Record<BounceLevelRole, boolean>>,
  showAirPockets: boolean,
): BounceLevelsSnapshot {
  const roleByStrike = new Map(snapshot.levels.map((level) => [level.sourceStrike, level.role]));
  const isVisible = (role: BounceLevelRole) => visibility[role] !== false;
  return {
    ...snapshot,
    levels: snapshot.levels.filter((level) => isVisible(level.role)),
    exposureField: snapshot.exposureField.map((slice) => ({
      ...slice,
      nodes: slice.nodes.filter((node) => isVisible(roleByStrike.get(node.sourceStrike) ?? "RETIRED")),
    })),
    airPockets: showAirPockets ? snapshot.airPockets : [],
  };
}

export function mergeBounceIntervalSurfaces(
  historical: GexIntervalProviderSurface | null,
  current: GexIntervalProviderSurface,
): GexIntervalProviderSurface {
  if (!historical || historical.sourceTicker !== current.sourceTicker) return current;
  const buckets = new Map(historical.buckets.map((bucket) => [bucket.timestamp, bucket]));
  for (const bucket of current.buckets) buckets.set(bucket.timestamp, bucket);
  const newestTimestamp = Math.max(0, ...buckets.keys());
  const historyCutoff = newestTimestamp - BOUNCE_LEVELS_HISTORY_DAYS * 24 * 60 * 60_000;
  return {
    ...current,
    aggregationPeriod: `${historical.aggregationPeriod}+${current.aggregationPeriod}`,
    buckets: [...buckets.values()]
      .filter((bucket) => bucket.timestamp >= historyCutoff && bucket.timestamp <= newestTimestamp)
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT),
    limitations: [...new Set([...historical.limitations, ...current.limitations])],
  };
}

function percentileRanks(rows: NetGammaStrikeRow[]) {
  const sorted = [...rows].sort((left, right) => Math.abs(left.netExposure) - Math.abs(right.netExposure));
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => ranks.set(row.id, sorted.length <= 1 ? 1 : index / (sorted.length - 1)));
  return ranks;
}

function buildHistory(surface: GexIntervalProviderSurface | null, settings: BounceLevelsBuildSettings, asOfMs: number) {
  const byStrike = new Map<number, StrikeHistory>();
  if (!surface) return byStrike;
  const eligible = surface.buckets.filter((bucket) => bucket.timestamp <= asOfMs).slice(-Math.max(2, settings.historyBuckets));
  for (const bucket of eligible) {
    const aggregate = new Map<number, number>();
    for (const row of rowsForExpirationScope(bucket.rows, bucket.timestamp, settings)) {
      aggregate.set(row.sourceStrike, (aggregate.get(row.sourceStrike) ?? 0) + row.callExposure + row.putExposure);
    }
    for (const [strike, value] of aggregate) {
      const history = byStrike.get(strike) ?? { values: [], timestamps: [], sourcePrices: [] };
      history.values.push(value);
      history.timestamps.push(bucket.timestamp);
      history.sourcePrices.push(bucket.sourcePrice);
      byStrike.set(strike, history);
    }
  }
  return byStrike;
}

function nearestHistory(histories: Map<number, StrikeHistory>, sourceStrikes: number[]) {
  for (const strike of sourceStrikes) if (histories.has(strike)) return histories.get(strike) ?? null;
  const target = sourceStrikes.reduce((sum, value) => sum + value, 0) / Math.max(1, sourceStrikes.length);
  let best: StrikeHistory | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const [strike, history] of histories) if (Math.abs(strike - target) < distance) { distance = Math.abs(strike - target); best = history; }
  return best;
}

function priorAtWindow(history: StrikeHistory, now: number, windowMs: number) {
  const target = now - windowMs;
  let result = history.values[0] ?? 0;
  for (let index = 0; index < history.timestamps.length; index += 1) {
    if (history.timestamps[index] > target) break;
    result = history.values[index];
  }
  return result;
}

function historyScores(history: StrikeHistory | null, current: number, sourceStrike: number, now: number, settings: BounceLevelsBuildSettings) {
  if (!history?.values.length) return { accumulation: 0.5, persistence: 0.5, freshness: 1, momentum: 0, magnitudeChangePercent: 0, shortRoc: 0, mediumRoc: 0, longRoc: 0, touches: 0, persistenceSnapshots: 0 };
  const previous = history.values.at(-1) ?? current;
  const denominator = Math.max(1, Math.abs(previous));
  const magnitudeChangePercent = 100 * (Math.abs(current) - Math.abs(previous)) / denominator;
  const signedRoc = (current - previous) / Math.max(1, Math.abs(current), Math.abs(previous));
  const accumulation = clamp01(0.5 + magnitudeChangePercent / 200);
  const sameSignValues = history.values.filter((value) => value !== 0 && Math.sign(value) === Math.sign(current));
  const persistence = sameSignValues.length / Math.max(1, history.values.length);
  const tolerance = Math.max(0.01, Math.abs(sourceStrike) * settings.touchTolerancePercent);
  let touches = 0;
  let wasTouching = false;
  let lastTouchAt = 0;
  history.sourcePrices.forEach((price, index) => {
    const touching = price !== null && Math.abs(price - sourceStrike) <= tolerance;
    if (touching && !wasTouching) { touches += 1; lastTouchAt = history.timestamps[index]; }
    wasTouching = touching;
  });
  const touchAgeScore = lastTouchAt > 0 ? Math.exp(-Math.max(0, now - lastTouchAt) / (60 * 60_000)) : 1;
  const freshness = clamp01(touchAgeScore * Math.pow(settings.touchDecayFactor, touches));
  const roc = (prior: number) => 100 * (Math.abs(current) - Math.abs(prior)) / Math.max(1, Math.abs(prior));
  return {
    accumulation,
    persistence,
    freshness,
    momentum: signedRoc,
    magnitudeChangePercent,
    shortRoc: roc(priorAtWindow(history, now, 5_000)),
    mediumRoc: roc(priorAtWindow(history, now, 300_000)),
    longRoc: roc(priorAtWindow(history, now, 900_000)),
    touches,
    persistenceSnapshots: sameSignValues.length,
  };
}

function clusterMembership(rows: NetGammaStrikeRow[], sourceSpot: number, settings: BounceLevelsBuildSettings) {
  const maximumDistance = settings.clusterDistancePoints > 0 ? settings.clusterDistancePoints / Math.max(0.000001, Math.abs(rows[0]?.mapping.beta ?? 1)) : sourceSpot * 0.0025;
  const sorted = [...rows].sort((left, right) => left.sourceStrike - right.sourceStrike);
  const result = new Map<string, { id: string; score: number }>();
  let group: NetGammaStrikeRow[] = [];
  const flush = () => {
    if (group.length >= settings.minimumClusterNodes) {
      const magnitude = group.reduce((sum, row) => sum + Math.abs(row.netExposure), 0);
      const id = `cluster:${group[0].sourceStrike}:${group.at(-1)?.sourceStrike}`;
      for (const row of group) result.set(row.id, { id, score: magnitude });
    }
    group = [];
  };
  for (const row of sorted) {
    if (!group.length || row.sourceStrike - (group.at(-1)?.sourceStrike ?? row.sourceStrike) <= maximumDistance) group.push(row);
    else { flush(); group.push(row); }
  }
  flush();
  return result;
}

function explanation(level: BounceLevel, greekMode: BounceGreekMode) {
  const sign = level.signedExposure >= 0 ? "positive" : "negative";
  const momentum = level.rateOfChangePercent >= 10 ? "building" : level.rateOfChangePercent <= -10 ? "unwinding" : "stable";
  return `${level.role.replaceAll("_", " ")} · ${sign} ${greekMode.toLowerCase()} exposure is ${momentum}; ${level.percentOfKing.toFixed(0)}% of KING magnitude, relevance ${level.relevanceScore.toFixed(0)}/100, ${level.distancePoints.toFixed(2)} points from chart price.`;
}

export function buildBounceLevelsSnapshot(profile: NetGammaProfileSnapshot, historySurface: GexIntervalProviderSurface | null, partialSettings: Partial<BounceLevelsBuildSettings> = {}): BounceLevelsSnapshot {
  const settings = { ...DEFAULT_BOUNCE_LEVELS_SETTINGS, ...partialSettings };
  const exposureHistory = buildExposureField(profile, historySurface, settings);
  const rows = profile.rows.filter((row) => Number.isFinite(row.netExposure) && Number.isFinite(row.mappedDisplayPrice));
  const nonZeroRows = rows.filter((row) => Math.abs(row.netExposure) > Number.EPSILON);
  const kingRow = nonZeroRows.reduce<NetGammaStrikeRow | null>((best, row) => !best || Math.abs(row.netExposure) > Math.abs(best.netExposure) ? row : best, null);
  const kingMagnitude = Math.abs(kingRow?.netExposure ?? 0);
  const ranks = percentileRanks(rows);
  const histories = buildHistory(historySurface, settings, profile.snapshotTimeMs);
  const clusters = clusterMembership(rows, profile.sourceSpotPrice, settings);
  const totalWeight = Math.max(0.0001, settings.magnitudeWeight + settings.proximityWeight + settings.accumulationWeight + settings.persistenceWeight + settings.freshnessWeight + settings.clusterWeight);
  const dataQuality = Math.max(0.5, clamp01((profile.mapping.mappingConfidence / 100) * (profile.status === "stale" ? 0.65 : profile.status === "delayed" ? 0.8 : 1)));

  const candidates: Candidate[] = rows.map((row) => {
    const absoluteExposure = Math.abs(row.netExposure);
    const percentOfKingFraction = kingMagnitude > 0 ? absoluteExposure / kingMagnitude : 0;
    const magnitudePercentile = ranks.get(row.id) ?? 0;
    const magnitudeScore = row.id === kingRow?.id ? 1 : 0.65 * clamp01(percentOfKingFraction) + 0.35 * magnitudePercentile;
    const distancePoints = Math.abs(row.mappedDisplayPrice - profile.displayPrice);
    const distancePercent = Math.abs(row.sourceStrike - profile.sourceSpotPrice) / Math.max(0.000001, profile.sourceSpotPrice);
    const proximity = clamp01(Math.exp(-distancePercent / Math.max(0.0001, settings.proximityDecayPercent)));
    const strikeHistory = nearestHistory(histories, row.sourceStrikes);
    const history = historyScores(strikeHistory, row.netExposure, row.sourceStrike, profile.snapshotTimeMs, settings);
    const cluster = clusters.get(row.id);
    const clusterScore = cluster && kingMagnitude > 0 ? clamp01(cluster.score / kingMagnitude) * 0.5 : 0;
    const baseRelevance = (settings.magnitudeWeight * magnitudeScore + settings.proximityWeight * proximity + settings.accumulationWeight * history.accumulation + settings.persistenceWeight * history.persistence + settings.freshnessWeight * history.freshness + settings.clusterWeight * clusterScore) / totalWeight;
    const relevanceScore = 100 * baseRelevance * dataQuality;
    const active = magnitudePercentile >= settings.minimumExposurePercentile || percentOfKingFraction >= settings.minimumPercentOfKing || relevanceScore >= settings.minimumRelevanceScore;
    const developing = !active && magnitudePercentile >= settings.developingMinimumPercentile && history.magnitudeChangePercent >= settings.developingMinimumGrowthPercent;
    const weakening = active && (history.magnitudeChangePercent <= settings.weakeningThresholdPercent || relevanceScore < settings.weakeningRelevanceThreshold);
    const retired = relevanceScore < settings.retirementRelevanceThreshold && magnitudePercentile < settings.retirementExposurePercentile && history.persistenceSnapshots >= 2;
    return {
      id: row.id,
      sourceStrike: row.sourceStrike,
      mappedPrice: row.mappedDisplayPrice,
      signedExposure: row.netExposure,
      absoluteExposure,
      callExposure: row.callExposure,
      putExposure: row.putExposure,
      magnitudePercentile,
      magnitudeScore: magnitudeScore * 100,
      percentOfKing: percentOfKingFraction * 100,
      distancePoints,
      distancePercent: distancePercent * 100,
      rateOfChangeAbsolute: row.netExposure - (strikeHistory?.values.at(-1) ?? row.netExposure),
      rateOfChangePercent: history.magnitudeChangePercent,
      shortRateOfChange: history.shortRoc,
      mediumRateOfChange: history.mediumRoc,
      longRateOfChange: history.longRoc,
      accumulationScore: history.accumulation * 100,
      persistenceScore: history.persistence * 100,
      persistenceSnapshots: history.persistenceSnapshots,
      freshnessScore: history.freshness * 100,
      clusterScore: clusterScore * 100,
      relevanceScore,
      dataQuality: dataQuality * 100,
      momentum: history.momentum,
      touches: history.touches,
      isClusterMember: Boolean(cluster),
      ...(cluster ? { clusterId: cluster.id } : {}),
      snapshotTimeMs: profile.snapshotTimeMs,
      active,
      developing,
      weakening,
      retired,
    };
  });

  const eligible = candidates.filter((node) => node.id === kingRow?.id || node.active || node.developing || node.weakening || node.retired).filter((node) => settings.maximumDistancePoints <= 0 || node.id === kingRow?.id || node.distancePoints <= settings.maximumDistancePoints);
  const structural = [...eligible].sort((left, right) => right.relevanceScore - left.relevanceScore);
  const below = structural.find((node) => node.sourceStrike < profile.sourceSpotPrice && node.active && node.id !== kingRow?.id) ?? null;
  const above = structural.find((node) => node.sourceStrike > profile.sourceSpotPrice && node.active && node.id !== kingRow?.id) ?? null;
  const destination = kingRow ? candidates.find((node) => node.id === kingRow.id) ?? null : null;
  const gatekeepersRaw = destination ? structural.filter((node) => {
    if (!node.active || node.id === destination.id) return false;
    const between = destination.sourceStrike > profile.sourceSpotPrice ? node.sourceStrike > profile.sourceSpotPrice && node.sourceStrike < destination.sourceStrike : node.sourceStrike < profile.sourceSpotPrice && node.sourceStrike > destination.sourceStrike;
    return between && node.relevanceScore >= settings.minimumGatekeeperRelevance && node.percentOfKing >= settings.minimumGatekeeperPercentOfKing * 100;
  }).slice(0, Math.max(0, Math.round(settings.maximumGatekeepers))) : [];
  const gatekeeperIds = new Set(gatekeepersRaw.map((node) => node.id));

  const classified = eligible.map((node): BounceLevel => {
    let role: BounceLevelRole;
    if (node.id === kingRow?.id) role = "KING";
    else if (gatekeeperIds.has(node.id)) role = "GATEKEEPER";
    else if (node.id === below?.id) role = "FLOOR";
    else if (node.id === above?.id) role = "CEILING";
    else if (node.retired) role = "RETIRED";
    else if (node.weakening) role = "WEAKENING";
    else if (node.developing) role = "DEVELOPING";
    else if (node.isClusterMember) role = "CLUSTER";
    else role = "MAJOR";
    const level = { ...node, role, explanation: "" } as BounceLevel;
    return { ...level, explanation: explanation(level, settings.greekMode) };
  });
  const king = classified.find((level) => level.role === "KING") ?? null;
  const ranked = classified.sort((left, right) => (right.role === "KING" ? 1 : 0) - (left.role === "KING" ? 1 : 0) || right.relevanceScore - left.relevanceScore);
  let majorCount = 0;
  const selected = ranked.filter((level) => {
    if (level.role !== "MAJOR") return true;
    majorCount += 1;
    return majorCount <= Math.max(0, Math.round(settings.maximumMajorNodes));
  }).slice(0, Math.max(1, Math.round(settings.maximumLevels))).sort((left, right) => left.mappedPrice - right.mappedPrice);
  const selectedFloor = selected.find((level) => level.role === "FLOOR") ?? (king && king.sourceStrike < profile.sourceSpotPrice ? king : null);
  const selectedCeiling = selected.find((level) => level.role === "CEILING") ?? (king && king.sourceStrike > profile.sourceSpotPrice ? king : null);
  const gatekeepers = selected.filter((level) => level.role === "GATEKEEPER");

  const activeBoundaries = selected.filter((level) => !["DEVELOPING", "RETIRED"].includes(level.role)).sort((left, right) => left.sourceStrike - right.sourceStrike);
  const airPockets: BounceAirPocket[] = [];
  for (let index = 1; index < activeBoundaries.length; index += 1) {
    const left = activeBoundaries[index - 1];
    const right = activeBoundaries[index];
    const widthPercent = (right.sourceStrike - left.sourceStrike) / Math.max(0.000001, profile.sourceSpotPrice);
    if (widthPercent < settings.minimumAirPocketWidthPercent) continue;
    const insideMagnitude = rows.filter((row) => row.sourceStrike > left.sourceStrike && row.sourceStrike < right.sourceStrike).reduce((sum, row) => sum + Math.abs(row.netExposure), 0);
    const boundaryMagnitude = Math.max(1, Math.abs(left.signedExposure) + Math.abs(right.signedExposure));
    const ratio = insideMagnitude / boundaryMagnitude;
    if (ratio <= settings.airPocketRatio) airPockets.push({ id: `${left.id}:${right.id}`, lowerPrice: left.mappedPrice, upperPrice: right.mappedPrice, magnitudeRatio: ratio });
  }
  const mapSignature = [king?.id ?? "none", selectedFloor?.id ?? "none", selectedCeiling?.id ?? "none", ...gatekeepers.map((level) => level.id)].join("|");
  return {
    schemaVersion: BOUNCE_LEVELS_SCHEMA_VERSION,
    id: `${profile.id}:bounce:${settings.greekMode}:${settings.maximumLevels}:${settings.minimumRelevanceScore}`,
    sourceTicker: profile.sourceTicker,
    displayInstrument: profile.displayInstrument,
    displayPrice: profile.displayPrice,
    greekMode: settings.greekMode,
    status: profile.status,
    snapshotTimeMs: profile.snapshotTimeMs,
    receivedTimeMs: profile.receivedTimeMs,
    refreshAfterMs: profile.refreshAfterMs,
    expirationLabel: profile.expirationLabel,
    representation: "per-one-percent-move",
    mapping: profile.mapping,
    exposureField: exposureHistory.slices,
    exposureSeries: exposureHistory.exposureSeries,
    exposureRefreshIntervalMs: exposureHistory.exposureRefreshIntervalMs,
    visualStrengthBasis: settings.visualStrengthBasis,
    rolls: exposureHistory.rolls,
    levels: selected,
    king,
    floor: selectedFloor,
    ceiling: selectedCeiling,
    gatekeepers,
    airPockets,
    mapSignature,
    limitations: [...profile.limitations, ...(historySurface?.limitations ?? []), "Bounce roles are transparent structural classifications, not a probability or guaranteed price reaction."],
  };
}

export function isBounceLevelsSnapshot(value: unknown): value is BounceLevelsSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BounceLevelsSnapshot>;
  return candidate.schemaVersion === BOUNCE_LEVELS_SCHEMA_VERSION
    && typeof candidate.id === "string"
    && Array.isArray(candidate.exposureField)
    && Array.isArray(candidate.levels)
    && typeof candidate.greekMode === "string";
}
