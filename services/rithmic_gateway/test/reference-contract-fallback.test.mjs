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
test('provider-listed fallback ranks verified activity above an idle nearer serial, excluding expired or other-root contracts',()=>{
 const rows=[{symbol:'SR3Q6',exchange:'CME',expirationDate:'20261117'},{symbol:'SR3Z6',exchange:'CME',expirationDate:'20270316'},{symbol:'SR3F6',exchange:'CME',expirationDate:'20260414'},{symbol:'NQZ6',exchange:'CME',expirationDate:'20261221'}];
 assert.equal(selectReferenceContract(rows,{exchange:'CME',root:'SR3',now,activityBySymbol:{SR3Q6:50,SR3Z6:432272,SR3F6:9999999,NQZ6:9999999}}).symbol,'SR3Z6');
 assert.equal(selectReferenceContract(rows,{exchange:'CME',root:'SR3',now}).symbol,'SR3Q6');
});
test('a temporary reference-search outage preserves the existing exact-product quote',async()=>{
 const config=loadConfig({RITHMIC_SOURCE_MODE:'protocol',RITHMIC_PROTO_DIR:new URL('../vendor/proto',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),RITHMIC_SUBSCRIPTIONS:'CBOT:UBZ6'}),c=new RithmicMarketDataClient(config);
 c.book.applyTrade({exchange:'CBOT',symbol:'UBZ6',tradePrice:100,tradeSize:1,ssboe:Math.floor(Date.now()/1000)});c.socket={readyState:1};
 c.send=name=>{if(name==='RequestFrontMonthContract'){for(const[id,p]of c.pendingFrontMonthRequests){clearTimeout(p.timeout);c.pendingFrontMonthRequests.delete(id);p.reject(Error('Front month failed (7)'));}}};
 c.searchReferenceContracts=async()=>{throw Error('temporary reference outage')};
 const result=await c.resolveFrontMonth('CBOT','UB');assert.equal(result.contractSymbol,'UBZ6');assert.equal(result.source,'live-book-fallback');c.socket=null;
});
