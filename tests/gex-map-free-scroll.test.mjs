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
  assert.doesNotMatch(workspace, /className="relative h-full min-h-0 touch-pan-y/);
  assert.match(workspace, /gex-map-panel-grid grid h-full min-w-0/);
  assert.doesNotMatch(workspace, /gex-map-panel-grid grid min-h-full/);
  assert.match(workspace, /className="relative flex min-h-0 flex-1 bg-chart-background"/);
  assert.match(workspace, /gex-map-strike-viewport[^\n]*min-h-px[^\n]*flex-1/);
  assert.match(workspace, /container\.clientHeight <= 0/);
  assert.match(workspace, /const ladderRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(workspace, /container\.scrollTop = 0/);
  assert.match(workspace, /target\.offsetTop \+ target\.offsetHeight \/ 2/);
  assert.match(workspace, /container\.scrollTo\(\{ top: nextScroll, behavior: "auto" \}\)/);
  assert.match(workspace, /key=\{viewIdentity\}/);
  assert.match(workspace, /overflowAnchor: "none"/);
  assert.match(workspace, /settleFrame = window\.requestAnimationFrame/);
  assert.doesNotMatch(workspace, /ladder\.style\.paddingTop/);
  assert.doesNotMatch(workspace, /ladder\.style\.paddingBottom/);
  assert.match(workspace, /if \(followingSpot && spotStrike !== null\) centerLiveStrike\(\);/);
  assert.match(workspace, /data-gex-strike-ladder="true"/);
});

test("wheel input over a strike node owns the vertical slot-machine movement", () => {
  assert.match(workspace, /data-gex-strike-node="true"/);
  assert.match(workspace, /addEventListener\("wheel", routeExposureWheel, \{ capture: true, passive: false \}\)/);
  assert.match(workspace, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*setFollowingSpot\(false\)/);
});

test("cached strikes remain visible during a silent background refresh", () => {
  assert.doesNotMatch(workspace, /> Syncing</);
  assert.match(workspace, /loading && !payload/);
  assert.match(workspace, /hasRenderableGexMapSurface\(cached\) \? cached : null/);
  assert.match(workspace, /validate: \(value\) => hasRenderableGexMapSurface/);
});
