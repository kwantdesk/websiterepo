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

/** CME futures session key: the trading day rolls at 17:00 Chicago. */
function chicagoSessionKey(timestampMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(read("hour"));
  const date = `${read("year")}-${read("month")}-${read("day")}`;
  if (hour < 17) return date;
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
    points.push({ time: Math.floor(candle.timestamp / 1000), value: cumulative });
  }
  return points;
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
  const cvdAt = (candle: CvdCandleLike) => cvdByTime.get(Math.floor(candle.timestamp / 1000));

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
            fromTime: Math.floor(anchorOne.timestamp / 1000),
            toTime: Math.floor(anchorTwo.timestamp / 1000),
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
            fromTime: Math.floor(anchorOne.timestamp / 1000),
            toTime: Math.floor(anchorTwo.timestamp / 1000),
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
