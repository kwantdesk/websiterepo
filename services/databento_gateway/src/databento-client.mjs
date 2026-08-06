import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { createConnection } from "node:net";

import { buildPositioningMap } from "./native-gamma-engine.mjs";
import { chicagoWallClockToUtc } from "./market-clock.mjs";

const HISTORICAL_URL = "https://hist.databento.com/v0/timeseries.get_range";

function basicAuth(apiKey) {
  return Buffer.from(`${apiKey}:`).toString("base64");
}

function nextUtcDate(dateIso) {
  const value = new Date(`${dateIso}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function priorTradingDate(dateIso) {
  const value = new Date(`${dateIso}T00:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

async function pullRange({ apiKey, schema, symbols, stype = "parent", start, end, limit = 150_000 }) {
  const query = new URLSearchParams({
    dataset: "GLBX.MDP3",
    schema,
    symbols,
    stype_in: stype,
    start,
    end,
    encoding: "json",
    limit: String(limit),
  });
  const response = await fetch(`${HISTORICAL_URL}?${query}`, {
    headers: { Authorization: `Basic ${basicAuth(apiKey)}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Databento ${schema} ${symbols} returned ${response.status}.`);
  const text = await response.text();
  return text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
}

export async function loadDailyPositioningMap(apiKey, requestedDate, logger = () => {}) {
  let settleDate = requestedDate;
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const next = nextUtcDate(settleDate);
      const start = `${settleDate}T00:00:00.000Z`;
      const end = `${next}T00:00:00.000Z`;
      const [definitions, futuresDefinitions, statistics, futuresStatistics] = await Promise.all([
        pullRange({ apiKey, schema: "definition", symbols: "NQ.OPT", start, end }),
        pullRange({ apiKey, schema: "definition", symbols: "NQ.FUT", start, end, limit: 10_000 }),
        pullRange({ apiKey, schema: "statistics", symbols: "NQ.OPT", start, end }),
        pullRange({ apiKey, schema: "statistics", symbols: "NQ.FUT", start, end, limit: 20_000 }),
      ]);
      const anchorMs = chicagoWallClockToUtc(settleDate, 17, 15);
      return buildPositioningMap({
        definitions,
        futuresDefinitions,
        statistics,
        futuresStatistics,
        nowMs: anchorMs,
        oiAsOf: settleDate,
        logger,
      });
    } catch (error) {
      lastError = error;
      logger({ level: "warn", code: "DAILY_MAP_ATTEMPT_FAILED", settleDate, error: error instanceof Error ? error.message : String(error) });
      settleDate = priorTradingDate(settleDate);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No settled NQ positioning map is available.");
}

function numericPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0 || Math.abs(numeric) >= 9e18) return null;
  return Math.abs(numeric) > 1e7 ? numeric / 1e9 : numeric;
}

export class DatabentoNqTradeStream extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.socket = null;
    this.buffer = "";
    this.authenticated = false;
    this.stopping = false;
    this.reconnectMs = config.reconnectMinMs;
    this.contract = "";
    this.lastMessageAt = null;
    this.lastTradeAt = null;
    this.lastPrice = null;
    this.heartbeatTimer = null;
  }

  start(contract) {
    this.contract = String(contract || "").trim().toUpperCase();
    this.stopping = false;
    this.connect();
  }

  setContract(contract) {
    const normalized = String(contract || "").trim().toUpperCase();
    if (!normalized || normalized === this.contract) return;
    this.contract = normalized;
    this.socket?.destroy();
  }

  connect() {
    if (this.stopping || this.socket) return;
    const socket = createConnection({ host: "glbx-mdp3.lsg.databento.com", port: 13000 });
    this.socket = socket;
    this.buffer = "";
    this.authenticated = false;
    socket.setKeepAlive(true, 10_000);
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (error) => this.emit("streamError", error));
    socket.on("close", () => {
      this.socket = null;
      this.authenticated = false;
      this.emit("status", this.status());
      if (!this.stopping) {
        const wait = this.reconnectMs;
        this.reconnectMs = Math.min(this.config.reconnectMaxMs, this.reconnectMs * 2);
        setTimeout(() => this.connect(), wait).unref?.();
      }
    });
    this.heartbeatTimer ??= setInterval(() => {
      const now = Date.now();
      if (this.authenticated && this.lastMessageAt && now - this.lastMessageAt > 30_000) {
        this.emit("streamError", new Error("Databento live stream heartbeat timed out."));
        this.socket?.destroy();
        return;
      }
      this.emit("heartbeat", this.status());
    }, 10_000);
  }

  onData(chunk) {
    this.lastMessageAt = Date.now();
    this.buffer += chunk.toString("utf8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (!this.authenticated) {
        if (line.startsWith("cram=")) {
          const challenge = line.slice(5);
          const digest = createHash("sha256").update(`${challenge}|${this.config.apiKey}`).digest("hex");
          this.socket?.write(`auth=${digest}-${this.config.apiKey.slice(-5)}|dataset=GLBX.MDP3|encoding=json|ts_out=1|heartbeat_interval_s=10\n`);
        } else if (line.startsWith("success=1")) {
          this.authenticated = true;
          this.reconnectMs = this.config.reconnectMinMs;
          if (this.contract) this.socket?.write(`schema=trades|stype_in=raw_symbol|symbols=${this.contract}\n`);
          else this.socket?.write("schema=trades|stype_in=continuous|symbols=NQ.v.0\n");
          this.socket?.write("start_session=1\n");
          this.emit("status", this.status());
        } else if (line.startsWith("success=0") || line.startsWith("error=")) {
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
        const price = numericPrice(record.price);
        if (!price) continue;
        const timestampValue = record.hd?.ts_event ?? record.ts_recv ?? record.ts_out;
        const numericTimestamp = Number(timestampValue);
        const timestamp = typeof timestampValue === "string" && !/^\d+$/.test(timestampValue)
          ? Date.parse(timestampValue)
          : numericTimestamp > 1e17 ? numericTimestamp / 1e6
            : numericTimestamp > 1e14 ? numericTimestamp / 1e3
              : numericTimestamp > 1e11 ? numericTimestamp : Date.now();
        this.lastTradeAt = Number.isFinite(timestamp) ? timestamp : Date.now();
        this.lastPrice = price;
        this.emit("trade", { price, timestamp: this.lastTradeAt, size: Number(record.size ?? 0) });
      } catch {
        // Symbol maps and control frames do not carry a trade price.
      }
    }
  }

  status() {
    return {
      connected: Boolean(this.socket && !this.socket.destroyed && this.authenticated),
      contract: this.contract || "NQ.v.0",
      lastMessageAt: this.lastMessageAt,
      lastTradeAt: this.lastTradeAt,
      lastPrice: this.lastPrice,
    };
  }

  stop() {
    this.stopping = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.socket?.destroy();
    this.socket = null;
  }
}
