import type { GameplanEdition, GameplanSession } from "@/lib/gameplan";
import type { VolatilityCandle } from "@/lib/volatilityRegime";

export const GAMEPLAN_TIMEFRAMES = [
  { id: "5m", label: "5M", windowMs: 5 * 60_000, minimumBars: 1 },
  { id: "15m", label: "15M", windowMs: 15 * 60_000, minimumBars: 3 },
  { id: "30m", label: "30M", windowMs: 30 * 60_000, minimumBars: 6 },
  { id: "1h", label: "1H", windowMs: 60 * 60_000, minimumBars: 12 },
  { id: "4h", label: "4H", windowMs: 4 * 60 * 60_000, minimumBars: 36 },
  { id: "1d", label: "1D", windowMs: 24 * 60 * 60_000, minimumBars: 96 },
  { id: "1w", label: "1W", windowMs: 7 * 24 * 60 * 60_000, minimumBars: 240 },
] as const;

export type GameplanTimeframeId = (typeof GAMEPLAN_TIMEFRAMES)[number]["id"];
export type GameplanTimeframeControl = "BUYERS" | "SELLERS" | "BALANCED";
export type GameplanTimeframeStructure = "ADVANCING" | "DECLINING" | "ROTATING";

export type GameplanTimeframeContext = {
  modelVersion: "gameplan-timeframe-context-v1";
  root: "NQ" | "ES";
  session: GameplanSession;
  timeframe: GameplanTimeframeId;
  label: string;
  periodKey: string;
  windowStart: string;
  windowEnd: string;
  updatedAt: string;
  nextUpdateAt: string;
  sampleBars: number;
  coverage: number;
  open: number;
  high: number;
  low: number;
  close: number;
  move: number;
  range: number;
  closeLocation: number;
  control: GameplanTimeframeControl;
  controlScore: number;
  structure: GameplanTimeframeStructure;
  confidence: number;
  levelName: string;
  levelZone: [number, number];
  interaction: "RECLAIMED" | "LOST" | "DEFENDED" | "REJECTED" | "TESTED" | "NEARBY";
  optionsCoverage: "ACTIVE" | "STRUCTURAL";
  whatHappened: string;
  levelContext: string;
  optionsContext: string;
  hypothesis: string;
};

type BuildOptions = {
  root: "NQ" | "ES";
  session: GameplanSession;
  plan: GameplanEdition;
  candles: VolatilityCandle[];
  now?: number;
};

const FIVE_MINUTES_MS = 5 * 60_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
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
    : `${formatPrice(zone[0])}-${formatPrice(zone[1])}`;
}

function normalizeCandles(source: VolatilityCandle[], now: number) {
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
      || candle.timestamp + FIVE_MINUTES_MS > now
    ) continue;
    rows.set(candle.timestamp, candle);
  }
  return [...rows.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function averageTrueRange(candles: VolatilityCandle[]) {
  if (!candles.length) return 0;
  let total = candles[0].high - candles[0].low;
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1].close;
    total += Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  }
  return total / candles.length;
}

function isNewYorkOptionsWindow(now: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (values.weekday === "Sat" || values.weekday === "Sun") return false;
  const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
  return minuteOfDay >= 9 * 60 + 30 && minuteOfDay <= 16 * 60 + 15;
}

function nearestLevel(plan: GameplanEdition, close: number) {
  return plan.ladder.reduce((best, level) => {
    const midpoint = (level.zone[0] + level.zone[1]) / 2;
    const bestMidpoint = (best.zone[0] + best.zone[1]) / 2;
    return Math.abs(close - midpoint) < Math.abs(close - bestMidpoint) ? level : best;
  }, plan.ladder[0]);
}

function describeControl(control: GameplanTimeframeControl) {
  if (control === "BUYERS") return "buyers carried the completed window";
  if (control === "SELLERS") return "sellers controlled the completed window";
  return "neither side kept control of the completed window";
}

function timeframeNoun(timeframe: GameplanTimeframeId) {
  if (timeframe === "5m" || timeframe === "15m" || timeframe === "30m") return "rotation";
  if (timeframe === "1h" || timeframe === "4h") return "structure";
  return "auction";
}

function interactionForWindow(
  window: VolatilityCandle[],
  level: GameplanEdition["ladder"][number],
  close: number,
) {
  const first = window[0];
  const touched = window.some((candle) => candle.high >= level.zone[0] && candle.low <= level.zone[1]);
  const startedBelow = first.open < level.zone[0];
  const startedAbove = first.open > level.zone[1];
  if (startedBelow && close > level.zone[1]) return "RECLAIMED" as const;
  if (startedAbove && close < level.zone[0]) return "LOST" as const;
  if (touched && close > level.zone[1]) return "DEFENDED" as const;
  if (touched && close < level.zone[0]) return "REJECTED" as const;
  if (touched) return "TESTED" as const;
  return "NEARBY" as const;
}

function levelNarrative(
  interaction: GameplanTimeframeContext["interaction"],
  name: string,
  zone: [number, number],
  close: number,
) {
  const reference = `${name} at ${formatZone(zone)}`;
  if (interaction === "RECLAIMED") {
    return `Price moved back through ${reference} and finished above it, so the completed window records a reclaim rather than a simple touch.`;
  }
  if (interaction === "LOST") {
    return `Price moved through ${reference} and finished below it, so the completed window records a loss of that reference.`;
  }
  if (interaction === "DEFENDED") {
    return `${reference} was tested and buyers kept the close above the zone. It remains the nearest defended reference.`;
  }
  if (interaction === "REJECTED") {
    return `${reference} was tested and sellers kept the close below the zone. It remains the nearest rejected reference.`;
  }
  if (interaction === "TESTED") {
    return `${reference} traded during the window, but the close at ${formatPrice(close)} did not establish clean separation.`;
  }
  const relation = close > zone[1] ? "above" : close < zone[0] ? "below" : "inside";
  return `Price finished ${relation} ${reference}; it is the closest mapped reference even though this window did not test it.`;
}

function buildContextForTimeframe(
  config: (typeof GAMEPLAN_TIMEFRAMES)[number],
  candles: VolatilityCandle[],
  options: BuildOptions,
  now: number,
): GameplanTimeframeContext | null {
  const last = candles.at(-1);
  if (!last || !options.plan.ladder.length) return null;

  const latestCloseAt = last.timestamp + FIVE_MINUTES_MS;
  const periodEnd = Math.floor(latestCloseAt / config.windowMs) * config.windowMs;
  if (periodEnd <= 0) return null;
  const periodStart = periodEnd - config.windowMs;
  const window = candles.filter((candle) => (
    candle.timestamp >= periodStart
    && candle.timestamp + FIVE_MINUTES_MS <= periodEnd
  ));
  if (!window.length) return null;

  const first = window[0];
  const final = window.at(-1)!;
  const open = first.open;
  const close = final.close;
  const high = Math.max(...window.map((candle) => candle.high));
  const low = Math.min(...window.map((candle) => candle.low));
  const range = Math.max(0.0001, high - low);
  const move = close - open;
  const closeLocation = clamp((close - low) / range, 0, 1);
  const upBars = window.filter((candle) => candle.close > candle.open).length;
  const downBars = window.filter((candle) => candle.close < candle.open).length;
  const directionalBars = Math.max(1, upBars + downBars);
  const barBalance = (upBars - downBars) / directionalBars;
  const atr = Math.max(0.0001, averageTrueRange(window));
  const displacement = clamp(move / Math.max(range, atr * Math.sqrt(window.length)), -1, 1);
  const locationScore = (closeLocation - 0.5) * 2;
  const optionsLean = clamp(options.plan.environment.flow.lean, -1, 1);
  // These cards describe futures price structure. Options flow is narrated below,
  // but it must not vote the visible candle structure in the opposite direction.
  const controlScore = clamp(
    displacement * 0.52
    + locationScore * 0.3
    + barBalance * 0.18,
    -1,
    1,
  );
  const control: GameplanTimeframeControl = controlScore >= 0.18
    ? "BUYERS"
    : controlScore <= -0.18
      ? "SELLERS"
      : "BALANCED";
  const structure: GameplanTimeframeStructure = control === "BUYERS"
    ? "ADVANCING"
    : control === "SELLERS"
      ? "DECLINING"
      : "ROTATING";
  const level = nearestLevel(options.plan, close);
  const interaction = interactionForWindow(window, level, close);
  const expectedBars = Math.max(1, Math.round(config.windowMs / FIVE_MINUTES_MS));
  const coverage = clamp(window.length / expectedBars, 0, 1);
  const sampleFactor = clamp(window.length / config.minimumBars, 0, 1);
  const confidence = Math.round(clamp(
    42
    + Math.abs(controlScore) * 26
    + sampleFactor * 16
    + (interaction === "NEARBY" ? 0 : 8),
    42,
    92,
  ));
  const moveCopy = Math.abs(move) < atr * 0.35
    ? `Price finished almost unchanged at ${formatPrice(close)} after trading a ${formatPrice(range)}-point range`
    : `${describeControl(control)}, moving ${Math.abs(move).toLocaleString("en-US", { maximumFractionDigits: 2 })} points ${move >= 0 ? "higher" : "lower"} from ${formatPrice(open)} to ${formatPrice(close)}`;
  const finishCopy = closeLocation >= 0.67
    ? "and closed in the upper part of that range"
    : closeLocation <= 0.33
      ? "and closed in the lower part of that range"
      : "but closed back through the middle of that range";
  const whatHappened = `Over the completed ${config.label} ${timeframeNoun(config.id)}, ${moveCopy} ${finishCopy}. ${
    control === "BALANCED"
      ? "The two-way trade matters more than the final direction."
      : `${control === "BUYERS" ? "Buying" : "Selling"} made the better progress and retained the close.`
  }`;
  const optionsCoverage = isNewYorkOptionsWindow(periodEnd) ? "ACTIVE" : "STRUCTURAL";
  const tapeCopy = options.plan.environment.tape.state === "snowball"
    ? "negative-gamma conditions can amplify an accepted move"
    : options.plan.environment.tape.state === "calm"
      ? "positive-gamma conditions still favour rotation unless price earns separation"
      : "mixed gamma conditions do not add a clean directional impulse";
  const flowCopy = Math.abs(optionsLean) < 0.15
    ? "classified options premium is balanced"
    : optionsLean > 0
      ? "classified options premium leans bullish"
      : "classified options premium leans bearish";
  const optionsContext = optionsCoverage === "ACTIVE"
    ? `New York options flow is active: ${flowCopy}, while ${tapeCopy}. This is context for the futures structure, not a signal by itself.`
    : `Live US options participation is outside its strongest window. The latest positioning map says ${flowCopy} and ${tapeCopy}, so it is being treated as structural context rather than fresh confirmation.`;
  const controlCopy = control === "BUYERS"
    ? `The stable ${config.label} hypothesis is buyer control while completed trade remains above ${formatZone(level.zone)}.`
    : control === "SELLERS"
      ? `The stable ${config.label} hypothesis is seller control while completed trade remains below ${formatZone(level.zone)}.`
      : `The stable ${config.label} hypothesis is balance around ${formatZone(level.zone)} until a completed window establishes separation.`;
  const resetCopy = control === "BUYERS"
    ? `A completed return through ${formatPrice(level.zone[0])} would weaken that context.`
    : control === "SELLERS"
      ? `A completed recovery through ${formatPrice(level.zone[1])} would weaken that context.`
      : `A close outside the zone with range expansion would replace the balanced read.`;

  return {
    modelVersion: "gameplan-timeframe-context-v1",
    root: options.root,
    session: options.session,
    timeframe: config.id,
    label: config.label,
    periodKey: `${options.root}:${config.id}:${periodEnd}`,
    windowStart: new Date(periodStart).toISOString(),
    windowEnd: new Date(periodEnd).toISOString(),
    updatedAt: new Date(periodEnd).toISOString(),
    nextUpdateAt: new Date(periodEnd + config.windowMs).toISOString(),
    sampleBars: window.length,
    coverage: round(coverage, 3),
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close),
    move: round(move),
    range: round(range),
    closeLocation: Math.round(closeLocation * 100),
    control,
    controlScore: round(controlScore, 3),
    structure,
    confidence,
    levelName: level.name,
    levelZone: level.zone,
    interaction,
    optionsCoverage,
    whatHappened,
    levelContext: levelNarrative(interaction, level.name, level.zone, close),
    optionsContext,
    hypothesis: `${controlCopy} ${resetCopy}`,
  };
}

export function buildGameplanTimeframeContexts(options: BuildOptions) {
  const now = options.now ?? Date.now();
  const candles = normalizeCandles(options.candles, now);
  return GAMEPLAN_TIMEFRAMES.flatMap((config) => {
    const context = buildContextForTimeframe(config, candles, options, now);
    return context ? [context] : [];
  });
}

export function isGameplanTimeframeContext(value: unknown): value is GameplanTimeframeContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameplanTimeframeContext>;
  return candidate.modelVersion === "gameplan-timeframe-context-v1"
    && (candidate.root === "NQ" || candidate.root === "ES")
    && GAMEPLAN_TIMEFRAMES.some((timeframe) => timeframe.id === candidate.timeframe)
    && typeof candidate.periodKey === "string"
    && typeof candidate.updatedAt === "string"
    && typeof candidate.whatHappened === "string"
    && typeof candidate.hypothesis === "string";
}
