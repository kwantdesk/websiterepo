import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { signBrowserStreamTicket } from '../src/lib/browserStreamTicket.ts';
import { verifyBrowserStreamTicket } from '../services/rithmic_gateway/src/browser-stream-edge.mjs';
const origin = 'https://www.kwantdesk.com';
function route(actor) {
  let issued = 0; const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/app/api/gex-data/[tool]/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, TextDecoder, URLSearchParams, process: { env: { VERCEL: '1' } },
    require: name => name === 'next/server' ? { NextResponse: { json: (value, init) => Response.json(value, init) } }
      : name.includes('serverAuth') ? { getRouteActor: actor }
      : name.includes('gexDataPolicy') ? { validateGexDataRequest: (tool, body) => { if (tool !== 'net-drift' || body.bad) throw Error(); return body; } }
      : name.includes('executionStreamLease') ? { executionStreamLeaseResponse: () => { issued++; return Response.json({ transport: 'direct-vps' }); } } : {},
  });
  return { get: async (query = '?tool=net-drift&request=e30&streamLease=1') => exports.GET({ nextUrl: new URL(origin + '/api/gex-data/stream' + query) }, { params: Promise.resolve({ tool: 'stream' }) }), count: () => issued };
}
test('lease is never issued for missing, unavailable or local-dev production actor', async () => {
  for (const actor of [async () => null, async () => { throw Error('timeout'); }, async () => ({ mode: 'local-dev' })]) {
    const r = route(actor); const response = await r.get(); assert([401, 503].includes(response.status)); assert.equal(r.count(), 0);
  }
});
test('authenticated exact validated selection only: no unknown tools, extra query, duplicate key or malformed body', async () => {
  const r = route(async () => ({ mode: 'supabase' }));
  assert.equal((await r.get()).status, 200); assert.equal(r.count(), 1);
  for (const query of ['?tool=bogus&request=e30&streamLease=1', '?tool=net-drift&request=***&streamLease=1', '?tool=net-drift&request=e30&streamLease=1&other=1', '?tool=net-drift&tool=net-drift&request=e30&streamLease=1']) assert.equal((await r.get(query)).status, 400);
  assert.equal(r.count(), 1);
});
test('GEX ticket preserves exact selected ticker and rejects wrong origin, tampering and expiry', () => {
  const key = 'test-only', now = 1000000, search = '?tool=net-drift&request=' + Buffer.from('{"filter":{"ticker":"SPY"}}').toString('base64url');
  const ticket = signBrowserStreamTicket({ key, origin, path: '/v1/market-data/gex-data-stream', search, now });
  assert.equal(verifyBrowserStreamTicket(ticket, key, origin, now).search, search);
  assert.throws(() => verifyBrowserStreamTicket(ticket, key, 'https://other.example', now));
  assert.throws(() => verifyBrowserStreamTicket(ticket + 'x', key, origin, now));
  assert.throws(() => verifyBrowserStreamTicket(ticket, key, origin, now + 301000));
});
