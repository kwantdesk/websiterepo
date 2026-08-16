import type { RithmicLiquiditySnapshot, RithmicOrderLifecycleEvent } from "@/lib/structureLevels";

export type PullingStackingClassificationMode = "price-level" | "individual-order";
export type PullingStackingMoveHandling = "separate-move" | "pull-and-stack" | "ignore-correlated-move";
export type PullingStackingRenderMode = "hybrid" | "heat-cells" | "ribbons" | "event-markers" | "current-profile" | "lower-pane";
export type PullingStackingEventKind = "BID_STACK" | "ASK_STACK" | "BID_PULL" | "ASK_PULL";

export type PullingStackingSettings = {
  preset: "balanced" | "scalper" | "structural" | "custom";
  classificationMode: PullingStackingClassificationMode;
  moveHandling: PullingStackingMoveHandling;
  renderMode: PullingStackingRenderMode;
  aggregationMs: number;
  rollingWindowMs: number;
  historySeconds: number;
  baselineBuckets: number;
  minimumContracts: number;
  relativeThreshold: number;
  scoreThreshold: number;
  visibleTicks: number;
  currentProfileWidth: number;
  maximumEvents: number;
  staleAfterMs: number;
  markerRetentionMs: number;
  opacity: number;
  showHeatCells: boolean;
  showRibbons: boolean;
  showEventMarkers: boolean;
  showCurrentProfile: boolean;
  showLowerPane: boolean;
  showLabels: boolean;
  showHeader: boolean;
  showWallBuild: boolean;
  showWallCollapse: boolean;
  showLiquidityVacuum: boolean;
  pullRepostEnabled: boolean;
  enableAlerts: boolean;
  useThemeColors: boolean;
  bidStackColor: string;
  askStackColor: string;
  bidPullColor: string;
  askPullColor: string;
  neutralColor: string;
  pullingStackingSettingsVersion: number;
};

export const PULLING_STACKING_SETTINGS_VERSION = 1;

export const DEFAULT_PULLING_STACKING_SETTINGS: PullingStackingSettings = {
  preset: "balanced",
  classificationMode: "price-level",
  moveHandling: "separate-move",
  renderMode: "hybrid",
  aggregationMs: 1_000,
  rollingWindowMs: 10_000,
  historySeconds: 300,
  baselineBuckets: 60,
  minimumContracts: 10,
  relativeThreshold: 1.5,
  scoreThreshold: 55,
  visibleTicks: 120,
  currentProfileWidth: 72,
  maximumEvents: 1_500,
  staleAfterMs: 5_000,
  markerRetentionMs: 60_000,
  opacity: 62,
  showHeatCells: true,
  showRibbons: true,
  showEventMarkers: true,
  showCurrentProfile: true,
  showLowerPane: false,
  showLabels: true,
  showHeader: true,
  showWallBuild: true,
  showWallCollapse: true,
  showLiquidityVacuum: true,
  pullRepostEnabled: false,
  enableAlerts: false,
  useThemeColors: true,
  bidStackColor: "#22C55E",
  askStackColor: "#EF4444",
  bidPullColor: "#F59E0B",
  askPullColor: "#38BDF8",
  neutralColor: "#A1A1AA",
  pullingStackingSettingsVersion: PULLING_STACKING_SETTINGS_VERSION,
};

export const PULLING_STACKING_PRESETS: Record<Exclude<PullingStackingSettings["preset"], "custom">, Partial<PullingStackingSettings>> = {
  balanced: {
    preset: "balanced", aggregationMs: 1_000, rollingWindowMs: 10_000, minimumContracts: 10,
    relativeThreshold: 1.5, scoreThreshold: 55, renderMode: "hybrid",
  },
  scalper: {
    preset: "scalper", aggregationMs: 250, rollingWindowMs: 3_000, minimumContracts: 4,
    relativeThreshold: 1.2, scoreThreshold: 42, historySeconds: 120, renderMode: "hybrid",
  },
  structural: {
    preset: "structural", aggregationMs: 2_000, rollingWindowMs: 30_000, minimumContracts: 25,
    relativeThreshold: 2, scoreThreshold: 68, historySeconds: 900, renderMode: "ribbons",
  },
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizePullingStackingSettings(value: Record<string, number | string | boolean> | null | undefined): PullingStackingSettings {
  const source = value ?? {};
  const classificationMode = source.classificationMode === "individual-order" ? "individual-order" : "price-level";
  const moveHandling = ["separate-move", "pull-and-stack", "ignore-correlated-move"].includes(String(source.moveHandling))
    ? source.moveHandling as PullingStackingMoveHandling : "separate-move";
  const renderMode = ["hybrid", "heat-cells", "ribbons", "event-markers", "current-profile", "lower-pane"].includes(String(source.renderMode))
    ? source.renderMode as PullingStackingRenderMode : "hybrid";
  return {
    ...DEFAULT_PULLING_STACKING_SETTINGS,
    ...source,
    preset: ["balanced", "scalper", "structural", "custom"].includes(String(source.preset)) ? source.preset as PullingStackingSettings["preset"] : "balanced",
    classificationMode,
    moveHandling,
    renderMode,
    aggregationMs: Math.round(clamp(finite(source.aggregationMs, 1_000), 100, 60_000)),
    rollingWindowMs: Math.round(clamp(finite(source.rollingWindowMs, 10_000), 500, 300_000)),
    historySeconds: Math.round(clamp(finite(source.historySeconds, 300), 30, 3_600)),
    baselineBuckets: Math.round(clamp(finite(source.baselineBuckets, 60), 5, 1_000)),
    minimumContracts: Math.round(clamp(finite(source.minimumContracts, 10), 1, 100_000)),
    relativeThreshold: clamp(finite(source.relativeThreshold, 1.5), 0.1, 20),
    scoreThreshold: Math.round(clamp(finite(source.scoreThreshold, 55), 1, 100)),
    visibleTicks: Math.round(clamp(finite(source.visibleTicks, 120), 10, 2_000)),
    currentProfileWidth: Math.round(clamp(finite(source.currentProfileWidth, 72), 24, 240)),
    maximumEvents: Math.round(clamp(finite(source.maximumEvents, 1_500), 100, 10_000)),
    staleAfterMs: Math.round(clamp(finite(source.staleAfterMs, 5_000), 500, 120_000)),
    markerRetentionMs: Math.round(clamp(finite(source.markerRetentionMs, 60_000), 1_000, 3_600_000)),
    opacity: clamp(finite(source.opacity, 62), 5, 100),
    showHeatCells: source.showHeatCells !== false,
    showRibbons: source.showRibbons !== false,
    showEventMarkers: source.showEventMarkers !== false,
    showCurrentProfile: source.showCurrentProfile !== false,
    showLowerPane: source.showLowerPane === true,
    showLabels: source.showLabels !== false,
    showHeader: source.showHeader !== false,
    showWallBuild: source.showWallBuild !== false,
    showWallCollapse: source.showWallCollapse !== false,
    showLiquidityVacuum: source.showLiquidityVacuum !== false,
    pullRepostEnabled: source.pullRepostEnabled === true,
    enableAlerts: source.enableAlerts === true,
    useThemeColors: source.useThemeColors !== false,
    bidStackColor: String(source.bidStackColor ?? DEFAULT_PULLING_STACKING_SETTINGS.bidStackColor),
    askStackColor: String(source.askStackColor ?? DEFAULT_PULLING_STACKING_SETTINGS.askStackColor),
    bidPullColor: String(source.bidPullColor ?? DEFAULT_PULLING_STACKING_SETTINGS.bidPullColor),
    askPullColor: String(source.askPullColor ?? DEFAULT_PULLING_STACKING_SETTINGS.askPullColor),
    neutralColor: String(source.neutralColor ?? DEFAULT_PULLING_STACKING_SETTINGS.neutralColor),
    pullingStackingSettingsVersion: PULLING_STACKING_SETTINGS_VERSION,
  };
}

export type PullingStackingMetrics = {
  bidStack: number;
  askStack: number;
  bidPull: number;
  askPull: number;
  pressure: number;
  churn: number;
  stackPullRatio: number;
  velocity: number;
  score: number;
};

export type PullingStackingRow = PullingStackingMetrics & {
  tick: number;
  price: number;
  bidSize: number;
  askSize: number;
  bidOrders: number;
  askOrders: number;
};

export type PullingStackingBucket = {
  timestamp: number;
  rows: PullingStackingRow[];
  totals: PullingStackingMetrics;
};

export type PullingStackingEvent = {
  id: string;
  timestamp: number;
  tick: number;
  price: number;
  kind: PullingStackingEventKind;
  quantity: number;
  score: number;
  wallBuild: boolean;
  wallCollapse: boolean;
  liquidityVacuum: boolean;
  pullRepost: boolean;
};

export type PullingStackingFrame = {
  timestamp: number;
  tickSize: number;
  contractSymbol: string;
  lastPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  fullDepth: boolean;
  bookValid: boolean;
  individualOrders: boolean;
  warmup: boolean;
  stale: boolean;
  sequenceGap: boolean;
  rows: PullingStackingRow[];
  buckets: PullingStackingBucket[];
  events: PullingStackingEvent[];
  totals: PullingStackingMetrics;
  limitations: string[];
};

type MutableMetrics = Omit<PullingStackingMetrics, "pressure" | "churn" | "stackPullRatio" | "velocity" | "score">;
type BookRow = { bidSize: number; askSize: number; bidOrders: number; askOrders: number };
type DeltaMaps = { additions: Map<string, number>; reductions: Map<string, number>; movedKeys: Set<string> };

const emptyMutable = (): MutableMetrics => ({ bidStack: 0, askStack: 0, bidPull: 0, askPull: 0 });
const emptyMetrics = (): PullingStackingMetrics => ({ ...emptyMutable(), pressure: 0, churn: 0, stackPullRatio: 0, velocity: 0, score: 0 });
const keyFor = (side: "BID" | "ASK", tick: number) => `${side}:${tick}`;

function median(values: number[]) {
  if (!values.length) return 1;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function lifecycleDeltas(events: RithmicOrderLifecycleEvent[] | undefined, tickSize: number, mode: PullingStackingMoveHandling, seen: Set<string>): DeltaMaps {
  const additions = new Map<string, number>();
  const reductions = new Map<string, number>();
  const movedKeys = new Set<string>();
  const add = (target: Map<string, number>, key: string, quantity: number) => target.set(key, (target.get(key) ?? 0) + Math.max(0, quantity));
  for (const event of events ?? []) {
    const identity = `${event.sequence}:${event.timestamp}:${event.orderId}:${event.action}:${event.side}:${event.previousPrice}:${event.price}:${event.previousSize}:${event.size}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const nextTick = Math.round(event.price / tickSize);
    const previousTick = Math.round((event.previousPrice ?? event.price) / tickSize);
    const nextKey = keyFor(event.side, nextTick);
    const previousKey = keyFor(event.side, previousTick);
    if (event.action === "ADD") { add(additions, nextKey, event.size); continue; }
    if (event.action === "REMOVE") { add(reductions, previousKey, event.previousSize); continue; }
    if (nextTick !== previousTick) {
      movedKeys.add(previousKey); movedKeys.add(nextKey);
      // A price-changing MODIFY is an order move, not proof of an independent
      // cancellation/addition. Only the explicit pull-and-stack mode folds it
      // into those metrics; separate-move keeps it out of directional totals.
      if (mode === "pull-and-stack") {
        add(reductions, previousKey, event.previousSize);
        add(additions, nextKey, event.size);
      }
      continue;
    }
    const delta = event.size - event.previousSize;
    if (delta > 0) add(additions, nextKey, delta);
    if (delta < 0) add(reductions, previousKey, -delta);
  }
  return { additions, reductions, movedKeys };
}

function metricsFromMutable(value: MutableMetrics, durationMs: number, baseline: number): PullingStackingMetrics {
  const stack = value.bidStack + value.askStack;
  const pull = value.bidPull + value.askPull;
  const churn = stack + pull;
  const pressure = value.bidStack + value.askPull - value.askStack - value.bidPull;
  const relative = churn / Math.max(1, baseline);
  const score = Math.round(clamp(32 * Math.log1p(relative) + 68 * Math.min(1, Math.abs(pressure) / Math.max(1, churn)), 0, 100));
  return {
    ...value,
    pressure,
    churn,
    stackPullRatio: stack / Math.max(1, pull),
    velocity: churn / Math.max(0.001, durationMs / 1_000),
    score,
  };
}

export class PullingStackingEngine {
  private readonly book = new Map<number, BookRow>();
  private readonly seenTrades = new Set<number>();
  private readonly seenEvents = new Set<string>();
  private readonly buckets: PullingStackingBucket[] = [];
  private events: PullingStackingEvent[] = [];
  private activeBucketTimestamp = 0;
  private active = new Map<number, MutableMetrics>();
  private lastTimestamp = 0;
  private lastSequence = 0;
  private sequenceGap = false;

  reset() {
    this.book.clear(); this.seenTrades.clear(); this.seenEvents.clear(); this.buckets.length = 0;
    this.events = []; this.active.clear(); this.activeBucketTimestamp = 0; this.lastTimestamp = 0;
    this.lastSequence = 0; this.sequenceGap = false;
  }

  apply(snapshot: RithmicLiquiditySnapshot, rawSettings?: Partial<PullingStackingSettings>): PullingStackingFrame {
    const settings = normalizePullingStackingSettings(rawSettings as Record<string, number | string | boolean> | undefined);
    const parsedTimestamp = Date.parse(snapshot.asOf);
    const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();
    const tickSize = snapshot.tickSize > 0 ? snapshot.tickSize : 0.25;
    if (this.lastTimestamp && timestamp + settings.aggregationMs < this.lastTimestamp) return this.frame(snapshot, settings, this.lastTimestamp);
    this.lastTimestamp = Math.max(this.lastTimestamp, timestamp);
    this.rollBucket(timestamp, settings, snapshot, tickSize);

    const executions = new Map<string, number>();
    for (const trade of snapshot.trades ?? []) {
      if (this.seenTrades.has(trade.id)) continue;
      this.seenTrades.add(trade.id);
      const restingSide = trade.side === "BUY" ? "ASK" : "BID";
      const key = keyFor(restingSide, Math.round(trade.price / tickSize));
      executions.set(key, (executions.get(key) ?? 0) + trade.size);
    }
    const lifecycle = lifecycleDeltas(snapshot.orderEvents, tickSize, settings.moveHandling, this.seenEvents);
    const sequences = (snapshot.orderEvents ?? []).map((event) => event.sequence).filter((value) => value > 0).sort((a, b) => a - b);
    for (const sequence of sequences) {
      if (this.lastSequence > 0 && sequence > this.lastSequence + 1) this.sequenceGap = true;
      this.lastSequence = Math.max(this.lastSequence, sequence);
    }

    const nextBook = new Map<number, BookRow>();
    for (const level of snapshot.levels) {
      const tick = Math.round(level.price / tickSize);
      const row = nextBook.get(tick) ?? { bidSize: 0, askSize: 0, bidOrders: 0, askOrders: 0 };
      if (level.side === "BID") { row.bidSize = level.size; row.bidOrders = level.orders; }
      else { row.askSize = level.size; row.askOrders = level.orders; }
      nextBook.set(tick, row);
    }

    if (this.book.size > 0 && snapshot.bookValid) {
      const ticks = new Set([...this.book.keys(), ...nextBook.keys()]);
      for (const tick of ticks) {
        const previous = this.book.get(tick) ?? { bidSize: 0, askSize: 0, bidOrders: 0, askOrders: 0 };
        const next = nextBook.get(tick) ?? { bidSize: 0, askSize: 0, bidOrders: 0, askOrders: 0 };
        const row = this.active.get(tick) ?? emptyMutable();
        const bidKey = keyFor("BID", tick);
        const askKey = keyFor("ASK", tick);
        const bidExecution = executions.get(bidKey) ?? 0;
        const askExecution = executions.get(askKey) ?? 0;
        const useLifecycle = settings.classificationMode === "individual-order" && snapshot.individualOrders === true;
        const bidAddition = useLifecycle ? lifecycle.additions.get(bidKey) ?? 0 : Math.max(0, next.bidSize - previous.bidSize);
        const askAddition = useLifecycle ? lifecycle.additions.get(askKey) ?? 0 : Math.max(0, next.askSize - previous.askSize);
        const bidReduction = useLifecycle ? lifecycle.reductions.get(bidKey) ?? 0 : Math.max(0, previous.bidSize - next.bidSize);
        const askReduction = useLifecycle ? lifecycle.reductions.get(askKey) ?? 0 : Math.max(0, previous.askSize - next.askSize);
        row.bidStack += bidAddition;
        row.askStack += askAddition;
        row.bidPull += Math.max(0, bidReduction - bidExecution);
        row.askPull += Math.max(0, askReduction - askExecution);
        this.active.set(tick, row);
      }
    }
    this.book.clear();
    nextBook.forEach((row, tick) => this.book.set(tick, row));
    this.prune(settings, timestamp);
    return this.frame(snapshot, settings, timestamp);
  }

  private rollBucket(timestamp: number, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot, tickSize: number) {
    const bucketTimestamp = timestamp - (timestamp % settings.aggregationMs);
    if (!this.activeBucketTimestamp) { this.activeBucketTimestamp = bucketTimestamp; return; }
    if (bucketTimestamp <= this.activeBucketTimestamp) return;
    this.commitBucket(this.activeBucketTimestamp, settings, snapshot, tickSize);
    this.activeBucketTimestamp = bucketTimestamp;
    this.active = new Map();
  }

  private commitBucket(timestamp: number, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot, tickSize: number) {
    const historicalChurn = this.buckets.slice(-settings.baselineBuckets).map((bucket) => bucket.totals.churn).filter((value) => value > 0);
    const baseline = median(historicalChurn);
    const rows: PullingStackingRow[] = [];
    let totalsMutable = emptyMutable();
    for (const [tick, mutable] of this.active) {
      const metrics = metricsFromMutable(mutable, settings.aggregationMs, baseline);
      const book = this.book.get(tick) ?? { bidSize: 0, askSize: 0, bidOrders: 0, askOrders: 0 };
      const row = { tick, price: tick * tickSize, ...book, ...metrics };
      rows.push(row);
      totalsMutable = {
        bidStack: totalsMutable.bidStack + mutable.bidStack,
        askStack: totalsMutable.askStack + mutable.askStack,
        bidPull: totalsMutable.bidPull + mutable.bidPull,
        askPull: totalsMutable.askPull + mutable.askPull,
      };
      const values: Array<[PullingStackingEventKind, number]> = [
        ["BID_STACK", metrics.bidStack], ["ASK_STACK", metrics.askStack], ["BID_PULL", metrics.bidPull], ["ASK_PULL", metrics.askPull],
      ];
      for (const [kind, quantity] of values) {
        if (quantity < settings.minimumContracts || metrics.score < settings.scoreThreshold) continue;
        const wallBuild = (kind === "BID_STACK" || kind === "ASK_STACK") && quantity >= baseline * settings.relativeThreshold;
        const wallCollapse = (kind === "BID_PULL" || kind === "ASK_PULL") && quantity >= baseline * settings.relativeThreshold;
        const currentDepth = kind.startsWith("BID") ? book.bidSize : book.askSize;
        const liquidityVacuum = wallCollapse && currentDepth <= Math.max(1, quantity * 0.25);
        const priorOpposite = [...this.events].reverse().find((event) => event.tick === tick && event.kind !== kind && timestamp - event.timestamp <= 4_000);
        this.events.push({
          id: `${kind}:${tick}:${timestamp}`, timestamp, tick, price: tick * tickSize, kind, quantity,
          score: metrics.score, wallBuild, wallCollapse, liquidityVacuum,
          pullRepost: settings.pullRepostEnabled && Boolean(priorOpposite),
        });
      }
    }
    const totals = metricsFromMutable(totalsMutable, settings.aggregationMs, baseline);
    this.buckets.push({ timestamp, rows, totals });
    if (snapshot.bookValid && rows.length === 0) this.buckets.at(-1)!.totals = emptyMetrics();
  }

  private frame(snapshot: RithmicLiquiditySnapshot, settings: PullingStackingSettings, timestamp: number): PullingStackingFrame {
    const tickSize = snapshot.tickSize || 0.25;
    const historyChurn = this.buckets.slice(-settings.baselineBuckets).map((bucket) => bucket.totals.churn).filter((value) => value > 0);
    const baseline = median(historyChurn);
    const currentRows = [...this.book.entries()].map(([tick, book]) => {
      const current = metricsFromMutable(this.active.get(tick) ?? emptyMutable(), Math.max(1, timestamp - this.activeBucketTimestamp), baseline);
      return { tick, price: tick * tickSize, ...book, ...current };
    });
    const totalsMutable = [...this.active.values()].reduce((sum, value) => ({
      bidStack: sum.bidStack + value.bidStack,
      askStack: sum.askStack + value.askStack,
      bidPull: sum.bidPull + value.bidPull,
      askPull: sum.askPull + value.askPull,
    }), emptyMutable());
    const limitations = [
      "Aggressive executions are reconciled before non-executed reductions are classified as pulls.",
      ...(snapshot.individualOrders ? [] : ["Participant identity and individual queue ownership are not present; price-level mode is active."]),
      "The public browser feed does not identify implied orders, hidden liquidity, or the intent behind an order change.",
    ];
    return {
      timestamp,
      tickSize,
      contractSymbol: snapshot.contractSymbol,
      lastPrice: snapshot.lastPrice ?? snapshot.microPrice ?? null,
      bestBid: snapshot.bestBid ?? null,
      bestAsk: snapshot.bestAsk ?? null,
      fullDepth: snapshot.fullDepth,
      bookValid: snapshot.bookValid,
      individualOrders: snapshot.individualOrders === true,
      warmup: this.buckets.length < Math.min(5, settings.baselineBuckets),
      stale: (snapshot.ageMs ?? 0) > settings.staleAfterMs,
      sequenceGap: this.sequenceGap,
      rows: currentRows,
      buckets: [...this.buckets],
      events: [...this.events],
      totals: metricsFromMutable(totalsMutable, Math.max(1, timestamp - this.activeBucketTimestamp), baseline),
      limitations,
    };
  }

  private prune(settings: PullingStackingSettings, timestamp: number) {
    const cutoff = timestamp - settings.historySeconds * 1_000;
    while (this.buckets.length && this.buckets[0].timestamp < cutoff) this.buckets.shift();
    this.events = this.events.filter((event) => timestamp - event.timestamp <= settings.markerRetentionMs).slice(-settings.maximumEvents);
    if (this.seenTrades.size > 50_000) this.seenTrades.clear();
    if (this.seenEvents.size > 100_000) this.seenEvents.clear();
  }
}
