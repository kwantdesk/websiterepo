import type { Candle } from "./backtester.ts";
import type { InstitutionalTrade } from "./institutionalMarketData.ts";

export type FootprintImbalanceMode = "diagonal" | "horizontal" | "delta-percent";

export type FootprintBuildSettings = {
  tickSize: number;
  groupTicks: number;
  minimumTradeVolume: number;
  maximumTradeVolume: number;
  imbalanceMode: FootprintImbalanceMode;
  minimumImbalancePercent: number;
  minimumDelta: number;
  includeZero: boolean;
};

export type FootprintRow = {
  price: number;
  bidVolume: number;
  askVolume: number;
  bidTrades: number;
  askTrades: number;
  volume: number;
  delta: number;
  bidImbalance: boolean;
  askImbalance: boolean;
};

export type FootprintBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  rows: FootprintRow[];
  bidVolume: number;
  askVolume: number;
  volume: number;
  delta: number;
  trades: number;
  pocPrice: number | null;
  deltaPocPrice: number | null;
  vah: number | null;
  val: number | null;
  hasPriceLevelFlow: boolean;
};

type MutableFootprintRow = Omit<FootprintRow, "bidImbalance" | "askImbalance">;

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function lowerBoundCandle(candles: Candle[], timestamp: number) {
  let low = 0;
  let high = candles.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (candles[middle].timestamp <= timestamp) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function sideTrades(record: InstitutionalTrade, bid: number, ask: number) {
  const trades = Math.max(1, finite(record.trades, 1));
  const total = bid + ask;
  if (total <= 0) return { bidTrades: 0, askTrades: 0 };
  if (bid <= 0) return { bidTrades: 0, askTrades: trades };
  if (ask <= 0) return { bidTrades: trades, askTrades: 0 };
  const askTrades = trades * ask / total;
  return { bidTrades: trades - askTrades, askTrades };
}

function imbalancePass(numerator: number, denominator: number, percent: number, minimumDelta: number, includeZero: boolean) {
  if (numerator - denominator < minimumDelta) return false;
  if (denominator <= 0) return includeZero && numerator > 0;
  return numerator / denominator * 100 >= percent;
}

function footprintValueArea(rows: MutableFootprintRow[]) {
  if (!rows.length) return { pocPrice: null, vah: null, val: null };
  const total = rows.reduce((sum, row) => sum + row.volume, 0);
  if (total <= 0) return { pocPrice: null, vah: null, val: null };
  let pocIndex = 0;
  rows.forEach((row, index) => {
    if (row.volume > rows[pocIndex].volume) pocIndex = index;
  });
  const target = total * 0.7;
  let included = rows[pocIndex].volume;
  let low = pocIndex;
  let high = pocIndex;
  while (included < target && (low > 0 || high < rows.length - 1)) {
    const below = low > 0 ? rows[low - 1].volume : -1;
    const above = high < rows.length - 1 ? rows[high + 1].volume : -1;
    if (above >= below && high < rows.length - 1) {
      high += 1;
      included += rows[high].volume;
    } else if (low > 0) {
      low -= 1;
      included += rows[low].volume;
    }
  }
  return {
    pocPrice: rows[pocIndex].price,
    vah: rows[high].price,
    val: rows[low].price,
  };
}

export function buildFootprintBars(
  candles: Candle[],
  records: InstitutionalTrade[],
  settings: FootprintBuildSettings,
): FootprintBar[] {
  if (!candles.length) return [];
  const tickSize = Math.max(0.000001, finite(settings.tickSize, 0.25));
  const groupTicks = Math.max(1, Math.round(finite(settings.groupTicks, 1)));
  const rowSize = tickSize * groupTicks;
  const minimum = Math.max(0, finite(settings.minimumTradeVolume));
  const maximum = Math.max(0, finite(settings.maximumTradeVolume));
  const rowsByBar = candles.map(() => new Map<number, MutableFootprintRow>());

  const ordered = [...records].sort((left, right) =>
    left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
  for (const record of ordered) {
    const volume = Math.max(0, finite(record.volume, finite(record.askVolume) + finite(record.bidVolume)));
    if (volume <= 0 || volume < minimum || (maximum > 0 && volume > maximum)) continue;
    const candleIndex = lowerBoundCandle(candles, record.timestamp);
    if (candleIndex < 0) continue;
    const nextTimestamp = candles[candleIndex + 1]?.timestamp;
    if (nextTimestamp !== undefined && record.timestamp >= nextTimestamp) continue;
    const rawPrice = finite(record.close, finite(record.open));
    if (rawPrice <= 0) continue;
    const rowTick = Math.round(rawPrice / rowSize);
    const price = rowTick * rowSize;
    let askVolume = Math.max(0, finite(record.askVolume));
    let bidVolume = Math.max(0, finite(record.bidVolume));
    if (askVolume + bidVolume <= 0) {
      if (record.aggressor === "BUY") askVolume = volume;
      else if (record.aggressor === "SELL") bidVolume = volume;
      else continue;
    }
    const { bidTrades, askTrades } = sideTrades(record, bidVolume, askVolume);
    const current = rowsByBar[candleIndex].get(rowTick) ?? {
      price,
      bidVolume: 0,
      askVolume: 0,
      bidTrades: 0,
      askTrades: 0,
      volume: 0,
      delta: 0,
    };
    current.bidVolume += bidVolume;
    current.askVolume += askVolume;
    current.bidTrades += bidTrades;
    current.askTrades += askTrades;
    current.volume = current.bidVolume + current.askVolume;
    current.delta = current.askVolume - current.bidVolume;
    rowsByBar[candleIndex].set(rowTick, current);
  }

  return candles.map((candle, candleIndex) => {
    const rows = [...rowsByBar[candleIndex].values()].sort((left, right) => left.price - right.price);
    const byPriceTick = new Map(rows.map((row) => [Math.round(row.price / rowSize), row]));
    const threshold = Math.max(100, finite(settings.minimumImbalancePercent, 300));
    const minimumDelta = Math.max(0, finite(settings.minimumDelta, 10));
    const finalRows = rows.map((row): FootprintRow => {
      const tick = Math.round(row.price / rowSize);
      if (settings.imbalanceMode === "delta-percent") {
        const deltaPercent = row.volume > 0 ? row.delta / row.volume * 100 : 0;
        return {
          ...row,
          askImbalance: deltaPercent >= threshold / 10 && row.delta >= minimumDelta,
          bidImbalance: deltaPercent <= -threshold / 10 && -row.delta >= minimumDelta,
        };
      }
      const askComparison = settings.imbalanceMode === "diagonal"
        ? byPriceTick.get(tick - 1)?.bidVolume ?? 0
        : row.bidVolume;
      const bidComparison = settings.imbalanceMode === "diagonal"
        ? byPriceTick.get(tick + 1)?.askVolume ?? 0
        : row.askVolume;
      return {
        ...row,
        askImbalance: imbalancePass(
          row.askVolume,
          askComparison,
          threshold,
          minimumDelta,
          settings.includeZero,
        ),
        bidImbalance: imbalancePass(
          row.bidVolume,
          bidComparison,
          threshold,
          minimumDelta,
          settings.includeZero,
        ),
      };
    });
    const bidVolume = finalRows.reduce((sum, row) => sum + row.bidVolume, 0);
    const askVolume = finalRows.reduce((sum, row) => sum + row.askVolume, 0);
    const trades = finalRows.reduce((sum, row) => sum + row.bidTrades + row.askTrades, 0);
    const { pocPrice, vah, val } = footprintValueArea(rows);
    const deltaPoc = finalRows.reduce<FootprintRow | null>((best, row) =>
      !best || Math.abs(row.delta) > Math.abs(best.delta) ? row : best, null);
    return {
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      rows: finalRows,
      bidVolume,
      askVolume,
      volume: bidVolume + askVolume,
      delta: askVolume - bidVolume,
      trades,
      pocPrice,
      deltaPocPrice: deltaPoc?.price ?? null,
      vah,
      val,
      hasPriceLevelFlow: finalRows.length > 0,
    };
  });
}

export function formatFootprintValue(value: number, format: "automatic" | "normal" | "thousands") {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  if (format === "normal") return rounded.toLocaleString("en-US");
  if (format === "thousands" || (format === "automatic" && Math.abs(value) >= 10_000)) {
    return `${(value / 1_000).toFixed(Math.abs(value) >= 100_000 ? 0 : 1)}K`;
  }
  return rounded.toLocaleString("en-US");
}
