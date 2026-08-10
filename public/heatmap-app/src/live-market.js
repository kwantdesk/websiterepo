const REQUESTED_DEPTH_TICKS = 1000;
// 72 presentation frames per second lands on every second refresh of a
// 144 Hz panel (and naturally coalesces to one paint per refresh on 60 Hz
// panels). Full 23 KB order-book snapshots remain bounded upstream; these
// in-between columns are zero-order holds with no duplicated trades/events.
const DISPLAY_FRAME_MS = 1000 / 72;
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

// Depth sources that carry a genuine full order book. The Rithmic collector
// emits depth-by-order (true L3, individual exchange order ids and queue
// priority); Databento MBO is the original Kwantify source. Anything else -
// an aggregated ladder, a partial book - is refused rather than drawn, because
// a heatmap that silently renders L2 as if it were L3 is worse than a blank
// one: the shape looks authoritative and the queue detail simply is not there.
export const FULL_DEPTH_SOURCES = new Set([
  'databento-mbo',
  'rithmic-depth-by-order',
]);

export function isFullDepthSource(source) {
  return FULL_DEPTH_SOURCES.has(source);
}

// Micro contracts trade the same underlying as their e-mini parent, so the
// collector serves MNQ from the NQ book and answers with the parent root.
// Comparing roots literally would reject every snapshot on a micro tab.
const MICRO_PARENT_ROOTS = { MNQ: 'NQ', MES: 'ES', MYM: 'YM', M2K: 'RTY', MGC: 'GC', MCL: 'CL' };

export function symbolMatchesSnapshot(requested, snapshotRoot) {
  const want = String(requested || '').toUpperCase();
  const got = String(snapshotRoot || '').toUpperCase();
  if (!want || !got) return false;
  return got === want || got === (MICRO_PARENT_ROOTS[want] || want);
}

export function normalizeLiveSnapshot(raw) {
  if (!raw || !FULL_DEPTH_SOURCES.has(raw.source) || raw.readOnly !== true || raw.fullDepth !== true) return null;
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

export class DepthMarketFeed {
  constructor({ symbol = 'MNQ', contractSymbol = '', onSnapshot, onStatus, eventSourceFactory } = {}) {
    this.symbol = symbol;
    this.contractSymbol = contractSymbol;
    this.onSnapshot = onSnapshot;
    this.onStatus = onStatus;
    this.eventSourceFactory = eventSourceFactory || (url => new EventSource(url));
    this.stream = null;
    this.displayFrameTimer = null;
    this.presentationSnapshot = null;
    this.presentationHoldCount = 0;
    this.latestTradeTick = null;
    this.lastRealFrameAt = 0;
    this.observedRealFrameMs = 100;
    this.lastSnapshotToken = '';
    this.seenSnapshotIdentities = new Set();
    this.snapshotIdentityQueue = [];
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
    clearTimeout(this.displayFrameTimer);
    this.displayFrameTimer = null;
    this.presentationSnapshot = null;
    this.presentationHoldCount = 0;
    this.latestTradeTick = null;
    this.lastRealFrameAt = 0;
    this.observedRealFrameMs = 100;
    this.stream?.close();
    this.stream = null;
  }

  setSymbol(symbol, contractSymbol = '') {
    if (symbol === this.symbol && contractSymbol === this.contractSymbol) return;
    this.symbol = symbol;
    this.contractSymbol = contractSymbol;
    this.lastSnapshotToken = '';
    this.seenSnapshotIdentities.clear();
    this.snapshotIdentityQueue = [];
    clearTimeout(this.displayFrameTimer);
    this.displayFrameTimer = null;
    this.presentationSnapshot = null;
    this.presentationHoldCount = 0;
    this.latestTradeTick = null;
    this.lastRealFrameAt = 0;
    this.observedRealFrameMs = 100;
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
    stream.addEventListener('history', event => {
      const payload = JSON.parse(event.data || '{}');
      const payloadStatus = payload.status || {};
      this.status = {
        ...this.status,
        ...payloadStatus,
        connected: typeof payloadStatus.connected === 'boolean'
          ? payloadStatus.connected
          : true,
        historyFrames: Array.isArray(payload.snapshots) ? payload.snapshots.length : 0,
      };
      this.onStatus?.(this.status);
      // Replay the real server-side Rithmic window through the exact same
      // append path as a live frame. This restores the polished map instantly
      // after page navigation without inventing or interpolating liquidity.
      const snapshots = [];
      for (const rawSnapshot of payload.snapshots || []) {
        // Vercel rotates long-running proxy requests. EventSource then opens a
        // fresh request and the gateway sends its history window again. Do not
        // normalise and append the same (potentially thousands of) frames on
        // every reconnect: that synchronous replay blocks the browser and made
        // the whole liquidity map appear frozen after a few minutes.
        if (this.#hasSeenRawSnapshot(rawSnapshot)) continue;
        const snapshot = normalizeLiveSnapshot(rawSnapshot);
        const token = snapshotBookToken(snapshot);
        if (snapshot && token !== this.lastSnapshotToken) {
          this.lastSnapshotToken = token;
          this.#rememberSnapshot(snapshot);
          snapshots.push(snapshot);
        }
      }
      snapshots.forEach((snapshot, index) => {
        this.onSnapshot?.(snapshot, {
          historical: true,
          final: index === snapshots.length - 1,
        });
      });
    });
    stream.addEventListener('depth', event => {
      const payload = JSON.parse(event.data || '{}');
      const payloadStatus = payload.status || {};
      this.status = {
        ...this.status,
        ...payloadStatus,
        // An open SSE socket is not proof that the exchange book is fresh.
        // Preserve the gateway's explicit stale state for weekends, halts and
        // interrupted market data instead of relabelling every frame LIVE.
        connected: typeof payloadStatus.connected === 'boolean'
          ? payloadStatus.connected
          : true,
      };
      this.onStatus?.(this.status);
      const snapshot = normalizeLiveSnapshot(payload.snapshot);
      const token = snapshotBookToken(snapshot);
      if (snapshot && token !== this.lastSnapshotToken) {
        this.latestTradeTick = snapshot.lastTick;
        this.lastSnapshotToken = token;
        this.#rememberSnapshot(snapshot);
        const arrivedAt = performance.now();
        if (this.lastRealFrameAt > 0) {
          const interval = arrivedAt - this.lastRealFrameAt;
          this.observedRealFrameMs = this.observedRealFrameMs * 0.65 + interval * 0.35;
        }
        this.lastRealFrameAt = arrivedAt;
        this.onSnapshot?.(snapshot);
        this.#paceDisplay(snapshot);
      }
    });
    stream.addEventListener('tick', event => {
      const payload = JSON.parse(event.data || '{}');
      const tick = finite(payload.tick, Number.NaN);
      if (!Number.isFinite(tick)) return;
      this.latestTradeTick = tick;
      if (this.presentationSnapshot) {
        this.presentationSnapshot = {
          ...this.presentationSnapshot,
          lastTick: tick,
        };
      }
    });
    stream.onerror = () => {
      this.status = {
        ...this.status,
        connected: false,
        message: 'Depth stream reconnecting',
      };
      this.onStatus?.(this.status);
    };
  }

  #rawSnapshotIdentity(raw) {
    if (!raw) return '';
    const id = finite(raw.id, Number.NaN);
    const timestamp = finite(raw.timestamp, Number.NaN);
    if (!Number.isFinite(id) || !Number.isFinite(timestamp)) return '';
    return `${id}:${timestamp}`;
  }

  #snapshotIdentity(snapshot) {
    if (!snapshot) return '';
    return `${snapshot.id}:${snapshot.timestamp}`;
  }

  #hasSeenRawSnapshot(raw) {
    const identity = this.#rawSnapshotIdentity(raw);
    return Boolean(identity && this.seenSnapshotIdentities.has(identity));
  }

  #rememberSnapshot(snapshot) {
    const identity = this.#snapshotIdentity(snapshot);
    if (!identity || this.seenSnapshotIdentities.has(identity)) return;
    this.seenSnapshotIdentities.add(identity);
    this.snapshotIdentityQueue.push(identity);
    // Keep enough identities to span several gateway history windows without
    // allowing a permanently open map tab to grow memory without bound.
    while (this.snapshotIdentityQueue.length > 10_000) {
      const expired = this.snapshotIdentityQueue.shift();
      if (expired) this.seenSnapshotIdentities.delete(expired);
    }
  }

  #paceDisplay(snapshot) {
    clearTimeout(this.displayFrameTimer);
    this.presentationSnapshot = snapshot;
    this.presentationHoldCount = 0;
    const emitHold = () => {
      if (!this.running || !this.status.connected || !this.presentationSnapshot) return;
      // Do not burn CPU in a background tab. The genuine stream remains open;
      // presentation resumes from the newest real frame when the tab returns.
      if (typeof document !== 'undefined' && document.hidden) {
        this.displayFrameTimer = setTimeout(emitHold, 120);
        return;
      }
      this.presentationHoldCount += 1;
      const elapsed = Math.max(
        DISPLAY_FRAME_MS,
        performance.now() - this.lastRealFrameAt,
      );
      const held = this.presentationSnapshot;
      // Zero-order hold: the exchange book remains at its last known state
      // until the next genuine snapshot. Trades, volume and event counts are
      // deliberately empty so visual pacing can never duplicate market data.
      this.onSnapshot?.({
        ...held,
        id: held.id + Math.min(0.9999, this.presentationHoldCount / 10_000),
        timestamp: Math.min(Date.now(), held.timestamp + elapsed),
        lastTick: this.latestTradeTick ?? held.lastTick,
        trades: [],
        volume: 0,
        delta: 0,
        eventsSince: 0,
        visualHold: true,
      }, { visualHold: true });
      this.displayFrameTimer = setTimeout(emitHold, DISPLAY_FRAME_MS);
    };
    this.displayFrameTimer = setTimeout(emitHold, DISPLAY_FRAME_MS);
  }
}
