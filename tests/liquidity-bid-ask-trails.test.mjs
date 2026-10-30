import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/heatmap-app/src/renderer.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  #drawInsideMarket('),source.indexOf('  #drawTrades(')).trim().replace('#drawInsideMarket','function');
class Path {points=[];moveTo(x,y){this.points.push([x,y]);}lineTo(x,y){this.points.push([x,y]);}}
const draw=new Function('Path2D','colorCss','return '+method)(Path,value=>value);
function paint(pixelsPerTick,history=[{bestBid:100,bestAsk:101},{bestBid:101,bestAsk:102}],start=0,end=history.length-1){
  const strokes=[];let points=[];
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},stroke(path){strokes.push({width:this.lineWidth,color:this.strokeStyle,points:path?.points??points});}};
  const layout={start,end,xForIndex:i=>i*50,yForTick:tick=>300-tick*pixelsPerTick,dataWidth:50,plotWidth:100};
  draw.call({layout},ctx,history,{bid:'#00ccff',ask:'#ff8800'});return strokes;
}
test('tight historical quotes retain exact coordinates while their strokes stop covering each other',()=>{
  const strokes=paint(2);assert.equal(strokes.length,4);
  assert.deepEqual(strokes[0].points,[[0,100],[50,98]]);
  assert.deepEqual(strokes[2].points,[[0,98],[50,96]]);
  assert.ok(strokes.every(s=>s.width<2&&s.width>=.5));
  assert.deepEqual(strokes[1].points,[[50,98],[100,98]]);
  assert.deepEqual(strokes[3].points,[[50,96],[100,96]]);
});
test('normal zoom keeps the original stroke width and subpixel zoom never fabricates quote separation',()=>{
  assert.ok(paint(10).every(s=>s.width===3));
  const thin=paint(.25);assert.equal(thin[0].points[0][1]-thin[2].points[0][1],.25);
  assert.ok(thin.every(s=>s.width===.5));
});
test('only visible quotes determine trace thickness and no saved history is rewritten',()=>{
  const history=[{bestBid:100,bestAsk:101},{bestBid:100,bestAsk:104},{bestBid:101,bestAsk:105}],before=JSON.stringify(history);
  assert.ok(paint(2,history,1,2).every(s=>s.width===3));
  assert.equal(JSON.stringify(history),before);
});
