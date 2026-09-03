import { EventEmitter } from "node:events";
import WebSocket from "ws";

import { loadProtocol, TEMPLATE_IDS } from "./protocol.mjs";
import { RithmicBookStore, instrumentKey } from "./book-store.mjs";

/*
 * Everything Rithmic will send for an instrument.
 *
 * The subscription asked for update_bits 7 - LAST_TRADE | BBO | ORDER_BOOK -
 * which is three of the seventeen types the protocol defines. Settlement,
 * open interest, market mode (the halts), the official open and close, the
 * price limits and the opening/closing indicators were never requested, so
 * for every session recorded before this they do not exist and cannot be
 * recovered: Rithmic sells no history for them.
 *
 * The value is the OR of every UpdateBits constant in
 * request_market_data_update.proto, written out so a reader can see that
 * nothing was left out on purpose.
 */
const UPDATE_BITS = {
  LAST_TRADE: 1,
  BBO: 2,
  ORDER_BOOK: 4,
  OPEN: 8,
  OPENING_INDICATOR: 16,
  HIGH_LOW: 32,
  HIGH_BID_LOW_ASK: 64,
  CLOSE: 128,
  CLOSING_INDICATOR: 256,
  SETTLEMENT: 512,
  MARKET_MODE: 1024,
  OPEN_INTEREST: 2048,
  MARGIN_RATE: 4096,
  HIGH_PRICE_LIMIT: 8192,
  LOW_PRICE_LIMIT: 16384,
  PROJECTED_SETTLEMENT: 32768,
  ADJUSTED_CLOSE: 65536,
};
export const ALL_UPDATE_BITS = Object.values(UPDATE_BITS)
  .reduce((all, bit) => all | bit, 0);

/*
 * What is NOT archived, rather than what is.
 *
 * This was an allowlist of six template ids, so a message type we had not
 * enumerated was discarded before it ever reached the recorder - including
 * every type the widened subscription now brings in, whose ids are not
 * published in the .proto files. An allowlist silently drops what it does not
 * know about, which is the opposite of what an archive is for.
 *
 * Session plumbing is excluded because it carries no market data and would
 * only add noise: login, logout, system info, heartbeats and the responses to
 * our own subscription requests.
 */
const NON_MARKET_TEMPLATE_IDS = new Set([
  // Login, logout, system info and heartbeats - the ids we send ourselves and
  // their direct responses, from TEMPLATE_IDS above.
  10, 11, 12, 13, 16, 17, 18, 19,
  // The acknowledgements of our own market-data and depth subscriptions.
  101, 118,
]);
/*
 * Deliberately short. Every id not listed is written to the archive, including
 * ones we cannot name yet - a message we failed to anticipate is exactly the
 * message worth keeping, and noise on disk costs a few bytes while a dropped
 * market event is gone for good.
 */

// A refused login retries four times an hour at worst, which cannot lock an
// account, and recovers by itself from a session Rithmic had not yet released.
const AUTH_RETRY_MIN_MS = 60_000;
const AUTH_RETRY_MAX_MS = 15 * 60_000;

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
    // Startup can be requested both by the server boot path and the manual
    // connect endpoint. Until the login response arrives `this.socket` is
    // still null, so checking only readyState allows two simultaneous Rithmic
    // sessions to be opened with the same credentials. Rithmic rejects the
    // second session and that rejection can overwrite the healthy first
    // session's shared status. Keep both operations single-flight.
    this.startPromise = null;
    this.connectPromise = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.stopped = true;
    this.subscriptions = new Map(
      config.subscriptions.map((row) => [instrumentKey(row.exchange, row.symbol), row]),
    );
    // The complete set of instruments this collector may ever ask Rithmic
    // for. Empty means "no restriction configured" and is treated as
    // allow-configured-only by subscribe().
    this.allowedInstruments = new Set(
      (config.allowedInstruments ?? config.subscriptions ?? []).map((row) =>
        instrumentKey(row.exchange, row.symbol),
      ),
    );
    this.allowedRoots = new Set(
      (config.allowedRoots ?? []).map((row) =>
        instrumentKey(row.exchange, row.symbol),
      ),
    );
    this.frontMonthCache = new Map();
    this.pendingFrontMonthRequests = new Map();
    this.frontMonthRequestSequence = 0;
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
    if (this.startPromise) return this.startPromise;
    if (
      !this.stopped &&
      this.status.authenticated &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    this.startPromise = this.startOnce();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async startOnce() {
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
    if (this.connectPromise) return this.connectPromise;
    if (this.stopped || this.socket?.readyState === WebSocket.OPEN) return;

    this.connectPromise = this.connectOnce();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async connectOnce() {
    try {
      const socket = await openSocket(this.config.url);
      if (this.stopped) {
        socket.close(1000, "connection cancelled");
        return;
      }
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
      /*
       * A refused login is retried too, just slowly.
       *
       * It used to schedule nothing at all, so one rejection left the
       * collector permanently dead with the process still running and Docker
       * still reporting it healthy - it had to be restarted by hand, and every
       * print that arrived meanwhile is gone for good. The rejection that
       * caused this was transient: Rithmic would not accept a new login while
       * it still held the session from the process we had just replaced.
       *
       * Retrying on the normal one-second backoff would hammer the account and
       * risk a real lockout, so an auth failure gets its own much longer
       * schedule: a minute, backing off to a quarter of an hour. Wrong
       * credentials therefore retry four times an hour, which locks nothing,
       * while a session that simply had not been released recovers on its own.
       */
      this.scheduleReconnect(error?.code === "RITHMIC_AUTH_REJECTED");
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

  async resolveFrontMonth(exchange, root, timeoutMs = 8_000) {
    const normalizedExchange = String(exchange || "").trim().toUpperCase();
    const normalizedRoot = String(root || "").trim().toUpperCase();
    if (!normalizedExchange || !normalizedRoot) {
      throw new Error("Both exchange and product root are required.");
    }
    const key = instrumentKey(normalizedExchange, normalizedRoot);
    const cached = this.frontMonthCache.get(key);
    if (cached && Date.now() - cached.resolvedAt < 6 * 60 * 60_000) {
      return cached;
    }
    const live = this.book.list()
      .filter((row) => (
        String(row.exchange || "").toUpperCase() === normalizedExchange
        && String(row.symbol || "").toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/u, "") === normalizedRoot
        && ["LIVE", "STALE"].includes(row.status)
      ))
      .sort((left, right) => (right.status === "LIVE" ? 1 : 0) - (left.status === "LIVE" ? 1 : 0))[0];
    if (live?.symbol) {
      const resolved = {
        exchange: normalizedExchange,
        root: normalizedRoot,
        contractSymbol: String(live.symbol).toUpperCase(),
        resolvedAt: Date.now(),
        source: "live-book",
      };
      this.frontMonthCache.set(key, resolved);
      return resolved;
    }
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error("Rithmic Ticker Plant is not connected.");
    }
    const requestId = `front-month:${normalizedExchange}:${normalizedRoot}:${++this.frontMonthRequestSequence}`;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingFrontMonthRequests.delete(requestId);
        reject(new Error(`Timed out resolving ${normalizedExchange}:${normalizedRoot} front month.`));
      }, timeoutMs);
      this.pendingFrontMonthRequests.set(requestId, {
        exchange: normalizedExchange,
        root: normalizedRoot,
        resolve,
        reject,
        timeout,
      });
      try {
        this.send("RequestFrontMonthContract", {
          templateId: TEMPLATE_IDS.FRONT_MONTH_REQUEST,
          userMsg: [requestId],
          symbol: normalizedRoot,
          exchange: normalizedExchange,
          needUpdates: false,
        });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingFrontMonthRequests.delete(requestId);
        reject(error);
      }
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
      // Already subscribed: serve from the local book and transmit nothing.
      // This is the path every website read takes, so reads cost Rithmic
      // zero requests no matter how many clients or tabs are open.
      this.book.ensure(existing.exchange, existing.symbol);
      return existing;
    }
    // Not subscribed: this would open a NEW upstream subscription that never
    // expires. Refuse anything outside the configured allowlist rather than
    // silently consuming provider capacity on a stray query string.
    const root = row.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/u, "");
    const rootAllowed = this.allowedRoots.has(instrumentKey(row.exchange, root));
    if (this.allowedInstruments.size && !this.allowedInstruments.has(key) && !rootAllowed) {
      const error = new Error(
        `${row.exchange}:${row.symbol} is not an allowed instrument on this collector. `
          + `Add it to RITHMIC_SUBSCRIPTIONS, RITHMIC_ALLOWED_INSTRUMENTS, or RITHMIC_ALLOWED_ROOTS and restart.`,
      );
      error.code = "RITHMIC_INSTRUMENT_NOT_ALLOWED";
      throw error;
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
        updateBits: ALL_UPDATE_BITS,
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
      updateBits: ALL_UPDATE_BITS,
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
    // Archive tap. The book-store events below carry only {type, instrument}
    // for depth and BBO because the values land in the book itself — writing
    // those to disk would archive the fact that an update happened without
    // what it contained. The decoded wire payload is the only faithful
    // record, and L3 depth cannot be re-requested from Rithmic later.
    if (!NON_MARKET_TEMPLATE_IDS.has(decoded.templateId)) {
      this.emit("rawMessage", {
        templateId: decoded.templateId,
        exchange: decoded.payload?.exchange,
        symbol: decoded.payload?.symbol,
        payload: decoded.payload,
        // Unmapped market-data templates cannot be decoded safely until their
        // vendor schema is identified. protocol.decode() preserves those
        // original wire bytes; forwarding them here is essential. Previously
        // this property was accidentally discarded at the event boundary, so
        // the recorder wrote { payload: null } and the data itself was lost.
        ...(decoded.raw ? { raw: decoded.raw } : {}),
        receivedAt: this.status.lastMessageAt,
      });
    }
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
      case 161:
        // Some Rithmic systems terminate a DBO snapshot with the dedicated end
        // event instead of the empty ResponseDepthByOrderSnapshot packet.
        // Both paths must commit the staged book exactly once.
        event = this.book.applyDepthSnapshot(decoded.payload);
        break;
      case 154467: {
        const payload = decoded.payload || {};
        const requestId = payload.userMsg?.[0];
        const pending = requestId ? this.pendingFrontMonthRequests.get(requestId) : null;
        if (!pending) break;
        clearTimeout(pending.timeout);
        this.pendingFrontMonthRequests.delete(requestId);
        const failureCode = payload.rpCode?.find((code) => code !== "0");
        const contractSymbol = String(payload.tradingSymbol || payload.symbol || "").toUpperCase();
        if (failureCode || !contractSymbol) {
          pending.reject(new Error(
            `Rithmic could not resolve ${pending.exchange}:${pending.root} front month${failureCode ? ` (${failureCode})` : ""}.`,
          ));
          break;
        }
        const resolved = {
          exchange: String(payload.tradingExchange || pending.exchange).toUpperCase(),
          root: pending.root,
          contractSymbol,
          resolvedAt: Date.now(),
          source: "rithmic-front-month",
        };
        this.frontMonthCache.set(instrumentKey(pending.exchange, pending.root), resolved);
        pending.resolve(resolved);
        break;
      }
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
        // Rithmic's DBO sequence is exchange/channel scoped, not a monotonic
        // per-instrument cursor. A lower value therefore does not prove that
        // this instrument lost data. The former implementation invalidated
        // the live book and requested a new 1,000+ row snapshot every time;
        // production recorded millions of snapshot rows and the heatmap kept
        // painting partial rebuilds. Count the observation for diagnostics,
        // but preserve the atomic book. Reconnect/login still obtains a fresh
        // baseline snapshot.
        this.status.observedDepthSequenceRegressions =
          Number(this.status.observedDepthSequenceRegressions || 0) + 1;
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

  scheduleReconnect(authRejected = false) {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    this.status.reconnectAttempt = this.reconnectAttempt;
    // A refused login backs off on its own far slower schedule; see connect().
    const minMs = authRejected ? AUTH_RETRY_MIN_MS : this.config.reconnectMinMs;
    const maxMs = authRejected ? AUTH_RETRY_MAX_MS : this.config.reconnectMaxMs;
    const base = Math.min(
      maxMs,
      minMs * 2 ** Math.min(8, this.reconnectAttempt - 1),
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
