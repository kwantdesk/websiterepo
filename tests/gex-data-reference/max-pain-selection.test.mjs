import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {additionalToolRequest} from '../../public/gex-data-app/additional-tool-requests.js';
import {resolveFilterOverride,expirationFilterForTool} from '../../public/gex-data-app/preferences-model.js';
import {currencyAbbreviated,currencyAuto} from '../../public/gex-data-app/number-format.js';
import {toolSeriesVisibility} from '../../public/gex-data-app/series-visibility-model.js';

const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
const buildSource=app.slice(app.indexOf('  function maybeFilter('),app.indexOf('  async function toolFetch('));
const loaderSource=app.slice(app.indexOf('  async function loadToolPayload('),app.indexOf('  function updateInitialToolLoading('));
function requests(){
  const values={ticker:'',expiry:''},overrides={page:{},global:{}},calls=[];
  const env={additionalToolRequest,requestBase:()=>({sessionDate:'2026-10-16'}),getControl:id=>values[id]??'',toolCursor:null,
    getFilterOverrides:()=>overrides,resolveFilterOverride,expirationFilterForTool,FILTER_GROUP_TOOLS:new Set(),
    apiStatus:{market:{optionsSessionDate:'2026-10-16'}},snapshotSelections:new Map(),snapshotKey:()=>'',
    toolFetch:async(endpoint,body)=>{calls.push({endpoint,body});return {data:{actual:true}};},};
  vm.runInNewContext(buildSource+loaderSource+'\nthis.build=buildRequest;this.load=loadToolPayload;',env);
  const tool={id:'max-pain',view:'maxPain',endpoint:'max-pain',controls:['ticker','expiry']};
  return {values,overrides,calls,load:()=>env.load(tool),build:()=>env.build(tool)};
}

test('actual Max Pain request waits for explicit required selection without discovery/provider calls',async()=>{
  const h=requests();await assert.rejects(h.load(),/Select an instrument and expiration/);assert.equal(h.calls.length,0);
  h.values.ticker='SPY';await assert.rejects(h.load(),/Select an expiration/);assert.equal(h.calls.length,0);
  h.values.expiry='2026-10-23';await h.load();assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].endpoint,'max-pain');assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].body)),{sessionDate:'2026-10-16',filter:{ticker:'SPY',expirationDate:'2026-10-23'}});
});

test('actual request honors page/global restored selections before validating required Max Pain filters',async()=>{
  const h=requests();h.overrides.global={tickers:['SPY'],expirationDate:'2026-10-23',sessionDate:'2026-10-16'};
  await h.load();assert.equal(h.calls[0].body.filter.ticker,'SPY');assert.equal(h.calls[0].body.filter.expirationDate,'2026-10-23');
  h.overrides.page={tickers:['QQQ'],expirationDate:'2026-11-20'};
  assert.equal(h.build().filter.ticker,'QQQ');assert.equal(h.build().filter.expirationDate,'2026-11-20');
  assert.deepEqual(h.values,{ticker:'',expiry:''});
});

test('actual control event clears expiration only on genuine ticker changes, not duplicate events or restores',()=>{
  const source=app.slice(app.indexOf('  function onControlsChanged('),app.indexOf('  function showBoard('));
  const values={ticker:'SPY',expiry:'2026-10-23'},ticker={dataset:{control:'ticker',maxPainTicker:'SPY'}},changes=[];
  const env={activeTool:{id:'max-pain'},getControl:id=>values[id]??'',setControl:(id,value)=>{values[id]=value;changes.push(id);},
    toolSeriesOptions:()=>[],saveToolControls(){},commonSessionDateControls:null,netDriftContractControls:null,syncNetDriftDisplayButtons(){},
    toolPayload:null,EMBEDDED:false,clearTimeout(){},setTimeout:()=>1};
  vm.runInNewContext(source+'\nthis.changed=onControlsChanged;',env);
  env.changed({target:ticker});assert.equal(values.expiry,'2026-10-23');assert.deepEqual(changes,[]);
  values.ticker='QQQ';env.changed({target:ticker});assert.equal(values.expiry,'');assert.deepEqual(changes,['expiry']);
  values.expiry='2026-11-20';env.changed({target:ticker});assert.equal(values.expiry,'2026-11-20');
  env.changed({target:{dataset:{control:'expiry'}}});assert.equal(values.expiry,'2026-11-20');
});

test('actual Max Pain tooltip uses native Calls/Puts currency labels and retains measured zero',()=>{
  const source=app.slice(app.indexOf('  function renderMaxPainQuant('),app.indexOf('  function renderMaxPainTimeQuant('));let spec;
  const env={getControl:id=>({ticker:'SPY',expiry:'2026-10-23'})[id]??'',number:Number,toolSeriesVisibility:()=>({call:true,put:true}),CHART_COLORS:{call:'green',put:'red',primary:'purple'},currencyAuto,formatPrice:value=>'$'+value,chartStrikeLabel:value=>'$'+value,compact:value=>currencyAbbreviated(value,2),quantCanvas:value=>{spec=value;},setSummary(){}};
  vm.runInNewContext(source+'\nthis.render=renderMaxPainQuant;',env);env.render({data:{'763':{callIntrinsicValue:0,putIntrinsicValue:1250000}},maxPainStrikePrice:763,stockPrice:762.74});
  assert.deepEqual(JSON.parse(JSON.stringify(spec.tooltipRows(spec.items[0],0,{}))),['$763',{columns:[['Calls:','Puts:'],[{parts:[{text:'$0',tone:'bullish'}]},{parts:[{text:'$1.25 M',tone:'bearish'}]}]],columnAlignments:['left','right']}]);
  const tooltipSource=app.slice(app.indexOf('  function chartTooltipRow('),app.indexOf('  function quantGrid('));
  env.element=(tag,className='',text='')=>({tag,className,text,style:{},children:[],append(...nodes){this.children.push(...nodes);}});
  vm.runInNewContext(tooltipSource+'\nthis.row=chartTooltipRow;',env);
  const rendered=spec.tooltipRows(spec.items[0],0,{}).map(env.row),grid=rendered[1];
  assert.equal(rendered[0].tag,'b');assert.equal(rendered[0].text,'$763');
  assert.equal(grid.children[1].style.textAlign,'right');
  assert.deepEqual(grid.children[0].children.map(node=>node.text),['Calls:','Puts:']);
  assert.deepEqual(grid.children[1].children.map(node=>[node.children[0].text,node.children[0].style.color]),[['$0','green'],['$1.25 M','red']]);
});

test('actual Max Pain header keeps both interactive leg legends, persists toggles and protects the last visible leg',()=>{
  const source=app.slice(app.indexOf('  function renderMaxPainQuant('),app.indexOf('  function renderMaxPainTimeQuant('));
  const values={ticker:'SPY',expiry:'2026-10-23',painCalls:'SHOW',painPuts:'HIDE'},writes=[],specs=[],draws=[];
  const payload={data:{'763':{callIntrinsicValue:10,putIntrinsicValue:20}},maxPainStrikePrice:763,stockPrice:762.74};
  const env={getControl:id=>values[id]??'',number:Number,toolSeriesVisibility,
    setControl:(key,value)=>{values[key]=value;},onControlsChanged:()=>{writes.push({...values});env.render(payload);},
    CHART_COLORS:{call:'green',put:'red',primary:'purple'},currencyAuto,formatPrice:value=>'$'+value,chartStrikeLabel:value=>'$'+value,
    compact:value=>currencyAbbreviated(value,2),quantCanvas:spec=>specs.push(spec),setSummary(){},
    MAX_PAIN_STYLES:{},toolConfiguration:{},drawExposureBars:(_ctx,_w,_h,_rows,options)=>{draws.push(options);return null;},
  };
  vm.runInNewContext(source+'\nthis.render=renderMaxPainQuant;',env);env.render(payload);
  let spec=specs.at(-1);
  assert.deepEqual(Array.from(spec.legend,row=>[row.label,row.visible,typeof row.onClick]),[['Calls',true,'function'],['Puts',false,'function'],['SPY',undefined,'undefined']]);
  spec.legend[0].onClick();assert.equal(writes.length,0);assert.equal(values.painCalls,'SHOW','sole visible leg cannot be hidden');
  spec.legend[1].onClick();assert.equal(writes.at(-1).painPuts,'SHOW');spec=specs.at(-1);
  spec.legend[0].onClick();assert.equal(writes.at(-1).painCalls,'HIDE');spec=specs.at(-1);
  assert.deepEqual(Array.from(spec.legend.slice(0,2),row=>row.visible),[false,true]);
  assert.deepEqual(JSON.parse(JSON.stringify(spec.tooltipRows(spec.items[0],0,{}))),['$763',{columns:[['Puts:'],[{parts:[{text:'$20',tone:'bearish'}]}]],columnAlignments:['left','right']}]);
  spec.draw({},900,540,{start:0,end:0});assert.equal(draws.at(-1).display,'PUT');
  const count=writes.length;spec.legend[1].onClick();assert.equal(writes.length,count);assert.equal(values.painPuts,'SHOW');
  assert.deepEqual(Array.from(spec.navigatorValues),[30],'navigator preserves full observed data');
});

test('actual Max Pain marker labels use source auto currency precision without altering numeric markers',()=>{
  const source=app.slice(app.indexOf('  function renderMaxPainQuant('),app.indexOf('  function renderMaxPainTimeQuant('));let spec,draw,summary;
  const env={getControl:id=>({ticker:'SPY',expiry:'2026-10-16'})[id]??'',number:Number,toolSeriesVisibility,currencyAuto,
    CHART_COLORS:{call:'green',put:'red',primary:'purple'},chartStrikeLabel:currencyAuto,compact:value=>currencyAbbreviated(value,2),
    quantCanvas:value=>{spec=value;},setSummary:value=>{summary=value;},MAX_PAIN_STYLES:{},toolConfiguration:{},
    drawExposureBars:(_ctx,_w,_h,_rows,options)=>{draw=options;return null;}};
  vm.runInNewContext(source+'\nthis.render=renderMaxPainQuant;',env);
  env.render({data:{'770':{callIntrinsicValue:10,putIntrinsicValue:20}},maxPainStrikePrice:770,stockPrice:762.74});
  spec.draw({},900,540,{start:0,end:0});
  assert.deepEqual(Array.from(draw.markers,marker=>[marker.value,marker.label]),[[770,'Max Pain: $770'],[762.74,'Last Price: $762.74']]);
  assert.deepEqual(Array.from(summary.slice(0,2),row=>Array.from(row)),[['Max pain','$770'],['Underlying','$762.74']]);
  assert.equal(spec.legend.at(-1).value,'$762.74');assert.equal(spec.tooltipRows(spec.items[0],0,{})[0],'$770');
  env.render({data:{'770.5':{callIntrinsicValue:10,putIntrinsicValue:20}},maxPainStrikePrice:770.5,stockPrice:762});
  spec.draw({},900,540,{start:0,end:0});
  assert.deepEqual(Array.from(draw.markers,marker=>marker.label),['Max Pain: $770.50','Last Price: $762']);
});
