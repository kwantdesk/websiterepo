import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {liquidityMapTradeLevels,liquidityMapExecutionQuote,liquidityMapPickedPrice} from '../src/lib/liquidityMapTrading.ts';
import {createPaperTradingAccount} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger,placePaperOrder,updatePaperProtection,updatePaperOrderPrice,processPaperQuote} from '../src/lib/paperTrading.ts';
import {executableBook,executablePrint} from '../public/heatmap-app/src/trading-bridge.js';
const root=new URL('../',import.meta.url);
const now=Date.now();
const snapshot={readOnly:true,bestBid:120000,bestAsk:120001,tickSize:.25,timestamp:now};
const account=createPaperTradingAccount({name:'Isolated LIQ MAP test',balance:100000,leverage:'1:30',instrument:'All CME Futures'});
function placed(type='market',side='buy'){
 const result=placePaperOrder(emptyPaperTradingLedger(),[account],{accountId:account.id,symbol:'NQ',side,type,quantity:1,price:type==='market'?undefined:29990,stopLoss:29980,takeProfits:[{price:30020,quantity:1}]},{bid:30000,ask:30000.25,timestamp:now});
 assert.equal(result.error,undefined);return result.ledger;
}
const levels=(ledger,symbol='NQ.v.0',id=account.id)=>liquidityMapTradeLevels(symbol,id,ledger.accounts[account.id].positions,ledger.accounts[account.id].orders);
test('map views the exact shared account and instrument, never micros or another account',()=>{
 const ledger=placed();assert.equal(levels(ledger).length,3);
 assert.equal(levels(ledger,'MNQ.v.0').length,0);assert.equal(levels(ledger,'ES.v.0').length,0);assert.equal(levels(ledger,'NQ','other-account').length,0);
 assert.equal(levels(ledger)[0].draggable,false);assert.ok(levels(ledger).slice(1).every(l=>l.draggable));
});
test('SL/TP edits immediately mirror the normal-chart ledger and real quote triggers the moved target',()=>{
 let ledger=placed();const position=ledger.accounts[account.id].positions[0];
 for(const [kind,price] of [['stop_loss',29985],['take_profit',30010]]){
  const level=levels(ledger).find(l=>l.kind===kind);
  const result=updatePaperProtection(ledger,account.id,level.ownerId,{kind,targetId:level.targetId,price});assert.equal(result.error,undefined);ledger=result.ledger;
  assert.equal(levels(ledger).find(l=>l.kind===kind).price,price);
 }
 assert.equal(ledger.accounts[account.id].positions[0].stopLoss,29985);
 assert.equal(ledger.accounts[account.id].positions[0].takeProfits[0].price,30010);
 const held=processPaperQuote(ledger,[account],'NQ',{bid:30010,ask:30010.25,timestamp:now+1},{executionAuthorized:true,suspendedProtectionPositionIds:new Set([position.id])});
 assert.ok(held.accounts[account.id].positions.some(p=>p.remainingQuantity>0));
 const reset=processPaperQuote(held,[account],'NQ',{bid:30005,ask:30005.25,timestamp:now+2},{executionAuthorized:true});
 const closed=processPaperQuote(reset,[account],'NQ',{bid:30010,ask:30010.25,timestamp:now+3},{executionAuthorized:true});
 assert.equal(levels(closed).length,0);assert.ok(closed.accounts[account.id].fills.some(f=>f.role==='take_profit'));
});
test('working entries are movable and retain their protection; completed targets are omitted',()=>{
 let ledger=placed('limit');assert.equal(levels(ledger)[0].resting,true);assert.equal(levels(ledger)[0].draggable,true);
 const order=ledger.accounts[account.id].orders[0];ledger=updatePaperOrderPrice(ledger,account.id,order.id,29991);
 assert.equal(levels(ledger)[0].price,29991);assert.equal(levels(ledger).find(l=>l.kind==='stop_loss').price,29980);
 const open=placed();open.accounts[account.id].positions[0].takeProfits[0].filledQuantity=1;
 assert.equal(levels(open).filter(l=>l.kind==='take_profit').length,0);
});
test('only genuine fresh executable books and trade prints are forwarded, never visual or archive frames',()=>{
 const book=executableBook(snapshot,'NQ',{},now);assert.equal(book.bid,30000);assert.equal(book.ask,30000.25);assert.equal(book.last,undefined);
 for(const metadata of [{historical:true},{visualHold:true}])assert.equal(executableBook(snapshot,'NQ',metadata,now),null);
 for(const patch of [{timestamp:now-5001},{timestamp:now+1001},{bestBid:NaN},{bestAsk:119999},{tickSize:0},{readOnly:false}])assert.equal(executableBook({...snapshot,...patch},'NQ',{},now),null);
 const print=executablePrint(book,120004,now+1,.25,'NQ',now+1);assert.equal(print.last,30001);
 assert.equal(executablePrint(book,120004,now+5001,.25,'NQ',now+5001),null);
 assert.equal(executablePrint(book,120004,now+1,.25,'MNQ',now+1),null);
});
test('host rejects stale/cross-symbol/untrusted-source prices and snaps picks to contract ticks',()=>{
 const book=executableBook(snapshot,'NQ',{},now);const quote=liquidityMapExecutionQuote(book,'NQ.v.0','map-pane',now);
 assert.equal(quote.paneId,'map-pane');assert.equal(quote.source,'live');assert.equal(quote.receivedAt,now);
 for(const patch of [{symbol:'MNQ'},{source:'replay'},{ask:1},{bid:Infinity},{timestamp:now-5001},{timestamp:now+1001}])assert.equal(liquidityMapExecutionQuote({...book,...patch},'NQ','map',now),null);
 assert.equal(liquidityMapPickedPrice('NQ',30000.12),30000);for(const value of [NaN,Infinity,0,-1,'30000'])assert.equal(liquidityMapPickedPrice('NQ',value),null);
});
test('both map mounts use the shared ticket handlers; messages and drag ownership are scoped',()=>{
 const workspace=readFileSync(new URL('src/components/KwantifyWorkspace.tsx',root),'utf8');
 const bridge=readFileSync(new URL('src/components/liquidity-map/LiquidityMapTrading.tsx',root),'utf8');
 assert.match(workspace,/trading=\{liquidityMapTrading\(pane.id\)\}/);assert.match(workspace,/trading=\{liquidityMapTrading\(activePaneId\)\}/);
 assert.match(workspace,/if \(mapTicketContext\) return null/);assert.match(workspace,/quote.last === previous.last/);
 for(const callback of ['handlePaperProtectionUpdate','handlePaperOrderPriceUpdate','handlePaperProtectionDragStateChange','handleActiveChartExecutionQuote'])assert.ok(workspace.includes(callback));
 assert.match(bridge,/event.source !== iframeRef.current\?\.contentWindow/);assert.match(bridge,/event.origin !== window.location.origin/);
 assert.match(bridge,/d.scope === state.scope/);assert.match(bridge,/setPointerCapture/);assert.match(bridge,/finally \{ cancelDrag\(\); \}/);
 assert.match(bridge,/onLostPointerCapture=\{cancelDrag\}/);assert.match(bridge,/previous\?\.release\(\)/);
 assert.doesNotMatch(bridge,/localStorage|fetch\(|setInterval/);
});
test('armed map clicks request host confirmation only inside the live plot; replay/pan/axis clicks cannot place',()=>{
 const main=readFileSync(new URL('public/heatmap-app/src/main.js',root),'utf8');
 const code=main.slice(main.indexOf('  #pointerDown(event) {')+'  #pointerDown(event) {'.length,main.indexOf('    if (event.button !== 0) return;',main.indexOf('  #pointerDown(event) {'))).replace('this.#canvasPoint(event)','this.point(event)');
 const messages=[];const pick=vm.runInNewContext(`(function(event){${code}})`,{window:{parent:{postMessage:value=>messages.push(value)},location:{origin:'https://kwantdesk.test'}}});
 const state={tradingIntent:{armed:{type:'limit'},symbol:'NQ',scope:'account:NQ:false'},symbol:'NQ',replay:{active:false},atLive:true,playing:true,tool:'crosshair',point:()=>({x:100,y:100}),renderer:{layout:{plotWidth:500,plotHeight:400,tickForY:()=>120001,config:{tickSize:.25}}}};
 pick.call(state,{button:0,preventDefault(){}});assert.equal(messages.length,1);assert.equal(messages[0].price,30000.25);assert.equal(messages[0].scope,'account:NQ:false');
 for(const patch of [{replay:{active:true}},{atLive:false},{playing:false},{tool:'pan'},{tool:'measure'},{symbol:'ES'},{point:()=>({x:510,y:100})},{point:()=>({x:100,y:450})}])pick.call({...state,...patch},{button:0,preventDefault(){}});
 assert.equal(messages.length,1);assert.equal(messages[0].type,'kwantdesk:liquidity-map-order-pick');
});
