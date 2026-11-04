import {EXCHANGE_GROUP_MEMBERS,exchangeLabel,marketShareValue} from './options-models.js?v=2';
import {abbreviate,currencyAbbreviated} from './number-format.js?v=2';

// Source727319 +264831, fresh main SHA256 e341548c609dc0fbc393cef000ae6fbe84dd565dcea04322b947965dd3c68fec.
// Public response amounts are already dollars. The source's private cents
// schema is not a reason to rescale these public observations.
export function marketShareFormatValue(value,mode='EQUITY_VOLUME'){
 return mode.endsWith('PREMIUM')?currencyAbbreviated(value,2):abbreviate(value,mode.endsWith('TRADE_COUNT')?0:2);
}
export function marketShareTooltipModel(entry,model){
 if(!entry||!model)return [];
 const rows=model.view==='EXCHANGE_GROUP'?(EXCHANGE_GROUP_MEMBERS[entry.group]||[]).map(exchange=>({exchange,row:entry.members?.find(member=>member.exchange===exchange)?.row??{}})):[{exchange:entry.exchange,row:entry.row??{}}];
 return rows.map(({exchange,row})=>{const value=marketShareValue(row,model.mode),fraction=model.total===0?0:value/model.total;return {exchange,name:exchangeLabel(exchange),value,fraction,valueLabel:marketShareFormatValue(value,model.mode),percentageLabel:(fraction*100).toFixed(2)+'%'};});
}
export function marketShareTooltipRows(entry,model){
 // Source264831 renders member rows without an aggregate/group heading.
 return marketShareTooltipModel(entry,model).map(row=>`${row.name}: ${row.valueLabel} (${row.percentageLabel})`);
}
