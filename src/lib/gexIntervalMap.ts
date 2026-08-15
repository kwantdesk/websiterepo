import { normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import { expirationDte, expirationMatchesFilter, roundMappedPriceToTick } from "@/lib/netGammaExposureMath";
import type { GammaExpirationFilter, StrikeMappingSnapshot } from "@/lib/netGammaExposureByStrike";

export const GEX_INTERVAL_MAP_ID = "gex-interval-map";
export const GEX_INTERVAL_MAP_SCHEMA_VERSION = 1;

export type GexIntervalMapStatus = "LIVE" | "LAST_SESSION" | "DELAYED" | "HISTORICAL";
export type GexIntervalMapMode = "raw" | "difference";
export type GexIntervalMapBaseline = "previous-bucket" | "session-open" | "rolling-average";
export type GexIntervalMapContent = "net" | "call" | "put" | "gross" | "call-put-split";
export type GexIntervalMapVisual = "bubbles" | "fixed-dots" | "heat-cells" | "horizontal-ribbons" | "hybrid";
export type GexIntervalMapAggregation = "exact-display-tick" | "auto-bin" | "custom-bin";

export type GexIntervalProviderRow = {
  expirationDate: string;
  sourceStrike: number;
  callExposure: number;
  putExposure: number;
};

export type GexIntervalProviderBucket = {
  timestamp: number;
  sourcePrice: number | null;
  rows: GexIntervalProviderRow[];
};

export type GexIntervalProviderSurface = {
  schemaVersion: 1;
  provider: "quantdata";
  representation: "provider-signed-exposure";
  sourceTicker: string;
  sessionDate: string;
  marketOpen: boolean;
  status: GexIntervalMapStatus;
  checkedAt: string;
  refreshAfterMs: number;
  aggregationPeriod: string;
  buckets: GexIntervalProviderBucket[];
  limitations: string[];
};

export type GexIntervalMapPoint = {
  id: string;
  timestamp: number;
  sourceStrike: number;
  mappedPrice: number;
  call: number;
  put: number;
  net: number;
  gross: number;
  previousNet: number | null;
  netChange: number | null;
  value: number;
  percentageOfBucketMagnitude: number;
  percentageOfVisibleMagnitude: number;
  mapping: StrikeMappingSnapshot;
  expirationDates: string[];
};

export type GexIntervalMapLevelKind = "MAX_POSITIVE" | "MAX_NEGATIVE" | "DOMINANT_ABSOLUTE" | "CALL_WALL" | "PUT_WALL";
export type GexIntervalMapLevel = { kind: GexIntervalMapLevelKind; label: string; price: number; value: number };

export type GexIntervalMapTrackPoint = {
  timestamp: number;
  price: number;
  value: number;
};

export type GexIntervalMapTracks = {
  maxPositive: GexIntervalMapTrackPoint[];
  maxNegative: GexIntervalMapTrackPoint[];
  underlyingPrice: GexIntervalMapTrackPoint[];
};

export type GexIntervalMapSnapshot = {
  id: string;
  sourceTicker: string;
  displayInstrument: string;
  sessionDate: string;
  status: GexIntervalMapStatus;
  checkedAt: string;
  refreshAfterMs: number;
  mode: GexIntervalMapMode;
  baseline: GexIntervalMapBaseline;
  content: GexIntervalMapContent;
  points: GexIntervalMapPoint[];
  levels: GexIntervalMapLevel[];
  tracks: GexIntervalMapTracks;
  netExposure: number;
  grossExposure: number;
  skippedMappingBuckets: number;
  limitations: string[];
};

export type GexIntervalMapBuildSettings = {
  mode: GexIntervalMapMode;
  baseline: GexIntervalMapBaseline;
  rollingBuckets: number;
  content: GexIntervalMapContent;
  expiration: GammaExpirationFilter;
  aggregationMode: GexIntervalMapAggregation;
  customBinSizePoints: number;
  minimumAbsoluteExposure: number;
  maximumDistancePoints: number;
  maximumPoints: number;
  maximumStrikesPerBucket?: number;
  hideZeroValues?: boolean;
};

export type DisplayPricePoint = { timestamp: number; price: number };

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeEpochMs = (value: number) => value < 100_000_000_000 ? value * 1_000 : value;

export function defaultGexIntervalMapSource(displayInstrument: string) {
  const display = normalizeGammaHeatmapInstrument(displayInstrument);
  if (display === "ES" || display === "MES") return "SPY";
  if (display === "SPX" || display === "SPY" || display === "NDX" || display === "QQQ") return display;
  return "QQQ";
}

export function isGexIntervalProviderSurface(value: unknown): value is GexIntervalProviderSurface {
  return record(value)
    && value.schemaVersion === 1
    && value.provider === "quantdata"
    && typeof value.sourceTicker === "string"
    && Array.isArray(value.buckets);
}

export function normalizeGexIntervalProviderPayload(input: {
  payload: unknown;
  pricePayload: unknown;
  sourceTicker: string;
  sessionDate: string;
  marketOpen: boolean;
  checkedAt: string;
  aggregationPeriod: string;
}): GexIntervalProviderSurface {
  const priceByTimestamp = new Map<number, number>();
  if (record(input.pricePayload) && record(input.pricePayload.data)) {
    for (const [timestampKey, raw] of Object.entries(input.pricePayload.data)) {
      if (!record(raw)) continue;
      const timestampValue = finite(timestampKey);
      const timestamp = timestampValue === null ? null : normalizeEpochMs(timestampValue);
      const price = finite(raw.closePrice);
      if (timestamp !== null && price !== null && price > 0) priceByTimestamp.set(timestamp, price);
    }
  }
  const buckets: GexIntervalProviderBucket[] = [];
  if (record(input.payload) && record(input.payload.data)) {
    for (const [timestampKey, rawBucket] of Object.entries(input.payload.data)) {
      const timestampValue = finite(timestampKey);
      const timestamp = timestampValue === null ? null : normalizeEpochMs(timestampValue);
      if (timestamp === null || !record(rawBucket)) continue;
      const rows: GexIntervalProviderRow[] = [];
      for (const [expirationDate, rawExpiry] of Object.entries(rawBucket)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationDate) || !record(rawExpiry)) continue;
        for (const [strikeKey, rawCell] of Object.entries(rawExpiry)) {
          if (!record(rawCell)) continue;
          const sourceStrike = finite(strikeKey);
          if (sourceStrike === null) continue;
          const callExposure = finite(rawCell.CALL) ?? finite(rawCell.callExposure) ?? 0;
          const putExposure = finite(rawCell.PUT) ?? finite(rawCell.putExposure) ?? 0;
          rows.push({ expirationDate, sourceStrike, callExposure, putExposure });
        }
      }
      if (rows.length) buckets.push({ timestamp, sourcePrice: priceByTimestamp.get(timestamp) ?? null, rows });
    }
  }
  buckets.sort((left, right) => left.timestamp - right.timestamp);
  return {
    schemaVersion: 1,
    provider: "quantdata",
    representation: "provider-signed-exposure",
    sourceTicker: input.sourceTicker.toUpperCase(),
    sessionDate: input.sessionDate,
    marketOpen: input.marketOpen,
    status: input.marketOpen ? "LIVE" : "LAST_SESSION",
    checkedAt: input.checkedAt,
    refreshAfterMs: input.marketOpen ? 5_000 : 60_000,
    aggregationPeriod: input.aggregationPeriod,
    buckets: buckets.slice(-720),
    limitations: buckets.length ? [] : ["The provider returned no entitled interval-map buckets for this query."],
  };
}

function nearestPrice(points: DisplayPricePoint[], timestamp: number, toleranceMs = 90_000) {
  let best: DisplayPricePoint | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const nextDistance = Math.abs(point.timestamp - timestamp);
    if (nextDistance < distance) { best = point; distance = nextDistance; }
  }
  return best && distance <= toleranceMs ? best.price : null;
}

function regressionMapping(input: {
  sourceTicker: string;
  displayInstrument: string;
  timestamp: number;
  sourcePrice: number;
  displayPrice: number;
  samples: Array<{ source: number; display: number }>;
}): StrikeMappingSnapshot {
  const source = input.sourceTicker.toUpperCase();
  const display = normalizeGammaHeatmapInstrument(input.displayInstrument);
  const direct = source === display || (source === "NQ" && display === "MNQ") || (source === "ES" && display === "MES");
  if (direct) return {
    method: "same-underlying-direct", sourceTicker: source, displayInstrument: display, alpha: 0, beta: 1,
    sourceSpotPrice: input.sourcePrice, displayMidPrice: input.displayPrice, mappedSourceSpotPrice: input.sourcePrice,
    mappingConfidence: 100, calculatedAtMs: input.timestamp, dataAgeMs: 0,
  };
  const basis = (source === "NDX" && /^(NQ|MNQ)$/.test(display)) || (source === "SPX" && /^(ES|MES)$/.test(display));
  if (basis) {
    const alpha = input.displayPrice - input.sourcePrice;
    return {
      method: "spot-futures-basis", sourceTicker: source, displayInstrument: display, alpha, beta: 1,
      sourceSpotPrice: input.sourcePrice, displayMidPrice: input.displayPrice, mappedSourceSpotPrice: input.sourcePrice + alpha,
      mappingConfidence: 92, calculatedAtMs: input.timestamp, dataAgeMs: 0,
    };
  }
  const samples = input.samples.filter((sample) => sample.source > 0 && sample.display > 0).slice(-120);
  if (samples.length >= 12) {
    const meanX = samples.reduce((sum, sample) => sum + sample.source, 0) / samples.length;
    const meanY = samples.reduce((sum, sample) => sum + sample.display, 0) / samples.length;
    const variance = samples.reduce((sum, sample) => sum + (sample.source - meanX) ** 2, 0);
    const covariance = samples.reduce((sum, sample) => sum + (sample.source - meanX) * (sample.display - meanY), 0);
    if (variance > 0) {
      const beta = covariance / variance;
      const alpha = meanY - beta * meanX;
      const total = samples.reduce((sum, sample) => sum + (sample.display - meanY) ** 2, 0);
      const residual = samples.reduce((sum, sample) => sum + (sample.display - (alpha + beta * sample.source)) ** 2, 0);
      const rSquared = total > 0 ? Math.max(0, Math.min(1, 1 - residual / total)) : 1;
      return {
        method: "rolling-affine-regression", sourceTicker: source, displayInstrument: display, alpha, beta,
        sourceSpotPrice: input.sourcePrice, displayMidPrice: input.displayPrice, mappedSourceSpotPrice: alpha + beta * input.sourcePrice,
        rSquared, sampleCount: samples.length, mappingConfidence: Math.round(rSquared * 100), calculatedAtMs: input.timestamp, dataAgeMs: 0,
      };
    }
  }
  const beta = input.displayPrice / input.sourcePrice;
  return {
    method: "live-ratio", sourceTicker: source, displayInstrument: display, alpha: 0, beta,
    sourceSpotPrice: input.sourcePrice, displayMidPrice: input.displayPrice, mappedSourceSpotPrice: input.sourcePrice * beta,
    sampleCount: samples.length, mappingConfidence: 70, calculatedAtMs: input.timestamp, dataAgeMs: 0,
  };
}

function valueFor(content: GexIntervalMapContent, call: number, put: number) {
  if (content === "call") return call;
  if (content === "put") return put;
  if (content === "gross") return Math.abs(call) + Math.abs(put);
  return call + put;
}

function deriveLevels(points: GexIntervalMapPoint[]): GexIntervalMapLevel[] {
  if (!points.length) return [];
  const latestTimestamp = Math.max(...points.map((point) => point.timestamp));
  const latest = points.filter((point) => point.timestamp === latestTimestamp);
  const maxBy = (rows: GexIntervalMapPoint[], score: (point: GexIntervalMapPoint) => number) => rows.length ? [...rows].sort((a, b) => score(b) - score(a))[0] : null;
  const positive = maxBy(latest.filter((point) => point.net > 0), (point) => point.net);
  const negative = maxBy(latest.filter((point) => point.net < 0), (point) => Math.abs(point.net));
  const dominant = maxBy(latest, (point) => Math.abs(point.net));
  const call = maxBy(latest, (point) => point.call);
  const put = maxBy(latest, (point) => -point.put);
  return [
    positive ? { kind: "MAX_POSITIVE" as const, label: "Max +GEX", price: positive.mappedPrice, value: positive.net } : null,
    negative ? { kind: "MAX_NEGATIVE" as const, label: "Max -GEX", price: negative.mappedPrice, value: negative.net } : null,
    dominant ? { kind: "DOMINANT_ABSOLUTE" as const, label: "Dominant |GEX|", price: dominant.mappedPrice, value: dominant.net } : null,
    call ? { kind: "CALL_WALL" as const, label: "Call Wall", price: call.mappedPrice, value: call.call } : null,
    put ? { kind: "PUT_WALL" as const, label: "Put Wall", price: put.mappedPrice, value: put.put } : null,
  ].filter((level): level is GexIntervalMapLevel => level !== null);
}

function deriveTracks(points: GexIntervalMapPoint[]): GexIntervalMapTracks {
  const byTimestamp = new Map<number, GexIntervalMapPoint[]>();
  for (const point of points) {
    const bucket = byTimestamp.get(point.timestamp) ?? [];
    bucket.push(point);
    byTimestamp.set(point.timestamp, bucket);
  }
  const tracks: GexIntervalMapTracks = { maxPositive: [], maxNegative: [], underlyingPrice: [] };
  for (const [timestamp, bucket] of [...byTimestamp.entries()].sort((left, right) => left[0] - right[0])) {
    const positive = bucket.filter((point) => point.net > 0).sort((left, right) => right.net - left.net)[0];
    const negative = bucket.filter((point) => point.net < 0).sort((left, right) => left.net - right.net)[0];
    const mapping = bucket[0]?.mapping;
    if (positive) tracks.maxPositive.push({ timestamp, price: positive.mappedPrice, value: positive.net });
    if (negative) tracks.maxNegative.push({ timestamp, price: negative.mappedPrice, value: negative.net });
    if (mapping?.displayMidPrice && mapping.displayMidPrice > 0) {
      tracks.underlyingPrice.push({ timestamp, price: mapping.displayMidPrice, value: 0 });
    }
  }
  return tracks;
}

function retainCompleteLatestBuckets(points: GexIntervalMapPoint[], maximumPoints: number) {
  if (points.length <= maximumPoints) return points;
  const byTimestamp = new Map<number, GexIntervalMapPoint[]>();
  for (const point of points) {
    const bucket = byTimestamp.get(point.timestamp) ?? [];
    bucket.push(point);
    byTimestamp.set(point.timestamp, bucket);
  }
  const retained: GexIntervalMapPoint[][] = [];
  let retainedCount = 0;
  const buckets = [...byTimestamp.entries()].sort((left, right) => right[0] - left[0]);
  for (const [, bucket] of buckets) {
    if (retainedCount > 0 && retainedCount + bucket.length > maximumPoints) break;
    retained.push(bucket);
    retainedCount += bucket.length;
  }
  return retained.reverse().flat();
}

export function buildGexIntervalMapSnapshot(
  surface: GexIntervalProviderSurface,
  displayInstrumentInput: string,
  displayPricesInput: DisplayPricePoint[],
  settings: GexIntervalMapBuildSettings,
): GexIntervalMapSnapshot {
  const displayInstrument = normalizeGammaHeatmapInstrument(displayInstrumentInput);
  const displayPrices = [...displayPricesInput].filter((point) => point.price > 0).sort((a, b) => a.timestamp - b.timestamp);
  const frontExpiration = surface.buckets.flatMap((bucket) => bucket.rows.map((row) => row.expirationDate)).sort()[0] ?? null;
  const filteredBuckets = surface.buckets.map((bucket) => ({
    ...bucket,
    rows: bucket.rows.filter((row) => expirationMatchesFilter(row.expirationDate, surface.sessionDate, settings.expiration, frontExpiration)),
  })).filter((bucket) => bucket.rows.length);
  const baselineRows = new Map<number, { call: number; put: number }>();
  const points: GexIntervalMapPoint[] = [];
  const mappingSamples: Array<{ source: number; display: number }> = [];
  let skippedMappingBuckets = 0;
  let latestRawNetExposure = 0;
  let latestRawGrossExposure = 0;
  const displayTick = /^(NQ|MNQ|ES|MES)$/.test(displayInstrument) ? 0.25 : 0.01;
  for (let bucketIndex = 0; bucketIndex < filteredBuckets.length; bucketIndex += 1) {
    const bucket = filteredBuckets[bucketIndex];
    const displayPrice = nearestPrice(displayPrices, bucket.timestamp);
    const directRoot = (surface.sourceTicker === "NQ" && /^(NQ|MNQ)$/.test(displayInstrument))
      || (surface.sourceTicker === "ES" && /^(ES|MES)$/.test(displayInstrument));
    const sourcePrice = bucket.sourcePrice ?? (directRoot ? displayPrice : null);
    if (!(sourcePrice && displayPrice)) { skippedMappingBuckets += 1; continue; }
    mappingSamples.push({ source: sourcePrice, display: displayPrice });
    const mapping = regressionMapping({ sourceTicker: surface.sourceTicker, displayInstrument, timestamp: bucket.timestamp, sourcePrice, displayPrice, samples: mappingSamples });
    const aggregatedSource = new Map<number, { call: number; put: number; expirations: Set<string> }>();
    for (const row of bucket.rows) {
      const current = aggregatedSource.get(row.sourceStrike) ?? { call: 0, put: 0, expirations: new Set<string>() };
      current.call += row.callExposure;
      current.put += row.putExposure;
      current.expirations.add(row.expirationDate);
      aggregatedSource.set(row.sourceStrike, current);
    }
    const previousRows = new Map<number, { call: number; put: number }>();
    const previousBucket = filteredBuckets[bucketIndex - 1];
    if (previousBucket) for (const row of previousBucket.rows) {
      const current = previousRows.get(row.sourceStrike) ?? { call: 0, put: 0 };
      current.call += row.callExposure; current.put += row.putExposure; previousRows.set(row.sourceStrike, current);
    }
    let comparison = new Map<number, { call: number; put: number }>();
    if (settings.mode === "difference") {
      if (settings.baseline === "session-open") comparison = baselineRows;
      else if (settings.baseline === "previous-bucket") {
        comparison = previousRows;
      } else {
        const prior = filteredBuckets.slice(Math.max(0, bucketIndex - settings.rollingBuckets), bucketIndex);
        for (const priorBucket of prior) for (const row of priorBucket.rows) {
          const current = comparison.get(row.sourceStrike) ?? { call: 0, put: 0 };
          current.call += row.callExposure / Math.max(1, prior.length);
          current.put += row.putExposure / Math.max(1, prior.length);
          comparison.set(row.sourceStrike, current);
        }
      }
    }
    let strikes = [...new Set([...aggregatedSource.keys(), ...comparison.keys()])];
    const maximumStrikes = Math.max(0, Math.floor(settings.maximumStrikesPerBucket ?? 0));
    if (maximumStrikes > 0 && strikes.length > maximumStrikes) {
      strikes = strikes
        .sort((left, right) => Math.abs(left - sourcePrice) - Math.abs(right - sourcePrice))
        .slice(0, maximumStrikes)
        .sort((left, right) => left - right);
    }
    const mapped = new Map<number, GexIntervalMapPoint>();
    let bucketRawNetExposure = 0;
    let bucketRawGrossExposure = 0;
    for (const sourceStrike of strikes) {
      const current = aggregatedSource.get(sourceStrike) ?? { call: 0, put: 0, expirations: new Set<string>() };
      const prior = comparison.get(sourceStrike) ?? { call: 0, put: 0 };
      const call = current.call - (settings.mode === "difference" ? prior.call : 0);
      const put = current.put - (settings.mode === "difference" ? prior.put : 0);
      const net = call + put;
      const gross = Math.abs(call) + Math.abs(put);
      const priorBucketValue = previousRows.get(sourceStrike);
      const previousNet = priorBucketValue ? priorBucketValue.call + priorBucketValue.put : null;
      const currentRawNet = current.call + current.put;
      bucketRawNetExposure += net;
      bucketRawGrossExposure += gross;
      if (gross < settings.minimumAbsoluteExposure) continue;
      if (settings.hideZeroValues !== false && gross === 0) continue;
      const rawMappedPrice = mapping.alpha + mapping.beta * sourceStrike;
      if (settings.maximumDistancePoints > 0 && Math.abs(rawMappedPrice - displayPrice) > settings.maximumDistancePoints) continue;
      const binSize = settings.aggregationMode === "custom-bin"
        ? Math.max(displayTick, settings.customBinSizePoints)
        : settings.aggregationMode === "auto-bin" ? Math.max(displayTick, displayInstrument.startsWith("NQ") || displayInstrument === "MNQ" ? 5 : 1) : displayTick;
      const { mappedDisplayPrice: mappedPrice } = roundMappedPriceToTick(rawMappedPrice, binSize);
      const existing = mapped.get(mappedPrice);
      if (existing) {
        existing.call += call; existing.put += put; existing.net += net; existing.gross += gross;
        existing.previousNet = existing.previousNet === null || previousNet === null ? null : existing.previousNet + previousNet;
        existing.netChange = existing.netChange === null || previousNet === null ? null : existing.netChange + currentRawNet - previousNet;
        existing.value = valueFor(settings.content, existing.call, existing.put);
        existing.expirationDates = [...new Set([...existing.expirationDates, ...current.expirations])];
      } else {
        mapped.set(mappedPrice, {
          id: `${bucket.timestamp}:${mappedPrice}`,
          timestamp: bucket.timestamp,
          sourceStrike,
          mappedPrice,
          call, put, net, gross,
          previousNet,
          netChange: previousNet === null ? null : currentRawNet - previousNet,
          value: valueFor(settings.content, call, put),
          percentageOfBucketMagnitude: 0,
          percentageOfVisibleMagnitude: 0,
          mapping,
          expirationDates: [...current.expirations],
        });
      }
    }
    const visibleMapped = [...mapped.values()].filter((point) => settings.hideZeroValues === false || Math.abs(point.value) > 1e-9);
    const bucketMagnitude = visibleMapped.reduce((sum, point) => sum + Math.abs(point.value), 0);
    if (bucketMagnitude > 0) for (const point of visibleMapped) point.percentageOfBucketMagnitude = Math.abs(point.value) / bucketMagnitude;
    latestRawNetExposure = bucketRawNetExposure;
    latestRawGrossExposure = bucketRawGrossExposure;
    points.push(...visibleMapped);
    if (bucketIndex === 0) for (const [strike, row] of aggregatedSource) baselineRows.set(strike, { call: row.call, put: row.put });
  }
  const bounded = retainCompleteLatestBuckets(points, Math.max(100, settings.maximumPoints));
  const visibleMagnitude = bounded.reduce((sum, point) => sum + Math.abs(point.value), 0);
  if (visibleMagnitude > 0) for (const point of bounded) point.percentageOfVisibleMagnitude = Math.abs(point.value) / visibleMagnitude;
  return {
    id: `${surface.sourceTicker}:${displayInstrument}:${surface.sessionDate}:${surface.checkedAt}:${settings.mode}:${settings.baseline}`,
    sourceTicker: surface.sourceTicker,
    displayInstrument,
    sessionDate: surface.sessionDate,
    status: surface.status,
    checkedAt: surface.checkedAt,
    refreshAfterMs: surface.refreshAfterMs,
    mode: settings.mode,
    baseline: settings.baseline,
    content: settings.content,
    points: bounded,
    levels: deriveLevels(bounded),
    tracks: deriveTracks(bounded),
    netExposure: latestRawNetExposure,
    grossExposure: latestRawGrossExposure,
    skippedMappingBuckets,
    limitations: [
      ...surface.limitations,
      ...(skippedMappingBuckets ? [`${skippedMappingBuckets} interval buckets were skipped because contemporaneous source/display prices were unavailable.`] : []),
      "Local sign changes are not labelled as a Gamma Flip.",
    ],
  };
}

export function isGexIntervalMapSnapshot(value: unknown): value is GexIntervalMapSnapshot {
  return record(value) && typeof value.id === "string" && Array.isArray(value.points) && Array.isArray(value.levels);
}

export function gexIntervalDte(expiration: string, sessionDate: string) {
  return expirationDte(expiration, sessionDate);
}
