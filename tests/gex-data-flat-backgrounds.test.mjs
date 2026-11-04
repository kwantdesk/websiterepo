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

test("versioned flat host overrides load after every reference gradient stylesheet",()=>{
  const html=read("public/gex-data-app/index.html");
  const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map(match=>({url:new URL(match[1],'https://fixture.invalid'),index:match.index}));
  const site=styles.find(item=>item.url.pathname==='/gex-data-app/site.css');assert.ok(site,'host theme stylesheet is required');
  assert.ok(site.url.searchParams.get('v'),'host CSS must have a cache-busting revision, without pinning its literal value');
  for(const path of ['/gex-data-app/styles.css','/gex-data-app/workspace.css']){
    const reference=styles.find(item=>item.url.pathname===path);assert.ok(reference,path);assert.ok(site.index>reference.index,`${path} must load before the host overrides`);
  }
  const theme=read("public/gex-data-app/site-theme.js");
  assert.match(theme,/for\(const\[key,value\]of Object.entries\(palette\)\)document.documentElement.style.setProperty\('--site-'\+key,value\)/);
  // Financial series/rings still encode real data; they are not page decoration.
  assert.match(read("public/gex-data-app/equity-renderers.js"),/ctx\.createLinearGradient/);
  assert.match(read("public/gex-data-app/styles.css"),/\.stat-ring \{[^}]*conic-gradient/);
});

test('filter row shares the flat background and vertically centres controls and actions',()=>{
  const css=read('public/gex-data-app/site.css');
  assert.match(css,/\.panel,\.tool-workspace,\.tool-controls,\.tool-stage/);
  assert.match(css,/\.embedded \.tool-controls\{[^}]*box-sizing:border-box;align-items:center/);
  assert.match(css,/\.embedded \.tool-controls>\.control,\.embedded \.tool-controls>\.embedded-actions\{align-items:center;align-self:center\}/);
  assert.match(css,/\.embedded \.embedded-actions button\{[^}]*height:24px;min-height:24px;line-height:1/);
  assert.match(css,/\.embedded \.tool-controls>\.embedded-actions\{margin-left:0;gap:5px;flex:0 0 auto\}/);
  assert.match(css,/\.embedded-actions button\{background:var\(--site-surface\)!important;color:var\(--site-foreground\)!important;border:1px solid var\(--site-border\)!important;border-radius:3px!important/);
});
