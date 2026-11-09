import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {netDriftInitialRthIndex} from '../../public/gex-data-app/net-drift-interaction-model.js';
import {createIntervalMapTooltipSelection,intervalMapTooltipRows} from '../../public/gex-data-app/interval-map-interaction-model.js';
const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),time=Date.parse('2026-10-16T14:00:00Z');
function harness({difference=false,observedRows}={}){
 const raw=observedRows||[{time,strikes:[{strike:762,call:10,put:-20,value:-10}]},{time:time+300000,strikes:[{strike:762,call:12,put:-25,value:-13}]}],prices=[{time:time+600000,spot:763}],bounds={left:72,right:584,top:8,bottom:380,minX:time-30000,maxX:time+330000,minY:760,maxY:765};let configuration,drawArguments;
 const env={netDriftInitialRthIndex,getControl:key=>({ticker:'SPY',greek:'GAMMA',intervalValueMode:difference?'DIFFERENCE':'VALUE',strikePadding:'3',minStrike:'',maxStrike:''}[key]||''),parsePrices:()=>prices,parseInterval:()=>raw,createIntervalMapTooltipSelection,intervalMapTooltipRows,intervalStrikeWindow:()=>[760,765],intervalPreview:()=>[],quantCanvas(options){configuration=options;return {shell:{classList:{add(){}}}};},CHART_COLORS:{primary:'#fff'},formatPrice:String,compact:String,toolConfiguration:{hideCrosshairs:false,hideAxisTitles:false},gexTimeZone:()=> 'Australia/Brisbane',displayChartTime:String,chartStrikeLabel:String,drawIntervalPlot(...args){drawArguments=args;return bounds;},setSummary(){}};
 vm.runInNewContext(source.slice(source.indexOf('  function renderIntervalMapQuant('),source.indexOf('\n  function ',source.indexOf('  function renderIntervalMapQuant(')+10))+'\nthis.render=renderIntervalMapQuant;',env);env.render({});configuration.draw({},600,400,{start:0,end:1,yWindow:[0,1]});return {raw,prices,bounds,configuration,get drawArguments(){return drawArguments;}};
}
test('actual Interval renderer keeps exposure-only timeline and anchors tooltip to measured plot time/strike instead of generic hover',()=>{
 const h=harness();assert.equal(h.configuration.items.length,2);assert.equal(h.configuration.items.some(row=>row.time===h.prices[0].time),false);assert.equal(h.configuration.plotRight,16);assert.equal(Object.hasOwn(h.drawArguments[4],'right'),false);
 const pointerX=h.bounds.left+(time+300000-h.bounds.minX)/(h.bounds.maxX-h.bounds.minX)*(h.bounds.right-h.bounds.left),pointerY=h.bounds.top+(h.bounds.maxY-762)/(h.bounds.maxY-h.bounds.minY)*(h.bounds.bottom-h.bounds.top),state={pointerX,pointerY};const rows=h.configuration.tooltipRows(h.raw[0],0,state);assert.equal(rows[0],'12:05 AM on October 17, 2026');assert.equal(rows[1],'SPY $762');assert.deepEqual(rows.slice(2),['Call GEX: 12','Put GEX: -25','Net GEX: -13']);assert.equal(state.hover,1);
});
test('actual Interval Difference keeps existing delta math and exposes only Difference of Net tooltip',()=>{
 const h=harness({difference:true});assert.equal(h.configuration.items.length,1);assert.equal(h.configuration.items[0].strikes[0].value,-3);assert.equal(h.raw[1].strikes[0].value,-13,'original recorded values unchanged');const rows=h.configuration.tooltipRows(null,0,{pointerX:h.bounds.right,pointerY:h.bounds.top+(h.bounds.maxY-762)/5*(h.bounds.bottom-h.bounds.top)});assert.equal(rows.length,3);assert.equal(rows[2],'Difference of Net GEX: -3');
});

test('actual Interval initial viewport opens at cash session while retaining genuine premarket observations',()=>{
 for(const [date,open]of [['2026-11-06','14:30'],['2026-10-16','13:30']]){
  const at=Date.parse(date+'T'+open+':00Z'),observedRows=[-300000,0,300000].map(offset=>({time:at+offset,strikes:[{strike:762,call:10,put:-20,value:-10}]})),h=harness({observedRows});
  assert.equal(h.configuration.items.length,3);assert.deepEqual(JSON.parse(JSON.stringify(h.configuration.initialWindow)),{start:1,end:2});
  assert.equal(h.configuration.items[0].time,at-300000,'premarket data remains available by panning');
 }
 const early=harness({observedRows:[{time:Date.parse('2026-11-06T12:30:00Z'),strikes:[]}]});assert.equal(early.configuration.initialWindow,null);
});
