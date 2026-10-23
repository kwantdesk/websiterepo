import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
import { CHART_COLORS } from './chart-primitives.js';

// market-data shipped source, 2026-10-18: 0j3p3hcgafh1-.js offsets are
// UTF-16 character offsets, not byte offsets. REST prices are dollars, unlike
// the source application's internal *InCents fields; do not divide REST values.
export const PRICE_CHART_TYPES = Object.freeze([['candles', 'Candlestick'], ['line', 'Line']]);
export const DEFAULT_TOP_DARK_POOL_LEVEL_COUNT = 50;

const marketNumber = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

// Contract REST OHLC has no underlying field. Join only an explicitly fetched
// stock response for the same session/aggregation. Missing prices stay missing.
export function parsePriceRows(payload, stockPayload = null) {
  const stock = stockPayload?.data || {};
  return Object.entries(payload?.data || {}).filter(([time]) => /^\d+$/.test(time)).sort(([a], [b]) => Number(a)-Number(b)).map(([time, row]) => ({
    time: Number(time), open: marketNumber(row.openPrice), high: marketNumber(row.highPrice),
    low: marketNumber(row.lowPrice), close: marketNumber(row.closePrice),
    volume: marketNumber(row.volume), spot: marketNumber(stock[time]?.closePrice)
  }));
}

// Source chars 1253600–1256200: contract line and volume use contract color,
// while stock overlay is lightened primary. Stock chart has no volume pane.
export function priceChartPresentation({ option = false, contractType, chartType = 'candles', rows = [] } = {}) {
  const contractColor = contractType === 'CALL' ? CHART_COLORS.call : contractType === 'PUT' ? CHART_COLORS.put : null;
  return {
    chartType: chartType === 'line' ? 'line' : 'candles',
    lineColor: option ? contractColor : CHART_COLORS.price,
    volumeColor: option ? contractColor : null,
    showVolume: option && rows.some(row => Number.isFinite(row.volume)),
    showUnderlying: option && rows.some(row => Number.isFinite(row.spot)),
    leftAxisName: option ? 'Contract Price ($)' : 'Underlying ($)',
    rightAxisName: option ? 'Underlying ($)' : null
  };
}

// Source 1174784 and 1190782: slot * .6, clamped 1–64; filled bodies,
// 1px wicks, green when close >= open. One shared rule for price and volume.
export function candleBodyWidth(slotWidth) { return Math.max(1, Math.min(.6 * slotWidth, 64)); }

export function priceChartBounds(rows, chartType = 'candles') {
  const lows=rows.map(row=>chartType==='line'?row.close:row.low).filter(Number.isFinite);
  const highs=rows.map(row=>chartType==='line'?row.close:row.high).filter(Number.isFinite);
  return {min:Math.min(...lows),max:Math.max(...highs)};
}

export function drawPriceCandles(ctx, rows, x, y, slotWidth) {
  const width = candleBodyWidth(slotWidth);
  rows.forEach((row, index) => {
    if (![row.open,row.high,row.low,row.close].every(Number.isFinite)) return;
    const cx=x(index), bodyTop=y(Math.max(row.open,row.close)), bodyBottom=y(Math.min(row.open,row.close));
    ctx.strokeStyle=ctx.fillStyle=row.close>=row.open?CHART_COLORS.call:CHART_COLORS.put;
    ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,y(row.high));ctx.lineTo(cx,y(row.low));ctx.stroke();
    ctx.fillRect(cx-width/2,bodyTop,width,Math.max(bodyBottom-bodyTop,1));
  });
}

// Source 1191660: non-signed volume bars use one contract color and omit
// missing / zero values. This must never be used for a stock volume pane.
export function drawOptionVolume(ctx, rows, x, y, slotWidth, contractType) {
  const color=contractType==='CALL'?CHART_COLORS.call:contractType==='PUT'?CHART_COLORS.put:null;
  if(!color)return;
  const width=candleBodyWidth(slotWidth),zero=y(0);ctx.fillStyle=color;
  rows.forEach((row,index)=>{if(!Number.isFinite(row.volume))return;const top=y(row.volume),height=zero-top;if(height>0)ctx.fillRect(x(index)-width/2,top,width,height);});
}

// Source 1310400 + native area renderer 1189490. Both area and 2px line use
// the vertical primary→#C687FF gradient. The area closes at the plot bottom.
export function drawDarkFlowArea(ctx, points, {top,bottom,primaryColor=CHART_COLORS.primary}) {
  const finite=points.filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));if(!finite.length)return;
  const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,primaryColor);gradient.addColorStop(1,themePaint("#C687FF"));
  const trace=()=>{ctx.beginPath();finite.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));};
  ctx.save();trace();ctx.lineTo(finite.at(-1)[0],bottom);ctx.lineTo(finite[0][0],bottom);ctx.closePath();ctx.globalAlpha=.3;ctx.fillStyle=gradient;ctx.fill();ctx.restore();
  trace();ctx.strokeStyle=gradient;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
}

// Explicit source schemas: never derive visible columns from API key order.
// Historical source tables show Date; latest-session tables omit it.
export const EQUITY_PRINT_COLUMNS = Object.freeze([
  {key:'date',label:'Date',width:120,historicalOnly:true,timeField:'tradeTime'},
  {key:'tradeTime',label:'Time',width:110}, {key:'ticker',label:'Ticker',width:110},
  {key:'size',label:'Quantity',width:110}, {key:'price',label:'Price',width:110},
  {key:'notionalValue',label:'Notional',width:120}, {key:'bidAsk',label:'Bid-Ask',width:150}
]);
export const EXCHANGE_NOTIFICATION_COLUMNS = Object.freeze([
  {key:'date',label:'Date',width:120,historicalOnly:true,timeField:'createdTime'},
  {key:'createdTime',label:'Time',width:100}, {key:'ticker',label:'Ticker',width:110}, {key:'type',label:'Type',width:110}
]);
export const DARK_POOL_LEVEL_COLUMNS = Object.freeze([
  {key:'rank',label:'Rank',width:70}, {key:'price',label:'Price',width:100},
  {key:'notionalValue',label:'Notional Value',width:150}, {key:'tradeCount',label:'Trade Count',width:140}, {key:'volume',label:'Volume',width:140}
]);

// Source 1318800: choose Top N by notional BEFORE applying table sorting;
// notional progress is relative to maximum, trade/volume percentages to sum.
export function prepareDarkPoolLevels(payload, {limit=50,sortKey='price',direction=-1}={}) {
  const all=Object.entries(payload?.data||{}).map(([price,row])=>({price:marketNumber(price),notionalValue:marketNumber(row.notionalValue),tradeCount:marketNumber(row.tradeCount),volume:marketNumber(row.size)})).filter(row=>Number.isFinite(row.price));
  const top=all.sort((a,b)=>(b.notionalValue??0)-(a.notionalValue??0)).slice(0,Math.max(1,Math.trunc(limit)||50));
  const maximum=Math.max(0,...top.map(row=>row.notionalValue??0)),trades=top.reduce((sum,row)=>sum+(row.tradeCount??0),0),volume=top.reduce((sum,row)=>sum+(row.volume??0),0);
  return top.map(row=>({...row,notionalFraction:maximum?(row.notionalValue??0)/maximum:0,tradeFraction:trades?(row.tradeCount??0)/trades:0,volumeFraction:volume?(row.volume??0)/volume:0})).sort((a,b)=>((a[sortKey]??0)-(b[sortKey]??0))*direction).map((row,index)=>({rank:index+1,...row}));
}

// Source 987268: these are semantic CSS tokens, not guessed theme RGBs.
export function equityPrintColorToken(row) {
  return row.isDelayedPrint?'--qd-dot-equityPhantomColor':row.printType==='DARK_POOL'?'--qd-dot-equityDarkPoolColor':row.printType==='LIT_POOL'?'--qd-dot-equityLitPoolColor':null;
}
export function equitySideColorToken(row) {
  if(row.isDelayedPrint)return '--qd-dot-equityPhantomColor';
  if(['ASK','ABOVE_ASK','A','AA'].includes(row.tradeSide))return '--qd-dot-sentimentBullishColor';
  if(['BID','BELOW_BID','B','BB'].includes(row.tradeSide))return '--qd-dot-sentimentBearishColor';
  return ['MID_MARKET','M'].includes(row.tradeSide)?'--qd-dot-sentimentNeutralColor':null;
}

// Source module 963429, chars 979000–984395, type→sentiment classification.
export const NOTIFICATION_SENTIMENT = Object.freeze(Object.fromEntries([
  ...['C3','C4','C9','C11','IPOQ','IPOE','MWCQ','R4','R9','T2','T3','T6'].map(type=>[type,'POSITIVE']),
  ...['D','H4','H9','H10','H11','M2','REG_SHO'].map(type=>[type,'NEGATIVE']),
  ...['MWC0','MWC1','MWC2','MWC3','O1'].map(type=>[type,'NEGATIVE_MARKET_WIDE']),
  ...['IPO1','LUDP','LUDS','M','M1','R1','R2','T1','T5','T7','T8','T12'].map(type=>[type,'NEUTRAL'])
]));
export const NOTIFICATION_TYPES = Object.freeze(Object.keys(NOTIFICATION_SENTIMENT));
export function notificationColorToken(type) {
  return {POSITIVE:'--qd-dot-exchangeNotificationPositiveColor',NEGATIVE:'--qd-dot-exchangeNotificationNegativeColor',NEGATIVE_MARKET_WIDE:'--qd-dot-exchangeNotificationNegativeMarketWideColor',NEUTRAL:'--qd-dot-exchangeNotificationNeutralColor'}[NOTIFICATION_SENTIMENT[type]]??null;
}
