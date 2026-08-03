import WebSocket from "ws";

import { loadConfig } from "../src/config.mjs";
import { loadProtocol, TEMPLATE_IDS } from "../src/protocol.mjs";

const ORDER_PLANT = 2;
const RECONNECT_DELAY_MS = 2_000;
const LOGIN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const protocol = loadProtocol(config.protoDir);
let stopping = false;
let socket = null;

if (!config.configured) {
  throw new Error("RITHMIC_USER and RITHMIC_PASSWORD must be set locally.");
}
if (!config.appName.startsWith("jahu:")) {
  throw new Error('RITHMIC_APP_NAME must begin with "jahu:" for conformance.');
}

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectAndHold() {
  return new Promise((resolve, reject) => {
    let authenticated = false;
    let heartbeatTimer = null;
    let loginTimer = null;

    const cleanup = () => {
      clearTimeout(loginTimer);
      clearInterval(heartbeatTimer);
    };

    socket = new WebSocket(config.url, {
      handshakeTimeout: LOGIN_TIMEOUT_MS,
      rejectUnauthorized: true,
    });

    loginTimer = setTimeout(() => {
      socket?.terminate();
      reject(new Error("Timed out waiting for the Rithmic Order Plant login."));
    }, LOGIN_TIMEOUT_MS);

    socket.once("open", () => {
      socket.send(
        protocol.encode("RequestLogin", {
          templateId: TEMPLATE_IDS.LOGIN_REQUEST,
          templateVersion: "3.9",
          userMsg: ["olisa-labs-order-plant-conformance"],
          user: config.user,
          password: config.password,
          appName: config.appName,
          appVersion: config.appVersion,
          systemName: config.systemName,
          infraType: ORDER_PLANT,
        }),
      );
    });

    socket.on("message", (data) => {
      const decoded = protocol.decode(data);
      if (decoded.templateId !== TEMPLATE_IDS.LOGIN_RESPONSE || authenticated) {
        return;
      }
      clearTimeout(loginTimer);
      const response = decoded.payload;
      if (response.rpCode?.[0] !== "0") {
        cleanup();
        socket.close(1008, "login rejected");
        reject(
          new Error(
            `Rithmic Order Plant login rejected: ${
              response.rpCode?.join(", ") || "unknown"
            }`,
          ),
        );
        return;
      }

      authenticated = true;
      const heartbeatSeconds = Math.max(
        5,
        Number(response.heartbeatInterval || 30),
      );
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState !== WebSocket.OPEN) return;
        socket.send(
          protocol.encode("RequestHeartbeat", {
            templateId: TEMPLATE_IDS.HEARTBEAT_REQUEST,
            userMsg: ["olisa-labs-order-plant-heartbeat"],
          }),
        );
      }, Math.max(1_000, Math.floor(heartbeatSeconds * 500)));

      log(
        `Authenticated to ${config.systemName} Order Plant as ${config.appName}; leaving connection running for conformance.`,
      );
    });

    socket.once("error", (error) => {
      if (!authenticated) {
        cleanup();
        reject(error);
      } else {
        log(`Order Plant socket error: ${error.message}`);
      }
    });

    socket.once("close", (code, reason) => {
      cleanup();
      socket = null;
      const suffix = reason?.length ? ` (${reason.toString()})` : "";
      if (stopping) {
        resolve();
      } else if (authenticated) {
        log(`Order Plant connection closed: ${code}${suffix}`);
        resolve();
      } else {
        reject(new Error(`Order Plant connection closed: ${code}${suffix}`));
      }
    });
  });
}

async function stop() {
  if (stopping) return;
  stopping = true;
  log("Stopping Rithmic Order Plant conformance connection.");
  if (socket?.readyState === WebSocket.OPEN) {
    socket.close(1000, "operator shutdown");
  } else {
    socket?.terminate();
  }
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

log(
  `Starting ${config.appName} against ${config.systemName} Order Plant at ${config.url}.`,
);
while (!stopping) {
  try {
    await connectAndHold();
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
  }
  if (!stopping) {
    log(`Reconnecting in ${RECONNECT_DELAY_MS}ms.`);
    await delay(RECONNECT_DELAY_MS);
  }
}
