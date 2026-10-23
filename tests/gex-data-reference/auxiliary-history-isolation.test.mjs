import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {snapshotControlTimeline} from '../../public/gex-data-app/snapshot-model.js';

const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
const loader=app.slice(app.indexOf('  async function loadToolPayload('),app.indexOf('  function updateInitialToolLoading('));
function harness({primaryError,priceError,aborted=false}={}){
  const primary={data:{SPY:{exposureMap:{actual:123}}}};
  const context={
    buildRequest:()=>({sessionDate:'2026-10-16',filter:{ticker:'SPY'}}),
    apiStatus:{market:{}},snapshotSelections:new Map(),snapshotKey:()=>'',
    getControl:()=> 'SPY',activeController:{signal:{aborted}},requestBase:()=>({sessionDate:'2026-10-16'}),
    toolFetch:async endpoint=>{if(endpoint==='stock-price-over-time'){if(priceError)throw priceError;return {data:{one:{closePrice:100}}};}if(primaryError)throw primaryError;return primary;},
    parsePrices:payload=>Object.keys(payload.data).map(()=>({time:1,close:100})),
    snapshotControlTimeline:prices=>prices.map(row=>({time:row.time})),equityOptionSnapshotSchedule:()=>({}),
    selectedSnapshotSpot:()=>({available:true,spot:100}),completedMinuteSnapshot:value=>value,
  };
  vm.runInNewContext(loader+'\nthis.load=loadToolPayload;',context);
  return {load:context.load,primary,context};
}
for(const id of ['heat-map','exposure-by-strike','exposure-by-expiration','market-map']){
  test(`${id}: auxiliary failure retains primary values without fictional spot/history`,async()=>{
    const {load,primary}=harness({priceError:Error('history unavailable')});
    const result=await load({id,endpoint:id});
    assert.equal(result.data,primary.data);
    assert.equal(result._priceHistoryUnavailable,true);
    assert.equal(result._timeline.length,0);assert.equal(result._snapshotEntries.length,0);
    assert.equal(result._spot,undefined);assert.equal(result._snapshotTime,undefined);
  });
  test(`${id}: primary failure and cancellation remain failures`,async()=>{
    await assert.rejects(harness({primaryError:Error('primary unavailable')}).load({id,endpoint:id}),/primary unavailable/);
    await assert.rejects(harness({priceError:Error('aborted'),aborted:true}).load({id,endpoint:id}),/aborted/);
  });
}
test('successful auxiliary response retains actual spot and timeline',async()=>{
  const result=await harness().load({id:'exposure-by-strike',endpoint:'exposure-by-strike'});
  assert.equal(result._priceHistoryUnavailable,false);assert.equal(result._spot,100);
  assert.equal(result._timeline[0],1);
});

test('market-map latest uses the verified close control, not an invented extra source minute',async()=>{
  const {load,context}=harness();
  const minute=Date.parse('2026-10-16T20:14:00Z'),close=minute+60000;
  context.parsePrices=()=>[{time:minute,spot:100}];
  context.snapshotControlTimeline=snapshotControlTimeline;
  context.equityOptionSnapshotSchedule=(ticker,date)=>{
    assert.equal(ticker,'SPY');
    return {verified:true,sessionDate:date,timeZone:'America/New_York',openMinute:570,closeMinute:975};
  };
  const result=await load({id:'market-map',endpoint:'market-map'});
  assert.deepEqual(Array.from(result._timeline),[minute,close]);
  assert.equal(result._snapshotEntries[1].kind,'latest');
  assert.equal(result._snapshotEntries[1].sourceTime,null);
  assert.equal(result._snapshotTime,close);
});
