import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createServerClient} from '@supabase/ssr';
import {createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError} from '../src/lib/middlewareAuth.ts';

const source=readFileSync(new URL('../middleware.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({claims={data:{claims:{sub:'verified-user',email:'verified@example.test'}},error:null}, user={data:{user:{email:'verified@example.test'}},error:null}, granted=true, authFactory, cookies}={}){
  let claimsCalls=0,userCalls=0,options;
  const exports={};
  vm.runInNewContext(code,{exports,URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public'}},require(name){
    if(name==='next/server')return{NextResponse:{next:()=>({next:true}),json:(body,init)=>({body,...init}),redirect:url=>({redirect:String(url)})}};
    if(name==='@/lib/siteAccess')return{SITE_ACCESS_COOKIE:'gate',isSiteAccessConfigured:()=>true,isValidSiteAccessToken:async()=>granted};
    if(name==='@/lib/middlewareAuth')return{createMiddlewareAuthBudget:()=>createMiddlewareAuthBudget(25),isTemporaryMiddlewareAuthError};
    if(name==='@supabase/ssr')return{createServerClient:(url,key,init)=>{options=init;const real=authFactory?.(url,key,init);return real??{auth:{
      getClaims:()=>{claimsCalls++;return typeof claims==='function'?claims():Promise.resolve(claims);},
      getUser:()=>{userCalls++;return typeof user==='function'?user():Promise.resolve(user);},
    }}}};
    throw Error(name);
  }});
  return {run:(path='/charts',method='GET')=>exports.middleware({method,nextUrl:{pathname:path,hostname:'www.kwantdesk.com'},url:'https://www.kwantdesk.com'+path,cookies:{get:()=>({value:'gate'}),getAll:()=>cookies??[
    {name:'unrelated',value:'ignored'},{name:'sb-old-auth-token',value:'ignored'},{name:'sb-project-auth-token.0',value:'part0'},{name:'sb-project-auth-token.1',value:'part1'},
  ]}}),get counts(){return{claimsCalls,userCalls};},get options(){return options;}};
}
test('navigation uses verified claims without waiting for a remote user lookup',async()=>{
  const h=harness({user:()=>new Promise(()=>{})});
  assert.equal((await h.run('/charts')).next,true);
  assert.deepEqual(h.counts,{claimsCalls:1,userCalls:0});
  assert.equal(typeof h.options.global.fetch,'function');
  assert.deepEqual(h.options.cookies.getAll().map(x=>x.name),['sb-project-auth-token.0','sb-project-auth-token.1']);
  h.options.cookies.setAll([{name:'anything',value:'must not be forwarded'}]);
});
test('both Options GETs use verified claims; writes and private APIs retain fresh user checks',async()=>{
  const h=harness();
  for(const path of ['/api/options-flow','/api/options-flow/market-data'])assert.equal((await h.run(path)).next,true);
  for(const [path,method]of [['/api/options-flow','POST'],['/api/preferences','GET'],['/api/preferences','POST'],['/settings','POST']])assert.equal((await h.run(path,method)).next,true);
  assert.deepEqual(h.counts,{claimsCalls:2,userCalls:4});
});
test('site gate rejects before any account verification',async()=>{
  const h=harness({granted:false});assert.equal((await h.run('/api/options-flow')).status,401);
  assert.deepEqual(h.counts,{claimsCalls:0,userCalls:0});
});
test('missing claims, missing subject/email and invalid signatures cannot enter private pages',async()=>{
  for(const claims of [{data:null,error:null},{data:{claims:{email:'x@test'}},error:null},{data:{claims:{sub:'user'}},error:null},{data:null,error:{name:'AuthInvalidJwtError',status:400}}]){
    const h=harness({claims});assert.match((await h.run()).redirect,/\/login\?returnTo=%2Fcharts$/);
    assert.equal((await h.run('/api/options-flow')).status,401);
  }
});
test('hanging key lookup and user lookup fail closed within a bounded routing decision, without login redirect',async()=>{
  for(const [path,args]of [['/charts',{claims:()=>new Promise(()=>{})}],['/api/preferences',{user:()=>new Promise(()=>{})}]]){
    const h=harness(args),start=Date.now(),response=await h.run(path);
    assert.equal(response.status,503);assert.equal(response.body.code,'AUTH_SERVICE_UNAVAILABLE');
    assert.equal(response.redirect,undefined);assert.equal(response.headers['Retry-After'],'2');
    assert.ok(Date.now()-start<1000);
  }
});
test('transient auth service errors do not become expired-session redirects or successful access',async()=>{
  for(const status of [0,408,429,500,503,504]){
    const h=harness({claims:{data:null,error:{status}}});assert.equal((await h.run()).status,503);
  }
});
test('one auth budget aborts a stalled body and makes subsequent SDK retries terminal without more network calls',async()=>{
  let calls=0,aborted=false;
  const budget=createMiddlewareAuthBudget(25,async(_input,init)=>{
    calls++;return new Response(new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>{aborted=true;controller.error(new Error('aborted'));},{once:true});}}));
  });
  await assert.rejects(budget.run(async()=>{const r=await budget.fetch('https://auth.test');return r.json();}),/temporarily unavailable|aborted/);
  assert.equal(aborted,true);assert.equal(budget.expired,true);
  const retry=await budget.fetch('https://auth.test');assert.equal(retry.status,408);assert.equal(calls,1);
});
test('a shared deadline includes SDK lock waits and preserves caller cancellation',async()=>{
  const budget=createMiddlewareAuthBudget(25);
  await assert.rejects(budget.run(()=>new Promise(()=>{})),/temporarily unavailable/);
  const caller=new AbortController();caller.abort();let seen;
  const second=createMiddlewareAuthBudget(100,async(_input,init)=>{seen=init.signal.aborted;throw new Error('caller cancelled');});
  await assert.rejects(second.run(()=>second.fetch('https://auth.test',{signal:caller.signal})),/caller cancelled/);
  assert.equal(seen,true);assert.equal(second.expired,false);
});
test('the actual SDK verifies ES256 signature/expiry and reuses public keys across navigation without user lookups',async()=>{
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'routing-fixture',alg:'ES256',use:'sig'};
  const now=Math.floor(Date.now()/1000);
  async function sign(exp){
    const header=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid:jwk.kid})).toString('base64url');
    const body=Buffer.from(JSON.stringify({iss:'https://project.supabase.co/auth/v1',sub:'fixture-owner',email:'fixture@example.test',aud:'authenticated',role:'authenticated',iat:now,exp})).toString('base64url');
    const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(header+'.'+body));
    return header+'.'+body+'.'+Buffer.from(sig).toString('base64url');
  }
  const valid=await sign(now+3600), expired=await sign(now-60), parts=valid.split('.');
  const tampered=parts.slice(0,2).join('.')+'.'+(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  const original=globalThis.fetch;let keys=0,other=0;
  globalThis.fetch=async input=>{if(String(input).endsWith('/.well-known/jwks.json')){keys++;return Response.json({keys:[jwk]});}other++;throw Error('unexpected remote account lookup');};
  try{
    for(const [token,accepted]of [[valid,true],[valid,true],[tampered,false],[expired,false]]){
      const session={access_token:token,refresh_token:'fixture-only',token_type:'bearer',expires_at:now+3600,expires_in:3600,user:{id:'fixture-owner',email:'fixture@example.test'}};
      const h=harness({authFactory:createServerClient,cookies:[{name:'sb-project-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')}]});
      const result=await h.run();
      if(accepted)assert.equal(result.next,true);else assert.match(result.redirect,/\/login/);
    }
    assert.equal(keys,1);assert.equal(other,0);
  }finally{globalThis.fetch=original;}
});
