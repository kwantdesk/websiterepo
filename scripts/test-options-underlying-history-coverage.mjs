import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const optionsSource = readFileSync(new URL("../src/lib/optionsFlow.ts", import.meta.url), "utf8");
const archiverSource = readFileSync(new URL("../services/rithmic_gateway/src/cash-index-archiver.mjs", import.meta.url), "utf8");
const historySource = readFileSync(new URL("../services/rithmic_gateway/src/quantdata-market-history.mjs", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../services/rithmic_gateway/src/server.mjs", import.meta.url), "utf8");
const backfillSource = readFileSync(new URL("../services/rithmic_gateway/scripts/backfill-cash-index-history.mjs", import.meta.url), "utf8");

function quotedValues(source, startPattern) {
  const start = source.indexOf(startPattern);
  assert.notEqual(start, -1, `${startPattern} was not found`);
  const terminator = startPattern.includes("Object.freeze") ? "]);" : "];";
  const end = source.indexOf(terminator, start);
  assert.notEqual(end, -1, `${startPattern} was not terminated`);
  return [...source.slice(start, end).matchAll(/"([A-Z][A-Z0-9]*)"/g)].map((match) => match[1]);
}

const optionTickers = quotedValues(optionsSource, "export const OPTIONS_FLOW_TICKERS = [");
const archiveTickers = quotedValues(archiverSource, "export const DEFAULT_CASH_INDEX_TICKERS = Object.freeze([");
const expectedPhysicalTickers = [...new Set(optionTickers.map((ticker) => ticker === "SPXW" ? "SPX" : ticker))];

assert.deepEqual(
  [...archiveTickers].sort(),
  [...expectedPhysicalTickers, "VIX"].sort(),
  "the permanent underlying archive must cover every options ticker plus VIX",
);
for (const ticker of [...optionTickers, "VIX"]) {
  assert.match(historySource, new RegExp(`"${ticker}"`), `${ticker} is archived but cannot be served to charts`);
}
assert.match(serverSource, /indexSymbols: \["SPX", "NDX", "VIX"\]/, "VIX is missing from the shared live QuantData index poller");
assert.match(backfillSource, /CASH_INDEX_HISTORY_FROM \|\| "2025-01-01"/, "the backfill floor moved later than January 2025");
assert.match(backfillSource, /isCashSessionOpen\(\)/, "bulk history is not blocked during the live US session");

console.log(`options-underlying history: ${optionTickers.length} offered tickers map to ${expectedPhysicalTickers.length} provider roots; VIX is included separately`);
