import WebSocket from "ws";

import { loadConfig } from "../src/config.mjs";
import { loadProtocol, TEMPLATE_IDS } from "../src/protocol.mjs";

/**
 * Does this Rithmic account carry the History Plant?
 *
 * The collector logs in as infraType 1 (Ticker Plant) and only ever has. The
 * History Plant is infraType 3 on the SAME credential — a separate login, the
 * way RTrader holds ticker, order and history sessions at once. If it answers,
 * time bars, tick bars and volume-profile minute bars become available, and
 * that last one carries per-price bid/ask aggressor volume: a historical
 * footprint, which is most of what the futures side currently buys elsewhere.
 *
 * This probe deliberately stops at the login. Sending an actual replay request
 * needs the template-id VALUES, which are not derivable from the .proto files
 * (every Rithmic message declares template_id on field 154467; the value is
 * documented separately). Guessing one would get the request rejected and read
 * as "not entitled" when the truth is "wrong number" — a false negative on the
 * one question this exists to answer.
 *
 * The login response alone is decisive: rp_code "0" means the plant is open to
 * this account.
 *
 * Safety: this is a different infraType from the collector, so it is not a
 * competing session on the ticker plant and does not trip Rithmic's one-login
 * rule. It logs out immediately either way rather than holding the session.
 *
 *   node scripts/probe-history-plant.mjs
 */

const HISTORY_PLANT = 3;
const LOGIN_TIMEOUT_MS = 15_000;

const config = loadConfig();
const protocol = loadProtocol(config.protoDir);

if (!config.configured) {
  throw new Error("RITHMIC_USER and RITHMIC_PASSWORD must be set (operator.env).");
}

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function probe() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocket(config.url, {
      handshakeTimeout: LOGIN_TIMEOUT_MS,
      rejectUnauthorized: true,
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.terminate();
      reject(new Error("Timed out waiting for the History Plant login response."));
    }, LOGIN_TIMEOUT_MS);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.send(
          protocol.encode("RequestLogout", {
            templateId: TEMPLATE_IDS.LOGOUT_REQUEST,
            userMsg: ["kwantdesk-history-plant-probe"],
          }),
        );
      } catch {
        // Logging out is a courtesy; the close below ends the session anyway.
      }
      socket.close(1000, "probe complete");
      resolve(result);
    };

    socket.once("open", () => {
      log(`Connected to ${config.url}; logging in to ${config.systemName} as infraType ${HISTORY_PLANT}.`);
      socket.send(
        protocol.encode("RequestLogin", {
          templateId: TEMPLATE_IDS.LOGIN_REQUEST,
          templateVersion: "3.9",
          userMsg: ["kwantdesk-history-plant-probe"],
          user: config.user,
          password: config.password,
          appName: config.appName,
          appVersion: config.appVersion,
          systemName: config.systemName,
          infraType: HISTORY_PLANT,
        }),
      );
    });

    socket.on("message", (data) => {
      const decoded = protocol.decode(data);
      if (decoded.templateId !== TEMPLATE_IDS.LOGIN_RESPONSE) return;
      // The decoder nests the message under `payload`; reading the fields off
      // the envelope silently yields undefined and reads as a refusal.
      const body = decoded.payload ?? decoded;
      finish({
        raw: decoded,
        rpCode: body.rpCode ?? [],
        heartbeatInterval: body.heartbeatInterval ?? null,
        templateVersion: body.templateVersion ?? null,
      });
    });

    socket.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

const result = await probe();
const code = result.rpCode?.[0];

log(`Login response rp_code: ${JSON.stringify(result.rpCode)}`);
if (result.templateVersion) log(`Server template version: ${result.templateVersion}`);
if (result.heartbeatInterval != null) log(`Heartbeat interval: ${result.heartbeatInterval}s`);

if (result.rpCode.length === 0) {
  log("");
  log("INCONCLUSIVE — the login response carried no rp_code at all.");
  log("That is neither an acceptance nor a refusal. Full decoded response:");
  log(JSON.stringify(result.raw, null, 2));
  process.exit(2);
}

if (code === "0") {
  log("");
  log("ENTITLED — the History Plant accepted this credential.");
  log("Time bars, tick bars and volume-profile minute bars are available to this account.");
  log("Next step is the template-id values for the replay requests, from Rithmic's API doc.");
  process.exit(0);
}

log("");
log("NOT ENTITLED (or rejected) — the History Plant refused this login.");
log("A non-zero rp_code here usually means the plant is not on the subscription;");
log("Rithmic bills it separately from the ticker plant. Confirm with them before building on it.");
process.exit(1);
