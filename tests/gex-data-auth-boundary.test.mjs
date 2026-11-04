import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError,middlewareAuthRecoveryHtml} from '../src/lib/middlewareAuth.ts';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('only site-gated exact GEX Data query routes delegate account verification to their handler',async()=>{
 let calls=0,granted=true;const exports={};
 vm.runInNewContext(compile(readFileSync('middleware.ts','utf8')),{exports,URL,Response,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture'}},require:id=>{
  if(id==='next/server')return{NextResponse:{next:()=>({next:true}),json:(body,init)=>({body,...init}),redirect:()=>({redirect:true})}};
  if(id==='@supabase/ssr')return{createServerClient:()=>({auth:{getUser:async()=>{calls++;return{data:{user:null},error:null}},getClaims:async()=>{calls++;return{data:null,error:null}}}})};
  if(id==='@/lib/siteAccess')return{SITE_ACCESS_COOKIE:'gate',isSiteAccessConfigured:()=>true,isValidSiteAccessToken:async()=>granted};
  if(id==='@/lib/middlewareAuth')return{createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError,middlewareAuthRecoveryHtml};throw Error(id);
 }});
 const run=(pathname,method)=>exports.middleware({method,url:'https://fixture.test'+pathname,nextUrl:{pathname,hostname:'fixture.test'},cookies:{get:()=>({value:'signed'}),getAll:()=>[]}});
 for(const [path,method]of [['/api/gex-data/status','GET'],['/api/gex-data/net-drift','POST'],['/api/gex-data/heat-map-history','POST']])assert.equal((await run(path,method)).next,true);
 assert.equal(calls,0);
 for(const [path,method]of [['/api/preferences','POST'],['/api/gex-data/net-drift/write','POST'],['/api/gex-data/net-drift','DELETE'],['/api/gex-data/net-drift','GET']])assert.equal((await run(path,method)).status,401);
 assert.equal(calls,4);granted=false;assert.equal((await run('/api/gex-data/net-drift','POST')).status,401);assert.equal(calls,4);
});
test('GEX Data query handler refuses absent accounts and auth-service failures before market-data IO',async()=>{
 for(const file of ['src/app/api/gex-data/[tool]/route.ts','src/app/api/gex-data/heat-map-history/route.ts'])for(const failure of [false,true]){
  let external=0;const exports={};const auth=[];
  vm.runInNewContext(compile(readFileSync(file,'utf8')),{exports,process:{env:{VERCEL:'1'}},require:id=>{
   if(id==='next/server')return{NextResponse:{json:(body,init)=>({body,...init})}};
   if(id==='@/lib/serverAuth')return{getRouteActor:async(_request,opts)=>{auth.push(opts);if(failure)throw Error('dependency unavailable');return null}};
   if(id==='node:crypto')return{createHash(){external++;throw Error('unexpected IO')}};
   return new Proxy({},{get:()=>()=>{external++;throw Error('unexpected IO')}});
  }});
  const response=await exports.POST({},{});assert.equal(response.status,failure?503:401);assert.equal(external,0);assert.equal(auth[0].timeoutMs,5000);
  if(failure){assert.equal(response.body.code,'AUTH_SERVICE_UNAVAILABLE');assert.equal(response.headers['Retry-After'],'2');}
 }
});
