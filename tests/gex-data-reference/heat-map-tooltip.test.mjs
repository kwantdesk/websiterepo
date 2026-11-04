import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {heatMapCellPoint,heatMapTooltipRows} from '../../public/gex-data-app/additional-tool-renderers.js';
import {heatMetricFor,heatMapInitialWindow} from '../../public/gex-data-app/exposure-models.js';
import {abbreviate,currencyAbbreviated} from '../../public/gex-data-app/number-format.js';
import {heatCellSelection,heatCellTradeRequest} from '../../public/gex-data-app/heat-cell-history-model.js';

const context={ticker:'SPY',mode:'NET_GAMMA_EXPOSURE',formatExpiry:date=>date,formatStrike:strike=>'$'+strike};
const point=(raw,mode=context.mode)=>heatMapCellPoint(raw,{expiry:'2026-10-16',strike:763,mode});
const tooltip=(cell,mode=context.mode)=>heatMapTooltipRows(cell,{...context,mode});

test('actual Heat Map tooltip retains observed zero and signed paired legs without altering payload',()=>{
  const raw={callValue:0,putValue:-9400000000},original=structuredClone(raw),cell=point(raw);
  assert.deepEqual(cell,{expiry:'2026-10-16',strike:763,value:-9400000000,callValue:0,putValue:-9400000000});
  assert.deepEqual(tooltip(cell),['SPY · 2026-10-16','$763','Value: -9.40 B','Call Value: 0','Put Value: -9.40 B']);
  assert.deepEqual(raw,original);
});

test('actual tooltip omits absent/null/invalid legs and does not invent a net from a partial pair',()=>{
  for(const raw of [{callValue:4},{callValue:4,putValue:null},{callValue:4,putValue:''},{callValue:4,putValue:NaN}]){
    const cell=point(raw);assert.equal(cell.value,null);assert.equal(Object.hasOwn(cell,'putValue'),false);
    assert.deepEqual(tooltip(cell),['SPY · 2026-10-16','$763','Call Value: 4']);
  }
  assert.deepEqual(tooltip(point({value:0})),['SPY · 2026-10-16','$763','Value: 0']);
  assert.deepEqual(tooltip(point(null)),['SPY · 2026-10-16','$763']);
});

test('net premium subtracts supplied legs and retains REST dollar units at native precision',()=>{
  const cell=point({callValue:1234567,putValue:250000},'NET_PREMIUM');
  assert.equal(cell.value,984567);
  assert.deepEqual(tooltip(cell,'NET_PREMIUM').slice(2),['Value: $984.57 K','Call Value: $1.23 M','Put Value: $250 K']);
  assert.equal(tooltip(point({value:-1.25},'CALL_OPTION_PRICE'),'CALL_OPTION_PRICE').at(-1),'Value: -$1.25');
});

test('single-value IV remains percentage points and Greek tooltips retain five decimal places',()=>{
  assert.equal(tooltip(point({value:12.3456},'CALL_IMPLIED_VOLATILITY'),'CALL_IMPLIED_VOLATILITY').at(-1),'Value: 12.35%');
  assert.equal(tooltip(point({value:-.01234567},'PUT_DELTA'),'PUT_DELTA').at(-1),'Value: -0.01235');
  assert.equal(tooltip(point({value:0},'CALL_GAMMA'),'CALL_GAMMA').at(-1),'Value: 0.00000');
});

test('explicit source value wins over paired derivation without suppressing supplied legs',()=>{
  const cell=point({value:5,callValue:10,putValue:-3});assert.equal(cell.value,5);
  assert.deepEqual(tooltip(cell).slice(2),['Value: 5','Call Value: 10','Put Value: -3']);
});

// Execute the actual application factory, then exercise its draw-established
// hit geometry and tooltip callback. A disconnected helper cannot satisfy this.
const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
const renderer=app.slice(app.indexOf('  function renderHeatMap(payload)'),app.indexOf('  function renderMarketMap(payload)'));
function renderHeatMap(data,mode='NET_GAMMA_EXPOSURE',{inverted=false,hideAxisTitles=false}={}){
  let spec,summary;const details=[],drawCalls=[];
  const env={heatMapCellPoint,heatMapTooltipRows,heatMetricFor,heatMapInitialWindow,
    toolConfiguration:{hideAxisTitles},
    showVisual(){},getControl:key=>({ticker:'SPY',heatMetric:mode,heatAxes:inverted?'INVERTED':'NORMAL'})[key],
    q:()=>({clientWidth:900}),themePaint:color=>color,CHART_COLORS:{primary:'#700FEC'},
    chartStrikeLabel:value=>'$'+value,formatPrice:value=>'$'+value,
    compact:(value,money)=>money?currencyAbbreviated(value,2):abbreviate(value,2),
    heatCellColor:()=> '#700FEC',quantCanvas:value=>{spec=value;},setSummary:value=>{summary=value;},
    activeTool:{id:'heat-map'},buildRequest:()=>({sessionDate:'2026-10-16',dataMode:mode,filter:{ticker:'SPY'},filterExpression:{field:'PREMIUM',operation:'GREATER_THAN',values:[1000]}}),
    heatCellSelection,heatCellTradeRequest,openTradeDetail:detail=>details.push(detail),
  };
  vm.runInNewContext(renderer+'\nthis.render=renderHeatMap;',env);
  env.render({data:{'2026-10-16':data},_spot:763});
  const ctx=new Proxy({measureText:text=>({width:String(text).length*7})},{get:(target,key)=>target[key]??((...args)=>drawCalls.push({method:key,args})),set:(target,key,value)=>{target[key]=value;return true;}});
  spec.draw(ctx,900,540,{start:0,end:0,yWindow:[0,1]});
  const count=Object.keys(data).length,span=Math.max(1,count-1)+1;
  const pointer=index=>({pointerX:469,pointerY:506-(index+.5)*496/span});
  return {spec,summary,details,drawCalls,hover:index=>Array.from(spec.tooltipRows(null,0,pointer(index))),click:index=>spec.onClick(null,0,pointer(index))};
}

test('actual renderHeatMap factory suppresses zero net but retains supplied zero legs on nonzero points',()=>{
  const raw={'762':{callValue:0,putValue:0},'763':{callValue:0,putValue:-3000000}},before=structuredClone(raw);
  const h=renderHeatMap(raw);
  assert.deepEqual(h.hover(0),[]);h.click(0);assert.equal(h.details.length,0);
  assert.deepEqual(h.hover(1).slice(1),['$763','Value: -3 M','Call Value: 0','Put Value: -3 M']);
  h.click(1);assert.equal(h.details.length,1);
  assert.equal(h.summary.find(row=>row[0]==='Active cells')[1],'1');
  assert.match(h.spec.legend[0].label,/MVC \(\$763/);
  assert.deepEqual(raw,before);
});

test('actual renderer does not expose incomplete, zero, cancelling, null or nonfinite cells as grid points or MVC',()=>{
  const h=renderHeatMap({'760':{callValue:4},'761':{value:0},'762':{callValue:10,putValue:-10},'763':{value:null},'764':{value:NaN},'765':null,'766':{value:Infinity}});
  for(let index=0;index<7;index++){assert.deepEqual(h.hover(index),[]);h.click(index);}
  assert.equal(h.details.length,0);assert.equal(h.spec.legend.some(row=>row.label.startsWith('MVC')),false);
  assert.equal(h.summary.find(row=>row[0]==='Active cells')[1],'0');
  assert.equal(h.drawCalls.some(call=>call.method==='fillRect'),false);
});

test('actual renderer hover uses mode-specific units without scaling REST dollars or IV points',()=>{
  assert.deepEqual(renderHeatMap({'763':{callValue:1250000,putValue:250000}},'NET_PREMIUM').hover(0).slice(2),['Value: $1 M','Call Value: $1.25 M','Put Value: $250 K']);
  assert.equal(renderHeatMap({'763':{value:12.3456}},'CALL_IMPLIED_VOLATILITY').hover(0).at(-1),'Value: 12.35%');
  assert.equal(renderHeatMap({'763':{value:-.01234567}},'PUT_DELTA').hover(0).at(-1),'Value: -0.01235');
});

test('actual Heat Map click ignores a partial decimal cell and preserves scope for a real nonzero cell',()=>{
  const partial=renderHeatMap({'763':{callValue:-.12345}},'CALL_DELTA');
  assert.doesNotThrow(()=>partial.click(0));assert.equal(partial.details.length,0);assert.deepEqual(partial.hover(0),[]);
  const h=renderHeatMap({'763':{value:-.12345}},'CALL_DELTA');
  assert.doesNotThrow(()=>h.click(0));
  assert.equal(h.details.length,1);const detail=h.details[0];
  assert.equal(detail.individual,true);assert.match(detail.preview,/Delta \(Calls\): -0.12345$/);
  assert.equal(detail.requestOverride.sessionDate,'2026-10-16');
  assert.equal(detail.requestOverride.filter.ticker,'SPY');
  assert.deepEqual(Array.from(detail.requestOverride.filter.expirationDates),['2026-10-16']);
  assert.deepEqual(Array.from(detail.requestOverride.filter.strikePrices),[763]);
  assert.deepEqual(detail.requestOverride.filterExpression,{field:'PREMIUM',operation:'GREATER_THAN',values:[1000]});
});

test('actual Heat Map suppresses sparse absent cells and hits outside the plot',()=>{
  const h=renderHeatMap({'763':{callValue:1,putValue:-2}});
  assert.deepEqual(h.hover(1),[]);h.click(1);assert.equal(h.details.length,0);
  for(const [pointerX,pointerY]of [[87,250],[851,250],[469,9],[469,507]]){
    assert.deepEqual(Array.from(h.spec.tooltipRows(null,0,{pointerX,pointerY})),[]);
    h.spec.onClick(null,0,{pointerX,pointerY});
  }
  assert.equal(h.details.length,0);
});

test('actual Heat Map draws source-exact left title for normal and inverted axes and honors hide titles',()=>{
  for(const inverted of [false,true]){
    const h=renderHeatMap({'763':{callValue:1,putValue:-2}},'NET_GAMMA_EXPOSURE',{inverted});
    const title=inverted?'Expiration':'Strike Price';
    const text=h.drawCalls.filter(call=>call.method==='fillText'&&call.args[0]===title);
    assert.equal(text.length,1);assert.deepEqual(text[0].args,[title,0,0]);
    const index=h.drawCalls.indexOf(text[0]),preceding=h.drawCalls.slice(0,index);
    assert.deepEqual(preceding.filter(call=>call.method==='translate').at(-1).args,[18,258]);
    assert.deepEqual(preceding.filter(call=>call.method==='rotate').at(-1).args,[-Math.PI/2]);
    const hidden=renderHeatMap({'763':{callValue:1,putValue:-2}},'NET_GAMMA_EXPOSURE',{inverted,hideAxisTitles:true});
    assert.equal(hidden.drawCalls.filter(call=>call.method==='fillText'&&['Strike Price','Expiration'].includes(call.args[0])).length,0);
    assert.ok(hidden.drawCalls.some(call=>call.method==='fillText'),'axis/category labels remain drawn');
  }
});

test('actual scalar IV renderer places leg after Heat Map and legends use observed nonzero extrema at source precision',()=>{
  const h=renderHeatMap({'760':{value:0},'761':{value:.0476837158203125},'762':{value:2467.489}},'CALL_IMPLIED_VOLATILITY');
  assert.equal(h.spec.title,'Implied Volatility Heat Map (Calls) - SPY');
  assert.deepEqual(Array.from(h.spec.legend,row=>[row.label,row.value,row.color]),[
    ['Min Value','0.05%',heatMetricFor('CALL_IMPLIED_VOLATILITY').minColor+'1a'],
    ['Max Value','2,467.49%',heatMetricFor('CALL_IMPLIED_VOLATILITY').maxColor],
    ['SPY','$763','#700FEC'],
  ]);
});

test('actual scalar legends preserve signed extrema and metric formatting without replacing exposure MVC',()=>{
  const puts=renderHeatMap({'761':{value:-.125678},'762':{value:-.00123}},'PUT_DELTA');
  assert.equal(puts.spec.title,'Delta Heat Map (Puts) - SPY');
  assert.deepEqual(Array.from(puts.spec.legend.slice(0,2),row=>[row.label,row.value]),[['Min Value','-0.12568'],['Max Value','-0.00123']]);
  const net=renderHeatMap({'761':{callValue:1000,putValue:2000},'762':{callValue:5000,putValue:1000}},'NET_PREMIUM');
  assert.equal(net.spec.title,'Net Premium Heat Map - SPY');
  assert.deepEqual(Array.from(net.spec.legend.slice(0,2),row=>[row.label,row.value,row.color]),[['Min Value','-$1 K',heatMetricFor('NET_PREMIUM').minColor],['Max Value','$4 K',heatMetricFor('NET_PREMIUM').maxColor]]);
  const exposure=renderHeatMap({'761':{callValue:10,putValue:-2}});
  assert.equal(exposure.spec.title,'Net GEX Heat Map - SPY');assert.match(exposure.spec.legend[0].label,/^MVC /);
  assert.equal(exposure.spec.legend.some(row=>row.label==='Min Value'||row.label==='Max Value'),false);
  const empty=renderHeatMap({'761':{value:0},'762':{value:null}},'CALL_IMPLIED_VOLATILITY');
  assert.deepEqual(Array.from(empty.spec.legend,row=>row.label),['SPY']);
});
