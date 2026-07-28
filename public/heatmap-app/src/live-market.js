const REQUESTED_DEPTH_TICKS = 1000;
export const INSTITUTIONAL_MARKET_DATA_ORIGIN = '/api/institutional-market-data';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function liveDepthStreamUrl(symbol = 'MNQ', contractSymbol = '') {
  const query = new URLSearchParams({
    depthTicks: String(REQUESTED_DEPTH_TICKS),
    symbol,
  });
  if (contractSymbol) query.set('contractSymbol', contractSymbol);
  return `${INSTITUTIONAL_MARKET_DATA_ORIGIN}/v1/heatmap/stream?${query}`;
}

export function normalizeBookLevels(rawLevels) {
  const levels = new Map();
  const orders = new Map();
  for (const rawLevel of rawLevels || []) {
    if (!Array.isArray(rawLevel) || rawLevel.length < 2) continue;
    const tick = finite(rawLevel[0], Number.NaN);
    const size = finite(rawLevel[1]);
    const orderCount = Math.max(0, Math.round(finite(rawLevel[2])));
    if (!Number.isFinite(tick)) continue;
    if (size > 0) {
      levels.set(tick, size);
      orders.set(tick, orderCount);
    }
  }
  return { levels, orders };
}

export function snapshotBookToken(snapshot) {
  if (!snapshot) return '';
  let hash = 2166136261;
  const mix = value => {
    hash ^= Math.round(finite(value) * 1000);
    hash = Math.imul(hash, 16777619);
  };
  mix(snapshot.id);
  mix(snapshot.timestamp);
  for (const side of [snapshot.bids, snapshot.asks]) {
    for (const [tick, size] of side || []) {
      mix(tick);
      mix(size);
    }
    mix(-1);
  }
  return `${snapshot.id}:${snapshot.timestamp}:${hash >>> 0}`;
}

export function normalizeLiveSnapshot(raw) {
  const supportedSource = raw?.source === 'databento-mbo' || raw?.source === 'rithmic-depth-by-order';
  if (!raw || !supportedSource || raw.readOnly !== true || raw.fullDepth !== true) return null;
  const bidBook = normalizeBookLevels(raw.bids);
  const askBook = normalizeBookLevels(raw.asks);
  if (!bidBook.levels.size || !askBook.levels.size) return null;
  const bestBid = finite(raw.bestBid, Math.max(...bidBook.levels.keys()));
  const bestAsk = finite(raw.bestAsk, Math.min(...askBook.levels.keys()));
  return {
    id: finite(raw.id),
    timestamp: finite(raw.timestamp, Date.now()),
    symbol: String(raw.root || ''),
    contractSymbol: String(raw.contractSymbol || ''),
    tickSize: finite(raw.tickSize, 0.25),
    bids: bidBook.levels,
    asks: askBook.levels,
    bidOrders: bidBook.orders,
    askOrders: askBook.orders,
    bestBid,
    bestAsk,
    midTick: finite(raw.midTick, (bestBid + bestAsk) / 2),
    lastTick: finite(raw.lastTick, (bestBid + bestAsk) / 2),
    trades: (raw.trades || []).map(trade => ({
      id: finite(trade.id),
      timestamp: finite(trade.timestamp, raw.timestamp),
      tick: finite(trade.tick),
      size: finite(trade.size),
      side: trade.side === 'sell' ? 'sell' : 'buy',
    })),
    cvd: finite(raw.cvd),
    delta: finite(raw.delta),
    volume: finite(raw.volume),
    totalVolume: finite(raw.totalVolume),
    imbalance: {
      bid: finite(raw.imbalance?.bid),
      ask: finite(raw.imbalance?.ask),
      ratio: finite(raw.imbalance?.ratio, 0.5),
    },
    microTick: finite(raw.microTick, (bestBid + bestAsk) / 2),
    maxDepth: finite(raw.maxDepth),
    wallCount: finite(raw.wallCount),
    orderCount: finite(raw.orderCount),
    tradeRate: finite(raw.tradeRate),
    sweepScore: finite(raw.sweepScore),
    absorptionScore: finite(raw.absorptionScore),
    changeTicks: finite(raw.changeTicks),
    latencyMs: finite(raw.latencyMs),
    eventsSince: finite(raw.eventsSince, 1),
    source: raw.source,
    fullDepth: true,
    readOnly: true,
  };
}

export class DatabentoDepthMarket {
  constructor({ symbol = 'MNQ', contractSymbol = '', onSnapshot, onStatus, eventSourceFactory } = {}) {
    this.symbol = symbol;
    this.contractSymbol = contractSymbol;
    this.onSnapshot = onSnapshot;
    this.onStatus = onStatus;
    this.eventSourceFactory = eventSourceFactory || (url => new EventSource(url));
    this.stream = null;
    this.lastSnapshotToken = '';
    this.running = false;
    this.status = {
      connected: false,
      readOnly: true,
      trading: false,
      levels: 0,
      depthMode: 'CONNECTING',
      fullDepth: false,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.#connect();
  }

  stop() {
    this.running = false;
    this.stream?.close();
    this.stream = null;
  }

  setSymbol(symbol, contractSymbol = '') {
    if (symbol === this.symbol && contractSymbol === this.contractSymbol) return;
    this.symbol = symbol;
    this.contractSymbol = contractSymbol;
    this.lastSnapshotToken = '';
    this.stream?.close();
    this.stream = null;
    this.status = {
      ...this.status,
      connected: false,
      levels: 0,
      depthMode: 'CONNECTING',
      fullDepth: false,
      contractSymbol,
    };
    this.onStatus?.(this.status);
    if (this.running) this.#connect();
  }

  #connect() {
    const stream = this.eventSourceFactory(liveDepthStreamUrl(this.symbol, this.contractSymbol));
    this.stream = stream;
    stream.onopen = () => {
      this.status = { ...this.status, connected: true };
      this.onStatus?.(this.status);
    };
    stream.addEventListener('status', event => {
      this.status = { ...this.status, ...JSON.parse(event.data || '{}') };
      this.onStatus?.(this.status);
    });
    stream.addEventListener('depth', event => {
      const payload = JSON.parse(event.data || '{}');
      this.status = { ...this.status, ...(payload.status || {}), connected: true };
      this.onStatus?.(this.status);
      const snapshot = normalizeLiveSnapshot(payload.snapshot);
      const token = snapshotBookToken(snapshot);
      if (snapshot && token !== this.lastSnapshotToken) {
        this.lastSnapshotToken = token;
        this.onSnapshot?.(snapshot);
      }
    });
    stream.onerror = () => {
      this.status = {
        ...this.status,
        connected: false,
        message: 'Databento depth stream reconnecting',
      };
      this.onStatus?.(this.status);
    };
  }
}
