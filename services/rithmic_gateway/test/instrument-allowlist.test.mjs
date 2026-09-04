import assert from "node:assert/strict";
import test from "node:test";

import { RithmicMarketDataClient } from "../src/rithmic-client.mjs";
import { loadConfig } from "../src/config.mjs";

// A collector that is not connected still answers subscribe() from its local
// state, which is exactly the path every website read takes.
function offlineClient(env) {
  const config = loadConfig({
    RITHMIC_SOURCE_MODE: "protocol",
    RITHMIC_PROTO_DIR: new URL("../vendor/proto", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    RITHMIC_USER: "unused",
    RITHMIC_PASSWORD: "unused",
    RITHMIC_SUBSCRIPTIONS: "CME:MNQU6,CME:NQU6,CME:ESU6,CME:MESU6",
    ...env,
  });
  return new RithmicMarketDataClient(config);
}

test("configured instruments resolve without transmitting upstream", () => {
  const client = offlineClient();
  const sent = [];
  client.send = (name) => sent.push(name);

  for (const symbol of ["MNQU6", "NQU6", "ESU6", "MESU6"]) {
    const row = client.subscribe("CME", symbol);
    assert.equal(row.symbol, symbol);
  }
  // Repeated reads must never produce a Rithmic request.
  for (let i = 0; i < 50; i += 1) client.subscribe("CME", "NQU6");
  assert.deepEqual(sent, [], "reads must not transmit to Rithmic");
});

test("a configured contract permits only its own rollover family", () => {
  const client = offlineClient();
  const sent = [];
  client.send = (name) => sent.push(name);

  assert.equal(client.subscribe("CME", "NQZ6").symbol, "NQZ6");
  assert.throws(
    () => client.subscribe("CME", "NGU6"),
    (error) => error.code === "RITHMIC_INSTRUMENT_NOT_ALLOWED",
    "an unrelated product must remain refused",
  );
  assert.equal(client.subscriptions.has("CME:NGU6"), false);
});

test("the allowlist can be widened deliberately", () => {
  const client = offlineClient({
    RITHMIC_ALLOWED_INSTRUMENTS: "CME:MNQU6,CME:NQU6,CME:ESU6,CME:MESU6,CME:NQZ6",
  });
  const row = client.subscribe("CME", "NQZ6");
  assert.equal(row.symbol, "NQZ6");
});

test("an allowed product root permits the active contract without allowing unrelated products", () => {
  const client = offlineClient({
    RITHMIC_ALLOWED_ROOTS: "NYMEX:CL,COMEX:GC",
  });
  assert.equal(client.subscribe("NYMEX", "CLQ6").symbol, "CLQ6");
  assert.equal(client.subscribe("COMEX", "GCZ6").symbol, "GCZ6");
  assert.throws(
    () => client.subscribe("NYMEX", "NGQ6"),
    (error) => error.code === "RITHMIC_INSTRUMENT_NOT_ALLOWED",
  );
});

test("case and whitespace do not bypass the allowlist", () => {
  const client = offlineClient();
  assert.throws(
    () => client.subscribe(" cme ", " ngu6 "),
    (error) => error.code === "RITHMIC_INSTRUMENT_NOT_ALLOWED",
  );
  // The configured set still normalizes to a hit.
  assert.equal(client.subscribe(" cme ", " nqu6 ").symbol, "NQU6");
});

test("front-month resolution asks Rithmic even while the expiring contract is live", async () => {
  const client = offlineClient({ RITHMIC_ALLOWED_ROOTS: "CME:NQ" });
  client.book.ensure("CME", "NQU6").asOfMs = Date.now();
  client.socket = { readyState: 1 };
  const sent = [];
  client.send = (name, payload) => {
    sent.push({ name, payload });
    setImmediate(() => {
      const requestId = payload.userMsg[0];
      const pending = client.pendingFrontMonthRequests.get(requestId);
      clearTimeout(pending.timeout);
      client.pendingFrontMonthRequests.delete(requestId);
      const resolved = {
        exchange: "CME", root: "NQ", contractSymbol: "NQZ6",
        resolvedAt: Date.now(), source: "rithmic-front-month",
      };
      client.frontMonthCache.set("CME:NQ", resolved);
      pending.resolve(resolved);
    });
  };

  const [first, second] = await Promise.all([
    client.resolveFrontMonth("CME", "NQ"),
    client.resolveFrontMonth("CME", "NQ"),
  ]);
  assert.equal(first.contractSymbol, "NQZ6");
  assert.equal(second.contractSymbol, "NQZ6");
  assert.equal(sent.length, 1, "simultaneous users opened duplicate provider requests");
  assert.equal(sent[0].name, "RequestFrontMonthContract");
  assert.equal(sent[0].payload.templateId, 113);
  assert.equal(sent[0].payload.needUpdates, true);
});

test("front-month fallback refuses an undated root subscription", async () => {
  const client = offlineClient({
    RITHMIC_SUBSCRIPTIONS: "CME:MNQ",
    RITHMIC_ALLOWED_ROOTS: "CME:MNQ",
  });
  client.book.ensure("CME", "MNQ").asOfMs = Date.now();

  await assert.rejects(
    client.resolveFrontMonth("CME", "MNQ", 5),
    /not connected/u,
  );
});

test("a provider response replaces the expiring configured subscription", async () => {
  const client = offlineClient();
  client.socket = { readyState: 1 };
  const sent = [];
  client.send = (name, payload) => {
    sent.push({ name, payload });
    if (name !== "RequestFrontMonthContract") return;
    setImmediate(() => {
      client.handleMessage(client.protocol.encode("ResponseFrontMonthContract", {
        templateId: 114,
        userMsg: [payload.userMsg[0]],
        rpCode: ["0"],
        symbol: "NQ",
        exchange: "CME",
        isFrontMonthSymbol: true,
        tradingSymbol: "NQZ6",
        tradingExchange: "CME",
      }));
    });
  };

  const resolved = await client.resolveFrontMonth("CME", "NQ");
  assert.equal(resolved.contractSymbol, "NQZ6");
  assert.equal(client.subscriptions.has("CME:NQZ6"), true);
  assert.equal(client.subscriptions.has("CME:NQU6"), false);
  assert.ok(sent.some((row) => row.name === "RequestMarketDataUpdate" && row.payload.symbol === "NQZ6"));
  assert.ok(sent.some((row) => row.name === "RequestMarketDataUpdate" && row.payload.symbol === "NQU6" && row.payload.request === 2));
});
