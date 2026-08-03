import { EventEmitter } from "node:events";

import { RithmicBookStore, instrumentKey } from "./book-store.mjs";

export class RTraderExcelMarketDataClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.book = new RithmicBookStore({ maxTrades: config.maxTrades });
    this.subscriptions = new Map(
      config.subscriptions.map((row) => [instrumentKey(row.exchange, row.symbol), row]),
    );
    this.status = {
      provider: "Rithmic",
      source: "RTrader Pro Excel live stream",
      sourceMode: "rtrader-excel",
      environment: "RTrader Pro",
      configured: config.configured,
      connected: false,
      authenticated: false,
      readOnly: true,
      individualOrders: false,
      infraType: "MBO aggregated full depth",
      startedAt: null,
      connectedAt: null,
      lastMessageAt: null,
      lastError: null,
      subscriptions: [...this.subscriptions.values()],
    };
    this.stopped = true;
    this.watchdog = null;
    this.seenTradeIds = new Set();
    this.seenTradeOrder = [];
  }

  async start() {
    this.stopped = false;
    this.status.startedAt ||= new Date().toISOString();
    this.watchdog ||= setInterval(() => {
      const lastMessageMs = this.status.lastMessageAt
        ? Date.parse(this.status.lastMessageAt)
        : 0;
      const connected = Boolean(
        lastMessageMs && Date.now() - lastMessageMs <= this.config.excelStaleMs,
      );
      if (connected === this.status.connected) return;
      this.status.connected = connected;
      this.status.authenticated = connected;
      if (!connected && lastMessageMs) {
        this.status.lastError = "RTrader Pro Excel stream is stale.";
      }
      this.emit("status", this.health());
    }, Math.min(1_000, Math.max(250, Math.floor(this.config.excelStaleMs / 2))));
    this.emit("status", this.health());
  }

  subscribe(exchange, symbol) {
    const row = {
      exchange: String(exchange || "").trim().toUpperCase(),
      symbol: String(symbol || "").trim().toUpperCase(),
    };
    if (!row.exchange || !row.symbol) throw new Error("Both exchange and symbol are required.");
    this.subscriptions.set(instrumentKey(row.exchange, row.symbol), row);
    this.book.ensure(row.exchange, row.symbol);
    this.status.subscriptions = [...this.subscriptions.values()];
    return row;
  }

  unsubscribe(exchange, symbol) {
    const row = {
      exchange: String(exchange || "").trim().toUpperCase(),
      symbol: String(symbol || "").trim().toUpperCase(),
    };
    this.subscriptions.delete(instrumentKey(row.exchange, row.symbol));
    this.status.subscriptions = [...this.subscriptions.values()];
    return row;
  }

  ingestSnapshot(payload) {
    if (this.stopped) throw new Error("RTrader Pro Excel source is stopped.");
    const exchange = String(payload.exchange || "").trim().toUpperCase();
    const symbol = String(payload.contractSymbol || payload.symbol || "")
      .trim()
      .toUpperCase();
    if (!exchange || !symbol) throw new Error("Snapshot exchange and contractSymbol are required.");
    this.subscribe(exchange, symbol);
    const event = this.book.applyAggregatedSnapshot({ ...payload, exchange, symbol });
    const now = new Date().toISOString();
    this.status.connected = true;
    this.status.authenticated = true;
    this.status.connectedAt ||= now;
    this.status.lastMessageAt = now;
    this.status.lastError = null;
    for (const trade of event.inferredTrades || []) {
      this.emit("marketData", { type: "trade", instrument: event.instrument, trade });
    }
    this.emit("marketData", { type: "depth", instrument: event.instrument });
    return this.book.snapshot(exchange, symbol, 5_000);
  }

  ingestTrades(payload) {
    if (this.stopped) throw new Error("RTrader Pro Excel source is stopped.");
    const exchange = String(payload.exchange || "").trim().toUpperCase();
    const symbol = String(payload.contractSymbol || payload.symbol || "")
      .trim()
      .toUpperCase();
    if (!exchange || !symbol) throw new Error("Trade batch exchange and contractSymbol are required.");
    this.subscribe(exchange, symbol);
    const rows = Array.isArray(payload.trades) ? payload.trades : [];
    let accepted = 0;
    for (const row of rows) {
      const sourceTradeId = String(row.sourceTradeId || "").trim();
      if (!sourceTradeId || this.seenTradeIds.has(`${exchange}:${symbol}:${sourceTradeId}`)) continue;
      const timestampMs = Number(row.timestampMs);
      const aggressorText = String(row.aggressor || row.side || "").trim().toUpperCase();
      const event = this.book.applyTrade({
        exchange,
        symbol,
        tradePrice: Number(row.price ?? row.tradePrice),
        tradeSize: Number(row.size ?? row.tradeSize),
        aggressor: aggressorText === "BUY" || aggressorText === "B" ? 1
          : aggressorText === "SELL" || aggressorText === "S" ? 2 : 0,
        sourceSsboe: Number.isFinite(timestampMs) && timestampMs > 0 ? Math.floor(timestampMs / 1_000) : 0,
        sourceUsecs: Number.isFinite(timestampMs) && timestampMs > 0 ? (timestampMs % 1_000) * 1_000 : 0,
        sourceTradeId,
      });
      if (!event) continue;
      const dedupeKey = `${exchange}:${symbol}:${sourceTradeId}`;
      this.seenTradeIds.add(dedupeKey);
      this.seenTradeOrder.push(dedupeKey);
      accepted += 1;
      this.emit("marketData", event);
    }
    const maxSeen = Math.max(10_000, this.config.maxTrades * 2);
    if (this.seenTradeOrder.length > maxSeen) {
      const removed = this.seenTradeOrder.splice(0, this.seenTradeOrder.length - maxSeen);
      for (const key of removed) this.seenTradeIds.delete(key);
    }
    const now = new Date().toISOString();
    this.status.connected = true;
    this.status.authenticated = true;
    this.status.connectedAt ||= now;
    this.status.lastMessageAt = now;
    this.status.lastError = null;
    return {
      accepted,
      received: rows.length,
      snapshot: this.book.snapshot(exchange, symbol, 1),
    };
  }

  async stop() {
    this.stopped = true;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.status.connected = false;
    this.status.authenticated = false;
  }

  health() {
    return {
      ...this.status,
      subscriptions: [...this.subscriptions.values()],
      instruments: this.book.list(),
    };
  }
}
