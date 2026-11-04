import '../scripts/alias-hook.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/bounceLevelsPrimitive.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"@/lib/gexMapFormat"',JSON.stringify(new URL('../src/lib/gexMapFormat.ts',import.meta.url).href));
const {visibleBounceSlices}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('zoom retains the two real observations spanning a viewport even when neither centre is visible',()=>{
 const rows=[{x:-5000,id:1},{x:-1000,id:2},{x:2000,id:3},{x:5000,id:4}];
 assert.deepEqual(visibleBounceSlices(rows,800).map(x=>x.id),[2,3]);
 assert.equal(rows.filter(s=>s.x>-80&&s.x<880).length,0,'old renderer dropped the entire crossing ribbon');
});
test('boundary neighbours preserve ribbon geometry during pans without retaining all off-screen history',()=>{
 const rows=Array.from({length:10000},(_,i)=>({x:i*10-50000,id:i}));
 const visible=visibleBounceSlices(rows,800);assert.ok(visible.length<100);assert.ok(visible[0].x<-80);assert.ok(visible.at(-1).x>880);
 assert.equal(visible[0],rows[4991]);assert.equal(visible.at(-1),rows[5089]);
});
test('empty and entirely out-of-range histories do not invent new observations',()=>{
 assert.deepEqual(visibleBounceSlices([],800),[]);
 const left=[{x:-4000},{x:-2000}],right=[{x:2000},{x:4000}];
 assert.deepEqual(visibleBounceSlices(left,800),[left[1]]);assert.deepEqual(visibleBounceSlices(right,800),[right[0]]);
});
