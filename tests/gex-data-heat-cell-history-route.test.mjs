import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { validateHeatCellArchiveQuery } from '../services/rithmic_gateway/src/heat-cell-archive.mjs';

const source = readFileSync(new URL('../src/app/api/gex-data/heat-map-history/route.ts', import.meta.url), 'utf8');
const request = { dataMode: 'CALL_IMPLIED_VOLATILITY', sessionDate: '2026-11-03', filter: { ticker: 'QQQ' } }, body = { request, sessionDate: '2026-11-03', expirationDate: '2026-11-06', strikePrice: 712, throughMs: Date.parse('2026-11-03T15:00:00Z') };
function harness() {
  const state = { actor: { mode: 'account' }, calls: [], status: 200, payload: { rows: [], nextCursor: null, coverage: { kind: 'observations-only', partial: true, reason: 'not-recorded' } } }, exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Buffer, URL, process: { env: {} }, require: name => {
    if (name === 'next/server') return { NextResponse: { json: (value, init = {}) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };
    if (name === '@/lib/serverAuth') return { getRouteActor: async () => state.actor };
    if (name === '@/lib/institutionalMarketData.server') return { fetchInstitutionalMarketData: async (...args) => { state.calls.push(args); return new Response(JSON.stringify(state.payload), { status: state.status }); } };
    if (name === '@/lib/gexDataPolicy') return { validateGexDataRequest: (tool, value) => { assert.equal(tool, 'heat-map'); return value; } };
    if (name.endsWith('heat-cell-archive-policy.mjs')) return { validateHeatCellArchiveQuery: value => validateHeatCellArchiveQuery(value, Date.parse('2026-11-04T02:00:00Z')) };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { state, post: (value = body, url = 'https://www.kwantdesk.com/api/gex-data/heat-map-history') => exports.POST(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })) };
}
test('named website route authenticates before archive access and forwards fixed existing gateway boundary', async () => {
  const h = harness(); h.state.actor = null; assert.equal((await h.post()).status, 401); assert.equal(h.state.calls.length, 0);
  h.state.actor = { mode: 'account' }; const response = await h.post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(h.state.calls.length, 1);
  const [path, init, timeout] = h.state.calls[0]; assert.equal(path, 'v1/market-data/heat-map-history'); assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body), body); assert.equal(timeout, 8000); assert.ok(init.signal); assert.equal(init.headers.Authorization, undefined);
});
test('malformed or cross-session/cursor-unsafe request is rejected before gateway call', async () => {
  const h = harness(); for (const value of [{ ...body, sessionDate: '../etc' }, { ...body, strikePrice: -1 }, { ...body, request: { ...request, dataMode: 'invented' } }, { ...body, cursor: 'x'.repeat(2049) }]) assert.equal((await h.post(value)).status, 400);
  assert.equal((await h.post(body, 'https://www.kwantdesk.com/api/gex-data/heat-map-history?path=/etc')).status, 400); assert.equal(h.state.calls.length, 0);
});
test('archive failures retain relevant status; malformed provider payload is never passed as history', async () => {
  const h = harness(); h.state.status = 409; h.state.payload = { code: 'heat_cell_stale_cursor' }; assert.equal((await h.post()).status, 409);
  h.state.status = 200; h.state.payload = { rows: [], coverage: { kind: 'complete-market-history' } }; assert.equal((await h.post()).status, 502);
});
test('gateway history branch is after unchanged authorization and separately defers when live collector overloaded', () => {
  const server = readFileSync(new URL('../services/rithmic_gateway/src/server.mjs', import.meta.url), 'utf8');
  assert.ok(server.indexOf('const authorization = await gatewayAuthorizer.authorize') < server.indexOf('if (url.pathname === "/v1/market-data/heat-map-history")'));
  assert.match(server, /if \(url\.pathname === "\/v1\/market-data\/heat-map-history"\) \{\s+if \(eventLoopLoadGuard\.isOverloaded\(\)\)/);
  const authorizer = readFileSync(new URL('../services/rithmic_gateway/src/gateway-authorizer.mjs', import.meta.url), 'utf8'); assert.doesNotMatch(authorizer, /heat-map-history/);
});
