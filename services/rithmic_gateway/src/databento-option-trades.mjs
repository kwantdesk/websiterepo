import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { createConnection } from "node:net";

const DATASET = "GLBX.MDP3";
const HOST = "glbx-mdp3.lsg.databento.com";
const PORT = 13000;
const MAX_ACTIVE_SYMBOLS = 12;
const MAX_RETAINED_TRADES = 5_000;

/**
 * One bounded VPS-side Databento session shared by every native option pane.
 * Adding/removing a symbol reconnects the single multiplexed session; duplicate
 * panes only increment a reference count and never open another vendor socket.
 */
export class DatabentoOptionTradeStream extends EventEmitter {
  constructor({
    apiKey = "",
    reconnectMinMs = 1_000,
    reconnectMaxMs = 30_000,
    maxSymbols = MAX_ACTIVE_SYMBOLS,
  } = {}) {
    super();
    this.apiKey = String(apiKey || "").trim();
    this.reconnectMinMs = Math.max(100, Number(reconnectMinMs) || 1_000);
    this.reconnectMaxMs = Math.max(this.reconnectMinMs, Number(reconnectMaxMs) || 30_000);
    this.maxSymbols = Math.min(MAX_ACTIVE_SYMBOLS, Math.max(1, Number(maxSymbols) || MAX_ACTIVE_SYMBOLS));
    this.references = new Map();
    this.instrumentSymbols = new Map();
    this.retained = new Map();
    this.sequence = 0;
    this.socket = null;
    this.buffer = "";
    this.authenticated = false;
    this.stopping = false;
    this.reconnectMs = this.reconnectMinMs;
    this.restartTimer = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastMessageAt = null;
    this.lastTradeAt = null;
    this.disabledReason = null;
  }

  subscribe(rawSymbol) {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) throw new Error("A valid CME option contract symbol is required.");
    const existing = this.references.get(symbol) || 0;
    if (!existing && this.references.size >= this.maxSymbols) {
      throw new Error(`At most ${this.maxSymbols} live CME option contracts may be open.`);
    }
    this.references.set(symbol, existing + 1);
    if (!existing) this.#scheduleRestart();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = this.references.get(symbol) || 0;
      if (count <= 1) {
        this.references.delete(symbol);
        this.#scheduleRestart();
      } else {
        this.references.set(symbol, count - 1);
      }
    };
  }

  trades(rawSymbol) {
    const symbol = normalizeSymbol(rawSymbol);
    return [...(this.retained.get(symbol) || [])];
  }

  status() {
    return {
      configured: Boolean(this.apiKey),
      connected: Boolean(this.socket && !this.socket.destroyed && this.authenticated),
      source: "Databento",
      dataset: DATASET,
      activeSymbols: [...this.references.keys()],
      vendorConnections: this.socket && !this.socket.destroyed ? 1 : 0,
      lastMessageAt: this.lastMessageAt,
      lastTradeAt: this.lastTradeAt,
      disabledReason: this.disabledReason,
    };
  }

  stop() {
    this.stopping = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.restartTimer = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.socket?.destroy();
    this.socket = null;
    this.authenticated = false;
  }

  #scheduleRestart() {
    if (this.stopping || !this.apiKey || this.disabledReason) return;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.references.size) {
        this.socket?.destroy();
        this.socket = null;
        this.authenticated = false;
        this.emit("status", this.status());
        return;
      }
      this.socket?.destroy();
      this.socket = null;
      this.authenticated = false;
      this.#connect();
    }, 50);
    this.restartTimer.unref?.();
  }

  #connect() {
    if (this.stopping || this.disabledReason || this.socket || !this.apiKey || !this.references.size)
      return;
    const socket = createConnection({ host: HOST, port: PORT });
    this.socket = socket;
    this.buffer = "";
    this.authenticated = false;
    this.instrumentSymbols.clear();
    socket.setKeepAlive(true, 10_000);
    socket.on("data", (chunk) => this.#onData(chunk));
    socket.on("error", (error) => this.emit("streamError", error));
    socket.on("close", () => {
      if (this.socket === socket) this.socket = null;
      this.authenticated = false;
      this.emit("status", this.status());
      if (!this.stopping && !this.disabledReason && this.references.size && !this.restartTimer) {
        const wait = this.reconnectMs;
        this.reconnectMs = Math.min(this.reconnectMaxMs, this.reconnectMs * 2);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.#connect();
        }, wait);
        this.reconnectTimer.unref?.();
      }
    });
    this.heartbeatTimer ??= setInterval(() => {
      const now = Date.now();
      if (this.authenticated && this.lastMessageAt && now - this.lastMessageAt > 30_000) {
        this.emit("streamError", new Error("Databento CME options heartbeat timed out."));
        this.socket?.destroy();
      }
      this.emit("heartbeat", this.status());
    }, 10_000);
    this.heartbeatTimer.unref?.();
  }

  #onData(chunk) {
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
            .update(`${challenge}|${this.apiKey}`)
            .digest("hex");
          this.socket?.write(`auth=${digest}-${this.apiKey.slice(-5)}|dataset=${DATASET}|encoding=json|ts_out=1|heartbeat_interval_s=10\n`);
        } else if (line.startsWith("success=1")) {
          this.authenticated = true;
          this.reconnectMs = this.reconnectMinMs;
          this.socket?.write(`schema=trades|stype_in=raw_symbol|symbols=${[...this.references.keys()].join(",")}\n`);
          this.socket?.write("start_session=1\n");
          this.emit("status", this.status());
        } else if (line.startsWith("success=0") || line.startsWith("error=")) {
          if (/live data license is required|not entitled/i.test(line)) this.disabledReason = line;
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
        const direct = [record.raw_symbol, record.stype_out_symbol, record.stype_in_symbol, record.symbol]
          .map(normalizeSymbol)
          .find((symbol) => this.references.has(symbol));
        const instrumentId = Number(record.hd?.instrument_id ?? record.instrument_id);
        if (direct && Number.isFinite(instrumentId)) this.instrumentSymbols.set(instrumentId, direct);
        const symbol = direct || (Number.isFinite(instrumentId) ? this.instrumentSymbols.get(instrumentId) : null);
        if (!symbol || !this.references.has(symbol)) continue;
        const price = finitePrice(record.price);
        const size = Math.max(0, Math.floor(Number(record.size) || 0));
        if (!(price > 0) || !(size >= 0)) continue;
        const timestampMs = eventTimestampMs(record.hd?.ts_event ?? record.ts_recv ?? record.ts_out);
        const sequence = ++this.sequence;
        const trade = Object.freeze({
          id: `databento-option-${sequence}`,
          sequence,
          timestampMs,
          price,
          size,
          // Databento's trades schema does not guarantee aggressor side. Do
          // not manufacture order-flow delta from an unclassified print.
          aggressor: "UNKNOWN",
        });
        const retained = this.retained.get(symbol) || [];
        retained.push(trade);
        if (retained.length > MAX_RETAINED_TRADES)
          retained.splice(0, retained.length - MAX_RETAINED_TRADES);
        this.retained.set(symbol, retained);
        this.lastTradeAt = timestampMs;
        this.emit("trade", { symbol, trade });
      } catch {
        // Mapping, heartbeat and control records are expected in the stream.
      }
    }
  }
}

function normalizeSymbol(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized && /^[A-Z0-9 ._+\-]{1,64}$/.test(normalized) ? normalized : "";
}

function finitePrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || Math.abs(numeric) >= 9e18) return 0;
  return Math.abs(numeric) > 1e7 ? numeric / 1e9 : numeric;
}

function eventTimestampMs(value) {
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
