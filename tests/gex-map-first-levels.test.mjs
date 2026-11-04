import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const text=readFileSync(new URL('../src/lib/quantData.server.ts',import.meta.url),'utf8');
const start=text.indexOf('async function buildGexMapPanel('),end=text.indexOf('\n/**',start+10);
const executable=ts.transpileModule(text.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const day='2026-11-04',stamp=Date.parse(day+'T18:00:00Z'),strikes=[{strike:7700,call:20,put:-10,net:10}];
function fixture({historical=false,empty=false,open=true}={}){
 const calls=[];let release;const held=new Promise(r=>release=r);
 const context={Map,Date,Promise,Math,DEFAULT_GEX_MAP_EXPIRY_SCOPE:'FRONT_EXPIRY',DEFAULT_GEX_MAP_REPRESENTATION:'PER_ONE_DOLLAR_MOVE',OPTIONS_SURFACE_REFRESH_MS:5000,
 gexMapProviderTicker:x=>x,getUsOptionsSession:()=>({sessionDate:day,marketOpen:open}),optionsOpeningClock:()=>({opening:false}),QuantDataError:Error,
 quantDataPost:async(path,body)=>{calls.push({path,body});if(path.endsWith('interval-map')){await held;return{payload:{},remaining:100}}return{payload:{},remaining:100}},
 parseExposure:()=>({expiries:[{expiration:day}],strikes:empty?[]:strikes}),parseCandles:()=>[{timestamp:stamp,open:7700,close:7701}],readStockPrice:()=>7701,
 parseFullChainGexMapFrames:()=>[],parseGexMapFrames:()=>[],latestGexMapStrikesFromFrames:()=>strikes};
 vm.runInNewContext(executable+'\nthis.build=buildGexMapPanel;',context);
 return {calls,release,build:(head)=>context.build('SPX','GAMMA',historical?'2026-11-03':undefined,'FRONT_EXPIRY','PER_ONE_DOLLAR_MOVE',head)};
}
test('current SPX ladder resolves without starting or waiting for interval history',async()=>{
 const f=fixture(),result=await f.build(true);assert.deepEqual(f.calls.map(x=>x.path),['/options/tool/exposure-by-strike','/equities/tool/stock-price-over-time']);
 assert.equal(result.latestStrikes,strikes);assert.equal(result.frames.length,0);assert.equal(result.historyPending,true);assert.equal(result.expiration,day);
});
for(const options of [{},{historical:true},{open:false},{empty:true}])test('full/replay/closed/empty paths retain genuine history acquisition '+JSON.stringify(options),async()=>{
 const f=fixture(options);let resolved=false;const promise=f.build(Object.keys(options).length>0).then(x=>{resolved=true;return x});await new Promise(r=>setImmediate(r));assert.ok(f.calls.some(x=>x.path.endsWith('interval-map')));assert.equal(resolved,false);f.release();await promise;
});
