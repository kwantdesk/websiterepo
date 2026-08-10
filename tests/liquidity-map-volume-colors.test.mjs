import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync(
  new URL("../public/heatmap-app/src/renderer.js", import.meta.url),
  "utf8",
);

test("LIQ MAP volume bars share the live trade-bubble palette", () => {
  assert.match(renderer, /#drawBottomVolume\(ctx, history, accents\)/);
  assert.match(renderer, /frame\.delta >= 0[\s\S]*colorCss\(accents\.bid, \.78\)[\s\S]*colorCss\(accents\.ask, \.78\)/);
  assert.doesNotMatch(renderer, /frame\.delta >= 0 \? 'rgba\(0,245,160/);
});
