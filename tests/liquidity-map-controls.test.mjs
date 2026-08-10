import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../public/heatmap-app/index.html", import.meta.url);
const embedCssPath = new URL("../public/heatmap-app/embed.css", import.meta.url);
const mainPath = new URL("../public/heatmap-app/src/main.js", import.meta.url);

test("restores the full Kwantify liquidity-map control surface", async () => {
  const html = await readFile(htmlPath, "utf8");

  for (const id of [
    "toggleHeatmap",
    "toggleTrades",
    "toggleProfile",
    "toggleCvd",
    "quickHeatRange",
    "paletteSelect",
    "sensitivityRange",
    "dimmingRange",
    "bubbleRange",
    "showDom",
    "cvdEnabled",
    "absorptionEnabled",
    "sweepsEnabled",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} remains available`);
  }

  assert.match(html, /data-panel-shortcut="depth"/);
  assert.match(html, /data-panel-shortcut="signals"/);
  assert.match(html, /data-panel-shortcut="settings"/);
});

test("embedded liquidity map uses the restored horizontal toolbar", async () => {
  const css = await readFile(embedCssPath, "utf8");

  assert.match(css, /grid-template-rows:\s*46px 52px minmax\(0, 1fr\)/);
  assert.match(css, /\.tool-rail\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.match(css, /\.workspace\s*\{[\s\S]*?grid-row:\s*3/);
  assert.doesNotMatch(css, /\.app-bar,\s*\nhtml\[data-embed="true"\] \.status-bar/);
});

test("liquidity-map choices persist between visits", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /kwantdesk:liquidity-map-settings:v1/);
  assert.match(source, /#restoreSettings\(\)/);
  assert.match(source, /#saveSettings\(\)/);
});

test("Ctrl plus mouse wheel pans the liquidity timeline horizontally", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey\) \{[\s\S]*?this\.#panHistory\(wheelColumnShift\(/);
  assert.doesNotMatch(source, /event\.ctrlKey\s*\?\s*\{ price: true, time: false \}/);
});

test("embedded map omits intrusive feed and latency overlays", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.doesNotMatch(html, /id=["']sourceBanner["']/);
  assert.doesNotMatch(html, /id=["']latencyLabel["']/);
  assert.doesNotMatch(html, /Live .*depth-by-order.*full resting book.*trading disabled/i);
});
