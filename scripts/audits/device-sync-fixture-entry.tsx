import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '@/components/KwantifyWorkspace';
import {writeProtectedItem} from '@/lib/browserStorageQuota';
import {createDrawing} from '@/lib/chartDrawTools';
import {createPaperTradingAccount, savePaperTradingAccounts} from '@/lib/paperAccounts';
import {emptyPaperTradingLedger, placePaperOrder, savePaperTradingLedger, loadPaperTradingLedger, updatePaperProtection, closePaperPosition} from '@/lib/paperTrading';

Object.assign(window, { deviceFixture: {
  write: (key: string, value: string) => writeProtectedItem(key,value),
  draw: (paneId: string) => {
    const key='kwantdesk:chart-drawtools:v1',store=JSON.parse(localStorage.getItem(key)||'{}');
    const time=Math.floor(Date.now()/60000)*60-180;
    store[paneId]=[...(store[paneId]||[]),createDrawing('trendLine',[{time,price:6500},{time:time+120,price:6501}])];
    writeProtectedItem(key,JSON.stringify(store));
  },
  openTrade: () => {
    const account=createPaperTradingAccount({name:'Device-only fixture',balance:50000,leverage:'1:30',instrument:'ES'});
    savePaperTradingAccounts([account]);
    const result=placePaperOrder(emptyPaperTradingLedger(),[account],{accountId:account.id,symbol:'ES',side:'buy',type:'market',quantity:1,price:null,stopLoss:6490,takeProfits:[{price:6520,quantity:1}]},{last:6500,bid:6500,ask:6500,timestamp:Date.now()});
    if(result.error)throw Error(result.error); savePaperTradingLedger(result.ledger); return account.id;
  },
  moveStop: (accountId: string) => {const ledger=loadPaperTradingLedger(),position=ledger.accounts[accountId].positions[0];savePaperTradingLedger(updatePaperProtection(ledger,accountId,position.id,{kind:'stop_loss',price:6495}).ledger);},
  closeTrade: (accountId: string) => {const ledger=loadPaperTradingLedger(),position=ledger.accounts[accountId].positions[0];savePaperTradingLedger(closePaperPosition(ledger,accountId,position.id,{last:6501,bid:6501,ask:6501,timestamp:Date.now()}).ledger);},
} });
createRoot(document.getElementById('root')!).render(<Workspace section="charts" embedded/>);
