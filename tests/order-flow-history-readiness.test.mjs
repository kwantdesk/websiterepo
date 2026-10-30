import test from 'node:test';import assert from 'node:assert/strict';
import {hasUsableOrderFlowHistory} from '../src/lib/orderFlowHistoryReadiness.ts';
const baseline=candles=>{const verified=candles.filter(c=>Number(c.askVolume??0)+Number(c.bidVolume??0)>0);const required=Math.min(60,Math.max(2,Math.floor(candles.length*.05)));return verified.length>=required&&(verified.at(-1)?.timestamp??0)>(verified[0]?.timestamp??0)};
test('readiness preserves the previous full-history result across sparse, mixed and malformed flow values',()=>{
 let seed=18927;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let sample=0;sample<400;sample++){const rows=Array.from({length:Math.floor(random()*2000)},(_,i)=>({timestamp:random()<.02?NaN:i*60000,askVolume:[undefined,0,1,NaN,-2][Math.floor(random()*5)],bidVolume:[0,2,undefined,NaN][Math.floor(random()*4)]}));if(sample%3===0)rows.reverse();assert.equal(hasUsableOrderFlowHistory(rows),baseline(rows));}
 for(const n of[0,1,2,3,20,59,60,61,10000]){const rows=Array.from({length:n},(_,i)=>({timestamp:i,askVolume:1,bidVolume:0}));assert.equal(hasUsableOrderFlowHistory(rows),baseline(rows));}
});
test('a hydrated five-day history requires only bounded reads and no filter allocation on each live tick',()=>{
 let reads=0;const rows=Array.from({length:20000},(_,i)=>({timestamp:i,get askVolume(){reads++;return 1},bidVolume:0}));
 rows.filter=()=>{throw Error('full-history filter allocation returned')};
 assert.equal(hasUsableOrderFlowHistory(rows),true);assert.ok(reads<=62,'readiness should stop after sufficient verified candles');
});
