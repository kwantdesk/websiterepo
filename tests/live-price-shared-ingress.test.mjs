import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {publishChartLivePrice,subscribeChartDisplayPrice,chartQuoteKey} from '../src/lib/liveChartPrice.ts';
const now=Date.now();
const q=(overrides={})=>({key:chartQuoteKey('Databento::NQ'),symbol:'NQ',contractSymbol:'NQZ6',price:27000,sourceTimestampMs:now,receivedAt:now,...overrides});
test('shared ingress updates all matching panes before any pane validation or execution callback',()=>{
 const seen=[[],[]]; const stops=seen.map((out,i)=>subscribeChartDisplayPrice('direct-'+i,'NQ','NQZ6','Databento',x=>out.push(x.price)));
 for(let i=0;i<20;i++)publishChartLivePrice(q({price:27000+(i%2?.125:-.125),sourceTimestampMs:now+i}));
 assert.equal(seen[0].length,20);assert.deepEqual(seen[0],seen[1]);stops.forEach(x=>x());
});
test('broker, instrument and contract isolation plus monotonic ordering across ingress and pane fallback',()=>{
 const values=[];const stop=subscribeChartDisplayPrice('fallback','ES','ESZ6','Databento',x=>values.push(x.price));
 const packet=q({key:chartQuoteKey('Databento::ES'),symbol:'ES',contractSymbol:'ESZ6',price:7400,sourceTimestampMs:now+30});
 publishChartLivePrice(packet);publishChartLivePrice({...packet,key:'fallback'});
 publishChartLivePrice({...packet,key:'fallback',price:7399,sourceTimestampMs:now+29});
 publishChartLivePrice({...packet,key:chartQuoteKey('Other::ES'),price:999});
 publishChartLivePrice({...packet,contractSymbol:'ESH7',price:888,sourceTimestampMs:now+31});
 publishChartLivePrice({...packet,key:'fallback',price:7400.25,sourceTimestampMs:now+32});
 assert.deepEqual(values,[7400,7400.25]);stop();
 publishChartLivePrice({...packet,price:7401,sourceTimestampMs:now+33});assert.equal(values.length,2);
});
test('actual watchlist ingress publishes exact midpoint before scheduling UI and rejects cached/invalid quotes',()=>{
 const source=fs.readFileSync('src/components/KwantifyWorkspace.tsx','utf8');const ast=ts.createSourceFile('w.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='publishLiveWatchlistQuote')fn=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);assert(fn);
 const order=[],seen=[];const stop=subscribeChartDisplayPrice('actual-ingress','GC','GCZ6','Databento',x=>{order.push('chart');seen.push(x.price)});
 const scope={chartQuoteKey,publishChartLivePrice,marketTimestamp:x=>Number(x),displayCmeSymbol:x=>x,liveWatchlistSnapshots:new Map(),liveWatchlistFlashTimers:new Map(),setTimeout:()=>1,clearTimeout:()=>{},scheduleLiveWatchlistPaint:()=>order.push('watchlist'),Date,Number};
 vm.runInNewContext(ts.transpileModule(fn+';this.publish=publishLiveWatchlistQuote',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
 scope.publish('Databento::GC',{instrument:'GC',contractSymbol:'GCZ6',mid:4000.05,timestamp:now+100});
 assert.deepEqual(order,['chart','watchlist']);assert.deepEqual(seen,[4000.05]);
 scope.publish('Databento::GC',{instrument:'GC',contractSymbol:'GCZ6',mid:4000.1,timestamp:now+101,cached:true});
 scope.publish('Databento::GC',{instrument:'GC',contractSymbol:'GCZ6',mid:NaN,timestamp:now+102});assert.equal(seen.length,1);stop();
});
