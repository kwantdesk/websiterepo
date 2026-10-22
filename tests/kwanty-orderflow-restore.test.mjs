import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='@/lib/gexBotOrderflowArchive.server')return {url:new URL('../src/lib/gexBotOrderflowArchive.server.ts',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {createKwantyOrderflowArchive,validOrderflowRow,orderflowSessionDate}=await import('../src/lib/kwantyOrderflowArchive.server.ts');
import {createSessionHistory} from '../public/kwanty-app/session-history.js';
const time=Date.UTC(2026,9,19,20)/1000,date='2026-10-19';
const row=(extra={})=>({ticker:'NDX',timestamp:time,spot:29536.02,zgr:-29428.66,gexoflow:-2650.06,...extra});
function harness(overrides={}){let reads=0,writes=[];const archive=createKwantyOrderflowArchive({configured:()=>true,now:()=>Date.UTC(2026,9,20),read:async()=>{reads++;return [row()];},write:async value=>{writes.push(value);},...overrides});return {archive,get reads(){return reads;},writes};}
test('record only genuine exact-instrument frames, globally minute-keyed without changing payload time',async()=>{
 const h=harness();await Promise.all([h.archive.record(row({timestamp:time+5})),h.archive.record(row({timestamp:time+20}))]);
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].ticker,'NDX');assert.equal(h.writes[0].frameTimestamp,time*1000);assert.equal(h.writes[0].payload.timestamp,time+5);
 await h.archive.record({ticker:'NDX',timestamp:time});await h.archive.record(row({timestamp:NaN}));assert.equal(h.writes.length,1);
 assert.equal(validOrderflowRow(row(),'QQQ',date),false);assert.equal(validOrderflowRow(row(),'NDX','2026-10-18'),false);assert.equal(orderflowSessionDate(time),date);
});
test('archive restores sorted exact-session observations, not wrong instruments or missing metrics',async()=>{
 const h=harness({read:async()=>[row({timestamp:time-60}),row(),row({ticker:'QQQ'}),row({timestamp:time-86400}),{ticker:'NDX',timestamp:time},row({zgr:-1})]});
 const result=await h.archive.session('NDX',date);assert.equal(result.availability,'recorded');assert.equal(result.data.length,2);assert.equal(result.data[0].timestamp,time-60);assert.equal(result.data[1].zgr,-1);
});
test('concurrent panels share one archive read; unconfigured/empty/failing archives never invent data',async()=>{
 const h=harness();const results=await Promise.all(Array.from({length:12},()=>h.archive.session('NDX',date)));assert.equal(h.reads,1);assert.ok(results.every(result=>result.data.length===1));
 for(const overrides of [{configured:()=>false},{read:async()=>[]},{read:async()=>{throw Error('offline');}}]){const result=await harness(overrides).archive.session('NDX',date);assert.deepEqual(result.data,[]);assert.notEqual(result.availability,'recorded');}
});
test('failed recording backs off and does not block subsequent source minutes',async()=>{
 let attempts=0;const h=harness({write:async()=>{attempts++;throw Error('offline');}});await h.archive.record(row());await h.archive.record(row());assert.equal(attempts,1);await h.archive.record(row({timestamp:time+60}));assert.equal(attempts,2);
});
test('client session restore is one request per instrument/day, including empty/failure results',async()=>{
 let calls=0;const history=createSessionHistory(async()=>{calls++;return {data:[row()]};});const values=await Promise.all(Array.from({length:5},()=>history.read('NDX',date)));assert.equal(calls,1);assert.equal(values[0][0].zgr,-29428.66);
 await history.read('QQQ',date);assert.equal(calls,2);const empty=createSessionHistory(async()=>{throw Error('archive offline');});assert.deepEqual(await empty.read('NDX',date),[]);assert.deepEqual(await empty.read('NDX',date),[]);
});
test('restore guard cannot overwrite a new instrument/session or paused/replay selection',()=>{
 const source=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');let applied=0;const current=[row()];
 const context={state:{package:'orderflow',historyMode:false,auto:true,payload:row(),records:current},modeGeneration:1,identity:()=> 'selected',sessionHistory:{read:async()=>[row({timestamp:time-60})]},sourceDate:orderflowSessionDate,mergeSnapshots:(old,next)=>[...old,...next],collections:{set(){}},syncTimeline:()=>applied++,drawAll(){}};
 vm.runInNewContext(source.slice(source.indexOf('async function restoreOrderflowSession'),source.indexOf('function syncShell'))+';globalThis.restore=restoreOrderflowSession;',context);
 return (async()=>{await context.restore('old',1,date,'NDX');await context.restore('selected',0,date,'NDX');assert.equal(applied,0);context.state.historyMode=date;await context.restore('selected',1,date,'NDX');assert.equal(applied,0);context.state.historyMode=false;await context.restore('selected',1,date,'NDX');assert.equal(applied,1);assert.equal(context.state.records.length,2);})();
});
test('default window keeps actual close timestamp inside the plot without changing source observations',()=>{
 const source=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8'),context={};
 vm.runInNewContext(source.slice(source.indexOf('function regularWindow'),source.indexOf('function exportChartImage'))+';globalThis.windowFor=orderflowWindow;',context);
 const full=context.windowFor([{time:time*1000}],23400),rolling=context.windowFor([{time:time*1000}],5400);
 assert.ok(full.endTime>time*1000);assert.equal(full.startTime,Date.UTC(2026,9,19,13,30));assert.ok(rolling.endTime>time*1000);assert.equal(rolling.startTime,time*1000-5400000);
});

test('positioning window stays on its real session when underlying prices advance overnight',()=>{
 const source=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8'),context={};
 vm.runInNewContext(source.slice(source.indexOf('function regularWindow'),source.indexOf('function exportChartImage'))+';globalThis.windowFor=orderflowWindow;',context);
 const close=Date.UTC(2026,9,21,20),overnight=[{time:Date.UTC(2026,9,22,10)}],records=[{timestamp:close/1000}];
 for(const seconds of [23400,7200,5400]){
  const result=context.windowFor(overnight,seconds,records);
  assert.ok(result.startTime<=close&&result.endTime>=close,'latest real metric remains inside the plot');
  assert.ok(result.endTime<Date.UTC(2026,9,22),'overnight price cannot shift the options window into tomorrow');
 }
 assert.equal(context.windowFor(overnight,23400,records).startTime,Date.UTC(2026,9,21,13,30));
 assert.equal(records[0].timestamp,close/1000,'no source timestamp rewrite');
 assert.match(source,/orderflowWindow\(price\.points,panel\.period,records\)/);
 assert.match(source,/c\.sessionDate!==sessionDate\)\{views\.delete\(panel\.id\)/);
});
