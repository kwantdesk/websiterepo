import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChartHistoryRecovery, isTransientHistoryFailure} from '../src/lib/chartHistoryRecovery.ts';
import {MarketDataResponseError} from '../src/lib/marketDataRequest.ts';

test('network/deadline failures recover; authentication and missing recordings do not loop',()=>{
  for(const error of [new TypeError('Failed to fetch'),new DOMException('deadline','TimeoutError'),new DOMException('deadline','AbortError'),new MarketDataResponseError(503)]) {
    assert.equal(isTransientHistoryFailure(error),true);
  }
  for(const error of [new MarketDataResponseError(401),new MarketDataResponseError(403),new MarketDataResponseError(404),new Error('No candles were recorded for this replay session.')]) {
    assert.equal(isTransientHistoryFailure(error),false);
  }
});

test('background recovery coalesces schedules, backs off, caps reads and cancels on interval switch',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const recovery=new ChartHistoryRecovery(); let calls=0;
  const retry=()=>{calls++;recovery.schedule(retry);};
  assert.equal(recovery.schedule(retry),true);
  assert.equal(recovery.schedule(retry),false);
  t.mock.timers.tick(1999);assert.equal(calls,0);
  t.mock.timers.tick(1);assert.equal(calls,1);
  t.mock.timers.tick(3999);assert.equal(calls,1);
  t.mock.timers.tick(1);assert.equal(calls,2);
  t.mock.timers.tick(8000);assert.equal(calls,3);
  t.mock.timers.tick(60000);assert.equal(calls,3);
  const switched=new ChartHistoryRecovery();
  switched.schedule(()=>calls++);switched.dispose();
  t.mock.timers.tick(60000);assert.equal(calls,3);
  assert.equal(switched.schedule(retry),false);
});

test('live and replay index hydration use recovery and release timers on unmount',()=>{
  const source=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  assert.match(source,/recoverIndexHistory\(loadError, loadReplaySession\)/);
  assert.match(source,/recoverIndexHistory\(loadError, loadHistory\)/);
  assert.equal(source.match(/indexHistoryRecovery\.dispose\(\)/g)?.length,2);
  const branch=source.slice(source.indexOf('if (broker === "Market Index") {',source.indexOf('async function fetchWorkspaceCandles')),source.indexOf('const storedUrl =',source.indexOf('async function fetchWorkspaceCandles')));
  assert.match(branch,/fetchJsonWithBudget<WorkspaceHistoryPayload>/);
  assert.match(branch,/workspaceCandleRequests\.get\(requestKey\)/);
  assert.doesNotMatch(branch,/timeoutController\.abort|attempt\(30_000\)/);
});
