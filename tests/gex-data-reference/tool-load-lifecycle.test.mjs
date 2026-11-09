import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dataRequestIdentity} from '../../public/gex-data-app/live-chart-model.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){
  const start=new RegExp(`^  (?:async )?function ${name}\\(`,'m').exec(source);assert.ok(start);
  const tail=source.slice(start.index+start[0].length),end=/^  (?:async )?function /m.exec(tail);assert.ok(end);
  return source.slice(start.index,start.index+start[0].length+end.index);
}
class Node{
  constructor(){this.children=['previous SPY chart'];this.hidden=false;this.textContent='Source SPY timestamp';this.attributes={};}
  setAttribute(key,value){this.attributes[key]=value;}
  replaceChildren(...children){this.children=children;}
  remove(){this.removed=true;}
}
function harness(){
  const nodes=new Map(),requests=[],selection={ticker:'SPY',expiry:'2026-10-19',strike:766,type:'PUT'},previous={data:{ticker:'SPY',close:4.80}},view=new Node();
  const env={activeTool:{id:'option-price-over-time',view:'optionOhlc'},masterReplay:null,window:{},frameVisible:true,toolRequestId:0,toolRequestInFlight:false,pendingLiveFrame:false,
    toolCursor:'previous-cursor',toolPayload:previous,toolPayloadQuery:null,pollTimer:null,activeController:null,AbortController,Date,EMBEDDED:false,
    snapshotSelections:new Map(),snapshotKey:()=> 'snapshot',dataRequestIdentity,
    toolView:view,q:key=>{if(!nodes.has(key))nodes.set(key,new Node());return nodes.get(key);},clearTimeout(){},updateInitialToolLoading(){},
    buildRequest:()=>{if(!selection.expiry)throw Error('Please select an expiration date.');return {sessionDate:'2026-10-16',filter:{ticker:selection.ticker,expirationDate:selection.expiry,strikePrice:selection.strike,contractType:selection.type}};},
    loadToolPayload:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),
    renderToolPayload:(_tool,payload)=>{env.q('#toolVisual').replaceChildren(payload.data.ticker);env.q('#toolVisual').hidden=false;},renderSnapshotControl(){},
    lastToolAttemptAt:0,lastToolSuccessAt:100,updateToolTimestamp:(_tool,payload)=>{env.q('#toolUpdated').textContent='Source '+payload.data.ticker+' timestamp';},saveToolControls(){},updateLiveState(){},schedulePoll(){env.pollSchedules++;},pollSchedules:0,
    activeChartUpdate:()=>{},activeChartInstance:{ticker:'SPY'},refreshingCanvas:{},activeChartDispose:()=>{env.disposals++;},disposals:0,
    activeChartReset:()=>{},tableColumns:['previous'],tableRows:[{ticker:'SPY'}],tableRuntime:{closeAutoFilter(){env.editorClosures++;}},editorClosures:0,
  };
  env.toolPayloadQuery=dataRequestIdentity(env.activeTool.id,env.buildRequest());
  vm.runInNewContext(actual('resetStage')+actual('loadActiveTool')+';this.load=loadActiveTool;',env);
  return {env,nodes,requests,selection,previous,view};
}
function assertCleared(h){
  assert.equal(h.env.toolPayload,null);assert.equal(h.env.toolPayloadQuery,null);assert.equal(h.env.activeChartInstance,null);assert.equal(h.env.activeChartUpdate,null);
  assert.deepEqual(h.env.q('#toolVisual').children,[]);assert.equal(h.env.q('#toolVisual').hidden,true);assert.equal(h.env.q('#toolUpdated').textContent,'');
  assert.equal(h.env.activeChartReset,null);assert.equal(h.env.tableRows.length,0);
  assert.ok(h.env.editorClosures>0,'clearing a selection closes any portaled Equity editor and cancels its pending drafts');
}

test('invalid new Contract scope clears previous payload, identity, chart, tables and timestamp before showing the prompt',async()=>{
  const h=harness();h.selection.ticker='QQQ';h.selection.expiry='';await h.env.load();
  assertCleared(h);assert.equal(h.env.toolCursor,null);assert.equal(h.env.disposals,1);assert.equal(h.requests.length,0);
  assert.equal(h.env.q('#toolError').hidden,false);assert.match(h.env.q('#toolError').textContent,/select an expiration/);
  assert.equal(h.env.toolRequestInFlight,false);assert.equal(h.view.attributes['aria-busy'],'false');
});

test('prepared-request identity failure also clears an old chart without sending a request',async()=>{
  const h=harness();const circular={};circular.self=circular;h.env.buildRequest=()=>circular;await h.env.load();assertCleared(h);assert.equal(h.requests.length,0);
});

test('validated same-selection network refresh failure retains the verified chart, identity and source timestamp',async()=>{
  const h=harness(),identity=h.env.toolPayloadQuery,chart=h.env.activeChartInstance,loading=h.env.load();
  assert.equal(h.env.toolPayload,h.previous);assert.equal(h.env.activeChartInstance,chart);assert.equal(h.requests.length,1);
  h.requests[0].reject(Error('Network unavailable'));await loading;
  assert.equal(h.env.toolPayload,h.previous);assert.equal(h.env.toolPayloadQuery,identity);assert.equal(h.env.activeChartInstance,chart);assert.equal(h.env.disposals,0);
  assert.equal(h.env.q('#toolUpdated').textContent,'Source SPY timestamp');assert.deepEqual(h.env.q('#toolVisual').children,['previous SPY chart']);
  assert.equal(h.env.lastToolSuccessAt,100);assert.equal(h.env.q('#toolError').hidden,false);
});

test('valid new selection clears old identity and chart while loading, then installs only the new payload',async()=>{
  const h=harness();h.selection.ticker='QQQ';const loading=h.env.load();assertCleared(h);assert.equal(h.requests.length,1);
  h.requests[0].resolve({data:{ticker:'QQQ',close:1.25}});await loading;
  assert.equal(h.env.toolPayload.data.ticker,'QQQ');assert.equal(h.env.toolPayloadQuery,dataRequestIdentity(h.env.activeTool.id,h.env.buildRequest(),null));
  assert.deepEqual(h.env.q('#toolVisual').children,['QQQ']);assert.equal(h.env.q('#toolUpdated').textContent,'Source QQQ timestamp');
});

test('late prior request rejection cannot clear or unlock a replacement after an invalid-scope transition',async()=>{
  const h=harness(),old=h.env.load();h.selection.ticker='QQQ';h.selection.expiry='';await h.env.load();assertCleared(h);
  h.selection.expiry='2026-10-23';const replacement=h.env.load();assert.equal(h.requests.length,2);assert.equal(h.env.toolRequestInFlight,true);
  const schedules=h.env.pollSchedules;h.requests[0].reject(Error('Late old selection failure'));await old;
  assert.equal(h.env.toolRequestInFlight,true);assert.equal(h.env.pollSchedules,schedules);assert.equal(h.view.attributes['aria-busy'],'true');assertCleared(h);
  h.requests[1].resolve({data:{ticker:'QQQ'}});await replacement;assert.equal(h.env.toolPayload.data.ticker,'QQQ');assert.equal(h.env.toolRequestInFlight,false);
});

test('aborted same-selection refresh neither clears verified data nor shows a failure',async()=>{
  const h=harness(),loading=h.env.load();h.env.activeController.abort();h.requests[0].reject(Object.assign(Error('Cancelled'),{name:'AbortError'}));await loading;
  assert.equal(h.env.toolPayload,h.previous);assert.equal(h.env.activeChartInstance.ticker,'SPY');assert.equal(h.env.q('#toolError').hidden,true);assert.equal(h.env.disposals,0);
});
