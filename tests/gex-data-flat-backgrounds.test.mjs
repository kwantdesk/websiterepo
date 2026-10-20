import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("empty docks and populated tool surfaces use the exact live host background",()=>{
  const css=read("public/gex-data-app/site.css");
  const flatRule=css.match(/(html,body,\.app-shell,\.dashboard,\.dock-body,\.dock-tool-frame,[\s\S]*?)\{\s*background:var\(--site-background\)!important;([^}]+)\}/);
  assert.ok(flatRule,"a flat background shorthand must clear inherited gradient images");
  for(const selector of ['.dock-body','.dock-tool-frame','.tool-workspace','.tool-stage','.tool-visual','.quant-chart-shell','.quant-chart-plot','.stats-visual','.side-stat-visual','.share-visual','.stat-ring-card','.summary-card','.picker-preview'])assert.ok(flatRule[1].includes(selector),selector);
  for(const declaration of ['backdrop-filter:none!important','-webkit-backdrop-filter:none!important','box-shadow:none!important'])assert.ok(flatRule[2].includes(declaration),declaration);
  assert.doesNotMatch(flatRule[0],/#(?:000|fff)|rgba?\(|gradient\(/i);
  assert.doesNotMatch(flatRule[1],/\*|\.stat-ring(?:,|\s)|canvas/);
});

test("flat host overrides load after reference gradients, with a fresh stylesheet URL",()=>{
  const html=read("public/gex-data-app/index.html");
  const site=html.indexOf('/gex-data-app/site.css?v=6');
  assert.ok(site>html.indexOf('/gex-data-app/styles.css'));
  assert.ok(site>html.indexOf('/gex-data-app/workspace.css'));
  const theme=read("public/gex-data-app/site-theme.js");
  assert.match(theme,/for\(const\[key,value\]of Object.entries\(palette\)\)document.documentElement.style.setProperty\('--site-'\+key,value\)/);
  // Financial series/rings still encode real data; they are not page decoration.
  assert.match(read("public/gex-data-app/equity-renderers.js"),/ctx\.createLinearGradient/);
  assert.match(read("public/gex-data-app/styles.css"),/\.stat-ring \{[^}]*conic-gradient/);
});
