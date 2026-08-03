import type {
  GameplanEdition,
  GameplanRole,
  GameplanSession,
} from "@/lib/gameplan";
import type {
  VolatilityCandle,
  VolatilitySnapshot,
} from "@/lib/volatilityRegime";
import type {
  GameplanTimeframeContext,
  GameplanTimeframeId,
} from "@/lib/gameplanTimeframeAnalysis";

export type LiveAnalystControl = "BUYERS" | "SELLERS" | "BALANCED";
export type LiveAnalystBias = "UP" | "DOWN" | "NEUTRAL";
export type LiveAnalystTrend = "UP" | "DOWN" | "FLAT";
export type LiveAnalystPhase = "OBSERVING" | "APPROACH" | "TESTING" | "ROTATION" | "EXPANSION";
export type LiveAnalystPublishReason =
  | "INITIAL READ"
  | "LEVEL APPROACH"
  | "LEVEL TEST"
  | "LEVEL TRANSITION"
  | "CONTROL SHIFT"
  | "CONTEXT UPDATE";

export type LiveAnalystLevel = {
  id: string;
  name: string;
  role: GameplanRole;
  zone: [number, number];
  distance: number;
  relation: "ABOVE" | "INSIDE" | "BELOW";
};

export type LiveAnalystSnapshot = {
  modelVersion: "gameplan-live-analyst-v1";
  root: "NQ" | "ES";
  session: GameplanSession;
  sessionDate: string;
  generatedAt: string;
  price: number;
  phase: LiveAnalystPhase;
  control: LiveAnalystControl;
  controlScore: number;
  confidence: number;
  bias: LiveAnalystBias;
  nearestLevel: LiveAnalystLevel;
  timeframe: {
    fifteenMinute: LiveAnalystTrend;
    oneHour: LiveAnalystTrend;
    fourHour: LiveAnalystTrend;
    fifteenMinuteMove: number;
    oneHourMove: number;
    fourHourMove: number;
    recentHigh: number;
    recentLow: number;
    atr: number;
  };
  volatility: {
    regime: string;
    score: number | null;
    trend: string;
  };
  options: {
    tape: GameplanEdition["environment"]["tape"]["state"];
    flowLean: number;
    fearRatio: number;
    coverage: "FULL" | "STRUCTURAL";
  };
  thesis: string;
  confirmation: string;
  invalidation: string;
  nextEvidence: string;
  signature: string;
  dataQuality: number;
};

export type LiveAnalystReview = {
  reviewedAt: string;
  horizonMinutes: number;
  reviewPrice: number;
  move: number;
  threshold: number;
  verdict: "SUPPORTED" | "FAILED" | "INCONCLUSIVE";
  reasoningScore: number;
  note: string;
};

export type LiveAnalystEntry = LiveAnalystSnapshot & {
  id: string;
  reason: LiveAnalystPublishReason;
  processScore: number;
  review: LiveAnalystReview | null;
};

const REVIEW_HORIZON_MS = 15 * 60_000;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatZone(zone: [number, number]) {
  return zone[0] === zone[1]
    ? formatPrice(zone[0])
    : `${formatPrice(zone[0])}–${formatPrice(zone[1])}`;
}

const LIVE_STRUCTURE_WEIGHTS: Partial<Record<GameplanTimeframeId, number>> = {
  "5m": 0.12,
  "15m": 0.22,
  "30m": 0.22,
  "1h": 0.24,
  "4h": 0.2,
};

function normalizeCandles(source: VolatilityCandle[], currentPrice: number, now: number) {
  const rows = new Map<number, VolatilityCandle>();
  for (const candle of source) {
    if (
      !Number.isFinite(candle.timestamp)
      || !Number.isFinite(candle.open)
      || !Number.isFinite(candle.high)
      || !Number.isFinite(candle.low)
      || !Number.isFinite(candle.close)
      || candle.timestamp <= 0
      || candle.open <= 0
      || candle.high <= 0
      || candle.low <= 0
      || candle.close <= 0
      || candle.high < candle.low
    ) continue;
    rows.set(candle.timestamp, candle);
  }
  const normalized = [...rows.values()].sort((left, right) => left.timestamp - right.timestamp);
  if (!normalized.length) return normalized;
  const last = normalized.at(-1)!;
  const fiveMinutes = 5 * 60_000;
  const currentBucket = Math.floor(now / fiveMinutes) * fiveMinutes;
  const sourceIsFresh = now - last.timestamp <= 15 * 60_000;
  if (!sourceIsFresh) return normalized;
  if (currentBucket > last.timestamp && currentBucket - last.timestamp <= 15 * 60_000) {
    normalized.push({
      timestamp: currentBucket,
      open: last.close,
      high: Math.max(last.close, currentPrice),
      low: Math.min(last.close, currentPrice),
      close: currentPrice,
      volume: 0,
    });
  } else {
    normalized[normalized.length - 1] = {
      ...last,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
      close: currentPrice,
    };
  }
  return normalized;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function averageTrueRange(candles: VolatilityCandle[]) {
  if (candles.length < 2) return 0;
  const ranges: number[] = [];
  for (let index = Math.max(1, candles.length - 24); index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1].close;
    ranges.push(Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    ));
  }
  return average(ranges);
}

function momentumForBars(
  candles: VolatilityCandle[],
  bars: number,
  currentPrice: number,
  atr: number,
) {
  if (candles.length < 2) return { move: 0, normalized: 0 };
  const anchor = candles[Math.max(0, candles.length - 1 - bars)]?.close ?? currentPrice;
  const move = currentPrice - anchor;
  const normalizer = Math.max(0.0001, atr * Math.sqrt(Math.max(1, bars)));
  return {
    move,
    normalized: clamp(move / normalizer, -1.5, 1.5),
  };
}

function trendForMomentum(value: number): LiveAnalystTrend {
  if (value >= 0.18) return "UP";
  if (value <= -0.18) return "DOWN";
  return "FLAT";
}

function trendForContext(context: GameplanTimeframeContext | undefined): LiveAnalystTrend | null {
  if (!context) return null;
  if (context.control === "BUYERS") return "UP";
  if (context.control === "SELLERS") return "DOWN";
  return "FLAT";
}

function authoritativeContextScore(contexts: GameplanTimeframeContext[]) {
  const eligible = contexts.flatMap((context) => {
    const weight = LIVE_STRUCTURE_WEIGHTS[context.timeframe];
    return weight ? [{ context, weight }] : [];
  });
  const weightTotal = eligible.reduce((sum, item) => sum + item.weight, 0);
  if (!weightTotal) return null;
  const score = eligible.reduce(
    (sum, item) => sum + item.context.controlScore * item.weight,
    0,
  ) / weightTotal;
  const buyerWeight = eligible
    .filter((item) => item.context.control === "BUYERS")
    .reduce((sum, item) => sum + item.weight, 0) / weightTotal;
  const sellerWeight = eligible
    .filter((item) => item.context.control === "SELLERS")
    .reduce((sum, item) => sum + item.weight, 0) / weightTotal;
  const dominantWeight = Math.max(buyerWeight, sellerWeight);
  const opposingWeight = Math.min(buyerWeight, sellerWeight);
  return {
    score: clamp(score, -1, 1),
    coverage: clamp(weightTotal, 0, 1),
    buyerWeight,
    sellerWeight,
    dominantWeight,
    opposingWeight,
    sampleCount: eligible.length,
  };
}

function nearestLevel(plan: GameplanEdition, price: number): LiveAnalystLevel {
  const level = plan.ladder.reduce((best, candidate) => {
    const candidateDistance = price < candidate.zone[0]
      ? candidate.zone[0] - price
      : price > candidate.zone[1]
        ? price - candidate.zone[1]
        : 0;
    const bestDistance = price < best.zone[0]
      ? best.zone[0] - price
      : price > best.zone[1]
        ? price - best.zone[1]
        : 0;
    return candidateDistance < bestDistance ? candidate : best;
  }, plan.ladder[0]);
  const relation = price < level.zone[0] ? "BELOW" : price > level.zone[1] ? "ABOVE" : "INSIDE";
  const distance = relation === "BELOW"
    ? level.zone[0] - price
    : relation === "ABOVE"
      ? price - level.zone[1]
      : 0;
  return {
    id: `${plan.edition.date}:${plan.edition.session}:${level.name}:${level.zone.join(":")}`,
    name: level.name,
    role: level.role,
    zone: level.zone,
    distance,
    relation,
  };
}

function roleDescription(role: GameplanRole) {
  if (role === "accelerant") {
    return "This is an accelerant boundary, so an accepted break matters more than the first touch.";
  }
  if (role === "magnet") {
    return "This is a magnet, so repeated two-way trade is more likely until price earns separation.";
  }
  if (role === "decision") {
    return "This is a decision zone: the side that can hold beyond it controls the next mapped path.";
  }
  return "This is a positioning wall, so the quality of the first defence matters more than the touch itself.";
}

function higherTimeframeDescription(
  fifteen: LiveAnalystTrend,
  hour: LiveAnalystTrend,
  fourHour: LiveAnalystTrend,
) {
  if (hour === fourHour && hour !== "FLAT") {
    return `${hour === "UP" ? "Buyers" : "Sellers"} control both the one-hour and four-hour structure`;
  }
  if (fifteen !== "FLAT" && hour !== "FLAT" && fifteen !== hour) {
    return `${fifteen === "UP" ? "buyers" : "sellers"} are producing a short-term response against the broader ${hour === "UP" ? "upward" : "downward"} one-hour structure`;
  }
  if (fourHour !== "FLAT") {
    return `the four-hour structure remains ${fourHour === "UP" ? "upward" : "downward"}, while the shorter windows are less decisive`;
  }
  return "the higher-timeframe structure is balanced, so location and acceptance carry more weight than direction";
}

function optionsDescription(
  plan: GameplanEdition,
  session: GameplanSession,
  now: number,
) {
  const newYorkParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(newYorkParts.map((part) => [part.type, part.value]));
  const weekday = values.weekday;
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  const usOptionsActive = !["Sat", "Sun"].includes(weekday)
    && minutes >= 9 * 60 + 30
    && minutes <= 16 * 60 + 15;
  const coverage: "FULL" | "STRUCTURAL" = session === "newyork" && usOptionsActive
    ? "FULL"
    : "STRUCTURAL";
  const tape = plan.environment.tape.state === "snowball"
    ? "The negative-gamma snowball environment increases the value of confirmed acceptance and reduces the value of reflexively fading momentum."
    : plan.environment.tape.state === "calm"
      ? "The calmer positive-gamma environment favours rotation and first defences until price proves sustained acceptance."
      : "The mixed gamma environment does not support a directional assumption; price must prove control at the mapped level.";
  const flow = plan.environment.flow.lean > 0.18
    ? "Options premium has a bullish lean."
    : plan.environment.flow.lean < -0.18
      ? "Options premium has a bearish lean."
      : "Options premium is broadly balanced.";
  const timing = coverage === "FULL"
    ? "New York options participation is active."
    : "Outside New York, options positioning remains a structural map but live options-flow confirmation carries less weight.";
  return { text: `${tape} ${flow} ${timing}`, coverage };
}

function phaseForSnapshot(
  root: "NQ" | "ES",
  level: LiveAnalystLevel,
  control: LiveAnalystControl,
  fifteen: LiveAnalystTrend,
  hour: LiveAnalystTrend,
): LiveAnalystPhase {
  if (level.relation === "INSIDE") return "TESTING";
  if (level.distance <= (root === "NQ" ? 35 : 10)) return "APPROACH";
  if (
    control !== "BALANCED"
    && fifteen !== "FLAT"
    && hour !== "FLAT"
    && fifteen === hour
  ) return "EXPANSION";
  if (control === "BALANCED") return "ROTATION";
  return "OBSERVING";
}

function levelContext(
  root: "NQ" | "ES",
  level: LiveAnalystLevel,
  price: number,
) {
  if (level.relation === "INSIDE") {
    return `${root} at ${formatPrice(price)} is testing ${level.name} ${formatZone(level.zone)}`;
  }
  const side = level.relation === "ABOVE" ? "above" : "below";
  return `${root} at ${formatPrice(price)} is ${formatPrice(level.distance)} points ${side} ${level.name} ${formatZone(level.zone)}`;
}

function controlDescription(control: LiveAnalystControl, fifteen: LiveAnalystTrend, hour: LiveAnalystTrend) {
  if (control === "BUYERS") {
    return fifteen === "UP" && hour === "UP"
      ? "Buyers are making progress in both the immediate and one-hour windows."
      : "Buyers have the immediate edge, but they have not secured full timeframe alignment.";
  }
  if (control === "SELLERS") {
    return fifteen === "DOWN" && hour === "DOWN"
      ? "Sellers are making progress in both the immediate and one-hour windows."
      : "Sellers have the immediate edge, but they have not secured full timeframe alignment.";
  }
  return "Neither side is producing enough distance and timeframe agreement to claim control.";
}

function buildDecisionLevels(
  plan: GameplanEdition,
  level: LiveAnalystLevel,
  bias: LiveAnalystBias,
) {
  const ordered = [...plan.ladder].sort((left, right) => left.zone[0] - right.zone[0]);
  const levelIndex = ordered.findIndex((candidate) =>
    candidate.name === level.name
    && candidate.zone[0] === level.zone[0]
    && candidate.zone[1] === level.zone[1]);
  const nextAbove = ordered[Math.min(ordered.length - 1, Math.max(0, levelIndex + 1))];
  const nextBelow = ordered[Math.max(0, levelIndex - 1)];

  if (bias === "UP") {
    const confirmationPrice = level.relation === "ABOVE" && nextAbove
      ? nextAbove.zone[0]
      : level.zone[1];
    return {
      confirmation: `Confirmation requires acceptance above ${formatPrice(confirmationPrice)}, followed by a retest that holds as support.`,
      invalidation: `The bullish read weakens if price accepts below ${formatPrice(level.zone[0])} and cannot reclaim the zone.`,
      nextEvidence: `Watch whether buyers can create distance from ${level.name}; a touch without separation is not continuation.`,
    };
  }
  if (bias === "DOWN") {
    const confirmationPrice = level.relation === "BELOW" && nextBelow
      ? nextBelow.zone[1]
      : level.zone[0];
    return {
      confirmation: `Confirmation requires acceptance below ${formatPrice(confirmationPrice)}, followed by a failed reclaim from underneath.`,
      invalidation: `The bearish read weakens if price accepts above ${formatPrice(level.zone[1])} and holds the retest.`,
      nextEvidence: `Watch whether sellers can create distance from ${level.name}; a touch without separation is not continuation.`,
    };
  }
  return {
    confirmation: `The decision is a sustained hold beyond either ${formatPrice(level.zone[0])} or ${formatPrice(level.zone[1])}; the first wick is not enough.`,
    invalidation: `Any early directional read is invalid while price continues to rotate through ${formatZone(level.zone)} without displacement.`,
    nextEvidence: "Wait for one side to leave the zone, hold outside it, and defend the first retest before upgrading the read.",
  };
}

export function buildLiveAnalystSnapshot(args: {
  root: "NQ" | "ES";
  session: GameplanSession;
  plan: GameplanEdition;
  currentPrice: number | null;
  candles: VolatilityCandle[];
  volatility: VolatilitySnapshot | null;
  timeframeContexts?: GameplanTimeframeContext[];
  now?: number;
}): LiveAnalystSnapshot | null {
  const { root, session, plan, volatility } = args;
  const currentPrice = args.currentPrice;
  if (
    currentPrice === null
    || !Number.isFinite(currentPrice)
    || currentPrice <= 0
    || !plan.ladder.length
  ) return null;

  const now = args.now ?? Date.now();
  const candles = normalizeCandles(args.candles, currentPrice, now);
  const atr = averageTrueRange(candles) || (root === "NQ" ? 12 : 3);
  const fifteen = momentumForBars(candles, 3, currentPrice, atr);
  const hour = momentumForBars(candles, 12, currentPrice, atr);
  const fourHour = momentumForBars(candles, 48, currentPrice, atr);
  const contexts = args.timeframeContexts ?? [];
  const contextState = authoritativeContextScore(contexts);
  const fifteenContext = contexts.find((context) => context.timeframe === "15m");
  const hourContext = contexts.find((context) => context.timeframe === "1h");
  const fourHourContext = contexts.find((context) => context.timeframe === "4h");
  const fifteenTrend = trendForContext(fifteenContext) ?? trendForMomentum(fifteen.normalized);
  const hourTrend = trendForContext(hourContext) ?? trendForMomentum(hour.normalized);
  const fourHourTrend = trendForContext(fourHourContext) ?? trendForMomentum(fourHour.normalized);
  const fallbackDirectionalScore = clamp(
    (
      fifteen.normalized * 0.45
      + hour.normalized * 0.35
      + fourHour.normalized * 0.2
    ) * 72,
    -100,
    100,
  );
  // Price structure is authoritative. Options flow remains useful context, but it
  // must never flip the displayed control against the visible futures structure.
  const directionalScore = contextState
    ? clamp(contextState.score * 100, -100, 100)
    : fallbackDirectionalScore;
  const contextBuyerControl = Boolean(
    contextState
    && contextState.buyerWeight >= 0.42
    && contextState.buyerWeight - contextState.sellerWeight >= 0.12
    && directionalScore >= 16,
  );
  const contextSellerControl = Boolean(
    contextState
    && contextState.sellerWeight >= 0.42
    && contextState.sellerWeight - contextState.buyerWeight >= 0.12
    && directionalScore <= -16,
  );
  const control: LiveAnalystControl = contextState
    ? contextBuyerControl
      ? "BUYERS"
      : contextSellerControl
        ? "SELLERS"
        : "BALANCED"
    : directionalScore >= 16
      ? "BUYERS"
      : directionalScore <= -16
        ? "SELLERS"
        : "BALANCED";
  const bias: LiveAnalystBias = control === "BUYERS" ? "UP" : control === "SELLERS" ? "DOWN" : "NEUTRAL";
  const level = nearestLevel(plan, currentPrice);
  const phase = phaseForSnapshot(root, level, control, fifteenTrend, hourTrend);
  const options = optionsDescription(plan, session, now);
  const decision = buildDecisionLevels(plan, level, bias);
  const trendAlignment = [fifteenTrend, hourTrend, fourHourTrend]
    .filter((trend) => trend !== "FLAT" && trend === (bias === "UP" ? "UP" : bias === "DOWN" ? "DOWN" : "FLAT"))
    .length;
  const dataQuality = Math.round(clamp(
    38
    + Math.min(24, candles.length / 4)
    + (volatility ? 12 : 0)
    + (options.coverage === "FULL" ? 10 : 5)
    + Math.min(10, plan.ladder.length)
    + (contextState ? contextState.coverage * 10 : 0),
    0,
    100,
  ));
  const agreement = contextState?.dominantWeight ?? (trendAlignment / 3);
  const opposingWeight = contextState?.opposingWeight ?? 0;
  let confidence = Math.round(clamp(
    38
    + Math.abs(directionalScore) * 0.22
    + agreement * 24
    + (phase === "TESTING" || phase === "APPROACH" ? 4 : 0)
    + (dataQuality - 50) * 0.12,
    35,
    90,
  ));
  if (contextState && contextState.sampleCount < 3) confidence = Math.min(confidence, 62);
  if (opposingWeight >= 0.12) confidence = Math.min(confidence, 68);
  if (opposingWeight >= 0.25) confidence = Math.min(confidence, 58);
  const recentWindow = candles.slice(-48);
  const recentHigh = recentWindow.length ? Math.max(...recentWindow.map((candle) => candle.high)) : currentPrice;
  const recentLow = recentWindow.length ? Math.min(...recentWindow.map((candle) => candle.low)) : currentPrice;
  const htf = higherTimeframeDescription(fifteenTrend, hourTrend, fourHourTrend);
  const rangeContext = recentHigh - currentPrice <= atr
    ? `Price is also pressing the verified four-hour high at ${formatPrice(recentHigh)}, so continuation still has to prove it can hold above that reference.`
    : currentPrice - recentLow <= atr
      ? `Price is also testing the verified four-hour low at ${formatPrice(recentLow)}, so sellers still need acceptance beneath that reference.`
      : `The verified four-hour reference range remains ${formatPrice(recentLow)}–${formatPrice(recentHigh)}.`;
  const agreementCopy = opposingWeight >= 0.12
    ? " The completed timeframe evidence is mixed, so confidence is deliberately capped until the conflict resolves."
    : "";
  const thesis = `${levelContext(root, level, currentPrice)}. ${roleDescription(level.role)} ${controlDescription(control, fifteenTrend, hourTrend)} On the wider map, ${htf}.${agreementCopy} ${rangeContext} ${options.text}`;
  const volatilityRegime = volatility?.regime ?? "BUILDING";
  const volatilityTrend = volatility?.trend ?? "UNKNOWN";
  const signature = [
    plan.edition.date,
    session,
    level.id,
    level.relation,
    phase,
    control,
    fifteenTrend,
    hourTrend,
    fourHourTrend,
    volatilityRegime,
    plan.environment.tape.state,
  ].join("|");

  return {
    modelVersion: "gameplan-live-analyst-v1",
    root,
    session,
    sessionDate: plan.edition.date,
    generatedAt: new Date(now).toISOString(),
    price: round(currentPrice),
    phase,
    control,
    controlScore: Math.round(directionalScore),
    confidence,
    bias,
    nearestLevel: {
      ...level,
      distance: round(level.distance),
    },
    timeframe: {
      fifteenMinute: fifteenTrend,
      oneHour: hourTrend,
      fourHour: fourHourTrend,
      fifteenMinuteMove: round(fifteenContext?.move ?? fifteen.move),
      oneHourMove: round(hourContext?.move ?? hour.move),
      fourHourMove: round(fourHourContext?.move ?? fourHour.move),
      recentHigh: round(recentHigh),
      recentLow: round(recentLow),
      atr: round(atr),
    },
    volatility: {
      regime: volatilityRegime,
      score: volatility?.score ?? null,
      trend: volatilityTrend,
    },
    options: {
      tape: plan.environment.tape.state,
      flowLean: round(plan.environment.flow.lean, 3),
      fearRatio: round(plan.environment.fear.ratio, 2),
      coverage: options.coverage,
    },
    thesis,
    confirmation: decision.confirmation,
    invalidation: decision.invalidation,
    nextEvidence: decision.nextEvidence,
    signature,
    dataQuality,
  };
}

export function analystPublishReason(
  previous: LiveAnalystEntry | null,
  snapshot: LiveAnalystSnapshot,
  now = Date.now(),
): LiveAnalystPublishReason | null {
  if (!previous) return "INITIAL READ";
  if (
    previous.root !== snapshot.root
    || previous.session !== snapshot.session
    || previous.sessionDate !== snapshot.sessionDate
  ) return "INITIAL READ";

  const age = now - Date.parse(previous.generatedAt);
  if (age < 90_000) return null;
  if (previous.nearestLevel.id !== snapshot.nearestLevel.id) return "LEVEL TRANSITION";
  if (previous.phase !== snapshot.phase) {
    if (snapshot.phase === "TESTING") return "LEVEL TEST";
    if (snapshot.phase === "APPROACH") return "LEVEL APPROACH";
    if (age >= 3 * 60_000) return "LEVEL TRANSITION";
  }
  if (previous.control !== snapshot.control && age >= 5 * 60_000) return "CONTROL SHIFT";
  if (previous.signature !== snapshot.signature && age >= 7 * 60_000) return "CONTEXT UPDATE";
  if (age >= 15 * 60_000) return "CONTEXT UPDATE";
  return null;
}

export function createLiveAnalystEntry(
  snapshot: LiveAnalystSnapshot,
  reason: LiveAnalystPublishReason,
): LiveAnalystEntry {
  const processScore = Math.round(clamp(
    snapshot.dataQuality * 0.45
    + snapshot.confidence * 0.25
    + (snapshot.confirmation ? 12 : 0)
    + (snapshot.invalidation ? 10 : 0)
    + (snapshot.nearestLevel.name ? 8 : 0),
    0,
    100,
  ));
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ...snapshot,
    id: `gameplan-analyst-${snapshot.root.toLowerCase()}-${random}`,
    reason,
    processScore,
    review: null,
  };
}

function reviewPriceForEntry(
  entry: LiveAnalystEntry,
  candles: VolatilityCandle[],
  currentPrice: number,
  now: number,
) {
  const target = Date.parse(entry.generatedAt) + REVIEW_HORIZON_MS;
  if (now < target) return null;
  const normalized = normalizeCandles(candles, currentPrice, now);
  const candle = normalized.find((candidate) => candidate.timestamp >= target);
  return candle?.close ?? currentPrice;
}

export function reviewLiveAnalystEntry(args: {
  entry: LiveAnalystEntry;
  candles: VolatilityCandle[];
  currentPrice: number;
  now?: number;
}): LiveAnalystEntry | null {
  const { entry, candles, currentPrice } = args;
  if (entry.review || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  const now = args.now ?? Date.now();
  const reviewPrice = reviewPriceForEntry(entry, candles, currentPrice, now);
  if (reviewPrice === null) return null;

  const move = reviewPrice - entry.price;
  const threshold = entry.root === "NQ"
    ? Math.max(10, entry.timeframe.atr * 0.75)
    : Math.max(2.5, entry.timeframe.atr * 0.75);
  const supported = entry.bias === "UP"
    ? move >= threshold
    : entry.bias === "DOWN"
      ? move <= -threshold
      : Math.abs(move) < threshold;
  const failed = entry.bias === "UP"
    ? move <= -threshold
    : entry.bias === "DOWN"
      ? move >= threshold
      : Math.abs(move) >= threshold * 1.5;
  const verdict: LiveAnalystReview["verdict"] = supported
    ? "SUPPORTED"
    : failed
      ? "FAILED"
      : "INCONCLUSIVE";
  const outcomeScore = verdict === "SUPPORTED" ? 92 : verdict === "FAILED" ? 34 : 62;
  const reasoningScore = Math.round(clamp(entry.processScore * 0.65 + outcomeScore * 0.35, 0, 100));
  const directionalCopy = entry.bias === "UP"
    ? "upside progress"
    : entry.bias === "DOWN"
      ? "downside progress"
      : "continued balance";
  const note = verdict === "SUPPORTED"
    ? `The ${entry.bias.toLowerCase()} read received the required ${directionalCopy}: price moved ${formatPrice(Math.abs(move))} points over the review window.`
    : verdict === "FAILED"
      ? `Price moved ${formatPrice(Math.abs(move))} points against the ${entry.bias.toLowerCase()} read. The next version should demand stronger acceptance before assigning control.`
      : `Price moved ${formatPrice(Math.abs(move))} points, below the ${formatPrice(threshold)}-point evidence threshold. The original read remains unproven rather than wrong.`;

  return {
    ...entry,
    review: {
      reviewedAt: new Date(now).toISOString(),
      horizonMinutes: 15,
      reviewPrice: round(reviewPrice),
      move: round(move),
      threshold: round(threshold),
      verdict,
      reasoningScore,
      note,
    },
  };
}

export function isLiveAnalystEntry(value: unknown): value is LiveAnalystEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LiveAnalystEntry>;
  return (
    entry.modelVersion === "gameplan-live-analyst-v1"
    && typeof entry.id === "string"
    && (entry.root === "NQ" || entry.root === "ES")
    && typeof entry.generatedAt === "string"
    && typeof entry.thesis === "string"
    && typeof entry.processScore === "number"
    && Boolean(entry.nearestLevel && typeof entry.nearestLevel === "object")
  );
}
