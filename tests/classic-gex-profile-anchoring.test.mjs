import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Classic GEX renders inside the native price-coordinate primitive", () => {
  const chart = read("src/components/Chart.tsx");
  const primitive = read("src/lib/classicGexProfilePrimitive.ts");
  assert.match(chart, /new ClassicGexProfilePrimitive\(\)/);
  assert.match(chart, /candleSeries\.attachPrimitive\(classicGexProfilePrimitive\)/);
  assert.match(chart, /classicGexProfilePrimitiveRef\.current\?\.update/);
  assert.match(primitive, /series\.priceToCoordinate\(row\.mappedPrice\)/);
  assert.match(primitive, /series\.priceToCoordinate\(line\.mappedPrice\)/);
  assert.doesNotMatch(primitive, /viewportVersion|setViewportVersion|style\.transform/);
});

test("the former SVG geometry is retained only as a transparent tooltip hit layer", () => {
  const chart = read("src/components/Chart.tsx");
  assert.match(chart, /Visible GEX geometry is rendered by ClassicGexProfilePrimitive/);
  assert.match(chart, /style=\{\{ opacity: 0 \}\}/);
});
