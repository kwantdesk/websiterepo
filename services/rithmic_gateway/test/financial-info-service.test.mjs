import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FinancialInfoService, normalizeFinancialHeadlines } from '../src/financial-info-service.mjs';

const now = Date.parse('2026-10-18T12:00:00Z');
const headline = { guid: 'source-123', title: 'Example test headline', isoDate: '2026-10-18T11:55:00Z', link: 'https://www.financialjuice.com/News/123', categories: ['Macro'] };
const run = { id: 'run123', defaultDatasetId: 'data123', status: 'SUCCEEDED', finishedAt: new Date(now).toISOString() };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
function service(options = {}) {
  const calls = [], timers = [];
  const s = new FinancialInfoService({ enabled: true, token: 'test-private-token', now: () => now,
    setTimer: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; }, clearTimer: () => {},
    fetchImpl: async (url, init) => { calls.push({ url, init }); return url.includes('/runs?') ? json({ data: { items: [run] } }) : json([headline]); }, ...options });
  return { s, calls, timers };
}
test('normalizes source publication times, not extraction timestamps; deduplicates and removes unsafe URLs', () => {
  const rows = normalizeFinancialHeadlines([headline, { ...headline, title: '<b>Corrected</b>' }, { ...headline, guid: 'unsafe', link: 'javascript:alert(1)' }, { ...headline, guid: 'foreign', link: 'https://evil.example/news' }, { title: 'Missing date', timestamp: new Date(now).toISOString(), link: headline.link }], now);
  assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Corrected'); assert.equal(rows[0].publishedAt, headline.isoDate.replace('Z', '.000Z'));
  assert.throws(() => normalizeFinancialHeadlines([{}]), /INVALID_DATASET/);
});
test('unconfigured service performs zero network or paid operations', async () => {
  const f = service({ enabled: false }); await f.s.start(); await f.s.refresh();
  assert.equal(f.calls.length, 0); assert.equal(f.s.snapshot().status, 'not_configured'); f.s.stop();
});
test('one shared collector reads existing successful runs only and snapshots never trigger fetches', async () => {
  const f = service(); await f.s.start(); await f.s.refresh();
  assert.equal(f.calls.length, 2); assert.equal(f.s.snapshot().items.length, 1); assert.equal(f.s.snapshot().status, 'connected');
  for (let i = 0; i < 100; i++) f.s.snapshot();
  assert.equal(f.calls.length, 2);
  for (const call of f.calls) { assert.equal(call.init.method, 'GET'); assert.equal(call.init.redirect, 'error'); assert.equal(call.init.headers.Authorization, 'Bearer test-private-token'); assert.ok(!call.url.includes('token=')); assert.ok(!call.url.includes('run-sync')); }
  await f.s.refresh(); assert.equal(f.calls.length, 3); // unchanged run does not refetch dataset
  f.s.stop();
});
test('bad or unavailable data retains last-good headlines and marks outage', async () => {
  const f = service(); await f.s.start(); await f.s.refresh();
  f.s.fetch = async () => new Response('secret upstream detail', { status: 403 });
  await f.s.refresh(); assert.equal(f.s.snapshot().status, 'unavailable'); assert.equal(f.s.snapshot().items.length, 1);
  assert.ok(!JSON.stringify(f.s.snapshot()).includes('secret')); f.s.stop();
});
test('old successful scrape stays stale even though it was just polled', async () => {
  const f = service({ fetchImpl: async url => url.includes('/runs?') ? json({ data: { items: [{ ...run, finishedAt: '2026-10-16T20:00:00Z' }] } }) : json([headline]) });
  await f.s.start(); await f.s.refresh(); assert.equal(f.s.snapshot().status, 'stale'); assert.equal(f.s.snapshot().checkedAt, new Date(now).toISOString()); f.s.stop();
});
test('source schema changes fail closed rather than invent dates or follow arbitrary dataset URLs', async () => {
  const f = service({ fetchImpl: async () => json({ data: { items: [{ ...run, defaultDatasetId: '../other?token=oops' }] } }) });
  await f.s.start(); await f.s.refresh(); assert.equal(f.s.snapshot().status, 'unavailable'); assert.equal(f.s.snapshot().items.length, 0); f.s.stop();
});
test('bounded payloads and invalid body type are rejected', async () => {
  const f = service({ fetchImpl: async () => new Response('[]', { headers: { 'content-type': 'application/json', 'content-length': '1000001' } }) });
  await f.s.start(); await f.s.refresh(); assert.equal(f.s.snapshot().status, 'unavailable'); f.s.stop();
  assert.throws(() => normalizeFinancialHeadlines(Array(501).fill(headline)), /INVALID_DATASET/);
});
test('verified persisted snapshot survives restart with stable identity', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'kwant-financial-info-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const f = service({ directory }); await f.s.start(); await f.s.refresh(); const id = f.s.snapshot().items[0].id; f.s.stop();
  const g = service({ directory, enabled: false }); await g.s.start(); assert.equal(g.s.snapshot().items[0].id, id); assert.equal(g.calls.length, 0); g.s.stop();
});
