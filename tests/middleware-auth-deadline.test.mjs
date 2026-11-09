import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createServerClient} from '@supabase/ssr';
import {createMiddlewareAuthBudget,isTemporaryMiddlewareAuthError,middlewareAuthRecoveryHtml} from '../src/lib/middlewareAuth.ts';

const source=readFileSync(new URL('../middleware.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({claims={data:{claims:{sub:'verified-user',email:'verified@example.test'}},error:null}, user={data:{user:{email:'verified@example.test'}},error:null}, granted=true, authFactory, cookies}={}){
  let claimsCalls=0,userCalls=0,options;
  const exports={};
  vm.runInNewContext(code,{exports,URL,Response,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public'}},require(name){
    if(name==='next/server')return{NextResponse:{next:()=>({next:true}),json:(body,init)=>({body,...init}),redirect:url=>({redirect:String(url)})}};
    if(name==='@/lib/siteAccess')return{SITE_ACCESS_COOKIE:'gate',isSiteAccessConfigured:()=>true,isValidSiteAccessToken:async()=>granted};
    if(name==='@/lib/middlewareAuth')return{createMiddlewareAuthBudget:()=>createMiddlewareAuthBudget(25),isTemporaryMiddlewareAuthError,middlewareAuthRecoveryHtml};
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
    assert.equal(response.status,503);
    if(path.startsWith('/api/')){assert.equal(response.body.code,'AUTH_SERVICE_UNAVAILABLE');assert.equal(response.headers['Retry-After'],'2');}
    else {assert.match(await response.text(),/Reconnecting your session/);assert.equal(response.headers.get('Retry-After'),'2');}
    assert.equal(response.redirect,undefined);
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

test('a transient public signing-key fetch retries once, without retrying refresh POSTs or rejected credentials',async()=>{
 let calls=0;const budget=createMiddlewareAuthBudget(100,async()=>{calls++;if(calls===1)throw TypeError('temporary transport failure');return Response.json({keys:[]});});
 assert.equal((await budget.run(()=>budget.fetch('https://auth.test/.well-known/jwks.json'))).status,200);assert.equal(calls,2);
 for(const [url,init]of [['https://auth.test/token',{method:'POST'}],['https://auth.test/user',{}]]){
  let count=0;const single=createMiddlewareAuthBudget(100,async()=>{count++;throw TypeError('transport failure')});await assert.rejects(single.run(()=>single.fetch(url,init)));assert.equal(count,1);
 }
 let refused=0;const deny=createMiddlewareAuthBudget(100,async()=>{refused++;return Response.json({error:'denied'},{status:401})});assert.equal((await deny.run(()=>deny.fetch('https://auth.test/.well-known/jwks.json'))).status,401);assert.equal(refused,1);
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


test('independently authenticated Socials and Journal reads do not duplicate remote Auth checks',async()=>{
 const h=harness({user:()=>new Promise(()=>{})});
 for(const path of ['/api/socials','/api/socials/notifications','/api/journal'])assert.equal((await h.run(path)).next,true);
 assert.deepEqual(h.counts,{claimsCalls:0,userCalls:0});
 for(const path of ['/api/socials/export','/api/journal/export'])assert.equal((await h.run(path)).status,503);
 for(const path of ['/api/socials','/api/socials/notifications','/api/journal'])assert.equal((await h.run(path,'POST')).status,503);
 const denied=harness({granted:false});assert.equal((await denied.run('/api/journal')).status,401);
});

test('each delegated GET handler rejects anonymous access before opening a database client',async()=>{
 for(const [file,client,actor]of [
  ['src/app/api/socials/route.ts','socialClient','getSocialsRouteActor'],
  ['src/app/api/socials/notifications/route.ts','notificationClient','getRouteActor'],
  ['src/app/api/journal/route.ts','journalClient','getJournalRouteActor'],
 ]){
  const text=readFileSync(file,'utf8'),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const functions=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&[client,'GET'].includes(n.name?.text)).map(n=>n.getText(tree));
  assert.equal(functions.length,2);let verifications=0,databaseOpens=0;const exports={};
  const compiled=ts.transpileModule(functions.join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{exports,[actor]:async()=>{verifications++;return null;},createSupabaseServerClient:async()=>{databaseOpens++;throw Error('must not read');},NextResponse:{json:(body,options)=>({body,...options})}});
  assert.equal((await exports.GET({})).status,401,file);assert.equal(verifications,1);assert.equal(databaseOpens,0);
 }
});
