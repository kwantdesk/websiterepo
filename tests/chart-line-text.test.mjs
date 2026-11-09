import test from 'node:test';import assert from 'node:assert/strict';
import {LINE_TEXT_TOOLS,lineTextGeometry} from '../src/lib/chartLineText.ts';
import {createDrawing,normalizeDrawings} from '../src/lib/chartDrawTools.ts';
for(const tool of LINE_TEXT_TOOLS)test(tool+' labels survive save/copy and stay at the starting anchor',()=>{
 const drawing=createDrawing(tool,[{time:1,price:100},{time:2,price:102},{time:3,price:99}], 'London high');
 const restored=normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0];assert.equal(restored.text,'London high');
 const first=lineTextGeometry(tool,[{x:100,y:200},{x:300,y:180}],restored.text);assert.equal(first.text,'London high');assert.ok(Math.hypot(first.x-100,first.y-200)<6);assert.ok(Math.abs(first.angle)<=90);
 const moved=lineTextGeometry(tool,[{x:150,y:250},{x:350,y:230}],restored.text);assert.equal(moved.x-first.x,50);assert.equal(moved.y-first.y,50);
});
test('leftward lines stay readable and grow toward the line direction',()=>{const g=lineTextGeometry('trendLine',[{x:300,y:100},{x:100,y:100}],'text');assert.equal(g.textAnchor,'end');assert.equal(g.angle,0);assert.equal(g.x,296);});
test('horizontal and vertical labels follow the line geometry',()=>{assert.equal(lineTextGeometry('horizontalLine',[{x:100,y:100},{x:200,y:150}],'text').angle,0);assert.equal(lineTextGeometry('verticalLine',[{x:100,y:100}],'text').angle,-90)});
test('labels never wrap, edge-pin, or appear for invalid/missing text and anchors',()=>{assert.equal(lineTextGeometry('trendLine',[{x:-100,y:200},{x:100,y:200}],' a\nb\tc ').text,'a b c');assert.ok(lineTextGeometry('trendLine',[{x:-100,y:200},{x:100,y:200}],'a').x<0);for(const p of [[],[{x:null,y:200}],[{x:100,y:NaN}]])assert.equal(lineTextGeometry('trendLine',p,'text'),null);assert.equal(lineTextGeometry('trendLine',[{x:100,y:200}],''),null);assert.equal(lineTextGeometry('rectangle',[{x:100,y:200}],'text').angle,0)});
