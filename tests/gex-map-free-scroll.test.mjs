import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");

test("manual GEX strike scrolling suspends live-price auto centering", () => {
  assert.match(workspace, /const \[followingSpot, setFollowingSpot\] = useState\(true\)/);
  assert.match(workspace, /syncStrikeViewport\(followingSpot && spotStrike !== null\)/);
  assert.match(workspace, /routeExposureWheel[\s\S]*?setFollowingSpot\(false\)[\s\S]*?container\.scrollTop = nextScroll/);
  assert.match(workspace, /onPointerDown=\{\(\) => setFollowingSpot\(false\)\}/);
  assert.match(workspace, /onTouchStart=\{\(\) => setFollowingSpot\(false\)\}/);
});

test("the user can explicitly re-centre the live strike", () => {
  assert.match(workspace, /Centre price/);
  assert.match(workspace, /setFollowingSpot\(true\);[\s\S]*?centerLiveStrike\(\)/);
});

test("GEX strike centering cannot retain stale workspace geometry", () => {
  assert.doesNotMatch(workspace, /strikeViewportHeight/);
  assert.doesNotMatch(workspace, /strikeEdgeSpace/);
  assert.match(workspace, /const edgeSpace = Math\.max\(0, container\.clientHeight \/ 2 - 18\)/);
  assert.match(workspace, /content\.style\.paddingTop = `\$\{edgeSpace\}px`/);
  assert.match(workspace, /content\.style\.paddingBottom = `\$\{edgeSpace\}px`/);
  assert.match(workspace, /if \(followingSpot\) container\.scrollTop = 0/);
  assert.match(workspace, /data-gex-strike-ladder="true"/);
});

test("cached strikes remain visible during a silent background refresh", () => {
  assert.doesNotMatch(workspace, /> Syncing</);
  assert.match(workspace, /loading && !payload/);
});
