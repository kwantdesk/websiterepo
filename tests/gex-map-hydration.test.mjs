import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url),
  "utf8",
);
const workspaceCache = readFileSync(
  new URL("../src/lib/workspaceDataCache.ts", import.meta.url),
  "utf8",
);
const quantDataServer = readFileSync(
  new URL("../src/lib/quantData.server.ts", import.meta.url),
  "utf8",
);
const gatewayDockerfile = readFileSync(
  new URL("../services/rithmic_gateway/Dockerfile", import.meta.url),
  "utf8",
);

test("GEX map hydration starts from deterministic panel state", () => {
  assert.match(workspace, /const \[locationMarket, setLocationMarket\] = useState<GexMapMarket \| null>\(null\)/);
  assert.match(workspace, /const \[panelData, setPanelData\][\s\S]*?left: null,[\s\S]*?centre: null,[\s\S]*?right: null/);
  assert.doesNotMatch(
    workspace,
    /useState<Record<string, GexMapPanelPayload \| null>>\(\(\) =>[\s\S]*?readWorkspaceData/,
  );
});

test("GEX map restores cache after mount and does not restart on replay date discovery", () => {
  assert.match(workspace, /setLocationMarket\(market \?\? linkedMarketFromLocation\(\)\)/);
  assert.match(workspace, /const cachedData = Object\.fromEntries[\s\S]*?readWorkspaceData<GexMapPanelPayload>/);
  assert.match(workspace, /\}, \[panels, refreshToken, replayMode, requestedReplayDate\]\);/);
  assert.doesNotMatch(workspace, /setReplayDate\(firstSuccess\.value\.payload\.sessionDate\)/);
});

test("GEX map retains a compact completed-session snapshot through provider restarts", () => {
  assert.match(workspaceCache, /GEX_MAP_LAST_GOOD_MAX_AGE_MS = 72 \* 60 \* 60 \* 1_000/);
  assert.match(workspaceCache, /window\.localStorage\.setItem\(/);
  assert.match(workspaceCache, /frames: Array\.isArray\(payload\.frames\) \? payload\.frames\.slice\(-5\) : \[\]/);
  assert.match(workspaceCache, /return readLastGoodGexMap<T>\(key\)/);
  assert.match(quantDataServer, /lastGoodGexMapPanelBySurface/);
  assert.match(quantDataServer, /completed-gex-map-panel-v3/);
  assert.match(quantDataServer, /latestGexMapStrikesFromFrames\(frames\)/);
  assert.match(quantDataServer, /status: "LAST_SESSION"/);
});

test("the VPS vendor edge includes an operating-system certificate store", () => {
  assert.match(gatewayDockerfile, /apt-get install -y --no-install-recommends ca-certificates/);
  assert.match(gatewayDockerfile, /update-ca-certificates/);
});
