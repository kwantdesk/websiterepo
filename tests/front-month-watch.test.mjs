import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {watchFrontMonth} from '../src/lib/frontMonthWatcher.ts';
import {createKwantyPricePool} from '../src/lib/kwantyPriceBridge.ts';

test('watcher rotates only on a confirmed change, coalesces refresh and cleans up',async()=>{
 let symbol='NQU6',resolveJob,calls=0;const seen=[];
 const watcher=watchFrontMonth(()=>{calls++;return new Promise(resolve=>resolveJob=()=>resolve(symbol));},value=>seen.push(value));
 const pending=watcher.refresh();assert.equal(calls,1);resolveJob();await pending;await new Promise(r=>setImmediate(r));
 assert.deepEqual(seen,['NQU6']);const same=watcher.refresh();resolveJob();await same;assert.deepEqual(seen,['NQU6']);
 symbol='NQZ6';const changed=watcher.refresh();resolveJob();await changed;assert.deepEqual(seen,['NQU6','NQZ6']);
 watcher.dispose();await watcher.refresh();assert.equal(calls,3);
});
test('Kwanty drops lifetime contract pin, unsubscribes the old stream and rejects its late records',async()=>{
 const original=Date.now;let now=Date.UTC(2026,8,1),front='NQU6',checks=0,watcher,stops=0;const streams=[],frames=[];
 Date.now=()=>now;
 const pool=createKwantyPricePool({frontMonth:async()=>{checks++;return {contractSymbol:front};},watchContracts:(...args)=>(watcher=watchFrontMonth(...args)),subscribeTrades:args=>{streams.push(args);return()=>stops++;}});
 try{const stop=pool.subscribePrice('NQ_NDX',frame=>frames.push(frame));await new Promise(r=>setImmediate(r));assert.equal(streams[0].contractSymbol,'NQU6');
  now+=600001;front='NQZ6';await watcher.refresh();assert.equal(checks,2);assert.equal(stops,1);assert.equal(streams[1].contractSymbol,'NQZ6');
  const record={timestamp:now,open:100,high:101,low:99,close:100};streams[0].onTrades([record]);assert.equal(frames.length,0);
  streams[1].onTrades([record]);assert.equal(frames.length,1);stop();assert.equal(stops,2);
 }finally{pool.dispose();Date.now=original;}
});
test('live resolver validates exact requested root and replay cannot advertise a live contract',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');const data=read('src/lib/institutionalMarketData.ts'),workspace=read('src/components/KwantifyWorkspace.tsx');
 assert.match(data,/resolvedRoot !== root/);assert.match(workspace,/futuresContractRoot\(normalized\)!==root/);
 assert.match(workspace,/if \(replayActive \|\| pane.broker !== "Databento"/);
 assert.match(workspace,/row.contractSymbol && !\(chartSurfaceActive && gexVueReplay.active\)/);
 assert.match(workspace,/futuresContractRoot\(price.contractSymbol\)!==root/);
 assert.match(workspace,/moveRatio > 0.2 && !contractChanged/);
});
