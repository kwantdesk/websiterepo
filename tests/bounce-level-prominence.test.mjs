import "../scripts/alias-hook.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/bounceLevelsPrimitive.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll('"@/lib/gexMapFormat"', JSON.stringify(new URL("../src/lib/gexMapFormat.ts", import.meta.url).href));
const { calculateBounceNodeProminence, calculateBounceNodeHeight } = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));

test("weak nodes have genuinely thin, faint presentation rather than a common line floor", () => {
  const weak = calculateBounceNodeProminence(.05);
  assert.ok(weak.opacityScale < .06);
  assert.ok(calculateBounceNodeHeight(2, 18, .05) * weak.heightScale < .5);
});
test("strong levels keep their existing thickness and opacity", () => {
  for (const strength of [.65, .75, .9, 1]) {
    assert.deepEqual(calculateBounceNodeProminence(strength), { heightScale: 1, opacityScale: 1 });
    assert.equal(calculateBounceNodeHeight(2, 18, strength) * calculateBounceNodeProminence(strength).heightScale, calculateBounceNodeHeight(2, 18, strength));
  }
});
test("the falloff is smooth, bounded and monotonic across exposure strengths", () => {
  let previous = { heightScale: 0, opacityScale: 0 };
  for (let i = 0; i <= 1000; i++) {
    const value = calculateBounceNodeProminence(i / 1000);
    assert.ok(value.heightScale >= previous.heightScale && value.opacityScale >= previous.opacityScale);
    assert.ok(value.heightScale <= 1 && value.opacityScale <= 1);
    assert.ok(value.opacityScale - previous.opacityScale < .04);
    previous = value;
  }
});
test("out-of-range strength is clamped without changing source exposure", () => {
  assert.deepEqual(calculateBounceNodeProminence(-10), calculateBounceNodeProminence(0));
  assert.deepEqual(calculateBounceNodeProminence(10), calculateBounceNodeProminence(1));
});
