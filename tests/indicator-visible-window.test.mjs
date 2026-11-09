import assert from 'node:assert/strict';
import test from 'node:test';
import { visiblePaneData, sampledPanePoints, sampledVerticalPanePoints } from '../src/lib/chartIndicatorPaneSampling.ts';
const data=Array.from({length:200000},(_,time)=>({time,value:Math.sin(time),open:time%3,high:4,low:-4,close:1,breakBefore:time%500===0}));
for(const kind of ['line','histogram','candlestick'])test(`visible ${kind} geometry matches full-history projection and keeps session breaks`,()=>{
 const definition={kind,key:'test',data};let reads=0;const project=t=>{reads++;return t-100000};
 const baseline=sampledPanePoints(definition,project,600);const fullReads=reads;reads=0;
 const actual=sampledPanePoints(definition,project,600,{from:99930,to:100670});
 assert.deepEqual(actual,baseline);assert.equal(fullReads,200000);assert.ok(reads<750);
 reads=0;const baselineVertical=sampledVerticalPanePoints(definition,project,600);reads=0;
 const vertical=sampledVerticalPanePoints(definition,project,600,{from:99930,to:100670});assert.deepEqual(vertical,baselineVertical);assert.ok(reads<750);
});
test('source window is reversible on pan, never mutates or truncates archived data',()=>{
 const left=visiblePaneData(data,{from:20,to:30});assert.equal(left[0],data[19]);assert.equal(left.at(-1),data[31]);
 const far=visiblePaneData(data,{from:180000,to:180050});assert.equal(far[0],data[179999]);
 assert.deepEqual(visiblePaneData(data,{from:20,to:30}),left);assert.equal(data.length,200000);
 for(const window of [null,undefined,{from:NaN,to:20},{from:20,to:10}])assert.equal(visiblePaneData(data,window),data);
});
test('sparse/event source seconds keep neighbouring samples and exact OHLC unchanged',()=>{
 const rows=[{time:1,value:1},{time:3.501,value:2},{time:3.502,value:3},{time:1000,value:4},{time:9000,value:5}];
 assert.deepEqual(visiblePaneData(rows,{from:3.501,to:3.502}),rows.slice(0,4));
 assert.deepEqual(visiblePaneData(rows,{from:3.6,to:100}),rows.slice(2,5));
});
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('actual native viewport adapter reads current pan and maps event-bar seconds back to source time',()=>{
 const source=ts.createSourceFile('Chart.tsx',fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let initializer;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='indicatorVisibleTimeWindow')initializer=n.initializer.getText(source);ts.forEachChild(n,visit)};visit(source);assert.ok(initializer);
 let range={from:100,to:200};const chartRef={current:{timeScale:()=>({getVisibleRange:()=>range})}},eventSourceTimeByChartTimeRef={current:new Map()};
 const code=ts.transpileModule('const read='+initializer+';read;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const read=vm.runInNewContext(code,{useCallback:fn=>fn,chartRef,eventSourceTimeByChartTimeRef});assert.deepEqual({...read()},{from:90,to:210});
 range={from:501,to:502};eventSourceTimeByChartTimeRef.current=new Map([[501,9000000],[502,9060000]]);assert.deepEqual({...read()},{from:8994,to:9066});
 range=null;assert.equal(read(),null);chartRef.current=null;assert.equal(read(),null);
});
