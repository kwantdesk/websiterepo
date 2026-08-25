import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const domain = read("src/lib/gexMap.ts");
const server = read("src/lib/quantData.server.ts");
const route = read("src/app/api/gex-map/route.ts");
const cache = read("src/lib/workspaceDataCache.ts");
const workspace = read("src/components/gex-map/GexMapWorkspace.tsx");
const chart = read("src/components/Chart.tsx");

assert.match(
  domain,
  /DEFAULT_GEX_MAP_EXPIRY_SCOPE:\s*GexMapExpiryScope\s*=\s*"ALL_EXPIRIES"/,
  "the comparison map must default to the complete option chain",
);
assert.match(domain, /expirations:\s*string\[\]/, "payload must expose the expiries that were aggregated");
assert.match(domain, /model:\s*"STRUCTURAL_OI"/, "payload must identify its calculation model honestly");

assert.match(
  server,
  /expiryScope === "ALL_EXPIRIES"[\s\S]*?\? fullExposure[\s\S]*?: parseExposure/,
  "all-expiry mode must use the complete exposure surface",
);
assert.match(
  server,
  /filter: expiryScope === "ALL_EXPIRIES"[\s\S]*?\? \{ ticker: providerTicker \}[\s\S]*?: \{ ticker: providerTicker, expirationDate: expiration \}/,
  "the provider request must omit expirationDate only for the complete-chain mode",
);
assert.match(
  server,
  /expiryScope === "ALL_EXPIRIES"[\s\S]*?parseFullChainGexMapFrames\(intervalResult\.payload\)/,
  "replay frames must aggregate all expiries rather than just relabeling the result",
);
assert.match(
  server,
  /expiryScope: GexMapExpiryScope = "FRONT_EXPIRY"/,
  "non-map internal callers must retain their previous front-expiry semantics",
);
assert.match(server, /sessionDate}:\$\{expiryScope}/, "server fallback identity must include expiry scope");
assert.match(server, /completed-gex-map-panel-v5[\s\S]*?expiryScope/, "completed-session cache identity must include expiry scope");

assert.match(route, /searchParams\.get\("scope"\)/, "the API must accept an explicit expiry scope");
assert.match(route, /getGexMapPanel\(symbol, greekMode, sessionDate, scope\)/, "the API must pass scope to the provider calculation");
assert.match(cache, /gex-map:\$\{symbol}:\$\{greekMode}:\$\{sessionDate \|\| "live"}:\$\{scope}/, "browser cache identity must include expiry scope");

assert.match(workspace, /expiryScope:\s*GexMapExpiryScope/, "saved GEX Map workspaces must preserve expiry scope");
assert.match(workspace, /scope:\s*expiryScope/, "workspace requests must send the selected scope");
assert.match(workspace, /All Exp/, "the complete-chain selector must be visible in the GEX Map toolbar");
assert.match(workspace, /OI model/, "the UI must distinguish structural OI from proprietary inferred dealer flow");

const isolatedFrontRequests = chart.match(/scope=FRONT_EXPIRY/g) ?? [];
assert.equal(
  isolatedFrontRequests.length,
  2,
  "the two existing chart gamma consumers must stay explicitly front-expiry",
);

console.log("GEX Map expiry-scope wiring: all assertions passed");
