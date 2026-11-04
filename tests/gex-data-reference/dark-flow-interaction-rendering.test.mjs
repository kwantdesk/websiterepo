import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {darkFlowRows,darkFlowTotals,darkFlowTooltipModel,darkFlowTooltipRows} from '../../public/gex-data-app/dark-flow-interaction-model.js';
import {darkFlowInitialWindow} from '../../public/gex-data-app/equity-window-model.js';
import {niceValueDomain} from '../../public/gex-data-app/exposure-models.js';
import {timeDomain,timeX} from '../../public/gex-data-app/time-axis.js';
import {currencyAbbreviated,currencyAuto} from '../../public/gex-data-app/number-format.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  function ',start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const T=Date.parse('2026-10-16T08:00:00Z');
const row=(stockPrice,notionalValue=200,size=10,tradeCount=2)=>({stockPrice,notionalValue,size,tradeCount});

test('Source sorting/spot carry omits leading unusable quotes without changing input history or fabricating zero spots',()=>{
  const data={[T+180000]:row(null,400),[T]:row(null,50),[T+120000]:row(0,300),[T+60000]:row(100,200)},before=structuredClone(data);
  const rows=darkFlowRows(data);
  assert.deepEqual(rows.map(point=>point.time),[T+60000,T+120000,T+180000]);
  assert.deepEqual(rows.map(point=>point.spot),[100,100,100]);
  assert.deepEqual(rows.map(point=>point.notional),[200,300,400]);assert.deepEqual(data,before);
  assert.deepEqual(darkFlowRows({[T]:row(null),[T+60000]:row(0)}),[]);
});

test('Missing trade metrics remain missing instead of becoming zero trades',()=>{
  const rows=darkFlowRows({[T]:{stockPrice:100,notionalValue:null,size:null,tradeCount:null}});
  assert.equal(rows[0].notional,null);assert.equal(rows[0].size,null);assert.equal(rows[0].tradeCount,null);
  assert.deepEqual(darkFlowTotals(rows),{notional:null,size:null,tradeCount:null});
  assert.deepEqual(darkFlowTooltipRows(rows,rows[0]).slice(1,4),['Total Size: —','Total Trade Count: —','Total Notional Value: —']);
});

test('Full source tooltip labels, two-place abbreviations, currency, first-loaded baseline and timezone rollover',()=>{
  const rows=darkFlowRows({[T]:row(100),[T+9*3600000+30*60000]:row(101,1235000,1235,1234)}),last=rows.at(-1);
  assert.deepEqual(darkFlowTooltipRows(rows,last,{timeZone:'Australia/Brisbane'}),[
    '3:30 AM on October 17, 2026','Total Size: 1.24 K','Total Trade Count: 1.23 K','Total Notional Value: $1.24 M','Underlying Price: $101 (↑ 1.00%)',
  ]);
  const model=darkFlowTooltipModel(rows,last);assert.equal(model.spot.change,'1.00%');assert.equal(model.spot.direction,'up');
  assert.equal(darkFlowTooltipModel(rows,{...last,spot:99}).spot.change,'-1.00%');
  assert.equal(darkFlowTooltipModel(rows,rows[0]).spot.change,'0.00%');
});

test('Actual licensed first/last fixture fragments preserve source currency and percentage math',()=>{
  const rows=darkFlowRows({
    1792137600000:{notionalValue:2079425.25,size:2690,stockPrice:773.38,tradeCount:452},
    1792195140000:{notionalValue:716987.48,size:942,stockPrice:761.1,tradeCount:12},
  });
  assert.equal(rows.length,2);assert.equal(rows[0].spot,773.38);assert.equal(rows.at(-1).spot,761.1);
  assert.equal(darkFlowTooltipModel(rows,rows.at(-1)).spot.change,'-1.59%');
  assert.equal(currencyAbbreviated(darkFlowTotals(rows).notional,2),'$2.80 M');
});

function rendererHarness(){
  const specs=[],axes=[],lines=[],areas=[],updates=[],controls={ticker:'SPY',darkUnderlying:'SHOW'},summary=[];
  const env={getControl:key=>controls[key]??'',activeTool:{id:'dark-flow'},buildRequest:()=>({sessionDate:'2026-10-16',aggregationPeriod:'1m',filter:{ticker:controls.ticker}}),
    gexTimeZone:()=> 'America/New_York',darkFlowRows,darkFlowTotals,darkFlowTooltipRows,darkFlowInitialWindow,currencyAbbreviated,currencyAuto,
    compact:String,CHART_COLORS:{primary:'primary',price:'price'},themePaint:value=>value,niceValueDomain,timeDomain,timeX,
    quantCanvas:spec=>{specs.push(spec);return {update:(rows,legend,navigator)=>{updates.push({rows,legend,navigator});spec.items.splice(0,spec.items.length,...rows);spec.legend=legend;return true;}};},
    setSummary:items=>summary.push(items),drawDarkFlowArea:(_,points)=>areas.push(points),quantLine:(_,points)=>lines.push(points),
    drawAxisLabels:(_,options)=>axes.push(options),drawHorizontalTicks(){},drawTimeLabels(){},drawChartCrosshair(){},chartStrikeLabel:String,activeChartUpdate:null,
  };
  vm.runInNewContext(actual('renderDarkFlowQuant')+'\nthis.render=renderDarkFlowQuant;',env);
  const context=new Proxy({},{get:()=>()=>{}});
  return {env,specs,axes,lines,areas,updates,controls,summary,draw:(state={start:0,end:1})=>specs.at(-1).draw(context,900,540,state)};
}

test('Actual renderer uses visible positive notional bounds instead of a forced zero and full-session tooltip baseline',()=>{
  const h=rendererHarness();h.env.render({data:{[T]:row(100,10),[T+60000]:row(101,200),[T+120000]:row(102,250)}});
  h.draw({start:1,end:2});assert.ok(h.axes[0].min>0);assert.equal(h.specs[0].items.length,3);
  assert.match(h.specs[0].tooltipRows(h.specs[0].items[2]).at(-1),/2\.00%/);
  assert.equal(h.specs[0].legend[1].value,'$102');assert.equal(h.specs[0].legend[0].onClick,undefined);
});

test('Compatible actual refresh retains chart instance/history/navigation while updating header, tooltip and current rows',()=>{
  const h=rendererHarness();h.env.render({data:{[T]:row(100,100),[T+60000]:row(101,200)}});
  const state={start:0,end:1,rawStart:.25,rawEnd:1,yWindow:[0,1]},before=structuredClone(state),spec=h.specs[0];
  assert.equal(h.env.activeChartUpdate({data:{[T]:row(100,100),[T+60000]:row(102,300),[T+120000]:row(103,400)}}),true);
  assert.equal(h.specs.length,1);assert.equal(spec.items.length,3);assert.equal(h.updates.length,1);
  assert.deepEqual(h.updates[0].navigator,[100,300,400]);assert.equal(spec.legend[0].value,'$800');assert.equal(spec.legend[1].value,'$103');
  assert.match(spec.tooltipRows(spec.items[2]).at(-1),/3\.00%/);h.draw(state);assert.deepEqual(state,before);
  h.controls.ticker='QQQ';assert.equal(h.env.activeChartUpdate({data:{[T]:row(100)}}),false);assert.equal(h.updates.length,1);
});

test('Dark Flow metadata no longer offers an interval selector and actual builder fixes the public request to one minute',()=>{
  const start=source.indexOf('  const TOOL_DEFINITIONS = ['),end=source.indexOf('  const FILTER_GROUP_TOOLS=',start);
  const tools=vm.runInNewContext(source.slice(start,end)+'\nTOOL_DEFINITIONS;');assert.equal(tools.find(tool=>tool.id==='dark-flow').controls.includes('period'),false);
  const env={getControl:key=>({ticker:'SPY',period:'4h'})[key]??'',requestBase:()=>({sessionDate:'2026-10-16'}),toolCursor:null,
    getFilterOverrides:()=>({page:{},global:{}}),resolveFilterOverride:()=>({type:'NONE'}),FILTER_GROUP_TOOLS:new Set(),additionalToolRequest:(_,__,body)=>body};
  vm.runInNewContext(actual('maybeFilter')+'\n'+actual('buildRequest')+'\nthis.body=buildRequest({id:"dark-flow",controls:[]});',env);
  assert.equal(env.body.aggregationPeriod,'1m');
});
