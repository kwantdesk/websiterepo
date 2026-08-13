import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");

test("manual GEX strike scrolling suspends live-price auto centering", () => {
  assert.match(workspace, /const \[followingSpot, setFollowingSpot\] = useState\(true\)/);
  assert.match(workspace, /if \(followingSpot && spotStrike !== null\) centerLiveStrike\(\)/);
  assert.match(workspace, /routeExposureWheel[\s\S]*?setFollowingSpot\(false\)[\s\S]*?container\.scrollTop = nextScroll/);
  assert.match(workspace, /onPointerDown=\{\(\) => setFollowingSpot\(false\)\}/);
  assert.match(workspace, /onTouchStart=\{\(\) => setFollowingSpot\(false\)\}/);
});

test("the user can explicitly re-centre the live strike", () => {
  assert.match(workspace, /Centre price/);
  assert.match(workspace, /setFollowingSpot\(true\);[\s\S]*?centerLiveStrike\(\)/);
});

test("GEX strike centering cannot collapse or hide the ladder viewport", () => {
  assert.doesNotMatch(workspace, /strikeViewportHeight/);
  assert.doesNotMatch(workspace, /strikeEdgeSpace/);
  assert.doesNotMatch(workspace, /className="relative h-full min-h-0 touch-pan-y/);
  assert.match(workspace, /className="relative flex min-h-0 flex-1 bg-chart-background"/);
  assert.match(workspace, /gex-map-strike-viewport[^\n]*min-h-px[^\n]*flex-1/);
  assert.match(workspace, /container\.clientHeight <= 0/);
  assert.match(workspace, /if \(followingSpot\) container\.scrollTop = 0/);
  assert.match(workspace, /data-gex-strike-ladder="true"/);
});

test("cached strikes remain visible during a silent background refresh", () => {
  assert.doesNotMatch(workspace, /> Syncing</);
  assert.match(workspace, /loading && !payload/);
});
