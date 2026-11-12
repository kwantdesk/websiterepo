import { futuresInstrumentRoot, scopedFuturesContract } from "@/lib/futuresInstrumentIdentity";
import type { Candle } from "@/lib/backtester";
import type { RithmicLiquiditySnapshot } from "@/lib/structureLevels";

export function bookSpeedSource(instrument: string, contractSymbol?: string | null) {
  const root = futuresInstrumentRoot(instrument);
  const contract = scopedFuturesContract(root, instrument) ?? scopedFuturesContract(root, contractSymbol);
  return { root, contract };
}

export function matchesBookSpeedContract(root: string, expected: string | null, received: string) {
  const contract = scopedFuturesContract(root, received);
  if (!contract) return false;
  if (!expected) return true;
  const code = contract.slice(root.length);
  const requested = expected.slice(root.length);
  return code === requested || (code.length !== requested.length && code[0] === requested[0] && code.at(-1) === requested.at(-1));
}

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

/**
 * Counts a level only when displayed liquidity is actually exhausted and the
 * same market frame carries sufficient aggressive executions at that price. A
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
  private observation: { timestamp: number; bookUsable: boolean; stale: boolean; fullDepth: boolean } | null = null;
  private completedSinceSeed = false;

  reset() {
    this.instrument = "";
    this.seenTrades.clear();
    this.seenTradeQueue = [];
    this.completed = [];
    this.observation = null;
    this.breakContinuity();
  }

  interrupt() {
    this.breakContinuity();
  }

  private breakContinuity() {
    this.previous.clear();
    this.active = null;
    this.direction = 0;
    this.lastPrice = null;
    this.extremePrice = null;
    this.warmed = false;
    this.completedSinceSeed = false;
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
    this.completedSinceSeed = true;
    if (this.completed.length > 11_000) this.completed.shift();
    this.active = this.startBucket(timestamp, settings);
  }

  private rollSeconds(timestamp: number, settings: BookSpeedSettings) {
    const nextStart = Math.floor(timestamp / (settings.parameterValue * 1_000)) * settings.parameterValue * 1_000;
    if (!this.active) this.active = this.startBucket(timestamp, settings);
    const boundary = this.active.startMs + settings.parameterValue * 1_000;
    if (nextStart > boundary) {
      this.breakContinuity();
      this.active = this.startBucket(timestamp, settings);
    } else if (nextStart === boundary) {
      this.commit(boundary, settings);
    }
    this.active.endMs = timestamp;
  }

  private rollTickReversal(timestamp: number, price: number | null, tickSize: number, settings: BookSpeedSettings) {
    if (!this.active) this.active = this.startBucket(timestamp, settings);
    this.active.endMs = timestamp;
    if (price == null || !Number.isFinite(price)) return;
    const priceTick = Math.round(price / tickSize);
    if (this.lastPrice == null || this.extremePrice == null) {
      this.lastPrice = priceTick;
      this.extremePrice = priceTick;
      return;
    }
    if (this.direction === 0 && priceTick !== this.lastPrice) {
      this.direction = priceTick > this.lastPrice ? 1 : -1;
      this.extremePrice = priceTick;
    } else if (this.direction === 1) {
      this.extremePrice = Math.max(this.extremePrice, priceTick);
      if (priceTick <= this.extremePrice - settings.parameterValue) {
        this.commit(timestamp, settings);
        this.direction = -1;
        this.extremePrice = priceTick;
      }
    } else if (this.direction === -1) {
      this.extremePrice = Math.min(this.extremePrice, priceTick);
      if (priceTick >= this.extremePrice + settings.parameterValue) {
        this.commit(timestamp, settings);
        this.direction = 1;
        this.extremePrice = priceTick;
      }
    }
    this.lastPrice = priceTick;
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
    this.observe(snapshot, settings);
    return this.frame(settings);
  }

  observe(snapshot: RithmicLiquiditySnapshot, settings: BookSpeedSettings) {
    const observedAt = Date.parse(snapshot.depthAsOf ?? snapshot.asOf);
    const instrument = snapshot.contractSymbol || "UNKNOWN";
    if (this.instrument && instrument !== this.instrument) this.reset();
    this.instrument = instrument;
    if (snapshot.depthUpdated === false || (this.observation
      && (!Number.isFinite(observedAt) || observedAt < this.observation.timestamp))) return;
    const timestamp = Number.isFinite(observedAt) ? observedAt : 0;
    const stale = snapshot.ageMs != null && snapshot.ageMs > 5_000;
    const bookUsable = Number.isFinite(observedAt) && (snapshot.depthBookValid ?? snapshot.bookValid) && !stale;
    if (!bookUsable) {
      this.breakContinuity();
    }
    const tickSize = Math.max(Number.EPSILON, snapshot.tickSize || 1);
    if (bookUsable) {
      if (settings.parameterMode === "seconds") this.rollSeconds(timestamp, settings);
      else this.rollTickReversal(timestamp, snapshot.depthLastPrice === undefined ? snapshot.lastPrice ?? null : snapshot.depthLastPrice, tickSize, settings);
    }

    const current = new Map<string, number>();
    for (const level of snapshot.levels) current.set(levelKey(level.side, level.price, tickSize), Math.max(0, level.size));
    const trades = this.freshTrades(snapshot);
    const aggressiveVolume = new Map<string, number>();
    for (const trade of trades) {
      if (!Number.isFinite(trade.price) || !Number.isFinite(trade.size) || trade.size <= 0) continue;
      const key = levelKey(trade.side === "BUY" ? "ASK" : "BID", trade.price, tickSize);
      aggressiveVolume.set(key, (aggressiveVolume.get(key) ?? 0) + trade.size);
    }
    let consumedBid = 0;
    let consumedAsk = 0;
    if (this.warmed && bookUsable && this.active) {
      for (const [key, previousSize] of this.previous) {
        if (previousSize <= 0 || (current.get(key) ?? 0) > 0) continue;
        if ((aggressiveVolume.get(key) ?? 0) < previousSize) continue;
        if (key.startsWith("ASK:")) consumedAsk += 1;
        else consumedBid += 1;
      }
      this.active.bidLevels += consumedBid;
      this.active.askLevels += consumedAsk;
    }
    if (bookUsable) {
      this.previous = current;
      this.warmed = true;
    }

    this.observation = { timestamp, bookUsable, stale, fullDepth: snapshot.fullDepth };
  }

  frame(settings: BookSpeedSettings): BookSpeedFrame {
    const rawBuckets = [...this.completed.slice(-(settings.historyBuckets + settings.averageLength)),
      ...(this.active ? [this.active] : [])];
    const buckets: BookSpeedBucket[] = [];
    const visibleFrom = Math.max(0, rawBuckets.length - settings.historyBuckets);
    let bid = 0;
    let ask = 0;
    rawBuckets.forEach((bucket, index) => {
      bid += bucket.bidLevels;
      ask -= bucket.askLevels;
      if (index >= settings.averageLength) {
        const outgoing = rawBuckets[index - settings.averageLength];
        bid -= outgoing.bidLevels;
        ask += outgoing.askLevels;
      }
      if (index >= visibleFrom) {
        const count = Math.min(index + 1, settings.averageLength);
        buckets.push({ ...bucket, averageBid: bid / count, averageAsk: ask / count });
      }
    });
    const hasConsumption = buckets.some((bucket) => bucket.bidLevels || bucket.askLevels);
    const status: BookSpeedFrameStatus = !this.observation ? "CONNECTING" : this.observation.stale ? "STALE"
      : !this.observation.bookUsable ? "BOOK UNAVAILABLE" : !this.completedSinceSeed ? "WARM-UP"
      : hasConsumption ? "LIVE" : "NO CONSUMPTION";
    const fullDepth = this.observation?.fullDepth ?? false;
    return {
      generatedAt: this.observation?.timestamp ?? 0,
      status,
      statusMessage: status === "BOOK UNAVAILABLE" ? "Rithmic order book is rebuilding." : status === "STALE" ? "Rithmic order book is stale." : status === "WARM-UP" || status === "CONNECTING" ? "Building the first complete measurement window." : status === "NO CONSUMPTION" ? "No fully consumed book levels in the loaded window." : "Counting execution-confirmed consumed price levels.",
      buckets,
      currentBid: buckets.at(-1)?.bidLevels ?? 0,
      currentAsk: buckets.at(-1)?.askLevels ?? 0,
      fullDepth,
      limitations: [
        "A level counts only when it disappears from the displayed book with enough same-frame aggressive volume at that exact price to cover the previously displayed size.",
        ...(fullDepth ? [] : ["The gateway currently supplies a price-level book window rather than the complete exchange depth."]),
      ],
    };
  }
}

/** Keep every measured window when the chart interval is wider than a book window. */
export function projectBookSpeedBuckets(
  buckets: readonly BookSpeedBucket[],
  candles: readonly Candle[],
  chartTime: (sourceTimestamp: number) => number | undefined,
  intervalMs: number | null,
) {
  const grouped = new Map<number, BookSpeedBucket & { time: number; windows: number }>();
  let candleIndex = 0;
  for (const bucket of buckets) {
    const timestamp = bucket.provisional ? bucket.endMs : Math.max(bucket.startMs, bucket.endMs - 1);
    if (timestamp < (candles[0]?.timestamp ?? Infinity)) continue;
    while (candleIndex + 1 < candles.length && candles[candleIndex + 1].timestamp <= timestamp) candleIndex++;
    const sourceTime = candles[candleIndex].timestamp;
    if (intervalMs !== null && timestamp >= sourceTime + intervalMs) continue;
    const time = chartTime(sourceTime);
    if (time === undefined) continue;
    const earlier = grouped.get(time);
    grouped.set(time, {
      ...bucket, time, windows: (earlier?.windows ?? 0) + 1,
      startMs: earlier?.startMs ?? bucket.startMs,
      bidLevels: (earlier?.bidLevels ?? 0) + bucket.bidLevels,
      askLevels: (earlier?.askLevels ?? 0) + bucket.askLevels,
    });
  }
  return [...grouped.values()];
}
