import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createOptionsFlowRequestPool} from '../src/lib/optionsFlowRequests.ts';
import {editorStyleSize} from '../public/kwanty-app/settings-editor.js';

test('opening and saving untouched negative Greek sizes retains the renderer fallback',()=>{
 for(const family of ['gex_vol','gex_oi','delta','gamma','vanna','charm']){
  assert.equal(editorStyleSize({},family+'_neg'),6.5);
  assert.equal(editorStyleSize({[family]:{size:8}},family+'_neg'),8);
  assert.equal(editorStyleSize({[family]:{size:8},[family+'_neg']:{size:3}},family+'_neg'),3);
 }
 assert.equal(editorStyleSize({},'five'),1);
});

test('standalone host permits the actual session restore URL but not other origins or operations',()=>{
 const source=readFileSync(new URL('../src/components/kwanty/KwantyWorkspace.tsx',import.meta.url),'utf8');
 const guard=source.match(/if \(!(.+)\.test\(url\)\) throw new Error\("Unsupported data request\."\);/);
 assert.ok(guard,'test the real mounted host guard, not a copied allowlist');
 const allowed=vm.runInNewContext(`url => ${guard[1]}.test(url)`);
 assert.equal(allowed('/api/kwanty/session?ticker=SPX&date=2026-10-20'),true);
 for(const url of ['https://elsewhere.test/api/kwanty/session','/api/kwanty/secret','/api/kwanty/session/extra','/api/kwanty/session#fragment'])assert.equal(allowed(url),false);
});

test('embedded panels share a real saved-session request through their existing bounded pool',async()=>{
 let calls=0;
 const pool=createOptionsFlowRequestPool(async url=>{
  calls++;assert.equal(url,'/api/kwanty/session?ticker=NDX&date=2026-10-20');
  return new Response(JSON.stringify({data:[{ticker:'NDX',timestamp:1792508489,zgr:5217.09}]}),{headers:{'Cache-Control':'private, max-age=60'}});
 });
 try{
  const results=await Promise.all(Array.from({length:4},()=>pool.request('/api/kwanty/session?ticker=NDX&date=2026-10-20')));
  assert.equal(calls,1);
  for(const response of results)assert.equal((await response.json()).data[0].zgr,5217.09);
  await assert.rejects(pool.request('/api/kwanty/unknown'),/Unsupported/);
 }finally{pool.dispose();}
});
