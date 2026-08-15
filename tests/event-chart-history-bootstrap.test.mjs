import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const route = await fs.readFile(
  new URL("../src/app/api/databento/market/route.ts", import.meta.url),
  "utf8",
);
const eventHistory = await fs.readFile(
  new URL("../src/lib/databentoEventHistory.server.ts", import.meta.url),
  "utf8",
);
const workspace = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const edge = await fs.readFile(
  new URL("../services/rithmic_gateway/src/vendor-data-edge.mjs", import.meta.url),
  "utf8",
);

test("range and volume charts reuse durable base event history", () => {
  assert.match(route, /getDurableEventBars/);
  assert.match(route, /\["cme-event-bars-v2", symbol, timeframe/);
  assert.match(route, /await durableEventBarsOrDirect\(/);
});

test("a single forming event candle never masquerades as restored history", () => {
  assert.match(
    workspace,
    /const hasImmediateHistory = immediateHistoryForPeriod\.length > \([\s\S]*?isEventBasedChartInterval\(pane\.timeframe\) \? 1 : 0/,
  );
});

test("the VPS keeps only explicitly identified event archives warm", () => {
  assert.match(eventHistory, /"X-KwantDesk-Event-History": "1"/);
  assert.match(edge, /EVENT_HISTORY_DATABENTO_CACHE_MS = 5 \* 60_000/);
  assert.match(edge, /request\.headers\["x-kwantdesk-event-history"\] === "1"/);
});
