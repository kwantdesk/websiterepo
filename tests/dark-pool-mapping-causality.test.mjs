import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { causalDarkPoolMappingReceipt, causalDarkPoolMappingSamples } from "../src/lib/darkPoolMappingCausality.ts";

test("backward replay cannot retain later regression observations from the same date", () => {
  const samples = [{ timeMs: 1_000, source: 1 }, { timeMs: 120_000, source: 2 }, { timeMs: 180_000, source: 3 }];
  assert.deepEqual(causalDarkPoolMappingSamples(samples, 120_000, 1), [samples[1]]);
  assert.deepEqual(causalDarkPoolMappingSamples(samples, 180_000, 1), samples.slice(1));
});
test("a frozen receipt learned later in replay cannot leak into an earlier snapshot", () => {
  const future = { calculatedAtMs: 180_000, beta: 40 };
  const current = { calculatedAtMs: 120_000, beta: 35 };
  assert.deepEqual(causalDarkPoolMappingReceipt(future, current, 120_000), current);
  assert.equal(causalDarkPoolMappingReceipt(current, future, 180_000), current, "retain genuinely earlier frozen mappings");
});
test("route does not substitute completed-session close for an absent historical source print", () => {
  const source = readFileSync(new URL("../src/app/api/dark-pool-map/route.ts", import.meta.url), "utf8");
  assert.match(source, /const sourceMid = hasHistoricalAsOf\s*\? prints\.at\(-1\)\?\.price \?\? null/);
  assert.ok(source.includes("causalDarkPoolMappingReceipt(frozenPrintMappings.get(frozenKey), receipt, nowMs)"));
  assert.ok(source.includes("causalDarkPoolMappingSamples("));
});
