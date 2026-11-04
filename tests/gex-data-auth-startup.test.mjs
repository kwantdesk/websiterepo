import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
const start=source.indexOf('    const checkUsername = async () => {');
const checkUsername=source.slice(start,source.indexOf('    checkUsername();',start));
const effectStart=source.lastIndexOf('  useEffect(() => {',start);
const reset=source.slice(effectStart+'  useEffect(() => {'.length,start);
function boot(user,{owned=false}={}){
  const events=[];
  const context={supabase:{auth:{getUser:async()=>({data:{user}})}},
    router:{replace:url=>events.push(['redirect',url])},
    setAuthChecked:value=>events.push(['authChecked',value]),
    setCurrentUsername:value=>events.push(['username',value]),
    setCurrentDisplayName:value=>events.push(['display',value]),
    setAuthenticatedGexDataUserId:value=>events.push(['gexIdentity',value]),
    setOwnedWorkspaceDisplayReady:value=>events.push(['ownedDisplay',value]),
    canDisplayOwnedWorkspace:id=>{events.push(['ownedDisplayCheck',id]);return owned;},
    setPreferenceUserId:value=>events.push(['preferenceIdentity',value]),
    hydrateUserPreferences:()=>{events.push(['preferenceWait']);return new Promise(()=>{});},
  };
  const code=ts.transpileModule(checkUsername+'this.boot=checkUsername;this.reset=()=>{'+reset+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,context);
  return {events,run:context.boot,reset:context.reset};
}
test('verified GEX identity publishes before unresolved cloud preferences, not after',async()=>{
  for(const owned of [false,true]){
    const {events,run}=boot({id:'verified-user',user_metadata:{username:'Trader'}},{owned});
    void run();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(events.filter(([kind])=>['gexIdentity','ownedDisplayCheck','ownedDisplay','preferenceWait'].includes(kind)),[['gexIdentity','verified-user'],['ownedDisplayCheck','verified-user'],['ownedDisplay',owned],['preferenceWait']]);
    assert.ok(!events.some(([kind])=>['authChecked','preferenceIdentity'].includes(kind)),'unresolved cloud hydration cannot authorize trading/preference writes');
  }
});
test('absent verified user cannot mount an account-scoped GEX host',async()=>{
  const {events,run}=boot(null);await run();
  assert.ok(!events.some(([kind])=>['gexIdentity','preferenceWait','ownedDisplayCheck','ownedDisplay','preferenceIdentity'].includes(kind)));
  assert.ok(events.some(([kind,url])=>kind==='redirect'&&url.startsWith('/login?')));
});
test('account transition clears verified identity and early display before checking the next user; hydration gates stay intact',()=>{
  assert.match(source,/<GexDataWorkspace key=\{authenticatedGexDataUserId\} accountKey=\{authenticatedGexDataUserId\}/);
  const {events,reset}=boot({id:'next-user'});reset();
  assert.deepEqual(events,[['gexIdentity',''],['ownedDisplay',false]]);
  assert.equal((source.match(/setPreferenceUserId\(user.id\)/g)||[]).length,1);
  assert.ok(source.indexOf('setPreferenceUserId(user.id)')>source.indexOf('hydrated = await hydrateUserPreferences'));
  assert.match(source,/const paperJournalKey = preferenceUserId \|\| currentUsername \|\| "local"/);
});
