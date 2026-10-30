import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stateDrawingCoordinates,stateDrawingSource,stateProfileWindow} from '../src/lib/kwantyStateDrawingAdapter.ts';
import {attachStateDrawingTools} from '../public/kwanty-app/state-drawing-tools.js';
import {createDrawing} from '../src/lib/chartDrawTools.ts';
import {createPriceSeries} from '../public/kwanty-app/price-series.js';
import {restoreStatePanels} from '../public/kwanty-app/state-panels.js';
const start=Date.UTC(2026,9,20,14);
const make=(ticker='QQQ',multiplier=1,offset=0)=>{
 const f={ticker,width:1000,height:500,multiplier,offset,interval:60000,bullish:'#123456',bearish:'#654321',candles:[]};
 f.geometry={left:20,right:920,top:40,bottom:440,startTime:start,endTime:start+3600000,minPrice:90,maxPrice:110,
 timeX:t=>20+(t-f.geometry.startTime)/(f.geometry.endTime-f.geometry.startTime)*900,
 priceY:p=>40+(f.geometry.maxPrice-p)/(f.geometry.maxPrice-f.geometry.minPrice)*400};return f;
};
test('all State ticker tools use real time/price, not strike rows or exposure coordinates',()=>{
 for(const ticker of ['SPX','SPXW','SPY','NDX','QQQ','VIX','AAPL','ES_SPX','NQ_NDX']){
  const f=make(ticker),c=stateDrawingCoordinates(()=>f),p={time:start/1000+900,price:101.125};
  const result=c.fromXY(c.toX(p.time),c.toY(p.price));assert.deepEqual(result,p);
  f.geometry.startTime+=120000;f.geometry.endTime+=120000;f.geometry.minPrice-=2;f.geometry.maxPrice-=2;
  assert.deepEqual(c.fromXY(c.toX(p.time),c.toY(p.price)),p);
 }
});
test('converted axes preserve raw drawing prices and source units across conversions',()=>{
 const f=make('ES_SPX',.02,-20),c=stateDrawingCoordinates(()=>f),p={time:start/1000+600,price:6000};
 assert.deepEqual(c.fromXY(c.toX(p.time),c.toY(p.price)),p);
 f.multiplier=.01;f.offset=40;assert.deepEqual(c.fromXY(c.toX(p.time),c.toY(p.price)),p);
 assert.equal(stateDrawingSource('ES_SPX'),'ES');assert.equal(stateDrawingSource('NQ_NDX'),'NQ');assert.equal(stateDrawingSource('QQQ'),'QQQ');
});
test('axis/header clicks and missing/inverted geometry never place a drawing',()=>{
 const f=make(),c=stateDrawingCoordinates(()=>f);
 for(const [x,y] of [[10,100],[950,100],[100,10],[100,450]])assert.equal(c.fromXY(x,y),null);
 f.geometry=null;assert.equal(c.toX(start),null);assert.equal(c.toY(100),null);assert.equal(c.fromXY(100,100),null);
});
test('profile ranges use source milliseconds, reverse placement and true candle interval',()=>{
 const f=make();f.candles=[{time:start+120000,open:100,high:101,low:99,close:100}];f.interval=180000;
 const fixed=createDrawing('fixedRangeVolumeProfile',[{time:(start+60000)/1000,price:100},{time:start/1000,price:101}]);
 assert.deepEqual(stateProfileWindow(fixed,f),{startMs:start,endMs:start+60000});
 const anchored=createDrawing('anchoredVolumeProfile',[{time:start/1000,price:100}]);
 assert.deepEqual(stateProfileWindow(anchored,f),{startMs:start,endMs:start+300000});
 assert.equal(stateProfileWindow({...fixed,points:[fixed.points[0],fixed.points[0]]},f),null);
});
test('async drawing mount disposes after chart removal instead of leaking a React root',async()=>{
 let release,disposed=0,updates=0;
 const chart={panel:{ticker:'QQQ'},toolsHost:{}},mounted=attachStateDrawingTools(chart,{mount:()=>new Promise(r=>release=r),persist(){},activate(){},zoom(){}});
 mounted.update(make());await Promise.resolve();mounted.dispose();release({dispose(){disposed++},update(){updates++}});await mounted.ready;
 assert.equal(disposed,1);assert.equal(updates,0);
});
test('drawing edits stay per ticker/panel, including late old-ticker events, and flush pending save on dispose',async()=>{
 let api,saves=0,updated;
 const panel={ticker:'QQQ'},mounted=attachStateDrawingTools({panel,toolsHost:{}},{mount:(_element,value)=>{api=value;return{update:f=>updated=f,dispose(){}}},persist(){saves++},activate(){},zoom(){}});
 await mounted.ready;
 const qqq=[createDrawing('horizontalLine',[{time:start/1000,price:100}])];
 api.write(qqq);panel.ticker='NDX';api.write([], 'QQQ');
 assert.deepEqual(api.read(),[]);api.write(qqq,'QQQ');assert.deepEqual(api.read('QQQ'),qqq);assert.deepEqual(api.read('NDX'),[]);
 mounted.update(make('NDX'));assert.equal(updated.ticker,'NDX');mounted.dispose();assert.equal(saves,1);
 const restored=restoreStatePanels([JSON.parse(JSON.stringify({id:'saved',...panel}))],{ticker:'SPX',settings:{}})[0];
 assert.deepEqual(restored.drawingsByTicker.QQQ,JSON.parse(JSON.stringify(qqq)));
});
test('indicator settings persist per panel/ticker and reserve real chart space',async()=>{
 let api,saves=0,redraws=0;
 const panel={ticker:'QQQ',settings:{}},chart={panel,toolsHost:{},wrap:{style:{}},content:{style:{}},indicatorPaneHost:{style:{}}};
 const mounted=attachStateDrawingTools(chart,{mount:(_host,value)=>{api=value;return{update(){},dispose(){}}},persist(){saves++},activate(){},zoom(){},redraw(){redraws++}});
 await mounted.ready;
 const studies=[{instanceId:'ma',indicatorId:'moving-average',enabled:true,settings:{length:5}}];
 api.writeIndicators(studies,'QQQ');assert.deepEqual(api.readIndicators('QQQ'),studies);assert.deepEqual(api.readIndicators('SPX'),[]);
 api.reserveIndicatorHeight(120);assert.equal(chart.content.style.bottom,'120px');assert.equal(chart.indicatorPaneHost.style.height,'120px');
 api.setPriceVisible(false);assert.equal(panel.settings.show_spot_history.display,false);assert.equal(redraws,1);assert.equal(saves,2);
 mounted.dispose();api.writeIndicators([],'QQQ');assert.deepEqual(panel.indicatorsByTicker.QQQ,studies);
});

test('real reported volume survives series aggregation; missing volume is never inferred',()=>{
 const series=createPriceSeries();series.reset({symbol:'QQQ'});
 const candle=i=>({time:start+i*60000,open:100,high:102,low:99,close:101,volume:10+i});
 series.seed([candle(0),candle(1),candle(2)],{symbol:'QQQ'});
 assert.equal(series.candles(180000)[0].volume,33);
 const noVolume={...candle(1)};delete noVolume.volume;series.seed([noVolume],{symbol:'QQQ'});
 assert.equal(series.candles(180000)[0].volume,undefined);
});
test('State reuses normal drawing layer/settings and forbids fabricated VAP fallback',()=>{
 const code=readFileSync(new URL('../src/components/kwanty/StateChartTools.tsx',import.meta.url),'utf8');
 assert.match(code,/import ChartDrawLayer/);assert.match(code,/import ChartDrawSettings/);assert.match(code,/requireExactVolumeProfiles/);
 assert.match(code,/isExecutionBackedVolumeProfile/);assert.match(code,/cash index|Cash index/);
 const layer=readFileSync(new URL('../src/components/ChartDrawLayer.tsx',import.meta.url),'utf8');
 assert.match(layer,/ownerDocument.defaultView/);assert.doesNotMatch(layer,/window\.(?:add|remove)EventListener/);
 assert.match(layer,/requireExactVolumeProfiles \|\| \(requireExactFixedVolumeProfiles && !anchored\)\) \? null : volumeProfile/);
});
