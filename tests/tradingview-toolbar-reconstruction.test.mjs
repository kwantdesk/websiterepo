import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync(new URL("../src/lib/tradingViewToolbarCatalog.ts", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/lib/professionalDrawingEngine.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/registry/tool-registry.ts", import.meta.url), "utf8");
const drawing = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/kwant/kwant-tool-drawing.ts", import.meta.url), "utf8");

test("the TradingView reconstruction has one authoritative 93-tool catalog with drift guards", () => {
  assert.match(catalog, /TRADINGVIEW_TOOLBAR_TOOL_COUNT = 93/);
  assert.match(catalog, /new Set\(TRADINGVIEW_TOOLBAR_CATALOG\.map\(\(tool\) => tool\.appTool\)\)/);
  assert.match(catalog, /duplicate application tool IDs/);
  assert.match(catalog, /expected \$\{TRADINGVIEW_TOOLBAR_TOOL_COUNT\}, received/);
  for (let groupNumber = 1; groupNumber <= 7; groupNumber += 1) {
    assert.match(catalog, new RegExp(`\\.\\.\\.group\\(${groupNumber},`));
  }
});

test("every reconstructed group uses split-button last-used behavior and stable DOM identities", () => {
  assert.match(chart, /kwantdesk:drawing-last-used:v1/);
  assert.match(chart, /lastUsedToolByGroup/);
  assert.match(chart, /data-tool-id=\{tool\.id\}/);
  assert.match(chart, /data-name=\{TRADINGVIEW_TOOLBAR_BY_APP_TOOL\.get\(tool\.id\)\?\.dataName\}/);
  assert.match(chart, /setLastUsedToolByGroup/);
  assert.match(chart, /aria-label=\{`Open \$\{group\.label\}`\}/);
});

test("previously missing pattern, cycle and content tools resolve to real canvas engines", () => {
  for (const tool of [
    "xabcdPattern", "cypherPattern", "headAndShoulders", "abcdPattern", "trianglePattern", "threeDrivesPattern",
    "cyclicLines", "timeCycles", "sineLine", "ghostFeed", "image", "post", "idea",
  ]) assert.match(engine, new RegExp(`\\b${tool}:`));

  for (const kind of [
    "xabcd-pattern", "cypher-pattern", "head-and-shoulders", "abcd-pattern", "triangle-pattern", "three-drives-pattern",
    "cyclic-lines", "time-cycles", "sine-line", "ghost-feed", "image-content", "post-content", "idea-content",
  ]) {
    assert.match(registry, new RegExp(`["']${kind}["']`));
    assert.match(drawing, new RegExp(`["']${kind}["']`));
  }
});
