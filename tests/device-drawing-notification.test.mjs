import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {writeProtectedItem} from '../src/lib/browserStorageQuota.ts';
import {isTrackedStorageKey} from '../src/lib/accountPreferenceKeys.ts';
const file=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function executeFunction(text,context){return vm.runInNewContext(ts.transpileModule('const fn = '+text+';fn;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);}
test('the actual professional drawing persistence effect notifies account sync',async()=>{
 let effect;function walk(node){if(ts.isCallExpression(node)&&node.expression.getText(file)==='useEffect'&&node.arguments[0]?.getText(file).includes('JSON.stringify(professionalDrawings)')&&node.arguments[0].getText(file).includes('queueDrawingSave'))effect=node.arguments[0].getText(file);ts.forEachChild(node,walk);}walk(file);assert.ok(effect);
 const previous=globalThis.window,events=[],values=new Map(),window=new EventTarget();window.localStorage={setItem:(key,value)=>values.set(key,value)};window.setTimeout=()=>1;window.clearTimeout=()=>{};globalThis.window=window;window.addEventListener('kwantdesk:preferences-changed',e=>events.push(e.detail));
 const records=[{id:'fixture-record',type:'trend-line'}];
 try{const run=executeFunction(effect,{window,writeProtectedItem,professionalDrawingsRenderGeneration:1,professionalDrawingsLoadGenerationRef:{current:1},professionalDrawingsRef:{current:[]},professionalDrawingsHydrationRef:{current:{ready:true,instrument:'ES'}},instrument:'ES',chartInstanceId:'pane-1',professionalDrawings:records,drawingsStorageKey:(symbol,pane)=>'kwantdesk:chart-drawings:v1:'+pane+':'+symbol});const cleanup=run();await Promise.resolve();assert.equal(values.get('kwantdesk:chart-drawings:v1:pane-1:ES'),JSON.stringify(records));assert.equal(events.length,1);cleanup();}finally{globalThis.window=previous;}
});
test('drawing controls survive account normalization instead of staying device-only',()=>{for(const key of ['kwantdesk:chart-magnet-strength:v1','kwantdesk:chart-emoji:v1','kwantdesk:chart-emoji-quick-picks:v1','kwantdesk:drawing-last-used:v1','kwantdesk:drawing-favourites:v1'])assert.equal(isTrackedStorageKey(key),true,key);});
test('an account-restored drawing document prevents the older migration endpoint from overwriting it',async()=>{
 let loader;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='loadPersistedDrawings')loader=node.initializer.getText(file);ts.forEachChild(node,walk);}walk(file);assert.ok(loader);let requests=0;const load=executeFunction(loader,{hasScopedDrawingDocument:true,fetch(){requests++;throw Error('must not request migration data');}});const records=await load();assert.equal(records.length,0);assert.equal(requests,0);
});
