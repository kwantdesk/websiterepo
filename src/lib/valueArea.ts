export const DEFAULT_VALUE_AREA_PERCENT = 0.7;

export type ValueAreaAccumulator = {
  tickSize: number;
  volumeByTick: Map<number, number>;
  totalVolume: number;
  priceVolume: number;
  tradeRecords: number;
  firstTradeAt: number | null;
  lastTradeAt: number | null;
};

export type ValueAreaProfile = {
  vah: number;
  val: number;
  poc: number;
  vwap: number;
  totalVolume: number;
  valueAreaVolume: number;
  valueAreaPercent: number;
  tradeRecords: number;
  priceLevels: number;
  firstTradeAt: number;
  lastTradeAt: number;
};

function finitePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function tickPrecision(tickSize: number) {
  const text = tickSize.toFixed(10).replace(/0+$/, "");
  const decimal = text.indexOf(".");
  return decimal < 0 ? 0 : text.length - decimal - 1;
}

function tickPrice(tickIndex: number, tickSize: number) {
  return Number((tickIndex * tickSize).toFixed(tickPrecision(tickSize)));
}

export function createValueAreaAccumulator(tickSize: number): ValueAreaAccumulator {
  const normalizedTickSize = finitePositive(tickSize);
  if (normalizedTickSize === null) {
    throw new Error("A positive tick size is required for a value-area profile.");
  }
  return {
    tickSize: normalizedTickSize,
    volumeByTick: new Map<number, number>(),
    totalVolume: 0,
    priceVolume: 0,
    tradeRecords: 0,
    firstTradeAt: null,
    lastTradeAt: null,
  };
}

export function addValueAreaTrade(
  accumulator: ValueAreaAccumulator,
  trade: { timestamp: number; price: number; size: number },
) {
  const timestamp = Number(trade.timestamp);
  const price = finitePositive(trade.price);
  const size = finitePositive(trade.size);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || price === null || size === null) return;

  const tickIndex = Math.round(price / accumulator.tickSize);
  accumulator.volumeByTick.set(
    tickIndex,
    (accumulator.volumeByTick.get(tickIndex) ?? 0) + size,
  );
  accumulator.totalVolume += size;
  accumulator.priceVolume += price * size;
  accumulator.tradeRecords += 1;
  accumulator.firstTradeAt = accumulator.firstTradeAt === null
    ? timestamp
    : Math.min(accumulator.firstTradeAt, timestamp);
  accumulator.lastTradeAt = accumulator.lastTradeAt === null
    ? timestamp
    : Math.max(accumulator.lastTradeAt, timestamp);
}

export function finalizeValueAreaProfile(
  accumulator: ValueAreaAccumulator,
  valueAreaPercent = DEFAULT_VALUE_AREA_PERCENT,
): ValueAreaProfile | null {
  const rows = [...accumulator.volumeByTick.entries()]
    .filter(([, volume]) => Number.isFinite(volume) && volume > 0)
    .sort(([left], [right]) => left - right);
  if (
    rows.length === 0
    || accumulator.totalVolume <= 0
    || accumulator.firstTradeAt === null
    || accumulator.lastTradeAt === null
  ) {
    return null;
  }

  const boundedPercent = Math.max(0.5, Math.min(0.95, valueAreaPercent));
  const vwap = accumulator.priceVolume / accumulator.totalVolume;
  const vwapTick = vwap / accumulator.tickSize;
  let pocIndex = 0;
  rows.forEach(([tickIndex, volume], index) => {
    const [currentTick, currentVolume] = rows[pocIndex];
    if (
      volume > currentVolume
      || (
        volume === currentVolume
        && (
          Math.abs(tickIndex - vwapTick) < Math.abs(currentTick - vwapTick)
          || (
            Math.abs(tickIndex - vwapTick) === Math.abs(currentTick - vwapTick)
            && tickIndex < currentTick
          )
        )
      )
    ) {
      pocIndex = index;
    }
  });

  const targetVolume = accumulator.totalVolume * boundedPercent;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let valueAreaVolume = rows[pocIndex][1];

  while (valueAreaVolume < targetVolume && (lowIndex > 0 || highIndex < rows.length - 1)) {
    const lowerVolume = lowIndex > 0 ? rows[lowIndex - 1][1] : Number.NEGATIVE_INFINITY;
    const upperVolume = highIndex < rows.length - 1 ? rows[highIndex + 1][1] : Number.NEGATIVE_INFINITY;

    if (lowerVolume === upperVolume && Number.isFinite(lowerVolume)) {
      lowIndex -= 1;
      highIndex += 1;
      valueAreaVolume += lowerVolume + upperVolume;
    } else if (upperVolume > lowerVolume) {
      highIndex += 1;
      valueAreaVolume += upperVolume;
    } else if (lowIndex > 0) {
      lowIndex -= 1;
      valueAreaVolume += lowerVolume;
    } else {
      highIndex += 1;
      valueAreaVolume += upperVolume;
    }
  }

  return {
    vah: tickPrice(rows[highIndex][0], accumulator.tickSize),
    val: tickPrice(rows[lowIndex][0], accumulator.tickSize),
    poc: tickPrice(rows[pocIndex][0], accumulator.tickSize),
    vwap,
    totalVolume: accumulator.totalVolume,
    valueAreaVolume,
    valueAreaPercent: valueAreaVolume / accumulator.totalVolume,
    tradeRecords: accumulator.tradeRecords,
    priceLevels: rows.length,
    firstTradeAt: accumulator.firstTradeAt,
    lastTradeAt: accumulator.lastTradeAt,
  };
}
