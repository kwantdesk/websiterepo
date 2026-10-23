import test from 'node:test';
import assert from 'node:assert/strict';
import {createOverlayHistory,nearestArchivedProfileTime} from '../public/kwanty-app/overlay-history.js';
import {buildProfileOverlayLayout} from '../public/kwanty-app/profile-overlay.js';
import {createOverlayEditor} from '../public/kwanty-app/overlay-editor.js';

// Synthetic source responses exercise the real adapter/page/renderer contract.
const date='2026-10-21',t=Date.parse(date+'T15:00:00Z')/1000;
const selector={ticker:'SPX',package:'state',category:'gamma_zero'};
const original=(timestamp=t,extra={})=>({ticker:'SPX',category:'gamma_zero',timestamp,mini_contracts:[[7750,1,2,-31,[3,4,5]]],...extra});
const envelope=(selection=selector)=>({...selection,sessionDate:date,profilePages:[{first:t,last:t+10,count:2}],data:[{ticker:selection.ticker,category:selection.category,timestamp:t,profilePage:0},{ticker:selection.ticker,category:selection.category,timestamp:t+10,profilePage:0}]});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('archived marker search remains causal and logarithmic across a full session',()=>{
 let reads=0;const rows=Array.from({length:23400},(_,i)=>({get timestamp(){reads++;return t+i;}}));
 assert.equal(nearestArchivedProfileTime(rows,(t+109.6)*1000,t+200),t+110);assert.ok(reads<70);
 assert.equal(nearestArchivedProfileTime(rows,(t+1000)*1000,t+100),t+100);assert.equal(nearestArchivedProfileTime(rows,t*1000,t-1),null);assert.equal(nearestArchivedProfileTime(rows,(t-100)*1000,t+100),t);
});

test('historical overlays share one manifest/page and render exact recorded tuples at or before replay',async()=>{
 const calls=[],first=original(),later=original(t+10,{mini_contracts:[[7750,1,2,99,[]]]});
 const history=createOverlayHistory({api:async path=>{calls.push(path);return path.includes('page=')?{...envelope(),page:0,data:[first,later]}:envelope();},onChange(){}});
 assert.equal(history.select(selector,date,t+5).payload,null);history.select(selector,date,t+5);await settle();
 assert.equal(history.select(selector,date,t+5).payload,null,'manifest summaries cannot paint before exact page');history.select(selector,date,t+5);await settle();
 const selected=history.select(selector,date,t+5);assert.deepEqual(selected.payload,first);assert.equal(calls.length,2);assert.equal(history.select(selector,date,t+10).payload,later);assert.equal(calls.length,2);
 const geometry={left:0,right:800,top:0,bottom:400,spotY:price=>200+(7750-price),timeX:time=>(time-t*1000)/1000};
 const layout=buildProfileOverlayLayout(geometry,{slots:[{show:true,category:'gamma_zero',payload:selected.payload,time:t+5}]});
 assert.equal(layout.layers.length,1);assert.equal(layout.layers[0].bars[0].value,-31);assert.equal(layout.layers[0].timestamp,t*1000);history.dispose();
});

test('history never borrows a later profile or loads a page before its first observed instant',async()=>{
 const calls=[];const history=createOverlayHistory({api:async path=>{calls.push(path);return envelope();},onChange(){}});
 history.select(selector,date,t-1);await settle();assert.equal(history.select(selector,date,t-1).payload,null);assert.equal(calls.length,1);
 assert.equal(history.select(selector,'2026-10-20',t).error,'HISTORY_SESSION_MISMATCH');assert.equal(calls.length,1);history.dispose();
});

test('wrong session/category rows fail before merge can silently remove them, with bounded retry',async()=>{
 for(const row of [original(t-86400),original(t,{category:'charm_zero'}),original(t,{ticker:'QQQ'})]){
  let calls=0;const history=createOverlayHistory({api:async()=>{calls++;return {...envelope(),profilePages:undefined,data:[row]};},onChange(){}});
  history.select(selector,date,t);await settle();const selected=history.select(selector,date,t);assert.equal(selected.payload,null);assert.ok(selected.error);history.select(selector,date,t);assert.equal(calls,1);history.dispose();
 }
});

test('Classic OI, State volume/Greeks and different tickers own separate manifest/page identities',async()=>{
 const calls=[];const history=createOverlayHistory({api:async path=>{calls.push(path);const q=new URLSearchParams(path.split('?')[1]),selection=Object.fromEntries(['ticker','package','category'].map(key=>[key,q.get(key)])),row={ticker:selection.ticker,category:selection.category,timestamp:t,...(selection.category.startsWith('gex_')?{strikes:[[7750,13,29,[]]]}:{mini_contracts:[[7750,1,2,31,[]]]})};return {...envelope(selection),...(q.has('page')?{page:0,data:[row]}:{})};},onChange(){}});
 const selections=[selector,{ticker:'SPX',package:'classic',category:'gex_zero'},{ticker:'QQQ',package:'state',category:'gamma_zero'}];
 for(const selected of selections){history.select(selected,date,t);await settle();history.select(selected,date,t);await settle();const payload=history.select(selected,date,t).payload;assert.equal(payload.ticker,selected.ticker);assert.equal(payload.category,selected.category);}
 assert.equal(calls.length,6);history.dispose();
});

test('missing exact pages stay unavailable until explicit retry, without repeated fetches on paint',async()=>{
 let calls=0,failed=true;const history=createOverlayHistory({api:async path=>{calls++;if(!path.includes('page='))return envelope();if(failed)throw Error('denied');return {...envelope(),page:0,data:[original()]};},onChange(){}});
 history.select(selector,date,t);await settle();history.select(selector,date,t);await settle();assert.equal(history.select(selector,date,t).error,'PROFILE_REPLAY_UNAVAILABLE');
 for(let i=0;i<10;i++)history.select(selector,date,t);assert.equal(calls,2);failed=false;history.retry(selector,date);await settle();history.select(selector,date,t);await settle();assert.equal(history.select(selector,date,t).payload.timestamp,t);assert.equal(calls,4);history.dispose();
});

test('manifest/page requests share a two-request ceiling; disposal aborts active and drops queued work',async()=>{
 let active=0,maximum=0,calls=0;const history=createOverlayHistory({api:(path,signal)=>new Promise((resolve,reject)=>{calls++;active++;maximum=Math.max(maximum,active);signal.addEventListener('abort',()=>{active--;reject(signal.reason);},{once:true});}),onChange(){}});
 for(const ticker of ['SPX','QQQ','SPY'])history.select({...selector,ticker},date,t);await settle();assert.equal(calls,2);assert.equal(maximum,2);history.dispose();await settle();assert.equal(active,0);assert.equal(calls,2);assert.equal(history.select(selector,date,t).payload,null);
});

test('actual overlay editor paints archived bars, drags to recorded times and persists offset buttons',async()=>{
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};}
  append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(key,value){this.attributes[key]=value;}show(){this.open=true;}close(){this.open=false;}remove(){this.removed=true;}
  all(){return [this,...this.children.filter(node=>node instanceof Element).flatMap(node=>node.all())];}
  querySelector(selector){return this.all().find(node=>selector.startsWith('.')&&node.className===selector.slice(1))||null;}
 }
 const previousDocument=globalThis.document,previousWindow=globalThis.window,body=new Element('body');
 globalThis.document={body,hidden:false,createElement:tag=>new Element(tag),querySelector:()=>null};globalThis.window={__kwantyActive:true};
 const panel={ticker:'SPX',profileSlots:[{show:true,category:'gamma_zero',time:null,verticalOffset:0}]},state={ticker:'SPX',panels:[panel],historyMode:date,replayIndex:1,auto:false,settings:{orderflow:{},state:{},classic:{}}};let persists=0,editor;
 try{
  const later=original(t+10),geometry={left:0,right:800,top:0,bottom:400,spotY:price=>200+(7750-price),timeX:time=>(time-t*1000)/1000};
  const ctx=new Proxy({},{get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
  let calls=0,denyPage=true;editor=createOverlayEditor({state,api:async path=>{calls++;if(path.includes('page=')){if(denyPage)throw Error('page unavailable');return {...envelope(),page:0,data:[original(),later]};}return envelope();},persist:()=>persists++,redraw(){},message(){},selectedPayload:()=>({timestamp:t+10})});
  assert.deepEqual(editor.frameReady(panel,t+10),{pending:true,error:null});assert.equal(editor.paint(ctx,geometry,panel).layers.length,0);await settle();
  assert.deepEqual(editor.frameReady(panel,t+10),{pending:true,error:null});await settle();assert.equal(editor.frameReady(panel,t+10).error,'PROFILE_REPLAY_UNAVAILABLE');
  denyPage=false;editor.open(panel);const load=body.all().find(node=>node.tag==='button'&&node.textContent==='load session');assert.ok(load);load.onclick();await settle();assert.equal(editor.frameReady(panel,t+10).pending,true);await settle();assert.deepEqual(editor.frameReady(panel,t+10),{pending:false,error:null});assert.equal(calls,4);assert.equal(persists,1);
  assert.deepEqual(editor.frameReady(panel,t-1),{pending:false,error:null},'before first genuine observation does not stall playback');panel.profileSlots[0].show=false;assert.deepEqual(editor.frameReady(panel,t+10),{pending:false,error:null});assert.equal(calls,4,'hidden profiles never load history');panel.profileSlots[0].show=true;
  let layout=editor.paint(ctx,geometry,panel);assert.equal(layout.layers[0].timestamp,(t+10)*1000);assert.equal(layout.layers[0].bars[0].value,-31);
  assert.equal(editor.markerAt(panel,layout,{x:layout.layers[0].markerX,y:399},geometry).available,true);
  editor.dragTo(panel,0,(t+2)*1000);assert.equal(panel.profileSlots[0].time,t);layout=editor.paint(ctx,geometry,panel);assert.equal(layout.layers[0].timestamp,t*1000);
  editor.open(panel);const plus=body.all().find(node=>node.attributes['aria-label']==='Move profile vertical offset +5 pixels');assert.ok(plus);plus.onclick();assert.equal(panel.profileSlots[0].verticalOffset,5);assert.equal(persists,3);
  body.all().find(node=>node.attributes['aria-label']==='Reset profile vertical offset').onclick();assert.equal(panel.profileSlots[0].verticalOffset,0);assert.equal(persists,4);
 }finally{editor?.dispose();globalThis.document=previousDocument;globalThis.window=previousWindow;}
});
