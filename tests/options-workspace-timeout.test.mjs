import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {gzipSync, gunzipSync} from 'node:zlib';

const baseline = process.env.KWANTDESK_OPTIONS_TIMEOUT_BASELINE;
const readSource = path => baseline
  ? execFileSync('git', ['show', `${baseline}:${path}`], {encoding: 'utf8'})
  : readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const server = readSource('src/lib/quantData.server.ts');
const client = readSource('src/components/options-flow/GammaWorkspace.tsx');
function declaration(source, name, variable = false) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if ((!variable && ts.isFunctionDeclaration(node) || variable && ts.isVariableDeclaration(node)) && node.name?.getText(ast) === name) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, name);
  return variable ? `const ${found.getText(ast)};` : found.getText(ast).replace(/^export\s+/, '');
}
function evaluate(source, context, names) {
  const js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(js + '\nObject.assign(result, {' + names.join(',') + '});', {...context, result: context.result});
  return context.result;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function fixture({cached = fn => fn, open = true} = {}) {
  let now = 0, networkCalls = 0, builds = 0;
  const jobs = [], buildJobs = [];
  class Clock extends Date { static now() {return now;} }
  const context = {
    result: {}, Date: Clock, endpointCache: new Map(), requestCache: new Map(), lastGoodOptionsFlowByInstrument: new Map(), CACHE_TTL_MS: 4000,
    getUsOptionsSession: () => ({sessionDate: '2026-10-29', marketOpen: open}),
    QuantDataError: class extends Error {}, getQuantDataHttpError: error => ({message: error.message}),
    unstable_cache: cached, gzipSync, gunzipSync, Buffer,
    quantDataNetworkPost: () => {networkCalls++; const job = deferred(); jobs.push(job); return job.promise;},
    buildOptionsFlowPayload: () => {builds++; const job = deferred(); buildJobs.push(job); return job.promise;},
  };
  const api = evaluate(declaration(server, 'quantDataPost') + declaration(server, 'readCompletedOptionsFlow') + declaration(server, 'getOptionsFlowPayload'), context, ['quantDataPost', 'getOptionsFlowPayload']);
  return {...api, context, jobs, buildJobs, tick: value => {now = value;}, setOpen: value => {open = value;}, counts: () => ({networkCalls, builds})};
}

for (const ttl of [4000, 15000, 0]) {
  test(`an unfinished provider request stays single-flight beyond TTL ${ttl}`, async () => {
    const f = fixture(), body = {filter: {ticker: 'QQQ'}};
    const first = f.quantDataPost('/options/tool/exposure-by-strike', body, ttl);
    f.tick(25000);
    const joined = f.quantDataPost('/options/tool/exposure-by-strike', body, ttl);
    assert.equal(f.counts().networkCalls, 1);
    const data = {payload: {actual: 42}, remaining: 19};
    f.jobs[0].resolve(data);
    assert.strictEqual(await first, data);
    assert.strictEqual(await joined, data);
    f.tick(25000 + ttl + 1);
    const next = f.quantDataPost('/options/tool/exposure-by-strike', body, ttl);
    assert.equal(f.counts().networkCalls, 2);
    f.jobs[1].resolve(data); await next;
  });
}
test('a cache TTL starts when the genuine response arrives, and symbols stay isolated', async () => {
  const f = fixture();
  const first = f.quantDataPost('/surface', {ticker: 'QQQ'}, 4000);
  f.tick(25000); f.jobs[0].resolve({payload: 1}); await first;
  f.tick(28999);
  const cached = f.quantDataPost('/surface', {ticker: 'QQQ'}, 4000);
  assert.equal(f.counts().networkCalls, 1);
  assert.equal((await cached).payload, 1);
  const other = f.quantDataPost('/surface', {ticker: 'SPY'}, 4000);
  assert.equal(f.counts().networkCalls, 2); f.jobs[1].resolve({payload: 2}); await other;
});
test('failed provider jobs release the shared slot and can recover without an unhandled finally rejection', async () => {
  const f = fixture();
  const first = f.quantDataPost('/surface', {}, 0);
  const failure = assert.rejects(first, /transport failed/);
  f.jobs[0].reject(new Error('transport failed')); await failure;
  assert.equal(f.context.endpointCache.size, 0);
  const retry = f.quantDataPost('/surface', {}, 0);
  f.jobs[1].resolve({payload: 'recovered'});
  assert.equal((await retry).payload, 'recovered');
  await new Promise(resolve => setImmediate(resolve));
});
for (const detail of ['CORE', 'FULL']) {
  test(`${detail} workspace builds stay shared while slow, then expire normally`, async () => {
    const f = fixture();
    const first = f.getOptionsFlowPayload('QQQ', 'CASH', undefined, detail);
    f.tick(25000);
    const joined = f.getOptionsFlowPayload('QQQ', 'CASH', undefined, detail);
    assert.equal(f.counts().builds, 1);
    const payload = {symbol: 'QQQ', asOf: 'actual source time', errors: []};
    f.buildJobs[0].resolve(payload);
    assert.strictEqual(await first, payload); assert.strictEqual(await joined, payload);
    f.tick(28999); assert.strictEqual(await f.getOptionsFlowPayload('QQQ', 'CASH', undefined, detail), payload);
    f.tick(29001); const next = f.getOptionsFlowPayload('QQQ', 'CASH', undefined, detail);
    assert.equal(f.counts().builds, 2); f.buildJobs[1].resolve(payload); await next;
  });
}
test('a failed build returns only its real last good snapshot, releases the job and retries', async () => {
  const f = fixture(), previous = {symbol: 'QQQ', asOf: 'unchanged source time', errors: []};
  f.context.lastGoodOptionsFlowByInstrument.set('QQQ:CASH:FULL', previous);
  const first = f.getOptionsFlowPayload('QQQ');
  f.buildJobs[0].reject(new Error('upstream failure'));
  const stale = await first;
  assert.equal(stale.asOf, previous.asOf);
  assert.match(stale.errors[0], /upstream failure/);
  assert.equal(f.context.requestCache.size, 0);
  const next = f.getOptionsFlowPayload('QQQ'); f.buildJobs[1].resolve(previous); await next;
  assert.equal(f.counts().builds, 2);
});
test('detail, price mode and instrument do not share unrelated builds', async () => {
  const f = fixture();
  const requests = [['QQQ','CASH','CORE'], ['QQQ','CASH','FULL'], ['SPY','CASH','CORE'], ['QQQ','FUTURES','CORE']]
    .map(([symbol, mode, detail]) => f.getOptionsFlowPayload(symbol, mode, undefined, detail));
  assert.equal(f.counts().builds, 4);
  f.buildJobs.forEach(job => job.resolve({errors: []})); await Promise.all(requests);
});

const eodFrame = () => ({
  session: {sessionDate: '2026-10-29', marketOpen: false}, snapshotMode: 'NEW_YORK_EOD',
  asOf: '2026-10-29T20:00:00Z', exposures: {GAMMA: {strikes: [{strike: 670}]}}, errors: [],
});

test('market close cannot reuse the same-day live job, even if it is still in flight', async () => {
  const f = fixture();
  const live = f.getOptionsFlowPayload('QQQ');
  f.setOpen(false);
  const closed = f.getOptionsFlowPayload('QQQ');
  assert.equal(f.counts().builds, 2);
  f.buildJobs[0].resolve({...eodFrame(), snapshotMode: 'LIVE'});
  f.buildJobs[1].resolve(eodFrame());
  assert.equal((await live).snapshotMode, 'LIVE');
  assert.equal((await closed).snapshotMode, 'NEW_YORK_EOD');
});

test('large closing payload fits the data cache and returns all original fields', async () => {
  let encoded;
  const f = fixture({open: false, cached: fn => async () => {
    if (encoded === undefined) encoded = await fn();
    assert.ok(Buffer.byteLength(JSON.stringify({body: encoded})) < 2 * 1024 * 1024);
    return encoded;
  }});
  const full = {...eodFrame(), exposureHistory: Array(50000).fill({strike: 670, timestamp: 1793300000000, net: -149033.5})};
  assert.ok(Buffer.byteLength(JSON.stringify(full)) > 2 * 1024 * 1024);
  const first = f.getOptionsFlowPayload('QQQ');
  f.buildJobs[0].resolve(full);
  assert.deepEqual(JSON.parse(JSON.stringify(await first)), full);
  f.context.requestCache.clear();
  assert.equal((await f.getOptionsFlowPayload('QQQ')).exposureHistory.length, 50000);
  assert.equal(f.counts().builds, 1);
});

test('a failed persistent cache falls through to the closing source exactly once', async () => {
  const f = fixture({open: false, cached: fn => async () => {
    await fn();
    throw new Error('cache write failed');
  }});
  const first = f.getOptionsFlowPayload('QQQ');
  f.buildJobs[0].resolve(eodFrame());
  assert.equal((await first).snapshotMode, 'NEW_YORK_EOD');
  assert.equal(f.counts().builds, 1);
});

test('closing price uses its own session candles without asking for an after-hours quote', async () => {
  const marketDataSource = readSource('src/lib/optionsMarketData.server.ts');
  const candle = {timestamp: Date.parse('2026-10-29T19:59:00Z'), close: 670};
  const unexpectedQuote = () => assert.fail('A closing snapshot must not read a live quote');
  const {getOptionsMarketPulse} = evaluate(
    declaration(server, 'getOptionsMarketPulse')
      + declaration(marketDataSource, 'resolveOptionsMarketData')
      + declaration(marketDataSource, 'unavailableCashFallback'),
    {
      result: {}, OPTIONS_FLOW_INSTRUMENTS: [{symbol: 'QQQ', futuresRoot: 'NQ', levelTranslation: 'ratio'}],
      getUsOptionsSession: () => ({marketOpen: false, sessionDate: '2026-10-29'}),
      resolveCashLevelOne: unexpectedQuote, getGatewayConfig: unexpectedQuote, LIVE_CASH_BAR_MAX_AGE_MS: 30_000,
      quantDataPost: async (_path, body) => {
        assert.equal(body.sessionDate, '2026-10-29');
        return {payload: [candle], remaining: 19};
      },
      parseCandles: x => x,
    },
    ['getOptionsMarketPulse'],
  );
  const closed = await getOptionsMarketPulse('QQQ', 'CASH');
  assert.equal(closed.marketData.status, 'LAST_SESSION');
  assert.equal(closed.marketData.lastPrice, 670);
  assert.equal(closed.asOf, '2026-10-29T19:59:00.000Z');
});
for (const detail of ['CORE', 'FULL']) {
  test(`${detail} browser load permits the supported backend budget without losing the frame`, async () => {
    let displayed = null, loading = false;
    const requested = [], payload = {symbol: 'QQQ', asOf: 'actual', errors: []};
    const context = {result: {}, useCallback: fn => fn, requestIdRef: {current: {CORE: 0, FULL: 0}}, dataRef: {current: null},
      setRefreshing: () => {}, setLoading: value => {loading = value;}, setError: () => {}, setData: value => {displayed = value;},
      canRenderOptionsPayload: () => true, mergeCoreOptionsPayload: (_old, value) => value, optionsFlowCacheKey: (s,m) => `${s}:${m}`, writeWorkspaceData: () => {},
      fetchWorkspaceData: async (_key, _url, options) => {requested.push(options); if ((options.timeoutMs ?? 20000) < 26000) throw new Error('signal timed out'); return payload;},
    };
    const {loadData} = evaluate(declaration(client, 'loadData', true), context, ['loadData']);
    await loadData('QQQ', 'CASH', false, false, detail);
    assert.strictEqual(displayed, payload);
    assert.equal(loading, false);
    assert.equal(requested.length, 1);
    assert.ok(requested[0].timeoutMs <= 65000, 'still bounded');
  });
}
