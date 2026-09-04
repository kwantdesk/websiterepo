import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDrawing, normalizeDrawings } from "../src/lib/chartDrawTools.ts";

const points = [{ time: 100, price: 100 }, { time: 200, price: 110 }];

// Missing flags on old saved drawings deliberately mean enabled. This keeps
// VAH and VAL visible immediately without rewriting a user's workspace.
{
  const fresh = createDrawing("fixedRangeVolumeProfile", points);
  assert.notEqual(fresh.style.showValueAreaLines, false);

  const [legacy] = normalizeDrawings([{
    id: "legacy-fixed-profile",
    tool: "fixedRangeVolumeProfile",
    points,
    style: fresh.style,
  }]);
  assert.notEqual(legacy.style.showValueAreaLines, false);
}

const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
assert.ok(layer.includes("const vahY = toY(prof.vahHigh)"), "renderer must project VAH");
assert.ok(layer.includes("const valY = toY(prof.valLow)"), "renderer must project VAL");
assert.ok(layer.includes("line(boxLeft, vahY, boxRight, vahY"), "VAH begins at the profile spine and ends at its range edge");
assert.ok(layer.includes("line(boxLeft, valY, boxRight, valY"), "VAL begins at the profile spine and ends at its range edge");
assert.ok(layer.includes("`VAH ${prof.vahHigh.toFixed(2)}`"), "VAH label uses the calculated level");
assert.ok(layer.includes("`VAL ${prof.valLow.toFixed(2)}`"), "VAL label uses the calculated level");

const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");
for (const contract of [
  "Show POC line",
  "Show VAH / VAL lines",
  "POC line colour",
  "VAH / VAL colour",
  "POC line width",
  "VAH / VAL width",
]) {
  assert.ok(settings.includes(contract), `fixed profile settings must expose ${contract}`);
}

console.log("Fixed range volume profile level tests passed.");
