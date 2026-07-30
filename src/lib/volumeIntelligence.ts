export type VolumeCandle = {
  timestamp: number;
  volume?: number;
};

export type VolumeSessionId = "asia" | "london" | "new-york";
export type VolumePaceLabel = "QUIET" | "LIGHT" | "NORMAL" | "ACTIVE" | "HEAVY";
export type VolumeTrend = "RISING" | "STEADY" | "EASING";

export type SessionVolumeSnapshot = {
  id: VolumeSessionId;
  label: string;
  windowLabel: string;
  active: boolean;
  averageVolume: number;
  previousVolume: number;
  currentVolume: number | null;
  projectedVolume: number | null;
  comparisonRatio: number;
  sampleCount: number;
  elapsedPercent: number | null;
};

export type VolumeIntelligenceSnapshot = {
  updatedAt: string;
  rollingWindowMinutes: number;
  rollingAverageVolume: number;
  baselineRollingAverage: number;
  paceRatio: number;
  paceScore: number;
  paceLabel: VolumePaceLabel;
  trend: VolumeTrend;
  activeSession: VolumeSessionId | null;
  activeSessionLabel: string | null;
  summary: string;
  sessions: SessionVolumeSnapshot[];
};

type SessionDefinition = {
  id: VolumeSessionId;
  label: string;
  startMinute: number;
  endMinute: number;
  windowLabel: string;
};

type SessionMembership = {
  id: VolumeSessionId;
  sessionDate: string;
  offsetMinutes: number;
  durationMinutes: number;
};

type SessionAggregate = SessionMembership & {
  key: string;
  totalVolume: number;
  bars: Array<{ offsetMinutes: number; volume: number; timestamp: number }>;
};

const ROLLING_WINDOW_MINUTES = 30;
const SESSION_SAMPLE_LIMIT = 5;

const SESSION_DEFINITIONS: SessionDefinition[] = [
  {
    id: "asia",
    label: "Asia",
    startMinute: 18 * 60,
    endMinute: 2 * 60,
    windowLabel: "18:00–02:00 ET",
  },
  {
    id: "london",
    label: "London",
    startMinute: 3 * 60,
    endMinute: 8 * 60 + 30,
    windowLabel: "03:00–08:30 ET",
  },
  {
    id: "new-york",
    label: "New York",
    startMinute: 9 * 60 + 30,
    endMinute: 16 * 60,
    windowLabel: "09:30–16:00 ET",
  },
];

const NEW_YORK_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function newYorkClock(timestamp: number) {
  const parts = Object.fromEntries(
    NEW_YORK_CLOCK
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return {
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minute: hour * 60 + minute,
  };
}

function sessionMembership(timestamp: number): SessionMembership | null {
  const clock = newYorkClock(timestamp);
  if (!clock) return null;

  for (const definition of SESSION_DEFINITIONS) {
    if (definition.startMinute > definition.endMinute) {
      const durationMinutes = 24 * 60 - definition.startMinute + definition.endMinute;
      if (clock.minute >= definition.startMinute) {
        return {
          id: definition.id,
          sessionDate: addUtcDays(clock.date, 1),
          offsetMinutes: clock.minute - definition.startMinute,
          durationMinutes,
        };
      }
      if (clock.minute < definition.endMinute) {
        return {
          id: definition.id,
          sessionDate: clock.date,
          offsetMinutes: 24 * 60 - definition.startMinute + clock.minute,
          durationMinutes,
        };
      }
      continue;
    }

    if (clock.minute >= definition.startMinute && clock.minute < definition.endMinute) {
      return {
        id: definition.id,
        sessionDate: clock.date,
        offsetMinutes: clock.minute - definition.startMinute,
        durationMinutes: definition.endMinute - definition.startMinute,
      };
    }
  }
  return null;
}

function paceLabel(ratio: number): VolumePaceLabel {
  if (ratio < 0.72) return "QUIET";
  if (ratio < 0.9) return "LIGHT";
  if (ratio < 1.15) return "NORMAL";
  if (ratio < 1.45) return "ACTIVE";
  return "HEAVY";
}

function volumeTrend(candles: Array<{ volume: number }>): VolumeTrend {
  if (candles.length < 6) return "STEADY";
  const recent = average(candles.slice(-3).map((candle) => candle.volume));
  const prior = average(candles.slice(-6, -3).map((candle) => candle.volume));
  if (prior <= 0) return "STEADY";
  const ratio = recent / prior;
  if (ratio > 1.18) return "RISING";
  if (ratio < 0.82) return "EASING";
  return "STEADY";
}

function samePhaseAverage(
  aggregates: SessionAggregate[],
  membership: SessionMembership | null,
) {
  if (!membership) return 0;
  const comparable = aggregates
    .filter((aggregate) =>
      aggregate.id === membership.id
      && aggregate.sessionDate < membership.sessionDate)
    .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate))
    .slice(0, SESSION_SAMPLE_LIMIT);
  const lowerBound = Math.max(0, membership.offsetMinutes - ROLLING_WINDOW_MINUTES);
  const samples = comparable.flatMap((aggregate) =>
    aggregate.bars
      .filter((bar) => bar.offsetMinutes > lowerBound && bar.offsetMinutes <= membership.offsetMinutes)
      .map((bar) => bar.volume));
  return average(samples);
}

function compactVolume(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}

export function calculateVolumeIntelligence(
  sourceCandles: VolumeCandle[],
  now = Date.now(),
): VolumeIntelligenceSnapshot | null {
  const candles = sourceCandles
    .map((candle) => ({
      timestamp: Number(candle.timestamp),
      volume: Math.max(0, Number(candle.volume ?? 0)),
    }))
    .filter((candle) => Number.isFinite(candle.timestamp) && candle.timestamp > 0 && candle.volume > 0)
    .sort((left, right) => left.timestamp - right.timestamp);
  if (candles.length < 12) return null;

  const aggregateMap = new Map<string, SessionAggregate>();
  for (const candle of candles) {
    const membership = sessionMembership(candle.timestamp);
    if (!membership) continue;
    const key = `${membership.id}:${membership.sessionDate}`;
    const aggregate = aggregateMap.get(key) ?? {
      ...membership,
      key,
      totalVolume: 0,
      bars: [],
    };
    aggregate.totalVolume += candle.volume;
    aggregate.bars.push({
      offsetMinutes: membership.offsetMinutes,
      volume: candle.volume,
      timestamp: candle.timestamp,
    });
    aggregateMap.set(key, aggregate);
  }

  const aggregates = [...aggregateMap.values()];
  if (!aggregates.length) return null;

  const activeMembership = sessionMembership(now);
  const activeKey = activeMembership
    ? `${activeMembership.id}:${activeMembership.sessionDate}`
    : null;
  const activeAggregate = activeKey ? aggregateMap.get(activeKey) ?? null : null;

  const latestTimestamp = candles.at(-1)?.timestamp ?? now;
  const rollingCandles = candles.filter((candle) =>
    candle.timestamp > latestTimestamp - ROLLING_WINDOW_MINUTES * 60_000
    && candle.timestamp <= latestTimestamp);
  const rollingAverageVolume = average(rollingCandles.map((candle) => candle.volume));
  const referenceMembership = activeMembership ?? sessionMembership(latestTimestamp);
  const comparableAverage = samePhaseAverage(aggregates, referenceMembership);
  const fallbackAverage = average(candles.slice(-72, -6).map((candle) => candle.volume));
  const baselineRollingAverage = comparableAverage || fallbackAverage || rollingAverageVolume;
  const paceRatio = baselineRollingAverage > 0 ? rollingAverageVolume / baselineRollingAverage : 1;
  const normalizedPaceRatio = clamp(paceRatio, 0, 3);
  const paceScore = Math.round(clamp((normalizedPaceRatio - 0.5) * 100, 0, 100));

  const sessions = SESSION_DEFINITIONS.map((definition): SessionVolumeSnapshot => {
    const currentAggregate = activeMembership?.id === definition.id ? activeAggregate : null;
    const completed = aggregates
      .filter((aggregate) =>
        aggregate.id === definition.id
        && aggregate.key !== activeKey)
      .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate))
      .slice(0, SESSION_SAMPLE_LIMIT);
    const averageVolume = average(completed.map((aggregate) => aggregate.totalVolume));
    const previousVolume = completed[0]?.totalVolume ?? 0;
    const currentVolume = currentAggregate?.totalVolume ?? null;
    const elapsedPercent = currentAggregate && activeMembership
      ? clamp(
          ((activeMembership.offsetMinutes + 5) / activeMembership.durationMinutes) * 100,
          1,
          100,
        )
      : null;
    let projectedVolume: number | null = null;
    if (currentVolume !== null && elapsedPercent !== null) {
      const elapsedRatio = elapsedPercent / 100;
      const rawProjection = currentVolume / Math.max(0.03, elapsedRatio);
      const confidence = clamp(elapsedRatio, 0.12, 0.88);
      projectedVolume = averageVolume > 0
        ? averageVolume * (1 - confidence) + rawProjection * confidence
        : rawProjection;
    }
    const comparisonVolume = projectedVolume ?? previousVolume;
    return {
      id: definition.id,
      label: definition.label,
      windowLabel: definition.windowLabel,
      active: Boolean(currentAggregate),
      averageVolume,
      previousVolume,
      currentVolume,
      projectedVolume,
      comparisonRatio: averageVolume > 0 ? comparisonVolume / averageVolume : 1,
      sampleCount: completed.length,
      elapsedPercent,
    };
  });

  const activeSession = sessions.find((session) => session.active) ?? null;
  const label = paceLabel(normalizedPaceRatio);
  const summary = activeSession?.projectedVolume
    ? `${activeSession.label} participation is ${normalizedPaceRatio.toFixed(2)}× its same-phase baseline. At the current smoothed pace, end-of-session volume projects near ${compactVolume(activeSession.projectedVolume)} contracts.`
    : `The latest 30-minute participation rate is ${normalizedPaceRatio.toFixed(2)}× its matching-session baseline. The next active session will begin with its completed-session average as the anchor.`;

  return {
    updatedAt: new Date(latestTimestamp).toISOString(),
    rollingWindowMinutes: ROLLING_WINDOW_MINUTES,
    rollingAverageVolume,
    baselineRollingAverage,
    paceRatio: normalizedPaceRatio,
    paceScore,
    paceLabel: label,
    trend: volumeTrend(rollingCandles),
    activeSession: activeSession?.id ?? null,
    activeSessionLabel: activeSession?.label ?? null,
    summary,
    sessions,
  };
}
