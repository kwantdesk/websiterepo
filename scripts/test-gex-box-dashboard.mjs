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
assert.ok(dashboard.includes("function OrderFlowPanel") && dashboard.includes('label: "Premium"') && dashboard.includes('label: "Side"') && dashboard.includes('label: "Sentiment"') && dashboard.includes('label: "Exchange"') && dashboard.includes('label: "Trade type"'), "Order Flow must render QuantData premium, side, sentiment, exchange and trade-type fields.");
assert.ok(dashboard.includes('label="Sentiment"') && dashboard.includes('label="Exchange"') && dashboard.includes('label="Expiry"') && dashboard.includes('label="Flags"') && dashboard.includes('label="Columns"') && dashboard.includes('label="Group"'), "Order Flow must expose its professional filter controls.");
assert.ok(dashboard.includes('label: "Spread"') && dashboard.includes('label: "Moneyness"') && dashboard.includes('label: "Δ / Γ / Θ / V"') && dashboard.includes('label: "Flags"'), "Order Flow must expose execution, contract, Greeks and classification detail.");
assert.ok(dashboard.includes('flowColumns: "full"') && dashboard.includes('flowGrouping: "none"') && dashboard.includes('flowFlags: "ALL"'), "Order Flow display presets must remain backward-compatible with stored workspaces.");
assert.ok(dashboard.includes("function ProfessionalIntervalMap") && dashboard.includes('"horizontal-ribbons"') && dashboard.includes('"call-put-split"'), "Interval Map must support the audited QuantData visual and content modes.");
assert.ok(dashboard.includes("intervalMaximumDistance") && dashboard.includes('aria-label="Interval map visible range"') && dashboard.includes('exposureSide: "call"'), "Interval Map must expose strike-distance, navigation and true call/put split controls.");
assert.ok(dashboard.includes("TOOL_SERIES[panel.toolId]") && dashboard.includes("<SeriesPanel"), "Time-series tools must route to their chart renderer.");
assert.ok(dashboard.includes('panel.toolId === "market-map"') && dashboard.includes("<MarketMapPanel"), "Market Map must use its dedicated cross-symbol renderer.");
for (const renderer of [
  "<OrderFlowPanel", "<ProfessionalIntervalMap", "<ExposureHeatMap", "<DarkPoolLevelsPanel",
  "<EquityPrintsPanel", "<ProfileBars", "<IvRank", "<SeriesPanel", "<MarketMapPanel",
  "<StructuredToolPanel", "<DataTable",
]) assert.ok(dashboard.includes(renderer), `Missing dedicated GEX BOX renderer route: ${renderer}`);
assert.ok(dashboard.includes('label: "Bullish premium"') && dashboard.includes('label: "Bearish premium"') && dashboard.includes('label: "Bullish share"'), "Gainers / Losers must retain premium-direction and sentiment detail.");
assert.ok(dashboard.includes('label="Current IV"') && dashboard.includes('label="IV percentile"') && dashboard.includes('label="Call IV"') && dashboard.includes('label="Put IV"') && dashboard.includes('label="Data quality"'), "IV Rank must retain its full context metrics rather than a lone gauge.");
assert.ok(dashboard.includes("Verified renderer unavailable"), "Unknown tool payloads must not silently fall back to a misleading generic table.");
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
assert.ok(toolRoute.includes("selectedExpiryRows") && toolRoute.includes('request.nextUrl.searchParams.get("expiry")'), "Exposure tools must honor their expiry filter.");
for (const statistic of ["Average print premium", "Unusual prints", "Opening prints", "0DTE prints", "Average implied volatility"]) assert.ok(toolRoute.includes(statistic), `Contract Statistics lost its ${statistic} row.`);
for (const side of ["CALL BOUGHT", "CALL SOLD", "PUT BOUGHT", "PUT SOLD", "LONG OPTIONS", "SHORT OPTIONS", "NET LONG"]) assert.ok(toolRoute.includes(side), `Contract Side Statistics lost its ${side} classification.`);
assert.ok(audit.includes("Production tool catalogue"), "Reconstruction audit is incomplete.");
assert.ok(audit.includes("credentials are never exported"), "Audit must preserve the server-only credential boundary.");

console.log("GEX BOX dashboard architecture checks passed.");
