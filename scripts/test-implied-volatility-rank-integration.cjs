const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (filename) => fs.readFileSync(path.join(root, filename), "utf8");

const catalog = read("src/lib/chartIndicatorCatalog.ts");
const workspace = read("src/components/KwantifyWorkspace.tsx");
const chart = read("src/components/Chart.tsx");
const config = read("src/lib/chartIndicatorConfig.ts");
const route = read("src/app/api/implied-volatility-rank/route.ts");
const icon = read("src/components/icons/ImpliedVolatilityRankIcon.tsx");

assert.equal((catalog.match(/indicator\("Implied Volatility Rank"/g) || []).length, 1, "indicator is registered exactly once");
assert.equal((workspace.match(/id: "tool-implied-volatility-rank"/g) || []).length, 1, "Add Tool entry is registered exactly once");
assert.match(workspace, /indicatorId: "implied-volatility-rank"/, "Add Tool shares the stable indicator ID");
assert.match(workspace, /const installed = withoutPreviousTool\.find/, "Add Tool reuses an installed instance rather than duplicating it");
assert.match(config, /placement: "separate-pane"/, "separate pane is the default placement");
assert.match(config, /paneHeight: 220/, "IV Rank defaults to a 220px pane");
assert.match(config, /showIvPercentile: false/, "percentile is opt-in by default");
assert.match(chart, /fixedDomain: \{ min: 0, max: 100 \}/, "primary IV Rank axis is fixed to 0–100");
assert.match(chart, /secondaryAxisSeriesKey/, "underlying price uses a separate secondary axis");
assert.match(chart, /QQQ|automaticIvSourceTicker/, "mapped source is displayed and derived explicitly");
assert.match(route, /getConfiguredQuantDataApiKey/, "provider credential is checked on the server route");
assert.doesNotMatch(route, /NEXT_PUBLIC_.*QUANT/i, "provider credential is never read from a public browser variable");
assert.match(icon, /Original KwantDesk IV Rank mark/, "Add Tool uses the original local SVG icon");

console.log("Implied Volatility Rank registration and chart-integration tests passed.");
