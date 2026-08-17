import { EventEmitter } from "node:events";

import WebSocket from "ws";

const DEFAULT_REST_ORIGIN = "https://api.massive.com";
const DEFAULT_WEBSOCKET_URL = "wss://socket.massive.com/indices";

const PROVIDER_TICKER_BY_SYMBOL = new Map([
  ["SPX", "I:SPX"],
  ["SPXW", "I:SPX"],
  ["NDX", "I:NDX"],
  ["VIX", "I:VIX"],
  ["VXN", "I:VXN"],
  ["RUT", "I:RUT"],
  ["DJI", "I:DJI"],
]);

const SYMBOLS_BY_PROVIDER_TICKER = new Map();
for (const [symbol, ticker] of PROVIDER_TICKER_BY_SYMBOL) {
  SYMBOLS_BY_PROVIDER_TICKER.set(ticker, [
    ...(SYMBOLS_BY_PROVIDER_TICKER.get(ticker) || []),
    symbol,
  ]);
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampMs(value) {
  const parsed = finiteNumber(value);
  if (parsed === null) return Date.now();
  if (parsed > 1e17) return Math.floor(parsed / 1e6);
  if (parsed > 1e14) return Math.floor(parsed / 1e3);
  if (parsed > 1e11) return Math.floor(parsed);
  if (parsed > 1e9) return Math.floor(parsed * 1_000);
  return Date.now();
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
  const minute = Number(read("hour")) * 60 + Number(read("minute"));
  const weekday = read("weekday");
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    open: weekday !== "Sat" && weekday !== "Sun" && minute >= 570 && minute < 960,
  };
}

function providerTicker(symbol) {
  return PROVIDER_TICKER_BY_SYMBOL.get(String(symbol || "").trim().toUpperCase()) || null;
}

function publicSymbols(ticker) {
  return SYMBOLS_BY_PROVIDER_TICKER.get(String(ticker || "").trim().toUpperCase()) || [];
}

function aggregateResolution(timeframe) {
  const normalized = String(timeframe || "5m").trim();
  const minutes = normalized.match(/^(\d+)m$/i);
  if (minutes) return { multiplier: Number(minutes[1]), timespan: "minute" };
  const hours = normalized.match(/^(\d+)h$/i);
  if (hours) return { multiplier: Number(hours[1]), timespan: "hour" };
  const fixed = {
    "1D": { multiplier: 1, timespan: "day" },
    "1W": { multiplier: 1, timespan: "week" },
    "1M": { multiplier: 1, timespan: "month" },
  }[normalized.toUpperCase()];
  if (fixed) return fixed;
  throw new Error(`Massive indices do not support ${normalized}.`);
}

function snapshotFromValue({ symbol, price, timestamp, previous }) {
  const session = newYorkSession(timestamp);
  const openPrice = previous?.sessionDate === session.date
    ? previous.openPrice
    : price;
  const change = price - openPrice;
  return {
    symbol,
    lastPrice: price,
    openPrice,
    change,
    changePercent: openPrice ? (change / openPrice) * 100 : 0,
    timestamp,
    marketOpen: session.open,
    delayed: false,
    provider: "Massive",
    transport: "VPS WebSocket → shared SSE",
    sessionDate: session.date,
  };
}

function parseSnapshotResult(result) {
  if (!result || typeof result !== "object") return null;
  const ticker = String(result.ticker || "").trim().toUpperCase();
  const price = finiteNumber(result.value ?? result.last?.value ?? result.session?.close);
  if (!ticker || price === null || price <= 0) return null;
  const timestamp = timestampMs(result.last_updated ?? result.lastUpdated ?? result.timestamp);
  const session = newYorkSession(timestamp);
  const sessionPayload = result.session && typeof result.session === "object" ? result.session : {};
  const openPrice = finiteNumber(
    sessionPayload.previous_close
      ?? sessionPayload.previousClose
      ?? sessionPayload.open,
  ) ?? price;
  const change = finiteNumber(sessionPayload.change) ?? price - openPrice;
  return {
    ticker,
    price,
    timestamp,
    openPrice,
    change,
    changePercent: finiteNumber(sessionPayload.change_percent ?? sessionPayload.changePercent)
      ?? (openPrice ? (change / openPrice) * 100 : 0),
    marketOpen: String(result.market_status || "").toLowerCase() === "open" || session.open,
    delayed: String(result.timeframe || "").toUpperCase().includes("DELAY"),
    sessionDate: session.date,
  };
}

/**
 * One Massive indices connection owned by the VPS. Every browser reads the
 * normalized cache through the existing authenticated SSE endpoint, so adding
 * users never creates more vendor sessions or exposes the API key.
 */
export class MassiveIndicesStream extends EventEmitter {
  constructor(config, dependencies = {}) {
    super();
    this.config = config;
    this.fetch = dependencies.fetchImpl || fetch;
    this.WebSocketImpl = dependencies.WebSocketImpl || WebSocket;
    this.symbols = [...new Set((config.symbols || [])
      .map((value) => String(value).trim().toUpperCase())
      .filter((value) => providerTicker(value)))];
    this.tickers = [...new Set(this.symbols.map(providerTicker).filter(Boolean))];
    this.snapshots = new Map();
    this.historyCache = new Map();
    this.socket = null;
    this.stopping = false;
    this.authenticated = false;
    this.reconnectMs = config.reconnectMinMs || 1_000;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastMessageAt = null;
    this.lastValueAt = null;
    this.lastSnapshotAt = null;
    this.lastError = null;
  }

  start() {
    if (!this.config.apiKey || !this.tickers.length || this.socket) return;
    this.stopping = false;
    void this.bootstrap().catch((error) => this.#reportError(error));
    this.connect();
  }

  connect() {
    if (this.stopping || this.socket || !this.config.apiKey) return;
    const socket = new this.WebSocketImpl(this.config.websocketUrl || DEFAULT_WEBSOCKET_URL);
    this.socket = socket;
    socket.on("open", () => {
      socket.send(JSON.stringify({ action: "auth", params: this.config.apiKey }));
    });
    socket.on("message", (data) => this.handleMessage(data));
    socket.on("error", (error) => this.#reportError(error));
    socket.on("close", () => {
      if (this.socket === socket) this.socket = null;
      this.authenticated = false;
      this.emit("status", this.status());
      if (!this.stopping) this.#scheduleReconnect();
    });
    this.heartbeatTimer ??= setInterval(() => {
      if (
        this.socket
        && this.lastMessageAt
        && Date.now() - this.lastMessageAt > (this.config.staleMs || 30_000)
      ) {
        this.#reportError(new Error("Massive indices WebSocket heartbeat timed out."));
        this.socket.terminate?.();
      }
      this.emit("status", this.status());
    }, 10_000);
    this.heartbeatTimer.unref?.();
  }

  handleMessage(data) {
    this.lastMessageAt = Date.now();
    let frames;
    try {
      const parsed = JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data));
      frames = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return;
    }
    for (const frame of frames) {
      if (!frame || typeof frame !== "object") continue;
      if (frame.ev === "status") {
        const status = String(frame.status || "").toLowerCase();
        if (status === "auth_success" || /authenticated/.test(String(frame.message || ""))) {
          this.authenticated = true;
          this.reconnectMs = this.config.reconnectMinMs || 1_000;
          const channels = this.tickers.flatMap((ticker) => [`V.${ticker}`, `A.${ticker}`]);
          this.socket?.send(JSON.stringify({ action: "subscribe", params: channels.join(",") }));
          this.emit("status", this.status());
        } else if (status.includes("auth_failed") || status.includes("error")) {
          this.#reportError(new Error(String(frame.message || "Massive authentication failed.")));
        }
        continue;
      }
      const ticker = String(frame.T ?? frame.sym ?? "").trim().toUpperCase();
      const price = finiteNumber(frame.val ?? frame.c);
      if (!publicSymbols(ticker).length || price === null || price <= 0) continue;
      const timestamp = timestampMs(frame.t ?? frame.e ?? frame.s);
      for (const symbol of publicSymbols(ticker)) {
        const previous = this.snapshots.get(symbol);
        if (previous && timestamp < previous.timestamp) continue;
        const snapshot = snapshotFromValue({ symbol, price, timestamp, previous });
        this.snapshots.set(symbol, snapshot);
        this.emit("quote", snapshot);
      }
      this.lastValueAt = timestamp;
    }
  }

  async #requestJson(url, timeoutMs = 10_000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error || payload.message || `Massive request failed (${response.status}).`));
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async bootstrap() {
    if (!this.config.apiKey || !this.tickers.length) return;
    const endpoint = new URL(`${this.config.restOrigin || DEFAULT_REST_ORIGIN}/v3/snapshot`);
    endpoint.searchParams.set("ticker.any_of", this.tickers.join(","));
    endpoint.searchParams.set("limit", String(Math.max(10, this.tickers.length)));
    const payload = await this.#requestJson(endpoint.toString());
    const results = Array.isArray(payload.results) ? payload.results : [];
    for (const result of results) {
      const parsed = parseSnapshotResult(result);
      if (!parsed) continue;
      for (const symbol of publicSymbols(parsed.ticker)) {
        const snapshot = {
          symbol,
          lastPrice: parsed.price,
          openPrice: parsed.openPrice,
          change: parsed.change,
          changePercent: parsed.changePercent,
          timestamp: parsed.timestamp,
          marketOpen: parsed.marketOpen,
          delayed: parsed.delayed,
          provider: "Massive",
          transport: "VPS REST bootstrap → shared SSE",
          sessionDate: parsed.sessionDate,
        };
        const previous = this.snapshots.get(symbol);
        if (previous && previous.timestamp > snapshot.timestamp) continue;
        this.snapshots.set(symbol, snapshot);
        this.emit("quote", snapshot);
      }
    }
    this.lastSnapshotAt = Date.now();
    this.emit("status", this.status());
  }

  async history({ symbol, timeframe, from, to }) {
    const normalized = String(symbol || "").trim().toUpperCase();
    const ticker = providerTicker(normalized);
    if (!ticker) throw new Error(`${normalized} is not a Massive cash index.`);
    const start = Number(from);
    const end = Number(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error("Select a valid index-history window.");
    }
    const { multiplier, timespan } = aggregateResolution(timeframe);
    const cacheKey = `${ticker}:${multiplier}:${timespan}:${start}:${end}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.candles;
    const fromDate = new Date(start).toISOString().slice(0, 10);
    const toDate = new Date(end).toISOString().slice(0, 10);
    const endpoint = new URL(
      `${this.config.restOrigin || DEFAULT_REST_ORIGIN}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`,
    );
    endpoint.searchParams.set("adjusted", "true");
    endpoint.searchParams.set("sort", "asc");
    endpoint.searchParams.set("limit", "50000");
    const payload = await this.#requestJson(endpoint.toString(), this.config.requestTimeoutMs || 15_000);
    const candles = (Array.isArray(payload.results) ? payload.results : []).flatMap((row) => {
      const timestamp = finiteNumber(row?.t ?? row?.timestamp);
      const open = finiteNumber(row?.o ?? row?.open);
      const high = finiteNumber(row?.h ?? row?.high);
      const low = finiteNumber(row?.l ?? row?.low);
      const close = finiteNumber(row?.c ?? row?.close);
      if ([timestamp, open, high, low, close].some((value) => value === null)) return [];
      return [{
        timestamp,
        open,
        high,
        low,
        close,
        volume: finiteNumber(row?.v ?? row?.volume) ?? 0,
      }];
    });
    const historical = end < Date.now() - 5 * 60_000;
    this.historyCache.set(cacheKey, {
      candles,
      expiresAt: Date.now() + (historical ? 5 * 60_000 : 10_000),
    });
    if (this.historyCache.size > 100) {
      const oldest = this.historyCache.keys().next().value;
      if (oldest) this.historyCache.delete(oldest);
    }
    return candles;
  }

  snapshot(symbol) {
    return this.snapshots.get(String(symbol || "").trim().toUpperCase()) || null;
  }

  status() {
    const connected = Boolean(
      this.socket
      && this.socket.readyState === 1
      && this.authenticated,
    );
    return {
      connected,
      configured: Boolean(this.config.apiKey),
      authenticated: this.authenticated,
      source: "Massive",
      transport: "one VPS WebSocket → shared cache/SSE",
      websocketUrl: String(this.config.websocketUrl || DEFAULT_WEBSOCKET_URL).replace(/\?.*$/, ""),
      symbols: this.symbols,
      lastMessageAt: this.lastMessageAt,
      lastValueAt: this.lastValueAt,
      lastSnapshotAt: this.lastSnapshotAt,
      lastError: this.lastError,
    };
  }

  #reportError(error) {
    this.lastError = {
      at: Date.now(),
      message: error instanceof Error ? error.message : String(error),
    };
    this.emit("streamError", error);
    this.emit("status", this.status());
  }

  #scheduleReconnect() {
    if (this.reconnectTimer || this.stopping) return;
    const delay = this.reconnectMs;
    this.reconnectMs = Math.min(this.config.reconnectMaxMs || 30_000, delay * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  stop() {
    this.stopping = true;
    this.authenticated = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.socket?.close?.();
    this.socket = null;
  }
}

export const __test = {
  aggregateResolution,
  newYorkSession,
  parseSnapshotResult,
  providerTicker,
  publicSymbols,
  snapshotFromValue,
  timestampMs,
};
