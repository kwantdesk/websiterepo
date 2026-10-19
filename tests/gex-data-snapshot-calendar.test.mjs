import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {equityOptionSnapshotSchedule,snapshotControlTimeline,sessionMinuteTimestamp} from '../public/gex-data-app/snapshot-model.js';

const source=readFileSync(new URL('../src/lib/gexDataPolicy.ts',import.meta.url),'utf8'),policy={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:policy,Intl,Date,structuredClone,Set,Number,Error,Object,Array});
const calendar=()=>JSON.parse(JSON.stringify(policy.gexDataCalendar()));
const server=(ticker,date)=>JSON.parse(JSON.stringify(policy.gexDataEquityOptionSchedule(ticker,date)));

test('selected historical date is certified from the calendar years, not the current clock date',()=>{
  const market=policy.gexDataClock(new Date('2029-01-02T17:00:00Z'));
  assert.equal(market.calendarVerified,false);
  const expected={verified:true,sessionDate:'2026-10-16',timeZone:'America/New_York',openMinute:570,closeMinute:975};
  assert.deepEqual(equityOptionSnapshotSchedule('SPY','2026-10-16',JSON.parse(JSON.stringify(market.calendar))),expected);
  assert.deepEqual(server('SPY','2026-10-16'),expected);
  assert.equal(equityOptionSnapshotSchedule('SPY','2029-01-02',calendar()),null);
  assert.equal(server('SPY','2029-01-02'),null);
});

test('SPY/QQQ/IWM alone receive ETF option hours, including normalized ticker case',()=>{
  for(const ticker of ['SPY','QQQ','IWM',' spy '])assert.deepEqual(equityOptionSnapshotSchedule(ticker,'2026-10-16',calendar()),server(ticker,'2026-10-16'));
  for(const ticker of ['SPX','SPXW','NDX','VIX','XSP','AAPL','ES','',null]){
    assert.equal(equityOptionSnapshotSchedule(ticker,'2026-10-16',calendar()),null);
    assert.equal(policy.gexDataEquityOptionSchedule(ticker,'2026-10-16'),null);
  }
  const broader=calendar();broader.equityOptions.symbols.push('SPX');
  assert.equal(equityOptionSnapshotSchedule('SPX','2026-10-16',broader),null);
});

test('all serialized holidays, weekend dates and malformed dates fail closed',()=>{
  const value=calendar();
  for(const [year,dates]of Object.entries(value.holidays))for(const date of dates){const selected=year+'-'+date;assert.equal(equityOptionSnapshotSchedule('QQQ',selected,value),null);assert.equal(server('QQQ',selected),null);}
  for(const selected of ['2026-10-17','2026-10-18','2026-02-30','2027-02-29','not-date','2026-1-02','2025-10-16']){
    assert.equal(equityOptionSnapshotSchedule('SPY',selected,value),null);assert.equal(server('SPY',selected),null);
  }
  assert.ok(equityOptionSnapshotSchedule('IWM','2028-02-29',value));
});

test('every existing early close resolves its own13:15 clock independent of today',()=>{
  const value=calendar();
  for(const date of value.earlyCloses){
    const expected={verified:true,sessionDate:date,timeZone:'America/New_York',openMinute:570,closeMinute:795};
    assert.deepEqual(equityOptionSnapshotSchedule('SPY',date,value),expected);assert.deepEqual(server('SPY',date),expected);
  }
  assert.equal(equityOptionSnapshotSchedule('SPY','2026-11-30',value).closeMinute,975);
});

test('calendar serialization does not expose mutable policy arrays or silently broaden malformed contracts',()=>{
  const value=policy.gexDataCalendar();value.holidays['2026'].length=0;value.earlyCloses.length=0;value.equityOptions.symbols.push('SPX');
  assert.equal(server('SPY','2026-11-26'),null);assert.equal(server('SPY','2026-11-27').closeMinute,795);
  for(const bad of [null,{}, {...calendar(),version:2},{...calendar(),timeZone:'UTC'},{...calendar(),verifiedYears:[]},{...calendar(),holidays:{}},{...calendar(),earlyCloses:null},{...calendar(),equityOptions:{symbols:['SPY'],openMinute:0,closeMinute:1440,earlyCloseMinute:795}}])assert.equal(equityOptionSnapshotSchedule('SPY','2026-10-16',bad),null);
});

test('server and browser resolver agree across every calendar day in the three verified years',()=>{
  const value=calendar();
  for(const year of value.verifiedYears){
    const date=new Date(`${year}-01-01T12:00Z`);
    while(String(date.getUTCFullYear())===year){const selected=date.toISOString().slice(0,10);assert.deepEqual(equityOptionSnapshotSchedule('SPY',selected,value),server('SPY',selected));date.setUTCDate(date.getUTCDate()+1);}
  }
});

test('resolved selected-day schedules drive DST-correct terminal controls without fabricating bars',()=>{
  for(const [date,lastMinute,expectedClose]of [['2026-10-16',404,'2026-10-16T20:15:00.000Z'],['2026-11-27',224,'2026-11-27T18:15:00.000Z']]){
    const source=[{time:sessionMinuteTimestamp(date,0)},{time:sessionMinuteTimestamp(date,lastMinute)}];
    const entries=snapshotControlTimeline(source,{sessionDate:date,schedule:equityOptionSnapshotSchedule('SPY',date,calendar()),now:Date.parse(`${date}T23:00Z`)});
    assert.equal(entries.length,3);assert.equal(new Date(entries.at(-1).time).toISOString(),expectedClose);
    assert.equal(entries.at(-1).kind,'latest');assert.ok(!entries.at(-1).snapshotTime);assert.equal(entries.at(-1).sourceTime,null);
  }
});
