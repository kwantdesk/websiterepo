// Isolated local QA only. Never deploy this server or expose it beyond loopback.
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, extname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { HeatCellArchiveReader } from '../services/rithmic_gateway/src/heat-cell-archive.mjs';
import { validateHeatCellArchiveQuery } from '../services/rithmic_gateway/src/heat-cell-archive-policy.mjs';
import { GEX_DATA_TOOLS, gexDataClock, validateGexDataRequest } from '../src/lib/gexDataPolicy.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = resolve(ROOT, 'public');
const FIXTURE = resolve(ROOT, 'tests/fixtures/gex-data-parity-workspace.html');
const MAX_REQUEST = 128_000, MAX_RESPONSE = 12_000_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ttf': 'font/ttf' };

async function boundedBody(stream, maximum) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maximum) throw Object.assign(new Error('Response or request exceeds its QA safety bound.'), { status: 413 });
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}

export async function createParityServer({ fetchImpl = fetch, token: testToken, gatewayOrigin = 'http://127.0.0.1:8793', archiveRoot = process.env.GEX_PARITY_ARCHIVE_ROOT } = {}) {
  if(!['http://127.0.0.1:8793','https://feed.kwantdesk.com'].includes(gatewayOrigin))throw new Error('Unsupported audit gateway origin.');
  const token = testToken ?? parseEnv(await readFile(resolve(ROOT, 'services/rithmic_gateway/operator.env'), 'utf8')).KWANTIFY_MARKET_DATA_GATEWAY_TOKEN?.trim();
  if (!token) throw new Error('Existing local gateway authentication is unavailable. No service was started.');
  let archiveReader = null;
  if (archiveRoot) {
    if (typeof archiveRoot !== 'string' || !isAbsolute(archiveRoot) || /^[/\\]{2}/.test(archiveRoot)) throw new Error('QA archives require an absolute local temporary path.');
    const temp = await realpath(tmpdir()), actual = await realpath(resolve(archiveRoot)), inside = relative(temp, actual);
    if (!inside || inside.startsWith(`..${sep}`) || inside === '..' || resolve(temp, inside) !== actual) throw new Error('QA archives must be inside a dedicated local temporary directory.');
    archiveReader = new HeatCellArchiveReader({ dir: actual, key: randomBytes(32).toString('hex') });
  }
  const cache = new Map(), pending = new Map(); let cacheBytes = 0;
  const server = createServer(async (request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
      if (request.headers.host !== origin.slice(7) || (request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') {
        return json(response, 403, { error: 'Loopback same-origin QA requests only.' });
      }
      const rawPath = request.url.split('?')[0];
      let decoded;
      try { decoded = decodeURIComponent(rawPath); } catch { return json(response, 400, { error: 'Invalid path.' }); }
      if (decoded.includes('\\') || decoded.split('/').some(part => part === '..' || part === '.')) return json(response, 400, { error: 'Invalid path.' });
      const url = new URL(request.url, origin);
      const api = /^\/api\/gex-data\/([a-z-]+)$/.exec(url.pathname);
      if (api) {
        const tool = api[1];
        if (tool === 'status' && request.method === 'GET') {
          let connected = false;
          try {
            const health = await fetchImpl(`${gatewayOrigin}/health`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
            if (health.ok) { const state = JSON.parse((await boundedBody(health.body, MAX_RESPONSE)).toString()); connected = state.connected === true; }
          } catch { /* Truthful disconnected status; no vendor request. */ }
          return json(response, 200, { connected, mode: 'gateway', market: gexDataClock() });
        }
        if (request.method !== 'POST') return json(response, 405, { error: 'POST required.' });
        if (request.headers.origin !== origin) return json(response, 403, { error: 'Same-origin browser request required.' });
        if (tool === 'heat-map-history') {
          if (url.search) return json(response, 400, { error: 'Unsupported history parameter.' });
          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) return json(response, 415, { error: 'JSON required.' });
          let input, selection;
          try {
            input = JSON.parse((await boundedBody(request, Math.min(MAX_REQUEST, 65536))).toString('utf8'));
            input.request = validateGexDataRequest('heat-map', input.request);
            selection = validateHeatCellArchiveQuery(input);
          } catch (error) { return json(response, error.status === 413 ? 413 : 400, { error: 'Invalid or oversized recorded-cell request.' }); }
          if (!archiveReader) return json(response, 200, { rows: [], nextCursor: null,
            selection: { ticker: selection.ticker, sessionDate: selection.sessionDate, expirationDate: selection.expirationDate, strikePrice: selection.strikePrice, dataMode: selection.dataMode, throughMs: selection.throughMs },
            coverage: { kind: 'observations-only', scanComplete: true, partial: true, scanPartial: false, reason: 'not-recorded' } });
          const controller = new AbortController(), cancel = () => { if (!response.writableEnded) controller.abort(); };
          response.once('close', cancel);
          try { return json(response, 200, await archiveReader.read(input, { signal: controller.signal })); }
          catch (error) { return json(response, error.status || 502, { error: 'Local recorded-cell history is unavailable.', code: error.code || 'heat_cell_archive_unreadable' }); }
          finally { response.off('close', cancel); }
        }
        if (!GEX_DATA_TOOLS[tool]) return json(response, 404, { error: 'Unsupported QA data tool.' });
        let body;
        try { body = validateGexDataRequest(tool, JSON.parse((await boundedBody(request, MAX_REQUEST)).toString('utf8'))); }
        catch (error) { return json(response, error.status === 413 ? 413 : 400, { error: 'Invalid or oversized QA request.' }); }
        const serialized = JSON.stringify(body), key = `${tool}:${serialized}`;
        let entry = cache.get(key);
        if (!entry || entry.until <= Date.now()) {
          let job = pending.get(key);
          if (!job) {
            if (pending.size >= 16) return json(response, 503, { error: 'Local QA request queue is full.' });
            const spec = GEX_DATA_TOOLS[tool];
            job = (async () => {
              const upstream = await fetchImpl(`${gatewayOrigin}/v1/vendors/quantdata/v1/${spec.surface}/tool/${spec.path ?? tool}`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: serialized, signal: AbortSignal.timeout(35_000), redirect: 'error',
              });
              const bytes = await boundedBody(upstream.body, MAX_RESPONSE);
              if (!upstream.ok) return { status: upstream.status, bytes: Buffer.from(JSON.stringify({ error: `Existing licensed gateway returned ${upstream.status}.` })), until: 0 };
              let payload;
              try { payload = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Invalid gateway JSON.'); }
              const fetched = new Date().toISOString();
              const result = Buffer.from(JSON.stringify({ ...payload, _gexData: { gatewayFetchedAt: fetched, requestedSessionDate: body.sessionDate ?? null, liveVerified: false, localParityQA: true } }));
              if (result.length > MAX_RESPONSE) throw new Error('QA response exceeds its safety bound.');
              const historical = typeof body.sessionDate === 'string' && body.sessionDate < gexDataClock().date;
              const value = { status: 200, bytes: result, until: Date.now() + (historical || body.snapshotTime ? 300_000 : 10_000) };
              const previous = cache.get(key); if (previous) cacheBytes -= previous.bytes.length;
              cache.delete(key); cache.set(key, value); cacheBytes += result.length;
              while (cache.size > 32 || cacheBytes > 32_000_000) { const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).bytes.length; cache.delete(oldest); }
              return value;
            })().finally(() => pending.delete(key));
            pending.set(key, job);
          }
          entry = await job;
        }
        response.writeHead(entry.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return response.end(entry.bytes);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Read-only assets.' });
      let asset;
      if (url.pathname === '/') asset = FIXTURE;
      else if (/^\/(?:gex-data-app|kwanty-app)\/[a-zA-Z0-9_.-]+$/.test(url.pathname) || /^\/workspace-loading\.(?:js|css)$/.test(url.pathname) || /^\/fonts\/aleph\/Aleph-(?:Regular|Bold)\.ttf$/.test(url.pathname)) asset = resolve(PUBLIC, `.${url.pathname}`);
      else return json(response, 404, { error: 'QA asset not found.' });
      const actual = await realpath(asset), allowed = asset === FIXTURE ? resolve(ROOT, 'tests/fixtures') : PUBLIC;
      const inside = relative(allowed, actual);
      if (inside.startsWith(`..${sep}`) || inside === '..' || resolve(allowed, inside) !== actual) return json(response, 403, { error: 'Asset outside QA allowlist.' });
      const bytes = await readFile(actual);
      if (bytes.length > MAX_RESPONSE) return json(response, 413, { error: 'Asset too large.' });
      response.writeHead(200, { 'Content-Type': MIME[extname(actual)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      if (!response.headersSent) json(response, 502, { error: 'Local QA request failed; existing gateway or asset is unavailable.' });
      else response.destroy();
    }
  });
  server.requestTimeout = 40_000; server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = await createParityServer({gatewayOrigin:process.env.GEX_PARITY_GATEWAY_ORIGIN||'http://127.0.0.1:8793'});
    server.on('error', () => { process.stderr.write('Local parity QA could not bind its loopback port.\n'); process.exitCode = 1; });
    server.listen(4329, '127.0.0.1', () => process.stdout.write('LOCAL PARITY QA — http://127.0.0.1:4329/ — existing licensed source; not production.\n'));
  } catch { process.stderr.write('Local parity QA could not initialize; verify existing gateway environment privately.\n'); process.exitCode = 1; }
}
