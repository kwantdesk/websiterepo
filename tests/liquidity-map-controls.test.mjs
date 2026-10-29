import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../public/heatmap-app/index.html", import.meta.url);
const embedCssPath = new URL("../public/heatmap-app/embed.css", import.meta.url);
const mainPath = new URL("../public/heatmap-app/src/main.js", import.meta.url);
const rendererPath = new URL("../public/heatmap-app/src/renderer.js", import.meta.url);
const workspacePath = new URL("../src/components/liquidity-map/LiquidityMapWorkspace.tsx", import.meta.url);
const workspaceShellPath = new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url);
const preferencesPath = new URL("../src/lib/userPreferences.ts", import.meta.url);

test("restores the full Kwant Desk liquidity-map control surface", async () => {
  const html = await readFile(htmlPath, "utf8");

  for (const id of [
    "toggleHeatmap",
    "toggleDom",
    "toggleTrades",
    "toggleProfile",
    "toggleCvd",
    "quickHeatRange",
    "paletteSelect",
    "sensitivityRange",
    "dimmingRange",
    "bubbleRange",
    "showDom",
    "showRestingSell",
    "showRestingBuy",
    "showCob",
    "showBidPercent",
    "showAskPercent",
    "showSvp",
    "cvdEnabled",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} remains available`);
  }

  assert.match(html, /data-panel-shortcut="depth"/);
  assert.match(html, /data-panel-shortcut="signals"/);
  assert.match(html, /data-panel-shortcut="settings"/);
  assert.doesNotMatch(html, /id=["']absorption(?:Signal|Enabled|Automatic|WindowMs|MinimumVolume|SdMultiplier)["']/);
  assert.doesNotMatch(html, /id=["'](?:sweepSignal|sweepsEnabled|sweepsAutomatic|sweepWindowMs|sweepMinimumVolume|sweepMinimumLevels|sweepSdMultiplier)["']/);
});

test("LIQ MAP never renders absorption or sweep event badges", async () => {
  const [source, renderer, indicators] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(rendererPath, "utf8"),
    readFile(new URL("../public/heatmap-app/src/order-flow-indicators.js", import.meta.url), "utf8"),
  ]);

  assert.match(source, /this\.settings\.absorptionEnabled = false/);
  assert.match(source, /this\.settings\.sweepsEnabled = false/);
  assert.doesNotMatch(renderer, /#drawIndicatorMarks/);
  assert.doesNotMatch(renderer, /fillText\(['"]S['"]/);
  assert.match(indicators, /absorptionEnabled: false/);
  assert.match(indicators, /sweepsEnabled: false/);
});

test("the second chart tool is an icon-only grab hand matching the crosshair", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.match(html, /data-tool="crosshair"[\s\S]*?<\/button>[\s\S]*?<button class="rail-button" data-tool="pan"[^>]*title="Grab and move chart"[^>]*aria-label="Grab and move chart"[\s\S]*?<\/button>[\s\S]*?data-tool="measure"/);
  assert.doesNotMatch(html, /data-tool="pan"[^>]*>[\s\S]*?<span>Grab<\/span>/);
  assert.doesNotMatch(html, /data-tool="pan"[^>]*title="Pan chart"/);
});

test("toolbar DOM control sits between heatmap and trades and removes the full rail", async () => {
  const [html, source, renderer] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(mainPath, "utf8"),
    readFile(rendererPath, "utf8"),
  ]);

  assert.match(html, /id="toggleHeatmap"[\s\S]*?id="toggleDom"[\s\S]*?id="toggleTrades"/);
  assert.match(source, /#bindToggle\('toggleDom', 'domVisible'\)/);
  assert.match(source, /#syncDomVisibilityControls\(notifyParent = false\)/);
  assert.match(renderer, /const priceAxisWidth = domVisible \? priceLabelWidth \+ restingBookWidth \+ depthColumnWidth : 0/);
  assert.match(renderer, /const profilesVisible = domVisible && settings\.profile/);
  assert.match(renderer, /const volumeRatioWidth = ratioColumnCount \* profileColumnWidth/);
  assert.match(renderer, /const profileWidth = svpVisible \? profileColumnWidth \* 2 : 0/);
  assert.match(renderer, /if \(volumeRatioWidth > 0\) \{[\s\S]*?this\.#drawBidAskVolumeProfile/);
  assert.match(renderer, /if \(profileWidth > 0\) \{[\s\S]*?this\.#drawVolumeProfile/);
  assert.match(renderer, /if \(domVisible\) this\.#drawPriceAxis\(ctx, current, accents\)/);
});

test("individual DOM columns can be hidden and reclaim chart width", async () => {
  const [html, source, renderer] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(mainPath, "utf8"),
    readFile(rendererPath, "utf8"),
  ]);

  for (const id of ["showRestingSell", "showRestingBuy", "showCob", "showBidPercent", "showAskPercent", "showSvp"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const setting of ["domRestingSellVisible", "domRestingBuyVisible", "domCobVisible", "domBidPercentVisible", "domAskPercentVisible", "domSvpVisible"]) {
    assert.match(source, new RegExp(`${setting}: true`));
  }
  assert.match(renderer, /const restingSideCount = Number\(restingSellVisible\) \+ Number\(restingBuyVisible\)/);
  assert.match(renderer, /const ratioColumnCount = Number\(bidPercentVisible\) \+ Number\(askPercentVisible\)/);
  assert.match(renderer, /if \(size && layout\.cobVisible\)/);
});

test("LIQ MAP display buttons have documented keyboard shortcuts", async () => {
  const [html, source] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(mainPath, "utf8"),
  ]);

  assert.match(html, /Kwant Desk LIQ MAP shortcuts/);
  assert.match(html, /<kbd>D<\/kbd><span>Show or hide full DOM<\/span>/);
  assert.match(html, /<kbd>P<\/kbd><span>Show or hide volume profile<\/span>/);
  assert.match(html, /<kbd>C<\/kbd><span>Show or hide CVD<\/span>/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'd'\) \$\('toggleDom'\)\.click\(\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'p'\) \$\('toggleProfile'\)\.click\(\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'c'\) \$\('toggleCvd'\)\.click\(\)/);
});

test("heat sensitivity can dim substantially below the old minimum", async () => {
  const [html, engine] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(new URL("../public/heatmap-app/src/depth-engine.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="quickHeatRange"[^>]*min="0\.1"[^>]*value="0\.1"/);
  assert.match(html, /id="sensitivityRange"[^>]*min="0\.1"[^>]*value="0\.1"/);
  assert.match(engine, /clamp\(sensitivity, 0\.1, 4\)/);
  assert.match(await readFile(mainPath, "utf8"), /LIQUIDITY_MAP_DISPLAY_DEFAULTS = Object\.freeze\([\s\S]*?sensitivity: 0\.1/);
});

test("new users and reset share the canonical account-backed display defaults", async () => {
  const [source, preferences] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(preferencesPath, "utf8"),
  ]);

  assert.match(source, /this\.settings = \{[\s\S]*?\.\.\.LIQUIDITY_MAP_DISPLAY_DEFAULTS/);
  assert.match(source, /#resetSettings\(\)[\s\S]*?\.\.\.LIQUIDITY_MAP_DISPLAY_DEFAULTS/);
  assert.match(preferences, /"kwantdesk:liquidity-map-settings:v1"/);
  assert.match(source, /kwantdesk:liquidity-map-preferences-changed/);
});

test("embedded liquidity map uses the restored horizontal toolbar", async () => {
  const [html, css] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(embedCssPath, "utf8"),
  ]);

  assert.match(css, /grid-template-rows:\s*46px 52px minmax\(0, 1fr\)/);
  assert.match(css, /\.tool-rail\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.match(css, /\.workspace\s*\{[\s\S]*?grid-row:\s*3/);
  assert.doesNotMatch(css, /\.app-bar,\s*\nhtml\[data-embed="true"\] \.status-bar/);
  assert.match(html, /<div class="app-actions">[\s\S]*?id="modeStatus"[\s\S]*?class="toolbar-panel-shortcuts header-panel-shortcuts"[\s\S]*?id="utcClock"/);
  assert.doesNotMatch(html, /<section class="top-deck"[\s\S]*?<div class="toolbar-panel-shortcuts"/);
  assert.match(css, /\.header-panel-shortcuts\s*\{[\s\S]*?height:\s*34px;/);
  assert.match(css, /\.tool-rail\s*\{[\s\S]*?scroll-padding-right:\s*190px;/);
});

test("liquidity-map choices persist between visits", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /kwantdesk:liquidity-map-settings:v1/);
  assert.match(source, /#restoreSettings\(\)/);
  assert.match(source, /#saveSettings\(\)/);
});

test("liquidity-map display and bubble settings follow the signed-in account", async () => {
  const [source, workspace, preferences] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(workspacePath, "utf8"),
    readFile(preferencesPath, "utf8"),
  ]);

  assert.match(preferences, /"kwantdesk:liquidity-map-settings:v1"/);
  assert.match(preferences, /"kwantdesk:liquidity-map-tabs:v1"/);
  assert.match(preferences, /"kwantdesk:liquidity-map-instrument:v1"/);
  assert.match(source, /kwantdesk:liquidity-map-preferences-changed/);
  assert.match(workspace, /kwantdesk:liquidity-map-preferences-changed[\s\S]*?kwantdesk:preferences-changed/);
});

test("liquidity-map tab deletion keeps the outer workspace instrument in sync", async () => {
  const [source, workspace] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(workspacePath, "utf8"),
  ]);

  assert.match(source, /type:\s*'kwantdesk:liquidity-map-preferences-changed'[\s\S]*?active:\s*this\.symbol/);
  assert.match(workspace, /event\.data\.active[\s\S]*?kwantdesk:liquidity-map-instrument:v1/);
  assert.match(workspace, /if \(isReady\) syncInstrument\(\)/);
  assert.doesNotMatch(workspace, /onLoad=\{\(\) => \{[\s\S]{0,180}syncInstrument\(\)/);
  assert.match(source, /if \(symbol && symbol !== this\.symbol\) this\.#addInstrumentTab\(symbol, false\)/);
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
  assert.match(source, /INSTRUMENT_ORDER = \[\.\.\.LIQUIDITY_MAP_ROOTS\]/);
  assert.match(source, /#loadInstrumentCatalog/);
  assert.match(source, /this\.availableInstrumentSymbols\.has\(symbol\)/);
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

test("ES uses its own one-tick price viewport and visual holds do not enter history", async () => {
  const [symbols, source] = await Promise.all([
    readFile(new URL("../public/heatmap-app/src/market-simulator.js", import.meta.url), "utf8"),
    readFile(new URL("../public/heatmap-app/src/main.js", import.meta.url), "utf8"),
  ]);
  assert.match(symbols, /instrument\('ES',[\s\S]*?defaultVisibleRows: 45/);
  assert.match(symbols, /instrument\('NQ',[\s\S]*?depthRangePoints: 100/);
  assert.match(source, /if \(metadata\.visualHold\)[\s\S]*?updateLivePresentationEdge/);
  assert.match(source, /this\.view\.visibleRows = SYMBOLS\[symbol\]\.defaultVisibleRows \|\| 112/);
});

test("CVD header controls remain contained beside the live market rail", async () => {
  const css = await readFile(embedCssPath, "utf8");

  assert.match(css, /\.cvd-panel header\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(css, /\.cvd-header-controls\s*\{[\s\S]*?max-width:\s*calc\(100% - 128px\);/);
  assert.match(css, /#cvdStyleButton\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
  assert.match(css, /#cvdLegend\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;/);
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
  assert.match(css, /\.inspector-panel\s*\{[\s\S]*?padding-top:\s*42px;[\s\S]*?font-family:\s*"Inter"/);
});

test("inspector uses one toolbar navigation and themed custom dropdowns", async () => {
  const [html, source, css] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(mainPath, "utf8"),
    readFile(embedCssPath, "utf8"),
  ]);

  assert.doesNotMatch(html, /class="inspector-tabs"/);
  assert.match(source, /#enhanceInspectorSelects\(\)/);
  assert.match(source, /className = 'kwant-select-trigger'/);
  assert.match(css, /\.kwant-select-trigger\s*\{[\s\S]*?font:\s*500 11px "Inter"/);
  assert.match(css, /\.kwant-select-menu\s*\{[\s\S]*?background:\s*color-mix/);
  assert.doesNotMatch(html, /Linked to Website Settings/);
  assert.doesNotMatch(html, /id="uiThemeSelect"/);
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

test("wheel input over the time rail stretches only the horizontal time axis", async () => {
  const html = await readFile(htmlPath, "utf8");
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /#isTimeAxisPoint\(point\)[\s\S]*?point\.y >= layout\.plotHeight[\s\S]*?point\.y <= layout\.plotHeight \+ layout\.timeAxisHeight/);
  assert.match(source, /if \(this\.#isTimeAxisPoint\(point\)\)[\s\S]*?\{ price: false, time: true \}/);
  assert.match(html, /Time scale \+ wheel<\/kbd><span>Stretch time axis only/);
});

test("auto-center keeps live price as the true viewport target", async () => {
  const [source, renderer] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(rendererPath, "utf8"),
  ]);

  assert.match(source, /if \(this\.settings\.autoCenter && wasAtLive\) this\.view\.centerTick = null;/);
  assert.match(source, /if \(this\.settings\.autoCenter && this\.atLive\) this\.view\.centerTick = null;/);
  assert.doesNotMatch(source, /recenterThreshold|drift \* 0\.42/);
  assert.match(renderer, /const liveTick = Number\(current\.lastTick\);[\s\S]*?const targetCenterTick = view\.centerTick \?\? \(Number\.isFinite\(liveTick\) && liveTick > 0[\s\S]*?liveTick[\s\S]*?: current\.midTick\);/);
  assert.match(renderer, /const autoCenterLocked = settings\.autoCenter[\s\S]*?const centerTick = autoCenterLocked[\s\S]*?\? this\.#smoothCameraCenter\(targetCenterTick, true\)/);
  assert.match(renderer, /const bottomTick = centerTick - visibleTickSpan \/ 2;[\s\S]*?const topTick = centerTick \+ visibleTickSpan \/ 2;/);
});

test("auto-center keeps the marker fixed while the price plane follows smoothly", async () => {
  const [source, renderer] = await Promise.all([
    readFile(mainPath, "utf8"),
    readFile(rendererPath, "utf8"),
  ]);

  assert.match(renderer, /\? this\.#smoothCameraCenter\(targetCenterTick, true\)/);
  assert.match(source, /const lockedCenterY = this\.settings\.autoCenter && this\.atLive[\s\S]*?plotHeight[\s\S]*?\/ 2/);
  assert.match(source, /#presentLiveCamera\(timestamp\)[\s\S]*?Never translate the shared canvas/);
  assert.match(source, /if \(canvas\?\.style\.transform\) canvas\.style\.transform = ''/);
  assert.doesNotMatch(source, /canvas\.style\.transform = transform/);
  assert.match(source, /switchSymbol\(symbol\)[\s\S]*?this\.renderer\.resetCamera\(\)/);
  assert.doesNotMatch(source, /timestamp - this\.lastCanvasPaintAt >= 1000 \/ 30/);
});

test("every liquidity-map load and instrument switch starts auto-centered", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /this\.#restoreSettings\(\);[\s\S]*?this\.settings\.autoCenter = true;[\s\S]*?this\.view\.centerTick = null;/);
  assert.match(source, /switchSymbol\(symbol\)[\s\S]*?this\.settings\.autoCenter = true;[\s\S]*?\$\('autoCenter'\)\.checked = true;[\s\S]*?this\.view\.centerTick = null;/);
  assert.match(source, /allowed\.delete\('autoCenter'\)/);
  assert.match(source, /delete saved\.autoCenter/);
});

test("dragging and zooming cannot break an enabled auto-center lock", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /this\.drag\?\.mode === 'price-pan'[\s\S]*?if \(this\.settings\.autoCenter\) \{[\s\S]*?this\.view\.centerTick = null;[\s\S]*?\} else \{[\s\S]*?panPriceCenter/);
  assert.match(source, /this\.drag\?\.mode === 'pan'[\s\S]*?if \(this\.settings\.autoCenter\) \{[\s\S]*?this\.view\.centerTick = null;[\s\S]*?\} else \{/);
  assert.match(source, /if \(price\)[\s\S]*?if \(this\.settings\.autoCenter\) \{[\s\S]*?this\.view\.centerTick = null;[\s\S]*?\} else if \(anchorTick/);
  assert.doesNotMatch(source, /this\.settings\.autoCenter = false/);
  assert.doesNotMatch(source, /\$\('autoCenter'\)\.checked = false/);
});

test("refresh and drag always snap an enabled auto-center back to live price", async () => {
  const source = await readFile(mainPath, "utf8");

  assert.match(source, /window\.addEventListener\('pageshow',[\s\S]*?if \(this\.settings\.autoCenter\) this\.goLive\(\)/);
  assert.match(source, /#syncHeatmapControls\(\) \{[\s\S]*?\$\('autoCenter'\)\.checked = Boolean\(this\.settings\.autoCenter\)/);
  assert.match(source, /this\.drag\?\.mode === 'pan'[\s\S]*?this\.settings\.autoCenter[\s\S]*?this\.viewEnd = this\.history\.length - 1;[\s\S]*?this\.atLive = true;/);
  assert.match(source, /#pointerUp\(event\)[\s\S]*?if \(this\.settings\.autoCenter\) this\.goLive\(\)/);
  assert.match(source, /#panHistory\(columnShift\)[\s\S]*?if \(this\.settings\.autoCenter\) \{[\s\S]*?this\.goLive\(\);[\s\S]*?return;/);
});

test("embedded map omits intrusive feed and latency overlays", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.doesNotMatch(html, /id=["']sourceBanner["']/);
  assert.doesNotMatch(html, /id=["']latencyLabel["']/);
  assert.doesNotMatch(html, /Live .*depth-by-order.*full resting book.*trading disabled/i);
});

test("liquidity map stops at the global right-rail boundary", async () => {
  const [workspace, shell] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(workspaceShellPath, "utf8"),
  ]);

  assert.match(workspace, /isolate[^"]*min-w-0[^"]*max-w-full[^"]*overflow-hidden[^"]*\[contain:layout_paint_size\]/);
  assert.match(workspace, /<iframe[\s\S]*?className="[^"]*min-w-0[^"]*max-w-full/);
  assert.match(shell, /ref=\{mainRef\}[\s\S]*?AppSidebar/);
  assert.match(shell, /className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden" ref=\{mainRef\}/);
  assert.match(shell, /relative isolate min-h-0 min-w-0 flex-1 overflow-hidden bg-panel/);
  assert.match(shell, /relative z-40 w-\[44px\] shrink-0/);
});
