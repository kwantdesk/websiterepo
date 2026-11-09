import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {publishChartLivePrice,subscribeChartLivePrice,createLiveQuotePriceLine} from '../src/lib/liveChartPrice.ts';

const quote=(key,overrides={})=>({key,symbol:'NQ',contractSymbol:'NQZ6',price:29000.125,sourceTimestampMs:Date.now(),receivedAt:Date.now(),...overrides});
test('every quote reaches its scoped marker synchronously, independently of interval or candle aggregation',()=>{
  for(const interval of ['1s','1m','5m','200v','10r','renko']){
    const key='fast-'+interval,received=[];const stop=subscribeChartLivePrice(key,'NQ','NQZ6',x=>received.push(x.price));
    for(const price of [29000.125,29000.25,29000,29000.375])publishChartLivePrice(quote(key,{price}));
    assert.deepEqual(received,[29000.125,29000.25,29000,29000.375]);stop();
    publishChartLivePrice(quote(key,{price:29001}));assert.equal(received.length,4);
  }
});
test('wrong symbol/contract, invalid and older observations cannot move a chart; equal timestamps can bobble',()=>{
  const key='scope',received=[],now=Date.now();const stop=subscribeChartLivePrice(key,'NQ','NQZ6',x=>received.push(x.price));
  publishChartLivePrice(quote(key,{price:29000,sourceTimestampMs:now}));
  publishChartLivePrice(quote(key,{price:29000.25,sourceTimestampMs:now}));
  publishChartLivePrice(quote(key,{price:29002,sourceTimestampMs:now-1}));
  publishChartLivePrice(quote(key,{price:NaN}));publishChartLivePrice(quote(key,{symbol:'ES',price:7400}));
  publishChartLivePrice(quote(key,{contractSymbol:'NQH7',price:29010}));
  assert.deepEqual(received,[29000,29000.25]);stop();
});
test('remount gets a fresh retained quote, stopped subscribers and stale retained prices do not leak',()=>{
  const key='retained';publishChartLivePrice(quote(key));const seen=[];
  const stop=subscribeChartLivePrice(key,'NQ','NQZ6',x=>seen.push(x.price));assert.equal(seen.length,1);stop();
  publishChartLivePrice(quote('stale',{receivedAt:Date.now()-11000}));const end=subscribeChartLivePrice('stale','NQ','NQZ6',()=>assert.fail('stale quote replayed'));end();
  const cleanup=subscribeChartLivePrice(key,'NQ','NQZ6',()=>{throw Error('disposed chart');});
  const cleanup2=subscribeChartLivePrice(key,'NQ','NQZ6',()=>seen.push(1));publishChartLivePrice(quote(key));
  assert.equal(seen.at(-1),1);cleanup();cleanup2();
});
test('native line receives exact quoted values without update/setData on candle history, and restores replay defaults',()=>{
  const calls=[],initial={priceLineVisible:true,lastValueVisible:true,priceLineStyle:2,priceLineWidth:1};
  const series={options:()=>initial,applyOptions:o=>calls.push(['series',o]),createPriceLine:o=>{calls.push(['create',o]);return {applyOptions:o=>calls.push(['price',o])};},removePriceLine:()=>calls.push(['remove'])};
  const marker=createLiveQuotePriceLine(series,'#abcdef');marker.update(quote('native'));marker.update(quote('native',{price:29000.375}));
  assert.equal(calls[0][1].price,29000.125);assert.equal(calls[2][1].price,29000.375);
  assert.deepEqual(calls[1][1],{priceLineVisible:false,lastValueVisible:false});marker.dispose();
  assert.deepEqual(calls.at(-1)[1],{priceLineVisible:true,lastValueVisible:true});const n=calls.length;marker.update(quote('native'));assert.equal(calls.length,n);
});
test('actual validated futures quote consumer publishes before its execution-only candle return',()=>{
  const source=fs.readFileSync('src/components/KwantifyWorkspace.tsx','utf8'),ast=ts.createSourceFile('workspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='consumeLivePrice')fn=node.initializer.getText(ast);ts.forEachChild(node,visit);};visit(ast);assert(fn);
  const received=[],candles=[{timestamp:1,open:1,high:1,low:1,close:1}];let accept=true;
  const scope={publishChartLivePrice:x=>received.push(x),usingDatabentoPaneFeed:true,usingCTraderFeed:false,pane:{id:'actual',broker:'Databento',symbol:'NQ',timeframe:'1m'},sameLiveInstrument:(a,b)=>a===b,
    liveInstrumentIdentityRef:{current:'Databento:NQ'},latestFuturesRef:{current:{price:29000,asOfMs:1}},latestCandlesRef:{current:candles},liveOutlierCandidateRef:{current:null},liveTailStartTimestampRef:{current:null},
    marketTimestamp:Number,validateLiveTick:()=>({accepted:accept,candidate:null}),futuresTickSize:()=>.25,onLiveExecutionQuote:undefined,displayCmeSymbol:x=>x,resolvedContractSymbol:'NQZ6',markMarketActive:()=>{},chartSourceTimestamp:Number,setLiveFeedError:()=>{},Date};
  const code=ts.transpileModule('this.consume='+fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,scope);
  scope.consume({instrument:'NQ',mid:29000.125,timestamp:Date.now()});assert.equal(received.length,1);assert.equal(received[0].price,29000.125);
  scope.consume({instrument:'NQ',mid:29000.25,timestamp:Date.now(),cached:true});assert.equal(received.length,1);
  accept=false;scope.consume({instrument:'NQ',mid:990000,timestamp:Date.now()});assert.equal(received.length,1);
  assert.deepEqual(candles,[{timestamp:1,open:1,high:1,low:1,close:1}]);
});
test('between-tick quote labels retain the contract axis increment without rounding to a different execution price',()=>{
  const initial={priceLineVisible:true,lastValueVisible:true,priceLineStyle:2,priceLineWidth:1,priceFormat:{type:'price',precision:2,minMove:.25}},options=[];
  const marker=createLiveQuotePriceLine({options:()=>initial,applyOptions:o=>options.push(o),createPriceLine:()=>({applyOptions:()=>{}}),removePriceLine:()=>{}},'#fff');
  marker.update(quote('format'));const format=options[0].priceFormat;
  assert.equal(format.minMove,.25);assert.equal(format.formatter(29000.125),(29000.125).toFixed(2));
  assert.equal(format.formatter(28999.875),(28999.875).toFixed(2));marker.dispose();assert.deepEqual(options.at(-1).priceFormat,initial.priceFormat);
});
test('actual execution consumer publishes before heavy history work and ignores flow-only records',()=>{
  const source=fs.readFileSync('src/components/KwantifyWorkspace.tsx','utf8'),ast=ts.createSourceFile('workspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='queueExecutionUpdate')fn=node.initializer.getText(ast);ts.forEachChild(node,visit);};visit(ast);assert(fn);
  const order=[],pending=[];const scope={publishChartLivePrice:x=>order.push(['price',x.price]),pane:{id:'p',symbol:'NQ'},displayCmeSymbol:x=>x,resolvedContractSymbol:'NQZ6',Date,pendingExecutionRecords:pending,
    appendLosslessPaneRecords:(target,records)=>{order.push(['aggregate']);target.push(...records);},executionPaintScheduler:{schedule:()=>order.push(['schedule'])}};
  vm.runInNewContext(ts.transpileModule('this.queue='+fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
  scope.queue([{timestamp:Date.now(),close:29000},{timestamp:Date.now(),close:99999,flowOnly:true}]);
  assert.deepEqual(order,[['price',29000],['aggregate'],['schedule']]);assert.equal(pending.length,2,'exact flow records still reach existing accumulator');
});

test('replay cleanup restores defaults even when the chart library mutates its options object',()=>{
  const current={priceLineVisible:true,lastValueVisible:true,priceLineStyle:2,priceLineWidth:1,priceFormat:{type:'price',minMove:.25,precision:2}};
  const marker=createLiveQuotePriceLine({options:()=>current,applyOptions:o=>Object.assign(current,o),createPriceLine:()=>({applyOptions:()=>{}}),removePriceLine:()=>{}},'#fff');
  marker.update(quote('mutated-options'));assert.equal(current.priceLineVisible,false);marker.dispose();
  assert.equal(current.priceLineVisible,true);assert.equal(current.lastValueVisible,true);assert.equal(current.priceFormat.type,'price');
});
