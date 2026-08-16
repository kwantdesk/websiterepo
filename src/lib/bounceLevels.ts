import type { GexIntervalProviderBucket, GexIntervalProviderSurface } from "@/lib/gexIntervalMap";
import type { NetGammaProfileSnapshot, NetGammaStrikeRow } from "@/lib/netGammaExposureByStrike";

export const BOUNCE_LEVELS_ID = "bounce-levels";
export const BOUNCE_LEVELS_SCHEMA_VERSION = 2;

export type BounceGreekMode = "GAMMA" | "DELTA" | "VANNA" | "CHARM";
export type BounceLevelRole = "KING" | "FLOOR" | "CEILING" | "GATEKEEPER" | "MAJOR" | "CLUSTER" | "DEVELOPING" | "WEAKENING" | "RETIRED" | "AIR_POCKET";
export type BounceMomentumState = "rapid-accumulation" | "accumulating" | "stable" | "weakening" | "rapid-unwinding";
export type BounceExposureRole = "KING" | "MAJOR" | "DEVELOPING" | "WEAKENING" | "RETIRED";

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
export type BounceExposureNode = {
  id: string;
  timestamp: number;
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  callExposure: number;
  putExposure: number;
  strength: number;
  bucketShare: number;
  rateOfChangePercent: number;
  percentOfKingSigned: number;
  percentOfKingAbsolute: number;
  shortRateOfChange: number;
  mediumRateOfChange: number;
  longRateOfChange: number;
  momentumState: BounceMomentumState;
  role: BounceExposureRole;
  dataQuality: number;
  touches: number;
  freshnessScore: number;
};
export type BounceExposureSlice = {
  timestamp: number;
  sourcePrice: number | null;
  mappedSourcePrice: number | null;
  maximumAbsoluteExposure: number;
  totalAbsoluteExposure: number;
  nodes: BounceExposureNode[];
};
export type BounceLevelsSnapshot = {
  schemaVersion: 2;
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
  rocDenominatorFloor: number;
  rocOutlierClampPercent: number;
  rapidAccumulationThresholdPercent: number;
  accumulationThresholdPercent: number;
  weakeningMomentumThresholdPercent: number;
  rapidUnwindingThresholdPercent: number;
};

export const DEFAULT_BOUNCE_LEVELS_SETTINGS: BounceLevelsBuildSettings = {
  greekMode: "GAMMA",
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
  historyBuckets: 120,
  maximumNodesPerSlice: 8,
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
  rocDenominatorFloor: 100_000,
  rocOutlierClampPercent: 500,
  rapidAccumulationThresholdPercent: 20,
  accumulationThresholdPercent: 5,
  weakeningMomentumThresholdPercent: -5,
  rapidUnwindingThresholdPercent: -20,
};

type StrikeHistory = { values: number[]; timestamps: number[]; sourcePrices: Array<number | null> };
type Candidate = Omit<BounceLevel, "role" | "explanation"> & { active: boolean; developing: boolean; weakening: boolean; retired: boolean };
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function buildExposureField(
  profile: NetGammaProfileSnapshot,
  surface: GexIntervalProviderSurface | null,
  settings: BounceLevelsBuildSettings,
) {
  const selectedExpirations = new Set(profile.expirationDates);
  const maximumBuckets = Math.max(2, Math.round(settings.historyBuckets));
  const maximumNodes = Math.max(4, Math.min(64, Math.round(settings.maximumNodesPerSlice)));
  const displayTick = /^(NQ|MNQ|ES|MES|RTY|M2K)$/.test(profile.displayInstrument) ? 0.25 : 0.01;
  const mapPrice = (sourceStrike: number) => Math.round((profile.mapping.alpha + profile.mapping.beta * sourceStrike) / displayTick) * displayTick;
  const eligibleBuckets = (surface?.buckets ?? [])
    .filter((bucket) => bucket.timestamp <= profile.snapshotTimeMs)
    .slice(-maximumBuckets);
  const historyByStrike = new Map<number, Array<{ timestamp: number; absoluteExposure: number }>>();
  const touchStateByStrike = new Map<number, { inside: boolean; touches: number; lastTouchAt: number | null }>();
  const slices: BounceExposureSlice[] = [];

  const priorMagnitude = (sourceStrike: number, timestamp: number, windowMs: number) => {
    const history = historyByStrike.get(sourceStrike) ?? [];
    const target = timestamp - windowMs;
    let prior: number | undefined;
    for (const sample of history) {
      if (sample.timestamp > target) break;
      prior = sample.absoluteExposure;
    }
    return prior;
  };
  const boundedRoc = (current: number, previous: number | undefined) => {
    if (previous === undefined) return 0;
    const denominator = Math.max(1, settings.rocDenominatorFloor, Math.abs(previous));
    return Math.max(
      -Math.abs(settings.rocOutlierClampPercent),
      Math.min(Math.abs(settings.rocOutlierClampPercent), 100 * (current - Math.abs(previous)) / denominator),
    );
  };
  const momentumState = (roc: number): BounceMomentumState => {
    if (roc <= settings.rapidUnwindingThresholdPercent) return "rapid-unwinding";
    if (roc < settings.weakeningMomentumThresholdPercent) return "weakening";
    if (roc >= settings.rapidAccumulationThresholdPercent) return "rapid-accumulation";
    if (roc > settings.accumulationThresholdPercent) return "accumulating";
    return "stable";
  };

  const buildSlice = (
    timestamp: number,
    sourcePrice: number | null,
    rows: Array<{ sourceStrike: number; callExposure: number; putExposure: number; expirationDate?: string }>,
  ) => {
    const aggregate = new Map<number, { call: number; put: number }>();
    for (const row of rows) {
      if (row.expirationDate && selectedExpirations.size && !selectedExpirations.has(row.expirationDate)) continue;
      const current = aggregate.get(row.sourceStrike) ?? { call: 0, put: 0 };
      current.call += Number(row.callExposure) || 0;
      current.put += Number(row.putExposure) || 0;
      aggregate.set(row.sourceStrike, current);
    }
    const ranked = [...aggregate.entries()]
      .map(([sourceStrike, exposure]) => ({
        sourceStrike,
        callExposure: exposure.call,
        putExposure: exposure.put,
        signedExposure: exposure.call + exposure.put,
      }))
      .filter((row) => Number.isFinite(row.signedExposure) && Math.abs(row.signedExposure) > Number.EPSILON)
      .sort((left, right) => Math.abs(right.signedExposure) - Math.abs(left.signedExposure));
    const maximumAbsoluteExposure = Math.max(0, ...ranked.map((row) => Math.abs(row.signedExposure)));
    const totalAbsoluteExposure = ranked.reduce((sum, row) => sum + Math.abs(row.signedExposure), 0);
    const presentStrikes = new Set(ranked.map((row) => row.sourceStrike));
    for (const [strike, state] of touchStateByStrike) if (!presentStrikes.has(strike)) touchStateByStrike.set(strike, { ...state, inside: false });
    for (const row of ranked) {
      const prior = touchStateByStrike.get(row.sourceStrike) ?? { inside: false, touches: 0, lastTouchAt: null };
      const tolerance = Math.max(displayTick / 2, Math.abs(row.sourceStrike) * Math.max(0, settings.touchTolerancePercent));
      const inside = sourcePrice !== null && Math.abs(sourcePrice - row.sourceStrike) <= tolerance;
      touchStateByStrike.set(row.sourceStrike, {
        inside,
        touches: prior.touches + (inside && !prior.inside ? 1 : 0),
        lastTouchAt: inside && !prior.inside ? timestamp : prior.lastTouchAt,
      });
    }
    const retained = ranked.slice(0, maximumNodes);
    const nodes = retained.map((row): BounceExposureNode => {
      const absoluteExposure = Math.abs(row.signedExposure);
      const shortRateOfChange = boundedRoc(absoluteExposure, priorMagnitude(row.sourceStrike, timestamp, 60_000));
      const mediumRateOfChange = boundedRoc(absoluteExposure, priorMagnitude(row.sourceStrike, timestamp, 5 * 60_000));
      const longRateOfChange = boundedRoc(absoluteExposure, priorMagnitude(row.sourceStrike, timestamp, 15 * 60_000));
      const state = momentumState(shortRateOfChange);
      const percentOfKingAbsolute = maximumAbsoluteExposure > 0 ? absoluteExposure / maximumAbsoluteExposure : 0;
      const role: BounceExposureRole = absoluteExposure === maximumAbsoluteExposure && maximumAbsoluteExposure > 0
        ? "KING"
        : state === "rapid-unwinding" ? "RETIRED"
          : state === "weakening" ? "WEAKENING"
            : state === "rapid-accumulation" || state === "accumulating" ? "DEVELOPING" : "MAJOR";
      const touchState = touchStateByStrike.get(row.sourceStrike) ?? { inside: false, touches: 0, lastTouchAt: null };
      const minutesSinceTouch = touchState.lastTouchAt === null ? Number.POSITIVE_INFINITY : Math.max(0, timestamp - touchState.lastTouchAt) / 60_000;
      const freshnessScore = touchState.lastTouchAt === null ? 0 : 100 * Math.pow(Math.max(0.01, settings.touchDecayFactor), minutesSinceTouch / 5);
      return {
        id: `${timestamp}:${row.sourceStrike}`,
        timestamp,
        sourceStrike: row.sourceStrike,
        mappedPrice: mapPrice(row.sourceStrike),
        signedExposure: row.signedExposure,
        absoluteExposure,
        callExposure: row.callExposure,
        putExposure: row.putExposure,
        strength: percentOfKingAbsolute,
        bucketShare: totalAbsoluteExposure > 0 ? absoluteExposure / totalAbsoluteExposure : 0,
        rateOfChangePercent: shortRateOfChange,
        percentOfKingSigned: maximumAbsoluteExposure > 0 ? row.signedExposure / maximumAbsoluteExposure : 0,
        percentOfKingAbsolute,
        shortRateOfChange,
        mediumRateOfChange,
        longRateOfChange,
        momentumState: state,
        role,
        dataQuality: profile.status === "live" ? 1 : profile.status === "delayed" ? 0.8 : profile.status === "stale" ? 0.65 : 0.75,
        touches: touchState.touches,
        freshnessScore,
      };
    });
    for (const row of ranked) {
      const history = historyByStrike.get(row.sourceStrike) ?? [];
      history.push({ timestamp, absoluteExposure: Math.abs(row.signedExposure) });
      historyByStrike.set(row.sourceStrike, history);
    }
    slices.push({
      timestamp,
      sourcePrice,
      mappedSourcePrice: sourcePrice && sourcePrice > 0 ? mapPrice(sourcePrice) : null,
      maximumAbsoluteExposure,
      totalAbsoluteExposure,
      nodes,
    });
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
  return slices;
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

function percentileRanks(rows: NetGammaStrikeRow[]) {
  const sorted = [...rows].sort((left, right) => Math.abs(left.netExposure) - Math.abs(right.netExposure));
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => ranks.set(row.id, sorted.length <= 1 ? 1 : index / (sorted.length - 1)));
  return ranks;
}

function buildHistory(surface: GexIntervalProviderSurface | null, maximumBuckets: number, asOfMs: number) {
  const byStrike = new Map<number, StrikeHistory>();
  if (!surface) return byStrike;
  const eligible = surface.buckets.filter((bucket) => bucket.timestamp <= asOfMs).slice(-Math.max(2, maximumBuckets));
  for (const bucket of eligible) {
    const aggregate = new Map<number, number>();
    for (const row of bucket.rows) aggregate.set(row.sourceStrike, (aggregate.get(row.sourceStrike) ?? 0) + row.callExposure + row.putExposure);
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
  const rows = profile.rows.filter((row) => Number.isFinite(row.netExposure) && Number.isFinite(row.mappedDisplayPrice));
  const nonZeroRows = rows.filter((row) => Math.abs(row.netExposure) > Number.EPSILON);
  const kingRow = nonZeroRows.reduce<NetGammaStrikeRow | null>((best, row) => !best || Math.abs(row.netExposure) > Math.abs(best.netExposure) ? row : best, null);
  const kingMagnitude = Math.abs(kingRow?.netExposure ?? 0);
  const ranks = percentileRanks(rows);
  const histories = buildHistory(historySurface, settings.historyBuckets, profile.snapshotTimeMs);
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
    exposureField: buildExposureField(profile, historySurface, settings),
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
