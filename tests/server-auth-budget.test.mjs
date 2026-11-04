import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError} from '../src/lib/middlewareAuth.ts';
const code=ts.transpileModule(readFileSync('src/lib/serverAuth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(result){const exports={};let fetcher;vm.runInNewContext(code,{exports,Buffer,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture'}},require:id=>{
 if(id==='node:crypto')return{timingSafeEqual(){}};
 if(id==='next/headers')return{cookies:async()=>({getAll:()=>[]})};
 if(id==='@/lib/middlewareAuth')return{createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError};
 if(id==='@supabase/ssr')return{createServerClient:(_u,_k,opts)=>{fetcher=opts.global?.fetch;return{auth:{getUser:async()=>typeof result==='function'?result():result}}}};
 throw Error(id);
 }});return{read:exports.getRouteActor,get fetcher(){return fetcher}};}
test('bounded read actor still requires a server-verified user',async()=>{
 const h=fixture({data:{user:{id:'owner',email:'owner@test',user_metadata:{}}},error:null});const actor=await h.read(undefined,{timeoutMs:50});assert.equal(actor.userId,'owner');assert.equal(typeof h.fetcher,'function');
 assert.equal(await fixture({data:{user:null},error:{status:401}}).read(undefined,{timeoutMs:50}),null);
});
test('temporary and stalled remote checks fail closed as unavailable, not a fake signed-out identity',async()=>{
 for(const result of [{data:{user:null},error:{status:503}},()=>new Promise(()=>{})])await assert.rejects(fixture(result).read(undefined,{timeoutMs:20}),/temporarily unavailable/);
});
