import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DRAW_TOOL_GROUPS, DRAW_TOOL_LIST, DRAW_TOOL_SPECS, FIB_LEVELS, FIB_RETRACEMENT_LEVELS } from "../src/lib/chartDrawTools.ts";

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

check("the legacy left rail is gone, not merely switched off", () => {
  // It used to be 536 lines of JSX behind `LEGACY_LEFT_TOOLBAR_ENABLED = false`
  // - permanently unrendered, but still the first drawing toolbar anyone found
  // when searching this file, and repeatedly the one edited by mistake.
  // Deleting it is what makes ChartDrawToolbar the only answer.
  assert.doesNotMatch(chartSource, /LEGACY_LEFT_TOOLBAR_ENABLED/,
    "the dead rail is back; reviving it is a deliberate decision, but CLAUDE.md section 8 and this test must change with it");
  assert.doesNotMatch(chartSource, /function activateToolbarTool/,
    "activateToolbarTool only ever served the dead rail");
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

check("a retracement stays inside its own two anchors", () => {
  // A retracement measures how far a move pulled back, so every level belongs
  // between the anchors. The 1.618/2.618/3.618/4.236 projections are the
  // Extension tool's, and drawing them here put lines far off the move being
  // measured.
  assert.ok(FIB_RETRACEMENT_LEVELS.length > 0);
  for (const level of FIB_RETRACEMENT_LEVELS) {
    assert.ok(level.coeff >= 0 && level.coeff <= 1, `${level.coeff} is outside the 0-1 range`);
  }
  const coeffs = FIB_RETRACEMENT_LEVELS.map((level) => level.coeff);
  assert.deepEqual(coeffs, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
  // The Extension tool still needs the projections, so they must not have been
  // deleted outright.
  assert.ok(FIB_LEVELS.some((level) => level.coeff > 1), "the extension levels are gone");
});

check("the retracement renderer uses the bounded list", () => {
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const start = layer.indexOf('case "fibRetracement"');
  assert.ok(start > 0, "the retracement case is gone");
  const body = layer.slice(start, layer.indexOf('case "fibExtension"', start));
  assert.match(body, /FIB_RETRACEMENT_LEVELS\.map/, "the retracement is drawing the full list again");
});

check("indicator pane titles are named, not shouted", () => {
  // Kwant Stats shipped as "KWANT STATS" beside CVD's "Cumulative Volume
  // Delta". Acronyms stay upper case; a whole word does not.
  const ACRONYMS = new Set([
    "CVD", "VWAP", "MACD", "RSI", "ATR", "EMA", "SMA", "WMA", "ADX", "CCI", "OBV",
    "TPO", "VP", "VAH", "VAL", "POC", "IV", "GEX", "DEX", "VEX", "CHEX", "DOM",
    "OI", "PNL", "OCO", "RTH", "ETH", "CME", "ZGB", "AD", "DP", "SVP", "COB",
  ]);
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const shouted = [];
  for (const line of chart.split("\n")) {
    const match = /^\s*title: [`"]([^`"$]*)/.exec(line);
    if (!match) continue;
    for (const word of match[1].split(/[^A-Za-z/]+/)) {
      const bare = word.replace(/\//g, "");
      if (bare.length < 3 || bare !== bare.toUpperCase()) continue;
      if (ACRONYMS.has(bare)) continue;
      shouted.push(`${word} (in "${match[1].trim()}")`);
    }
  }
  assert.deepEqual(shouted, [], `pane titles shouting: ${shouted.join(", ")}`);
});

console.log(`\ntoolbar single-source: ${passed}/${passed} checks passed`);
