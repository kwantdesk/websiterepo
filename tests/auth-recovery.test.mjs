import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {middlewareAuthRecoveryHtml} from '../src/lib/middlewareAuth.ts';
test('recovery shell is public presentation and contains no request-supplied HTML',()=>{
 const html=middlewareAuthRecoveryHtml();assert.match(html,/Reconnecting your session/);assert.match(html,/auth-recovery.js/);assert.doesNotMatch(html,/AUTH_SERVICE_UNAVAILABLE|access_token|refresh_token/);
});
async function run(results){
 const pending=[],calls=[],status={textContent:''};let reloads=0;
 vm.runInNewContext(readFileSync('public/auth-recovery.js','utf8'),{document:{getElementById:id=>id==='recovery-status'?status:{addEventListener(){}}},location:{href:'https://fixture.test/charts',reload(){reloads++}},window:{addEventListener(){}},AbortSignal,
  setTimeout:fn=>{pending.push(fn);return pending.length},clearTimeout(){},fetch:async(url,options)=>{calls.push({url,options});const result=results.shift();if(result==='error')throw Error('temporary');return{ok:result===200};}});
 while(pending.length){pending.shift()();await new Promise(r=>setImmediate(r));}
 return{calls,status,reloads};
}
test('temporary failures perform at most three same-page HEAD probes without clearing credentials or looping',async()=>{
 const x=await run([503,'error',503]);assert.equal(x.calls.length,3);assert.equal(x.reloads,0);assert.match(x.status.textContent,/Still unable/);
 for(const c of x.calls){assert.equal(c.url,'https://fixture.test/charts');assert.equal(c.options.method,'HEAD');assert.equal(c.options.credentials,'same-origin');assert.equal(c.options.cache,'no-store');}
});
test('successful verification reloads the same page once and stops retrying',async()=>{
 const x=await run([503,200]);assert.equal(x.calls.length,2);assert.equal(x.reloads,1);
});
