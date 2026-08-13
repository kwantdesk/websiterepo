import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const liquidityEmbedCss = fs.readFileSync(
  new URL("../public/heatmap-app/embed.css", import.meta.url),
  "utf8",
);
const gexMapSource = fs.readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url),
  "utf8",
);

test("embedded liquidity map rows follow the shared 36px workspace rhythm", () => {
  assert.match(liquidityEmbedCss, /grid-template-rows:\s*36px 36px minmax\(0, 1fr\)/);
  assert.match(liquidityEmbedCss, /\.app-bar\s*\{[\s\S]*?height:\s*36px;[\s\S]*?min-height:\s*36px;/);
  assert.match(liquidityEmbedCss, /\.top-deck\s*\{[\s\S]*?height:\s*36px;/);
  assert.match(liquidityEmbedCss, /\.tool-rail\s*\{[\s\S]*?height:\s*35px;/);
});

test("GEX map internal control rail uses the shared 36px workspace height", () => {
  assert.match(gexMapSource, /gex-map-header[^\n]*h-9 min-h-9/);
  assert.doesNotMatch(gexMapSource, /gex-map-header[^\n]*min-h-\[48px\]/);
  assert.match(gexMapSource, /gex-map-frame-steps[^\n]*h-7/);
});
