import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {createPaperTradingAccount} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger,placePaperOrder,normalizePaperSymbol} from '../src/lib/paperTrading.ts';
import {processPaperExecutionTape} from '../src/lib/paperExecutionTape.ts';

test('actual workspace protection precedes failing chart/quote consumers and keeps a one-print touch at its exact tick',async()=>{
  const before={window:globalThis.window,Worker:globalThis.Worker,error:console.error};
  let worker,reports=0,acks=0;
  class FakeWorker {
    callbacks=new Map();
    constructor(){worker=this;}
    addEventListener(name,fn){this.callbacks.set(name,fn);}
    postMessage(message){if(message.type==='ack')acks++;}
    emit(message){this.callbacks.get('message')({data:message,currentTarget:this});}
  }
  globalThis.window={};globalThis.Worker=FakeWorker;console.error=()=>reports++;
  const source=ts.createSourceFile('workspace.tsx',fs.readFileSync('src/components/KwantifyWorkspace.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let args;const visit=node=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==='subscribeRithmicIndicatorTrades'
      &&node.arguments[0]?.getText(source).includes('processPaperExecutionTape(current'))args=node.arguments[0];
    ts.forEachChild(node,visit);
  };visit(source);assert.ok(args);assert.ok(args.getText(source).includes('executionPriority: true'));
  const time=1790000000000;
  try {
    const {subscribeRithmicIndicatorTrades}=await import('../src/lib/rithmicIndicatorStream.ts');
    for(const side of ['buy','sell'])for(const role of ['take_profit','stop_loss']){
      const record=createPaperTradingAccount({name:'isolated priority fixture',balance:250000,leverage:'1:1',instrument:'NQ'});
      const opened=placePaperOrder(emptyPaperTradingLedger(),[record],{accountId:record.id,symbol:'NQ',side,type:'market',quantity:1,price:null,
        stopLoss:side==='buy'?29790:29810,takeProfits:[{price:side==='buy'?29810:29790,quantity:1}]},{bid:29800,ask:29800,last:29800,timestamp:time});
      assert.equal(opened.error,undefined);
      const events=[];const ref={current:opened.ledger};
      const fills=()=>ref.current.accounts[record.id].fills.filter(f=>f.role!=='entry');
      const stopChart=subscribeRithmicIndicatorTrades({symbol:'NQ',contractSymbol:'NQZ6',onTrades:()=>{events.push('chart');assert.equal(fills().length,1);throw Error('failed chart');}});
      const context=vm.createContext({symbol:'NQ',contractSymbol:'NQZ6',paperLiveExecutionEnabledRef:{current:true},paperLedgerRef:ref,
        paperJournalAccountsRef:{current:[record]},suspendedPaperProtectionIdsRef:{current:new Set()},normalizePaperSymbol,processPaperExecutionTape,
        paperLedgerExecutionShapeChanged:()=>true,schedulePaperJournalSync:()=>events.push('journal'),syncPaperLedgerUi:()=>events.push('ledger'),
        paperTradeExecutionQuote:()=>({last:29800}),publishLiveExecutionQuote:()=>{events.push('quote');throw Error('failed quote listener');},
      });
      vm.runInContext(ts.transpileModule(`var subscription=${args.getText(source)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
      const stopPaper=subscribeRithmicIndicatorTrades(context.subscription);
      const stopObserver=subscribeRithmicIndicatorTrades({symbol:'NQ',contractSymbol:'NQZ6',onTrades:()=>events.push('observer')});
      try {
        const hit=(side==='buy')===(role==='take_profit')?29810:29790;
        const records=[hit,29800].map((close,i)=>({timestamp:time+1,recordIndex:i,eventId:`${side}:${role}:${i}`,open:close,high:close,low:close,close,volume:1,trades:1}));
        const previousAcks=acks;
        worker.emit({type:'trades',key:'NQ:NQZ6',records});
        assert.deepEqual(events,['journal','ledger','quote','chart','observer']);
        assert.equal(fills()[0].price,hit);assert.equal(fills()[0].role,role);assert.equal(acks,previousAcks+1);
        worker.emit({type:'trades',key:'NQ:NQZ6',records});assert.equal(fills().length,1);
      }finally{stopObserver();stopPaper();stopChart();}
    }
    assert.equal(reports,8,'report once for each failing paper quote/chart subscriber, never once per tick');
  }finally{
    console.error=before.error;
    for(const name of ['window','Worker'])if(before[name]===undefined)delete globalThis[name];else globalThis[name]=before[name];
  }
});
