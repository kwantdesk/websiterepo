// The rendered viewport normally exposes roughly 100-180 price rows. Asking
// the proxy for 1,000 rows per frame flooded a browser with more than 1 MB/s
// and a 9 MB synchronous history event. Keep a generous off-screen buffer
// without transporting levels the user cannot display.
const REQUESTED_DEPTH_TICKS = 320;
const STREAM_WATCHDOG_INTERVAL_MS = 2_000;
const STREAM_SILENCE_RECONNECT_MS = 13_000;
const MARKET_FRAME_PROBE_MS = 8_000;
// Vercel terminates the same-origin SSE proxy after roughly five minutes.
// Rotate before that hard edge so the replacement connection is deliberate
// instead of waiting for a half-closed EventSource to notice the failure.
const STREAM_LEASE_MS = 240_000;
// The lightweight tick channel is only a presentation aid between complete
// order-book frames. A malformed tick (for example, a price instead of a tick
// index or a late event from another contract) must never be allowed to throw
// the camera hundreds of points away and then snap it back on the next book.
const MAX_PRESENTATION_TICK_JUMP = 128;
const SNAPSHOT_IDENTITY_CAPACITY = 2048;
export const INSTITUTIONAL_MARKET_DATA_ORIGIN = '/api/institutional-market-data';

export function liveInstrumentCatalogUrl() {
  return `${INSTITUTIONAL_MARKET_DATA_ORIGIN}/v1/market-data/catalog`;
}

export function liveInstrumentResolveUrl(symbol, exchange = '') {
  const query = new URLSearchParams({ symbol: String(symbol || '').toUpperCase() });
  if (exchange) query.set('exchange', String(exchange).toUpperCase());
  return `${INSTITUTIONAL_MARKET_DATA_ORIGIN}/v1/market-data/resolve?${query}`;
}

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function isPlausiblePresentationTick(value, snapshot) {
  const tick = finite(value, Number.NaN);
  const reference = finite(snapshot?.lastTick, finite(snapshot?.midTick, Number.NaN));
  return Number.isFinite(tick)
    && tick > 0
    && Number.isFinite(reference)
    && Math.abs(tick - reference) <= MAX_PRESENTATION_TICK_JUMP;
}

export function liveDepthStreamUrl(symbol = 'MNQ', contractSymbol = '', afterTimestamp = 0, exchange = '') {
  const query = new URLSearchParams({
    depthTicks: String(REQUESTED_DEPTH_TICKS),
    symbol,
  });
  if (contractSymbol) query.set('contractSymbol', contractSymbol);
  if (exchange) query.set('exchange', String(exchange).toUpperCase());
  if (Number(afterTimestamp) > 0) query.set('afterTimestamp', String(Math.floor(Number(afterTimestamp))));
  return `${INSTITUTIONAL_MARKET_DATA_ORIGIN}/v1/heatmap/stream?${query}`;
}

export function liveDepthSnapshotUrl(symbol = 'MNQ', contractSymbol = '', exchange = '') {
  const query = new URLSearchParams({
    depthTicks: String(REQUESTED_DEPTH_TICKS),
    symbol,
  });
  if (contractSymbol) query.set('contractSymbol', contractSymbol);
  if (exchange) query.set('exchange', String(exchange).toUpperCase());
  return `${INSTITUTIONAL_MARKET_DATA_ORIGIN}/v1/heatmap/snapshot?${query}`;
}

export function normalizeBookLevels(rawLevels) {
  const ticks = [];
  const sizes = [];
  const orderCounts = [];
  for (const rawLevel of rawLevels || []) {
    if (!Array.isArray(rawLevel) || rawLevel.length < 2) continue;
    const tick = finite(rawLevel[0], Number.NaN);
    const size = finite(rawLevel[1]);
    const orderCount = Math.max(0, Math.round(finite(rawLevel[2])));
    if (!Number.isFinite(tick)) continue;
    if (size > 0) {
      ticks.push(tick);
      sizes.push(size);
      orderCounts.push(orderCount);
    }
  }
  const packedTicks = Float64Array.from(ticks);
  return {
    levels: new PackedBook(packedTicks, Float64Array.from(sizes)),
    orders: new PackedBook(packedTicks, Uint32Array.from(orderCounts)),
  };
}

// A native Map allocates a hash node plus several JS objects for every price
// level. Retaining thousands of 320-level depth frames therefore grew one LIQ
// MAP into hundreds of megabytes and forced stop-the-world garbage collection
// every few seconds. The book is read-mostly, so packed numeric arrays provide
// the same Map-like API at a fraction of the heap cost.
export class PackedBook {
  constructor(ticks = new Float64Array(), values = new Float64Array()) {
    this.ticks = ticks;
    this.values = values;
  }

  get size() { return this.ticks.length; }

  get(tick) {
    const wanted = Number(tick);
    for (let index = 0; index < this.ticks.length; index += 1) {
      if (this.ticks[index] === wanted) return this.values[index];
    }
    return undefined;
  }

  has(tick) { return this.get(tick) !== undefined; }

  forEachLevel(callback) {
    for (let index = 0; index < this.ticks.length; index += 1) {
      callback(this.ticks[index], this.values[index]);
    }
  }

  *keys() {
    for (let index = 0; index < this.ticks.length; index += 1) yield this.ticks[index];
  }

  *[Symbol.iterator]() {
    for (let index = 0; index < this.ticks.length; index += 1) {
      yield [this.ticks[index], this.values[index]];
    }
  }

  entries() { return this[Symbol.iterator](); }
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
const MICRO_PARENT_ROOTS = {
  MNQ: 'NQ', MES: 'ES', MYM: 'YM', M2K: 'RTY', MGC: 'GC', MCL: 'CL',
  SIL: 'SI', QG: 'NG', M6E: '6E', M6B: '6B', M6A: '6A', MBT: 'BTC', MET: 'ETH',
};

export const LIQUIDITY_MAP_ROOTS = [
  'NQ', 'ES', 'RTY', 'YM',
  'CL', 'QM', 'NG', 'RB', 'HO',
  'GC', 'SI', 'HG', 'PL', 'PA',
  'ZN', 'TN', 'ZB', 'UB', 'ZF', 'ZT', '10Y', 'SR3',
  '6E', '6J', '6B', '6A', '6C', '6S', '6N', '6M',
  'BTC', 'ETH',
  'ZC', 'ZS', 'ZW', 'ZM', 'ZL', 'LE', 'HE', 'GF',
];
export const LIQUIDITY_MAP_SYMBOLS = new Set(LIQUIDITY_MAP_ROOTS);

export function normalizeLiquidityMapSymbol(value) {
  const root = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\.[VNC]\.\d+$/i, '')
    .replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, '');
  const parent = MICRO_PARENT_ROOTS[root] || root;
  return LIQUIDITY_MAP_SYMBOLS.has(parent) ? parent : '';
}

export function symbolMatchesSnapshot(requested, snapshotRoot) {
  const want = String(requested || '').toUpperCase();
  const got = String(snapshotRoot || '').toUpperCase();
  if (!want || !got) return false;
  return got === want || got === (MICRO_PARENT_ROOTS[want] || want);
}

/*
 * The tightest pair that is not crossed.
 *
 * A resting ask below the best bid would already have traded, so a crossed
 * inside market is a level the book never removed - not a real quote. Measured
 * live on NQ: the ask stack was correct from tick 118590 up, while two phantom
 * asks sat at 118156 and 118214, about a hundred points BELOW the market. Both
 * the collector and this file pick the inside market with a plain min/max, so
 * one of those phantoms became bestAsk - reported ~400 ticks below bestBid.
 * The ask trail was then drawn far off the bottom of the plot and the map
 * showed a single line where it draws two.
 *
 * The last trade is the referee, because it comes from the tape rather than
 * from the book: the inside market is the tightest pair straddling it. Nothing
 * is repaired unless the book is actually crossed, so a normal snapshot takes
 * exactly the values the collector sent.
 *
 * This corrects the DISPLAY of a book the collector already published crossed.
 * The stale orders themselves are the collector's to drop.
 */
export function insideMarket(bidLevels, askLevels, rawBid, rawAsk, lastTick) {
  if (!(rawBid >= rawAsk)) return { bid: rawBid, ask: rawAsk };
  if (!Number.isFinite(lastTick)) return { bid: rawBid, ask: rawAsk };
  let bid = -Infinity;
  let ask = Infinity;
  for (const tick of bidLevels.keys()) if (tick <= lastTick && tick > bid) bid = tick;
  for (const tick of askLevels.keys()) if (tick >= lastTick && tick < ask) ask = tick;
  // A side with nothing on the trade's own side of the book keeps what it had;
  // inventing a level would be worse than showing the collector's own number.
  return {
    bid: Number.isFinite(bid) ? bid : rawBid,
    ask: Number.isFinite(ask) ? ask : rawAsk,
  };
}

/**
 * How far back of the collector's trade buffer belongs to THIS frame.
 *
 * A snapshot carries the gateway's rolling tape - up to a couple of thousand
 * prints - and every one of them was being pinned to the single frame that
 * happened to carry them. On a busy book that is invisible, because the next
 * frame arrives before anyone looks. On a quiet one it is the whole picture:
 * measured on gold, 300 frames held trades in FIVE of them, 220 prints stacked
 * into a single column while the other 295 columns were empty.
 *
 * A print belongs to the moment it happened, so only the ones inside this
 * frame's own window are attached to it. The rest already have frames of their
 * own, or belong to minutes the map was not watching - and a bubble drawn in
 * the wrong column is worse than one not drawn at all.
 */
const TRADE_FRAME_WINDOW_MS = 1_500;

export function normalizeLiveSnapshot(raw) {
  if (!raw || !FULL_DEPTH_SOURCES.has(raw.source) || raw.readOnly !== true || raw.fullDepth !== true) return null;
  const bidBook = normalizeBookLevels(raw.bids);
  const askBook = normalizeBookLevels(raw.asks);
  if (!bidBook.levels.size || !askBook.levels.size) return null;
  const inside = insideMarket(
    bidBook.levels,
    askBook.levels,
    finite(raw.bestBid, Math.max(...bidBook.levels.keys())),
    finite(raw.bestAsk, Math.min(...askBook.levels.keys())),
    finite(raw.lastTick, Number.NaN),
  );
  const bestBid = inside.bid;
  const bestAsk = inside.ask;
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
    trades: (raw.trades || [])
      .map(trade => ({
        id: finite(trade.id),
        timestamp: finite(trade.timestamp, raw.timestamp),
        tick: finite(trade.tick),
        size: finite(trade.size),
        side: trade.side === 'sell' ? 'sell' : 'buy',
      }))
      .filter(trade => {
        const frameTime = finite(raw.timestamp, 0);
        if (!frameTime || !trade.timestamp) return true;
        const age = frameTime - trade.timestamp;
        // Future-dated prints are a clock skew, not history: keep them.
        return age <= TRADE_FRAME_WINDOW_MS;
      }),
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

export function updateLivePresentationEdge(history, snapshot) {
  if (!Array.isArray(history) || !history.length || !snapshot) return false;
  const current = history[history.length - 1];
  const liveTick = finite(snapshot.lastTick, Number.NaN);
  const liveTimestamp = finite(snapshot.timestamp, Number.NaN);
  let changed = false;
  if (Number.isFinite(liveTick) && liveTick > 0 && liveTick !== current.lastTick) {
    current.lastTick = liveTick;
    changed = true;
  }
  if (Number.isFinite(liveTimestamp) && liveTimestamp > current.timestamp) {
    current.timestamp = liveTimestamp;
    changed = true;
  }
  return changed;
}

export class DepthMarketFeed {
  constructor({ symbol = 'MNQ', contractSymbol = '', exchange = '', onSnapshot, onPresentationTick, onStatus, onCvdHistory, eventSourceFactory } = {}) {
    this.symbol = symbol;
    this.contractSymbol = contractSymbol;
    this.exchange = String(exchange || '').toUpperCase();
    this.onSnapshot = onSnapshot;
    this.onPresentationTick = onPresentationTick;
    this.onStatus = onStatus;
    this.onCvdHistory = onCvdHistory;
    this.eventSourceFactory = eventSourceFactory || (url => new EventSource(url));
    this.stream = null;
    this.watchdogTimer = null;
    this.reconnectTimer = null;
    this.streamLeaseTimer = null;
    this.lastStreamActivityAt = 0;
    this.lastMarketFrameAt = 0;
    this.lastSnapshotProbeAt = 0;
    this.snapshotProbeInFlight = false;
    this.snapshotProbeQueued = false;
    this.presentationSnapshot = null;
    this.latestTradeTick = null;
    this.lastRealFrameAt = 0;
    this.observedRealFrameMs = 100;
    this.lastSnapshotToken = '';
    this.lastAcceptedTimestamp = 0;
    this.seenSnapshotIdentities = new Set();
    this.snapshotIdentityQueue = [];
    this.snapshotIdentityCursor = 0;
    this.connectionGeneration = 0;
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
    this.lastStreamActivityAt = Date.now();
    this.lastMarketFrameAt = Date.now();
    this.#startWatchdog();
    this.#bindRecoveryEvents();
    this.#connect();
  }

  stop() {
    this.running = false;
    this.connectionGeneration += 1;
    clearInterval(this.watchdogTimer);
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.streamLeaseTimer);
    this.watchdogTimer = null;
    this.reconnectTimer = null;
    this.streamLeaseTimer = null;
    this.presentationSnapshot = null;
    this.latestTradeTick = null;
    this.lastRealFrameAt = 0;
    this.lastStreamActivityAt = 0;
    this.lastMarketFrameAt = 0;
    this.lastSnapshotProbeAt = 0;
    this.snapshotProbeInFlight = false;
    this.snapshotProbeQueued = false;
    this.observedRealFrameMs = 100;
    this.stream?.close();
    this.stream = null;
    this.#unbindRecoveryEvents();
  }

  setSymbol(symbol, contractSymbol = '', exchange = '') {
    const normalizedExchange = String(exchange || '').toUpperCase();
    if (
      symbol === this.symbol
      && contractSymbol === this.contractSymbol
      && normalizedExchange === this.exchange
    ) return;
    this.symbol = symbol;
    this.contractSymbol = contractSymbol;
    this.exchange = normalizedExchange;
    this.connectionGeneration += 1;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.lastSnapshotToken = '';
    this.lastAcceptedTimestamp = 0;
    this.seenSnapshotIdentities.clear();
    this.snapshotIdentityQueue = [];
    this.snapshotIdentityCursor = 0;
    this.presentationSnapshot = null;
    this.latestTradeTick = null;
    this.lastRealFrameAt = 0;
    this.lastStreamActivityAt = Date.now();
    this.lastMarketFrameAt = Date.now();
    this.lastSnapshotProbeAt = 0;
    this.observedRealFrameMs = 100;
    this.stream?.close();
    this.stream = null;
    clearTimeout(this.streamLeaseTimer);
    this.streamLeaseTimer = null;
    this.status = {
      ...this.status,
      connected: false,
      levels: 0,
      depthMode: 'CONNECTING',
      fullDepth: false,
      contractSymbol,
      exchange: normalizedExchange,
    };
    this.onStatus?.(this.status);
    if (this.running) this.#connect();
  }

  #connect() {
    const symbol = this.symbol;
    const contractSymbol = this.contractSymbol;
    const exchange = this.exchange;
    const generation = ++this.connectionGeneration;
    const stream = this.eventSourceFactory(liveDepthStreamUrl(
      symbol,
      contractSymbol,
      this.lastAcceptedTimestamp,
      exchange,
    ));
    const isCurrentConnection = () => (
      this.running
      && this.stream === stream
      && this.connectionGeneration === generation
      && this.symbol === symbol
    );
    this.stream = stream;
    stream.onopen = () => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
      clearTimeout(this.streamLeaseTimer);
      this.streamLeaseTimer = setTimeout(() => {
        if (isCurrentConnection()) this.#restartSilentStream('scheduled stream rotation');
      }, STREAM_LEASE_MS);
      this.streamLeaseTimer?.unref?.();
      this.status = { ...this.status, connected: true };
      this.onStatus?.(this.status);
    };
    stream.addEventListener('status', event => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
      this.status = { ...this.status, ...JSON.parse(event.data || '{}') };
      this.onStatus?.(this.status);
    });
    stream.addEventListener('history', event => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
      const payload = JSON.parse(event.data || '{}');
      const payloadStatus = payload.status || {};
      this.status = {
        ...this.status,
        ...payloadStatus,
        connected: typeof payloadStatus.connected === 'boolean'
          ? payloadStatus.connected
          : true,
        historyFrames: Number(payload.totalFrames)
          || (Array.isArray(payload.snapshots) ? payload.snapshots.length : 0),
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
          this.lastAcceptedTimestamp = Math.max(this.lastAcceptedTimestamp, snapshot.timestamp);
          this.#rememberSnapshot(snapshot);
          snapshots.push(snapshot);
        }
      }
      snapshots.forEach((snapshot, index) => {
        if (!isCurrentConnection()) return;
        this.#emitSnapshot(snapshot, {
          historical: true,
          final: payload.final !== false && index === snapshots.length - 1,
        });
      });
      if (snapshots.length) this.#markMarketFrame();
    });
    stream.addEventListener('cvd-history', event => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
      const payload = JSON.parse(event.data || '{}');
      const points = Array.isArray(payload.points)
        ? payload.points.filter(point => Number.isFinite(Number(point?.timestamp)))
        : [];
      this.onCvdHistory?.(points, payload.tradingDate || '', Number(payload.asOfMs) || 0);
    });
    stream.addEventListener('depth', event => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
      this.#markMarketFrame();
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
        this.presentationSnapshot = snapshot;
        this.lastSnapshotToken = token;
        this.lastAcceptedTimestamp = Math.max(this.lastAcceptedTimestamp, snapshot.timestamp);
        this.#rememberSnapshot(snapshot);
        const arrivedAt = performance.now();
        if (this.lastRealFrameAt > 0) {
          const interval = arrivedAt - this.lastRealFrameAt;
          this.observedRealFrameMs = this.observedRealFrameMs * 0.65 + interval * 0.35;
        }
        this.lastRealFrameAt = arrivedAt;
        this.#emitSnapshot(snapshot);
      }
    });
    stream.addEventListener('tick', event => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
      this.#markMarketFrame();
      const payload = JSON.parse(event.data || '{}');
      const tick = finite(payload.tick, Number.NaN);
      if (!isPlausiblePresentationTick(tick, this.presentationSnapshot)) return;
      this.latestTradeTick = tick;
      if (this.presentationSnapshot) {
        this.presentationSnapshot = {
          ...this.presentationSnapshot,
          lastTick: tick,
        };
      }
      this.onPresentationTick?.(tick, finite(payload.timestamp, Date.now()));
    });
    stream.addEventListener('heartbeat', () => {
      if (!isCurrentConnection()) return;
      this.#markStreamActivity();
    });
    stream.onerror = () => {
      if (!isCurrentConnection()) return;
      // Native EventSource retry reuses the old URL and asks for the complete
      // session history again. Reopen with our accepted timestamp so a proxy
      // rotation cannot freeze the main thread parsing duplicate history.
      this.#restartSilentStream();
    };
    // Do not make the first visible map depend on a long-running SSE request
    // clearing the hosting proxy. A small current-book request paints the
    // chart immediately; the stream then appends history and live changes.
    void this.#probeLatestSnapshot(true);
  }

  #markStreamActivity() {
    this.lastStreamActivityAt = Date.now();
  }

  #markMarketFrame() {
    this.lastMarketFrameAt = Date.now();
  }

  #startWatchdog() {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      if (!this.running || this.reconnectTimer) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const now = Date.now();
      if (now - this.lastStreamActivityAt > STREAM_SILENCE_RECONNECT_MS) {
        this.#restartSilentStream('socket silence');
        return;
      }
      // Heartbeats prove only that the HTTP connection is alive. They used to
      // keep the watchdog satisfied even when real depth frames had stopped,
      // leaving a frozen map labelled LIVE indefinitely.
      const liveDepthMode = String(this.status.depthMode || '').toUpperCase();
      const expectsLiveFrames = this.status.connected === true
        && this.status.fullDepth === true
        && this.status.stale !== true
        && ['L3', 'MBO_AGGREGATED', 'LIVE'].includes(liveDepthMode);
      if (expectsLiveFrames && now - this.lastMarketFrameAt > MARKET_FRAME_PROBE_MS) {
        void this.#probeLatestSnapshot();
      }
    }, STREAM_WATCHDOG_INTERVAL_MS);
    this.watchdogTimer?.unref?.();
  }

  #restartSilentStream(reason = 'stream interruption') {
    if (!this.running || this.reconnectTimer) return;
    this.connectionGeneration += 1;
    clearTimeout(this.streamLeaseTimer);
    this.streamLeaseTimer = null;
    this.stream?.close();
    this.stream = null;
    const hadUsableFrame = Boolean(this.presentationSnapshot);
    this.status = {
      ...this.status,
      // Retain the last completed book while the transport swaps underneath
      // it. Brief proxy rotations must not flash the entire map offline.
      connected: hadUsableFrame ? this.status.connected : false,
      message: `Depth stream reconnecting: ${reason}`,
    };
    this.onStatus?.(this.status);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.running) return;
      this.lastStreamActivityAt = Date.now();
      this.lastMarketFrameAt = Date.now();
      this.#connect();
    }, 180);
    this.reconnectTimer?.unref?.();
  }

  async #probeLatestSnapshot(force = false) {
    const now = Date.now();
    if (this.snapshotProbeInFlight) {
      // Contract resolution can replace the stream while the bootstrap book
      // for the previous contract is still crossing the proxy. Never let that
      // stale request suppress the only immediate probe for the new book.
      if (force) this.snapshotProbeQueued = true;
      return;
    }
    if (
      !this.running
      || (!force && now - this.lastSnapshotProbeAt < MARKET_FRAME_PROBE_MS)
    ) return;
    this.snapshotProbeInFlight = true;
    this.lastSnapshotProbeAt = now;
    const symbol = this.symbol;
    const contractSymbol = this.contractSymbol;
    const exchange = this.exchange;
    const generation = this.connectionGeneration;
    try {
      const response = await fetch(liveDepthSnapshotUrl(symbol, contractSymbol, exchange), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (!this.running || generation !== this.connectionGeneration || symbol !== this.symbol) return;
      const payloadStatus = payload?.status || {};
      this.status = { ...this.status, ...payloadStatus };
      this.onStatus?.(this.status);
      const snapshot = normalizeLiveSnapshot(payload?.snapshot);
      const token = snapshotBookToken(snapshot);
      if (!snapshot || token === this.lastSnapshotToken) {
        // A valid probe proves the market edge is still available even when
        // the book itself genuinely has not changed.
        this.lastMarketFrameAt = Date.now();
        return;
      }
      this.latestTradeTick = snapshot.lastTick;
      this.presentationSnapshot = snapshot;
      this.lastSnapshotToken = token;
      this.lastAcceptedTimestamp = Math.max(this.lastAcceptedTimestamp, snapshot.timestamp);
      this.#rememberSnapshot(snapshot);
      // The snapshot endpoint carries a retained trade window rather than an
      // SSE cursor. It is used only to repair book/price continuity; replaying
      // those trades would duplicate bubbles, tape rows and CVD.
      snapshot.trades = [];
      snapshot.delta = 0;
      snapshot.volume = 0;
      snapshot.eventsSince = 0;
      this.#markMarketFrame();
      this.#emitSnapshot(snapshot, { recovered: true });
    } catch {
      // The SSE socket watchdog remains authoritative. A failed health probe
      // must not blank a valid last frame or create a reconnect storm.
    } finally {
      this.snapshotProbeInFlight = false;
      const retryLatestBook = this.snapshotProbeQueued
        || (this.running && generation !== this.connectionGeneration);
      this.snapshotProbeQueued = false;
      if (retryLatestBook && this.running) {
        queueMicrotask(() => {
          if (this.running) void this.#probeLatestSnapshot(true);
        });
      }
    }
  }

  #bindRecoveryEvents() {
    if (this.recoveryEventsBound || typeof window === 'undefined') return;
    this.recoveryEventsBound = true;
    this.handleVisibilityRecovery = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!this.running || Date.now() - this.lastMarketFrameAt <= MARKET_FRAME_PROBE_MS) return;
      void this.#probeLatestSnapshot();
    };
    this.handleOnlineRecovery = () => {
      if (this.running) this.#restartSilentStream('network restored');
    };
    window.addEventListener('focus', this.handleVisibilityRecovery);
    window.addEventListener('online', this.handleOnlineRecovery);
    document?.addEventListener?.('visibilitychange', this.handleVisibilityRecovery);
  }

  #unbindRecoveryEvents() {
    if (!this.recoveryEventsBound || typeof window === 'undefined') return;
    window.removeEventListener('focus', this.handleVisibilityRecovery);
    window.removeEventListener('online', this.handleOnlineRecovery);
    document?.removeEventListener?.('visibilitychange', this.handleVisibilityRecovery);
    this.recoveryEventsBound = false;
    this.handleVisibilityRecovery = null;
    this.handleOnlineRecovery = null;
  }

  #emitSnapshot(snapshot, metadata) {
    try {
      this.onSnapshot?.(snapshot, metadata);
    } catch (error) {
      // A consumer paint failure must never break the live presentation timer
      // or stop subsequent genuine Rithmic frames from reaching the map.
      console.error('Liquidity map snapshot callback was isolated.', error);
    }
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
    // A 10,000-item Array.shift() on every live frame eventually became an
    // O(n) main-thread tax. A fixed circular identity window spans many times
    // the gateway's retained history while eviction remains O(1).
    if (this.snapshotIdentityQueue.length < SNAPSHOT_IDENTITY_CAPACITY) {
      this.snapshotIdentityQueue.push(identity);
      return;
    }
    const expired = this.snapshotIdentityQueue[this.snapshotIdentityCursor];
    if (expired) this.seenSnapshotIdentities.delete(expired);
    this.snapshotIdentityQueue[this.snapshotIdentityCursor] = identity;
    this.snapshotIdentityCursor = (this.snapshotIdentityCursor + 1) % SNAPSHOT_IDENTITY_CAPACITY;
  }

}
