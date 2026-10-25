import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('public/heatmap-app/site.css'),html=read('public/heatmap-app/index.html'),workspace=read('src/components/liquidity-map/LiquidityMapWorkspace.tsx');
test('LIQ MAP shares the actual GEX DATA and KWANTY command-control dimensions and typography',()=>{
 for(const reference of ['public/gex-data-app/site.css','public/kwanty-app/site.css']){
  const source=read(reference);assert.match(source,/height:28px/);assert.match(source,/font-size:10px/);assert.match(source,/letter-spacing:\.075em/);
 }
 for(const contract of [/height: 28px/,/min-height: 28px/,/max-height: 28px/,/border-radius: 3px/,/font: 600 10px\/1 var\(--font-ui\)/,/letter-spacing: \.075em/,/stroke-width: 1.5/])assert.match(css,contract);
 assert.match(css,/grid-template-rows: 38px 38px minmax\(0, 1fr\)/);
});
test('presentation waits for the final theme stylesheet, with the existing retry mechanism retained',()=>{
 assert.match(html,/const required = new Set\(\['base', 'embed', 'site'\]\)/);
 assert.match(html,/data-liquidity-style="site"[\s\S]*?__kwantLiquidityStyleLoaded\('site'\)/);
 assert.match(html,/__kwantLiquidityStyleFailed\('site', this\)/);
 assert.match(workspace,/loadedStyleSheets.some\(\(href\) => href.includes\("\/heatmap-app\/site.css"\)\)/);
 assert.match(workspace,/index.html\?v=20261025-session-replay-exchanges/);
});
test('toolbar and popup colours follow website tokens, without decorative gradients or hardcoded ink',()=>{
 for(const token of ['--ui-bg','--ui-panel','--ui-surface','--ui-line','--ui-muted','--ui-text','--ui-accent'])assert.ok(css.includes(`var(${token})`));
 assert.doesNotMatch(css,/(?:linear|radial)-gradient\(/);assert.doesNotMatch(css,/(?:^|[;{\s])color:\s*#/m);
 assert.match(css,/backdrop-filter: none/);assert.match(css,/\.toolbar-panel-shortcuts, \.header-panel-shortcuts/);
 assert.match(css,/background: color-mix\(in srgb, var\(--ui-accent\) 8%, transparent\)/);
});
test('settings fields, checkbox alignment and popup rows match the shared options-workspace language',()=>{
 assert.match(css,/#inspector \.kwant-select-trigger[\s\S]*?font: 400 12px/);
 assert.match(css,/#inspector \.kwant-select-menu[\s\S]*?border-radius: 16px/);
 assert.match(css,/#inspector \.kwant-select-option[\s\S]*?min-height: 36px[\s\S]*?border-radius: 12px/);
 assert.match(css,/#settingsPanel > label:has\(> input\[type="checkbox"\]\)[\s\S]*?display: flex[\s\S]*?justify-content: flex-start/);
 assert.match(css,/\.inspector-header h2 \{ font: 600 11px/);
 const embed=read('public/heatmap-app/embed.css');assert.match(embed,/dialog.inspector::backdrop \{ background: rgba\(0, 0, 0, .35\)/);
});
test('configuration controls use accessible line icons, while narrow layouts keep controls reachable',()=>{
 for(const label of ['depth','signals','settings'])assert.match(html,new RegExp(`data-panel-shortcut="${label}" aria-label="[^"]+"><svg[\\s\\S]*?<span>`));
 assert.match(html,/id="newTab"[^>]*aria-label="Add instrument"><svg/);
 assert.match(css,/@media \(max-width: 520px\)[\s\S]*?\.header-panel-shortcuts button > span \{ display: none/);
 assert.match(read('public/heatmap-app/embed.css'),/overflow-x: auto/);
});
test('injected Trade control follows the same contract and styling does not alter price-rendering rules',()=>{
 const trading=read('src/components/liquidity-map/LiquidityMapTrading.tsx');
 assert.match(trading,/inline-flex h-7[\s\S]*?rounded-\[3px\][\s\S]*?text-\[10px\][\s\S]*?tracking-\[\.075em\]/);
 assert.doesNotMatch(css,/canvas\s*\{|transform:\s*(?:translate|scale)/);
 assert.doesNotMatch(css,/@import\s+url\(['"]?https?:/);
});
