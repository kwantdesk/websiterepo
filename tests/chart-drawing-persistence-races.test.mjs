import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createDrawing,normalizeDrawings} from '../src/lib/chartDrawTools.ts';
import {CHART_DRAWING_PREFERENCE_KEY as key,mergeChartDrawingPreferences} from '../src/lib/chartDrawingPreferences.ts';
import {mergeAccountPreferenceChanges} from '../src/lib/accountPreferenceMerge.ts';
import {hydrateUserPreferences} from '../src/lib/userPreferences.ts';

const short=createDrawing('shortPosition',[{time:100,price:100},{time:200,price:110},{time:200,price:90}]);
const line=createDrawing('trendLine',[{time:100,price:100},{time:200,price:101}]);
const store=(a=[],b=[])=>JSON.stringify({a,b});
const snapshot=value=>({version:1,complete:true,updatedAt:'2026-10-27T00:00:00Z',values:{[key]:value}});
const ids=value=>JSON.parse(value).a.map(d=>d.id).sort();
const parseSource=file=>ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const find=(source,predicate)=>{let result;const visit=node=>{if(predicate(node))result=node;ts.forEachChild(node,visit);};visit(source);return result;};

test('account sync retains independent drawings created concurrently in the same pane',()=>{
  const merged=mergeAccountPreferenceChanges(snapshot(store()),snapshot(store([short])),snapshot(store([line])));
  assert.deepEqual(ids(merged.values[key]),[short.id,line.id].sort());
});
test('editing another pane never discards a newly placed short position',()=>{
  const merged=mergeChartDrawingPreferences(store(),store([short]),store([],[line]));
  assert.deepEqual(ids(merged),[short.id]);assert.equal(JSON.parse(merged).b[0].id,line.id);
});
test('edits retain other drawings and explicit deletion does not resurrect after stale sync',()=>{
  const edited={...short,text:'edited'};
  const merged=mergeChartDrawingPreferences(store([short]),store([edited]),store([short,line]));
  assert.equal(JSON.parse(merged).a.find(d=>d.id===short.id).text,'edited');
  assert.deepEqual(ids(merged),[short.id,line.id].sort());
  assert.deepEqual(ids(mergeChartDrawingPreferences(store([short]),store([]),store([edited,line]))),[line.id]);
  assert.deepEqual(ids(mergeChartDrawingPreferences(store([short]),store([edited]),store([]))),[]);
});
test('malformed remote documents cannot clear a valid local drawing',()=>{
  assert.deepEqual(ids(mergeChartDrawingPreferences(store(),store([short]),'{broken')),[short.id]);
});

test('actual mount effects do not publish an empty drawing document before restoration commits',()=>{
  const source=parseSource('src/components/KwantifyWorkspace.tsx');
  const hydrate=find(source,n=>ts.isCallExpression(n)&&n.expression.getText(source)==='useEffect'&&n.arguments[0]?.getText(source).includes('setPaneChartDrawingsHydrated(true)'));
  const save=find(source,n=>ts.isCallExpression(n)&&n.expression.getText(source)==='useEffect'&&n.arguments[0]?.getText(source).includes('JSON.stringify(paneChartDrawings)'));
  assert.ok(hydrate);assert.ok(save);
  const writes=[];let restored;
  const ctx=vm.createContext({paneChartDrawings:{},paneChartDrawingsHydrated:false,CHARTING_DRAWINGS_STORAGE_KEY:key,normalizeDrawings,
    setPaneChartDrawings:next=>{restored=next;},setPaneChartDrawingsHydrated:()=>{},CustomEvent:class{},
    window:{localStorage:{getItem:()=>store([short]),setItem:(_key,value)=>writes.push(value)},dispatchEvent:()=>{}},
  });
  const run=call=>vm.runInContext(ts.transpileModule(`(${call.arguments[0].getText(source)})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  run(hydrate);run(save);assert.equal(writes.length,0);
  ctx.paneChartDrawings=restored;ctx.paneChartDrawingsHydrated=true;run(save);
  assert.deepEqual(ids(writes[0]),[short.id]);
});

test('actual retained layer callbacks cannot discard a drawing created after their render',()=>{
  const source=parseSource('src/components/Chart.tsx');
  const layer=find(source,n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(source)==='ChartDrawLayer');
  const declaration=find(source,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)==='commitDrawings');
  assert.ok(layer);assert.ok(declaration);
  const ctx=vm.createContext({chartingDrawings:[],chartingDrawingsRef:{current:[]},normalizeDrawings,onChartingDrawingsChange:()=>{},setDrawSelectedId:()=>{}});
  const callback=declaration.initializer.arguments[0].getText(source);
  let code=`var commitDrawings=${callback};`;
  for(const name of ['onCommit','onUpdate']){
    const attr=layer.attributes.properties.find(a=>a.name?.getText(source)===name);
    code+=`var ${name}=${attr.initializer.expression.getText(source)};`;
  }
  vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  ctx.onCommit(short);ctx.onCommit(line);ctx.onUpdate({...short,text:'dragged'});
  assert.deepEqual(ctx.chartingDrawingsRef.current.map(d=>d.id).sort(),[short.id,line.id].sort());
});

function browser(){
  const data=new Map();globalThis.window={localStorage:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},dispatchEvent:()=>{},requestAnimationFrame:fn=>{fn();return 0;},matchMedia:()=>({matches:false})};
  globalThis.document={documentElement:{dataset:{},style:{setProperty:()=>{}},setAttribute:()=>{},classList:{add:()=>{},remove:()=>{},toggle:()=>{}}},querySelector:()=>null,querySelectorAll:()=>[]};
  globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail;}};
  return data;
}
test('a late initial cloud response retains drawings placed while loading, with owner isolation',async()=>{
  for(const owner of ['owner','other']){
    const data=browser();data.set('kwantdesk:active-preferences-owner:v1',owner);data.set(key,store());
    let resolve;const cloud=new Promise(done=>{resolve=done;});
    const client={from:()=>({select:()=>{const chain={eq:()=>chain,abortSignal:()=>chain,maybeSingle:()=>cloud};return chain;},upsert:async()=>({error:null})})};
    const pending=hydrateUserPreferences(client,{id:'owner',user_metadata:{}});
    data.set(key,store([short]));
    resolve({data:{preferences:snapshot(store([line]))},error:null});await pending;
    assert.deepEqual(ids(data.get(key)),owner==='owner'?[short.id,line.id].sort():[line.id]);
  }
});
