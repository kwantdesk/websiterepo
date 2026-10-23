import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inFlightGexWorkspace} from '../src/lib/gexDataPreferenceOwnership.ts';

const workspace=(accountKey,values={'gex-data:workspace':'new'})=>JSON.stringify({accountKey,values});
test('late cloud hydration preserves new edits only from the verified GEX account',()=>{
  const old=workspace('user',{'gex-data:workspace':'old'}),fresh=workspace('user');
  assert.equal(inFlightGexWorkspace(old,fresh,'user'),fresh);
  assert.equal(inFlightGexWorkspace(fresh,fresh,'user'),null);
  assert.equal(inFlightGexWorkspace(old,workspace('other'),'user'),null);
  assert.equal(inFlightGexWorkspace(undefined,fresh,''),null);
});
test('invalid, oversized and unscoped GEX snapshots cannot cross the hydration boundary',()=>{
  for(const value of ['{bad',workspace('user',{'not-gex':'bad'}),workspace('user',[]),workspace('user',{'gex-data:a':5}),'x'.repeat(1_500_001)]){
    assert.equal(inFlightGexWorkspace(undefined,value,'user'),null);
  }
});
test('actual hydrator applies the scoped in-flight decision before writing cloud preferences locally',()=>{
  const source=readFileSync(new URL('../src/lib/userPreferences.ts',import.meta.url),'utf8');
  assert.match(source,/inFlightGexWorkspace\(current.values\[gexKey\], latest.values\[gexKey\], user.id\)/);
  assert.ok(source.indexOf('const gexWorkspace =')<source.indexOf('applyBrowserPreferences(selected)'));
});
