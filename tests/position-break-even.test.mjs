import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { clampPositionStopPrice, nearestPositionHandle } from '../src/lib/positionToolConstraints.ts';
import { createDrawing, updateDrawingHandle, normalizeDrawings } from '../src/lib/chartDrawTools.ts';
import { positionToolScreenGeometry } from '../src/lib/chartDrawGeometry.ts';

for(const tool of ['longPosition','shortPosition'])test(`${tool} stop clamps at exact entry and can be pulled away after save/reselect`,()=>{
 const sign=tool==='longPosition'?1:-1,entry=100;
 let drawing=createDrawing(tool,[{time:10,price:entry},{time:20,price:entry-sign*10},{time:20,price:entry+sign*20}]);
 const original=structuredClone(drawing);
 for(const pointer of [entry-sign,entry,entry+sign,entry+sign*1000]){
  drawing=updateDrawingHandle(drawing,1,{time:20,price:pointer});
  assert.equal(drawing.points[1].price,sign===1?Math.min(pointer,entry):Math.max(pointer,entry));
  assert.deepEqual(drawing.points[0],original.points[0]);assert.deepEqual(drawing.points[2],original.points[2]);
 }
 drawing=normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0];assert.equal(drawing.points[1].price,entry);
 drawing=updateDrawingHandle(drawing,1,{time:25,price:entry-sign*7});assert.equal(drawing.points[1].price,entry-sign*7);
 assert.equal(drawing.points[2].time,25);assert.equal(drawing.points[2].price,entry+sign*20);
 assert.equal(original.points[1].price,entry-sign*10);
});
test('clamp remains exact for fractional entries, large overshoots and unrelated tools',()=>{
 assert.equal(clampPositionStopPrice('longPosition',100.125,1000),100.125);
 assert.equal(clampPositionStopPrice('shortPosition',100.125,-1000),100.125);
 assert.equal(clampPositionStopPrice('trendLine',100,101),101);
});
test('zero-risk position retains real stop corners at entry and selects the nearest stop, not body/target',()=>{
 for(const scale of [0.5,1,2,4]){
  const g=positionToolScreenGeometry([{x:10*scale,y:100*scale},{x:110*scale,y:100*scale},{x:110*scale,y:99*scale}]);
  assert.equal(g.stopY,100*scale);assert.equal(g.corners.filter(c=>c.edge==='stop').length,2);
  const corners=[...g.corners].sort((a,b)=>Number(a.edge==='stop')-Number(b.edge==='stop'));
  assert.equal(nearestPositionHandle(corners,110*scale,100*scale).edge,'stop');
  assert.equal(nearestPositionHandle(corners,10*scale,100*scale).edge,'stop');
 }
 assert.equal(nearestPositionHandle([{x:0,y:0,edge:'target'},{x:0,y:0,edge:'stop'}],0,0).edge,'stop');
 assert.equal(nearestPositionHandle([{x:0,y:0}],100,100),null);
});
test('both actual corner and anchor drag paths use the clamp; break-even readout never invents one tick risk',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const layer=read('src/components/ChartDrawLayer.tsx'),chart=read('src/components/Chart.tsx');
 assert.match(layer,/next\[1\].price = clampPositionStopPrice\(drawing.tool, origin\[0\].price, price\)/);
 assert.match(layer,/if \(hit.positionCorner\)[\s\S]*?beginPositionCornerDrag/);
 assert.match(chart,/price: clampPositionStopPrice\(drawing.tool, basePoints\[0\].price, snapPositionPrice\(point.price\)\)/);
 assert.match(chart,/const stopDistance = Math.abs\(entryPrice - stopPrice\)/);
 assert.match(chart,/Break-even · R:R —/);assert.match(layer,/Break-even · Risk\/Reward Ratio: —/);
});
