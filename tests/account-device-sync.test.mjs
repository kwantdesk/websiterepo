import test from 'node:test';
import assert from 'node:assert/strict';
import {accountPreferenceFingerprint,mergeAccountPreferenceChanges,PAPER_LEDGER_KEY} from '../src/lib/accountPreferenceMerge.ts';
import {exchangeAccountPreferences} from '../src/lib/accountPreferenceCloud.ts';
import {createPaperTradingAccount} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger,placePaperOrder,processPaperQuote,closePaperPosition,updatePaperProtection,resetPaperAccountLedger} from '../src/lib/paperTrading.ts';

const snapshot=values=>({version:1,complete:true,updatedAt:'2026-10-27T00:00:00Z',values});
const tradeSnapshot=ledger=>snapshot({[PAPER_LEDGER_KEY]:JSON.stringify(ledger)});
const ledgerOf=s=>JSON.parse(s.values[PAPER_LEDGER_KEY]);
const record=createPaperTradingAccount({name:'Device fixture',balance:50000,leverage:'1:30',instrument:'ES'});
const quote=price=>({last:price,bid:price,ask:price,timestamp:Date.parse('2026-10-27T00:00:00Z')});
function opened(quantity=1){
 const result=placePaperOrder(emptyPaperTradingLedger(),[record],{accountId:record.id,symbol:'ES',side:'buy',type:'market',quantity,price:null,stopLoss:7699,takeProfits:[{price:7701,quantity:1}]},quote(7700));
 assert.equal(result.error,undefined);return result.ledger;
}
test('a stale phone changes only its edited keys, preserving desktop layout and deletions',()=>{
 const base=snapshot({'olisa-chart-workspace-layout':'old','olisa-theme':'old',removed:'old'});
 const local=snapshot({'olisa-chart-workspace-layout':'old','olisa-theme':'new',removed:'old'});
 const remote=snapshot({'olisa-chart-workspace-layout':'desktop','olisa-theme':'old'});
 assert.deepEqual(mergeAccountPreferenceChanges(base,local,remote).values,{'olisa-chart-workspace-layout':'desktop','olisa-theme':'new'});
});
test('live quote marks do not dirty account sync or resurrect a peer-closed trade',()=>{
 const original=opened();
 const marked=processPaperQuote(original,[record],'ES',{...quote(7700.25),timestamp:quote(7700).timestamp+1000},{executionAuthorized:false});
 assert.equal(accountPreferenceFingerprint(tradeSnapshot(original)),accountPreferenceFingerprint(tradeSnapshot(marked)));
 const position=original.accounts[record.id].positions[0];
 const closed=closePaperPosition(original,record.id,position.id,{...quote(7701),timestamp:quote(7700).timestamp+500}).ledger;
 const result=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(original),tradeSnapshot(marked),tradeSnapshot(closed)));
 assert.equal(result.accounts[record.id].positions[0].status,'closed');
 assert.equal(result.accounts[record.id].cashBalance,50050);
});
test('a concurrent stop edit cannot undo a completed exit or its P&L',()=>{
 const original=opened(),id=original.accounts[record.id].positions[0].id;
 const changed=updatePaperProtection(original,record.id,id,{kind:'stop_loss',price:7699.5}).ledger;
 const closed=closePaperPosition(original,record.id,id,{...quote(7701),timestamp:quote(7700).timestamp+500}).ledger;
 const result=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(original),tradeSnapshot(changed),tradeSnapshot(closed)));
 assert.equal(result.accounts[record.id].positions[0].status,'closed');
 assert.equal(result.accounts[record.id].cashBalance,50050);
 assert.equal(result.accounts[record.id].realizedPnl,50);
});
test('two devices seeing the same partial target produce one fill and preserve the filled target',()=>{
 const original=opened(2),timestamp=quote(7700).timestamp+1000;
 const left=processPaperQuote(structuredClone(original),[record],'ES',{...quote(7701),timestamp},{executionAuthorized:true});
 const right=processPaperQuote(structuredClone(original),[record],'ES',{...quote(7701),timestamp:timestamp+1},{executionAuthorized:true});
 assert.equal(left.accounts[record.id].fills.at(-1).id,right.accounts[record.id].fills.at(-1).id);
 const merged=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(original),tradeSnapshot(left),tradeSnapshot(right)));
 const account=merged.accounts[record.id];
 assert.equal(account.cashBalance,50050);assert.equal(account.positions[0].remainingQuantity,1);
 assert.equal(account.positions[0].takeProfits[0].filledQuantity,1);
 assert.equal(account.fills.filter(f=>f.role==='take_profit').length,1);
});
test('shared resting orders open the same position and targets on both devices',()=>{
 const pending=placePaperOrder(emptyPaperTradingLedger(),[record],{accountId:record.id,symbol:'ES',side:'buy',type:'limit',quantity:1,price:7699.5,stopLoss:7699,takeProfits:[{price:7701,quantity:1}]},quote(7700)).ledger;
 const fill=()=>processPaperQuote(structuredClone(pending),[record],'ES',{...quote(7699.5),timestamp:quote(7700).timestamp+1000},{executionAuthorized:true});
 const a=fill(),b=fill();
 assert.equal(a.accounts[record.id].positions[0].id,b.accounts[record.id].positions[0].id);
 assert.deepEqual(a.accounts[record.id].positions[0].takeProfits,b.accounts[record.id].positions[0].takeProfits);
 const merged=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(pending),tradeSnapshot(a),tradeSnapshot(b)));
 assert.equal(merged.accounts[record.id].positions.length,1);
 assert.equal(merged.accounts[record.id].fills.length,1);
});
test('independent new orders from two devices are both retained',()=>{
 const base=opened();
 const add=()=>placePaperOrder(structuredClone(base),[record],{accountId:record.id,symbol:'ES',side:'buy',type:'market',quantity:1,price:null,stopLoss:null,takeProfits:[]},{...quote(7700),timestamp:quote(7700).timestamp+2000}).ledger;
 const merged=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(base),tradeSnapshot(add()),tradeSnapshot(add())));
 assert.equal(merged.accounts[record.id].positions.length,3);
 assert.equal(merged.accounts[record.id].cashBalance,50000);
});
test('deleted demo accounts are not recreated by stale marking state',()=>{
 const base=opened(),local=structuredClone(base);
 const extra=createPaperTradingAccount({name:'other',balance:1000,leverage:'1:30',instrument:'ES'});
 local.accounts[extra.id]={...local.accounts[record.id],accountId:extra.id};
 const merged=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(base),tradeSnapshot(local),tradeSnapshot(emptyPaperTradingLedger())));
 assert.equal(merged.accounts[record.id],undefined);assert.ok(merged.accounts[extra.id]);
});
test('a deliberate reset survives a concurrent stale protection edit without losing journal evidence',()=>{
 const first=opened(),position=first.accounts[record.id].positions[0];
 const closed=closePaperPosition(first,record.id,position.id,{...quote(7701),timestamp:quote(7700).timestamp+1000}).ledger;
 const base=placePaperOrder(closed,[record],{accountId:record.id,symbol:'ES',side:'buy',type:'market',quantity:1,price:null,stopLoss:7699,takeProfits:[]},{...quote(7700),timestamp:quote(7700).timestamp+2000}).ledger;
 const second=base.accounts[record.id].positions.at(-1);
 const remote=updatePaperProtection(base,record.id,second.id,{kind:'stop_loss',price:7699.5}).ledger;
 const local=resetPaperAccountLedger(base,record.id);
 const result=ledgerOf(mergeAccountPreferenceChanges(tradeSnapshot(base),tradeSnapshot(local),tradeSnapshot(remote))).accounts[record.id];
 assert.equal(result.cashBalance,50000);assert.equal(result.realizedPnl,0);
 assert.equal(result.positions.length,0);assert.equal(result.orders.length,0);
 assert.ok(result.journalFills.some(fill=>fill.role==='manual_close'));
});

function database(initial){
 let row={preferences:initial,updated_at:initial.updatedAt},race=null,writes=0;
 const client={from(table){
  const filters={};let payload=null,op='read';
  const chain={abortSignal(signal){assert.ok(signal instanceof AbortSignal);return chain},select(){return chain},eq(k,v){filters[k]=v;return chain},update(p){payload=p;op='update';return chain},
   async maybeSingle(){
    assert.equal(filters.user_id,'owner');
    if(table!=='user_preferences')return {data:null,error:null};
    if(op==='read')return {data:structuredClone(row),error:null};
    if(race){row=race;race=null;}
    if(filters.updated_at!==row.updated_at)return {data:null,error:null};
    row=payload;writes++;return {data:{updated_at:row.updated_at},error:null};
   }};return chain;
 }};
 return {client,get row(){return row},get writes(){return writes},race(next){race={preferences:next,updated_at:next.updatedAt}}};
}
test('database compare-and-swap rebases a competing write without discarding it',async()=>{
 const base=snapshot({'olisa-chart-workspace-layout':'base','olisa-theme':'base'}),db=database(base);
 const peer={...snapshot({'olisa-chart-workspace-layout':'desktop','olisa-theme':'base'}),updatedAt:'2026-10-27T00:00:01Z'};
 db.race(peer);
 const result=await exchangeAccountPreferences(db.client,'owner',base,snapshot({'olisa-chart-workspace-layout':'base','olisa-theme':'phone'}),true);
 assert.deepEqual(result.snapshot.values,{'olisa-chart-workspace-layout':'desktop','olisa-theme':'phone'});
 assert.equal(db.writes,1);assert.deepEqual(db.row.preferences.values,result.snapshot.values);
});
test('read-only catchup never writes the database',async()=>{
 const base=snapshot({'olisa-chart-workspace-layout':'base'}),remote=snapshot({'olisa-chart-workspace-layout':'desktop'}),db=database(remote);
 const result=await exchangeAccountPreferences(db.client,'owner',base,base,false);
 assert.equal(result.snapshot.values["olisa-chart-workspace-layout"],'desktop');assert.equal(db.writes,0);
});
