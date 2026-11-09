import test from 'node:test';
import assert from 'node:assert/strict';
import {readAccountPreferenceRevision} from '../src/lib/accountPreferenceCloud.ts';

function client(rows){const calls=[];return {calls,from(table){const call={table,filters:{}};calls.push(call);const q={select(columns){call.columns=columns;return q},eq(key,value){call.filters[key]=value;return q},abortSignal(signal){call.signal=signal;return q},async maybeSingle(){return rows[table]??{data:null,error:null}}};return q}};}
test('lightweight recovery reads only the signed-in account revision, never the ledger',async()=>{
 const c=client({user_preferences:{data:{updated_at:'2026-11-09T00:00:00Z'},error:null}});
 assert.equal(await readAccountPreferenceRevision(c,'owner'),'2026-11-09T00:00:00Z');
 assert.equal(c.calls.length,1);assert.equal(c.calls[0].columns,'updated_at');assert.deepEqual(c.calls[0].filters,{user_id:'owner'});
});
test('legacy revision fallback stays private and uses the same account preferences object',async()=>{
 const c=client({social_objects:{data:{updated_at:'legacy'},error:null}});
 assert.equal(await readAccountPreferenceRevision(c,'owner'),'legacy');
 assert.deepEqual(c.calls[1].filters,{user_id:'owner',id:'account-preferences'});
 assert.ok(c.calls.every(call=>call.columns==='updated_at'));
});
test('missing rows return null and database errors do not masquerade as empty account state',async()=>{
 assert.equal(await readAccountPreferenceRevision(client({}),'owner'),null);
 const c=client({user_preferences:{data:null,error:{code:'08006'}}});
 await assert.rejects(readAccountPreferenceRevision(c,'owner'));assert.equal(c.calls.length,1);
});
