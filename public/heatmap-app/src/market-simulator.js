export const SYMBOLS = {
  MNQ: {
    key: 'MNQ', contract: 'MNQU6', venue: 'CME', description: 'Micro E-mini Nasdaq-100',
    tickSize: 0.25, decimals: 2, startPrice: 22486.25, baseDepth: 42, volatility: 0.19, seed: 0x4d4e51,
    depthRangePoints: 100,
  },
  ES: {
    key: 'ES', contract: 'ESU6', venue: 'CME', description: 'E-mini S&P 500',
    tickSize: 0.25, decimals: 2, startPrice: 6387.50, baseDepth: 86, volatility: 0.13, seed: 0x455355,
  },
  BTC: {
    key: 'BTC', contract: 'BTC-USD', venue: 'CRYPTO', description: 'Bitcoin / U.S. Dollar',
    tickSize: 1, decimals: 0, startPrice: 118420, baseDepth: 13, volatility: 0.31, seed: 0x425443,
  },
};

class DeterministicRandom {
  constructor(seed) { this.state = seed >>> 0 || 1; }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  normal() {
    const u = Math.max(1e-9, this.next());
    const v = Math.max(1e-9, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

export class SyntheticMarket {
  constructor(symbol = 'MNQ') {
    this.intervalMs = 100;
    this.setSymbol(symbol);
  }

  setSymbol(symbol) {
    this.config = SYMBOLS[symbol] || SYMBOLS.MNQ;
    this.depthRadius = Math.max(
      16,
      Math.round((this.config.depthRangePoints ?? this.config.tickSize * 110) / this.config.tickSize),
    );
    this.random = new DeterministicRandom(this.config.seed);
    this.eventId = 0;
    this.elapsedMs = 0;
    this.midTick = this.config.startPrice / this.config.tickSize;
    this.sessionOpenTick = this.midTick;
    this.velocity = 0;
    this.flowBias = 0;
    this.cvd = 0;
    this.totalVolume = 0;
    this.depth = new Map();
    this.walls = new Map();
    this.recentRate = 0;
    this.sweepPulse = 0;
    this.absorptionPulse = 0;
    this.lastBestBid = Math.floor(this.midTick - 0.5);
    this.lastBestAsk = this.lastBestBid + 1;
    const now = Date.now();
    this.startTimestamp = now - 74 * 1000;
    this.timestamp = this.startTimestamp;
    this.#seedDepth();
  }

  #seedDepth() {
    const bid = Math.floor(this.midTick - 0.5);
    const ask = bid + 1;
    for (let tick = bid - this.depthRadius; tick <= ask + this.depthRadius; tick += 1) {
      if (tick > bid && tick < ask) continue;
      const distance = tick <= bid ? bid - tick + 1 : tick - ask + 1;
      this.depth.set(tick, this.#targetDepth(distance));
    }
  }

  #targetDepth(distance) {
    const cfg = this.config;
    const distanceCurve = 0.58 + 0.74 * (1 - Math.exp(-distance / 13));
    const wave = 1 + 0.2 * Math.sin(distance * 0.61 + this.elapsedMs * 0.00013);
    return Math.max(1, cfg.baseDepth * distanceCurve * wave * (0.64 + this.random.next() * 0.72));
  }

  #maybeCreateWall(bestBid, bestAsk) {
    if (this.random.next() > 0.022) return;
    const sign = this.random.next() < 0.5 ? -1 : 1;
    const offset = 5 + Math.floor(Math.pow(this.random.next(), 0.72) * 60);
    const tick = sign < 0 ? bestBid - offset : bestAsk + offset;
    if (this.walls.has(tick)) return;
    const scale = this.config.baseDepth * (4.5 + this.random.next() * 12);
    this.walls.set(tick, {
      side: sign < 0 ? 'bid' : 'ask',
      size: scale,
      baseline: this.depth.get(tick) || this.#targetDepth(offset + 1),
      age: 0,
      life: 240 + Math.floor(this.random.next() * 560),
      phase: this.random.next() * Math.PI * 2,
    });
  }

  #distanceFromBook(tick, bestBid, bestAsk) {
    return tick <= bestBid ? bestBid - tick + 1 : tick - bestAsk + 1;
  }

  #evolveWalls(bestBid, bestAsk) {
    for (const [tick, wall] of this.walls) {
      wall.age += 1;
      const distance = this.#distanceFromBook(tick, bestBid, bestAsk);
      const tradedThrough = wall.side === 'bid' ? bestAsk <= tick : bestBid >= tick;
      if (tradedThrough || wall.age >= wall.life || this.random.next() < 0.00025) {
        this.walls.delete(tick);
        this.depth.set(tick, Math.round(this.#targetDepth(distance)));
        continue;
      }
      if ((this.eventId + Math.abs(tick)) % 2 === 0) {
        const cycle = 0.5 + 0.5 * Math.sin(wall.phase + this.elapsedMs * 0.00072);
        const displayed = wall.baseline + wall.size * (0.84 + 0.14 * cycle);
        this.depth.set(tick, Math.max(1, Math.round(displayed)));
      }
    }
  }

  #evolveDepth(bestBid, bestAsk) {
    const minimumTick = bestBid - this.depthRadius;
    const maximumTick = bestAsk + this.depthRadius;
    for (let tick = minimumTick; tick <= maximumTick; tick += 1) {
      if (this.depth.has(tick)) continue;
      this.depth.set(tick, Math.round(this.#targetDepth(this.#distanceFromBook(tick, bestBid, bestAsk))));
    }

    // A full-depth feed changes many independent price levels between 100 ms
    // samples. Keep the fallback event-carried, but produce enough add/pull and
    // resize events for historical color striations to remain visible.
    const updateCount = Math.max(
      10,
      Math.round((10 + this.random.next() * 13) * this.depthRadius / 110),
    );
    for (let update = 0; update < updateCount; update += 1) {
      const isBid = this.random.next() < 0.5;
      const offset = Math.floor(Math.pow(this.random.next(), 1.7) * this.depthRadius);
      const tick = isBid ? bestBid - offset : bestAsk + offset;
      if (this.walls.has(tick)) continue;
      const distance = offset + 1;
      const previous = this.depth.get(tick) || 0;
      let size;
      const action = this.random.next();
      if (distance > 2 && action < 0.045) {
        size = 0;
      } else if (previous > 0 && action < 0.18) {
        size = previous * (0.42 + this.random.next() * 1.18);
      } else {
        const target = this.#targetDepth(distance);
        size = previous <= 0
          ? target * (0.55 + this.random.next() * 0.6)
          : previous * 0.82 + target * 0.18
            + this.random.normal() * Math.sqrt(Math.max(2, previous)) * 0.55;
        if (distance <= 3 && this.random.next() < 0.12) size *= 0.25 + this.random.next() * 0.5;
      }
      this.depth.set(tick, Math.max(0, Math.round(size)));
    }

    for (const tick of [...this.depth.keys()]) {
      if (tick < minimumTick || tick > maximumTick) this.depth.delete(tick);
    }
  }

  step() {
    this.eventId += 1;
    this.elapsedMs += this.intervalMs;
    this.timestamp += this.intervalMs;

    const bookPressure = this.#nearBookPressure();
    this.flowBias = this.flowBias * 0.91 + this.random.normal() * 0.055 + bookPressure * 0.025;
    this.flowBias = Math.max(-0.68, Math.min(0.68, this.flowBias));
    this.velocity = this.velocity * 0.89 + this.flowBias * 0.045 + this.random.normal() * this.config.volatility * 0.07;

    if (this.random.next() < 0.028) {
      this.velocity += (this.random.next() < 0.5 ? -1 : 1) * (0.5 + this.random.next() * 0.65);
    }

    const moveProbability = Math.min(0.90, 0.42 + Math.abs(this.velocity) * 0.55 + Math.abs(this.flowBias) * 0.16);
    if (this.random.next() < moveProbability) {
      // Several quote events can land in one sampled column; preserve their net tick distance.
      const moveCount = 1
        + (this.random.next() < 0.22 ? 1 : 0)
        + (this.random.next() < 0.04 ? 1 : 0);
      for (let move = 0; move < moveCount; move += 1) {
        const direction = this.velocity + this.flowBias * 0.24 + this.random.normal() * 0.26 >= 0 ? 1 : -1;
        this.midTick += direction;
        this.velocity = this.velocity * 0.97 - direction * 0.035;
      }
    }

    const bestBid = Math.floor(this.midTick - 0.5);
    const bestAsk = bestBid + 1;
    this.#maybeCreateWall(bestBid, bestAsk);
    this.#evolveDepth(bestBid, bestAsk);
    this.#evolveWalls(bestBid, bestAsk);

    const bids = new Map();
    const asks = new Map();
    let maxDepth = 0;
    let wallCount = 0;

    for (let tick = bestBid - this.depthRadius; tick <= bestAsk + this.depthRadius; tick += 1) {
      if (tick > bestBid && tick < bestAsk) continue;
      const isBid = tick <= bestBid;
      const size = this.depth.get(tick) || 0;
      if (size <= 0) continue;
      (isBid ? bids : asks).set(tick, size);
      maxDepth = Math.max(maxDepth, size);
      if (this.walls.has(tick)) wallCount += 1;
    }

    const trades = this.#createTrades(bestBid, bestAsk, bids, asks);
    const imbalance = this.#imbalance(bids, asks, bestBid, bestAsk, 10);
    const microTick = bestBid + imbalance.bid / Math.max(1, imbalance.bid + imbalance.ask);
    const delta = trades.reduce((sum, trade) => sum + (trade.side === 'buy' ? trade.size : -trade.size), 0);
    const volume = trades.reduce((sum, trade) => sum + trade.size, 0);
    this.cvd += delta;
    this.totalVolume += volume;
    this.recentRate = this.recentRate * 0.92 + trades.length * (1000 / this.intervalMs) * 0.08;
    this.sweepPulse *= 0.86;
    this.absorptionPulse *= 0.9;

    const snapshot = {
      id: this.eventId,
      timestamp: this.timestamp,
      bids,
      asks,
      bestBid,
      bestAsk,
      midTick: (bestBid + bestAsk) / 2,
      lastTick: trades.length ? trades[trades.length - 1].tick : (this.flowBias >= 0 ? bestAsk : bestBid),
      trades,
      cvd: this.cvd,
      delta,
      volume,
      totalVolume: this.totalVolume,
      imbalance,
      microTick,
      maxDepth,
      wallCount,
      tradeRate: this.recentRate,
      sweepScore: this.sweepPulse,
      absorptionScore: this.absorptionPulse,
      changeTicks: ((bestBid + bestAsk) / 2) - this.sessionOpenTick,
    };

    this.lastBestBid = bestBid;
    this.lastBestAsk = bestAsk;
    return snapshot;
  }

  #createTrades(bestBid, bestAsk, bids, asks) {
    const trades = [];
    const activity = Math.min(0.72, 0.14 + Math.abs(this.velocity) * 0.22);
    let count = this.random.next() < activity ? 1 : 0;
    if (count > 0 && this.random.next() < 0.16) count += 1 + Math.floor(this.random.next() * 2);
    if (this.random.next() < 0.012) count += 2 + Math.floor(this.random.next() * 4);
    const buyProbability = Math.max(0.12, Math.min(0.88, 0.5 + this.flowBias * 0.58 + this.velocity * 0.12));
    let sweptLevels = 0;

    for (let index = 0; index < count; index += 1) {
      const buy = this.random.next() < buyProbability;
      const heavy = this.random.next() < 0.075;
      const sweep = heavy && this.random.next() < 0.34;
      const levelOffset = sweep ? Math.floor(this.random.next() * 3) : 0;
      const tick = buy ? bestAsk + levelOffset : bestBid - levelOffset;
      let size = Math.max(1, Math.round(-Math.log(Math.max(1e-7, 1 - this.random.next())) * (this.config.baseDepth * 0.11)));
      if (heavy) size += Math.round(this.config.baseDepth * (0.35 + this.random.next() * 1.25));
      const book = buy ? asks : bids;
      const available = book.get(tick) || this.config.baseDepth;
      if (size > available * 0.78) this.absorptionPulse = Math.min(1, this.absorptionPulse + 0.34);
      if (levelOffset > 0) sweptLevels = Math.max(sweptLevels, levelOffset + 1);
      book.set(tick, Math.max(1, available - Math.round(size * 0.42)));
      this.depth.set(tick, book.get(tick));
      trades.push({
        tick,
        size,
        side: buy ? 'buy' : 'sell',
        timestamp: this.timestamp + index * 2,
      });
    }

    if (sweptLevels >= 2) this.sweepPulse = Math.min(1, this.sweepPulse + sweptLevels * 0.28);
    return trades;
  }

  #imbalance(bids, asks, bestBid, bestAsk, levels) {
    let bid = 0;
    let ask = 0;
    for (let offset = 0; offset < levels; offset += 1) {
      bid += bids.get(bestBid - offset) || 0;
      ask += asks.get(bestAsk + offset) || 0;
    }
    return { bid, ask, ratio: bid / Math.max(1, bid + ask) };
  }

  #nearBookPressure() {
    const bid = this.lastBestBid;
    const ask = this.lastBestAsk;
    let bidSize = 0;
    let askSize = 0;
    for (let i = 0; i < 6; i += 1) {
      bidSize += this.depth.get(bid - i) || 0;
      askSize += this.depth.get(ask + i) || 0;
    }
    return (bidSize - askSize) / Math.max(1, bidSize + askSize);
  }
}
