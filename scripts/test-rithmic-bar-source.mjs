import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bars = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");
const server = readFileSync(
  new URL("../services/rithmic_gateway/src/server.mjs", import.meta.url), "utf8",
);

/**
 * Chart history comes from the desk's own recording, not from a subscription.
 *
 * Bars were bought per request from Databento. That account now answers 402
 * "insufficient budget", and because the busiest window of the day is the most
 * expensive request, the US cash session was exactly the part that stopped
 * being served: charts drew a live right-hand edge with a hole through the
 * middle of the day. Every print was already being recorded on the collector
 * the whole time.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// databento.ts pulls in server-only modules, so the helper is lifted out and
// executed here rather than imported.
const contractRootSymbol = (() => {
  const open = "export function contractRootSymbol(symbol: string) {";
  const start = bars.indexOf(open);
  if (start < 0) throw new Error("contractRootSymbol is gone");
  const close = String.fromCharCode(10) + "}";
  const end = bars.indexOf(close, start);
  const body = bars.slice(start + open.length, end).replace(/: string/g, "");
  return new Function("symbol", body);
})();

check("the gateway serves history from its own recording", () => {
  assert.match(server, /const chartHistory = new FuturesBarArchive\(\{/);
  assert.match(server, /chartHistory\.attach\(client\);/, "the archive is not fed by the live stream");
  assert.match(server, /chartHistory\.restore\(\)/, "a restart would start the day with an empty chart");
  assert.ok(
    !/new DatabentoHistoryService\(/.test(server),
    "the gateway still constructs the vendor history service",
  );
});

check("the website asks the gateway, not the vendor", () => {
  assert.match(
    bars,
    /await fetchInstitutionalMarketData\(`\/v1\/market-data\/history\?\$\{query\}`\)/,
    "bars are no longer fetched from the collector",
  );
  // The time-bar request was the only place that asked the vendor for an
  // ohlcv schema. Its absence is what proves the swap.
  assert.ok(
    !/schema: sourceSchema\(timeframe\),/.test(bars),
    "the time-bar path still issues a vendor timeseries request",
  );
});

check("event bars use the complete paged Rithmic tape", () => {
  /*
   * There must be one builder. The removed inline copy clipped the requested
   * window to six hours and hard-coded CME, so 40R and non-CME contracts had
   * short or empty histories even while the archive held the prints.
   */
  const eventBranch = bars.slice(
    bars.indexOf("if (isEventBasedChartInterval(timeframe))"),
    bars.indexOf("export async function getDatabentoOrderFlowHistory"),
  );
  assert.match(eventBranch, /await fetchRecordedTrades\(/);
  assert.match(eventBranch, /applyMarketTradesToEventBars\(\[\], trades, timeframe, symbol, 120_000\)/);
  assert.doesNotMatch(eventBranch, /6 \* 60 \* 60_000/);
  assert.doesNotMatch(eventBranch, /exchange: "CME"/);
});

check("an unavailable history is reported, never silently empty", () => {
  /*
   * A chart with a hole in it read as missing market activity rather than a
   * failed request, which is how this went unnoticed. It has to fail loudly.
   */
  assert.match(bars, /throw new Error\(`Chart history is unavailable \(\$\{response\.status\}\)/);
});

check("continuous roots resolve to the book the collector holds", () => {
  assert.equal(contractRootSymbol("NQ.c.0"), "NQ");
  assert.equal(contractRootSymbol("ES.c.0"), "ES");
  // Volume and tick roots name the same book.
  assert.equal(contractRootSymbol("NQ.v.0"), "NQ");
  assert.equal(contractRootSymbol("NQ.n.0"), "NQ");
  // An explicit contract still reduces to its root.
  assert.equal(contractRootSymbol("NQU6"), "NQ");
  assert.equal(contractRootSymbol("ESU6"), "ES");
  // A plain root is already the answer.
  assert.equal(contractRootSymbol("NQ"), "NQ");
  assert.equal(contractRootSymbol(""), "");
});

check("the requested window is passed through", () => {
  assert.match(bars, /query\.set\("fromMs", String\(requestedFrom\)\)/);
  assert.match(bars, /query\.set\("toMs", String\(requestedTo\)\)/);
  assert.match(bars, /interval: timeframe,/);
});

console.log(`\nrithmic bar source: ${passed}/${passed} checks passed`);
