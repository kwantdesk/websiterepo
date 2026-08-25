export const LAB_SNAPSHOT_VERSION = "kwantdesk-august-v1-lab-v1" as const;

export type LabRoot = "NQ" | "ES";
export type LabPhase = "PREOPEN" | "WAKE" | "LIVE" | "CLOSED";
export type LabMode = "FADE" | "FOLLOW" | "UNRESOLVED";
export type LabCogStatus = "LIVE" | "FROZEN" | "STALE" | "DOWN" | "NOT_REQUIRED";
export type LabGateStatus = "PASS" | "WARN" | "STOP" | "UNKNOWN";
export type LabLevelKind = "BUY" | "SELL" | "FLIP" | "TARGET" | "NO_TRADE" | "REFERENCE";

export type LabSnapshotCog = {
  id: string;
  label: string;
  status: LabCogStatus;
  source: string;
  asOf: string | null;
  detail: string;
};

export type LabSnapshotGate = {
  id: string;
  label: string;
  value: string;
  status: LabGateStatus;
  asOf: string | null;
  rule: string;
};

export type LabFilmDelta = {
  id: string;
  label: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: "CHASING_UP" | "CHASING_DOWN" | "DIVERGING" | "HOLDING" | "UNKNOWN";
  interpretation: string;
};

export type LabSnapshotLevel = {
  id: string;
  label: string;
  kind: LabLevelKind;
  low: number;
  high: number;
  strength: number;
  status: "PROVISIONAL" | "CONFIRMED" | "TESTING" | "HELD" | "BROKEN" | "INVALIDATED";
  action: string;
  invalidation: string;
  sources: string[];
  witnesses: string[];
  career: string;
};

export type LabSnapshotScenario = {
  id: string;
  name: string;
  weight: number;
  status: "WATCHING" | "ACTIVE" | "INVALIDATED" | "COMPLETE";
  trigger: string;
  path: number[];
  kill: string;
};

export type LabSnapshotUpdate = {
  id: string;
  at: string;
  kind: "PLAN" | "WAKE" | "FILM" | "LEVEL" | "REFEREE" | "RISK" | "REVIEW";
  title: string;
  body: string;
  evidence: string[];
  price: number | null;
};

export type LabSnapshot = {
  version: typeof LAB_SNAPSHOT_VERSION;
  environment: "LIVE" | "TEST";
  root: LabRoot;
  sessionDate: string;
  phase: LabPhase;
  publishedAt: string;
  updatedAt: string;
  refreshAfterMs: number;
  receipt: {
    repository: string;
    commit: string;
    artifact: string;
  };
  mode: {
    value: LabMode;
    spot: number | null;
    flip: number | null;
    asOf: string | null;
    prior: boolean;
    reason: string;
  };
  summary: {
    oneLiner: string;
    dayType: string;
    confidence: number;
    evidenceGrade: "AUDITED" | "CORE" | "PROVISIONAL" | "UNVERIFIED";
    sampleSize: number;
    killCondition: string;
  };
  film: {
    status: "READY" | "NO_FILM" | "STALE";
    asOf: string | null;
    priorAsOf: string | null;
    deltas: LabFilmDelta[];
  };
  cogs: LabSnapshotCog[];
  gates: LabSnapshotGate[];
  levels: LabSnapshotLevel[];
  scenarios: LabSnapshotScenario[];
  trade: {
    status: "ARMED" | "WAIT" | "DELETED" | "NO_TRADE";
    side: "LONG" | "SHORT" | null;
    name: string;
    zone: [number, number] | null;
    qualityGrade?: "A+" | "A" | "B+" | "WAIT";
    qualityScore?: number;
    optionsAlignment?: string;
    technicalReasoning?: string[];
    permission: string;
    entryTrigger: string;
    stop: number | null;
    coreTarget: number | null;
    runnerTarget: number | null;
    invalidation: string;
    announce: string[];
  };
  noTrade: Array<{
    id: string;
    label: string;
    low: number | null;
    high: number | null;
    reason: string;
  }>;
  updates: LabSnapshotUpdate[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, limit = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableFinite(value: unknown): value is number | null {
  return value === null || finite(value);
}

function iso(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function enumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function strings(value: unknown, limit = 12) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit)
    : [];
}

function boundedNumber(value: unknown, low: number, high: number) {
  return finite(value) ? Math.max(low, Math.min(high, value)) : null;
}

export function isLabSnapshot(value: unknown): value is LabSnapshot {
  if (!record(value)) return false;
  if (value.version !== LAB_SNAPSHOT_VERSION) return false;
  if (!enumValue(value.environment, ["LIVE", "TEST"] as const)) return false;
  if (!enumValue(value.root, ["NQ", "ES"] as const)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value.sessionDate, 10))) return false;
  if (!enumValue(value.phase, ["PREOPEN", "WAKE", "LIVE", "CLOSED"] as const)) return false;
  if (!iso(value.publishedAt) || !iso(value.updatedAt)) return false;
  if (!finite(value.refreshAfterMs) || value.refreshAfterMs < 1_000 || value.refreshAfterMs > 300_000) return false;
  if (!record(value.receipt) || !text(value.receipt.repository) || !text(value.receipt.artifact)) return false;
  if (!record(value.mode) || !enumValue(value.mode.value, ["FADE", "FOLLOW", "UNRESOLVED"] as const)) return false;
  if (!nullableFinite(value.mode.spot) || !nullableFinite(value.mode.flip)) return false;
  if (value.mode.asOf !== null && !iso(value.mode.asOf)) return false;
  if (typeof value.mode.prior !== "boolean" || !text(value.mode.reason)) return false;
  if (!record(value.summary) || !text(value.summary.oneLiner) || !text(value.summary.killCondition)) return false;
  if (!finite(value.summary.confidence) || value.summary.confidence < 0 || value.summary.confidence > 100) return false;
  if (!enumValue(value.summary.evidenceGrade, ["AUDITED", "CORE", "PROVISIONAL", "UNVERIFIED"] as const)) return false;
  if (!finite(value.summary.sampleSize) || value.summary.sampleSize < 0) return false;
  if (!record(value.film) || !enumValue(value.film.status, ["READY", "NO_FILM", "STALE"] as const)) return false;
  if (value.film.asOf !== null && !iso(value.film.asOf)) return false;
  if (value.film.priorAsOf !== null && !iso(value.film.priorAsOf)) return false;
  if (!Array.isArray(value.film.deltas) || value.film.deltas.length > 20) return false;
  if (!Array.isArray(value.cogs) || value.cogs.length > 24) return false;
  if (!Array.isArray(value.gates) || value.gates.length > 24) return false;
  if (!Array.isArray(value.levels) || value.levels.length > 80) return false;
  if (!Array.isArray(value.scenarios) || value.scenarios.length > 16) return false;
  if (!Array.isArray(value.updates) || value.updates.length > 200) return false;
  if (!Array.isArray(value.noTrade) || value.noTrade.length > 30) return false;
  if (!record(value.trade) || !enumValue(value.trade.status, ["ARMED", "WAIT", "DELETED", "NO_TRADE"] as const)) return false;
  if (value.trade.side !== null && !enumValue(value.trade.side, ["LONG", "SHORT"] as const)) return false;
  if (value.trade.zone !== null && (!Array.isArray(value.trade.zone) || value.trade.zone.length !== 2 || !value.trade.zone.every(finite))) return false;
  if (value.trade.qualityGrade !== undefined && !enumValue(value.trade.qualityGrade, ["A+", "A", "B+", "WAIT"] as const)) return false;
  if (value.trade.qualityScore !== undefined && (!finite(value.trade.qualityScore) || value.trade.qualityScore < 0 || value.trade.qualityScore > 100)) return false;
  if (value.trade.optionsAlignment !== undefined && !text(value.trade.optionsAlignment)) return false;
  if (value.trade.technicalReasoning !== undefined && (!Array.isArray(value.trade.technicalReasoning)
    || value.trade.technicalReasoning.length > 8
    || !value.trade.technicalReasoning.every((item) => Boolean(text(item))))) return false;
  if (!nullableFinite(value.trade.stop) || !nullableFinite(value.trade.coreTarget) || !nullableFinite(value.trade.runnerTarget)) return false;
  if (!Array.isArray(value.trade.announce) || !value.trade.announce.every((item) => typeof item === "string")) return false;

  return value.film.deltas.every((item) => record(item)
      && Boolean(text(item.id))
      && Boolean(text(item.label))
      && nullableFinite(item.previous)
      && nullableFinite(item.current)
      && nullableFinite(item.delta)
      && enumValue(item.direction, ["CHASING_UP", "CHASING_DOWN", "DIVERGING", "HOLDING", "UNKNOWN"] as const)
      && Boolean(text(item.interpretation)))
    && value.cogs.every((item) => record(item)
      && Boolean(text(item.id))
      && Boolean(text(item.label))
      && enumValue(item.status, ["LIVE", "FROZEN", "STALE", "DOWN", "NOT_REQUIRED"] as const)
      && Boolean(text(item.source))
      && (item.asOf === null || iso(item.asOf))
      && Boolean(text(item.detail)))
    && value.gates.every((item) => record(item)
      && Boolean(text(item.id))
      && Boolean(text(item.label))
      && enumValue(item.status, ["PASS", "WARN", "STOP", "UNKNOWN"] as const)
      && (item.asOf === null || iso(item.asOf))
      && Boolean(text(item.rule)))
    && value.levels.every((item) => record(item)
      && Boolean(text(item.id))
      && Boolean(text(item.label))
      && enumValue(item.kind, ["BUY", "SELL", "FLIP", "TARGET", "NO_TRADE", "REFERENCE"] as const)
      && finite(item.low)
      && finite(item.high)
      && item.low <= item.high
      && boundedNumber(item.strength, 0, 100) !== null
      && enumValue(item.status, ["PROVISIONAL", "CONFIRMED", "TESTING", "HELD", "BROKEN", "INVALIDATED"] as const)
      && Boolean(text(item.action))
      && Boolean(text(item.invalidation))
      && Array.isArray(item.sources)
      && Array.isArray(item.witnesses)
      && Boolean(text(item.career)))
    && value.scenarios.every((item) => record(item)
      && Boolean(text(item.id))
      && Boolean(text(item.name))
      && finite(item.weight)
      && item.weight >= 0
      && item.weight <= 100
      && enumValue(item.status, ["WATCHING", "ACTIVE", "INVALIDATED", "COMPLETE"] as const)
      && Boolean(text(item.trigger))
      && Array.isArray(item.path)
      && item.path.every(finite)
      && Boolean(text(item.kill)))
    && value.updates.every((item) => record(item)
      && Boolean(text(item.id))
      && iso(item.at)
      && enumValue(item.kind, ["PLAN", "WAKE", "FILM", "LEVEL", "REFEREE", "RISK", "REVIEW"] as const)
      && Boolean(text(item.title))
      && Boolean(text(item.body))
      && Array.isArray(item.evidence)
      && nullableFinite(item.price))
    && value.noTrade.every((item) => record(item)
      && Boolean(text(item.id))
      && Boolean(text(item.label))
      && nullableFinite(item.low)
      && nullableFinite(item.high)
      && Boolean(text(item.reason)));
}

export function parseLabSnapshot(value: unknown) {
  if (!isLabSnapshot(value)) throw new Error("The VPS repository returned an invalid August V1 Lab snapshot.");
  return value;
}

export function labSnapshotAgeMs(snapshot: LabSnapshot, now = Date.now()) {
  return Math.max(0, now - Date.parse(snapshot.updatedAt));
}

export function labSnapshotFreshness(snapshot: LabSnapshot, now = Date.now()) {
  const age = labSnapshotAgeMs(snapshot, now);
  const liveWindow = Math.max(30_000, snapshot.refreshAfterMs * 3);
  if (age <= liveWindow) return "CURRENT" as const;
  if (age <= 15 * 60_000) return "LATE" as const;
  return "STALE" as const;
}

export function clampLabRefreshMs(value: number) {
  return Math.max(5_000, Math.min(60_000, Math.round(value || 15_000)));
}

export function nextNewYorkOpen(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const base = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));

  const offsetFor = (date: Date) => {
    const zoned = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const row = Object.fromEntries(zoned.map((part) => [part.type, part.value]));
    return Date.UTC(Number(row.year), Number(row.month) - 1, Number(row.day), Number(row.hour), Number(row.minute), Number(row.second)) - date.getTime();
  };

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const localDate = new Date(base.getTime() + dayOffset * 86_400_000);
    if (localDate.getUTCDay() === 0 || localDate.getUTCDay() === 6) continue;
    const guess = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 9, 30);
    const open = new Date(guess - offsetFor(new Date(guess)));
    if (open.getTime() > now.getTime()) return open;
  }
  return new Date(now.getTime() + 24 * 60 * 60_000);
}

export function labClockPhase(now = new Date()) {
  const open = nextNewYorkOpen(new Date(now.getTime() - 8 * 60 * 60_000));
  const openMs = open.getTime();
  const nowMs = now.getTime();
  if (nowMs >= openMs && nowMs < openMs + 6.5 * 60 * 60_000) return { phase: "LIVE" as const, open };
  if (nowMs >= openMs - 30 * 60_000 && nowMs < openMs) return { phase: "PLAN_WINDOW" as const, open };
  return { phase: "PREOPEN" as const, open: nextNewYorkOpen(now) };
}

export function safeLabStrings(value: unknown, limit = 12) {
  return strings(value, limit);
}
