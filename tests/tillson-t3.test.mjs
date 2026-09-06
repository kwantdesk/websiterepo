import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
const theme={primary:"#11ff44",secondary:"#ffaa22",positive:"#44ff66",negative:"#ff7777",muted:"#bbb"};
const bars=values=>values.map((close,i)=>({timestamp:1700000000000+i*60000,close,open:close-1,high:close+2,low:close-2,volume:i*7}));
const instance=(settings={})=>({instanceId:"t3-a",indicatorId:"tillson-t3",enabled:true,settings:{...defaultIndicatorSettings("tillson-t3"),...settings}});
const calc=(candles,settings={},instrument="NQ")=>calculateIndicatorSeries(instance(settings),candles,theme,{instrument});
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
function ema(values,n){
  const result=Array(values.length).fill(null);let count=0,sum=0,last;
  values.forEach((value,i)=>{
    if(value===null)return;
    if(count<n){sum+=value;if(++count<n)return;last=sum/n;}
    else last=(value*2+last*(n-1))/(n+1);
    result[i]=last;
  });return result;
}
function reference(values,n,v){
  const stages=[];for(let j=0;j<6;j++)stages.push(ema(stages.at(-1)??values,n));
  const [,,a,b,c,d]=stages;
  return values.flatMap((_,i)=>d[i]===null?[]:[-(v**3)*d[i]+(3*v*v+3*v**3)*c[i]+(-6*v*v-3*v-3*v**3)*b[i]+(1+3*v+3*v*v+v**3)*a[i]]);
}
test("documented defaults and six full seeds; linear ramp has hand-calculated lag",()=>{
  const settings=defaultIndicatorSettings("tillson-t3");assert.equal(settings.length,14);assert.equal(settings.volumeFactor,0.618);
  assert.deepEqual(calc(bars(Array(78).fill(100))),[]);
  assert.equal(calc(bars(Array(79).fill(100)))[0].data[0].value,100);
  const ramp=calc(bars([1,2,3,4,5,6,7,8]),{length:2})[0].data;
  near(ramp[0].value,7-1.5+1.5*0.618);near(ramp[1].value,8-1.5+1.5*0.618);
});
test("independent batch EMA/coefficient reference matches all factor limits and lengths",()=>{
  const values=Array.from({length:300},(_,i)=>100+Math.sin(i/11)*7+i/10);
  for(const length of [2,3,14,30])for(const volumeFactor of [0,0.618,1]){
    const a=calc(bars(values),{length,volumeFactor})[0].data.map(p=>p.value);
    const b=reference(values,length,volumeFactor);assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],1e-8));
  }
});
test("identity, constant preservation and factor actually changing the output",()=>{
  const values=[1e12+0.125,1e12+0.25,1e12+0.5];
  assert.deepEqual(calc(bars(values),{length:1})[0].data.map(p=>p.value),values);
  assert.ok(calc(bars(Array(150).fill(1e12)))[0].data.every(p=>p.value===1e12));
  const candles=bars(Array.from({length:150},(_,i)=>Math.sin(i/9)*20));
  assert.notDeepEqual(calc(candles,{volumeFactor:0})[0].data,calc(candles,{volumeFactor:1})[0].data);
});
test("five real source fields; volume factor is not traded volume and absent volume is not zero",()=>{
  const candles=bars(Array.from({length:120},(_,i)=>100+i/10));
  for(const inputData of ["close","open","high","low","volume"]){
    const a=calc(candles,{inputData})[0].data;
    const b=reference(candles.map(c=>c[inputData]),14,0.618);a.forEach((p,i)=>near(p.value,b[i],1e-8));
  }
  const noVolume=candles.map(c=>({...c,volume:undefined}));assert.ok(calc(noVolume).length);
  assert.deepEqual(calc(noVolume,{inputData:"volume"}),[]);
  assert.deepEqual(calc(candles,{inputData:"volume"},"SPX"),[]);
  assert.ok(calc(candles,{},"SPX").length);
  assert.equal(calc(candles,{inputData:"volume"},"QQQ")[0].priceScaleId,"t3-t3-a");
});
test("invalid data resets every EMA; event timestamps and causal prefixes survive",()=>{
  const candles=bars(Array.from({length:30},(_,i)=>100+Math.sin(i)));
  const broken=candles.map(c=>({...c}));broken[12].close=NaN;
  const output=calc(broken,{length:2})[0].data;assert.equal(output.filter(p=>p.breakBefore).length,1);
  const after=calc(broken.slice(13),{length:2})[0].data;
  assert.deepEqual(output.filter(p=>p.time>=broken[19].timestamp/1000).map(p=>p.value),after.map(p=>p.value));
  const event=candles.map((c,i)=>({...c,timestamp:1700000000000+i}));assert.equal(new Set(calc(event,{length:2})[0].data.map(p=>p.time)).size,24);
  assert.deepEqual(calc(candles.slice(0,20),{length:2})[0].data,calc(candles,{length:2})[0].data.slice(0,14));
  const changed=candles.map(c=>({...c}));changed.at(-1).close=1000;
  assert.deepEqual(calc(changed,{length:2})[0].data.slice(0,-1),calc(candles,{length:2})[0].data.slice(0,-1));
});
test("slope/none, colours, short name, styles and saved settings reach the output",()=>{
  const candles=bars(Array.from({length:120},(_,i)=>100-i));
  const settings={length:2,useThemeColors:false,plotColor:"#123456",secondaryColor:"#abcdef",shortName:"  Fast T3  ",displayStyle:"line-points",lineStyle:"dotted",lineWidth:3};
  const series=calc(candles,settings)[0];assert.equal(series.label,"Fast T3");assert.equal(series.data[1].color,"#abcdef");
  assert.equal(calc(candles,{...settings,colorMode:"none"})[0].data[1].color,"#123456");
  assert.equal(calc(candles,{...settings,useThemeColors:true})[0].data[1].color,theme.secondary);
  assert.equal(series.pointMarkersVisible,true);assert.equal(series.lineVisible,true);assert.equal(series.lineWidth,3);
  const restored=normalizePaneIndicatorState(JSON.parse(JSON.stringify({pane:[instance(settings)]}))).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored,candles,theme),calc(candles,settings));
  assert.deepEqual(calculateIndicatorSeries({...instance(),enabled:false},candles,theme),[]);
});
test("release registration and actual deep-history routing cover maximum warmup",()=>{
  assert.ok(!auditIndicatorLibrary().pending.some(r=>r.id==="tillson-t3"));
  const file=ts.createSourceFile("Chart.tsx",readFileSync("src/components/Chart.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let members=[],limit=0;
  const visit=node=>{if(ts.isVariableDeclaration(node)){if(node.name.getText(file)==="DEEP_HISTORY_INDICATOR_IDS")members=node.initializer.arguments[0].elements.map(e=>e.text);if(node.name.getText(file)==="DEEP_HISTORY_INDICATOR_MAX_BARS")limit=Number(node.initializer.text);}ts.forEachChild(node,visit);};visit(file);
  assert.ok(members.includes("tillson-t3"));assert.ok(limit>=5995);
  assert.equal(calc(bars(Array(5995).fill(100)),{length:1000})[0].data.length,1);
});
