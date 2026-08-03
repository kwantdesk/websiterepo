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
      infraType: "MBO-derived aggregated full depth",
      startedAt: null,
      connectedAt: null,
      lastMessageAt: null,
      lastError: null,
      subscriptions: [...this.subscriptions.values()],
    };
    this.stopped = true;
    this.watchdog = null;
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
