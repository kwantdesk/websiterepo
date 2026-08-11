import type { OptionsFlowPayload, OptionsKeyLevel } from "@/lib/optionsFlow";
import {
  gammaCageLabel,
  gammaCageNarrative,
  isGammaCageGameplanLevel,
  type GammaCageRegime,
} from "@/lib/gammaCage";

export const GAMEPLAN_SESSIONS = [
  { id: "globex", label: "Globex", timeZone: "America/New_York", openHour: 18, openMinute: 0 },
  { id: "tokyo", label: "Tokyo", timeZone: "Asia/Tokyo", openHour: 9, openMinute: 0 },
  { id: "frankfurt", label: "Frankfurt", timeZone: "Europe/Berlin", openHour: 8, openMinute: 0 },
  { id: "london", label: "London", timeZone: "Europe/London", openHour: 8, openMinute: 0 },
  { id: "newyork", label: "New York", timeZone: "America/New_York", openHour: 9, openMinute: 30 },
] as const;

export type GameplanSession = (typeof GAMEPLAN_SESSIONS)[number]["id"];
export const GAMEPLAN_PREPARATION_WINDOW_MS = 2 * 60 * 60 * 1_000;
export type GameplanSessionTarget = {
  session: GameplanSession;
  activeSession: GameplanSession;
  phase: "ACTIVE" | "PREPARING";
  opensAt: string;
  millisecondsUntilOpen: number;
};
export type GameplanTapeState = "calm" | "snowball" | "mixed";
export type GameplanRole = "magnet" | "wall" | "accelerant" | "decision";
export type GameplanSource = "positioning" | "dated" | "tape-memory" | "em-math";

export type GameplanAPlusTarget = {
  price: number;
  level: string;
  reason: string;
  risk_reward: number;
  pay_percent: number;
};

export type GameplanAPlusSetup = {
  side: "LONG" | "SHORT";
  quality_score: number;
  quality_grade: "A+" | "A" | "B+" | "WAIT";
  setup_name: string;
  zone: [number, number];
  level_name: string;
  level_role: GameplanRole;
  permission: string;
  options_alignment: string;
  reasoning: string[];
  entry_reference: number;
  stop: number;
  targets: number[];
  target_details: GameplanAPlusTarget[];
  best_risk_reward: number;
  invalidation: string;
};

export function isGameplanSession(value: unknown): value is GameplanSession {
  return typeof value === "string" && GAMEPLAN_SESSIONS.some((session) => session.id === value);
}

export function gameplanSessionLabel(session: GameplanSession) {
  return GAMEPLAN_SESSIONS.find((item) => item.id === session)?.label ?? session;
}

export function gameplanSessionConfig(session: GameplanSession) {
  return GAMEPLAN_SESSIONS.find((item) => item.id === session) ?? GAMEPLAN_SESSIONS[0];
}

function timeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ) - date.getTime();
}

function sessionOpenTimestamp(
  session: (typeof GAMEPLAN_SESSIONS)[number],
  localDate: Date,
) {
  const utcGuess = Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
    session.openHour,
    session.openMinute,
  );
  return utcGuess - timeZoneOffset(new Date(utcGuess), session.timeZone);
}

function sessionRunsOnLocalDay(session: GameplanSession, localDay: number) {
  if (session === "globex") return localDay === 0 || (localDay >= 1 && localDay <= 4);
  return localDay >= 1 && localDay <= 5;
}

/**
 * Targets the active market session until the next valid session is within the
 * two-hour preparation window, then rolls the Gameplan forward automatically.
 */
export function resolveGameplanSessionTarget(at = new Date()): GameplanSessionTarget {
  const now = at.getTime();
  let latest: { session: GameplanSession; openedAt: number } | null = null;
  let next: { session: GameplanSession; openedAt: number } | null = null;

  for (const session of GAMEPLAN_SESSIONS) {
    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: session.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const values = Object.fromEntries(localParts.map((part) => [part.type, part.value]));
    const localDate = new Date(Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
    ));

    for (let dayOffset = -7; dayOffset <= 8; dayOffset += 1) {
      const candidateDate = new Date(localDate.getTime() + dayOffset * 86_400_000);
      if (!sessionRunsOnLocalDay(session.id, candidateDate.getUTCDay())) continue;
      const openedAt = sessionOpenTimestamp(session, candidateDate);
      if (openedAt <= now) {
        if (!latest || openedAt > latest.openedAt) latest = { session: session.id, openedAt };
      } else if (!next || openedAt < next.openedAt) {
        next = { session: session.id, openedAt };
      }
    }
  }

  const active = latest ?? { session: "newyork" as const, openedAt: now };
  const preparing = next !== null && next.openedAt - now <= GAMEPLAN_PREPARATION_WINDOW_MS;
  const target = preparing ? next! : active;
  return {
    session: target.session,
    activeSession: active.session,
    phase: preparing ? "PREPARING" : "ACTIVE",
    opensAt: new Date(target.openedAt).toISOString(),
    millisecondsUntilOpen: preparing ? Math.max(0, target.openedAt - now) : 0,
  };
}

export function currentGameplanSession(at = new Date()): GameplanSession {
  return resolveGameplanSessionTarget(at).session;
}

export type GameplanEdition = {
  edition: {
    session: GameplanSession;
    date: string;
    published_at: string;
    data_basis: string;
    freshness_note: string;
  };
  environment: {
    tape: { state: GameplanTapeState; flip_price: number | null; plain: string };
    fear: { ratio: number; plain: string };
    flow: { lean: number; plain: string };
    expiry: { relevant: boolean; plain: string };
  };
  one_liner: string;
  ladder: Array<{
    zone: [number, number];
    name: string;
    role: GameplanRole;
    strength: number;
    sources: GameplanSource[];
    why: string;
    if_visit: string;
    if_hold: string;
    if_break: string;
    order_character: { balance: number; plain: string };
    terrain: "sticky" | "air";
    history: string;
    career: string[];
  }>;
  belly_zones: Array<[number, number]>;
  scenarios: Array<{
    name: string;
    trigger: string;
    path: number[];
    kill: string;
    weight: number;
  }>;
  one_trade: {
    zone: [number, number];
    long_side: GameplanAPlusSetup;
    short_side: GameplanAPlusSetup;
    not_a_trade_if: string;
  };
  receipts: {
    date: string;
    levels: Array<{
      zone: [number, number];
      verdict: "held" | "broke" | "untested";
      note: string;
    }>;
    one_trade_outcome: string;
    honest_note: string;
  };
  downloads: { deepchart_xml: string; sierra_csv: string };
};

export type GameplanPayload = {
  instrument: "NQ" | "ES";
  source_symbol: "NDX" | "SPX";
  current_price: number | null;
  status: "LIVE" | "PARTIAL";
  generated_at: string;
  refresh_after_ms: number;
  plan: GameplanEdition;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableFiniteNumber(value: unknown): value is number | null {
  return value === null || finiteNumber(value);
}

function numberZone(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && finiteNumber(value[0])
    && finiteNumber(value[1]);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function numberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(finiteNumber);
}

function isAPlusSetup(value: unknown): value is GameplanAPlusSetup {
  if (!record(value)) return false;
  return (value.side === "LONG" || value.side === "SHORT")
    && finiteNumber(value.quality_score)
    && ["A+", "A", "B+", "WAIT"].includes(String(value.quality_grade))
    && typeof value.setup_name === "string"
    && numberZone(value.zone)
    && typeof value.level_name === "string"
    && ["magnet", "wall", "accelerant", "decision"].includes(String(value.level_role))
    && typeof value.permission === "string"
    && typeof value.options_alignment === "string"
    && stringArray(value.reasoning)
    && finiteNumber(value.entry_reference)
    && finiteNumber(value.stop)
    && numberArray(value.targets)
    && Array.isArray(value.target_details)
    && value.target_details.every((target) => record(target)
      && finiteNumber(target.price)
      && typeof target.level === "string"
      && typeof target.reason === "string"
      && finiteNumber(target.risk_reward)
      && finiteNumber(target.pay_percent))
    && finiteNumber(value.best_risk_reward)
    && typeof value.invalidation === "string";
}

/**
 * Runtime contract for data that is allowed to reach the Game Plan renderer.
 * Game Plan data is cached between navigations and its schema has evolved; a
 * TypeScript cast cannot protect a running browser from an old or partial
 * record. Rejecting that record keeps the last complete edition on screen.
 */
export function isGameplanPayload(value: unknown): value is GameplanPayload {
  if (!record(value) || !record(value.plan)) return false;
  const plan = value.plan;
  if (!record(plan.edition) || !record(plan.environment)) return false;
  const edition = plan.edition;
  const environment = plan.environment;
  if (!record(environment.tape) || !record(environment.fear)
    || !record(environment.flow) || !record(environment.expiry)) return false;

  const ladderValid = Array.isArray(plan.ladder) && plan.ladder.every((level) => (
    record(level)
    && numberZone(level.zone)
    && typeof level.name === "string"
    && ["magnet", "wall", "accelerant", "decision"].includes(String(level.role))
    && finiteNumber(level.strength)
    && Array.isArray(level.sources)
    && level.sources.every((source) => ["positioning", "dated", "tape-memory", "em-math"].includes(String(source)))
    && typeof level.why === "string"
    && typeof level.if_visit === "string"
    && typeof level.if_hold === "string"
    && typeof level.if_break === "string"
    && record(level.order_character)
    && finiteNumber(level.order_character.balance)
    && typeof level.order_character.plain === "string"
    && (level.terrain === "sticky" || level.terrain === "air")
    && typeof level.history === "string"
    && stringArray(level.career)
  ));
  const scenariosValid = Array.isArray(plan.scenarios) && plan.scenarios.every((scenario) => (
    record(scenario)
    && typeof scenario.name === "string"
    && typeof scenario.trigger === "string"
    && numberArray(scenario.path)
    && typeof scenario.kill === "string"
    && finiteNumber(scenario.weight)
  ));
  if (!record(plan.one_trade) || !record(plan.receipts) || !record(plan.downloads)) return false;
  const receipts = plan.receipts;

  return (value.instrument === "NQ" || value.instrument === "ES")
    && (value.source_symbol === "NDX" || value.source_symbol === "SPX")
    && nullableFiniteNumber(value.current_price)
    && (value.status === "LIVE" || value.status === "PARTIAL")
    && typeof value.generated_at === "string"
    && finiteNumber(value.refresh_after_ms)
    && isGameplanSession(edition.session)
    && typeof edition.date === "string"
    && typeof edition.published_at === "string"
    && typeof edition.data_basis === "string"
    && typeof edition.freshness_note === "string"
    && ["calm", "snowball", "mixed"].includes(String(environment.tape.state))
    && nullableFiniteNumber(environment.tape.flip_price)
    && typeof environment.tape.plain === "string"
    && finiteNumber(environment.fear.ratio)
    && typeof environment.fear.plain === "string"
    && finiteNumber(environment.flow.lean)
    && typeof environment.flow.plain === "string"
    && typeof environment.expiry.relevant === "boolean"
    && typeof environment.expiry.plain === "string"
    && typeof plan.one_liner === "string"
    && ladderValid
    && Array.isArray(plan.belly_zones)
    && plan.belly_zones.every(numberZone)
    && scenariosValid
    && numberZone(plan.one_trade.zone)
    && isAPlusSetup(plan.one_trade.long_side)
    && isAPlusSetup(plan.one_trade.short_side)
    && typeof plan.one_trade.not_a_trade_if === "string"
    && typeof receipts.date === "string"
    && Array.isArray(receipts.levels)
    && receipts.levels.every((level) => record(level)
      && numberZone(level.zone)
      && ["held", "broke", "untested"].includes(String(level.verdict))
      && typeof level.note === "string")
    && typeof receipts.one_trade_outcome === "string"
    && typeof receipts.honest_note === "string"
    && typeof plan.downloads.deepchart_xml === "string"
    && typeof plan.downloads.sierra_csv === "string";
}

function roundToTick(value: number, root: "NQ" | "ES") {
  const tick = root === "NQ" ? 0.25 : 0.25;
  return Math.round(value / tick) * tick;
}

function translatedPrice(level: OptionsKeyLevel, data: OptionsFlowPayload, root: "NQ" | "ES") {
  const scale = data.marketData.levelPriceScale || 1;
  return roundToTick(level.price * scale, root);
}

function roleForLevel(level: OptionsKeyLevel): GameplanRole {
  if (level.kind === "GAMMA_ACCELERATOR") return "accelerant";
  if (level.kind.includes("MAGNET")) return "magnet";
  if (level.kind === "ZERO_GAMMA" || level.kind.includes("CENTRE") || level.kind.includes("MAX_PAIN")) return "decision";
  return "wall";
}

function cageKindForLevel(level: OptionsKeyLevel) {
  if (level.kind.includes("CALL_WALL")) return "CALL_WALL" as const;
  if (level.kind.includes("PUT_WALL")) return "PUT_WALL" as const;
  if (level.kind.includes("MAGNET")) return "GAMMA_MAGNET" as const;
  if (level.kind === "GAMMA_ACCELERATOR") return "GAMMA_ACCELERATOR" as const;
  if (level.kind === "ZERO_GAMMA") return "ZERO_GAMMA" as const;
  return null;
}

function nameForLevel(level: OptionsKeyLevel, regime: GammaCageRegime) {
  const cageKind = cageKindForLevel(level);
  if (cageKind) return gammaCageLabel(cageKind, regime);
  if (level.kind.includes("CENTRE") || level.kind.includes("MAX_PAIN")) return "THE HINGE";
  if (level.kind.includes("PUT_SUPPORT")) return "BUYER DEFENCE";
  return "POSITIONING WALL";
}

function sourceForLevel(level: OptionsKeyLevel): GameplanSource[] {
  if (level.metric === "EXPECTED_MOVE_1SIGMA") return ["em-math"];
  if (level.metric === "OPEN_INTEREST_MAX_PAIN") return ["positioning", "dated"];
  if (level.metric === "GEX_AND_OPEN_INTEREST") return ["positioning", "dated"];
  return ["positioning"];
}

function strengthForLevel(level: OptionsKeyLevel) {
  return Math.max(1, Math.min(5, 6 - Math.max(1, level.rank)));
}

function formatLevel(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function tapeFromData(data: OptionsFlowPayload): GameplanTapeState {
  if (data.levels.regime === "POSITIVE") return "calm";
  if (data.levels.regime === "NEGATIVE") return "snowball";
  return "mixed";
}

export function createLevelRows(data: OptionsFlowPayload, root: "NQ" | "ES") {
  const currentPrice = data.marketData.lastPrice;
  const regime = data.levels.regime;
  const unique = new Map<number, OptionsKeyLevel>();
  for (const level of gameplanEligibleKeyLevels(data.levels.keyLevels)) {
    const price = translatedPrice(level, data, root);
    const existing = unique.get(price);
    if (!existing || level.rank < existing.rank) unique.set(price, level);
  }

  const selected = [...unique.entries()]
    .sort((a, b) => b[0] - a[0])
    .filter(([price]) => currentPrice === null || Math.abs(price / currentPrice - 1) <= 0.08)
    .slice(0, 12);

  return selected.map(([price, level], index) => {
    const role = roleForLevel(level);
    const cageKind = cageKindForLevel(level);
    const cageNarrative = cageKind ? gammaCageNarrative(cageKind, regime) : null;
    const width = root === "NQ" ? (role === "magnet" ? 12 : 6) : (role === "magnet" ? 3 : 1.5);
    const above = selected[Math.max(0, index - 1)]?.[0] ?? price + width * 4;
    const below = selected[Math.min(selected.length - 1, index + 1)]?.[0] ?? price - width * 4;
    const supportLike = level.kind.includes("PUT") || level.kind.includes("MIN");
    const resistanceLike = level.kind.includes("CALL") || level.kind.includes("MAX");
    const balance = supportLike ? 0.72 : resistanceLike ? -0.72 : 0;
    const terrain: "sticky" | "air" = role === "accelerant" ? "air" : "sticky";

    return {
      zone: [roundToTick(price - width, root), roundToTick(price + width, root)] as [number, number],
      name: nameForLevel(level, regime),
      role,
      strength: strengthForLevel(level),
      sources: sourceForLevel(level),
      why: level.explanation || (
        role === "magnet"
          ? "The board’s positioning is concentrated here, so hedging flows can repeatedly pull price back toward it."
          : "A measurable concentration of options positioning sits here, so the firms carrying the other side are more likely to trade when price arrives."
      ),
      if_visit: cageNarrative?.visit ?? "Watch the first reaction. A useful defence leaves the level quickly; repeated small bounces mean the orders may be getting used up.",
      if_hold: cageNarrative?.hold ?? `A clean defence keeps rotation toward ${formatLevel(above)} in play. Let price leave the zone before treating the reaction as real.`,
      if_break: cageNarrative?.break ?? `Acceptance through the zone opens the path toward ${formatLevel(below)}. Broken support can become resistance on the retest, and vice versa.`,
      order_character: {
        balance,
        plain: balance > 0
          ? "The concentration is support-like: buyers and short-option hedging are more likely to defend from below."
          : balance < 0
            ? "The concentration is resistance-like: sellers and long-option hedging are more likely to defend from above."
            : "The positioning is balanced around this level. Price decides the role by the side it accepts.",
      },
      terrain,
      history: "",
      career: [],
    };
  });
}

export function gameplanEligibleKeyLevels(levels: OptionsKeyLevel[]) {
  return levels.filter((level) => isGammaCageGameplanLevel(level.kind));
}

function nearestLevels(levels: GameplanEdition["ladder"], current: number | null) {
  const mids = levels.map((level) => (level.zone[0] + level.zone[1]) / 2).sort((a, b) => a - b);
  if (!mids.length) return { below: 0, hinge: 0, above: 0 };
  if (current === null) {
    const middle = Math.floor(mids.length / 2);
    return {
      below: mids[Math.max(0, middle - 1)],
      hinge: mids[middle],
      above: mids[Math.min(mids.length - 1, middle + 1)],
    };
  }
  const below = [...mids].reverse().find((price) => price <= current) ?? mids[0];
  const above = mids.find((price) => price >= current) ?? mids[mids.length - 1];
  const hinge = mids.reduce((best, price) => Math.abs(price - current) < Math.abs(best - current) ? price : best, mids[0]);
  return { below, hinge, above };
}

function aPlusSetupForSide(
  side: "LONG" | "SHORT",
  ladder: GameplanEdition["ladder"],
  current: number | null,
  flowLean: number,
  tape: GameplanTapeState,
  root: "NQ" | "ES",
): GameplanAPlusSetup {
  const direction = side === "LONG" ? 1 : -1;
  const middleLevel = ladder[Math.floor(ladder.length / 2)];
  const referencePrice = current
    ?? (middleLevel ? (middleLevel.zone[0] + middleLevel.zone[1]) / 2 : 0);
  const directional = ladder.filter((level) => {
    const midpoint = (level.zone[0] + level.zone[1]) / 2;
    return side === "LONG" ? midpoint <= referencePrice : midpoint >= referencePrice;
  });
  const candidates = directional;
  const stopBuffer = root === "NQ" ? 12 : 3;

  const ranked = candidates.map((level) => {
    const midpoint = (level.zone[0] + level.zone[1]) / 2;
    const entryReference = side === "LONG" ? level.zone[1] : level.zone[0];
    const stop = roundToTick(
      side === "LONG" ? level.zone[0] - stopBuffer : level.zone[1] + stopBuffer,
      root,
    );
    const risk = Math.max(0.25, Math.abs(entryReference - stop));
    const targetLevels = ladder
      .filter((candidate) => {
        const targetPrice = side === "LONG" ? candidate.zone[0] : candidate.zone[1];
        return side === "LONG" ? targetPrice > entryReference : targetPrice < entryReference;
      })
      .sort((left, right) => {
        const leftPrice = side === "LONG" ? left.zone[0] : left.zone[1];
        const rightPrice = side === "LONG" ? right.zone[0] : right.zone[1];
        return side === "LONG" ? leftPrice - rightPrice : rightPrice - leftPrice;
      })
      .filter((candidate, index, rows) => {
        const price = side === "LONG" ? candidate.zone[0] : candidate.zone[1];
        return index === rows.findIndex((row) =>
          (side === "LONG" ? row.zone[0] : row.zone[1]) === price);
      })
      .slice(0, 3);
    const paySplits = targetLevels.length >= 3
      ? [40, 35, 25]
      : targetLevels.length === 2 ? [60, 40] : [100];
    const targetDetails = targetLevels.map((target, index): GameplanAPlusTarget => {
      const price = side === "LONG" ? target.zone[0] : target.zone[1];
      return {
        price,
        level: target.name,
        reason: `Pay into ${target.name}; it is the next verified ${target.role} on the options-based session ladder.`,
        risk_reward: Number((Math.abs(price - entryReference) / risk).toFixed(2)),
        pay_percent: paySplits[index] ?? 0,
      };
    });
    const bestRiskReward = targetDetails.reduce(
      (best, target) => Math.max(best, target.risk_reward),
      0,
    );
    const characterAlignment = direction * level.order_character.balance;
    const flowAlignment = direction * flowLean;
    const roleScore = level.role === "wall"
      ? 15
      : level.role === "decision" ? 12 : level.role === "accelerant" ? 9 : 7;
    const sourceScore = Math.min(12, level.sources.length * 4);
    const characterScore = Math.round(Math.max(-5, Math.min(12, characterAlignment * 12)));
    const flowScore = Math.round(Math.max(-7, Math.min(12, flowAlignment * 12)));
    const rrScore = Math.min(16, Math.round(bestRiskReward * 4));
    const correctSideScore = side === "LONG"
      ? midpoint <= referencePrice ? 8 : 0
      : midpoint >= referencePrice ? 8 : 0;
    const distancePenalty = Math.min(
      18,
      Math.round(Math.abs(midpoint - referencePrice) / (root === "NQ" ? 40 : 10)),
    );
    const qualityScore = Math.max(0, Math.min(100,
      25
      + level.strength * 5
      + roleScore
      + sourceScore
      + characterScore
      + flowScore
      + rrScore
      + correctSideScore
      - distancePenalty,
    ));
    return {
      level,
      entryReference,
      stop,
      targetDetails,
      bestRiskReward,
      qualityScore,
      characterAlignment,
      flowAlignment,
    };
  }).sort((left, right) => right.qualityScore - left.qualityScore);

  const selected = ranked[0];
  if (!selected) {
    return {
      side,
      quality_score: 0,
      quality_grade: "WAIT",
      setup_name: `${side === "LONG" ? "Long" : "Short"} setup awaiting verified levels`,
      zone: [referencePrice, referencePrice],
      level_name: "NO VERIFIED LEVEL",
      level_role: "decision",
      permission: "No trade until a verified structural level and options-flow context are available.",
      options_alignment: "Options alignment is unavailable.",
      reasoning: ["The current edition does not contain enough verified ladder data to manufacture an A+ setup."],
      entry_reference: referencePrice,
      stop: referencePrice,
      targets: [],
      target_details: [],
      best_risk_reward: 0,
      invalidation: "Unavailable until the session ladder reconnects.",
    };
  }

  const { level, targetDetails, flowAlignment, characterAlignment } = selected;
  const flowDescription = Math.abs(flowLean) < 0.15
    ? "Classified options premium is balanced, so the setup requires stronger price confirmation."
    : flowAlignment > 0
      ? `Classified options premium is aligned with the ${side.toLowerCase()} side.`
      : `Classified options premium currently opposes the ${side.toLowerCase()} side; wait for that pressure to weaken or reverse.`;
  const tapeDescription = tape === "snowball"
    ? "Negative-gamma conditions reward displacement and clean continuation; do not anticipate the turn."
    : tape === "calm"
      ? "Positive-gamma conditions favour a defended level and rotation toward the next positioning concentration."
      : "Mixed gamma conditions require acceptance away from the entry zone before treating the reaction as real.";
  const permission = side === "LONG"
    ? `Price trades into ${formatLevel(level.zone[0])}-${formatLevel(level.zone[1])}; sell aggression stops making progress, buyers reclaim the upper edge, and price leaves the zone with displacement while options flow confirms or stops opposing the move.`
    : `Price trades into ${formatLevel(level.zone[0])}-${formatLevel(level.zone[1])}; buy aggression stops making progress, sellers reclaim the lower edge, and price leaves the zone with displacement while options flow confirms or stops opposing the move.`;
  const invalidation = side === "LONG"
    ? `The thesis is invalid if price accepts below ${formatLevel(selected.stop)} or bearish options pressure expands through the defence.`
    : `The thesis is invalid if price accepts above ${formatLevel(selected.stop)} or bullish options pressure expands through the rejection.`;

  return {
    side,
    quality_score: selected.qualityScore,
    quality_grade: selected.qualityScore >= 80 ? "A+" : selected.qualityScore >= 70 ? "A" : "B+",
    setup_name: `${level.name} ${side === "LONG" ? "defence" : "rejection"}`,
    zone: level.zone,
    level_name: level.name,
    level_role: level.role,
    permission,
    options_alignment: flowDescription,
    reasoning: [
      level.why,
      `${level.name} carries ${level.strength}/5 structural strength from ${level.sources.join(" + ")} evidence.`,
      characterAlignment > 0.2
        ? `Its order character supports the ${side.toLowerCase()} thesis.`
        : `Its order character is not fully aligned, so the live reaction must do more of the work.`,
      flowDescription,
      tapeDescription,
      targetDetails.length
        ? `The furthest verified pay-yourself level offers approximately 1:${selected.bestRiskReward.toFixed(2)} risk-to-reward from the conservative entry reference.`
        : "No verified pay-yourself level exists beyond this zone yet.",
    ],
    entry_reference: selected.entryReference,
    stop: selected.stop,
    targets: targetDetails.map((target) => target.price),
    target_details: targetDetails,
    best_risk_reward: selected.bestRiskReward,
    invalidation,
  };
}

export function buildGameplanPayload(
  data: OptionsFlowPayload,
  root: "NQ" | "ES",
  session: GameplanSession,
): GameplanPayload {
  const ladder = createLevelRows(data, root);
  const current = data.marketData.lastPrice;
  const snapshotAsOf = data.marketData.asOf || data.asOf;
  const { below, hinge, above } = nearestLevels(ladder, current);
  const tape = tapeFromData(data);
  const flowLean = data.environment.bullishShare === null
    ? 0
    : Math.max(-1, Math.min(1, data.environment.bullishShare * 2 - 1));
  const actualVol = data.marketMap.volatility.historicalVol21d;
  const impliedVol = data.marketMap.volatility.atmIv30d;
  const fearRatio = actualVol && impliedVol ? impliedVol / actualVol : 1;
  const zone = ladder.find((level) => level.role === "decision")?.zone
    ?? ladder.find((level) => level.role === "magnet")?.zone
    ?? [hinge, hinge] as [number, number];
  const zoneMid = (zone[0] + zone[1]) / 2;
  const targetUp = ladder.map((level) => level.zone[0]).filter((price) => price > zoneMid).sort((a, b) => a - b);
  const targetDown = ladder.map((level) => level.zone[1]).filter((price) => price < zoneMid).sort((a, b) => b - a);
  const tapePlain = tape === "calm"
    ? "CALM TAPE — moves are more likely to stall and rotate at major levels."
    : tape === "snowball"
      ? "SNOWBALL TAPE — accepted breaks can feed themselves and travel quickly."
      : "MIXED TAPE — expect rotation until price proves acceptance beyond a major level.";
  const oneLiner = tape === "snowball"
    ? `Respect acceptance outside ${formatLevel(below)}–${formatLevel(above)} and stay with the break; the trap is fading momentum before price proves it has failed.`
    : `Work the reaction between ${formatLevel(below)} and ${formatLevel(above)}, with ${formatLevel(hinge)} as the hinge; the trap is chasing inside the no-trade belly.`;

  const bellyZones = ladder
    .slice(0, -1)
    .map((level, index) => {
      const next = ladder[index + 1];
      return [next.zone[1], level.zone[0]] as [number, number];
    })
    .filter(([low, high]) => high > low && (high - low) > (root === "NQ" ? 25 : 7))
    .slice(0, 3);
  const longAPlus = aPlusSetupForSide("LONG", ladder, current, flowLean, tape, root);
  const shortAPlus = aPlusSetupForSide("SHORT", ladder, current, flowLean, tape, root);

  const weights = tape === "snowball" ? [0.28, 0.38, 0.34] : [0.48, 0.27, 0.25];
  const date = data.session.sessionDate;
  const previousDate = new Date(`${date}T12:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);

  const plan: GameplanEdition = {
    edition: {
      session,
      date,
      published_at: data.asOf,
      data_basis: `options positioning ${date}`,
      freshness_note: `Levels computed ${new Date(data.asOf).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" })} AEST; futures snapshot ${new Date(snapshotAsOf).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" })} AEST.`,
    },
    environment: {
      tape: {
        state: tape,
        flip_price: data.levels.gammaCenter === null ? null : roundToTick(data.levels.gammaCenter * (data.marketData.levelPriceScale || 1), root),
        plain: tapePlain,
      },
      fear: {
        ratio: Number.isFinite(fearRatio) ? fearRatio : 1,
        plain: actualVol && impliedVol
          ? `Options insurance is ${fearRatio.toFixed(1)}× recent realised movement. ${fearRatio > 1.25 ? "Protection is expensive, so nervous two-way trade and sharp whips are more likely." : "Insurance and realised movement are broadly aligned."}`
          : "The volatility comparison is incomplete in this snapshot, so no fear premium is being inferred.",
      },
      flow: {
        lean: flowLean,
        plain: data.environment.bullishShare === null
          ? "The session premium split is incomplete; the plan is not assigning a directional money-flow lean."
          : `${Math.round(data.environment.bullishShare * 100)}% of classified premium is bullish. ${Math.abs(flowLean) < 0.2 ? "Money flow is balanced." : flowLean > 0 ? "Calls have the stronger premium lean." : "Puts have the stronger premium lean."}`,
      },
      expiry: {
        relevant: data.levels.zeroDteAvailable,
        plain: data.levels.zeroDteAvailable
          ? "Same-day positioning is active. The closing hour can reprice quickly as expiring hedges are removed."
          : "No verified same-day expiration concentration is included in this snapshot.",
      },
    },
    one_liner: oneLiner,
    ladder,
    belly_zones: bellyZones,
    scenarios: [
      {
        name: "The Magnet Rotation",
        trigger: `Price rejects an outer level and reclaims ${formatLevel(hinge)}.`,
        path: [below, hinge, above],
        kill: `Dead if price accepts outside ${formatLevel(below)}–${formatLevel(above)}.`,
        weight: weights[0],
      },
      {
        name: "The Squeeze",
        trigger: `Only if price accepts above ${formatLevel(above)} and the first retest holds.`,
        path: [hinge, above, targetUp[0] ?? above],
        kill: `Dead if price closes back below ${formatLevel(above)}.`,
        weight: weights[1],
      },
      {
        name: "The Trapdoor",
        trigger: `Only if price accepts below ${formatLevel(below)} and failed buyers cannot reclaim it.`,
        path: [hinge, below, targetDown[0] ?? below],
        kill: `Dead if price reclaims and holds above ${formatLevel(below)}.`,
        weight: weights[2],
      },
    ],
    one_trade: {
      zone,
      long_side: longAPlus,
      short_side: shortAPlus,
      not_a_trade_if: "Neither card is permission by itself. Stand down if price churns through the location, the first reaction has already reached its pay-yourself level, options flow materially opposes the direction, or the required displacement never prints.",
    },
    receipts: {
      date: previousDate.toISOString().slice(0, 10),
      levels: [],
      one_trade_outcome: "Awaiting the verified journal grade.",
      honest_note: "No receipt has been published for the prior session yet. Kwant Desk will not manufacture a score from incomplete tape.",
    },
    downloads: {
      deepchart_xml: "",
      sierra_csv: "",
    },
  };

  return {
    instrument: root,
    source_symbol: root === "NQ" ? "NDX" : "SPX",
    current_price: current,
    status: data.errors.length || data.marketData.stale || data.marketData.fallback || data.marketData.status !== "LIVE" ? "PARTIAL" : "LIVE",
    generated_at: new Date().toISOString(),
    // Price is streamed independently. The Gameplan is a structural options
    // snapshot and should not rebuild its upstream request fan-out every five
    // seconds.
    refresh_after_ms: data.session.marketOpen ? 60_000 : 5 * 60_000,
    plan,
  };
}
