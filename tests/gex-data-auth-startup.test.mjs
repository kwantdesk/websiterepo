import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
const start=source.indexOf('    const checkUsername = async () => {');
const prefix=source.slice(start,source.indexOf('      let hydrated:',start));
function boot(user){
  const events=[];
  const context={supabase:{auth:{getUser:async()=>({data:{user}})}},
    router:{replace:url=>events.push(['redirect',url])},
    setAuthChecked:value=>events.push(['authChecked',value]),
    setCurrentUsername:value=>events.push(['username',value]),
    setCurrentDisplayName:value=>events.push(['display',value]),
    setAuthenticatedGexDataUserId:value=>events.push(['gexIdentity',value]),
    hydrateUserPreferences:()=>{events.push(['preferenceWait']);return new Promise(()=>{});},
  };
  const code=ts.transpileModule(prefix+'await hydrateUserPreferences(supabase,user);};this.boot=checkUsername;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,context);
  return {events,run:context.boot};
}
test('verified GEX identity publishes before unresolved cloud preferences, not after',async()=>{
  const {events,run}=boot({id:'verified-user',user_metadata:{username:'Trader'}});
  void run();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events.filter(([kind])=>['gexIdentity','preferenceWait'].includes(kind)),[['gexIdentity','verified-user'],['preferenceWait']]);
  assert.ok(!events.some(([kind])=>kind==='authChecked'));
});
test('absent verified user cannot mount an account-scoped GEX host',async()=>{
  const {events,run}=boot(null);await run();
  assert.ok(!events.some(([kind])=>kind==='gexIdentity'||kind==='preferenceWait'));
  assert.ok(events.some(([kind,url])=>kind==='redirect'&&url.startsWith('/login?')));
});
test('only GEX host gets separately verified identity; preference/trading hydration gates stay intact',()=>{
  assert.match(source,/<GexDataWorkspace key=\{authenticatedGexDataUserId\} accountKey=\{authenticatedGexDataUserId\}/);
  assert.match(source,/setAuthenticatedGexDataUserId\(""\);\s+const checkUsername/);
  assert.equal((source.match(/setPreferenceUserId\(user.id\)/g)||[]).length,1);
  assert.ok(source.indexOf('setPreferenceUserId(user.id)')>source.indexOf('hydrated = await hydrateUserPreferences'));
  assert.match(source,/const paperJournalKey = preferenceUserId \|\| currentUsername \|\| "local"/);
});
