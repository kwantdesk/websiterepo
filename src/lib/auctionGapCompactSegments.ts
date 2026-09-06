import type { Candle } from "./backtester.ts";
import type {
  AuctionGapCompactBar,
  AuctionGapCompactPriceRow,
  AuctionGapCompactRowsResult,
  AuctionGapCompactSlice,
} from "./auctionGapCompactRows.ts";
import type { AuctionGapSourceBar } from "./auctionGapLifecycle.ts";
import { AuctionGapSessionClock, type AuctionGapCalendar, type AuctionGapTimeSettings } from "./auctionGapSessionClock.ts";

export type AuctionGapCompactSegmentResult =
  | { status: "ready"; segments: AuctionGapSourceBar[] }
  | { status: "unavailable"; reason: string; segments: [] };

function mergeRows(target: Map<number, AuctionGapCompactPriceRow>, rows: readonly AuctionGapCompactPriceRow[]) {
  for (const row of rows) {
    const total = target.get(row.tickIndex) ?? {
      tickIndex: row.tickIndex, bidVolume: 0, askVolume: 0, unknownVolume: 0,
    };
    total.bidVolume += row.bidVolume;
    total.askVolume += row.askVolume;
    total.unknownVolume += row.unknownVolume;
    target.set(row.tickIndex, total);
  }
}

const sortedRows = (rows: Map<number, AuctionGapCompactPriceRow>) =>
  [...rows.values()].sort((left, right) => left.tickIndex - right.tickIndex);

/** Convert validated v2 minute slices into the exact reset/filter segments the
 * detector consumes. Classification happens once per minute—the settings'
 * finest supported resolution—while raw rows remain available for retests. */
export function buildAuctionGapCompactSegments(input: {
  history: AuctionGapCompactRowsResult;
  candles: readonly Candle[];
  expectedContract: string;
  chartKind: "time" | "event";
  tickSize: number;
  asOfMs: number;
  calendar: AuctionGapCalendar;
  timeSettings: AuctionGapTimeSettings;
}): AuctionGapCompactSegmentResult {
  const fail = (reason: string): AuctionGapCompactSegmentResult => ({ status: "unavailable", reason, segments: [] });
  if (input.history.status !== "ready" || input.history.coverage !== "complete") return fail("partial-history");
  if (!input.expectedContract || input.history.contractSymbol !== input.expectedContract
    || input.history.bars.length !== input.candles.length || !Number.isFinite(input.asOfMs)
    || !Number.isFinite(input.tickSize) || input.tickSize <= 0) return fail("source-chart-mismatch");
  let clock: AuctionGapSessionClock;
  try { clock = new AuctionGapSessionClock(input.calendar, input.timeSettings); }
  catch { return fail("invalid-calendar"); }

  const segments: AuctionGapSourceBar[] = [];
  for (let chartIndex = 0; chartIndex < input.history.bars.length; chartIndex += 1) {
    const compact = input.history.bars[chartIndex];
    const candle = input.candles[chartIndex];
    if (compact.chartIndex !== chartIndex || compact.timestamp !== candle.timestamp) return fail("source-chart-mismatch");
    const slices = compact.slices.length ? compact.slices : [emptySlice(compact, candle, input.tickSize)];
    const groups: Array<{ resetKey: string | null; slices: AuctionGapCompactSlice[]; detect: boolean[] }> = [];
    for (const slice of slices) {
      const classification = clock.classify(slice.startTime);
      if (!classification) return fail("invalid-source-time");
      const prior = groups.at(-1);
      if (!prior || prior.resetKey !== classification.resetKey) {
        groups.push({ resetKey: classification.resetKey, slices: [slice], detect: [classification.detect] });
      } else {
        prior.slices.push(slice);
        prior.detect.push(classification.detect);
      }
    }
    for (let part = 0; part < groups.length; part += 1) {
      const group = groups[part];
      const raw = new Map<number, AuctionGapCompactPriceRow>();
      const detection = new Map<number, AuctionGapCompactPriceRow>();
      group.slices.forEach((slice, sliceIndex) => {
        mergeRows(raw, slice.rows);
        if (group.detect[sliceIndex]) mergeRows(detection, slice.rows);
      });
      const first = group.slices[0];
      const last = group.slices.at(-1)!;
      const isClosed = input.chartKind === "event"
        ? chartIndex < input.history.bars.length - 1
        : Number(compact.endTime) <= input.asOfMs;
      const base = {
        id: JSON.stringify([input.expectedContract, compact.timestamp, part]),
        instrument: input.expectedContract,
        startTime: first.startTime,
        endTime: last.endTime,
        openTick: first.openTick,
        closeTick: last.closeTick,
        lowTick: Math.min(...group.slices.map((slice) => slice.lowTick)),
        highTick: Math.max(...group.slices.map((slice) => slice.highTick)),
        hasPriceLevelFlow: true as const,
        isClosed,
      };
      segments.push({ chartIndex, resetKey: group.resetKey, detect: group.detect.some(Boolean),
        bar: { ...base, rows: sortedRows(raw) },
        detectionBar: { ...base, rows: sortedRows(detection) } });
    }
  }
  return { status: "ready", segments };
}

function emptySlice(compact: AuctionGapCompactBar, candle: Candle, tickSize: number): AuctionGapCompactSlice {
  const startTime = Number(compact.sourceStartTimestamp ?? compact.timestamp);
  const tick = Math.round(Number(candle.close) / tickSize);
  return { minute: Math.floor(startTime / 60_000) * 60_000, startTime, endTime: startTime,
    openTick: tick, highTick: tick, lowTick: tick, closeTick: tick, volume: 0, rows: [] };
}
