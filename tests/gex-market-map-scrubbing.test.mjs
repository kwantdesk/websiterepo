import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {sameSnapshotScope,createSnapshotFrameCache} from '../public/gex-data-app/snapshot-frame-cache.js';
const key=(scope,time)=>JSON.stringify(['market-map',scope,time]);
test('only time changes retain a map: instrument, dates and filters remain isolated',()=>{const scope={sessionDate:'2026-11-06',filter:{sector:'TECHNOLOGY'}};assert(sameSnapshotScope(key(scope,1),key(scope,2)));assert(!sameSnapshotScope(key(scope,1),key({...scope,sessionDate:'2026-11-05'},2)));assert(!sameSnapshotScope(key(scope,1),key({...scope,filter:{sector:'ENERGY'}},2)));assert(!sameSnapshotScope(null,key(scope,2)));assert(!sameSnapshotScope('{}',key(scope,2)));});
test('cache returns only observed exact frames and bounds frame count with LRU eviction',()=>{const cache=createSnapshotFrameCache({maxFrames:2});const frame={data:{AAA:{currentValue:100}}};assert.equal(cache.get('missing'),null);cache.put('a',frame);cache.put('b',{data:{}});assert.equal(cache.get('a'),frame);cache.put('c',{data:{}});assert.equal(cache.get('b'),null);assert.equal(cache.get('a'),frame);});
test('oversized frames cannot fill memory or destroy a usable cached frame',()=>{const cache=createSnapshotFrameCache({maxBytes:60});cache.put('a',{data:1});cache.put('large',{data:'x'.repeat(100)});assert.equal(cache.get('large'),null);assert.deepEqual(cache.get('a'),{data:1});});

const app = readFileSync(new URL('../public/gex-data-app/app.js', import.meta.url), 'utf8');
const requestFunctions = app.slice(app.indexOf('  function currentToolSessionDate('), app.indexOf('  function maybeFilter('));
const openFunction = app.slice(app.indexOf('  function toolMarketOpen('), app.indexOf('  function renderSnapshotControl('));
const map = {id:'market-map',group:'Equities'};
const premarket = {sessionDate:'2026-11-11',optionsSessionDate:'2026-11-10',equitiesOpen:true,optionsOpen:false};

function sessionState({tool=map,market=premarket,controls={},masterReplay=null}={}) {
  return runInNewContext(
    `${requestFunctions}${openFunction} [requestBase().sessionDate,toolMarketOpen()]`,
    {activeTool:tool,apiStatus:{market},getControl:key=>controls[key],masterReplay},
  ).join(',');
}

test('Market Map uses the previous cash session in premarket and switches at cash open',()=>{
  assert.equal(sessionState(),'2026-11-10,false');
  assert.equal(sessionState({market:{...premarket,optionsSessionDate:premarket.sessionDate,optionsOpen:true}}),'2026-11-11,true');
  assert.equal(sessionState({tool:{id:'equity-prints',group:'Equities'}}),'2026-11-11,true');
});

test('explicit historical and replay Market Map dates keep their requested scope',()=>{
  const controls={mode:'historical',date:'2026-11-06'};
  assert.equal(sessionState({controls}),'2026-11-06,false');
  assert.equal(sessionState({controls,masterReplay:{sessionDate:'2026-11-09'}}),'2026-11-09,false');
});
