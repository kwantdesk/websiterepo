import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function harness(){
 const effects=[],timers=new Map(),listeners=new Map();let owner='',calls=0,failed=true,disposed=false,id=0;
 const events={addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f)},removeEventListener(k,f){listeners.get(k)?.delete(f)}};
 const client={auth:{async getUser(){return {data:{user:{id:'owner'}},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){disposed=true}}}}}}};
 const code=ts.transpileModule(fs.readFileSync('src/components/StandaloneAccountSync.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require(name){
 if(name==='react')return {useEffect:f=>effects.push(f),useMemo:f=>f(),useState:()=>['',v=>{owner=v}]};
 if(name==='next/navigation')return {usePathname:()=>'/'};
 if(name.includes('supabase/client'))return {createClient:()=>client};
 if(name.includes('userPreferences'))return {async hydrateUserPreferences(){calls++;if(failed)throw Error('temporary unavailable');}};
 if(name.includes('useAccountPreferenceSync'))return {useAccountPreferenceSync(){}};throw Error(name);
 },window:events,document:{...events,visibilityState:'visible'},queueMicrotask,setTimeout(fn){timers.set(++id,fn);return id},clearTimeout(id){timers.delete(id)}});
 exports.default();const clean=effects.map(f=>f());
 return {get owner(){return owner},get calls(){return calls},get timers(){return timers.size},get disposed(){return disposed},recover(){failed=false},async settle(){await new Promise(r=>setImmediate(r))},async retry(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();await this.settle()},cleanup(){clean.forEach(f=>f?.())}};
}
test('a phone retries failed initial hydration and joins account sync after recovery without reload',async()=>{
 const h=harness();await h.settle();assert.equal(h.owner,'');assert.equal(h.calls,1);assert.equal(h.timers,1);
 await h.retry();assert.equal(h.calls,2);assert.equal(h.owner,'');h.recover();await h.retry();
 assert.equal(h.owner,'owner');assert.equal(h.calls,3);assert.equal(h.timers,0);h.cleanup();assert.equal(h.disposed,true);
});
test('leaving the page cancels pending retry without clearing or replacing account data',async()=>{
 const h=harness();await h.settle();h.cleanup();assert.equal(h.timers,0);h.recover();await h.retry();assert.equal(h.calls,1);assert.equal(h.owner,'');
});
