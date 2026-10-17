import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("GEX Map toolbar reserves vertical padding without a fixed height that clips controls above the scrollbar", () => {
  const source = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
  const classes = source.match(/<header className="(gex-map-header[^\"]+)"/)?.[1];
  assert.ok(classes);
  assert.match(classes, /\bpy-1\.5\b/);
  assert.match(classes, /min-h-\[48px\]/);
  assert.match(classes, /\boverflow-x-auto\b/);
  assert.match(classes, /\bshrink-0\b/);
  assert.doesNotMatch(classes, /(?:^|\s)h-(?:\d|\[)/);
});
