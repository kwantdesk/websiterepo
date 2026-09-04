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

test("emoji shrinks with chart zoom instead of staying fixed in pixels", () => {
  assert.equal(sizeAt(0.5, 0.5), 18);
  assert.equal(sizeAt(0.25, 0.25), 9);
});

test("manual resizing remains proportional at the zoomed scale", () => {
  assert.equal(sizeAt(0.5, 0.5, 72), 36);
});

test("legacy emoji remains visible until the chart layer captures its scale", () => {
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
