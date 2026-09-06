import type { Candle } from "./backtester.ts";

export type AuctionGapCompactPriceRow = {
  tickIndex: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
};

export type AuctionGapCompactBar = {
  chartIndex: number;
  timestamp: number;
  endTime?: number;
  sourceStartTimestamp?: number;
  sourceEndTimestamp?: number;
  rows: AuctionGapCompactPriceRow[];
};

export type AuctionGapCompactRowsResult =
  | { status: "ready"; coverage: "complete"; contractSymbol: string; bars: AuctionGapCompactBar[] }
  | { status: "unavailable"; coverage: "partial"; reason: string; bars: [] };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const closeEnough = (left: number, right: number) =>
  Math.abs(left - right) <= Math.max(1e-8, Math.abs(right) * 1e-10);

/**
 * Validate the gateway's compact Auction Gap rows against the chart candles
 * that will actually be painted. This is intentionally fail-closed: a valid
 * schema or a complete coverage flag alone cannot promote rows belonging to
 * another contract, candle set, tick geometry, or source volume.
 */
export function validateAuctionGapCompactRows(
  value: unknown,
  candles: readonly Candle[],
  expectedContract: string,
  tickSize: number,
): AuctionGapCompactRowsResult {
  const fail = (reason: string): AuctionGapCompactRowsResult => ({
    status: "unavailable", coverage: "partial", reason, bars: [],
  });
  const normalizedContract = expectedContract.trim().toUpperCase();
  if (!record(value) || !normalizedContract || !finite(tickSize) || tickSize <= 0 || !candles.length) {
    return fail("invalid-source");
  }
  if (value.schemaVersion !== "kwantify-auction-gap-rows-v1" || value.provider !== "Rithmic") {
    return fail("unsupported-source-schema");
  }
  if (String(value.contractSymbol ?? "").trim().toUpperCase() !== normalizedContract) {
    return fail("contract-mismatch");
  }
  if (value.coverageComplete !== true || value.executionOrderComplete !== true) {
    return fail(typeof value.reason === "string" && value.reason ? value.reason : "historical-coverage-unproved");
  }
  if (!Array.isArray(value.rows) || value.rows.length !== candles.length) {
    return fail("bar-count-mismatch");
  }

  const bars: AuctionGapCompactBar[] = [];
  let previousTimestamp = -Infinity;
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const source = value.rows[index];
    if (!record(source) || source.chartIndex !== index || !finite(source.timestamp)
      || source.timestamp !== candle.timestamp || source.timestamp <= previousTimestamp
      || !Array.isArray(source.rows)) return fail("bar-identity-mismatch");
    previousTimestamp = source.timestamp;

    const candleValues = [candle.open, candle.high, candle.low, candle.close, candle.volume];
    if (!candleValues.every(finite)) return fail("invalid-chart-candle");
    const [open, high, low, close, volume] = candleValues as [number, number, number, number, number];
    if (volume < 0 || low > Math.min(open, close)
      || high < Math.max(open, close)) return fail("invalid-chart-candle");
    const candleTicks = [open, high, low, close]
      .map((price) => Math.round(price / tickSize));
    if (candleTicks.some((tick, offset) => !Number.isSafeInteger(tick)
      || !closeEnough(candleValues[offset] / tickSize, tick))) return fail("off-tick-chart-candle");

    const hasTimeGeometry = source.endTime !== undefined
      || source.openTick !== undefined || source.highTick !== undefined
      || source.lowTick !== undefined || source.closeTick !== undefined
      || source.volume !== undefined;
    const hasEventGeometry = source.sourceStartTimestamp !== undefined
      || source.sourceEndTimestamp !== undefined;
    if (hasTimeGeometry === hasEventGeometry) return fail("ambiguous-bar-geometry");

    let barGeometry: Omit<AuctionGapCompactBar, "chartIndex" | "timestamp" | "rows">;
    if (hasTimeGeometry) {
      if (!finite(source.endTime) || source.endTime <= source.timestamp
        || source.openTick !== candleTicks[0] || source.highTick !== candleTicks[1]
        || source.lowTick !== candleTicks[2] || source.closeTick !== candleTicks[3]
        || !finite(source.volume) || !closeEnough(source.volume, volume)) {
        return fail("time-geometry-mismatch");
      }
      barGeometry = { endTime: source.endTime };
    } else {
      if (!finite(source.sourceStartTimestamp) || !finite(source.sourceEndTimestamp)
        || source.sourceStartTimestamp > source.sourceEndTimestamp
        || source.timestamp !== source.sourceStartTimestamp) return fail("event-geometry-mismatch");
      if (finite(candle.sourceStartTimestamp)
        && candle.sourceStartTimestamp !== source.sourceStartTimestamp) return fail("event-geometry-mismatch");
      if (finite(candle.sourceEndTimestamp)
        && candle.sourceEndTimestamp !== source.sourceEndTimestamp) return fail("event-geometry-mismatch");
      barGeometry = {
        sourceStartTimestamp: source.sourceStartTimestamp,
        sourceEndTimestamp: source.sourceEndTimestamp,
      };
    }

    const rows: AuctionGapCompactPriceRow[] = [];
    let previousTick = -Infinity;
    let sourceVolume = 0;
    for (const item of source.rows) {
      if (!record(item) || !finite(item.tickIndex) || !Number.isSafeInteger(item.tickIndex)
        || item.tickIndex <= previousTick || item.tickIndex < candleTicks[2] || item.tickIndex > candleTicks[1]
        || !finite(item.bidVolume) || !finite(item.askVolume) || !finite(item.unknownVolume)
        || item.bidVolume < 0 || item.askVolume < 0 || item.unknownVolume < 0) {
        return fail("invalid-price-row");
      }
      const rowVolume = item.bidVolume + item.askVolume + item.unknownVolume;
      if (!finite(rowVolume) || rowVolume <= 0) return fail("invalid-price-row");
      previousTick = item.tickIndex;
      sourceVolume += rowVolume;
      rows.push({
        tickIndex: item.tickIndex,
        bidVolume: item.bidVolume,
        askVolume: item.askVolume,
        unknownVolume: item.unknownVolume,
      });
    }
    if (!closeEnough(sourceVolume, volume)) return fail("source-volume-mismatch");
    bars.push({ chartIndex: index, timestamp: source.timestamp, ...barGeometry, rows });
  }

  return { status: "ready", coverage: "complete", contractSymbol: normalizedContract, bars };
}

/** Recheck the smaller same-origin DTO in the browser before retaining it for
 * a pane. Provider/schema proof was consumed by the server validator above;
 * this second boundary prevents a response for an older contract or candle
 * generation being attached after a rollover or rapid timeframe switch. */
export function acceptAuctionGapCompactRows(
  value: unknown,
  candles: readonly Candle[],
  expectedContract: string,
): AuctionGapCompactRowsResult {
  const fail = (reason: string): AuctionGapCompactRowsResult => ({
    status: "unavailable", coverage: "partial", reason, bars: [],
  });
  const contract = expectedContract.trim().toUpperCase();
  if (!record(value) || value.status !== "ready" || value.coverage !== "complete"
    || String(value.contractSymbol ?? "").trim().toUpperCase() !== contract
    || !contract || !Array.isArray(value.bars) || value.bars.length !== candles.length) {
    return fail(record(value) && typeof value.reason === "string" && value.reason
      ? value.reason : "browser-history-mismatch");
  }
  const bars: AuctionGapCompactBar[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    const source = value.bars[index];
    const candle = candles[index];
    if (!record(source) || source.chartIndex !== index || source.timestamp !== candle.timestamp
      || !Array.isArray(source.rows)) return fail("browser-history-mismatch");
    const rows: AuctionGapCompactPriceRow[] = [];
    let volume = 0;
    let previousTick = -Infinity;
    for (const item of source.rows) {
      if (!record(item) || !finite(item.tickIndex) || !Number.isSafeInteger(item.tickIndex)
        || item.tickIndex <= previousTick || !finite(item.bidVolume) || !finite(item.askVolume)
        || !finite(item.unknownVolume) || item.bidVolume < 0 || item.askVolume < 0
        || item.unknownVolume < 0) return fail("browser-history-mismatch");
      previousTick = item.tickIndex;
      volume += item.bidVolume + item.askVolume + item.unknownVolume;
      rows.push({ tickIndex: item.tickIndex, bidVolume: item.bidVolume,
        askVolume: item.askVolume, unknownVolume: item.unknownVolume });
    }
    if (!finite(candle.volume) || !closeEnough(volume, candle.volume)) {
      return fail("browser-history-mismatch");
    }
    const geometry = finite(source.endTime)
      ? { endTime: source.endTime }
      : finite(source.sourceStartTimestamp) && finite(source.sourceEndTimestamp)
        ? { sourceStartTimestamp: source.sourceStartTimestamp,
            sourceEndTimestamp: source.sourceEndTimestamp }
        : null;
    if (!geometry) return fail("browser-history-mismatch");
    bars.push({ chartIndex: index, timestamp: source.timestamp as number, ...geometry, rows });
  }
  return { status: "ready", coverage: "complete", contractSymbol: contract, bars };
}
