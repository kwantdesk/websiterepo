import {abbreviate,currencyAbbreviated} from './number-format.js?v=2';

/** Source795251/674634: only Side Statistics trade counts use precision zero.
 * Ordinary Contract Statistics uses two places for both volume and trade count.
 * Public premium is dollars; the private formatter's cents conversion is not
 * applied to REST values again.
 */
export function contractStatisticsValue(value,{money=false,sideMode}={}){
  return money?currencyAbbreviated(value,2):abbreviate(value,sideMode==='TRADE_COUNT'?0:2);
}

export function contractStatisticsPercentage(value){
  if(typeof value!=='number'||!Number.isFinite(value))return '—';
  return (Math.round((value*100+Number.EPSILON)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
}

/** Source20298: category header, Put/Call left and colored values right.
 * Source empty bars occupy two neutral halves, but their actual percentages
 * remain zero. Never infer50% from that visual placeholder geometry.
 */
export function contractStatisticsTooltipRows(row,{sideMode}={}){
  if(!row)return [];
  const value=key=>{
    const fraction=row.total===0?0:row[key]/row.total;
    return {parts:[{text:`${contractStatisticsValue(row[key],{money:row.money,sideMode})} (${contractStatisticsPercentage(fraction)})`,tone:key==='put'?'bearish':'bullish'}]};
  };
  return [row.label,{columns:[['Put:','Call:'],[value('put'),value('call')]],columnAlignments:['left','right']}];
}
