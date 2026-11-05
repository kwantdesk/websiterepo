import test from 'node:test';
import assert from 'node:assert/strict';
import {packPreferenceCache,unpackPreferenceCache,compactScopedPreferenceCaches} from '../src/lib/preferenceCachePacking.ts';
import {writeProtectedItem} from '../src/lib/browserStorageQuota.ts';
import {saveWorkspacePreferencePatch,saveScopedPreferences,readScopedPreferences,captureBrowserPreferences,receiveAccountPreferences,loadCloudPreferences} from '../src/lib/userPreferences.ts';
import {readWorkspacePreferenceValue,clearConfirmedWorkspacePreferences} from '../src/lib/workspacePreferenceFallback.ts';
import {mergeAccountPreferenceChanges,accountPreferenceFingerprint} from '../src/lib/accountPreferenceMerge.ts';
import {WORKSPACE_PRESET_DELETIONS_KEY,markWorkspacePresetDeleted} from '../src/lib/workspacePresetPreferences.ts';
const key='kwantdesk-chart-workspace-presets',ownerKey='kwantdesk:active-preferences-owner:v1';
const preset=id=>({id,name:id,updatedAt:'2026-11-05T12:00:00Z',panes:[{symbol:'NQ'}],layout:{type:'pane',paneId:'nq'}});
const snap=values=>({version:1,complete:true,updatedAt:'2026-11-05T00:00:00Z',values});
function storage(entries=[],limit=Infinity,reject=()=>false){const map=new Map(entries);return {map,get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,
 setItem(k,v){if(reject(k))throw new DOMException('Full','QuotaExceededError');let bytes=0;for(const [name,value]of map)if(name!==k)bytes+=(name.length+value.length)*2;if(bytes+(k.length+v.length)*2>limit)throw new DOMException('Full','QuotaExceededError');map.set(k,String(v));},removeItem:k=>map.delete(k)};}
function client(initial,{fail=false}={}){let row=structuredClone(initial),writes=0;return {get row(){return row},get writes(){return writes},from(table){assert.equal(table,'user_preferences');let fields;const filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},abortSignal(){return q},update(value){fields=value;return q},async maybeSingle(){assert.equal(filters.user_id,'owner');if(fail)return {error:{code:'08006'},data:null};if(fields){if(filters.updated_at!==row.updatedAt)return {data:null,error:null};row=structuredClone(fields.preferences);writes++;return {data:{updated_at:row.updatedAt},error:null};}return {data:{preferences:structuredClone(row),updated_at:row.updatedAt},error:null};}};return q;}};}
async function withStore(store,fn){const previous=globalThis.window;clearConfirmedWorkspacePreferences('owner');globalThis.window={localStorage:store,dispatchEvent(){}};try{return await fn();}finally{globalThis.window=previous;clearConfirmedWorkspacePreferences('owner');}}
test('large acknowledged caches pack losslessly including emoji and Unicode, with bounded decode',()=>{
 const raw=JSON.stringify({values:{[key]:JSON.stringify(Array.from({length:300},(_,i)=>({...preset(String(i)),note:'🧲 東京 / price & Δ '.repeat(20)})))}});
 const packed=packPreferenceCache(raw);assert.ok(packed.length<raw.length/3);assert.equal(unpackPreferenceCache(packed),raw);assert.equal(packPreferenceCache('small'),'small');assert.equal(unpackPreferenceCache('legacy'),'legacy');assert.throws(()=>unpackPreferenceCache('kwantdesk:packed-preference-cache:v1:999999999:AAAA'));
});
test('a full origin makes room by compacting the duplicate account cache without deleting work',()=>{
 const raw=JSON.stringify(snap({[key]:JSON.stringify(Array.from({length:1000},(_,i)=>preset(String(i))))}));
 const cache='kwantdesk:user-preferences:owner:v1';const library='["original workspace"]',drawings='["keep drawings"]',ledger='keep every fill';
 const store=storage([[cache,raw],[key,library],['kwantdesk:chart-drawings:v1:nq',drawings],['kwantify-paper-trading-ledger-v1',ledger]],raw.length*2+2000);
 const replacement=JSON.stringify(Array.from({length:600},(_,i)=>preset('new-'+i)));
 const result=writeProtectedItem(key,replacement,store);assert.equal(result.ok,true);assert.equal(result.evicted,0);assert.ok(result.reclaimedBytes>0);assert.equal(unpackPreferenceCache(store.getItem(cache)),raw);assert.equal(store.getItem(key),replacement);assert.equal(store.getItem('kwantdesk:chart-drawings:v1:nq'),drawings);assert.equal(store.getItem('kwantify-paper-trading-ledger-v1'),ledger);
});
test('failed compaction retains the original cache unchanged',()=>{const name='kwantdesk:user-preferences:owner:v1',raw='x'.repeat(100000);const store=storage([[name,raw]],Infinity,k=>k===name);assert.equal(compactScopedPreferenceCaches(store),0);assert.equal(store.getItem(name),raw);});
test('scoped cache loader accepts both legacy JSON and packed snapshots',async()=>{const store=storage();await withStore(store,()=>{const snapshot=snap({[key]:JSON.stringify(Array.from({length:500},(_,i)=>preset(String(i))))});saveScopedPreferences('owner',snapshot);assert.deepEqual(readScopedPreferences('owner'),snapshot);store.setItem('kwantdesk:user-preferences:owner:v1',JSON.stringify(snapshot));assert.deepEqual(readScopedPreferences('owner'),snapshot);});});
test('full local workspace quota cannot veto a confirmed account save or let stale local values undo it',async()=>{
 const original=JSON.stringify([preset('old')]),base=snap({[key]:original});const store=storage([[ownerKey,'owner'],[key,original]],Infinity,k=>k===key);const remote=snap({[key]:JSON.stringify([preset('old'),preset('phone-peer')])}),cloud=client(remote);
 await withStore(store,async()=>{saveScopedPreferences('owner',base);const saved=await saveWorkspacePreferencePatch(cloud,'owner',{[key]:JSON.stringify([preset('old'),preset('new')])});assert.equal(cloud.writes,1);assert.equal(store.getItem(key),original);const expected=['new','old','phone-peer'];assert.deepEqual(JSON.parse(readWorkspacePreferenceValue(key)).map(p=>p.id),expected);assert.deepEqual(JSON.parse(saved.values[key]).map(p=>p.id),expected);assert.equal(accountPreferenceFingerprint(captureBrowserPreferences()),accountPreferenceFingerprint(readScopedPreferences('owner')));
 // A later remote read and a fresh page restore retain the account-backed save.
 clearConfirmedWorkspacePreferences('owner');const restored=await loadCloudPreferences(cloud,{id:'owner'});receiveAccountPreferences('owner',restored);assert.deepEqual(JSON.parse(readWorkspacePreferenceValue(key)).map(p=>p.id),expected);
 store.map.set(ownerKey,'another-account');assert.equal(readWorkspacePreferenceValue(key),original);assert.equal(captureBrowserPreferences().values[key],original);
 });
});
test('an offline account never yields false success or publishes a failed save',async()=>{const original=JSON.stringify([preset('old')]),base=snap({[key]:original}),store=storage([[ownerKey,'owner'],[key,original]],Infinity,k=>k===key),cloud=client(base,{fail:true});await withStore(store,async()=>{saveScopedPreferences('owner',base);await assert.rejects(saveWorkspacePreferencePatch(cloud,'owner',{[key]:JSON.stringify([preset('new')])}));assert.equal(readWorkspacePreferenceValue(key),original);assert.equal(captureBrowserPreferences().values[key],original);assert.equal(cloud.writes,0);});});
test('account-backed delete survives a stale peer even when both local deletion writes are blocked',async()=>{const original=JSON.stringify([preset('old'),preset('keep')]),base=snap({[key]:original}),store=storage([[ownerKey,'owner'],[key,original]],Infinity,k=>k===key||k===WORKSPACE_PRESET_DELETIONS_KEY),cloud=client(base);await withStore(store,async()=>{saveScopedPreferences('owner',base);const removed=markWorkspacePresetDeleted(undefined,key,'old');const saved=await saveWorkspacePreferencePatch(cloud,'owner',{[key]:JSON.stringify([preset('keep')]),[WORKSPACE_PRESET_DELETIONS_KEY]:removed});const merged=mergeAccountPreferenceChanges(base,base,saved);assert.deepEqual(JSON.parse(merged.values[key]).map(p=>p.id),['keep']);assert.deepEqual(JSON.parse(readWorkspacePreferenceValue(key)).map(p=>p.id),['keep']);});});

test('a newer successful write from another local tab replaces the confirmed fallback instead of being shadowed',async()=>{
 const original=JSON.stringify([preset('old')]),base=snap({[key]:original}),store=storage([[ownerKey,'owner'],[key,original]],Infinity,k=>k===key),cloud=client(base);
 await withStore(store,async()=>{saveScopedPreferences('owner',base);await saveWorkspacePreferencePatch(cloud,'owner',{[key]:JSON.stringify([preset('new')])});
 const peer=JSON.stringify([preset('new'),preset('peer-local')]);store.map.set(key,peer);assert.equal(readWorkspacePreferenceValue(key),peer);assert.equal(captureBrowserPreferences().values[key],peer);
 });
});
