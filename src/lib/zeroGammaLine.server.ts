import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { getDatabentoBars } from "@/lib/databento";
import {
  newYorkCashCloseIso,
  type NativeGammaRoot,
} from "@/lib/databentoGamma.server";
import {
  nativeProfileFrames,
  replayWindow,
  type NativePricePoint,
} from "@/lib/gex-box/native";
import { getChartGammaLevels, getGexMapPanel } from "@/lib/quantData.server";
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

// The intraday trail derives one zero-Gamma crossing per completed
// one-minute interval-map bucket — the same surface reconstruction and
// cumulative-sign crossing GEX BOX paints as its zero-Gamma trail. This is
// what turns the chart line from straight segments between daily closes into
// a sensitive trace of where the crossing actually travelled all session.
const TRAIL_EXPOSURE_TICKER: Record<ZeroGammaLineSource, string> = {
  NQ: "NDX",
  ES: "SPX",
  NDX: "NDX",
  QQQ: "QQQ",
  SPX: "SPX",
  SPXW: "SPX",
  SPY: "SPY",
};

/**
 * How far a one-minute crossing may sit from spot before it is treated as a
 * half-built surface rather than a real flip. 2% is ~590 points on NQ and
 * ~120 on ES — wide enough for a genuine intraday migration, narrow enough
 * that a partially accumulated bucket cannot draw a spike across the pane.
 */
const ZERO_GAMMA_MAX_SPOT_DEVIATION = 0.02;

async function computeIntradayTrail(
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  date: string,
): Promise<ZeroGammaLinePoint[]> {
  const exposureSymbol = TRAIL_EXPOSURE_TICKER[sourceSymbol] ?? (root === "NQ" ? "NDX" : "SPX");
  const panel = await getGexMapPanel(exposureSymbol, "GAMMA", date);
  // Futures charts display the crossing on the futures scale. Databento 1m
  // closes over the session window give a per-minute cash→futures basis, the
  // same calibration the value-area and gamma-level projections use. Cash
  // sources keep their own option chain's scale untouched.
  let displayPoints: NativePricePoint[] = [];
  if (sourceSymbol === root) {
    const frameWindow = replayWindow(panel.frames);
    if (frameWindow) {
      const bars = await getDatabentoBars(`${root}.v.0`, "1m", frameWindow.start, frameWindow.end);
      displayPoints = bars
        .filter((bar) => Number.isFinite(bar.timestamp) && Number.isFinite(bar.close) && bar.close > 0)
        .map((bar) => ({ timestamp: bar.timestamp, price: bar.close }));
    }
  }
  const frames = nativeProfileFrames(panel, exposureSymbol, displayPoints);
  return frames.flatMap((frame): ZeroGammaLinePoint[] => {
    const value = frame.zero_gamma;
    if (value === null || !Number.isFinite(value) || !Number.isFinite(frame.timestamp)) return [];
    // Early buckets carry a partially accumulated surface whose cumulative
    // crossing lands thousands of points from price. A real zero-Gamma
    // crossing hugs the traded range, so a bucket that puts it far from spot
    // is a half-built surface, not a market event.
    //
    // The previous 10% bound was far too generous to do that job: on NQ near
    // 29,400 it admitted a crossing almost 3,000 points away, and those
    // survivors are the vertical spikes that made the line unreadable. A
    // crossing that genuinely leaves this band has left the auction, and
    // plotting it beside price would misrepresent where gamma flips.
    if (frame.strikes.length < 20) return [];
    const spot = frame.spot;
    if (
      Number.isFinite(spot)
      && spot > 0
      && Math.abs(value - spot) / spot > ZERO_GAMMA_MAX_SPOT_DEVIATION
    ) return [];
    return [{ timestampMs: frame.timestamp, sessionDate: date, value, status: "HISTORICAL" }];
  });
}

// Completed-session trails are immutable → durable cross-instance cache.
const cachedHistoricalTrail = (
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  date: string,
) => unstable_cache(
  () => computeIntradayTrail(root, sourceSymbol, date),
  ["zero-gamma-trail-v2", root, sourceSymbol, date],
  { revalidate: 6 * 60 * 60 },
)();

// The live session gains at most one new bucket per minute; a short
// process-local memo keeps a polling pane fleet from rebuilding the same
// trail on every refresh tick.
const liveTrailCache = new Map<string, { at: number; points: ZeroGammaLinePoint[] }>();
const LIVE_TRAIL_MEMO_MS = 45_000;

// A cold trail rebuilds a full interval-map panel and can outlive a request
// waiting on the centrally spaced provider queue. Never let it hold a
// response: race a short budget, and on a miss finish the SAME in-flight
// build after the response is sent (`after` keeps the invocation alive), so
// its durable cache commits and the next poll serves it instantly.
const TRAIL_BUDGET_TIMEOUT = Symbol("trail-budget-timeout");
const backgroundTrailBuilds = new Set<string>();

async function intradayTrailSafe(
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  date: string,
  completed: boolean,
  budgetMs = 12_000,
): Promise<ZeroGammaLinePoint[]> {
  const key = `${root}:${sourceSymbol}:${date}:${completed ? "h" : "l"}`;
  try {
    if (!completed) {
      const memo = liveTrailCache.get(key);
      if (memo && Date.now() - memo.at < LIVE_TRAIL_MEMO_MS) return memo.points;
    }
    const work = completed
      ? cachedHistoricalTrail(root, sourceSymbol, date)
      : computeIntradayTrail(root, sourceSymbol, date).then((points) => {
          liveTrailCache.set(key, { at: Date.now(), points });
          if (liveTrailCache.size > 64) {
            const oldest = liveTrailCache.keys().next().value;
            if (oldest !== undefined) liveTrailCache.delete(oldest);
          }
          return points;
        });
    let timer: ReturnType<typeof setTimeout> | null = null;
    const result = await Promise.race([
      work.finally(() => { if (timer !== null) clearTimeout(timer); }),
      new Promise<typeof TRAIL_BUDGET_TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TRAIL_BUDGET_TIMEOUT), budgetMs);
      }),
    ]);
    if (result !== TRAIL_BUDGET_TIMEOUT) return result;
    if (!backgroundTrailBuilds.has(key)) {
      backgroundTrailBuilds.add(key);
      after(() => work.catch(() => undefined).finally(() => backgroundTrailBuilds.delete(key)));
    }
    return [];
  } catch {
    // The session anchors below still paint; the trail heals on a later poll.
    return [];
  }
}

async function computeHistoricalPoint(
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  date: string,
): Promise<ZeroGammaLinePoint> {
  const snapshot = await getChartGammaLevels(root, sourceSymbol, date);
  const zeroGamma = zeroGammaFromPayload(snapshot);
  if (zeroGamma === null) throw new Error(`No verified ${root} zero-Gamma point for ${date}.`);
  return {
    timestampMs: Date.parse(newYorkCashCloseIso(snapshot.sessionDate)),
    sessionDate: snapshot.sessionDate,
    value: zeroGamma,
    status: "HISTORICAL",
  };
}

// The instance memo dies with every cold serverless start, and a fleet of
// polling browsers lands on many instances at once. Persist each verified
// completed-session point in the cross-instance data cache so the provider
// chain runs once per session per source across the whole deployment —
// failures throw and are never cached, so a transient gap can still heal.
const cachedHistoricalPoint = (
  root: NativeGammaRoot,
  sourceSymbol: ZeroGammaLineSource,
  date: string,
) => unstable_cache(
  () => computeHistoricalPoint(root, sourceSymbol, date),
  ["zero-gamma-point-v1", root, sourceSymbol, date],
  { revalidate: 6 * 60 * 60 },
)();

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

  const [historical, current] = await Promise.all([
    Promise.all(completedDates.map(async (date): Promise<ZeroGammaLinePoint | null> => {
      const cacheKey = `${root}:${sourceSymbol}:${date}`;
      const cached = historicalPointCache.get(cacheKey);
      if (cached) return cached;
      try {
        const point = await cachedHistoricalPoint(root, sourceSymbol, date);
        if (historicalPointCache.size >= HISTORICAL_POINT_CACHE_LIMIT) {
          const oldest = historicalPointCache.keys().next().value;
          if (oldest !== undefined) historicalPointCache.delete(oldest);
        }
        historicalPointCache.set(cacheKey, point);
        return point;
      } catch {
        return null;
      }
    })),
    getChartGammaLevels(root, sourceSymbol, sessionDate).catch(() => null),
  ]);
  const points = historical.filter((point): point is ZeroGammaLinePoint => point !== null);
  // Trails are computed sequentially and only where they pay for themselves:
  // a cold interval-map rebuild for several sessions in parallel stampedes
  // the centrally spaced provider queue and can outlive the whole request.
  // The recurring one-session poll only refreshes the live trail (memoized to
  // one rebuild a minute); the initial multi-session load also restores the
  // newest completed session's trail, whose durable cache converges even if
  // the first cold browser request times out client-side.
  if (historySessions > 1) {
    const newestCompleted = completedDates.at(-1);
    if (newestCompleted) {
      points.push(...await intradayTrailSafe(root, sourceSymbol, newestCompleted, true, 20_000));
    }
  }
  if (marketOpen) {
    // The live trace only exists while the session is producing buckets.
    const liveTrail = await intradayTrailSafe(root, sourceSymbol, sessionDate, false);
    points.push(...liveTrail.map((point) => ({ ...point, status: "LIVE" as const })));
  } else if (historySessions === 1 && completedDates.includes(sessionDate)) {
    // After the close, the one-session poll restores today's completed trace.
    points.push(...await intradayTrailSafe(root, sourceSymbol, sessionDate, true));
  }
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
    disclosure: "Zero Gamma is the verified aggregate dealer-Gamma sign crossing for the chart's own options family. The intraday trail derives one crossing per completed one-minute positioning bucket; completed-session values are never painted backward. Price above the line is the positive-Gamma environment, below is negative.",
  };
}
