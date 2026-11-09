import test from 'node:test';
import assert from 'node:assert/strict';
import {emojiRotation,emojiTransformHandle,transformEmojiFromDrag} from '../src/lib/chartEmojiTransform.ts';
import {createDrawing,normalizeDrawings} from '../src/lib/chartDrawTools.ts';

test('all quadrants and a full revolution preserve size while turning the emoji',()=>{
 const start={x:24,y:24};
 for(let degrees=0;degrees<=360;degrees+=15){
  const angle=(45+degrees)*Math.PI/180,radius=Math.hypot(24,24);
  const result=transformEmojiFromDrag(48,0,start,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});
  assert.equal(result.fontSize,48);
  assert.ok(Math.abs(result.emojiRotation-emojiRotation(degrees))<1e-9 || Math.abs(result.emojiRotation-360)<1e-9);
 }
});
test('outward resizing, off-center grabs and previously rotated emojis do not snap',()=>{
 assert.deepEqual(transformEmojiFromDrag(48,90,{x:-21,y:28},{x:-21,y:28}),{fontSize:48,emojiRotation:90});
 assert.deepEqual(transformEmojiFromDrag(48,90,{x:-21,y:28},{x:-42,y:56}),{fontSize:96,emojiRotation:90});
 assert.equal(transformEmojiFromDrag(48,90,{x:24,y:24},{x:2400,y:2400}).fontSize,160);
 assert.equal(transformEmojiFromDrag(48,90,{x:24,y:24},{x:1,y:1}).fontSize,16);
});
test('handle follows rotation around the unchanged anchor',()=>{
 assert.deepEqual(emojiTransformHandle(200,100,48,0),{x:224,y:124});
 const turned=emojiTransformHandle(200,100,48,90);assert.ok(Math.abs(turned.x-176)<1e-9);assert.ok(Math.abs(turned.y-124)<1e-9);
 assert.equal(emojiRotation(-90),270);assert.equal(emojiRotation(undefined),0);assert.equal(emojiRotation(Infinity),0);
});
test('saved rotation, colour and size survive normalization without moving anchors',()=>{
 const drawing=createDrawing('emoji',[{time:100,price:200}],'🙂');
 drawing.style={...drawing.style,fontSize:80,emojiRotation:235,emojiOriginalColors:false,color:'#ff0000'};
 const restored=normalizeDrawings(JSON.parse(JSON.stringify([drawing])))[0];
 assert.equal(restored.style.emojiRotation,235);assert.equal(restored.style.fontSize,80);
 assert.deepEqual(restored.points,drawing.points);assert.equal(restored.style.color,'#ff0000');
});
