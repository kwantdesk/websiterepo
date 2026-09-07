import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chart = await readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

test("chart pan and zoom keep native canvas input ahead of React overlays", () => {
  assert.match(chart, /const VIEWPORT_REACT_SETTLE_DELAY_MS = 80/);
  assert.match(
    chart,
    /const scheduleViewportRefresh = \(\) => \{[\s\S]*?requestAnimationFrame[\s\S]*?clearTimeout\(viewportRefreshTimerRef\.current\)[\s\S]*?setTimeout\([\s\S]*?VIEWPORT_REACT_SETTLE_DELAY_MS/,
  );
  assert.match(
    chart,
    /const commitViewportRefresh = \(\) => \{[\s\S]*?startTransition\(\(\) => \{[\s\S]*?setViewportVersion/,
  );
  const scheduleBlock = chart.slice(
    chart.indexOf("const scheduleViewportRefresh = () =>"),
    chart.indexOf("const handlePriceScaleWheel", chart.indexOf("const scheduleViewportRefresh = () =>")),
  );
  assert.doesNotMatch(scheduleBlock, /elapsed >=|setViewportVersion/);
  assert.doesNotMatch(scheduleBlock, /syncNativePriceScaleWidth\(\)|refreshPaperLivePnl\(\)/);
  assert.match(scheduleBlock, /paperOverlayNodesRef\.current\.size > 0/);
});

test("profile calculations do not rebuild during ordinary viewport gestures", () => {
  assert.match(chart, /variantProfileViewportRevision = variantProfileInstances\.some[\s\S]*visible-range-volume-profile/);
  assert.match(chart, /deepProfileValuesViewportRevision = deepProfileValuesSettings\.periodMode === "visible"/);
  assert.doesNotMatch(chart, /deepProfileValuesSettings,[^\]]*viewportVersion/);
});

test("raw chart mouse movement is coalesced without repeated layout reads", () => {
  assert.match(chart, /let cachedContainerRect = container\.getBoundingClientRect\(\)/);
  assert.match(
    chart,
    /const handleMouseMove = \(event: MouseEvent\) => \{[\s\S]*?pendingMouseMove[\s\S]*?requestAnimationFrame\(flushMouseMove\)/,
  );
  const handler = chart.match(/const handleMouseMove = \(event: MouseEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
  assert.doesNotMatch(handler, /getBoundingClientRect/);
});

test("chart teardown cancels viewport and pointer refresh work", () => {
  assert.match(chart, /clearTimeout\(viewportRefreshTimerRef\.current\)/);
  assert.match(chart, /cancelAnimationFrame\(mouseMoveFrame\)/);
});
