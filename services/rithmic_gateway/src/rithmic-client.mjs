import { EventEmitter } from "node:events";
import WebSocket from "ws";

import { loadProtocol, TEMPLATE_IDS } from "./protocol.mjs";
import { RithmicBookStore, instrumentKey } from "./book-store.mjs";

function openSocket(url, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {
      handshakeTimeout: timeoutMs,
      rejectUnauthorized: true,
    });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Rithmic WebSocket connection timed out."));
    }, timeoutMs);
    socket.once("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForTemplate(socket, protocol, templateId, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for Rithmic template ${templateId}.`));
    }, timeoutMs);
    const onMessage = (data) => {
      try {
        const decoded = protocol.decode(data);
        if (decoded.templateId !== templateId) return;
        cleanup();
        resolve(decoded.payload);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const onClose = () => {
      cleanup();
      reject(new Error("Rithmic WebSocket closed while awaiting a response."));
    };
    function cleanup() {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("close", onClose);
    }
    socket.on("message", onMessage);
    socket.once("close", onClose);
  });
}

export async function discoverRithmicSystems({ url, protoDir }) {
  const protocol = loadProtocol(protoDir);
  const socket = await openSocket(url);
  try {
    const responsePromise = waitForTemplate(
      socket,
      protocol,
      TEMPLATE_IDS.SYSTEM_INFO_RESPONSE,
    );
    socket.send(
      protocol.encode("RequestRithmicSystemInfo", {
        templateId: TEMPLATE_IDS.SYSTEM_INFO_REQUEST,
        userMsg: ["kwantify-system-discovery"],
      }),
    );
    const response = await responsePromise;
    if (response.rpCode?.[0] !== "0") {
      throw new Error(`Rithmic system discovery failed: ${response.rpCode?.join(", ") || "unknown"}`);
    }
    return response.systemName || [];
  } finally {
    socket.close(1000, "discovery complete");
  }
}

export class RithmicMarketDataClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.protocol = loadProtocol(config.protoDir);
    this.book = new RithmicBookStore({ maxTrades: config.maxTrades });
    this.socket = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.stopped = true;
    this.subscriptions = new Map(
      config.subscriptions.map((row) => [instrumentKey(row.exchange, row.symbol), row]),
    );
    this.status = {
      provider: "Rithmic",
      environment: config.systemName,
      url: config.url,
      configured: config.configured,
      connected: false,
      authenticated: false,
      infraType: "Ticker Plant",
      startedAt: null,
      connectedAt: null,
      lastMessageAt: null,
      lastError: null,
      reconnectAttempt: 0,
      discoveredSystems: [],
      templateCounts: {},
      subscriptionResponses: [],
      subscriptions: [...this.subscriptions.values()],
    };
  }

  async start() {
    this.stopped = false;
    this.status.startedAt ||= new Date().toISOString();
    if (!this.config.configured) {
      this.status.lastError = "RITHMIC_USER and RITHMIC_PASSWORD are not configured.";
      return;
    }
    const systems = await discoverRithmicSystems(this.config);
    this.status.discoveredSystems = systems;
    if (!systems.includes(this.config.systemName)) {
      throw new Error(
        `Configured Rithmic system "${this.config.systemName}" was not returned by the gateway.`,
      );
    }
    await this.connect();
  }

  async connect() {
    if (this.stopped || this.socket?.readyState === WebSocket.OPEN) return;
    try {
      const socket = await openSocket(this.config.url);
      const loginPromise = waitForTemplate(socket, this.protocol, TEMPLATE_IDS.LOGIN_RESPONSE);
      socket.send(
        this.protocol.encode("RequestLogin", {
          templateId: TEMPLATE_IDS.LOGIN_REQUEST,
          templateVersion: "3.9",
          userMsg: ["kwantify-ticker-plant-login"],
          user: this.config.user,
          password: this.config.password,
          appName: this.config.appName,
          appVersion: this.config.appVersion,
          systemName: this.config.systemName,
          infraType: 1,
        }),
      );
      const response = await loginPromise;
      if (response.rpCode?.[0] !== "0") {
        socket.close(1008, "login rejected");
        const error = new Error(
          `Rithmic login rejected: ${response.rpCode?.join(", ") || "unknown"}`,
        );
        error.code = "RITHMIC_AUTH_REJECTED";
        throw error;
      }
      this.socket = socket;
      this.status.connected = true;
      this.status.authenticated = true;
      this.status.connectedAt = new Date().toISOString();
      this.status.lastError = null;
      this.status.reconnectAttempt = 0;
      this.reconnectAttempt = 0;
      socket.on("message", (data) => this.handleMessage(data));
      socket.on("close", (code, reason) => this.handleClose(code, reason));
      socket.on("error", (error) => {
        this.status.lastError = error.message;
        this.emit("gatewayError", error);
      });
      const heartbeatSeconds = Math.max(5, Number(response.heartbeatInterval || 30));
      this.heartbeatTimer = setInterval(
        () => this.sendHeartbeat(),
        Math.max(1_000, Math.floor(heartbeatSeconds * 500)),
      );
      for (const subscription of this.subscriptions.values()) {
        this.sendSubscription(subscription);
      }
      this.emit("status", this.health());
    } catch (error) {
      this.status.connected = false;
      this.status.authenticated = false;
      this.status.lastError = error instanceof Error ? error.message : String(error);
      this.emit("gatewayError", error);
      if (error?.code !== "RITHMIC_AUTH_REJECTED") this.scheduleReconnect();
      throw error;
    }
  }

  send(name, payload) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error("Rithmic Ticker Plant is not connected.");
    }
    this.socket.send(this.protocol.encode(name, payload));
  }

  sendHeartbeat() {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.send("RequestHeartbeat", {
      templateId: TEMPLATE_IDS.HEARTBEAT_REQUEST,
      userMsg: ["kwantify-heartbeat"],
    });
  }

  subscribe(exchange, symbol) {
    const row = {
      exchange: String(exchange).trim().toUpperCase(),
      symbol: String(symbol).trim().toUpperCase(),
    };
    if (!row.exchange || !row.symbol) {
      throw new Error("Both exchange and symbol are required.");
    }
    const key = instrumentKey(row.exchange, row.symbol);
    const existing = this.subscriptions.get(key);
    if (existing) {
      this.book.ensure(existing.exchange, existing.symbol);
      return existing;
    }
    this.subscriptions.set(key, row);
    this.book.ensure(row.exchange, row.symbol);
    this.status.subscriptions = [...this.subscriptions.values()];
    if (this.socket?.readyState === WebSocket.OPEN) this.sendSubscription(row);
    return row;
  }

  unsubscribe(exchange, symbol) {
    const row = {
      exchange: String(exchange).trim().toUpperCase(),
      symbol: String(symbol).trim().toUpperCase(),
    };
    this.subscriptions.delete(instrumentKey(row.exchange, row.symbol));
    this.status.subscriptions = [...this.subscriptions.values()];
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send("RequestMarketDataUpdate", {
        templateId: TEMPLATE_IDS.MARKET_DATA_REQUEST,
        userMsg: [`unsubscribe:${row.exchange}:${row.symbol}`],
        symbol: row.symbol,
        exchange: row.exchange,
        request: 2,
        updateBits: 7,
      });
      if (this.config.enableDepthByOrder) {
        this.send("RequestDepthByOrderUpdates", {
          templateId: TEMPLATE_IDS.DEPTH_UPDATES_REQUEST,
          userMsg: [`dbo-unsubscribe:${row.exchange}:${row.symbol}`],
          request: 2,
          symbol: row.symbol,
          exchange: row.exchange,
        });
      }
    }
    return row;
  }

  sendSubscription(row) {
    this.send("RequestMarketDataUpdate", {
      templateId: TEMPLATE_IDS.MARKET_DATA_REQUEST,
      userMsg: [`subscribe:${row.exchange}:${row.symbol}`],
      symbol: row.symbol,
      exchange: row.exchange,
      request: 1,
      updateBits: 7,
    });
    if (this.config.enableDepthByOrder) {
      this.send("RequestDepthByOrderSnapshot", {
        templateId: TEMPLATE_IDS.DEPTH_SNAPSHOT_REQUEST,
        userMsg: [`dbo-snapshot:${row.exchange}:${row.symbol}`],
        symbol: row.symbol,
        exchange: row.exchange,
      });
      this.send("RequestDepthByOrderUpdates", {
        templateId: TEMPLATE_IDS.DEPTH_UPDATES_REQUEST,
        userMsg: [`dbo-subscribe:${row.exchange}:${row.symbol}`],
        request: 1,
        symbol: row.symbol,
        exchange: row.exchange,
      });
    }
  }

  handleMessage(data) {
    const decoded = this.protocol.decode(data);
    this.status.lastMessageAt = new Date().toISOString();
    this.status.templateCounts[decoded.templateId] =
      Number(this.status.templateCounts[decoded.templateId] || 0) + 1;
    let event = null;
    switch (decoded.templateId) {
      case 150:
        event = this.book.applyTrade(decoded.payload);
        break;
      case 151:
        event = this.book.applyBbo(decoded.payload);
        break;
      case 156:
        event = this.book.applyOrderBook(decoded.payload);
        break;
      case 116:
        this.recordSubscriptionResponse(decoded);
        event = this.book.applyDepthSnapshot(decoded.payload);
        break;
      case 160:
        event = this.book.applyDepthUpdate(decoded.payload);
        break;
      case 101:
      case 118:
        this.recordSubscriptionResponse(decoded);
        if (decoded.payload?.rpCode?.[0] && decoded.payload.rpCode[0] !== "0") {
          this.status.lastError = `Rithmic subscription rejected: ${decoded.payload.rpCode.join(", ")}`;
          this.emit("gatewayError", new Error(this.status.lastError));
        }
        break;
      case 77:
        this.status.lastError = "Rithmic forced the session to log out.";
        break;
      default:
        break;
    }
    if (event) {
      if (event.sequenceRegression && decoded.payload?.exchange && decoded.payload?.symbol) {
        this.status.lastError =
          `Depth sequence regression for ${decoded.payload.exchange}:${decoded.payload.symbol}; ` +
          `previous ${event.previousSequence}, received ${event.receivedSequence}. Requesting a fresh snapshot.`;
        this.book.resetDepth(decoded.payload.exchange, decoded.payload.symbol);
        this.send("RequestDepthByOrderSnapshot", {
          templateId: TEMPLATE_IDS.DEPTH_SNAPSHOT_REQUEST,
          userMsg: [`dbo-resync:${decoded.payload.exchange}:${decoded.payload.symbol}`],
          symbol: decoded.payload.symbol,
          exchange: decoded.payload.exchange,
        });
      }
      this.emit("marketData", {
        ...event,
        receivedAt: this.status.lastMessageAt,
      });
    }
  }

  recordSubscriptionResponse(decoded) {
    const payload = decoded.payload || {};
    const rqHandlerRpCode = payload.rqHandlerRpCode || [];
    const rpCode = payload.rpCode || [];
    const allCodes = [...rqHandlerRpCode, ...rpCode];
    const failureCode = allCodes.find((code) => code !== "0");
    if (
      decoded.templateId === 116 &&
      !failureCode &&
      rqHandlerRpCode.length > 0 &&
      rpCode.length === 0
    ) {
      return;
    }
    const response = {
      templateId: decoded.templateId,
      userMsg: payload.userMsg || [],
      rqHandlerRpCode,
      rpCode,
      receivedAt: this.status.lastMessageAt,
    };
    this.status.subscriptionResponses.push(response);
    if (this.status.subscriptionResponses.length > 32) {
      this.status.subscriptionResponses.splice(
        0,
        this.status.subscriptionResponses.length - 32,
      );
    }
    if (failureCode) {
      this.status.lastError =
        `Rithmic template ${decoded.templateId} rejected a subscription request: ${failureCode}`;
    }
  }

  handleClose(code, reason) {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.socket = null;
    this.status.connected = false;
    this.status.authenticated = false;
    this.status.lastError = `Rithmic socket closed (${code}) ${String(reason || "")}`.trim();
    this.emit("status", this.health());
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    this.status.reconnectAttempt = this.reconnectAttempt;
    const base = Math.min(
      this.config.reconnectMaxMs,
      this.config.reconnectMinMs * 2 ** Math.min(8, this.reconnectAttempt - 1),
    );
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // connect() records the error and schedules the next bounded retry.
      }
    }, delay);
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.send("RequestLogout", {
          templateId: 12,
          userMsg: ["kwantify-shutdown"],
        });
      } catch {
        // Socket teardown remains authoritative during shutdown.
      }
      this.socket.close(1000, "gateway shutdown");
    }
    this.socket = null;
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
