export type RithmicClassicCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type RithmicClassicTrade = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const ONE_MINUTE_MS = 60_000;

export function rithmicRootForGexTicker(ticker: string) {
  const normalized = ticker.trim().toUpperCase();
  if (normalized === "NQ_NDX") return "NQ";
  if (normalized === "ES_SPX") return "ES";
  return null;
}

export function rithmicContractForRoot(root: string, now = new Date()) {
  const normalized = root.trim().toUpperCase();
  if (normalized !== "NQ" && normalized !== "ES") return null;
  const currentMonth = now.getUTCMonth() + 1;
  const deliveryMonths = [3, 6, 9, 12];
  let deliveryMonth = deliveryMonths.find((month) => month >= currentMonth);
  let year = now.getUTCFullYear();
  if (!deliveryMonth) {
    deliveryMonth = 3;
    year += 1;
  }
  const monthCode = "FGHJKMNQUVXZ"[deliveryMonth - 1];
  return `${normalized}${monthCode}${String(year).slice(-1)}`;
}

/**
 * Adds one authoritative Rithmic price to a bounded one-minute OHLC buffer.
 * The array is mutated intentionally so a tick-rate stream does not allocate a
 * new 720-row history on every trade. React receives a copy at animation-frame
 * cadence from the caller.
 */
export function appendRithmicClassicTick(
  candles: RithmicClassicCandle[],
  timestamp: number,
  price: number,
  limit = 720,
) {
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(price) || price <= 0) return candles;
  const bucket = Math.floor(timestamp / ONE_MINUTE_MS) * ONE_MINUTE_MS;
  const last = candles.at(-1);

  if (!last || bucket > last.timestamp) {
    candles.push({ timestamp: bucket, open: price, high: price, low: price, close: price });
    if (candles.length > limit) candles.splice(0, candles.length - limit);
    return candles;
  }

  const candle = bucket === last.timestamp
    ? last
    : candles.find((entry) => entry.timestamp === bucket);
  if (!candle) return candles;
  candle.high = Math.max(candle.high, price);
  candle.low = Math.min(candle.low, price);
  candle.close = price;
  return candles;
}


/**
 * Applies an authoritative execution record. Historical Rithmic seeds may
 * already contain OHLC ranges, so retain the complete range instead of
 * reducing every record to its close.
 */
export function appendRithmicClassicTrade(
  candles: RithmicClassicCandle[],
  trade: RithmicClassicTrade,
  limit = 720,
) {
  const { timestamp, open, high, low, close } = trade;
  if (![timestamp, open, high, low, close].every(Number.isFinite) || timestamp <= 0 || close <= 0) return candles;
  const bucket = Math.floor(timestamp / ONE_MINUTE_MS) * ONE_MINUTE_MS;
  const last = candles.at(-1);
  if (!last || bucket > last.timestamp) {
    candles.push({
      timestamp: bucket,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
    });
    if (candles.length > limit) candles.splice(0, candles.length - limit);
    return candles;
  }
  const candle = bucket === last.timestamp
    ? last
    : candles.find((entry) => entry.timestamp === bucket);
  if (!candle) return candles;
  candle.high = Math.max(candle.high, open, high, low, close);
  candle.low = Math.min(candle.low, open, high, low, close);
  candle.close = close;
  return candles;
}

export function buildRithmicClassicCandles(
  trades: RithmicClassicTrade[],
  limit = 720,
) {
  const candles: RithmicClassicCandle[] = [];
  [...trades]
    .sort((left, right) => left.timestamp - right.timestamp)
    .forEach((trade) => appendRithmicClassicTrade(candles, trade, limit));
  return candles;
}

export function replayCandlesAtOrBefore(
  candles: RithmicClassicCandle[],
  timestamp: number,
) {
  return candles.filter((candle) => candle.timestamp <= timestamp);
}
