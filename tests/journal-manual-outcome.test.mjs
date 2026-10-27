import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {journalManualOutcome} from '../src/lib/journalManualOutcome.ts';
import {calculateJournalStats,calculateJournalExecutionStats} from '../src/lib/journal.ts';
import {parseJournalSpreadsheetFile} from '../src/lib/journalSpreadsheet.ts';
import {appendPaperTradesToJournal} from '../src/lib/paperJournal.ts';
import {createPaperTradingAccount} from '../src/lib/paperAccounts.ts';
import {emptyPaperTradingLedger} from '../src/lib/paperTrading.ts';
import {saveJournalState,loadJournalState} from '../src/lib/journalStore.ts';

const draft=netPnl=>({netPnl,symbol:'',side:'',quantity:'',openedAt:'',closedAt:''});
const outcome=(pnl,overrides={})=>journalManualOutcome({...draft(pnl),...overrides},'2026-10-20');
test('profit alone records an outcome without inventing execution details',()=>{
 const trade=outcome('125.50');
 assert.equal(trade.netPnl,125.5); assert.equal(trade.symbol,'UNSPECIFIED');
 assert.equal(trade.side,'UNKNOWN'); assert.equal(trade.quantity,0);
 assert.equal(trade.entryTimeKnown,false);assert.equal(trade.exitTimeKnown,false);
 assert.equal(trade.durationMs,null);assert.equal(trade.closedAt,null);
 assert.equal(new Date(trade.openedAt).getDate(),20);
});
test('losses and breakeven count correctly alongside existing results',()=>{
 const trades=['100','-40','0'].map((pnl,i)=>({...outcome(pnl),id:String(i),initialRisk:null,rMultiple:null,reviewedAt:null}));
 const stats=calculateJournalStats(trades);
 assert.equal(stats.tradeCount,3); assert.equal(stats.netPnl,60);
 assert.equal(stats.profitFactor,2.5);assert.equal(stats.expectancy,20);
 assert.equal(stats.maxDrawdown,40);assert.equal(stats.averageR,null);
 const execution=calculateJournalExecutionStats(trades);
 assert.equal(execution.averageHoldMs,null);assert.equal(execution.averageFavourableExcursion,null);
});
test('optional execution times establish hold only when both are known',()=>{
 assert.equal(outcome('10',{closedAt:'2026-10-19T09:05:00'}).durationMs,null);
 assert.equal(outcome('10',{openedAt:'2026-10-19T09:00:00',closedAt:'2026-10-19T09:05:00',symbol:'es',side:'LONG',quantity:'2'}).durationMs,300000);
 assert.throws(()=>outcome('10',{openedAt:'2026-10-19T10:00:00',closedAt:'2026-10-19T09:00:00'}),/before/);
 for(const pnl of ['', ' ', 'abc','Infinity'])assert.throws(()=>outcome(pnl));
 assert.throws(()=>outcome('10',{quantity:'-1'}));
});
test('manual outcomes survive demo reconciliation and a saved journal reload',async()=>{
 const record=createPaperTradingAccount({name:'20 october',balance:50000,leverage:'1:30',instrument:'ES'});
 const trade={...outcome('-75'),id:'manual:fixture',account:'20 october',sourceImportId:'manual:fixture'};
 const state={version:1,accounts:[],trades:[trade],imports:[],evidence:[]};
 const ledger=emptyPaperTradingLedger(),before=JSON.stringify(ledger);
 const next=appendPaperTradesToJournal(state,[record],ledger);
 assert.equal(next.accounts[0].source,'paper');assert.equal(next.trades[0],trade);
 assert.equal(JSON.stringify(ledger),before);
 await saveJournalState('manual-outcome-fixture',next);
 const restored=await loadJournalState('manual-outcome-fixture');
 assert.equal(restored.trades[0].netPnl,-75);assert.equal(restored.trades[0].quantity,0);
});
test('HTML table exports still import into the selected demo journal',async()=>{
 const html='<html><body><table><tr><th>Entry Time</th><th>Exit Time</th><th>Symbol</th><th>Side</th><th>Quantity</th><th>Entry Price</th><th>Exit Price</th><th>Net Pnl</th></tr><tr><td>2026-10-20T09:00:00Z</td><td>2026-10-20T09:05:00Z</td><td>ES</td><td>LONG</td><td>1</td><td>7700</td><td>7701</td><td>48</td></tr></table></body></html>';
 const buffer=new TextEncoder().encode(html).buffer;
 const result=await parseJournalSpreadsheetFile('statement.html',buffer,'20 october','html-test');
 assert.equal(result.trades.length,1);assert.equal(result.trades[0].netPnl,48);
 assert.equal(result.trades[0].account,'20 october');
});
test('actual create-trade route accepts owned demo/import/manual journals and rejects mismatched accounts or invalid profit',async()=>{
 const source=fs.readFileSync('src/app/api/journal/route.ts','utf8');
 const block=source.slice(source.indexOf('  if (action === "create-trade")'),source.indexOf('  if (action === "save-evidence")'));
 const writes=[];let row={id:'paper-test',name:'20 october',source:'import'};
 const filters=[];
 const supabase={from(table){return {select(){return this},eq(key,value){filters.push([key,value]);return this},async maybeSingle(){return {data:row}},async upsert(payload){writes.push({table,payload});return {error:null}}}}};
 const code=ts.transpileModule(`(async (body)=>{const action='create-trade';${block}})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const run=vm.runInNewContext(code,{
  supabase,actor:{userId:'owner'},cleanText:x=>x,cleanId:x=>x,accountId:x=>x,
  isZyonJournalAccountName:x=>x==='ZYON Journal',sanitizeTrade:x=>x,
  NextResponse:{json:(body,options)=>({body,status:options?.status??200})},
 });
 const body={account:'20 october',accountId:'paper-test',trade:{id:'manual-result',sourceImportId:'manual:result',netPnl:125}};
 for(const source of ['import','manual','paper']){row={...row,source};assert.equal((await run(body)).status,200);}
 assert.ok(filters.some(([key,value])=>key==='user_id'&&value==='owner'));
 assert.ok(writes.every(w=>w.table==='journal_trades'&&w.payload.account_id==='paper-test'));
 row={...row,name:'another journal'};assert.equal((await run(body)).status,400);
 assert.equal((await run({...body,trade:{...body.trade,netPnl:null}})).status,400);
 assert.equal((await run({...body,account:'ZYON Journal'})).status,400);
});
