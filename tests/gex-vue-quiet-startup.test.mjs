import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {themeBootstrapScript} from '../src/lib/theme.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const loaderSource=read('src/components/KwantLoader.tsx'),workspace=read('src/components/KwantifyWorkspace.tsx'),chart=read('src/components/Chart.tsx');
const code=ts.transpileModule(loaderSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const exports={};new Function('require','exports',code)(createRequire(import.meta.url),exports);
const render=props=>renderToStaticMarkup(React.createElement(exports.default,{title:'Loading chart',detail:'Internal startup detail',...props}));

test('quiet startup renders only an accessible theme surface, with no visual animation or backdrop',()=>{
 const html=render({quiet:true,className:'h-full w-full bg-chart-background'});
 assert.match(html,/data-workspace-loading="quiet"/);assert.match(html,/aria-busy="true"/);
 assert.match(html,/class="sr-only">Loading chart/);assert.match(html,/bg-chart-background/);
 assert.doesNotMatch(html,/kwant-loader|svg|Internal startup detail|animate-|transition/);
});

test('quiet startup preserves full-page dimensions and explicit custom chart backgrounds',()=>{
 for(const color of ['#ffffff','#10051f','#001b20']){
  const html=render({quiet:true,page:true,style:{backgroundColor:color}});
  assert.match(html,/min-h-\[70vh\]/);assert.ok(html.includes(`background-color:${color}`));
  assert.doesNotMatch(html,/#000000|radial-gradient|kwant-loader/);
 }
 assert.match(render({}),/kwant-loader-orbit/); // Existing non-GEX callers retain their presentation.
});

test('every GEX VUE startup phase is quiet without bypassing chart or preference readiness',()=>{
 assert.match(workspace,/workspaceLoader\("Opening charts",[^\n]+chartWorkspaceScope === "gamma"\)/);
 assert.equal((workspace.match(/quiet=\{chartWorkspaceScope === "gamma"\}/g)||[]).length,3);
 assert.match(workspace,/quietLoading=\{chartWorkspaceScope === "gamma"\}/);
 assert.match(workspace,/quietLoading=\{quietLoading\}/);
 assert.match(workspace,/data-chart-loading="true"[\s\S]{0,400}quiet=\{quietLoading\}/);
 assert.match(chart,/!chartVisualReady \? \([\s\S]{0,400}quiet=\{quietLoading\}/);
 assert.match(workspace,/loading: \(\) => workspaceLoader\("Loading chart",[^\n]+true\)/);
 assert.match(workspace,/!preferencesReady \? \(/);assert.match(workspace,/chartIsLoading \? \(/);
 assert.match(workspace,/\) : error \? \(/);
 assert.match(workspace,/data-chart-workspace-scope=\{chartWorkspaceScope\}[\s\S]{0,100}bg-chart-background/);
});

test('saved light and dark themes paint synchronously before React or animation frames run',()=>{
 for(const [background,chartBackground] of [['#ffffff','#fafafa'],['#10051f','#170829'],['#001b20','#00262d']]){
  const properties={},root={dataset:{},style:{setProperty:(key,value)=>properties[key]=value}},frames=[];
  vm.runInNewContext(themeBootstrapScript(),{document:{documentElement:root,querySelector:()=>null},localStorage:{getItem:()=>JSON.stringify({background,chartBackground})},requestAnimationFrame:callback=>frames.push(callback)});
  assert.equal(root.style.backgroundColor,background);assert.equal(properties['--background'],background);
  assert.equal(properties['--chart-background'],chartBackground);assert.equal(root.dataset.themeReady,'true');
  assert.equal(frames.length,1); // No frame had to run to resolve the palette.
 }
});
