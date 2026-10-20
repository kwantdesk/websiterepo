import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {foldIntervalUpdates,precedingIntervalSpot,intervalTimeline,averagedIvRank,drawIntervalPlot} from '../../public/gex-data-app/chart-primitives.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
const context={unwrapArchive:value=>value,foldIntervalUpdates,precedingIntervalSpot};
vm.runInNewContext(source.slice(source.indexOf('function parseInterval('),source.indexOf('function drawExposure('))+'\nthis.parse=parseInterval;',context);

test('price-only timestamps never manufacture carried exposure snapshots',()=>{
  const prices=[{time:2000,spot:101},{time:3000,spot:102},{time:7000,spot:103}];
  const rows=context.parse({data:{1000:{A:{100:{CALL:20,PUT:-5}}},5000:{A:{100:{CALL:0}}}}},prices);
  assert.deepEqual(Array.from(rows,row=>row.time),[1000,5000]);
  assert.equal(rows[0].spot,undefined);assert.equal(rows[1].spot,102);
  assert.deepEqual(Array.from(rows,row=>row.strikes[0].value),[15,-5]);
  const timeline=intervalTimeline(rows,prices);
  assert.deepEqual(timeline.map(row=>row.time),[1000,2000,3000,5000,7000]);
  assert.equal(timeline.filter(row=>row.strikes.length).length,2);
  for(const time of [2000,3000,7000])assert.deepEqual(timeline.find(row=>row.time===time).strikes,[]);
});
test('tooltip price cannot use future or stale data; a measured zero is preserved',()=>{
  const prices=[{time:100000,spot:0},{time:200000,spot:101}];
  assert.equal(precedingIntervalSpot(prices,99999),undefined);
  assert.equal(precedingIntervalSpot(prices,100000),0);
  assert.equal(precedingIntervalSpot(prices,160000),0);
  assert.equal(precedingIntervalSpot(prices,160001),undefined);
  assert.equal(precedingIntervalSpot(prices,200000),101);
});
test('an actual empty exposure update carries state, but an absent bucket stays absent',()=>{
  const rows=context.parse({data:{1:{A:{100:{CALL:20,PUT:-5}}},3:{},5:{A:{100:{PUT:0}}}}});
  assert.deepEqual(Array.from(rows,row=>row.time),[1,3,5]);
  assert.deepEqual(Array.from(rows,row=>row.strikes[0].value),[15,15,20]);
});
test('IV missing inputs do not become negative measured ranks; valid zero remains valid',()=>{
  for(const missing of [null,undefined,'',' ',NaN,Infinity,false,true,[],{}]){
    assert.equal(averagedIvRank({CALL:{lastIv:missing,windowMinIv:.1,windowMaxIv:.3}}),null);
  }
  assert.equal(averagedIvRank({CALL:{lastIv:0,windowMinIv:0,windowMaxIv:1}}),0);
  assert.equal(averagedIvRank({CALL:{lastIv:.2,windowMinIv:.1,windowMaxIv:.3},PUT:{lastIv:null,windowMinIv:.1,windowMaxIv:.3}}),50.000000000000014);
});
test('interval renderer draws independent stock observations without exposure bubbles at them',()=>{
  const calls=[],ctx=new Proxy({measureText:()=>({width:10})},{get:(obj,key)=>obj[key]??((...args)=>calls.push([key,...args])),set:(obj,key,value)=>(obj[key]=value,true)});
  const rows=[{time:1000,strikes:[{strike:100,value:20}]},{time:5000,strikes:[{strike:100,value:10}]}],prices=[{time:2000,spot:99},{time:3000,spot:101},{time:7000,spot:100}];
  const result=drawIntervalPlot(ctx,600,400,intervalTimeline(rows,prices),{prices,padding:1});
  assert.equal(result.cells,2);
  assert.ok(calls.some(([name,x,y])=>name==='lineTo'&&x===result.xFor(3000)&&y===result.yFor(101)));
});
test('fractionally zoomed Net Drift clips premium, price and volume to their own panes',()=>{
  let drawing,depth=0,clips=0;
  const rows=[0,1,2].map(time=>({time:time*60000,call:time,put:-time,net:2*time,spot:100+time,callVolume:time,putVolume:0}));
  const sandbox={parseNetDrift:()=>rows,getControl:key=>key==='ticker'?'SPY':'HIDE',buildRequest:()=>({}),activeTool:{id:'net-drift'},gexTimeZone:()=> 'UTC',CHART_COLORS:{},compact:String,formatPrice:String,setSummary(){},quantCanvas:options=>{drawing=options.draw;return {};},safeBounds:()=>[0,3],niceValueDomain:()=>({min:0,max:3}),timeDomain:()=>({min:30000,max:90000}),timeX:(time,domain,left,right)=>left+(time-domain.min)/(domain.max-domain.min)*(right-left),drawHorizontalTicks(){},drawAxisLabels(){},drawTimeLabels(){},drawChartCrosshair(){},quantLine(){assert.ok(depth>0,'premium lines must be clipped');},drawSignedVolume(){assert.ok(depth>0,'volume must be clipped');}};
  vm.runInNewContext(source.slice(source.indexOf('  function renderNetDriftQuant('),source.indexOf('  function renderDarkFlowQuant('))+'\nthis.render=renderNetDriftQuant;',sandbox);
  sandbox.render({});
  const ctx={save(){depth++;},restore(){depth--;},beginPath(){},rect(){},clip(){clips++;}};
  drawing(ctx,600,540,{start:0,end:2,rawStart:.5,rawEnd:1.5});
  assert.equal(clips,2);assert.equal(depth,0);
});
