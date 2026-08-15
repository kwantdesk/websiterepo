import type {
  RithmicLiquiditySnapshot,
  RithmicOrderLifecycleEvent,
} from "@/lib/structureLevels";

export const DOM_PRO_SETTINGS_VERSION = 4;

export type DomProColumnId =
  | "buy"
  | "sell"
  | "bid"
  | "price"
  | "ask"
  | "trades"
  | "orders"
  | "cob"
  | "pullStack";

export type DomProColumn = {
  id: DomProColumnId;
  label: string;
  width: number;
  enabled: boolean;
};

export type DomProSettings = {
  version: number;
  preset: "scalper" | "order-flow" | "minimal" | "custom";
  rows: number;
  rowHeight: number;
  fontSize: number;
  refreshRateMs: number;
  recentWindowMs: number;
  autoCenter: boolean;
  compactNumbers: boolean;
  useThemeColors: boolean;
  showHistogram: boolean;
  showHeaderStats: boolean;
  showImbalance: boolean;
  depthScaleCap: number;
  highlightThreshold: number;
  columns: DomProColumn[];
};

export type DomProTrade = {
  id: number;
  timestamp: number;
  tick: number;
  size: number;
  side: "BUY" | "SELL";
};

export type DomProOrder = {
  orderId: string;
  side: "BID" | "ASK";
  tick: number;
  size: number;
  timestamp: number;
};

export type DomProLevel = {
  tick: number;
  bidSize: number;
  askSize: number;
  bidOrders: number;
  askOrders: number;
  bidAdded: number;
  askAdded: number;
  bidRemoved: number;
  askRemoved: number;
  buyVolume: number;
  sellVolume: number;
};

export type DomProCapabilities = {
  fullDepth: boolean;
  mbo: boolean;
  exactQueue: boolean;
  ownOrders: boolean;
  trading: boolean;
};

export type DomProState = {
  tickSize: number;
  levels: Map<number, DomProLevel>;
  orders: Map<string, DomProOrder>;
  trades: DomProTrade[];
  bestBidTick: number | null;
  bestAskTick: number | null;
  lastTick: number | null;
  lastSequence: number | null;
  staleReason: string | null;
  snapshotComplete: boolean;
  capabilities: DomProCapabilities;
};

const DEFAULT_COLUMNS: DomProColumn[] = [
  { id: "buy", label: "BUY", width: 100, enabled: true },
  { id: "sell", label: "SELL", width: 100, enabled: true },
  { id: "bid", label: "BID", width: 100, enabled: true },
  { id: "price", label: "PR", width: 100, enabled: true },
  { id: "ask", label: "ASK", width: 100, enabled: true },
  { id: "trades", label: "T", width: 100, enabled: true },
  { id: "orders", label: "ORD", width: 82, enabled: false },
  { id: "cob", label: "COB", width: 82, enabled: false },
  { id: "pullStack", label: "P/S", width: 82, enabled: false },
];

export const DEFAULT_DOM_PRO_SETTINGS: DomProSettings = {
  version: DOM_PRO_SETTINGS_VERSION,
  preset: "order-flow",
  rows: 20,
  rowHeight: 24,
  fontSize: 10,
  refreshRateMs: 32,
  recentWindowMs: 8_000,
  autoCenter: true,
  compactNumbers: true,
  useThemeColors: true,
  showHistogram: true,
  showHeaderStats: true,
  showImbalance: true,
  depthScaleCap: 0,
  highlightThreshold: 0,
  columns: DEFAULT_COLUMNS,
};

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function domProSettingsFromRecord(record: Record<string, unknown> | undefined): DomProSettings {
  const source = record ?? {};
  const storedColumns = typeof source.domColumns === "string"
    ? (() => {
        try {
          return JSON.parse(source.domColumns) as Array<Partial<DomProColumn>>;
        } catch {
          return [];
        }
      })()
    : [];
  const columns = DEFAULT_COLUMNS.map((fallback) => {
    const stored = storedColumns.find((column) => column.id === fallback.id);
    return {
      ...fallback,
      enabled: bool(stored?.enabled, fallback.enabled),
      width: Math.max(54, Math.min(260, Math.round(finite(stored?.width, fallback.width)))),
    };
  });
  return {
    ...DEFAULT_DOM_PRO_SETTINGS,
    version: DOM_PRO_SETTINGS_VERSION,
    preset: (["scalper", "order-flow", "minimal", "custom"].includes(String(source.domPreset))
      ? String(source.domPreset)
      : "order-flow") as DomProSettings["preset"],
    rows: Math.max(10, Math.min(120, Math.round(finite(source.rows, 20)))),
    rowHeight: Math.max(16, Math.min(42, Math.round(finite(source.rowHeight, 24)))),
    fontSize: Math.max(8, Math.min(15, finite(source.fontSize, 10))),
    refreshRateMs: Math.max(16, Math.min(1_000, Math.round(finite(source.refreshRateMs, 32)))),
    recentWindowMs: Math.max(250, Math.min(60_000, Math.round(finite(source.recentWindowMs, 8_000)))),
    autoCenter: bool(source.autoCenter, true),
    compactNumbers: bool(source.compactNumbers, true),
    useThemeColors: bool(source.useThemeColors, true),
    showHistogram: bool(source.showDepthHistogram, true),
    showHeaderStats: bool(source.showHeaderStats, true),
    showImbalance: bool(source.showImbalance, true),
    depthScaleCap: Math.max(0, finite(source.depthScaleCap, 0)),
    highlightThreshold: Math.max(0, finite(source.highlightThreshold, 0)),
    columns,
  };
}

export function domProPreset(
  preset: Exclude<DomProSettings["preset"], "custom">,
  current = DEFAULT_DOM_PRO_SETTINGS,
): DomProSettings {
  const enabled = preset === "minimal"
    ? new Set<DomProColumnId>(["bid", "price", "ask"])
    : preset === "scalper"
      ? new Set<DomProColumnId>(["buy", "sell", "bid", "price", "ask", "trades", "orders"])
      : new Set<DomProColumnId>(["buy", "sell", "bid", "price", "ask", "trades"]);
  return {
    ...current,
    preset,
    rows: preset === "scalper" ? 28 : preset === "minimal" ? 20 : 20,
    columns: current.columns.map((column) => ({ ...column, enabled: enabled.has(column.id) })),
  };
}

export function createDomProState(tickSize = 0.25): DomProState {
  return {
    tickSize,
    levels: new Map(),
    orders: new Map(),
    trades: [],
    bestBidTick: null,
    bestAskTick: null,
    lastTick: null,
    lastSequence: null,
    staleReason: null,
    snapshotComplete: false,
    capabilities: {
      fullDepth: false,
      mbo: false,
      exactQueue: false,
      ownOrders: false,
      trading: false,
    },
  };
}

function emptyLevel(tick: number): DomProLevel {
  return {
    tick,
    bidSize: 0,
    askSize: 0,
    bidOrders: 0,
    askOrders: 0,
    bidAdded: 0,
    askAdded: 0,
    bidRemoved: 0,
    askRemoved: 0,
    buyVolume: 0,
    sellVolume: 0,
  };
}

function getLevel(state: DomProState, tick: number) {
  const current = state.levels.get(tick);
  if (current) return current;
  const next = emptyLevel(tick);
  state.levels.set(tick, next);
  return next;
}

function rebuildInsideMarket(state: DomProState) {
  let bestBid: number | null = null;
  let bestAsk: number | null = null;
  for (const level of state.levels.values()) {
    if (level.bidSize > 0 && (bestBid === null || level.tick > bestBid)) bestBid = level.tick;
    if (level.askSize > 0 && (bestAsk === null || level.tick < bestAsk)) bestAsk = level.tick;
  }
  state.bestBidTick = bestBid;
  state.bestAskTick = bestAsk;
}

function removeOrderContribution(state: DomProState, order: DomProOrder) {
  const level = getLevel(state, order.tick);
  if (order.side === "BID") {
    level.bidSize = Math.max(0, level.bidSize - order.size);
    level.bidOrders = Math.max(0, level.bidOrders - 1);
    level.bidRemoved += order.size;
  } else {
    level.askSize = Math.max(0, level.askSize - order.size);
    level.askOrders = Math.max(0, level.askOrders - 1);
    level.askRemoved += order.size;
  }
}

function addOrderContribution(state: DomProState, order: DomProOrder) {
  const level = getLevel(state, order.tick);
  if (order.side === "BID") {
    level.bidSize += order.size;
    level.bidOrders += 1;
    level.bidAdded += order.size;
  } else {
    level.askSize += order.size;
    level.askOrders += 1;
    level.askAdded += order.size;
  }
}

export function applyDomProOrderEvent(state: DomProState, event: RithmicOrderLifecycleEvent) {
  if (event.sequence > 0 && state.lastSequence !== null && event.sequence !== state.lastSequence + 1) {
    state.staleReason = `Sequence gap ${state.lastSequence} → ${event.sequence}`;
    state.snapshotComplete = false;
    return state;
  }
  if (event.sequence > 0) state.lastSequence = event.sequence;
  if (!event.orderId) return state;
  const previous = state.orders.get(event.orderId);
  if (previous) {
    removeOrderContribution(state, previous);
    state.orders.delete(event.orderId);
  }
  if (event.action !== "REMOVE" && event.size > 0) {
    const next: DomProOrder = {
      orderId: event.orderId,
      side: event.side,
      tick: Math.round(event.price / state.tickSize),
      size: event.size,
      timestamp: event.timestamp,
    };
    state.orders.set(event.orderId, next);
    addOrderContribution(state, next);
  }
  rebuildInsideMarket(state);
  return state;
}

export function applyDomProSnapshot(
  previous: DomProState,
  snapshot: RithmicLiquiditySnapshot,
  now = Date.now(),
): DomProState {
  const tickSize = snapshot.tickSize > 0 ? snapshot.tickSize : previous.tickSize;
  const next = createDomProState(tickSize);
  next.capabilities = {
    fullDepth: Boolean(snapshot.fullDepth),
    mbo: Boolean(snapshot.individualOrders),
    exactQueue: Boolean(snapshot.individualOrders),
    ownOrders: false,
    trading: false,
  };
  next.snapshotComplete = Boolean(snapshot.bookValid);
  next.staleReason = snapshot.bookValid ? null : "Waiting for a valid exchange snapshot";
  for (const input of snapshot.levels) {
    const tick = Math.round(input.price / tickSize);
    const level = getLevel(next, tick);
    if (input.side === "BID") {
      level.bidSize += Math.max(0, input.size);
      level.bidOrders += Math.max(0, input.orders);
      level.bidAdded += Math.max(0, input.addedSize);
      level.bidRemoved += Math.max(0, input.removedSize);
    } else {
      level.askSize += Math.max(0, input.size);
      level.askOrders += Math.max(0, input.orders);
      level.askAdded += Math.max(0, input.addedSize);
      level.askRemoved += Math.max(0, input.removedSize);
    }
  }
  const mergedTrades = [
    ...previous.trades.filter((trade) => now - trade.timestamp <= 60_000),
    ...(snapshot.trades ?? []).map((trade) => ({
      ...trade,
      tick: Math.round(trade.price / tickSize),
    })),
  ];
  const seenTradeIds = new Set<number>();
  for (const trade of mergedTrades) {
    if (now - trade.timestamp > 60_000) continue;
    if (seenTradeIds.has(trade.id)) continue;
    seenTradeIds.add(trade.id);
    const tick = trade.tick;
    next.trades.push({ id: trade.id, timestamp: trade.timestamp, size: trade.size, side: trade.side, tick });
    const level = getLevel(next, tick);
    if (trade.side === "BUY") level.buyVolume += trade.size;
    else level.sellVolume += trade.size;
  }
  next.lastTick = snapshot.lastPrice == null ? previous.lastTick : Math.round(snapshot.lastPrice / tickSize);
  next.bestBidTick = snapshot.bestBid == null ? null : Math.round(snapshot.bestBid / tickSize);
  next.bestAskTick = snapshot.bestAsk == null ? null : Math.round(snapshot.bestAsk / tickSize);
  if (next.bestBidTick === null || next.bestAskTick === null) rebuildInsideMarket(next);
  // The gateway's aggregate snapshot remains authoritative. Lifecycle events
  // are consumed by applyDomProOrderEvent in event/replay mode; applying them
  // on top of an already-current aggregate snapshot would double-count depth.
  return next;
}

export function visibleDomProRows(args: {
  state: DomProState;
  rowCount: number;
  centreTick?: number | null;
  offsetTicks?: number;
  recentWindowMs?: number;
  now?: number;
}) {
  const { state } = args;
  const rowCount = Math.max(1, Math.round(args.rowCount));
  const centreTick = args.centreTick
    ?? state.lastTick
    ?? (state.bestBidTick !== null && state.bestAskTick !== null
      ? Math.round((state.bestBidTick + state.bestAskTick) / 2)
      : state.bestBidTick ?? state.bestAskTick ?? 0);
  const offset = Math.round(args.offsetTicks ?? 0);
  const topTick = centreTick + offset + Math.floor(rowCount / 2);
  const cutoff = (args.now ?? Date.now()) - (args.recentWindowMs ?? 8_000);
  const recentByTick = new Map<number, { buy: number; sell: number }>();
  for (const trade of state.trades) {
    if (trade.timestamp < cutoff) continue;
    const current = recentByTick.get(trade.tick) ?? { buy: 0, sell: 0 };
    if (trade.side === "BUY") current.buy += trade.size;
    else current.sell += trade.size;
    recentByTick.set(trade.tick, current);
  }
  return Array.from({ length: rowCount }, (_, index) => {
    const tick = topTick - index;
    const level = state.levels.get(tick) ?? emptyLevel(tick);
    const recent = recentByTick.get(tick) ?? { buy: 0, sell: 0 };
    return {
      ...level,
      buyVolume: recent.buy,
      sellVolume: recent.sell,
      price: tick * state.tickSize,
      atBid: tick === state.bestBidTick,
      atAsk: tick === state.bestAskTick,
      atLast: tick === state.lastTick,
    };
  });
}
