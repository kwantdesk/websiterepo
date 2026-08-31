import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveGexFlowContractRatios } from "../src/lib/gexFlow.ts";
import { OPTIONS_FLOW_INSTRUMENTS } from "../src/lib/optionsFlow.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/gex-flow-authoritative.json",
  import.meta.url,
), "utf8"));
const workspace = readFileSync(new URL("../src/components/gex-flow/GexFlowWorkspace.tsx", import.meta.url), "utf8");

assert.deepEqual(["ALL", ...OPTIONS_FLOW_INSTRUMENTS.map((item) => item.symbol)], fixture.symbols);
for (const id of fixture.screenIds) assert.match(workspace, new RegExp(`id: ["']${id}["']`), `missing browser screen ${id}`);
for (const column of fixture.columns) assert.match(workspace, new RegExp(`(?:^|[,{\\s])${column}: ["']`), `missing browser column ${column}`);
assert.match(workspace, /Public prints do not establish participant identity or legal intent\./);

const ratios = deriveGexFlowContractRatios([
  { osi: "SPXW", ticker: "SPX", expirationDate: "2026-08-20", strikePrice: 6500, contractType: "CALL", side: "BID", size: 340 },
  { osi: "SPXW", ticker: "SPX", expirationDate: "2026-08-20", strikePrice: 6500, contractType: "CALL", side: "MID", size: 40 },
  { osi: "SPXW", ticker: "SPX", expirationDate: "2026-08-20", strikePrice: 6500, contractType: "CALL", side: "ASK", size: 620 },
]);
assert.deepEqual(ratios.get("SPXW"), fixture.ratio);

console.log("GEX FLOW native/browser authority fixture passed.");
