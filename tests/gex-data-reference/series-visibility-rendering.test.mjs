import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {netDriftRows} from '../../public/gex-data-app/options-models.js';
import {niceValueDomain,drawExposureBars,MAX_PAIN_STYLES} from '../../public/gex-data-app/exposure-models.js';
import {drawDarkFlowArea} from '../../public/gex-data-app/equity-renderers.js';
import {timeDomain,timeX} from '../../public/gex-data-app/time-axis.js';
import {toolSeriesVisibility,toolSeriesOptions,setToolSeriesVisibility} from '../../public/gex-data-app/series-visibility-model.js';
import {dataRequestIdentity} from '../../public/gex-data-app/live-chart-model.js';
import {darkFlowInitialWindow} from '../../public/gex-data-app/equity-window-model.js';
import {darkFlowRows,darkFlowTotals,darkFlowTooltipRows} from '../../public/gex-data-app/dark-flow-interaction-model.js';
import {netDriftTooltipRows,netDriftInitialRthIndex,netDriftVolumeDomain} from '../../public/gex-data-app/net-drift-interaction-model.js';
import {currencyAuto} from '../../public/gex-data-app/number-format.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf('  function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('\n  function ',start+1);return source.slice(start,end<0?source.length:end);}
const T=1792157400000;
function harness(controls={}){
  const specs=[],lines=[],areas=[],axes=[],volumes=[],bars=[],summaries=[],paint={globalAlpha:1},stack=[];
  const ctx=new Proxy({save(){stack.push({...paint});},restore(){Object.assign(paint,stack.pop());},measureText:text=>({width:String(text).length*7}),createLinearGradient:()=>({addColorStop(){}}),fill(){areas.push({color:paint.fillStyle,alpha:paint.globalAlpha});}},
    {get(target,key){if(key in target)return target[key];if(key in paint)return paint[key];return(...values)=>assert.ok(values.filter(value=>typeof value==='number').every(Number.isFinite));},set(_,key,value){paint[key]=value;return true;}});
  const env={getControl:key=>controls[key]??(key==='ticker'?'SPY':undefined),number:value=>Number(value)||0,parseNetDrift:(payload,options)=>netDriftRows(payload.data,options),currentNetDriftScope:()=>({eligible:controls.__scopeEligible!==false,ticker:'SPY'}),netDriftTooltipRows,netDriftInitialRthIndex,netDriftVolumeDomain,currencyAuto,
    compact:value=>String(value),formatPrice:value=>Number.isFinite(value)?'$'+value.toFixed(2):'—',currencyAbbreviated:String,chartStrikeLabel:String,displayChartTime:String,
    activeTool:{id:'net-drift'},activeChartUpdate:null,buildRequest:()=>({sessionDate:'2026-10-16',filter:{ticker:'SPY'}}),gexTimeZone:()=> 'Australia/Brisbane',
    CHART_COLORS:{call:'call',put:'put',price:'spot',netPremium:'net',primary:'primary',grid:'grid'},themePaint:value=>value,toolConfiguration:{hideAxisTitles:false},
    quantCanvas:spec=>{specs.push(spec);return {update:()=>true};},setSummary:summary=>summaries.push(summary),
    quantLine(_,points,color){assert.ok(points.every(point=>point.every(Number.isFinite)));lines.push({points,color});},
    niceValueDomain,timeDomain,timeX,MAX_PAIN_STYLES,drawDarkFlowArea,toolSeriesVisibility,darkFlowInitialWindow,darkFlowRows,darkFlowTotals,darkFlowTooltipRows,
    drawSignedVolume(_,points){volumes.push(points);},drawExposureBars(...args){bars.push(args[4]);return drawExposureBars(...args);},
    drawAxisLabels(_,options){axes.push(options);},drawHorizontalTicks(){},drawTimeLabels(){},drawChartCrosshair(){},
  };
  vm.runInNewContext([actual('numericEntries'),actual('safeBounds'),actual('renderDarkFlowQuant'),actual('renderNetDriftQuant'),actual('renderMaxPainQuant'),'this.renderers={renderDarkFlowQuant,renderNetDriftQuant,renderMaxPainQuant};'].join('\n'),env);
  const draw=()=>{const spec=specs.at(-1);spec.draw(ctx,900,540,{start:0,end:spec.items.length-1,rawStart:0,rawEnd:spec.items.length-1,yWindow:[0,1]});};
  return {env,specs,lines,areas,axes,volumes,bars,summaries,draw};
}

test('actual Dark Flow renderer hides only underlying line/axis and retains real notional area and totals',()=>{
  const payload={data:{[T]:{notionalValue:100,stockPrice:700,size:2,tradeCount:1},[T+60000]:{notionalValue:250,stockPrice:701,size:5,tradeCount:3}}},before=structuredClone(payload),shown=harness(),hidden=harness({darkUnderlying:'HIDE'});
  shown.env.renderers.renderDarkFlowQuant(payload);shown.draw();hidden.env.renderers.renderDarkFlowQuant(payload);hidden.draw();
  assert.deepEqual(shown.lines.map(line=>line.color),['spot']);assert.equal(hidden.lines.length,0);
  assert.equal(shown.axes.filter(axis=>axis.rightSide).length,1);assert.equal(hidden.axes.filter(axis=>axis.rightSide).length,0);
  assert.equal(hidden.areas.filter(area=>area.alpha===.3).length,1);assert.deepEqual(Array.from(hidden.specs[0].legend,row=>row.label),['Notional Value']);assert.equal(hidden.summaries[0][0][1],'350');assert.deepEqual(payload,before);
});

test('actual Net Drift hiding Calls removes their band, legend and domain contribution without changing volume history',()=>{
  const payload={data:{[T]:{stockPrice:700,netCallPremium:10000,netPutPremium:3,netCallVolume:5,netPutVolume:2,midMarketCallPremium:100,midMarketPutPremium:1},[T+60000]:{stockPrice:701,netCallPremium:10000,netPutPremium:3,netCallVolume:7,netPutVolume:1,midMarketCallPremium:100,midMarketPutPremium:1}}},before=structuredClone(payload),h=harness({driftCalls:'HIDE',driftPuts:'SHOW',driftNet:'HIDE',driftBands:'SHOW',driftUnderlying:'HIDE'});
  h.env.renderers.renderNetDriftQuant(payload);h.draw();assert.deepEqual(h.lines.map(line=>line.color),['put']);assert.deepEqual(h.areas.map(area=>area.color),['put']);assert.deepEqual(Array.from(h.specs[0].legend,row=>row.label),['Calls','Puts','SPY']);assert.deepEqual(Array.from(h.specs[0].legend,row=>row.visible),[false,true,false]);
  assert.ok(h.axes.find(axis=>axis.label==='Premium ($)').max<100);assert.equal(h.volumes.length,1);assert.equal(h.volumes[0].length,2);assert.equal(h.specs[0].items.at(-1).call,20000);assert.equal(h.specs[0].items.at(-1).netVolume,9);assert.deepEqual(payload,before);
});

test('actual Max Pain renderer selects the remaining intrinsic leg while keeping raw values and both real markers',()=>{
  const payload={stockPrice:715,maxPainStrikePrice:720,data:{'710':{callIntrinsicValue:10000,putIntrinsicValue:8},'720':{callIntrinsicValue:20000,putIntrinsicValue:9}}},before=structuredClone(payload);
  for(const [controls,display,label]of [[{painCalls:'HIDE'},'PUT','Puts'],[{painPuts:'HIDE'},'CALL','Calls']]){
    const h=harness(controls);h.env.renderers.renderMaxPainQuant(payload);h.draw();assert.equal(h.bars[0].display,display);assert.equal(h.bars[0].markers.length,2);assert.deepEqual(Array.from(h.bars[0].markers,marker=>marker.value),[720,715]);assert.equal(h.specs[0].items.at(-1).call,20000);
    // Native950920 always retains both legend entries; seriesVisible dims the
    // hidden leg so it remains available to restore with a header click.
    assert.deepEqual(Array.from(h.specs[0].legend,row=>row.label),['Calls','Puts','SPY']);
    assert.deepEqual(Array.from(h.specs[0].legend.slice(0,2),row=>row.visible),label==='Puts'?[false,true]:[true,false]);
    assert.ok(h.specs[0].legend.slice(0,2).every(row=>typeof row.onClick==='function'));
    const tip=h.specs[0].tooltipRows(h.specs[0].items.at(-1),1,{start:0,end:1,pointerX:900});
    assert.deepEqual(JSON.parse(JSON.stringify(tip)),['720',{columns:[[label+':'],[{parts:[{text:label==='Puts'?'9':'20000',tone:label==='Puts'?'bearish':'bullish'}]}]],columnAlignments:['left','right']}]);
  }
  assert.deepEqual(payload,before);
});

test('Net Drift raw volume is zero-anchored and dim legend clicks preserve complete tooltips',()=>{
  const controls={driftCalls:'SHOW'},h=harness(controls),events=[],payload={data:{[T]:{stockPrice:700,netCallPremium:10,netPutPremium:3,netCallVolume:1},[T+60000]:{stockPrice:701,netCallPremium:20,netPutPremium:4,netCallVolume:9}}};
  h.env.setControl=(key,value)=>{controls[key]=value;};h.env.onControlsChanged=event=>events.push(event);h.env.renderers.renderNetDriftQuant(payload);h.draw();
  const axis=h.axes.find(axis=>axis.label==='Volume');assert.equal(axis.min,0);assert.equal(axis.max,10);assert.equal(axis.steps,4);
  const spec=h.specs[0];spec.legend.find(row=>row.label==='Calls').onClick();assert.equal(controls.driftCalls,'HIDE');assert.equal(events[0].target.dataset.control,'driftCalls');assert.ok(spec.tooltipRows(spec.items[0]).some(row=>row.startsWith('Net Premium Difference:')));
});

test('a single-ticker Net Drift cannot infer permission to omit required stock from missing payload data',()=>{
  const payload={data:{[T]:{netCallPremium:10,netPutPremium:3},[T+60000]:{netCallPremium:20,netPutPremium:4}}},single=harness(),aggregate=harness({__scopeEligible:false});
  single.env.renderers.renderNetDriftQuant(payload);assert.equal(single.specs[0].items.length,0);
  aggregate.env.renderers.renderNetDriftQuant(payload);assert.equal(aggregate.specs[0].items.length,2);assert.deepEqual(Array.from(aggregate.specs[0].legend,row=>row.label),['Calls','Puts']);assert.ok(!aggregate.specs[0].tooltipRows(aggregate.specs[0].items[0]).some(row=>row.startsWith('Underlying Price:')));
});

test('actual visibility change callback redraws cached data without requesting or changing ticker/session/snapshot',()=>{
  for(const [toolId,control]of [['dark-flow','darkUnderlying'],['net-drift','driftCalls'],['max-pain','painCalls']]){
    const values={ticker:'SPY',mode:'historical',date:'2026-10-16',[control]:'SHOW'},payload={data:{unchanged:true}},request={sessionDate:'2026-10-16',filter:{ticker:'SPY'}},snapshots=new Map([['key',T]]);let renders=0,timers=0,saves=0;
    const env={EMBEDDED:false,commonSessionDateControls:null, netDriftContractControls:null,syncNetDriftDisplayButtons(){},activeTool:{id:toolId,view:toolId==='net-drift'?'netDrift':toolId},currentNetDriftScope:()=>({eligible:true,ticker:'SPY'}),savedToolControls:{[toolId]:{...values}},toolPayload:payload,toolPayloadQuery:dataRequestIdentity(toolId,request,T),snapshotSelections:snapshots,snapshotKey:()=> 'key',buildRequest:()=>request,dataRequestIdentity,toolSeriesOptions,setToolSeriesVisibility,
      setControl:(key,value)=>{values[key]=value;},saveToolControls(){saves++;env.savedToolControls[toolId]={...values};},renderToolPayload(tool,data,options){assert.equal(options.refresh,toolId==='net-drift');assert.equal(data,payload);assert.equal(tool.id,toolId);renders++;},renderSnapshotControl(){},syncDateControl(){},clearTimeout(){},setTimeout(){timers++;return 1;},loadActiveTool(){throw Error('Visibility must not request data');}};
    vm.runInNewContext(actual('onControlsChanged')+'\nthis.change=onControlsChanged;',env);env.change({target:{dataset:{control},value:'HIDE'}});
    assert.equal(renders,1);assert.equal(saves,1);assert.equal(timers,0);assert.equal(values[control],'HIDE');assert.equal(values.ticker,'SPY');assert.equal(values.date,'2026-10-16');assert.equal(snapshots.get('key'),T);
  }
});
