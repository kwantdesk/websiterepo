import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {restoreStatePanels,statePanelCategory,selectStateProfile,stateControlTargets,stateViewportUpdates,stateCursor,projectStateCursor} from '../public/kwanty-app/state-panels.js';
import {createStateSources} from '../public/kwanty-app/state-sources.js';
import {calculateProfileGeometry,drawProfile} from '../public/kwanty-app/profile-chart.js';
const time=Date.UTC(2026,9,20,14),stamp=time/1000;
const app=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');
const panel=(id='a',ticker='QQQ',greek='gamma')=>({id,ticker,greek,greekExpiry:'zero',gexCategory:'gex_full',settings:{priceMultiplier:1,priceOffset:0}});
const frame=(ticker,category)=>({ticker,category,timestamp:stamp,spot:100,mini_contracts:[[100,.2,.3,5,[]]]});
function harness(){let time=1;const requests=[],priceOwners=[],pending=new Map();const pool=createStateSources({now:()=>time,api:async(path,signal)=>{const query=new URLSearchParams(path.split('?')[1]),ticker=query.get('ticker'),category=query.get('category');requests.push({path,signal,ticker,category});if(pending.has(ticker+'/'+category))return pending.get(ticker+'/'+category);return{data:path.startsWith('history')?[frame(ticker,category)]:frame(ticker,category)};},history(){},subscribe(){},onChange(){},createPrices:()=>{const price={disposed:0,selections:[],setActive(value){this.active=value;},select(...args){this.selections.push(args);},dispose(){this.disposed++;},snapshot:()=>({points:[],candles:[]}),refresh:async()=>{}};priceOwners.push(price);return price;}});return{pool,requests,priceOwners,pending,set time(value){time=value;}};}

test('first-run State migration preserves saved ticker, profile and settings; multiple panels restore independently without a three-panel cap',()=>{
 const settings={timeZone:'UTC',gamma:{color:'#123456'}},scope={greek:'vanna',greekExpiry:'one',gexCategory:'gex_zero'};
 const initial=restoreStatePanels(undefined,{ticker:'NDX',settings,scope,uuid:()=> 'first'});
 assert.equal(initial[0].ticker,'NDX');assert.equal(statePanelCategory(initial[0]),'vanna_one');
 initial[0].settings.gamma.color='#ffffff';assert.equal(settings.gamma.color,'#123456');
 const saved=Array.from({length:6},(_,i)=>({...panel('p'+i,i%2?'QQQ':'NDX'),candleIntervalMs:(i+1)*60000}));
 const restored=restoreStatePanels(JSON.parse(JSON.stringify(saved)),{ticker:'SPX',settings,scope});
 assert.equal(restored.length,6);assert.equal(restored[5].ticker,'QQQ');assert.equal(restored[5].candleIntervalMs,360000);
 restored[0].settings.gamma.color='#000000';assert.equal(restored[1].settings.gamma.color,'#123456');
});

test('profile selectors stay independent and reject unknown types',()=>{
 const a=panel(),b=panel('b');assert.equal(selectStateProfile(a,'delta_one'),true);assert.equal(statePanelCategory(a),'delta_one');assert.equal(statePanelCategory(b),'gamma_zero');assert.equal(selectStateProfile(a,'bogus'),false);selectStateProfile(a,'gex_zero');assert.equal(a.greek,null);assert.equal(statePanelCategory(a),'gex_zero');
});

test('adding/restoring a panel deep-clones nested styles and normalizes link flags',()=>{
 const settings={gamma:{color:'#abcdef'},showGrid:true},a=restoreStatePanels([panel()],{ticker:'QQQ',settings})[0];
 const b=restoreStatePanels([{...a,id:'b',viewportLinked:'false'}],{ticker:'QQQ',settings})[0];
 b.settings.gamma.color='#000000';assert.equal(a.settings.gamma.color,'#abcdef');assert.equal(b.viewportLinked,false);
 const migrated=restoreStatePanels(undefined,{ticker:'QQQ',settings,scope:{greek:'invalid',greekExpiry:'invalid'}})[0];
 assert.equal(statePanelCategory(migrated),'gex_full');assert.equal(migrated.greekExpiry,'zero');
});

test('timeframe/type controls use active-only or linked group, and persist separate State settings',()=>{
 const panels=[panel(),{...panel('b'),viewportLinked:true},{...panel('c'),viewportLinked:true}];let active='a';
 const context={state:{package:'state',statePanels:panels},get activeStatePanelId(){return active;},stateControlTargets,settings:()=>({}),persist(){},syncActiveChartControls(){},syncTimeline(){},drawAll(){}};
 vm.runInNewContext(app.slice(app.indexOf('function chartControlTargets('),app.indexOf('function setChartView(')),context);
 context.changeCandleInterval(180000);context.changePriceView('line');assert.equal(panels[0].priceViewMode,'line');assert.equal(panels[1].priceViewMode,undefined);
 active='b';context.changeCandleInterval(300000);context.changePriceView('candles');assert.deepEqual(panels.map(p=>p.candleIntervalMs),[180000,300000,300000]);assert.equal(panels[0].priceViewMode,'line');
 assert.notEqual(panels[0].settings,panels[1].settings);
});

test('linked State view shares price only for identical ticker and conversion, never exposure',()=>{
 const a={...panel(),viewportLinked:true},b={...panel('b'),viewportLinked:true},c={...panel('c','NDX'),viewportLinked:true},d=panel('d');
 const updates=stateViewportUpdates([a,b,c,d],'a',{startTime:time,endTime:time+60000,minPrice:98,maxPrice:102,minExposure:-50,maxExposure:50});
 assert.equal(updates.get('b').minPrice,98);assert.equal(updates.get('b').minExposure,undefined);assert.equal(updates.get('c').startTime,time);assert.equal(updates.get('c').minPrice,undefined);assert.equal(updates.has('d'),false);
 b.settings.priceOffset=3;assert.equal(stateViewportUpdates([a,b],'a',{minPrice:98,maxPrice:102}).get('b').minPrice,undefined);
});

test('linked State cursors project exact time/price on unequal charts, and only time across different tickers',()=>{
 const options={package:'state',payload:{spot:100,strikes:[[100,2,3,[]]]},view:{startTime:time,endTime:time+60000,minPrice:98,maxPrice:102}};
 const a=calculateProfileGeometry(1000,600,options),b=calculateProfileGeometry(700,300,options);
 const cursor=stateCursor(a,{x:a.timeX(time+12345),y:a.priceY(101.25)}),both=projectStateCursor(b,cursor),vertical=projectStateCursor(b,cursor,false);
 assert.equal(both.x,b.timeX(cursor.time));assert.equal(both.y,b.priceY(101.25));assert.equal(vertical.y,undefined);assert.equal(vertical.time,cursor.time);
 const calls=[],ctx=new Proxy({measureText:text=>({width:text.length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 const result=drawProfile(ctx,700,300,{...options,hover:vertical});assert.equal(result.crosshair.price,null);assert.equal(result.crosshair.time,cursor.time);assert.ok(result.crosshair.timeText);
});

test('State identical selectors coalesce and different profiles share one price owner per ticker',async()=>{
 const h=harness(),a=panel(),duplicate=panel('b'),delta=panel('c','QQQ','delta'),ndx=panel('d','NDX');h.pool.reconcile([a,duplicate,delta,ndx],{active:true});await Promise.all([h.pool.refresh(),h.pool.refresh()]);
 assert.equal(h.requests.length,3);assert.equal(h.priceOwners.length,2);assert.equal(h.pool.get(a),h.pool.get(duplicate));assert.notEqual(h.pool.get(a),h.pool.get(delta));
 for(let i=0;i<10;i++){h.pool.reconcile([a,duplicate,delta,ndx],{active:true});await h.pool.refresh();}assert.equal(h.requests.length,3);
 h.time=30001;await h.pool.refresh();assert.equal(h.requests.length,6);
 h.pool.reconcile([a],{active:true});assert.equal(h.priceOwners[1].disposed,1);assert.equal(h.pool.get(delta),undefined);h.pool.dispose();assert.ok(h.priceOwners.every(price=>price.disposed===1));
});

test('State stale responses, wrong categories and failed selectors remain isolated with backoff',async()=>{
 const h=harness(),a=panel(),b=panel('b','NDX');let resolve;h.pending.set('QQQ/gamma_zero',new Promise(done=>resolve=done));h.pool.reconcile([a,b],{active:true});const job=h.pool.refresh();h.pool.reconcile([b],{active:true});resolve({data:frame('QQQ','gamma_zero')});await job;assert.equal(h.pool.get(a),undefined);assert.equal(h.pool.get(b).records[0].ticker,'NDX');
 h.pool.reconcile([a,b],{active:true});h.pending.set('QQQ/gamma_zero',Promise.resolve({data:frame('QQQ','delta_zero')}));await h.pool.refresh();assert.equal(h.pool.get(a).error,'PROFILE_DATA_MISMATCH');assert.equal(h.pool.get(a).records.length,0);const before=h.requests.length;h.time=30001;await h.pool.refresh();assert.equal(h.requests.length,before+1,'only healthy source retries at30s');h.pool.dispose();
});

test('historical selectors follow requested date, visibility and lifecycle; bounded request concurrency',async()=>{
 const h=harness(),panels=[panel(),panel('b','NDX')];h.pool.reconcile(panels,{active:false,date:'2026-10-20',live:false});await h.pool.refresh();assert.equal(h.requests.length,0);
 h.pool.reconcile(panels,{active:true});await h.pool.refresh();assert.ok(h.requests.every(r=>r.path.startsWith('history?')&&r.path.includes('date=2026-10-20')));assert.ok(h.priceOwners.every(p=>p.selections.at(-1)[1].live===false));
 h.pool.reconcile(panels,{active:true,date:null,live:true});assert.equal(h.pool.get(panels[0]).records.length,0);await h.pool.refresh();h.pool.dispose();
 let active=0,maximum=0;const releases=[];const bounded=createStateSources({api:async path=>{active++;maximum=Math.max(maximum,active);await new Promise(done=>releases.push(done));active--;const q=new URLSearchParams(path.split('?')[1]);return{data:frame(q.get('ticker'),q.get('category'))};},onChange(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
 bounded.reconcile(Array.from({length:7},(_,i)=>panel(String(i),'SYM'+String.fromCharCode(65+i))),{active:true});const job=bounded.refresh();
 while(releases.length||active){for(const release of releases.splice(0))release();await new Promise(done=>setImmediate(done));}
 await job;assert.equal(maximum,2);bounded.dispose();
});

test('State ticker handler changes only selected/linked panels, preserving other views and settings',()=>{
 const panels=[panel(),{...panel('b','NDX'),viewportLinked:true},{...panel('c','SPX'),viewportLinked:true}],views=new Map(panels.map(p=>[p.id,{x:1}]));let id='a';
 const context={state:{statePanels:panels,replayIndex:null},get activeStatePanelId(){return id;},stateControlTargets,views,charts:[],stopReplay(){},syncPrices(){},syncStatePanel(){},syncShell(){},renderSummary(){},syncTimeline(){},drawAll(){},persist(){},loadState(){}};
 vm.runInNewContext(app.slice(app.indexOf('function changeStateTicker('),app.indexOf('function changeStateProfile(')),context);
 context.changeStateTicker('SPY');assert.deepEqual(panels.map(p=>p.ticker),['SPY','NDX','SPX']);assert.equal(views.has('b'),true);id='b';context.changeStateTicker('QQQ');assert.deepEqual(panels.map(p=>p.ticker),['SPY','QQQ','QQQ']);assert.equal(views.has('b'),false);assert.equal(views.has('c'),false);
});

test('price notifications do not rebuild snapshot sidebar DOM, while source changes remain explicit',async()=>{
 const kinds=[],ticks=[];const pool=createStateSources({api:async()=>({data:frame('QQQ','gamma_zero')}),onChange:kind=>kinds.push(kind),createPrices:({onChange})=>{ticks.push(onChange);return{setActive(){},select(){},dispose(){}};}});
 pool.reconcile([panel(),panel('duplicate')],{active:true});await pool.refresh();assert.deepEqual(kinds,['snapshot']);
 for(let i=0;i<100;i++)ticks[0]();assert.equal(kinds.filter(k=>k==='snapshot').length,1);assert.equal(kinds.filter(k=>k==='price').length,100);pool.dispose();
 assert.match(app,/onChange:kind=>\{if\(state.package==='state'\)\{if\(kind!=='price'\)/);
});

test('actual add/close/restore preserves nested settings, order and active IDs beyond three panels',()=>{
 const a=panel(),b=panel('b','NDX'),c=panel('c','SPY');let serial=0,scrolls=0;
 const context={state:{statePanels:[a,b,c],closedStatePanels:[],ticker:'QQQ',replayIndex:null},activeStatePanelId:'a',scopes:{state:{}},restoreStatePanels,crypto:{randomUUID:()=> 'new'+(++serial)},structuredClone,views:new Map(),charts:[],settings:()=>a.settings,activeStatePanel:()=>context.state.statePanels.find(p=>p.id===context.activeStatePanelId),saveScope(){},stopReplay(){},syncStatePanel(){},syncShell(){},persist(){},loadState(){},buildCharts(){context.charts=context.state.statePanels.map(panel=>({panel,wrap:{scrollIntoView:()=>scrolls++}}));}};
 vm.runInNewContext(app.slice(app.indexOf('function addStateChart('),app.indexOf('function renderStateControls(')),context);
 context.addStateChart();assert.equal(context.state.statePanels.length,4);const added=context.state.statePanels.at(-1);assert.notEqual(added.settings,a.settings);assert.equal(added.viewportLinked,false);
 context.closeStateChart(b);assert.equal(context.state.statePanels.length,3);context.addStateChart({restore:true});assert.equal(context.state.statePanels[1].id,'b');assert.equal(context.activeStatePanelId,'b');assert.equal(context.state.closedStatePanels.length,0);
 for(const p of [...context.state.statePanels])context.closeStateChart(p);assert.equal(context.state.statePanels.length,1);assert.ok(scrolls>=2);
});

test('State pending-profile price chart uses real candle close and linked seed waits for loaded profiles',()=>{
 const p={...panel(),viewportLinked:true},ctx=new Proxy({measureText:text=>({width:text.length*6})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const price={latest:null,loading:false,points:[{time,spot:500}],candles:[{time,open:499,high:501,low:498,close:500}]};
 const chart={panel:p,status:{},title:{},wrap:{setAttribute(){},querySelectorAll:()=>[]},canvas:{setAttribute(){}},closeButton:{setAttribute(){}},settingsButton:{setAttribute(){}}};
 const context={updateStateDrawingTools(){},priceState:()=>price,stateSources:{get:()=>({})},selectedPayload:()=>null,currentRecords:()=>[],priceViewFor:()=> 'candles',statePanelLabel:()=> 'Gamma',statePanelCategory,sourceDate:()=> '2026-10-20',drawProfile,candleIntervalFor:()=>60000,regularWindow:()=>({startTime:time,endTime:time+60000}),views:new Map(),stateLinkedSeedKey:null};
 vm.runInNewContext(app.slice(app.indexOf('function paintStateChart('),app.indexOf('function seedStateViews(')),context);
 context.paintStateChart(chart,ctx,1000,600);assert.equal(chart.geometry.spot,500);assert.ok(chart.geometry.minPrice>450);assert.ok(chart.geometry.maxPrice<550);
 let ready=false,calls=0;Object.assign(context,{charts:[chart,{...chart,panel:{...p,id:'b'}}],selectedPayload:()=>ready?frame('QQQ','gamma_zero'):null,activeStatePanel:()=>p,setChartView:()=>calls++});
 vm.runInNewContext(app.slice(app.indexOf('function seedStateViews('),app.indexOf('function paintAll(')),context);
 context.seedStateViews();assert.equal(calls,0);ready=true;context.seedStateViews();assert.equal(calls,1);context.seedStateViews();assert.equal(calls,1);
});
