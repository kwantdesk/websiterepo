import {
  newYorkCashCloseIso,
  type NativeGammaRoot,
} from "@/lib/databentoGamma.server";
import { getChartGammaLevels } from "@/lib/quantData.server";
import type { ZeroGammaLinePayload, ZeroGammaLinePoint, ZeroGammaLineSource } from "@/lib/zeroGammaLine";

function previousTradingDay(sessionDate: string) {
  const value = new Date(`${sessionDate}T12:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function currentNewYorkSessionDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  let value = `${parts.year}-${parts.month}-${parts.day}`;
  if (parts.weekday === "Sun") value = previousTradingDay(value);
  if (parts.weekday === "Sat") value = previousTradingDay(value);
  return value;
}

function newYorkClockParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    weekday: String(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function newYorkMarketOpen(now = new Date()) {
  const clock = newYorkClockParts(now);
  return !["Sat", "Sun"].includes(clock.weekday) && clock.minutes >= 570 && clock.minutes < 960;
}

/**
 * Today only counts as a completed session after the 16:00 New York close.
 * Before the open, the newest completed session is the previous trading day —
 * starting the history at today's untraded date made a one-session request
 * return nothing at all overnight.
 */
function newYorkSessionCompleted(now = new Date()) {
  const clock = newYorkClockParts(now);
  return !["Sat", "Sun"].includes(clock.weekday) && clock.minutes >= 960;
}

function zeroGammaFromPayload(payload: Awaited<ReturnType<typeof getChartGammaLevels>>) {
  const source = payload.sources.find((candidate) => candidate.symbol === payload.requestedSource);
  if (!source) return null;
  const candidate = source.cage?.flip
    ?? source.levels.find((level) => level.kind === "ZERO_GAMMA")?.price
    ?? null;
  if (candidate === null || !Number.isFinite(candidate)) return null;
  // A zero-gamma crossing sits near the session's own trading range. An
  // observation far outside it is a broken or mis-scaled provider value, and
  // painting it would drag the line thousands of points off the chart —
  // drop the observation instead.
  const spot = source.stockPrice;
  if (Number.isFinite(spot) && spot > 0 && Math.abs(candidate - spot) / spot > 0.25) return null;
  return candidate;
}

// Completed sessions are immutable, so their derived zero-Gamma points are
// memoized for the life of the server instance. A cold five-session request
// previously recomputed every session through the provider chain and could
// outlive the browser's timeout, which left the chart line permanently blank.
const historicalPointCache = new Map<string, ZeroGammaLinePoint>();
const HISTORICAL_POINT_CACHE_LIMIT = 400;

export async function getZeroGammaLinePayload(
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  displayInstrument: string,
  historySessions = 5,
): Promise<ZeroGammaLinePayload> {
  const now = new Date();
  const sessionDate = currentNewYorkSessionDate(now);
  const marketOpen = newYorkMarketOpen(now);
  const completedDates: string[] = [];
  let cursor = newYorkSessionCompleted(now) ? sessionDate : previousTradingDay(sessionDate);
  while (completedDates.length < Math.max(1, Math.min(5, Math.round(historySessions)))) {
    completedDates.unshift(cursor);
    cursor = previousTradingDay(cursor);
  }

  const historical = await Promise.all(completedDates.map(async (date): Promise<ZeroGammaLinePoint | null> => {
    const cacheKey = `${root}:${sourceSymbol}:${date}`;
    const cached = historicalPointCache.get(cacheKey);
    if (cached) return cached;
    try {
      const snapshot = await getChartGammaLevels(root, sourceSymbol, date);
      const zeroGamma = zeroGammaFromPayload(snapshot);
      if (zeroGamma === null) return null;
      const point: ZeroGammaLinePoint = {
        timestampMs: Date.parse(newYorkCashCloseIso(snapshot.sessionDate)),
        sessionDate: snapshot.sessionDate,
        value: zeroGamma,
        status: "HISTORICAL",
      };
      if (historicalPointCache.size >= HISTORICAL_POINT_CACHE_LIMIT) {
        const oldest = historicalPointCache.keys().next().value;
        if (oldest !== undefined) historicalPointCache.delete(oldest);
      }
      historicalPointCache.set(cacheKey, point);
      return point;
    } catch {
      return null;
    }
  }));

  const current = await getChartGammaLevels(root, sourceSymbol, sessionDate).catch(() => null);
  const points = historical.filter((point): point is ZeroGammaLinePoint => point !== null);
  const currentZeroGamma = current ? zeroGammaFromPayload(current) : null;
  if (current && currentZeroGamma !== null) {
    points.push({
      timestampMs: marketOpen ? now.getTime() : Date.parse(newYorkCashCloseIso(current.sessionDate)),
      sessionDate: current.sessionDate,
      value: currentZeroGamma,
      status: marketOpen ? "LIVE" : "EOD",
    });
  }

  const deduplicated = [...new Map(points.map((point) => [`${point.timestampMs}:${point.sessionDate}`, point])).values()]
    .sort((left, right) => left.timestampMs - right.timestampMs);
  if (!deduplicated.length) throw new Error(`No verified ${root} zero-Gamma snapshots are currently available.`);
  return {
    root,
    sourceSymbol,
    displayInstrument,
    asOf: now.toISOString(),
    status: marketOpen ? "LIVE" : "EOD",
    positiveAbove: current?.environment.gammaRegime === "POSITIVE"
      ? true
      : current?.environment.gammaRegime === "NEGATIVE"
        ? false
        : null,
    points: deduplicated,
    method: sourceSymbol === root ? "TRUE_OI_SCENARIO" : "OPTIONS_GAMMA_CROSSING",
    disclosure: "Zero Gamma is the verified aggregate dealer-Gamma sign crossing for the chart's own options family. Each observation paints forward from its timestamp like a running VWAP; completed-session values are never painted backward.",
  };
}
