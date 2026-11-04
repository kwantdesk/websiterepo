// Licensed REST contracts checked2026-11-03: /api/docs/field-reference,
// /filter-expression, /pagination and /endpoints/order-flow-{un,}consolidated.
// Pure models only: no fetching, timers, page-row statistics, or price conversion.
const EQ=Object.freeze(['EQUALS','DOES_NOT_EQUAL']);
const CMP=Object.freeze([...EQ,'GREATER_THAN','GREATER_THAN_OR_EQUAL_TO','LESS_THAN','LESS_THAN_OR_EQUAL_TO']);
const descriptor=(key,field,label,type='number',extra={})=>Object.freeze({key,field,label,type,operators:['number','date','datetime'].includes(type)?CMP:EQ,...extra});
const entries=[
  descriptor('ticker','TICKER','Ticker','text'),descriptor('osi','OSI','OSI','text'),
  descriptor('expirationDate','EXPIRATION_DATE','Expiration','date'),descriptor('strikePrice','STRIKE_PRICE','Strike'),
  descriptor('contractType','CONTRACT_TYPE','Contract type','enum',{choices:['CALL','PUT']}),
  descriptor('tradeTime','TRADE_TIME','Trade time','datetime'),descriptor('stockPrice','STOCK_PRICE','Spot'),
  descriptor('size','SIZE','Quantity','number',{integer:true}),descriptor('optionPrice','OPTION_PRICE','Price'),
  descriptor('bidPrice','BID_PRICE','Bid'),descriptor('askPrice','ASK_PRICE','Ask'),descriptor('bidAskSpread','BID_ASK_SPREAD','Bid-Ask spread'),
  descriptor('premium','PREMIUM','Premium'),descriptor('volume','VOLUME','Volume','number',{integer:true}),
  descriptor('openInterest','OPEN_INTEREST','Open interest','number',{integer:true}),descriptor('impliedVolatility','IMPLIED_VOLATILITY','IV'),
  descriptor('dte','DTE','DTE'),descriptor('sector','SECTOR','Sector','enum'),descriptor('industry','INDUSTRY','Industry','enum'),
  descriptor('exchange','EXCHANGE','Exchange','enum'),descriptor('tradeType','TRADE_TYPE','Trade condition','enum'),
  descriptor('tradeSideCode','TRADE_SIDE','Trade side','enum',{choices:['ABOVE_ASK','ASK','MID_MARKET','BID','BELOW_BID']}),
  descriptor('sentimentType','SENTIMENT','Sentiment','enum',{choices:['BULLISH','BEARISH','NEUTRAL']}),
  descriptor('tradeConsolidationType','TRADE_CONSOLIDATION_TYPE','Consolidation','enum',{choices:['BLOCK','SPLIT','SWEEP'],consolidatedOnly:true}),
  descriptor('moneyness.moneyType','MONEY_TYPE','Money type','enum',{choices:['AT_THE_MONEY','IN_THE_MONEY','OUT_OF_THE_MONEY']}),
  descriptor('moneyness.degree','MONEYNESS_IN_DOLLARS','Moneyness ($)'),descriptor('moneyness.degreeInPercent','MONEYNESS_IN_PERCENT','Moneyness (%)'),
  ...['delta','gamma','theta','vega','rho','charm','color','speed','vanna','vomma','veta','omega','sigma','ultima','zomma'].map(key=>descriptor(`greeks.${key}`,key.toUpperCase(),key[0].toUpperCase()+key.slice(1))),
  ...['isETF','isIndex','isOpeningPosition','isUnusual','isVolumeGreaterThanOpenInterest','isCancelled','isComplex','isComplexToComplex','isElectronicCross','isFloor','isLegging','isPriceImprovement','isSimpleToSimple','isTied'].map(key=>descriptor(key,key.replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase(),key,'boolean')),
  descriptor('isGoldenSweep','IS_GOLDEN_SWEEP','Golden sweep','boolean',{consolidatedOnly:true}),
];
export const OPTION_TAPE_FIELDS=Object.freeze(Object.fromEntries(entries.map(value=>[value.key,value])));
const normalized=value=>String(value??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const aliases={DATE:'TRADETIME',TIME:'TRADETIME',QUANTITY:'SIZE',SPOT:'STOCKPRICE',PRICE:'OPTIONPRICE',IV:'IMPLIEDVOLATILITY',OI:'OPENINTEREST',SIDE:'TRADESIDE',TRADESIDECODE:'TRADESIDE',SENTIMENTTYPE:'SENTIMENT',MONEYNESSTYPE:'MONEYTYPE',MONEYNESSDOLLARS:'MONEYNESSINDOLLARS',MONEYNESSPERCENT:'MONEYNESSINPERCENT',EXPIRY:'EXPIRATIONDATE',EXPIRATION:'EXPIRATIONDATE',STRIKE:'STRIKEPRICE'};
export function optionTapeField(key){const value=normalized(key),name=aliases[value]??value;return entries.find(entry=>normalized(entry.key)===name||normalized(entry.field)===name)||null;}
export function optionTapeColumnFields(key){
  const composite={contract:['ticker','expirationDate','strikePrice','contractType'],bidAskSpread:['bidPrice','askPrice','bidAskSpread'],moneyness:['moneyness.moneyType','moneyness.degree','moneyness.degreeInPercent']};
  return composite[key]?composite[key].map(value=>OPTION_TAPE_FIELDS[value]):[optionTapeField(key)].filter(Boolean);
}
const TAPE_TOOLS=new Set(['order-flow-consolidated','order-flow-unconsolidated']);
export const isOptionTapeTool=tool=>TAPE_TOOLS.has(tool);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const present=value=>value!==undefined&&value!==null&&value!=='';
function fieldFor(key,toolId){const field=optionTapeField(key);if(!field||toolId==='order-flow-unconsolidated'&&field.consolidatedOnly||toolId==='order-flow-consolidated'&&field.unconsolidatedOnly)throw Error('Unsupported option tape field.');return field;}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose a valid session date.');const time=Date.parse(value+'T12:00:00Z');if(!Number.isFinite(time)||!new Date(time).toISOString().startsWith(value))throw Error('Choose a valid session date.');return value;}
/** No undocumented second sort key; the response cursor remains opaque. */
export function optionTapeSort(selection,toolId){
  if(selection==null)return {field:'tradeTime',direction:'DESCENDING'};
  if(!object(selection))throw Error('Invalid option tape sort.');
  const field=fieldFor(selection.field??selection.key??selection.id,toolId);
  const direction=selection.direction===1?'ASCENDING':selection.direction===-1?'DESCENDING':selection.direction;
  if(!['ASCENDING','DESCENDING'].includes(direction))throw Error('Choose ascending or descending tape order.');
  return {field:field.field,direction};
}
const operationAliases={'=':'EQUALS','==':'EQUALS',EQ:'EQUALS','!=':'DOES_NOT_EQUAL','<>':'DOES_NOT_EQUAL',NEQ:'DOES_NOT_EQUAL','>':'GREATER_THAN',GT:'GREATER_THAN','>=':'GREATER_THAN_OR_EQUAL_TO',GTE:'GREATER_THAN_OR_EQUAL_TO','<':'LESS_THAN',LT:'LESS_THAN','<=':'LESS_THAN_OR_EQUAL_TO',LTE:'LESS_THAN_OR_EQUAL_TO'};
const operation=value=>operationAliases[String(value).toUpperCase()]??String(value).toUpperCase();
function filterValue(field,value){
  // Source359988's IV factory displays a percent sign but parses20% as20;
  // source886167 does not multiply100. Actual tape IV is percentage points,
  // unlike greeks.sigma. Never apply this percent parsing to other greeks.
  if(field.field==='IMPLIED_VOLATILITY'&&typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*%$/.test(value.trim()))value=value.trim().replace(/\s*%$/,'');
  if(field.type==='number'){if(typeof value!=='number'&&typeof value!=='string'||String(value).trim()===''||!Number.isFinite(Number(value))||field.integer&&!Number.isInteger(Number(value)))throw Error(`Enter a valid ${field.label}.`);return Number(value);}
  if(field.type==='date')return date(value);
  if(field.type==='datetime'){
    const time=typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):typeof value==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
    if(!Number.isSafeInteger(time)||!Number.isFinite(new Date(time).getTime()))throw Error('Enter an explicit timestamp or zoned ISO instant.');return time;
  }
  if(field.type==='boolean'){if(value===true||value===false)return value;if(value==='true'||value==='false')return value==='true';throw Error('Choose true or false.');}
  if(typeof value!=='string'||!value.trim())throw Error(`Enter a valid ${field.label}.`);
  let result=value.trim().toUpperCase().replace(/[\s-]+/g,'_');
  if(field.field==='TICKER'){result=value.trim().toUpperCase();if(!/^[A-Z0-9./^_-]{1,16}$/.test(result))throw Error('Enter one valid ticker.');}
  if(field.field==='TRADE_SIDE')result=({AA:'ABOVE_ASK',A:'ASK',M:'MID_MARKET',MID:'MID_MARKET',B:'BID',BB:'BELOW_BID'})[result]??result;
  if(field.field==='MONEY_TYPE')result=({ATM:'AT_THE_MONEY',ITM:'IN_THE_MONEY',OTM:'OUT_OF_THE_MONEY'})[result]??result;
  if(field.field==='CONTRACT_TYPE')result=({C:'CALL',P:'PUT'})[result]??result;
  if(field.choices&&!field.choices.includes(result))throw Error(`Choose a valid ${field.label}.`);
  return result;
}
/** Each header condition is AND; values in one terminal retain API OR semantics. */
export function optionTapeFilterExpression(filters=[],toolId){
  if(!Array.isArray(filters)||filters.length>100)throw Error('Choose at most100 tape filters.');
  const terminals=[];
  for(const item of filters){
    if(!object(item))throw Error('Invalid option tape filter.');
    if(!present(item.value)||Array.isArray(item.value)&&!item.value.length)continue;
    const field=fieldFor(item.field??item.key??item.id,toolId),op=operation(item.operator??item.operation??'EQUALS');
    if(!field.operators.includes(op))throw Error('Unsupported comparison for this tape field.');
    const values=Array.isArray(item.value)?item.value:typeof item.value==='string'&&item.value.includes(',')?item.value.split(',').map(value=>value.trim()):[item.value];
    terminals.push({field:field.field,operation:op,values:values.map(value=>filterValue(field,value))});
  }
  return terminals.length?{conjunction:'AND',filters:terminals}:null;
}
/** Source stores ISO sessionDateStart/End. Its private backend hour bounds are
 * not shipped. Public equivalent uses whole NY calendar dates, not guessed RTH;
 * same-day selection uses native sessionDate, whose provider bounds stay owned. */
export function optionTapeSessionRange({startDate,endDate}={}){
  if(!present(startDate)&&!present(endDate))return {};
  const start=date(present(startDate)?startDate:endDate),end=date(present(endDate)?endDate:start);
  if(end<start)throw Error('The session range end must not precede its start.');
  if(start===end)return {sessionDate:start};
  const startEpoch=Date.parse(start+'T00:00:00Z'),endEpoch=Date.parse(end+'T00:00:00Z');
  if(endEpoch-startEpoch+86400000>93*86400000)throw Error('Choose a range of at most three months.');
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const midnight=target=>{let value=target;for(let pass=0;pass<5;pass++){const p=Object.fromEntries(formatter.formatToParts(value).map(part=>[part.type,part.value]));const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second),difference=target-shown;value+=difference;if(!difference)return new Date(value).toISOString();}throw Error('Cannot resolve New York session boundary.');};
  return {timeRange:{startTime:midnight(startEpoch),endTime:midnight(endEpoch+86400000)}};
}
/** Do not infer cursor structure from field names or derive it from displayed rows. */
export function optionTapeCursor(payload){
  const value=payload?.nextSearchAfter;if(value===undefined||value===null)return null;
  if(!Array.isArray(value)||value.some(item=>typeof item!=='string'))throw Error('Invalid option tape cursor.');
  return [...value];
}
/** Preserve server page order; real duplicate IDs update in their original slot. */
export function mergeOptionTapeRows(previous=[],incoming=[]){
  if(!Array.isArray(previous)||!Array.isArray(incoming))throw Error('Invalid option tape rows.');
  const rows=[],indices=new Map();
  for(const row of [...previous,...incoming]){if(!object(row))continue;const key=typeof row.id==='string'||typeof row.id==='number'?`${typeof row.id}:${row.id}`:null;if(key!==null&&indices.has(key))rows[indices.get(key)]=row;else{if(key!==null)indices.set(key,rows.length);rows.push(row);}}
  return rows;
}
export function optionTapeRequest(toolId,controls={},baseBody={}){
  if(!isOptionTapeTool(toolId))throw Error('Unsupported option tape.');
  if(!object(baseBody)||!object(controls))throw Error('Invalid option tape request.');
  const body=structuredClone(baseBody);
  body.sort=optionTapeSort(Object.hasOwn(controls,'sort')?controls.sort:body.sort,toolId);
  if(Object.hasOwn(controls,'filters')){const header=optionTapeFilterExpression(controls.filters,toolId);if(header)body.filterExpression=body.filterExpression?{conjunction:'AND',filters:[body.filterExpression,header]}:header;}
  body.includeStatistics=body.searchAfter==null;
  validateOptionTapeRequest(toolId,body);return body;
}
export function validateOptionTapeRequest(toolId,body){
  if(!isOptionTapeTool(toolId))return;
  if(!object(body))throw Error('Invalid option tape request.');
  const allowed=new Set(['sessionDate','timeRange','filter','filterExpression','size','sort','searchAfter','includes','excludes','includeStatistics',...(toolId==='order-flow-consolidated'?['includeComprisingTrades']:[])]);
  if(Object.keys(body).some(key=>!allowed.has(key)))throw Error('Unsupported option tape request field.');
  if(body.sessionDate!==undefined)date(body.sessionDate);
  if(body.timeRange!==undefined){const range=body.timeRange;if(!object(range)||!Number.isFinite(Date.parse(range.startTime))||!Number.isFinite(Date.parse(range.endTime))||Date.parse(range.endTime)<=Date.parse(range.startTime))throw Error('Invalid tape time range.');if(body.sessionDate!==undefined)throw Error('Choose one tape session or time range.');}
  const max=toolId==='order-flow-unconsolidated'?1000:100;
  if(body.size!==undefined&&(!Number.isInteger(body.size)||body.size<1||body.size>max))throw Error(`Tape page size must be between1 and${max}.`);
  for(const flag of ['includeStatistics','includeComprisingTrades'])if(body[flag]!==undefined&&typeof body[flag]!=='boolean')throw Error('Tape inclusion flags must be boolean.');
  if(body.sort!==undefined)optionTapeSort(body.sort,toolId);
  if(body.searchAfter!==undefined)optionTapeCursor({nextSearchAfter:body.searchAfter});
  if(body.includes!==undefined&&body.excludes!==undefined)throw Error('Choose one tape projection.');
  for(const key of ['includes','excludes'])if(body[key]!==undefined&&(!Array.isArray(body[key])||body[key].some(field=>typeof field!=='string')))throw Error('Invalid tape projection.');
  if(body.filter!==undefined&&!object(body.filter))throw Error('Invalid tape filter.');
  // Reject consolidated-only names in raw convenience filters and DSL, rather
  // than silently returning a different query than the user's chosen scope.
  const inspect=value=>{if(!object(value)&&!Array.isArray(value))return;for(const [key,child] of Object.entries(value)){const name=normalized(key==='field'?child:key);if(toolId==='order-flow-unconsolidated'&&['TRADECONSOLIDATIONTYPE','TRADECONSOLIDATIONTYPES','CONSOLIDATIONTYPE','ISGOLDENSWEEP'].includes(name))throw Error('Consolidated-only fields are unavailable for raw option prints.');if(child&&typeof child==='object')inspect(child);}};inspect(body.filter);inspect(body.filterExpression);
  let terminals=0;const expression=(node,depth=0)=>{if(!object(node)||depth>5)throw Error('Invalid tape filter expression depth.');if(Object.hasOwn(node,'filters')){if(!['AND','OR'].includes(node.conjunction)||!Array.isArray(node.filters)||!node.filters.length||['field','operation','value','values'].some(key=>Object.hasOwn(node,key)))throw Error('Invalid tape compound filter.');node.filters.forEach(child=>expression(child,depth+1));}else{const field=fieldFor(node.field,toolId),op=operation(node.operation),values=node.values??node.value;if(Object.hasOwn(node,'conjunction')||!field.operators.includes(op)||!present(values)||Array.isArray(values)&&!values.length||++terminals>100)throw Error('Invalid tape terminal filter.');for(const value of Array.isArray(values)?values:[values])filterValue(field,value);}};
  if(body.filterExpression!==undefined)expression(body.filterExpression);
}
