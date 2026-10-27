import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {buildPaperFillMarkers} from '../src/lib/paperFillMarkers.ts';
import {ObservedCandleHistory} from '../src/lib/observedCandleHistory.ts';

const start=Date.UTC(2026,9,27,0,0);
const bar=(offset=0)=>({timestamp:start+offset,open:100,high:105,low:95,close:103});
const fill=(overrides={})=>({id:'entry-1',symbol:'NQZ6',price:100.25,timestamp:start+15000,side:'buy',role:'entry',...overrides});

test('actual entry fills stay at their execution price on 1m and 3m charts',()=>{
  for(const interval of [60000,180000]){
    const marker=buildPaperFillMarkers([bar()], [fill()], 'NQ',interval)[0];
    assert.equal(marker.time,start/1000);assert.equal(marker.price,100.25);
    assert.equal(marker.role,'entry');
    assert.equal(buildPaperFillMarkers([{...bar(),close:200}], [fill()], 'NQ',interval)[0].price,100.25);
    assert.equal(buildPaperFillMarkers([bar()],[fill()],'NQ',interval,new Map([[start,123]]))[0].time,start/1000,'a previous event-chart mapping cannot move a clock-chart arrow');
  }
});

test('wrong instruments, missing buckets and invalid/unfilled records produce no misleading arrow',()=>{
  const records=[fill({symbol:'ES'}),fill({price:NaN}),fill({role:'working'}),fill({timestamp:start-1}),fill({timestamp:start+120000})];
  assert.deepEqual(buildPaperFillMarkers([bar()],records,'NQ',60000),[]);
  assert.equal(buildPaperFillMarkers([bar(),bar(120000)],[fill({timestamp:start+120001})],'NQ',60000)[0].time,(start+120000)/1000);
});

test('a directly painted new bar supplies the fill anchor before the sampled React history catches up',()=>{
  const observed=new ObservedCandleHistory();const scope='NQ:1m';
  observed.observe(scope,bar(),start+1000);observed.observe(scope,bar(60000),start+60010);
  const rows=observed.merge(scope,[bar()]);
  const markers=buildPaperFillMarkers(rows,[fill({timestamp:start+60010})],'NQ',60000);
  assert.equal(markers[0].time,(start+60000)/1000);
});

test('event candles use source execution times and their synthetic axis coordinates',()=>{
  const rows=[{...bar(),timestamp:start+1,sourceStartTimestamp:start},{...bar(),timestamp:start+2,sourceStartTimestamp:start+1}];
  const markers=buildPaperFillMarkers(rows,[fill({timestamp:start+1})],'NQ',null,new Map([[start+1,100],[start+2,101]]));
  assert.equal(markers[0].time,101);assert.equal(markers[0].price,100.25);
});

const text=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
const source=ts.createSourceFile('Chart.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
test('the actual canvas renderer paints a small red entry arrow with its tip exactly at the fill coordinate',()=>{
  let renderer;const visit=node=>{if(ts.isClassDeclaration(node)&&node.name?.text==='PaperFillMarkersRenderer')renderer=node;ts.forEachChild(node,visit)};visit(source);
  const code=ts.transpileModule(renderer.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const Renderer=new Function(`${code};return PaperFillMarkersRenderer`)();
  for(const side of ['buy','sell']){
    const drawn=[];let points=[];
    const ctx={save(){},restore(){},beginPath(){points=[]},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},closePath(){},fill(){drawn.push({points,color:this.fillStyle})}};
    const primitive={chart:()=>({timeScale:()=>({timeToCoordinate:()=>100})}),series:()=>({priceToCoordinate:price=>price*10}),markers:()=>[{time:1,price:100.25,side,role:'entry'}]};
    new Renderer(primitive).draw({useMediaCoordinateSpace:fn=>fn({context:ctx})});
    assert.equal(drawn[0].color,'#ff3b5c');assert.deepEqual(drawn[0].points,[[88,998.5],[100,1002.5],[88,1006.5]]);
  }
});

test('the actual fill effect rehydrates markers on chart creation and preserves the event-axis mapping',()=>{
  let effect;const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('const primitive = paperFillMarkersPrimitiveRef.current'))effect=node;ts.forEachChild(node,visit)};visit(source);
  assert.ok(effect.arguments[1].getText(source).includes('chartReadyRevision'));
  const paints=[];const context=vm.createContext({useEffect:fn=>fn(),paperFillMarkersPrimitiveRef:{current:null},buildPaperFillMarkers,
    observedCandleHistoryRef:{current:new ObservedCandleHistory()},observedCandleScope:'NQ:1m',candles:[bar()],paperFills:[fill()],instrument:'NQ',candleIntervalMs:60000,
    chartReadyRevision:0,eventChartTimeBySourceTimeRef:{current:new Map()}});
  const code=ts.transpileModule(effect.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInContext(code,context);assert.equal(paints.length,0);
  context.paperFillMarkersPrimitiveRef.current={update:markers=>paints.push(markers)};context.chartReadyRevision=1;
  vm.runInContext(code,context);assert.equal(paints[0][0].price,100.25);
});
