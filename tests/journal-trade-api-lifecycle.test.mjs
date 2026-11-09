import{execFileSync}from'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import * as crypto from 'node:crypto';import * as journal from '../src/lib/journal.ts';
const compiled=ts.transpileModule((process.env.JOURNAL_BASELINE?execFileSync('git',['show','HEAD:src/app/api/journal/route.ts'],{encoding:'utf8'}):fs.readFileSync(new URL('../src/app/api/journal/route.ts',import.meta.url),'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const user='owner',other='other';const account={user_id:user,id:'flow',name:'Olisa Flow 06-11-2026',source:'manual',created_at:'2026-11-06T00:00:00Z',updated_at:'2026-11-06T00:00:00Z'};
const trade=(id,extra={})=>({id,account:account.name,symbol:'NQ',side:'LONG',openedAt:'2026-11-06T14:00:00Z',closedAt:'2026-11-06T14:05:00Z',netPnl:100,sourceImportId:'manual:'+id,sourceFile:'KwantDesk Manual',...extra});
function fixture(){
 const db={journal_accounts:[structuredClone(account)],journal_trades:[],journal_imports:[],social_objects:[]};let failedDeletionWrite=false,failedDeletionRead=false;
 const get=(row,key)=>key.replaceAll('->>','.').replaceAll('->','.').split('.').reduce((v,k)=>v?.[k],row);
 class Query{
  filters=[];op='read';input=null;options={};single=false;lo=0;hi=Infinity;sorts=[];
  constructor(table){this.table=table}
  select(){return this}eq(k,v){this.filters.push(r=>get(r,k)===v);return this}in(k,values){this.filters.push(r=>values.includes(get(r,k)));return this}
  or(value){const options=value.split(',').map(x=>x.match(/^(.*?)\.eq\.(.*)$/).slice(1));this.filters.push(r=>options.some(([k,v])=>get(r,k)===v));return this}
  order(k,opt={}){this.sorts.push([k,opt.ascending!==false]);return this}range(lo,hi){this.lo=lo;this.hi=hi;return this}limit(n){this.hi=n-1;return this}
  maybeSingle(){this.single=true;return this}upsert(rows,options){this.op='upsert';this.input=Array.isArray(rows)?rows:[rows];this.options=options??{};return this}update(row){this.op='update';this.input=row;return this}delete(){this.op='delete';return this}
  then(resolve,reject){try{
   if(this.table==='social_objects'&&((this.op==='upsert'&&failedDeletionWrite&&this.input.some(r=>r.payload?.kind==='journal-trade-deletion-v1'))||(this.op==='read'&&failedDeletionRead)))return Promise.resolve({data:null,error:{code:'TEST',message:'offline'}}).then(resolve,reject);
   let rows=db[this.table].filter(r=>this.filters.every(fn=>fn(r)));
   if(this.op==='upsert'){for(const row of this.input){const index=db[this.table].findIndex(r=>r.user_id===row.user_id&&r.id===row.id);if(index<0)db[this.table].push(structuredClone(row));else if(!this.options.ignoreDuplicates)db[this.table][index]={...db[this.table][index],...structuredClone(row)}}}
   if(this.op==='update')for(const row of rows)Object.assign(row,structuredClone(this.input));
   if(this.op==='delete')db[this.table]=db[this.table].filter(r=>!rows.includes(r));
   for(const[k,asc]of [...this.sorts].reverse())rows.sort((a,b)=>(String(get(a,k)??'').localeCompare(String(get(b,k)??'')))*(asc?1:-1));
   rows=rows.slice(this.lo,this.hi===Infinity?undefined:this.hi+1);
   return Promise.resolve({data:this.single?(rows[0]??null):rows,error:null}).then(resolve,reject);
  }catch(e){return Promise.reject(e).then(resolve,reject)}}
 }
 const client={from:table=>new Query(table)},exports={};
 vm.runInNewContext(compiled,{exports,require:name=>name==='node:crypto'?crypto:name==='next/server'?{NextResponse:{json:(body,options={})=>Response.json(body,options)}}:name.includes('supabase/server')?{createClient:async()=>client}:name.includes('serverAuth')?{getJournalRouteActor:async request=>request.headers.get('x-test-owner')===other?{userId:other,label:'Other'}:{userId:user,label:'Owner'}}:name.includes('journal')?journal:(()=>{throw Error(name)})(),console,Date,Set,Map,Response});
 const request=(method,path='/api/journal',body,owner=user)=>{const r=new Request('https://www.kwantdesk.com'+path,{method,headers:{'content-type':'application/json','x-test-owner':owner},...(body?{body:JSON.stringify(body)}:{})});r.nextUrl=new URL(r.url);return r};
 return {db,api:exports,request,failWrite:()=>failedDeletionWrite=true,failRead:()=>failedDeletionRead=true,seed(t,owner=user){db.journal_trades.push({user_id:owner,id:t.id,account_id:'flow',source_import_id:t.sourceImportId,opened_at:t.openedAt,closed_at:t.closedAt,payload:structuredClone(t)})}};
}
test('real create/read API durably returns a backdated manual outcome in its journal and Overall',async()=>{const h=fixture();const r=await h.api.POST(h.request('POST',undefined,{action:'create-trade',account:account.name,accountId:'flow',trade:trade('saved')}));assert.equal(r.status,200);const saved=await r.json();assert.ok(saved.trade.recordedAt);const state=await(await h.api.GET(h.request('GET'))).json();assert.equal(state.trades.length,1);assert.equal(journal.uniqueJournalOutcomes(state.trades).length,1);assert.equal(state.trades[0].account,account.name)});

test('copy API skips an outcome already file-imported under a different destination row ID',async()=>{
 const h=fixture();h.db.journal_accounts.push({...account,id:'review',name:'Review'});
 h.seed(trade('source',{fingerprint:'same-outcome'}));
 h.seed(trade('separate-file-id',{account:'Review',fingerprint:'same-outcome'}));h.db.journal_trades.at(-1).account_id='review';
 const before=JSON.stringify(h.db.journal_trades);
 const r=await h.api.POST(h.request('POST',undefined,{action:'copy-trades',accountId:'review',tradeIds:['source']}));
 assert.equal(r.status,200);const body=await r.json();assert.deepEqual(body.trades,[]);assert.equal(body.skipped,1);
 assert.equal(JSON.stringify(h.db.journal_trades),before,'existing records and reviews are untouched');
});

test('copy duplicate check respects journal reset visibility and owner isolation',async()=>{
 for(const reset of [false,true]){
  const h=fixture();h.db.journal_accounts.push({...account,id:'review',name:'Review'});
  h.seed(trade('source',{fingerprint:'same-outcome'}));
  h.seed(trade('old-import',{account:'Review',fingerprint:'same-outcome'}),reset?user:other);h.db.journal_trades.at(-1).account_id='review';
  if(reset)h.db.social_objects.push({user_id:user,id:'journal-account-state:review',payload:{resetAt:'2026-11-07T00:00:00Z'}});
  const before=h.db.journal_trades.length;
  const r=await h.api.POST(h.request('POST',undefined,{action:'copy-trades',accountId:'review',tradeIds:['source']}));
  assert.equal(r.status,200);assert.equal(h.db.journal_trades.length,before+1);
 }
});
test('real delete API hides original and all copies, retains recoverable rows and blocks stale upload revival',async()=>{const h=fixture(),original=trade('original'),copy=trade('journal-copy:one',{journalCopy:{originalTradeId:'original',sourceJournal:account.name,importedAt:new Date().toISOString()}});h.seed(original);h.seed(copy);h.seed(trade('keep'));h.seed(trade('original'),other);h.db.social_objects.push({user_id:user,id:'post',object_type:'post',payload:{kind:'TRADE',trade:{journalTradeId:copy.id}}});const response=await h.api.DELETE(h.request('DELETE','/api/journal?tradeId='+encodeURIComponent(copy.id)));assert.equal(response.status,200);const deleted=await response.json();assert.ok(deleted.deletedTradeIds.includes('original'));assert.equal(deleted.linkedPostsDeleted,1);assert.equal(h.db.journal_trades.length,4,'source rows remain recoverable');let visible=await(await h.api.GET(h.request('GET'))).json();assert.deepEqual(visible.trades.map(t=>t.id),['keep']);const stale=await h.api.POST(h.request('POST',undefined,{action:'sync',account:account.name,accountId:'flow',trades:[original,copy]}));assert.equal(stale.status,200);visible=await(await h.api.GET(h.request('GET'))).json();assert.deepEqual(visible.trades.map(t=>t.id),['keep']);assert.equal((await(await h.api.GET(h.request('GET',undefined,undefined,other))).json()).trades.length,1)});
test('stale recovery synchronization cannot overwrite a saved review or move its trade date',async()=>{const h=fixture();const latest=trade('original',{notes:'reviewed',netPnl:500,recordedAt:'2026-11-09T00:00:00Z'});h.seed(latest);await h.api.POST(h.request('POST',undefined,{action:'sync',account:account.name,accountId:'flow',trades:[trade('original',{notes:'old',netPnl:0})]}));assert.equal(h.db.journal_trades[0].payload.notes,'reviewed');assert.equal(h.db.journal_trades[0].payload.netPnl,500);assert.equal(h.db.journal_trades[0].payload.recordedAt,latest.recordedAt)});
test('failed deletion acknowledgement retains the trade instead of claiming it was removed',async()=>{const h=fixture();h.seed(trade('original'));h.failWrite();const r=await h.api.DELETE(h.request('DELETE','/api/journal?tradeId=original'));assert.equal(r.status,502);assert.equal((await(await h.api.GET(h.request('GET'))).json()).trades.length,1)});
test('deletion-history read failure is a failed load, never an empty authoritative journal',async()=>{const h=fixture();h.seed(trade('original'));h.failRead();const r=await h.api.GET(h.request('GET'));assert.equal(r.status,502);assert.equal((await r.json()).trades,undefined)});

test('legacy backdated manual entries recover their real database receipt time',async()=>{const h=fixture();h.seed(trade('legacy'));h.db.journal_trades[0].created_at='2026-11-09T01:00:00Z';h.db.social_objects.push({id:'journal-account-state:flow',user_id:user,object_type:'progress',payload:{kind:'journal-account-state-v1',accountId:'flow',resetAt:'2026-11-08T00:00:00Z'}});const state=await(await h.api.GET(h.request('GET'))).json();assert.equal(state.trades.length,1);assert.equal(state.trades[0].recordedAt,'2026-11-09T01:00:00Z');assert.equal(state.trades[0].openedAt,'2026-11-06T14:00:00Z')});
