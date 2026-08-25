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
  /DEFAULT_GEX_MAP_EXPIRY_SCOPE:\s*GexMapExpiryScope\s*=\s*"FRONT_EXPIRY"/,
  "the comparable strike ladder must default to the front / 0DTE expiry",
);
assert.match(domain, /expirations:\s*string\[\]/, "payload must expose the expiries that were aggregated");
assert.match(domain, /model:\s*"STRUCTURAL_OI"/, "payload must identify its calculation model honestly");
assert.match(
  domain,
  /DEFAULT_GEX_MAP_REPRESENTATION:\s*GexMapRepresentation\s*=\s*"PER_ONE_DOLLAR_MOVE"/,
  "the comparison map must default to the dollar-move convention used by strike ladders",
);
assert.match(domain, /representation:\s*GexMapRepresentation/, "payload must identify the requested exposure unit");

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
const providerRepresentationRequests = server.match(/representationMode:\s*representation/g) ?? [];
assert.equal(
  providerRepresentationRequests.length,
  2,
  "both exposure and interval provider requests must use the selected exposure unit",
);
assert.match(
  server,
  /function parseExposure\([\s\S]*?representation: GexMapRepresentation = "PER_ONE_PERCENT_MOVE"[\s\S]*?representation,/,
  "the exposure parser must preserve the provider unit instead of always stamping 1%",
);
assert.match(
  server,
  /parseExposure\([\s\S]*?providerTicker,[\s\S]*?greekModeInput,[\s\S]*?undefined,[\s\S]*?representation,[\s\S]*?\)/,
  "the full strike surface must carry the selected unit through parsing",
);
assert.match(server, /sessionDate}:\$\{expiryScope}:\$\{representation}/, "server fallback identity must include scope and exposure unit");
assert.match(
  server,
  /completed-gex-map-panel-v6[\s\S]*?expiryScope, representation/,
  "completed-session cache identity must include scope and exposure unit",
);

assert.match(route, /searchParams\.get\("scope"\)/, "the API must accept an explicit expiry scope");
assert.match(route, /searchParams\.get\("representation"\)/, "the API must accept an explicit exposure unit");
assert.match(
  route,
  /getGexMapPanel\(symbol, greekMode, sessionDate, scope, representation\)/,
  "the API must pass scope and exposure unit to the provider calculation",
);
assert.match(
  cache,
  /gex-map:\$\{symbol}:\$\{greekMode}:\$\{sessionDate \|\| "live"}:\$\{scope}:\$\{representation}/,
  "browser cache identity must include scope and exposure unit",
);

assert.match(workspace, /expiryScope:\s*GexMapExpiryScope/, "saved GEX Map workspaces must preserve expiry scope");
assert.match(workspace, /representation:\s*GexMapRepresentation/, "saved GEX Map workspaces must preserve exposure unit");
assert.match(workspace, /surfaceVersion:\s*2/, "saved GEX Map workspaces must version the comparable surface");
assert.match(
  workspace,
  /const currentSurface = parsed\.surfaceVersion === 2[\s\S]*?expiryScope: currentSurface[\s\S]*?: DEFAULT_GEX_MAP_EXPIRY_SCOPE/,
  "legacy all-expiry workspaces must migrate once to the front-expiry default",
);
assert.match(workspace, /scope:\s*expiryScope/, "workspace requests must send the selected scope");
assert.match(workspace, /representation,/, "workspace requests must send the selected exposure unit");
assert.match(workspace, /All Exp/, "the complete-chain selector must be visible in the GEX Map toolbar");
assert.match(workspace, /Front \/ 0DTE/, "the comparable front-expiry selector must be labelled explicitly");
assert.match(workspace, /PER_ONE_DOLLAR_MOVE[\s\S]*?\$1/, "the dollar-move selector must be visible in the GEX Map toolbar");
assert.match(workspace, /OI model/, "the UI must distinguish structural OI from proprietary inferred dealer flow");
assert.match(workspace, /viewMode === "ninja"[\s\S]*?Ninja node selection/, "Ninja-only controls must not be shown as inert settings in other views");

const isolatedFrontRequests = chart.match(/scope=FRONT_EXPIRY/g) ?? [];
assert.equal(
  isolatedFrontRequests.length,
  2,
  "the two existing chart gamma consumers must stay explicitly front-expiry",
);

console.log("GEX Map expiry-scope wiring: all assertions passed");
