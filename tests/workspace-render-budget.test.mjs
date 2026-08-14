import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("visible background charts retain live ticks but reconcile heavy state less often", () => {
  const workspace = read("src/components/KwantifyWorkspace.tsx");
  assert.match(workspace, /const activeRef = useRef\(active\)/);
  assert.match(workspace, /activeRef\.current \? 500 : 1_000/);
  assert.match(workspace, /activeRef\.current \? 250 : 750/);
  assert.match(workspace, /dispatchEvent\(new CustomEvent\(LIVE_CHART_CANDLE_EVENT/);
});

test("an embedded liquidity map receives pane priority and budgets background paints", () => {
  const workspace = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");
  const shell = read("src/components/KwantifyWorkspace.tsx");
  const runtime = read("public/heatmap-app/src/main.js");
  assert.match(workspace, /kwantdesk:liquidity-map-performance/);
  assert.match(shell, /embedded active=\{activePaneId === pane\.id\}/);
  assert.match(runtime, /this\.workspaceEmbedded && !this\.workspacePresentationActive \? 100 : 0/);
  assert.match(runtime, /this\.workspaceEmbedded && !this\.workspacePresentationActive \? 250 : 100/);
  assert.match(runtime, /if \(this\.renderRequested && canvasPaintDue\)/);
});
