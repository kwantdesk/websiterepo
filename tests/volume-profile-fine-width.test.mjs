import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fineVolumeProfileWidth } from "../src/lib/volumeProfileWidth.ts";

test("width 1 is a quarter at every pixel scale, including renderer floors", () => {
  for (const pixels of [0.25, 1, 7, 30, 40, 50, 120, 500]) {
    assert.equal(fineVolumeProfileWidth(pixels, 1), pixels / 4);
    assert.equal(fineVolumeProfileWidth(pixels, 2), pixels / 2);
    assert.equal(fineVolumeProfileWidth(pixels, 3), pixels * 0.75);
  }
});

test("normal widths and defaults are unchanged; hidden profiles remain hidden", () => {
  for (const setting of [4, 9, 18, 24, 28, 32, 45, 100]) {
    assert.equal(fineVolumeProfileWidth(150, setting), 150);
  }
  for (const setting of [0, -1, NaN, Infinity]) assert.equal(fineVolumeProfileWidth(50, setting), 0);
  assert.equal(fineVolumeProfileWidth(0, 1), 0);
  assert.equal(fineVolumeProfileWidth(NaN, 1), 0);
});

test("every volume-profile renderer applies fine scaling after layout floors", () => {
  const native = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
  assert.match(native, /const profileWidth = fineVolumeProfileWidth\(baseProfileWidth, effectiveWidthPercent\)/);
  assert.match(native, /isNewestOfKind\s*\? style.widthPercent\s*:\s*Number\(style.previousWidthPercent/);
  for (const file of ["src/components/ChartDrawLayer.tsx", "src/chart/precision-tools/renderer.ts"]) {
    assert.match(readFileSync(file, "utf8"), /fineVolumeProfileWidth\(Math.max\(/);
  }
  assert.match(readFileSync("src/components/ChartDrawSettings.tsx", "utf8"), /min=\{1\} max=\{80\} step=\{1\}/);
});
