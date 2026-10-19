import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {beginChartHistoryRead,readChartCacheWithin} from '../src/lib/chartHistoryRead.ts';

test('base history starts immediately, independent of an unresolved seam/cache',async()=>{
  let started=0,finish;
  const pending=new Promise(resolve=>{finish=resolve;});
  const read=beginChartHistoryRead(()=>{started++;return pending;});
  assert.equal(started,1);
  finish(['verified OHLC']);
  assert.deepEqual(await read(),['verified OHLC']);
  assert.deepEqual(await read(),['verified OHLC']);
  assert.equal(started,1);
});
test('early rejection is retained safely until consumed; failure is not fabricated data',async()=>{
  const failure=new Error('history unavailable');
  const read=beginChartHistoryRead(()=>Promise.reject(failure));
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(read(),error=>error===failure);
  const thrown=beginChartHistoryRead(()=>{throw failure;});
  await assert.rejects(thrown(),error=>error===failure);
});
test('workspace starts base requests before cache loading and never awaits optional seam in that barrier',()=>{
  const source=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const start=source.indexOf('const earlyBaseHistory =');
  const end=source.indexOf('const loadHistory = async () =>',start);
  assert.ok(start>0&&end>start);
  const bootstrap=source.slice(start,end);
  assert.match(bootstrap,/!isEventBasedChartInterval\(pane.timeframe\)/);
  assert.match(bootstrap,/if \(cancelled\) return/);
  assert.match(bootstrap,/if \(!receivedBaseHistory/);
  assert.match(bootstrap,/if \(cmeChartTailNeedsReconciliation\(repaired, pane.timeframe\)\) return/);
  const barrier=source.slice(end,source.indexOf('if (cancelled) return;',end));
  assert.doesNotMatch(barrier,/liveSeamRequest/);
  assert.match(source,/earlyBaseHistory && !needsOrderFlowHistory/);
});
test('a blocked or failed optional cache cannot block authoritative candles',async()=>{
  const blocked=new Promise(()=>{});
  assert.equal(await readChartCacheWithin(()=>blocked,null,2),null);
  assert.equal(await readChartCacheWithin(()=>Promise.reject(new Error('IDB failed')),null,2),null);
  const cached={candles:[1,2,3]};
  assert.equal(await readChartCacheWithin(()=>Promise.resolve(cached),null,20),cached);
});
