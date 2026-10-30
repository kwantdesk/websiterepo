import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError} from '../src/lib/middlewareAuth.ts';
const source=readFileSync(new URL('../middleware.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function harness({configured=true,granted=true}={}){
 let authCalls=0;
 const exports={},response={next:true};
 const context={exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test'}},URL,require(name){
  if(name==='next/server')return{NextResponse:{next:()=>response,json:(body,options)=>({body,...options}),redirect:()=>({redirect:true})}};
  if(name==='@supabase/ssr')return{createServerClient:()=>({auth:{getUser:async()=>{authCalls++;return{data:{user:null}}}}})};
  if(name==='@/lib/siteAccess')return{SITE_ACCESS_COOKIE:'gate',isSiteAccessConfigured:()=>configured,isValidSiteAccessToken:async()=>granted};
  if(name==='@/lib/middlewareAuth')return{createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError};
  throw Error(name);
 }};
 vm.runInNewContext(code,context);
 const run=(operation,method='GET')=>exports.middleware({method,nextUrl:{pathname:'/api/kwanty/'+operation,hostname:'www.kwantdesk.com'},url:'https://www.kwantdesk.com/api/kwanty/'+operation,cookies:{get:()=>({value:'signed-gate'}),getAll:()=>[]}});
 return{run,get authCalls(){return authCalls}};
}
test('only known read-only Kwanty operations avoid duplicate middleware remote auth after valid site gate',async()=>{
 const h=harness();for(const operation of ['status','catalog','snapshot','history','session'])assert.equal((await h.run(operation)).next,true);
 assert.equal(h.authCalls,0);
 for(const [operation,method]of [['snapshot','POST'],['snapshot/other','GET'],['unknown','GET']])assert.equal((await h.run(operation,method)).status,401);
 assert.equal(h.authCalls,3);
});
test('missing or rejected site access never uses the Kwanty read fast path',async()=>{
 const rejected=harness({granted:false});assert.equal((await rejected.run('history')).status,401);assert.equal(rejected.authCalls,0);
 const unconfigured=harness({configured:false});assert.equal((await unconfigured.run('history')).status,401);assert.equal(unconfigured.authCalls,1);
});
test('Kwanty route still requires a server-verified account before any operation or data fetch',()=>{
 const route=readFileSync(new URL('../src/app/api/kwanty/[operation]/route.ts',import.meta.url),'utf8');
 assert.match(route,/const actor=await getRouteActor\(request\)/);
 assert.match(route,/if\(!actor\|\|\(process.env.VERCEL&&actor.mode==="local-dev"\)\)return NextResponse.json/);
 assert.ok(route.indexOf('const actor=await getRouteActor(request)')<route.indexOf('const {operation}=await params'));
});
