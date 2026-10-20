import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {showWorkspaceLoading} from '../public/workspace-loading.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('embedded loader safely renders the standard themed emblem, without mounting repeatedly',()=>{
  const original=globalThis.document;let creates=0;
  globalThis.document={createElement:()=>{creates++;return {className:'',attributes:{},title:{},setAttribute(key,value){this.attributes[key]=value;},querySelector(){return this.title;},classList:{contains:()=>true}};}};
  try{
    const target={dataset:{},replaceChildren(child){this.firstElementChild=child;}};
    showWorkspaceLoading(target,'Loading <example>');
    assert.equal(target.firstElementChild.title.textContent,'Loading <example>');
    assert.doesNotMatch(target.firstElementChild.innerHTML,/<example>/);
    assert.equal(target.firstElementChild.attributes['aria-busy'],'true');
    assert.match(target.firstElementChild.innerHTML,/site-loader-orbit/);
    showWorkspaceLoading(target,'Loading <example>');assert.equal(creates,1);
    showWorkspaceLoading(target,'Loading chart');assert.equal(creates,2);
    const css=read('public/workspace-loading.css');
    for(const token of ['width:40px;height:40px','3.4s','2.8s','2.2s','--site-background','prefers-reduced-motion:reduce'])assert.ok(css.includes(token));
  }finally{globalThis.document=original;}
});

test('KWANTY hides the loader for real data and replaces it with genuine errors',()=>{
  const app=read('public/kwanty-app/app.js'),code=app.slice(app.indexOf('function renderChartEmpty()'),app.indexOf('function resetSelection()'));
  const target={hidden:false,textContent:''},context={state:{payload:null,sourceError:null},$:()=>target,showWorkspaceLoading:(_,title)=>target.textContent=title};
  vm.runInNewContext(code+';globalThis.render=renderChartEmpty;',context);
  context.render();assert.equal(target.textContent,'Loading KWANTY');assert.equal(target.hidden,false);
  context.state.payload={real:true};context.render();assert.equal(target.hidden,true);
  context.state.payload=null;context.state.sourceError='Connection unavailable';context.render();
  assert.equal(target.hidden,false);assert.equal(target.textContent,'Data unavailable — Connection unavailable');
  assert.match(app,/catch\(error\)\{state\.sourceError=error\.message;renderChartEmpty\(\);updateHealth/);
});

test('embedded data loaders stay standard while React page startup has no splash',()=>{
  for(const path of ['public/gex-data-app/app.js','public/gex-data-app/index.html','public/kwanty-app/app.js','public/kwanty-app/index.html','public/kwanty-app/overlay-editor.js'])assert.doesNotMatch(read(path),/(?:Loading|Connecting to)[^'"\n]{0,45}licensed/i);
  for(const path of ['public/gex-data-app/index.html','public/kwanty-app/index.html'])assert.match(read(path),/workspace-loading\.css/);
  assert.doesNotMatch(read('src/components/kwanty/KwantyWorkspace.tsx'),/KwantLoader|Loading KWANTY|Loading calendar/);
  const context={document:{documentElement:{style:{setProperty(){}}}},location:{search:'',pathname:'/kwanty-app/index.html'},URLSearchParams};
  context.window={__kwantyHost:{theme:()=>({background:'#fefefe',foreground:'#111111'})}};
  vm.runInNewContext(read('public/gex-data-app/site-bootstrap.js'),context);
  assert.equal(context.document.documentElement.style.backgroundColor,'#fefefe');
});
