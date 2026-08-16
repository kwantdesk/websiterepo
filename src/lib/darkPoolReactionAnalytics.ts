export type DarkPoolReactionResolution = "tick" | "1s" | "1m" | "3m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "chart";
export type DarkPoolDistanceMode = "ticks" | "absolute" | "percentage" | "basis-points" | "atr";
export type DarkPoolReactionSession = "regular-hours" | "extended-hours" | "all";
export type DarkPoolBreakConfirmation = "intrabar" | "1-close" | "2-closes" | "3-closes" | "time-beyond";

export type DarkPoolReactionPriceSample = {
  timestampMs: number;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  atr?: number;
  resolution?: DarkPoolReactionResolution;
};

export type DarkPoolReactionGexContext = {
  nearestNodePrice: number | null;
  nearestNodeRole: string | null;
  signedExposure: number | null;
  absoluteExposure: number | null;
  percentOfKing: number | null;
  distanceToNode: number | null;
  distanceToNodePct: number | null;
  kingPrice: number | null;
  kingDistancePct: number | null;
  dataTimestampMs: number | null;
};

export type DarkPoolInteraction = {
  id: string;
  darkPoolPrintId: string;
  levelPrice: number;
  approachSide: "FROM_ABOVE" | "FROM_BELOW" | "UNKNOWN";
  touchTimestampMs: number;
  touchPrice: number;
  minimumDistance: number;
  minimumDistancePct: number;
  minimumDistanceTicks: number;
  entryTimestampMs: number;
  exitTimestampMs: number | null;
  durationMs: number | null;
  totalTimeInZoneMs: number;
  reentryCount: number;
  outcome: "HOLD" | "BREAK" | "RECLAIM" | "UNRESOLVED";
  reactionDirection: "UP" | "DOWN" | "NONE";
  maxFavorableExcursion: number;
  maxFavorableExcursionPct: number;
  maxFavorableExcursionTicks: number;
  maxAdverseExcursion: number;
  maxAdverseExcursionPct: number;
  maxAdverseExcursionTicks: number;
  reactionMagnitude: number;
  reactionMagnitudePct: number;
  barsToReaction: number | null;
  timeToReactionMs: number | null;
  breakTimestampMs: number | null;
  reclaimTimestampMs: number | null;
  timeBeyondLevelMs: number | null;
  distanceBeforeReclaim: number | null;
  reactionQuality: number | null;
  gexContextAtTouch?: DarkPoolReactionGexContext;
  // Compatibility aliases for existing chart renderers and exported studies.
  timestampMs: number;
  observedPrice: number;
  touchError: number;
  touchErrorPercent: number;
  touchErrorTicks: number;
  approach: "FROM_ABOVE" | "FROM_BELOW" | "UNKNOWN";
  reaction: number;
  mfe: number;
  mae: number;
};

export type DarkPoolReactionAnalytics = {
  darkPoolPrintId: string;
  levelPrice: number;
  firstEligibleInteractionMs: number | null;
  touchCount: number;
  holdCount: number;
  breakCount: number;
  reclaimCount: number;
  latestInteraction?: DarkPoolInteraction;
  interactions: DarkPoolInteraction[];
  freshness: "FRESH" | "TOUCHED_ONCE" | "MULTI_TOUCH" | "BROKEN" | "RECLAIMED";
  currentDistanceAbsolute: number;
  currentDistancePct: number;
  historicalReactionScore?: number;
  dataThroughMs: number;
  resolution: DarkPoolReactionResolution;
  supportsTickClaim: boolean;
  medianTouchError: number | null;
  medianTouchErrorTicks: number | null;
  medianReaction: number | null;
  medianMfe: number | null;
  medianMae: number | null;
  averageTouchError: number | null;
  averageReaction: number | null;
  averageMfe: number | null;
  averageMae: number | null;
  averageTimeToReactionMs: number | null;
  holdRate: number | null;
  breakRate: number | null;
  reclaimRate: number | null;
  // Compatibility aliases used by the existing chart and inspector.
  touches: DarkPoolInteraction[];
  holds: number;
  breaks: number;
  reclaims: number;
  latestOutcome: DarkPoolInteraction["outcome"] | "NONE";
};

export type DarkPoolReactionSettings = {
  interactionToleranceMode: DarkPoolDistanceMode;
  interactionTolerance: number;
  resetDistanceMode: DarkPoolDistanceMode;
  resetDistance: number;
  minimumTimeOutsideMs: number;
  useIntrabarHighLow: boolean;
  interactionSession: DarkPoolReactionSession;
  reactionThresholdMode: DarkPoolDistanceMode;
  reactionThreshold: number;
  maximumConfirmationBars: number;
  requireCloseAwayFromLevel: boolean;
  minimumReactionDurationMs: number;
  breakDistanceMode: DarkPoolDistanceMode;
  breakDistance: number;
  breakConfirmation: DarkPoolBreakConfirmation;
  breakTimeBeyondMs: number;
  useVolumeConfirmation: boolean;
  volumeThreshold: number;
  enableReclaimDetection: boolean;
  reclaimConfirmationCloses: number;
  minimumTimeBeyondBeforeReclaimMs: number;
  reactionHorizonBars: number;
  reactionHorizonMs: number;
  firstTouchOnly: boolean;
  minimumStatsSamples: number;
  qualityPrecisionWeight: number;
  qualityExcursionWeight: number;
  qualityEfficiencyWeight: number;
  qualitySpeedWeight: number;
  qualityFreshnessWeight: number;
  qualityGexWeight: number;
};

const EPSILON = 1e-12;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function samplePrice(sample: DarkPoolReactionPriceSample) {
  return sample.price ?? sample.close ?? sample.open ?? sample.high ?? sample.low ?? null;
}

function sampleDistance(sample: DarkPoolReactionPriceSample, level: number, useIntrabar: boolean) {
  if (useIntrabar && typeof sample.high === "number" && typeof sample.low === "number") {
    if (level >= sample.low && level <= sample.high) return { distance: 0, observed: level };
    if (level > sample.high) return { distance: level - sample.high, observed: sample.high };
    return { distance: sample.low - level, observed: sample.low };
  }
  const price = samplePrice(sample);
  return price === null ? { distance: Number.POSITIVE_INFINITY, observed: level } : { distance: Math.abs(price - level), observed: price };
}

function sessionMinutes(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (record.weekday === "Sat" || record.weekday === "Sun") return null;
  return Number(record.hour) * 60 + Number(record.minute);
}

function isInSession(timestampMs: number, session: DarkPoolReactionSession) {
  if (session === "all") return true;
  const minutes = sessionMinutes(timestampMs);
  if (minutes === null) return false;
  if (session === "regular-hours") return minutes >= 570 && minutes < 960;
  return minutes >= 240 && minutes < 1_200;
}

function distanceForMode(
  levelPrice: number,
  tickSize: number,
  mode: DarkPoolDistanceMode,
  value: number,
  atr?: number,
) {
  if (mode === "absolute") return Math.max(0, value);
  if (mode === "percentage") return Math.max(0, levelPrice * value / 100);
  if (mode === "basis-points") return Math.max(0, levelPrice * value / 10_000);
  if (mode === "atr") return Math.max(0, (atr ?? 0) * value);
  return Math.max(0, tickSize * value);
}

function closeOf(sample: DarkPoolReactionPriceSample) {
  return sample.close ?? sample.price ?? sample.open ?? null;
}

function extreme(sample: DarkPoolReactionPriceSample, direction: "UP" | "DOWN") {
  if (direction === "UP") return sample.high ?? samplePrice(sample);
  return sample.low ?? samplePrice(sample);
}

function adverseExtreme(sample: DarkPoolReactionPriceSample, direction: "UP" | "DOWN") {
  if (direction === "UP") return sample.low ?? samplePrice(sample);
  return sample.high ?? samplePrice(sample);
}

function confirmedBeyond(
  samples: DarkPoolReactionPriceSample[],
  index: number,
  direction: "UP" | "DOWN",
  boundary: number,
  settings: DarkPoolReactionSettings,
  firstBeyondMs: number | null,
) {
  const sample = samples[index];
  const beyondIntrabar = direction === "DOWN"
    ? (sample.low ?? closeOf(sample) ?? Number.POSITIVE_INFINITY) < boundary
    : (sample.high ?? closeOf(sample) ?? Number.NEGATIVE_INFINITY) > boundary;
  if (settings.breakConfirmation === "intrabar") return beyondIntrabar;
  const closesNeeded = settings.breakConfirmation === "2-closes" ? 2 : settings.breakConfirmation === "3-closes" ? 3 : 1;
  if (settings.breakConfirmation === "time-beyond") {
    const close = closeOf(sample);
    const beyond = close !== null && (direction === "DOWN" ? close < boundary : close > boundary);
    return beyond && firstBeyondMs !== null && sample.timestampMs - firstBeyondMs >= settings.breakTimeBeyondMs;
  }
  if (index + 1 < closesNeeded) return false;
  for (let offset = 0; offset < closesNeeded; offset += 1) {
    const close = closeOf(samples[index - offset]);
    if (close === null || !(direction === "DOWN" ? close < boundary : close > boundary)) return false;
    if (settings.useVolumeConfirmation && (samples[index - offset].volume ?? 0) < settings.volumeThreshold) return false;
  }
  return true;
}

function reactionConfirmed(sample: DarkPoolReactionPriceSample, direction: "UP" | "DOWN", boundary: number, requireClose: boolean) {
  const value = requireClose ? closeOf(sample) : extreme(sample, direction);
  return value !== null && (direction === "UP" ? value >= boundary : value <= boundary);
}

function calculateQuality(
  interaction: Pick<DarkPoolInteraction, "minimumDistance" | "maxFavorableExcursion" | "maxAdverseExcursion" | "timeToReactionMs">,
  touchDistance: number,
  reactionTarget: number,
  horizonMs: number,
  touchIndex: number,
  gexScore: number,
  settings: DarkPoolReactionSettings,
) {
  const precision = 1 - clamp01(interaction.minimumDistance / Math.max(EPSILON, touchDistance));
  const excursion = clamp01(interaction.maxFavorableExcursion / Math.max(EPSILON, reactionTarget));
  const efficiency = interaction.maxFavorableExcursion / Math.max(EPSILON, interaction.maxFavorableExcursion + interaction.maxAdverseExcursion);
  const speed = interaction.timeToReactionMs === null ? 0 : 1 - clamp01(interaction.timeToReactionMs / Math.max(1, horizonMs));
  const freshness = touchIndex === 0 ? 1 : touchIndex === 1 ? 0.8 : touchIndex === 2 ? 0.6 : 0.4;
  const weights = [
    settings.qualityPrecisionWeight,
    settings.qualityExcursionWeight,
    settings.qualityEfficiencyWeight,
    settings.qualitySpeedWeight,
    settings.qualityFreshnessWeight,
    settings.qualityGexWeight,
  ];
  const total = Math.max(EPSILON, weights.reduce((sum, value) => sum + Math.max(0, value), 0));
  return 100 * (
    Math.max(0, weights[0]) * precision +
    Math.max(0, weights[1]) * excursion +
    Math.max(0, weights[2]) * efficiency +
    Math.max(0, weights[3]) * speed +
    Math.max(0, weights[4]) * freshness +
    Math.max(0, weights[5]) * clamp01(gexScore)
  ) / total;
}

export function calculateDarkPoolReactionAnalytics(args: {
  darkPoolPrintId: string;
  levelPrice: number;
  observableAtMs: number;
  samples: DarkPoolReactionPriceSample[];
  tickSize: number;
  settings: DarkPoolReactionSettings;
  asOfMs: number;
  currentPrice?: number | null;
  gexAtTouch?: (timestampMs: number) => DarkPoolReactionGexContext | undefined;
}) : DarkPoolReactionAnalytics | null {
  const samples = args.samples
    .filter((sample) => sample.timestampMs >= args.observableAtMs && sample.timestampMs <= args.asOfMs && samplePrice(sample) !== null)
    .filter((sample) => isInSession(sample.timestampMs, args.settings.interactionSession))
    .sort((left, right) => left.timestampMs - right.timestampMs);
  if (!samples.length) return null;
  const resolution = samples.find((sample) => sample.resolution)?.resolution ?? "chart";
  const interactions: DarkPoolInteraction[] = [];
  let eligible = true;
  let outsideSinceMs: number | null = samples[0].timestampMs;
  let lastOutsidePrice: number | null = samplePrice(samples[0]);

  for (let entryIndex = 0; entryIndex < samples.length; entryIndex += 1) {
    const sample = samples[entryIndex];
    const atr = sample.atr;
    const touchDistance = distanceForMode(args.levelPrice, args.tickSize, args.settings.interactionToleranceMode, args.settings.interactionTolerance, atr);
    const resetDistance = Math.max(touchDistance, distanceForMode(args.levelPrice, args.tickSize, args.settings.resetDistanceMode, args.settings.resetDistance, atr));
    const distance = sampleDistance(sample, args.levelPrice, args.settings.useIntrabarHighLow);
    const reference = samplePrice(sample) ?? args.levelPrice;
    const outsideReset = Math.abs(reference - args.levelPrice) >= resetDistance - EPSILON;
    if (outsideReset) {
      if (outsideSinceMs === null) outsideSinceMs = sample.timestampMs;
      lastOutsidePrice = reference;
      if (sample.timestampMs - outsideSinceMs >= args.settings.minimumTimeOutsideMs) eligible = true;
    } else if (distance.distance > touchDistance) {
      outsideSinceMs = null;
      lastOutsidePrice = reference;
    }
    if (!eligible || distance.distance > touchDistance + EPSILON) continue;

    const approachSide = lastOutsidePrice === null
      ? "UNKNOWN"
      : lastOutsidePrice > args.levelPrice ? "FROM_ABOVE" : lastOutsidePrice < args.levelPrice ? "FROM_BELOW" : "UNKNOWN";
    const reactionDirection = approachSide === "FROM_ABOVE" ? "UP" : approachSide === "FROM_BELOW" ? "DOWN" : "NONE";
    const breakDirection = approachSide === "FROM_ABOVE" ? "DOWN" : approachSide === "FROM_BELOW" ? "UP" : null;
    const reactionDistance = distanceForMode(args.levelPrice, args.tickSize, args.settings.reactionThresholdMode, args.settings.reactionThreshold, atr);
    const breakDistance = distanceForMode(args.levelPrice, args.tickSize, args.settings.breakDistanceMode, args.settings.breakDistance, atr);
    const maxEndIndex = Math.min(samples.length - 1, entryIndex + Math.max(1, args.settings.reactionHorizonBars));
    const horizonEndMs = Math.min(args.asOfMs, sample.timestampMs + Math.max(1_000, args.settings.reactionHorizonMs));
    let endIndex = entryIndex;
    while (endIndex + 1 <= maxEndIndex && samples[endIndex + 1].timestampMs <= horizonEndMs) endIndex += 1;

    let minDistance = distance.distance;
    let touchPrice = distance.observed;
    let maxFavorable = 0;
    let maxAdverse = 0;
    let reactionMagnitude = 0;
    let timeToReactionMs: number | null = null;
    let barsToReaction: number | null = null;
    let breakTimestampMs: number | null = null;
    let reclaimTimestampMs: number | null = null;
    let firstBeyondMs: number | null = null;
    let maximumBeyondDistance = 0;
    let exitTimestampMs: number | null = null;
    let totalTimeInZoneMs = 0;
    let reentryCount = 0;
    let wasInZone = true;
    let lastZoneMs = sample.timestampMs;
    let outcome: DarkPoolInteraction["outcome"] = "UNRESOLVED";
    let reclaimCloses = 0;

    for (let index = entryIndex; index <= endIndex; index += 1) {
      const candidate = samples[index];
      const candidateDistance = sampleDistance(candidate, args.levelPrice, args.settings.useIntrabarHighLow);
      if (candidateDistance.distance < minDistance) {
        minDistance = candidateDistance.distance;
        touchPrice = candidateDistance.observed;
      }
      const inZone = candidateDistance.distance <= touchDistance + EPSILON;
      if (inZone) {
        if (!wasInZone) reentryCount += 1;
        if (index > entryIndex) totalTimeInZoneMs += Math.max(0, candidate.timestampMs - lastZoneMs);
        lastZoneMs = candidate.timestampMs;
      } else if (wasInZone) {
        exitTimestampMs = candidate.timestampMs;
      }
      wasInZone = inZone;

      if (reactionDirection !== "NONE") {
        const favorable = extreme(candidate, reactionDirection);
        const adverse = adverseExtreme(candidate, reactionDirection);
        if (favorable !== null) maxFavorable = Math.max(maxFavorable, reactionDirection === "UP" ? favorable - args.levelPrice : args.levelPrice - favorable);
        if (adverse !== null) maxAdverse = Math.max(maxAdverse, reactionDirection === "UP" ? args.levelPrice - adverse : adverse - args.levelPrice);
      }

      if (breakDirection && breakTimestampMs === null) {
        const boundary = breakDirection === "DOWN" ? args.levelPrice - breakDistance : args.levelPrice + breakDistance;
        const close = closeOf(candidate);
        const beyond = close !== null && (breakDirection === "DOWN" ? close < boundary : close > boundary);
        if (beyond && firstBeyondMs === null) firstBeyondMs = candidate.timestampMs;
        if (!beyond && args.settings.breakConfirmation === "time-beyond") firstBeyondMs = null;
        if (confirmedBeyond(samples, index, breakDirection, boundary, args.settings, firstBeyondMs)) {
          breakTimestampMs = candidate.timestampMs;
          outcome = "BREAK";
        }
      }

      if (breakTimestampMs === null && reactionDirection !== "NONE" && index - entryIndex <= args.settings.maximumConfirmationBars) {
        const boundary = reactionDirection === "UP" ? args.levelPrice + reactionDistance : args.levelPrice - reactionDistance;
        if (candidate.timestampMs - sample.timestampMs >= args.settings.minimumReactionDurationMs && reactionConfirmed(candidate, reactionDirection, boundary, args.settings.requireCloseAwayFromLevel)) {
          if (timeToReactionMs === null) {
            timeToReactionMs = candidate.timestampMs - sample.timestampMs;
            barsToReaction = index - entryIndex;
          }
          outcome = "HOLD";
        }
      }

      if (breakTimestampMs !== null && args.settings.enableReclaimDetection && breakDirection) {
        const adverse = breakDirection === "DOWN" ? (candidate.low ?? closeOf(candidate)) : (candidate.high ?? closeOf(candidate));
        if (adverse !== null) maximumBeyondDistance = Math.max(maximumBeyondDistance, Math.abs(adverse - args.levelPrice));
        const close = closeOf(candidate);
        const originalSide = close !== null && (approachSide === "FROM_ABOVE" ? close >= args.levelPrice : close <= args.levelPrice);
        reclaimCloses = originalSide ? reclaimCloses + 1 : 0;
        if (
          reclaimTimestampMs === null &&
          candidate.timestampMs - breakTimestampMs >= args.settings.minimumTimeBeyondBeforeReclaimMs &&
          reclaimCloses >= Math.max(1, args.settings.reclaimConfirmationCloses)
        ) {
          reclaimTimestampMs = candidate.timestampMs;
          outcome = "RECLAIM";
          if (timeToReactionMs === null) {
            timeToReactionMs = candidate.timestampMs - sample.timestampMs;
            barsToReaction = index - entryIndex;
          }
        }
      }
    }

    reactionMagnitude = maxFavorable;
    const gexContextAtTouch = args.gexAtTouch?.(sample.timestampMs);
    const draft = {
      minimumDistance: minDistance,
      maxFavorableExcursion: Math.max(0, maxFavorable),
      maxAdverseExcursion: Math.max(0, maxAdverse),
      timeToReactionMs,
    };
    const quality = outcome === "UNRESOLVED" ? null : calculateQuality(
      draft,
      touchDistance,
      reactionDistance,
      Math.max(1_000, args.settings.reactionHorizonMs),
      interactions.length,
      gexContextAtTouch?.percentOfKing ? Math.abs(gexContextAtTouch.percentOfKing) / 100 : 0,
      args.settings,
    );
    const interaction: DarkPoolInteraction = {
      id: `${args.darkPoolPrintId}:${sample.timestampMs}`,
      darkPoolPrintId: args.darkPoolPrintId,
      levelPrice: args.levelPrice,
      approachSide,
      touchTimestampMs: sample.timestampMs,
      touchPrice,
      minimumDistance: minDistance,
      minimumDistancePct: 100 * minDistance / Math.max(EPSILON, args.levelPrice),
      minimumDistanceTicks: minDistance / Math.max(EPSILON, args.tickSize),
      entryTimestampMs: sample.timestampMs,
      exitTimestampMs,
      durationMs: exitTimestampMs === null ? null : Math.max(0, exitTimestampMs - sample.timestampMs),
      totalTimeInZoneMs,
      reentryCount,
      outcome,
      reactionDirection,
      maxFavorableExcursion: Math.max(0, maxFavorable),
      maxFavorableExcursionPct: 100 * Math.max(0, maxFavorable) / Math.max(EPSILON, args.levelPrice),
      maxFavorableExcursionTicks: Math.max(0, maxFavorable) / Math.max(EPSILON, args.tickSize),
      maxAdverseExcursion: Math.max(0, maxAdverse),
      maxAdverseExcursionPct: 100 * Math.max(0, maxAdverse) / Math.max(EPSILON, args.levelPrice),
      maxAdverseExcursionTicks: Math.max(0, maxAdverse) / Math.max(EPSILON, args.tickSize),
      reactionMagnitude,
      reactionMagnitudePct: 100 * reactionMagnitude / Math.max(EPSILON, args.levelPrice),
      barsToReaction,
      timeToReactionMs,
      breakTimestampMs,
      reclaimTimestampMs,
      timeBeyondLevelMs: breakTimestampMs === null ? null : (reclaimTimestampMs ?? Math.min(horizonEndMs, args.asOfMs)) - breakTimestampMs,
      distanceBeforeReclaim: reclaimTimestampMs === null ? null : maximumBeyondDistance,
      reactionQuality: quality,
      ...(gexContextAtTouch ? { gexContextAtTouch } : {}),
      timestampMs: sample.timestampMs,
      observedPrice: touchPrice,
      touchError: minDistance,
      touchErrorPercent: 100 * minDistance / Math.max(EPSILON, args.levelPrice),
      touchErrorTicks: minDistance / Math.max(EPSILON, args.tickSize),
      approach: approachSide,
      reaction: reactionMagnitude,
      mfe: Math.max(0, maxFavorable),
      mae: Math.max(0, maxAdverse),
    };
    interactions.push(interaction);
    eligible = false;
    outsideSinceMs = null;
    let resetIndex = entryIndex + 1;
    for (; resetIndex < samples.length; resetIndex += 1) {
      const resetPrice = samplePrice(samples[resetIndex]);
      if (resetPrice === null || Math.abs(resetPrice - args.levelPrice) < resetDistance - EPSILON) continue;
      const departureStart = samples[resetIndex].timestampMs;
      let eligibleIndex = resetIndex;
      while (eligibleIndex < samples.length && samples[eligibleIndex].timestampMs - departureStart < args.settings.minimumTimeOutsideMs) eligibleIndex += 1;
      if (eligibleIndex < samples.length) {
        entryIndex = eligibleIndex - 1;
        eligible = true;
        outsideSinceMs = departureStart;
        lastOutsidePrice = samplePrice(samples[eligibleIndex]);
      } else entryIndex = samples.length;
      break;
    }
    if (args.settings.firstTouchOnly || !eligible) break;
  }

  const holdCount = interactions.filter((item) => item.outcome === "HOLD").length;
  const breakCount = interactions.filter((item) => item.breakTimestampMs !== null).length;
  const reclaimCount = interactions.filter((item) => item.reclaimTimestampMs !== null).length;
  const latest = interactions.at(-1);
  const freshness: DarkPoolReactionAnalytics["freshness"] = reclaimCount > 0
    ? "RECLAIMED"
    : breakCount > 0 ? "BROKEN" : interactions.length > 1 ? "MULTI_TOUCH" : interactions.length === 1 ? "TOUCHED_ONCE" : "FRESH";
  const latestSample = samples.at(-1);
  const currentPrice = args.currentPrice ?? (latestSample ? samplePrice(latestSample) : null) ?? args.levelPrice;
  const resolved = interactions.filter((item) => item.outcome !== "UNRESOLVED");
  const qualified = interactions.length >= args.settings.minimumStatsSamples;
  const qualityValues = resolved.map((item) => item.reactionQuality).filter((value): value is number => value !== null);
  return {
    darkPoolPrintId: args.darkPoolPrintId,
    levelPrice: args.levelPrice,
    firstEligibleInteractionMs: interactions[0]?.touchTimestampMs ?? null,
    touchCount: interactions.length,
    holdCount,
    breakCount,
    reclaimCount,
    ...(latest ? { latestInteraction: latest } : {}),
    interactions,
    freshness,
    currentDistanceAbsolute: currentPrice - args.levelPrice,
    currentDistancePct: 100 * (currentPrice - args.levelPrice) / Math.max(EPSILON, args.levelPrice),
    ...(qualityValues.length ? { historicalReactionScore: mean(qualityValues) ?? undefined } : {}),
    dataThroughMs: Math.min(args.asOfMs, samples.at(-1)?.timestampMs ?? args.asOfMs),
    resolution,
    supportsTickClaim: resolution === "tick",
    medianTouchError: median(interactions.map((item) => item.minimumDistance)),
    medianTouchErrorTicks: median(interactions.map((item) => item.minimumDistanceTicks)),
    medianReaction: median(interactions.map((item) => item.reactionMagnitude)),
    medianMfe: median(interactions.map((item) => item.maxFavorableExcursion)),
    medianMae: median(interactions.map((item) => item.maxAdverseExcursion)),
    averageTouchError: mean(interactions.map((item) => item.minimumDistance)),
    averageReaction: mean(interactions.map((item) => item.reactionMagnitude)),
    averageMfe: mean(interactions.map((item) => item.maxFavorableExcursion)),
    averageMae: mean(interactions.map((item) => item.maxAdverseExcursion)),
    averageTimeToReactionMs: mean(interactions.map((item) => item.timeToReactionMs).filter((value): value is number => value !== null)),
    holdRate: qualified ? holdCount / Math.max(1, interactions.length) : null,
    breakRate: qualified ? breakCount / Math.max(1, interactions.length) : null,
    reclaimRate: qualified ? reclaimCount / Math.max(1, interactions.length) : null,
    touches: interactions,
    holds: holdCount,
    breaks: breakCount,
    reclaims: reclaimCount,
    latestOutcome: latest?.outcome ?? "NONE",
  };
}
