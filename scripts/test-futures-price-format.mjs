import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import{futuresAwarePriceFormat}from'../src/lib/instrumentPriceFormat.ts';
const chart=readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
const start=chart.indexOf('function getPriceFormat('),end=chart.indexOf('\nfunction withAlpha(',start);
const getFormat=vm.runInNewContext('('+ts.transpileModule(chart.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText.trim()+')',{futuresAwarePriceFormat});
const ticks={ES:.25,NQ:.25,YM:1,RTY:.1,MES:.25,MNQ:.25,M2K:.1,MYM:1,CL:.01,MCL:.01,QM:.025,NG:.001,QG:.005,RB:.0001,HO:.0001,GC:.1,MGC:.1,SI:.005,SIL:.005,HG:.0005,PL:.1,PA:.1,ZN:1/64,ZB:1/32,ZF:1/128,ZT:1/256,TN:1/64,UB:1/32,'10Y':.001,SR3:.0025,'6E':.00005,M6E:.0001,'6B':.0001,M6B:.0001,'6A':.00005,M6A:.0001,'6J':.0000005,'6C':.00005,'6S':.00005,'6N':.00005,'6M':.00001,BTC:5,MBT:5,ETH:.5,MET:.5,ZC:.25,ZS:.25,ZW:.25,ZM:.1,ZL:.01,LE:.025,HE:.025,GF:.025};
test('every catalogue future uses its actual tick and sufficient candle precision',()=>{
 assert.equal(Object.keys(ticks).length,53);
 for(const[root,tick]of Object.entries(ticks))for(const symbol of [root,root+'.v.0',root+'Z6']){
  const f=getFormat(symbol);assert.equal(f.minMove,tick,symbol);assert.equal(Number(tick.toFixed(f.precision)),tick,symbol+' must not round away a tick');
 }
 assert.equal(getFormat('6M.v.0').precision,5);assert.equal(getFormat('6J.v.0').precision,7);assert.equal(getFormat('UB.v.0').precision,5);assert.equal(getFormat('ZT.v.0').precision,8);
});
test('ordinary stocks retain cents and forex retains its prior formatting',()=>{
 for(const symbol of ['META','AMD','SPY','QQQ'])assert.equal(getFormat(symbol).minMove,.01);
 assert.equal(getFormat('EURUSD').precision,5);assert.equal(getFormat('USDJPY').precision,3);
});
test('gateway instrument metadata agrees with chart ticks for the complete catalogue',()=>{
 const source=readFileSync(new URL('../services/rithmic_gateway/src/server.mjs',import.meta.url),'utf8'),start=source.indexOf('function tickSize('),end=source.indexOf('\nconst MONTH_CODES',start);
 const tickSize=vm.runInNewContext('('+source.slice(start,end).trim()+')',{contractRoot:value=>String(value).toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/,'')});for(const[root,tick]of Object.entries(ticks))assert.equal(tickSize(root),tick,root);
});
