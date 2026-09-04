import { exchangeClockParts } from "@/lib/exchangeClock";

/**
 * CVD Divergence detection.
 *
 * A divergence exists when the recent price extreme and the session-CVD value
 * at that extreme disagree with the previous comparable swing:
 *   bearish — price prints a higher high while CVD prints a lower high;
 *   bullish — price prints a lower low while CVD prints a higher low.
 * The signal only ever anchors on the recent live candles, and it disappears
 * the moment CVD catches up and "matches" price again (the invalidation the
 * chart shows as both reading level from a horizontal view).
 */

export type CvdCandleLike = {
  timestamp: number;
  high: number;
  low: number;
  delta?: number | null;
  askVolume?: number | null;
  bidVolume?: number | null;
};

export type CvdPoint = { time: number; value: number };

export type CvdDivergenceOptions = {
  pivotStrength?: number;
  lookbackBars?: number;
  recentBars?: number;
};

export type CvdDivergenceResult = {
  kind: "bullish" | "bearish";
  /** Chart times in seconds for both anchors. */
  fromTime: number;
  toTime: number;
  /** Wick anchors: highs for bearish, lows for bullish. */
  fromPrice: number;
  toPrice: number;
  /** Session CVD readings at the same anchors. */
  fromCvd: number;
  toCvd: number;
};

function candleDelta(candle: CvdCandleLike): number | null {
  if (Number.isFinite(Number(candle.delta))) return Number(candle.delta);
  const ask = Number(candle.askVolume);
  const bid = Number(candle.bidVolume);
  if (Number.isFinite(ask) && Number.isFinite(bid)) return ask - bid;
  return null;
}

// One shared formatter for the whole module. Constructing an
// Intl.DateTimeFormat is one of the most expensive calls in V8; building a
// fresh one per candle (thousands per live tick, per chart) was a dominant
// main-thread stall and GC-churn source behind the multi-chart freeze.
const EXCHANGE_TIME_ZONE = "America/Chicago";

/** CME futures session key: the trading day rolls at 17:00 Chicago. */
function chicagoSessionKey(timestampMs: number): string {
  // Runs per candle. The shared clock caches per minute so a full recompute
  // does not pay Intl for every bar.
  const parts = exchangeClockParts(timestampMs, EXCHANGE_TIME_ZONE);
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value));
  const date = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  if (parts.hour < 17) return date;
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Session-anchored cumulative volume delta, one point per candle. */
export function sessionCvdPoints(candles: CvdCandleLike[]): CvdPoint[] {
  const points: CvdPoint[] = [];
  let activeSession = "";
  let cumulative = 0;
  for (const candle of candles) {
    const delta = candleDelta(candle);
    if (delta === null) continue;
    const session = chicagoSessionKey(candle.timestamp);
    if (session !== activeSession) {
      activeSession = session;
      cumulative = 0;
    }
    cumulative += delta;
    points.push({ time: candle.timestamp / 1000, value: cumulative });
  }
  return points;
}

/**
 * One CVD bar: cumulative delta shaped like a candle.
 *
 * The divergence study reads the CVD's own wick extremes, so it needs the
 * bar's high and low rather than a single closing value. Sessions reset at the
 * 17:00 Chicago futures boundary, exactly as the CVD study does.
 */
export type CvdBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export function sessionCvdBars(candles: CvdCandleLike[]): CvdBar[] {
  const bars: CvdBar[] = [];
  let activeSession = "";
  let cumulative = 0;
  for (const candle of candles) {
    const delta = candleDelta(candle);
    if (delta === null) continue;
    const session = chicagoSessionKey(candle.timestamp);
    if (session !== activeSession) {
      activeSession = session;
      cumulative = 0;
    }
    const open = cumulative;
    cumulative += delta;
    bars.push({
      time: candle.timestamp / 1_000,
      open,
      // Within a bar the running total travels from open to close, so those
      // are its extremes. Intrabar excursions are not recoverable from a
      // completed candle's aggregate delta and are never invented here.
      high: Math.max(open, cumulative),
      low: Math.min(open, cumulative),
      close: cumulative,
    });
  }
  return bars;
}

/** A drawn divergence: one dotted segment across the CVD. */
export type CvdDivergenceSegment = {
  kind: "bullish" | "bearish";
  /** Which extreme the segment connects. */
  direction: "high" | "low";
  fromTime: number;
  toTime: number;
  /** CVD extremes at each anchor — where the segment is actually drawn. */
  fromCvd: number;
  toCvd: number;
  fromPrice: number;
  toPrice: number;
};

/**
 * Every divergence in the window, in time order.
 *
 * The single-result detector this replaces reported only the newest signal and
 * retracted it as soon as CVD recovered, so a completed divergence vanished
 * from the chart. A divergence is a fact about two swings that have already
 * printed: once formed it is history and stays drawn.
 *
 * Both directions are reported. Consecutive swing LOWS are compared against
 * the CVD's lows and consecutive swing HIGHS against its highs; any
 * disagreement in direction between price and CVD is a divergence, whichever
 * way round it falls.
 */
export function detectCvdDivergences(
  candles: CvdCandleLike[],
  cvdBars: CvdBar[],
  options: CvdDivergenceOptions = {},
): CvdDivergenceSegment[] {
  const pivotStrength = Math.max(1, Math.min(5, Math.round(options.pivotStrength ?? 2)));
  const lookbackBars = Math.max(20, Math.min(2_000, Math.round(options.lookbackBars ?? 300)));
  if (candles.length < pivotStrength * 2 + 2 || cvdBars.length < 2) return [];

  const cvdByTime = new Map(cvdBars.map((bar) => [bar.time, bar]));
  const window = candles.slice(Math.max(0, candles.length - lookbackBars));
  const segments: CvdDivergenceSegment[] = [];

  for (const direction of ["low", "high"] as const) {
    const pivots: Array<{ candle: CvdCandleLike; bar: CvdBar }> = [];
    for (let index = pivotStrength; index < window.length - pivotStrength; index += 1) {
      if (!isPivot(window, index, pivotStrength, direction)) continue;
      const bar = cvdByTime.get(window[index].timestamp / 1_000);
      if (!bar) continue;
      pivots.push({ candle: window[index], bar });
    }
    for (let index = 1; index < pivots.length; index += 1) {
      const previous = pivots[index - 1];
      const current = pivots[index];
      const priceFrom = direction === "high" ? previous.candle.high : previous.candle.low;
      const priceTo = direction === "high" ? current.candle.high : current.candle.low;
      const cvdFrom = direction === "high" ? previous.bar.high : previous.bar.low;
      const cvdTo = direction === "high" ? current.bar.high : current.bar.low;
      if (priceFrom === priceTo || cvdFrom === cvdTo) continue;
      const priceRose = priceTo > priceFrom;
      const cvdRose = cvdTo > cvdFrom;
      // Agreement is confirmation, not divergence.
      if (priceRose === cvdRose) continue;
      segments.push({
        // Price up while flow falls is the bearish case, and the mirror is
        // bullish — read the same way on either extreme.
        kind: priceRose ? "bearish" : "bullish",
        direction,
        fromTime: previous.bar.time,
        toTime: current.bar.time,
        fromCvd: cvdFrom,
        toCvd: cvdTo,
        fromPrice: priceFrom,
        toPrice: priceTo,
      } as CvdDivergenceSegment);
    }
  }
  return segments.sort((left, right) => left.fromTime - right.fromTime || left.toTime - right.toTime);
}

function isPivot(
  candles: CvdCandleLike[],
  index: number,
  strength: number,
  direction: "high" | "low",
): boolean {
  const value = direction === "high" ? candles[index].high : candles[index].low;
  for (let offset = 1; offset <= strength; offset += 1) {
    const before = candles[index - offset];
    const after = candles[index + offset];
    if (!before || !after) return false;
    if (direction === "high" && (before.high > value || after.high > value)) return false;
    if (direction === "low" && (before.low < value || after.low < value)) return false;
  }
  return true;
}

export function detectCvdDivergence(
  candles: CvdCandleLike[],
  cvd: CvdPoint[],
  options: CvdDivergenceOptions = {},
): CvdDivergenceResult | null {
  const pivotStrength = Math.max(1, Math.min(5, Math.round(options.pivotStrength ?? 2)));
  const lookbackBars = Math.max(20, Math.min(300, Math.round(options.lookbackBars ?? 80)));
  const recentBars = Math.max(3, Math.min(60, Math.round(options.recentBars ?? 12)));
  if (candles.length < pivotStrength * 2 + 4 || cvd.length < 4) return null;

  const cvdByTime = new Map(cvd.map((point) => [point.time, point.value]));
  const latestCvd = cvd[cvd.length - 1].value;
  const start = Math.max(0, candles.length - lookbackBars);
  const window = candles.slice(start);
  const cvdAt = (candle: CvdCandleLike) => cvdByTime.get(candle.timestamp / 1000);

  const attempt = (direction: "high" | "low"): CvdDivergenceResult | null => {
    // Anchor two: the extreme of the recent live candles.
    const recentStart = Math.max(0, window.length - recentBars);
    let recentIndex = -1;
    for (let index = recentStart; index < window.length; index += 1) {
      if (cvdAt(window[index]) === undefined) continue;
      if (recentIndex === -1) { recentIndex = index; continue; }
      const better = direction === "high"
        ? window[index].high >= window[recentIndex].high
        : window[index].low <= window[recentIndex].low;
      if (better) recentIndex = index;
    }
    if (recentIndex === -1) return null;
    const anchorTwo = window[recentIndex];
    const anchorTwoCvd = cvdAt(anchorTwo);
    if (anchorTwoCvd === undefined) return null;

    // Anchor one: the most recent completed swing before anchor two.
    for (let index = recentIndex - Math.max(2, pivotStrength); index >= pivotStrength; index -= 1) {
      if (!isPivot(window, index, pivotStrength, direction)) continue;
      const anchorOne = window[index];
      const anchorOneCvd = cvdAt(anchorOne);
      if (anchorOneCvd === undefined) continue;
      if (direction === "high") {
        const diverges = anchorTwo.high > anchorOne.high && anchorTwoCvd < anchorOneCvd;
        // Invalidated the moment CVD catches back up to the earlier swing.
        if (diverges && latestCvd < anchorOneCvd) {
          return {
            kind: "bearish",
            fromTime: anchorOne.timestamp / 1000,
            toTime: anchorTwo.timestamp / 1000,
            fromPrice: anchorOne.high,
            toPrice: anchorTwo.high,
            fromCvd: anchorOneCvd,
            toCvd: anchorTwoCvd,
          };
        }
      } else {
        const diverges = anchorTwo.low < anchorOne.low && anchorTwoCvd > anchorOneCvd;
        if (diverges && latestCvd > anchorOneCvd) {
          return {
            kind: "bullish",
            fromTime: anchorOne.timestamp / 1000,
            toTime: anchorTwo.timestamp / 1000,
            fromPrice: anchorOne.low,
            toPrice: anchorTwo.low,
            fromCvd: anchorOneCvd,
            toCvd: anchorTwoCvd,
          };
        }
      }
      return null;
    }
    return null;
  };

  const bearish = attempt("high");
  const bullish = attempt("low");
  if (bearish && bullish) return bearish.toTime >= bullish.toTime ? bearish : bullish;
  return bearish ?? bullish;
}
