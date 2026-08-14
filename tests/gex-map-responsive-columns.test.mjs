import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("GEX Map reduces horizontal surfaces without vertically stacking them", () => {
  assert.match(
    styles,
    /\.gex-map-panel-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    styles,
    /@container \(max-width: 859px\)[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*?\.gex-map-panel-grid > :nth-child\(n \+ 3\)[\s\S]*?display:\s*none/,
  );
  assert.match(
    styles,
    /@container \(max-width: 569px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*?\.gex-map-panel-grid > :nth-child\(n \+ 2\)[\s\S]*?display:\s*none/,
  );
  assert.doesNotMatch(
    styles,
    /\.gex-map-panel-grid\s*\{[\s\S]*?repeat\(auto-fit/,
  );
});
