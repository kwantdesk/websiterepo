function instrumentKey(exchange, symbol) {
  return `${String(exchange || "").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function snapshotLevels(levels, depth, descending) {
  if (depth !== 1) return [...levels.values()].sort((a, b) => descending ? b.price - a.price : a.price - b.price).slice(0, depth);
  let best = null;
  for (const level of levels.values()) {
    if (!best || (descending ? level.price > best.price : level.price < best.price)) best = level;
  }
  return best ? [best] : [];
}

function snapshotTrades(source, afterSequence, limit) {
  if (limit <= 0) return [];
  if (afterSequence <= 0) return source.slice(-limit);
  // Live sequence numbers increase on append; restored history uses negative
  // cursors. A heatmap needs only its newest bounded tail, not a full-ring
  // filter/allocation on every frame. Retention and archive records are intact.
  const trades = [];
  for (let index = source.length - 1; index >= 0 && trades.length < limit; index--) {
    const trade = source[index];
    if (Number(trade.sequence) <= afterSequence) break;
    if (Number(trade.sequence) > afterSequence) trades.push(trade);
  }
  return trades.reverse();
}

function eventTimestampMs(payload) {
  const seconds = Number(payload.sourceSsboe ?? payload.ssboe ?? 0);
  const microseconds = Number(payload.sourceUsecs ?? payload.usecs ?? 0);
  return seconds > 0 ? seconds * 1_000 + Math.floor(microseconds / 1_000) : 0;
}

function eventTimestampUs(payload) {
  const seconds = Number(payload.sourceSsboe ?? payload.ssboe ?? 0);
  const micros = Number(payload.sourceUsecs ?? (payload.sourceNsecs != null
    ? Math.floor(Number(payload.sourceNsecs) / 1_000) : payload.usecs ?? 0));
  const value = seconds * 1_000_000 + micros;
  return seconds > 0 && Number.isSafeInteger(value) ? value : 0;
}

const levelKey = (side, price) => `${side}:${Number(price)}`;

function indexOrder(instrument, order) {
  const index = order.side === "BUY" ? instrument.bidOrderIds : instrument.askOrderIds;
  let ids = index.get(Number(order.price));
  if (!ids) index.set(Number(order.price), ids = new Set());
  ids.add(order.id);
}

function snapshotTarget(payload) {
  const exchange = Array.isArray(payload?.exchange) ? payload.exchange[0] : payload?.exchange;
  const symbol = Array.isArray(payload?.symbol) ? payload.symbol[0] : payload?.symbol;
  if (exchange && symbol) {
    return {
      exchange: String(exchange).toUpperCase(),
      symbol: String(symbol).toUpperCase(),
    };
  }
  for (const message of payload?.userMsg || []) {
    const match = String(message).match(/^dbo-(?:snapshot|resync):([^:]+):(.+)$/i);
    if (match) {
      return {
        exchange: match[1].toUpperCase(),
        symbol: match[2].toUpperCase(),
      };
    }
  }
  return null;
}

function addLevel(levels, price, size, orders = 0) {
  const numericPrice = Number(price);
  const numericSize = Number(size);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) return;
  if (!Number.isFinite(numericSize) || numericSize <= 0) {
    levels.delete(numericPrice);
    return;
  }
  levels.set(numericPrice, {
    price: numericPrice,
    size: numericSize,
    orders: Number.isFinite(Number(orders)) ? Number(orders) : 0,
  });
}

function makeInstrument(exchange, symbol, maxTrades) {
  return {
    exchange: String(exchange || "").toUpperCase(),
    symbol: String(symbol || "").toUpperCase(),
    bids: new Map(),
    asks: new Map(),
    orders: new Map(),
    bidOrderIds: new Map(),
    askOrderIds: new Map(),
    orderSourceTimes: new Map(),
    emptyLevelTimes: new Map(),
    volumeByPrice: new Map(),
    trades: [],
    // Exact one-minute aggressor-flow bars are retained independently from
    // the raw execution ring. A busy CME session can exceed maxTrades; CVD
    // must not lose its session open merely because older raw prints were
    // compacted out of memory.
    flowCandles: new Map(),
    askVolumeTotal: 0,
    bidVolumeTotal: 0,
    sequence: 0,
    orderEventSequence: 0,
    sourceSequence: "0",
    asOfMs: 0,
    lastPrice: null,
    lastTradeTimeMs: 0,
    bidTimeUs: 0,
    askTimeUs: 0,
    bestBid: null,
    bestAsk: null,
    bookValid: false,
    depthMode: "TRADES",
    individualOrders: false,
    pendingDepthSnapshot: null,
    maxTrades,
  };
}

const FLOW_BUCKET_MS = 60_000;
const MAX_FLOW_CANDLES = 20_000;
const TRADE_TRIM_BATCH = 4_096;

function trimTrades(instrument) {
  // Shifting a 250k-element array for every new print turns the hot market
  // data callback into O(n) work after the ring fills. Keep a tiny bounded
  // overflow and trim it in one batch; small test/dev stores remain exact.
  const slack = instrument.maxTrades >= TRADE_TRIM_BATCH * 2 ? TRADE_TRIM_BATCH : 0;
  if (instrument.trades.length <= instrument.maxTrades + slack) return;
  instrument.trades.splice(0, instrument.trades.length - instrument.maxTrades);
}

function tradeDelta(trade) {
  if (trade.aggressor === "BUY") return trade.size;
  if (trade.aggressor === "SELL") return -trade.size;
  return 0;
}

function recordTradeFlow(instrument, trade) {
  const timestamp = trade.timestampMs - (trade.timestampMs % FLOW_BUCKET_MS);
  const askVolume = trade.aggressor === "BUY" ? trade.size : 0;
  const bidVolume = trade.aggressor === "SELL" ? trade.size : 0;
  const delta = tradeDelta(trade);
  instrument.askVolumeTotal += askVolume;
  instrument.bidVolumeTotal += bidVolume;
  let candle = instrument.flowCandles.get(timestamp);
  if (!candle) {
    candle = {
      timestamp,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: 0,
      trades: 0,
      askVolume: 0,
      bidVolume: 0,
      askTrades: 0,
      bidTrades: 0,
      delta: 0,
      deltaOpen: 0,
      deltaHigh: 0,
      deltaLow: 0,
      deltaClose: 0,
    };
    instrument.flowCandles.set(timestamp, candle);
  }
  candle.high = Math.max(candle.high, trade.price);
  candle.low = Math.min(candle.low, trade.price);
  candle.close = trade.price;
  candle.volume += trade.size;
  candle.trades += 1;
  candle.askVolume += askVolume;
  candle.bidVolume += bidVolume;
  candle.askTrades += trade.aggressor === "BUY" ? 1 : 0;
  candle.bidTrades += trade.aggressor === "SELL" ? 1 : 0;
  candle.delta += delta;
  candle.deltaHigh = Math.max(candle.deltaHigh, candle.delta);
  candle.deltaLow = Math.min(candle.deltaLow, candle.delta);
  candle.deltaClose = candle.delta;

  while (instrument.flowCandles.size > MAX_FLOW_CANDLES) {
    const oldest = instrument.flowCandles.keys().next().value;
    if (oldest == null) break;
    instrument.flowCandles.delete(oldest);
  }
}

function aggregateFlowCandles(candles, intervalMs) {
  const aggregated = new Map();
  for (const source of candles) {
    const timestamp = source.timestamp - (source.timestamp % intervalMs);
    let target = aggregated.get(timestamp);
    if (!target) {
      target = {
        ...source,
        timestamp,
        deltaOpen: 0,
        deltaHigh: source.deltaHigh,
        deltaLow: source.deltaLow,
        deltaClose: source.delta,
      };
      aggregated.set(timestamp, target);
      continue;
    }
    const deltaBase = target.delta;
    target.high = Math.max(target.high, source.high);
    target.low = Math.min(target.low, source.low);
    target.close = source.close;
    target.volume += source.volume;
    target.trades += source.trades;
    target.askVolume += source.askVolume;
    target.bidVolume += source.bidVolume;
    target.askTrades += source.askTrades;
    target.bidTrades += source.bidTrades;
    target.deltaHigh = Math.max(target.deltaHigh, deltaBase + source.deltaHigh);
    target.deltaLow = Math.min(target.deltaLow, deltaBase + source.deltaLow);
    target.delta += source.delta;
    target.deltaClose = target.delta;
  }
  return [...aggregated.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function rebuildDepthByOrder(instrument) {
  instrument.bids.clear();
  instrument.asks.clear();
  instrument.bidOrderIds.clear();
  instrument.askOrderIds.clear();
  const bidOrders = new Map();
  const askOrders = new Map();
  for (const order of instrument.orders.values()) {
    indexOrder(instrument, order);
    const target = order.side === "BUY" ? instrument.bids : instrument.asks;
    const orderCounts = order.side === "BUY" ? bidOrders : askOrders;
    const previous = target.get(order.price);
    addLevel(
      target,
      order.price,
      Number(previous?.size || 0) + order.size,
      Number(orderCounts.get(order.price) || 0) + 1,
    );
    orderCounts.set(order.price, Number(orderCounts.get(order.price) || 0) + 1);
  }
  instrument.depthMode = "L3";
  instrument.individualOrders = true;
  instrument.bookValid = instrument.bids.size > 0 || instrument.asks.size > 0;
}

function removeOrderFromDepth(instrument, order) {
  if (!order || !Number.isFinite(Number(order.price))) return;
  const index = order.side === "BUY" ? instrument.bidOrderIds : instrument.askOrderIds;
  const ids = index.get(Number(order.price));
  ids?.delete(order.id);
  if (ids?.size === 0) index.delete(Number(order.price));
  const levels = order.side === "BUY" ? instrument.bids : instrument.asks;
  const level = levels.get(Number(order.price));
  if (!level) return;
  addLevel(
    levels,
    order.price,
    Number(level.size || 0) - Number(order.size || 0),
    Math.max(0, Number(level.orders || 0) - 1),
  );
}

function addOrderToDepth(instrument, order) {
  if (
    !order
    || !Number.isFinite(Number(order.price))
    || !Number.isFinite(Number(order.size))
    || Number(order.size) <= 0
  ) return;
  indexOrder(instrument, order);
  const levels = order.side === "BUY" ? instrument.bids : instrument.asks;
  const level = levels.get(Number(order.price));
  addLevel(
    levels,
    order.price,
    Number(level?.size || 0) + Number(order.size),
    Number(level?.orders || 0) + 1,
  );
}

export class RithmicBookStore {
  constructor({ maxTrades = 250_000 } = {}) {
    this.maxTrades = maxTrades;
    this.instruments = new Map();
  }

  ensure(exchange, symbol) {
    const key = instrumentKey(exchange, symbol);
    let instrument = this.instruments.get(key);
    if (!instrument) {
      instrument = makeInstrument(exchange, symbol, this.maxTrades);
      this.instruments.set(key, instrument);
    }
    return instrument;
  }

  /**
   * Prepend an isolated archive replay to the live tape without allowing old
   * records to overwrite the current quote, depth, or exchange sequence.
   * Replaying directly into the live book during startup used to pin every
   * chart to old prices and delayed the Rithmic connection for several
   * minutes on large archives.
   */
  mergeHistoricalTradesFrom(historyBook) {
    let merged = 0;
    for (const [key, historyInstrument] of historyBook?.instruments || []) {
      const instrument = this.instruments.get(key)
        || this.ensure(historyInstrument.exchange, historyInstrument.symbol);
      const liveTrades = instrument.trades.slice();
      let earliestLiveMs = Number.POSITIVE_INFINITY;
      for (const trade of liveTrades) {
        const timestampMs = Number(trade.timestampMs);
        if (Number.isFinite(timestampMs)) earliestLiveMs = Math.min(earliestLiveMs, timestampMs);
      }
      const liveIds = new Set(liveTrades.map((trade) => String(trade.id)));
      const historical = historyInstrument.trades
        .filter((trade) => Number(trade.timestampMs) < earliestLiveMs && !liveIds.has(String(trade.id)))
        .slice(-Math.max(0, instrument.maxTrades - liveTrades.length));
      if (!historical.length) continue;

      // Historical sequence numbers must never outrank the live exchange
      // cursor used by incremental clients.
      const normalizedHistory = historical.map((trade, index) => ({
        ...trade,
        sequence: index - historical.length,
      }));
      instrument.trades = [...normalizedHistory, ...liveTrades].slice(-instrument.maxTrades);
      instrument.flowCandles = new Map();
      instrument.askVolumeTotal = 0;
      instrument.bidVolumeTotal = 0;
      for (const trade of instrument.trades) recordTradeFlow(instrument, trade);
      merged += normalizedHistory.length;
    }
    return merged;
  }

  resetDepth(exchange, symbol) {
    const instrument = this.ensure(exchange, symbol);
    instrument.bids.clear();
    instrument.asks.clear();
    instrument.orders.clear();
    instrument.bidOrderIds.clear();
    instrument.askOrderIds.clear();
    instrument.orderSourceTimes.clear();
    instrument.emptyLevelTimes.clear();
    instrument.pendingDepthSnapshot = null;
    instrument.bookValid = false;
    instrument.depthMode = "TRADES";
    instrument.individualOrders = false;
  }

  applyTrade(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    const price = Number(payload.tradePrice);
    const size = Number(payload.tradeSize);
    if (!Number.isFinite(price) || !Number.isFinite(size) || size <= 0) return null;
    instrument.sequence += 1;
    instrument.sourceSequence = String(
      payload.sourceTradeId || payload.exchangeOrderId || payload.aggressorExchangeOrderId || instrument.sequence,
    );
    const timestampMs = eventTimestampMs(payload) || Date.now();
    instrument.asOfMs = Math.max(instrument.asOfMs || 0, timestampMs);
    if (timestampMs >= instrument.lastTradeTimeMs) {
      instrument.lastPrice = price;
      instrument.lastTradeTimeMs = timestampMs;
    }
    const aggressor =
      Number(payload.aggressor) === 1 ? "BUY" : Number(payload.aggressor) === 2 ? "SELL" : "UNKNOWN";
    const trade = {
      id: payload.sourceTradeId
        ? `${instrument.exchange}:${instrument.symbol}:${payload.sourceTradeId}`
        : `${instrument.exchange}:${instrument.symbol}:${timestampMs}:${instrument.sequence}`,
      sequence: instrument.sequence,
      sourceSequence: instrument.sourceSequence,
      timestampMs,
      price,
      size,
      aggressor,
    };
    instrument.trades.push(trade);
    recordTradeFlow(instrument, trade);
    trimTrades(instrument);
    return { type: "trade", instrument: instrumentKey(instrument.exchange, instrument.symbol), trade };
  }

  applyBbo(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    const timeUs = eventTimestampUs(payload);
    instrument.asOfMs = Math.max(instrument.asOfMs || 0, eventTimestampMs(payload) || instrument.asOfMs || Date.now());
    if (Number.isFinite(Number(payload.bidPrice)) && Number(payload.bidPrice) > 0
      && (!timeUs || timeUs >= instrument.bidTimeUs)) {
      instrument.bidTimeUs = timeUs || instrument.bidTimeUs;
      instrument.bestBid = {
        price: Number(payload.bidPrice),
        size: Number(payload.bidSize || 0),
        orders: Number(payload.bidOrders || 0),
      };
    }
    if (Number.isFinite(Number(payload.askPrice)) && Number(payload.askPrice) > 0
      && (!timeUs || timeUs >= instrument.askTimeUs)) {
      instrument.askTimeUs = timeUs || instrument.askTimeUs;
      instrument.bestAsk = {
        price: Number(payload.askPrice),
        size: Number(payload.askSize || 0),
        orders: Number(payload.askOrders || 0),
      };
    }
    instrument.sequence += 1;
    return { type: "bbo", instrument: instrumentKey(instrument.exchange, instrument.symbol) };
  }

  applyOrderBook(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    if (instrument.depthMode === "L3" || instrument.pendingDepthSnapshot) {
      const timeUs = eventTimestampUs(payload);
      const orderEvents = [];
      // A positive aggregated quantity cannot identify individual orders.
      // An explicit, timestamped zero-size/zero-order level CAN prove every
      // older order at that exact side/price is gone. Ignoring these clears
      // left real captured NQ snapshot orders resting after their deletion.
      if (timeUs > 0) for (const [side, prefix, index] of [
        ["BUY", "bid", instrument.bidOrderIds],
        ["SELL", "ask", instrument.askOrderIds],
      ]) {
        const prices = payload[`${prefix}Price`] || [];
        for (let offset = 0; offset < prices.length; offset += 1) {
          const price = Number(prices[offset]);
          if (!(price > 0) || payload[`${prefix}Size`]?.[offset] !== 0
            || payload[`${prefix}Orders`]?.[offset] !== 0) continue;
          const key = levelKey(side, price);
          if (timeUs < (instrument.emptyLevelTimes.get(key) || 0)) continue;
          instrument.emptyLevelTimes.set(key, timeUs);
          // Bound clocks even on a long-running, very wide contract range.
          if (instrument.emptyLevelTimes.size > 20_000) {
            instrument.emptyLevelTimes.delete(instrument.emptyLevelTimes.keys().next().value);
          }
          for (const id of [...(index.get(price) || [])]) {
            if ((instrument.orderSourceTimes.get(id) || 0) > timeUs) continue;
            const order = instrument.orders.get(id);
            if (!order) continue;
            removeOrderFromDepth(instrument, order);
            instrument.orders.delete(id);
            instrument.orderSourceTimes.delete(id);
            instrument.pendingDepthSnapshot?.deltaOrders?.set(id, null);
            orderEvents.push({ sequence: ++instrument.orderEventSequence,
              timestamp: Math.floor(timeUs / 1_000), orderId: id, action: "REMOVE",
              side: side === "BUY" ? "BID" : "ASK", price, previousPrice: price,
              size: 0, previousSize: Number(order.size || 0),
              priority: String(order.priority || "0"), previousPriority: String(order.priority || "0"),
              reason: "explicit-price-level-clear" });
          }
        }
      }
      if (orderEvents.length) {
        instrument.sequence += 1;
        instrument.asOfMs = Math.max(instrument.asOfMs || 0, Math.floor(timeUs / 1_000));
        instrument.bookValid = instrument.bids.size > 0 || instrument.asks.size > 0;
        return { type: "depth", instrument: instrumentKey(instrument.exchange, instrument.symbol), orderEvents };
      }
      // Rithmic sends the aggregated OrderBook alongside the depth-by-order
      // stream. It is not an L3 change and, outside trading hours, often has
      // no exchange timestamp. Publishing it as a new depth frame made the
      // heatmap alternate between the last real market timestamp and
      // Date.now(), stretching the time axis by hours and making the original
      // Kwantify renderer look broken. Once an L3 book exists, only DBO events
      // are allowed to advance it.
      return null;
    }
    const updateType = Number(payload.updateType || 0);
    if (updateType === 1 || updateType === 2 || updateType === 3 || updateType === 4 || updateType === 7) {
      if (updateType !== 5 && updateType !== 6) {
        instrument.bids.clear();
        instrument.asks.clear();
      }
    }
    const bidPrices = payload.bidPrice || [];
    const askPrices = payload.askPrice || [];
    for (let index = 0; index < bidPrices.length; index += 1) {
      addLevel(
        instrument.bids,
        bidPrices[index],
        payload.bidSize?.[index],
        payload.bidOrders?.[index],
      );
    }
    for (let index = 0; index < askPrices.length; index += 1) {
      addLevel(
        instrument.asks,
        askPrices[index],
        payload.askSize?.[index],
        payload.askOrders?.[index],
      );
    }
    instrument.asOfMs = Math.max(instrument.asOfMs || 0, eventTimestampMs(payload) || instrument.asOfMs || Date.now());
    instrument.sequence += 1;
    instrument.depthMode = "L2";
    instrument.individualOrders = false;
    instrument.bookValid = instrument.bids.size > 0 || instrument.asks.size > 0;
    return { type: "depth", instrument: instrumentKey(instrument.exchange, instrument.symbol) };
  }

  applyAggregatedSnapshot(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    const bids = Array.isArray(payload.bids) ? payload.bids : [];
    const asks = Array.isArray(payload.asks) ? payload.asks : [];
    const tradeVolumes = Array.isArray(payload.tradeVolumes)
      ? payload.tradeVolumes
      : [];
    const nextBids = new Map();
    const nextAsks = new Map();
    for (const row of bids) {
      addLevel(nextBids, row.price, row.size, row.orders);
    }
    for (const row of asks) {
      addLevel(nextAsks, row.price, row.size, row.orders);
    }

    const timestampMs = Number(payload.timestampMs);
    const asOfMs = Number.isFinite(timestampMs) && timestampMs > 0
      ? Math.floor(timestampMs)
      : Date.now();
    const firstVolumeSnapshot = instrument.volumeByPrice.size === 0;
    const nextVolumeByPrice = new Map();
    const inferredTrades = [];
    const bestBidPrice = [...nextBids.keys()].reduce(
      (best, candidate) => Math.max(best, candidate),
      Number.NEGATIVE_INFINITY,
    );
    const bestAskPrice = [...nextAsks.keys()].reduce(
      (best, candidate) => Math.min(best, candidate),
      Number.POSITIVE_INFINITY,
    );
    for (const row of tradeVolumes) {
      const price = Number(row.price);
      const volume = Number(row.volume);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(volume) || volume < 0) {
        continue;
      }
      nextVolumeByPrice.set(price, volume);
      if (firstVolumeSnapshot) continue;
      const previous = Number(instrument.volumeByPrice.get(price) || 0);
      const delta = volume - previous;
      if (delta <= 0) continue;
      const aggressor = price >= bestAskPrice
        ? "BUY"
        : price <= bestBidPrice
          ? "SELL"
          : "UNKNOWN";
      instrument.sequence += 1;
      const trade = {
        id: `${instrument.exchange}:${instrument.symbol}:${asOfMs}:${instrument.sequence}`,
        sequence: instrument.sequence,
        sourceSequence: String(payload.sequence || instrument.sequence),
        timestampMs: asOfMs,
        price,
        size: delta,
        aggressor,
      };
      instrument.trades.push(trade);
      recordTradeFlow(instrument, trade);
      inferredTrades.push(trade);
    }
    trimTrades(instrument);

    instrument.bids = nextBids;
    instrument.asks = nextAsks;
    instrument.volumeByPrice = nextVolumeByPrice;
    instrument.orders.clear();
    instrument.asOfMs = asOfMs;
    instrument.sequence += 1;
    instrument.sourceSequence = String(payload.sequence || instrument.sequence);
    instrument.depthMode = "MBO_AGGREGATED";
    instrument.individualOrders = false;
    instrument.bookValid = nextBids.size > 0 || nextAsks.size > 0;
    const sortedBids = [...nextBids.values()].sort((left, right) => right.price - left.price);
    const sortedAsks = [...nextAsks.values()].sort((left, right) => left.price - right.price);
    instrument.bestBid = sortedBids[0] || null;
    instrument.bestAsk = sortedAsks[0] || null;
    const explicitLast = Number(payload.lastPrice);
    instrument.lastPrice = Number.isFinite(explicitLast) && explicitLast > 0
      ? explicitLast
      : inferredTrades.at(-1)?.price ??
        instrument.lastPrice ??
        (Number.isFinite(bestBidPrice) && Number.isFinite(bestAskPrice)
          ? (bestBidPrice + bestAskPrice) / 2
          : Number.isFinite(bestBidPrice)
            ? bestBidPrice
            : Number.isFinite(bestAskPrice)
              ? bestAskPrice
              : null);

    return {
      type: "depth",
      instrument: instrumentKey(instrument.exchange, instrument.symbol),
      inferredTrades,
    };
  }

  applyDepthSnapshot(payload, receivedAtMs = Date.now()) {
    const target = snapshotTarget(payload);
    if (!target) return null;
    const instrument = this.ensure(target.exchange, target.symbol);

    // A ResponseDepthByOrderSnapshot is a stream of hundreds or thousands of
    // packets followed by a zero-row completion packet. The previous adapter
    // rebuilt and published the live book after every packet. That exposed
    // partial books to the canvas and was the largest source of flashing,
    // collapsing ladders and distorted liquidity. Stage it, then swap the
    // complete snapshot into the live book atomically.
    if (payload.depthPrice == null) {
      const responseCodes = [...(payload.rqHandlerRpCode || []), ...(payload.rpCode || [])];
      const failed = responseCodes.some((code) => String(code) !== "0");
      const pending = instrument.pendingDepthSnapshot;
      instrument.pendingDepthSnapshot = null;
      if (failed || !pending || pending.orders.size === 0) return null;
      // Live updates can arrive while baseline rows are still streaming. A
      // baseline swap must not resurrect a cancelled order, undo its latest
      // price/size, or discard orders added since that baseline began.
      for (const [id, order] of pending.deltaOrders || []) {
        if (order) {
          pending.orders.set(id, order);
          pending.orderSourceTimes.set(id, pending.deltaTimes.get(id) || 0);
        } else {
          pending.orders.delete(id);
          pending.orderSourceTimes.delete(id);
        }
      }
      for (const [id, order] of pending.orders) {
        const clearedAt = instrument.emptyLevelTimes.get(levelKey(order.side, order.price));
        if (clearedAt && (pending.orderSourceTimes.get(id) || 0) <= clearedAt) {
          pending.orders.delete(id);
          pending.orderSourceTimes.delete(id);
        }
      }
      instrument.orders = pending.orders;
      instrument.orderSourceTimes = pending.orderSourceTimes;
      instrument.sourceSequence = pending.sourceSequence || instrument.sourceSequence;
      instrument.sequence += 1;
      rebuildDepthByOrder(instrument);
      return {
        type: "depth",
        instrument: instrumentKey(instrument.exchange, instrument.symbol),
        snapshotComplete: true,
      };
    }

    const sourceSequence = String(payload.sequenceNumber || "0");
    if (
      !instrument.pendingDepthSnapshot
      || (
        sourceSequence !== "0"
        && instrument.pendingDepthSnapshot.sourceSequence !== "0"
        && sourceSequence !== instrument.pendingDepthSnapshot.sourceSequence
      )
    ) {
      instrument.pendingDepthSnapshot = {
        sourceSequence,
        orders: new Map(),
        deltaOrders: new Map(),
        deltaTimes: new Map(),
        orderSourceTimes: new Map(),
        // The complete image was captured before its first row arrived.
        // Its receipt is a conservative upper bound, not an exchange clock.
        observedAtUs: (Number.isFinite(Number(receivedAtMs)) ? Number(receivedAtMs) : Date.now()) * 1_000 + 999,
      };
    }
    const pending = instrument.pendingDepthSnapshot;
    const side = Number(payload.depthSide) === 1 ? "BUY" : "SELL";
    const sizes = payload.depthSize || [];
    const priorities = payload.depthOrderPriority || [];
    const ids = payload.exchangeOrderId || [];
    for (let index = 0; index < sizes.length; index += 1) {
      const id = String(ids[index] || `${side}:${payload.depthPrice}:${priorities[index] || index}`);
      pending.orders.set(id, {
        id,
        side,
        price: Number(payload.depthPrice),
        size: Number(sizes[index] || 0),
        priority: String(priorities[index] || "0"),
      });
      pending.orderSourceTimes.set(id, pending.observedAtUs);
    }
    return null;
  }

  applyDepthUpdate(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    const previousSequence = BigInt(instrument.sourceSequence || "0");
    const incomingSequence = BigInt(String(payload.sequenceNumber || "0"));
    const sequenceRegression =
      previousSequence > 0n &&
      incomingSequence > 0n &&
      incomingSequence < previousSequence;
    const updates = payload.updateType || [];
    const sides = payload.transactionType || [];
    const prices = payload.depthPrice || [];
    const previousPrices = payload.prevDepthPrice || [];
    const sizes = payload.depthSize || [];
    const priorities = payload.depthOrderPriority || [];
    const ids = payload.exchangeOrderId || [];
    const orderEvents = [];
    const timestamp = eventTimestampMs(payload) || Date.now();
    const timeUs = eventTimestampUs(payload);
    for (let index = 0; index < updates.length; index += 1) {
      const id = String(ids[index] || `${sides[index]}:${prices[index]}:${priorities[index] || index}`);
      const updateType = Number(updates[index]);
      const existing = instrument.orders.get(id);
      if (timeUs > 0 && (instrument.orderSourceTimes.get(id) || 0) > timeUs) continue;
      if (updateType === 3) {
        instrument.pendingDepthSnapshot?.deltaOrders?.set(id, null);
        if (existing) {
          orderEvents.push({
            sequence: ++instrument.orderEventSequence,
            timestamp,
            orderId: id,
            action: "REMOVE",
            side: existing.side === "BUY" ? "BID" : "ASK",
            price: Number(existing.price),
            previousPrice: Number(existing.price),
            size: 0,
            previousSize: Number(existing.size || 0),
            priority: String(existing.priority || "0"),
            previousPriority: String(existing.priority || "0"),
          });
        }
        removeOrderFromDepth(instrument, existing);
        instrument.orders.delete(id);
        instrument.orderSourceTimes.delete(id);
        continue;
      }
      const nextOrder = {
        id,
        side: Number(sides[index]) === 1 ? "BUY" : Number(sides[index]) === 2 ? "SELL" : existing?.side,
        price: Number(
          prices[index] ??
            (payload.prevDepthPriceFlag?.[index] ? previousPrices[index] : existing?.price),
        ),
        size: Number(sizes[index] ?? existing?.size ?? 0),
        priority: String(priorities[index] ?? existing?.priority ?? "0"),
      };
      const clearedAt = instrument.emptyLevelTimes.get(levelKey(nextOrder.side, nextOrder.price));
      if (timeUs > 0 && clearedAt && timeUs <= clearedAt) {
        instrument.pendingDepthSnapshot?.deltaOrders?.set(id, null);
        continue;
      }
      orderEvents.push({
        sequence: ++instrument.orderEventSequence,
        timestamp,
        orderId: id,
        action: existing ? "MODIFY" : "ADD",
        side: nextOrder.side === "BUY" ? "BID" : "ASK",
        price: Number(nextOrder.price),
        previousPrice: existing ? Number(existing.price) : null,
        size: Number(nextOrder.size || 0),
        previousSize: Number(existing?.size || 0),
        priority: String(nextOrder.priority || "0"),
        previousPriority: existing ? String(existing.priority || "0") : null,
      });
      // Updating one order used to rebuild every price level from every order
      // in the book. At active CME rates that is O(messages * total orders)
      // and pinned the gateway above 100% CPU. Maintain the two affected
      // aggregates instead, making each DBO update O(1).
      removeOrderFromDepth(instrument, existing);
      instrument.orders.set(id, nextOrder);
      instrument.orderSourceTimes.set(id, timeUs);
      instrument.pendingDepthSnapshot?.deltaOrders?.set(id, nextOrder);
      instrument.pendingDepthSnapshot?.deltaTimes?.set(id, timeUs);
      addOrderToDepth(instrument, nextOrder);
    }
    instrument.sourceSequence = String(payload.sequenceNumber || instrument.sourceSequence);
    instrument.asOfMs = Math.max(instrument.asOfMs || 0, eventTimestampMs(payload) || instrument.asOfMs);
    instrument.sequence += 1;
    instrument.depthMode = "L3";
    instrument.individualOrders = true;
    instrument.bookValid = instrument.bids.size > 0 || instrument.asks.size > 0;
    return {
      type: "depth",
      instrument: instrumentKey(instrument.exchange, instrument.symbol),
      sequenceRegression,
      previousSequence: sequenceRegression ? String(previousSequence) : null,
      receivedSequence: sequenceRegression ? String(incomingSequence) : null,
      orderEvents,
    };
  }

  list() {
    return [...this.instruments.values()].map((instrument) => ({
      exchange: instrument.exchange,
      symbol: instrument.symbol,
      lastPrice: instrument.lastPrice,
      asOf: instrument.asOfMs ? new Date(instrument.asOfMs).toISOString() : null,
      status:
        instrument.asOfMs && Date.now() - instrument.asOfMs <= 30_000
          ? "LIVE"
          : instrument.asOfMs
            ? "STALE"
            : "NOT_OPEN",
      depthMode: instrument.depthMode,
      bookValid: instrument.bookValid,
      orderCount: instrument.orders.size,
      pendingOrderCount: instrument.pendingDepthSnapshot?.orders?.size ?? 0,
      retainedTrades: instrument.trades.length,
    }));
  }

  /**
   * Return retained executions independently from the lightweight order-book
   * snapshot.  Snapshot payloads deliberately carry only a small recent tail
   * so depth/health requests stay cheap; indicator calculations must use the
   * complete retained tape or session profiles and historical Big Trades are
   * silently corrupted.
   */
  trades(exchange, symbol, { fromMs = 0, toMs = Number.POSITIVE_INFINITY, limit = null } = {}) {
    const instrument = this.instruments.get(instrumentKey(exchange, symbol));
    if (!instrument) return [];
    const lower = Number.isFinite(Number(fromMs)) ? Number(fromMs) : 0;
    const upper = Number.isFinite(Number(toMs)) ? Number(toMs) : Number.POSITIVE_INFINITY;
    const filtered = instrument.trades.filter(
      (trade) => trade.timestampMs >= lower && trade.timestampMs <= upper,
    );
    const requestedLimit = Number(limit);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) return filtered;
    return filtered.slice(-Math.floor(requestedLimit));
  }

  /**
   * Return lossless, pre-aggregated aggressor flow. This survives raw-tape
   * compaction and is the authoritative historical input for CVD on time bars.
   */
  flowCandles(
    exchange,
    symbol,
    { fromMs = 0, toMs = Number.POSITIVE_INFINITY, intervalMs = FLOW_BUCKET_MS, limit = 20_000 } = {},
  ) {
    const instrument = this.instruments.get(instrumentKey(exchange, symbol));
    if (!instrument) return [];
    const lower = Number.isFinite(Number(fromMs)) ? Number(fromMs) : 0;
    const upper = Number.isFinite(Number(toMs)) ? Number(toMs) : Number.POSITIVE_INFINITY;
    const duration = Math.max(FLOW_BUCKET_MS, Math.floor(Number(intervalMs) || FLOW_BUCKET_MS));
    const source = [...instrument.flowCandles.values()].filter(
      (candle) => candle.timestamp >= lower - duration && candle.timestamp <= upper,
    );
    return aggregateFlowCandles(source, duration).slice(-Math.max(1, Math.floor(Number(limit) || 20_000)));
  }

  snapshot(exchange, symbol, depth = 100, options = {}) {
    const instrument = this.instruments.get(instrumentKey(exchange, symbol));
    if (!instrument) return null;
    const bids = snapshotLevels(instrument.bids, depth, true);
    const asks = snapshotLevels(instrument.asks, depth, false);
    // Non-empty sides alone do not establish a valid executable book. Keep
    // the raw rows for diagnostics/recordings, but never certify a crossed
    // baseline as full depth or silently trim it around the last trade.
    const crossedBook = Boolean(bids.length && asks.length && bids[0].price >= asks[0].price);
    const afterSequence = Math.max(0, Number(options.afterSequence) || 0);
    const tradeLimit = Math.max(0, Math.floor(Number(options.tradeLimit ?? 2_500) || 0));
    const trades = snapshotTrades(instrument.trades, afterSequence, tradeLimit);
    const includeOrders = options.includeOrders === true;
    const orderLimit = Math.min(50_000, Math.max(1, Math.floor(Number(options.orderLimit) || 50_000)));
    let orders;
    let orderStateComplete = false;
    if (includeOrders && instrument.individualOrders) {
      // The incremental lifecycle tape is contract-wide. Seed the same bounded
      // scope once: a visible-price-only baseline would become unknowable as
      // soon as an off-screen MODIFY/REMOVE arrived, even though no events were
      // lost. Pane depth is a presentation filter applied after reconstruction.
      const selected = [...instrument.orders.values()];
      const priority = (value) => {
        try {
          const parsed = BigInt(String(value || "0"));
          return parsed > 0n ? parsed : null;
        } catch {
          return null;
        }
      };
      selected.sort((left, right) => {
        if (left.side !== right.side) return left.side === "BUY" ? -1 : 1;
        if (left.price !== right.price) {
          return left.side === "BUY" ? right.price - left.price : left.price - right.price;
        }
        const leftPriority = priority(left.priority);
        const rightPriority = priority(right.priority);
        if (leftPriority === null && rightPriority !== null) return 1;
        if (leftPriority !== null && rightPriority === null) return -1;
        if (leftPriority !== null && rightPriority !== null && leftPriority !== rightPriority)
          return leftPriority < rightPriority ? -1 : 1;
        return String(left.id).localeCompare(String(right.id));
      });
      orders = selected.slice(0, orderLimit).map((order) => ({
        orderId: String(order.id),
        side: order.side === "BUY" ? "BID" : "ASK",
        price: Number(order.price),
        size: Number(order.size),
        priority: String(order.priority || "0"),
      }));
      orderStateComplete = instrument.orders.size <= orderLimit && instrument.pendingDepthSnapshot === null;
    }
    return {
      provider: "Rithmic",
      exchange: instrument.exchange,
      symbol: instrument.symbol,
      sequence: instrument.sequence,
      sourceSequence: instrument.sourceSequence,
      asOfMs: instrument.asOfMs,
      ageMs: instrument.asOfMs ? Math.max(0, Date.now() - instrument.asOfMs) : null,
      lastPrice: instrument.lastPrice,
      bestBid: instrument.bestBid || bids[0] || null,
      bestAsk: instrument.bestAsk || asks[0] || null,
      bids,
      asks,
      trades,
      flowTotals: {
        askVolume: instrument.askVolumeTotal,
        bidVolume: instrument.bidVolumeTotal,
      },
      depthMode: instrument.depthMode,
      fullDepth:
        ["L3", "MBO_AGGREGATED"].includes(instrument.depthMode) &&
        instrument.bookValid && !crossedBook,
      individualOrders: instrument.individualOrders,
      bookValid: instrument.bookValid && !crossedBook,
      crossedBook,
      orderCount: instrument.orders.size,
      orderEventSequence: instrument.orderEventSequence,
      orders,
      orderStateComplete,
    };
  }
}

export { aggregateFlowCandles, eventTimestampMs, instrumentKey };
