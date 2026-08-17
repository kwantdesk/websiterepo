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
  assert.match(bouncePrimitive, /const maximumVisibleSlices = Math\.max\(96, Math\.min\(360, Math\.floor\(mediaSize\.width \/ 3\)\)\)/);
  assert.match(bouncePrimitive, /const maximumStops = 48/);
  assert.match(bouncePrimitive, /const detailedRendering = prepared\.length <= 2_200/);
  assert.match(bouncePrimitive, /data\.microOrbTexture && prepared\.length <= 1_600/);
});

test("identical Bounce panels share refresh work and Dark Pool mutates only live price", () => {
  const signatureBlock = chart.match(/const bounceLevelsDataSignature = bounceLevelsIndicator \? JSON\.stringify\(\{[\s\S]*?\}\) : "";/)?.[0] ?? "";
  assert.doesNotMatch(signatureBlock, /instanceId/);
  assert.match(chart, /window\.setTimeout\(\(\) => void load\(false\), refreshMs\)/);
  assert.match(darkPoolPrimitive, /updateCurrentPrice\(price: number \| null\)/);
});
