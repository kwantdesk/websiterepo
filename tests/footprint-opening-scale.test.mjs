import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function expression(name){let result;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)result=node.initializer?.getText(source);ts.forEachChild(node,visit);};visit(source);assert.ok(result,name);return result;}
function memoHarness(name,values){
 let previous,value;
 const context=vm.createContext({...values,useMemo:(calculate,deps)=>{if(!previous||deps.some((item,index)=>!Object.is(item,previous[index]))){value=calculate();previous=deps;}return value;}});
 const code=ts.transpileModule(`globalThis.result=${expression(name)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return {context,render:()=>{vm.runInContext(code,context);return context.result;}};
}

test('actual automatic grouping recalculates when the opening price scale settles, without waiting for trades',()=>{
 let pixelsPerTick=.05;
 const h=memoHarness('resolvedFootprintGroupTicks',{
  chartReadyRevision:1,chartVisualReady:false,footprintViewportVersion:0,
  footprintSettings:{groupingMode:'auto',fontSize:10,autoGroupFactor:1},footprintVisibleCandles:[{open:100,close:100}],
  candleSeriesRef:{current:{priceToCoordinate:price=>(price-100)/.25*pixelsPerTick}},priceFormat:{minMove:.25},
 });
 assert.equal(h.render(),100,'temporary fit-all scale is coarse');
 pixelsPerTick=5;h.context.chartVisualReady=true;
 assert.equal(h.render(),3,'final viewport determines first visible rows even on a silent feed');
});

test('actual footprint source window refreshes from fallback history to settled visible bars',()=>{
 let logical=null;
 const candles=Array.from({length:1000},(_,timestamp)=>({timestamp}));
 const h=memoHarness('footprintVisibleCandles',{
  footprintDataConsumer:true,footprintCandles:candles,candles,chartReadyRevision:1,chartVisualReady:false,
  footprintViewportVersion:0,footprintViewportCoverageRef:{current:null},chartRef:{current:{timeScale:()=>({getVisibleLogicalRange:()=>logical})}},
 });
 assert.equal(h.render().length,160);
 logical={from:970,to:990};h.context.chartVisualReady=true;
 const settled=h.render();assert.equal(settled[0].timestamp,952);assert.equal(settled.length,48);
});

test('manual ticks per row remain exact across the opening transition',()=>{
 const h=memoHarness('resolvedFootprintGroupTicks',{
  chartReadyRevision:1,chartVisualReady:false,footprintViewportVersion:0,
  footprintSettings:{groupingMode:'manual',manualTicks:7},footprintVisibleCandles:[],candleSeriesRef:{current:null},priceFormat:{minMove:.25},
 });
 assert.equal(h.render(),7);h.context.chartVisualReady=true;assert.equal(h.render(),7);
});

test('actual presentation clears provisional rows and commits final footprint before paint',()=>{
 let effect;
 const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='useLayoutEffect'&&node.arguments[0]?.getText(source).includes('const stableFootprintBars ='))effect=node.arguments[0];ts.forEachChild(node,visit);};visit(source);assert.ok(effect);
 const updates=[];
 const context=vm.createContext({footprintPrimitiveRef:{current:{update:bars=>updates.push(bars)}},candleSeriesRef:{current:{applyOptions:()=>{}}},chartRef:{current:{timeScale:()=>({applyOptions:()=>{}})}},
  footprintDataKey:'NQ:1m',contractSymbol:'NQZ6',footprintIndicator:{},liveFootprintRenderBars:[{rows:['final']}],chartVisualReady:false,replayTimestampMs:null,
  footprintPresentationScopeRef:{current:null},liveFootprintRenderBarsRef:{current:[]},retainLiveFootprintRows:bars=>bars,footprintPrimitiveOptions:{barWidth:50,perBarProfileWidthPercent:50},
  candlesVisible:true,livePriceLineColor:'#fff',footprintActiveRef:{current:false},footprintBarWidthRef:{current:null},clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
 });
 const code=ts.transpileModule(`(${effect.getText(source)})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInContext(code,context);assert.equal(updates.at(-1).length,0);
 context.chartVisualReady=true;vm.runInContext(code,context);assert.equal(updates.at(-1)[0].rows[0],'final');
});
