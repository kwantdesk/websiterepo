import type { Candle } from "@/lib/backtester";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type KwantStatsFormat = "number" | "percent" | "seconds" | "ratio";
export type KwantStatsTone = "neutral" | "positive" | "negative" | "signed";

export type KwantStatsMetric = {
  key: string;
  label: string;
  format: KwantStatsFormat;
  tone: KwantStatsTone;
  threshold: number;
};

export type KwantStatsBar = {
  time: number;
  values: Record<string, number | null>;
};

export type KwantStatsTable = {
  metrics: KwantStatsMetric[];
  bars: KwantStatsBar[];
  coloringDeviation: number;
  autoFormat: boolean;
  showHeader: boolean;
  positiveColor: string;
  negativeColor: string;
  neutralColor: string;
  textColor: string;
  headerColor: string;
};

const METRICS: Array<Omit<KwantStatsMetric, "threshold"> & { setting: string }> = [
  { key: "totalVolume", setting: "showTotalVolume", label: "VOL", format: "number", tone: "neutral" },
  { key: "bidVolume", setting: "showBidVolume", label: "BID VOL", format: "number", tone: "negative" },
  { key: "askVolume", setting: "showAskVolume", label: "ASK VOL", format: "number", tone: "positive" },
  { key: "deltaVolume", setting: "showDeltaVolume", label: "DELTA", format: "number", tone: "signed" },
  { key: "maxDeltaVolume", setting: "showMaxDeltaVolume", label: "MAX Δ VOL", format: "number", tone: "signed" },
  { key: "minDeltaVolume", setting: "showMinDeltaVolume", label: "MIN Δ VOL", format: "number", tone: "signed" },
  { key: "totalTrades", setting: "showTotalTrades", label: "TOT NT", format: "number", tone: "neutral" },
  { key: "deltaTrades", setting: "showDeltaTrades", label: "DELTA NT", format: "number", tone: "signed" },
  { key: "rangeTicks", setting: "showRangeTicks", label: "DELTA HL", format: "number", tone: "neutral" },
  { key: "deltaPercent", setting: "showDeltaPercent", label: "DELTA %", format: "percent", tone: "signed" },
  { key: "sessionCvd", setting: "showSessionCvd", label: "DELTA DLY", format: "number", tone: "signed" },
  { key: "volumePerSecond", setting: "showVolumePerSecond", label: "VOL/S", format: "number", tone: "neutral" },
  { key: "cotHigh", setting: "showCotHigh", label: "COT H", format: "number", tone: "signed" },
  { key: "cotLow", setting: "showCotLow", label: "COT L", format: "number", tone: "signed" },
  { key: "cotBar", setting: "showCotBar", label: "COT BAR", format: "number", tone: "signed" },
  { key: "durationSeconds", setting: "showDuration", label: "TIME/S", format: "seconds", tone: "neutral" },
  { key: "barRatio", setting: "showBarRatio", label: "BAR RATIO", format: "ratio", tone: "neutral" },
  { key: "highRatio", setting: "showHighRatio", label: "HIGH RATIO", format: "ratio", tone: "neutral" },
  { key: "lowRatio", setting: "showLowRatio", label: "LOW RATIO", format: "ratio", tone: "neutral" },
  { key: "totalEffort", setting: "showTotalEffort", label: "TOTAL EFF", format: "ratio", tone: "neutral" },
  { key: "deltaEffort", setting: "showDeltaEffort", label: "DELTA EFF", format: "ratio", tone: "signed" },
];

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const bool = (instance: ChartIndicatorInstance, key: string, fallback: boolean) =>
  typeof instance.settings?.[key] === "boolean" ? Boolean(instance.settings[key]) : fallback;

const text = (instance: ChartIndicatorInstance, key: string, fallback: string) =>
  typeof instance.settings?.[key] === "string" && String(instance.settings[key]).trim()
    ? String(instance.settings[key])
    : fallback;

const chicagoClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});

function sessionKey(timestamp: number, startHour: number) {
  const parts = Object.fromEntries(
    chicagoClock
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour", number>;
  const tradingDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < startHour) tradingDate.setUTCDate(tradingDate.getUTCDate() - 1);
  return tradingDate.toISOString().slice(0, 10);
}

type SequencedBarStats = {
  askTrades: number;
  bidTrades: number;
  cotHigh: number | null;
  cotLow: number | null;
  highRatio: number | null;
  lowRatio: number | null;
};

function sequenceStats(
  candles: Candle[],
  trades: InstitutionalTrade[],
  tickSize: number,
) {
  const output = new Map<number, SequencedBarStats>();
  if (!candles.length || !trades.length || tickSize <= 0) return output;
  const recordsByBar = new Map<number, InstitutionalTrade[]>();

  for (const trade of trades) {
    let low = 0;
    let high = candles.length - 1;
    let candleIndex = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candles[middle].timestamp <= trade.timestamp) {
        candleIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (candleIndex < 0) continue;
    const nextTimestamp = candles[candleIndex + 1]?.timestamp;
    if (nextTimestamp != null && trade.timestamp >= nextTimestamp) continue;
    const records = recordsByBar.get(candleIndex) ?? [];
    records.push(trade);
    recordsByBar.set(candleIndex, records);
  }

  recordsByBar.forEach((records, candleIndex) => {
    const candle = candles[candleIndex];
    const askByTick = new Map<number, number>();
    const bidByTick = new Map<number, number>();
    let askTrades = 0;
    let bidTrades = 0;
    let lastLowIndex = -1;
    let lastHighIndex = -1;
    records.forEach((record, index) => {
      const tick = Math.round(record.close / tickSize);
      askByTick.set(tick, (askByTick.get(tick) ?? 0) + Math.max(0, record.askVolume));
      bidByTick.set(tick, (bidByTick.get(tick) ?? 0) + Math.max(0, record.bidVolume));
      if (record.aggressor === "BUY") askTrades += Math.max(0, record.trades);
      if (record.aggressor === "SELL") bidTrades += Math.max(0, record.trades);
      if (record.low <= candle.low + tickSize * 0.25) lastLowIndex = index;
      if (record.high >= candle.high - tickSize * 0.25) lastHighIndex = index;
    });
    const highTick = Math.round(candle.high / tickSize);
    const lowTick = Math.round(candle.low / tickSize);
    const highAsk = askByTick.get(highTick) ?? 0;
    const previousAsk = askByTick.get(highTick - 1) ?? 0;
    const lowBid = bidByTick.get(lowTick) ?? 0;
    const previousBid = bidByTick.get(lowTick + 1) ?? 0;
    const deltaFrom = (startIndex: number) =>
      startIndex < 0
        ? null
        : records.slice(startIndex).reduce(
          (sum, record) => sum + finite(record.delta, finite(record.askVolume) - finite(record.bidVolume)),
          0,
        );
    output.set(candleIndex, {
      askTrades,
      bidTrades,
      cotHigh: deltaFrom(lastLowIndex),
      cotLow: deltaFrom(lastHighIndex),
      highRatio: highAsk > 0 ? previousAsk / highAsk : null,
      lowRatio: lowBid > 0 ? previousBid / lowBid : null,
    });
  });
  return output;
}

export function calculateKwantStats(
  candles: Candle[],
  trades: InstitutionalTrade[],
  instance: ChartIndicatorInstance,
  tickSize: number,
  colors: {
    positive: string;
    negative: string;
    neutral: string;
    text: string;
    header: string;
  },
): KwantStatsTable {
  const startHour = Math.min(23, Math.max(0, Math.round(finite(instance.settings?.sessionStartHour, 17))));
  const filterMin = Math.max(0, finite(instance.settings?.filterMin, 0));
  const filterMax = Math.max(0, finite(instance.settings?.filterMax, 0));
  const inputData = text(instance, "inputData", "Volume");
  const details = sequenceStats(candles, trades, tickSize);
  let activeSession = "";
  let sessionCvd = 0;

  const bars = candles.map((candle, index): KwantStatsBar => {
    const ask = Math.max(0, finite(candle.askVolume));
    const bid = Math.max(0, finite(candle.bidVolume));
    const hasExecutedSides = ask + bid > 0;
    const total = Math.max(0, finite(candle.volume, ask + bid));
    const delta = hasExecutedSides
      ? finite(candle.deltaClose, finite(candle.delta, ask - bid))
      : null;
    const totalTrades = Math.max(0, finite(candle.trades));
    const filterValue = inputData === "Volume" ? total : totalTrades;
    const passesFilter = filterValue >= filterMin && (filterMax === 0 || filterValue <= filterMax);
    const nextSession = sessionKey(candle.timestamp, startHour);
    if (nextSession !== activeSession) {
      activeSession = nextSession;
      sessionCvd = 0;
    }
    if (passesFilter && delta !== null) sessionCvd += delta;
    const nextTimestamp = candles[index + 1]?.timestamp;
    const previousTimestamp = candles[index - 1]?.timestamp;
    const durationSeconds = Math.max(
      0.001,
      ((nextTimestamp ?? (candle.timestamp + Math.max(1_000, candle.timestamp - (previousTimestamp ?? candle.timestamp - 60_000)))) - candle.timestamp) / 1_000,
    );
    const rangeTicks = Math.max(0, (candle.high - candle.low) / Math.max(tickSize, Number.EPSILON));
    const sequenced = details.get(index);
    const askTrades = finite(candle.askTrades, sequenced?.askTrades ?? 0);
    const bidTrades = finite(candle.bidTrades, sequenced?.bidTrades ?? 0);
    const hasTradeSides = candle.askTrades != null || candle.bidTrades != null || sequenced != null;
    const highRatio = sequenced?.highRatio ?? null;
    const lowRatio = sequenced?.lowRatio ?? null;
    const cotHigh = sequenced?.cotHigh ?? null;
    const cotLow = sequenced?.cotLow ?? null;
    const bullish = candle.close >= candle.open;

    return {
      time: candle.timestamp / 1_000,
      values: {
        totalVolume: passesFilter ? total : null,
        bidVolume: passesFilter && hasExecutedSides ? bid : null,
        askVolume: passesFilter && hasExecutedSides ? ask : null,
        deltaVolume: passesFilter ? delta : null,
        maxDeltaVolume: passesFilter && delta !== null
          ? finite(candle.deltaHigh, Math.max(0, delta))
          : null,
        minDeltaVolume: passesFilter && delta !== null
          ? finite(candle.deltaLow, Math.min(0, delta))
          : null,
        totalTrades: passesFilter ? totalTrades : null,
        deltaTrades: passesFilter && hasTradeSides ? askTrades - bidTrades : null,
        rangeTicks: passesFilter ? rangeTicks : null,
        deltaPercent: passesFilter && total > 0 && delta !== null ? delta / total * 100 : null,
        sessionCvd: passesFilter && delta !== null ? sessionCvd : null,
        volumePerSecond: passesFilter ? total / durationSeconds : null,
        cotHigh: passesFilter ? cotHigh : null,
        cotLow: passesFilter ? cotLow : null,
        cotBar: passesFilter ? (bullish ? cotHigh : cotLow) : null,
        durationSeconds: passesFilter ? durationSeconds : null,
        barRatio: passesFilter ? (bullish ? lowRatio : highRatio) : null,
        highRatio: passesFilter ? highRatio : null,
        lowRatio: passesFilter ? lowRatio : null,
        totalEffort: passesFilter && rangeTicks > 0 ? total / rangeTicks : null,
        deltaEffort: passesFilter && rangeTicks > 0 && delta !== null ? delta / rangeTicks : null,
      },
    };
  });

  const metrics = METRICS
    .filter((metric) => bool(instance, metric.setting, true))
    .map((metric) => ({
      key: metric.key,
      label: metric.label,
      format: metric.format,
      tone: metric.tone,
      threshold: Math.max(0, finite(instance.settings?.[`${metric.key}Threshold`], 0)),
    }));
  if (bool(instance, "invertRows", false)) metrics.reverse();
  const useThemeColors = bool(instance, "useThemeColors", true);
  return {
    metrics,
    bars,
    coloringDeviation: Math.max(0.1, finite(instance.settings?.coloringDeviation, 2)),
    autoFormat: bool(instance, "autoFormat", true),
    showHeader: bool(instance, "showHeader", true),
    positiveColor: useThemeColors ? colors.positive : text(instance, "positiveColor", colors.positive),
    negativeColor: useThemeColors ? colors.negative : text(instance, "negativeColor", colors.negative),
    neutralColor: useThemeColors ? colors.neutral : text(instance, "neutralColor", colors.neutral),
    textColor: useThemeColors ? colors.text : text(instance, "textColor", colors.text),
    headerColor: useThemeColors ? colors.header : text(instance, "headerColor", colors.header),
  };
}
