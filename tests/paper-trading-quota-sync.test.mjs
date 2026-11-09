import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaperTradingAccount,savePaperTradingAccounts,readPaperTradingAccounts} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger,placePaperOrder,savePaperTradingLedger,loadPaperTradingLedger,updatePaperProtection,closePaperPosition} from '../src/lib/paperTrading.ts';
import {captureBrowserPreferences,receiveAccountPreferences} from '../src/lib/userPreferences.ts';
import {clearConfirmedWorkspacePreferences} from '../src/lib/workspacePreferenceFallback.ts';

test('quota-refused active trades remain available to account upload and remote hydration',async()=>{
 const ownerKey='kwantdesk:active-preferences-owner:v1',key='kwantify-paper-trading-ledger-v1',accountsKey='kwantify-paper-trading-accounts';
 const map=new Map([[ownerKey,'quota-owner'],[key,JSON.stringify(emptyPaperTradingLedger())],[accountsKey,'[]']]);
 let full=true;
 const storage={get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k),setItem(k,v){if(full)throw new DOMException('full','QuotaExceededError');map.set(k,String(v));}};
 const previous=globalThis.window;globalThis.window={localStorage:storage,dispatchEvent(){}};
 try{
  const account=createPaperTradingAccount({name:'Existing account',balance:50000,leverage:'1:30',instrument:'NQ'});
  const quote={last:20000,bid:20000,ask:20000,timestamp:Date.now()};
  const opened=placePaperOrder(emptyPaperTradingLedger(),[account],{accountId:account.id,symbol:'NQ',side:'buy',type:'market',quantity:1,price:null,stopLoss:19990,takeProfits:[{price:20020,quantity:1}]},quote).ledger;
  assert.equal(savePaperTradingAccounts([account]).ok,false);assert.equal(savePaperTradingLedger(opened).ok,false);
  assert.equal(readPaperTradingAccounts().accounts[0].id,account.id);
  assert.equal(loadPaperTradingLedger().accounts[account.id].positions[0].status,'open');
  const upload=captureBrowserPreferences();
  assert.equal(JSON.parse(upload.values[key]).accounts[account.id].positions[0].status,'open');
  assert.equal(JSON.parse(upload.values[accountsKey])[0].id,account.id);
  const id=opened.accounts[account.id].positions[0].id;
  const edited=updatePaperProtection(opened,account.id,id,{kind:'stop_loss',price:19995}).ledger;
  receiveAccountPreferences('quota-owner',{...upload,values:{...upload.values,[key]:JSON.stringify(edited)}});
  assert.equal(loadPaperTradingLedger().accounts[account.id].positions[0].stopLoss,19995);
  const closed=closePaperPosition(edited,account.id,id,{...quote,last:20001,bid:20001,ask:20001,timestamp:quote.timestamp+1000}).ledger;
  assert.equal(savePaperTradingLedger(closed).ok,false);
  assert.equal(JSON.parse(captureBrowserPreferences().values[key]).accounts[account.id].positions[0].status,'closed');
  map.set(ownerKey,'different-owner');
  assert.deepEqual(loadPaperTradingLedger().accounts,{},'no cross-account in-memory fallback');
  map.set(ownerKey,'quota-owner');full=false;assert.equal(savePaperTradingLedger(closed).ok,true);
  assert.equal(loadPaperTradingLedger().accounts[account.id].positions[0].status,'closed');
  await Promise.resolve();
 }finally{globalThis.window=previous;clearConfirmedWorkspacePreferences('quota-owner');}
});
