// Authoritative one-minute OHLC and observed quotes have separate provenance.
// Positioning snapshots (spot-only records) are never a candle source.
const MINUTE = 60_000;
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const epoch = value => numeric(value) && value >= 1e11 && value <= 8.64e15;
const symbolName = value => typeof value === 'string' ? value.trim().toUpperCase() : '';

export function normalizePriceCandle(row) {
  if (!row || typeof row !== 'object') return null;
  const time = row.time ?? row.timestamp;
  const {open, high, low, close} = row;
  if (!epoch(time) || time % MINUTE !== 0
    || ![open, high, low, close].every(value => numeric(value) && value > 0)
    || high < Math.max(open, close) || low > Math.min(open, close) || high < low) return null;
  return {time, open, high, low, close, spot: close, provenance: 'ohlc'};
}

export function createPriceSeries({maxBars = 6_000, maxQuotes = 3_000} = {}) {
  const barLimit = Math.min(30_000, Math.max(1, Math.floor(Number(maxBars) || 6_000)));
  const quoteLimit = Math.min(30_000, Math.max(1, Math.floor(Number(maxQuotes) || 3_000)));
  let scope = {symbol: '', sessionDate: null};
  let bars = new Map(), quotes = [], latest = null;
  const matches = context => !!scope.symbol && symbolName(context?.symbol) === scope.symbol
    && (context?.sessionDate == null || scope.sessionDate == null || context.sessionDate === scope.sessionDate);
  const trimBars = () => {
    if (bars.size <= barLimit) return;
    const times = [...bars.keys()].sort((a, b) => a - b);
    for (const time of times.slice(0, times.length - barLimit)) bars.delete(time);
  };
  const applyQuote = point => {
    const time = Math.floor(point.time / MINUTE) * MINUTE, candle = bars.get(time);
    if (!candle || candle.finalizedAt != null && point.time < time + MINUTE) return;
    // A sampled quote can widen known extrema, but is not proof of full trade
    // coverage. Never invent a new OHLC bar when its authoritative source is absent.
    if (candle.quoteTime != null && point.time < candle.quoteTime) return;
    bars.set(time, {...candle, high: Math.max(candle.high, point.spot),
      low: Math.min(candle.low, point.spot), close: point.spot, spot: point.spot,
      quoteTime: point.time, observationOnly: true, provenance: 'ohlc+observed-quote'});
  };
  return {
    reset({symbol, sessionDate = null} = {}) {
      scope = {symbol: symbolName(symbol), sessionDate};
      bars = new Map(); quotes = []; latest = null;
    },
    seed(rows, context) {
      if (!matches(context) || !Array.isArray(rows) || rows.length > 100_000) return false;
      const accepted = [];
      for (const row of rows) {
        if (row?.symbol && symbolName(row.symbol) !== scope.symbol) return false;
        const candle = normalizePriceCandle(row);
        if (!candle) return false;
        accepted.push(candle);
      }
      // Validate the whole batch before mutation: a malformed replacement must
      // not erase the last known genuine series.
      for (const candle of accepted) {
        const previous = bars.get(candle.time);
        const sourceAsOf = epoch(context.asOf) ? context.asOf : previous?.sourceAsOf;
        if (epoch(context.asOf) && previous?.sourceAsOf > context.asOf) continue;
        if (sourceAsOf != null) candle.sourceAsOf = sourceAsOf;
        const finalized = sourceAsOf != null && candle.time + MINUTE <= sourceAsOf;
        const quoteIsCovered = finalized && previous?.quoteTime < candle.time + MINUTE;
        const quoteExtremaOutsideSource = previous?.quoteTime != null
          && (previous.high > candle.high || previous.low < candle.low);
        bars.set(candle.time, previous?.quoteTime != null && !quoteIsCovered
          ? {...candle, high: Math.max(candle.high, previous.high), low: Math.min(candle.low, previous.low),
            close: previous.close, spot: previous.close, quoteTime: previous.quoteTime,
            observationOnly: true, provenance: 'ohlc+observed-quote'}
          : {...candle, ...(finalized ? {finalizedAt: sourceAsOf} : {}),
            ...(quoteIsCovered && quoteExtremaOutsideSource ? {
              high: Math.max(candle.high, previous.high), low: Math.min(candle.low, previous.low),
              observationOnly: true, provenance: 'ohlc+observed-quote',
            } : {})});
      }
      if (latest) applyQuote(latest);
      trimBars(); return true;
    },
    quote(frame) {
      if (!matches(frame) || !epoch(frame?.timestamp) || !numeric(frame.lastPrice) || frame.lastPrice <= 0) return false;
      const point = {time: frame.timestamp, spot: frame.lastPrice, provenance: 'observed-quote'};
      if (latest && (point.time < latest.time || point.time === latest.time && point.spot === latest.spot)) return false;
      latest = point;
      if (quotes.at(-1)?.time === point.time) quotes[quotes.length - 1] = point;
      else quotes.push(point);
      if (quotes.length > quoteLimit) quotes.splice(0, quotes.length - quoteLimit);
      applyQuote(point); return true;
    },
    candles(intervalMs = MINUTE, {cutoffTime = Infinity} = {}) {
      if (!numeric(intervalMs) || intervalMs < MINUTE || intervalMs % MINUTE !== 0) return [];
      const result = new Map();
      for (const candle of [...bars.values()].sort((a, b) => a.time - b.time)) {
        // Replay cannot consume the final OHLC of an as-yet-unclosed source
        // minute. Live callers omit the cutoff and may display the forming bar.
        if (candle.time + MINUTE > cutoffTime) continue;
        const time = Math.floor(candle.time / intervalMs) * intervalMs;
        const current = result.get(time);
        if (!current) result.set(time, {...candle, time, sourceBars: 1, firstSourceTime: candle.time, lastSourceTime: candle.time});
        else {
          current.high = Math.max(current.high, candle.high); current.low = Math.min(current.low, candle.low);
          current.close = candle.close; current.spot = candle.close; current.sourceBars++;
          current.lastSourceTime = candle.time;
          current.observationOnly ||= !!candle.observationOnly;
          if (current.observationOnly) current.provenance = 'ohlc+observed-quote';
        }
      }
      return [...result.values()].map(candle => ({...candle,
        partial: candle.sourceBars !== intervalMs / MINUTE || !!candle.observationOnly}));
    },
    quoteLine({cutoffTime = Infinity} = {}) { return quotes.filter(point => point.time <= cutoffTime).map(point => ({...point})); },
    get current() { return latest ? {...latest} : null; },
    get identity() { return {...scope}; },
    get size() { return bars.size; },
  };
}
