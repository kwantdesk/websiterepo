import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dataRequestIdentity,liveChartWindow,compatibleLiveTimeline} from '../public/gex-data-app/live-chart-model.js';
import {navigatorPreviewDomain} from '../public/gex-data-app/navigator-ui.js';
import {heatMapInitialWindow,heatMetricFor} from '../public/gex-data-app/exposure-models.js';
import {heatMapCellPoint,heatMapTooltipRows} from '../public/gex-data-app/additional-tool-renderers.js';
import {abbreviate,currencyAbbreviated} from '../public/gex-data-app/number-format.js';
import {lerpZoomStep} from '../public/gex-data-app/chart-interaction-model.js';

const source=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function requestsHarness(){
  let now=100000,mode='latest',date='2026-11-02';
  const requests=[],timers=new Map(),nodes={'#toolError':{hidden:true},'#toolUpdated':{textContent:'previous'},'#loadMore':{disabled:false}};
  const context={masterReplay:null,activeTool:{id:'stock-price-over-time',group:'Equities',liveMs:10000},frameVisible:true,window:{},document:{hidden:false},
    toolRequestId:0,toolCursor:null,toolPayload:{data:{previous:true}},tableRows:[],pollTimer:null,activeController:null,toolRequestInFlight:false,lastToolSuccessAt:10000,lastToolAttemptAt:10000,
    Date:class extends Date{static now(){return now;}},AbortController,EMBEDDED:false,
    snapshotSelections:new Map(),snapshotKey:()=> 'current',getControl:()=>mode,
    apiStatus:{market:{sessionDate:'2026-11-02',optionsSessionDate:'2026-11-02',equitiesOpen:true,optionsOpen:true}},
    buildRequest:()=>({sessionDate:date,filter:{ticker:'SPY'}}),dataRequestIdentity,toolPayloadQuery:null,
    toolView:{setAttribute(){}},q:key=>nodes[key],updateInitialToolLoading(){},resetStage(){context.resets++;},resets:0,
    loadToolPayload:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),renderToolPayload(){context.renders++;},renders:0,renderSnapshotControl(){},saveToolControls(){},updateLiveState(){},gexTimeZone:()=> 'UTC',
    setTimeout(fn,ms){const timer={fn,ms};timers.set(timer,timer);return timer;},clearTimeout(id){timers.delete(id);},
  };
  context.toolPayloadQuery=dataRequestIdentity(context.activeTool.id,context.buildRequest());
  const load=source.slice(source.indexOf('  async function loadActiveTool('),source.indexOf('  function renderSnapshotControl('));
  vm.runInNewContext(load+';this.resume=refreshResumedTool;this.load=loadActiveTool;this.schedule=schedulePoll;',context);
  return {context,requests,timers,nodes,setNow:value=>now=value,setMode:value=>mode=value,setDate:value=>date=value};
}

test('stale populated resume immediately fetches once, preserves selection and retains the normal poll cadence',async()=>{
  const h=requestsHarness(),previous=h.context.toolPayload,identity=h.context.toolPayloadQuery;
  h.context.resume();h.context.resume();h.context.schedule();
  assert.equal(h.requests.length,1);assert.equal(h.timers.size,0);assert.equal(h.context.toolPayload,previous);assert.equal(h.context.resets,0);
  h.requests[0].resolve({data:{current:true}});await flush();
  assert.equal(h.context.toolPayloadQuery,identity);assert.equal(h.context.renders,1);assert.equal(h.timers.size,1);
  assert.equal([...h.timers.values()][0].ms,30000);assert.equal(h.context.lastToolSuccessAt,100000);
  h.context.resume();assert.equal(h.requests.length,1);assert.equal(h.timers.size,1);
});

test('a fresh tab resume does not add a vendor request or duplicate its pending poll',()=>{
  const h=requestsHarness();h.context.lastToolSuccessAt=90000;
  h.context.resume();h.context.resume();
  assert.equal(h.requests.length,0);assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].ms,30000);
});

test('failed populated resume keeps verified data and does not create a tab-toggle retry storm',async()=>{
  const h=requestsHarness(),previous=h.context.toolPayload;
  h.context.resume();h.requests[0].reject(new Error('Unavailable'));await flush();
  h.context.resume();h.context.resume();
  assert.equal(h.requests.length,1);assert.equal(h.context.toolPayload,previous);assert.equal(h.nodes['#toolError'].hidden,false);assert.equal(h.timers.size,1);
  h.setNow(130000);h.context.resume();assert.equal(h.requests.length,2);
  h.requests[1].resolve({data:{current:true}});await flush();
});

test('aborted hidden request can be replaced once and its late finally cannot unlock the replacement',async()=>{
  const h=requestsHarness();h.context.resume();h.context.activeController.abort();h.context.resume();h.context.resume();
  assert.equal(h.requests.length,2);h.requests[0].reject(Object.assign(new Error('aborted'),{name:'AbortError'}));await flush();
  assert.equal(h.context.toolRequestInFlight,true);assert.equal(h.timers.size,0);
  h.requests[1].resolve({data:{current:true}});await flush();assert.equal(h.context.toolRequestInFlight,false);assert.equal(h.timers.size,1);
});

test('pinned, historical, historical override, replay, hidden and closed selections are not changed by resume',()=>{
  for(const change of [h=>h.context.snapshotSelections.set('current',123),h=>h.setMode('historical'),h=>h.setDate('2026-10-30'),h=>h.context.masterReplay={sessionDate:'2026-10-30',timestampMs:123},h=>h.context.document.hidden=true,h=>h.context.frameVisible=false,h=>h.context.apiStatus.market.equitiesOpen=false]){
    const h=requestsHarness(),previous=h.context.toolPayload,selection=h.context.toolPayloadQuery;change(h);h.context.resume();
    assert.equal(h.requests.length,0);assert.equal(h.context.toolPayload,previous);assert.equal(h.context.toolPayloadQuery,selection);assert.equal(h.timers.size,0);
  }
});

test('empty initial data still loads on resume without waiting for the polling interval',async()=>{
  const h=requestsHarness();h.context.toolPayload=null;h.context.lastToolSuccessAt=99999;h.context.resume();h.context.resume();
  assert.equal(h.requests.length,1);h.requests[0].resolve({data:{first:true}});await flush();assert.equal(h.context.renders,1);
});

function canvasHarness(){
  let dimensions={width:600,height:540},frameId=0;const observers=[],frames=new Map();
  class Node{
    constructor(){this.children=[];this.style={};this.listeners={};this.attributes={};this.isConnected=true;this.hidden=false;this.classList={add(){}};}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
    remove(){this.isConnected=false;}
    replaceChild(next,old){this.children[this.children.indexOf(old)]=next;}get lastChild(){return this.children.at(-1);}
    setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,v){(this.listeners[k]||=[]).push(v);}
    setPointerCapture(){}hasPointerCapture(){return true;}releasePointerCapture(){}
    getBoundingClientRect(){return {...dimensions,left:0,top:0};}
  }
  const nodes=new Map(),painted=[],lengths=[],navigators=[];
  const context={refreshingCanvas:null,activeChartInstance:null,activeChartUpdate:null,tableRuntime:null,tableColumnHost:null,activeTool:{id:'stock-price-over-time'},chartWindows:new Map(),
    buildRequest:()=>({sessionDate:'2026-11-02',filter:{ticker:'SPY'}}),showVisual(){},q:key=>{if(!nodes.has(key))nodes.set(key,new Node());return nodes.get(key);},element:(tag,className,textContent)=>Object.assign(new Node(),{tagName:tag,className,textContent}),document:{createElement:tag=>Object.assign(new Node(),{tagName:tag})},
    quantLegend:entries=>Object.assign(new Node(),{entries}),clearTimeout(){},setTimeout(){return 1;},cancelAnimationFrame:id=>frames.delete(id),requestAnimationFrame:callback=>{const id=++frameId;frames.set(id,callback);return id;},
    ResizeObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}},canvasContext:()=>({...dimensions,ctx:new Proxy({measureText:text=>({width:String(text).length*7})},{get:(target,key)=>target[key]??(()=>{})})}),themePaint:v=>v,CHART_COLORS:{primary:'#fff'},quantLine(){},timeDomain:()=>null,lerpZoomStep,
    bindZoomNavigator:options=>{navigators.push(options);return {sync(){},setLength:n=>lengths.push(n)};},liveChartWindow,compatibleLiveTimeline,navigatorPreviewDomain,
    toolConfiguration:{hideTooltips:false},cursorTooltipPlacement:()=>({left:0,top:0}),
    resetStage(){context.activeChartInstance=null;context.refreshingCanvas=null;context.resets++;},resets:0,
  };
  const tooltipRow=source.slice(source.indexOf('  function chartTooltipRow('),source.indexOf('  function quantGrid('));
  vm.runInNewContext(tooltipRow+source.slice(source.indexOf('  function quantCanvas('),source.indexOf('  function drawAxisLabels('))+';this.make=quantCanvas;',context);
  const spec=(items,extra={})=>({title:'Source chart',items,navigatorValues:items.map(row=>row.value),timeScale:true,legend:[{label:'Actual',value:items.at(-1)?.value}],draw:()=>painted.push(items.map(row=>row.value)),...extra});
  return {context,nodes,painted,lengths,navigators,spec,pendingFrames:()=>frames.size,flushFrames:()=>{let count=0;while(frames.size&&count++<200){const [id,callback]=frames.entries().next().value;frames.delete(id);callback();}assert.ok(count<200,'animation frames must settle');},setSize:(width,height)=>{dimensions={width,height};},resize:(width,height)=>{dimensions={width,height};for(const observer of observers)if(!observer.disconnected)observer.callback();}};
}

const heatExpiries=Array.from({length:33},(_,index)=>'expiry-'+index),heatStrikes=Array.from({length:101},(_,index)=>713+index);
const heatViewport=(width,height,spot=763,invert=false)=>{
  const next=heatMapInitialWindow(width,height,heatExpiries,heatStrikes,spot,invert),vertical=invert?heatExpiries:heatStrikes;
  return {start:next.horizontal[0],end:next.horizontal[1],yWindow:next.vertical.map(index=>index/(vertical.length-1))};
};
function heatSpec(h,resolver){return h.spec(heatExpiries.map((label,index)=>({label,value:index})),{timeScale:false,twoDimensional:true,verticalValues:heatStrikes,initialWindow:resolver});}

test('opt-in Heat Map initial window uses the first actual positive canvas size, not a fixed height or holder width',()=>{
  const h=canvasHarness(),calls=[];h.context.activeTool.id='heat-map';h.setSize(1240,600);
  const chart=h.context.make(heatSpec(h,size=>{calls.push(size);return heatViewport(size.width,size.height);})),expected=heatViewport(1240,600);h.flushFrames();
  assert.deepEqual(calls.map(size=>[size.width,size.height]),[[1240,600]]);assert.equal(chart.state.start,expected.start);assert.equal(chart.state.end,expected.end);assert.deepEqual(chart.state.yWindow,expected.yWindow);
  assert.equal(expected.end-expected.start+1,16);assert.equal(Math.round((chart.state.yWindow[1]-chart.state.yWindow[0])*(heatStrikes.length-1))+1,25);
  h.resize(900,420);assert.equal(calls.length,1,'ordinary resizing does not overwrite the selected viewport');assert.equal(chart.state.end,expected.end);assert.deepEqual(chart.state.yWindow,expected.yWindow);
});

test('zero-sized hidden canvas defers initial geometry until its first measured layout',()=>{
  const h=canvasHarness(),calls=[];h.context.activeTool.id='heat-map';h.setSize(0,0);const chart=h.context.make(heatSpec(h,size=>{calls.push(size);return heatViewport(size.width,size.height);}));
  assert.equal(calls.length,0);assert.equal(chart.state.end,32);h.flushFrames();h.resize(1240,600);assert.equal(calls.length,1);assert.equal(chart.state.end,15);h.resize(0,0);h.resize(1240,600);assert.equal(calls.length,1);
});

test('measured defaults do not replace a compatible saved viewport; reset recomputes at current size',()=>{
  const h=canvasHarness(),calls=[],frames=[];h.context.activeTool.id='heat-map';h.setSize(1240,600);
  h.context.chartWindows.set('heat-map',{query:JSON.stringify(h.context.buildRequest()),length:33,start:2,end:6,yWindow:[.2,.5]});
  const chart=h.context.make(heatSpec(h,size=>{calls.push(size);return heatViewport(size.width,size.height);}));h.flushFrames();assert.equal(chart.state.start,2);assert.equal(chart.state.end,6);assert.deepEqual(Array.from(chart.state.yWindow),[.2,.5]);
  h.resize(900,420);assert.equal(calls.length,1);h.context.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};h.context.activeChartReset();let turns=0;while(frames.length&&turns++<200)frames.shift()();assert.ok(turns<200);
  const expected=heatViewport(900,420);assert.equal(chart.state.start,expected.start);assert.equal(chart.state.end,expected.end);assert.deepEqual(Array.from(chart.state.yWindow),expected.yWindow);assert.deepEqual(calls.map(size=>[size.width,size.height]),[[1240,600],[900,420]]);
});

test('compatible Heat Map refresh preserves manual navigation and updates only the later reset resolver',()=>{
  const h=canvasHarness(),oldCalls=[],newCalls=[],frames=[];h.context.activeTool.id='heat-map';h.setSize(1240,600);
  const chart=h.context.make(heatSpec(h,size=>{oldCalls.push(size);return heatViewport(size.width,size.height);}));h.flushFrames();h.navigators[0].setWindow({start:3,end:9});h.navigators[1].setWindow({start:20,end:40});
  h.context.refreshingCanvas=chart;const replacement=h.context.make(heatSpec(h,size=>{newCalls.push(size);return heatViewport(size.width,size.height,770);}));assert.equal(replacement,chart);assert.equal(chart.state.start,3);assert.equal(chart.state.end,9);assert.deepEqual(Array.from(chart.state.yWindow),[.2,.4]);assert.equal(oldCalls.length,1);assert.equal(newCalls.length,0);
  h.context.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};h.context.activeChartReset();let turns=0;while(frames.length&&turns++<200)frames.shift()();assert.ok(turns<200);assert.equal(newCalls.length,1);assert.deepEqual(Array.from(chart.state.yWindow),heatViewport(1240,600,770).yWindow);
});

test('other charts retain static initial-window and reset behavior without measured opt-in',()=>{
  const h=canvasHarness(),initial={start:2,end:8,yWindow:[.1,.9]},frames=[];h.setSize(0,0);const chart=h.context.make(h.spec(Array.from({length:20},(_,time)=>({time,value:time})),{initialWindow:initial}));
  assert.equal(chart.state.start,2);assert.equal(chart.state.end,8);h.resize(900,420);assert.equal(chart.state.start,2);assert.equal(chart.state.end,8);chart.state.start=5;chart.state.end=10;
  h.context.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};h.context.activeChartReset();let turns=0;while(frames.length&&turns++<200)frames.shift()();assert.ok(turns<200);assert.equal(chart.state.start,2);assert.equal(chart.state.end,8);assert.deepEqual(Array.from(chart.state.yWindow),initial.yWindow);
});

function actualHeatPath(){
  const h=canvasHarness(),controls={ticker:'SPY',date:'2026-10-16',heatMetric:'CALL_IMPLIED_VOLATILITY',heatAxes:'NORMAL'},dates=Array.from({length:33},(_,index)=>new Date(Date.UTC(2026,9,16+index,12)).toISOString().slice(0,10));
  h.setSize(1240,600);Object.assign(h.context,{activeTool:{id:'heat-map',view:'heatMap'},activeChartDispose:null,tableRows:[],tableColumns:null,
    getControl:key=>controls[key]||'',buildRequest:()=>({sessionDate:controls.date,dataMode:controls.heatMetric,filter:{ticker:controls.ticker},...(controls.premiumCutoff?{filterExpression:{field:'PREMIUM',operation:'GREATER_THAN',values:[controls.premiumCutoff]}}:{})}),
    heatMapCellPoint,heatMapTooltipRows,heatMapInitialWindow,heatMetricFor,heatCellColor:()=> '#700FEC',formatPrice:value=>'$'+value,chartStrikeLabel:value=>'$'+value,
    compact:(value,money)=>money?currencyAbbreviated(value,2):abbreviate(value,2),setSummary(){},
  });
  const actual=name=>{const start=new RegExp(`^  function ${name}\\(`,'m').exec(source);assert.ok(start);const tail=source.slice(start.index+start[0].length),end=/^  (?:async )?function /m.exec(tail);assert.ok(end);return source.slice(start.index,start.index+start[0].length+end.index);};
  vm.runInNewContext(['showVisual','resetStage','renderHeatMap','renderToolPayload'].map(actual).join('\n')+';this.renderHeatPayload=renderToolPayload;',h.context);
  const domain=id=>{const entry=h.context.chartWindows.get('heat-map').navigation.axes.find(axis=>axis.id===id);return [entry.startValue,entry.endValue];};
  const render=(strikes,refresh=false,expiryDates=dates,activate=true)=>{const data=Object.fromEntries(expiryDates.map(date=>[date,Object.fromEntries(strikes.map(strike=>[strike,{value:10}]))]));h.context.renderHeatPayload(h.context.activeTool,{data,_spot:763},{refresh});if(activate)h.flushFrames();return h.context.activeChartInstance;};
  const oldStrikes=[55,100,200,380,...heatStrikes];
  return {...h,controls,dates,oldStrikes,render,domain};
}

test('actual Heat Map first activation ignores pre-footer540px observations and uses the settled503px layout',()=>{
  const h=actualHeatPath(),measure=h.context.canvasContext,reads=[];h.setSize(1280,540);
  h.context.canvasContext=canvas=>{const result=measure(canvas);if(canvas.className?.includes('quant-detail-chart'))reads.push([result.width,result.height]);return result;};
  const chart=h.render(h.oldStrikes,false,h.dates,false);assert.equal(h.pendingFrames(),1);assert.deepEqual(reads,[]);assert.equal(h.context.chartWindows.has('heat-map'),false);
  // loadActiveTool adds the snapshot footer after renderToolPayload returns.
  // Its ResizeObserver notification must not commit the earlier540px height.
  h.resize(1280,503);chart.redraw();assert.deepEqual(reads,[]);h.flushFrames();assert.deepEqual(reads,[[1280,503]]);
  const expected=heatMapInitialWindow(1280,503,h.dates,h.oldStrikes,763);assert.equal(chart.state.start,expected.horizontal[0]);assert.equal(chart.state.end,expected.horizontal[1]);assert.deepEqual(h.domain('strike'),[h.oldStrikes[expected.vertical[0]],h.oldStrikes[expected.vertical[1]]]);assert.equal(expected.vertical[1]-expected.vertical[0]+1,21);
  const initial={start:chart.state.start,end:chart.state.end,strike:h.domain('strike')};h.context.activeChartReset();h.flushFrames();assert.equal(chart.state.start,initial.start);assert.equal(chart.state.end,initial.end);assert.deepEqual(h.domain('strike'),initial.strike);assert.ok(reads.every(([,height])=>height===503));
});

test('actual Heat Map stays uninitialized at zero size and activates correctly on a later positive layout',()=>{
  const h=actualHeatPath();h.setSize(0,0);const chart=h.render(h.oldStrikes,false,h.dates,false);h.flushFrames();assert.equal(h.context.chartWindows.has('heat-map'),false);assert.equal(chart.state.end,32);
  h.resize(1280,503);assert.deepEqual(h.domain('strike'),[753,773]);assert.equal(h.pendingFrames(),0);
});

test('disposing actual Heat Map before its scheduled activation cancels drawing and navigation persistence',()=>{
  const h=actualHeatPath(),measure=h.context.canvasContext,reads=[];h.context.canvasContext=canvas=>{if(canvas.className?.includes('quant-detail-chart'))reads.push(canvas);return measure(canvas);};
  h.render(h.oldStrikes,false,h.dates,false);assert.equal(h.pendingFrames(),1);h.context.activeChartDispose();assert.equal(h.pendingFrames(),0);h.resize(1280,503);h.flushFrames();assert.deepEqual(reads,[]);assert.equal(h.context.chartWindows.has('heat-map'),false);
});

test('a saved semantic Heat Map window survives deferred first activation after the footer changes its height',()=>{
  const h=actualHeatPath();h.render(h.oldStrikes);h.navigators.at(-2).setWindow({start:3,end:8});h.navigators.at(-1).setWindow({start:h.oldStrikes.indexOf(740),end:h.oldStrikes.indexOf(755)});
  const chart=h.render(h.oldStrikes,false,h.dates,false);h.resize(1280,503);h.flushFrames();assert.equal(chart.state.start,3);assert.equal(chart.state.end,8);assert.deepEqual(h.domain('strike'),[740,755]);
});

test('a compatible refresh before deferred activation cannot persist a temporary full-universe window',()=>{
  const h=actualHeatPath();h.setSize(1280,540);const chart=h.render(h.oldStrikes,false,h.dates,false),refreshed=h.render(h.oldStrikes,true,h.dates,false);assert.equal(refreshed,chart);assert.equal(h.pendingFrames(),1);assert.equal(h.context.chartWindows.has('heat-map'),false);
  h.resize(1280,503);h.flushFrames();assert.deepEqual(h.domain('strike'),[753,773]);
});

test('actual Heat Map renderer and canvas swap expiry/strike value windows and reverse them on inversion',()=>{
  const h=actualHeatPath(),normal=h.render(h.oldStrikes);assert.deepEqual(h.domain('strike'),[751,775]);assert.deepEqual(h.domain('expiry'),[h.dates[0],h.dates[15]]);
  h.controls.heatAxes='INVERTED';const inverted=h.render(h.oldStrikes);assert.notEqual(inverted,normal);assert.equal(inverted.state.start,h.oldStrikes.indexOf(751));assert.equal(inverted.state.end,h.oldStrikes.indexOf(775));assert.deepEqual(h.domain('strike'),[751,775]);assert.deepEqual(h.domain('expiry'),[h.dates[0],h.dates[15]]);
  h.controls.heatAxes='NORMAL';const reversed=h.render(h.oldStrikes);assert.equal(reversed.state.start,0);assert.equal(reversed.state.end,15);assert.deepEqual(h.domain('strike'),[751,775]);assert.deepEqual(h.domain('expiry'),[h.dates[0],h.dates[15]]);
});

test('actual metric changes restore values into a different strike inventory rather than reuse normalized indices',()=>{
  const h=actualHeatPath(),first=h.render(h.oldStrikes),previousY=[...first.state.yWindow],nextStrikes=[50,55,100,200,380,500,...heatStrikes.filter(strike=>strike!==720)];
  h.controls.heatMetric='NET_PREMIUM';const next=h.render(nextStrikes);assert.deepEqual(h.domain('strike'),[751,775]);assert.deepEqual(h.domain('expiry'),[h.dates[0],h.dates[15]]);assert.notDeepEqual(Array.from(next.state.yWindow),previousY);
});

test('missing metric endpoints restore nearest actual strikes with the source lower tie rule',()=>{
  const h=actualHeatPath();h.render(h.oldStrikes);h.controls.heatMetric='NET_GAMMA_EXPOSURE';h.render(h.oldStrikes.filter(strike=>strike!==751&&strike!==775));assert.deepEqual(h.domain('strike'),[750,774]);
});

test('metric expiry-inventory changes preserve selected calendar dates on either axis',()=>{
  for(const inverted of [false,true]){
    const h=actualHeatPath();h.controls.heatAxes=inverted?'INVERTED':'NORMAL';h.render(h.oldStrikes);
    const dateNavigator=h.navigators.at(inverted?-1:-2);dateNavigator.setWindow({start:4,end:10});assert.deepEqual(h.domain('expiry'),[h.dates[4],h.dates[10]]);
    h.controls.heatMetric='NET_PREMIUM';const nextDates=[...h.dates.slice(1),'2026-11-18'];const chart=h.render(h.oldStrikes,false,nextDates);assert.deepEqual(h.domain('expiry'),[h.dates[4],h.dates[10]]);
    if(!inverted){assert.equal(chart.state.start,3);assert.equal(chart.state.end,9);}else{assert.deepEqual(Array.from(chart.state.yWindow),[3/(nextDates.length-1),9/(nextDates.length-1)]);}
  }
});

test('actual compatible refresh retains fractional navigation; changed same-length strike inventory remaps its values',()=>{
  const h=actualHeatPath(),first=h.render(h.oldStrikes),horizontal=h.navigators.at(-2),vertical=h.navigators.at(-1);
  horizontal.setWindow({start:3.25,end:8.75});vertical.setWindow({start:40.25,end:61.75});const before={start:first.state.start,end:first.state.end,y:Array.from(first.state.yWindow)};
  const refreshed=h.render(h.oldStrikes,true);assert.equal(refreshed,first);assert.equal(refreshed.state.start,before.start);assert.equal(refreshed.state.end,before.end);assert.deepEqual(Array.from(refreshed.state.yWindow),before.y);
  const values=h.domain('strike'),nextStrikes=[...h.oldStrikes.filter(strike=>strike!==55),790.5].sort((a,b)=>a-b),remapped=h.render(nextStrikes,true);assert.equal(remapped,first);assert.deepEqual(h.domain('strike'),values);assert.notDeepEqual(Array.from(remapped.state.yWindow),before.y);
});

test('actual ticker, session and genuine filter changes reset the domain instead of inheriting another scope',()=>{
  for(const change of [h=>{h.controls.ticker='QQQ';},h=>{h.controls.date='2026-10-19';},h=>{h.controls.premiumCutoff=100000;}]){
    const h=actualHeatPath();h.render(h.oldStrikes);h.navigators.at(-2).setWindow({start:4,end:7});h.navigators.at(-1).setWindow({start:h.oldStrikes.indexOf(740),end:h.oldStrikes.indexOf(755)});assert.deepEqual(h.domain('strike'),[740,755]);change(h);const next=h.render(h.oldStrikes);
    assert.equal(next.state.start,0);assert.equal(next.state.end,15);assert.deepEqual(h.domain('strike'),[751,775]);
  }
});

test('explicit Heat Map reset recomputes measured defaults for the current inverted orientation',()=>{
  const h=actualHeatPath(),frames=[];h.render(h.oldStrikes);h.controls.heatAxes='INVERTED';const chart=h.render(h.oldStrikes);assert.deepEqual(h.domain('strike'),[751,775]);h.context.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};h.context.activeChartReset();let turns=0;while(frames.length&&turns++<200)frames.shift()();assert.ok(turns<200);
  const expected=heatMapInitialWindow(1240,600,h.dates,h.oldStrikes,763,true);assert.equal(chart.state.start,expected.horizontal[0]);assert.equal(chart.state.end,expected.horizontal[1]);assert.deepEqual(h.domain('strike'),[h.oldStrikes[expected.horizontal[0]],h.oldStrikes[expected.horizontal[1]]]);assert.deepEqual(h.domain('expiry'),[h.dates[expected.vertical[0]],h.dates[expected.vertical[1]]]);
});

test('legacy Heat Map index-only saves reset safely rather than guessing which semantic axis they described',()=>{
  const h=actualHeatPath();h.context.chartWindows.set('heat-map',{query:JSON.stringify(h.context.buildRequest()),length:h.dates.length,start:2,end:5,yWindow:[.8,.9]});const chart=h.render(h.oldStrikes);assert.equal(chart.state.start,0);assert.equal(chart.state.end,15);assert.deepEqual(h.domain('strike'),[751,775]);
});

test('actual horizontal and vertical navigator callbacks clear stale dated tooltips and crosshairs',()=>{
  for(const axis of ['horizontal','vertical']){
    const h=canvasHarness(),rows=Array.from({length:10},(_,time)=>({time,value:time}));
    const chart=h.context.make(h.spec(rows,{twoDimensional:true,verticalValues:[10,20,30,40],tooltipRows:row=>['Observed',String(row.value)]}));
    const tooltip=chart.shell.children[1].children[1];
    chart.canvas.listeners.pointermove[0]({clientX:200,clientY:100});
    assert.equal(tooltip.hidden,false);assert.notEqual(chart.state.hover,null);
    chart.state.hoverRatio=.3;
    const navigator=h.navigators[axis==='horizontal'?0:1];
    navigator.setWindow(axis==='horizontal'?{start:1,end:7}:{start:1,end:2});
    assert.equal(tooltip.hidden,true,axis);assert.equal(chart.state.hover,null,axis);assert.equal(chart.state.hoverRatio,null,axis);
    if(axis==='horizontal'){assert.equal(chart.state.start,1);assert.equal(chart.state.end,7);}
    else assert.deepEqual(Array.from(chart.state.yWindow),[1/3,2/3]);
  }
});

test('actual legacy range-input events clear tooltip and hover on both horizontal and vertical windows',()=>{
  const descendants=node=>[node,...node.children.flatMap(descendants)];
  for(const [label,value] of [['Chart window start','1'],['Chart window end','8'],['Chart vertical window start','200'],['Chart vertical window end','800']]){
    const h=canvasHarness(),rows=Array.from({length:10},(_,time)=>({time,value:time}));
    const chart=h.context.make(h.spec(rows,{twoDimensional:true,verticalValues:[10,20,30,40],tooltipRows:row=>['Observed',String(row.value)]})),tooltip=chart.shell.children[1].children[1];
    chart.canvas.listeners.pointermove[0]({clientX:200,clientY:100});assert.equal(tooltip.hidden,false,label);
    chart.state.hoverRatio=.3;
    const range=descendants(chart.shell).find(node=>node.attributes['aria-label']===label);assert.ok(range,label);
    range.value=value;range.listeners.input[0]({target:range});
    assert.equal(tooltip.hidden,true,label);assert.equal(chart.state.hover,null,label);assert.equal(chart.state.hoverRatio,null,label);
  }
});

test('ordinary compatible data updates and replacements retain valid hover and refresh it from current observations',()=>{
  for(const method of ['update','replace']){
    const h=canvasHarness(),rows=Array.from({length:10},(_,time)=>({time,value:time}));
    const tooltipRows=row=>['Observed',String(row.value)],chart=h.context.make(h.spec(rows,{tooltipRows})),tooltip=chart.shell.children[1].children[1],event={clientX:200,clientY:100};
    chart.canvas.listeners.pointermove[0](event);const hovered=chart.state.hover;chart.state.hoverRatio=.3;
    assert.equal(tooltip.hidden,false);assert.equal(tooltip.children[1].textContent,String(rows[hovered].value));
    const next=rows.map(row=>({...row,value:row.value+100}));
    if(method==='update')assert.equal(chart.update(next,[{label:'Actual',value:109}],next.map(row=>row.value)),true);
    else assert.equal(chart.replace(h.spec(next,{tooltipRows})),true);
    assert.equal(chart.state.hover,hovered,method);assert.equal(chart.state.hoverRatio,.3,method);
    // The next real pointer sample reads the newly retained model; no stale
    // tooltip is restored by a delayed navigation callback or old closure.
    chart.canvas.listeners.pointermove[0](event);
    assert.equal(tooltip.hidden,false);assert.equal(tooltip.children[1].textContent,String(next[hovered].value),method);
  }
});

test('general canvas refresh keeps the actual canvas, pointer handlers, zoom and new callback data',()=>{
  const h=canvasHarness(),rows=[1,2,3,4].map(time=>({time,value:time})),first=h.context.make(h.spec(rows)),canvas=first.canvas;
  first.state.start=1;first.state.end=2;first.state.dragX=120;first.state.dragStart=[1,2,0,1];
  h.context.refreshingCanvas=first;
  const nextRows=[1,2,3,4,5].map(time=>({time,value:time*10})),next=h.context.make(h.spec(nextRows));
  assert.equal(next,first);assert.equal(next.canvas,canvas);assert.equal(h.context.resets,0);assert.equal(canvas.listeners.pointerdown.length,1);assert.equal(canvas.listeners.wheel.length,1);
  assert.equal(next.state.start,1);assert.equal(next.state.end,2);assert.equal(next.state.dragX,120);
  assert.deepEqual(h.painted.at(-1),[10,20,30,40,50]);assert.equal(next.shell.children[0].lastChild.entries[0].value,50);
  next.redraw();assert.deepEqual(h.painted.at(-1),[10,20,30,40,50]);
});

test('incompatible timeline, changed ticker or changed plot geometry rebuilds rather than misplacing observations',()=>{
  for(const alter of ['timeline','ticker','geometry','navigator']){
    const h=canvasHarness(),rows=[1,2,3].map(time=>({time,value:time})),first=h.context.make(h.spec(rows));
    h.context.refreshingCanvas=first;let nextRows=rows.map(row=>({...row,value:99})),extra={};
    if(alter==='timeline')nextRows=[{time:1,value:9},{time:1.5,value:9},{time:2,value:9},{time:3,value:9}];
    if(alter==='ticker')h.context.buildRequest=()=>({sessionDate:'2026-11-02',filter:{ticker:'QQQ'}});
    if(alter==='geometry')extra={plotRight:30};
    if(alter==='navigator'){nextRows=[{time:1,value:9}];}
    const next=h.context.make(h.spec(nextRows,extra));assert.notEqual(next.canvas,first.canvas);assert.equal(h.context.resets,1);
  }
});

test('a chart click restores its observed tooltip and numeric-strike crosshair, but a pan or detail click does not',()=>{
  const h=canvasHarness(),rows=[1,2,3].map(time=>({time,value:time}));
  const chart=h.context.make(h.spec(rows,{tooltipRows:(row,_index,state)=>{state.hover=1;state.hoverRatio=.7;return ['Observed',String(row.value)];}})),canvas=chart.canvas,tooltip=chart.shell.children[1].children[1];
  const event={clientX:200,clientY:100,pointerId:1,type:'pointerup'};
  canvas.listeners.pointermove[0](event);assert.equal(chart.state.hoverRatio,.7);assert.equal(tooltip.hidden,false);
  canvas.listeners.pointerdown[0](event);assert.equal(tooltip.hidden,true);
  canvas.listeners.pointerup[0](event);assert.equal(tooltip.hidden,false);assert.equal(chart.state.hoverRatio,.7);
  canvas.listeners.pointerdown[0](event);chart.state.panning=true;chart.state.start=.5;canvas.listeners.pointerup[0](event);assert.equal(tooltip.hidden,true);
  let details=0;
  const detail=h.context.make(h.spec(rows,{onClick:()=>{details++;},tooltipRows:()=>['Observed']}));
  detail.canvas.listeners.pointermove[0](event);detail.canvas.listeners.pointerdown[0](event);detail.state.panning=true;detail.canvas.listeners.pointerup[0]({...event,clientY:110});assert.equal(details,0);assert.equal(detail.shell.children[1].children[1].hidden,false);
  detail.canvas.listeners.pointermove[0](event);detail.canvas.listeners.pointerdown[0](event);detail.canvas.listeners.pointerup[0](event);
  assert.equal(details,1);assert.equal(detail.shell.children[1].children[1].hidden,true);
});

test('snapshot controls replace the previous control after an in-place canvas refresh',()=>{
  let removed=0;
  const context={q:(selector)=>selector==='.snapshot-control'?{remove(){removed++;}}:{},};
  vm.runInNewContext(source.slice(source.indexOf('  function renderSnapshotControl('),source.indexOf('  function resetStage('))+';renderSnapshotControl({});renderSnapshotControl({});',context);
  assert.equal(removed,2);
});

test('every opted-in renderer dispatches through the retained canvas while custom Market Map remains a rebuild',()=>{
  for(const view of ['netDrift','darkFlow','ohlc','optionOhlc','ivRank','maxPainTime','contractStats','sideStats','marketShare','exposureStrike','exposureExpiration','maxPain','heatMap','intervalMap','marketMap']){
    const h=canvasHarness(),rows=[1,2,3].map(time=>({time,value:time})),paint=payload=>h.context.make(h.spec(payload.data));
    for(const name of ['renderNetDriftQuant','renderDarkFlowQuant','renderOhlcQuant','renderIvRankQuant','renderMaxPainTimeQuant','renderContractStatsQuant','renderSideStatsQuant','renderMarketShareQuant','renderExposureProfileQuant','renderMaxPainQuant','renderHeatMap','renderIntervalMap','renderMarketMap'])h.context[name]=paint;
    vm.runInNewContext(source.slice(source.indexOf('  function renderToolPayload('),source.indexOf('  function exportCsv()'))+';this.render=renderToolPayload;',h.context);
    h.context.render({view},{data:rows});const first=h.context.activeChartInstance;
    first.state.start=1;first.state.end=2;
    h.context.render({view},{data:rows.map(row=>({...row,value:row.value+10}))},{refresh:true});
    assert.equal(h.context.resets,view==='marketMap'?2:1,view);
    assert.equal(h.context.activeChartInstance===first,view!=='marketMap',view);
    assert.equal(h.context.refreshingCanvas,null,view);
  }
});
