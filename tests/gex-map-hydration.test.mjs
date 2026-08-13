import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url),
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
