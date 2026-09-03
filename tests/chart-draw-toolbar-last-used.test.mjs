import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DRAW_TOOL_LAST_USED_EVENT,
  DRAW_TOOL_LAST_USED_STORAGE_KEY,
  normalizeLastUsedDrawTools,
  quickDrawToolForGroup,
  rememberLastUsedDrawTool,
} from "../src/lib/chartDrawTools.ts";

const toolbar = readFileSync(new URL("../src/components/ChartDrawToolbar.tsx", import.meta.url), "utf8");

test("a group defaults to its first tool before anything has been used", () => {
  assert.equal(quickDrawToolForGroup("trend", "cursor", {}), "trendLine");
});

test("Extended Line becomes the Lines group's persistent one-click action", () => {
  const recent = rememberLastUsedDrawTool({}, "extendedLine");
  assert.equal(recent.trend, "extendedLine");
  assert.equal(quickDrawToolForGroup("trend", "cursor", recent), "extendedLine");
});

test("the currently armed group tool wins without erasing other recent choices", () => {
  const recent = rememberLastUsedDrawTool({ fib: "fibExtension" }, "extendedLine");
  assert.equal(quickDrawToolForGroup("trend", "ray", recent), "ray");
  assert.equal(recent.fib, "fibExtension");
});

test("stored values are accepted only when they belong to the stated group", () => {
  assert.deepEqual(normalizeLastUsedDrawTools({ trend: "extendedLine", fib: "rectangle", nope: "ray" }), {
    trend: "extendedLine",
  });
});

test("the live toolbar persists, synchronizes and reuses the remembered tool", () => {
  assert.equal(DRAW_TOOL_LAST_USED_STORAGE_KEY, "kwantdesk:drawing-last-used:v1");
  assert.equal(DRAW_TOOL_LAST_USED_EVENT, "kwantdesk:drawing-last-used-change");
  assert.match(toolbar, /quickDrawToolForGroup\(group\.id, activeTool, lastUsedToolByGroup\)/);
  assert.match(toolbar, /rememberLastUsedDrawTool\(lastUsedToolByGroup, tool\)/);
  assert.match(toolbar, /localStorage\.setItem\(DRAW_TOOL_LAST_USED_STORAGE_KEY/);
  assert.match(toolbar, /window\.dispatchEvent\(new Event\(DRAW_TOOL_LAST_USED_EVENT\)\)/);
  assert.match(toolbar, /onClick=\{\(\) => selectTool\(shown\)\}/);
  assert.match(toolbar, /selectTool\(toolId\); setOpenGroup\(null\)/);
});
