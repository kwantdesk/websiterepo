const MAX_RANGE_BARS_PER_EXECUTION = 8;
const RANGE_DATA_GAP_MS = 15_000;

const CONTRACT_MONTH = /[FGHJKMNQUVXZ]\d{1,2}$/u;

export function eventInterval(value) {
  const raw = String(value || "").trim();
  const paired = raw.match(/^(\d+)\/(\d+)(VB|PF)$/i);
  if (paired) {
    return {
      kind: paired[3].toUpperCase() === "VB" ? "volume-bars" : "point-figure",
      value: Number(paired[1]),
      secondary: Number(paired[2]),
    };
  }
  const simple = raw.match(/^(\d+)(r|v|t|R|dv)$/u);
  if (!simple) return null;
  const suffix = simple[2];
  return {
    kind: suffix === "r" ? "range"
      : suffix === "v" ? "volume"
        : suffix === "t" ? "trade"
          : suffix === "R" ? "renko"
            : "delta",
    value: Number(simple[1]),
    secondary: 1,
  };
}

export function futuresTickSize(symbol) {
  const root = String(symbol || "").toUpperCase().split(".")[0].replace(CONTRACT_MONTH, "");
  if (["ES", "MES", "NQ", "MNQ"].includes(root)) return 0.25;
  if (["YM", "MYM"].includes(root)) return 1;
  if (["RTY", "M2K"].includes(root)) return 0.1;
  if (["CL", "MCL"].includes(root)) return 0.01;
  if (root === "QM") return 0.025;
  if (["RB", "HO"].includes(root)) return 0.0001;
  if (root === "NG") return 0.001;
  if (root === "QG") return 0.005;
  if (["GC", "MGC", "PL", "PA"].includes(root)) return 0.1;
  if (["SI", "SIL"].includes(root)) return 0.005;
  if (root === "HG") return 0.0005;
  if (["ZN", "TN"].includes(root)) return 1 / 64;
  if (["ZB", "UB"].includes(root)) return 1 / 32;
  if (root === "ZF") return 1 / 128;
  if (root === "ZT") return 1 / 256;
  if (root === "10Y") return 0.001;
  if (root === "SR3") return 0.0025;
  if (["6E", "6A", "6C", "6S", "6N"].includes(root)) return 0.00005;
  if (["6B", "M6E", "M6A", "M6B", "M6C", "MCD", "MSF"].includes(root)) return 0.0001;
  if (root === "6J") return 0.0000005;
  if (root === "6M") return 0.00001;
  if (["ZC", "ZW", "ZS"].includes(root)) return 0.25;
  if (root === "ZM") return 0.1;
  if (root === "ZL") return 0.01;
  if (["LE", "HE", "GF"].includes(root)) return 0.025;
  if (["BTC", "MBT"].includes(root)) return 5;
  if (["ETH", "MET"].includes(root)) return 0.5;
  return 0.01;
}

function thresholdFor(interval, symbol) {
  const parsed = eventInterval(interval);
  if (!parsed) return null;
  if (["volume", "trade", "delta"].includes(parsed.kind)) {
    return { ...parsed, value: Math.max(1, parsed.value), secondary: Math.max(1, parsed.secondary) };
  }
  const tick = futuresTickSize(symbol);
  return {
    ...parsed,
    value: Math.max(tick, parsed.value * tick),
    secondary: Math.max(tick, parsed.secondary * tick),
  };
}

function safeTimestamp(timestamp, previous) {
  return previous ? Math.max(timestamp, previous.timestamp + 1) : timestamp;
}

function makeCandle(record, timestamp, volume = 0, trades = 0, delta = 0) {
  return {
    timestamp,
    open: record.price,
    high: record.price,
    low: record.price,
    close: record.price,
    volume,
    trades,
    delta,
    askVolume: delta > 0 ? volume : 0,
    bidVolume: delta < 0 ? volume : 0,
    sourceStartTimestamp: record.timestamp,
    sourceEndTimestamp: record.timestamp,
  };
}

function makeContinuation(record, previous) {
  const candle = makeCandle({ ...record, price: previous.close }, safeTimestamp(record.timestamp, previous));
  candle.open = previous.close;
  return candle;
}

function update(candle, price, volume, trades, delta) {
  candle.high = Math.max(candle.high, price);
  candle.low = Math.min(candle.low, price);
  candle.close = price;
  candle.volume = Math.max(0, Number(candle.volume || 0)) + volume;
  candle.trades = Math.max(0, Number(candle.trades || 0)) + trades;
  candle.delta = Number(candle.delta || 0) + delta;
  candle.askVolume = Math.max(0, Number(candle.askVolume || 0)) + (delta > 0 ? volume : 0);
  candle.bidVolume = Math.max(0, Number(candle.bidVolume || 0)) + (delta < 0 ? volume : 0);
}

function updateFlow(candle, volume, trades, delta) {
  candle.volume = Math.max(0, Number(candle.volume || 0)) + volume;
  candle.trades = Math.max(0, Number(candle.trades || 0)) + trades;
  candle.delta = Number(candle.delta || 0) + delta;
  candle.askVolume = Math.max(0, Number(candle.askVolume || 0)) + (delta > 0 ? volume : 0);
  candle.bidVolume = Math.max(0, Number(candle.bidVolume || 0)) + (delta < 0 ? volume : 0);
}

function addThreshold(bars, record, threshold) {
  const volume = Math.max(0, Number(record.size) || 0);
  const trades = Math.max(1, Number(record.trades) || 1);
  const delta = Number(record.delta) || 0;
  let last = bars.at(-1);
  if (!last) {
    last = makeCandle(record, safeTimestamp(record.timestamp));
    bars.push(last);
  }
  const filled = threshold.kind === "volume" ? Number(last.volume || 0)
    : threshold.kind === "trade" ? Number(last.trades || 0)
      : Math.abs(Number(last.delta || 0));
  if (filled >= threshold.value - 1e-9) {
    last = makeContinuation(record, last);
    bars.push(last);
  }
  update(last, record.price, volume, trades, delta);
}

function addRange(bars, record, threshold) {
  let last = bars.at(-1);
  if (!last) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp), record.size, record.trades || 1, record.delta || 0));
    return;
  }
  const ranges = Math.floor((Math.abs(record.price - last.close) + 1e-10) / threshold.value);
  const gap = Math.max(0, record.timestamp - last.timestamp) >= RANGE_DATA_GAP_MS && ranges >= 2;
  if (ranges > MAX_RANGE_BARS_PER_EXECUTION || gap) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp, last), Math.max(0, Number(record.size) || 0), Math.max(1, Number(record.trades) || 1), Number(record.delta) || 0));
    return;
  }
  let guard = 0;
  let volume = Math.max(0, Number(record.size) || 0);
  let trades = Math.max(1, Number(record.trades) || 1);
  let delta = Number(record.delta) || 0;
  while (guard++ <= MAX_RANGE_BARS_PER_EXECUTION) {
    const high = Math.max(last.high, record.price);
    const low = Math.min(last.low, record.price);
    if (high - low < threshold.value - 1e-10) {
      update(last, record.price, volume, trades, delta);
      return;
    }
    const boundary = record.price >= last.close ? low + threshold.value : high - threshold.value;
    update(last, boundary, volume, trades, delta);
    volume = 0; trades = 0; delta = 0;
    last.close = boundary;
    last.high = Math.max(last.high, boundary);
    last.low = Math.min(last.low, boundary);
    if (Math.abs(record.price - boundary) < threshold.value - 1e-10) {
      const forming = makeCandle({ ...record, price: boundary }, safeTimestamp(record.timestamp, last));
      update(forming, record.price, 0, 0, 0);
      bars.push(forming);
      return;
    }
    last = makeCandle({ ...record, price: boundary }, safeTimestamp(record.timestamp, last));
    bars.push(last);
  }
}

function addRenko(bars, record, threshold) {
  let forming = bars.at(-1);
  if (!forming) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp), record.size, record.trades || 1, record.delta || 0));
    return;
  }
  const distance = record.price - forming.open;
  const count = Math.floor(Math.abs(distance) / threshold.value);
  if (!count) {
    update(forming, record.price, record.size, record.trades || 1, record.delta || 0);
    return;
  }
  const direction = distance > 0 ? 1 : -1;
  let volume = Math.max(0, record.size);
  let trades = Math.max(1, record.trades || 1);
  let delta = record.delta || 0;
  for (let index = 0; index < count; index += 1) {
    const close = forming.open + direction * threshold.value;
    update(forming, close, volume, trades, delta);
    volume = 0; trades = 0; delta = 0;
    forming.close = close;
    forming.high = Math.max(forming.open, close);
    forming.low = Math.min(forming.open, close);
    forming = makeCandle({ ...record, price: close }, safeTimestamp(record.timestamp, forming));
    bars.push(forming);
  }
  update(forming, record.price, 0, 0, 0);
}

function addPointFigure(bars, record, threshold) {
  const last = bars.at(-1);
  if (!last) {
    bars.push(makeCandle(record, safeTimestamp(record.timestamp), record.size, record.trades || 1, record.delta || 0));
    return;
  }
  const volume = Math.max(0, Number(record.size) || 0);
  const trades = Math.max(1, Number(record.trades) || 1);
  const delta = Number(record.delta) || 0;
  const direction = Math.sign(last.close - last.open);
  if (!direction) {
    const boxes = Math.floor(Math.abs(record.price - last.open) / threshold.value + 1e-10);
    updateFlow(last, volume, trades, delta);
    if (boxes > 0) {
      last.close = last.open + Math.sign(record.price - last.open) * boxes * threshold.value;
      last.high = Math.max(last.open, last.close);
      last.low = Math.min(last.open, last.close);
    }
    return;
  }
  const continuation = direction > 0 ? record.price - last.close : last.close - record.price;
  if (continuation >= threshold.value - 1e-10) {
    const boxes = Math.floor((continuation + 1e-10) / threshold.value);
    updateFlow(last, volume, trades, delta);
    last.close += direction * boxes * threshold.value;
    last.high = Math.max(last.open, last.close);
    last.low = Math.min(last.open, last.close);
    return;
  }
  const reversal = direction > 0 ? last.close - record.price : record.price - last.close;
  if (reversal < threshold.secondary - 1e-10) {
    updateFlow(last, volume, trades, delta);
    return;
  }
  const boxes = Math.floor((reversal + 1e-10) / threshold.value);
  const next = makeCandle({ ...record, price: last.close }, safeTimestamp(record.timestamp, last), volume, trades, delta);
  next.close = last.close - direction * boxes * threshold.value;
  next.high = Math.max(next.open, next.close);
  next.low = Math.min(next.open, next.close);
  bars.push(next);
}

export function createEventBarBuilder(interval, symbol, limit = 250_000) {
  const threshold = thresholdFor(interval, symbol);
  if (!threshold) throw new Error(`Unsupported event interval: ${interval}`);
  const bars = [];
  let processedThrough = Number.NEGATIVE_INFINITY;
  return {
    add(record) {
      if (!Number.isFinite(record?.timestamp) || !Number.isFinite(record?.price) || record.price <= 0) return;
      if (record.timestamp < processedThrough) return;
      if (["volume", "trade", "delta"].includes(threshold.kind)) addThreshold(bars, record, threshold);
      else if (threshold.kind === "renko") addRenko(bars, record, threshold);
      else if (threshold.kind === "point-figure") addPointFigure(bars, record, threshold);
      else addRange(bars, record, threshold);
      const forming = bars.at(-1);
      if (forming) {
        forming.sourceStartTimestamp = Number.isFinite(Number(forming.sourceStartTimestamp)) ? Number(forming.sourceStartTimestamp) : record.timestamp;
        forming.sourceEndTimestamp = Math.max(Number(forming.sourceEndTimestamp ?? record.timestamp), record.timestamp);
      }
      processedThrough = Math.max(processedThrough, record.timestamp);
      if (bars.length > limit * 2) bars.splice(0, bars.length - limit);
    },
    finish() {
      return bars.length > limit ? bars.slice(-limit) : bars;
    },
  };
}

export function buildEventBars(records, interval, symbol, limit = 250_000) {
  const builder = createEventBarBuilder(interval, symbol, limit);
  for (const record of records) builder.add(record);
  return builder.finish();
}
