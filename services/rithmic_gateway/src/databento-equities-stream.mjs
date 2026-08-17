import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { createConnection } from "node:net";

const DATASET = "EQUS.MINI";
const HOST = "equs-mini.lsg.databento.com";
const PORT = 13000;

function finitePrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || Math.abs(numeric) >= 9e18) return null;
  return Math.abs(numeric) > 1e7 ? numeric / 1e9 : numeric;
}

function timestampMs(value) {
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Date.now();
  if (numeric > 1e17) return Math.floor(numeric / 1e6);
  if (numeric > 1e14) return Math.floor(numeric / 1e3);
  if (numeric > 1e11) return Math.floor(numeric);
  if (numeric > 1e9) return Math.floor(numeric * 1e3);
  return Date.now();
}

function newYorkSession(timestamp) {
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
    open: weekday !== "Sat" && weekday !== "Sun" && minute >= 570 && minute <= 960,
  };
}

function recordSymbol(record, mappings, allowed) {
  const direct = [
    record.symbol,
    record.raw_symbol,
    record.stype_out_symbol,
    record.stype_in_symbol,
    record.ticker,
  ].find((value) => typeof value === "string" && allowed.has(value.trim().toUpperCase()));
  if (direct) return direct.trim().toUpperCase();
  const instrumentId = Number(record.hd?.instrument_id ?? record.instrument_id);
  return Number.isFinite(instrumentId) ? mappings.get(instrumentId) ?? null : null;
}

/** One provider session on the VPS, fanned out to every browser over SSE. */
export class DatabentoEquitiesTradeStream extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.symbols = [...new Set((config.symbols || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
    this.allowed = new Set(this.symbols);
    this.socket = null;
    this.buffer = "";
    this.authenticated = false;
    this.stopping = false;
    this.reconnectMs = config.reconnectMinMs || 1_000;
    this.lastMessageAt = null;
    this.lastTradeAt = null;
    this.instrumentSymbols = new Map();
    this.snapshots = new Map();
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.disabledReason = null;
  }

  start() {
    if (!this.config.apiKey || !this.symbols.length) return;
    this.stopping = false;
    this.disabledReason = null;
    this.connect();
  }

  connect() {
    if (this.stopping || this.disabledReason || this.socket || !this.config.apiKey) return;
    const socket = createConnection({ host: HOST, port: PORT });
    this.socket = socket;
    this.buffer = "";
    this.authenticated = false;
    this.instrumentSymbols.clear();
    socket.setKeepAlive(true, 10_000);
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (error) => this.emit("streamError", error));
    socket.on("close", () => {
      this.socket = null;
      this.authenticated = false;
      this.emit("status", this.status());
      if (!this.stopping && !this.disabledReason) {
        const wait = this.reconnectMs;
        this.reconnectMs = Math.min(this.config.reconnectMaxMs || 30_000, this.reconnectMs * 2);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, wait);
        this.reconnectTimer.unref?.();
      }
    });
    this.heartbeatTimer ??= setInterval(() => {
      const now = Date.now();
      if (this.authenticated && this.lastMessageAt && now - this.lastMessageAt > 30_000) {
        this.emit("streamError", new Error("Databento equities heartbeat timed out."));
        this.socket?.destroy();
      }
      this.emit("heartbeat", this.status());
    }, 10_000);
  }

  onData(chunk) {
    this.lastMessageAt = Date.now();
    this.buffer += chunk.toString("utf8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (!this.authenticated) {
        if (line.startsWith("cram=")) {
          const challenge = line.slice(5);
          const digest = createHash("sha256")
            .update(`${challenge}|${this.config.apiKey}`)
            .digest("hex");
          this.socket?.write(`auth=${digest}-${this.config.apiKey.slice(-5)}|dataset=${DATASET}|encoding=json|ts_out=1|heartbeat_interval_s=10\n`);
        } else if (line.startsWith("success=1")) {
          this.authenticated = true;
          this.reconnectMs = this.config.reconnectMinMs || 1_000;
          this.socket?.write(`schema=trades|stype_in=raw_symbol|symbols=${this.symbols.join(",")}\n`);
          this.socket?.write("start_session=1\n");
          this.emit("status", this.status());
        } else if (line.startsWith("success=0") || line.startsWith("error=")) {
          if (/live data license is required/i.test(line)) {
            // This is an entitlement rejection, not a transient socket fault.
            // Reconnecting forever only burns CPU and floods logs; KwantData's
            // VPS poller remains active while this source is disabled.
            this.disabledReason = line;
          }
          this.emit("streamError", new Error(line));
          this.socket?.destroy();
        }
        continue;
      }
      try {
        const record = JSON.parse(line);
        if (record.err) {
          this.emit("streamError", new Error(String(record.err)));
          continue;
        }
        const mappedSymbol = [record.stype_out_symbol, record.stype_in_symbol, record.symbol]
          .find((value) => typeof value === "string" && this.allowed.has(value.trim().toUpperCase()));
        const instrumentId = Number(record.hd?.instrument_id ?? record.instrument_id);
        if (mappedSymbol && Number.isFinite(instrumentId)) {
          this.instrumentSymbols.set(instrumentId, mappedSymbol.trim().toUpperCase());
        }
        const price = finitePrice(record.price);
        if (price === null) continue;
        const symbol = recordSymbol(record, this.instrumentSymbols, this.allowed);
        if (!symbol) continue;
        const timestamp = timestampMs(record.hd?.ts_event ?? record.ts_recv ?? record.ts_out);
        const session = newYorkSession(timestamp);
        const previous = this.snapshots.get(symbol);
        const openPrice = previous?.sessionDate === session.date ? previous.openPrice : price;
        const snapshot = {
          symbol,
          lastPrice: price,
          openPrice,
          change: price - openPrice,
          changePercent: openPrice ? ((price - openPrice) / openPrice) * 100 : 0,
          timestamp,
          marketOpen: session.open,
          delayed: false,
          provider: "Databento",
          sessionDate: session.date,
        };
        this.lastTradeAt = timestamp;
        this.snapshots.set(symbol, snapshot);
        this.emit("quote", snapshot);
      } catch {
        // Control and mapping records are expected alongside trade records.
      }
    }
  }

  snapshot(symbol) {
    return this.snapshots.get(String(symbol || "").trim().toUpperCase()) || null;
  }

  status() {
    return {
      connected: Boolean(this.socket && !this.socket.destroyed && this.authenticated),
      source: "Databento",
      dataset: DATASET,
      symbols: this.symbols,
      lastMessageAt: this.lastMessageAt,
      lastTradeAt: this.lastTradeAt,
      disabledReason: this.disabledReason,
    };
  }

  stop() {
    this.stopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.socket?.destroy();
    this.socket = null;
  }
}
