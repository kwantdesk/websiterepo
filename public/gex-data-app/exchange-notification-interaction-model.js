// Public Exchange Notifications contract. Private source-createdTime fields
// map directly to the documented CREATED_TIME/TICKER/TYPE sort vocabulary.
import {normalizeAPIExpression} from './preferences-model.js?v=1';
import {NOTIFICATION_TYPES} from './equity-renderers.js?v=3';
const fields=[
  {key:'createdTime',field:'CREATED_TIME',sortField:'CREATED_TIME',label:'Time',type:'datetime'},
  {key:'ticker',field:'TICKER',sortField:'TICKER',label:'Ticker',type:'text',operators:['EQUALS','DOES_NOT_EQUAL']},
  {key:'type',field:'TYPE',sortField:'TYPE',label:'Type',type:'enum',choices:[...NOTIFICATION_TYPES].sort(),rawChoiceLabels:true,operators:['EQUALS','DOES_NOT_EQUAL'],operatorLabels:{EQUALS:'is',DOES_NOT_EQUAL:'is not'}},
];
const canonical=value=>String(value??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
export function validateNotificationRequest(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid notification request.');
  if(body.sessionDate&&body.timeRange)throw Error('Choose one notification time selector.');
  if(body.size!==undefined&&(!Number.isInteger(body.size)||body.size<1||body.size>100))throw Error('Notification page size must be between1 and100.');
  if(body.sort!==undefined){const sort=body.sort;if(!sort||typeof sort!=='object'||Array.isArray(sort)||Object.keys(sort).some(key=>!['field','direction'].includes(key))||typeof sort.field!=='string')throw Error('Choose a supported Exchange Notifications sort.');notificationSort(sort);}
}
export function notificationField(value){const key=canonical(value);return fields.find(field=>canonical(field.key)===key||canonical(field.field)===key)??null;}
export function notificationColumnFields(key){return (key==='date'||key==='time'?[fields[0]]:[notificationField(key)]).filter(Boolean);}
export function notificationSort(value){
  if(value==null)return {field:'CREATED_TIME',direction:'DESCENDING'};
  const field=notificationField(value.field??value.key),direction=value.direction===1?'ASCENDING':value.direction===-1?'DESCENDING':value.direction;
  if(!field||!['ASCENDING','DESCENDING'].includes(direction))throw Error('Choose a supported Exchange Notifications sort.');
  return {field:field.sortField,direction};
}
export function notificationFilterExpression(filters=[]){
  if(!Array.isArray(filters)||filters.length>100)throw Error('Choose at most100 notification filters.');
  const terminals=[];
  for(const condition of filters){
    const field=notificationField(condition?.field??condition?.key),operation=condition?.operator??condition?.operation;
    if(!field?.operators?.includes(operation))throw Error('Unsupported notification column filter.');
    const input=condition.value;if(input===''||input==null||Array.isArray(input)&&!input.length)continue;
    const values=(Array.isArray(input)?input:typeof input==='string'?input.split(','):[input]).map(value=>{
      if(typeof value!=='string'||!value.trim())throw Error('Enter a valid '+field.label+'.');
      const result=value.trim().toUpperCase();
      if(field.key==='ticker'?!/^[A-Z0-9./^_-]{1,16}$/.test(result):!field.choices.includes(result))throw Error('Enter a valid '+field.label+'.');
      return result;
    });
    // Public terminal values are OR alternatives. Excluding several codes
    // therefore requires ANDed scalar inequalities, never ORed NOT_EQUALS.
    if(operation==='DOES_NOT_EQUAL')for(const value of values)terminals.push({field:field.field,operation,values:[value]});
    else terminals.push({field:field.field,operation,values});
  }
  return terminals.length?normalizeAPIExpression({conjunction:'AND',filters:terminals}):null;
}
export function notificationCursor(payload){
  const cursor=payload?.nextSearchAfter;if(cursor==null)return null;
  if(!Array.isArray(cursor))throw Error('Invalid notification cursor.');return structuredClone(cursor);
}
export function notificationRequest(body,{sort,filters=[],preserveTickerFilter=false}={}){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid notification request.');
  const result=structuredClone(body);result.sort=notificationSort(sort);result.size=100;
  if(result.sessionDate&&result.timeRange)throw Error('Choose one notification time selector.');
  const header=notificationFilterExpression(filters);
  for(const condition of filters)if(condition.operator==='DOES_NOT_EQUAL'){
    const key=notificationField(condition.field??condition.key)?.key;if(key==='type'&&result.filter)delete result.filter.types;
    if(key==='ticker'&&!preserveTickerFilter&&result.filter){delete result.filter.tickers;delete result.filter.ticker;}
  }
  if(header)result.filterExpression=normalizeAPIExpression(result.filterExpression?{conjunction:'AND',filters:[result.filterExpression,header]}:header);
  validateNotificationRequest(result);return result;
}
