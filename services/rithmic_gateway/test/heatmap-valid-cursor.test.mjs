import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('actual heatmap capture retains execution/order cursors through rejected depth frames',()=>{
  const source=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function captureHeatmapFrame('),end=source.indexOf('\nfunction emitRawSse',start);
  const trades=[{sequence:2,id:'first'},{sequence:3,id:'second'},{sequence:5,id:'fifth'}];
  const state={lastEmitAt:0,lastSequence:1,pendingOrderEvents:[],frames:[]};
  const frames=[
    {sequence:2,fullDepth:false,asOfMs:1000},
    {sequence:3,fullDepth:false,asOfMs:1100},
    {sequence:4,fullDepth:true,asOfMs:1200},
    {sequence:5,fullDepth:true,asOfMs:1300},
  ];
  const calls=[];
  const context={
    heatmapSseClients:new Set([{key:'CME:NQZ6',depth:320,response:{writable:true}}]),
    heatmapHistoryState:()=>state,HEATMAP_FRAME_MS:50,HEATMAP_CACHE_DEPTH:320,HEATMAP_HISTORY_LIMIT:1800,
    client:{book:{snapshot(_exchange,_symbol,_depth,options){
      const frame=frames.shift();calls.push({...options});
      return {...frame,bids:[{price:100}],asks:[{price:101}],
        trades:trades.filter(trade=>trade.sequence>options.afterSequence&&trade.sequence<=frame.sequence)};
    }}},
    heatmapPayload:snapshot=>({status:{connected:true},snapshot:{...snapshot}}),
    acceptMonotonicHeatmapFrame:()=>true,
  };
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.capture=captureHeatmapFrame;',context);
  context.capture('CME:NQZ6',1000,{orderEvents:[{action:'REMOVE',orderId:'gone-a'}]});
  assert.equal(state.lastSequence,1,'an invalid book cannot acknowledge executions the browser discards');
  context.capture('CME:NQZ6',1100,{orderEvents:[{action:'REMOVE',orderId:'gone-b'}]});
  const recovered=context.capture('CME:NQZ6',1200);
  assert.deepEqual(Array.from(recovered.snapshot.trades,trade=>trade.id),['first','second']);
  assert.deepEqual(Array.from(recovered.snapshot.orderEvents,event=>event.orderId),['gone-a','gone-b']);
  assert.equal(state.lastSequence,4);
  assert.equal(state.pendingOrderEvents.length,0);
  const next=context.capture('CME:NQZ6',1300);
  assert.deepEqual(Array.from(next.snapshot.trades,trade=>trade.id),['fifth'],'recovery must not replay delivered prints');
  assert.deepEqual(calls.map(call=>call.tradeLimit),[256,2500,2500,256]);
});
