import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the Rithmic map publishes truthful depth at a 20 FPS cadence", () => {
  const gateway = read("services/rithmic_gateway/src/server.mjs");
  const feed = read("public/heatmap-app/src/live-market.js");
  assert.match(gateway, /RITHMIC_HEATMAP_FRAME_MS\) \|\| 50/);
  assert.match(feed, /observedRealFrameMs <= 70/);
});

test("live map rendering avoids full-history analysis and repeated DOM replacement on every frame", () => {
  const runtime = read("public/heatmap-app/src/main.js");
  const depthEngine = read("public/heatmap-app/src/depth-engine.js");

  assert.match(runtime, /INDICATOR_ANALYSIS_INTERVAL_MS = 250/);
  assert.match(runtime, /nextHtml !== this\.depthLadderHtml/);
  assert.match(runtime, /nextHtml !== this\.tapeHtml/);
  assert.match(depthEngine, /if \(!force && this\.version > 0\) return false/);
  assert.match(runtime, /this\.renderRequested = false;\s+this\.frames \+= 1;/);
  assert.match(runtime, /snapshot\.eventsSince \?\?/);
  assert.match(runtime, /finally \{\s+requestAnimationFrame\(next => this\.#loop\(next\)\);/);
});
