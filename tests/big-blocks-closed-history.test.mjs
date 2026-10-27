import test from 'node:test';
import assert from 'node:assert/strict';
import {BigBlocksLiveState} from '../src/lib/bigBlocksLiveState.ts';
import {calculateDeepEffort} from '../src/lib/deepEffort.ts';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const start=Date.UTC(2026,9,27,0,0);
const bar=i=>({timestamp:start+i*60000,open:100,high:102,low:99,close:101,volume:1000,askVolume:600,bidVolume:400,delta:200});
const candles=()=>Array.from({length:45},(_,i)=>bar(i));
const tagged=i=>({sourceTimestamp:bar(i).timestamp,endSourceTimestamp:bar(i+10).timestamp,zone:{id:`block-${i}`,startTime:bar(i).timestamp/1000,endTime:bar(i+10).timestamp/1000,top:102,bottom:100,side:'ASK',extensionBars:0}});

test('a historical block ten candles behind the live edge survives alternating recalculation results',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.synchronizeSnapshot(candles(),[tagged(34)],20);
  state.update(bar(44).timestamp,[],true);
  assert.equal(state.display([tagged(34)]).length,1);
  for(let i=0;i<20;i++){
    state.synchronizeSnapshot(candles(),i%2?[]:[{...tagged(34),zone:{...tagged(34).zone,top:999}}],20);
    const displayed=state.display(i%2?[]:[tagged(34)]);
    assert.equal(displayed.length,1);
    assert.equal(displayed[0].top,102);
  }
});

test('a closed historical no-signal decision with actual inputs cannot acquire a late block',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.synchronizeSnapshot(candles(),[],20);
  state.update(bar(44).timestamp,[],true);
  state.synchronizeSnapshot(candles(),[tagged(34)],20);
  assert.deepEqual(state.display([tagged(34)]),[]);
});

test('missing classified inputs can hydrate once, and the resulting closed block stays stable',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.synchronizeSnapshot(candles().map(c=>({...c,askVolume:0,bidVolume:0,delta:0})),[],20);
  state.synchronizeSnapshot(candles(),[tagged(34)],20);
  assert.equal(state.display([tagged(34)]).length,1);
  state.synchronizeSnapshot(candles(),[],20);
  assert.equal(state.display([]).length,1);
});

test('the current snapshot candle remains a withdrawable preview until a successor is available',()=>{
  const state=new BigBlocksLiveState('NQ:1m');
  state.synchronizeSnapshot(candles(),[tagged(44)],20);
  assert.equal(state.display([tagged(44)]).length,1);
  state.synchronizeSnapshot(candles(),[],20);
  assert.equal(state.display([]).length,0);
});

test('causal replay snapshots remain seekable and never retain future blocks after rewinding',()=>{
  const state=new BigBlocksLiveState('NQ:1m:replay');
  state.synchronizeSnapshot(candles(),[tagged(34)],20,false);
  assert.equal(state.display([tagged(34)]).length,1);
  state.synchronizeSnapshot(candles().slice(0,30),[],20,false);
  assert.deepEqual(state.display([]),[]);
});

test('the actual snapshot paint effect retains a real calculated ten-bar-old signal through flow recalculation',()=>{
  const text=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('Chart.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let effect;
  const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('bigBlocksLiveState.synchronizeSnapshot'))effect=node;ts.forEachChild(node,visit)};
  visit(source);assert.ok(effect);
  const original=candles().map(c=>({...c,close:100.1,high:101,low:99.5,askVolume:520,bidVolume:480,delta:40}));
  original[34]={...original[34],high:102,close:101.75,volume:5000,askVolume:4500,bidVolume:500,delta:4000};
  const changed=original.map((c,i)=>i===34?{...c,volume:9000,askVolume:4500,bidVolume:4500,delta:0}:c);
  const mapZones=rows=>calculateDeepEffort(rows,{instrument:'NQ',tickSize:0.25,minimumBars:20}).zones.map(zone=>({
    sourceTimestamp:zone.startTimestamp,endSourceTimestamp:rows[Math.min(zone.endIndex,rows.length-1)].timestamp,
    zone:{id:zone.id,startTime:rows[zone.startIndex].timestamp/1000,endTime:rows[Math.min(zone.endIndex,rows.length-1)].timestamp/1000,
      top:zone.top,bottom:zone.bottom,side:zone.side,extensionBars:Math.max(0,zone.endIndex-rows.length+1)},
  }));
  const initial=mapZones(original);assert.equal(initial.length,1);assert.equal(mapZones(changed).length,0);
  const paints=[];
  const context=vm.createContext({useEffect:fn=>fn(),deepEffortIndicator:{settings:{}},resolveIndicatorPalette:()=>({askColor:'green',bidColor:'red'}),
    indicatorPaletteTheme:{},clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),deepEffortOptions:{minimumBars:20},
    bigBlocksLiveState:new BigBlocksLiveState('NQ:1m'),indicatorCandles:original,bigBlockRenderZones:initial,
    bigBlocksPrimitiveOptionsRef:{current:null},bigBlocksSnapshotZonesRef:{current:[]},bigBlocksPrimitiveRef:{current:{update:zones=>paints.push(zones)}},
    eventChartTimeBySourceTimeRef:{current:new Map()},liveReplayActiveRef:{current:false},chartReadyRevision:1,settings:{},themeVersion:1,
  });
  const code=ts.transpileModule(effect.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInContext(code,context);
  for(let i=0;i<20;i++){
    context.indicatorCandles=i%2?original:changed;context.bigBlockRenderZones=mapZones(context.indicatorCandles);
    vm.runInContext(code,context);
    assert.equal(paints.at(-1).length,1);assert.equal(paints.at(-1)[0].id,initial[0].zone.id);
    assert.equal(paints.at(-1)[0].top,initial[0].zone.top);
  }
  // A different replay identity gets causal snapshots, not this live latch.
  context.bigBlocksLiveState=new BigBlocksLiveState('NQ:1m:replay');context.liveReplayActiveRef.current=true;
  context.indicatorCandles=original;context.bigBlockRenderZones=initial;vm.runInContext(code,context);
  context.indicatorCandles=original.slice(0,30);context.bigBlockRenderZones=[];vm.runInContext(code,context);
  assert.equal(paints.at(-1).length,0);
});
