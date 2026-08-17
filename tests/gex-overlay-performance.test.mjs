import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chart = await readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const bouncePrimitive = await readFile(new URL("../src/lib/bounceLevelsPrimitive.ts", import.meta.url), "utf8");
const darkPoolPrimitive = await readFile(new URL("../src/lib/darkPoolGexPrimitive.ts", import.meta.url), "utf8");

test("GEX overlays keep full-history analytics off the live tick path", () => {
  assert.match(chart, /const overlayTimelineKey = `\$\{candles\.length\}/);
  assert.match(chart, /const darkPoolGexPriceSamples = useMemo/);
  assert.match(chart, /\[overlayTimelineKey, timeframe\]/);
  const frameBlock = chart.slice(
    chart.indexOf("const darkPoolGexFrame = useMemo"),
    chart.indexOf("const darkPoolGexCurrentPrice"),
  );
  assert.doesNotMatch(frameBlock, /\[candles,/);
  assert.match(frameBlock, /darkPoolGexPriceSamples/);
  assert.match(chart, /updateCurrentPrice\(darkPoolGexCurrentPrice\)/);
});

test("Bounce Levels uses pixel-aware detail and bounded gradients", () => {
  assert.match(bouncePrimitive, /activePanelCount >= 4/);
  assert.match(bouncePrimitive, /Math\.min\(180, Math\.floor\(mediaSize\.width \/ 5\)\)/);
  assert.match(bouncePrimitive, /const maximumGradientStops = activePanelCount >= 4 \? 20/);
  assert.match(bouncePrimitive, /const detailedRendering = activePanelCount <= 2 && prepared\.length <= 2_200/);
  assert.match(bouncePrimitive, /data\.microOrbTexture && activePanelCount === 1 && prepared\.length <= 1_600/);
});

test("Bounce Levels composites a retained render layer instead of rebuilding it on every market tick", () => {
  assert.match(bouncePrimitive, /const cachedLayer = this\.primitive\.cachedLayer\(layerKey\)/);
  assert.match(bouncePrimitive, /targetContext\.drawImage/);
  assert.match(bouncePrimitive, /this\.primitive\.storeLayer\(layerKey, layer\.canvas, viewport\)/);
  assert.match(bouncePrimitive, /private renderRevision = 0/);
  assert.match(bouncePrimitive, /pixelBudgetRatio/);
});

test("Bounce Levels transforms its retained layer throughout pan and zoom gestures", () => {
  assert.match(bouncePrimitive, /const transformedLayer = this\.primitive\.transformedLayer\(viewport\)/);
  assert.match(bouncePrimitive, /targetContext\.translate\(transformedLayer\.translateX, transformedLayer\.translateY\)/);
  assert.match(bouncePrimitive, /targetContext\.scale\(transformedLayer\.scaleX, transformedLayer\.scaleY\)/);
  assert.match(bouncePrimitive, /this\.primitive\.scheduleRefinement\(layerKey\)/);
  assert.match(bouncePrimitive, /this\.refinementKey === key/);
  assert.match(bouncePrimitive, /}, 120\)/);
});

test("identical Bounce panels share refresh work and Dark Pool mutates only live price", () => {
  const signatureBlock = chart.match(/const bounceLevelsDataSignature = bounceLevelsIndicator \? JSON\.stringify\(\{[\s\S]*?\}\) : "";/)?.[0] ?? "";
  assert.doesNotMatch(signatureBlock, /instanceId/);
  assert.match(chart, /window\.setTimeout\(\(\) => void load\(false\), refreshMs\)/);
  assert.match(darkPoolPrimitive, /updateCurrentPrice\(price: number \| null\)/);
});
