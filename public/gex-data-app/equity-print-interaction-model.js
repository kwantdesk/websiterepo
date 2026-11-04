// Licensed public Equity Prints contract; source20731 supplies header grouping.
// Public prices are dollars. Source-private *InCents fields are never sent.
import {normalizeAPIExpression} from './preferences-model.js?v=1';
const EQ=['EQUALS','DOES_NOT_EQUAL'],CMP=[...EQ,'GREATER_THAN','GREATER_THAN_OR_EQUAL_TO','LESS_THAN','LESS_THAN_OR_EQUAL_TO'];
const field=(key,api,label,type='number',extra={})=>({key,field:api,sortField:api,label,type,operators:type==='number'||type==='datetime'?CMP:EQ,...extra});
const fields=[field('tradeTime','TRADE_TIME','Time','datetime'),field('ticker','TICKER','Ticker','text'),field('printType','PRINT_TYPE','Type','enum',{choices:['DARK_POOL','LIT_POOL']}),field('size','SIZE','Quantity','number',{integer:true}),field('price','PRICE','Price'),field('notionalValue','NOTIONAL_VALUE','Notional'),field('tradeSide','TRADE_SIDE','Trade side','enum',{choices:['ABOVE_ASK','ASK','MID_MARKET','BID','BELOW_BID']}),field('bidPrice','BID_PRICE','Bid price'),field('askPrice','ASK_PRICE','Ask price'),field('bidSize','BID_SIZE','Bid size','number',{integer:true}),field('askSize','ASK_SIZE','Ask size','number',{integer:true}),field('isDelayedPrint','IS_DELAYED_PRINT','Phantom Prints','boolean')];
const normalized=value=>String(value??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
export function equityPrintField(value){const key=normalized(value);return fields.find(field=>normalized(field.key)===key||normalized(field.field)===key)??null;}
export function equityPrintColumnFields(key){const keys={date:['tradeTime'],tradeTime:['tradeTime'],time:['tradeTime'],ticker:['ticker','printType'],size:['size'],price:['price','tradeSide'],notionalValue:['notionalValue'],bidAsk:['bidPrice','askPrice']};return (keys[key]??[]).map(equityPrintField);}
export function equityPrintSort(value){
  if(value==null)return {field:'TRADE_TIME',direction:'DESCENDING'};
  const field=equityPrintField(value.field??value.key),direction=value.direction===1?'ASCENDING':value.direction===-1?'DESCENDING':value.direction;
  if(!field||!['ASCENDING','DESCENDING'].includes(direction))throw Error('Choose a supported Equity Prints sort.');
  return {field:field.sortField,direction};
}
export function equityPrintCursor(payload){const cursor=payload?.nextSearchAfter;if(cursor==null)return null;if(!Array.isArray(cursor))throw Error('Invalid equity cursor.');return structuredClone(cursor);}
export function equityPrintFilterExpression(filters=[]){
  if(!Array.isArray(filters)||filters.length>100)throw Error('Choose at most100 equity filters.');
  const terminals=[];
  for(const condition of filters){
    const field=equityPrintField(condition?.field??condition?.key),operation=condition?.operator??condition?.operation;
    if(!field||!field.operators.includes(operation))throw Error('Unsupported Equity Prints filter.');
    const input=condition.value;if(input===''||input==null||Array.isArray(input)&&!input.length)continue;
    const values=(Array.isArray(input)?input:typeof input==='string'&&input.includes(',')?input.split(','):[input]).map(value=>{
      if(field.type==='number'){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||field.integer&&!Number.isInteger(Number(value)))throw Error('Enter a valid '+field.label+'.');return Number(value);}
      if(field.type==='boolean'){if(value===true||value===false)return value;if(value==='true'||value==='false')return value==='true';throw Error('Choose true or false.');}
      if(field.type==='datetime'){const time=typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):typeof value==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;if(!Number.isSafeInteger(time))throw Error('Choose a zoned timestamp.');return time;}
      if(typeof value!=='string'||!value.trim())throw Error('Enter a valid '+field.label+'.');
      let result=value.trim().toUpperCase();if(field.key==='tradeSide')result=({AA:'ABOVE_ASK',A:'ASK',M:'MID_MARKET',B:'BID',BB:'BELOW_BID'})[result]??result;
      if(field.choices&&!field.choices.includes(result)||field.key==='ticker'&&!/^[A-Z0-9./^_-]{1,16}$/.test(result))throw Error('Enter a valid '+field.label+'.');return result;
    });
    terminals.push({field:field.field,operation,values});
  }
  return terminals.length?normalizeAPIExpression({conjunction:'AND',filters:terminals}):null;
}
export function equityPrintRequest(body,{sort,filters=[]}={}){
  const result=structuredClone(body);result.sort=equityPrintSort(sort);result.size=100;
  const header=equityPrintFilterExpression(filters);if(header)result.filterExpression=normalizeAPIExpression(result.filterExpression?{conjunction:'AND',filters:[result.filterExpression,header]}:header);
  if(result.sessionDate&&result.timeRange)throw Error('Choose one Equity Prints time selector.');
  delete result.includeStatistics;delete result.includeComprisingTrades;
  return result;
}
