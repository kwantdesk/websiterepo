import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [middleware, workspace, html, styles, embed, themes] = await Promise.all([
  fs.readFile(new URL("middleware.ts", root), "utf8"),
  fs.readFile(new URL("src/components/liquidity-map/LiquidityMapWorkspace.tsx", root), "utf8"),
  fs.readFile(new URL("public/heatmap-app/index.html", root), "utf8"),
  fs.readFile(new URL("public/heatmap-app/styles.css", root), "utf8"),
  fs.readFile(new URL("public/heatmap-app/embed.css", root), "utf8"),
  fs.readFile(new URL("public/heatmap-app/src/ui-themes.js", root), "utf8"),
]);

test("the static liquidity-map presentation bundle bypasses auth middleware", () => {
  assert.match(middleware, /heatmap-app\//);
  assert.match(middleware, /Live data still comes from protected \/api routes/);
});

test("embedded liquidity map is not revealed until both stylesheets are attached", () => {
  assert.match(workspace, /\/heatmap-app\/styles\.css/);
  assert.match(workspace, /\/heatmap-app\/embed\.css/);
  assert.match(workspace, /revealWhenStyled/);
  assert.doesNotMatch(workspace, /event\.data\?\.type === "kwantdesk:liquidity-map-ready"[\s\S]{0,700}setIsReady\(true\)/);
});

test("liquidity-map styles use a cache-busted deployment revision", () => {
  assert.match(workspace, /src="\/heatmap-app\/index\.html"/);
  assert.match(html, /styles\.css\?v=20260813-cockpit-font/);
  assert.match(html, /embed\.css\?v=20260813-cockpit-font/);
});

test("liquidity-map UI controls use the current cockpit typography", () => {
  const cockpitFont = /--font-ui:\s*["']?Rajdhani/;
  assert.match(styles, cockpitFont);
  assert.match(embed, cockpitFont);
  assert.match(themes, /'--font-ui':\s*'"Rajdhani"/);
  assert.match(html, /'--font-ui':\s*'"Rajdhani"/);
  const embeddedRules = embed.slice(embed.indexOf("html[data-embed=\"true\"] body"));
  assert.doesNotMatch(embeddedRules, /font-family:\s*"Inter"/);
  assert.doesNotMatch(embeddedRules, /font:\s*[^;]*"Inter"/);
});
