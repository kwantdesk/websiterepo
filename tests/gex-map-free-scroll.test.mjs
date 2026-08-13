import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");

test("manual GEX strike scrolling suspends live-price auto centering", () => {
  assert.match(workspace, /const \[followingSpot, setFollowingSpot\] = useState\(true\)/);
  assert.match(workspace, /if \(!followingSpot \|\| spotStrike === null\) return/);
  assert.match(workspace, /routeExposureWheel[\s\S]*?setFollowingSpot\(false\)[\s\S]*?container\.scrollTop = nextScroll/);
  assert.match(workspace, /onPointerDown=\{\(\) => setFollowingSpot\(false\)\}/);
  assert.match(workspace, /onTouchStart=\{\(\) => setFollowingSpot\(false\)\}/);
});

test("the user can explicitly re-centre the live strike", () => {
  assert.match(workspace, /Centre price/);
  assert.match(workspace, /setFollowingSpot\(true\);[\s\S]*?centerLiveStrike\(\)/);
});
