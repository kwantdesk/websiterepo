import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workspacePath = path.resolve("src/components/heatmap/OptionsHeatmapWorkspace.tsx");
const source = fs.readFileSync(workspacePath, "utf8");

test("live heatmap ticks paint imperatively without rebuilding the structural model per frame", () => {
  assert.match(source, /const HEATMAP_MODEL_REFRESH_MS = 500;/);
  assert.match(source, /livePricePath: \[\],/);
  assert.doesNotMatch(source, /liveVersion/);
  assert.match(source, /window\.addEventListener\(DATABENTO_LIVE_TICK_EVENT, requestLivePaint\)/);
  assert.match(source, /const remaining = 50 - \(now - lastLivePaintAt\);/);
});

test("heatmap canvas bounds its backing-store cost on dense displays", () => {
  assert.match(source, /const HEATMAP_MAX_PIXEL_COUNT = 3_000_000;/);
  assert.match(source, /Math\.min\(1\.5, window\.devicePixelRatio \|\| 1\)/);
  assert.match(source, /Math\.sqrt\(HEATMAP_MAX_PIXEL_COUNT \/ Math\.max\(1, width \* height\)\)/);
});

test("heatmap pointer interaction avoids raw-event React state churn", () => {
  assert.doesNotMatch(source, /setHover\(/);
  assert.match(source, /pendingViewportRef\.current = \{/);
  assert.match(source, /dragFrameRef\.current = window\.requestAnimationFrame/);
});
