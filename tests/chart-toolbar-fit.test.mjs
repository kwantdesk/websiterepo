import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
test('toolbar scrollports explicitly reserve their full vertical lane and beat the global scrollbar rule',()=>{
 const rule=css.match(/\.kwant-chart-toolbar-shell \.kwant-chart-toolbar-scrollport\s*\{([^}]+)\}/)?.[1];
 assert.ok(rule);for(const pattern of [/height:\s*var\(--kwant-shell-bar-height\)/,/overflow-x:\s*auto/,/overflow-y:\s*hidden/,/scrollbar-width:\s*none/])assert.match(rule,pattern);
 assert.match(css,/\.kwant-chart-toolbar-scrollport::-webkit-scrollbar\s*\{\s*display:\s*none;\s*width:\s*0;\s*height:\s*0;/);
});
test('tracks retain natural horizontal width while every button fits the 36px lane',()=>{
 assert.match(css,/\.kwant-chart-toolbar-track\s*\{[^}]*flex:\s*0 0 auto;[^}]*width:\s*max-content;[^}]*height:\s*28px;[^}]*white-space:\s*nowrap;/);
 assert.match(css,/\.kwant-chart-toolbar-track button\s*\{[^}]*flex-shrink:\s*0;[^}]*height:\s*28px;[^}]*min-height:\s*28px;[^}]*max-height:\s*28px;[^}]*padding-block:\s*0;/);
});
test('available workspace width controls two-row and phone layouts, not device width',()=>{
 assert.match(source,/<div className="kwant-chart-toolbar-shell shrink-0">\s*<header/);
 assert.match(css,/container:\s*chart-toolbar \/ inline-size;/);
 assert.match(css,/@container chart-toolbar \(max-width: 1279px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?\.kwant-chart-shortcuts \{ grid-column: 1 \/ -1; grid-row: 1; \}/);
 assert.match(css,/@container chart-toolbar \(max-width: 640px\)[\s\S]*?repeat\(3, var\(--kwant-shell-bar-height\)\)[\s\S]*?\.kwant-chart-actions \{ grid-column: 1; grid-row: 3; \}/);
 assert.doesNotMatch(css,/grid-template-columns:\s*repeat\(3, max-content\)/);
});
test('end alignment does not make leading controls unreachable on overflow',()=>{
 assert.match(css,/\.kwant-chart-actions > \.kwant-chart-toolbar-track \{ margin-inline-start: auto; \}/);
 assert.match(source,/kwant-chart-actions kwant-chart-toolbar-scrollport[^\n]*overflow-x-auto/);
 assert.doesNotMatch(source,/kwant-chart-actions[^\n]*justify-end/);
});
test('interval, workspace and timezone menus remain outside the clipping lanes',()=>{
 assert.match(source,/showAllTF && timeframeMenuAnchor[^\n]*createPortal\(/);
 assert.match(source,/timeframePanelRef\.current\?\.contains\(target\)/);
 assert.match(source,/CHART_TIME_ZONE_TRIGGER_CLASS_NAME/);
 assert.match(source,/kwant-chart-layout-controls[\s\S]*?positionWorkspacePresetMenu\(\)/);
});
