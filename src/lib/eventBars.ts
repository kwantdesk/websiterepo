import type { Candle } from "@/lib/backtester";
import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";

export type MarketTrade = {
  timestamp: number;
  price: number;
  size: number;
  trades?: number;
  delta?: number;
};

export type EventCandle = Candle & {
  trades?: number;
  delta?: number;
  askVolume?: number;
  bidVolume?: number;
};

type EventThreshold = {
  kind: NonNullable<ReturnType<typeof getChartInterval>>["kind"];
  value: number;
  secondary: number;
};

export function futuresTickSize(symbol: string) {
  const root = symbol.toUpperCase().split(".")[0].replace(/[FGHJKMNQUVXZ]\d{1,2}$/u, "");
  if (["ES", "MES", "NQ", "MNQ"].includes(root)) return 0.25;
  if (["YM", "MYM"].includes(root)) return 1;
  if (["RTY", "M2K"].includes(root)) return 0.1;
  if (["CL", "MCL", "RB", "HO"].includes(root)) return 0.01;
  if (root === "NG") return 0.001;
  if (["GC", "MGC", "PL"].includes(root)) return 0.1;
  if (root === "SI") return 0.005;
  if (root === "HG") return 0.0005;
  if (["ZN", "ZF"].includes(root)) return 1 / 64;
  if (["ZB", "ZT"].includes(root)) return 1 / 32;
  if (root === "10Y") return 0.001;
  if (root === "SR3") return 0.0025;
  if (["6E", "6A", "6C"].includes(root)) return 0.00005;
  if (root === "6B") return 0.0001;
  if (root === "6J") return 0.0000005;
  if (["ZC", "ZW", "ZS"].includes(root)) return 0.25;
  return 0.01;
}

function eventThreshold(timeframe: string, symbol: string): EventThreshold | null {
  const interval = getChartInterval(timeframe);
  if (!interval || !isEventBasedChartInterval(timeframe)) return null;
  if (["volume", "trade", "delta"].includes(interval.kind)) {
    return {
      kind: interval.kind,
      value: Math.max(1, interval.value),
      secondary: Math.max(1, interval.secondaryValue ?? 1),
    };
  }
  const tickSize = futuresTickSize(symbol);
  return {
    kind: interval.kind,
    value: Math.max(tickSize, interval.value * tickSize),
    secondary: Math.max(tickSize, (interval.secondaryValue ?? 1) * tickSize),
  };
}

function safeTimestamp(timestamp: number, previous?: EventCandle) {
  return previous ? Math.max(timestamp, previous.timestamp + 1) : timestamp;
}

function makeCandle(
  record: MarketTrade,
  timestamp: number,
  volume = 0,
  trades = 0,
  delta = 0,
): EventCandle {
  return {
    timestamp,
    open: record.price,
    high: record.price,
    low: record.price,
    close: record.price,
    volume,
    trades,
    delta,
    askVolume: delta > 0 ? volume : 0,
    bidVolume: delta < 0 ? volume : 0,
  };
}

function updateCandle(
  candle: EventCandle,
  price: number,
  volume: number,
  trades: number,
  delta: number,
) {
  candle.high = Math.max(candle.high, price);
  candle.low = Math.min(candle.low, price);
  candle.close = price;
  candle.volume = Math.max(0, Number(candle.volume ?? 0)) + volume;
  candle.trades = Math.max(0, Number(candle.trades ?? 0)) + trades;
  candle.delta = Number(candle.delta ?? 0) + delta;
  candle.askVolume = Math.max(0, Number(candle.askVolume ?? 0)) + (delta > 0 ? volume : 0);
  candle.bidVolume = Math.max(0, Number(candle.bidVolume ?? 0)) + (delta < 0 ? volume : 0);
}

function addThresholdTrade(
  bars: EventCandle[],
  record: MarketTrade,
  threshold: EventThreshold,
) {
  let remainingVolume = Math.max(0, Number(record.size) || 0);
  let remainingTrades = Math.max(1, Number(record.trades) || 1);
  let remainingDelta = Number(record.delta) || 0;
  const measurement = threshold.kind === "volume"
    ? () => remainingVolume
    : threshold.kind === "trade"
      ? () => remainingTrades
      : () => Math.abs(remainingDelta);

  while (measurement() > 1e-9) {
    let last = bars.at(-1);
    if (!last) {
      last = makeCandle(record, safeTimestamp(record.timestamp), 0, 0, 0);
      bars.push(last);
    }

    const current = threshold.kind === "volume"
      ? Number(last.volume ?? 0)
      : threshold.kind === "trade"
        ? Number(last.trades ?? 0)
        : Math.abs(Number(last.delta ?? 0));
    const capacity = Math.max(0, threshold.value - current);
    if (capacity <= 1e-9) {
      bars.push(makeCandle(record, safeTimestamp(record.timestamp, last), 0, 0, 0));
      continue;
    }

    const available = measurement();
    const fraction = Math.min(1, capacity / Math.max(available, 1e-9));
    const volumePart = remainingVolume * fraction;
    const tradesPart = remainingTrades * fraction;
    const deltaPart = remainingDelta * fraction;
    updateCandle(last, record.price, volumePart, tradesPart, deltaPart);
    remainingVolume = Math.max(0, remainingVolume - volumePart);
    remainingTrades = Math.max(0, remainingTrades - tradesPart);
    remainingDelta -= deltaPart;

    if (fraction >= 1 - 1e-9) break;
    bars.push(makeCandle(record, safeTimestamp(record.timestamp, last), 0, 0, 0));
  }
}

function addRangeTrade(
  bars: EventCandle[],
  record: MarketTrade,
  threshold: EventThreshold,
) {
  let last = bars.at(-1);
  if (!last) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp), record.size, record.trades ?? 1, record.delta ?? 0));
    return;
  }

  let guard = 0;
  while (guard++ < 2_000) {
    const projectedHigh = Math.max(last.high, record.price);
    const projectedLow = Math.min(last.low, record.price);
    if (projectedHigh - projectedLow < threshold.value - 1e-10) {
      updateCandle(last, record.price, record.size, record.trades ?? 1, record.delta ?? 0);
      return;
    }

    const closesUp = record.price >= last.close;
    const boundary = closesUp
      ? projectedLow + threshold.value
      : projectedHigh - threshold.value;
    updateCandle(last, boundary, record.size, record.trades ?? 1, record.delta ?? 0);
    last.close = boundary;
    last.high = Math.max(last.high, boundary);
    last.low = Math.min(last.low, boundary);

    if (Math.abs(record.price - boundary) < threshold.value - 1e-10) {
      const forming = makeCandle(
        { ...record, price: boundary },
        safeTimestamp(record.timestamp, last),
      );
      updateCandle(forming, record.price, 0, 0, 0);
      bars.push(forming);
      return;
    }
    last = makeCandle(
      { ...record, price: boundary },
      safeTimestamp(record.timestamp, last),
    );
    bars.push(last);
  }
}

function addRenkoTrade(
  bars: EventCandle[],
  record: MarketTrade,
  threshold: EventThreshold,
) {
  let forming = bars.at(-1);
  if (!forming) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp), record.size, record.trades ?? 1, record.delta ?? 0));
    return;
  }

  const distance = record.price - forming.open;
  const brickCount = Math.floor(Math.abs(distance) / threshold.value);
  if (brickCount === 0) {
    updateCandle(forming, record.price, record.size, record.trades ?? 1, record.delta ?? 0);
    return;
  }

  const direction = distance > 0 ? 1 : -1;
  const volumePart = Math.max(0, record.size) / brickCount;
  const tradesPart = Math.max(1, record.trades ?? 1) / brickCount;
  const deltaPart = (record.delta ?? 0) / brickCount;
  for (let index = 0; index < brickCount; index += 1) {
    const close = forming.open + direction * threshold.value;
    updateCandle(forming, close, volumePart, tradesPart, deltaPart);
    forming.close = close;
    forming.high = Math.max(forming.open, close);
    forming.low = Math.min(forming.open, close);
    forming = makeCandle(
      { ...record, price: close },
      safeTimestamp(record.timestamp, forming),
    );
    bars.push(forming);
  }
  updateCandle(forming, record.price, 0, 0, 0);
}

function addPointFigureTrade(
  bars: EventCandle[],
  record: MarketTrade,
  threshold: EventThreshold,
) {
  const last = bars.at(-1);
  if (!last) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp), record.size, record.trades ?? 1, record.delta ?? 0));
    return;
  }
  const direction = last.close >= last.open ? 1 : -1;
  const continuation = direction > 0
    ? record.price >= last.close + threshold.value
    : record.price <= last.close - threshold.value;
  const reversal = direction > 0
    ? record.price <= last.close - threshold.secondary
    : record.price >= last.close + threshold.secondary;
  if (!continuation && !reversal) {
    updateCandle(last, record.price, record.size, record.trades ?? 1, record.delta ?? 0);
    return;
  }
  bars.push(makeCandle(
    record,
    safeTimestamp(record.timestamp, last),
    record.size,
    record.trades ?? 1,
    record.delta ?? 0,
  ));
}

/**
 * Deterministically build non-time-based CME bars from an ordered execution
 * tape. Overflow is carried into the next bar instead of being discarded.
 */
export function applyMarketTradesToEventBars(
  current: Candle[],
  records: MarketTrade[],
  timeframe: string,
  symbol: string,
  limit = 5_000,
) {
  const threshold = eventThreshold(timeframe, symbol);
  if (!threshold || records.length === 0) return current;
  const bars = current.map((candle) => ({ ...candle })) as EventCandle[];

  for (const record of records) {
    if (!Number.isFinite(record.timestamp) || !Number.isFinite(record.price) || record.price <= 0) continue;
    if (threshold.kind === "volume" || threshold.kind === "trade" || threshold.kind === "delta") {
      addThresholdTrade(bars, record, threshold);
    } else if (threshold.kind === "renko") {
      addRenkoTrade(bars, record, threshold);
    } else if (threshold.kind === "point-figure") {
      addPointFigureTrade(bars, record, threshold);
    } else {
      addRangeTrade(bars, record, threshold);
    }
    if (bars.length > limit * 2) bars.splice(0, bars.length - limit);
  }

  return bars.slice(-Math.max(1, limit));
}
