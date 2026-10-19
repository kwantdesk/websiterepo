import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("profile history failures remain diagnostic-only, not chart overlays", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const block = chart.match(/\{volumeProfileError \? \(([\s\S]*?)\) : null\}/)?.[1];
  assert.ok(block, "keep the actual failure available for diagnostics");
  assert.match(block, /<div hidden data-volume-profile-diagnostic="unavailable">/);
  assert.match(block, /\{volumeProfileError\}/);
  assert.doesNotMatch(block, /role="(?:status|alert)"|className=/);
});
