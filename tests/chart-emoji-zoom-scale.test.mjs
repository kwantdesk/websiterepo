import assert from "node:assert/strict";
import test from "node:test";

import { chartAnchoredEmojiScreenSize } from "../src/lib/chartEmojiScale.ts";

const sizeAt = (pixelsPerTime, pixelsPerPrice, nominalSize = 36) => chartAnchoredEmojiScreenSize({
  nominalSize,
  referenceSize: 36,
  timeRadius: 18,
  priceRadius: 18,
  anchorTime: 1_000,
  anchorPrice: 100,
  anchorX: 400,
  anchorY: 300,
  toX: (time) => 400 + (time - 1_000) * pixelsPerTime,
  toY: (price) => 300 - (price - 100) * pixelsPerPrice,
});
test("emoji keeps its placed size at the reference chart scale", () => {
  assert.equal(sizeAt(1, 1), 36);
});

test("emoji keeps its screen size under either axis zoom", () => {
  assert.equal(sizeAt(0.5, 0.5), 36);
  assert.equal(sizeAt(0.25, 0.25), 36);
});

test("manual resizing stays fixed after zooming", () => {
  assert.equal(sizeAt(0.5, 0.5, 72), 72);
});

test("legacy emoji uses its saved pixel size without chart spans", () => {
  assert.equal(chartAnchoredEmojiScreenSize({
    nominalSize: 48,
    anchorTime: 1_000,
    anchorPrice: 100,
    anchorX: 400,
    anchorY: 300,
    toX: () => null,
    toY: () => null,
  }), 48);
});

test("anisotropic zoom and pan cannot resize saved emojis", () => {
 for(const x of [0.01, 0.5, 1, 4, 20]) for(const y of [0.01, 0.5, 1, 4, 20])
  for(const size of [16,36,72,160]) assert.equal(sizeAt(x,y,size),size);
});
