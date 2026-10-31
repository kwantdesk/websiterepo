import test from "node:test";
import assert from "node:assert/strict";
import { runRecordedAlgoBacktest } from "../src/lib/algoBacktest.ts";
import { defaultAlgoConfig, algoSessionTimestamp } from "../src/lib/algoWorkspace.ts";
import { ALGO_INSTRUMENTS } from "../src/lib/algoWorkspace.ts";
import { paperContractSpec } from "../src/lib/paperTrading.ts";
const now=Date.parse("2026-10-31T00:00:00Z");
function fixture() {
  const config={...defaultAlgoConfig(new Date(now)),from:"2026-10-30",to:"2026-10-30",sessionStart:"09:30",sessionEnd:"10:00",commission:2.5,slippageTicks:1};
  for(const [id,p] of Object.entries(config.algorithms)) Object.assign(p,{enabled:id==="opening-range",lookback:3,stopTicks:4,targetTicks:4});
  const t=algoSessionTimestamp(config.from,config.sessionStart,config.timeZone);
  const bars=Array.from({length:30},(_,i)=>({timestamp:t+i*60000,open:100,high:100.25,low:99.75,close:100,volume:100}));
  bars[3]={...bars[3],close:101,high:101.25};
  bars[4]={...bars[4],open:101,close:102,high:102.25,low:100.75};
  return {config,bars};
}
test("recorded ORB enters after closed signal and reconciles fees/equity",()=>{
  const {config,bars}=fixture(), saved=structuredClone(bars),r=runRecordedAlgoBacktest(config,bars,now),t=r.trades[0];
  assert.equal(r.kind,"recorded");assert.equal(r.trades.length,1);
  assert.equal(t.entryTime,bars[4].timestamp);assert.equal(t.entryPrice,101);assert.equal(t.exitPrice,102);
  assert.equal(t.reason,"TP");assert.equal(t.gross,20);assert.equal(t.costs,15);assert.equal(t.net,5);
  assert.equal(r.equity.at(-1).equity,config.capital+5);assert.deepEqual(bars,saved);
});
test("both brackets in one bar use conservative stop-first",()=>{
  const {config,bars}=fixture();bars[4].low=99;
  const t=runRecordedAlgoBacktest(config,bars,now).trades[0];assert.equal(t.reason,"SL");assert.equal(t.exitPrice,100);
});
test("adverse opening gap fills at real open, not an unreachable stop",()=>{
  const {config,bars}=fixture();Object.assign(bars[4],{close:101,high:101.25});
  Object.assign(bars[5],{open:98,high:98.25,low:97,close:98});
  const t=runRecordedAlgoBacktest(config,bars,now).trades[0];assert.equal(t.reason,"SL");assert.equal(t.exitPrice,98);
});
test("historical trades cannot change when later bars change",()=>{
  const {config,bars}=fixture(), first=runRecordedAlgoBacktest(config,bars,now).trades;
  bars[20]={...bars[20],high:1000};assert.deepEqual(runRecordedAlgoBacktest(config,bars,now).trades,first);
});
test("missing/invalid/conflicting history cannot yield invented fills",()=>{
  for(const kind of ["missing","invalid","conflict"]){
    const {config,bars}=fixture();
    if(kind==="missing")bars.splice(8,1);
    if(kind==="invalid")bars[1].high=90;
    if(kind==="conflict")bars.push({...bars[0],close:100.1});
    assert.throws(()=>runRecordedAlgoBacktest(config,bars,now),/incomplete|invalid|conflicting/);
  }
});
test("no signal produces zero trades, not a scheduled alternating trade",()=>{
  const {config,bars}=fixture();bars[3]={...bars[2],timestamp:bars[3].timestamp};bars[4]={...bars[2],timestamp:bars[4].timestamp};
  assert.equal(runRecordedAlgoBacktest(config,bars,now).trades.length,0);
});
test("short ORB uses genuine downward breakout and proper price direction",()=>{
  const {config,bars}=fixture();Object.assign(bars[3],{high:100.25,low:98.75,close:99});
  Object.assign(bars[4],{open:99,high:99.25,low:97.75,close:98});
  const t=runRecordedAlgoBacktest(config,bars,now).trades[0];assert.equal(t.direction,"Short");assert.equal(t.exitPrice,98);assert.equal(t.net,5);
});
test("unfinished sessions and oversized ranges fail",()=>{
  const {config,bars}=fixture();assert.throws(()=>runRecordedAlgoBacktest(config,bars,bars[4].timestamp),/completed/);
  config.from="2026-09-01";assert.throws(()=>runRecordedAlgoBacktest(config,bars,now),/30 calendar/);
});
test("trend uses preceding range only; VWAP requires actual volume",()=>{
  const {config,bars}=fixture();config.algorithms["opening-range"].enabled=false;config.algorithms["trend-continuation"].enabled=true;
  assert.equal(runRecordedAlgoBacktest(config,bars,now).trades[0].entryTime,bars[4].timestamp);
  config.algorithms["trend-continuation"].enabled=false;config.algorithms["vwap-reversion"].enabled=true;
  bars[1].volume=undefined;assert.throws(()=>runRecordedAlgoBacktest(config,bars,now),/volume/);
});
test("VWAP crossover is a closed-bar signal followed by an open entry",()=>{
  const {config,bars}=fixture();config.algorithms["opening-range"].enabled=false;config.algorithms["vwap-reversion"].enabled=true;
  Object.assign(bars[1],{close:99,low:98.75});
  Object.assign(bars[2],{open:99,high:99.25,low:98.75,close:99});
  const t=runRecordedAlgoBacktest(config,bars,now).trades[0];
  assert.equal(t.direction,"Long");assert.equal(t.entryTime,bars[4].timestamp);assert.equal(t.reason,"TP");
});
test("all six supported contracts use the normal trading engine's tick/value specs",()=>{
  for (const [symbol, spec] of Object.entries(ALGO_INSTRUMENTS)) {
    const canonical=paperContractSpec(symbol);
    assert.equal(spec.tick,canonical.tickSize,symbol);assert.equal(spec.pointValue,canonical.pointValue,symbol);
    const {config,bars}=fixture();config.instrument=symbol;
    const t=runRecordedAlgoBacktest(config,bars,now).trades[0];
    assert.ok(Math.abs(t.gross-(t.exitPrice-t.entryPrice)*canonical.pointValue)<1e-6,symbol);
  }
});
