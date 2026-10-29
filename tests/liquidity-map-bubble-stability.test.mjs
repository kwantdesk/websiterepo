import test from 'node:test';
import assert from 'node:assert/strict';
import {RollingDepthEngine} from '../public/heatmap-app/src/depth-engine.js';
import {planIncrementalTradeClusterRefresh} from '../public/heatmap-app/src/renderer.js';

const trade=(id,timestamp,size,side='buy')=>({id,timestamp,tick:100,size,side});
const frame=(id,trades=[])=>({id,timestamp:id*50,bids:new Map(),asks:new Map(),trades});
const options={start:0,rowTicks:1,rowPixels:10,columnPixels:0.2,circleSize:40,smartClustering:100};

test('normal executed-volume bubbles cannot be cancelled by opposite executions',()=>{
  const engine=new RollingDepthEngine(100);
  engine.append(frame(20,[trade('buy',1000,50),trade('sell',1010,50,'sell')]));
  const bubbles=engine.clusterTrades({...options,end:0});
  assert.equal(bubbles.length,1);assert.equal(bubbles[0].total,100);
  assert.equal(bubbles[0].buyVolume,50);assert.equal(bubbles[0].sellVolume,50);
});

test('later opposite trades cannot consume a settled bubble even at compressed zoom',()=>{
  const engine=new RollingDepthEngine(100);
  engine.append(frame(20,[trade('buy',1000,50)]));
  const initial=engine.clusterTrades({...options,end:0,differential:true});
  engine.append(frame(40,[trade('sell',2000,50,'sell')]));
  const bubbles=engine.clusterTrades({...options,end:1,differential:true});
  assert.equal(initial.length,1);assert.equal(bubbles.length,2);
  assert.equal(bubbles.find(b=>b.anchorTimestamp===1000).total,50);
});

test('depth-only refreshes cannot resurrect half of a previously balanced net cluster',()=>{
  const engine=new RollingDepthEngine(100);
  for(let i=0;i<50;i++)engine.append(frame(i,i===17?[trade('buy',850,40)]:i===18?[trade('sell',900,40,'sell')]:[]));
  const cached=engine.clusterTrades({...options,end:49,differential:true});
  assert.equal(cached.length,0);
  const previousEnd=engine.frames[49];engine.append(frame(50));engine.append(frame(51));
  const plan=planIncrementalTradeClusterRefresh(engine.frames,cached,0,51,previousEnd,32);
  const rebuilt=engine.clusterTrades({...options,start:plan.rebuildStart,end:51,differential:true});
  assert.equal(rebuilt.length,0,'a refresh boundary must not discard only the buy half and invent a sell bubble');
});

test('a catch-up packet preserves separate execution-time windows',()=>{
  const engine=new RollingDepthEngine(100);
  engine.append(frame(50,[trade('buy',1000,50),trade('sell',2000,50,'sell')]));
  const bubbles=engine.clusterTrades({...options,end:0,differential:true});
  assert.equal(bubbles.length,2);
  assert.equal(bubbles.reduce((sum,b)=>sum+b.total,0),100);
});

test('repeated cache refreshes preserve every settled gross execution',()=>{
  const engine=new RollingDepthEngine(400);
  for(let i=0;i<200;i++)engine.append(frame(i,[trade(i,i*50,1+i%7,i%2?'sell':'buy')]));
  let cached=engine.clusterTrades({...options,end:199});
  let previousEnd=engine.frames[199];
  for(let i=200;i<230;i++){
    engine.append(frame(i));
    const plan=planIncrementalTradeClusterRefresh(engine.frames,cached,0,i,previousEnd,32);
    cached=[...plan.retained,...engine.clusterTrades({...options,start:plan.rebuildStart,end:i})];
    const full=engine.clusterTrades({...options,end:i});
    const stable=items=>items.map(({key,total,anchorTimestamp,tick})=>({key,total,anchorTimestamp,tick})).sort((a,b)=>a.anchorTimestamp-b.anchorTimestamp);
    assert.deepEqual(stable(cached),stable(full));
    previousEnd=engine.frames[i];
  }
});
