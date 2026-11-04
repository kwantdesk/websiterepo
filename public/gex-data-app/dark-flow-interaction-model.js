import {abbreviate,currencyAbbreviated,currencyAuto} from './number-format.js?v=2';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const observed=value=>finite(value)?value:null;

/** Source413224.N: sorted buckets, last observed nonzero spot carried forward.
 * Leading buckets without an underlying observation are source-defined omissions;
 * neither the input history nor its trade fields are modified or synthesized.
 * Public REST money fields already use dollars, unlike private tuple cents.
 */
export function darkFlowRows(data={}){
  let spot=null;
  return Object.entries(data).map(([time,row])=>({time:Number(time),row}))
    .filter(entry=>finite(entry.time)&&Number.isFinite(new Date(entry.time).getTime())&&entry.row&&typeof entry.row==='object')
    .sort((a,b)=>a.time-b.time).flatMap(({time,row})=>{
      if(finite(row.stockPrice)&&row.stockPrice>0)spot=row.stockPrice;
      if(spot===null)return [];
      return [{time,spot,notional:observed(row.notionalValue),size:observed(row.size),tradeCount:observed(row.tradeCount)}];
    });
}

export function darkFlowTotals(rows){
  return Object.fromEntries(['notional','size','tradeCount'].map(key=>{
    const values=rows.map(row=>row[key]).filter(finite);
    return [key,values.length?values.reduce((sum,value)=>sum+value,0):null];
  }));
}

/** Source578271: first loaded processed spot, independent of visible zoom. */
export function darkFlowTooltipModel(rows,row,{timeZone='America/New_York'}={}){
  if(!row||!finite(row.time)||!Number.isFinite(new Date(row.time).getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(row.time).map(part=>[part.type,part.value]));
  const date=new Intl.DateTimeFormat('en-US',{timeZone,month:'long',day:'numeric',year:'numeric'}).format(row.time);
  const first=rows[0]?.spot,change=finite(first)&&first!==0&&finite(row.spot)?(row.spot-first)/Math.abs(first)*100:null;
  const percent=change===null?null:(Math.round((change+Number.EPSILON)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  return {timeLabel:`${parts.hour}:${parts.minute} ${parts.dayPeriod} on ${date}`,
    size:abbreviate(row.size,2),tradeCount:abbreviate(row.tradeCount,2),notional:currencyAbbreviated(row.notional,2),
    spot:finite(row.spot)&&row.spot!==0?{value:currencyAuto(row.spot),change:percent,direction:change===null||change===0?'flat':change>0?'up':'down'}:null};
}

export function darkFlowTooltipRows(rows,row,options){
  const model=darkFlowTooltipModel(rows,row,options);if(!model)return [];
  const arrow=model.spot?.direction==='up'?'↑ ':model.spot?.direction==='down'?'↓ ':'';
  return [model.timeLabel,`Total Size: ${model.size}`,`Total Trade Count: ${model.tradeCount}`,`Total Notional Value: ${model.notional}`,
    ...(model.spot?[`Underlying Price: ${model.spot.value}${model.spot.change===null?'':` (${arrow}${model.spot.change})`}`]:[])];
}
