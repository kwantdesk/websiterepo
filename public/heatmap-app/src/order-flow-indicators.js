const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const DEFAULT_INDICATOR_SETTINGS = Object.freeze({
  cvdEnabled: true,
  cvdPanel: true,
  cvdDisplayStyle: 'candles',
  cvdMinimumTradeSize: 1,
  cvdMaximumTradeSize: 0,
  cvdRange: 'loaded',
  cvdScale: 'compact',
  cvdSplit: false,
  absorptionEnabled: true,
  absorptionAutomatic: true,
  absorptionWindowMs: 1_000,
  absorptionMinimumVolume: 24,
  absorptionLookbackMs: 120_000,
  absorptionSdMultiplier: 2.5,
  sweepsEnabled: true,
  sweepsAutomatic: true,
  sweepWindowMs: 500,
  sweepMinimumVolume: 36,
  sweepMinimumLevels: 3,
  sweepLookbackMs: 120_000,
  sweepSdMultiplier: 2.8,
  imbalanceDepthLevels: 10,
  imbalanceDecay: 0.12,
});

export function flattenTrades(history) {
  const flattened = [];
  let sequence = 0;
  history.forEach((frame, frameIndex) => {
    for (const trade of frame.trades || []) {
      const size = finite(trade.size);
      const tick = finite(trade.tick, NaN);
      if (!(size > 0) || !Number.isFinite(tick) || !['buy', 'sell'].includes(trade.side)) continue;
      flattened.push({
        ...trade,
        id: trade.id ?? `${frame.id ?? frameIndex}:${sequence}`,
        tick,
        size,
        side: trade.side,
        timestamp: finite(trade.timestamp, finite(frame.timestamp)),
        frameIndex,
        sequence: sequence++,
      });
    }
  });
  flattened.sort((left, right) => (
    left.timestamp - right.timestamp
    || left.frameIndex - right.frameIndex
    || left.sequence - right.sequence
  ));
  return flattened;
}

export function tradeAllowed(trade, minimum = 1, maximum = 0) {
  const size = finite(trade?.size);
  const min = Math.max(0, finite(minimum, 1));
  const max = Math.max(0, finite(maximum));
  return size >= min && (max === 0 || size <= max);
}

export function computeCvdSeries(history, {
  minimumTradeSize = 1,
  maximumTradeSize = 0,
  resetIndex = 0,
} = {}) {
  const points = [];
  let buy = 0;
  let sell = 0;
  const reset = Math.max(0, Math.floor(finite(resetIndex)));
  history.forEach((frame, frameIndex) => {
    if (frameIndex < reset) {
      points.push({ frameIndex, value: 0, buy: 0, sell: 0 });
      return;
    }
    const open = buy + sell;
    let high = open;
    let low = open;
    for (const trade of frame.trades || []) {
      if (!tradeAllowed(trade, minimumTradeSize, maximumTradeSize)) continue;
      if (trade.side === 'buy') buy += finite(trade.size);
      if (trade.side === 'sell') sell -= finite(trade.size);
      const running = buy + sell;
      high = Math.max(high, running);
      low = Math.min(low, running);
    }
    const close = buy + sell;
    points.push({ frameIndex, value: close, open, high, low, close, buy, sell });
  });
  return { points, buy, sell, value: buy + sell };
}

function bucketVolumes(trades, windowMs, lookbackMs, endTimestamp) {
  const width = Math.max(1, finite(windowMs, 1_000));
  const lookback = Math.max(width, finite(lookbackMs, 120_000));
  const end = finite(endTimestamp, trades.at(-1)?.timestamp || 0);
  const start = end - lookback;
  const buckets = new Map();
  for (const trade of trades) {
    if (trade.timestamp < start || trade.timestamp > end) continue;
    const bucket = Math.floor(trade.timestamp / width) * width;
    buckets.set(bucket, (buckets.get(bucket) || 0) + trade.size);
  }
  return [...buckets.values()];
}

export function estimateAutoThreshold(trades, {
  windowMs = 1_000,
  lookbackMs = 120_000,
  sdMultiplier = 2.5,
  floor = 1,
  endTimestamp,
} = {}) {
  const volumes = bucketVolumes(trades, windowMs, lookbackMs, endTimestamp);
  const minimum = Math.max(1, finite(floor, 1));
  if (volumes.length < 2) return minimum;
  const mean = volumes.reduce((sum, value) => sum + value, 0) / volumes.length;
  const variance = volumes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / volumes.length;
  return Math.max(minimum, mean + Math.max(0, finite(sdMultiplier, 2.5)) * Math.sqrt(variance));
}

export function buildAdaptiveThresholdSeries(trades, options = {}) {
  const width = Math.max(1, finite(options.windowMs, 1_000));
  const lookback = Math.max(width, finite(options.lookbackMs, 120_000));
  const multiplier = Math.max(0, finite(options.sdMultiplier, 2.5));
  const minimum = Math.max(1, finite(options.floor, 1));
  const completed = [];
  const thresholds = [];
  let completedSum = 0;
  let completedSquareSum = 0;
  let currentBucket = null;
  let currentVolume = 0;
  for (const trade of trades) {
    const bucket = Math.floor(trade.timestamp / width) * width;
    if (currentBucket !== bucket) {
      if (currentBucket !== null) {
        completed.push({ timestamp: currentBucket, volume: currentVolume });
        completedSum += currentVolume;
        completedSquareSum += currentVolume ** 2;
      }
      currentBucket = bucket;
      currentVolume = 0;
      while (completed.length && completed[0].timestamp < bucket - lookback) {
        const expired = completed.shift();
        completedSum -= expired.volume;
        completedSquareSum -= expired.volume ** 2;
      }
    }
    if (completed.length < 2) {
      thresholds.push(minimum);
    } else {
      const mean = completedSum / completed.length;
      const variance = Math.max(0, completedSquareSum / completed.length - mean ** 2);
      thresholds.push(Math.max(minimum, mean + multiplier * Math.sqrt(variance)));
    }
    currentVolume += trade.size;
  }
  return thresholds;
}

function eventThreshold(thresholds, index, fallback) {
  return Math.max(1, finite(thresholds?.[index], finite(fallback, 1)));
}

export function detectAbsorptions(trades, {
  windowMs = 1_000,
  threshold = 1,
  thresholds = null,
} = {}) {
  const width = Math.max(1, finite(windowMs, 1_000));
  const states = new Map();
  const events = [];
  trades.forEach((trade, tradeIndex) => {
    const key = `${trade.side}:${trade.tick}`;
    const state = states.get(key) || { queue: [], volume: 0, armed: true };
    while (state.queue.length && trade.timestamp - state.queue[0].timestamp > width) {
      state.volume -= state.queue.shift().size;
    }
    const required = eventThreshold(thresholds, tradeIndex, threshold);
    if (state.volume < required) state.armed = true;
    state.queue.push(trade);
    state.volume += trade.size;
    if (state.armed && state.volume >= required) {
      events.push({
        id: `absorption:${trade.side}:${trade.tick}:${state.queue[0].timestamp}`,
        type: 'absorption',
        frameIndex: trade.frameIndex,
        timestamp: trade.timestamp,
        tick: trade.tick,
        aggressiveSide: trade.side,
        passiveSide: trade.side === 'buy' ? 'seller' : 'buyer',
        bookSide: trade.side === 'buy' ? 'ask' : 'bid',
        volume: state.volume,
        threshold: required,
        windowMs: width,
      });
      state.armed = false;
    }
    states.set(key, state);
  });
  return events;
}

export function detectSweeps(trades, {
  windowMs = 500,
  threshold = 1,
  thresholds = null,
  minimumLevels = 3,
} = {}) {
  const width = Math.max(1, finite(windowMs, 500));
  const levelMinimum = Math.max(2, Math.floor(finite(minimumLevels, 3)));
  const states = new Map();
  const events = [];
  trades.forEach((trade, tradeIndex) => {
    const state = states.get(trade.side) || { queue: [], volume: 0, levels: new Map(), armed: true };
    while (state.queue.length && trade.timestamp - state.queue[0].timestamp > width) {
      const expired = state.queue.shift();
      state.volume -= expired.size;
      const count = (state.levels.get(expired.tick) || 1) - 1;
      if (count <= 0) state.levels.delete(expired.tick); else state.levels.set(expired.tick, count);
    }
    const required = eventThreshold(thresholds, tradeIndex, threshold);
    if (state.volume < required || state.levels.size < levelMinimum) state.armed = true;
    state.queue.push(trade);
    state.volume += trade.size;
    state.levels.set(trade.tick, (state.levels.get(trade.tick) || 0) + 1);
    if (state.armed && state.volume >= required && state.levels.size >= levelMinimum) {
      const levels = [...state.levels.keys()].sort((left, right) => left - right);
      events.push({
        id: `sweep:${trade.side}:${state.queue[0].timestamp}`,
        type: 'sweep',
        frameIndex: trade.frameIndex,
        timestamp: trade.timestamp,
        tick: trade.side === 'buy' ? levels.at(-1) : levels[0],
        aggressiveSide: trade.side,
        volume: state.volume,
        threshold: required,
        levelCount: levels.length,
        levels,
        windowMs: width,
      });
      state.armed = false;
    }
    states.set(trade.side, state);
  });
  return events;
}

function orderedBook(book, descending) {
  const entries = book instanceof Map ? [...book.entries()] : Array.isArray(book) ? book : [];
  return entries
    .filter(([, size]) => finite(size) > 0)
    .sort((left, right) => descending ? right[0] - left[0] : left[0] - right[0]);
}

export function computeOrderbookImbalance(snapshot, { levels = 10, decay = 0.12 } = {}) {
  const count = Math.max(1, Math.floor(finite(levels, 10)));
  const falloff = Math.max(0, finite(decay, 0.12));
  const sum = entries => entries.slice(0, count).reduce(
    (total, [, size], index) => total + finite(size) * Math.exp(-falloff * index),
    0,
  );
  const bid = sum(orderedBook(snapshot?.bids, true));
  const ask = sum(orderedBook(snapshot?.asks, false));
  const total = bid + ask;
  return { bid, ask, value: total > 0 ? (bid - ask) / total : 0 };
}

export function computeVolumeImbalance(trades) {
  let buy = 0;
  let sell = 0;
  for (const trade of trades || []) {
    if (trade.side === 'buy') buy += finite(trade.size);
    if (trade.side === 'sell') sell += finite(trade.size);
  }
  const total = buy + sell;
  return { buy, sell, value: total > 0 ? (buy - sell) / total : 0 };
}

export function analyzeOrderFlow(history, options = {}) {
  const settings = { ...DEFAULT_INDICATOR_SETTINGS, ...options };
  const trades = flattenTrades(history);
  const absorptionThresholds = settings.absorptionAutomatic
    ? buildAdaptiveThresholdSeries(trades, {
      windowMs: settings.absorptionWindowMs,
      lookbackMs: settings.absorptionLookbackMs,
      sdMultiplier: settings.absorptionSdMultiplier,
      floor: settings.absorptionMinimumVolume,
    })
    : null;
  const sweepThresholds = settings.sweepsAutomatic
    ? buildAdaptiveThresholdSeries(trades, {
      windowMs: settings.sweepWindowMs,
      lookbackMs: settings.sweepLookbackMs,
      sdMultiplier: settings.sweepSdMultiplier,
      floor: settings.sweepMinimumVolume,
    })
    : null;
  const cvd = computeCvdSeries(history, {
    minimumTradeSize: settings.cvdMinimumTradeSize,
    maximumTradeSize: settings.cvdMaximumTradeSize,
  });
  const absorptionEvents = settings.absorptionEnabled ? detectAbsorptions(trades, {
    windowMs: settings.absorptionWindowMs,
    threshold: settings.absorptionMinimumVolume,
    thresholds: absorptionThresholds,
  }) : [];
  const sweepEvents = settings.sweepsEnabled ? detectSweeps(trades, {
    windowMs: settings.sweepWindowMs,
    threshold: settings.sweepMinimumVolume,
    thresholds: sweepThresholds,
    minimumLevels: settings.sweepMinimumLevels,
  }) : [];
  return {
    trades,
    cvd,
    absorptionEvents,
    sweepEvents,
    volumeImbalance: computeVolumeImbalance(trades),
    thresholds: {
      absorption: absorptionThresholds?.at(-1) ?? settings.absorptionMinimumVolume,
      sweep: sweepThresholds?.at(-1) ?? settings.sweepMinimumVolume,
    },
  };
}
