import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DRAW_TOOL_SPECS, createDrawing } from "../src/lib/chartDrawTools.ts";

/**
 * Placing a text tool must actually give you somewhere to type.
 *
 * Reproduced on production: arm Text, click the chart, nothing happens. The box
 * WAS being created - it simply never survived. onBlur closed it
 * unconditionally, and on a live chart it is blurred immediately: the placing
 * click claims the pane's keyboard target, and any re-render (a tick, an
 * indicator sample) takes focus with it. The box appeared and vanished before a
 * character could reach it.
 *
 * Losing focus with nothing typed is not a cancellation. Escape cancels, Enter
 * commits, a press elsewhere commits-or-closes, and anything else puts the
 * caret back.
 */

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("every text-bearing tool asks for its text", () => {
  // THE SECOND BUG, found by checking the rest of the toolbar rather than only
  // the tool that was reported. defaultStyleFor treats six tools as
  // text-bearing; TEXT_INPUT_TOOLS listed four. priceLabel and flagMark fell
  // through to generic placement and dropped an empty, captionless marker.
  const styled = ["text", "note", "callout", "priceLabel", "signpost", "flagMark"];
  const listed = layer.match(/const TEXT_INPUT_TOOLS: DrawToolId\[\] = \[([^\]]+)\]/)[1];
  for (const tool of styled) {
    assert.ok(listed.includes(`"${tool}"`), `${tool} takes text but is not in TEXT_INPUT_TOOLS`);
    assert.ok(DRAW_TOOL_SPECS[tool], `${tool} must still be a registered tool`);
    // The shared yellow is how defaultStyleFor marks the annotation family.
    assert.equal(createDrawing(tool, [{ time: 1, price: 1 }], "x").style.color, "#EAB308",
      `${tool} is styled as text-bearing`);
  }
});

check("an empty blur does not throw the box away", () => {
  const blur = chart.slice(chart.indexOf("onBlur={(event) => {"), chart.indexOf("onKeyDown={(event) => {"));
  assert.match(blur, /if \(drawTextDismissRef\.current\) return;/, "only a deliberate exit closes it");
  assert.match(blur, /window\.requestAnimationFrame\(\(\) => \{\s*\n\s*if \(!drawTextDismissRef\.current\) input\.focus\(\);/,
    "an accidental blur must put the caret back");
  // A value still commits and closes on blur - that behaviour was correct.
  assert.match(blur, /if \(value\) \{[\s\S]*?setDrawTextInput\(null\);\s*\n\s*return;/);
});

check("Escape cancels and Enter commits, both deliberately", () => {
  const keys = chart.slice(chart.indexOf("onKeyDown={(event) => {"), chart.indexOf("onKeyDown={(event) => {") + 400);
  assert.match(keys, /if \(event\.key === "Enter"\) \{ drawTextDismissRef\.current = true; event\.currentTarget\.blur\(\); \}/);
  assert.match(keys, /if \(event\.key === "Escape"\) \{ drawTextDismissRef\.current = true; setDrawTextInput\(null\); \}/);
});

check("the flag is armed fresh for each box", () => {
  // Left true from a previous box, the very next one would close on its first
  // stray blur - the original bug, back again and harder to see.
  const request = chart.slice(chart.indexOf("onRequestText={(points, tool) => {"), chart.indexOf("onRequestText={(points, tool) => {") + 500);
  assert.match(request, /drawTextDismissRef\.current = false;\s*\n\s*setDrawTextInput\(\{ points, tool, x, y, value: "" \}\);/);
});

check("a press outside the box is the deliberate exit", () => {
  const outside = chart.slice(chart.indexOf("const drawTextCommitRef"), chart.indexOf("const [crosshairStyle"));
  assert.match(outside, /document\.addEventListener\("pointerdown", onPress, true\)/,
    "capture phase, because the chart stops propagation before a bubble listener would see it");
  assert.match(outside, /document\.removeEventListener\("pointerdown", onPress, true\)/);
  assert.match(outside, /target\?\.closest\?\.\("\[data-chart-text-input\]"\)/, "pressing the box itself is not an exit");
  assert.match(chart, /data-chart-text-input=""/, "so the box has to be recognisable");
  // Attached once per box, not once per keystroke, so the value is read through
  // a ref rather than a closure that would be stale.
  assert.match(outside, /\}, \[Boolean\(drawTextInput\)\]\);/);
  assert.match(outside, /drawTextCommitRef\.current\?\.\(\);/);
});

console.log(`\nchart text tools: ${passed}/${passed} checks passed`);
