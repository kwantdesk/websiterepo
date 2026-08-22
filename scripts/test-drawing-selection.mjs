import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layer = readFileSync("src/chart/precision-tools/PrecisionToolsLayer.tsx", "utf8");
const drawLayer = readFileSync("src/components/ChartDrawLayer.tsx", "utf8");
const renderer = readFileSync("src/chart/precision-tools/renderer.ts", "utf8");

// 1. Anchor handles are drawn ONLY for the selected object. Both engines.
assert.match(drawLayer, /const handles = selected\s*\r?\n?\s*\?/);
assert.match(renderer, /objects\.filter\(\(object\) => selectedIds\.includes\(object\.id\)/);

// 2. THE BUG: losing chart interaction must clear the selection, or a finished
//    drawing keeps its dots forever — the click that moved on goes to another
//    surface, so nothing here ever deselects it.
const ownerBlock = layer.slice(
  layer.indexOf("subscribeChartInteractionOwner((owner) => {"),
  layer.indexOf("}), [store]);"),
);
assert.ok(ownerBlock.includes("store.select([])"), "disengaging must clear the selection");
assert.ok(ownerBlock.includes("store.cancelDraft()"), "and must still drop any in-flight draft");

// 3. A background click inside the layer still deselects directly.
assert.match(layer, /const hit = hitTestObjects\(snapshot\.objects, point, adapter\);\s*\r?\n\s*if \(!hit\) \{\s*\r?\n\s*store\.select\(\[\]\);/);

// 4. Clear-all must reach EVERY drawing document, not just the chart's own.
assert.match(layer, /export const CLEAR_CHART_DRAWINGS_EVENT = "kwantdesk:clear-chart-drawings";/);
const clearBlock = layer.slice(layer.indexOf("const onClearAll = () => {"), layer.indexOf("window.addEventListener(CLEAR_CHART_DRAWINGS_EVENT"));
for (const call of ["store.cancelDraft()", "store.select([])", "store.clear()"]) {
  assert.ok(clearBlock.includes(call), `clear-all must call ${call}`);
}

// 5. The listener is removed on unmount — a stale handler would clear a store
//    belonging to a pane that no longer exists.
assert.match(layer, /return \(\) => window\.removeEventListener\(CLEAR_CHART_DRAWINGS_EVENT, onClearAll\);/);

console.log("drawing selection and clear-all: 5/5 checks passed");
