import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createOrderflowSources} from '../public/kwanty-app/orderflow-sources.js';
const app=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');
const timestamp=Date.parse('2026-10-19T18:00:00Z')/1000;
const frame=(ticker,spot=1)=>({ticker,spot,timestamp});
function harness(){
 let time=1;const requests=[],prices=[],history=[],pending=new Map();
 const pool=createOrderflowSources({now:()=>time,api:async(path,signal)=>{const query=new URLSearchParams(path.split('?')[1]),ticker=query.get('ticker');requests.push({ticker,path,signal});if(pending.has(ticker))return pending.get(ticker);return {data:path.startsWith('history')?[frame(ticker)]:frame(ticker,ticker==='NDX'?20000:500)};},history(){},subscribe(){},sessionHistory:{read:async(ticker,date)=>{history.push({ticker,date});return []; }},onChange(){},createPrices:()=>{const price={selected:[],disposed:0,active:[],setActive(value){this.active.push(value);},select(ticker,options){this.ticker=ticker;this.selected.push({ticker,options});},snapshot(interval){return {ticker:this.ticker,interval,candles:[],points:[]};},refresh:async()=>{},dispose(){this.disposed++;}};prices.push(price);return price;}});
 return {pool,requests,prices,history,pending,set time(value){time=value;}};
}
test('independent tickers have isolated data, while repeated tickers share one source and cadence',async()=>{
 const h=harness();h.pool.reconcile(['NDX','SPY','NDX'],{active:true,date:null,live:true});await h.pool.refresh();
 assert.deepEqual(h.requests.map(row=>row.ticker),['NDX','SPY']);assert.equal(h.prices.length,2);
 assert.equal(h.pool.get('NDX').records[0].spot,20000);assert.equal(h.pool.get('SPY').records[0].spot,500);
 for(let i=0;i<10;i++){h.pool.reconcile(['NDX','SPY','NDX'],{active:true});await h.pool.refresh();}
 assert.equal(h.requests.length,2,'focus/paint does not poll or duplicate data requests');
 h.time=30001;await h.pool.refresh();assert.equal(h.requests.length,4);
 h.pool.reconcile(['SPY','QQQ'],{active:true});await h.pool.refresh();assert.equal(h.prices[0].disposed,1);assert.equal(h.requests.length,5);
 assert.equal(h.pool.get('NDX'),undefined);assert.equal(h.pool.get('SPY').records[0].ticker,'SPY');h.pool.dispose();assert.ok(h.prices.every(price=>price.disposed===1));
});
test('removed/aborted ticker responses cannot contaminate the next selection',async()=>{
 const h=harness();let resolve;h.pending.set('SPY',new Promise(done=>resolve=done));h.pool.reconcile(['SPY'],{active:true});const job=h.pool.refresh();
 h.pool.reconcile(['QQQ'],{active:true});await h.pool.refresh();assert.equal(h.requests[0].signal.aborted,true);
 resolve({data:frame('SPY',999)});await job;assert.equal(h.pool.get('SPY'),undefined);assert.equal(h.pool.get('QQQ').records[0].ticker,'QQQ');h.pool.dispose();
});
test('concurrent refresh coalesces; errors remain scoped and cannot masquerade as another ticker',async()=>{
 const h=harness();let resolve;h.pending.set('NDX',new Promise(done=>resolve=done));h.pool.reconcile(['NDX','SPY'],{active:true});const a=h.pool.refresh(),b=h.pool.refresh();
 assert.equal(h.requests.length,2);resolve({data:frame('SPY')});await Promise.all([a,b]);
 assert.equal(h.pool.get('NDX').records.length,0);assert.equal(h.pool.get('NDX').error,'INSTRUMENT_DATA_MISMATCH');assert.equal(h.pool.get('SPY').error,null);
 h.pool.dispose();
});
test('historical sessions and visibility apply per distinct ticker; returning live discards old scope',async()=>{
 const h=harness();h.pool.reconcile(['NDX','SPY'],{active:false,date:null});await h.pool.refresh();assert.equal(h.requests.length,0);
 h.pool.reconcile(['NDX','SPY'],{active:true,date:'2026-10-19',live:false});await h.pool.refresh();assert.ok(h.requests.every(row=>row.path.startsWith('history?')&&row.path.includes('date=2026-10-19')));
 assert.ok(h.prices.filter(price=>!price.disposed).every(price=>price.selected.at(-1).options.live===false));
 h.pool.reconcile(['NDX','SPY'],{active:true,date:null,live:true});assert.equal(h.pool.get('SPY').records.length,0);await h.pool.refresh();assert.equal(h.requests.length,4);h.pool.dispose();
});
test('actual ticker handler changes active-only or linked peers, preserving unrelated view and settings',()=>{
 const panels=[{id:'a',ticker:'NDX',candleIntervalMs:60000},{id:'b',ticker:'SPY',viewportLinked:true},{id:'c',ticker:'QQQ',viewportLinked:true}],views=new Map(panels.map(p=>[p.id,{startTime:123}]));
 let selected=panels[0],loads=0;const context={catalog:{tickers:['NDX','SPY','QQQ','SPX']},state:{package:'orderflow',panels,ticker:'NDX'},charts:[],views,panelTicker:panel=>panel.ticker,chartControlTargets:()=>selected.viewportLinked?panels.filter(p=>p.viewportLinked):[selected],stopReplay(){},syncPrices(){},syncOrderflowState(){},syncShell(){},syncTimeline(){},drawAll(){},persist(){},load:()=>loads++};
 vm.runInNewContext(app.slice(app.indexOf('function changeTicker('),app.indexOf('function chartControlTargets(')),context);
 context.changeTicker('SPY');assert.deepEqual(panels.map(p=>p.ticker),['SPY','SPY','QQQ']);assert.equal(views.has('a'),false);assert.equal(views.has('b'),true);
 selected=panels[1];context.changeTicker('SPX');assert.deepEqual(panels.map(p=>p.ticker),['SPY','SPX','SPX']);assert.equal(panels[0].candleIntervalMs,60000);
 context.changeTicker('UNKNOWN');assert.equal(loads,2);assert.deepEqual(JSON.parse(JSON.stringify(panels)).map(p=>p.ticker),['SPY','SPX','SPX']);
});
test('price caches, rendering, overlay lookup and state restore use each panel ticker, not active global ticker',()=>{
 assert.match(app,/priceKey=ticker\+':\'\+interval/);
 assert.match(app,/records=currentRecords\(c.panel\)/);
 assert.match(app,/thresholds:s.flowThresholds\?\.\[ticker\]\|\|\{\},records,ticker,/);
 const overlay=readFileSync(new URL('../public/kwanty-app/overlay-editor.js',import.meta.url),'utf8');
 assert.match(overlay,/profileSelector\(slot,tickerFor\(p\)\)/);assert.match(overlay,/selectedPayload\(p\)/);
 assert.match(app,/for\(const panel of state.panels\)if\(!panel.ticker\)panel.ticker=state.ticker/);
});

test('actual linked viewport seed waits for real history and does not reseed on each quote',()=>{
 const panels=[{id:'a',ticker:'SPY',viewportLinked:true},{id:'b',ticker:'SPY',viewportLinked:true}];
 const price={loading:true,candles:[],points:[{time:timestamp*1000,spot:500}]},calls=[];
 const context={state:{package:'orderflow',historyMode:false},charts:panels.map(panel=>({panel,geometry:{startTime:1,endTime:10,priceAxisVisible:true,spotDomain:[490,510]}})),views:new Map(),priceState:()=>price,panelTicker:p=>p.ticker,sourceDate:()=> '2026-10-19',setChartView:(chart,value)=>calls.push({chart,value})};
 const start=app.indexOf(" if(state.package==='orderflow'){\n  const linked=");
 const code=app.slice(start,app.indexOf('\n}\nfunction pointerPosition',start));
 vm.runInNewContext("let linkedViewportSeedKey=null,activePanelId='a';function seed(){"+code+'};globalThis.seed=seed;',context);
 context.seed();assert.equal(calls.length,0);
 price.candles=[{time:timestamp*1000}];context.seed();assert.equal(calls.length,0,'pending history cannot freeze an empty scale');
 price.loading=false;context.seed();assert.equal(calls.length,1);
 price.points.push({time:timestamp*1000+1000,spot:501});context.seed();assert.equal(calls.length,1,'live updates retain manual viewport');
});

test('denied provider history restores only genuine exact-session archive observations with provenance',async()=>{
 for(const status of [403,404]){
  let reads=0,requests=0;const error=Object.assign(Error('UPSTREAM_ENTITLEMENT_REQUIRED'),{status});
  const pool=createOrderflowSources({api:async()=>{requests++;throw error;},sessionHistory:{read:async(ticker,date)=>{reads++;assert.equal(ticker,'NDX');assert.equal(date,'2026-10-19');return [frame('NDX',20000),{...frame('NDX',19000),timestamp:timestamp-86400}];}},history(){},subscribe(){},onChange(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
  pool.reconcile(['NDX','NDX'],{active:true,date:'2026-10-19',live:false});await pool.refresh();
  const source=pool.get('NDX');assert.equal(source.error,null);assert.equal(source.records.length,1);assert.equal(source.records[0].spot,20000);assert.equal(source.envelope.historySource,'recorded-session');assert.equal(source.envelope.coverage,'observations-only');assert.equal(source.envelope.upstreamHistoryError,error.message);assert.equal(reads,1);assert.equal(requests,1);pool.dispose();
 }
});

test('historical archive cannot mask other failures, unavailable history, wrong ticker or removed scope',async()=>{
 for(const [status,rows]of [[401,[frame('NDX')]],[429,[frame('NDX')]],[403,[]],[404,[frame('SPY')]]]){
  let reads=0;const pool=createOrderflowSources({api:async()=>{throw Object.assign(Error('provider failed'),{status});},sessionHistory:{read:async()=>{reads++;return rows;}},history(){},subscribe(){},onChange(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
  pool.reconcile(['NDX'],{active:true,date:'2026-10-19'});await pool.refresh();assert.equal(pool.get('NDX').records.length,0);assert.ok(pool.get('NDX').error);assert.equal(reads,[403,404].includes(status)?1:0);pool.dispose();
 }
 let resolve;const pending=new Promise(done=>resolve=done),pool=createOrderflowSources({api:async()=>{throw Object.assign(Error('denied'),{status:403});},sessionHistory:{read:()=>pending},history(){},subscribe(){},onChange(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
 pool.reconcile(['NDX'],{active:true,date:'2026-10-19'});const job=pool.refresh();await Promise.resolve();pool.reconcile([],{active:false});resolve([frame('NDX')]);await job;assert.equal(pool.get('NDX'),undefined);pool.dispose();
});
