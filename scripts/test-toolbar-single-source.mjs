import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DRAW_TOOL_GROUPS, DRAW_TOOL_LIST, DRAW_TOOL_SPECS } from "../src/lib/chartDrawTools.ts";

/**
 * The chart carries three drawing toolbars and only one is mounted. Work has
 * repeatedly landed on a dead one — a tool added to `Chart.tsx`'s
 * `DRAWING_TOOLBAR_GROUPS` compiles, typechecks and ships without ever being
 * rendered. These checks pin the live toolbar's shape so that class of silent
 * no-op fails here instead of in front of a trader.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const toolbarSource = readFileSync(new URL("../src/components/ChartDrawToolbar.tsx", import.meta.url), "utf8");

check("the legacy left rail is still disabled", () => {
  assert.match(
    chartSource,
    /const LEGACY_LEFT_TOOLBAR_ENABLED = false;/,
    "LEGACY_LEFT_TOOLBAR_ENABLED changed. If the old rail is being revived that is a deliberate\n"
    + "decision, but CLAUDE.md section 8 and this test must be updated with it.",
  );
});

check("the mounted toolbar reads from chartDrawTools", () => {
  assert.match(toolbarSource, /from "@\/lib\/chartDrawTools"/);
});

check("every rail group has at least one tool", () => {
  // ChartDrawToolbar's primaryOf() does `.find(...)!.id`, so an empty group is
  // a runtime crash on the chart, not a type error.
  for (const group of DRAW_TOOL_GROUPS) {
    const tools = DRAW_TOOL_LIST.filter((tool) => tool.group === group.id);
    assert.ok(tools.length > 0, `rail group "${group.id}" has no tools; primaryOf() would throw`);
  }
});

check("every tool belongs to a group the rail renders", () => {
  const rendered = new Set(DRAW_TOOL_GROUPS.map((group) => group.id));
  for (const tool of DRAW_TOOL_LIST) {
    assert.ok(
      rendered.has(tool.group),
      `"${tool.id}" is in group "${tool.group}", which no rail group renders, so it is unreachable`,
    );
  }
});

check("pencil and eraser are one click away", () => {
  // Both are reached constantly while marking a chart up. The rail shows only
  // each group's FIRST tool, so being merely present in the list is not enough.
  for (const id of ["brush", "eraser"]) {
    const spec = DRAW_TOOL_SPECS[id];
    assert.ok(spec, `"${id}" is missing from the live tool list`);
    const primary = DRAW_TOOL_LIST.find((tool) => tool.group === spec.group);
    assert.equal(
      primary.id,
      id,
      `"${id}" is not the primary of group "${spec.group}" (that is "${primary.id}"), `
      + "so it is hidden behind a flyout chevron",
    );
  }
});

check("no duplicate tool ids", () => {
  const seen = new Set();
  for (const tool of DRAW_TOOL_LIST) {
    assert.ok(!seen.has(tool.id), `duplicate tool id "${tool.id}"`);
    seen.add(tool.id);
  }
});

console.log(`\ntoolbar single-source: ${passed}/${passed} checks passed`);
