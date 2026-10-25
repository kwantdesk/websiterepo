import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { isWorkspaceFeatureArchived, activeWorkspaceSection } from '../src/lib/archivedWorkspaceFeatures.ts';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('archive is exact, reversible and preserves unrelated options/trading/journal features',()=>{
 for(const feature of ['gameplan','zyon','optionstape']) {
  assert.equal(isWorkspaceFeatureArchived(feature),true);
  assert.equal(activeWorkspaceSection(feature),'charts');
 }
 for(const feature of ['charts','kwanty','gexdata','gamma','gexmap','order','watchlist','kwantbot','journal','alerts','friends','messages']) {
  assert.equal(isWorkspaceFeatureArchived(feature),false);
  assert.equal(activeWorkspaceSection(feature),feature);
 }
 assert.equal(isWorkspaceFeatureArchived(null),false);
});

test('both primary nav orientations, home and Add panel picker omit archived entries',()=>{
 const nav=read('src/components/AppSidebar.tsx'),home=read('src/components/WorkspaceHome.tsx'),workspace=read('src/components/KwantifyWorkspace.tsx');
 assert.equal((nav.match(/navItems.filter\(item => !isWorkspaceFeatureArchived\(item.key\)\)/g)||[]).length,2);
 assert.match(home,/destinations.filter\(destination => !isWorkspaceFeatureArchived\(destination.href.slice\(1\)\)\)/);
 assert.match(workspace,/WORKSPACE_PANEL_OPTIONS.filter\(option => !isWorkspaceFeatureArchived\(option.id\)\)/);
 assert.match(workspace,/title: "Options Tape"[\s\S]{0,350}filter\(item => !isWorkspaceFeatureArchived\(item.id\)\)/);
});

test('saved sidebar state and old routes cannot silently reactivate archived features',()=>{
 const workspace=read('src/components/KwantifyWorkspace.tsx'),layout=read('src/app/(workspace)/layout.tsx');
 assert.match(workspace,/saved !== null && !isWorkspaceFeatureArchived\(saved\)/);
 for(const [fn,arg] of [['toggleRightPanel','panel'],['reopenRightPanel','lastOpenRightPanel'],['selectWorkspacePanelContent','content'],['preloadWorkspaceModule','section']])
  assert.match(workspace,new RegExp(fn+'[^\\n]*\\{\\r?\\n\\s*if \\(isWorkspaceFeatureArchived\\('+arg+'\\)\\) return'));
 assert.match(workspace,/function renderEmbeddedWorkspace\(pane: WorkspacePane\) \{\s*if \(isWorkspaceFeatureArchived\(pane.content\)\)/);
 assert.match(layout,/section: activeWorkspaceSection\(direct\)/);
 assert.match(layout,/isWorkspaceFeatureArchived\(SECTION_BY_PATH\[pathname\]\)\) router.replace\("\/charts"\)/);
});

test('archiving retains implementations, routes, APIs and storage contracts for later restoration',()=>{
 for(const path of ['src/app/(workspace)/gameplan/page.tsx','src/app/(workspace)/zyon/page.tsx','src/components/gameplan/GameplanWorkspace.tsx','src/components/zyon/ZyonWorkspace.tsx','src/components/KwantifyWorkspace.tsx'])
  assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,path);
 const workspace=read('src/components/KwantifyWorkspace.tsx');
 assert.match(workspace,/case "zyon":/);assert.match(workspace,/case "gameplan":/);
 assert.match(workspace,/rightPanel === "optionstape"/);assert.match(workspace,/saved settings are preserved/);
 assert.doesNotMatch(read('src/lib/archivedWorkspaceFeatures.ts'),/removeItem|clear\(|fetch\(/);
});

test('actual primary navigation renders without Gameplan or Zyon in both orientations',()=>{
 const require=createRequire(import.meta.url),ts=require('typescript');
 const code=ts.transpileModule(read('src/components/AppSidebar.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 const localRequire=id=>id==='@/lib/archivedWorkspaceFeatures'?{isWorkspaceFeatureArchived}:id==='@/components/HighImpactNewsChip'?{__esModule:true,default:()=>null}:id.startsWith('@/lib/')?{}:require(id);
 vm.runInNewContext(code,{require:localRequire,module,exports:module.exports});
 for(const orientation of ['vertical','horizontal']) {
  const html=renderToStaticMarkup(React.createElement(module.exports.default,{activeItem:'charts',orientation}));
  assert.doesNotMatch(html,/href="\/(?:gameplan|zyon)"/);
  for(const route of ['/charts','/kwanty','/gamma','/journal'])assert.ok(html.includes('href="'+route+'"'),route);
 }
});
