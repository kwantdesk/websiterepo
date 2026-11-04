import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOptionContractChoicesRequest,parseOptionContractChoices,buildOptionStrikeChoicesRequest,parseOpenInterestStrikeChoices,mergeOptionContractChoices,buildOptionExpirationChoicesRequest,parseOpenInterestExpirationChoices} from '../public/gex-data-app/option-contract-choices.js';
import {validateGexDataRequest} from '../src/lib/gexDataPolicy.ts';

const call={delta:0.5,iv:0.25,moneyType:'ATM'},put={delta:-0.5,iv:0.25,moneyType:'OUT_OF_THE_MONEY'};
test('broad public request uses resolved widget scope and passes the actual route validator',()=>{
  const input={ticker:' spy ',sessionDate:'2026-10-16',expiry:'2026-10-19',strike:700,moneyType:'ATM',deltaMin:.4,filter:{tickers:['QQQ']},filterExpression:{conjunction:'AND',filters:[]}};
  const saved=structuredClone(input),body=buildOptionContractChoicesRequest(input);
  assert.deepEqual(body,{sessionDate:'2026-10-16',filter:{ticker:'SPY'}});
  assert.deepEqual(validateGexDataRequest('term-structure',body),body);
  assert.deepEqual(input,saved);
  assert.deepEqual(buildOptionContractChoicesRequest({ticker:'NDX'}),{filter:{ticker:'NDX'}});
  for(const ticker of ['',null,['SPY'],['SPY','QQQ'],'SPY,QQQ','SPY QQQ'])assert.throws(()=>buildOptionContractChoicesRequest({ticker}));
  for(const sessionDate of ['2026-02-29','2026-13-01','10/16/2026',new Date()])assert.throws(()=>buildOptionContractChoicesRequest({ticker:'SPY',sessionDate}));
});

test('only observed valid legs yield sorted dates and numeric-deduplicated strikes',()=>{
  const payload={data:{'2026-11-20':{'100.0':{CALL:call},'1e2':{PUT:put},'99.5':{PUT:put}},'2026-10-16':{'105.00':{CALL:call},'100':{CALL:call},'100.000':{CALL:call}},'2026-10-19':{}}};
  const saved=structuredClone(payload),model=parseOptionContractChoices(payload);
  assert.equal(model.coverage,'observed chain');
  assert.match(model.limitations,/not a complete/i);
  assert.deepEqual(model.expirationDates,['2026-10-16','2026-11-20']);
  assert.deepEqual(model.strikePricesByExpiration,{'2026-10-16':[100,105],'2026-11-20':[99.5,100]});
  assert.deepEqual(model.strikePrices,[99.5,100,105]);assert.deepEqual(payload,saved);
});

test('actual zero-valued and high-IV legs remain available independently of chart display rules',()=>{
  // Full spelling/high-IV example follows the licensed chain captured locally.
  const payload={data:{'2026-10-16':{'1':{CALL:{delta:0,iv:0,moneyType:'OUT_OF_THE_MONEY'}},'2':{PUT:{delta:-1,iv:0,moneyType:'ITM'}},'3':{CALL:{delta:.9997041815962604,iv:2188.6348724365234,moneyType:'IN_THE_MONEY'}}}}};
  assert.deepEqual(parseOptionContractChoices(payload).strikePrices,[1,2,3]);
});

test('malformed dates, strikes, empty/null legs and nonfinite fields do not manufacture choices',()=>{
  const data={'2026-02-30':{'100':{CALL:call}},'2026-10-16':{'0':{CALL:call},'-1':{CALL:call},'Infinity':{CALL:call},'0x10':{CALL:call},' ': {CALL:call},'1':{},'2':{CALL:null},'3':{CALL:{}},'4':{CALL:{...call,iv:null}},'5':{CALL:{...call,delta:Infinity}},'6':{PUT:{...put,delta:.5}},'7':{CALL:{...call,iv:-1}},'8':{CALL:{...call,moneyType:'fake'}},'9':{OTHER:call},'10':[], '11':{CALL:{...call,delta:'0.5'}},'12':{CALL:{...call,iv:NaN}}}};
  assert.deepEqual(parseOptionContractChoices({data}).expirationDates,[]);
  for(const payload of [null,undefined,[],{}, {data:[]},{data:null},{data:{'2026-10-16':null}}])assert.deepEqual(parseOptionContractChoices(payload).strikePrices,[]);
});

test('OI strike choices use documented optional expiry and reject supplied invalid dates',()=>{
  const body=buildOptionStrikeChoicesRequest({ticker:'spy',sessionDate:'2026-10-16',expirationDate:'2026-10-16',deltaMin:.4,strike:760,moneyType:'ATM'});
  assert.deepEqual(body,{sessionDate:'2026-10-16',filter:{ticker:'SPY',expirationDate:'2026-10-16'}});
  assert.deepEqual(validateGexDataRequest('open-interest-by-strike',body),body);
  const broad=buildOptionStrikeChoicesRequest({ticker:'SPY',sessionDate:'2026-10-16'});
  assert.deepEqual(broad,{sessionDate:'2026-10-16',filter:{ticker:'SPY'}});
  assert.deepEqual(validateGexDataRequest('open-interest-by-strike',broad),broad);
  assert.deepEqual(buildOptionStrikeChoicesRequest({ticker:'SPY',expirationDate:undefined}),{filter:{ticker:'SPY'}});
  for(const expirationDate of [null,'',[],['2026-10-16'],'2026-02-30'])assert.throws(()=>buildOptionStrikeChoicesRequest({ticker:'SPY',expirationDate}));
});

test('observed OI strikes retain zero counts and contracts absent from the IV chain',()=>{
  // Actual captured SPY Oct16 OI keys missing from the matching term snapshot.
  const data={'310.0':{callOpenInterest:2,putOpenInterest:4501},'315.0':{callOpenInterest:1,putOpenInterest:3539},'325.0':{callOpenInterest:1,putOpenInterest:426},'330.0':{callOpenInterest:3,putOpenInterest:4648},'350.0':{callOpenInterest:5,putOpenInterest:6274},'351':{callOpenInterest:0,putOpenInterest:0},'351.00':{callOpenInterest:0}};
  assert.deepEqual(parseOpenInterestStrikeChoices({data}).strikePrices,[310,315,325,330,350,351]);
  const invalid={data:{'1':{},'2':{callOpenInterest:null},'3':{callOpenInterest:NaN},'4':{putOpenInterest:-1},'5':{callOpenInterest:'0'},'0':{callOpenInterest:1},'Infinity':{callOpenInterest:1}}};
  assert.deepEqual(parseOpenInterestStrikeChoices(invalid).strikePrices,[]);
});

test('merge supplements only requested expiration without deleting prior observed choices or mutating inputs',()=>{
  const chain=parseOptionContractChoices({data:{'2026-10-16':{'300':{CALL:call},'305':{PUT:put}},'2026-11-20':{'350':{CALL:call}}}}),saved=structuredClone(chain);
  const payload={data:{'310':{callOpenInterest:2,putOpenInterest:4501},'305.0':{callOpenInterest:0}}},original=structuredClone(payload);
  const model=mergeOptionContractChoices(chain,'2026-10-16',payload);
  assert.equal(model.coverage,'observed chain and open interest');
  assert.deepEqual(model.strikePricesByExpiration,{'2026-10-16':[300,305,310],'2026-11-20':[350]});
  assert.deepEqual(model.strikePrices,[300,305,310,350]);assert.deepEqual(chain,saved);assert.deepEqual(payload,original);
  assert.deepEqual(mergeOptionContractChoices(chain,'2026-10-16',{data:{}}).strikePricesByExpiration,chain.strikePricesByExpiration);
  assert.throws(()=>mergeOptionContractChoices(chain,'2026-02-30',payload));
});

test('OI-only inventories preserve every observed expiry while lazily adding selected expiry strikes',()=>{
  const request=buildOptionExpirationChoicesRequest({ticker:'spy',sessionDate:'2026-10-16',strike:760,filter:{moneyTypes:['ATM']}});
  assert.deepEqual(request,{sessionDate:'2026-10-16',filter:{ticker:'SPY'}});
  assert.deepEqual(validateGexDataRequest('open-interest-by-expiration',request),request);
  const payload={data:{'2026-10-19':{callOpenInterest:0,putOpenInterest:0},'2026-10-16':{callOpenInterest:851228,putOpenInterest:2575771},'2026-02-30':{callOpenInterest:1},'2026-12-18':{},'2026-12-19':{putOpenInterest:null},'2026-12-20':{callOpenInterest:-1}}};
  const base=parseOpenInterestExpirationChoices(payload),copy=structuredClone(base);
  assert.equal(base.coverage,'observed open interest');
  assert.deepEqual(base.expirationDates,['2026-10-16','2026-10-19']);assert.deepEqual(base.strikePrices,[]);
  const merged=mergeOptionContractChoices(base,'2026-10-16',{data:{'310.0':{callOpenInterest:2,putOpenInterest:4501}}});
  assert.equal(merged.coverage,'observed open interest');
  assert.deepEqual(merged.expirationDates,['2026-10-16','2026-10-19']);
  assert.deepEqual(merged.strikePricesByExpiration,{'2026-10-16':[310],'2026-10-19':[]});
  assert.deepEqual(base,copy);assert.match(merged.limitations,/not a complete/i);
  assert.deepEqual(parseOpenInterestExpirationChoices({data:null}).expirationDates,[]);
});
