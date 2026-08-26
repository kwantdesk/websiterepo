import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The order-flow response must not ship the raw tape twice.
 *
 * Measured against production: two hours of NQ 3m came back as 6.1 MB —
 * 42 candles, 12,044 `records`, and 12,044 `trades` that were the same rows
 * mapped a second time. The chart only wants the candles; the rest is a few
 * kilobytes of signal wrapped in six megabytes of duplicate tape.
 *
 * Every caller in the product sends includeTrades=false and always has. The
 * gateway never read the parameter — `includeTrades` appeared nowhere in the
 * server — so the flag was answered with the largest possible response. The
 * browser then JSON.parsed 6 MB and normalised both copies on the main thread,
 * per pane, on load and on every four-minute heal cycle.
 */

const server = readFileSync(new URL("../src/server.mjs", import.meta.url), "utf8");

// The order-flow-levels handler, isolated so these checks cannot accidentally
// pass on some other route that happens to mention trades.
const handler = server.slice(
  server.indexOf('url.pathname === "/v1/market-data/order-flow-levels"'),
  server.indexOf('url.pathname === "/v1/market-data/volume-profile"'),
);

test("the handler exists and was found", () => {
  assert.ok(handler.length > 0 && handler.length < 6_000, `handler slice looks wrong: ${handler.length} chars`);
});

test("includeTrades is actually read", () => {
  assert.match(handler, /const includeTrades = String\(url\.searchParams\.get\("includeTrades"\)/);
});

test("the tape is mapped once, not twice", () => {
  // THE BUG: `records:` and `trades:` were two independent maps over the same
  // source, doubling both the CPU on the box and the bytes on the wire.
  const maps = handler.match(/trades\.map\(normalizedTradeRecord\)/g) ?? [];
  assert.equal(maps.length, 1, `the tape must be mapped exactly once, found ${maps.length}`);
  assert.match(handler, /const normalizedTrades = trades\.map\(normalizedTradeRecord\);/);
  assert.match(handler, /records: normalizedTrades,/);
});

test("trades are omitted unless asked for", () => {
  assert.match(handler, /\.\.\.\(includeTrades \? \{ trades: normalizedTrades \} : \{\}\)/);
  // And when they ARE asked for they must be the same array, not a second map.
  assert.doesNotMatch(handler, /trades: trades\.map\(/);
});

test("candles are always served - they are what the chart came for", () => {
  // The whole point of trimming the response is that the small, useful part
  // must survive. CVD skips any bar without aggressor volume, so losing these
  // would turn a bandwidth fix into a data outage.
  assert.match(handler, /candles: eventBased/);
  assert.match(handler, /compactFlowCandles/);
});

test("the client does not walk the tape a second time either", () => {
  const client = readFileSync(new URL("../../../src/lib/institutionalMarketData.ts", import.meta.url), "utf8");
  assert.match(
    client,
    /const trades = args\.includeTrades\s*\n\s*\? normalizeInstitutionalTradeRecords\(payload\.trades\)\s*\n\s*: records;/,
    "when trades were not requested the normalised records must stand in by reference",
  );
});
