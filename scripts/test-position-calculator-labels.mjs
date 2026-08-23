import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer = readFileSync("src/chart/precision-tools/renderer.ts", "utf8");
const chart = readFileSync("src/components/Chart.tsx", "utf8");
const primitive = readFileSync("src/lib/positionCalculatorPrimitive.ts", "utf8");

// 1. The precision renderer must know which object is selected.
assert.match(renderer, /function renderObject\([\s\S]{0,220}selected = false\): void/);
assert.match(renderer, /const selectedSet = new Set\(selectedIds\);/);
assert.match(renderer, /selectedSet\.has\(object\.id\) \|\| object\.id === draft\?\.id/);

// 2. TP / SL / R:R pills only draw for the selected calculator. Deselected,
//    the tool is just its red and green boxes.
const positionBlock = renderer.slice(
  renderer.indexOf("const centerX = left + boxWidth / 2;"),
  renderer.indexOf("break;", renderer.indexOf("const centerX = left + boxWidth / 2;")),
);
assert.ok(positionBlock.includes("if (selected) {"), "pills must be gated on selection");
for (const label of ["targetText", "stopText", "entryText"]) {
  const at = positionBlock.indexOf(label + ",");
  assert.ok(at > positionBlock.indexOf("if (selected) {"), `${label} must sit inside the gate`);
}

// 3. The invalid-setup warning is also a working readout, not permanent chrome.
assert.match(renderer, /\} else if \(selected\) \{/);

// 4. The boxes and their lines are NOT gated — the tool stays visible.
const bodyBlock = renderer.slice(
  renderer.indexOf("ctx.strokeStyle = object.style.neutralColor;"),
  renderer.indexOf("if (result.valid)"),
);
assert.ok(!bodyBlock.includes("if (selected)"), "the calculator body must always draw");

// 5. The live canvas primitive follows the same selected-only label rule.
assert.match(primitive, /if \(model\.selected && model\.showLabels\)/);

// 6. New calculators default to clean red/green boxes. Labels remain an
//    explicit user option and are persisted on the drawing when enabled.
assert.match(chart, /const positionStyleDefaults:[\s\S]{0,600}showLabels: false,/);
assert.match(chart, /positionStyle: \{[\s\S]{0,160}showLabels: false,/);

console.log("position calculator labels: 6/6 checks passed");
