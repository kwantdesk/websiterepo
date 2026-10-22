import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ExposureArchiver } from './exposure-archiver.mjs';
import { createEodStore } from './gexbot-eod-store.mjs';

const TICKERS = new Set(['NQ_NDX','ES_SPX','NDX','QQQ','SPX','SPY','RUT','IWM','VIX']);
const CATEGORIES = new Set(['full','zero','one','gex_full','gex_zero','gex_one','majors','maxchange',
  'charm','charm_one','charm_zero','delta','delta_one','delta_zero','gamma','gamma_one','gamma_zero',
  'onecharm','onedelta','onegamma','onevanna','vanna','vanna_one','vanna_zero',
  'convexity','convexity_one','convexity_zero','negative_vanna','negative_vanna_one','negative_vanna_zero',
  'open_interest','open_interest_one','open_interest_zero','orderflow']);

export function validateLegacyPath(path, history = false, now = Date.now()) {
  const parts = String(path).split('/');
  const [ticker, view, category, date] = history ? parts.slice(2) : parts.slice(1);
  if (history ? parts.length !== 6 || parts[1] !== 'hist' : parts.length !== 4) throw Error('INVALID_PATH');
  if (!TICKERS.has(ticker) || !['classic','state','orderflow'].includes(view) || !CATEGORIES.has(category)) throw Error('INVALID_PATH');
  if (view === 'orderflow' && category !== 'orderflow') throw Error('INVALID_PATH');
  if (history) {
    const time = Date.parse(date + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0,10) !== date || time > now || now - time > 90 * 86400000) throw Error('INVALID_DATE');
  }
  return path;
}

export function signedDownload(payload, depth = 0) {
  if (depth > 5) return null;
  if (typeof payload === 'string') return /^https:\/\//i.test(payload.trim()) ? payload.trim() : null;
  if (Array.isArray(payload)) return payload.map(value => signedDownload(value, depth + 1)).find(Boolean) || null;
  if (!payload || typeof payload !== 'object') return null;
  for (const field of ['url','download_url','signed_url','href','location']) {
    if (typeof payload[field] === 'string' && /^https:\/\//i.test(payload[field])) return payload[field];
  }
  for (const field of ['data','payload','result','archive','download']) {
    const value = signedDownload(payload[field], depth + 1); if (value) return value;
  }
  return null;
}

export function validateDownload(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
    || !(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname) || url.hostname === 'api.gexbot.com')) throw Error('INVALID_ARCHIVE_ORIGIN');
  return url;
}

async function bounded(response, maximum) {
  if (Number(response.headers.get('content-length')) > maximum) { await response.body?.cancel(); throw Error('RESPONSE_TOO_LARGE'); }
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body || []) {
    bytes += chunk.length;
    if (bytes > maximum) throw Error('RESPONSE_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Private read-only compatibility edge; never owns another Rithmic session. */
export function createGexbotRelay({ token, key, fetchImpl = fetch, archive = null, eod = null, now = Date.now } = {}) {
  if (!token || !key) throw Error('PRIVATE_PROVIDER_CONFIGURATION_REQUIRED');
  const expected = Buffer.from('Bearer ' + token), pending = new Map(), cache = new Map();
  let cacheBytes = 0, active = 0;
  const metrics = { upstreamRequests: 0, cacheHits: 0, captured: 0, failures: 0 };
  function remember(id, entry) {
    if (cache.has(id)) cacheBytes -= cache.get(id).body.length;
    cache.delete(id); cache.set(id, entry); cacheBytes += entry.body.length;
    while (cache.size > 64 || cacheBytes > 16 * 1024 * 1024) {
      const first = cache.keys().next().value; cacheBytes -= cache.get(first).body.length; cache.delete(first);
    }
  }
  async function upstream(url, authenticated, maximum, timeout = 12000) {
    metrics.upstreamRequests++;
    const response = await fetchImpl(url, { headers: { Accept: 'application/json',
      ...(authenticated ? { Authorization: 'Bearer ' + key } : {}) }, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    if (!response.ok) { await response.body?.cancel(); return { status: [401,403,404,429].includes(response.status) ? response.status : 502,
      body: Buffer.from(JSON.stringify({ error: 'POSITIONING_UPSTREAM_' + response.status })), type: 'application/json',
      retry: response.status === 429 ? '30' : null }; }
    return { status: 200, body: await bounded(response, maximum), type: response.headers.get('content-type') || 'application/json' };
  }
  async function read(url) {
    if (url.pathname === '/v1/native-positioning/session') {
      if (!eod) return { status: 503, body: Buffer.from(JSON.stringify({error:'EOD_UNAVAILABLE'})) };
      try {
        const payload = await eod.read(url.searchParams.get('ticker'),url.searchParams.get('date'));
        return { status: 200, body: Buffer.from(JSON.stringify(payload)), type: 'application/json' };
      } catch(error) {
        const code = error.code || '';
        const status = error.status || (/INVALID_SELECTION/.test(code) ? 400 : /NOT_FOUND|NOT_READY|DATE_MISMATCH/.test(code) ? 404 : /THROTTLED|QUOTA/.test(code) ? 429 : 502);
        return {status,body:Buffer.from(JSON.stringify({error:/^EOD_[A-Z_]+$/.test(code)?code:'EOD_UNAVAILABLE'})),type:'application/json'};
      }
    }
    if (url.pathname.startsWith('/v1/native-positioning/')) {
      // Reuse the existing native provider's validation, coalescing and quota.
      const response = await fetchImpl('http://gateway:8793' + url.pathname + url.search,
        { headers: { Authorization: 'Bearer ' + token }, redirect: 'manual', signal: AbortSignal.timeout(40000) });
      return { status: response.status, body: await bounded(response, 16 * 1024 * 1024), type: 'application/json' };
    }
    const history = url.pathname === '/v1/gexbot-legacy/history';
    const path = validateLegacyPath(url.searchParams.get('path'), history, now());
    const response = await upstream('https://api.gexbot.com' + path + (history ? '?noredirect' : ''), true, 8 * 1024 * 1024);
    if (!history || response.status !== 200) return response;
    let payload; try { payload = JSON.parse(response.body.toString('utf8')); } catch { throw Error('INVALID_HISTORY_JSON'); }
    const download = signedDownload(payload);
    if (!download) return response;
    // Signed storage URL stays on the VPS; bearer is NEVER sent to storage.
    return upstream(validateDownload(download), false, 16 * 1024 * 1024, 30000);
  }
  const server = createServer(async (request, response) => {
    const send = entry => { response.writeHead(entry.status, { 'Content-Type': entry.type || 'application/json',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...(entry.retry ? { 'Retry-After': entry.retry } : {}) }); response.end(entry.body); };
    const json = (status, error) => send({ status, body: JSON.stringify({ error }) });
    const url = new URL(request.url, 'http://private');
    if (url.pathname === '/health' && request.method === 'GET') return send({ status: 200, body: JSON.stringify({ ok: true, active, ...metrics, archive: archive?.status() ?? null }) });
    const actual = Buffer.from(String(request.headers.authorization || ''));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return json(401, 'UNAUTHORIZED');
    if (request.method !== 'GET') return json(405, 'METHOD_NOT_ALLOWED');
    const native = /^\/v1\/native-positioning\/(status|catalog|snapshot|history|session)$/.test(url.pathname);
    const legacy = ['/v1/gexbot-legacy/read','/v1/gexbot-legacy/history'].includes(url.pathname);
    if (!native && !legacy) return json(404, 'NOT_FOUND');
    if (request.url.length > 1000 || (legacy && (url.searchParams.size !== 1 || !url.searchParams.has('path')))) return json(400, 'INVALID_REQUEST');
    if(url.pathname.endsWith('/session')&&(url.searchParams.size!==2||url.searchParams.getAll('ticker').length!==1||url.searchParams.getAll('date').length!==1))return json(400,'INVALID_SELECTION');
    if (legacy) { try { validateLegacyPath(url.searchParams.get('path'), url.pathname.endsWith('/history'), now()); } catch { return json(400, 'INVALID_SELECTION'); } }
    const id = url.pathname + url.search, historical = /\/(history|session)$/.test(url.pathname);
    const cached = cache.get(id);
    if (cached && cached.expires > now()) { metrics.cacheHits++; return send(cached); }
    try {
      if (!pending.has(id)) {
        if (active >= 4) return json(503, 'POSITIONING_QUEUE_BUSY');
        active++;
        const job = read(url).then(entry => {
          if (entry.status === 200) {
            // Separate gexbot archive root avoids concurrent gzip writers to QD files.
            let payload = entry.body[0] === 0x1f && entry.body[1] === 0x8b
              ? Buffer.from(JSON.stringify({ encoding: 'gzip-base64', data: entry.body.toString('base64') })) : entry.body;
            if (native && ['snapshot','history'].some(operation => url.pathname.endsWith('/' + operation))) {
              // Transport cache ages change on every read; do not archive them
              // as new market observations or defeat raw-frame deduplication.
              const envelope = JSON.parse(entry.body.toString('utf8'));
              payload = Buffer.from(JSON.stringify({ data: envelope.data, providerAsOf: envelope.providerAsOf }));
            }
            if ((!native || /\/(snapshot|history)$/.test(url.pathname))
              && archive?.archive({ path: url.pathname, requestBody: Buffer.from(url.search), payload, receivedAtMs: now() })) metrics.captured++;
            remember(id, { ...entry, expires: now() + (historical ? 300000 : native ? 1000 : 2000) });
          } else {
            metrics.failures++;
            if (entry.status === 429) remember(id, { ...entry, expires: now() + 30000 });
          }
          return entry;
        }).finally(() => { active--; pending.delete(id); });
        pending.set(id, job);
      }
      return send(await pending.get(id));
    } catch { metrics.failures++; return json(502, 'POSITIONING_UNAVAILABLE'); }
  });
  server.requestTimeout = 45000; server.headersTimeout = 10000; server.maxConnections = 128;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archive = new ExposureArchiver({ enabled: true, dir: '/recordings/gexbot', maxPendingBytes: 16 * 1024 * 1024, maxTrackedKeys: 512 });
  archive.start();
  const eod = createEodStore({dir:'/recordings/gexbot/eod',key:process.env.GEXBOT_API_KEY});
  const server = createGexbotRelay({ token: process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN, key: process.env.GEXBOT_API_KEY, archive, eod });
  server.listen(8795, '0.0.0.0');
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => {
    server.close(async () => { await archive.stop(); process.exit(0); });
    server.closeIdleConnections();
  });
}
