import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const gexMap = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/gex-map/route.ts", import.meta.url), "utf8");

assert.match(
  workspace,
  /GEX_MAP_AUTO_CHART_SYMBOLS\s*=\s*\["SPXW",\s*"NDX",\s*"SPY",\s*"QQQ"\]/,
  "the synchronized four-chart preset must contain each requested underlying exactly once",
);

for (const symbol of ["SPXW", "NDX", "SPY", "QQQ"]) {
  assert.match(
    workspace,
    new RegExp(`GEX_MAP_AUTO_MAP_PANELS[\\s\\S]*?symbol:\\s*"${symbol}"`),
    `the embedded GEX Map replay preset must include ${symbol}`,
  );
}

assert.match(workspace, /externalReplay=\{chartWorkspaceScope === "gamma" && gexVueReplay\.active/);
assert.match(workspace, /replayTimestampMs=\{chartWorkspaceScope === "gamma" && gexVueReplay\.active/);
assert.match(workspace, /chartWorkspaceScope === "gamma" && gexVueReplay\.active \? \(/);
assert.doesNotMatch(
  workspace,
  /\(chartWorkspaceScope === "gamma" \|\| chartWorkspaceScope === "charts"\) && gexVueReplay\.active/,
  "GEX VUE replay must not leak into the normal Charts workspace",
);
assert.match(
  workspace,
  /const quoteIsAuthorizedForCurrentClock = quote\.source === "replay"\s*\? gexReplayActive\s*:\s*!gexReplayActive/,
  "GEX VUE must admit replay quotes only while its own replay clock is active",
);
assert.match(
  workspace,
  /gexPaperReplayActive && activeChartExecutionQuoteRef\.current\?\.source === "replay"/,
  "the paper ticket must select the active GEX VUE replay quote",
);
assert.match(
  workspace,
  /if \(gexReplayActive\) \{[\s\S]*?activeQuote\.source === "replay"[\s\S]*?activeQuote\.paneId === activePaneId[\s\S]*?return null;/,
  "a missing, live, or different-pane quote must fail closed during GEX VUE replay",
);

assert.match(workspace, /min=\{earliestGexVueReplaySessionDate\(\)\}/);
assert.match(workspace, /max=\{latestCompletedNewYorkSession\(\)\}/);
assert.match(workspace, /aria-label="Replay timeline"/);

assert.match(gexMap, /externalReplay\?\.sessionDate \|\| replayDate/);
assert.match(gexMap, /externalReplay\?\.timestampMs/);
assert.match(gexMap, /sessionDate: requestedReplayDate/);
assert.match(route, /searchParams\.get\("sessionDate"\)/);
assert.match(
  route,
  /getGexMapPanel\(\s*symbol,\s*greekMode,\s*sessionDate,\s*scope,\s*representation\s*\)/,
  "the replay route must preserve its session, expiry-scope, and representation identity",
);

console.log("GEX Vue replay wiring tests passed.");
