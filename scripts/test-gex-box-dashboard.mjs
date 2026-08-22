import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/gex-interval-map/route.ts", import.meta.url), "utf8");
const toolRoute = readFileSync(new URL("../src/app/api/gex-box/tool/route.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");
const audit = readFileSync(new URL("../docs/gex-box/QUANTDATA_RECONSTRUCTION_AUDIT.md", import.meta.url), "utf8");

for (const tool of [
  "Consolidated Order Flow", "Contract Side Statistics", "Exposure by Expiration",
  "Exposure by Strike", "Heat Map", "IV Rank", "Interval Map", "Max Pain",
  "Net Flow", "OI by Strike", "Term Structure", "Dark Pool Levels",
  "Equity Prints", "Stock Price / Time", "Market Map", "Volatility Drift",
]) assert.ok(dashboard.includes(tool), `Missing registered dashboard tool: ${tool}`);

for (const capability of [
  "kwantdesk:gex-box:dashboard:v2", "Export workspace", "Import workspace",
  "Reset to standard", "Infinite", "Duplicate Tab", "shared VPS feeds",
]) assert.ok(dashboard.includes(capability), `Missing dashboard capability: ${capability}`);

assert.ok(dashboard.includes("feedSubscribers") && dashboard.includes("feedTimers"), "Dashboard must share requests and polling timers across duplicate panels.");
assert.ok(dashboard.includes("memo(function ToolSurface") && dashboard.includes("memo(function DashboardPanelView"), "Unchanged GEX BOX panels must not rerender when another panel changes.");
assert.ok(dashboard.includes("collectRows(value: unknown, maxRows = 200)"), "Generic panel normalization must cap payload traversal.");
assert.ok(dashboard.includes("new Map<number, number>()") && !dashboard.includes("all.findIndex"), "Interval price-path normalization must remain linear rather than quadratic.");
assert.ok(dashboard.includes("5 * 60_000") && dashboard.includes("payload?.marketOpen === false"), "Completed snapshots must not poll at live-session cadence.");
assert.ok(dashboard.includes('panel.toolId === "dark-pool-levels"') && dashboard.includes("<DarkPoolLevelsPanel"), "Dark Pool Levels must use its dedicated visualization instead of the generic table.");
assert.ok(dashboard.includes('panel.toolId === "equity-prints"') && dashboard.includes("<EquityPrintsPanel"), "Equity Prints must use its dedicated tape visualization.");
assert.ok(dashboard.includes('url.includes("/api/dark-pool-map")') && dashboard.includes("return 5_000"), "Dark-pool panels must refresh at the live dashboard cadence.");
assert.ok(!dashboard.includes("Adapter pending"), "The Add Tool catalogue must not advertise unfinished adapters.");
assert.ok(!dashboard.includes('"News" |') && !dashboard.includes('["Options", "Equities", "News"'), "Empty or unsupported catalogue categories must not be exposed.");
assert.ok(dashboard.includes('for (const key of ["rows", "snapshots", "candles", "trades", "board", "data"])'), "Normalized row arrays must take priority over response metadata.");
assert.ok(!/https?:\/\//.test(dashboard), "Browser dashboard must only use authenticated same-origin API routes.");
assert.match(route, /GEX.*GAMMA/);
assert.match(route, /DEX.*DELTA/);
assert.match(route, /VEX.*VANNA/);
assert.match(route, /CHEX.*CHARM/);
assert.match(toolRoute, /mode: tool === "unconsolidated-flow" \? "RAW" : "CONSOLIDATED"/);
assert.ok(toolRoute.includes("detailModeForTool(tool)") && !toolRoute.includes('sessionDate, "FULL"'), "Small GEX BOX panels must not rebuild the full options payload.");
assert.ok(toolRoute.includes('tool === "volatility-drift"') && server.includes('/options/tool/volatility-drift'), "Volatility Drift must use its authoritative server adapter.");
assert.ok(audit.includes("Production tool catalogue"), "Reconstruction audit is incomplete.");
assert.ok(audit.includes("credentials are never exported"), "Audit must preserve the server-only credential boundary.");

console.log("GEX BOX dashboard architecture checks passed.");
