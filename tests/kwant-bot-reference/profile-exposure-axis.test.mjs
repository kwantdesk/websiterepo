import test from 'node:test';
import assert from 'node:assert/strict';
import { profileExposureTicks, profileTickLabel, drawProfile, calculateProfileGeometry } from '../../public/kwanty-app/profile-chart.js';

// Reviewed shipped Chart.js generator and Classic label callback; see the
// dated axis-semantics evidence for source identity and extraction ranges.
for (const [min,max,expected] of [
  [-12500,12500,['-10000.00','0.00','10000.00']],
  [-18750,18750,['-10000.00','0.00','10000.00']],
  [-31250,5000,['-20000.00','0.00']],
  [-10000,10000,['-5000.00','0.00','5000.00']],
  [0,18750,['5000.00','10000.00','15000.00']],
]) test(`exposure axis ${min}…${max} keeps nice interior labels and hides true boundaries`,()=>{
  const ticks=profileExposureTicks(min,max);
  assert.equal(ticks[0],min);assert.equal(ticks.at(-1),max);
  assert.deepEqual(ticks.map((value,index)=>profileTickLabel(value,index,ticks.length)).filter(Boolean),expected);
});

test('actual Classic canvas paints all three centered labels, without changing the data geometry',()=>{
  const labels=[];
  const ctx=new Proxy({measureText:t=>({width:t.length*6}),fillText:(text,x,y)=>{if(y===22)labels.push(text);}}, {get:(object,key)=>key in object?object[key]:(()=>{})});
  const geometry=drawProfile(ctx,900,600,{package:'classic',payload:{spot:7500,strikes:[[7500,-10000,2000,[]]]},view:{minPrice:7400,maxPrice:7600,minExposure:-12500,maxExposure:12500}});
  assert.deepEqual(labels,['-10000.00','0.00','10000.00']);
  assert.equal(geometry.minExposure,-12500);assert.equal(geometry.maxExposure,12500);
});

for(const sign of [-1,1])for(const [settings,expected]of [
 [{},[-18750,18750]],
 [{show_oi:false},[-15000,15000]],
 [{show_volume:false},[-18750,18750]],
 [{show_oi:false,show_volume:false},[-15000,15000]],
 [{priors:false},[-18750,18750]],
 [{profileBarAlignment:'left'},[0,18750]],
 [{profileBarAlignment:'right'},[-18750,0]],
])test(`Classic range uses source extents independently of marker visibility: ${sign}, ${JSON.stringify(settings)}`,()=>{
 const payload={ticker:'SPX',spot:500,strikes:[[490,sign*3000,sign*8000,[sign*12000]],[500,sign*9000,sign*15000,[sign*4000]],[510,0,sign*4000,[sign*40000]],[2500,sign*999999,sign*999999,[sign*999999]]]};
 const g=calculateProfileGeometry(900,600,{package:'classic',payload,settings});
 assert.deepEqual([g.minExposure,g.maxExposure],expected);
});
