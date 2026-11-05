import '../scripts/alias-hook.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCloudPreferences, hydrateUserPreferences } from '../src/lib/userPreferences.ts';
import { exchangeAccountPreferences } from '../src/lib/accountPreferenceCloud.ts';

const snapshot = values => ({version:1,complete:true,updatedAt:'2026-11-05T00:00:00Z',values});
const user = {id:'phone-fixture',user_metadata:{}};
function client(results) {
 const reads=[]; let writes=0;
 return {reads,get writes(){return writes},from(table){const chain={select(){return chain},eq(){return chain},abortSignal(){return chain},
   async maybeSingle(){reads.push(table);return results[table] ?? {data:null,error:null}},
   update(){writes++;throw Error('Unexpected write')},insert(){writes++;throw Error('Unexpected write')}};return chain}};
}

test('an unavailable cloud read is not treated as an empty account or stale legacy authority',async()=>{
 const c=client({user_preferences:{data:null,error:{code:'08006',message:'Network interrupted'}},
   social_objects:{data:{payload:{preferences:snapshot({'olisa-theme':'old legacy'})}},error:null}});
 await assert.rejects(loadCloudPreferences(c,user),/local changes have been retained/);
 assert.deepEqual(c.reads,['user_preferences']);assert.equal(c.writes,0);
});

test('failed first hydration does not publish phone defaults or mutate local work',async()=>{
 const store=new Map([['olisa-theme','phone default'],['olisa-chart-workspace-layout','single']]);
 globalThis.window={localStorage:{get length(){return store.size},key:i=>[...store.keys()][i]??null,
   getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)}};
 const before=[...store];
 const c=client({user_preferences:{data:null,error:{code:'57014',message:'Timed out'}}});
 await assert.rejects(hydrateUserPreferences(c,user),/local changes have been retained/);
 assert.deepEqual([...store],before);assert.equal(c.writes,0);
});

test('actual absent primary schema can still read valid legacy account state',async()=>{
 const remote=snapshot({'olisa-chart-workspace-layout':'quad'});
 const c=client({user_preferences:{data:null,error:{code:'PGRST205'}},
   social_objects:{data:{payload:{preferences:remote},updated_at:remote.updatedAt},error:null}});
 assert.deepEqual(await loadCloudPreferences(c,user),remote);
});

test('corrupt primary state cannot be replaced by defaults or an older legacy copy',async()=>{
 const c=client({user_preferences:{data:{preferences:{broken:true},updated_at:'now'},error:null}});
 await assert.rejects(loadCloudPreferences(c,user),/local changes have been retained/);
 const base=snapshot({});await assert.rejects(exchangeAccountPreferences(c,user.id,base,snapshot({'olisa-theme':'default'}),true),/local changes have been retained/);
 assert.equal(c.writes,0);
});

test('CAS does not fork writes into the legacy store during a primary outage',async()=>{
 const base=snapshot({}), c=client({user_preferences:{data:null,error:{code:'08006'}}});
 await assert.rejects(exchangeAccountPreferences(c,user.id,base,snapshot({'olisa-theme':'edit'}),true),/local changes have been retained/);
 assert.deepEqual(c.reads,['user_preferences']);assert.equal(c.writes,0);
});

test('missing primary row is not permission to insert when the legacy read timed out',async()=>{
 const base=snapshot({}), c=client({social_objects:{data:null,error:{code:'57014'}}});
 await assert.rejects(exchangeAccountPreferences(c,user.id,base,snapshot({'olisa-theme':'edit'}),true),/local changes have been retained/);
 await assert.rejects(loadCloudPreferences(c,user),/local changes have been retained/);assert.equal(c.writes,0);
});

test('successful empty reads remain distinct from an outage',async()=>{
 assert.equal(await loadCloudPreferences(client({}),user),null);
});
