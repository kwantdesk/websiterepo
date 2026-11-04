import {validateAdditionalToolRequest} from './additional-tool-requests.js';

// Public contract: quantdata.us/api/docs/endpoints/term-structure (2026-11-03).
// These are observed snapshot keys, not the platform's private expiration/strike
// metadata universe. Historical contracts without a usable chain snapshot can
// be absent. Never synthesize an expiration calendar or interpolate strikes.
const LIMITATIONS='Observed chain snapshot only; contracts missing from this snapshot are not enumerated. This is not a complete contract metadata inventory.';
const OI_LIMITATIONS='Observed open-interest strike keys for the requested expiration only; this is not a complete contract metadata inventory.';
const OI_EXPIRY_LIMITATIONS='Observed open-interest expiration keys for the requested ticker and session only; this is not a complete contract metadata inventory.';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const decimal=/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const moneyTypes=new Set(['ATM','ITM','OTM','AT_THE_MONEY','IN_THE_MONEY','OUT_OF_THE_MONEY']);
function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const time=Date.parse(value+'T12:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().startsWith(value);
}

/** A broad request body for the existing options/term-structure transport. */
export function buildOptionContractChoicesRequest({ticker,sessionDate}={}){
  if(typeof ticker!=='string')throw Error('Select one instrument for contract choices.');
  const body={filter:{ticker:ticker.trim().toUpperCase()}};
  if(sessionDate!==undefined&&sessionDate!==null&&sessionDate!=='')body.sessionDate=sessionDate;
  // Reuse the real licensed route's validator. No saved expiry, delta, money,
  // strike, filter-group, or snapshot selector may narrow the choice inventory.
  validateAdditionalToolRequest('term-structure',body);
  return body;
}

/** OI includes observed contracts without usable IV; optional expiry narrows its scope. */
export function buildOptionStrikeChoicesRequest({ticker,sessionDate,expirationDate}={}){
  if(expirationDate!==undefined&&!validDate(expirationDate))throw Error('Select one valid expiration for strike choices.');
  const body=buildOptionContractChoicesRequest({ticker,sessionDate});
  if(expirationDate!==undefined)body.filter.expirationDate=expirationDate;
  validateAdditionalToolRequest('open-interest-by-strike',body);
  return body;
}

/** Broad public OI expiration inventory; no IV/greeks/strike selection required. */
export function buildOptionExpirationChoicesRequest({ticker,sessionDate}={}){
  const body=buildOptionContractChoicesRequest({ticker,sessionDate});
  validateAdditionalToolRequest('open-interest-by-expiration',body);
  return body;
}

function positiveStrike(key){
  if(typeof key!=='string'||!decimal.test(key))return null;
  const strike=Number(key);return Number.isFinite(strike)&&strike>0?strike:null;
}
const validOpenInterestRow=row=>object(row)&&['callOpenInterest','putOpenInterest'].some(field=>
  Object.hasOwn(row,field)&&typeof row[field]==='number'&&Number.isFinite(row[field])&&row[field]>=0);

/** Actual public OI expiry keys, including zero counts; no fabricated calendar. */
export function parseOpenInterestExpirationChoices(payload){
  const expirationDates=object(payload)&&object(payload.data)?Object.keys(payload.data)
    .filter(date=>validDate(date)&&validOpenInterestRow(payload.data[date])).sort():[];
  return {coverage:'observed open interest',expirationDates,
    strikePricesByExpiration:Object.fromEntries(expirationDates.map(date=>[date,[]])),
    strikePrices:[],limitations:OI_EXPIRY_LIMITATIONS};
}

/** Public /open-interest-by-strike response; zero OI is still an observed key. */
export function parseOpenInterestStrikeChoices(payload){
  const strikes=new Set();
  if(object(payload)&&object(payload.data))for(const [key,row] of Object.entries(payload.data)){
    const strike=positiveStrike(key);if(strike===null||!object(row))continue;
    if(validOpenInterestRow(row))strikes.add(strike);
  }
  return {coverage:'observed open interest',strikePrices:[...strikes].sort((a,b)=>a-b),limitations:OI_LIMITATIONS};
}

/** Merge only an OI response requested for this exact expiration into observed choices. */
export function mergeOptionContractChoices(chainChoices,expirationDate,openInterestPayload){
  if(!validDate(expirationDate))throw Error('Select one expiration for strike choices.');
  const byDate={};
  if(object(chainChoices?.strikePricesByExpiration))for(const [date,strikes] of Object.entries(chainChoices.strikePricesByExpiration)){
    if(!validDate(date)||!Array.isArray(strikes))continue;
    const valid=strikes.filter(strike=>typeof strike==='number'&&Number.isFinite(strike)&&strike>0);
    byDate[date]=[...new Set(valid)].sort((a,b)=>a-b);
  }
  const oi=parseOpenInterestStrikeChoices(openInterestPayload).strikePrices;
  if(oi.length)byDate[expirationDate]=[...new Set([...(byDate[expirationDate]??[]),...oi])].sort((a,b)=>a-b);
  const expirationDates=Object.keys(byDate).sort();
  const strikePricesByExpiration=Object.fromEntries(expirationDates.map(date=>[date,byDate[date]]));
  const oiOnly=chainChoices?.coverage==='observed open interest';
  return {coverage:oiOnly?'observed open interest':oi.length||chainChoices?.coverage==='observed chain and open interest'?'observed chain and open interest':'observed chain',
    expirationDates,strikePricesByExpiration,
    strikePrices:[...new Set(expirationDates.flatMap(date=>byDate[date]))].sort((a,b)=>a-b),
    limitations:oiOnly?`${OI_EXPIRY_LIMITATIONS} ${OI_LIMITATIONS}`:oi.length?`${LIMITATIONS} ${OI_LIMITATIONS}`:LIMITATIONS};
}

function validLeg(leg,type){
  // IV zero and delta zero remain observed contracts. There is no display-IV
  // threshold/cap here. Full money-type spellings occur in actual API payloads.
  return object(leg)&&typeof leg.delta==='number'&&Number.isFinite(leg.delta)&&
    leg.delta>=(type==='CALL'?0:-1)&&leg.delta<=(type==='CALL'?1:0)&&
    typeof leg.iv==='number'&&Number.isFinite(leg.iv)&&leg.iv>=0&&moneyTypes.has(leg.moneyType);
}

/** Parse actual documented term-structure legs without changing licensed data. */
export function parseOptionContractChoices(payload){
  const strikePricesByExpiration={},all=new Set();
  if(object(payload)&&object(payload.data)){
    for(const expiration of Object.keys(payload.data).filter(validDate).sort()){
      const rows=payload.data[expiration];if(!object(rows))continue;
      const strikes=new Set();
      for(const [key,row] of Object.entries(rows)){
        const strike=positiveStrike(key);
        if(strike===null||!object(row))continue;
        if(!['CALL','PUT'].some(type=>Object.hasOwn(row,type)&&validLeg(row[type],type)))continue;
        strikes.add(strike);all.add(strike);
      }
      if(strikes.size)strikePricesByExpiration[expiration]=[...strikes].sort((a,b)=>a-b);
    }
  }
  return {coverage:'observed chain',expirationDates:Object.keys(strikePricesByExpiration),
    strikePricesByExpiration,strikePrices:[...all].sort((a,b)=>a-b),limitations:LIMITATIONS};
}
