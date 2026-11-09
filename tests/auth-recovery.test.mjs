import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {middlewareAuthRecoveryHtml} from '../src/lib/middlewareAuth.ts';

test('recovery shell is public presentation and contains no request-supplied HTML',()=>{
 const html=middlewareAuthRecoveryHtml();assert.match(html,/Reconnecting your session/);assert.match(html,/auth-recovery.js/);assert.doesNotMatch(html,/AUTH_SERVICE_UNAVAILABLE|access_token|refresh_token/);
});
function fixture(results, hidden=false){
 const pending=new Map(),calls=[],events={},status={textContent:''},delays=[];let reloads=0,id=0,click;
 const document={hidden,getElementById:key=>key==='recovery-status'?status:{addEventListener(_event,fn){click=fn;}},addEventListener:(event,fn)=>events[event]=fn};
 vm.runInNewContext(readFileSync('public/auth-recovery.js','utf8'),{document,location:{href:'https://fixture.test/charts',reload(){reloads++;}},window:{addEventListener:(event,fn)=>events[event]=fn},AbortSignal,
  setTimeout:(fn,delay)=>{pending.set(++id,fn);delays.push(delay);return id;},clearTimeout:id=>pending.delete(id),fetch:async(url,options)=>{calls.push({url,options});const result=results.shift();if(result==='error')throw Error('temporary');if(typeof result==='function')return result();return{ok:result===200};}});
 return {calls,status,delays,pending,document,events,click:()=>click(),get reloads(){return reloads;},async step(){const [id,fn]=pending.entries().next().value??[];if(!fn)return;pending.delete(id);fn();await new Promise(r=>setImmediate(r));}};
}

test('recovery continues past the old three-probe cutoff, backs off, and reloads once when restored',async()=>{
 const x=fixture([503,'error',503,503,503,200]);for(let i=0;i<6;i++)await x.step();
 assert.equal(x.calls.length,6);assert.equal(x.reloads,1);assert.equal(x.pending.size,0);
 assert.deepEqual(x.delays,[2000,4000,8000,16000,30000,30000]);
 for(const c of x.calls){assert.equal(c.url,'https://fixture.test/charts');assert.equal(c.options.method,'HEAD');assert.equal(c.options.credentials,'same-origin');assert.equal(c.options.cache,'no-store');}
});
test('hidden recovery tabs pause probes and resume on visibility or connectivity',async()=>{
 const x=fixture([503,200],true);assert.equal(x.pending.size,0);x.document.hidden=false;x.events.visibilitychange();await x.step();assert.equal(x.calls.length,1);
 x.document.hidden=true;x.events.visibilitychange();assert.equal(x.pending.size,0);x.document.hidden=false;x.events.online();await x.step();assert.equal(x.reloads,1);
});
test('manual clicks share one in-flight verification and navigation prevents late reloads',async()=>{
 let finish;const x=fixture([()=>new Promise(resolve=>{finish=resolve;})]);x.click();x.click();await x.step();assert.equal(x.calls.length,1);
 x.events.pagehide();finish({ok:true});await new Promise(r=>setImmediate(r));assert.equal(x.reloads,0);assert.equal(x.pending.size,0);
});
