import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {liveChartWindow,compatibleLiveTimeline,dataRequestIdentity} from '../public/gex-data-app/live-chart-model.js';
import {netDriftRows} from '../public/gex-data-app/options-models.js';
import {navigatorPreviewDomain} from '../public/gex-data-app/navigator-ui.js';

const source=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
test('live revisions preserve a fixed viewport; tail follows and full view expands',()=>{
  assert.deepEqual(liveChartWindow({start:2,end:6},10,11),{start:2,end:6});
  assert.deepEqual(liveChartWindow({start:5,end:9},10,11),{start:6,end:10});
  assert.deepEqual(liveChartWindow({start:0,end:9},10,11),{start:0,end:10});
  assert.deepEqual(liveChartWindow({start:2.5,end:6.5},10,10),{start:2.5,end:6.5});
});
test('only revisions and append-only matching timelines update the existing canvas',()=>{
  const rows=[{time:1},{time:2}];
  assert.ok(compatibleLiveTimeline(rows,[{time:1,call:99},{time:2},{time:3}]));
  for(const next of [[],[{time:1}],[{time:2},{time:3}],[{time:1},{time:1.5},{time:2}]])assert.equal(compatibleLiveTimeline(rows,next),false);
});
test('data identity distinguishes ticker, session, aggregation, units and snapshot, not a page cursor',()=>{
  const body={sessionDate:'2026-10-16',filter:{ticker:'SPY'},aggregationPeriod:'1m',greekMode:'GAMMA'};
  const identity=dataRequestIdentity('interval-map',body);
  assert.equal(dataRequestIdentity('interval-map',{...body,searchAfter:['next']}),identity);
  for(const change of [{sessionDate:'2026-10-19'},{filter:{ticker:'QQQ'}},{aggregationPeriod:'5m'},{greekMode:'DELTA'}])assert.notEqual(dataRequestIdentity('interval-map',{...body,...change}),identity);
  assert.notEqual(dataRequestIdentity('interval-map',body,123),identity);
});
test('failed ticker selection removes stale chart; failed same-query refresh retains it',async()=>{
  let ticker='SPY',fail=false,resets=0;
  const nodes=new Map(),q=key=>{if(!nodes.has(key))nodes.set(key,{hidden:true,textContent:''});return nodes.get(key);};
  const context={activeTool:{id:'heat-map'},window:{},EMBEDDED:false,frameVisible:true,toolRequestId:0,toolCursor:null,pollTimer:null,activeController:null,AbortController,
    toolView:{setAttribute(){}},q,clearTimeout(){},updateInitialToolLoading(){},toolPayload:{data:{ticker:'SPY'}},toolPayloadQuery:null,
    dataRequestIdentity,buildRequest:()=>({sessionDate:'2026-10-16',filter:{ticker}}),snapshotSelections:new Map(),snapshotKey:()=> 'heat',resetStage(){resets++;},
    loadToolPayload:async()=>{if(fail)throw Error('Unavailable');return {data:{ticker}};},renderToolPayload(){},renderSnapshotControl(){},updateToolTimestamp(){},saveToolControls(){},updateLiveState(){},schedulePoll(){}};
  context.toolPayloadQuery=dataRequestIdentity('heat-map',context.buildRequest());
  vm.runInNewContext(source.slice(source.indexOf('  async function loadActiveTool('),source.indexOf('  function updateToolTimestamp('))+'\nthis.load=loadActiveTool;',context);
  fail=true;await context.load();assert.equal(resets,0);assert.equal(context.toolPayload.data.ticker,'SPY');
  ticker='QQQ';await context.load();assert.equal(resets,1);assert.equal(context.toolPayload,null);assert.equal(q('#toolUpdated').textContent,'');
  fail=false;await context.load();assert.equal(context.toolPayload.data.ticker,'QQQ');
});
test('revised net drift buckets recalculate totals rather than accumulating twice',()=>{
  const data={1:{stockPrice:100,netCallPremium:10,netPutPremium:4,netCallVolume:3,netPutVolume:2},2:{stockPrice:101,netCallPremium:5,netPutPremium:2,netCallVolume:1,netPutVolume:4}};
  const before=netDriftRows(data);
  const after=netDriftRows({...data,2:{...data[2],netCallPremium:7},3:{stockPrice:102,netCallPremium:-2,netPutPremium:1}});
  assert.equal(after.at(-1).call,15);assert.equal(after.at(-1).put,7);assert.equal(after.at(-1).netVolume,-2);
  assert.equal(before.at(-1).call,15);assert.ok(compatibleLiveTimeline(before,after));
});
test('refresh updates Net Drift before reset; filter/timezone changes can rebuild safely',()=>{
  const renders=[],context={activeChartUpdate:()=>true,resetStage:()=>{throw Error('Canvas was reset');}};
  const code=source.slice(source.indexOf('  function renderToolPayload('),source.indexOf('  function exportCsv()'));
  vm.runInNewContext(code+'\nthis.render=renderToolPayload;',context);
  context.render({view:'netDrift'},{data:{}},{refresh:true});
  assert.equal(renders.length,0);
  context.activeChartUpdate=()=>false;
  assert.throws(()=>context.render({view:'netDrift'},{data:{}},{refresh:true}),/Canvas was reset/);
  assert.throws(()=>context.render({view:'netDrift'},{data:{}}),/Canvas was reset/);
  assert.match(source,/presentationKey=JSON.stringify\(\[buildRequest\(activeTool\)/);
  assert.match(source,/horizontalNavigation\?\.setLength\(items.length\)/);
});
test('historical page/global date overrides do not continue polling as live',()=>{
  const code=source.slice(source.indexOf('  function schedulePoll()'),source.indexOf('  function renderSnapshotControl('));
  let scheduled=0;
  const context={activeTool:{id:'net-drift',group:'Exposure',liveMs:12000},frameVisible:true,window:{},document:{hidden:false},getControl:()=> 'latest',snapshotSelections:new Map(),snapshotKey:()=> 'key',apiStatus:{market:{sessionDate:'2026-10-19',optionsSessionDate:'2026-10-19',optionsOpen:true}},buildRequest:()=>({sessionDate:'2026-10-16'}),pollTimer:null,clearTimeout(){},setTimeout(){scheduled++;return 1;}};
  vm.runInNewContext(code+'\nthis.schedule=schedulePoll;',context);
  context.schedule();assert.equal(scheduled,0);
  context.buildRequest=()=>({sessionDate:'2026-10-19'});context.schedule();assert.equal(scheduled,1);
  context.pollTimer=null;context.buildRequest=()=>{throw Error('Invalid controls');};assert.doesNotThrow(()=>context.schedule());assert.equal(scheduled,1);
});
test('real canvas updater retains nodes, revised rows, drag state and growing navigator',()=>{
  class Node {
    constructor(){this.children=[];this.style={};this.listeners={};this.attributes={};this.isConnected=true;}
    append(...children){this.children.push(...children);} replaceChildren(...children){this.children=children;}
    replaceChild(next,old){this.children[this.children.indexOf(old)]=next;}
    get lastChild(){return this.children.at(-1);}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(key,value){this.listeners[key]=value;}
    getBoundingClientRect(){return {width:600,height:540,left:0,top:0};}
  }
  const nodes=new Map(),lengths=[],renders=[],context={
    showVisual(){},q:key=>{if(!nodes.has(key))nodes.set(key,new Node());return nodes.get(key);},element:()=>new Node(),document:{createElement:()=>new Node()},
    quantLegend:items=>Object.assign(new Node(),{items}),chartWindows:new Map(),activeTool:{id:'net-drift'},buildRequest:()=>({sessionDate:'2026-10-20',filter:{tickers:['SPY']}}),
    clearTimeout(){},setTimeout(){return 1;},cancelAnimationFrame(){},requestAnimationFrame(){},
    ResizeObserver:class{observe(){}disconnect(){}},
    canvasContext:()=>({width:600,height:540,ctx:new Proxy({},{get:()=>()=>{}})}),
    themePaint:value=>value,CHART_COLORS:{primary:'#fff'},quantLine(){},timeDomain:()=>null,
    bindZoomNavigator:()=>({sync(){},setLength:n=>lengths.push(n)}),liveChartWindow,compatibleLiveTimeline,navigatorPreviewDomain,
  };
  vm.runInNewContext(source.slice(source.indexOf('  function quantCanvas('),source.indexOf('  function drawAxisLabels('))+'\nthis.make=quantCanvas;',context);
  const rows=[{time:1,call:10},{time:2,call:15}];
  const chart=context.make({title:'Net Drift',items:rows,timeScale:true,navigatorValues:[10,15],draw:()=>renders.push(rows.at(-1).call)}),canvas=chart.canvas,shell=chart.shell;
  chart.state.dragX=50;chart.state.dragStart=[0,1,0,1];
  assert.equal(chart.update([{time:1,call:10},{time:2,call:17},{time:3,call:16}],[{label:'Calls',value:'16'}],[10,17,16]),true);
  assert.equal(chart.canvas,canvas);assert.equal(chart.shell,shell);assert.equal(chart.state.dragX,50);
  assert.equal(rows.at(-1).call,16);assert.equal(chart.state.start,0);assert.equal(chart.state.end,2);
  assert.deepEqual(lengths,[3]);assert.equal(renders.at(-1),16);assert.equal(shell.children[0].lastChild.items[0].value,'16');
  assert.equal(chart.update([{time:5,call:99},{time:6,call:99}],[],[]),false);assert.equal(rows.at(-1).call,16);
  const make=items=>context.make({title:'Rebuilt interval',timeScale:true,items,navigatorValues:[],draw(){}});
  const rebuilt=make([{time:1},{time:2},{time:3},{time:4}]);
  assert.equal(rebuilt.state.start,0);assert.equal(rebuilt.state.end,3,'full-session rebuild expands instead of discarding opening data');
  chart.state.start=1;chart.state.end=2;
  chart.update([{time:1},{time:2},{time:3}],[],[]);
  const cropped=make([{time:1},{time:2},{time:3},{time:4}]);
  assert.equal(cropped.state.start,2);assert.equal(cropped.state.end,3,'cropped trailing viewport follows live tail');
  context.buildRequest=()=>({sessionDate:'2026-10-20',filter:{tickers:['QQQ']}});
  const changed=make([{time:1},{time:2},{time:3},{time:4}]);
  assert.equal(changed.state.start,0,'another ticker cannot inherit SPY crop');
  context.buildRequest=()=>({sessionDate:'2026-10-20',filter:{tickers:['SPY']}});
  const inserted=make([{time:1},{time:1.5},{time:2},{time:3}]);
  assert.equal(inserted.state.start,0,'a revised historical timeline cannot inherit incompatible indices');
});
test('chart/save storage echoes do not repaint; real theme/configuration and filter changes still apply',()=>{
  let configuration={},style='theme-one',filters={},renders=0,loads=0,reflects=0;
  const context={toolConfiguration:configuration,document:{documentElement:{getAttribute:()=>style,className:'embedded'}},getFilterOverrides:()=>filters,getFilterGroups:()=>[],applyDocumentPreferences:()=>configuration,activeTool:{id:'net-drift'},toolPayload:{data:{}},renderToolPayload(){renders++;},renderSnapshotControl(){},reflectFilterOverrides(){reflects++;},syncDateControl(){},loadActiveTool(){loads++;}};
  vm.runInNewContext(source.slice(source.indexOf('  const preferenceFilterSignature='),source.indexOf("  window.addEventListener('storage',preferencesChanged)"))+'\nthis.changed=preferencesChanged;',context);
  context.changed();context.changed();assert.equal(renders,0);assert.equal(loads,0);assert.equal(reflects,0);
  configuration={hideTooltips:true};context.changed();assert.equal(renders,1);assert.equal(loads,0);
  style='theme-two';context.changed();assert.equal(renders,2);
  filters={page:{sessionDate:'2026-10-16'}};context.changed();assert.equal(loads,1);assert.equal(reflects,1);assert.equal(renders,2);
  context.changed();assert.equal(loads,1);assert.equal(renders,2);
});
