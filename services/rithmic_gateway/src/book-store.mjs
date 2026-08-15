function instrumentKey(exchange, symbol) {
  return `${String(exchange || "").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function eventTimestampMs(payload) {
  const seconds = Number(payload.sourceSsboe ?? payload.ssboe ?? 0);
  const microseconds = Number(payload.sourceUsecs ?? payload.usecs ?? 0);
  return seconds > 0 ? seconds * 1_000 + Math.floor(microseconds / 1_000) : 0;
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
    sourceSequence: "0",
    asOfMs: 0,
    lastPrice: null,
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
  const bidOrders = new Map();
  const askOrders = new Map();
  for (const order of instrument.orders.values()) {
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

  resetDepth(exchange, symbol) {
    const instrument = this.ensure(exchange, symbol);
    instrument.bids.clear();
    instrument.asks.clear();
    instrument.orders.clear();
    instrument.pendingDepthSnapshot = null;
    instrument.bookValid = false;
    instrument.depthMode = "TRADES";
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
    instrument.asOfMs = eventTimestampMs(payload) || Date.now();
    instrument.lastPrice = price;
    const aggressor =
      Number(payload.aggressor) === 1 ? "BUY" : Number(payload.aggressor) === 2 ? "SELL" : "UNKNOWN";
    const trade = {
      id: payload.sourceTradeId
        ? `${instrument.exchange}:${instrument.symbol}:${payload.sourceTradeId}`
        : `${instrument.exchange}:${instrument.symbol}:${instrument.asOfMs}:${instrument.sequence}`,
      sequence: instrument.sequence,
      sourceSequence: instrument.sourceSequence,
      timestampMs: instrument.asOfMs,
      price,
      size,
      aggressor,
    };
    instrument.trades.push(trade);
    recordTradeFlow(instrument, trade);
    if (instrument.trades.length > instrument.maxTrades) {
      instrument.trades.splice(0, instrument.trades.length - instrument.maxTrades);
    }
    return { type: "trade", instrument: instrumentKey(instrument.exchange, instrument.symbol), trade };
  }

  applyBbo(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    instrument.asOfMs = eventTimestampMs(payload) || instrument.asOfMs || Date.now();
    if (Number.isFinite(Number(payload.bidPrice)) && Number(payload.bidPrice) > 0) {
      instrument.bestBid = {
        price: Number(payload.bidPrice),
        size: Number(payload.bidSize || 0),
        orders: Number(payload.bidOrders || 0),
      };
    }
    if (Number.isFinite(Number(payload.askPrice)) && Number(payload.askPrice) > 0) {
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
    if (instrument.orders.size > 0 && instrument.depthMode === "L3") {
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
    instrument.asOfMs = eventTimestampMs(payload) || instrument.asOfMs || Date.now();
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
    if (instrument.trades.length > instrument.maxTrades) {
      instrument.trades.splice(0, instrument.trades.length - instrument.maxTrades);
    }

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

  applyDepthSnapshot(payload) {
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
      instrument.orders = pending.orders;
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
    for (let index = 0; index < updates.length; index += 1) {
      const id = String(ids[index] || `${sides[index]}:${prices[index]}:${priorities[index] || index}`);
      const updateType = Number(updates[index]);
      const existing = instrument.orders.get(id);
      if (updateType === 3) {
        if (existing) {
          orderEvents.push({
            sequence: instrument.sequence + orderEvents.length + 1,
            timestamp,
            orderId: id,
            action: "REMOVE",
            side: existing.side === "BUY" ? "BID" : "ASK",
            price: Number(existing.price),
            previousPrice: Number(existing.price),
            size: 0,
            previousSize: Number(existing.size || 0),
          });
        }
        removeOrderFromDepth(instrument, existing);
        instrument.orders.delete(id);
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
      orderEvents.push({
        sequence: instrument.sequence + orderEvents.length + 1,
        timestamp,
        orderId: id,
        action: existing ? "MODIFY" : "ADD",
        side: nextOrder.side === "BUY" ? "BID" : "ASK",
        price: Number(nextOrder.price),
        previousPrice: existing ? Number(existing.price) : null,
        size: Number(nextOrder.size || 0),
        previousSize: Number(existing?.size || 0),
      });
      // Updating one order used to rebuild every price level from every order
      // in the book. At active CME rates that is O(messages * total orders)
      // and pinned the gateway above 100% CPU. Maintain the two affected
      // aggregates instead, making each DBO update O(1).
      removeOrderFromDepth(instrument, existing);
      instrument.orders.set(id, nextOrder);
      addOrderToDepth(instrument, nextOrder);
    }
    instrument.sourceSequence = String(payload.sequenceNumber || instrument.sourceSequence);
    instrument.asOfMs = eventTimestampMs(payload) || instrument.asOfMs;
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
    const bids = [...instrument.bids.values()]
      .sort((left, right) => right.price - left.price)
      .slice(0, depth);
    const asks = [...instrument.asks.values()]
      .sort((left, right) => left.price - right.price)
      .slice(0, depth);
    const afterSequence = Math.max(0, Number(options.afterSequence) || 0);
    const tradeLimit = Math.max(0, Math.floor(Number(options.tradeLimit ?? 2_500) || 0));
    const matchingTrades = afterSequence > 0
      ? instrument.trades.filter((trade) => Number(trade.sequence) > afterSequence)
      : instrument.trades;
    const trades = tradeLimit > 0 ? matchingTrades.slice(-tradeLimit) : [];
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
        instrument.bookValid,
      individualOrders: instrument.individualOrders,
      bookValid: instrument.bookValid,
      orderCount: instrument.orders.size,
    };
  }
}

export { aggregateFlowCandles, eventTimestampMs, instrumentKey };
