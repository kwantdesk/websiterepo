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
