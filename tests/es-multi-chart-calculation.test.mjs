import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';
import {packTpoBuild,unpackTpoBuild} from '../src/lib/tpo/workerProtocol.ts';
import {mergeBigContractHistory} from '../src/lib/bigContractHistory.ts';
function harness(){
 const workers=[],timers=new Map();let serial=0;
 class Worker { constructor(){this.messages=[];workers.push(this);}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}reply(profiles=[]){this.onmessage({data:{id:this.messages.at(-1).id,profiles}});} }
 const source=fs.readFileSync('src/lib/tpo/workerClient.ts','utf8').replace('import.meta.url',JSON.stringify('file:///workerClient.ts'));
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({packTpoBuild}),URL,Worker,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)});
 return {workers,timers,...exports};
}
const input=()=>({trades:[],bars:[],settings:{}});
test('one shared calculator coalesces each pane to its newest queued input',()=>{
 const h=harness(),seen=[]; const add=(owner,scope,value)=>h.requestTpoProfileBuild({owner,scope,input:input(),done:()=>seen.push(value),fail:()=>assert.fail('worker failed')});
 add('NQ','1','NQ1');add('ES','1','ES1');add('ES','1','ES2');add('NQ','1','NQ2');assert.equal(h.workers.length,1);
 h.workers[0].reply();h.workers[0].reply();h.workers[0].reply();assert.deepEqual(seen,['NQ1','ES2','NQ2']);assert.equal(h.workers[0].messages.length,3);
 h.cancelTpoProfileBuild('NQ');h.cancelTpoProfileBuild('ES');
});
test('a stale symbol/settings result cannot overwrite the current scope',()=>{
 const h=harness(),seen=[];for(const scope of ['old','new'])h.requestTpoProfileBuild({owner:'pane',scope,input:input(),done:()=>seen.push(scope),fail:()=>{}});
 h.workers[0].reply();assert.deepEqual(seen,[]);h.workers[0].reply();assert.deepEqual(seen,['new']);h.cancelTpoProfileBuild('pane');
});
test('unmount cancels pending callbacks and terminates an otherwise unused worker',()=>{
 const h=harness();h.requestTpoProfileBuild({owner:'pane',scope:'1',input:input(),done:()=>assert.fail('unmounted callback'),fail:()=>assert.fail('unmounted failure')});h.cancelTpoProfileBuild('pane');assert.equal(h.workers[0].terminated,true);assert.equal(h.timers.size,0);
});
test('worker failure releases the queue so another chart can calculate',()=>{
 const h=harness(),seen=[];for(const owner of ['NQ','ES'])h.requestTpoProfileBuild({owner,scope:'1',input:input(),done:()=>seen.push(owner),fail:()=>seen.push(owner+' failed')});h.workers[0].onerror();assert.equal(h.workers[0].terminated,true);assert.equal(h.workers.length,2);h.workers[1].reply();assert.deepEqual(seen,['NQ failed','ES']);h.cancelTpoProfileBuild('NQ');h.cancelTpoProfileBuild('ES');
});
test('packed trades preserve price, side, volume, ordering and instrument tick sizes',()=>{
 const trades=[{instrumentId:'ES',timestampMs:1234,price:7400.25,size:7,tickSize:.25,aggressorSide:'buy'},{instrumentId:'NQ',timestampMs:1234,price:27000.5,size:3,tickSize:.25,aggressorSide:'sell'}];assert.deepEqual(unpackTpoBuild(packTpoBuild({...input(),trades})).trades,trades);
});
test('empty Big Contracts archive preserves execution multiplicity and sorts late prints without mutating tape',()=>{
 const tape=[{timestamp:2,recordIndex:3},{timestamp:1,recordIndex:1},{timestamp:1,recordIndex:1},{timestamp:3,recordIndex:4,flowOnly:true}];const before=JSON.stringify(tape);assert.deepEqual(mergeBigContractHistory([],tape),[tape[1],tape[2],tape[0]]);assert.equal(JSON.stringify(tape),before);
});
