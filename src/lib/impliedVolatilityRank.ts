export const IMPLIED_VOLATILITY_RANK_ID = "implied-volatility-rank";
export const IMPLIED_VOLATILITY_RANK_WORKSPACE_TOOL_ID = "tool-implied-volatility-rank";
export const IMPLIED_VOLATILITY_RANK_SCHEMA_VERSION = 1;

export type IvRankContractMode =
  | "combined"
  | "average-call-put"
  | "call"
  | "put"
  | "call-put-split";

export type IvRankStatus =
  | "loading"
  | "live"
  | "prior-session"
  | "historical"
  | "delayed"
  | "stale"
  | "unavailable"
  | "error";

export type IvPercentileTieMode = "strictly-below" | "below-or-equal" | "mid-rank";

export interface IvRankLegObservation {
  lastIv: number;
  windowMinimumIv: number;
  windowMaximumIv: number;
  ivRank: number | null;
}

export interface IvDataQuality {
  score: number;
  legCompleteness: number;
  warnings: string[];
}

export interface IvRankObservation {
  sessionDate: string;
  timestampMs: number;
  sourceTicker: string;
  displayInstrument: string;
  expirationDate: string;
  targetMaturityDays: number;
  lookBackPeriodDays: number;
  stockPrice: number;
  call?: IvRankLegObservation;
  put?: IvRankLegObservation;
  combined?: IvRankLegObservation;
  ivPercentile?: number | null;
  dataQuality: IvDataQuality;
  status: "closed" | "historical" | "prior-session";
}

export interface IvRankLivePoint {
  timestampMs: number;
  currentIv: number;
  ivRank: number | null;
  stockPrice: number | null;
  displayInstrumentPrice: number | null;
  source: "quantdata-iv-rank" | "quantdata-volatility-drift" | "databento-custom";
  status: IvRankStatus;
  ageMs: number;
}

export interface IvRankSnapshot {
  schemaVersion: 1;
  id: string;
  provider: "quantdata";
  sourceTicker: string;
  displayInstrument: string;
  contractMode: IvRankContractMode;
  lookBackPeriodDays: number;
  targetMaturityDays: number;
  observations: IvRankObservation[];
  current: IvRankLivePoint | null;
  latestHistorical: IvRankObservation | null;
  overallStatus: IvRankStatus;
  percentileAvailable: boolean;
  receivedAtMs: number;
  refreshAfterMs: number;
  rejectedRows: number;
  limitations: string[];
}

export type IvRankDisplayStatus = {
  label: string;
  shortLabel: string;
  isFresh: boolean;
};

export interface IvRankBuildOptions {
  sourceTicker: string;
  displayInstrument: string;
  contractMode: IvRankContractMode;
  lookBackPeriodDays: number;
  targetMaturityDays: number;
  minimumRangeEpsilon?: number;
  clampToZeroHundred?: boolean;
  percentileTieMode?: IvPercentileTieMode;
  useLiveIntradayIv?: boolean;
  marketOpen?: boolean;
  nowMs?: number;
  maximumForwardFillMinutes?: number;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function finiteNonNegative(value: unknown): number | null {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) && next >= 0 ? next : null;
}

function finitePositive(value: unknown): number | null {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function normalizeEpochMs(value: string | number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
}

export function calculateIvRank(
  currentIv: number,
  windowMinimumIv: number,
  windowMaximumIv: number,
  options: { minimumRangeEpsilon?: number; clampToZeroHundred?: boolean } = {},
): number | null {
  if (![currentIv, windowMinimumIv, windowMaximumIv].every(Number.isFinite)) return null;
  const range = windowMaximumIv - windowMinimumIv;
  if (range <= (options.minimumRangeEpsilon ?? 1e-8)) return null;
  const rank = 100 * (currentIv - windowMinimumIv) / range;
  return options.clampToZeroHundred === false ? rank : Math.max(0, Math.min(100, rank));
}

export function calculateIvPercentile(
  historicalIv: number[],
  currentIv: number,
  tieMode: IvPercentileTieMode = "strictly-below",
): number | null {
  const valid = historicalIv.filter((value) => Number.isFinite(value) && value >= 0);
  if (!valid.length || !Number.isFinite(currentIv) || currentIv < 0) return null;
  const below = valid.filter((value) => value < currentIv).length;
  const equal = valid.filter((value) => value === currentIv).length;
  const count = tieMode === "below-or-equal"
    ? below + equal
    : tieMode === "mid-rank"
      ? below + equal / 2
      : below;
  return 100 * count / valid.length;
}

export function deriveIvRankDisplayStatus(input: {
  status: IvRankStatus | null | undefined;
  ageMs?: number | null;
  delayedMinutes?: number | null;
  hasPriorSessionRange?: boolean;
}): IvRankDisplayStatus {
  const status = input.status ?? "unavailable";
  if (status === "live") {
    return {
      label: input.hasPriorSessionRange === false ? "LIVE" : "LIVE IV · PRIOR SESSION RANGE",
      shortLabel: "LIVE",
      isFresh: true,
    };
  }
  if (status === "prior-session" || status === "historical") {
    return { label: "PRIOR SESSION", shortLabel: "PRIOR", isFresh: false };
  }
  if (status === "delayed") {
    const delay = Math.max(0, Math.round(input.delayedMinutes ?? (input.ageMs ?? 0) / 60_000));
    return { label: `DELAYED · ${delay}m`, shortLabel: "DELAYED", isFresh: false };
  }
  if (status === "stale") {
    const age = Math.max(0, Math.round((input.ageMs ?? 0) / 60_000));
    return { label: `STALE · LAST UPDATE ${age}m`, shortLabel: "STALE", isFresh: false };
  }
  if (status === "loading") return { label: "LOADING", shortLabel: "LOADING", isFresh: false };
  if (status === "error") return { label: "ERROR", shortLabel: "ERROR", isFresh: false };
  return { label: "UNAVAILABLE", shortLabel: "UNAVAILABLE", isFresh: false };
}

export function combineCallPutLegs(
  call: IvRankLegObservation | undefined,
  put: IvRankLegObservation | undefined,
): IvRankLegObservation | undefined {
  if (!call && !put) return undefined;
  if (!call) return put;
  if (!put) return call;
  const lastIv = (call.lastIv + put.lastIv) / 2;
  const windowMinimumIv = (call.windowMinimumIv + put.windowMinimumIv) / 2;
  const windowMaximumIv = (call.windowMaximumIv + put.windowMaximumIv) / 2;
  return { lastIv, windowMinimumIv, windowMaximumIv, ivRank: null };
}

export function interpolateConstantMaturityIv(input: {
  iv1: number;
  time1: number;
  iv2: number;
  time2: number;
  targetTime: number;
}): number | null {
  const { iv1, time1, iv2, time2, targetTime } = input;
  if (![iv1, time1, iv2, time2, targetTime].every(Number.isFinite)) return null;
  if (iv1 < 0 || iv2 < 0 || time1 <= 0 || time2 <= time1 || targetTime < time1 || targetTime > time2) return null;
  const weight = (targetTime - time1) / (time2 - time1);
  const variance1 = iv1 * iv1 * time1;
  const variance2 = iv2 * iv2 * time2;
  const targetVariance = variance1 + weight * (variance2 - variance1);
  return targetVariance >= 0 ? Math.sqrt(targetVariance / targetTime) : null;
}

function parseLeg(value: unknown, options: IvRankBuildOptions): IvRankLegObservation | undefined {
  const item = record(value);
  if (!item) return undefined;
  const lastIv = finiteNonNegative(item.lastIv);
  const windowMinimumIv = finiteNonNegative(item.windowMinIv);
  const windowMaximumIv = finiteNonNegative(item.windowMaxIv);
  if (lastIv === null || windowMinimumIv === null || windowMaximumIv === null || windowMaximumIv < windowMinimumIv) return undefined;
  return {
    lastIv,
    windowMinimumIv,
    windowMaximumIv,
    ivRank: calculateIvRank(lastIv, windowMinimumIv, windowMaximumIv, {
      minimumRangeEpsilon: options.minimumRangeEpsilon,
      clampToZeroHundred: options.clampToZeroHundred,
    }),
  };
}

function selectedLeg(observation: IvRankObservation, mode: IvRankContractMode) {
  if (mode === "call") return observation.call;
  if (mode === "put") return observation.put;
  return observation.combined;
}

function sessionDateTimestamp(sessionDate: string) {
  return Date.parse(`${sessionDate}T20:00:00.000Z`);
}

function parseLatestDrift(payload: unknown) {
  const root = record(payload);
  const data = record(root?.data);
  if (!data) return null;
  return Object.entries(data)
    .flatMap(([timestamp, raw]) => {
      const item = record(raw);
      const timestampMs = normalizeEpochMs(timestamp);
      const iv = finiteNonNegative(item?.iv);
      if (!item || timestampMs === null || iv === null) return [];
      return [{
        timestampMs,
        iv,
        stockPrice: finitePositive(item.stockPrice),
      }];
    })
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .at(-1) ?? null;
}

export function buildIvRankSnapshot(
  providerPayload: unknown,
  volatilityDriftPayload: unknown,
  options: IvRankBuildOptions,
): IvRankSnapshot {
  const nowMs = options.nowMs ?? Date.now();
  const root = record(providerPayload);
  const data = record(root?.data);
  let rejectedRows = 0;
  const observations = Object.entries(data ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([sessionDate, raw]) => {
      const item = record(raw);
      const legs = record(item?.contractTypeToIVData);
      const expirationDate = typeof item?.expirationDate === "string" ? item.expirationDate : "";
      const stockPrice = finitePositive(item?.stockPrice);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate) || stockPrice === null || !legs) {
        rejectedRows += 1;
        return [];
      }
      const call = parseLeg(legs.CALL, options);
      const put = parseLeg(legs.PUT, options);
      const combined = combineCallPutLegs(call, put);
      if (!call && !put) {
        rejectedRows += 1;
        return [];
      }
      if (combined) {
        combined.ivRank = calculateIvRank(combined.lastIv, combined.windowMinimumIv, combined.windowMaximumIv, {
          minimumRangeEpsilon: options.minimumRangeEpsilon,
          clampToZeroHundred: options.clampToZeroHundred,
        });
      }
      const warnings: string[] = [];
      if (!call || !put) warnings.push(`Only the ${call ? "call" : "put"} IV leg was available.`);
      const observation: IvRankObservation = {
        sessionDate,
        timestampMs: sessionDateTimestamp(sessionDate),
        sourceTicker: options.sourceTicker,
        displayInstrument: options.displayInstrument,
        expirationDate,
        targetMaturityDays: options.targetMaturityDays,
        lookBackPeriodDays: options.lookBackPeriodDays,
        stockPrice,
        call,
        put,
        combined,
        ivPercentile: null,
        dataQuality: {
          score: call && put ? 100 : 72,
          legCompleteness: call && put ? 100 : 50,
          warnings,
        },
        status: "historical",
      };
      return [observation];
    });

  const selectedHistory: number[] = [];
  for (const observation of observations) {
    const leg = selectedLeg(observation, options.contractMode);
    if (!leg) continue;
    observation.ivPercentile = calculateIvPercentile(
      selectedHistory,
      leg.lastIv,
      options.percentileTieMode,
    );
    selectedHistory.push(leg.lastIv);
  }

  const latestHistorical = observations.at(-1) ?? null;
  if (latestHistorical) latestHistorical.status = "prior-session";
  const latestLeg = latestHistorical ? selectedLeg(latestHistorical, options.contractMode) : undefined;
  const drift = options.useLiveIntradayIv === false ? null : parseLatestDrift(volatilityDriftPayload);
  const maximumDriftAgeMs = (options.maximumForwardFillMinutes ?? 5) * 60_000;
  const liveFresh = Boolean(options.marketOpen && drift && Math.max(0, nowMs - drift.timestampMs) <= maximumDriftAgeMs);
  const currentIv = liveFresh && drift ? drift.iv : latestLeg?.lastIv ?? null;
  const current = latestLeg && currentIv !== null ? {
    timestampMs: liveFresh && drift ? drift.timestampMs : latestHistorical!.timestampMs,
    currentIv,
    ivRank: calculateIvRank(currentIv, latestLeg.windowMinimumIv, latestLeg.windowMaximumIv, {
      minimumRangeEpsilon: options.minimumRangeEpsilon,
      clampToZeroHundred: options.clampToZeroHundred,
    }),
    stockPrice: liveFresh && drift ? drift.stockPrice : latestHistorical!.stockPrice,
    displayInstrumentPrice: null,
    source: liveFresh ? "quantdata-volatility-drift" as const : "quantdata-iv-rank" as const,
    status: liveFresh ? "live" as const : "prior-session" as const,
    ageMs: liveFresh && drift ? Math.max(0, nowMs - drift.timestampMs) : Math.max(0, nowMs - latestHistorical!.timestampMs),
  } : null;
  const limitations: string[] = [];
  if (!observations.length) limitations.push("No valid IV Rank history was returned for this ticker and maturity.");
  if (options.marketOpen && !liveFresh) limitations.push("Live current IV is unavailable; the latest completed session remains visible.");

  return {
    schemaVersion: 1,
    id: IMPLIED_VOLATILITY_RANK_ID,
    provider: "quantdata",
    sourceTicker: options.sourceTicker,
    displayInstrument: options.displayInstrument,
    contractMode: options.contractMode,
    lookBackPeriodDays: options.lookBackPeriodDays,
    targetMaturityDays: options.targetMaturityDays,
    observations,
    current,
    latestHistorical,
    overallStatus: current?.status ?? (observations.length ? "historical" : "unavailable"),
    percentileAvailable: selectedHistory.length >= 2,
    receivedAtMs: nowMs,
    refreshAfterMs: options.marketOpen ? 15_000 : 300_000,
    rejectedRows,
    limitations,
  };
}

export function automaticIvSourceTicker(instrument: string) {
  const root = instrument.toUpperCase().replace(/\.[VNC]\.\d+$/i, "").replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
  if (root === "NQ" || root === "MNQ") return "QQQ";
  if (root === "ES" || root === "MES") return "SPY";
  if (["QQQ", "NDX", "SPY", "SPX", "IWM", "DIA"].includes(root)) return root;
  return "QQQ";
}

export function impliedVolatilityRankCacheKey(input: {
  provider?: string;
  sourceTicker: string;
  displayInstrument: string;
  lookBackPeriodDays: number;
  targetMaturityDays: number;
  contractMode: IvRankContractMode;
  useLiveIntradayIv: boolean;
  maximumForwardFillMinutes?: number;
  carryLastValid?: boolean;
}) {
  return [
    input.provider ?? "quantdata",
    input.sourceTicker.toUpperCase(),
    input.displayInstrument.toUpperCase(),
    input.lookBackPeriodDays,
    input.targetMaturityDays,
    input.contractMode,
    input.useLiveIntradayIv ? "live" : "session",
    Math.max(0, Math.round(input.maximumForwardFillMinutes ?? 5)),
    input.carryLastValid === false ? "discard" : "carry",
  ].join(":");
}

export function validateIvRankSnapshot(value: unknown): value is IvRankSnapshot {
  const item = record(value);
  return item?.schemaVersion === 1
    && item.id === IMPLIED_VOLATILITY_RANK_ID
    && item.provider === "quantdata"
    && typeof item.sourceTicker === "string"
    && typeof item.displayInstrument === "string"
    && Array.isArray(item.observations);
}

export function displayIvPercent(fraction: number | null | undefined, decimals = 2) {
  return typeof fraction === "number" && Number.isFinite(fraction)
    ? `${(fraction * 100).toFixed(decimals)}%`
    : "—";
}
