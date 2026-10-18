import test from 'node:test';
import assert from 'node:assert/strict';
import {PRICE_CHART_TYPES,parsePriceRows,priceChartPresentation,candleBodyWidth,drawPriceCandles,drawOptionVolume,drawDarkFlowArea,prepareDarkPoolLevels,EQUITY_PRINT_COLUMNS,EXCHANGE_NOTIFICATION_COLUMNS,notificationColorToken,equitySideColorToken} from '../../public/gex-data-app/equity-renderers.js';

test('OHLC source types are candlestick and line only',()=>{
  assert.deepEqual(PRICE_CHART_TYPES.map(([value])=>value),['candles','line']);
  assert.equal(priceChartPresentation({chartType:'area'}).chartType,'candles');
});

test('REST OHLC remains dollars and missing values do not become zero',()=>{
  const rows=parsePriceRows({data:{200:{openPrice:1,highPrice:2,lowPrice:1,closePrice:1.5,volume:0},100:{openPrice:null,highPrice:3,lowPrice:1,closePrice:2,volume:4}}},{data:{200:{closePrice:700}}});
  assert.equal(rows[0].time,100);assert.equal(rows[0].open,null);assert.equal(rows[0].spot,null);
  assert.equal(rows[1].close,1.5);assert.equal(rows[1].spot,700);assert.equal(rows[1].volume,0);
});

test('contract volume/line uses contract color while stock never gets a volume pane',()=>{
  const rows=[{volume:12,spot:700}];
  const call=priceChartPresentation({option:true,contractType:'CALL',rows});
  assert.equal(call.lineColor,'#00FF00');assert.equal(call.volumeColor,'#00FF00');assert.equal(call.showUnderlying,true);assert.equal(call.showVolume,true);
  assert.equal(priceChartPresentation({option:true,contractType:'PUT',rows}).volumeColor,'#FF0000');
  assert.equal(priceChartPresentation({option:false,rows}).showVolume,false);
  assert.equal(priceChartPresentation({option:true,rows:[]}).showUnderlying,false);
});

test('candle and option-volume geometry uses source 60 percent slot width, 1–64px clamp',()=>{
  assert.equal(candleBodyWidth(20),12);assert.equal(candleBodyWidth(200),64);assert.equal(candleBodyWidth(1),1);
  const calls=[],ctx={beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(...args){calls.push({args,color:this.fillStyle});}};
  drawPriceCandles(ctx,[{open:1,high:3,low:0,close:2},{open:2,high:3,low:0,close:1},{open:null,high:3,low:0,close:1}],i=>i*20,n=>30-n*10,20);
  assert.equal(calls.length,2);assert.equal(calls[0].color,'#00FF00');assert.equal(calls[1].color,'#FF0000');assert.equal(calls[0].args[2],12);
  calls.length=0;drawOptionVolume(ctx,[{volume:1},{volume:0},{volume:null}],i=>i*20,n=>20-n*10,20,'PUT');
  assert.equal(calls.length,1);assert.equal(calls[0].color,'#FF0000');
});

test('dark-pool table selects notional top N before sorting and recomputes rank',()=>{
  const rows=prepareDarkPoolLevels({data:{100:{notionalValue:1000,tradeCount:1,size:10},101:{notionalValue:2000,tradeCount:3,size:30},102:{notionalValue:10,tradeCount:100,size:1000}}},{limit:2,sortKey:'tradeCount',direction:1});
  assert.deepEqual(rows.map(row=>row.price),[100,101]);assert.deepEqual(rows.map(row=>row.rank),[1,2]);
  assert.equal(rows[0].notionalFraction,.5);assert.equal(rows[1].notionalFraction,1);assert.equal(rows[0].tradeFraction,.25);assert.equal(rows[1].volumeFraction,.75);
});

test('dark flow fills to plot bottom with source gradient and 30 percent opacity',()=>{
  const stops=[],calls=[],ctx={createLinearGradient(...args){calls.push(['gradient',...args]);return {addColorStop(...args){stops.push(args);}};},beginPath(){},moveTo(){},lineTo(...args){calls.push(['line',...args]);},closePath(){},save(){},restore(){},fill(){calls.push(['fill',this.globalAlpha]);},stroke(){calls.push(['stroke',this.lineWidth]);}};
  drawDarkFlowArea(ctx,[[1,5],[2,8]],{top:0,bottom:20});
  assert.deepEqual(stops,[[0,'#6A12ED'],[1,'#C687FF']]);assert.ok(calls.some(call=>call[0]==='fill'&&call[1]===.3));assert.ok(calls.some(call=>call[0]==='line'&&call[1]===2&&call[2]===20));assert.ok(calls.some(call=>call[0]==='stroke'&&call[1]===2));
});

test('tables expose source columns and retain source notification/side semantics',()=>{
  assert.deepEqual(EQUITY_PRINT_COLUMNS.map(column=>column.label),['Date','Time','Ticker','Quantity','Price','Notional','Bid-Ask']);
  assert.deepEqual(EXCHANGE_NOTIFICATION_COLUMNS.map(column=>column.label),['Date','Time','Ticker','Type']);
  assert.equal(notificationColorToken('T2'),'--qd-dot-exchangeNotificationPositiveColor');assert.equal(notificationColorToken('H10'),'--qd-dot-exchangeNotificationNegativeColor');assert.equal(notificationColorToken('MWC1'),'--qd-dot-exchangeNotificationNegativeMarketWideColor');assert.equal(notificationColorToken('UNKNOWN'),null);
  assert.equal(equitySideColorToken({tradeSide:'MID_MARKET'}),'--qd-dot-sentimentNeutralColor');assert.equal(equitySideColorToken({isDelayedPrint:true,tradeSide:'ASK'}),'--qd-dot-equityPhantomColor');
});
