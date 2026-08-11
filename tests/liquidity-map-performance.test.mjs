import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the Rithmic map publishes bounded truthful depth at a sustainable cadence", () => {
  const gateway = read("services/rithmic_gateway/src/server.mjs");
  const feed = read("public/heatmap-app/src/live-market.js");
  assert.match(gateway, /RITHMIC_HEATMAP_FRAME_MS\) \|\| 50/);
  assert.match(gateway, /RITHMIC_HEATMAP_HISTORY_FRAMES\) \|\| 180/);
  assert.match(gateway, /HEATMAP_HISTORY_CHUNK_SIZE = 24/);
  assert.match(feed, /REQUESTED_DEPTH_TICKS = 320/);
  assert.match(gateway, /capturedHeatmapFrame/);
  assert.match(gateway, /afterSequence: state\.lastSequence, tradeLimit: 256/);
  assert.match(gateway, /tradeLimit: 1/);
});

test("the high-refresh presentation uses lightweight ticks without synthetic full-map paints", () => {
  const gateway = read("services/rithmic_gateway/src/server.mjs");
  const feed = read("public/heatmap-app/src/live-market.js");
  const runtime = read("public/heatmap-app/src/main.js");
  assert.match(gateway, /event: tick/);
  assert.match(feed, /onPresentationTick/);
  assert.doesNotMatch(feed, /visualHold: true/);
  assert.match(runtime, /#ingestPresentationTick/);
  assert.match(runtime, /this\.#positionCurrentPrice\(current\)/);
  assert.match(runtime, /#presentLiveCamera\(timestamp\)/);
  assert.match(runtime, /translate3d\(0, \$\{this\.presentationCameraY\.toFixed\(3\)\}px, 0\)/);
  assert.match(runtime, /this\.presentationFrames \+= 1/);
});

test("stream reconnects request only history newer than the accepted cursor", () => {
  const gateway = read("services/rithmic_gateway/src/server.mjs");
  const feed = read("public/heatmap-app/src/live-market.js");
  assert.match(feed, /afterTimestamp/);
  assert.match(feed, /this\.lastAcceptedTimestamp/);
  assert.match(feed, /this\.#restartSilentStream\(\)/);
  assert.match(gateway, /frame\.snapshot\?\.timestamp\) > afterTimestamp/);
});

test("live map rendering avoids full-history analysis and repeated DOM replacement on every frame", () => {
  const runtime = read("public/heatmap-app/src/main.js");
  const depthEngine = read("public/heatmap-app/src/depth-engine.js");

  assert.match(runtime, /INDICATOR_ANALYSIS_INTERVAL_MS = 250/);
  assert.match(runtime, /nextHtml !== this\.depthLadderHtml/);
  assert.match(runtime, /nextHtml !== this\.tapeHtml/);
  assert.match(depthEngine, /if \(!force && this\.version > 0\) return false/);
  assert.match(runtime, /this\.renderRequested = false;\s+this\.frames \+= 1;/);
  assert.match(runtime, /timestamp - this\.lastUiUpdate > 50/);
  assert.match(runtime, /snapshot\.eventsSince \?\?/);
  assert.match(runtime, /finally \{\s+requestAnimationFrame\(next => this\.#loop\(next\)\);/);
});

test("wide and high-DPI screens use bounded canvas work and cached trade clusters", () => {
  const renderer = read("public/heatmap-app/src/renderer.js");
  assert.match(renderer, /Math\.sqrt\(5_000_000 \/ Math\.max\(1, width \* height\)\)/);
  assert.match(renderer, /Math\.min\(1\.5, window\.devicePixelRatio/);
  assert.match(renderer, /this\.tradeClusterCache\.key !== clusterKey/);
});
