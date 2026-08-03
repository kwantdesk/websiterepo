import type { GameplanRole } from "@/lib/gameplan";

export type KwantBotMarketRoot = "NQ" | "ES";
export type KwantBotFeedState = "connecting" | "live" | "reconnecting";
export type KwantBotContextState = "loading" | "live" | "stale" | "error";
export type KwantBotMessageKind =
  | "system"
  | "briefing"
  | "approach"
  | "touch"
  | "rejection"
  | "acceptance"
  | "outcome"
  | "options";

export type KwantBotLevel = {
  id: string;
  name: string;
  role: GameplanRole;
  strength: number;
  zone: [number, number];
  why: string;
  ifVisit: string;
  ifHold: string;
  ifBreak: string;
};

export type KwantBotMarketContext = {
  root: KwantBotMarketRoot;
  sourceSymbol: "NDX" | "SPX";
  generatedAt: string;
  sessionDate: string;
  status: "LIVE" | "PARTIAL";
  refreshAfterMs: number;
  currentPrice: number | null;
  futuresStatus: "LIVE" | "DELAYED" | "LAST_SESSION" | "UNAVAILABLE";
  oneLiner: string;
  levels: KwantBotLevel[];
  scenarios: Array<{
    name: string;
    trigger: string;
    path: number[];
    kill: string;
    weight: number;
  }>;
  options: {
    asOf: string;
    marketOpen: boolean;
    sessionDate: string;
    gammaRegime: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    gammaStrength: string;
    gammaStateLabel: string;
    volatilityState: "COMPRESSION" | "BALANCED" | "EXPANSION RISK";
    netPremium: number;
    bullishShare: number | null;
    frontExpiration: string | null;
    zeroDteAvailable: boolean;
    majorPositiveGamma: { strike: number; value: number } | null;
    majorNegativeGamma: { strike: number; value: number } | null;
    gammaChange: Array<{
      minutes: number;
      strike: number;
      change: number;
      state: string;
    }>;
    tradeSidePremium: {
      netLongPremium: number;
      longShare: number | null;
      callBought: number;
      callSold: number;
      putBought: number;
      putSold: number;
    } | null;
    recentFlow: Array<{
      id: string;
      tradeTime: number;
      contractType: "CALL" | "PUT" | "UNKNOWN";
      strikePrice: number | null;
      expirationDate: string | null;
      premium: number;
      size: number | null;
      sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
      unusual: boolean;
      opening: boolean;
      side: string;
    }>;
    errors: string[];
  };
};

export type KwantBotInterpreterMessage = {
  id: string;
  root: KwantBotMarketRoot;
  kind: KwantBotMessageKind;
  text: string;
  createdAt: string;
  dedupeKey: string;
  price?: number;
  levelId?: string;
};

export type KwantBotMemoryEvent = {
  id: string;
  root: KwantBotMarketRoot;
  type:
    | "price"
    | "context"
    | "approach"
    | "touch"
    | "rejection"
    | "acceptance"
    | "outcome";
  createdAt: string;
  price?: number;
  levelId?: string;
  levelName?: string;
  zone?: [number, number];
  reasoning?: string;
  detail?: string;
};

export type KwantBotLevelRuntime = {
  phase: "far" | "approach" | "inside";
  entrySide: "above" | "below" | null;
  touchedAt: number | null;
  lastApproachAt: number | null;
  lastTouchAt: number | null;
  lastTouchSide: "above" | "below" | null;
  lastResponseAt: number | null;
  lastResponseKey: string | null;
};

export type KwantBotPendingOutcome = {
  levelId: string;
  levelName: string;
  direction: "up" | "down";
  type: "rejection" | "acceptance";
  startedAt: number;
  startPrice: number;
  zone: [number, number];
};

export type KwantBotRuntimeState = {
  lastPrice: number | null;
  lastBriefBucket: number | null;
  levels: Record<string, KwantBotLevelRuntime>;
  pendingOutcome: KwantBotPendingOutcome | null;
};

export type KwantBotTickResult = {
  runtime: KwantBotRuntimeState;
  messages: KwantBotInterpreterMessage[];
  memory: KwantBotMemoryEvent[];
};

const FIFTEEN_MINUTES_MS = 15 * 60_000;
export const KWANTBOT_TOUCH_COOLDOWN_MS = 5 * 60_000;
export const KWANTBOT_RESPONSE_COOLDOWN_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const WEEK_MS = 7 * DAY_MS;

export function createKwantBotRuntime(): KwantBotRuntimeState {
  return {
    lastPrice: null,
    lastBriefBucket: null,
    levels: {},
    pendingOutcome: null,
  };
}

export function kwantBotInterpreterId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function formatKwantBotPrice(root: KwantBotMarketRoot, value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: root === "NQ" || value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatZone(root: KwantBotMarketRoot, zone: [number, number]) {
  return zone[0] === zone[1]
    ? formatKwantBotPrice(root, zone[0])
    : `${formatKwantBotPrice(root, zone[0])}–${formatKwantBotPrice(root, zone[1])}`;
}

function distanceToZone(price: number, zone: [number, number]) {
  if (price < zone[0]) return zone[0] - price;
  if (price > zone[1]) return price - zone[1];
  return 0;
}

function sideOfZone(price: number, zone: [number, number]): "above" | "below" | "inside" {
  if (price > zone[1]) return "above";
  if (price < zone[0]) return "below";
  return "inside";
}

function hasRecentLevelEvent(
  memory: KwantBotMemoryEvent[],
  levelId: string,
  type: KwantBotMemoryEvent["type"],
  now: number,
  cooldownMs: number,
  detailMatches: (detail: string | undefined) => boolean,
) {
  return [...memory].reverse().some((event) => {
    if (event.levelId !== levelId || event.type !== type || !detailMatches(event.detail)) return false;
    const occurredAt = Date.parse(event.createdAt);
    return Number.isFinite(occurredAt) && now - occurredAt < cooldownMs;
  });
}

function message(
  root: KwantBotMarketRoot,
  kind: KwantBotMessageKind,
  text: string,
  dedupeKey: string,
  at: number,
  extras: Pick<KwantBotInterpreterMessage, "price" | "levelId"> = {},
): KwantBotInterpreterMessage {
  return {
    id: kwantBotInterpreterId(`kwantbot-${kind}`),
    root,
    kind,
    text,
    createdAt: new Date(at).toISOString(),
    dedupeKey,
    ...extras,
  };
}

function memoryEvent(
  root: KwantBotMarketRoot,
  type: KwantBotMemoryEvent["type"],
  at: number,
  extras: Omit<KwantBotMemoryEvent, "id" | "root" | "type" | "createdAt"> = {},
): KwantBotMemoryEvent {
  return {
    id: kwantBotInterpreterId(`memory-${type}`),
    root,
    type,
    createdAt: new Date(at).toISOString(),
    ...extras,
  };
}

function nextLevel(
  levels: KwantBotLevel[],
  zone: [number, number],
  direction: "up" | "down",
) {
  const candidates = levels
    .filter((level) => direction === "up" ? level.zone[0] > zone[1] : level.zone[1] < zone[0])
    .sort((left, right) => direction === "up"
      ? left.zone[0] - right.zone[0]
      : right.zone[1] - left.zone[1]);
  return candidates[0] ?? null;
}

function contextBias(context: KwantBotMarketContext) {
  const bullishShare = context.options.bullishShare;
  if (bullishShare !== null && bullishShare >= 0.62) return "Options premium has a bullish lean";
  if (bullishShare !== null && bullishShare <= 0.38) return "Options premium has a bearish lean";
  return "Options premium is broadly balanced";
}

function topVisitedArea(
  root: KwantBotMarketRoot,
  memory: KwantBotMemoryEvent[],
  now: number,
) {
  const bucketSize = root === "NQ" ? 25 : 5;
  const samples = memory.filter((event) =>
    event.root === root
    && event.type === "price"
    && typeof event.price === "number"
    && now - Date.parse(event.createdAt) <= DAY_MS);
  if (!samples.length) return null;
  const counts = new Map<number, number>();
  samples.forEach((event) => {
    const bucket = Math.round((event.price ?? 0) / bucketSize) * bucketSize;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  });
  const [price, count] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return typeof price === "number" ? { price, count, total: samples.length } : null;
}

function matchingLevelMemory(
  root: KwantBotMarketRoot,
  level: KwantBotLevel,
  memory: KwantBotMemoryEvent[],
) {
  const levelMid = (level.zone[0] + level.zone[1]) / 2;
  const tolerance = root === "NQ" ? 40 : 10;
  return memory.filter((event) => {
    if (event.root !== root || event.type === "price" || event.type === "context") return false;
    if (event.levelId === level.id) return true;
    if (event.levelName !== level.name || !event.zone) return false;
    const eventMid = (event.zone[0] + event.zone[1]) / 2;
    return Math.abs(eventMid - levelMid) <= tolerance;
  });
}

function levelMemoryCheck(
  root: KwantBotMarketRoot,
  level: KwantBotLevel,
  memory: KwantBotMemoryEvent[],
) {
  const matches = matchingLevelMemory(root, level, memory);
  const touches = matches.filter((event) => event.type === "touch");
  const outcomes = matches.filter((event) => event.type === "outcome");
  const confirmed = outcomes.filter((event) => event.detail?.includes("follow-through"));
  const unresolved = outcomes.length - confirmed.length;
  const latestOutcome = outcomes[outcomes.length - 1];
  if (!touches.length && !outcomes.length) {
    return "Memory check: this exact area has no stored response yet, so the first reaction carries more weight than any forecast.";
  }
  const latestText = latestOutcome
    ? ` Last recorded outcome: ${latestOutcome.detail ?? "completed read"} at ${formatKwantBotPrice(root, latestOutcome.price ?? level.zone[0])}.`
    : "";
  return `Memory check: ${touches.length} prior touch${touches.length === 1 ? "" : "es"}, ${confirmed.length} confirmed follow-through${confirmed.length === 1 ? "" : "s"}${unresolved ? `, ${unresolved} unresolved or failed response${unresolved === 1 ? "" : "s"}` : ""}.${latestText}`;
}

export function buildKwantBotBriefing(args: {
  root: KwantBotMarketRoot;
  context: KwantBotMarketContext;
  memory: KwantBotMemoryEvent[];
  price: number;
  now: number;
  manual?: boolean;
}) {
  const { root, context, memory, price, now } = args;
  const recentSamples = memory
    .filter((event) =>
      event.root === root
      && event.type === "price"
      && typeof event.price === "number"
      && now - Date.parse(event.createdAt) <= FIFTEEN_MINUTES_MS)
    .map((event) => event.price as number);
  const open = recentSamples[0] ?? price;
  const high = Math.max(price, ...recentSamples);
  const low = Math.min(price, ...recentSamples);
  const move = price - open;
  const nearest = [...context.levels]
    .sort((left, right) => distanceToZone(price, left.zone) - distanceToZone(price, right.zone))[0] ?? null;
  const visited = topVisitedArea(root, memory, now);
  const touchCount = nearest
    ? memory.filter((event) =>
      event.root === root
      && event.type === "touch"
      && event.levelId === nearest.id
      && now - Date.parse(event.createdAt) <= DAY_MS).length
    : 0;
  const recentLevelOutcomes = nearest
    ? memory.filter((event) =>
      event.root === root
      && event.type === "outcome"
      && event.levelId === nearest.id
      && now - Date.parse(event.createdAt) <= WEEK_MS)
    : [];
  const confirmedOutcomes = recentLevelOutcomes.filter((event) =>
    event.detail?.includes("follow-through")).length;
  const rangeText = recentSamples.length
    ? `Last 15m: ${move >= 0 ? "+" : ""}${move.toFixed(2)} points, range ${formatKwantBotPrice(root, low)}–${formatKwantBotPrice(root, high)}.`
    : `Live price is ${formatKwantBotPrice(root, price)}; the first 15-minute memory window is still building.`;
  const memoryText = visited
    ? `Over the rolling 24h, price has printed most often around ${formatKwantBotPrice(root, visited.price)} in the recorded one-minute samples.`
    : "The rolling 24-hour price memory is still building.";
  const levelText = nearest
    ? `${nearest.name} (${formatZone(root, nearest.zone)}) is nearest, ${distanceToZone(price, nearest.zone).toFixed(2)} points away${touchCount ? `, with ${touchCount} recorded touch${touchCount === 1 ? "" : "es"} in the last 24h` : ""}.`
    : "No verified Kwant level is loaded yet.";
  const historyText = nearest && recentLevelOutcomes.length
    ? `Across retained weekly memory, ${nearest.name} has ${confirmedOutcomes} confirmed follow-through outcome${confirmedOutcomes === 1 ? "" : "s"} from ${recentLevelOutcomes.length} completed read${recentLevelOutcomes.length === 1 ? "" : "s"}.`
    : "There is not enough retained weekly level history yet to claim a repeatable response.";
  const optionsText = `${context.options.gammaStateLabel}; ${contextBias(context).toLowerCase()}.`;

  return message(
    root,
    "briefing",
    `${args.manual ? "On-demand market read." : "15-minute market read."}\n\n${rangeText} ${levelText}\n\n${memoryText} ${historyText} ${optionsText} Wait for the level response before treating direction as confirmed.`,
    args.manual ? `manual:${now}` : `brief:${Math.floor(now / FIFTEEN_MINUTES_MS)}`,
    now,
    { price },
  );
}

export function buildContextChangeMessage(
  previous: KwantBotMarketContext | null,
  next: KwantBotMarketContext,
  now: number,
) {
  if (!previous) {
    const nearest = next.currentPrice === null
      ? null
      : [...next.levels].sort((left, right) =>
        distanceToZone(next.currentPrice as number, left.zone) - distanceToZone(next.currentPrice as number, right.zone))[0] ?? null;
    return message(
      next.root,
      "system",
      `${next.root} interpreter online. ${next.oneLiner}${nearest ? ` Nearest verified level: ${nearest.name} at ${formatZone(next.root, nearest.zone)}.` : ""} I’ll report approaches, touches, confirmed responses, outcomes, and a market read every 15 minutes. Live positioning changes are routed to Options Tape.`,
      `context:${next.generatedAt}`,
      now,
      { price: next.currentPrice ?? undefined, levelId: nearest?.id },
    );
  }

  // Options Tape is an intraday New York feed. Completed-session snapshots
  // remain useful elsewhere, but must never generate fresh tape messages.
  if (!next.options.marketOpen) return null;

  const changes: string[] = [];
  if (previous.options.gammaRegime !== next.options.gammaRegime) {
    changes.push(`gamma changed from ${previous.options.gammaRegime} to ${next.options.gammaRegime}`);
  }
  if (
    previous.options.bullishShare !== null
    && next.options.bullishShare !== null
    && Math.abs(previous.options.bullishShare - next.options.bullishShare) >= 0.12
  ) {
    changes.push(`bullish premium share moved from ${Math.round(previous.options.bullishShare * 100)}% to ${Math.round(next.options.bullishShare * 100)}%`);
  }
  if (
    Math.sign(previous.options.netPremium) !== 0
    && Math.sign(next.options.netPremium) !== 0
    && Math.sign(previous.options.netPremium) !== Math.sign(next.options.netPremium)
  ) {
    changes.push("net options premium flipped sign");
  }
  const previousFlowIds = new Set(previous.options.recentFlow.map((row) => row.id));
  const freshNotablePrint = next.options.recentFlow.find((row) =>
    !previousFlowIds.has(row.id)
    && (row.unusual || row.opening || row.premium >= 250_000));
  if (!changes.length && !freshNotablePrint) return null;
  const tapeText = freshNotablePrint
    ? ` New tape: ${freshNotablePrint.sentiment.toLowerCase()} ${freshNotablePrint.contractType.toLowerCase()}${freshNotablePrint.strikePrice === null ? "" : ` at ${freshNotablePrint.strikePrice.toLocaleString("en-US")}`}, $${Math.round(freshNotablePrint.premium).toLocaleString("en-US")} premium${freshNotablePrint.opening ? ", opening" : ""}${freshNotablePrint.unusual ? ", unusual" : ""}.`
    : "";
  const changeText = changes.length
    ? `${changes.join("; ")}.`
    : "A material new options print has reached the tape.";
  return message(
    next.root,
    "options",
    `Options positioning update: ${changeText}${tapeText} ${next.options.gammaStateLabel}; ${contextBias(next).toLowerCase()}. This changes the backdrop, not the trigger—price still has to confirm at the mapped levels.`,
    `options:${next.generatedAt}:${changes.join("|")}:${freshNotablePrint?.id ?? "none"}`,
    now,
    { price: next.currentPrice ?? undefined },
  );
}

export function interpretKwantBotTick(args: {
  root: KwantBotMarketRoot;
  price: number;
  now: number;
  context: KwantBotMarketContext | null;
  memory: KwantBotMemoryEvent[];
  runtime: KwantBotRuntimeState;
}): KwantBotTickResult {
  const { root, price, now, context, memory } = args;
  const runtime: KwantBotRuntimeState = {
    ...args.runtime,
    levels: { ...args.runtime.levels },
    pendingOutcome: args.runtime.pendingOutcome ? { ...args.runtime.pendingOutcome } : null,
  };
  const messages: KwantBotInterpreterMessage[] = [];
  const nextMemory: KwantBotMemoryEvent[] = [];
  const priorPrice = runtime.lastPrice;
  runtime.lastPrice = price;

  if (!context?.levels.length) return { runtime, messages, memory: nextMemory };

  if (runtime.pendingOutcome) {
    const pending = runtime.pendingOutcome;
    const travelNeeded = root === "NQ" ? 24 : 6;
    const signedTravel = pending.direction === "up"
      ? price - pending.startPrice
      : pending.startPrice - price;
    const returnedInside = sideOfZone(price, pending.zone) === "inside";
    if (signedTravel >= travelNeeded) {
      messages.push(message(
        root,
        "outcome",
        `${pending.levelName} follow-through confirmed. Price has travelled ${signedTravel.toFixed(2)} points ${pending.direction} from the ${pending.type}. The response has produced distance; manage the next decision at the next mapped level rather than chasing the middle.`,
        `outcome:${pending.levelId}:${pending.startedAt}:confirmed`,
        now,
        { price, levelId: pending.levelId },
      ));
      nextMemory.push(memoryEvent(root, "outcome", now, {
        price,
        levelId: pending.levelId,
        levelName: pending.levelName,
        zone: pending.zone,
        detail: `${pending.type} follow-through ${pending.direction}`,
      }));
      runtime.pendingOutcome = null;
    } else if (returnedInside && now - pending.startedAt >= 20_000) {
      messages.push(message(
        root,
        "outcome",
        `${pending.levelName} has pulled price back into its zone. The initial ${pending.type} has not produced clean distance, so the signal is unresolved. Stand down until price leaves the area decisively.`,
        `outcome:${pending.levelId}:${pending.startedAt}:failed`,
        now,
        { price, levelId: pending.levelId },
      ));
      nextMemory.push(memoryEvent(root, "outcome", now, {
        price,
        levelId: pending.levelId,
        levelName: pending.levelName,
        zone: pending.zone,
        detail: `${pending.type} returned to zone`,
      }));
      runtime.pendingOutcome = null;
    }
  }

  const nearest = [...context.levels]
    .sort((left, right) => distanceToZone(price, left.zone) - distanceToZone(price, right.zone))[0];
  const distance = distanceToZone(price, nearest.zone);
  const width = Math.max(0.25, nearest.zone[1] - nearest.zone[0]);
  const approachDistance = root === "NQ" ? Math.max(30, width * 3) : Math.max(8, width * 3);
  const levelRuntime = runtime.levels[nearest.id] ?? {
    phase: "far",
    entrySide: null,
    touchedAt: null,
    lastApproachAt: null,
    lastTouchAt: null,
    lastTouchSide: null,
    lastResponseAt: null,
    lastResponseKey: null,
  };
  const currentSide = sideOfZone(price, nearest.zone);
  const priorSide = priorPrice === null ? currentSide : sideOfZone(priorPrice, nearest.zone);

  if (
    currentSide !== "inside"
    && levelRuntime.phase !== "inside"
    && distance <= approachDistance
    && (!levelRuntime.lastApproachAt || now - levelRuntime.lastApproachAt >= 10 * 60_000)
  ) {
    const target = nextLevel(context.levels, nearest.zone, currentSide === "below" ? "up" : "down");
    const priorMemory = levelMemoryCheck(root, nearest, memory);
    messages.push(message(
      root,
      "approach",
      `${root} is approaching ${nearest.name} at ${formatZone(root, nearest.zone)}—${distance.toFixed(2)} points away. Why it matters: ${nearest.why} ${priorMemory} Prepare for the first response. ${nearest.ifVisit}${target ? ` The next mapped area on rejection is ${target.name} at ${formatZone(root, target.zone)}.` : ""}`,
      `approach:${nearest.id}:${Math.floor(now / (10 * 60_000))}`,
      now,
      { price, levelId: nearest.id },
    ));
    nextMemory.push(memoryEvent(root, "approach", now, {
      price,
      levelId: nearest.id,
      levelName: nearest.name,
      zone: nearest.zone,
      reasoning: nearest.why,
      detail: `${distance.toFixed(2)} points away`,
    }));
    levelRuntime.phase = "approach";
    levelRuntime.lastApproachAt = now;
  }

  if (currentSide === "inside" && levelRuntime.phase !== "inside") {
    const priorApproach = [...memory].reverse().find((event) =>
      event.root === root
      && event.type === "approach"
      && event.levelId === nearest.id);
    const approachReference = priorApproach
      ? ` This is the area flagged at ${new Date(priorApproach.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}; that preparation note remains valid until the response is confirmed or invalidated.`
      : "";
    const entrySide = priorSide === "inside"
      ? priorPrice !== null && priorPrice >= (nearest.zone[0] + nearest.zone[1]) / 2 ? "above" : "below"
      : priorSide;
    levelRuntime.phase = "inside";
    levelRuntime.entrySide = entrySide;
    levelRuntime.touchedAt = now;
    const touchDetail = `entered from ${entrySide}`;
    const touchAnnouncedRecently = (
      levelRuntime.lastTouchSide === entrySide
      && levelRuntime.lastTouchAt !== null
      && now - levelRuntime.lastTouchAt < KWANTBOT_TOUCH_COOLDOWN_MS
    ) || hasRecentLevelEvent(
      memory,
      nearest.id,
      "touch",
      now,
      KWANTBOT_TOUCH_COOLDOWN_MS,
      (detail) => detail === touchDetail,
    );
    if (!touchAnnouncedRecently) {
      messages.push(message(
        root,
        "touch",
        `${root} has hit ${nearest.name} and is trading inside ${formatZone(root, nearest.zone)}.${approachReference} No directional call yet. ${nearest.ifHold} ${nearest.ifBreak}`,
        `touch:${nearest.id}:${entrySide}`,
        now,
        { price, levelId: nearest.id },
      ));
      nextMemory.push(memoryEvent(root, "touch", now, {
        price,
        levelId: nearest.id,
        levelName: nearest.name,
        zone: nearest.zone,
        reasoning: nearest.ifVisit,
        detail: touchDetail,
      }));
      levelRuntime.lastTouchAt = now;
      levelRuntime.lastTouchSide = entrySide;
    }
  } else if (
    currentSide !== "inside"
    && levelRuntime.phase === "inside"
    && levelRuntime.touchedAt !== null
  ) {
    const entrySide = levelRuntime.entrySide
      ?? (priorSide === "inside"
        ? currentSide
        : priorSide);
    const rejected = currentSide === entrySide;
    const direction = currentSide === "above" ? "up" : "down";
    const target = nextLevel(context.levels, nearest.zone, direction);
    const responseKind = rejected ? "rejection" : "acceptance";
    const responseKey = `${responseKind}:${direction}`;
    const responseDetail = `${direction} after ${now - levelRuntime.touchedAt}ms`;
    const responseAnnouncedRecently = (
      levelRuntime.lastResponseKey === responseKey
      && levelRuntime.lastResponseAt !== null
      && now - levelRuntime.lastResponseAt < KWANTBOT_RESPONSE_COOLDOWN_MS
    ) || hasRecentLevelEvent(
      memory,
      nearest.id,
      responseKind,
      now,
      KWANTBOT_RESPONSE_COOLDOWN_MS,
      (detail) => detail === `${direction} response` || detail?.startsWith(`${direction} after `) === true,
    );
    const responseText = rejected
      ? `${nearest.name} has rejected price back ${direction} after ${Math.max(1, Math.round((now - levelRuntime.touchedAt) / 1_000))} seconds in the zone. That is the first confirmation, not a reason to chase.${target ? ` The next mapped decision is ${target.name} at ${formatZone(root, target.zone)}.` : ""}`
      : `${root} has accepted through ${nearest.name} to the ${direction}. ${nearest.ifBreak}${target ? ` The next mapped decision is ${target.name} at ${formatZone(root, target.zone)}.` : ""} A retest that holds outside the zone is stronger than the first break.`;
    if (!responseAnnouncedRecently) {
      messages.push(message(
        root,
        responseKind,
        responseText,
        `${responseKind}:${nearest.id}:${direction}`,
        now,
        { price, levelId: nearest.id },
      ));
      nextMemory.push(memoryEvent(root, responseKind, now, {
        price,
        levelId: nearest.id,
        levelName: nearest.name,
        zone: nearest.zone,
        reasoning: rejected ? nearest.ifHold : nearest.ifBreak,
        detail: responseDetail,
      }));
      runtime.pendingOutcome = {
        levelId: nearest.id,
        levelName: nearest.name,
        direction,
        type: responseKind,
        startedAt: now,
        startPrice: price,
        zone: nearest.zone,
      };
      levelRuntime.lastResponseAt = now;
      levelRuntime.lastResponseKey = responseKey;
    }
    levelRuntime.phase = "approach";
    levelRuntime.entrySide = null;
    levelRuntime.touchedAt = null;
  } else if (currentSide !== "inside" && distance > approachDistance * 1.4) {
    levelRuntime.phase = "far";
    levelRuntime.entrySide = null;
    levelRuntime.touchedAt = null;
  }

  runtime.levels[nearest.id] = levelRuntime;

  const briefBucket = Math.floor(now / FIFTEEN_MINUTES_MS);
  if (runtime.lastBriefBucket !== briefBucket) {
    runtime.lastBriefBucket = briefBucket;
    messages.push(buildKwantBotBriefing({ root, context, memory, price, now }));
  }

  return { runtime, messages, memory: nextMemory };
}

export function pruneKwantBotMemory(memory: KwantBotMemoryEvent[], now = Date.now()) {
  return memory.filter((event) => {
    const age = now - Date.parse(event.createdAt);
    return event.type === "price" ? age <= DAY_MS : true;
  }).slice(-50_000);
}
