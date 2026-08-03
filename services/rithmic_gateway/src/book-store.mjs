function instrumentKey(exchange, symbol) {
  return `${String(exchange || "").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function eventTimestampMs(payload) {
  const seconds = Number(payload.sourceSsboe ?? payload.ssboe ?? 0);
  const microseconds = Number(payload.sourceUsecs ?? payload.usecs ?? 0);
  return seconds > 0 ? seconds * 1_000 + Math.floor(microseconds / 1_000) : Date.now();
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
    sequence: 0,
    sourceSequence: "0",
    asOfMs: 0,
    lastPrice: null,
    bestBid: null,
    bestAsk: null,
    bookValid: false,
    depthMode: "TRADES",
    individualOrders: false,
    maxTrades,
  };
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
      payload.exchangeOrderId || payload.aggressorExchangeOrderId || instrument.sequence,
    );
    instrument.asOfMs = eventTimestampMs(payload);
    instrument.lastPrice = price;
    const aggressor =
      Number(payload.aggressor) === 1 ? "BUY" : Number(payload.aggressor) === 2 ? "SELL" : "UNKNOWN";
    const trade = {
      id: `${instrument.exchange}:${instrument.symbol}:${instrument.asOfMs}:${instrument.sequence}`,
      sequence: instrument.sequence,
      sourceSequence: instrument.sourceSequence,
      timestampMs: instrument.asOfMs,
      price,
      size,
      aggressor,
    };
    instrument.trades.push(trade);
    if (instrument.trades.length > instrument.maxTrades) {
      instrument.trades.splice(0, instrument.trades.length - instrument.maxTrades);
    }
    return { type: "trade", instrument: instrumentKey(instrument.exchange, instrument.symbol), trade };
  }

  applyBbo(payload) {
    const instrument = this.ensure(payload.exchange, payload.symbol);
    instrument.asOfMs = eventTimestampMs(payload);
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
      instrument.asOfMs = eventTimestampMs(payload);
      instrument.sequence += 1;
      return { type: "depth", instrument: instrumentKey(instrument.exchange, instrument.symbol) };
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
    instrument.asOfMs = eventTimestampMs(payload);
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
    if (!payload.symbol || !payload.exchange || payload.depthPrice == null) return null;
    const instrument = this.ensure(payload.exchange, payload.symbol);
    const side = Number(payload.depthSide) === 1 ? "BUY" : "SELL";
    const sizes = payload.depthSize || [];
    const priorities = payload.depthOrderPriority || [];
    const ids = payload.exchangeOrderId || [];
    for (let index = 0; index < sizes.length; index += 1) {
      const id = String(ids[index] || `${side}:${payload.depthPrice}:${priorities[index] || index}`);
      instrument.orders.set(id, {
        id,
        side,
        price: Number(payload.depthPrice),
        size: Number(sizes[index] || 0),
        priority: String(priorities[index] || "0"),
      });
    }
    instrument.sourceSequence = String(payload.sequenceNumber || instrument.sourceSequence);
    instrument.sequence += 1;
    rebuildDepthByOrder(instrument);
    return { type: "depth", instrument: instrumentKey(instrument.exchange, instrument.symbol) };
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
    for (let index = 0; index < updates.length; index += 1) {
      const id = String(ids[index] || `${sides[index]}:${prices[index]}:${priorities[index] || index}`);
      const updateType = Number(updates[index]);
      if (updateType === 3) {
        instrument.orders.delete(id);
        continue;
      }
      const existing = instrument.orders.get(id);
      instrument.orders.set(id, {
        id,
        side: Number(sides[index]) === 1 ? "BUY" : Number(sides[index]) === 2 ? "SELL" : existing?.side,
        price: Number(
          prices[index] ??
            (payload.prevDepthPriceFlag?.[index] ? previousPrices[index] : existing?.price),
        ),
        size: Number(sizes[index] ?? existing?.size ?? 0),
        priority: String(priorities[index] ?? existing?.priority ?? "0"),
      });
    }
    instrument.sourceSequence = String(payload.sequenceNumber || instrument.sourceSequence);
    instrument.asOfMs = eventTimestampMs(payload);
    instrument.sequence += 1;
    rebuildDepthByOrder(instrument);
    if (sequenceRegression) instrument.bookValid = false;
    return {
      type: "depth",
      instrument: instrumentKey(instrument.exchange, instrument.symbol),
      sequenceRegression,
      previousSequence: sequenceRegression ? String(previousSequence) : null,
      receivedSequence: sequenceRegression ? String(incomingSequence) : null,
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

  snapshot(exchange, symbol, depth = 100) {
    const instrument = this.instruments.get(instrumentKey(exchange, symbol));
    if (!instrument) return null;
    const bids = [...instrument.bids.values()]
      .sort((left, right) => right.price - left.price)
      .slice(0, depth);
    const asks = [...instrument.asks.values()]
      .sort((left, right) => left.price - right.price)
      .slice(0, depth);
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
      trades: instrument.trades.slice(-2_500),
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

export { eventTimestampMs, instrumentKey };
