import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RithmicMarketDataClient } from "../src/rithmic-client.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function testConfig() {
  return {
    configured: true,
    user: "test-user",
    password: "test-password",
    systemName: "Rithmic Paper Trading",
    url: "wss://example.invalid",
    protoDir: path.resolve(HERE, "../vendor/proto"),
    appName: "kwantdesk-test",
    appVersion: "1",
    maxTrades: 10,
    reconnectMinMs: 1,
    reconnectMaxMs: 1,
    subscriptions: [],
    allowedInstruments: [],
    allowedRoots: [],
  };
}

test("system discovery is retried and reconnects when a maintained environment returns", async () => {
  const client = new RithmicMarketDataClient(testConfig());
  client.on("gatewayError", () => {});

  let discoveryAttempts = 0;
  let connectionAttempts = 0;
  client.discoverSystems = async () => {
    discoveryAttempts += 1;
    return discoveryAttempts === 1 ? ["Tradeify"] : ["Rithmic Paper Trading"];
  };
  client.connect = async () => {
    connectionAttempts += 1;
    client.status.connected = true;
    client.status.authenticated = true;
  };

  await assert.rejects(
    client.start(),
    /Configured Rithmic system "Rithmic Paper Trading" was not returned/,
  );

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.ok(discoveryAttempts >= 2, "the reconnect timer must repeat system discovery");
  assert.equal(connectionAttempts, 1);
  assert.equal(client.status.connected, true);
  assert.equal(client.status.authenticated, true);
  await client.stop();
});
