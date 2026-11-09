import {parsePriceRows} from './equity-renderers.js';
import {abbreviate,currencyAuto} from './number-format.js?v=2';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const NEW_YORK=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',hour:'2-digit',minute:'2-digit'});

/** Source107856: inclusive first >=09:30 / last <=16:15 exchange-local slice.
 * Source falls back to all observations when those bounds cannot form a slice.
 */
export function stockPriceSessionRows(rows){
  if(!rows.length)return [];
  const minute=row=>{const parts=Object.fromEntries(NEW_YORK.formatToParts(row.time).map(part=>[part.type,part.value]));return Number(parts.hour)*60+Number(parts.minute);};
  let start=rows.findIndex(row=>minute(row)>=570),end=rows.findLastIndex(row=>minute(row)<=975);
  if(start<0)start=0;if(end<0)end=rows.length-1;
  return end>=start?rows.slice(start,end+1):rows.slice();
}

/** Source150382.b/255168._: carry explicit zero open/close sentinels only.
 * Public nulls remain null; no high/low/wick is ever generated or altered.
 * Independent REST stock candles cannot prove private contract-associated
 * spot equivalence. Keep genuine contract observations if that join is absent.
 */
export function priceChartRows(payload,{option=false}={}){
  const rawRows=parsePriceRows(payload,{data:payload.stock||{}}),processed=[];
  let previousOpen=null,previousClose=null,previousSpot=null,started=false;
  for(const raw of rawRows){
    const row={...raw};
    for(const key of ['open','close']){
      const previous=key==='open'?previousOpen:previousClose;
      if(row[key]===0)row[key]=previous;
      if(finite(row[key])&&row[key]!==0){if(key==='open')previousOpen=row[key];else previousClose=row[key];}
    }
    if(option){if(row.spot===0)row.spot=previousSpot;if(finite(row.spot)&&row.spot!==0)previousSpot=row.spot;}
    if(!started){if(!finite(row.open)||row.open===0||!finite(row.close)||row.close===0)continue;started=true;}
    processed.push(row);
  }
  return {rawRows,processedRows:processed,rows:option?processed:stockPriceSessionRows(processed)};
}

export function priceContractSelection({ticker,osi='',expirationDate,strikePrice,contractType}={}){
  const match=String(osi).replaceAll(' ','').toUpperCase().match(/^([A-Z.]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  return match?{ticker:match[1],expirationDate:`20${match[2]}-${match[3]}-${match[4]}`,strikePrice:Number(match[6])/1000,contractType:match[5]==='C'?'CALL':'PUT'}:{ticker,expirationDate,strikePrice,contractType};
}

/** Current Stock tooltip includes the hovered exchange instant in the display timezone. */
export function priceChartTooltipRows(row,{option=false,ticker,expirationDate,strikePrice,contractType,timeZone='America/New_York'}={}){
  if(!row)return [];
  const tone=finite(row.open)&&finite(row.close)?row.close>row.open?'bullish':row.close<row.open?'bearish':null:null;
  const metric=(label,value,color)=>({parts:[{text:label+': '},{text:currencyAuto(value),tone:color}]});
  const rows=[String(ticker||'')];
  if(!option&&finite(row.time)){
    const date=new Date(row.time);
    if(Number.isFinite(date.getTime()))rows.push(date.toLocaleTimeString('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}),date.toLocaleDateString('en-US',{timeZone,month:'short',day:'numeric',year:'numeric'}));
  }
  if(option){
    const date=typeof expirationDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)?new Date(expirationDate+'T12:00:00Z'):null;
    const label=date&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===expirationDate?date.toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}):'—';
    rows.push(`${label} ${currencyAuto(strikePrice)} ${contractType==='CALL'?'Call':contractType==='PUT'?'Put':'—'}`);
  }
  rows.push({separator:true},{columns:[
    [metric('Open',row.open,tone),metric('Close',row.close,tone)],
    [metric('Low',row.low,finite(row.low)&&finite(row.open)&&row.low<row.open?'bearish':tone),metric('High',row.high,finite(row.high)&&finite(row.open)&&row.high>row.open?'bullish':tone)],
  ]});
  if(option)rows.push({separator:true},{columns:[[ `Underlying: ${currencyAuto(row.spot)}`,`Option Volume: ${abbreviate(row.volume,2)}` ]]});
  return rows;
}
