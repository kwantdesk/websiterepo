import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {candleIntervalFor,priceViewFor,linkedViewportUpdates,linkedCursor,projectCursor,sharedViewport} from '../public/kwanty-app/panel-controls.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app=read('public/kwanty-app/app.js');

test('per-panel interval/type survive serialization and do not change neighbouring panels',()=>{
 const defaults={candleIntervalMs:60000,spotViewMode:'candles'},panels=[{id:'a',candleIntervalMs:60000,priceViewMode:'candles'},{id:'b',candleIntervalMs:300000,priceViewMode:'line'}];
 const restored=JSON.parse(JSON.stringify(panels));
 assert.deepEqual(restored.map(panel=>candleIntervalFor(panel,defaults)),[60000,300000]);
 assert.deepEqual(restored.map(panel=>priceViewFor(panel,defaults)),['candles','line']);
 assert.equal(candleIntervalFor({candleIntervalMs:-5},defaults),60000);
 assert.equal(candleIntervalFor(null,{candleIntervalMs:900000}),900000);
});

test('actual active-panel handlers update only the clicked panel and reuse local price aggregation',()=>{
 const nodes=Object.fromEntries(['#candleInterval','#priceViewMode','#activeChartLabel'].map(id=>[id,{}])),calls=[],settings={spotViewMode:'candles'},panels=[{id:'a',metric:'a'},{id:'b',metric:'b'}];
 let saves=0;
 const context={masterReplay:null,saved:{},state:{package:'orderflow',panels},settings:()=>settings,prices:{snapshot:interval=>{calls.push(interval);return {candles:[],points:[]};}},selectedPayload:()=>null,$:id=>nodes[id],$$:()=>[],charts:[],ORDERFLOW_METRICS:{a:{label:'GEX'},b:{label:'DEX'}},candleIntervalFor,priceViewFor,linkedViewportUpdates,linkedCursor,projectCursor,intervalLabel:value=>String(value),persist:()=>saves++,syncTimeline(){},drawAll(){}};
 context.orderSources={get:()=>({prices:context.prices,records:[]})};context.stopReplay=()=>{};context.syncShell=()=>context.syncActiveChartControls();
 vm.runInNewContext(app.slice(app.indexOf('let activePanelId='),app.indexOf('function syncPrices()')),context);
 context.activateChart({panel:panels[1]});context.changeCandleInterval(300000);context.priceState();
 context.activateChart({panel:panels[0]});context.changeCandleInterval(60000);context.priceState();
 assert.deepEqual(panels.map(p=>p.candleIntervalMs),[60000,300000]);assert.deepEqual(calls,[300000,60000]);
 assert.equal(nodes['#activeChartLabel'].textContent,'Chart 1 · GEX');assert.equal(saves,4);
 assert.equal(settings.candleIntervalMs,undefined);
});

test('viewport links copy time/underlying price, never incompatible metric values or candle intervals',()=>{
 const panels=[{id:'a',viewportLinked:true,candleIntervalMs:60000},{id:'b',viewportLinked:true,candleIntervalMs:300000},{id:'c',viewportLinked:false}];
 const next={startTime:100,endTime:500,minSpot:90,maxSpot:110,minValue:-1000000,maxValue:1000000};
 const updates=linkedViewportUpdates(panels,'a',next);
 assert.deepEqual(updates.get('a'),next);assert.deepEqual(updates.get('b'),{startTime:100,endTime:500,minSpot:90,maxSpot:110});
 assert.equal(updates.has('c'),false);assert.equal(panels[1].candleIntervalMs,300000);
 assert.deepEqual(sharedViewport({startTime:Infinity,endTime:500,minSpot:9,maxSpot:2}),{});
 panels[0].viewportLinked=false;assert.equal(linkedViewportUpdates(panels,'a',next).size,1);
});

test('actual toolbar handlers propagate interval and chart type only within the linked group',()=>{
 const panels=[{id:'a',viewportLinked:true,crosshairLinked:false},{id:'b',viewportLinked:true},{id:'c',viewportLinked:false,crosshairLinked:true}],defaults={};
 let selected=panels[0],saves=0,draws=0;
 const context={state:{package:'orderflow',panels},activePanel:()=>selected,settings:()=>defaults,persist:()=>saves++,syncActiveChartControls(){},syncTimeline(){},drawAll:()=>draws++};
 vm.runInNewContext(app.slice(app.indexOf('function chartControlTargets('),app.indexOf('function setChartView(')),context);
 context.changeCandleInterval('180000');context.changePriceView('line');
 assert.deepEqual(panels.map(p=>[p.candleIntervalMs,p.priceViewMode]),[[180000,'line'],[180000,'line'],[undefined,undefined]]);
 selected=panels[1];context.changeCandleInterval(300000);context.changePriceView('candles');
 assert.deepEqual(panels.slice(0,2).map(p=>[p.candleIntervalMs,p.priceViewMode]),[[300000,'candles'],[300000,'candles']]);
 selected=panels[2];context.changeCandleInterval(60000);context.changePriceView('line');
 assert.equal(panels[0].candleIntervalMs,300000);assert.equal(panels[0].priceViewMode,'candles');
 assert.equal(panels[2].candleIntervalMs,60000);assert.equal(panels[2].priceViewMode,'line');
 // Unlinking makes future edits independent without erasing the saved choices.
 panels[1].viewportLinked=false;selected=panels[0];context.changeCandleInterval(900000);
 assert.equal(panels[1].candleIntervalMs,300000);
 const restored=JSON.parse(JSON.stringify(panels));assert.equal(restored[0].candleIntervalMs,900000);assert.equal(restored[1].priceViewMode,'candles');
 for(const pkg of ['classic']){context.state.package=pkg;selected=null;context.changeCandleInterval(180000);context.changePriceView('line');assert.equal(defaults.candleIntervalMs,180000);assert.equal(defaults.spotViewMode,'line');}
 assert.equal(saves,9);assert.equal(draws,9);
 assert.match(app,/\$\('#priceViewMode'\)\.addEventListener\('change',event=>changePriceView\(event.target.value\)\)/);
});

function geometry({left=100,right=900,top=40,bottom=400,startTime=1000,endTime=11000,spotDomain=[90,110]}={}){
 return {left,right,top,bottom,startTime,endTime,spotDomain,priceAxisVisible:true,xTime:x=>startTime+(x-left)/(right-left)*(endTime-startTime),timeX:time=>left+(time-startTime)/(endTime-startTime)*(right-left),spotY:price=>bottom-(price-spotDomain[0])/(spotDomain[1]-spotDomain[0])*(bottom-top)};
}
test('linked cursor projects the identical timestamp and underlying price across unequal panel geometries',()=>{
 const a=geometry(),b=geometry({left:80,right:780,top:20,bottom:220,spotDomain:[80,120]});
 const cursor=linkedCursor(a,{x:500,y:130}),point=projectCursor(b,cursor);
 assert.equal(cursor.time,6000);assert.equal(cursor.spot,105);assert.equal(point.time,6000);
 assert.equal(b.xTime(point.x),cursor.time);assert.equal(point.y,b.spotY(cursor.spot));
 assert.equal(projectCursor(b,{time:99999,spot:105}),null);assert.equal(linkedCursor(a,{x:1,y:130}),null);
 const noPrice=projectCursor({...b,priceAxisVisible:false},cursor);assert.equal(noPrice.y,undefined);
});

test('linked reset synchronizes default time windows but does not reset another indicator’s metric scale',()=>{
 const panels=[{id:'a',viewportLinked:true,period:23400},{id:'b',viewportLinked:true,period:3600},{id:'c'}],views=new Map([['a',{minValue:-5,maxValue:5,startTime:1,endTime:2}],['b',{minValue:-1000,maxValue:1000,startTime:10,endTime:20,minSpot:50,maxSpot:60}],['c',{startTime:8,endTime:9}]]),frames=[];
 const chart={panel:panels[0],geometry:{priceAxisVisible:true,spotDomain:[90,110]}},context={views,state:{package:'orderflow',panels},charts:[chart],drawAll(){},priceState:()=>({points:[]}),currentRecords:()=>[],orderflowWindow:()=>({startTime:100,endTime:500}),requestAnimationFrame:fn=>frames.push(fn),setChartView:(_,next)=>{for(const[id,patch]of linkedViewportUpdates(panels,'a',next))views.set(id,{...views.get(id),...patch});}};
 vm.runInNewContext(app.slice(app.indexOf('function resetChartView('),app.indexOf('function syncChartCursor(')),context);context.resetChartView(chart);frames[0]();
 assert.equal(views.get('b').startTime,100);assert.equal(views.get('b').endTime,500);assert.equal(views.get('b').minValue,-1000);assert.equal(views.get('b').minSpot,90);
 assert.equal(views.get('a').minValue,undefined);assert.deepEqual(views.get('c'),{startTime:8,endTime:9});
});

test('toolbar is in the mode header, has normal-chart quick timeframes and per-panel link controls',()=>{
 const html=read('public/kwanty-app/index.html'),header=html.slice(html.indexOf('<header>'),html.indexOf('</header>'));
 for(const id of ['priceViewMode','candleInterval','toggleSidebar','fullscreen','screenshot'])assert.ok(header.includes('id="'+id+'"'));
 assert.doesNotMatch(html.slice(html.indexOf('<section id="charts"'),html.indexOf('<aside')),/id="candleInterval"|class="chart-tools"/);
 for(const ms of [60000,180000,300000,900000,1800000,3600000])assert.ok(header.includes('data-candle-interval="'+ms+'"'));
 assert.match(app,/panelLinkButton\(chart,'viewportLinked','shared viewport'/);assert.match(app,/panelLinkButton\(chart,'crosshairLinked','crosshair'/);
 assert.match(app,/priceState\(c.panel\)/);
 assert.match(app,/activePanelId,statePanels:state.statePanels,closedStatePanels:state.closedStatePanels,activeStatePanelId,scopes/);
});
