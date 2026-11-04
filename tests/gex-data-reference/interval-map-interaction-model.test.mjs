import test from 'node:test';
import assert from 'node:assert/strict';
import {intervalMapTooltipRows,createIntervalMapTooltipSelection,intervalMapTimeDomain,intervalMapPlotInsets} from '../../public/gex-data-app/interval-map-interaction-model.js';
import {drawIntervalPlot,bubbleDiameter} from '../../public/gex-data-app/chart-primitives.js';

// Source533485 field/format contract + parent-owned native Oct16 SPY samples.
// These formatting checks do not certify unobserved mathematical population.
const time=Date.parse('2026-10-16T20:00:00Z'),row={time,spot:762.46},point={strike:762,call:6e9,put:-10.1e9,value:-4.1e9};
test('Difference source tooltip has full selected-zone date, automatic strike precision and no invented underlying row',()=>{
 assert.deepEqual(intervalMapTooltipRows(row,point,{ticker:'SPY',mode:'DIFFERENCE',timeZone:'Australia/Brisbane'}),['6:00 AM on October 17, 2026','SPY $762','Difference of Net GEX: -4.10 B']);
 const positive=intervalMapTooltipRows(row,{...point,strike:765,value:2.34e9},{ticker:'SPY',mode:'DIFFERENCE',timeZone:'Australia/Brisbane'});
 assert.equal(positive.at(-1),'Difference of Net GEX: 2.34 B');assert.ok(!positive.join(' ').includes('+'));assert.ok(!positive.join(' ').includes('762.46'));
});
test('Value source tooltip includes Call/Put/Net, greek codes and fractional currency',()=>{
 assert.deepEqual(intervalMapTooltipRows(row,{...point,strike:762.5},{ticker:'SPY',greek:'DELTA',timeZone:'Australia/Brisbane'}),['6:00 AM on October 17, 2026','SPY $762.50','Call DEX: 6 B','Put DEX: -10.10 B','Net DEX: -4.10 B']);
 assert.equal(intervalMapTooltipRows(row,{...point,value:-12.45e9},{ticker:'SPY',greek:'CHARM',mode:'DIFFERENCE'}).at(-1),'Difference of Net CHEX: -12.45 B');
 assert.match(intervalMapTooltipRows(row,point,{ticker:'SPY',greek:'VANNA'})[2],/^Call VEX:/);
});
test('missing values remain unknown; no fabricated net/call/put or zero replacement',()=>{
 assert.deepEqual(intervalMapTooltipRows(row,{strike:762},{ticker:'SPY',timeZone:'UTC'}).slice(2),['Call GEX: —','Put GEX: —','Net GEX: —']);
 assert.deepEqual(intervalMapTooltipRows(null,point),[]);assert.deepEqual(intervalMapTooltipRows(row,null),[]);
 assert.match(intervalMapTooltipRows(row,{strike:0,call:0,put:0,value:0},{ticker:'SPY'}).at(-1),/Net GEX: 0$/);
});
test('selected timezone changes date as well as clock across midnight',()=>{
 assert.equal(intervalMapTooltipRows(row,point,{timeZone:'America/New_York'})[0],'4:00 PM on October 16, 2026');
 assert.equal(intervalMapTooltipRows(row,point,{timeZone:'UTC'})[0],'8:00 PM on October 16, 2026');
});
test('tooltip selects nearest real exposure time at the nearest strike, never a price-only bucket',()=>{
 const observations=[{time:1000,strikes:[{strike:100,value:11}]},{time:2000,spot:101,strikes:[]},{time:3000,strikes:[{strike:100,value:22},{strike:102,value:33}]}],before=JSON.stringify(observations),select=createIntervalMapTooltipSelection(observations);
 assert.equal(select(2000,100).point.value,22,'strict tie picks later source observation');assert.equal(select(1000,102).point.value,33,'nearest strike keeps its own actual observation time');assert.equal(select(999,99).row.time,1000);assert.equal(select(9999,103).row.time,3000);assert.equal(createIntervalMapTooltipSelection([])(1000,1),null);assert.equal(JSON.stringify(observations),before);
});
test('Interval-only x padding is 1% with minimum30seconds including fractional exposure viewport',()=>{
 const rows=[{time:0},{time:1800000},{time:3600000}];assert.deepEqual(intervalMapTimeDomain(rows),{firstTime:0,lastTime:3600000,padding:36000,min:-36000,max:3636000});
 assert.deepEqual(intervalMapTimeDomain(rows,.5,1.5),{firstTime:900000,lastTime:2700000,padding:30000,min:870000,max:2730000});
 assert.equal(intervalMapTimeDomain([{time:1000}]).min,-29000);assert.equal(intervalMapTimeDomain([{time:1000}]).max,31000);
});
test('source measured-label insets retain brand-font measurement without fixed right rail reservation',()=>{
 assert.deepEqual(intervalMapPlotInsets(600,400,['$762','$765'],{measureText:()=>31.2}),{left:70,right:584,top:8,bottom:380});
 assert.equal(intervalMapPlotInsets(600,400,['$762'],{measureText:()=>31.2,hideAxisTitles:true}).left,48);
});
test('renderer uses real exposure time domain, clips independent price observations and does not invent Market Open',()=>{
 const calls=[],ctx=new Proxy({measureText:()=>({width:30})},{get:(object,key)=>object[key]??((...args)=>calls.push([key,...args])),set:(object,key,value)=>(object[key]=value,true)});
 const start=Date.parse('2026-10-16T13:30:00Z'),rows=[{time:start,strikes:[{strike:762,value:10}]},{time:start+300000,strikes:[{strike:762,value:20}]}],before=JSON.stringify(rows),prices=[{time:start-60000,spot:500},{time:start+60000,spot:762},{time:start+240000,spot:763},{time:start+360000,spot:1000}];
 const result=drawIntervalPlot(ctx,600,400,rows,{prices,padding:1});assert.equal(result.minX,start-30000);assert.equal(result.maxX,start+330000);assert.equal(result.right,584);assert.equal(result.top,8);assert.equal(result.bottom,380);assert.ok(!calls.some(([method,text])=>method==='fillText'&&text==='Market Open'));assert.ok(!calls.some(([method,x])=>method==='lineTo'&&x===result.xFor(start+360000)));assert.equal(JSON.stringify(rows),before);
 assert.equal(bubbleDiameter(20,20),20);assert.equal(bubbleDiameter(10,20),10.5);assert.equal(result.cells,2);
});
test('fractional exposure viewport excludes neighboring buckets from bubbles and radius normalization',()=>{
 const ctx=new Proxy({measureText:()=>({width:30})},{get:(object,key)=>object[key]??(()=>{}),set:(object,key,value)=>(object[key]=value,true)}),rows=[{time:0,strikes:[{strike:762,value:1000000}]},{time:300000,strikes:[{strike:762,value:20}]},{time:600000,strikes:[{strike:762,value:2000000}]}];
 const result=drawIntervalPlot(ctx,600,400,rows,{start:.1,end:1.9});assert.equal(result.cells,1);assert.equal(result.maxAbs,20);assert.equal(bubbleDiameter(20,result.maxAbs),20);
});
