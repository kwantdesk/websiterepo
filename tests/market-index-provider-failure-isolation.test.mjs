import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vendorTransport = readFileSync(
  new URL("../src/lib/vendorMarketData.server.ts", import.meta.url),
  "utf8",
);
const marketIndices = readFileSync(
  new URL("../src/lib/marketIndices.server.ts", import.meta.url),
  "utf8",
);

test("vendor circuit breakers are isolated by provider", () => {
  assert.match(vendorTransport, /const breakerKey = `\$\{origin\}::vendor:\$\{provider\}`/);
  assert.match(vendorTransport, /originIsCoolingDown\(breakerKey\)/);
  assert.match(vendorTransport, /recordOriginSuccess\(breakerKey\)/);
  assert.match(vendorTransport, /recordOriginFailure\(breakerKey, true\)/);
});

test("options-underlying history cannot fall through to optional Massive", () => {
  const preference = marketIndices.indexOf("if (canUseKwantDataHistory)");
  const branchEnd = marketIndices.indexOf("\n  if (!vendorMarketDataConfigured", preference);
  const optionsBranch = marketIndices.slice(preference, branchEnd);

  assert.ok(preference >= 0 && branchEnd > preference);
  assert.match(optionsBranch, /await getOptionsUnderlyingHistory\(options\)/);
  assert.doesNotMatch(optionsBranch, /vendorMarketDataConfigured\("massive"\)/);
});
