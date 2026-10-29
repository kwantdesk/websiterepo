import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {emptyPaperTradingLedger,placePaperOrder,updatePaperProtection,updatePaperOrderProtection,processPaperQuote,normalizePaperTradingLedger} from '../src/lib/paperTrading.ts';
const source=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('  const handlePaperProtectionUpdate ='),source.indexOf('  const handlePaperProtectionDragStateChange ='));
const account={id:'fixture',name:'Fixture',balance:'$50,000',leverage:'1:30'};
const start=1793000000000;
const quote=(price,t=start+1000)=>({bid:price,ask:price,last:price,timestamp:t});
function fixture(side='buy',type='market'){
 const base=placePaperOrder(emptyPaperTradingLedger(),[account],{accountId:account.id,symbol:'NQ',side,type,quantity:1,price:type==='market'?null:30000,stopLoss:side==='buy'?29990:30010,takeProfits:[]},quote(type==='market'?30000:side==='buy'?30001:29999,start)).ledger;
 let stored=structuredClone(base),rendered=base;const writes=[],messages=[];
 const context={paperLedgerRef:{current:base},updatePaperProtection,updatePaperOrderProtection,processPaperQuote,
  resolvePaperExecutionQuote:()=>quote(30000),paperTradingAccounts:[account],suspendedPaperProtectionIdsRef:{current:new Set()},
  savePaperTradingLedger:ledger=>{stored=structuredClone(ledger);writes.push(stored);return {ok:true}},
  commitPaperLedger:ledger=>{context.paperLedgerRef.current=ledger;rendered=ledger},showPaperOrderMessage:(...args)=>messages.push(args)};
 vm.runInNewContext(ts.transpileModule(handler+'\nglobalThis.update=handlePaperProtectionUpdate;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {base,context,writes,messages,get stored(){return stored},get rendered(){return rendered}};
}
for(const side of ['buy','sell'])test(`a moved ${side} stop is durable before a following tick can skip React persistence`,()=>{
 const h=fixture(side),position=h.base.accounts.fixture.positions[0];const moved=side==='buy'?29980:30020,old=position.stopLoss;
 h.context.update('fixture',position.id,{kind:'stop_loss',price:moved});
 // Actual existing save-effect condition: a stream-owned ref can already
 // advance before passive persistence receives the just-rendered ledger.
 h.context.paperLedgerRef.current=processPaperQuote(h.context.paperLedgerRef.current,[account],'NQ',quote(side==='buy'?30001:29999),{executionAuthorized:true});
 assert.notStrictEqual(h.rendered,h.context.paperLedgerRef.current);
 assert.equal(h.writes.length,1,'operator intent must save inside the update, not wait for a passive effect');
 assert.equal(h.stored.accounts.fixture.positions[0].stopLoss,moved);
 let reloaded=normalizePaperTradingLedger(JSON.parse(JSON.stringify(h.stored)));
 reloaded=processPaperQuote(reloaded,[account],'NQ',quote(old,start+120000),{executionAuthorized:true});
 assert.equal(reloaded.accounts.fixture.positions[0].status,'open','old stop price must no longer exit');
 const stopped=processPaperQuote(reloaded,[account],'NQ',quote(moved,start+121000),{executionAuthorized:true});
 assert.equal(stopped.accounts.fixture.positions[0].status,'closed');assert.equal(stopped.accounts.fixture.fills.at(-1).price,moved);
});
test('resting order protection is durable before entry transfers it to a position',()=>{
 const h=fixture('buy','limit'),order=h.base.accounts.fixture.orders[0];h.context.update('fixture',order.id,{kind:'stop_loss',price:29980});
 assert.equal(h.stored.accounts.fixture.orders[0].stopLoss,29980);assert.equal(h.writes.length,1);
 const filled=processPaperQuote(h.stored,[account],'NQ',quote(30000),{executionAuthorized:true});assert.equal(filled.accounts.fixture.positions[0].stopLoss,29980);
});
test('storage refusal keeps in-memory protection but reports that saving failed',()=>{
 const h=fixture(),position=h.base.accounts.fixture.positions[0];h.context.savePaperTradingLedger=()=>({ok:false});
 h.context.update('fixture',position.id,{kind:'stop_loss',price:29980});assert.equal(h.context.paperLedgerRef.current.accounts.fixture.positions[0].stopLoss,29980);
 assert.ok(h.messages.some(([tone,text])=>tone==='error'&&/sav|storage/i.test(text)));
});
test('moved take-profit is durable and old target cannot execute after restoration',()=>{
 const h=fixture(),position=h.base.accounts.fixture.positions[0];
 h.context.update('fixture',position.id,{kind:'take_profit',price:30010});
 const target=h.stored.accounts.fixture.positions[0].takeProfits[0];
 h.context.update('fixture',position.id,{kind:'take_profit',targetId:target.id,price:30020});
 assert.equal(h.stored.accounts.fixture.positions[0].takeProfits[0].price,30020);
 let ledger=normalizePaperTradingLedger(h.stored);ledger=processPaperQuote(ledger,[account],'NQ',quote(30010,start+120000),{executionAuthorized:true});
 assert.equal(ledger.accounts.fixture.positions[0].status,'open');
 ledger=processPaperQuote(ledger,[account],'NQ',quote(30020,start+121000),{executionAuthorized:true});
 assert.equal(ledger.accounts.fixture.fills.at(-1).price,30020);
});
test('explicit stop removal saves synchronously and invalid edits never overwrite saved protection',()=>{
 const h=fixture(),position=h.base.accounts.fixture.positions[0];
 h.context.update('fixture',position.id,{kind:'stop_loss',price:-1});assert.equal(h.writes.length,0);
 h.context.update('fixture',position.id,{kind:'stop_loss',price:null});assert.equal(h.stored.accounts.fixture.positions[0].stopLoss,null);assert.equal(h.writes.length,1);
});
