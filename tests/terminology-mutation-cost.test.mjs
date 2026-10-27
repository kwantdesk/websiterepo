import test from 'node:test';
import assert from 'node:assert/strict';
import {processTerminologyMutations} from '../src/lib/terminologyMutations.ts';
import {publicFacingTerminology} from '../src/lib/privateTerminology.ts';
const node=(parentNode=null)=>({parentNode,nodeValue:'Rithmic',attributes:{title:'QuantData'}});
const mutation=(type,target,addedNodes=[],attributeName=null)=>({type,target,addedNodes,attributeName});
function run(records){const trees=[],texts=[],attributes=[];processTerminologyMutations(records,n=>trees.push(n),n=>{texts.push(n);n.nodeValue=publicFacingTerminology(n.nodeValue)},(n,k)=>{attributes.push([n,k]);n.attributes[k]=publicFacingTerminology(n.attributes[k])});return {trees,texts,attributes};}
test('a label change never scans 10000 descendants and still sanitizes changed copy',()=>{
 const chart=node();chart.childNodes=Array.from({length:10000},()=>node(chart));const result=run([mutation('attributes',chart,[],'title')]);assert.equal(result.trees.length,0);assert.equal(result.attributes.length,1);assert.equal(chart.attributes.title,'Options Data');assert.equal(chart.childNodes[0].nodeValue,'Rithmic');
});
test('1000 repeated text records are scrubbed once without scanning chart ancestors',()=>{
 const label=node(node()),result=run(Array.from({length:1000},()=>mutation('characterData',label)));assert.equal(result.texts.length,1);assert.equal(result.trees.length,0);assert.equal(label.nodeValue,'Futures Feed');
});
test('nested inserted roots are scrubbed once even when records arrive child first',()=>{
 const panel=node(),chart=node(panel),label=node(chart);const result=run([mutation('childList',chart,[label]),mutation('childList',panel,[chart]),mutation('childList',node(),[panel]),mutation('characterData',label),mutation('attributes',chart,[],'title')]);assert.deepEqual(result.trees,[panel]);assert.equal(result.texts.length,0);assert.equal(result.attributes.length,0);
});
test('distinct attributes and independent insertion branches are retained',()=>{
 const a=node(),b=node(),label=node();label.attributes.alt='Rithmic';const result=run([mutation('childList',node(),[a,b]),mutation('attributes',label,[],'title'),mutation('attributes',label,[],'title'),mutation('attributes',label,[],'alt')]);assert.deepEqual(result.trees,[a,b]);assert.equal(result.attributes.length,2);assert.equal(label.attributes.alt,'Futures Feed');
});
