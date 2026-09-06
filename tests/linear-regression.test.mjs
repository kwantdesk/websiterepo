import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
const theme = { primary:"#11ff44", secondary:"#ffaa22", positive:"#44ff66", negative:"#ff7777", muted:"#bbb" };
const bars = values => values.map((close, i) => ({ timestamp:1700000000000+i*60000, close, open:close-1, high:close+2, low:close-2, volume:i*7 }));
const instance = (settings={}) => ({instanceId:"ols-a",indicatorId:"linear-regression",enabled:true,settings:{...defaultIndicatorSettings("linear-regression"),...settings}});
const calc = (candles,settings={},instrument="NQ") => calculateIndicatorSeries(instance(settings),candles,theme,{instrument});
const near = (actual,expected,tolerance=1e-9) => assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function fit(values) {
  if(values.length===1)return values[0];
  const n=values.length, xMean=(n-1)/2, origin=values[0];
  const mean=values.reduce((sum,v)=>sum+(v-origin),0)/n;
  const cov=values.reduce((sum,v,i)=>sum+(i-xMean)*(v-origin-mean),0);
  const variance=values.reduce((sum,_,i)=>sum+(i-xMean)**2,0);
  return origin+mean+cov/variance*xMean;
}
test("hand-calculated endpoint, full warmup and straight lines",()=>{
  const data=calc(bars([1,2,4]),{length:3})[0].data;
  near(data[0].value,23/6); assert.equal(data.length,1);
  assert.deepEqual(calc(bars([1,2]),{length:3}),[]);
  const straight=calc(bars([10,12,14,16,18]),{length:3})[0].data;
  assert.deepEqual(straight.map(p=>p.value),[14,16,18]);
  assert.equal(defaultIndicatorSettings("linear-regression").length,21);
});
test("rolling ring and periodic rebases match independent centered least squares",()=>{
  const values=Array.from({length:3000},(_,i)=>100+Math.sin(i/11)*13+i/17);
  for(const length of [1,2,21,127,1000]) {
    const data=calc(bars(values),{length})[0].data;
    for(let i=0;i<data.length;i++)near(data[i].value,fit(values.slice(i,i+length)),1e-8);
  }
});
test("large price offsets with small changes remain numerically stable",()=>{
  const values=Array.from({length:4000},(_,i)=>1e12+Math.sin(i/11)*0.05+i/1000);
  const data=calc(bars(values),{length:101})[0].data;
  data.forEach((p,i)=>near(p.value,fit(values.slice(i,i+101)),0.00025));
});
test("all five sources are actual selected data; absent volume is not zero or proxy data",()=>{
  const candles=bars([11,12,15,14]);
  for(const inputData of ["close","open","high","low","volume"]) {
    const data=calc(candles,{inputData,length:3})[0].data;
    near(data[0].value,fit(candles.slice(0,3).map(b=>b[inputData])));
  }
  assert.deepEqual(calc(candles,{length:3,inputData:"volume"},"SPX"),[]);
  assert.deepEqual(calc(candles,{length:3,inputData:"volume"},"NDX"),[]);
  assert.deepEqual(calc(candles.map(b=>({...b,volume:undefined})),{length:3,inputData:"volume"}),[]);
  assert.ok(calc(candles.map(b=>({...b,volume:0})),{length:3,inputData:"volume"},"QQQ")[0].data.every(p=>p.value===0));
  assert.ok(calc(candles,{length:3},"SPX").length);
  assert.equal(calc(candles,{length:3,inputData:"volume"})[0].priceScaleId,"regression-ols-a");
});
test("gaps reset only on missing/invalid samples; timestamps and causality are preserved",()=>{
  const candles=bars([1,2,3,4,5,6,7,8]); candles[3].close=NaN;
  const data=calc(candles,{length:3})[0].data;
  assert.equal(data.length,3); assert.equal(data[1].breakBefore,true);
  const original=bars([1,4,2,8,3,12,7]);
  const event=original.map((b,i)=>({...b,timestamp:1700000000000+i}));
  assert.equal(new Set(calc(event,{length:3})[0].data.map(p=>p.time)).size,5);
  assert.deepEqual(calc(original.slice(0,5),{length:3})[0].data,calc(original,{length:3})[0].data.slice(0,3));
  const changed=original.map(b=>({...b})); changed.at(-1).close=20;
  assert.deepEqual(calc(changed,{length:3})[0].data.slice(0,-1),calc(original,{length:3})[0].data.slice(0,-1));
  const closed=original.map((b,i)=>({...b,timestamp:b.timestamp+(i>2?3*86400000:0)}));
  assert.deepEqual(calc(closed,{length:3})[0].data.map(p=>p.value),calc(original,{length:3})[0].data.map(p=>p.value));
});
test("settings, direction colours, theme, multiple-instance scales and saved normalization",()=>{
  const candles=bars([10,9,8,9,10,11]);
  const settings={length:3,secondaryColorEnabled:true,useThemeColors:false,plotColor:"#123456",secondaryColor:"#abcdef",displayStyle:"points",lineStyle:"dashed",lineWidth:4,useSecondaryAxis:true};
  const series=calc(candles,settings)[0];
  assert.equal(series.data[0].color,"#abcdef"); assert.equal(series.data.at(-1).color,"#123456");
  assert.equal(series.pointMarkersVisible,true); assert.equal(series.lineVisible,false);
  assert.equal(series.lineWidth,4); assert.equal(series.lineStyle,"dashed");
  assert.equal(calc(candles,{...settings,useThemeColors:true})[0].data[0].color,theme.secondary);
  const restored=normalizePaneIndicatorState(JSON.parse(JSON.stringify({pane:[instance(settings)]}))).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored,candles,theme),calc(candles,settings));
  const other=calculateIndicatorSeries({...instance(settings),instanceId:"ols-b"},candles,theme)[0];
  assert.notEqual(other.priceScaleId,series.priceScaleId);
  assert.deepEqual(calculateIndicatorSeries({...instance(),enabled:false},candles,theme),[]);
  assert.ok(!auditIndicatorLibrary().pending.some(r=>r.id==="linear-regression"));
});
test("the real chart routes regression to enough loaded history for its maximum length",()=>{
  const file=ts.createSourceFile("Chart.tsx",readFileSync("src/components/Chart.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let members=[],limit=0;
  const visit=node=>{
    if(ts.isVariableDeclaration(node)){
      if(node.name.getText(file)==="DEEP_HISTORY_INDICATOR_IDS")members=node.initializer.arguments[0].elements.map(e=>e.text);
      if(node.name.getText(file)==="DEEP_HISTORY_INDICATOR_MAX_BARS")limit=Number(node.initializer.text);
    }
    ts.forEachChild(node,visit);
  };visit(file);
  assert.ok(members.includes("linear-regression"));assert.ok(limit>=10000);
  assert.equal(calc(bars(Array.from({length:10001},(_,i)=>i)),{length:10000})[0].data.length,2);
});
