import assert from "node:assert/strict";
import {
  DARK_POOL_OPTIONS_UNDERLYING_SOURCES,
  createMappingReceipt,
  defaultDarkPoolSource,
  isDirectDarkPoolSource,
  mapDarkPoolPrint,
} from "../src/lib/darkPoolMap.ts";

const expectedSources = {
  SPX: "SPY",
  SPY: "SPY",
  NDX: "QQQ",
  QQQ: "QQQ",
  IWM: "IWM",
  AAPL: "AAPL",
  NVDA: "NVDA",
  TSLA: "TSLA",
  MSFT: "MSFT",
  AMZN: "AMZN",
  META: "META",
  AMD: "AMD",
};

assert.deepEqual(DARK_POOL_OPTIONS_UNDERLYING_SOURCES, expectedSources);
for (const [display, source] of Object.entries(expectedSources)) {
  assert.equal(defaultDarkPoolSource(display), source, `${display} should resolve to ${source}`);
  assert.equal(isDirectDarkPoolSource(display), display === source, `${display} direct-source classification`);
}

assert.equal(defaultDarkPoolSource("NQU6"), "QQQ");
assert.equal(defaultDarkPoolSource("MESU6"), "SPY");

const direct = createMappingReceipt({ mode: "rolling-affine", direct: true, sourceMid: 732.5, displayMid: 732.5 });
assert.ok(direct);
assert.equal(direct.method, "direct");
assert.equal(direct.alpha, 0);
assert.equal(direct.beta, 1);

const indexMapping = createMappingReceipt({ mode: "live-ratio", direct: false, sourceMid: 732.5, displayMid: 30_080 });
assert.ok(indexMapping);
assert.equal(indexMapping.method, "live-ratio");
const mapped = mapDarkPoolPrint({
  id: "qqq-print",
  ticker: "QQQ",
  price: 733,
  size: 10_000,
  notionalValue: 7_330_000,
  printType: "DARK_POOL",
  tradeSide: "MID_MARKET",
  askPrice: null,
  askSize: null,
  bidPrice: null,
  bidSize: null,
  isDelayedPrint: false,
  tradeTimeMs: Date.now(),
}, "NDX", indexMapping);
assert.ok(mapped.mappedPrice > 30_000 && mapped.mappedPrice < 31_000, "QQQ print should map into NDX price space");

console.log("Dark Pool Map options-underlying coverage passed.");
