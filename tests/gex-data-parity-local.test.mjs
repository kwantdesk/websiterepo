import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { createParityServer } from '../scripts/gex-data-parity-local.mjs';

// Invoke the HTTP handler without binding any port or contacting a gateway.
async function harness() {
  const calls = [];
  const server = await createParityServer({ token: 'public-test-token', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(url.endsWith('/health') ? { connected: true } : { data: { verified: 17 } }), { status: 200 });
  } });
  server.address = () => ({ port: 4329 });
  const handler = server.listeners('request')[0];
  const send = async (url, { method = 'GET', body, headers = {} } = {}) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
    Object.assign(request, { url, method, headers: { host: '127.0.0.1:4329', ...(method === 'POST' ? { origin: 'http://127.0.0.1:4329' } : {}), ...headers } });
    let status, responseHeaders;
    return new Promise((resolve, reject) => {
      const response = { headersSent: false, writeHead(code, values) { status = code; responseHeaders = values; this.headersSent = true; }, end(bytes) { resolve({ status, headers: responseHeaders, text: Buffer.from(bytes ?? '').toString() }); }, destroy() { reject(Error('Unexpected destroyed response')); } };
      handler(request, response).catch(reject);
    });
  };
  return { send, calls };
}

test('local QA rejects foreign hosts/origins, traversal and non-allowlisted assets', async () => {
  const { send, calls } = await harness();
  for (const headers of [{ host: 'kwantdesk.com' }, { origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await send('/', { headers })).status, 403);
  for (const path of ['/gex-data-app/%2e%2e/operator.env', '/gex-data-app/%5c..%5coperator.env', '/gex-data-app/%ZZ']) assert.equal((await send(path)).status, 400);
  assert.equal((await send('/services/rithmic_gateway/operator.env')).status, 404);
  assert.equal(calls.length, 0);
});

test('local QA validates and coalesces exact bodies, and bearer never reaches browser', async () => {
  const { send, calls } = await harness();
  const options = { method: 'POST', body: { filter: { ticker: 'SPY' }, size: 1 } };
  const responses = await Promise.all([send('/api/gex-data/order-flow-consolidated', options), send('/api/gex-data/order-flow-consolidated', options)]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:8793/v1/vendors/quantdata/v1/options/tool/order-flow/consolidated');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer public-test-token');
  for (const response of responses) { assert.equal(response.status, 200); assert.doesNotMatch(response.text, /public-test-token/); assert.equal(JSON.parse(response.text)._gexData.liveVerified, false); }
  await send('/api/gex-data/order-flow-consolidated', options);
  assert.equal(calls.length, 1);
  assert.equal((await send('/api/gex-data/not-real', options)).status, 404);
  assert.equal((await send('/api/gex-data/net-drift', { method: 'POST', body: { size: 101 } })).status, 400);
  assert.equal((await send('/api/gex-data/net-drift', { method: 'POST', body: 'x'.repeat(128001) })).status, 413);
});

test('status uses real health shape and fixture never writes production storage', async () => {
  const { send, calls } = await harness();
  const status = await send('/api/gex-data/status');
  assert.equal(JSON.parse(status.text).connected, true);
  assert.equal(calls[0].url, 'http://127.0.0.1:8793/health');
  const page = await send('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /LOCAL PARITY QA/);
  assert.match(page.text, /NOT production/);
  assert.match(page.text, /Australia\/Brisbane/);
  assert.doesNotMatch(page.text, /localStorage|sessionStorage|public-test-token|Authorization/);
  assert.match(page.text, /hostTimezone=0/);
  assert.equal((await send('/gex-data-app/options-models.js?v=1')).status, 200);
});

test('entrypoint is fixed loopback and does not schedule background provider polling', async () => {
  const source = await readFile(new URL('../scripts/gex-data-parity-local.mjs', import.meta.url), 'utf8');
  assert.match(source, /server\.listen\(4329, '127\.0\.0\.1'/);
  assert.doesNotMatch(source, /setInterval\(/);
});
