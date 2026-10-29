import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Position zones default to semantic green/red across themes; custom colours win.

const tools = readFileSync(new URL("../src/lib/chartDrawTools.ts", import.meta.url), "utf8");
const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the live stack is the one being edited", () => {
  // chartDrawTools -> ChartDrawToolbar -> ChartDrawLayer -> ChartDrawSettings.
  // If the position tools ever leave this list, the edits below are landing on
  // dead code and the test should say so rather than quietly passing.
  assert.match(tools, /T\("longPosition", "forecast"/);
  assert.match(tools, /T\("shortPosition", "forecast"/);
  assert.match(layer, /case "longPosition":\s*\n\s*case "shortPosition": \{/);
  assert.match(settings, /const POSITION_TOOLS = \["longPosition", "shortPosition"\];/);
});

check("the style model carries both colours, optionally", () => {
  // Optional is the point: absent means fixed green/red defaults, which is what every
  // drawing saved before this existed relies on.
  assert.match(tools, /profitColor\?: string;/);
  assert.match(tools, /lossColor\?: string;/);
});

check("the renderer prefers the drawing's own colours", () => {
  const block = layer.slice(
    layer.indexOf('case "longPosition":'),
    layer.indexOf('case "priceRange":'),
  );
  assert.ok(block.length > 0 && block.length < 6_000, `slice looks wrong: ${block.length}`);
  assert.match(block, /const green = style\.profitColor \?\? DEFAULT_POSITION_PROFIT_COLOR;/);
  assert.match(block, /const red = style\.lossColor \?\? DEFAULT_POSITION_LOSS_COLOR;/);
  // THE BUG: the theme must no longer be the only source.
  assert.doesNotMatch(block, /const green = themeColor \|\| "#089981";/);
  assert.doesNotMatch(block, /const red = themeBearColor \|\| "#F23645";/);
  // Both zones and both boundary lines have to read the same two values, or a
  // recoloured zone would keep a theme-coloured edge.
  assert.equal((block.match(/\bgreen\b/g) ?? []).length >= 4, true, "green drives fill, line and chip");
  assert.equal((block.match(/\bred\b/g) ?? []).length >= 4, true, "red drives fill, line and chip");
});

check("the settings dialog exposes them for position tools only", () => {
  assert.match(settings, /const isPosition = POSITION_TOOLS\.includes\(drawing\.tool\);/);
  assert.match(settings, /\{isPosition \? \(/);
  assert.match(settings, /ariaLabel="Profit zone colour"/);
  assert.match(settings, /ariaLabel="Loss zone colour"/);
  assert.match(settings, /patchStyle\(\{ profitColor: hex \}\)/);
  assert.match(settings, /patchStyle\(\{ lossColor: hex \}\)/);
  // Getting back to green/red defaults must not require deleting the drawing.
  assert.match(settings, /patchStyle\(\{ profitColor: undefined, lossColor: undefined \}\)/);
  // The site's own picker, not an OS colour input.
  assert.doesNotMatch(settings, /type="color"/);
});

check("the swatch shows what is actually painted", () => {
  // Same fallback chain as the renderer, or the dialog would advertise a colour
  // the chart is not using.
  assert.match(settings, /drawing\.style\.profitColor \?\? DEFAULT_POSITION_PROFIT_COLOR/);
  assert.match(settings, /drawing\.style\.lossColor \?\? DEFAULT_POSITION_LOSS_COLOR/);
  assert.match(tools, /DEFAULT_POSITION_PROFIT_COLOR = "#089981"/);
  assert.match(tools, /DEFAULT_POSITION_LOSS_COLOR = "#F23645"/);
  assert.match(settings, /Reset to green \/ red/);
});

check("templates capture the new colours for free", () => {
  // saveDrawTemplate stores drawing.style wholesale, so anything added to
  // DrawStyle is templated without further work. If that ever narrows to a
  // hand-listed set of fields, the new colours would silently stop saving.
  assert.match(settings, /saveDrawTemplate\(drawing\.tool, templateName\.trim\(\), drawing\.style\)/);
});

check("the canvas position path uses the same semantic defaults", () => {
  assert.match(chart, /targetColor: DEFAULT_POSITION_PROFIT_COLOR/);
  assert.match(chart, /stopColor: DEFAULT_POSITION_LOSS_COLOR/);
  assert.match(chart, /profitColor: visualStyle\.targetColor \?\? DEFAULT_POSITION_PROFIT_COLOR/);
  assert.match(chart, /lossColor: visualStyle\.stopColor \?\? DEFAULT_POSITION_LOSS_COLOR/);
});

console.log(`\nposition tool colours: ${passed}/${passed} checks passed`);
