import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync(
  new URL("../public/heatmap-app/src/renderer.js", import.meta.url),
  "utf8",
);
const depthEngine = readFileSync(
  new URL("../public/heatmap-app/src/depth-engine.js", import.meta.url),
  "utf8",
);

test("LIQ MAP volume bars share the live trade-bubble palette", () => {
  assert.match(renderer, /#drawBottomVolume\(ctx, history, accents\)/);
  assert.match(renderer, /frame\.delta >= 0[\s\S]*colorCss\(accents\.bid, \.78\)[\s\S]*colorCss\(accents\.ask, \.78\)/);
  assert.doesNotMatch(renderer, /frame\.delta >= 0 \? 'rgba\(0,245,160/);
});

test("bubble transparency at zero renders fully opaque spheres", () => {
  assert.match(renderer, /image\.data\[offset \+ 3\] = 255/);
  assert.doesNotMatch(renderer, /image\.data\[offset \+ 3\] = 191/);
  assert.match(depthEngine, /255 \* \(1 - fade\)/);
});
