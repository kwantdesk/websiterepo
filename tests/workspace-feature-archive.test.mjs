import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { isWorkspaceFeatureArchived, isRightPanelArchived, activeWorkspaceSection } from '../src/lib/archivedWorkspaceFeatures.ts';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('archive is exact, reversible and preserves unrelated options/trading/journal features',()=>{
 for(const feature of ['gameplan','zyon','optionstape','kwanty']) {
  assert.equal(isWorkspaceFeatureArchived(feature),true);
  assert.equal(activeWorkspaceSection(feature),'charts');
 }
 for(const feature of ['charts','gexdata','gamma','gexmap','order','watchlist','kwantbot','journal','alerts','friends','messages']) {
  assert.equal(isWorkspaceFeatureArchived(feature),false);
  assert.equal(activeWorkspaceSection(feature),feature);
 }
 assert.equal(isWorkspaceFeatureArchived(null),false);
});

test('Kwant Bot is archived only in the right sidebar',()=>{
 assert.equal(isRightPanelArchived('kwantbot'),true);
 assert.equal(isRightPanelArchived('optionstape'),true);
 assert.equal(isRightPanelArchived('watchlist'),false);
 assert.equal(activeWorkspaceSection('kwantbot'),'kwantbot');
});

test('both primary nav orientations, home and Add panel picker omit archived entries',()=>{
 const nav=read('src/components/AppSidebar.tsx'),home=read('src/components/WorkspaceHome.tsx'),workspace=read('src/components/KwantifyWorkspace.tsx');
 assert.equal((nav.match(/navItems.filter\(item => !isWorkspaceFeatureArchived\(item.key\)\)/g)||[]).length,3);
 assert.match(home,/destinations.filter\(destination => !isWorkspaceFeatureArchived\(destination.href.slice\(1\)\)\)/);
 const pickerOrder = workspace.match(/const WORKSPACE_PICKER_ORDER = \[([^\]]+)\]/)?.[1];
 assert.ok(pickerOrder);
 assert.doesNotMatch(pickerOrder, /"(?:gameplan|zyon|kwanty|optionstape)"/);
 assert.match(workspace, /WORKSPACE_PICKER_ORDER.map/);
 assert.match(workspace,/id: "kwantbot" as const[\s\S]{0,350}filter\(item => !isRightPanelArchived\(item.id\)\)/);
});

test('saved sidebar state and old routes cannot silently reactivate archived features',()=>{
 const workspace=read('src/components/KwantifyWorkspace.tsx'),layout=read('src/app/(workspace)/layout.tsx');
 assert.match(workspace,/saved !== null && !isRightPanelArchived\(saved\)/);
 for(const [fn,arg,guard] of [['toggleRightPanel','panel','isRightPanelArchived'],['reopenRightPanel','lastOpenRightPanel','isRightPanelArchived'],['selectWorkspacePanelContent','content','isWorkspaceFeatureArchived'],['preloadWorkspaceModule','section','isWorkspaceFeatureArchived']])
  assert.match(workspace,new RegExp(fn+'[^\\n]*\\{\\r?\\n\\s*if \\('+guard+'\\('+arg+'\\)\\) return'));
 assert.match(workspace,/function renderEmbeddedWorkspace\(pane: WorkspacePane\) \{\s*if \(isWorkspaceFeatureArchived\(pane.content\)\)/);
 assert.match(layout,/section: activeWorkspaceSection\(direct\)/);
 assert.match(layout,/isWorkspaceFeatureArchived\(SECTION_BY_PATH\[activePath\]\)\) router.replace\("\/charts"\)/);
});

test('archiving retains implementations, routes, APIs and storage contracts for later restoration',()=>{
 for(const path of ['src/app/(workspace)/gameplan/page.tsx','src/app/(workspace)/zyon/page.tsx','src/app/(workspace)/kwanty/page.tsx','src/components/kwanty/KwantyWorkspace.tsx','src/components/gameplan/GameplanWorkspace.tsx','src/components/zyon/ZyonWorkspace.tsx','src/components/KwantifyWorkspace.tsx'])
  assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,path);
 const workspace=read('src/components/KwantifyWorkspace.tsx');
 assert.match(workspace,/case "zyon":/);assert.match(workspace,/case "gameplan":/);
 assert.match(workspace,/rightPanel === "optionstape"/);assert.match(workspace,/saved settings are preserved/);
 assert.doesNotMatch(read('src/lib/archivedWorkspaceFeatures.ts'),/removeItem|clear\(|fetch\(/);
});

test('actual primary navigation renders without archived pages in desktop and mobile menus',()=>{
 const require=createRequire(import.meta.url),ts=require('typescript');
 const code=ts.transpileModule(read('src/components/AppSidebar.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 const localRequire=id=>id==='@/lib/archivedWorkspaceFeatures'?{isWorkspaceFeatureArchived}:id==='next/navigation'?{useRouter:()=>({prefetch(){},push(){}})}:id==='@/components/MobileWorkspaceNavigation'?{__esModule:true,default:({items})=>React.createElement('nav',{},items.map(item=>React.createElement('a',{key:item.key,href:item.href},item.label)))}:id==='@/components/HighImpactNewsChip'?{__esModule:true,default:()=>null}:id.startsWith('@/lib/')?{}:require(id);
 vm.runInNewContext(code,{require:localRequire,module,exports:module.exports});
 for(const orientation of ['vertical','horizontal']) {
  const html=renderToStaticMarkup(React.createElement(module.exports.default,{activeItem:'charts',orientation}));
  assert.doesNotMatch(html,/href="\/(?:gameplan|zyon|kwanty)"/);
  for(const route of ['/charts','/gamma','/journal'])assert.ok(html.includes('href="'+route+'"'),route);
 }
});

test('removed Kwanty route redirects and is no longer warmed',()=>{assert.match(read('next.config.ts'),/source: "\/kwanty", destination: "\/charts", permanent: false/);assert.doesNotMatch(read('src/lib/workspaceNavigationWarmup.ts'),/"\/kwanty":/);});
