const QUANTDATA_ORIGIN = "https://api.quantdata.us";
const MAX_HISTORY_CANDLES = 20_000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_RANGE_MS = 730 * 24 * 60 * 60_000;
const MAX_PROVIDER_SESSION_REQUESTS = 10;
const MAX_CONCURRENT_REQUESTS = 3;
const ROLLING_CACHE_MS = 10_000;
const HISTORICAL_CACHE_MS = 5 * 60_000;

const UNDERLYING_SYMBOLS = new Set([
  "SPX", "SPXW", "SPY", "NDX", "QQQ", "IWM",
  "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "AMD",
  "VIX",
]);

export class MarketIndexHistoryError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "MarketIndexHistoryError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Bounded VPS-owned history adapter for cash indices and options underlyings.
 * The desktop receives normalized candles only; QuantData URLs, payloads and
 * credentials terminate here.
 */
export class QuantDataMarketHistoryService {
  constructor({
    apiKey = "",
    fetchImpl = fetch,
    archiveReadSession = null,
    timeoutMs = 15_000,
    maxCacheEntries = 64,
    archiveResponse = null,
    now = () => Date.now(),
  } = {}) {
    this.apiKey = String(apiKey || "").trim();
    this.fetch = fetchImpl;
    this.archiveReadSession = typeof archiveReadSession === "function" ? archiveReadSession : null;
    this.timeoutMs = Math.max(1, Number(timeoutMs) || 15_000);
    this.maxCacheEntries = Math.max(1, Number(maxCacheEntries) || 64);
    this.archiveResponse = typeof archiveResponse === "function" ? archiveResponse : null;
    this.now = now;
    this.cache = new Map();
    this.inFlight = new Map();
  }

  supports(symbol) {
    return UNDERLYING_SYMBOLS.has(normalizeSymbol(symbol));
  }

  async load(rawRequest) {
    const request = normalizeRequest(rawRequest, this.now());
    if (!this.apiKey && !this.archiveReadSession) {
      throw new MarketIndexHistoryError(
        "index_history_unconfigured",
        "Cash-underlying history is not configured on the market-data gateway.",
        503,
      );
    }
    const key = JSON.stringify(request);
    const cached = this.cache.get(key);
    const cacheMs = request.to < this.now() - 5 * 60_000
      ? HISTORICAL_CACHE_MS
      : ROLLING_CACHE_MS;
    if (cached && this.now() - cached.storedAt <= cacheMs) {
      return { ...cached.payload, cached: true };
    }
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.#load(request)
        .then((payload) => {
          this.cache.set(key, { payload, storedAt: this.now() });
          while (this.cache.size > this.maxCacheEntries) {
            this.cache.delete(this.cache.keys().next().value);
          }
          return { ...payload, cached: false };
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  async #load(request) {
    const plan = historyPlan(request.timeframe);
    const ticker = request.symbol === "SPXW" ? "SPX" : request.symbol;
    let payloads = [];
    let truncated = false;
    if (plan.sessionScoped) {
      const dates = weekdaySessionDates(request.from, request.to);
      let providerDates = dates;
      if (this.archiveReadSession) {
        providerDates = [];
        for (let offset = 0; offset < dates.length; offset += 50) {
          const batchDates = dates.slice(offset, offset + 50);
          const archived = await Promise.all(batchDates.map(async (sessionDate) => ({
            sessionDate,
            value: await this.archiveReadSession(ticker, sessionDate).catch(() => null),
          })));
          for (const row of archived) {
            if (row.value?.complete === true && Array.isArray(row.value.candles) && row.value.candles.length) {
              payloads.push({
                payload: row.value,
                sourceAggregation: String(row.value.aggregationPeriod || "1m"),
              });
            } else {
              providerDates.push(row.sessionDate);
            }
          }
        }
      }
      if (providerDates.length > MAX_PROVIDER_SESSION_REQUESTS) {
        providerDates = providerDates.slice(-MAX_PROVIDER_SESSION_REQUESTS);
        truncated = true;
      }
      const failures = [];
      for (let offset = 0; offset < providerDates.length; offset += MAX_CONCURRENT_REQUESTS) {
        const batch = await Promise.allSettled(
          providerDates.slice(offset, offset + MAX_CONCURRENT_REQUESTS)
            .map((sessionDate) => this.#loadSession(ticker, plan.sourceAggregation, sessionDate, false)),
        );
        for (const result of batch) {
          if (result.status === "fulfilled" && result.value) payloads.push(result.value);
          else if (result.status === "rejected") failures.push(result.reason);
        }
      }
      if (!payloads.length && failures.length) throw failures[0];
    } else {
      if (!this.apiKey) {
        throw new MarketIndexHistoryError(
          "index_history_unconfigured",
          "Range history requires the configured VPS market-data provider.",
          503,
        );
      }
      payloads = [{
        payload: await this.#post({
          timeRange: {
            startTime: new Date(request.from).toISOString(),
            endTime: new Date(request.to).toISOString(),
          },
          aggregationPeriod: plan.sourceAggregation,
          filter: { ticker },
        }),
        sourceAggregation: plan.sourceAggregation,
      }];
    }

    const normalized = payloads.flatMap(({ payload, sourceAggregation }) =>
      aggregateCandles(parseCandles(payload), request.timeframe, sourceAggregation));
    const candles = [...new Map(normalized
      .filter((candle) => candle.timestamp >= request.from && candle.timestamp <= request.to)
      .map((candle) => [candle.timestamp, candle])).values()]
      .sort((left, right) => left.timestamp - right.timestamp);
    const bounded = candles.length > MAX_HISTORY_CANDLES
      ? candles.slice(-MAX_HISTORY_CANDLES)
      : candles;
    return {
      candles: bounded,
      symbol: request.symbol,
      source: "QuantData (VPS)",
      from: request.from,
      to: request.to,
      truncated: truncated || bounded.length < candles.length,
    };
  }

  async #loadSession(ticker, sourceAggregation, sessionDate, readArchive = true) {
    if (readArchive && this.archiveReadSession) {
      const archived = await this.archiveReadSession(ticker, sessionDate).catch(() => null);
      if (archived?.complete === true && Array.isArray(archived.candles) && archived.candles.length) {
        return {
          payload: archived,
          sourceAggregation: String(archived.aggregationPeriod || "1m"),
        };
      }
    }
    if (!this.apiKey) return null;
    return {
      payload: await this.#post({
        sessionDate,
        aggregationPeriod: sourceAggregation,
        filter: { ticker },
      }),
      sourceAggregation,
    };
  }

  async #post(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(`${QUANTDATA_ORIGIN}/v1/equities/tool/stock-price-over-time`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const declaredBytes = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RESPONSE_BYTES) {
        throw new MarketIndexHistoryError(
          "index_history_response_too_large",
          "Cash-underlying history exceeded the bounded response size.",
          502,
        );
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
        throw new MarketIndexHistoryError(
          "index_history_response_too_large",
          "Cash-underlying history exceeded the bounded response size.",
          502,
        );
      }
      if (!response.ok) {
        throw new MarketIndexHistoryError(
          "index_history_provider_rejected",
          `The VPS cash-underlying history provider rejected the request (${response.status}).`,
          502,
        );
      }
      this.archiveResponse?.({
        path: "/v1/equities/tool/stock-price-over-time",
        requestBody: Buffer.from(JSON.stringify(body)),
        payload: Buffer.from(text),
      });
      try {
        return JSON.parse(text);
      } catch {
        throw new MarketIndexHistoryError(
          "index_history_malformed",
          "The VPS cash-underlying history provider returned malformed data.",
          502,
        );
      }
    } catch (error) {
      if (error instanceof MarketIndexHistoryError) throw error;
      throw new MarketIndexHistoryError(
        "index_history_transport_failed",
        error?.name === "AbortError"
          ? "Cash-underlying history timed out on the VPS."
          : "Cash-underlying history transport failed on the VPS.",
        502,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeRequest(raw, nowMs) {
  const symbol = normalizeSymbol(raw?.symbol);
  const timeframe = String(raw?.timeframe || "5m").trim();
  const from = Number(raw?.from);
  const to = Number(raw?.to);
  if (!UNDERLYING_SYMBOLS.has(symbol)) {
    throw new MarketIndexHistoryError(
      "index_history_symbol_unsupported",
      `${symbol || "That symbol"} is not an enabled cash-underlying instrument.`,
    );
  }
  historyPlan(timeframe);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from ||
      to > nowMs + 5 * 60_000 || to - from > MAX_RANGE_MS) {
    throw new MarketIndexHistoryError(
      "index_history_window_invalid",
      "Cash-underlying history requires a positive window no longer than 730 days.",
    );
  }
  return Object.freeze({ symbol, timeframe, from: Math.floor(from), to: Math.floor(to) });
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function historyPlan(timeframe) {
  const minute = /^(\d+)m$/.exec(timeframe);
  if (minute) {
    const minutes = Number(minute[1]);
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 240) {
      const sourceMinutes = [30, 15, 5, 1].find((candidate) => minutes % candidate === 0) ?? 1;
      return { sourceAggregation: `${sourceMinutes}m`, sessionScoped: true };
    }
  }
  if (["1h", "2h", "4h"].includes(timeframe)) {
    return { sourceAggregation: "1h", sessionScoped: false };
  }
  if (["1D", "1W", "1M"].includes(timeframe)) {
    return { sourceAggregation: "1d", sessionScoped: false };
  }
  throw new MarketIndexHistoryError(
    "index_history_interval_unsupported",
    `${timeframe || "That interval"} is not supported for cash-underlying history.`,
  );
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 1e18) return Math.floor(numeric / 1e6);
  if (numeric >= 1e15) return Math.floor(numeric / 1e3);
  if (numeric >= 1e12) return Math.floor(numeric);
  if (numeric >= 1e9) return Math.floor(numeric * 1_000);
  return null;
}

function normalizedCandle(timestamp, raw) {
  if (!raw || typeof raw !== "object") return null;
  const open = Number(raw.openPrice ?? raw.open ?? raw.o);
  const high = Number(raw.highPrice ?? raw.high ?? raw.h);
  const low = Number(raw.lowPrice ?? raw.low ?? raw.l);
  const close = Number(raw.closePrice ?? raw.close ?? raw.c);
  const volume = Number(raw.volume ?? raw.totalVolume ?? raw.tradeVolume ?? raw.v ?? 0);
  if (timestamp === null || ![open, high, low, close, volume].every(Number.isFinite) ||
      open <= 0 || low <= 0 || close <= 0 || high < low || volume < 0) return null;
  return { timestamp, open, high, low, close, volume };
}

function parseCandles(payload) {
  if (Array.isArray(payload?.candles)) {
    return payload.candles.flatMap((raw) => {
      const candle = normalizedCandle(normalizeTimestamp(raw?.timestamp), raw);
      return candle ? [candle] : [];
    }).sort((left, right) => left.timestamp - right.timestamp);
  }
  if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") return [];
  return Object.entries(payload.data).flatMap(([timestamp, raw]) => {
    const candle = normalizedCandle(normalizeTimestamp(timestamp), raw);
    return candle ? [candle] : [];
  }).sort((left, right) => left.timestamp - right.timestamp);
}

function marketDateKey(timestamp) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function weekdaySessionDates(from, to) {
  const cursor = new Date(`${marketDateKey(from)}T12:00:00.000Z`);
  const final = new Date(`${marketDateKey(to)}T12:00:00.000Z`);
  const dates = [];
  while (cursor <= final) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function bucketTimestamp(timestamp, timeframe, sessionAnchor) {
  if (timeframe === "1W") {
    const monday = new Date(timestamp);
    const day = monday.getUTCDay() || 7;
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - day + 1);
    return monday.getTime();
  }
  if (timeframe === "1M") {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  if (timeframe === "1D") {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  const minute = /^(\d+)m$/.exec(timeframe);
  const duration = minute
    ? Number(minute[1]) * 60_000
    : { "1h": 60 * 60_000, "2h": 2 * 60 * 60_000, "4h": 4 * 60 * 60_000 }[timeframe];
  if (!duration) return timestamp;
  const anchor = minute ? sessionAnchor ?? 0 : 0;
  return anchor + Math.floor((timestamp - anchor) / duration) * duration;
}

function aggregateCandles(candles, timeframe, sourceAggregation) {
  if (timeframe.toLowerCase() === sourceAggregation.toLowerCase()) return candles;
  const sessionAnchors = new Map();
  if (/^\d+m$/.test(timeframe)) {
    for (const candle of candles) {
      const session = marketDateKey(candle.timestamp);
      const current = sessionAnchors.get(session);
      if (current === undefined || candle.timestamp < current) sessionAnchors.set(session, candle.timestamp);
    }
  }
  const groups = new Map();
  for (const candle of candles) {
    const bucket = bucketTimestamp(
      candle.timestamp,
      timeframe,
      sessionAnchors.get(marketDateKey(candle.timestamp)),
    );
    const rows = groups.get(bucket);
    if (rows) rows.push(candle);
    else groups.set(bucket, [candle]);
  }
  return [...groups.entries()].map(([timestamp, rows]) => ({
    timestamp,
    open: rows[0].open,
    high: Math.max(...rows.map((row) => row.high)),
    low: Math.min(...rows.map((row) => row.low)),
    close: rows.at(-1).close,
    volume: rows.reduce((sum, row) => sum + row.volume, 0),
  })).sort((left, right) => left.timestamp - right.timestamp);
}

export const __test = {
  aggregateCandles,
  historyPlan,
  normalizeRequest,
  normalizeTimestamp,
  parseCandles,
  weekdaySessionDates,
};
