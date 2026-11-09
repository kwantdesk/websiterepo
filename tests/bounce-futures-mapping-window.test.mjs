import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { supportsChartInterval } from '../src/lib/chartIntervals.ts';
import { newYorkSessionTimestamp } from '../src/lib/gexVueReplay.ts';
import { prepareBounceGexMirror, selectBounceGexMirror } from '../src/lib/bounceGexMapMirror.ts';
import { normalizeLinkedGexMapSettings, DEFAULT_LINKED_GEX_MAP_SETTINGS } from '../src/lib/gexMapLinkedSettings.ts';
import { projectionFixture } from './fixtures/bounceProjection.ts';

const hookSource = readFileSync(new URL('../src/components/gex-map/useBounceMappingHistory.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../src/app/api/databento/market/route.ts', import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function historyRoute(now) {
  const reads = [];
  const context = { exports: {}, Date: class extends Date { static now() { return now; } }, URL, Response, Request,
    require: name => {
      if (name === 'next/server') return { NextResponse: Response };
      if (name === 'next/cache') return { unstable_cache: fn => fn };
      if (name === '@/lib/conditionalJson') return { conditionalJson: (_request, body) => Response.json(body) };
      if (name === '@/lib/databento') return { getDatabentoBars: async (...args) => {
        reads.push(args);
        return [{ timestamp: now - 60000, open: 28000 }];
      } };
      if (name === '@/lib/chartHistoryWindow') return { DEFAULT_CHART_HISTORY_CALENDAR_DAYS: 10 };
      if (name === '@/lib/chartIntervals') return { isEventBasedChartInterval: () => false, supportsChartInterval };
      if (name === '@/lib/providerErrorMessage') return { logProviderError: () => {}, providerErrorMessage: e => String(e) };
      return {};
    },
  };
  vm.runInNewContext(compile(routeSource), context);
  return { get: context.exports.GET, reads };
}

async function mappingHook({ now, sessionDate, instrument, historical = false }) {
  const route = historyRoute(now), requests = [], effects = [], jobs = [], timers = [], refs = [];
  let state, refIndex = 0;
  const context = { exports: {}, URLSearchParams, Date: class extends Date { static now() { return now; } },
    document: { visibilityState: 'visible' }, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    require: name => {
      if (name === 'react') return {
        useState: initial => [state ??= initial, next => { state = next; }],
        useRef: value => refs[refIndex++] ??= { current: value }, useEffect: effect => effects.push(effect),
      };
      if (name === '@/lib/gexVueReplay') return { newYorkSessionTimestamp };
      if (name === '@/lib/workspaceDataCache') return { fetchWorkspaceData: (_key, url) => {
        requests.push(url);
        const job = route.get(new Request('https://test.local' + url)).then(async response => {
          const body = await response.json();
          if (!response.ok) throw Error(body.error);
          return body;
        });
        jobs.push(job); return job;
      } };
      throw Error(name);
    },
  };
  vm.runInNewContext(compile(hookSource), context);
  const input = { enabled: true, instrument, sessionDate, latestFrame: now, historical };
  context.exports.useBounceMappingHistory(input);
  const cleanups = effects.map(effect => effect());
  await Promise.all(jobs);
  await new Promise(setImmediate);
  refIndex = 0;
  const result = context.exports.useBounceMappingHistory(input);
  cleanups.forEach(fn => fn?.());
  return { result, requests, reads: route.reads, timers };
}

test('negative control: the former 17:00 ET end is rejected by the real history route during the session', async () => {
  const day = '2026-11-05', now = newYorkSessionTimestamp(day, 10 * 60), route = historyRoute(now);
  const q = new URLSearchParams({ symbol: 'NQ', timeframe: '1m', from: String(newYorkSessionTimestamp(day, 8 * 60)), to: String(newYorkSessionTimestamp(day, 17 * 60)) });
  const response = await route.get(new Request('https://test.local/api/cme-history?' + q));
  assert.equal(response.status, 400);
  assert.equal(route.reads.length, 0);
});

for (const instrument of ['NQ', 'MNQ', 'ES', 'MES', 'RTY', 'M2K']) {
  test(instrument + ' live mapping requests only existing time and receives the recorded minute', async () => {
    const day = '2026-11-05', now = newYorkSessionTimestamp(day, 10 * 60);
    const { result, requests, reads, timers } = await mappingHook({ now, sessionDate: day, instrument });
    assert.equal(requests.length, 1);
    assert.equal(Number(new URL('https://test.local' + requests[0]).searchParams.get('to')), now);
    assert.equal(reads.length, 1);
    assert.equal(result.points.length, 1);
    assert.equal(result.points[0].open, 28000);
    assert.equal(result.through, now - 1);
    assert.equal(timers.length, 0, 'successful history must not enter the failure retry loop');
  });
}

test('completed-session replay retains the full real session endpoint', async () => {
  const day = '2026-11-05', now = newYorkSessionTimestamp(day, 19 * 60);
  const { requests, reads } = await mappingHook({ now, sessionDate: day, instrument: 'NQ', historical: true });
  assert.equal(Number(new URL('https://test.local' + requests[0]).searchParams.get('to')), newYorkSessionTimestamp(day, 17 * 60));
  assert.equal(reads.length, 1);
});

test('before the mapping session starts, no inverted or future history request is sent', async () => {
  const { requests, result } = await mappingHook({ now: newYorkSessionTimestamp('2026-11-05', 7 * 60), sessionDate: '2026-11-05', instrument: 'NQ' });
  assert.equal(requests.length, 0);
  assert.equal(result.points.length, 0);
});

for (const source of ['QQQ', 'NDX']) {
  test(source + ' exposure now projects onto plain NQ from the received owned minute', async () => {
    const f = projectionFixture(source), last = f.payload.candles.at(-1);
    const { result } = await mappingHook({ now: last.timestamp + 60000, sessionDate: f.payload.sessionDate, instrument: 'NQ' });
    const prepared = prepareBounceGexMirror({
      payload: f.payload,
      settings: normalizeLinkedGexMapSettings({ ...DEFAULT_LINKED_GEX_MAP_SETTINGS, viewMode: 'full' }),
      displayInstrument: 'NQ', liveDisplayPrice: 99999, colorScale: ['#00FFFF', '#FFFFFF', '#FF00CC'],
      historyKey: result.key, mappingThrough: result.through,
      displayPriceAt: timestamp => result.points.find(p => p.timestamp <= timestamp && timestamp < p.timestamp + 60000)?.open ?? null,
    });
    const snapshot = selectBounceGexMirror(prepared, null);
    assert.ok(snapshot, 'live futures projection must no longer be blank');
    assert.equal(snapshot.levels.length, f.rows.length);
    for (const level of snapshot.levels) {
      const expected = source === 'NDX' ? level.sourceStrike + (28000 - last.open) : level.sourceStrike * 28000 / last.open;
      assert.ok(Math.abs(level.mappedPrice - expected) < 1e-8);
      assert.equal(level.signedExposure, f.rows.find(row => row.strike === level.sourceStrike).net);
    }
    assert.equal(snapshot.mapping.displayMidPrice, 28000, 'never substitute the unrelated current price');
  });
}
