import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeLiveSnapshot, isFullDepthSource } from '../public/heatmap-app/src/live-market.js';
import { SYMBOLS } from '../public/heatmap-app/src/market-simulator.js';

// Execute the actual shipped replay methods, without booting a live feed or
// replacing their ownership/cache/seek logic with a test-only implementation.
const source = readFileSync(new URL('../public/heatmap-app/src/main.js', import.meta.url), 'utf8');
const methods = source.slice(source.indexOf('  #postReplayStatus('), source.indexOf('  #ingestDepthSnapshot(')).replaceAll('#', '');
const Harness = new Function('normalizeLiveSnapshot', 'isFullDepthSource', 'SYMBOLS', '$', 'MAX_HISTORY', 'INSTITUTIONAL_MARKET_DATA_ORIGIN', `return class {
  constructor() {
    this.symbol = 'NQ'; this.settings = { autoCenter: true }; this.view = {}; this.instrumentSubscriptions = new Map();
    this.replay = { active: false, tradingDate: '', clockMs: 0, chunks: new Map() };
    this.depthEngine = { frames: [], reset() { this.frames = []; }, append(row) { this.frames.push(row); if(this.frames.length > 1800) this.frames.shift(); } };
    this.history = this.depthEngine.frames; this.tape = []; this.cvdHistory = [{timestamp:Infinity}];
    this.renderer = { endInteraction() {} };
    this.liveFeed = { stop() {}, start() {} };
  }
  updateSymbolUi() {} renderTape() {} requestRender() {} appendTrades(rows) { this.tape.push(...rows); }
  ${methods}
}`)(normalizeLiveSnapshot, isFullDepthSource, SYMBOLS, () => null, 1800, '/api/institutional-market-data');

const DATE = '2026-10-23';
const BASE = Date.parse(`${DATE}T14:00:00Z`);
const CHUNK = 30 * 60_000;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const response = (body, status = 200) => ({ ok: status === 200, json: async () => body });
const frame = (timestamp, root = 'NQ') => ({ snapshot: {
  id: timestamp, timestamp, root, contractSymbol: `${root}Z6`, tickSize: .25,
  bids: [[400,10,2]], asks: [[401,12,3]], lastTick:400, bestBid:400, bestAsk:401,
  fullDepth:true, bookValid:true, readOnly:true, source:'rithmic-depth-by-order', cvd:timestamp-BASE,
  trades:[{id:timestamp,timestamp,tick:400,size:2,side:'buy'},
    {id:timestamp+1,timestamp:timestamp+60_000,tick:401,size:3,side:'sell'}],
} });
function pack(root = 'NQ', tradingDate = DATE, start = BASE) {
  const rows = [frame(start+2000, root), frame(start+4000, root), frame(start+6000, root)];
  const chunk = { startMs:start, endMs:start+CHUNK, frames:rows.length };
  return { manifest:{root,tradingDate,exchange:SYMBOLS[root]?.venue||'CME',frameMs:2000,gaps:0,chunks:[chunk]}, chunk, frames:rows };
}
async function withReplay(fetcher, run) {
  const oldFetch = globalThis.fetch; const oldWindow = globalThis.window;
  const statuses = [];
  globalThis.fetch = fetcher;
  globalThis.window = { location:{origin:'https://www.kwantdesk.com'}, parent:{postMessage:message => statuses.push(message)} };
  const app = new Harness();
  try { await run(app, statuses); } finally { app.exitReplay(); globalThis.fetch = oldFetch; globalThis.window = oldWindow; }
}
const seek = (app, clockMs, tradingDate = DATE) => app.handleReplayMessage({active:true,tradingDate,timestampMs:clockMs});

test('archived depth, bubbles and CVD are causal and cannot retain future values on rewind', async () => {
  const data = pack(); let requests = 0;
  await withReplay(async url => { requests++; return response(url.includes('/chunk?') ? data : {manifest:data.manifest}); }, async app => {
    seek(app, BASE+4500); await settle();
    assert.deepEqual(app.history.map(row => row.timestamp), [BASE+2000,BASE+4000]);
    assert.deepEqual(app.cvdHistory.map(row => row.timestamp), [BASE+2000,BASE+4000]);
    assert.ok(app.tape.every(row => row.timestamp <= BASE+4500));
    seek(app, BASE+2500);
    assert.equal(app.history.length, 0, 'future history disappears synchronously before any promise settles');
    assert.equal(app.cvdHistory.length, 0);
    assert.equal(app.tape.length, 0);
    await settle();
    assert.deepEqual(app.history.map(row => row.timestamp), [BASE+2000]);
    assert.equal(requests, 2, 'manifest and bounded chunk are reused without polling');
    for (let i=0;i<10;i++) { seek(app, BASE+2500+i*10); await settle(); }
    assert.equal(requests, 2);
  });
});

test('late old-session responses cannot populate or unlock a replacement date', async () => {
  const delayed = deferred(); const second = pack('NQ', '2026-10-22', BASE-86400_000);
  let first = true;
  await withReplay(async url => {
    if (first) { first=false; return delayed.promise; }
    return response(url.includes('/chunk?') ? second : {manifest:second.manifest});
  }, async (app, statuses) => {
    seek(app, BASE+4500); const old = app.replay;
    seek(app, BASE-86400_000+4500, '2026-10-22'); await settle();
    const current = app.replay;
    assert.equal(old.abort.signal.aborted, true);
    delayed.resolve(response({manifest:pack().manifest})); await settle();
    assert.equal(app.replay, current);
    assert.equal(current.syncing, false);
    assert.ok(app.history.every(row => row.timestamp < BASE));
    assert.equal(statuses.at(-1).state, 'ready');
  });
});

test('late old-instrument chunks and requests completing after exit never contaminate replay or live', async () => {
  const delayed = deferred(); const nq = pack(); const es = pack('ES');
  await withReplay(async url => {
    const isEs = new URL(url,'https://test').searchParams.get('symbol') === 'ES';
    if (url.includes('/chunk?') && !isEs) return delayed.promise;
    return response(url.includes('/chunk?') ? es : {manifest:(isEs?es:nq).manifest});
  }, async app => {
    seek(app, BASE+4500); await settle(); const old = app.replay;
    app.symbol='ES'; app.enterReplay(); await settle();
    delayed.resolve(response(nq)); await settle();
    assert.equal(old.abort.signal.aborted, true);
    assert.ok(app.history.length > 0);
    assert.ok(app.history.every(row => row.symbol === 'ES'));
    assert.equal(app.replay.chunks.size, 1);
    app.exitReplay(); assert.equal(app.history.length, 0); assert.equal(app.sourceMode, 'connecting');
  });
});

test('a truncated chunk fails closed and clock messages cannot create a retry storm', async () => {
  const data = pack(); let requests=0;
  await withReplay(async url => { requests++; return response(url.includes('/chunk?') ? {...data,frames:data.frames.slice(0,1)} : {manifest:data.manifest}); }, async (app,statuses) => {
    seek(app,BASE+4500); await settle();
    assert.equal(statuses.at(-1).state,'unavailable');
    assert.equal(app.replay.appliedThroughMs,0);
    assert.equal(app.history.length,0);
    for(let i=0;i<50;i++) seek(app,BASE+4500+i*100);
    await settle(); assert.equal(requests,2);
    assert.ok(app.replay.retryAt > Date.now());
  });
});

test('unavailable archive is not a successful empty replay; invalid manifest identities are rejected', async () => {
  for(const fetcher of [async () => response({error:'No archive'},404), async () => response({manifest:pack('ES').manifest})]) {
    await withReplay(fetcher, async (app,statuses) => {
      seek(app,BASE+4500); await settle();
      assert.equal(statuses.at(-1).state,'unavailable'); assert.equal(app.history.length,0);
      assert.equal(app.replay.appliedThroughMs,0);
    });
  }
});

test('rewind while a forward chunk loads discards the old clock before painting', async () => {
  const data=pack(); const delayed=deferred(); let chunks=0;
  await withReplay(async url => url.includes('/chunk?') ? (++chunks,delayed.promise) : response({manifest:data.manifest}), async app => {
    seek(app,BASE+6500); await settle(); seek(app,BASE+2500);
    delayed.resolve(response(data)); await settle();
    assert.deepEqual(app.history.map(row=>row.timestamp),[BASE+2000]);
    assert.equal(app.replay.appliedThroughMs,BASE+2500); assert.equal(chunks,1);
  });
});

test('standalone LIQ Map uses the shared controls, timezone, readiness gate and read-only trading', () => {
  const workspace=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const bridge=readFileSync(new URL('../src/components/liquidity-map/LiquidityMapWorkspace.tsx',import.meta.url),'utf8');
  assert.equal((workspace.match(/\{renderReplayTransport\(\)\}/g)||[]).length,2);
  const start=workspace.indexOf('{bottomWorkspaceSection === "liqmap" ? (');
  const section=workspace.slice(start,workspace.indexOf('{visitedWorkspaceSections.has("heatmap")',start));
  assert.match(section,/WorkspaceReplayDialog[\s\S]*scope="charts"/);
  assert.match(section,/TimeZoneSelect/); assert.match(section,/replay=\{gexVueReplay.active/);
  assert.match(section,/onReplayReadyChange=\{setLiquidityReplayReady\}/);
  assert.match(workspace,/optimisticWorkspaceSection === "liqmap" && !liquidityReplayReady/);
  assert.match(bridge,/liquidity-map-theme-request[\s\S]{0,300}setBridgeReady/);
  assert.match(bridge,/if \(!bridgeReady\) return/);
  assert.match(bridge,/replay=\{Boolean\(replay\)\}/);
  assert.match(source,/#replaceCvdHistory[^\n]*\{\s*if \(this.replay.active\) return/);
});

test('missing clock coverage clears stale painted depth, but the clock can play through the archive gap', async()=>{
  const data=pack();
  await withReplay(async url=>response(url.includes('/chunk?')?data:{manifest:data.manifest}),async(app,statuses)=>{
    seek(app,BASE+6500);await settle();assert.ok(app.history.length);
    seek(app,BASE+60_000);await settle();assert.equal(app.history.length,0);assert.equal(statuses.at(-1).state,'gap');
    seek(app,BASE+6500);await settle();assert.equal(app.history.length,3);assert.equal(statuses.at(-1).state,'ready');
  });
});

test('exiting replay aborts in-flight downloads and their late completion cannot paint into live mode',async()=>{
  const delayed=deferred();const data=pack();
  await withReplay(async url=>url.includes('/chunk?')?delayed.promise:response({manifest:data.manifest}),async app=>{
    seek(app,BASE+6500);await settle();const session=app.replay;
    app.exitReplay();assert.equal(session.abort.signal.aborted,true);
    delayed.resolve(response(data));await settle();
    assert.equal(app.replay.active,false);assert.equal(app.history.length,0);assert.equal(app.sourceMode,'connecting');
  });
});

test('non-CME instruments retain their actual archive exchange on manifest AND chunk requests',async()=>{
 for(const [symbol,exchange] of [['YM','CBOT'],['CL','NYMEX'],['GC','COMEX']]){
  const data=pack(symbol);const queries=[];
  await withReplay(async url=>{queries.push(new URL(url,'https://test'));return response(url.includes('/chunk?')?data:{manifest:data.manifest});},async app=>{
   app.symbol=symbol;seek(app,BASE+4500);await settle();
   assert.equal(queries.length,2);assert.ok(queries.every(url=>url.searchParams.get('exchange')===exchange));
   assert.ok(app.history.every(row=>row.symbol===symbol));assert.equal(app.history.length,2);
  });
 }
});
