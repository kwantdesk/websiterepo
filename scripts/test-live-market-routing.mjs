import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../src/lib/marketIndexLiveClient.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/institutional-market-data/[...path]/route.ts", import.meta.url), "utf8");

for (const symbol of ["SPX", "SPXW", "NDX", "SPY", "QQQ", "IWM"]) {
  assert.match(client, new RegExp(`\\"${symbol}\\"`), `${symbol} must use the shared VPS index stream`);
}

const gexMapLiveGuards = workspace.match(/(?:section|bottomWorkspaceSection) !== "gexmap"/g) ?? [];
assert.ok(
  gexMapLiveGuards.length >= 6,
  `GEX Map must activate every global live-feed path; found ${gexMapLiveGuards.length} guards`,
);

assert.match(
  proxy,
  /const isLongLivedStream = path\.endsWith\("\/trades"\) \|\| path\.includes\("stream"\)/,
  "index-stream must receive the long-lived proxy timeout instead of being aborted every 30 seconds",
);
assert.doesNotMatch(
  proxy,
  /path\.endsWith\("\/trades"\) \|\| path\.endsWith\("\/stream"\)/,
  "stream detection must not depend on the broken /stream suffix check",
);

console.log("live market routing: shared cash-index SSE, proxy lifetime, and GEX Map subscriptions verified");
