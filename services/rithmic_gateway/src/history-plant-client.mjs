import WebSocket from "ws";

import { loadProtocol, TEMPLATE_IDS } from "./protocol.mjs";

const HISTORY_PLANT = 3;
const OPEN_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30 * 60_000;

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { handshakeTimeout: OPEN_TIMEOUT_MS, rejectUnauthorized: true });
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out opening the Rithmic History Plant socket."));
    }, OPEN_TIMEOUT_MS);
    socket.once("open", () => { clearTimeout(timer); resolve(socket); });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

export class RithmicHistoryPlantClient {
  constructor(config, options = {}) {
    this.config = config;
    this.protocol = loadProtocol(config.protoDir);
    this.socket = null;
    this.heartbeat = null;
    this.requestSequence = 0;
    this.pending = null;
    this.bytesReceived = 0;
    this.requestTimeoutMs = Number(options.requestTimeoutMs) || REQUEST_TIMEOUT_MS;
  }

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    const socket = await openSocket(this.config.url);
    const login = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("History Plant login timed out.")), OPEN_TIMEOUT_MS);
      const onMessage = (data) => {
        const decoded = this.protocol.decode(data);
        if (decoded.templateId !== TEMPLATE_IDS.LOGIN_RESPONSE) return;
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve(decoded.payload ?? decoded);
      };
      socket.on("message", onMessage);
    });
    socket.send(this.protocol.encode("RequestLogin", {
      templateId: TEMPLATE_IDS.LOGIN_REQUEST,
      templateVersion: "5.54",
      userMsg: ["kwantdesk-history-backfill-login"],
      user: this.config.user,
      password: this.config.password,
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      systemName: this.config.systemName,
      infraType: HISTORY_PLANT,
    }));
    const response = await login;
    if (response.rpCode?.[0] !== "0") {
      socket.close(1008, "login rejected");
      throw new Error(`History Plant login rejected: ${response.rpCode?.join(", ") || "unknown"}`);
    }
    this.socket = socket;
    socket.on("message", (data) => this.handleMessage(data));
    socket.on("close", () => this.failPending(new Error("History Plant socket closed.")));
    socket.on("error", (error) => this.failPending(error));
    const heartbeatSeconds = Math.max(5, Number(response.heartbeatInterval || 30));
    this.heartbeat = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(this.protocol.encode("RequestHeartbeat", {
        templateId: TEMPLATE_IDS.HEARTBEAT_REQUEST,
        userMsg: ["kwantdesk-history-backfill-heartbeat"],
      }));
    }, Math.max(1_000, Math.floor(heartbeatSeconds * 500)));
  }

  handleMessage(data) {
    this.bytesReceived += data.length ?? data.byteLength ?? 0;
    const decoded = this.protocol.decode(data);
    if (!this.pending || decoded.templateId !== this.pending.responseTemplateId) return;
    const payload = decoded.payload ?? decoded;
    if (!payload.userMsg?.includes(this.pending.id)) return;
    if (payload.rqHandlerRpCode?.length && payload.rqHandlerRpCode[0] !== "0") {
      this.failPending(new Error(`History request rejected: ${payload.rqHandlerRpCode.join(", ")}`));
      return;
    }
    if (payload.rpCode?.length) {
      if (payload.rpCode[0] !== "0") {
        this.failPending(new Error(`History replay failed: ${payload.rpCode.join(", ")}`));
      } else {
        const { resolve } = this.pending;
        clearTimeout(this.pending.timer);
        this.pending = null;
        resolve();
      }
      return;
    }
    this.pending.onRow(payload);
  }

  failPending(error) {
    if (!this.pending) return;
    const { reject } = this.pending;
    clearTimeout(this.pending.timer);
    this.pending = null;
    reject(error);
  }

  async replayMinuteBars({ exchange, symbol, startSec, finishSec, onBar }) {
    if (this.pending) throw new Error("Only one History Plant replay may run at a time.");
    await this.connect();
    const id = `kwantdesk-minute-${Date.now()}-${++this.requestSequence}`;
    const before = this.bytesReceived;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.failPending(new Error(`History replay timed out for ${exchange}:${symbol}.`)), this.requestTimeoutMs);
      this.pending = {
        id,
        responseTemplateId: TEMPLATE_IDS.TIME_BAR_REPLAY_RESPONSE,
        onRow: onBar,
        resolve,
        reject,
        timer,
      };
      this.socket.send(this.protocol.encode("RequestTimeBarReplay", {
        templateId: TEMPLATE_IDS.TIME_BAR_REPLAY_REQUEST,
        userMsg: [id],
        symbol,
        exchange,
        barType: 2,
        barTypePeriod: 1,
        startIndex: startSec,
        finishIndex: finishSec,
        direction: 1,
        timeOrder: 1,
        resumeBars: true,
      }));
    });
    return { bytesReceived: this.bytesReceived - before };
  }

  close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(this.protocol.encode("RequestLogout", {
          templateId: TEMPLATE_IDS.LOGOUT_REQUEST,
          userMsg: ["kwantdesk-history-backfill-logout"],
        }));
      } catch {}
      this.socket.close(1000, "history backfill complete");
    }
    this.socket = null;
  }
}
