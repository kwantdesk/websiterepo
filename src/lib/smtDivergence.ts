import type { Candle } from "@/lib/backtester";

export type SmtMarket = "NQ" | "ES";
export type SmtDivergenceKind = "bullish" | "bearish";

export type SmtDivergenceSettings = {
  pivotStrength: number;
  synchronizationBars: number;
  minimumSwingBars: number;
  maximumLookbackBars: number;
  minimumMoveTicks: number;
  maximumSignals: number;
  includeNonConfirmation: boolean;
  showBullish: boolean;
  showBearish: boolean;
};

export type SmtDivergenceSignal = {
  id: string;
  kind: SmtDivergenceKind;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  confirmationTime: number;
  primaryMarket: SmtMarket;
  comparisonMarket: SmtMarket;
  failedMarket: SmtMarket;
  label: string;
};

type Pivot = {
  index: number;
  timestamp: number;
  price: number;
  confirmationTime: number;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function resolveSmtMarket(instrument: string | null | undefined): SmtMarket | null {
  const normalized = String(instrument ?? "").trim().toUpperCase();
  if (/^(?:M?NQ)(?:\b|[FGHJKMNQUVXZ]\d|\.|\s|$)/.test(normalized)) return "NQ";
  if (/^(?:M?ES)(?:\b|[FGHJKMNQUVXZ]\d|\.|\s|$)/.test(normalized)) return "ES";
  return null;
}

export function comparisonSmtMarket(instrument: string | null | undefined): SmtMarket | null {
  const market = resolveSmtMarket(instrument);
  return market === "NQ" ? "ES" : market === "ES" ? "NQ" : null;
}

function normalizeCandles(candles: Candle[], maximumLookbackBars: number) {
  const byTimestamp = new Map<number, Candle>();
  for (const candle of candles) {
    if (
      !finite(candle.timestamp)
      || !finite(candle.high)
      || !finite(candle.low)
      || !finite(candle.open)
      || !finite(candle.close)
      || candle.high < candle.low
    ) continue;
    byTimestamp.set(candle.timestamp, candle);
  }
  return [...byTimestamp.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-Math.max(50, Math.round(maximumLookbackBars)));
}

function medianInterval(candles: Candle[]) {
  const intervals: number[] = [];
  for (let index = Math.max(1, candles.length - 120); index < candles.length; index += 1) {
    const interval = candles[index].timestamp - candles[index - 1].timestamp;
    if (interval > 0 && Number.isFinite(interval)) intervals.push(interval);
  }
  if (!intervals.length) return 60_000;
  intervals.sort((left, right) => left - right);
  return intervals[Math.floor(intervals.length / 2)];
}

function findPivots(candles: Candle[], kind: "high" | "low", strength: number) {
  const pivots: Pivot[] = [];
  const radius = Math.max(1, Math.round(strength));
  for (let index = radius; index < candles.length - radius; index += 1) {
    const price = kind === "high" ? candles[index].high : candles[index].low;
    let isExtreme = true;
    let strictlyExtremeOnLeft = false;
    let strictlyExtremeOnRight = false;
    for (let offset = 1; offset <= radius; offset += 1) {
      const leftPrice = kind === "high" ? candles[index - offset].high : candles[index - offset].low;
      const rightPrice = kind === "high" ? candles[index + offset].high : candles[index + offset].low;
      if (kind === "high") {
        if (leftPrice > price || rightPrice > price) isExtreme = false;
        if (price > leftPrice) strictlyExtremeOnLeft = true;
        if (price > rightPrice) strictlyExtremeOnRight = true;
      } else {
        if (leftPrice < price || rightPrice < price) isExtreme = false;
        if (price < leftPrice) strictlyExtremeOnLeft = true;
        if (price < rightPrice) strictlyExtremeOnRight = true;
      }
      if (!isExtreme) break;
    }
    if (!isExtreme || !strictlyExtremeOnLeft || !strictlyExtremeOnRight) continue;
    pivots.push({
      index,
      timestamp: candles[index].timestamp,
      price,
      confirmationTime: candles[index + radius].timestamp,
    });
  }
  return pivots;
}

function nearestPivot(pivots: Pivot[], timestamp: number, toleranceMs: number) {
  let nearest: Pivot | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const pivot of pivots) {
    const candidateDistance = Math.abs(pivot.timestamp - timestamp);
    if (candidateDistance > toleranceMs || candidateDistance >= distance) continue;
    nearest = pivot;
    distance = candidateDistance;
  }
  return nearest;
}

function direction(delta: number, threshold: number) {
  if (delta > threshold) return 1;
  if (delta < -threshold) return -1;
  return 0;
}

function buildSignalsForPivotKind(args: {
  primaryCandles: Candle[];
  comparisonCandles: Candle[];
  primaryMarket: SmtMarket;
  comparisonMarket: SmtMarket;
  kind: "high" | "low";
  tickSize: number;
  settings: SmtDivergenceSettings;
}) {
  const {
    primaryCandles,
    comparisonCandles,
    primaryMarket,
    comparisonMarket,
    kind,
    tickSize,
    settings,
  } = args;
  const primaryPivots = findPivots(primaryCandles, kind, settings.pivotStrength);
  const comparisonPivots = findPivots(comparisonCandles, kind, settings.pivotStrength);
  const interval = Math.max(medianInterval(primaryCandles), medianInterval(comparisonCandles));
  const toleranceMs = interval * Math.max(1, Math.round(settings.synchronizationBars));
  const threshold = Math.max(0, settings.minimumMoveTicks) * Math.max(0.000001, tickSize);
  const signals: SmtDivergenceSignal[] = [];

  for (let index = 1; index < primaryPivots.length; index += 1) {
    const first = primaryPivots[index - 1];
    const second = primaryPivots[index];
    if (second.index - first.index < Math.max(1, Math.round(settings.minimumSwingBars))) continue;
    const comparisonFirst = nearestPivot(comparisonPivots, first.timestamp, toleranceMs);
    const comparisonSecond = nearestPivot(comparisonPivots, second.timestamp, toleranceMs);
    if (!comparisonFirst || !comparisonSecond || comparisonSecond.index <= comparisonFirst.index) continue;

    const primaryDirection = direction(second.price - first.price, threshold);
    const comparisonDirection = direction(comparisonSecond.price - comparisonFirst.price, threshold);
    let diverged = false;
    let failedMarket: SmtMarket = comparisonMarket;
    if (kind === "high") {
      diverged = settings.includeNonConfirmation
        ? (primaryDirection === 1 && comparisonDirection <= 0)
          || (comparisonDirection === 1 && primaryDirection <= 0)
        : (primaryDirection === 1 && comparisonDirection === -1)
          || (comparisonDirection === 1 && primaryDirection === -1);
      failedMarket = primaryDirection === 1 ? comparisonMarket : primaryMarket;
    } else {
      diverged = settings.includeNonConfirmation
        ? (primaryDirection === -1 && comparisonDirection >= 0)
          || (comparisonDirection === -1 && primaryDirection >= 0)
        : (primaryDirection === -1 && comparisonDirection === 1)
          || (comparisonDirection === -1 && primaryDirection === 1);
      failedMarket = primaryDirection === -1 ? comparisonMarket : primaryMarket;
    }
    if (!diverged) continue;

    const signalKind: SmtDivergenceKind = kind === "high" ? "bearish" : "bullish";
    if ((signalKind === "bullish" && !settings.showBullish) || (signalKind === "bearish" && !settings.showBearish)) continue;
    const failedStructure = kind === "high" ? "HH" : "LL";
    signals.push({
      id: `${signalKind}-${first.timestamp}-${second.timestamp}-${comparisonFirst.timestamp}-${comparisonSecond.timestamp}`,
      kind: signalKind,
      startTime: first.timestamp,
      endTime: second.timestamp,
      startPrice: first.price,
      endPrice: second.price,
      confirmationTime: Math.max(second.confirmationTime, comparisonSecond.confirmationTime),
      primaryMarket,
      comparisonMarket,
      failedMarket,
      label: `${signalKind.toUpperCase()} DIVERGENCE · ${failedMarket} FAILED ${failedStructure}`,
    });
  }
  return signals;
}

export function calculateSmtDivergences(args: {
  primaryCandles: Candle[];
  comparisonCandles: Candle[];
  primaryMarket: SmtMarket;
  comparisonMarket: SmtMarket;
  tickSize: number;
  settings: SmtDivergenceSettings;
}) {
  const primaryCandles = normalizeCandles(args.primaryCandles, args.settings.maximumLookbackBars);
  const comparisonCandles = normalizeCandles(args.comparisonCandles, args.settings.maximumLookbackBars);
  if (primaryCandles.length < 10 || comparisonCandles.length < 10) return [];

  return [
    ...buildSignalsForPivotKind({ ...args, primaryCandles, comparisonCandles, kind: "high" }),
    ...buildSignalsForPivotKind({ ...args, primaryCandles, comparisonCandles, kind: "low" }),
  ]
    .sort((left, right) => left.confirmationTime - right.confirmationTime)
    .slice(-Math.max(1, Math.round(args.settings.maximumSignals)));
}
