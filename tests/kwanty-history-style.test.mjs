import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyDrawStyle,styledHistoryPoints,CLASSIC_HISTORY_KEYS,HISTORY_DRAW_STYLES} from '../public/kwanty-app/history-style.js';
import {drawProfile,normalizePriceHistory,preparedMajorHistory} from '../public/kwanty-app/profile-chart.js';

test('history drawing defaults only unset styles to line and preserves saved scatter',()=>{
 assert.equal(historyDrawStyle(), 'line');assert.equal(historyDrawStyle({}), 'line');
 assert.equal(historyDrawStyle({drawStyle:'scatter'}),'scatter');
 assert.equal(historyDrawStyle({drawStyle:'line'}),'line');
 assert.equal(historyDrawStyle({drawStyle:null}),'scatter');
 assert.deepEqual(HISTORY_DRAW_STYLES.map(v=>[v.value,v.label]),[['scatter','Scatter'],['line','Line (300 MA)']]);
});

test('trailing mean is 300 observations, warmed up, rounded to two decimals, and immutable',()=>{
 const points=Array.from({length:601},(_,i)=>({time:i*1234,spot:i+1})),saved=structuredClone(points);
 const result=styledHistoryPoints(points);
 for(let i=0;i<points.length;i++){
  const observed=points.slice(Math.max(0,i-299),i+1),expected=Number((observed.reduce((sum,p)=>sum+p.spot,0)/observed.length).toFixed(2));
  assert.equal(result[i].spot,expected);assert.equal(result[i].time,points[i].time);
 }
 assert.equal(result[0].spot,1);assert.equal(result[299].spot,150.5);assert.equal(result[300].spot,151.5);
 assert.deepEqual(points,saved);assert.equal(styledHistoryPoints(points,'scatter'),points);
});

test('conversion precedes mean and rounding; replay prefixes never borrow future observations',()=>{
 const start=Date.UTC(2026,9,21,13,30),raw=[{time:start,spot:1.234},{time:start+60000,spot:4.567},{time:start+120000,spot:1000}];
 const converted=normalizePriceHistory(raw,3,7),full=styledHistoryPoints(converted),prefix=styledHistoryPoints(converted.slice(0,2));
 assert.equal(full[0].spot,10.7);assert.equal(full[1].spot,15.7);
 assert.deepEqual(prefix,full.slice(0,2));assert.equal(full.length,3);
 assert.equal(prefix[1].spot,Number((((1.234*3+7)+(4.567*3+7))/2).toFixed(2)));
});

test('missing/null/nonfinite observations remain gaps, never zero prices or window samples',()=>{
 const points=[{time:1,spot:10},{time:2,spot:null},{time:3,spot:undefined},{time:4,spot:NaN},{time:5,spot:Infinity},{time:6,spot:''},{time:7,spot:20}];
 const result=styledHistoryPoints(points);
 for(let i=1;i<=5;i++)assert.equal(result[i],points[i]);
 assert.equal(result[6].spot,15);assert.deepEqual(result.map(p=>p.time),points.map(p=>p.time));
});

function renderTrail(key,style,values,conversion=1,conversionOffset=0){
 const calls=[],ctx={measureText:text=>({width:String(text).length*6})};
 for(const name of ['save','restore','clearRect','fillRect','fillText','beginPath','moveTo','lineTo','stroke','fill','rect','roundRect','clip','arc','setLineDash'])ctx[name]=(...args)=>calls.push({name,args,stroke:ctx.strokeStyle,fill:ctx.fillStyle});
 const settings={show_spot_history:{display:false,showHorizontalLine:false},showGrid:false,majors:false,show_volume:false,show_oi:false};
 for(const candidate of CLASSIC_HISTORY_KEYS)settings[candidate]={display:candidate===key,color:'#123abc',drawStyle:style,size:2};
 const g=drawProfile(ctx,1000,600,{package:'classic',payload:{ticker:'SPY',spot:100,strikes:[]},settings,conversion,conversionOffset,majorHistory:{[key]:values},view:{startTime:values[0].time,endTime:values.at(-1).time,minPrice:90,maxPrice:120}});
 return {g,calls:calls.filter(call=>call.stroke==='#123abc'||call.fill==='#123abc')};
}

test('all three actual Classic trails render MA lines or raw scatter through identical coordinates',()=>{
 const start=Date.UTC(2026,9,21,13,30),values=[{time:start,spot:100},{time:start+60000,spot:110}];
 for(const key of CLASSIC_HISTORY_KEYS){
  const line=renderTrail(key,'line',values),segments=line.calls.filter(c=>c.name==='lineTo');
  assert.equal(segments.length,1);assert.equal(segments[0].args[1],line.g.priceY(105));
  assert.equal(line.calls.filter(c=>c.name==='arc').length,0);
  const scatter=renderTrail(key,'scatter',values),dots=scatter.calls.filter(c=>c.name==='arc');
  assert.equal(dots.length,2);assert.equal(dots[1].args[1],scatter.g.priceY(110));assert.equal(dots[1].args[2],1.5);
  assert.equal(scatter.calls.filter(c=>c.name==='lineTo').length,0);
 }
});

test('an explicit null breaks a painted line rather than drawing a fabricated zero',()=>{
 const start=Date.UTC(2026,9,21,13,30),values=[{time:start,spot:100},{time:start+60000,spot:null},{time:start+120000,spot:110}];
 const {calls}=renderTrail(CLASSIC_HISTORY_KEYS[0],'line',values);
 assert.equal(calls.filter(c=>c.name==='lineTo').length,0);
 assert.equal(calls.filter(c=>c.name==='moveTo').length,2);
});

test('settings exposes persisted drawStyle only for the Classic history rows',()=>{
 const source=readFileSync(new URL('../public/kwanty-app/settings-editor.js',import.meta.url),'utf8');
 assert.match(source,/state\.package==='classic'&&CLASSIC_HISTORY_KEYS\.includes\(key\)\)add\('drawStyle','Draw style','select',historyDrawStyle\(value\),HISTORY_DRAW_STYLES\)/);
 assert.match(source,/next\[input\.dataset\.styleProperty\]=/);
});

test('actual repeated profile paints reuse normalization and MA, invalidating source/style/transform',()=>{
 let reads=0;const start=Date.UTC(2026,9,21,13,30),values=Array.from({length:900},(_,i)=>({time:start+i*1000,get spot(){reads++;return 100+i/1000;}}));
 const key=CLASSIC_HISTORY_KEYS[0];renderTrail(key,'line',values);const first=reads;
 assert.ok(first>=values.length);
 for(let i=0;i<20;i++)renderTrail(key,'line',values);
 assert.equal(reads,first,'pointer paints must not reread source values');
 renderTrail(key,'scatter',values);assert.ok(reads>first);const scattered=reads;
 renderTrail(key,'scatter',values);assert.equal(reads,scattered);
 renderTrail(key,'line',values,2,7);assert.ok(reads>scattered);const transformed=reads;
 renderTrail(key,'line',values,2,7);assert.equal(reads,transformed);
 const corrected=values.slice();corrected[1]={time:start+1000,spot:110};
 renderTrail(key,'line',corrected);assert.ok(reads>transformed);
 assert.equal(preparedMajorHistory(corrected)[1].spot,105);
});

test('weak source cache bounds six configurations and detects same-array append',()=>{
 const start=Date.UTC(2026,9,21,13,30),values=[{time:start,spot:100},{time:start+1000,spot:110}],first=preparedMajorHistory(values);
 for(let offset=1;offset<=6;offset++)preparedMajorHistory(values,1,offset);
 assert.notEqual(preparedMajorHistory(values),first,'oldest configuration must be evicted');
 values.push({time:start+2000,spot:120});
 const appended=preparedMajorHistory(values);assert.equal(appended.length,3);assert.equal(appended.at(-1).spot,110);
});
