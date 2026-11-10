import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {copyJournalTrades} from '../src/lib/journalCopyRequest.ts';

test('copy returns only server-confirmed rows and sends the chosen account and trade IDs',async()=>{
 const rows=[{id:'copy'}];let body;
 const result=await copyJournalTrades('review',['one'],async(_url,options)=>{body=JSON.parse(options.body);return Response.json({cloud:true,trades:rows,skipped:0})});
 assert.deepEqual(body,{action:'copy-trades',accountId:'review',tradeIds:['one']});assert.deepEqual(result.trades,rows);
});
for(const phase of ['fetch','body'])test(`a stalled ${phase} stops the import wait and never confirms unsaved trades`,async()=>{
 let signal;const stalled=async(_url,options)=>{signal=options.signal;return phase==='fetch'?new Promise(()=>{}):{ok:true,json:()=>new Promise(()=>{})}};
 await assert.rejects(copyJournalTrades('review',['one'],stalled,20),/confirmation took too long/);assert.equal(signal.aborted,true);
});
test('HTML failures and missing cloud acknowledgements produce a retryable error',async()=>{
 for(const response of [new Response('<html>timeout</html>',{status:504}),Response.json({trades:[{id:'unconfirmed'}]})]){
  await assert.rejects(copyJournalTrades('review',['one'],async()=>response),/could not be imported/);
 }
});
test('the server client shares one abort budget across journal database requests and preserves caller cancellation',async()=>{
 const code=ts.transpileModule(readFileSync('src/lib/supabase/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let options,calls=0;const exports={};
 vm.runInNewContext(code,{exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture'}},AbortSignal,Request,Response,fetch:async(_input,init)=>{calls++;return new Promise((_r,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))},require:id=>id==='@supabase/ssr'?{createServerClient:(_u,_k,o)=>{options=o;return o}}:id==='next/headers'?{cookies:async()=>({getAll:()=>[],set(){}})}:(()=>{throw Error(id)})()});
 const deadline=new AbortController();await exports.createClient({requestSignal:deadline.signal});
 const first=options.global.fetch('https://fixture.supabase.co/rest/v1/journal_trades');deadline.abort();
 assert.equal((await first).status,408);assert.equal((await options.global.fetch('https://fixture.supabase.co/rest/v1/journal_accounts')).status,408);assert.equal(calls,1,'no retry or second remote request after expiry');
 const next=new AbortController();await exports.createClient({requestSignal:next.signal});const caller=new AbortController();const cancelled=options.global.fetch('https://fixture.supabase.co/rest/v1/journal_trades',{signal:caller.signal});caller.abort();await assert.rejects(cancelled,/aborted/);assert.equal(next.signal.aborted,false);
});
