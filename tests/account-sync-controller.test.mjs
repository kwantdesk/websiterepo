import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {accountPreferenceFingerprint,mergeAccountPreferenceChanges} from '../src/lib/accountPreferenceMerge.ts';

const snapshot=values=>({version:1,complete:true,updatedAt:'2026-10-27T00:00:00Z',values});
function controller(){
 let state=snapshot({'olisa-theme':'desktop'}),cloud=structuredClone(state),effect;
 const listeners=new Map(),timeouts=new Map(),intervals=new Map();let sequence=0,calls=0,writes=0,applied=0,removed=0,captures=0;
 const events={addEventListener(key,fn){if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn)},removeEventListener(key,fn){listeners.get(key)?.delete(fn)},dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn(event)}};
 const window={...events,localStorage:{getItem:()=> 'owner'},setTimeout(fn){const id=++sequence;timeouts.set(id,fn);return id},clearTimeout(id){timeouts.delete(id)},setInterval(fn){const id=++sequence;intervals.set(id,fn);return id},clearInterval(id){intervals.delete(id)}};
 const document={...events,visibilityState:'visible'};
 const notifications={};const channel={on(type,filter,fn){notifications[type]=fn;return channel},subscribe(fn){fn('SUBSCRIBED');return channel},async send(){}};
 const client={channel:()=>channel,removeChannel(){removed++;}};
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('src/hooks/useAccountPreferenceSync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const require=id=>{
  if(id==='react')return {useEffect:fn=>{effect=fn}};
  if(id.includes('userPreferences'))return {isTrackedStorageKey:key=>key==='olisa-theme',captureBrowserPreferences:()=>{captures++;return structuredClone(state)},readScopedPreferences:()=>structuredClone(cloud),receiveAccountPreferences(_owner,next){state=next;applied++;}};
  if(id.includes('accountPreferenceMerge'))return {accountPreferenceFingerprint,mergeAccountPreferenceChanges};
  if(id.includes('accountPreferenceCloud'))return {async exchangeAccountPreferences(_client,owner,base,local,write){assert.equal(owner,'owner');calls++;const merged=mergeAccountPreferenceChanges(base,local,cloud);if(write){writes++;cloud=merged;}return {remote:structuredClone(cloud),snapshot:merged};}};
  throw Error(id);
 };
 vm.runInNewContext(code,{exports,require,window,document,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},Date,console});
 exports.useAccountPreferenceSync({supabase:client,userId:'owner',enabled:true});const cleanup=effect();
 return {get captures(){return captures},get state(){return state},get calls(){return calls},get writes(){return writes},get applied(){return applied},get removed(){return removed},get timers(){return timeouts.size+intervals.size},
  setState(next){state=next},setCloud(next){cloud=next},emit:(type,key)=>window.dispatchEvent({type,key}),notify:()=>notifications.broadcast(),cleanup,
  async flush(){const queued=[...timeouts.values()];timeouts.clear();for(const fn of queued)fn();await new Promise(resolve=>setImmediate(resolve));},
 };
}
test('live account receiver applies peer revisions and edits made locally do not echo forever',async()=>{
 const c=controller();await c.flush();assert.equal(c.calls,1);assert.equal(c.writes,0);
 c.setCloud(snapshot({'olisa-theme':'phone'}));c.notify();await c.flush();
 assert.equal(c.state.values['olisa-theme'],'phone');assert.equal(c.writes,0);
 c.setState(snapshot({'olisa-theme':'new desktop'}));c.emit('kwantdesk:preferences-changed');await c.flush();
 assert.equal(c.writes,1);const count=c.calls;
 c.emit('kwantdesk:preferences-changed');await c.flush();assert.equal(c.calls,count);
 c.cleanup();assert.equal(c.removed,1);assert.equal(c.timers,0);
});
test('one hundred unchanged local preference events cause no account reads or writes',async()=>{
 const c=controller();await c.flush();const before=c.calls;
 for(let i=0;i<100;i++)c.emit('kwantdesk:preferences-changed');
 await c.flush();assert.equal(c.calls,before);assert.equal(c.writes,0);c.cleanup();
});
test('focus catches up after a missed realtime notification',async()=>{
 const c=controller();await c.flush();c.setCloud(snapshot({'olisa-theme':'mobile'}));
 c.emit('focus');await c.flush();assert.equal(c.state.values['olisa-theme'],'mobile');c.cleanup();
});

test('cache storage storms cause no preference scans and local bursts debounce before scanning',async()=>{const c=controller();await c.flush();const before=c.captures;for(let i=0;i<1000;i++)c.emit('storage','kwantdesk:renderer-health:active:v1');assert.equal(c.captures,before);for(let i=0;i<1000;i++)c.emit('kwantdesk:preferences-changed');assert.equal(c.captures,before);await c.flush();assert.equal(c.captures,before+1);assert.equal(c.writes,0);c.cleanup()});
