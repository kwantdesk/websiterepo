import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const control = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);
const chart = readFileSync(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);
const config = readFileSync(
  new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url),
  "utf8",
);
const primitive = readFileSync(
  new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url),
  "utf8",
);

test("volume profile settings expose persistent off, left, and right edge modes", () => {
  assert.match(control, /Fix profile to chart edge/);
  assert.match(control, /\["left", "right"\] as const/);
  assert.match(control, /snapMode: snapMode === "off" \? "left" : "off"/);
  assert.match(control, /Off leaves every profile at its true historical session position/);
  assert.match(config, /profileSettingsVersion: 6/);
});

test("daily profiles honour off and right instead of forcing the left edge", () => {
  assert.match(primitive, /style\.snapMode === "left"[\s\S]*autoPinnedDailyLeft/);
  assert.match(primitive, /style\.snapMode === "right"[\s\S]*latestDailyProfile/);
  assert.doesNotMatch(
    primitive,
    /const pinnedDailyLeft = profile\.period === "daily" && autoPinnedDailyLeft/,
  );
  assert.doesNotMatch(chart, /profile\.period === "daily" && requestedSnapMode === "right"/);
  assert.match(chart, /snapMode: requestedSnapMode/);
});

test("profile width follows horizontal zoom without changing during horizontal panning", () => {
  assert.match(primitive, /function zoomScaledVolumeProfileWidth/);
  assert.match(primitive, /getVisibleLogicalRange\(\)/);
  assert.match(primitive, /paneWidth \/ visibleLogicalSpan/);
  assert.match(primitive, /referenceLogicalBars \* widthPercent \/ 100/);
  assert.match(primitive, /MAX_PROFILE_PANE_FRACTION/);
  assert.doesNotMatch(primitive, /viewportWidthLimit/);
});

test("the consolidated Daily Profile retains the KWANT chart-width renderer", () => {
  assert.match(
    chart,
    /widthBasis: "chart"/,
  );
  assert.match(primitive, /style\.widthBasis === "session"/);
  assert.match(primitive, /CHART_PROFILE_REFERENCE_BARS/);
});
