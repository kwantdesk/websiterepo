import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/gex-interval-map/route.ts", import.meta.url), "utf8");
const audit = readFileSync(new URL("../docs/gex-box/QUANTDATA_RECONSTRUCTION_AUDIT.md", import.meta.url), "utf8");

for (const tool of [
  "Consolidated Order Flow", "Contract Price / Time", "Exposure by Expiration",
  "Exposure by Strike", "Heat Map", "IV Rank", "Interval Map", "Max Pain",
  "Net Flow", "OI by Strike", "Term Structure", "Dark Pool Levels",
  "Equity Prints", "Stock Price / Time", "News Feed",
]) assert.ok(dashboard.includes(tool), `Missing registered dashboard tool: ${tool}`);

for (const capability of [
  "kwantdesk:gex-box:dashboard:v2", "Export workspace", "Import workspace",
  "Reset to standard", "Infinite", "Duplicate Tab", "shared VPS feeds",
]) assert.ok(dashboard.includes(capability), `Missing dashboard capability: ${capability}`);

assert.ok(dashboard.includes("feedSubscribers") && dashboard.includes("feedTimers"), "Dashboard must share requests and polling timers across duplicate panels.");
assert.ok(dashboard.includes('panel.toolId === "dark-pool-levels"') && dashboard.includes("<DarkPoolLevelsPanel"), "Dark Pool Levels must use its dedicated visualization instead of the generic table.");
assert.ok(dashboard.includes('panel.toolId === "equity-prints"') && dashboard.includes("<EquityPrintsPanel"), "Equity Prints must use its dedicated tape visualization.");
assert.ok(dashboard.includes('url.includes("/api/dark-pool-map")') && dashboard.includes("return 5_000"), "Dark-pool panels must refresh at the live dashboard cadence.");
assert.ok(dashboard.includes("disabled={!tool.endpoint}") && dashboard.includes("Adapter pending"), "Unwired catalogue entries must not masquerade as working tools.");
assert.ok(!/https?:\/\//.test(dashboard), "Browser dashboard must only use authenticated same-origin API routes.");
assert.match(route, /GEX.*GAMMA/);
assert.match(route, /DEX.*DELTA/);
assert.match(route, /VEX.*VANNA/);
assert.match(route, /CHEX.*CHARM/);
assert.ok(audit.includes("Complete tool catalogue"), "Reconstruction audit is incomplete.");
assert.ok(audit.includes("credentials are never exported"), "Audit must preserve the server-only credential boundary.");

console.log("GEX BOX dashboard architecture checks passed.");
