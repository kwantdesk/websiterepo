import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFinancialInfo, financialInfoUnavailable } from '../src/lib/financialInfo.ts';

const item = { id: 'a'.repeat(24), title: 'Fixture only', publishedAt: '2026-10-18T12:00:00Z', url: 'https://www.financialjuice.com/News/123', categories: ['Macro'] };
const payload = { ...financialInfoUnavailable(true), status: 'connected', items: [item], stale: false, collectedAt: item.publishedAt };
test('client validates source-bound headlines and strips unknown fields', () => {
  const result = parseFinancialInfo({ ...payload, secret: 'must-not-leak', items: [{ ...item, secret: 'must-not-leak' }] });
  assert.equal(result.items.length, 1); assert.ok(!JSON.stringify(result).includes('must-not-leak'));
});
test('malformed source, invalid timestamps, unsafe links and oversized lists fail closed', () => {
  for (const change of [{ source: 'Other' }, { collectedAt: 'nope' }, { items: Array(501).fill(item) }, { items: [{ ...item, url: 'javascript:alert(1)' }] }, { items: [{ ...item, url: 'https://financialjuice.com.evil.com/story' }] }, { items: [{ ...item, publishedAt: null }] }]) assert.throws(() => parseFinancialInfo({ ...payload, ...change }));
});
test('unconfigured state is explicit and has a low-frequency retry', () => {
  const p = parseFinancialInfo(financialInfoUnavailable()); assert.equal(p.status, 'not_configured'); assert.equal(p.refreshAfterMs, 900000); assert.equal(p.items.length, 0);
});
test('route authorizes before accessing shared data and exposes no paid-run operation', () => {
  const route = readFileSync('src/app/api/financial-info/route.ts', 'utf8');
  assert.ok(route.indexOf('const actor = await getNewsRouteActor') < route.indexOf('const value = await sharedSnapshot'));
  assert.match(route, /Authentication required/); assert.match(route, /request.nextUrl.search/); assert.doesNotMatch(route, /APIFY_API_TOKEN|run-sync|method: "POST"/);
});
test('News retains its other sections and adds Financial Info independently', () => {
  const source = readFileSync('src/components/news/NewsWorkspace.tsx', 'utf8');
  for (const label of ['Financial Info', 'Economic Calendar', 'Macroeconomics', 'Live Macro Developments']) assert.ok(source.includes(label));
  const ui = readFileSync('src/components/news/FinancialInfoWorkspace.tsx', 'utf8');
  assert.match(ui, /document.hidden/); assert.match(ui, /controller\?\.abort/); assert.match(ui, /setPendingPayload/); assert.doesNotMatch(ui, /dangerouslySetInnerHTML|api\.apify\.com/);
});
