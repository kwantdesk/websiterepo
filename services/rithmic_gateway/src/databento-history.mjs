const DATABENTO_HISTORY_URL = "https://hist.databento.com/v0/timeseries.get_range";
const DATASET = "GLBX.MDP3";
const MAX_LIMIT = 20_000;
const MAX_SOURCE_ROWS = 200_000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_RANGE_MS = 4 * 365 * 24 * 60 * 60_000;
const MAX_EVENT_WINDOW_MS = 6 * 60 * 60_000;
const ROLLING_CACHE_MS = 12_000;
const HISTORICAL_CACHE_MS = 5 * 60_000;

export class HistoryRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "HistoryRequestError";
    this.code = code;
    this.status = status;
  }
}

export class DatabentoHistoryService {
  constructor({
    apiKey = "",
    fetchImpl = fetch,
    timeoutMs = 30_000,
    maxCacheEntries = 32,
    now = () => Date.now(),
  } = {}) {
    this.apiKey = String(apiKey || "").trim();
    this.fetch = fetchImpl;
    this.timeoutMs = Math.max(1, Number(timeoutMs) || 30_000);
    this.maxCacheEntries = Math.max(1, Number(maxCacheEntries) || 32);
    this.now = now;
    this.cache = new Map();
    this.inFlight = new Map();
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      coalescedRequests: 0,
      lastRequestAt: null,
      lastError: null,
    };
  }

  status() {
    return {
      configured: Boolean(this.apiKey),
      cacheEntries: this.cache.size,
      inFlight: this.inFlight.size,
      ...this.metrics,
    };
  }

  async load(rawRequest) {
    if (!this.apiKey) {
      throw new HistoryRequestError(
        "history_unconfigured",
        "CME history is not configured on the market-data gateway.",
        503,
      );
    }
    const request = normalizeHistoryRequest(rawRequest, this.now());
    const key = JSON.stringify(request);
    const cached = this.cache.get(key);
    const cacheMs = request.toMs < this.now() - 5 * 60_000
      ? HISTORICAL_CACHE_MS
      : ROLLING_CACHE_MS;
    if (cached && this.now() - cached.storedAt <= cacheMs) {
      this.metrics.cacheHits += 1;
      return { ...cached.payload, cached: true, cachedAt: cached.storedAt };
    }

    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.#load(request)
        .then((payload) => {
          const storedAt = this.now();
          this.cache.set(key, { payload, storedAt });
          while (this.cache.size > this.maxCacheEntries) {
            this.cache.delete(this.cache.keys().next().value);
          }
          return { ...payload, cached: false, cachedAt: storedAt };
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    } else {
      this.metrics.coalescedRequests += 1;
    }
    return pending;
  }

  async #load(request) {
    const eventBased = isEventInterval(request.interval);
    const intervalMs = eventBased ? null : intervalDurationMs(request.interval);
    const sourceSchema = eventBased ? "trades" : schemaFor(request.interval);
    const sourceSizeMs = eventBased ? null : schemaDurationMs(sourceSchema);
    const sourceLimit = eventBased
      ? MAX_SOURCE_ROWS
      : Math.min(
          MAX_SOURCE_ROWS,
          Math.max(request.limit, request.limit * Math.ceil(intervalMs / sourceSizeMs)),
        );
    const sourceFromFor = (toMs) => Math.max(
      request.fromMs,
      eventBased ? toMs - MAX_EVENT_WINDOW_MS : toMs - sourceLimit * sourceSizeMs,
    );
    const formFor = (toMs, sourceFromMs) => new URLSearchParams({
      dataset: DATASET,
      schema: sourceSchema,
      symbols: request.symbol,
      stype_in: "raw_symbol",
      start: new Date(sourceFromMs).toISOString(),
      end: new Date(toMs).toISOString(),
      encoding: "json",
      pretty_px: "true",
      pretty_ts: "true",
      map_symbols: "false",
      limit: String(sourceLimit),
    });

    let effectiveToMs = request.toMs;
    let sourceFromMs = sourceFromFor(effectiveToMs);
    let response = await this.#requestProvider(formFor(effectiveToMs, sourceFromMs));
    let rejectionBodyConsumed = false;
    if (!response.ok) {
      const detail = await readBoundedText(response, 4_096);
      rejectionBodyConsumed = true;
      const availableEndMs = response.status === 422
        ? availableEndFromHistoryError(detail)
        : null;
      if (availableEndMs != null && availableEndMs - 1 > request.fromMs && availableEndMs < effectiveToMs) {
        effectiveToMs = Math.floor(availableEndMs - 1);
        sourceFromMs = sourceFromFor(effectiveToMs);
        response = await this.#requestProvider(formFor(effectiveToMs, sourceFromMs));
        rejectionBodyConsumed = false;
      }
    }
    if (!response.ok) {
      if (!rejectionBodyConsumed) await readBoundedText(response, 4_096);
      const failure = new HistoryRequestError(
        "history_provider_rejected",
        `CME history provider rejected the request (${response.status}).`,
        502,
      );
      this.metrics.lastError = { at: new Date(this.now()).toISOString(), code: failure.code };
      throw failure;
    }

    const rows = parseNdjson(await readBoundedText(response, MAX_RESPONSE_BYTES));
    const payload = eventBased
      ? eventHistoryPayload(request, rows)
      : timeHistoryPayload(request, rows, intervalMs);
    return {
      schemaVersion: "kwantdesk-history-v1",
      provider: "Databento",
      dataset: DATASET,
      exchange: request.exchange,
      symbol: request.symbol,
      interval: request.interval,
      requestedFromMs: request.fromMs,
      requestedToMs: request.toMs,
      effectiveToMs,
      sourceFromMs,
      sourceRecordCount: rows.length,
      historicalAvailable: true,
      ...payload,
      truncated: sourceFromMs > request.fromMs || effectiveToMs < request.toMs ||
        rows.length >= sourceLimit || payload.truncated,
    };
  }

  async #requestProvider(form) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(DATABENTO_HISTORY_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form,
        signal: controller.signal,
      });
      this.metrics.requests += 1;
      this.metrics.lastRequestAt = new Date(this.now()).toISOString();
      return response;
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "CME history timed out."
        : "CME history transport failed.";
      const failure = new HistoryRequestError("history_transport_failed", message, 502);
      this.metrics.lastError = { at: new Date(this.now()).toISOString(), code: failure.code };
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function availableEndFromHistoryError(detail) {
  const acceptedCases = new Set([
    "data_end_after_available_end",
    "dataset_unavailable_range",
  ]);
  let message = String(detail || "");
  try {
    const parsed = JSON.parse(message);
    const problem = parsed?.detail;
    if (!problem || !acceptedCases.has(String(problem.case || ""))) return null;
    const structured = Date.parse(String(problem.payload?.available_end || ""));
    if (Number.isFinite(structured)) return structured;
    message = String(problem.message || "");
  } catch {
    return null;
  }
  const match = message.match(/(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?)/);
  if (!match) return null;
  const timestamp = Date.parse(
    match[1].includes("T") || match[1].includes(" ")
      ? match[1]
      : `${match[1]}T00:00:00Z`,
  );
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeHistoryRequest(raw, nowMs = Date.now()) {
  const exchange = String(raw?.exchange || "").trim().toUpperCase();
  const symbol = String(raw?.symbol || raw?.contractSymbol || "").trim().toUpperCase();
  const interval = String(raw?.interval || "").trim();
  const fromMs = Number(raw?.fromMs);
  const toMs = Number(raw?.toMs);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(raw?.limit) || MAX_LIMIT)));
  if (!exchange || !/^[A-Z0-9._-]{1,16}$/.test(exchange))
    throw new HistoryRequestError("invalid_exchange", "A valid exchange is required.");
  if (!symbol || !/^[A-Z0-9 ._+\-]{1,64}$/.test(symbol))
    throw new HistoryRequestError("invalid_symbol", "A valid contract symbol is required.");
  if (!isSupportedInterval(interval))
    throw new HistoryRequestError("invalid_interval", "A supported canonical chart interval is required.");
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs < 0 || toMs <= fromMs)
    throw new HistoryRequestError("invalid_window", "A valid chart-history window is required.");
  if (toMs > nowMs + 5 * 60_000 || toMs - fromMs > MAX_RANGE_MS)
    throw new HistoryRequestError("invalid_window", "Chart history is limited to the previous four years.");
  return Object.freeze({ exchange, symbol, interval, fromMs, toMs, limit });
}

function isSupportedInterval(value) {
  return /^(?:\d+(?:s|m|h|D|W|M|r|v|t|R|dv)|\d+\/\d+(?:VB|PF))$/.test(value);
}

function isEventInterval(value) {
  return /(?:r|v|t|R|dv|VB|PF)$/.test(value)
    && !/(?:s|m|h|D|W|M)$/.test(value);
}

function intervalDurationMs(value) {
  const match = value.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) throw new HistoryRequestError("invalid_interval", "A time interval is required.");
  const amount = Number(match[1]);
  const unitMs = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 24 * 60 * 60_000,
    W: 7 * 24 * 60 * 60_000,
    M: 30 * 24 * 60 * 60_000,
  }[match[2]];
  return amount * unitMs;
}

function schemaFor(interval) {
  if (/s$/.test(interval)) return "ohlcv-1s";
  if (/h$/.test(interval)) return "ohlcv-1h";
  if (/[DWM]$/.test(interval)) return "ohlcv-1d";
  return "ohlcv-1m";
}

function schemaDurationMs(schema) {
  if (schema === "ohlcv-1s") return 1_000;
  if (schema === "ohlcv-1h") return 60 * 60_000;
  if (schema === "ohlcv-1d") return 24 * 60 * 60_000;
  return 60_000;
}

async function readBoundedText(response, maximumBytes) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maximumBytes)
      throw new HistoryRequestError("history_response_too_large", "CME history exceeded the bounded response size.", 502);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new HistoryRequestError("history_response_too_large", "CME history exceeded the bounded response size.", 502);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function parseNdjson(text) {
  let malformed = 0;
  const rows = text.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try {
      const value = JSON.parse(line);
      return Array.isArray(value) ? value : [value];
    } catch {
      malformed += 1;
      return [];
    }
  }).filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (malformed > 0)
    throw new HistoryRequestError("history_malformed", "CME history contained malformed records.", 502);
  return rows;
}

function normalizedTimestamp(raw) {
  const value = typeof raw === "object" && raw !== null ? raw.value : raw;
  if (typeof value === "string") {
    const text = value.trim();
    if (/^\d+$/.test(text)) {
      const numeric = Number(text);
      return numeric > 1e15 ? Math.floor(numeric / 1_000_000) : numeric;
    }
    const milliseconds = text.replace(/^(.*\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/, "$1$2");
    return Date.parse(milliseconds);
  }
  const numeric = Number(value);
  return numeric > 1e15 ? Math.floor(numeric / 1_000_000) : numeric;
}

function normalizedPrice(raw) {
  const value = typeof raw === "object" && raw !== null ? raw.value : raw;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || Math.abs(numeric) >= 9e18) return 0;
  return Math.abs(numeric) > 1e7 ? numeric / 1e9 : numeric;
}

function eventHistoryPayload(request, rows) {
  const records = rows.flatMap((row, index) => {
    const timestamp = normalizedTimestamp(row.ts_event ?? row.ts_recv ?? row.hd?.ts_event);
    const close = normalizedPrice(row.price);
    const volume = Math.max(0, Number(row.size ?? 0));
    const side = String(row.side?.value ?? row.side ?? row.aggressor_side ?? "").trim().toUpperCase().slice(0, 1);
    const aggressor = side === "B" ? "BUY" : side === "A" || side === "S" ? "SELL" : "NONE";
    return Number.isFinite(timestamp) && timestamp > 0 && close > 0 && volume > 0
      ? [{ timestamp, close, volume, aggressor, recordIndex: index + 1 }]
      : [];
  }).slice(-request.limit);
  return {
    candles: [],
    records,
    orderFlowAvailable: records.length > 0,
    coverageStartMs: records[0]?.timestamp ?? null,
    coverageEndMs: records.at(-1)?.timestamp ?? null,
    truncated: records.length < rows.length,
  };
}

function timeHistoryPayload(request, rows, intervalMs) {
  const buckets = new Map();
  for (const row of rows) {
    const sourceTimestamp = normalizedTimestamp(row.ts_event ?? row.ts_recv ?? row.hd?.ts_event);
    const open = normalizedPrice(row.open);
    const high = normalizedPrice(row.high);
    const low = normalizedPrice(row.low);
    const close = normalizedPrice(row.close);
    const volume = Math.max(0, Number(row.volume ?? 0));
    if (!Number.isFinite(sourceTimestamp) || sourceTimestamp <= 0 || open <= 0 || high < low || low <= 0 || close <= 0) continue;
    const timestamp = Math.floor(sourceTimestamp / intervalMs) * intervalMs;
    const current = buckets.get(timestamp);
    if (!current) {
      buckets.set(timestamp, {
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        trades: 0,
        bidVolume: 0,
        askVolume: 0,
        isClosed: true,
      });
      continue;
    }
    current.high = Math.max(current.high, high);
    current.low = Math.min(current.low, low);
    current.close = close;
    current.volume += volume;
  }
  const allCandles = [...buckets.values()].sort((left, right) => left.timestamp - right.timestamp);
  const candles = allCandles.slice(-request.limit);
  return {
    candles,
    records: [],
    orderFlowAvailable: false,
    coverageStartMs: candles[0]?.timestamp ?? null,
    coverageEndMs: candles.at(-1)?.timestamp ?? null,
    truncated: candles.length < allCandles.length,
  };
}
