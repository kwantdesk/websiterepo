import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CHART_INTERVAL_OPTIONS,
  getChartInterval,
  supportsChartInterval,
} from "../src/lib/chartIntervals.ts";
import { futuresVenue } from "../src/lib/futuresVenue.ts";

const catalogSource = readFileSync(
  new URL("../src/lib/databento.ts", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../src/app/api/databento/market/route.ts", import.meta.url),
  "utf8",
);
const catalogBlock = catalogSource.slice(
  catalogSource.indexOf("export const DATABENTO_FUTURES"),
  catalogSource.indexOf("export const DATABENTO_DEFAULT_SYMBOLS"),
);
const advertisedFutures = [...catalogBlock.matchAll(
  /\{ symbol: "([^"]+)", label: "[^"]+", venue: "(CME|CBOT|NYMEX|COMEX)"/g,
)].map((match) => ({ symbol: match[1], venue: match[2] }));
const engine = readFileSync(
  new URL("../src/lib/executionTapeEngine.ts", import.meta.url),
  "utf8",
);
const chart = readFileSync(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);
const dom = readFileSync(
  new URL("../src/components/DepthOfMarketPanel.tsx", import.meta.url),
  "utf8",
);
const eventHistory = readFileSync(
  new URL("../src/lib/databentoEventHistory.server.ts", import.meta.url),
  "utf8",
);

let passed = 0;
const check = (name, test) => {
  test();
  passed += 1;
  console.log(`  ok  ${name}`);
};

check("CME history has no retired Databento credential gate", () => {
  assert.doesNotMatch(route, /vendorMarketDataConfigured\("databento"\)/);
  assert.doesNotMatch(route, /CME market data is not configured/);
  assert.match(route, /RECORDED_DATASET = "Rithmic History Plant \+ recorded trade tape"/);
});

check("every advertised futures interval is routed to Rithmic", () => {
  assert.equal(CHART_INTERVAL_OPTIONS.length, 50);
  for (const instrument of advertisedFutures) {
    for (const interval of CHART_INTERVAL_OPTIONS) {
      assert.ok(
        supportsChartInterval(interval.id, "Databento"),
        `${instrument.symbol} ${interval.id} is exposed but not routable`,
      );
      assert.ok(getChartInterval(interval.id), `${interval.id} cannot be parsed`);
    }
  }
});

check("live executions use each product's actual CME Group venue", () => {
  const expected = new Map([
    ["ES.v.0", "CME"],
    ["YM.v.0", "CBOT"],
    ["CL.v.0", "NYMEX"],
    ["GC.v.0", "COMEX"],
  ]);
  for (const [symbol, venue] of expected) assert.equal(futuresVenue(symbol), venue);
  assert.match(engine, /exchange: futuresVenue\(symbol\)/);
  assert.doesNotMatch(engine, /exchange: "CME"/);
});

check("all 53 advertised futures roots have a deterministic venue", () => {
  assert.equal(advertisedFutures.length, 53);
  for (const instrument of advertisedFutures) {
    assert.equal(
      futuresVenue(instrument.symbol),
      instrument.venue,
      `${instrument.symbol} routes to the wrong exchange`,
    );
  }
});

check("chart liquidity and DOM streams are not pinned to CME", () => {
  assert.doesNotMatch(chart, /exchange: "CME"/);
  assert.doesNotMatch(dom, /exchange: "CME"/);
  assert.equal(
    (chart.match(/exchange: futuresVenue\(root\)/g) ?? []).length,
    5,
    "every chart liquidity subscriber must resolve its venue",
  );
  assert.match(dom, /exchange: futuresVenue\(instrument\)/);
});

check("dense range history cannot self-truncate below five sessions", () => {
  assert.match(eventHistory, /const MAX_EVENT_BARS = 250_000;/);
});

console.log(`\nCME interval routing: ${passed}/${passed} checks passed (${advertisedFutures.length * CHART_INTERVAL_OPTIONS.length} instrument/interval combinations)`);
