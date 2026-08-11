import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../public/heatmap-app/index.html", import.meta.url);
const embedCssPath = new URL("../public/heatmap-app/embed.css", import.meta.url);
const mainPath = new URL("../public/heatmap-app/src/main.js", import.meta.url);
const rendererPath = new URL("../public/heatmap-app/src/renderer.js", import.meta.url);

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

test("liquidity instruments use a searchable persistent tab picker", async () => {
  const [html, source] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(mainPath, "utf8"),
  ]);

  assert.match(html, /id=["']instrumentPicker["']/);
  assert.match(html, /id=["']instrumentSearch["']/);
  assert.match(html, /id=["']instrumentTabList["']/);
  assert.match(source, /kwantdesk:liquidity-map-tabs:v1/);
  assert.match(source, /DEFAULT_INSTRUMENT_TABS = \['NQ', 'ES'\]/);
  assert.match(source, /INSTRUMENT_ORDER = \['NQ', 'ES'\]/);
  assert.match(source, /#addInstrumentTab\(/);
  assert.match(source, /#closeInstrumentTab\(/);
  assert.doesNotMatch(source, /const next = this\.symbol === 'MNQ'/);
});

test("CVD is labelled and horizontally synchronized with the liquidity map", async () => {
  const [html, renderer] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(rendererPath, "utf8"),
  ]);

  assert.match(html, /> Cumulative Volume Delta<\/strong>/);
  assert.doesNotMatch(html, /Scroll or drag to explore history/);
  assert.match(html, /data-cvd-style="candles"/);
  assert.match(html, /data-cvd-style="line"/);
  assert.match(html, /data-cvd-style="bars"/);
  assert.match(renderer, /const dataWidth = width/);
  assert.match(renderer, /const xForIndex = index => count <= 1 \? dataWidth : \(\(index - start\) \/ \(count - 1\)\) \* dataWidth/);
});

test("Ctrl plus mouse wheel compresses the liquidity timeline without changing price scale", async () => {
  const [source, renderer] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(rendererPath, "utf8"),
  ]);

  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey\) \{[\s\S]*?this\.#zoom\(factor, point, \{ price: false, time: true \}\)/);
  assert.match(source, /#cvdWheel\(event\)[\s\S]*?if \(event\.ctrlKey \|\| event\.metaKey\)[\s\S]*?\{ price: false, time: true \}/);
  assert.doesNotMatch(source, /event\.ctrlKey\s*\?\s*\{ price: true, time: false \}/);
  assert.match(source, /fitLoadedHistory = layout\.dataWidth \/ Math\.max\(30, this\.history\.length\)/);
  assert.match(source, /ABSOLUTE_MIN_TIME_COLUMN_PIXELS = 0\.12/);
  assert.match(renderer, /Math\.max\(0\.12, view\.columnPixels/);
  assert.doesNotMatch(renderer, /Math\.max\(0\.6, view\.columnPixels/);
});

test("historical navigation exposes a bottom-right return-to-live control", async () => {
  const html = await readFile(htmlPath, "utf8");
  const source = await readFile(mainPath, "utf8");
  const styles = await readFile(new URL("../public/heatmap-app/styles.css", import.meta.url), "utf8");

  assert.match(html, /id="returnToLive"[^>]*aria-label="Return to live market"/);
  assert.match(source, /\$\('returnToLive'\)\.addEventListener\('click', \(\) => this\.goLive\(\)\)/);
  assert.match(source, /\$\('returnToLive'\)\.classList\.toggle\('hidden', this\.atLive\)/);
  assert.match(styles, /\.return-live-button\s*\{[\s\S]*?right:\s*18px;[\s\S]*?bottom:\s*18px;/);
});

test("signals and display inspector closes when the user clicks away", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /document\.addEventListener\('pointerdown', event => \{[\s\S]*?inspector\.classList\.contains\('open'\)[\s\S]*?event\.target\.closest\('#inspector, \[data-panel-shortcut\], #settingsButton, #cvdSettingsButton'\)[\s\S]*?inspector\.classList\.remove\('open'\)/);
});

test("display settings stay inside the viewport and scroll independently", async () => {
  const css = await readFile(embedCssPath, "utf8");

  assert.match(css, /\.inspector\s*\{[\s\S]*?max-height:\s*calc\(100vh - 122px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.inspector\s*\{[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(css, /\.inspector::-webkit-scrollbar\s*\{[\s\S]*?width:\s*7px;/);
  assert.match(css, /\.inspector-tabs\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/);
});

test("instrument changes show staged loading progress until the first new frame paints", async () => {
  const html = await readFile(htmlPath, "utf8");
  const source = await readFile(mainPath, "utf8");

  assert.match(html, /id="symbolLoadingOverlay"[\s\S]*?role="progressbar"[\s\S]*?id="symbolLoadingBar"/);
  assert.match(source, /#beginSymbolLoad\(symbol\);[\s\S]*?this\.liveFeed\.setSymbol\(symbol\)/);
  assert.match(source, /status\.historyFrames[\s\S]*?#setSymbolLoadProgress\(58/);
  assert.match(source, /metadata\.historical \? \(metadata\.final \? 88 : 72\) : 88/);
  assert.match(source, /this\.renderer\.render[\s\S]*?this\.#finishSymbolLoad\(this\.symbol\)/);
});

test("wheel input over the price rail stretches only the vertical price axis", async () => {
  const html = await readFile(htmlPath, "utf8");
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /const point = this\.#canvasPoint\(event\);[\s\S]*?this\.#isPriceRailPoint\(point\)[\s\S]*?\{ price: true, time: false \}/);
  assert.match(source, /y: layout\.plotHeight \/ 2/);
  assert.match(html, /Price scale \+ wheel<\/kbd><span>Stretch price axis only/);
});

test("embedded map omits intrusive feed and latency overlays", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.doesNotMatch(html, /id=["']sourceBanner["']/);
  assert.doesNotMatch(html, /id=["']latencyLabel["']/);
  assert.doesNotMatch(html, /Live .*depth-by-order.*full resting book.*trading disabled/i);
});
