import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSurfaceSelections,persistSurfaceSelections} from '../../public/gex-data-app/surface-selection-storage.js';

test('Skew saved selections survive a DOM-only save and JSON/CSV clipboard URL restoration',()=>{
  const previous={visibleExpiry:['2026-11-03','2026-11-05'],visibleContractType:['CALL','PUT']},before=structuredClone(previous),saved=persistSurfaceSelections('volatility-skew',previous,{ticker:'SPY',mode:'historical',date:'2026-11-03'});
  assert.deepEqual(saved,{...previous,ticker:'SPY',mode:'historical',date:'2026-11-03'});
  const params=new URLSearchParams();for(const [key,value]of Object.entries(saved))params.set('c_'+key,Array.isArray(value)?JSON.stringify(value):value);
  assert.deepEqual(restoreSurfaceSelections('volatility-skew',{parameters:params}),previous);
  assert.deepEqual(restoreSurfaceSelections('volatility-skew',{parameters:new URLSearchParams({c_visibleExpiry:'2026-11-03,2026-11-05',c_visibleContractType:'CALL,PUT'})}),previous);
  saved.visibleExpiry.push('2026-11-06');assert.deepEqual(previous,before);
});

test('explicit empty arrays survive copying and override legacy filters without changing their meaning',()=>{
  const skew=restoreSurfaceSelections('volatility-skew',{saved:{expiry:'2026-11-03',contractType:'CALL'},parameters:'c_visibleExpiry=%5B%5D&c_visibleContractType='});assert.deepEqual(skew,{visibleExpiry:[],visibleContractType:[]});
  const term=persistSurfaceSelections('term-structure',{expiryStart:'2026-11-03',expiryEnd:'2026-12-01',minStrike:700,maxStrike:800},{termExpirations:[],termStrikes:[],ticker:'SPY'});assert.deepEqual(term,{termExpirations:[],termStrikes:[],ticker:'SPY'});
  assert.deepEqual(restoreSurfaceSelections('term-structure',{parameters:{c_termExpirations:'',c_termStrikes:'[]'}}),{termExpirations:[],termStrikes:[]});
});

test('legacy Skew nonempty expiry/type migrate once; empty legacy defaults do not hide all',()=>{
  assert.deepEqual(persistSurfaceSelections('volatility-skew',{expiry:'2026-11-03,2026-11-05',contractTypeOptional:'CALL'},{ticker:'SPY'}),{visibleExpiry:['2026-11-03','2026-11-05'],visibleContractType:['CALL'],ticker:'SPY'});
  assert.deepEqual(restoreSurfaceSelections('volatility-skew',{saved:{expiry:'',contractTypeOptional:''}}),{});
  assert.deepEqual(restoreSurfaceSelections('volatility-skew',{saved:{visibleExpiry:[],visibleContractType:[],expiry:'bad-date',contractType:'BAD'}}),{visibleExpiry:[],visibleContractType:[]});
});

test('Term legacy ranges persist until corresponding new arrays override independently',()=>{
  const previous={expiryStart:'2026-11-03',expiryEnd:'2026-12-01',minStrike:'700',maxStrike:'800'},before=structuredClone(previous),saved=persistSurfaceSelections('term-structure',previous,{ticker:'SPY',moneyType:'ATM',deltaMin:'0',deltaMax:'1'});
  assert.deepEqual(saved,{expiryStart:'2026-11-03',expiryEnd:'2026-12-01',minStrike:700,maxStrike:800,ticker:'SPY',moneyType:'ATM',deltaMin:'0',deltaMax:'1'});assert.deepEqual(previous,before);
  assert.deepEqual(restoreSurfaceSelections('term-structure',{saved:previous,parameters:new URLSearchParams({c_termExpirations:'2026-11-05'})}),{termExpirations:['2026-11-05'],minStrike:700,maxStrike:800});
  assert.deepEqual(restoreSurfaceSelections('term-structure',{saved:previous,parameters:new URLSearchParams({c_termStrikes:'[750,760.5]'})}),{termStrikes:[750,760.5],expiryStart:'2026-11-03',expiryEnd:'2026-12-01'});
});

test('Term selected arrays survive workspace duplication and normalize finite numeric strike aliases',()=>{
  const previous={termExpirations:['2026-11-03'],termStrikes:[750,760.5]},saved=persistSurfaceSelections('term-structure',previous,{ticker:'SPY',moneyType:'',deltaMin:0,deltaMax:1}),params=new URLSearchParams();
  for(const [key,value]of Object.entries(saved))params.set('c_'+key,String(value));assert.deepEqual(restoreSurfaceSelections('term-structure',{parameters:params}),previous);
  assert.deepEqual(restoreSurfaceSelections('term-structure',{parameters:{c_termStrikes:'750,750.0,760.5'}}).termStrikes,[750,760.5]);
});

test('selection whitelist rejects cross-tool/control injection and never forwards arbitrary URL controls',()=>{
  const params=new URLSearchParams('c_visibleExpiry=2026-11-03&c_termStrikes=900&c_admin=true&c_ticker=EVIL&c___proto__=bad');assert.deepEqual(restoreSurfaceSelections('volatility-skew',{parameters:params}),{visibleExpiry:['2026-11-03']});
  assert.deepEqual(persistSurfaceSelections('volatility-skew',{admin:true,termStrikes:[900]},{ticker:'SPY',admin:true,termStrikes:[900]}),{ticker:'SPY'});
  for(const tool of ['unknown','__proto__','constructor']){assert.deepEqual(restoreSurfaceSelections(tool,{parameters:params}),{});assert.deepEqual(persistSurfaceSelections(tool,{}, {admin:true}),{});}
  assert.deepEqual(persistSurfaceSelections('term-structure',{mode:'historical',date:'2026-11-03',moneyType:'ATM',admin:true},{ticker:'SPY'}),{mode:'historical',date:'2026-11-03',ticker:'SPY',moneyType:'ATM'});
});

test('invalid known selections fail rather than silently broadening a surface filter',()=>{
  for(const saved of [{visibleExpiry:['2026-02-30']},{visibleContractType:['CALL','BAD']},{visibleExpiry:{}},{visibleExpiry:null}])assert.throws(()=>restoreSurfaceSelections('volatility-skew',{saved}));
  for(const value of ['Infinity','-1','1,,2','[null]','[true]','[{}]'])assert.throws(()=>restoreSurfaceSelections('term-structure',{parameters:{c_termStrikes:value}}));
  assert.throws(()=>restoreSurfaceSelections('term-structure',{saved:{expiryStart:'2026-12-01',expiryEnd:'2026-11-03'}}));
  assert.throws(()=>restoreSurfaceSelections('term-structure',{saved:{minStrike:800,maxStrike:700}}));
  assert.throws(()=>restoreSurfaceSelections('volatility-skew',{saved:{visibleExpiry:Array(4097).fill('2026-11-03')}}));
  assert.throws(()=>restoreSurfaceSelections('term-structure',{parameters:{c_termStrikes:' '.repeat(65537)}}));
});
