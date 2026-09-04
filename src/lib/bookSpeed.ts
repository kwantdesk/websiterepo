import type { RithmicLiquiditySnapshot } from "@/lib/structureLevels";

export const BOOK_SPEED_SETTINGS_VERSION = 1;

export type BookSpeedParameterMode = "seconds" | "tick-reversal";

export interface BookSpeedSettings {
  schemaVersion: number;
  parameterMode: BookSpeedParameterMode;
  parameterValue: number;
  showAverage: boolean;
  averageLength: number;
  showMarker: boolean;
  markerValue: number;
  lineWidth: number;
  historyBuckets: number;
  paneHeight: number;
  useThemeColors: boolean;
  bidColor: string;
  askColor: string;
  averageBidColor: string;
  averageAskColor: string;
  markerBidColor: string;
  markerAskColor: string;
}

export const DEFAULT_BOOK_SPEED_SETTINGS: BookSpeedSettings = {
  schemaVersion: BOOK_SPEED_SETTINGS_VERSION,
  parameterMode: "seconds",
  parameterValue: 10,
  showAverage: true,
  averageLength: 10,
  showMarker: false,
  markerValue: 10,
  lineWidth: 1,
  historyBuckets: 360,
  paneHeight: 190,
  useThemeColors: true,
  bidColor: "#22C55E",
  askColor: "#A855F7",
  averageBidColor: "#4ADE80",
  averageAskColor: "#F87171",
  markerBidColor: "#86EFAC",
  markerAskColor: "#FCA5A5",
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeBookSpeedSettings(input?: Record<string, unknown> | null): BookSpeedSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_BOOK_SPEED_SETTINGS, ...source } as BookSpeedSettings;
  settings.schemaVersion = BOOK_SPEED_SETTINGS_VERSION;
  settings.parameterMode = source.parameterMode === "tick-reversal" ? "tick-reversal" : "seconds";
  settings.parameterValue = Math.round(clamp(finite(source.parameterValue, 10), 1, 3_600));
  settings.averageLength = Math.round(clamp(finite(source.averageLength, 10), 1, 1_000));
  settings.markerValue = clamp(finite(source.markerValue, 10), 0, 100_000);
  settings.lineWidth = clamp(finite(source.lineWidth, 1), 0.5, 6);
  settings.historyBuckets = Math.round(clamp(finite(source.historyBuckets, 360), 20, 10_000));
  settings.paneHeight = Math.round(clamp(finite(source.paneHeight, 190), 120, 520));
  for (const key of ["showAverage", "showMarker", "useThemeColors"] as const) {
    settings[key] = source[key] == null ? DEFAULT_BOOK_SPEED_SETTINGS[key] : source[key] === true;
  }
  return settings;
}

export type BookSpeedBucket = {
  startMs: number;
  endMs: number;
  bidLevels: number;
  askLevels: number;
  averageBid: number;
  averageAsk: number;
  provisional: boolean;
};

export type BookSpeedFrameStatus = "CONNECTING" | "WARM-UP" | "LIVE" | "STALE" | "BOOK UNAVAILABLE" | "NO CONSUMPTION";

export type BookSpeedFrame = {
  generatedAt: number;
  status: BookSpeedFrameStatus;
  statusMessage: string;
  buckets: BookSpeedBucket[];
  currentBid: number;
  currentAsk: number;
  fullDepth: boolean;
  limitations: string[];
};

type MutableBucket = Omit<BookSpeedBucket, "averageBid" | "averageAsk">;
type Direction = -1 | 0 | 1;

function levelKey(side: "BID" | "ASK", price: number, tickSize: number) {
  return `${side}:${Math.round(price / tickSize)}`;
}

function movingAverage(values: number[], length: number, index: number) {
  const start = Math.max(0, index - length + 1);
  let total = 0;
  for (let cursor = start; cursor <= index; cursor += 1) total += values[cursor];
  return total / Math.max(1, index - start + 1);
}

/**
 * Counts a level only when displayed liquidity is actually exhausted and the
 * same market frame carries aggressive executions through that price. A
 * cancellation or pull can therefore never masquerade as book consumption.
 */
export class BookSpeedEngine {
  private instrument = "";
  private previous = new Map<string, number>();
  private seenTrades = new Set<string>();
  private seenTradeQueue: string[] = [];
  private completed: MutableBucket[] = [];
  private active: MutableBucket | null = null;
  private direction: Direction = 0;
  private lastPrice: number | null = null;
  private extremePrice: number | null = null;
  private warmed = false;

  reset() {
    this.instrument = "";
    this.previous.clear();
    this.seenTrades.clear();
    this.seenTradeQueue = [];
    this.completed = [];
    this.active = null;
    this.direction = 0;
    this.lastPrice = null;
    this.extremePrice = null;
    this.warmed = false;
  }

  private startBucket(timestamp: number, settings: BookSpeedSettings): MutableBucket {
    const startMs = settings.parameterMode === "seconds"
      ? Math.floor(timestamp / (settings.parameterValue * 1_000)) * settings.parameterValue * 1_000
      : timestamp;
    return { startMs, endMs: timestamp, bidLevels: 0, askLevels: 0, provisional: true };
  }

  private commit(timestamp: number, settings: BookSpeedSettings) {
    if (!this.active) return;
    this.active.endMs = timestamp;
    this.completed.push({ ...this.active, provisional: false });
    if (this.completed.length > settings.historyBuckets) this.completed.splice(0, this.completed.length - settings.historyBuckets);
    this.active = this.startBucket(timestamp, settings);
  }

  private rollSeconds(timestamp: number, settings: BookSpeedSettings) {
    const nextStart = Math.floor(timestamp / (settings.parameterValue * 1_000)) * settings.parameterValue * 1_000;
    if (!this.active) this.active = this.startBucket(timestamp, settings);
    while (this.active.startMs < nextStart) {
      const boundary = this.active.startMs + settings.parameterValue * 1_000;
      this.commit(boundary, settings);
    }
    this.active.endMs = timestamp;
  }

  private rollTickReversal(timestamp: number, price: number | null, tickSize: number, settings: BookSpeedSettings) {
    if (!this.active) this.active = this.startBucket(timestamp, settings);
    if (price == null || !Number.isFinite(price)) return;
    if (this.lastPrice == null || this.extremePrice == null) {
      this.lastPrice = price;
      this.extremePrice = price;
      return;
    }
    if (this.direction === 0 && price !== this.lastPrice) {
      this.direction = price > this.lastPrice ? 1 : -1;
      this.extremePrice = price;
    } else if (this.direction === 1) {
      this.extremePrice = Math.max(this.extremePrice, price);
      if (price <= this.extremePrice - settings.parameterValue * tickSize) {
        this.commit(timestamp, settings);
        this.direction = -1;
        this.extremePrice = price;
      }
    } else if (this.direction === -1) {
      this.extremePrice = Math.min(this.extremePrice, price);
      if (price >= this.extremePrice + settings.parameterValue * tickSize) {
        this.commit(timestamp, settings);
        this.direction = 1;
        this.extremePrice = price;
      }
    }
    this.lastPrice = price;
    this.active.endMs = timestamp;
  }

  private freshTrades(snapshot: RithmicLiquiditySnapshot) {
    return (snapshot.trades ?? []).filter((trade) => {
      const key = `${trade.id}:${trade.timestamp}:${trade.price}:${trade.size}:${trade.side}`;
      if (this.seenTrades.has(key)) return false;
      this.seenTrades.add(key);
      this.seenTradeQueue.push(key);
      while (this.seenTradeQueue.length > 50_000) this.seenTrades.delete(this.seenTradeQueue.shift()!);
      return true;
    });
  }

  apply(snapshot: RithmicLiquiditySnapshot, rawSettings?: BookSpeedSettings | Record<string, unknown>): BookSpeedFrame {
    const settings = normalizeBookSpeedSettings(rawSettings as Record<string, unknown>);
    const timestamp = Date.parse(snapshot.asOf) || Date.now();
    const instrument = snapshot.contractSymbol || "UNKNOWN";
    if (this.instrument && instrument !== this.instrument) this.reset();
    this.instrument = instrument;
    const tickSize = Math.max(Number.EPSILON, snapshot.tickSize || 1);
    if (settings.parameterMode === "seconds") this.rollSeconds(timestamp, settings);
    else this.rollTickReversal(timestamp, snapshot.lastPrice ?? snapshot.microPrice ?? null, tickSize, settings);

    const current = new Map<string, number>();
    for (const level of snapshot.levels) current.set(levelKey(level.side, level.price, tickSize), Math.max(0, level.size));
    const trades = this.freshTrades(snapshot);
    const buyTicks = new Set(trades.filter((trade) => trade.side === "BUY").map((trade) => Math.round(trade.price / tickSize)));
    const sellTicks = new Set(trades.filter((trade) => trade.side === "SELL").map((trade) => Math.round(trade.price / tickSize)));
    let consumedBid = 0;
    let consumedAsk = 0;
    if (this.warmed && snapshot.bookValid && this.active) {
      for (const [key, previousSize] of this.previous) {
        if (previousSize <= 0 || (current.get(key) ?? 0) > 0) continue;
        const [side, tickText] = key.split(":") as ["BID" | "ASK", string];
        const tick = Number(tickText);
        if (side === "ASK" && buyTicks.has(tick)) consumedAsk += 1;
        if (side === "BID" && sellTicks.has(tick)) consumedBid += 1;
      }
      this.active.bidLevels += consumedBid;
      this.active.askLevels += consumedAsk;
    }
    this.previous = current;
    this.warmed = this.warmed || snapshot.bookValid;

    const rawBuckets = [...this.completed, ...(this.active ? [{ ...this.active }] : [])].slice(-settings.historyBuckets);
    const bids = rawBuckets.map((bucket) => bucket.bidLevels);
    const asks = rawBuckets.map((bucket) => -bucket.askLevels);
    const buckets = rawBuckets.map((bucket, index): BookSpeedBucket => ({
      ...bucket,
      averageBid: movingAverage(bids, settings.averageLength, index),
      averageAsk: movingAverage(asks, settings.averageLength, index),
    }));
    const stale = snapshot.ageMs != null && snapshot.ageMs > 5_000;
    const hasConsumption = buckets.some((bucket) => bucket.bidLevels || bucket.askLevels);
    const status: BookSpeedFrameStatus = !snapshot.bookValid ? "BOOK UNAVAILABLE" : stale ? "STALE" : !this.warmed ? "CONNECTING" : rawBuckets.length < 2 ? "WARM-UP" : hasConsumption ? "LIVE" : "NO CONSUMPTION";
    return {
      generatedAt: timestamp,
      status,
      statusMessage: status === "BOOK UNAVAILABLE" ? "Rithmic order book is rebuilding." : status === "STALE" ? "Rithmic order book is stale." : status === "WARM-UP" || status === "CONNECTING" ? "Building the first complete measurement window." : status === "NO CONSUMPTION" ? "No fully consumed book levels in the loaded window." : "Counting execution-confirmed consumed price levels.",
      buckets,
      currentBid: buckets.at(-1)?.bidLevels ?? 0,
      currentAsk: buckets.at(-1)?.askLevels ?? 0,
      fullDepth: snapshot.fullDepth,
      limitations: [
        "A level counts only when it disappears from the displayed book with a same-frame aggressive execution at that exact price; pulls and cancellations do not count.",
        ...(snapshot.fullDepth ? [] : ["The gateway currently supplies a price-level book window rather than the complete exchange depth."]),
      ],
    };
  }
}
