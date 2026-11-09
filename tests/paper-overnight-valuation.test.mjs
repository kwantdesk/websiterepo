import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaperTradingAccount} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger,placePaperOrder,processPaperQuote,updatePaperProtection,normalizePaperTradingLedger,paperPositionLivePnl,paperProjectedPnl} from '../src/lib/paperTrading.ts';
import {mergeAccountPreferenceChanges,accountPreferenceFingerprint,PAPER_LEDGER_KEY} from '../src/lib/accountPreferenceMerge.ts';
const at=Date.parse('2026-11-09T20:00Z'),record=createPaperTradingAccount({name:'Overnight fixture',balance:50000,leverage:'1:30',instrument:'NQ'});
const q=(price,timestamp)=>({bid:price,ask:price+.25,last:price,timestamp});
const snap=ledger=>({version:1,complete:true,updatedAt:new Date(at).toISOString(),values:{[PAPER_LEDGER_KEY]:JSON.stringify(ledger)}});
const pos=ledger=>ledger.accounts[record.id].positions[0];
const open=()=>placePaperOrder(emptyPaperTradingLedger(),[record],{accountId:record.id,symbol:'NQ',side:'buy',type:'market',quantity:2,price:null,stopLoss:29900,takeProfits:[]},q(30000,at)).ledger;
test('an overnight position retains its final mark against older cached quotes and equal-time fallback',()=>{
 const base=open(),latest=processPaperQuote(base,[record],'NQ',q(30010,at+1000),{executionAuthorized:true});
 const stale=processPaperQuote(latest,[record],'NQ',q(29990,at+500));
 assert.equal(stale,latest);assert.equal(pos(stale).markPrice,30010);
 assert.equal(processPaperQuote(latest,[record],'NQ',q(29990,at+1000)),latest);
 const restored=normalizePaperTradingLedger(JSON.parse(JSON.stringify(latest)));
 assert.equal(paperPositionLivePnl(pos(restored),null,at+8*3600000),390);
 assert.equal(paperPositionLivePnl(pos(restored),{symbol:'NQ',...q(29990,at+500)},at+1001),390);
});
test('saved P&L is derived from entry, current mark, side and remaining size, never a cached amount',()=>{
 const ledger=open();pos(ledger).markPrice=30010;pos(ledger).unrealizedPnl=999999;
 assert.equal(pos(normalizePaperTradingLedger(ledger)).unrealizedPnl,390);
});
for(const reverse of [false,true])test(`new stop and latest valuation survive cross-device merge direction${reverse}`,()=>{
 const base=open(),id=pos(base).id;
 const marked=processPaperQuote(base,[record],'NQ',q(30010,at+1000),{executionAuthorized:true});
 const moved=updatePaperProtection(base,record.id,id,{kind:'stop_loss',price:30000.5},at+2000).ledger;
 const result=mergeAccountPreferenceChanges(snap(base),...(reverse?[snap(moved),snap(marked)]:[snap(marked),snap(moved)]));
 const merged=JSON.parse(result.values[PAPER_LEDGER_KEY]);
 assert.equal(pos(merged).stopLoss,30000.5);assert.equal(pos(merged).markPrice,30010);
 assert.equal(pos(merged).unrealizedPnl,390);
 assert.equal(paperProjectedPnl('NQ','buy',pos(merged).entryPrice,pos(merged).stopLoss,2),10);
 assert.equal(pos(merged).status,'open');
});
test('valuation clock updates alone never cause per-tick cloud writes',()=>{
 const base=open(),marked=processPaperQuote(base,[record],'NQ',q(30010,at+1000),{executionAuthorized:true});
 assert.equal(accountPreferenceFingerprint(snap(base)),accountPreferenceFingerprint(snap(marked)));
});
test('newer display marks do not suppress an earlier unprocessed execution protection touch',()=>{
 const base=open(),id=pos(base).id;
 const stop=updatePaperProtection(base,record.id,id,{kind:'stop_loss',price:29995},at+100).ledger;
 const display=processPaperQuote(stop,[record],'NQ',q(30010,at+2000));
 const touched=processPaperQuote(display,[record],'NQ',q(29995,at+1500),{executionAuthorized:true});
 assert.equal(pos(touched).status,'closed');assert.equal(touched.accounts[record.id].fills.at(-1).price,29995);
});
