import type { Candle } from "@/lib/backtester";
import { cmeSessionDateKey } from "@/lib/chartHistoryWindow";

export type StructureRole = "DEMAND" | "SUPPLY" | "SUPPORT" | "RESISTANCE";
export type StructureEvidence = "HISTORICAL" | "HYBRID_L3" | "LIVE_L3";

export type TrackedLiquidityLevel = {
  side: "BID" | "ASK";
  price: number;
  size: number;
  orders: number;
  emaSize: number;
  peakSize: number;
  observations: number;
  stableObservations: number;
  persistenceMs: number;
  addedSize: number;
  removedSize: number;
  /** Largest displayed child order when supplied by the shared MBO gateway. */
  largestOrder?: number | null;
};

export type RithmicOrderLifecycleEvent = {
  sequence: number;
  timestamp: number;
  orderId: string;
  action: "ADD" | "MODIFY" | "REMOVE";
  side: "BID" | "ASK";
  price: number;
  previousPrice: number | null;
  size: number;
  previousSize: number;
};

export type RithmicLiquiditySnapshot = {
  asOf: string;
  contractSymbol: string;
  tickSize: number;
  fullDepth: boolean;
  bookValid: boolean;
  individualOrders?: boolean;
  ageMs: number | null;
  levels: TrackedLiquidityLevel[];
  bestBid?: number | null;
  bestAsk?: number | null;
  lastPrice?: number | null;
  microPrice?: number | null;
  bidDepth?: number;
  askDepth?: number;
  trades?: Array<{
    id: number;
    timestamp: number;
    price: number;
    size: number;
    side: "BUY" | "SELL";
  }>;
  orderEvents?: RithmicOrderLifecycleEvent[];
};

export type HistoricalStructureCandidate = {
  id: string;
  role: StructureRole;
  originRole: StructureRole;
  low: number;
  high: number;
  score: number;
  volumeScore: number;
  reactionScore: number;
  departureScore: number;
  freshnessScore: number;
  touchCount: number;
  originAt: number;
  source: "PRICE_ACTION" | "VOLUME_NODE";
};

export type HistoricalStructureBase = {
  instrument: string;
  currentPrice: number | null;
  atr: number;
  tickSize: number;
  asOf: string | null;
  candidates: HistoricalStructureCandidate[];
};

export type StructureChartLevel = {
  id: string;
  price: number;
  color: string;
  label: string;
  lineStyle: "solid" | "dashed" | "dotted";
  lineWidth: 1 | 2 | 3 | 4;
  axisLabelVisible: boolean;
  role: StructureRole;
  evidence: StructureEvidence;
  confidence: number;
  explanation: string;
  firstTouch: string;
  hold: string;
  break: string;
};

export type StructureChartZone = {
  id: string;
  low: number;
  high: number;
  color: string;
  fillColor: string;
  label: string;
  role: StructureRole;
  evidence: StructureEvidence;
  confidence: number;
  historicalScore: number;
  liquidityScore: number | null;
  touchCount: number;
  explanation: string;
  firstTouch: string;
  hold: string;
  break: string;
};

export type StructureLevelsSnapshot = {
  instrument: string;
  contractSymbol: string | null;
  levels: StructureChartLevel[];
  zones: StructureChartZone[];
  asOf: string | null;
  status: "LIVE_L3" | "HISTORICAL" | "UNAVAILABLE";
  source: string;
  note: string;
  atr: number | null;
};

type CandidateDraft = Omit<HistoricalStructureCandidate, "id">;

type EnrichedStructureCandidate = HistoricalStructureCandidate & {
  liquidityScore: number | null;
  evidence: StructureEvidence;
  historicalScore: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values: number[], probability: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * probability));
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function roundToTick(value: number, tickSize: number) {
  return Math.round(value / tickSize) * tickSize;
}

function candleTrueRange(candle: Candle, previous: Candle | undefined) {
  if (!previous) return Math.max(0, candle.high - candle.low);
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previous.close),
    Math.abs(candle.low - previous.close),
  );
}

function robustAtr(candles: Candle[], tickSize: number) {
  const ranges = candles.slice(-300).map((candle, index, rows) =>
    candleTrueRange(candle, index ? rows[index - 1] : undefined),
  ).filter((value) => Number.isFinite(value) && value > 0);
  return Math.max(tickSize * 8, median(ranges.slice(-100)) || median(ranges) || tickSize * 8);
}

function roleForLocation(originRole: StructureRole, low: number, high: number, currentPrice: number) {
  if (currentPrice > high) {
    return originRole === "SUPPLY" ? "SUPPORT" : originRole === "RESISTANCE" ? "SUPPORT" : originRole;
  }
  if (currentPrice < low) {
    return originRole === "DEMAND" ? "RESISTANCE" : originRole === "SUPPORT" ? "RESISTANCE" : originRole;
  }
  return originRole;
}

function roleFamily(role: StructureRole) {
  return role === "DEMAND" || role === "SUPPORT" ? "BID" : "ASK";
}

function countTouches(candles: Candle[], startIndex: number, low: number, high: number) {
  let touches = 0;
  let lastTouch = -10;
  for (let index = startIndex; index < candles.length; index += 1) {
    const candle = candles[index];
    if (candle.high < low || candle.low > high || index - lastTouch < 3) continue;
    touches += 1;
    lastTouch = index;
  }
  return touches;
}

function mergeHistoricalCandidates(
  candidates: CandidateDraft[],
  atr: number,
  tickSize: number,
  currentPrice: number,
) {
  const mergeDistance = Math.max(tickSize * 8, atr * 0.12);
  const accepted: CandidateDraft[] = [];
  for (const candidate of [...candidates].sort((left, right) => right.score - left.score)) {
    const centre = (candidate.low + candidate.high) / 2;
    const existing = accepted.find((item) => {
      // Demand/support and supply/resistance are the same directional family.
      // Keeping them separate was allowing two labels to describe the same
      // traded area and draw directly on top of one another.
      if (roleFamily(item.role) !== roleFamily(candidate.role)) return false;
      const itemCentre = (item.low + item.high) / 2;
      const overlap = candidate.low <= item.high && candidate.high >= item.low;
      return overlap || Math.abs(centre - itemCentre) <= mergeDistance;
    });
    if (!existing) {
      accepted.push({ ...candidate });
      continue;
    }
    const combinedLow = Math.min(existing.low, candidate.low);
    const combinedHigh = Math.max(existing.high, candidate.high);
    if (combinedHigh - combinedLow > atr * 0.8) continue;
    const existingScore = existing.score;
    const totalWeight = Math.max(0.01, existingScore + candidate.score);
    existing.low = roundToTick(combinedLow, tickSize);
    existing.high = roundToTick(combinedHigh, tickSize);
    existing.score = Math.max(existingScore, candidate.score) * 0.75
      + ((existingScore + candidate.score) / 2) * 0.25;
    existing.volumeScore = (existing.volumeScore * existingScore + candidate.volumeScore * candidate.score) / totalWeight;
    existing.reactionScore = Math.max(existing.reactionScore, candidate.reactionScore);
    existing.departureScore = Math.max(existing.departureScore, candidate.departureScore);
    existing.freshnessScore = Math.max(existing.freshnessScore, candidate.freshnessScore);
    existing.touchCount = Math.min(20, existing.touchCount + candidate.touchCount);
    existing.originAt = Math.max(existing.originAt, candidate.originAt);
  }

  const inPlay = accepted.filter((candidate) => currentPrice >= candidate.low && currentPrice <= candidate.high);
  const below = accepted
    .filter((candidate) => candidate.high < currentPrice)
    .sort((left, right) => right.high - left.high || right.score - left.score)
    .slice(0, 5);
  const above = accepted
    .filter((candidate) => candidate.low > currentPrice)
    .sort((left, right) => left.low - right.low || right.score - left.score)
    .slice(0, 5);
  return [...inPlay.slice(0, 2), ...below, ...above]
    .sort((left, right) => left.low - right.low)
    .map((candidate, index): HistoricalStructureCandidate => ({
      ...candidate,
      id: `structure-h-${candidate.role.toLowerCase()}-${Math.round(((candidate.low + candidate.high) / 2) / tickSize)}-${index}`,
    }));
}

export function buildHistoricalStructureBase(args: {
  candles: Candle[];
  instrument: string;
  tickSize: number;
}): HistoricalStructureBase {
  const tickSize = Number.isFinite(args.tickSize) && args.tickSize > 0 ? args.tickSize : 0.25;
  const sanitizedCandles = args.candles
    .filter((candle) => [candle.timestamp, candle.open, candle.high, candle.low, candle.close]
      .every((value) => Number.isFinite(Number(value))))
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-5_000);
  const activeSession = cmeSessionDateKey(Date.now());
  // Structure is calculated only from completed CME sessions. The active
  // Globex session is deliberately excluded so a live bar can never drag a
  // historical supply/demand zone around the chart.
  const candles = activeSession
    ? sanitizedCandles.filter((candle) => {
        const candleSession = cmeSessionDateKey(candle.timestamp);
        return candleSession !== null && candleSession < activeSession;
      })
    : sanitizedCandles;
  const currentPrice = candles.at(-1)?.close ?? null;
  const atr = robustAtr(candles, tickSize);
  if (candles.length < 40 || currentPrice === null) {
    return { instrument: args.instrument, currentPrice, atr, tickSize, asOf: null, candidates: [] };
  }

  const volumes = candles.map((candle) => Math.max(0, Number(candle.volume ?? 0)));
  const volumeLow = quantile(volumes, 0.35);
  const volumeHigh = Math.max(volumeLow + 1, quantile(volumes, 0.9));
  const drafts: CandidateDraft[] = [];
  const startIndex = Math.max(3, candles.length - 2_600);

  for (let index = startIndex; index < candles.length - 5; index += 1) {
    const candle = candles[index];
    const previous = candles.slice(index - 3, index);
    const future = candles.slice(index + 1, index + 6);
    const isPivotLow = previous.every((row) => candle.low <= row.low)
      && future.slice(0, 3).every((row) => candle.low <= row.low);
    const isPivotHigh = previous.every((row) => candle.high >= row.high)
      && future.slice(0, 3).every((row) => candle.high >= row.high);
    const futureHigh = Math.max(...future.map((row) => row.high));
    const futureLow = Math.min(...future.map((row) => row.low));
    const upwardDeparture = Math.max(0, futureHigh - Math.max(candle.open, candle.close));
    const downwardDeparture = Math.max(0, Math.min(candle.open, candle.close) - futureLow);
    const range = Math.max(tickSize, candle.high - candle.low);
    const lowerWick = Math.max(0, Math.min(candle.open, candle.close) - candle.low) / range;
    const upperWick = Math.max(0, candle.high - Math.max(candle.open, candle.close)) / range;
    const volumeScore = clamp01((Number(candle.volume ?? 0) - volumeLow) / (volumeHigh - volumeLow));
    const recencyScore = clamp01((index - startIndex) / Math.max(1, candles.length - startIndex));
    const minimumWidth = tickSize * 4;
    const maximumWidth = atr * 0.42;

    if (isPivotLow || upwardDeparture >= atr * 1.3) {
      const low = roundToTick(candle.low, tickSize);
      const high = roundToTick(Math.max(
        low + minimumWidth,
        Math.min(Math.max(candle.open, candle.close), low + maximumWidth),
      ), tickSize);
      const touches = countTouches(candles, index + 6, low, high);
      const departureScore = clamp01(upwardDeparture / (atr * 2.4));
      const freshnessScore = clamp01(1 - touches / 5);
      const reactionScore = clamp01(lowerWick * 0.65 + Math.min(touches, 3) / 3 * 0.35);
      const originRole: StructureRole = upwardDeparture >= atr * 1.05 ? "DEMAND" : "SUPPORT";
      const role = roleForLocation(originRole, low, high, currentPrice);
      const score = originRole === "DEMAND"
        ? 0.3 * departureScore + 0.22 * volumeScore + 0.2 * reactionScore + 0.18 * freshnessScore + 0.1 * recencyScore
        : 0.22 * departureScore + 0.22 * volumeScore + 0.3 * reactionScore + 0.14 * freshnessScore + 0.12 * recencyScore;
      if (score >= 0.36) drafts.push({ role, originRole, low, high, score, volumeScore, reactionScore, departureScore, freshnessScore, touchCount: Math.min(20, touches), originAt: candle.timestamp, source: "PRICE_ACTION" });
    }

    if (isPivotHigh || downwardDeparture >= atr * 1.3) {
      const high = roundToTick(candle.high, tickSize);
      const low = roundToTick(Math.min(
        high - minimumWidth,
        Math.max(Math.min(candle.open, candle.close), high - maximumWidth),
      ), tickSize);
      const touches = countTouches(candles, index + 6, low, high);
      const departureScore = clamp01(downwardDeparture / (atr * 2.4));
      const freshnessScore = clamp01(1 - touches / 5);
      const reactionScore = clamp01(upperWick * 0.65 + Math.min(touches, 3) / 3 * 0.35);
      const originRole: StructureRole = downwardDeparture >= atr * 1.05 ? "SUPPLY" : "RESISTANCE";
      const role = roleForLocation(originRole, low, high, currentPrice);
      const score = originRole === "SUPPLY"
        ? 0.3 * departureScore + 0.22 * volumeScore + 0.2 * reactionScore + 0.18 * freshnessScore + 0.1 * recencyScore
        : 0.22 * departureScore + 0.22 * volumeScore + 0.3 * reactionScore + 0.14 * freshnessScore + 0.12 * recencyScore;
      if (score >= 0.36) drafts.push({ role, originRole, low, high, score, volumeScore, reactionScore, departureScore, freshnessScore, touchCount: Math.min(20, touches), originAt: candle.timestamp, source: "PRICE_ACTION" });
    }
  }

  // Bar volume is distributed through each candle's traded range. This is not
  // presented as historical MBO; it is a transparent volume-at-price proxy used
  // to locate repeated acceptance when no historical Level 3 archive exists.
  const bucketSize = roundToTick(Math.max(tickSize * 4, atr * 0.08), tickSize);
  const profile = new Map<number, number>();
  for (const candle of candles) {
    const lowBucket = Math.floor(candle.low / bucketSize);
    const highBucket = Math.ceil(candle.high / bucketSize);
    const steps = Math.max(1, highBucket - lowBucket + 1);
    const stride = Math.max(1, Math.ceil(steps / 24));
    const typical = (candle.high + candle.low + candle.close) / 3;
    const sampled: Array<{ bucket: number; weight: number }> = [];
    for (let bucket = lowBucket; bucket <= highBucket; bucket += stride) {
      const price = bucket * bucketSize;
      const distance = Math.abs(price - typical) / Math.max(bucketSize, candle.high - candle.low);
      sampled.push({ bucket, weight: Math.max(0.2, 1 - distance) });
    }
    const weightTotal = sampled.reduce((sum, row) => sum + row.weight, 0) || 1;
    for (const row of sampled) {
      profile.set(row.bucket, (profile.get(row.bucket) ?? 0) + Math.max(1, Number(candle.volume ?? 1)) * row.weight / weightTotal);
    }
  }
  const profileRows = [...profile.entries()].sort((left, right) => left[0] - right[0]);
  const profileVolumes = profileRows.map(([, volume]) => volume);
  const nodeThreshold = quantile(profileVolumes, 0.82);
  const nodeHigh = Math.max(nodeThreshold + 1, quantile(profileVolumes, 0.97));
  profileRows.forEach(([bucket, volume], index) => {
    if (volume < nodeThreshold || volume < (profileRows[index - 1]?.[1] ?? 0) || volume < (profileRows[index + 1]?.[1] ?? 0)) return;
    const centre = bucket * bucketSize;
    const low = roundToTick(centre - bucketSize * 0.5, tickSize);
    const high = roundToTick(centre + bucketSize * 0.5, tickSize);
    const originRole: StructureRole = centre <= currentPrice ? "SUPPORT" : "RESISTANCE";
    const volumeScore = clamp01((volume - nodeThreshold) / (nodeHigh - nodeThreshold));
    const touches = countTouches(candles.slice(-600), 0, low, high);
    const reactionScore = clamp01(touches / 8);
    const score = 0.58 * volumeScore + 0.3 * reactionScore + 0.12 * clamp01(1 - Math.abs(centre - currentPrice) / (atr * 12));
    if (score >= 0.42) drafts.push({
      role: originRole,
      originRole,
      low,
      high,
      score,
      volumeScore,
      reactionScore,
      departureScore: 0,
      freshnessScore: 0.5,
      touchCount: Math.min(20, touches),
      originAt: candles.at(-1)?.timestamp ?? Date.now(),
      source: "VOLUME_NODE",
    });
  });

  return {
    instrument: args.instrument,
    currentPrice,
    atr,
    tickSize,
    asOf: new Date(candles.at(-1)!.timestamp).toISOString(),
    candidates: mergeHistoricalCandidates(drafts, atr, tickSize, currentPrice),
  };
}

function structureEducation(role: StructureRole, evidence: StructureEvidence, touchCount: number) {
  const live = evidence === "HYBRID_L3"
    ? " Live resting liquidity is currently concentrated inside the same area, strengthening the location without guaranteeing that those orders will remain."
    : evidence === "LIVE_L3"
      ? " The area is driven by unusually large, persistent resting MBO liquidity and will weaken or disappear if that liquidity is pulled."
      : " It is calculated from completed-session price response, volume-at-price, displacement and retest evidence; no historical MBO is claimed.";
  const base = role === "DEMAND"
    ? "A demand origin where price previously left with upward displacement and meaningful participation."
    : role === "SUPPLY"
      ? "A supply origin where price previously left with downward displacement and meaningful participation."
      : role === "SUPPORT"
        ? `A support or role-flip area recognised by repeated trade and rejection evidence${touchCount ? ` across ${touchCount} observed tests` : ""}.`
        : `A resistance or role-flip area recognised by repeated trade and rejection evidence${touchCount ? ` across ${touchCount} observed tests` : ""}.`;
  if (role === "DEMAND" || role === "SUPPORT") {
    return {
      explanation: `${base}${live}`,
      firstTouch: "Watch whether bid liquidity persists and aggressive selling stops progressing. A visible order can be cancelled, so price acceptance remains the confirmation.",
      hold: "Holding above the zone with replenishing bids and positive response confirms it as an active support area.",
      break: "Two accepted closes below the lower edge, especially with bids being pulled, invalidate the immediate long-side read and can turn the zone into resistance.",
    };
  }
  return {
    explanation: `${base}${live}`,
    firstTouch: "Watch whether ask liquidity persists and aggressive buying stops progressing. A visible order can be cancelled, so price acceptance remains the confirmation.",
    hold: "Holding below the zone with replenishing offers and negative response confirms it as an active resistance area.",
    break: "Two accepted closes above the upper edge, especially with offers being pulled, invalidate the immediate short-side read and can turn the zone into support.",
  };
}

function liquidityCandidates(snapshot: RithmicLiquiditySnapshot, atr: number, tickSize: number) {
  return (["BID", "ASK"] as const).flatMap((side) => {
    const rows = snapshot.levels.filter((level) => level.side === side && level.size > 0);
    const sizes = rows.map((level) => Math.max(level.size, level.emaSize));
    const orders = rows.map((level) => level.orders);
    const sizeMedian = median(sizes);
    const sizeThreshold = Math.max(sizeMedian, quantile(sizes, 0.88));
    const sizeExtreme = Math.max(sizeThreshold + 1, quantile(sizes, 0.98));
    const orderThreshold = Math.max(1, quantile(orders, 0.88));
    return rows.flatMap((level) => {
      const effectiveSize = Math.max(level.size, level.emaSize);
      if (effectiveSize < sizeThreshold) return [];
      const concentration = clamp01((effectiveSize - sizeMedian) / Math.max(1, sizeExtreme - sizeMedian));
      const persistence = clamp01(level.persistenceMs / 15_000);
      const breadth = clamp01(level.orders / orderThreshold);
      const stability = clamp01(
        (level.stableObservations / Math.max(1, level.observations)) * 0.7
        + (1 - level.removedSize / Math.max(1, level.addedSize + level.removedSize)) * 0.3,
      );
      const score = 0.45 * concentration + 0.25 * persistence + 0.18 * breadth + 0.12 * stability;
      if (score < 0.48) return [];
      const halfWidth = Math.max(tickSize * 2, Math.min(atr * 0.08, tickSize * 8));
      return [{
        side,
        price: level.price,
        low: roundToTick(level.price - halfWidth, tickSize),
        high: roundToTick(level.price + halfWidth, tickSize),
        score,
        observations: level.observations,
        persistenceMs: level.persistenceMs,
      }];
    });
  }).sort((left, right) => right.score - left.score);
}

function candidateMarketSide(candidate: Pick<HistoricalStructureCandidate, "low" | "high">, currentPrice: number) {
  if (candidate.high < currentPrice) return "BELOW" as const;
  if (candidate.low > currentPrice) return "ABOVE" as const;
  return "IN_PLAY" as const;
}

function touchAdjustedScore(candidate: EnrichedStructureCandidate) {
  if (candidate.evidence === "LIVE_L3") return candidate.score;
  // A zone becomes less informative after repeated tests. Previously those
  // touches increased the reaction score almost as quickly as they reduced
  // freshness, allowing heavily worked areas to remain on screen.
  const excessTouches = Math.max(0, candidate.touchCount - 3);
  const touchPenalty = Math.max(0.68, 1 - excessTouches * 0.055);
  return candidate.score * touchPenalty;
}

// Only publish A-grade historical structure. A literal 100% would imply a
// certainty the evidence cannot support and would often publish nothing; 80%
// is a strict, honest floor that removes the lower-quality visual noise.
const MINIMUM_PUBLISHED_STRUCTURE_SCORE = 0.8;

function consolidateStructureCandidates(args: {
  candidates: EnrichedStructureCandidate[];
  currentPrice: number;
  atr: number;
  tickSize: number;
}) {
  const clusterDistance = Math.max(args.tickSize * 8, args.atr * 0.16);
  const maximumClusterWidth = Math.max(args.tickSize * 12, args.atr * 0.52);
  const accepted: EnrichedStructureCandidate[] = [];

  for (const rawCandidate of [...args.candidates].sort((left, right) =>
    touchAdjustedScore(right) - touchAdjustedScore(left),
  )) {
    const adjustedScore = touchAdjustedScore(rawCandidate);
    const threshold = MINIMUM_PUBLISHED_STRUCTURE_SCORE;
    if (adjustedScore < threshold) continue;

    const candidate = { ...rawCandidate, score: adjustedScore };
    const candidateSide = candidateMarketSide(candidate, args.currentPrice);
    const candidateCentre = (candidate.low + candidate.high) / 2;
    const existing = accepted.find((row) => {
      if (candidateMarketSide(row, args.currentPrice) !== candidateSide) return false;
      const rowCentre = (row.low + row.high) / 2;
      const overlaps = candidate.low <= row.high && candidate.high >= row.low;
      return overlaps || Math.abs(candidateCentre - rowCentre) <= clusterDistance;
    });

    if (!existing) {
      accepted.push(candidate);
      continue;
    }

    const combinedLow = Math.min(existing.low, candidate.low);
    const combinedHigh = Math.max(existing.high, candidate.high);
    // Do not turn several nearby references into one enormous unusable band.
    // The stronger candidate already represents this cluster if the union is
    // wider than a sensible intraday reaction area.
    if (combinedHigh - combinedLow > maximumClusterWidth) continue;

    existing.low = roundToTick(combinedLow, args.tickSize);
    existing.high = roundToTick(combinedHigh, args.tickSize);
    existing.score = Math.max(existing.score, candidate.score);
    existing.volumeScore = Math.max(existing.volumeScore, candidate.volumeScore);
    existing.reactionScore = Math.max(existing.reactionScore, candidate.reactionScore);
    existing.departureScore = Math.max(existing.departureScore, candidate.departureScore);
    existing.freshnessScore = Math.max(existing.freshnessScore, candidate.freshnessScore);
    existing.touchCount = Math.max(existing.touchCount, candidate.touchCount);
    existing.originAt = Math.max(existing.originAt, candidate.originAt);
    existing.historicalScore = Math.max(existing.historicalScore, candidate.historicalScore);
    existing.liquidityScore = existing.liquidityScore === null
      ? candidate.liquidityScore
      : candidate.liquidityScore === null
        ? existing.liquidityScore
        : Math.max(existing.liquidityScore, candidate.liquidityScore);
    existing.evidence = existing.historicalScore > 0 && existing.liquidityScore !== null
      ? "HYBRID_L3"
      : existing.liquidityScore !== null
        ? "LIVE_L3"
        : "HISTORICAL";
  }

  const inPlay = accepted
    .filter((candidate) => candidateMarketSide(candidate, args.currentPrice) === "IN_PLAY")
    .sort((left, right) => right.score - left.score)
    .slice(0, 1);
  const below = accepted
    .filter((candidate) => candidateMarketSide(candidate, args.currentPrice) === "BELOW")
    .sort((left, right) => right.high - left.high || right.score - left.score)
    .slice(0, 2);
  const above = accepted
    .filter((candidate) => candidateMarketSide(candidate, args.currentPrice) === "ABOVE")
    .sort((left, right) => left.low - right.low || right.score - left.score)
    .slice(0, 2);

  return [...inPlay, ...below, ...above].sort((left, right) => left.low - right.low);
}

export function buildStructureLevelsSnapshot(args: {
  base: HistoricalStructureBase;
  liquidity: RithmicLiquiditySnapshot | null;
  upColor: string;
  downColor: string;
}): StructureLevelsSnapshot {
  const { base } = args;
  if (!base.candidates.length || base.currentPrice === null) {
    return {
      instrument: base.instrument,
      contractSymbol: args.liquidity?.contractSymbol ?? null,
      levels: [],
      zones: [],
      asOf: base.asOf,
      status: "UNAVAILABLE",
      source: "Completed-session CME structure engine",
      note: "Waiting for enough five-minute CME history to validate structural zones.",
      atr: base.atr || null,
    };
  }

  const l3Live = Boolean(
    args.liquidity?.fullDepth
    && args.liquidity.bookValid
    && (args.liquidity.ageMs === null || args.liquidity.ageMs <= 5_000),
  );
  const liveCandidates = l3Live && args.liquidity
    ? liquidityCandidates(args.liquidity, base.atr, base.tickSize)
    : [];
  const currentPrice = base.currentPrice;
  const usedLive = new Set<number>();
  const combined: EnrichedStructureCandidate[] = base.candidates.map((candidate) => {
    const desiredSide = candidate.high <= currentPrice ? "BID" : candidate.low >= currentPrice ? "ASK" : null;
    const tolerance = Math.max(base.tickSize * 8, base.atr * 0.12, (candidate.high - candidate.low) * 0.5);
    const matchIndex = liveCandidates.findIndex((live, index) =>
      !usedLive.has(index)
      && (!desiredSide || live.side === desiredSide)
      && live.price >= candidate.low - tolerance
      && live.price <= candidate.high + tolerance,
    );
    const match = matchIndex >= 0 ? liveCandidates[matchIndex] : null;
    if (match) usedLive.add(matchIndex);
    const evidence: StructureEvidence = match ? "HYBRID_L3" : "HISTORICAL";
    return {
      ...candidate,
      // Live L3 is confirmation metadata only. It is never allowed to move,
      // widen, rescore or originate a historical structure zone.
      low: candidate.low,
      high: candidate.high,
      score: candidate.score,
      liquidityScore: match?.score ?? null,
      evidence,
      historicalScore: candidate.score,
    };
  });

  const selected = consolidateStructureCandidates({
    candidates: combined,
    currentPrice,
    atr: base.atr,
    tickSize: base.tickSize,
  });

  const zones = selected.map((candidate, index): StructureChartZone => {
    const confidence = Math.round(clamp01(candidate.score) * 100);
    const color = candidate.role === "DEMAND" || candidate.role === "SUPPORT" ? args.upColor : args.downColor;
    const evidenceLabel = candidate.evidence === "HYBRID_L3" ? "L3 confirmed" : candidate.evidence === "LIVE_L3" ? "live L3" : "historical";
    const roleLabel = candidate.role[0] + candidate.role.slice(1).toLowerCase();
    const education = structureEducation(candidate.role, candidate.evidence, candidate.touchCount);
    return {
      id: `structure-zone-${candidate.id}-${index}`,
      low: roundToTick(candidate.low, base.tickSize),
      high: roundToTick(candidate.high, base.tickSize),
      color,
      fillColor: `${color}16`,
      label: `${roleLabel} · ${confidence}% · ${evidenceLabel}`,
      role: candidate.role,
      evidence: candidate.evidence,
      confidence,
      historicalScore: Math.round(clamp01(candidate.historicalScore) * 100),
      liquidityScore: candidate.liquidityScore === null ? null : Math.round(clamp01(candidate.liquidityScore) * 100),
      touchCount: candidate.touchCount,
      ...education,
    };
  });
  const levels = zones.map((zone): StructureChartLevel => ({
    id: `${zone.id}-centre`,
    price: roundToTick((zone.low + zone.high) / 2, base.tickSize),
    color: zone.color,
    label: zone.label,
    lineStyle: zone.evidence === "HISTORICAL" ? "dashed" : "solid",
    lineWidth: zone.confidence >= 80 ? 3 : zone.confidence >= 62 ? 2 : 1,
    axisLabelVisible: true,
    role: zone.role,
    evidence: zone.evidence,
    confidence: zone.confidence,
    explanation: zone.explanation,
    firstTouch: zone.firstTouch,
    hold: zone.hold,
    break: zone.break,
  }));

  return {
    instrument: base.instrument,
    contractSymbol: args.liquidity?.contractSymbol ?? null,
    levels,
    zones,
    asOf: l3Live ? args.liquidity?.asOf ?? base.asOf : base.asOf,
    status: l3Live ? "LIVE_L3" : "HISTORICAL",
    source: l3Live ? "Completed-session CME structure + live Rithmic confirmation" : "Completed-session CME price and volume structure",
    note: l3Live
      ? "A-grade zones are locked from completed CME sessions using price response, volume-at-price, displacement and retests. Live Rithmic MBO can confirm a location but cannot create, widen, rescore or move it. The map refreshes only when a new CME session begins."
      : "A-grade zones are locked from completed CME sessions using price response, volume-at-price, displacement and retests. Only locations scoring at least 80% are published, and the map refreshes only when a new CME session begins.",
    atr: base.atr,
  };
}

export function emptyStructureLevelsSnapshot(instrument = "") : StructureLevelsSnapshot {
  return {
    instrument,
    contractSymbol: null,
    levels: [],
    zones: [],
    asOf: null,
    status: "UNAVAILABLE",
    source: "Completed-session CME structure engine",
    note: "Waiting for structural data.",
    atr: null,
  };
}
