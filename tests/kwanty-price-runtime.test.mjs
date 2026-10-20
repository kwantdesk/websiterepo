import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPriceController} from '../public/kwanty-app/price-runtime.js';

// Arithmetic-only mocks; no browser, provider, gateway or market API requests.
const minute=60_000, time=Date.UTC(2026,9,20,14), tick=time+30_000;
const candle=(index=0,extra={})=>({time:time+index*minute,open:100,high:105,low:98,close:102,...extra});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('unsupported stream does not prevent genuine history from loading',async()=>{
 const controller=createPriceController({history:async()=>[candle()],subscribe:()=>{throw Error('Unsupported stream');},onChange:()=>{},now:()=>tick});
 assert.doesNotThrow(()=>controller.select('QQQ'));await settle();assert.equal(controller.snapshot().candles.length,1);controller.dispose();
});
function harness({history=async()=>[candle()],now=()=>tick}={}){
  const calls=[],subscriptions=[];let changes=0;
  const controller=createPriceController({history:(...args)=>{calls.push(args);return history(...args);},subscribe:(symbol,listener,onError)=>{const sub={symbol,listener,onError,closed:false};subscriptions.push(sub);return()=>{sub.closed=true;};},now,onChange:()=>{changes++;}});
  return {controller,calls,subscriptions,get changes(){return changes;},emit(frame,sub=subscriptions.at(-1)){sub.listener(frame);}};
}

test('genuine history seeds first load and same-ticker Classic/State/Orderflow switches share one source',async()=>{
  const h=harness();h.controller.select('QQQ');await settle();
  assert.deepEqual(h.calls,[['QQQ',undefined]]);assert.equal(h.subscriptions.length,1);
  const first=h.controller.snapshot();assert.equal(first.loading,false);assert.equal(first.error,null);assert.equal(first.candles.length,1);
  assert.deepEqual([first.candles[0].open,first.candles[0].high,first.candles[0].low,first.candles[0].close],[100,105,98,102]);
  // Package is intentionally not a controller identity; switching pages calls select again.
  for(const pkg of ['classic','state','orderflow']){assert.ok(pkg);h.controller.select('QQQ');}
  assert.equal(h.calls.length,1);assert.equal(h.subscriptions.length,1);
  assert.strictEqual(h.controller.snapshot().candles,first.candles);h.controller.dispose();
});

test('quote changes repaint price without a positioning snapshot or history refresh completing',async()=>{
  const blocked=deferred();let reads=0;
  const h=harness({history:()=>++reads===1?Promise.resolve([candle()]):blocked.promise});
  h.controller.select('QQQ');await settle();const before=h.changes;
  h.emit({symbol:'QQQ',timestamp:tick,lastPrice:108});
  const next=h.controller.snapshot();assert.ok(h.changes>before);assert.equal(next.latest.spot,108);
  assert.equal(next.candles[0].high,108);assert.equal(next.candles[0].close,108);
  assert.equal(next.points.at(-1).spot,108);assert.equal(next.loading,true);
  blocked.resolve([candle()]);await settle();h.controller.dispose();
});

test('quote-only minute transitions request at most one authoritative repair per bucket and never invent OHLC',async()=>{
  const h=harness({history:async()=>[candle()],now:()=>time+2*minute});h.controller.select('QQQ');await settle();
  h.emit({symbol:'QQQ',timestamp:time+minute+100,lastPrice:109});await settle();const count=h.calls.length;
  for(let i=1;i<=10;i++)h.emit({symbol:'QQQ',timestamp:time+minute+100+i,lastPrice:109+i/100});
  await settle();assert.equal(h.calls.length,count);assert.equal(h.controller.snapshot().candles.length,1);
  h.emit({symbol:'QQQ',timestamp:time+2*minute+100,lastPrice:110});await settle();assert.equal(h.calls.length,count+1);
  assert.equal(h.controller.snapshot().candles.length,1);assert.equal(h.controller.snapshot().points.at(-1).spot,110);
  h.controller.dispose();
});

test('a real candle frame seeds the new minute without redundant quote-only repair',async()=>{
  const h=harness();h.controller.select('QQQ');await settle();const count=h.calls.length;
  h.emit({symbol:'QQQ',timestamp:time+minute+10,lastPrice:106,candle:candle(1,{high:106,close:106})});
  await settle();assert.equal(h.calls.length,count);assert.equal(h.controller.snapshot().candles.length,2);
  assert.equal(h.controller.snapshot().candles.at(-1).open,100);assert.equal(h.controller.snapshot().latest.spot,106);
  h.controller.dispose();
});

test('invalid and old quote packets cannot trigger history refresh storms',async()=>{
  const h=harness();h.controller.select('QQQ');await settle();
  h.emit({symbol:'QQQ',timestamp:time+minute+100,lastPrice:109});await settle();const count=h.calls.length;
  for(const frame of [
    {symbol:'QQQ',lastPrice:109},
    {symbol:'QQQ',timestamp:NaN,lastPrice:109},
    {symbol:'QQQ',timestamp:time+2*minute,lastPrice:NaN},
    {symbol:'QQQ',timestamp:tick,lastPrice:99},
    {symbol:'QQQ',timestamp:time+minute+101,lastPrice:110},
    {symbol:'QQQ',timestamp:tick+1,lastPrice:99},
  ]){h.emit(frame);await settle();}
  assert.equal(h.calls.length,count,'rejected frames and already-seen minute buckets must not fetch history');
  assert.equal(h.controller.snapshot().latest.spot,110);h.controller.dispose();
});

test('minute arriving during pending history is repaired once that request settles',async()=>{
  const pending=deferred();let reads=0;
  const h=harness({history:()=>++reads===1?pending.promise:Promise.resolve([candle(),candle(1)]),now:()=>time+minute+1000});
  h.controller.select('QQQ');
  h.emit({symbol:'QQQ',timestamp:time+minute+100,lastPrice:109});assert.equal(h.calls.length,1);
  pending.resolve([candle()]);await settle();
  h.emit({symbol:'QQQ',timestamp:time+minute+200,lastPrice:110});await settle();
  assert.equal(h.calls.length,2,'a boundary skipped during pending history must not be forgotten');
  assert.equal(h.controller.snapshot().candles.length,2);h.controller.dispose();
});

test('quote-only startup remains a genuine observed line with no fake candles',async()=>{
  const h=harness({history:async()=>[]});h.controller.select('NDX');await settle();
  h.emit({symbol:'NDX',timestamp:tick,lastPrice:20_000});await settle();
  const next=h.controller.snapshot();assert.deepEqual(next.candles,[]);assert.equal(next.points.at(-1).spot,20_000);
  assert.equal(next.latest.spot,20_000);h.controller.dispose();
});

test('inactive/replay/disposal close the source and stale callbacks cannot mutate price',async()=>{
  const h=harness();h.controller.select('QQQ');await settle();const initial=h.controller.snapshot();
  const first=h.subscriptions[0];h.controller.setActive(false);assert.equal(first.closed,true);
  h.emit({symbol:'QQQ',timestamp:tick,lastPrice:200},first);assert.strictEqual(h.controller.snapshot().candles,initial.candles);
  h.controller.setActive(true);await settle();assert.equal(h.subscriptions.length,2);
  const second=h.subscriptions[1];h.controller.select('QQQ',{live:false});await settle();assert.equal(second.closed,true);assert.equal(h.subscriptions.length,2);
  h.emit({symbol:'QQQ',timestamp:tick+1,lastPrice:300},second);assert.equal(h.controller.snapshot().latest,null);
  h.controller.select('QQQ',{live:true});await settle();const last=h.subscriptions.at(-1);
  h.controller.dispose();assert.equal(last.closed,true);const changes=h.changes;
  h.emit({symbol:'QQQ',timestamp:tick+2,lastPrice:400},last);await h.controller.refresh();assert.equal(h.changes,changes);
});

test('replay has no future OHLC/quotes/current marker and forwards explicit historical session',async()=>{
  const h=harness({history:async()=>[candle(),candle(1),candle(2)]});h.controller.select('QQQ');await settle();
  h.emit({symbol:'QQQ',timestamp:time+2*minute+100,lastPrice:107});await settle();
  const replay=h.controller.snapshot(minute,{cutoffTime:time+minute});
  assert.equal(replay.candles.length,1);assert.equal(replay.candles[0].time,time);assert.equal(replay.latest,null);
  assert.ok(replay.points.every(p=>p.time<=time+minute));
  h.controller.select('QQQ',{sessionDate:'2026-10-16',live:false});await settle();
  assert.deepEqual(h.calls.at(-1),['QQQ','2026-10-16']);assert.equal(h.subscriptions.at(-1).closed,true);h.controller.dispose();
});

test('late old-symbol history, quotes and errors cannot contaminate a new instrument',async()=>{
  const qqq=deferred(),ndx=deferred();const h=harness({history:symbol=>symbol==='QQQ'?qqq.promise:ndx.promise});
  h.controller.select('QQQ');const old=h.subscriptions[0];h.controller.select('NDX');
  qqq.resolve([candle()]);await settle();assert.equal(h.controller.snapshot().loading,true);assert.deepEqual(h.controller.snapshot().candles,[]);
  old.onError(new Error('stale old error'));h.emit({symbol:'QQQ',timestamp:tick,lastPrice:99},old);
  assert.equal(h.controller.snapshot().error,null);assert.equal(h.controller.snapshot().latest,null);
  ndx.resolve([candle(0,{open:20_000,high:20_010,low:19_990,close:20_005})]);await settle();
  assert.equal(h.controller.snapshot().candles[0].close,20_005);assert.equal(h.controller.snapshot().loading,false);
  h.emit({symbol:'QQQ',timestamp:tick,lastPrice:99});assert.equal(h.controller.snapshot().latest,null);h.controller.dispose();
});

test('same-symbol old-session and deactivated pending history are discarded',async()=>{
  const pending=[];const h=harness({history:()=>{const item=deferred();pending.push(item);return item.promise;}});
  h.controller.select('QQQ',{sessionDate:'2026-10-16',live:false});h.controller.select('QQQ',{sessionDate:'2026-10-19',live:false});
  pending[0].resolve([candle()]);await settle();assert.equal(h.controller.snapshot().candles.length,0);
  h.controller.setActive(false);pending[1].resolve([candle(1)]);await settle();assert.equal(h.controller.snapshot().candles.length,0);
  h.controller.setActive(true);pending[2].resolve([candle(2)]);await settle();assert.equal(h.controller.snapshot().candles[0].time,time+2*minute);h.controller.dispose();
});

test('snapshot hover reads reuse bounded cached arrays but invalidate immediately on price',async()=>{
  const h=harness();h.controller.select('SPXW');await settle();const first=h.controller.snapshot();const count=h.calls.length,subs=h.subscriptions.length;
  for(let i=0;i<100;i++){const next=h.controller.snapshot();assert.strictEqual(next.candles,first.candles);assert.strictEqual(next.points,first.points);}
  assert.equal(h.calls.length,count);assert.equal(h.subscriptions.length,subs);
  h.emit({symbol:'SPX',timestamp:tick,lastPrice:108});assert.notStrictEqual(h.controller.snapshot().candles,first.candles);
  const large=h.controller.snapshot(300_000);assert.strictEqual(h.controller.snapshot(300_000).candles,large.candles);
  for(let i=1;i<=9;i++)h.controller.snapshot(minute,{cutoffTime:time+i});
  assert.notStrictEqual(h.controller.snapshot().candles,first.candles);h.controller.dispose();
});

test('history failures retain genuine same-scope bars and expose error without a fake fallback',async()=>{
  let fail=false;const h=harness({history:async()=>{if(fail)throw Error('History offline');return [candle()];}});
  h.controller.select('QQQ');await settle();const before=h.controller.snapshot();fail=true;await h.controller.refresh();
  const next=h.controller.snapshot();assert.strictEqual(next.candles,before.candles);assert.equal(next.error,'History offline');assert.equal(next.loading,false);h.controller.dispose();
});

test('app passes independent authoritative price history to every renderer, never snapshot-derived candles',async()=>{
  const app=await readFile(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');
  assert.match(app,/createPriceController\(\{history:botPriceHistory,subscribe:botSubscribePrice/);
  assert.match(app,/renderOrderflow\([\s\S]*?priceHistory:price\.candles,priceLine:price\.points/);
  assert.match(app,/drawProfile\([\s\S]*?priceHistory:s\.spotViewMode==='candles'\?price\.candles:price\.points/);
  assert.doesNotMatch(app,/collectCandles\(/);assert.match(app,/prices\.setActive\(!document\.hidden&&window\.__kwantyActive!==false\)/);
  assert.match(app,/cutoffTime=state\.historyMode\|\|state\.replayIndex!==null/);
});

test('Candles/Line toolbar uses linked control targets with package settings as the default',async()=>{
  const [html,app,settings]=await Promise.all(['index.html','app.js','settings-editor.js'].map(name=>readFile(new URL('../public/kwanty-app/'+name,import.meta.url),'utf8')));
  assert.match(html,/id="priceViewMode" aria-label="Price chart type"[\s\S]*?value="candles">Candles[\s\S]*?value="line">Line/);
  assert.match(html,/name="spotViewMode" value="line"/);assert.match(html,/name="spotViewMode" value="candles"/);
  assert.match(settings,/spotViewMode:data\.get\('spotViewMode'\)/);
  assert.match(app,/\$\('#priceViewMode'\)\.addEventListener\('change',event=>changePriceView\(event.target.value\)\)/);
  assert.match(app,/\$\('#priceViewMode'\)\.value=priceViewFor\(panel,settings\(\)\)/);
  assert.match(app,/for\(const target of chartControlTargets\(\)\)target\[state.package==='orderflow'\?'priceViewMode':'spotViewMode'\]=value/);
});

test('standalone and independently mounted chart-grid tools expose the shared host price bridge',async()=>{
  const [main,embedded,runtime]=await Promise.all(['../src/components/kwanty/KwantyWorkspace.tsx','../src/components/options-flow/OptionsFlowToolPanel.tsx','../public/kwanty-app/site-runtime.js'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  for(const source of [main,embedded]){assert.match(source,/priceHistory:\s*prices\.priceHistory/);assert.match(source,/subscribePrice:\s*prices\.subscribePrice/);assert.match(source,/kwantyPriceBridge/);}
  assert.match(runtime,/hostId\?window\.parent\?\.__kwantOptionsToolHosts\?\.\[hostId\]:window\.parent\?\.__kwantyHost/);
  assert.match(runtime,/botPriceHistory=\(symbol,date\)=>host\?\.priceHistory/);assert.match(runtime,/botSubscribePrice=\(symbol,listener,onError\)=>host\?\.subscribePrice/);
});
