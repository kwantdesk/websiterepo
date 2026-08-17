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

test("the high-refresh presentation keeps the shared canvas fixed without synthetic history", () => {
  const gateway = read("services/rithmic_gateway/src/server.mjs");
  const feed = read("public/heatmap-app/src/live-market.js");
  const runtime = read("public/heatmap-app/src/main.js");
  assert.match(gateway, /event: tick/);
  assert.match(feed, /onPresentationTick/);
  assert.match(runtime, /#ingestPresentationTick/);
  assert.match(runtime, /this\.#positionCurrentPrice\(current\)/);
  assert.doesNotMatch(runtime, /#sampleRestingBook\(timestamp\)/);
  assert.doesNotMatch(runtime, /id: `hold:/);
  assert.match(runtime, /if \(metadata\.visualHold\)[\s\S]*?updateLivePresentationEdge/);
  assert.match(runtime, /#presentLiveCamera\(timestamp\)/);
  assert.match(runtime, /Never translate the shared canvas/);
  assert.doesNotMatch(runtime, /translate3d\(\$\{this\.presentationCameraX/);
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

  assert.match(runtime, /INDICATOR_ANALYSIS_INTERVAL_MS = 200/);
  assert.match(runtime, /INDICATOR_ANALYSIS_MAX_FRAMES = 1800/);
  assert.match(runtime, /this\.indicatorTradeRevision \+= 1/);
  assert.match(runtime, /this\.history\.slice\(analysisStart, this\.viewEnd \+ 1\)/);
  assert.doesNotMatch(runtime, /this\.history\.slice\(0, this\.viewEnd \+ 1\)/);
  assert.doesNotMatch(runtime, /#replaceCvdHistory[\s\S]{0,700}this\.indicatorAnalysisKey = ''/);
  assert.match(runtime, /currentNormalized: true/);
  assert.match(runtime, /nextHtml !== this\.depthLadderHtml/);
  assert.match(runtime, /nextHtml !== this\.tapeHtml/);
  assert.match(depthEngine, /if \(!force && this\.version > 0\) return false/);
  assert.match(depthEngine, /const cacheOwner = frame\.presentationSource \|\| frame/);
  assert.match(depthEngine, /RAW_COLUMN_GEOMETRY_CACHE_LIMIT = 2/);
  assert.match(depthEngine, /if \(cache\.size >= RAW_COLUMN_GEOMETRY_CACHE_LIMIT\) cache\.clear\(\)/);
  assert.match(depthEngine, /typeof book\?\.forEachLevel === 'function'/);
  assert.match(runtime, /MAX_HISTORY = 1800/);
  const feed = read("public/heatmap-app/src/live-market.js");
  assert.match(feed, /class PackedBook/);
  assert.match(feed, /Float64Array\.from\(ticks\)/);
  assert.match(runtime, /this\.renderRequested = false;\s+this\.frames \+= 1;/);
  assert.match(runtime, /const canvasPaintInterval = this\.workspaceEmbedded && !this\.workspacePresentationActive \? 50 : 0/);
  assert.match(runtime, /const uiUpdateInterval = 100/);
  assert.match(runtime, /timestamp - this\.lastUiUpdate > uiUpdateInterval/);
  assert.match(runtime, /activePanel === 'depthPanel'/);
  assert.match(runtime, /activePanel === 'signalsPanel'/);
  assert.match(runtime, /if \(metadata\.final\) this\.#updateUi\(false\)/);
  assert.match(runtime, /snapshot\.eventsSince \?\?/);
  assert.match(runtime, /finally \{\s+requestAnimationFrame\(next => this\.#loop\(next\)\);/);
});

test("wide and high-DPI screens use bounded canvas work and cached trade clusters", () => {
  const renderer = read("public/heatmap-app/src/renderer.js");
  assert.match(renderer, /Math\.sqrt\(5_000_000 \/ Math\.max\(1, width \* height\)\)/);
  assert.match(renderer, /Math\.min\(1\.5, window\.devicePixelRatio/);
  assert.match(renderer, /this\.tradeClusterCache\.key !== clusterKey/);
  assert.match(renderer, /TRADE_CLUSTER_REFRESH_MS = 100/);
  assert.match(renderer, /this\.depthEngine\.tradeRevision/);
  assert.match(renderer, /this\.executionProfileCache = \{ history: null/);
  assert.match(renderer, /this\.visibleExecutionProfile = this\.#getVisibleExecutionProfile\(history\)/);
  assert.match(renderer, /const canRoll = oldStart >= 0/);
  assert.match(renderer, /const heatmapAnchor = Math\.max\(layout\.rowTicks, layout\.rowTicks \* 4\)/);
  assert.match(renderer, /bottomTick: heatmapBottomTick,[\s\S]*?topTick: heatmapTopTick/);
  assert.match(renderer, /0, heatmapYOffset, layout\.dataWidth, layout\.plotHeight/);
  assert.match(renderer, /function timestampLowerBound\(points, target, high = points\.length\)/);
  assert.match(renderer, /function timestampUpperBound\(points, target\)/);
  assert.match(renderer, /const sessionEnd = timestampUpperBound\(sessionPoints, currentTimestamp\)/);
  assert.doesNotMatch(renderer, /sessionCvd\?\.points \|\| \[\]\)\s*\.filter/);
  assert.match(renderer, /if \(settings\.trades\) this\.#drawTrades/);
  assert.match(renderer, /if \(volumeRatioWidth > 0\) \{/);
  assert.match(renderer, /if \(profileWidth > 0\) \{/);
  assert.doesNotMatch(renderer, /settings\.trades && !this\.interaction/);
  assert.doesNotMatch(renderer, /settings\.profile && !this\.interaction/);
  assert.match(renderer, /this\.#drawBottomVolume\(ctx, history, accents\)/);
  assert.doesNotMatch(renderer, /!this\.interaction\) this\.#drawBottomVolume/);
  assert.match(renderer, /const overlayCenterTick = this\.interaction/);
  assert.match(renderer, /overlayBottomTick, overlayTopTick, overlayCenterTick, overlayYForTick/);
  assert.match(renderer, /this\.interaction\?\.startTimestamp/);
});

test("live heatmap raster buffers roll in place instead of allocating every frame", () => {
  const depthEngine = read("public/heatmap-app/src/depth-engine.js");
  const feed = read("public/heatmap-app/src/live-market.js");

  assert.match(depthEngine, /base = previous\.base/);
  assert.match(depthEngine, /intensities = previous\.intensities/);
  assert.match(depthEngine, /base\.copyWithin/);
  assert.match(depthEngine, /intensities\.copyWithin/);
  assert.match(feed, /SNAPSHOT_IDENTITY_CAPACITY = 2048/);
  assert.match(feed, /this\.snapshotIdentityCursor/);
  assert.doesNotMatch(feed, /snapshotIdentityQueue\.shift\(\)/);
});
