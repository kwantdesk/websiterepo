// Endpoint contracts verified 2026-11-03 against quantdata.us/api/docs/endpoints/.
// These pure request builders neither fetch nor infer market observations.
import {isOptionTapeTool,validateOptionTapeRequest} from './option-tape-interaction-model.js';
import {validateNotificationRequest} from './exchange-notification-interaction-model.js?v=20261104';
const TOP_FIELDS = Object.freeze({
  'net-flow': ['sessionDate','timeRange','aggregationPeriod','dataMode','filter','filterExpression'],
  'volatility-skew': ['sessionDate','snapshotTime','filter'],
  'volatility-drift': ['sessionDate','filter'],
  'term-structure': ['sessionDate','snapshotTime','filter'],
  'open-interest-by-strike': ['sessionDate','filter'],
  'open-interest-by-expiration': ['sessionDate','filter'],
  'open-interest-over-time': ['filter'],
  'open-interest-change': ['sessionDate','filter','filterExpression','size','sort','searchAfter','includes','excludes'],
});
const SINGLE_TICKER = new Set(['volatility-skew','volatility-drift','term-structure','open-interest-by-strike','open-interest-by-expiration','open-interest-over-time']);
const FILTER_FIELDS = Object.freeze({
  'volatility-skew': ['ticker','contractTypes','expirationDate','expirationDates','expirationDateRange'],
  'volatility-drift': ['ticker','expirationDate'],
  'term-structure': ['ticker','expirationDates','expirationDateRange','strikePrices','strikePriceRange','moneyTypes','deltaRange'],
  'open-interest-by-strike': ['ticker','expirationDate'],
  'open-interest-by-expiration': ['ticker','strikePrice'],
  'open-interest-over-time': ['ticker','expirationDate','strikePrice'],
});
const present = value => value !== undefined && value !== null && value !== '';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const select = (value,keys) => Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,structuredClone(value[key])]));
const values = value => (Array.isArray(value)?value:String(value).split(',')).map(item=>String(item).trim()).filter(Boolean);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_ALIASES = {ATM:'AT_THE_MONEY',ITM:'IN_THE_MONEY',OTM:'OUT_OF_THE_MONEY',AT_THE_MONEY:'AT_THE_MONEY',IN_THE_MONEY:'IN_THE_MONEY',OUT_OF_THE_MONEY:'OUT_OF_THE_MONEY'};
const OI_CHANGE_SORT_FIELDS = new Set(['CHANGEINOPENINTEREST','CONTRACTTYPE','CREATEDTIME','CURRENTOPENINTEREST','EXPIRATIONDATE','ID','PERCENTCHANGEINOPENINTEREST','PREVIOUSOPENINTEREST','SESSIONDATE','STRIKEPRICE','TICKER']);
function date(value,label){
  if(typeof value!=='string'||!DATE.test(value))throw Error(`Invalid ${label}.`);
  const parsed=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(parsed.getTime())||!parsed.toISOString().startsWith(value))throw Error(`Invalid ${label}.`);
  return value;
}
function positive(value,label){
  if(!present(value)||!Number.isFinite(Number(value))||Number(value)<=0)throw Error(`${label} must be positive.`);
  return Number(value);
}
function tickerFrom(filter,controls){
  const candidates=present(filter.ticker)?values(filter.ticker):present(filter.tickers)?values(filter.tickers):values(controls.ticker||controls.tickerOptional||'');
  if(candidates.length!==1||!/^[A-Z0-9./^_-]{1,16}$/i.test(candidates[0]))throw Error('Select one instrument for this tool.');
  return candidates[0].toUpperCase();
}
function expiryFrom(filter,controls){
  // The shared caller has already resolved page/global overrides. Do not let
  // a saved leaf control replace that canonical selection at the last step.
  const input=filter.expirationDate??filter.expirationDates??controls.expiry;
  if(!present(input))return undefined;
  const selected=values(input);if(selected.length!==1)throw Error('Select one expiration for this tool.');
  return date(selected[0],'expiration');
}
function rangeDates(filter,controls){
  if(!present(controls.expiryStart)&&!present(controls.expiryEnd))return;
  const startDate=date(controls.expiryStart,'expiration range start'),endDate=date(controls.expiryEnd,'expiration range end');
  if(startDate>endDate)throw Error('The expiration range end must follow its start.');
  delete filter.expirationDate;delete filter.expirationDates;
  filter.expirationDateRange={startDate,endDate};
}

/** Build the documented wire body; UI-only delta magnitudes and chart style stay local. */
export function additionalToolRequest(toolId,controls={},baseBody={}){
  if(isOptionTapeTool(toolId)){validateOptionTapeRequest(toolId,baseBody);return baseBody;}
  if(toolId==='iv-rank'){validateAdditionalToolRequest(toolId,baseBody);return baseBody;}
  if(!Object.hasOwn(TOP_FIELDS,toolId))return baseBody;
  if(!object(baseBody)||!object(controls))throw Error('Invalid tool request.');
  const original=baseBody.filter??{};if(!object(original))throw Error('Invalid tool filter.');
  if(baseBody.filterExpression&&!TOP_FIELDS[toolId].includes('filterExpression'))throw Error('This tool does not support filter groups.');
  const body=select(baseBody,TOP_FIELDS[toolId]),filter=SINGLE_TICKER.has(toolId)?select(original,FILTER_FIELDS[toolId]):structuredClone(original);
  body.filter=filter;
  if(SINGLE_TICKER.has(toolId))filter.ticker=tickerFrom(original,controls);
  if(toolId==='net-flow'){
    body.dataMode=String(controls.flowMetric||body.dataMode||'NET_PREMIUM');
    if(present(controls.period))body.aggregationPeriod=controls.period;
  }
  if(['volatility-skew','term-structure'].includes(toolId))rangeDates(filter,controls);
  if(toolId==='volatility-skew'&&Object.hasOwn(controls,'contractTypeOptional')){
    delete filter.contractTypes;if(present(controls.contractTypeOptional))filter.contractTypes=values(controls.contractTypeOptional);
  }
  if(['volatility-drift','open-interest-by-strike','open-interest-over-time'].includes(toolId)){
    delete filter.expirationDate;const expiry=expiryFrom(original,controls);if(expiry)filter.expirationDate=expiry;
  }
  if(['open-interest-by-expiration','open-interest-over-time'].includes(toolId)){
    const strike=present(controls.strike)?controls.strike:original.strikePrice??original.strikePrices;
    delete filter.strikePrice;if(present(strike)){
      const selected=values(strike);if(selected.length!==1)throw Error('Select one strike for this tool.');
      filter.strikePrice=positive(selected[0],'Strike');
    }
  }
  if(toolId==='term-structure'){
    if(present(controls.moneyType)){
      filter.moneyTypes=values(controls.moneyType).map(value=>{const key=MONEY_ALIASES[value.toUpperCase()];if(!key)throw Error('Invalid moneyness.');return key;});
    }else if(Object.hasOwn(controls,'moneyType'))delete filter.moneyTypes;
    if(present(controls.minStrike)||present(controls.maxStrike)){
      const min=present(controls.minStrike)?positive(controls.minStrike,'Minimum strike'):null,max=present(controls.maxStrike)?positive(controls.maxStrike,'Maximum strike'):null;
      if(min!==null&&max!==null&&min>max)throw Error('Minimum strike must not exceed maximum strike.');
      delete filter.strikePrices;filter.strikePriceRange={min,max};
    }
    // Reference controls select magnitudes for BOTH call and put deltas. A wire
    // range of .3..7 would discard puts, so the source-backed chart model applies
    // the two disjoint ranges after acquisition without losing either leg.
    const min=present(controls.deltaMin)?Number(controls.deltaMin):0,max=present(controls.deltaMax)?Number(controls.deltaMax):1;
    if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max>1||min>max)throw Error('Choose a delta magnitude between 0 and 1.');
  }
  if(toolId==='open-interest-change'){
    if(!Object.hasOwn(body,'size'))body.size=100;
    // Public endpoint defaults to createdTime. Request the reference's global
    // OI-change ranking BEFORE pagination; sorting100returned rows is too late.
    // Exact documented request example: /api/docs/endpoints/open-interest-change.
    if(body.sort===undefined)body.sort={field:present(controls.oiSortField)?controls.oiSortField:'changeInOpenInterest',direction:present(controls.oiSortDirection)?controls.oiSortDirection:'DESCENDING'};
  }
  validateAdditionalToolRequest(toolId,body);
  return body;
}

/** Strict validation shared by the authenticated server route and offline QA. */
export function validateAdditionalToolRequest(toolId,body){
  if(toolId==='exchange-notifications'){validateNotificationRequest(body);return;}
  if(isOptionTapeTool(toolId)){validateOptionTapeRequest(toolId,body);return;}
  if(toolId==='iv-rank'){
    if(!object(body))throw Error('Invalid tool request.');
    // Public IV Rank accepts integer windows1..365; private UI maturity0 is
    // unsupported by this licensed route. Reject it before any vendor call.
    for(const [key,label] of [['lookBackPeriod','lookback'],['maturity','maturity']]){
      if(Object.hasOwn(body,key)&&(!Number.isInteger(body[key])||body[key]<1||body[key]>365))throw Error(`IV Rank ${label} must be an integer between 1 and 365 days.`);
    }
    return;
  }
  if(!Object.hasOwn(TOP_FIELDS,toolId))return;
  if(!object(body))throw Error('Invalid tool request.');
  const unsupported=Object.keys(body).find(key=>!TOP_FIELDS[toolId].includes(key));
  if(unsupported)throw Error(`${toolId} does not support ${unsupported}.`);
  if(body.filter!==undefined&&!object(body.filter))throw Error('Invalid tool filter.');
  const filter=body.filter??{};
  if(SINGLE_TICKER.has(toolId)){
    if(typeof filter.ticker!=='string'||!/^[A-Z0-9./^_-]{1,16}$/i.test(filter.ticker))throw Error('Select one instrument for this tool.');
    const invalid=Object.keys(filter).find(key=>!FILTER_FIELDS[toolId].includes(key));
    if(invalid)throw Error(`${toolId} does not support filter ${invalid}.`);
  }
  if(body.sessionDate!==undefined)date(body.sessionDate,'session date');
  if(body.sessionDate!==undefined&&(body.snapshotTime!==undefined||body.timeRange!==undefined))throw Error('Choose one session or time selector.');
  if(body.snapshotTime!==undefined&&!Number.isFinite(Date.parse(body.snapshotTime)))throw Error('Invalid snapshot time.');
  if(body.dataMode!==undefined&&!['NET_PREMIUM','NET_VOLUME'].includes(body.dataMode))throw Error('Invalid Net Flow metric.');
  if(toolId==='net-flow'&&!['NET_PREMIUM','NET_VOLUME'].includes(body.dataMode))throw Error('Select a Net Flow metric.');
  if(filter.expirationDate!==undefined)date(filter.expirationDate,'expiration');
  if(filter.expirationDates!==undefined){if(!Array.isArray(filter.expirationDates)||!filter.expirationDates.length)throw Error('Invalid expirations.');filter.expirationDates.forEach(value=>date(value,'expiration'));}
  if(filter.expirationDateRange!==undefined){const range=filter.expirationDateRange;if(!object(range))throw Error('Invalid expiration range.');date(range.startDate,'expiration range start');date(range.endDate,'expiration range end');if(range.startDate>range.endDate)throw Error('Invalid expiration range.');}
  if(filter.expirationDateRange&&(filter.expirationDate||filter.expirationDates))throw Error('Choose individual expirations or a range.');
  if(filter.strikePrice!==undefined)positive(filter.strikePrice,'Strike');
  if(filter.strikePrices!==undefined){if(!Array.isArray(filter.strikePrices)||!filter.strikePrices.length)throw Error('Invalid strikes.');filter.strikePrices.forEach(value=>positive(value,'Strike'));}
  if(filter.strikePriceRange!==undefined){const range=filter.strikePriceRange;if(!object(range))throw Error('Invalid strike range.');if(range.min!=null)positive(range.min,'Minimum strike');if(range.max!=null)positive(range.max,'Maximum strike');if(range.min!=null&&range.max!=null&&Number(range.min)>Number(range.max))throw Error('Invalid strike range.');if(filter.strikePrices)throw Error('Choose individual strikes or a range.');}
  if(filter.contractTypes!==undefined&&(!Array.isArray(filter.contractTypes)||!filter.contractTypes.length||filter.contractTypes.some(value=>!['CALL','PUT'].includes(value))))throw Error('Invalid contract type.');
  if(filter.deltaRange!==undefined){const range=filter.deltaRange;if(!object(range)||![range.min,range.max].every(value=>value==null||typeof value==='number'&&Number.isFinite(value)&&value>=-1&&value<=1)||range.min!=null&&range.max!=null&&range.min>range.max)throw Error('Invalid delta range.');}
  if(filter.moneyTypes!==undefined&&(!Array.isArray(filter.moneyTypes)||!filter.moneyTypes.length||filter.moneyTypes.some(value=>typeof value!=='string'||!Object.hasOwn(MONEY_ALIASES,value))))throw Error('Invalid moneyness.');
  if(body.includes&&body.excludes)throw Error('Choose includes or excludes, not both.');
  if(toolId==='open-interest-change'&&body.sort!==undefined){
    const sort=body.sort;
    if(!object(sort)||Object.keys(sort).some(key=>!['field','direction'].includes(key))||typeof sort.field!=='string'||!OI_CHANGE_SORT_FIELDS.has(sort.field.replace(/[^a-z0-9]/gi,'').toUpperCase())||!['ASCENDING','DESCENDING'].includes(sort.direction))throw Error('Choose a supported open-interest-change sort field and direction.');
  }
}
