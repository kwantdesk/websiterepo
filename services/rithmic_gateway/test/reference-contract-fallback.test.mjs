import test from 'node:test';import assert from 'node:assert/strict';import {selectReferenceContract} from '../src/instrument-resolution.mjs';
import {RithmicMarketDataClient} from '../src/rithmic-client.mjs';import {loadConfig} from '../src/config.mjs';
const now=Date.parse('2026-10-27T09:00:00Z');
test('reference fallback uses provider expirations, exact root and exact exchange',()=>{
 const row=(symbol,expirationDate,exchange='CBOT')=>({symbol,expirationDate,exchange});
 const selected=selectReferenceContract([row('UBU6','20260921'),row('UBH7','20270319'),row('UBZ6','20261221'),row('ZBZ6','20261221'),row('UBX6','20261117','CME'),row('UBZ6-UBH7','20261221')],{exchange:'CBOT',root:'UB',now});
 assert.equal(selected.symbol,'UBZ6');assert.equal(selectReferenceContract([row('UBU6','20260921')],{exchange:'CBOT',root:'UB',now}),null);
 assert.equal(selectReferenceContract([row('UBZ6',undefined)],{exchange:'CBOT',root:'UB',now}),null);
});
test('symbol search waits past the acceptance acknowledgement for the terminal response',async()=>{
 const config=loadConfig({RITHMIC_SOURCE_MODE:'protocol',RITHMIC_PROTO_DIR:new URL('../vendor/proto',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),RITHMIC_SUBSCRIPTIONS:'CBOT:UBZ6'}),client=new RithmicMarketDataClient(config);
 client.send=(_name,request)=>queueMicrotask(()=>{
  const deliver=payload=>{client.protocol.decode=()=>({templateId:110,payload:{userMsg:request.userMsg,...payload}});client.handleMessage(Buffer.alloc(0))};
  deliver({rqHandlerRpCode:['0']});deliver({symbol:'UBZ6',exchange:'CBOT',expirationDate:'20261221'});deliver({rpCode:['0']});
 });
 const result=await client.searchReferenceContracts('CBOT','UB');assert.equal(result.length,1);assert.equal(result[0].symbol,'UBZ6');
});
