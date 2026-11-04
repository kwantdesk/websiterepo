import {abbreviate,currencyAuto} from './number-format.js?v=2';
import {timeAtIndex} from './time-axis.js?v=1';

// Fresh source533485 tooltip /391849 renderer, main asset SHA256
// e341548c609dc0fbc393cef000ae6fbe84dd565dcea04322b947965dd3c68fec.
// Public API values here are already dollars; no internal-cent rescaling.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const codes=Object.freeze({GAMMA:'GEX',DELTA:'DEX',CHARM:'CHEX',VANNA:'VEX'});
function timeOnDate(time,timeZone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(time).map(part=>[part.type,part.value]));
 const date=new Intl.DateTimeFormat('en-US',{timeZone,month:'long',day:'numeric',year:'numeric'}).format(time);
 return `${parts.hour}:${parts.minute} ${parts.dayPeriod} on ${date}`;
}
export function intervalMapTooltipRows(row,point,{ticker='',greek='GAMMA',mode='VALUE',timeZone='America/New_York'}={}){
 if(!row||!point||!finite(row.time)||!Number.isFinite(new Date(row.time).getTime())||!finite(point.strike))return [];
 if(!codes[greek]||!['VALUE','DIFFERENCE'].includes(mode))throw Error('Choose valid Interval Map controls.');
 const code=codes[greek],value=number=>finite(number)?abbreviate(number,2):'—';
 return [timeOnDate(row.time,timeZone),`${ticker} ${currencyAuto(point.strike)}`,
  ...(mode==='VALUE'?[`Call ${code}: ${value(point.call)}`,`Put ${code}: ${value(point.put)}`]:[]),
  `${mode==='DIFFERENCE'?'Difference of ':''}Net ${code}: ${value(point.value)}`];
}
function nearestIndex(values,target,value=row=>row){
 let low=0,high=values.length-1;while(low<high){const middle=(low+high)>>1;if(value(values[middle])<target)low=middle+1;else high=middle;}
 // Source A uses strict <, so an equidistant pair selects the later/higher.
 return low>0&&Math.abs(value(values[low-1])-target)<Math.abs(value(values[low])-target)?low-1:low;
}
export function createIntervalMapTooltipSelection(rows){
 const series=new Map();
 for(const row of rows||[]){if(!finite(row?.time))continue;for(const point of row.strikes||[]){if(!finite(point?.strike))continue;if(!series.has(point.strike))series.set(point.strike,[]);series.get(point.strike).push({row,point});}}
 const strikes=[...series.keys()].sort((a,b)=>a-b);for(const values of series.values())values.sort((a,b)=>a.row.time-b.row.time);
 return (time,strike)=>{if(!strikes.length||!finite(time)||!finite(strike))return null;const selected=strikes[nearestIndex(strikes,strike)],values=series.get(selected);return values[nearestIndex(values,time,value=>value.row.time)];};
}
export function intervalMapTimeDomain(rows,start=0,end=rows.length-1){
 if(!rows.length)return null;const firstTime=timeAtIndex(rows,start),lastTime=timeAtIndex(rows,end);if(!finite(firstTime)||!finite(lastTime))return null;
 const padding=Math.max((lastTime-firstTime)*.01,30000);
 return {firstTime,lastTime,padding,min:firstTime-padding,max:lastTime+padding};
}
export function intervalMapPlotInsets(width,height,strikeLabels,{axisFont=13,hideAxisTitles=false,measureText=label=>String(label).length*axisFont*.6}={}){
 const maximum=strikeLabels.reduce((value,label)=>Math.max(value,measureText(label)),0);
 return {left:Math.ceil(maximum)+16+(hideAxisTitles?0:22),right:width-16,top:8,bottom:height-20};
}
