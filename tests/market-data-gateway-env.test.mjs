import assert from "node:assert/strict";
import test from "node:test";

import {
  marketDataGatewayEnvNames,
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataProvider,
} from "../src/lib/marketDataGatewayEnv.ts";

const KEYS = [
  "KWANTDESK_MARKET_DATA_GATEWAY_URL", "KWANTIFY_MARKET_DATA_GATEWAY_URL",
  "KWANTIFY_MARKET_GATEWAY_URL", "KWANTDESK_MARKET_GATEWAY_URL",
  "KWANTDESK_MARKET_DATA_GATEWAY_TOKEN", "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN",
  "KWANTIFY_MARKET_GATEWAY_TOKEN", "KWANTDESK_MARKET_GATEWAY_TOKEN",
  "KWANTDESK_MARKET_DATA_PROVIDER", "KWANTIFY_MARKET_DATA_PROVIDER",
  "KWANTIFY_DATA_PROVIDER", "KWANTDESK_DATA_PROVIDER",
];

function clear() {
  for (const key of KEYS) delete process.env[key];
}

test("the shortened names configured in Vercel resolve", () => {
  clear();
  process.env.KWANTIFY_MARKET_GATEWAY_URL = "https://feed.kwantdesk.com";
  process.env.KWANTIFY_MARKET_GATEWAY_TOKEN = "token-abc";
  process.env.KWANTIFY_DATA_PROVIDER = "Rithmic";

  assert.equal(marketDataGatewayUrl(), "https://feed.kwantdesk.com");
  assert.equal(marketDataGatewayToken(), "token-abc");
  assert.equal(marketDataProvider(), "Rithmic");
  clear();
});

test("the original names still resolve, so nothing already deployed breaks", () => {
  clear();
  process.env.KWANTIFY_MARKET_DATA_GATEWAY_URL = "https://old.example.com";
  process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN = "old-token";
  process.env.KWANTIFY_MARKET_DATA_PROVIDER = "Databento";

  assert.equal(marketDataGatewayUrl(), "https://old.example.com");
  assert.equal(marketDataGatewayToken(), "old-token");
  assert.equal(marketDataProvider(), "Databento");
  clear();
});

test("a trailing slash on the origin is stripped so paths do not double up", () => {
  clear();
  process.env.KWANTIFY_MARKET_GATEWAY_URL = "https://feed.kwantdesk.com///";
  assert.equal(marketDataGatewayUrl(), "https://feed.kwantdesk.com");
  clear();
});

test("an empty or whitespace value is treated as unset, not as a value", () => {
  clear();
  process.env.KWANTDESK_MARKET_DATA_GATEWAY_URL = "   ";
  process.env.KWANTIFY_MARKET_GATEWAY_URL = "https://feed.kwantdesk.com";
  assert.equal(
    marketDataGatewayUrl(),
    "https://feed.kwantdesk.com",
    "a blank higher-precedence variable must not shadow a real one",
  );
  clear();
});

// The production incident: a stale localhost URL under the higher-precedence
// legacy name shadowed the real collector URL added later under a new name.
// Every proxy fetch hit 127.0.0.1 inside Vercel, failed, and the charts sat
// on the APPROX fallback with no error anywhere.
test("on Vercel, a stale loopback URL cannot shadow the real collector", () => {
  clear();
  const hadVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  process.env.KWANTIFY_MARKET_DATA_GATEWAY_URL = "http://127.0.0.1:8793";
  process.env.KWANTIFY_MARKET_GATEWAY_URL = "https://feed.kwantdesk.com";

  assert.equal(marketDataGatewayUrl(), "https://feed.kwantdesk.com");

  // Nothing reachable configured at all -> honest empty, not the loopback.
  delete process.env.KWANTIFY_MARKET_GATEWAY_URL;
  assert.equal(marketDataGatewayUrl(), "");

  if (hadVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = hadVercel;
  clear();
});

test("off Vercel, loopback URLs still work for local development", () => {
  clear();
  const hadVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  process.env.KWANTIFY_MARKET_DATA_GATEWAY_URL = "http://127.0.0.1:8793";

  assert.equal(marketDataGatewayUrl(), "http://127.0.0.1:8793");

  if (hadVercel !== undefined) process.env.VERCEL = hadVercel;
  clear();
});

test("provider defaults to Rithmic when nothing is set", () => {
  clear();
  assert.equal(marketDataProvider(), "Rithmic");
  assert.equal(marketDataGatewayUrl(), "");
  assert.equal(marketDataGatewayToken(), "");
  clear();
});

test("diagnostics report which variable name was actually used", () => {
  clear();
  process.env.KWANTIFY_MARKET_GATEWAY_TOKEN = "token-abc";
  const names = marketDataGatewayEnvNames();
  assert.equal(names.token, "KWANTIFY_MARKET_GATEWAY_TOKEN");
  assert.equal(names.url, null, "an unset variable reports null rather than guessing");
  assert.ok(names.accepted.token.includes("KWANTDESK_MARKET_DATA_GATEWAY_TOKEN"));
  clear();
});
