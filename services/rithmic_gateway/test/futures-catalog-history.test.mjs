import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {missingOnlyBars,configuredHistoryRoots,hydrateFuturesCatalogHistory} from '../scripts/hydrate-futures-catalog-history.mjs';
test('catalog hydration never rewrites published OHLC and orders missing rows',()=>{
 const old=[120000,100,110,90,105,10],correction=[120000,200,220,190,210,20],extra=[60000,101,102,100,101,5];
 assert.deepEqual(missingOnlyBars([old],[correction,extra]),[extra,old]);assert.deepEqual(old,[120000,100,110,90,105,10]);
});
test('provider reference failure retries only the exact resolved product on the same connection',async()=>{
 const calls=[],now=Date.parse('2026-10-27T09:00:00Z');let closed=0;
 const client={bytesReceived:0,close(){closed++},async replayMinuteBars(request){calls.push(request.symbol);if(request.symbol==='UB')throw Error('History replay failed: 7, reference data not available');request.onBar({marker:now/1000-60,openPrice:100,highPrice:102,lowPrice:99,closePrice:101,volume:8})}};
 const receipt=await hydrateFuturesCatalogHistory({now,config:{allowedRoots:[{exchange:'CBOT',symbol:'UB'}],subscriptions:[]},client,resolveContract:async row=>({...row,symbol:'UBZ6'})});
 assert.deepEqual(calls,['UB','UBZ6']);assert.equal(closed,1);assert.equal(receipt.instruments[0].status,'verified');assert.equal(receipt.instruments[0].contract,'UBZ6');
});
test('a rejected licensed login stops the entire catalog run without retrying credentials',async()=>{
 let requests=0,closed=0;const client={bytesReceived:0,close(){closed++},async replayMinuteBars(){requests++;throw Error('History login rejected: permission denied')}};
 const receipt=await hydrateFuturesCatalogHistory({config:{allowedRoots:[{exchange:'CME',symbol:'ES'},{exchange:'COMEX',symbol:'GC'}],subscriptions:[]},client});
 assert.equal(requests,1);assert.equal(closed,1);assert.equal(receipt.instruments.length,1);assert.equal(receipt.instruments[0].status,'failed');
});
test('each micro and parent has its own bounded history root and exchange',()=>{
 const roots=configuredHistoryRoots({allowedRoots:[{exchange:'COMEX',symbol:'MGC'},{exchange:'COMEX',symbol:'GC'},{exchange:'CME',symbol:'10Y'}],subscriptions:[{exchange:'COMEX',symbol:'GCZ6'}]});
 assert.equal(roots.length,3);assert.ok(roots.some(r=>r.symbol==='GC'));assert.ok(roots.some(r=>r.symbol==='MGC'));assert.ok(roots.some(r=>r.symbol==='10Y'&&r.exchange==='CME'));
 assert.throws(()=>configuredHistoryRoots({allowedRoots:Array.from({length:65},(_,i)=>({exchange:'CME',symbol:'A'+i})),subscriptions:[]}),/64/);
});

test('resolved-contract replay writes canonical root history without replacing live-contract bars',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kwantdesk-root-history-'));
 const day='2026-10-26',now=Date.parse('2026-10-28T09:00:00Z'),timestamp=Date.parse('2026-10-27T09:00:00Z');
 const live={tradingDate:day,exchange:'CBOT',symbol:'UBZ6',bars:[[timestamp,100,100,100,100,1]]};
 await mkdir(join(dir,'bars',day),{recursive:true});await writeFile(join(dir,'bars',day,'CBOT-UBZ6.json'),JSON.stringify(live));
 const client={bytesReceived:0,close(){},async replayMinuteBars(r){if(r.symbol==='UB')throw Error('History replay failed: 7, reference data not available');r.onBar({marker:timestamp/1000+60,openPrice:100,highPrice:102,lowPrice:99,closePrice:101,volume:8})}};
 try{
  const result=await hydrateFuturesCatalogHistory({dir,now,apply:true,config:{allowedRoots:[{exchange:'CBOT',symbol:'UB'}],subscriptions:[]},client,resolveContract:async r=>({...r,symbol:'UBZ6'})});
  const canonical=JSON.parse(await readFile(join(dir,'bars',day,'CBOT-UB.json'),'utf8'));
  assert.equal(canonical.symbol,'UB');assert.equal(canonical.sourceContract,'UBZ6');assert.equal(canonical.markerConvention,'bar-open');assert.equal(canonical.completedSession,true);
  assert.deepEqual(canonical.bars,[[timestamp,100,102,99,101,8]]);
  assert.deepEqual(JSON.parse(await readFile(join(dir,'bars',day,'CBOT-UBZ6.json'),'utf8')),live);
  assert.equal(result.instruments[0].sessions[0].added,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('an accepted but empty product-root replay retries its exact provider contract once',async()=>{
 const calls=[],now=Date.parse('2026-10-28T09:00:00Z');const client={bytesReceived:0,close(){},async replayMinuteBars(r){calls.push(r.symbol);if(r.symbol==='QGZ6')r.onBar({marker:now/1000-60,openPrice:3,highPrice:4,lowPrice:2,closePrice:3,volume:1})}};
 const result=await hydrateFuturesCatalogHistory({now,client,config:{allowedRoots:[{exchange:'NYMEX',symbol:'QG'}],subscriptions:[]},resolveContract:async r=>({...r,symbol:'QGZ6'})});
 assert.deepEqual(calls,['QG','QGZ6']);assert.equal(result.instruments[0].status,'verified');
});
test('ambiguous old markers require explicit full-session replacement and retain an exact backup',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kwantdesk-marker-repair-')),day='2026-10-26',now=Date.parse('2026-10-28T09:00:00Z'),timestamp=Date.parse('2026-10-27T09:00:00Z');
 const file=join(dir,'bars',day,'CBOT-ZB.json'),original=JSON.stringify({symbol:'ZB',bars:[[timestamp+60000,9,9,9,9,1]]});
 const client={bytesReceived:0,close(){},async replayMinuteBars(r){r.onBar({marker:timestamp/1000+60,openPrice:100,highPrice:102,lowPrice:99,closePrice:101,volume:8})}};
 const opts={dir,now,apply:true,client,config:{allowedRoots:[{exchange:'CBOT',symbol:'ZB'}],subscriptions:[]}};
 try{await mkdir(join(dir,'bars',day),{recursive:true});await writeFile(file,original);
 const skipped=await hydrateFuturesCatalogHistory(opts);assert.equal(skipped.instruments[0].status,'ambiguous-existing-markers');assert.equal(await readFile(file,'utf8'),original);
 const repaired=await hydrateFuturesCatalogHistory({...opts,repairAmbiguous:true});assert.equal(repaired.instruments[0].sessions[0].repairedAmbiguous,true);
 assert.deepEqual(JSON.parse(await readFile(file,'utf8')).bars,[[timestamp,100,102,99,101,8]]);
 assert.equal(await readFile(join(dir,'history-repairs','catalog-'+new Date(now).toISOString().replace(/[:.]/g,'-'),day,'CBOT-ZB.json'),'utf8'),original);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('a corrected provider reference cannot mix contracts and requires explicit backed-up repair',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kwantdesk-reference-repair-')),day='2026-10-26',now=Date.parse('2026-10-28T09:00:00Z'),timestamp=Date.parse('2026-10-27T09:00:00Z');
 const file=join(dir,'bars',day,'CME-SR3.json'),original=JSON.stringify({symbol:'SR3',source:'Rithmic History Plant minute bars',sourceContract:'SR3Q6',markerConvention:'bar-open',completedSession:true,bars:[[timestamp,99,99,99,99,1]]});
 const client={bytesReceived:0,close(){},async replayMinuteBars(r){if(r.symbol==='SR3')throw Error('History replay failed: 7, reference data not available');r.onBar({marker:timestamp/1000+60,openPrice:95,highPrice:96,lowPrice:94,closePrice:95,volume:400})}};
 const opts={dir,now,apply:true,client,config:{allowedRoots:[{exchange:'CME',symbol:'SR3'}],subscriptions:[]},resolveContract:async r=>({...r,symbol:'SR3Z6'})};
 try{await mkdir(join(dir,'bars',day),{recursive:true});await writeFile(file,original);await hydrateFuturesCatalogHistory(opts);assert.equal(await readFile(file,'utf8'),original);
 await hydrateFuturesCatalogHistory({...opts,repairContract:true});const repaired=JSON.parse(await readFile(file,'utf8'));assert.equal(repaired.sourceContract,'SR3Z6');assert.deepEqual(repaired.bars,[[timestamp,95,96,94,95,400]]);
 assert.equal(await readFile(join(dir,'history-repairs','catalog-'+new Date(now).toISOString().replace(/[:.]/g,'-'),day,'CME-SR3.json'),'utf8'),original);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('explicit authoritative repair replaces a proven incorrect closed candle and keeps its backup',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kwantdesk-provider-repair-')),day='2026-10-26',now=Date.parse('2026-10-28T09:00:00Z'),timestamp=Date.parse('2026-10-27T09:00:00Z');
 const file=join(dir,'bars',day,'CME-NQ.json'),original=JSON.stringify({source:'Rithmic History Plant minute bars',markerConvention:'bar-open',completedSession:true,bars:[[timestamp,100,100,100,100,1]]});
 const client={bytesReceived:0,close(){},async replayMinuteBars(r){r.onBar({marker:timestamp/1000+60,openPrice:100,highPrice:102,lowPrice:99,closePrice:101,volume:8})}};
 try{await mkdir(join(dir,'bars',day),{recursive:true});await writeFile(file,original);await hydrateFuturesCatalogHistory({dir,now,apply:true,repairAuthoritative:true,client,config:{allowedRoots:[{exchange:'CME',symbol:'NQ'}],subscriptions:[]}});
 assert.deepEqual(JSON.parse(await readFile(file,'utf8')).bars,[[timestamp,100,102,99,101,8]]);
 assert.equal(await readFile(join(dir,'history-repairs','catalog-'+new Date(now).toISOString().replace(/[:.]/g,'-'),day,'CME-NQ.json'),'utf8'),original);
 }finally{await rm(dir,{recursive:true,force:true})}
});
