import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {BigBlocksLiveState} from '../src/lib/bigBlocksLiveState.ts';
import {calculateDeepEffort} from '../src/lib/deepEffort.ts';
import {LIVE_CHART_CANDLE_EVENT} from '../src/lib/chartLiveEvents.ts';

const time=Date.UTC(2026,9,19,14,0);
const tagged=(timestamp,side='ASK',top=102)=>({sourceTimestamp:timestamp,zone:{
  id:`effort-${timestamp}-${side}`,startTime:timestamp/1000,endTime:timestamp/1000,
  top,bottom:100,side,extensionBars:22,
}});
const bar=(timestamp,values={})=>({timestamp,open:100,high:101,low:99.5,close:100.1,
  volume:1000,askVolume:520,bidVolume:480,delta:40,...values});
const seed=()=>Array.from({length:30},(_,i)=>bar(time-(30-i)*60_000));
const signal=()=>bar(time,{high:102,close:101.75,volume:5000,askVolume:4500,bidVolume:500,delta:4000});
const faded=()=>bar(time,{high:102,close:101.75,volume:9000,askVolume:4500,bidVolume:4500,delta:0});

test('forming preview appears immediately, disappears when no longer qualified, and can change side',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.update(time,[tagged(time)]);
  assert.equal(state.display([]).length,1);
  state.update(time,[]);
  assert.deepEqual(state.display([tagged(time)]),[],'a stale positive sample cannot resurrect a rejected preview');
  state.update(time,[tagged(time,'BID')]);
  assert.deepEqual(state.display([]).map(z=>z.side),['BID'],'no latched opposite-side ghost');
});

test('close freezes final geometry and absence; later samples cannot invent delayed blocks',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.update(time,[tagged(time)]);
  state.update(time+60_000,[]);
  state.update(time+120_000,[]);
  const snapshot=[tagged(time,'ASK',999),tagged(time+60_000),tagged(time+120_000)];
  assert.deepEqual(state.display(snapshot),[tagged(time).zone]);
  assert.deepEqual(state.display([]),[tagged(time).zone],'confirmed block survives a missing full-pass result');
  state.update(time,[tagged(time,'BID')]);
  assert.deepEqual(state.display([]),[tagged(time).zone],'late packets cannot rewrite a closed decision');
});

test('confirmed projection can terminate without moving or deleting the originating block',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.update(time,[tagged(time)]);
  state.update(time+60_000,[]);
  const changed=tagged(time,'ASK',999);
  changed.zone.endTime=(time+120_000)/1000;changed.zone.extensionBars=0;
  state.update(time+120_000,[changed]);
  const [fixed]=state.display([]);
  assert.equal(fixed.top,102);assert.equal(fixed.bottom,100);assert.equal(fixed.side,'ASK');
  assert.equal(fixed.endTime,changed.zone.endTime);assert.equal(fixed.extensionBars,0);
});

test('confirmed event-chart anchors reproject to their original source bars after axis hydration',()=>{
  const state=new BigBlocksLiveState('NQ:500v');
  const item={...tagged(time),endSourceTimestamp:time+1};
  state.update(time,[item]);state.update(time+2,[]);
  const [projected]=state.display([],new Map([[time,123],[time+1,124]]));
  assert.equal(projected.startTime,123);assert.equal(projected.endTime,124);
  assert.equal(projected.top,item.zone.top);assert.equal(projected.bottom,item.zone.bottom);
  assert.equal(projected.id,item.zone.id);
});

test('pre-existing history loads normally and model identities do not leak across charts/settings',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.update(time,[]);
  assert.deepEqual(state.display([tagged(time-60_000),tagged(time)]),[tagged(time-60_000).zone]);
  assert.equal(new BigBlocksLiveState('ES:5m').display([tagged(time)]).length,1);
});

test('unobserved reconnect gaps can backfill without rewriting adjacent live decisions',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.update(time,[]);
  state.update(time+180_000,[]);
  assert.deepEqual(state.display([tagged(time),tagged(time+60_000),tagged(time+180_000)]),[tagged(time+60_000).zone]);
});

test('missing warm-up or classified flow is unknown, not a frozen rejection',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.update(time,[],false);state.update(time+60_000,[],false);
  assert.deepEqual(state.display([tagged(time)]),[tagged(time).zone]);
  state.update(time+120_000,[],true);state.update(time+180_000,[],false);
  assert.deepEqual(state.display([tagged(time),tagged(time+120_000),tagged(time+180_000)]),[tagged(time).zone,tagged(time+180_000).zone]);
});

test('sampled candles cannot rewind the direct close, flow or multiple newer bars',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.synchronizeSnapshot(seed());
  state.sourceFor(signal());state.update(time,[tagged(time)]);
  state.synchronizeSnapshot([...seed(),bar(time,{close:99,volume:200})]);
  const source=state.sourceFor(faded());
  assert.equal(source.at(-1).askVolume,4500);assert.equal(source.at(-1).bidVolume,4500);
  assert.equal(source.at(-1).close,101.75);assert.equal(source.at(-1).delta,0);
  state.update(time,[]);
  state.sourceFor(bar(time+60_000));state.update(time+60_000,[]);
  state.sourceFor(bar(time+120_000));state.update(time+120_000,[]);
  state.synchronizeSnapshot(seed());
  assert.equal(state.sourceFor(bar(time+120_000)).at(-2).timestamp,time+60_000);
  assert.equal(state.sourceFor(bar(time-60_000)),null);
});

test('retention stays bounded and discarded old live decisions do not reappear from samples',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  for(let i=0;i<5000;i++){
    const timestamp=time+i*60_000;
    state.sourceFor(bar(timestamp));state.update(timestamp,[tagged(timestamp)]);
  }
  assert.equal(state.display([]).length,120);
  assert.ok(state.sourceFor(bar(time+5000*60_000)).length<=240);
  assert.ok(!state.display([tagged(time)]).some(z=>z.id===tagged(time).zone.id));
});

// Execute the actual Chart effect with a deterministic browser frame/event
// adapter. This checks the production receive/flush order, not a copied loop.
function mountedLiveEffect(){
  const source=readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const start=source.indexOf('  useEffect(() => {\n    if (!deepEffortZonesVisible) return;');
  assert.ok(start>=0);
  const effect=source.slice(start,source.indexOf('  const imbalanceTracker =',start));
  const code=ts.transpileModule(effect,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const frames=new Map(),listeners=new Map();let nextFrame=0,cleanup;
  const painted=[];
  const state=new BigBlocksLiveState('NQ:1m');state.synchronizeSnapshot(seed());
  const env={
    useEffect:fn=>{cleanup=fn();},deepEffortZonesVisible:true,
    deepEffortFrameRef:{current:null},pendingDeepEffortCandleRef:{current:null},
    bigBlocksPrimitiveRef:{current:{update:zones=>painted.push(zones)}},
    bigBlocksPrimitiveOptionsRef:{current:{}},bigBlocksSnapshotZonesRef:{current:[]},
    bigBlocksLiveState:state,calculateDeepEffort,
    deepEffortOptions:{instrument:'NQ',tickSize:0.25,minimumBars:20},
    eventChartTimeBySourceTimeRef:{current:new Map()},liveCandleEventKey:'pane',
    liveReplayActiveRef:{current:false},LIVE_CHART_CANDLE_EVENT,
    window:{requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},
      cancelAnimationFrame:id=>frames.delete(id),addEventListener:(name,fn)=>listeners.set(name,fn),
      removeEventListener:name=>listeners.delete(name)},
  };
  new Function(...Object.keys(env),code)(...Object.values(env));
  return {painted,state,env,
    send:(candle,key='pane')=>listeners.get(LIVE_CHART_CANDLE_EVENT)?.({detail:{key,candle}}),
    flush:()=>{const queued=[...frames.values()];frames.clear();for(const frame of queued)frame();},
    get frames(){return frames.size;},stop:()=>cleanup(),get listeners(){return listeners.size;},
  };
}

test('actual live effect paints before another bar, withdraws rejected preview, and freezes a qualifying close',()=>{
  const live=mountedLiveEffect();
  live.send(signal());live.flush();
  assert.equal(live.painted.at(-1).length,1,'actual calculator emits a live block');
  live.send(faded());live.flush();assert.deepEqual(live.painted.at(-1),[]);
  live.send(signal());live.flush();
  // Flow volumes never shrink in the real source. Recover qualification with
  // more same-side executions rather than rewinding the already observed flow.
  live.send(bar(time,{high:102,close:101.75,volume:18500,askVolume:14000,bidVolume:4500,delta:9500}));
  live.flush();assert.equal(live.painted.at(-1).length,1);
  const fixed=live.painted.at(-1)[0];
  live.send(bar(time+60_000));live.flush();
  assert.ok(live.painted.at(-1).some(z=>z.id===fixed.id));
  assert.equal(live.painted.at(-1).find(z=>z.id===fixed.id).top,fixed.top);
  live.stop();assert.equal(live.frames,0);assert.equal(live.listeners,0);
});

test('actual frame coalescer settles the final rejected/qualifying observation before crossing a bar boundary',()=>{
  for(const qualified of [false,true]){
    const live=mountedLiveEffect();
    live.send(signal());live.flush();assert.equal(live.painted.at(-1).length,1);
    live.send(qualified?signal():faded());
    live.send(bar(time+60_000)); // no intervening browser frame
    live.flush();
    assert.equal(live.painted.at(-1).some(z=>z.id===tagged(time).zone.id),qualified);
    live.stop();
  }
});

test('actual listener ignores other panes/replay and coalesces same-bar bursts to one frame',()=>{
  const live=mountedLiveEffect();
  live.send(signal(),'other');assert.equal(live.frames,0);
  live.env.liveReplayActiveRef.current=true;live.send(signal());assert.equal(live.frames,0);
  live.env.liveReplayActiveRef.current=false;
  for(let i=0;i<200;i++)live.send(signal());
  assert.equal(live.frames,1);live.flush();assert.equal(live.painted.length,1);
  live.send(signal());live.stop();assert.equal(live.frames,0);assert.equal(live.listeners,0);
});

test('chart calculation identity includes timeframe and instance, while ordinary theme/opacity edits do not reset it',()=>{
  const chart=readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  const identity=chart.slice(chart.indexOf('  const bigBlocksLiveIdentity ='),chart.indexOf('  const bigBlocksLiveState ='));
  for(const key of ['liveCandleEventKey','instrument','timeframe','priceFormat.minMove','instanceId','replayTimestampMs','deepEffortOptions'])assert.ok(identity.includes(key),key);
  assert.doesNotMatch(identity,/themeVersion|zoneOpacity|askColor|bidColor/);
});
