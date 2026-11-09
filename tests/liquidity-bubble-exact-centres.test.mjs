import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {resolveTradeClusterTimeIndex} from '../public/heatmap-app/src/renderer.js';

test('a newer print waits for its real time coordinate instead of jumping from the last column',()=>{
 const owner={timestamp:1000}, history=[{timestamp:500},owner];
 const cluster={anchorFrame:owner,anchorTimestamp:1100};
 assert.equal(resolveTradeClusterTimeIndex(history,cluster),-1);
 history.push({timestamp:1200});
 assert.equal(resolveTradeClusterTimeIndex(history,cluster),1.5);
 assert.equal(resolveTradeClusterTimeIndex(history,{...cluster,anchorTimestamp:1200}),2);
});

test('every sphere composition is centred on the exact execution coordinate',()=>{
 const source=readFileSync(new URL('../public/heatmap-app/src/renderer.js',import.meta.url),'utf8');
 const ast=ts.createSourceFile('renderer.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let method;
 function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='#drawSphereDot')method=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);
 assert.ok(method);
 method=method.replace('#drawSphereDot','draw').replaceAll('this.#sphereSprite','this.sprite').replaceAll('this.#drawClippedSphere','this.clipped');
 const Renderer=new Function('return class {'+method+'}')();
 const r=new Renderer(),boxes=[];
 r.sprite=()=>({});r.clipped=(_ctx,_sprite,x,y,w)=>boxes.push([x,y,w]);
 const ctx={save(){},restore(){},drawImage(_sprite,x,y,w){boxes.push([x,y,w]);}};
 for(const buyRatio of [0,.1,.25,.4,.5,.6,.75,.9,1]){
  boxes.length=0;r.draw(ctx,100,200,{diameter:30,buyRatio,alpha:255},{bid:[0,0,0],ask:[255,255,255]});
  assert.ok(boxes.length);for(const box of boxes)assert.deepEqual(box,[85,185,30],String(buyRatio));
 }
});
