import type {
  RithmicLiquiditySnapshot,
  RithmicOrderLifecycleEvent,
} from "@/lib/structureLevels";

export type SpoofingDetectionMode = "PRICE_LEVEL" | "INDIVIDUAL_ORDER";
export type SpoofingRowState = "QUIET" | "SUSPECT" | "PULLED" | "DUMPED";

export type SpoofingDetectorSettings = {
  visibleRows: number;
  detectionMode: SpoofingDetectionMode;
  candleIntervalMs: number;
  minimumCandidateContracts: number;
  minimumAggressiveContracts: number;
  sizeMultiple: number;
  cancellationRatio: number;
  maximumLifetimeMs: number;
  maximumExecutionRatio: number;
  scoreThreshold: number;
  markerRetentionMs: number;
  layeringEnabled: boolean;
  pullRepostEnabled: boolean;
  pullRepostWindowMs: number;
};

export const DEFAULT_SPOOFING_DETECTOR_SETTINGS: SpoofingDetectorSettings = {
  visibleRows: 20,
  detectionMode: "PRICE_LEVEL",
  candleIntervalMs: 1_000,
  minimumCandidateContracts: 80,
  minimumAggressiveContracts: 50,
  sizeMultiple: 2.5,
  cancellationRatio: 0.7,
  maximumLifetimeMs: 8_000,
  maximumExecutionRatio: 0.2,
  scoreThreshold: 68,
  markerRetentionMs: 60_000,
  layeringEnabled: true,
  pullRepostEnabled: true,
  pullRepostWindowMs: 4_000,
};

export type SpoofingDetectorRow = {
  key: string;
  side: "BID" | "ASK";
  price: number;
  liveContracts: number;
  orderCount: number;
  peakCandidateSize: number;
  cancelledContracts: number;
  aggressiveContracts: number;
  score: number;
  state: SpoofingRowState;
  layered: boolean;
  reposted: boolean;
  lastEventAt: number;
};

export type SpoofingDetectorEvent = {
  id: string;
  timestamp: number;
  side: "BID" | "ASK";
  price: number;
  state: Exclude<SpoofingRowState, "QUIET">;
  quantity: number;
  score: number;
  description: string;
};

export type SpoofingDetectorFrame = {
  timestamp: number;
  tickSize: number;
  lastPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  fullDepth: boolean;
  bookValid: boolean;
  individualOrders: boolean;
  rows: SpoofingDetectorRow[];
  events: SpoofingDetectorEvent[];
};

type MutableLevel = SpoofingDetectorRow & {
  initialized: boolean;
  emaSize: number;
  candidateStartedAt: number | null;
  candidateCancelled: number;
  candidateExecuted: number;
  markerExpiresAt: number;
};

type PulledRecord = {
  timestamp: number;
  side: "BID" | "ASK";
  price: number;
  quantity: number;
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeSpoofingDetectorSettings(
  value: Partial<SpoofingDetectorSettings> | null | undefined,
): SpoofingDetectorSettings {
  const source = value ?? {};
  return {
    visibleRows: Math.round(clamp(finite(source.visibleRows, 20), 10, 40)),
    detectionMode: source.detectionMode === "INDIVIDUAL_ORDER" ? "INDIVIDUAL_ORDER" : "PRICE_LEVEL",
    candleIntervalMs: [1_000, 2_000, 5_000, 10_000].includes(finite(source.candleIntervalMs))
      ? finite(source.candleIntervalMs)
      : 1_000,
    minimumCandidateContracts: Math.round(clamp(finite(source.minimumCandidateContracts, 80), 1, 100_000)),
    minimumAggressiveContracts: Math.round(clamp(finite(source.minimumAggressiveContracts, 50), 1, 100_000)),
    sizeMultiple: clamp(finite(source.sizeMultiple, 2.5), 1, 20),
    cancellationRatio: clamp(finite(source.cancellationRatio, 0.7), 0.05, 1),
    maximumLifetimeMs: Math.round(clamp(finite(source.maximumLifetimeMs, 8_000), 250, 120_000)),
    maximumExecutionRatio: clamp(finite(source.maximumExecutionRatio, 0.2), 0, 1),
    scoreThreshold: Math.round(clamp(finite(source.scoreThreshold, 68), 1, 100)),
    markerRetentionMs: Math.round(clamp(finite(source.markerRetentionMs, 60_000), 1_000, 30 * 60_000)),
    layeringEnabled: source.layeringEnabled !== false,
    pullRepostEnabled: source.pullRepostEnabled !== false,
    pullRepostWindowMs: Math.round(clamp(finite(source.pullRepostWindowMs, 4_000), 250, 60_000)),
  };
}

function median(values: number[]) {
  if (!values.length) return 1;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function levelKey(side: "BID" | "ASK", price: number, tickSize: number) {
  return `${side}:${Math.round(price / tickSize)}`;
}

function tradesAtPrice(snapshot: RithmicLiquiditySnapshot, seenTradeIds: Set<number>) {
  const result = new Map<string, number>();
  const tickSize = snapshot.tickSize || 0.25;
  for (const trade of snapshot.trades ?? []) {
    if (seenTradeIds.has(trade.id)) continue;
    seenTradeIds.add(trade.id);
    const restingSide = trade.side === "BUY" ? "ASK" : "BID";
    const key = levelKey(restingSide, trade.price, tickSize);
    result.set(key, (result.get(key) ?? 0) + trade.size);
  }
  return result;
}

function orderEventDeltas(events: RithmicOrderLifecycleEvent[] | undefined, tickSize: number) {
  const additions = new Map<string, number>();
  const reductions = new Map<string, number>();
  for (const event of events ?? []) {
    const nextKey = levelKey(event.side, event.price, tickSize);
    const priorPrice = event.previousPrice ?? event.price;
    const priorKey = levelKey(event.side, priorPrice, tickSize);
    if (event.action === "ADD") {
      additions.set(nextKey, (additions.get(nextKey) ?? 0) + event.size);
      continue;
    }
    if (event.action === "REMOVE") {
      reductions.set(priorKey, (reductions.get(priorKey) ?? 0) + event.previousSize);
      continue;
    }
    if (priorKey !== nextKey) {
      reductions.set(priorKey, (reductions.get(priorKey) ?? 0) + event.previousSize);
      additions.set(nextKey, (additions.get(nextKey) ?? 0) + event.size);
      continue;
    }
    const delta = event.size - event.previousSize;
    if (delta > 0) additions.set(nextKey, (additions.get(nextKey) ?? 0) + delta);
    if (delta < 0) reductions.set(priorKey, (reductions.get(priorKey) ?? 0) - delta);
  }
  return { additions, reductions };
}

function publicRow(level: MutableLevel): SpoofingDetectorRow {
  return {
    key: level.key,
    side: level.side,
    price: level.price,
    liveContracts: level.liveContracts,
    orderCount: level.orderCount,
    peakCandidateSize: level.peakCandidateSize,
    cancelledContracts: level.cancelledContracts,
    aggressiveContracts: level.aggressiveContracts,
    score: level.score,
    state: level.state,
    layered: level.layered,
    reposted: level.reposted,
    lastEventAt: level.lastEventAt,
  };
}

export class SpoofingDetectorEngine {
  private readonly levels = new Map<string, MutableLevel>();
  private events: SpoofingDetectorEvent[] = [];
  private pulled: PulledRecord[] = [];
  private readonly seenTradeIds = new Set<number>();
  private lastTimestamp = 0;

  reset() {
    this.levels.clear();
    this.events = [];
    this.pulled = [];
    this.seenTradeIds.clear();
    this.lastTimestamp = 0;
  }

  apply(
    snapshot: RithmicLiquiditySnapshot,
    rawSettings?: Partial<SpoofingDetectorSettings>,
  ): SpoofingDetectorFrame {
    const settings = normalizeSpoofingDetectorSettings(rawSettings);
    const timestamp = Math.max(this.lastTimestamp, Date.parse(snapshot.asOf) || 0);
    this.lastTimestamp = timestamp;
    const tickSize = snapshot.tickSize || 0.25;
    const activeKeys = new Set<string>();
    const executions = tradesAtPrice(snapshot, this.seenTradeIds);
    const orderDeltas = orderEventDeltas(snapshot.orderEvents, tickSize);
    const medianSize = Math.max(1, median(snapshot.levels.map((level) => level.size).filter((size) => size > 0)));

    for (const row of snapshot.levels) {
      const key = levelKey(row.side, row.price, tickSize);
      activeKeys.add(key);
      const existing = this.levels.get(key);
      if (!existing) {
        const lifecycleAddition = settings.detectionMode === "INDIVIDUAL_ORDER"
          ? orderDeltas.additions.get(key) ?? 0
          : 0;
        const qualifiesLifecycleAdd = lifecycleAddition > 0
          && row.size >= settings.minimumCandidateContracts
          && row.size / medianSize >= settings.sizeMultiple;
        this.levels.set(key, {
          key,
          side: row.side,
          price: row.price,
          liveContracts: row.size,
          orderCount: row.orders,
          peakCandidateSize: row.size,
          cancelledContracts: 0,
          aggressiveContracts: executions.get(key) ?? 0,
          score: 0,
          state: (executions.get(key) ?? 0) >= settings.minimumAggressiveContracts
            ? "DUMPED"
            : qualifiesLifecycleAdd ? "SUSPECT" : "QUIET",
          layered: false,
          reposted: false,
          lastEventAt: timestamp,
          initialized: true,
          emaSize: medianSize,
          candidateStartedAt: qualifiesLifecycleAdd ? timestamp : null,
          candidateCancelled: 0,
          candidateExecuted: 0,
          markerExpiresAt: timestamp + settings.markerRetentionMs,
        });
        continue;
      }

      const previousSize = existing.liveContracts;
      const executed = executions.get(key) ?? 0;
      const aggregateReduction = Math.max(0, previousSize - row.size);
      const lifecycleReduction = settings.detectionMode === "INDIVIDUAL_ORDER"
        ? orderDeltas.reductions.get(key) ?? 0
        : 0;
      const cancelled = Math.max(0, Math.max(aggregateReduction, lifecycleReduction) - executed);
      const aggregateAddition = Math.max(0, row.size - previousSize);
      const lifecycleAddition = settings.detectionMode === "INDIVIDUAL_ORDER"
        ? orderDeltas.additions.get(key) ?? 0
        : 0;
      const added = Math.max(aggregateAddition, lifecycleAddition);
      const reference = Math.max(1, existing.emaSize, medianSize);
      const sizeRatio = row.size / reference;
      const qualifies = row.size >= settings.minimumCandidateContracts && sizeRatio >= settings.sizeMultiple;

      existing.price = row.price;
      existing.liveContracts = row.size;
      existing.orderCount = row.orders;
      existing.emaSize = existing.emaSize * 0.9 + row.size * 0.1;
      existing.cancelledContracts = cancelled > 0
        ? existing.cancelledContracts + cancelled
        : existing.markerExpiresAt > timestamp ? existing.cancelledContracts : 0;
      existing.aggressiveContracts = executed > 0
        ? existing.aggressiveContracts + executed
        : existing.markerExpiresAt > timestamp ? existing.aggressiveContracts : 0;
      existing.lastEventAt = cancelled > 0 || executed > 0 || added > 0 ? timestamp : existing.lastEventAt;
      if (cancelled > 0 || executed > 0) existing.markerExpiresAt = timestamp + settings.markerRetentionMs;

      if ((qualifies && added > 0) || (existing.candidateStartedAt !== null && row.size > 0)) {
        if (existing.candidateStartedAt === null) {
          existing.candidateStartedAt = timestamp;
          existing.candidateCancelled = 0;
          existing.candidateExecuted = 0;
          existing.peakCandidateSize = row.size;
        }
        existing.peakCandidateSize = Math.max(existing.peakCandidateSize, previousSize, row.size);
        existing.candidateCancelled += cancelled;
        existing.candidateExecuted += executed;
      }

      if (executed >= settings.minimumAggressiveContracts) {
        existing.state = "DUMPED";
        existing.score = 0;
        this.recordEvent(existing, "DUMPED", executed, timestamp, settings,
          `${executed} contracts executed aggressively at this price.`);
      } else if (existing.candidateStartedAt !== null) {
        const peak = Math.max(1, existing.peakCandidateSize);
        const cancellationRatio = existing.candidateCancelled / peak;
        const executionRatio = existing.candidateExecuted / peak;
        const lifetime = Math.max(0, timestamp - existing.candidateStartedAt);
        const sizeScore = clamp((existing.peakCandidateSize / reference) / settings.sizeMultiple, 0, 1) * 25;
        const cancellationScore = clamp(cancellationRatio / settings.cancellationRatio, 0, 1) * 35;
        const speedScore = clamp(1 - lifetime / settings.maximumLifetimeMs, 0, 1) * 15;
        const executionAbsenceScore = clamp(1 - executionRatio / Math.max(0.01, settings.maximumExecutionRatio), 0, 1) * 15;
        existing.score = Math.round(sizeScore + cancellationScore + speedScore + executionAbsenceScore);
        existing.state = "SUSPECT";
        if (
          cancellationRatio >= settings.cancellationRatio
          && lifetime <= settings.maximumLifetimeMs
          && executionRatio <= settings.maximumExecutionRatio
          && existing.score >= settings.scoreThreshold
        ) {
          existing.state = "PULLED";
          this.pulled.push({ timestamp, side: existing.side, price: existing.price, quantity: existing.candidateCancelled });
          this.recordEvent(existing, "PULLED", existing.candidateCancelled, timestamp, settings,
            `${existing.candidateCancelled} resting contracts were removed without matching aggressive execution.`);
          existing.candidateStartedAt = null;
          existing.candidateCancelled = 0;
          existing.candidateExecuted = 0;
        }
      } else {
        existing.state = existing.markerExpiresAt > timestamp && existing.state !== "SUSPECT"
          ? existing.state
          : "QUIET";
        existing.score = 0;
      }
    }

    for (const [key, level] of this.levels) {
      if (activeKeys.has(key)) continue;
      const executed = executions.get(key) ?? 0;
      const lifecycleReduction = settings.detectionMode === "INDIVIDUAL_ORDER"
        ? orderDeltas.reductions.get(key) ?? 0
        : 0;
      const cancelled = Math.max(0, Math.max(level.liveContracts, lifecycleReduction) - executed);
      level.liveContracts = 0;
      level.cancelledContracts += cancelled;
      level.aggressiveContracts += executed;
      level.markerExpiresAt = timestamp + settings.markerRetentionMs;
      if (level.candidateStartedAt !== null && cancelled > 0) {
        level.candidateCancelled += cancelled;
        const ratio = level.candidateCancelled / Math.max(1, level.peakCandidateSize);
        const lifetime = timestamp - level.candidateStartedAt;
        level.score = Math.round(clamp(ratio / settings.cancellationRatio, 0, 1) * 75 + clamp(1 - lifetime / settings.maximumLifetimeMs, 0, 1) * 25);
        if (ratio >= settings.cancellationRatio && lifetime <= settings.maximumLifetimeMs && level.score >= settings.scoreThreshold) {
          level.state = "PULLED";
          this.pulled.push({ timestamp, side: level.side, price: level.price, quantity: level.candidateCancelled });
          this.recordEvent(level, "PULLED", level.candidateCancelled, timestamp, settings,
            `${level.candidateCancelled} resting contracts were removed without matching aggressive execution.`);
        }
      }
      level.candidateStartedAt = null;
    }

    const candidates = [...this.levels.values()].filter((level) => level.state === "SUSPECT");
    for (const level of this.levels.values()) {
      level.layered = settings.layeringEnabled && level.state === "SUSPECT" && candidates.some((other) => (
        other.key !== level.key
        && other.side === level.side
        && Math.abs(other.price - level.price) <= tickSize * 3
      ));
      level.reposted = settings.pullRepostEnabled && level.state === "SUSPECT" && this.pulled.some((record) => (
        record.side === level.side
        && timestamp - record.timestamp <= settings.pullRepostWindowMs
        && Math.abs(record.price - level.price) <= tickSize * 3
        && level.liveContracts >= record.quantity * 0.6
      ));
      if (level.layered) level.score = Math.min(100, level.score + 5);
      if (level.reposted) level.score = Math.min(100, level.score + 5);
    }

    this.pulled = this.pulled.filter((record) => timestamp - record.timestamp <= settings.pullRepostWindowMs);
    this.events = this.events.filter((event) => timestamp - event.timestamp <= settings.markerRetentionMs);
    if (this.seenTradeIds.size > 50_000) {
      this.seenTradeIds.clear();
      for (const trade of (snapshot.trades ?? []).slice(-5_000)) this.seenTradeIds.add(trade.id);
    }
    for (const [key, level] of this.levels) {
      if (level.liveContracts <= 0 && level.markerExpiresAt <= timestamp) this.levels.delete(key);
    }

    return {
      timestamp,
      tickSize,
      lastPrice: snapshot.lastPrice ?? snapshot.microPrice ?? null,
      bestBid: snapshot.bestBid ?? null,
      bestAsk: snapshot.bestAsk ?? null,
      fullDepth: snapshot.fullDepth,
      bookValid: snapshot.bookValid,
      individualOrders: snapshot.individualOrders === true,
      rows: [...this.levels.values()].map(publicRow),
      events: [...this.events],
    };
  }

  private recordEvent(
    level: MutableLevel,
    state: Exclude<SpoofingRowState, "QUIET">,
    quantity: number,
    timestamp: number,
    settings: SpoofingDetectorSettings,
    description: string,
  ) {
    if (quantity <= 0) return;
    const existing = this.events.find((event) => (
      event.side === level.side
      && event.price === level.price
      && event.state === state
      && timestamp - event.timestamp < Math.min(500, settings.markerRetentionMs)
    ));
    if (existing) {
      existing.quantity += quantity;
      existing.timestamp = timestamp;
      existing.score = Math.max(existing.score, level.score);
      return;
    }
    this.events.push({
      id: `${state}:${level.key}:${timestamp}`,
      timestamp,
      side: level.side,
      price: level.price,
      state,
      quantity,
      score: level.score,
      description,
    });
    if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
  }
}

export type SpoofingCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function appendSpoofingCandles(
  candles: SpoofingCandle[],
  trades: NonNullable<RithmicLiquiditySnapshot["trades"]>,
  intervalMs: number,
  seenTradeIds: Set<number>,
  limit = 180,
) {
  for (const trade of trades) {
    if (seenTradeIds.has(trade.id)) continue;
    seenTradeIds.add(trade.id);
    const timestamp = trade.timestamp - (trade.timestamp % intervalMs);
    let candle = candles.at(-1);
    if (!candle || candle.timestamp !== timestamp) {
      candle = { timestamp, open: trade.price, high: trade.price, low: trade.price, close: trade.price, volume: 0 };
      candles.push(candle);
    }
    candle.high = Math.max(candle.high, trade.price);
    candle.low = Math.min(candle.low, trade.price);
    candle.close = trade.price;
    candle.volume += trade.size;
  }
  if (candles.length > limit) candles.splice(0, candles.length - limit);
  if (seenTradeIds.size > 20_000) {
    seenTradeIds.clear();
    for (const trade of trades.slice(-Math.min(trades.length, 5_000))) seenTradeIds.add(trade.id);
  }
  return candles;
}
