import test from 'node:test';
import assert from 'node:assert/strict';
import {writeProtectedItem} from '../src/lib/browserStorageQuota.ts';
import {isTrackedStorageKey} from '../src/lib/accountPreferenceKeys.ts';
import {normalizeSnapshot} from '../src/lib/userPreferences.ts';

class StorageFixture {
  values=new Map(); get length(){return this.values.size;}
  key(index){return [...this.values.keys()][index]??null;}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}
test('ordinary workspace writes notify same-browser account sync once per batch',async()=>{
  const previous=globalThis.window,window=new EventTarget(),events=[];
  window.localStorage=new StorageFixture();globalThis.window=window;
  window.addEventListener('kwantdesk:preferences-changed',event=>events.push(event.detail));
  try{
    writeProtectedItem('olisa-chart-workspace-panes','[]');
    writeProtectedItem('olisa-chart-workspace-tree','{}');
    assert.equal(events.length,0);await Promise.resolve();assert.equal(events.length,1);
    assert.deepEqual(events[0].keys,['olisa-chart-workspace-panes','olisa-chart-workspace-tree']);
    writeProtectedItem('kwantdesk:renderer-health:active:v1','cache');
    writeProtectedItem('olisa-chart-workspace-panes','private test store',new StorageFixture());
    await Promise.resolve();assert.equal(events.length,1);
  }finally{globalThis.window=previous;}
});
test('candle visibility, colours, crosshair links and the actual layout lock survive cloud normalization',()=>{
  const keys=['olisa-chart-workspace-hidden-candles','olisa-chart-workspace-candle-settings','olisa-chart-workspace-crosshair-panes','olisa-chart-workspace-layout-locked-v2'];
  const values=Object.fromEntries(keys.map(key=>[key,'fixture']));
  for(const key of keys)assert.equal(isTrackedStorageKey(key),true,key);
  assert.deepEqual(normalizeSnapshot({values}).values,values);
  assert.equal(isTrackedStorageKey('kwantdesk:renderer-health:active:v1'),false);
});
