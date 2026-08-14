import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chart = await readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

test("chart pan and zoom keep native canvas input ahead of React overlays", () => {
  assert.match(chart, /const VIEWPORT_REACT_REFRESH_INTERVAL_MS = 64/);
  assert.match(
    chart,
    /const scheduleViewportRefresh = \(\) => \{[\s\S]*?requestAnimationFrame[\s\S]*?elapsed >= VIEWPORT_REACT_REFRESH_INTERVAL_MS[\s\S]*?setTimeout\([\s\S]*?VIEWPORT_REACT_REFRESH_INTERVAL_MS - elapsed/,
  );
  assert.match(
    chart,
    /const commitViewportRefresh = \(\) => \{[\s\S]*?startTransition\(\(\) => \{[\s\S]*?setViewportVersion/,
  );
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
