import {abbreviate,currencyAbbreviated,currencyAuto} from './number-format.js?v=2';
import {OPTION_TRADE_DETAIL_ENDPOINT,optionTradeDetailRequest} from './option-trade-detail-model.js?v=1';

export const NET_FLOW_DETAIL_ENDPOINT=OPTION_TRADE_DETAIL_ENDPOINT;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const total=(rows,key)=>{const values=rows.map(row=>row[key]).filter(finite);return values.length?values.reduce((sum,value)=>sum+value,0):null;};
const percentage=value=>finite(value)?(Math.round((value+Number.EPSILON)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'—';

function clock(time,timeZone){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(time).map(part=>[part.type,part.value]));
  const date=new Intl.DateTimeFormat('en-US',{timeZone,month:'long',day:'numeric',year:'numeric'}).format(time);
  return `${parts.hour}:${parts.minute} ${parts.dayPeriod} on ${date}`;
}

/** Source 504818 / hook 873489: rows are already public dollars/contracts. */
export function netFlowTooltipModel(rows,row,{mode='NET_PREMIUM',timeZone='America/New_York'}={}){
  if(!row||!finite(row.time)||!Number.isFinite(new Date(row.time).getTime()))return null;
  if(!Array.isArray(rows))throw Error('Choose actual Net Flow observations.');
  if(!['NET_PREMIUM','PREMIUM','NET_VOLUME','VOLUME'].includes(mode))throw Error('Choose a valid Net Flow metric.');
  const premium=mode==='NET_PREMIUM'||mode==='PREMIUM',metric=premium?'Premium':'Volume',format=value=>finite(value)?premium?currencyAbbreviated(value,1):abbreviate(value,2):'—';
  const leg=(key,label)=>{
    const denominator=total(rows,key),value=row[key],share=finite(value)&&denominator!==null?(denominator===0?0:value/denominator*100):null;
    return {label:`${label} ${metric}`,value:format(value),share:share===null?'—':percentage(share)+' of total'};
  };
  // The source uses the FIRST row's spot, not a future/first-valid replacement.
  const first=rows[0]?.spot,current=row.spot,change=finite(first)&&first!==0&&finite(current)?(current-first)/Math.abs(first)*100:null;
  const spot=finite(current)&&current!==0?{label:'Stock Price',value:currencyAuto(current),change:percentage(change),direction:change===null||change===0?'flat':change>0?'up':'down'}:null;
  return {timeLabel:clock(row.time,timeZone),call:leg('call','Call'),put:leg('put','Put'),spot,hint:'Click for more information'};
}

export function netFlowTooltipRows(rows,row,options){
  const model=netFlowTooltipModel(rows,row,options);if(!model)return [];
  return [model.timeLabel,`${model.call.label}: ${model.call.value} (${model.call.share})`,`${model.put.label}: ${model.put.value} (${model.put.share})`,
    ...(model.spot?[`${model.spot.label}: ${model.spot.value}${model.spot.change==='—'?'':` (${model.spot.change})`}`]:[]),model.hint];
}

/** One actual minute, start inclusive / end exclusive; never the next row. */
export function netFlowMinuteDetailRequest({base={},row,timestamp=row?.time,cursor}={}){
  if(!finite(timestamp)||!Number.isSafeInteger(timestamp)||!Number.isFinite(new Date(timestamp).getTime())||!Number.isFinite(new Date(timestamp+60000).getTime()))throw Error('Choose a valid Net Flow minute.');
  let start=timestamp,end=timestamp+60000;
  if(base.timeRange!==undefined){
    const lower=Date.parse(String(base.timeRange?.startTime)),upper=Date.parse(String(base.timeRange?.endTime));
    if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper<=lower)throw Error('Choose a valid active Net Flow time range.');
    start=Math.max(start,lower);end=Math.min(end,upper);
    if(end<=start)throw Error('The selected minute does not overlap the active Net Flow time range.');
  }
  // Reuse the existing raw-print request allowlist and consolidated-only filter
  // rejection. Session, Net Flow metric/aggregation and other tool extras cannot
  // leak into the individual-print body. The server still validates this body.
  const request=optionTradeDetailRequest({base,timeRange:{startTime:new Date(start).toISOString(),endTime:new Date(end).toISOString()},cursor,size:100});
  request.sort={field:'TRADE_TIME',direction:'DESCENDING'};
  return request;
}
