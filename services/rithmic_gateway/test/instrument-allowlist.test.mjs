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

test("an instrument outside the allowlist is refused, not subscribed", () => {
  const client = offlineClient();
  const sent = [];
  client.send = (name) => sent.push(name);

  assert.throws(
    () => client.subscribe("CME", "NQZ6"),
    (error) => error.code === "RITHMIC_INSTRUMENT_NOT_ALLOWED",
    "an unconfigured contract month must be refused",
  );
  assert.equal(client.subscriptions.has("CME:NQZ6"), false);
  assert.deepEqual(sent, [], "a refused instrument must not reach Rithmic");
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
    () => client.subscribe(" cme ", " nqz6 "),
    (error) => error.code === "RITHMIC_INSTRUMENT_NOT_ALLOWED",
  );
  // The configured set still normalizes to a hit.
  assert.equal(client.subscribe(" cme ", " nqu6 ").symbol, "NQU6");
});
