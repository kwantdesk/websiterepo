import { EventEmitter } from "node:events";

const QUANTDATA_ORIGIN = "https://api.quantdata.us";

function finitePrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function newYorkSession(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  const weekday = read("weekday");
  const minute = Number(read("hour")) * 60 + Number(read("minute"));
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    open: weekday !== "Sat" && weekday !== "Sun" && minute >= 570 && minute < 960,
  };
}

function quote(symbol, lastPrice, referencePrice, timestamp = Date.now()) {
  const session = newYorkSession(timestamp);
  const openPrice = finitePrice(referencePrice) ?? lastPrice;
  const change = lastPrice - openPrice;
  return {
    symbol,
    lastPrice,
    openPrice,
    change,
    changePercent: openPrice ? (change / openPrice) * 100 : 0,
    timestamp,
    marketOpen: session.open,
    delayed: false,
    provider: "QuantData",
    sessionDate: session.date,
  };
}

function parseLatestCandle(payload) {
  const rows = payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
    ? Object.entries(payload.data)
    : [];
  const valid = rows
    .map(([timestamp, row]) => ({ timestamp: Number(timestamp), row }))
    .filter(({ timestamp, row }) => Number.isFinite(timestamp) && row && typeof row === "object")
    .sort((left, right) => left.timestamp - right.timestamp);
  if (!valid.length) return null;
  const first = valid[0];
  const latest = valid.at(-1);
  const lastPrice = finitePrice(latest.row.closePrice ?? latest.row.lastPrice);
  if (lastPrice === null) return null;
  return {
    lastPrice,
    openPrice: finitePrice(first.row.openPrice) ?? lastPrice,
    timestamp: latest.timestamp,
  };
}

function retryDelay(response, fallbackMs) {
  const seconds = Number(response.headers?.get?.("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : fallbackMs;
}

/**
 * One QuantData REST poller on the VPS, broadcast to every browser through
 * the existing market-index SSE endpoint. Browsers never receive a vendor key
 * and never multiply the upstream request count.
 */
export class QuantDataMarketSnapshotStream extends EventEmitter {
  constructor(config, fetchImpl = fetch) {
    super();
    this.config = config;
    this.fetch = fetchImpl;
    this.equitySymbols = [...new Set((config.equitySymbols || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
    this.indexSymbols = [...new Set((config.indexSymbols || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
    this.snapshots = new Map();
    this.timer = null;
    this.running = false;
    this.inFlight = false;
    this.lastSuccessAt = null;
    this.lastRequestAt = null;
    this.lastError = null;
    this.backoffUntil = 0;
    this.lastIndexPollAt = 0;
    this.indexCursor = 0;
  }

  start() {
    if (!this.config.apiKey || this.running) return;
    this.running = true;
    this.#schedule(0);
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  #schedule(delayMs) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.pollNow();
    }, Math.max(0, delayMs));
    this.timer.unref?.();
  }

  async #post(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 8_000);
    let response;
    try {
      this.lastRequestAt = Date.now();
      response = await this.fetch(`${QUANTDATA_ORIGIN}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const validationErrors = Array.isArray(payload?.properties?.errors)
        ? payload.properties.errors.map((item) => item?.message).filter(Boolean).join(" | ")
        : "";
      const message = String(validationErrors || payload.detail || payload.message || payload.error || `QuantData request failed (${response.status}).`);
      const error = Object.assign(new Error(message), {
        status: response.status,
        retryAfterMs: retryDelay(response, this.config.pollMs || 2_500),
      });
      throw error;
    }
    return response.json();
  }

  #store(snapshot) {
    const previous = this.snapshots.get(snapshot.symbol);
    if (previous && snapshot.timestamp < previous.timestamp) return;
    this.snapshots.set(snapshot.symbol, snapshot);
    this.emit("quote", snapshot);
  }

  async #pollEquities() {
    if (!this.equitySymbols.length) return false;
    const payload = await this.#post("/v1/equities/tool/market-map", {
      filterExpression: {
        conjunction: "OR",
        filters: this.equitySymbols.map((symbol) => ({
          field: "TICKER",
          operation: "EQUALS",
          value: symbol,
        })),
      },
    });
    const data = payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
      ? payload.data
      : {};
    const timestamp = Date.now();
    let stored = false;
    for (const symbol of this.equitySymbols) {
      const row = data[symbol];
      const lastPrice = finitePrice(row?.currentValue);
      if (lastPrice === null) continue;
      this.#store(quote(symbol, lastPrice, row?.previousValue, timestamp));
      stored = true;
    }
    return stored;
  }

  async #pollIndex(symbol) {
    const session = newYorkSession();
    const payload = await this.#post("/v1/equities/tool/stock-price-over-time", {
      sessionDate: session.date,
      aggregationPeriod: "1m",
      filter: { ticker: symbol },
    });
    const candle = parseLatestCandle(payload);
    if (!candle) return false;
    this.#store(quote(symbol, candle.lastPrice, candle.openPrice, candle.timestamp));
    if (symbol === "SPX") {
      this.#store(quote("SPXW", candle.lastPrice, candle.openPrice, candle.timestamp));
    }
    return true;
  }

  async pollNow() {
    if (!this.config.apiKey || this.inFlight) return;
    this.inFlight = true;
    let anySuccess = false;
    let nextDelay = newYorkSession().open
      ? this.config.pollMs || 2_500
      : this.config.idlePollMs || 15_000;
    const errors = [];
    try {
      if (Date.now() < this.backoffUntil) return;
      try {
        anySuccess = await this.#pollEquities() || anySuccess;
      } catch (error) {
        errors.push(error);
        if (Number(error?.status) === 429) {
          nextDelay = Math.max(nextDelay, Number(error.retryAfterMs) || nextDelay);
          this.backoffUntil = Date.now() + nextDelay;
        }
      }
      const shouldPollIndices = this.indexSymbols.length > 0
        && Date.now() - this.lastIndexPollAt >= (this.config.indexPollMs || 5_000);
      if (shouldPollIndices) {
        this.lastIndexPollAt = Date.now();
        const symbol = this.indexSymbols[this.indexCursor % this.indexSymbols.length];
        this.indexCursor = (this.indexCursor + 1) % this.indexSymbols.length;
        // Keep the provider's documented one-second burst allowance healthy
        // while still staying well inside the 240 request/minute quota.
        await new Promise((resolve) => setTimeout(resolve, this.config.requestSpacingMs || 100));
        try {
          anySuccess = await this.#pollIndex(symbol) || anySuccess;
        } catch (error) {
          errors.push(error);
          if (Number(error?.status) === 429) {
            nextDelay = Math.max(nextDelay, Number(error.retryAfterMs) || nextDelay);
            this.backoffUntil = Date.now() + nextDelay;
          }
        }
      }
      if (anySuccess) {
        this.lastSuccessAt = Date.now();
        this.lastError = errors.length
          ? {
              at: Date.now(),
              message: errors.map((error) => error instanceof Error ? error.message : String(error)).join(" | "),
              status: Number(errors[0]?.status) || null,
              partial: true,
            }
          : null;
      } else if (errors.length) {
        throw errors[0];
      }
    } catch (error) {
      this.lastError = {
        at: Date.now(),
        message: error instanceof Error ? error.message : String(error),
        status: Number(error?.status) || null,
      };
      this.emit("streamError", error);
    } finally {
      this.inFlight = false;
      this.emit("status", this.status());
      this.#schedule(nextDelay);
    }
  }

  snapshot(symbol) {
    return this.snapshots.get(String(symbol || "").trim().toUpperCase()) || null;
  }

  status() {
    return {
      connected: Boolean(this.lastSuccessAt && Date.now() - this.lastSuccessAt < Math.max(
        45_000,
        (this.config.idlePollMs || 15_000) * 3,
        (this.config.pollMs || 2_500) * 4,
      )),
      configured: Boolean(this.config.apiKey),
      source: "QuantData",
      transport: "VPS REST poller → shared SSE",
      symbols: [...this.equitySymbols, ...this.indexSymbols, ...(this.indexSymbols.includes("SPX") ? ["SPXW"] : [])],
      lastSuccessAt: this.lastSuccessAt,
      lastRequestAt: this.lastRequestAt,
      lastError: this.lastError,
    };
  }
}

export const __test = { finitePrice, newYorkSession, parseLatestCandle, quote };
