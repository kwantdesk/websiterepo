import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {RollingDepthEngine,volumeDotDiameter,smartClusteringParameter,tradeClusterWindowMs} from '../public/heatmap-app/src/depth-engine.js';
import {planIncrementalTradeClusterRefresh} from '../public/heatmap-app/src/renderer.js';

const trade=(id,timestamp,size,tick=100,side='buy')=>({id,timestamp,size,tick,side});
const frame=(id,trades=[])=>({id,timestamp:id*50,bids:new Map(),asks:new Map(),trades});
const options={start:0,end:199,rowTicks:1,rowPixels:8,columnPixels:.2,circleSize:40,smartClustering:100};
const total=groups=>groups.reduce((sum,g)=>sum+g.total,0);

test('maximum clustering combines dense multi-second bursts while preserving every executed contract',()=>{
  const engine=new RollingDepthEngine(200);
  for(let i=0;i<80;i++)engine.append(frame(i,[trade(i,i*50,1+i%5,100+i%2,i%2?'sell':'buy')]));
  const individual=engine.clusterTrades({...options,smartClustering:0});
  const clustered=engine.clusterTrades(options);
  assert.ok(clustered.length<individual.length/4,`${individual.length}→${clustered.length}`);
  assert.equal(total(clustered),total(individual));
  assert.equal(clustered[0].anchorTimestamp,0);assert.equal(clustered[0].tick,100);
});
test('strength has bounded, increasing spatial reach and nested source-time windows',()=>{
  let previous=0;
  for(let strength=0;strength<=100;strength++){
    const parameter=smartClusteringParameter(strength);assert.ok(parameter>=previous&&parameter<=16);previous=parameter;
    assert.ok([250,500,1000,2000,4000].includes(tradeClusterWindowMs(strength)));
    assert.equal(tradeClusterWindowMs(strength,true),250);
  }
  assert.equal(tradeClusterWindowMs(100),4000);
  assert.ok(smartClusteringParameter(100)/smartClusteringParameter(99)<1.1);
});
test('3D sphere volume represents contracts and never renormalizes when a huge unrelated trade arrives',()=>{
  for(const size of [1,2,5,10,50,100,1000]){
    const diameter=volumeDotDiameter(size,100);
    assert.equal(diameter,volumeDotDiameter(size,1000000));
    assert.ok(Math.abs((diameter/volumeDotDiameter(1,100))**3-size)<1e-9);
  }
  assert.ok(volumeDotDiameter(1000,1000)>volumeDotDiameter(100,1000));
});
test('individual minimum2 retains all real larger trades; bubble minimum filters combined volume separately',()=>{
  const engine=new RollingDepthEngine(20);
  engine.append(frame(0,[trade('one',10,1),trade('two',20,2),trade('twenty',30,20)]));
  for(const minimumTradeSize of [1,2,3,20,21]){
    const groups=engine.clusterTrades({...options,minimumTradeSize});
    const expected=engine.frames[0].trades.filter(t=>t.size>=minimumTradeSize).reduce((s,t)=>s+t.size,0);
    assert.equal(total(groups),expected);
  }
  assert.ok(engine.clusterTrades({...options,minimumTradeSize:2}).length>0);
  assert.equal(total(engine.clusterTrades({...options,minimumTradeSize:1,minimumPixelVolume:23})),23);
  assert.equal(engine.clusterTrades({...options,minimumTradeSize:2,minimumPixelVolume:23}).length,0);
});
test('wide-window incremental refresh equals full rebuild including every bubble diameter',()=>{
  const engine=new RollingDepthEngine(300);
  for(let i=0;i<160;i++)engine.append(frame(i,[trade(i,i*50,1+i%3,100+i%4)]));
  let groups=engine.clusterTrades(options),end=engine.frames.at(-1);
  for(let i=160;i<180;i++){
    engine.append(frame(i,[trade(i,i*50,2,101)]));
    const plan=planIncrementalTradeClusterRefresh(engine.frames,groups,0,i,end,32,null,tradeClusterWindowMs(100));
    groups=[...plan.retained,...engine.clusterTrades({...options,start:plan.rebuildStart,end:i})];
    const shape=rows=>rows.map(({key,total,diameter,anchorTimestamp})=>({key,total,diameter,anchorTimestamp})).sort((a,b)=>a.anchorTimestamp-b.anchorTimestamp||a.key.localeCompare(b.key));
    assert.deepEqual(shape(groups),shape(engine.clusterTrades({...options,end:i})));
    end=engine.frames.at(-1);
  }
});
test('a later fixed source window cannot rewrite a settled bubble or its size',()=>{
  const engine=new RollingDepthEngine(50);engine.append(frame(0,[trade('first',10,10)]));
  const initial=engine.clusterTrades(options)[0];
  engine.append(frame(100,[trade('later',5000,10000)]));
  const held=engine.clusterTrades(options).find(g=>g.key===initial.key);
  assert.equal(held.total,10);assert.equal(held.diameter,initial.diameter);assert.equal(held.anchorTimestamp,10);
});
test('actual numeric and slider bindings use the same literal contract thresholds',()=>{
  const text=fs.readFileSync('public/heatmap-app/src/main.js','utf8');
  const source=ts.createSourceFile('main.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let loop;const visit=node=>{if(ts.isForOfStatement(node)&&node.initializer.getText(source)==='const [prefix, key]')loop=node;ts.forEachChild(node,visit);};visit(source);assert.ok(loop);
  const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'1',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});return nodes.get(id);};
  const ctx=vm.createContext({$,settings:{},requestRender:()=>{}});
  vm.runInContext(ts.transpileModule(loop.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  $('minimumTradeSizeRange').listeners.input({target:{value:'2'}});assert.equal(ctx.settings.minimumTradeSize,2);assert.equal($('minimumTradeSizeNumber').value,'2');
  $('minimumVolumeNumber').listeners.change({target:{value:'1500'}});assert.equal(ctx.settings.minimumPixelVolume,1500);assert.equal($('minimumVolumeOutput').value,'1500');
  $('minimumTradeSizeNumber').listeners.change({target:{value:''}});assert.equal(ctx.settings.minimumTradeSize,2);
});
