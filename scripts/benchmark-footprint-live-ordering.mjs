// Local synthetic hot-path benchmark; no provider traffic or owner state.
import fs from 'node:fs';
import cp from 'node:child_process';
import ts from 'typescript';
import * as analytics from '../src/lib/footprintAnalytics.ts';
import * as types from '../src/lib/footprintTypes.ts';

function load(source,dependencies){
 const exports={};
 new Function('exports','require','process',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(
  exports,name=>{for(const [key,value] of Object.entries(dependencies))if(name.includes(key))return value;throw Error(name);},process);
 return exports;
}
const baseline=load(cp.execFileSync('git',['show','ba4081fc:src/lib/footprintTradeAdapter.ts'],{encoding:'utf8'}),{});
const fixed=load(fs.readFileSync(new URL('../src/lib/footprintTradeAdapter.ts',import.meta.url),'utf8'),{});
const source=fs.readFileSync(new URL('../src/lib/footprint.ts',import.meta.url),'utf8');
const at=Date.UTC(2026,9,28,0),candle={timestamp:at,open:20000,high:20010,low:19990,close:20000,volume:25000};
const records=Array.from({length:25000},(_,i)=>({recordIndex:i,eventId:String(i),timestamp:at+Math.floor(i/20),open:20000,high:20000,low:20000,close:20000+(i%60-30)*.25,volume:1,trades:1,bidVolume:i%2,askVolume:1-i%2,delta:i%2?-1:1,aggressor:i%2?'SELL':'BUY',sideSemanticsVersion:2}));
const settings={tickSize:.25,groupTicks:1,minimumTradeVolume:0,maximumTradeVolume:0,imbalanceMode:'diagonal',minimumImbalancePercent:300,minimumDelta:0,includeZero:false,instrument:'NQ'};
for(const [name,implementation] of [['baseline',baseline],['fixed',fixed]]){
 const builder=load(source,{footprintAnalytics:analytics,footprintTradeAdapter:implementation,footprintTypes:types});
 const cache={current:null};builder.buildFootprintBarsCached(cache,[candle],records,settings);
 const times=[];let bars;
 for(let i=0;i<7;i++){const start=performance.now();bars=builder.buildFootprintBarsCached(cache,[candle],records,settings);times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 console.log(JSON.stringify({name,records:records.length,sameMillisecondBurst:20,medianMs:times[3],p95Ms:times[6],volume:bars[0].totalVolume,delta:bars[0].delta,rows:bars[0].rows.length}));
}
