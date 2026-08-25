import { exchangeMinuteOfDay } from "@/lib/exchangeClock";
import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type BigTradePrint = {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
  radius: number;
  opacity: number;
};

export type AnchoredBigTradePrint = BigTradePrint & { chartTimestamp: number };

/**
 * Reproduce the chart's unique time coordinate for event bars.
 *
 * Volume/range/tick bars can start inside the same wall-clock second. The
 * chart separates those bars by one synthetic second so Lightweight Charts
 * can retain every candle. Markers must use that same projection; using the
 * raw rounded second can otherwise attach a print to the preceding candle.
 */
export function buildEventBarChartTimeMap(
  candles: Pick<Candle, "timestamp">[],
) {
  const chartTimeBySourceTime = new Map<number, number>();
  let previousChartTime = Number.NEGATIVE_INFINITY;

  for (const candle of candles) {
    const sourceTimestamp = Number(candle.timestamp);
    const naturalTime = Math.floor(sourceTimestamp / 1_000);
    if (!Number.isFinite(sourceTimestamp) || !Number.isFinite(naturalTime)) continue;
    const chartTime = Math.max(naturalTime, previousChartTime + 1);
    previousChartTime = chartTime;
    chartTimeBySourceTime.set(sourceTimestamp, chartTime);
  }

  return chartTimeBySourceTime;
}

type BigTradeSettings = Record<string, number | string | boolean>;

type TradeCandidate = {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function quantile(sorted: number[], percentile: number) {
  if (!sorted.length) return 0;
  const position = clamp(percentile, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function tradeCandidates(
  _candles: Candle[],
  marketTrades: InstitutionalTrade[],
  cutoff: number,
  settings: BigTradeSettings,
): TradeCandidate[] {
  // This is an execution-tape study. Candle volume is never treated as one
  // large order; only real CME trade records are eligible.
  const liveCandidates: TradeCandidate[] = [];
  let monotonic = true;
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  for (const trade of marketTrades) {
    if (
      trade.flowOnly
      || trade.timestamp < cutoff
      || trade.volume <= 0
      || trade.aggressor === "UNKNOWN"
    ) continue;
    monotonic = monotonic && trade.timestamp >= previousTimestamp;
    previousTimestamp = trade.timestamp;
    liveCandidates.push({
      id: trade.eventId ?? `record-${trade.recordIndex}`,
      timestamp: trade.timestamp,
      price: trade.close,
      volume: trade.volume,
      executions: Math.max(1, trade.trades),
      side: trade.aggressor === "BUY" ? "ASK" as const : "BID" as const,
    });
  }
  if (!monotonic) liveCandidates.sort((left, right) => left.timestamp - right.timestamp);
  if (settings.enableClustering === false || liveCandidates.length < 2) {
    return liveCandidates;
  }

  const clusterWindowMs = clamp(Number(settings.clusterWindowMs ?? 100), 0, 10_000);
  const clusterPriceTicks = clamp(Number(settings.clusterPriceTicks ?? 0), 0, 100);
  const tickSize = Math.max(Number(settings.tickSize ?? 0.25), Number.EPSILON);
  const priceTolerance = clusterPriceTicks * tickSize + Number.EPSILON;
  const clustered: TradeCandidate[] = [];
  liveCandidates.forEach((candidate) => {
      const previous = clustered.at(-1);
      if (
        previous
        && previous.side === candidate.side
        && candidate.timestamp - previous.timestamp <= clusterWindowMs
        && Math.abs(candidate.price - previous.price) <= priceTolerance
      ) {
        const combinedVolume = previous.volume + candidate.volume;
        previous.price = (
          previous.price * previous.volume + candidate.price * candidate.volume
        ) / combinedVolume;
        previous.volume = combinedVolume;
        previous.executions += candidate.executions;
        previous.timestamp = candidate.timestamp;
        previous.id = `${previous.id}:${candidate.id}`;
        return;
      }
      clustered.push({ ...candidate });
    });
  return clustered;
}

// Mirrors the workspace tape's own compaction window: beyond this the retained
// history is a strongest-prints-per-minute sample, not a complete record.
const COMPLETE_TAPE_WINDOW_MS = 15 * 60_000;

/**
 * Upper bound for the manual minimum trade size, in contracts. Far above any
 * real single or clustered CME index-futures print, so the setting behaves as
 * a free numeric entry while still rejecting nonsense.
 */
export const MANUAL_FILTER_CEILING = 5_000;

/**
 * Regular trading hours for CME index futures, in exchange-local minutes.
 * Everything outside is treated as the overnight session.
 */
const RTH_OPEN_MINUTE = 8 * 60 + 30;
const RTH_CLOSE_MINUTE = 15 * 60 + 15;
const EXCHANGE_TIME_ZONE = "America/Chicago";

export function isRegularTradingHours(timestampMs: number): boolean {
  const minute = exchangeMinuteOfDay(timestampMs, EXCHANGE_TIME_ZONE);
  return minute >= RTH_OPEN_MINUTE && minute < RTH_CLOSE_MINUTE;
}

/**
 * The threshold and size scale for one session's tape.
 *
 * Overnight trades a fraction of the day session's volume, so a single
 * threshold measured across both is dominated by the day and silently raises
 * the bar overnight — the hours go bare, then the open floods. Measuring each
 * session against its own distribution is what makes a genuinely large
 * overnight print register as one.
 */
export type BigTradeSessionScale = {
  threshold: number;
  sizeFloor: number;
  visualCeiling: number;
};

export function buildSessionScale(
  sortedVolumes: number[],
  options: {
    filterMode: string;
    manualFilter: number;
    percentile: number;
    standardDevScale: number;
  },
): BigTradeSessionScale {
  if (!sortedVolumes.length) {
    return { threshold: options.manualFilter, sizeFloor: 0, visualCeiling: 1 };
  }
  const threshold = options.filterMode === "manual"
    ? options.manualFilter
    : quantile(sortedVolumes, options.percentile);
  // Marker size describes the TRADE, never the filter: the floor is always the
  // tape's own percentile so changing a manual minimum cannot re-normalise
  // every print still on screen.
  const sizeFloor = quantile(sortedVolumes, options.percentile);
  const mean = sortedVolumes.reduce((total, value) => total + value, 0) / sortedVolumes.length;
  const deviation = Math.sqrt(
    sortedVolumes.reduce((total, value) => total + (value - mean) ** 2, 0) / sortedVolumes.length,
  );
  const visualCeiling = Math.max(
    sizeFloor + 1,
    sizeFloor + deviation * options.standardDevScale,
    quantile(sortedVolumes, 0.99),
  );
  return { threshold, sizeFloor, visualCeiling };
}


export function calculateBigTradePrints(
  orderFlowCandles: Candle[],
  marketTrades: InstitutionalTrade[],
  settings: BigTradeSettings,
  now = Date.now(),
): BigTradePrint[] {
  return calculateBigTradePrintsWithContext(orderFlowCandles, marketTrades, settings, now).prints;
}

/**
 * The full pass, plus the scale it measured.
 *
 * Callers that paint a live edge keep the context so a print arriving before
 * the next full pass can be drawn straight away instead of waiting for one.
 */
export function calculateBigTradePrintsWithContext(
  orderFlowCandles: Candle[],
  marketTrades: InstitutionalTrade[],
  settings: BigTradeSettings,
  now = Date.now(),
): { prints: BigTradePrint[]; context: BigTradeLiveContext | null } {
  const daysToLoad = clamp(Number(settings.daysToLoad ?? 1), 1, 90);
  // Anchor the lookback to the newest execution we actually possess. CME is
  // closed over the weekend and on exchange holidays, so a wall-clock cutoff
  // can erase Friday's entire tape on Sunday even though it is still the most
  // recent market session. During live trading the newest execution tracks
  // `now`, while closed markets retain the final completed session.
  let latestExecutionTimestamp = 0;
  for (let index = marketTrades.length - 1; index >= 0; index -= 1) {
    const timestamp = marketTrades[index].timestamp;
    if (!Number.isFinite(timestamp)) continue;
    latestExecutionTimestamp = timestamp;
    break;
  }
  const marketTapeIsClosed = latestExecutionTimestamp > 0
    && now - latestExecutionTimestamp > 6 * 60 * 60_000;
  const historyAnchor = marketTapeIsClosed
    ? latestExecutionTimestamp
    : now;
  const cutoff = historyAnchor - daysToLoad * 86_400_000;
  const candidates = tradeCandidates(orderFlowCandles, marketTrades, cutoff, settings);
  if (!candidates.length) return { prints: [], context: null };
  // The automatic threshold must be measured against FULL-FIDELITY prints.
  // Beyond the browser's complete-tape window the retained history keeps only
  // the strongest prints per minute, so widening "Days to load" fed the
  // percentile a sample made almost entirely of large prints — the threshold
  // rocketed and nothing qualified any more, which is why raising the setting
  // made every marker disappear. Measure on the recent complete region and
  // apply that threshold across the whole window.
  const newestCandidate = candidates[candidates.length - 1]?.timestamp ?? historyAnchor;
  const completeFrom = newestCandidate - COMPLETE_TAPE_WINDOW_MS;
  const completeCandidates = candidates.filter((candidate) => candidate.timestamp >= completeFrom);
  const thresholdSample = completeCandidates.length >= 50 ? completeCandidates : candidates;
  const volumes = thresholdSample.map((candidate) => candidate.volume).sort((left, right) => left - right);
  const filterMode = String(settings.filterMode ?? "automatic");
  const intensity = String(settings.automaticIntensity ?? "medium");
  const percentileFor = (value: string) =>
    (value === "low" ? 0.8 : value === "strong" ? 0.975 : 0.9);
  const automaticPercentile = percentileFor(intensity);
  // A manual minimum is the trader's own floor and must be honoured exactly.
  // It used to be clamped to 100 contracts, so asking for 250-lot prints
  // silently kept showing 100-lot ones.
  const manualFilter = clamp(Number(settings.manualFilter ?? 30), 1, MANUAL_FILTER_CEILING);
  const standardDevScale = Math.max(0.1, Number(settings.standardDeviation ?? 1));

  // Day and overnight are measured separately unless asked otherwise.
  //
  // The overnight tape runs a fraction of the day session's volume. Measured
  // together, one threshold is set almost entirely by the day session, so the
  // overnight hours show nothing at all and then the open floods — the reading
  // is wrong at both ends of the clock. DeepChart carries a full second filter
  // for RTH for the same reason.
  const splitSessions = settings.sessionFilterEnabled !== false;
  const rthFilterMode = String(settings.rthFilterMode ?? filterMode);
  const rthManualFilter = clamp(
    Number(settings.rthManualFilter ?? manualFilter), 1, MANUAL_FILTER_CEILING,
  );
  const rthPercentile = percentileFor(String(settings.rthAutomaticIntensity ?? intensity));
  const rthStandardDevScale = Math.max(0.1, Number(settings.rthStandardDeviation ?? standardDevScale));

  // Each session gets its own complete-tape window, anchored to ITS newest
  // print rather than the tape's. The shared window spans only fifteen
  // minutes, so it belongs entirely to whichever session is trading now — a
  // combined anchor left the other session with no sample at all and silently
  // handed it the wrong scale, which is the same bug the split exists to fix.
  const sessionVolumes = (wantRth: boolean) => {
    const inSession = candidates.filter(
      (candidate) => isRegularTradingHours(candidate.timestamp) === wantRth,
    );
    if (!inSession.length) return [];
    const sessionNewest = inSession[inSession.length - 1].timestamp;
    const sessionComplete = inSession.filter(
      (candidate) => candidate.timestamp >= sessionNewest - COMPLETE_TAPE_WINDOW_MS,
    );
    const sample = sessionComplete.length >= 50 ? sessionComplete : inSession;
    return sample.map((candidate) => candidate.volume).sort((left, right) => left - right);
  };
  const overnightVolumes = splitSessions ? sessionVolumes(false) : volumes;
  const rthVolumes = splitSessions ? sessionVolumes(true) : volumes;

  // A session with too little tape to describe itself borrows the combined
  // one, so a quiet holiday session cannot produce a nonsense threshold.
  const MIN_SESSION_SAMPLE = 30;
  const baseScale = buildSessionScale(volumes, {
    filterMode, manualFilter, percentile: automaticPercentile, standardDevScale,
  });
  const overnightScale = splitSessions && overnightVolumes.length >= MIN_SESSION_SAMPLE
    ? buildSessionScale(overnightVolumes, {
        filterMode, manualFilter, percentile: automaticPercentile, standardDevScale,
      })
    : baseScale;
  const rthScale = splitSessions && rthVolumes.length >= MIN_SESSION_SAMPLE
    ? buildSessionScale(rthVolumes, {
        filterMode: rthFilterMode,
        manualFilter: rthManualFilter,
        percentile: rthPercentile,
        standardDevScale: rthStandardDevScale,
      })
    : baseScale;
  const scaleFor = (timestamp: number) => (
    splitSessions && isRegularTradingHours(timestamp) ? rthScale : overnightScale
  );

  // Capping. A single outsized print otherwise sets the top of the scale and
  // flattens every other marker toward the floor. "size" keeps the print but
  // draws it at full size; "reject" removes it from the study altogether.
  const cappingMode = String(settings.cappingMode ?? (Number(settings.maximumFilter ?? 0) > 0 ? "reject" : "off"));
  const cappingMaxVolume = Math.max(0, Number(settings.cappingMaxVolume ?? settings.maximumFilter ?? 0));
  const capActive = cappingMaxVolume > 0 && cappingMode !== "off";

  const qualified = candidates.filter((candidate) => {
    if (candidate.volume < scaleFor(candidate.timestamp).threshold) return false;
    if (capActive && cappingMode === "reject" && candidate.volume > cappingMaxVolume) return false;
    return true;
  });
  if (!qualified.length) return { prints: [], context: null };
  const minSize = clamp(Number(settings.minimumSize ?? 6), 1, 80);
  const maxSize = Math.max(minSize, clamp(Number(settings.maximumSize ?? 32), 1, 160));
  const minOpacity = clamp(Number(settings.minimumOpacity ?? 25) / 100, 0, 1);
  const maxOpacity = Math.max(minOpacity, clamp(Number(settings.maximumOpacity ?? 90) / 100, 0, 1));

  // Marker size describes the TRADE, never the filter.
  //
  // Both ends of the old scale were derived from the active threshold: the
  // floor was the threshold itself and the ceiling came from the surviving
  // prints' own spread. Raising a manual minimum therefore re-normalised
  // everything still on screen — the same 300-lot trade drew visibly smaller
  // purely because the filter had moved, which is why the setting looked like
  // it was "just shrinking the nodes" instead of filtering.
  //
  // The scale is now measured from the tape's own distribution, which does not
  // move when the trader changes the minimum. In automatic mode the floor is
  // still exactly the threshold (both are the same percentile), so that mode
  // is unchanged; in manual mode the minimum now only decides WHICH prints
  // appear, never how big they draw.

  // Keep the qualified history across the loaded chart. The former 2,500
  // tail cap made older bars lose their prints even though the execution tape
  // was present; 12,000 remains bounded while covering the adaptive top decile
  // of the retained, time-distributed execution history.
  const context: BigTradeLiveContext = {
    scaleFor,
    capActive,
    cappingMode,
    cappingMaxVolume,
    minSize,
    maxSize,
    minOpacity,
    maxOpacity,
  };
  return {
    prints: qualified.slice(-12_000).map((candidate) => sizeBigTradePrint(candidate, context)),
    context,
  };
}

/**
 * Everything needed to admit and size ONE further print without re-measuring
 * the tape.
 *
 * The distribution work - sorting volumes, quantiles, per-session scales - is
 * the expensive part of a full pass, measured at 30ms on a 20,000-print tape
 * and 198ms on 150,000. It is also stable second to second, so a print that
 * arrives between two full passes can be drawn immediately against the scale
 * the last pass established.
 */
export type BigTradeLiveContext = {
  scaleFor: (timestamp: number) => { threshold: number; sizeFloor: number; visualCeiling: number };
  capActive: boolean;
  cappingMode: string;
  cappingMaxVolume: number;
  minSize: number;
  maxSize: number;
  minOpacity: number;
  maxOpacity: number;
};

/** The one place a print's radius and opacity are decided. */
export function sizeBigTradePrint<T extends { timestamp: number; volume: number }>(
  candidate: T,
  context: BigTradeLiveContext,
): T & { radius: number; opacity: number } {
  const scale = context.scaleFor(candidate.timestamp);
  const visualRange = Math.max(1, scale.visualCeiling - scale.sizeFloor);
  // Capped prints draw at the top of the scale rather than stretching it.
  const sizingVolume = context.capActive && context.cappingMode === "size"
    ? Math.min(candidate.volume, context.cappingMaxVolume)
    : candidate.volume;
  const significance = clamp((sizingVolume - scale.sizeFloor) / visualRange, 0, 1);
  const visualWeight = Math.sqrt(significance);
  return {
    ...candidate,
    radius: context.minSize + (context.maxSize - context.minSize) * visualWeight,
    opacity: context.minOpacity + (context.maxOpacity - context.minOpacity) * visualWeight,
  };
}

/**
 * Prints that arrived since the last full pass, sized against its scale.
 *
 * A full pass costs 22ms on a 20,000-print tape and 183ms on 150,000, so it
 * cannot run at stream cadence - at 40ms those are 55% and 458% of a core.
 * The study therefore samples every 1.5s, which is why a large print could
 * sit invisible for over a second after the tape already held it.
 *
 * This is the live edge: O(new prints), no re-measuring, drawn immediately.
 * The next full pass replaces the whole set, so clustering and any scale
 * movement still settle authoritatively within the sample interval - a live
 * marker is never wrong for longer than that, and never absent in the
 * meantime.
 *
 * Deliberately does NOT cluster: clustering merges prints inside
 * clusterWindowMs, and a merge cannot be decided until that window has
 * elapsed. Drawing the print now and letting the full pass merge it is the
 * honest order; withholding it would reintroduce the delay this removes.
 */
export function admitLiveBigTradePrints(
  context: BigTradeLiveContext,
  trades: readonly InstitutionalTrade[],
  afterTimestamp: number,
): BigTradePrint[] {
  const prints: BigTradePrint[] = [];
  for (let index = trades.length - 1; index >= 0; index -= 1) {
    const trade = trades[index];
    const timestamp = Number(trade.timestamp);
    // The tape is time-ordered, so the first print at or before the watermark
    // ends the scan rather than filtering the whole array.
    if (!Number.isFinite(timestamp) || timestamp <= afterTimestamp) break;
    const volume = Math.max(0, Number(trade.volume ?? 0));
    const price = Number(trade.close);
    if (!(volume > 0) || !(price > 0)) continue;
    if (!admitsBigTrade(context, timestamp, volume)) continue;
    const askVolume = Math.max(0, Number(trade.askVolume ?? 0));
    const bidVolume = Math.max(0, Number(trade.bidVolume ?? 0));
    const side: "ASK" | "BID" = trade.aggressor === "BUY" || askVolume > bidVolume ? "ASK" : "BID";
    prints.push(sizeBigTradePrint({
      id: `live-${trade.eventId ?? `${timestamp}-${price}-${volume}`}`,
      timestamp,
      price,
      volume,
      executions: Math.max(1, Number(trade.trades ?? 1)),
      side,
    }, context));
  }
  return prints.reverse();
}

/** Whether a print qualifies, by the same rule the full pass applies. */
export function admitsBigTrade(context: BigTradeLiveContext, timestamp: number, volume: number) {
  if (volume < context.scaleFor(timestamp).threshold) return false;
  if (context.capActive && context.cappingMode === "reject" && volume > context.cappingMaxVolume) return false;
  return true;
}

/**
 * Project exact execution timestamps onto the selected chart's bars.
 *
 * This deliberately uses bar boundaries rather than a clock interval, so the
 * same 24-hour tape can be recalculated correctly for time, volume, range,
 * tick, delta-volume and Renko charts.
 */
export function anchorBigTradePrintsToCandles(
  prints: BigTradePrint[],
  candles: Candle[],
  /**
   * Bar length for CLOCK-based charts.
   *
   * Supplying it anchors by arithmetic rather than by searching the array,
   * which matters because the array a study holds is a throttled snapshot of
   * the series the chart draws. Walking a stale array pinned a print to the
   * last bar that snapshot happened to contain while the marker kept the
   * print's real price — so it drew above or below a candle it never traded
   * in, which is the marker apparently floating in space. A clock bucket
   * cannot go stale.
   *
   * Event bars (volume/range/tick/Renko) have no fixed length, so they keep
   * the array walk; their boundaries are market events, not clock time.
   */
  intervalMs?: number | null,
): AnchoredBigTradePrint[] {
  if (!candles.length || !prints.length) return [];
  const firstTimestamp = candles[0].timestamp;
  const anchored: AnchoredBigTradePrint[] = [];

  if (Number.isFinite(intervalMs) && Number(intervalMs) > 0) {
    const step = Number(intervalMs);
    // Bar phase is a property of the series, not of any one snapshot, so it is
    // safe to read from a stale array.
    const phase = ((firstTimestamp % step) + step) % step;
    for (const print of prints) {
      if (print.timestamp < firstTimestamp) continue;
      const bucket = Math.floor((print.timestamp - phase) / step) * step + phase;
      // The bucket is arithmetic and cannot go stale, so the bar is right by
      // construction. The price check still earns its place on a CLOSED bar,
      // whose high and low are final: a print outside one did not trade there
      // and something upstream is wrong.
      //
      // The newest bar is exempt. It is still filling, and its high and low
      // arrive from the same tape as the print — a moment where the print has
      // landed and the candle has not yet stretched to meet it is normal, and
      // withholding there would make markers blink on and off at the live
      // edge.
      const candle = candleAtTimestamp(candles, bucket);
      const isForming = candle !== undefined && candle.timestamp >= candles[candles.length - 1].timestamp;
      if (candle && !isForming && !printSitsInCandle(print.price, candle)) continue;
      anchored.push({ ...print, chartTimestamp: bucket });
    }
    return anchored;
  }

  let candleIndex = 0;
  for (const print of prints) {
    if (print.timestamp < firstTimestamp) continue;
    while (
      candleIndex + 1 < candles.length
      && candles[candleIndex + 1].timestamp <= print.timestamp
    ) candleIndex += 1;
    const candle = candles[candleIndex];
    // A trade happened at a price, in a bar. If the print's price is outside
    // the bar's own high and low then this is not the bar it traded in, and
    // drawing it here is the marker floating in space at a price the chart
    // never visited.
    //
    // The walk cannot tell on its own: the array a study holds is a THROTTLED
    // snapshot of the series, so on an event chart — volume, range, tick,
    // Renko, where there is no clock arithmetic to fall back on — every print
    // newer than the newest bar in that snapshot lands on it. Several prints
    // collapse onto one bar keeping their real prices, and the ones that did
    // not trade in it hang off the chart.
    //
    // Withheld rather than moved: the print is real and its price is right,
    // so the only wrong thing is the bar. The next snapshot carries the bar it
    // belongs to and it draws then.
    if (!printSitsInCandle(print.price, candle)) continue;
    anchored.push({ ...print, chartTimestamp: candle.timestamp });
  }
  return anchored;
}

/** The bar starting exactly at a timestamp, by binary search on the series. */
function candleAtTimestamp(candles: Candle[], timestamp: number): Candle | undefined {
  let low = 0;
  let high = candles.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = candles[mid].timestamp;
    if (value === timestamp) return candles[mid];
    if (value < timestamp) low = mid + 1;
    else high = mid - 1;
  }
  return undefined;
}

/**
 * Whether a print's price falls inside a bar's traded range.
 *
 * The tolerance is a thousandth of the bar's own range, which absorbs the
 * rounding in a clustered print's volume-weighted average price without
 * admitting a print from a different bar — those miss by whole handles, not
 * by a fraction of one bar's range.
 */
export function printSitsInCandle(
  price: number,
  candle: Pick<Candle, "high" | "low"> | undefined,
): boolean {
  if (!candle) return false;
  const high = Number(candle.high);
  const low = Number(candle.low);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return true;
  const tolerance = Math.max((high - low) * 0.001, Number.EPSILON);
  return price >= low - tolerance && price <= high + tolerance;
}
