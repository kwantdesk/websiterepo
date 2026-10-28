import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { HeatmapReplayStore } from './heatmap-replay.mjs';
import { verifyBrowserStreamTicket } from './browser-stream-edge.mjs';

// No Rithmic login or live subscriptions here. CPU-heavy archive walks run
// in a single bounded worker in an independently limited container.
export function createHeatmapHistoryHandler({ store, token, resolveTickSize, now = Date.now }) {
  if (!token) throw new Error('A gateway bearer token is required.');
  const coverage = new Map();
  const refreshAfter = new Map();
  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', ...res.historyCors });
    res.end(JSON.stringify(body));
  };
  return async (req, res) => {
    let url = new URL(req.url, 'http://history');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, service: 'heatmap-history', activeBuilds: store.builds?.size || 0 });
    let authorization = String(req.headers.authorization || '');
    if (url.pathname === '/liquidity-history' && req.method === 'GET') {
      try {
        if (url.searchParams.getAll('ticket').length !== 1 || [...url.searchParams.keys()].some(key => key !== 'ticket')) throw new Error();
        const origin = String(req.headers.origin || '');
        const ticket = verifyBrowserStreamTicket(url.searchParams.get('ticket'), token, origin, now());
        if (!['/v1/heatmap/replay', '/v1/heatmap/replay/chunk'].includes(ticket.path)) throw new Error();
        url = new URL(ticket.path + ticket.search, 'http://history');
        authorization = `Bearer ${token}`;
        res.historyCors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'X-KwantDesk-Market-Transport': 'direct-vps' };
      } catch { return send(res, 401, { error: 'Invalid history lease.' }); }
    }
    const supplied = Buffer.from(authorization);
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(res, 401, { error: 'Unauthorized' });
    if (req.method !== 'GET' || !['/v1/heatmap/replay', '/v1/heatmap/replay/chunk'].includes(url.pathname)) return send(res, 404, { error: 'Not found' });
    const date = url.searchParams.get('tradingDate') || '';
    const symbol = (url.searchParams.get('symbol') || '').toUpperCase();
    const exchange = (url.searchParams.get('exchange') || 'CME').toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[A-Z0-9]{1,12}$/.test(symbol) || !/^[A-Z0-9]{1,12}$/.test(exchange)) return send(res, 400, { error: 'Valid tradingDate, symbol and exchange are required.' });
    try {
      if (url.pathname.endsWith('/chunk')) {
        const chunk = Number(url.searchParams.get('chunk'));
        const generation = url.searchParams.get('generation') || '';
        if (!url.searchParams.has('chunk') || !Number.isFinite(chunk) || (generation && !/^\d+-[a-f0-9]+$/.test(generation))) return send(res, 400, { error: 'Invalid chunk or generation.' });
        const body = await store.readChunk(date, exchange, symbol, chunk, generation);
        return send(res, body ? 200 : generation ? 409 : 404, body || { error: 'No recorded chunk at this time.', ...(generation ? { code: 'HISTORY_GENERATION_EXPIRED' } : {}) });
      }
      const manifest = await store.readManifest(date, exchange, symbol);
      const key = `${date}:${exchange}:${symbol}`;
      let refresh = false;
      if (manifest) {
        let last = Number(manifest.lastFrameMs) || coverage.get(`${key}:${manifest.builtAt}`);
        if (!last && manifest.chunks?.length) {
          const tail = await store.readChunk(date, exchange, symbol, manifest.chunks.at(-1).startMs, manifest.generation || '');
          last = Number(tail?.frames.at(-1)?.snapshot.timestamp) || 0;
          if (coverage.size >= 64) coverage.delete(coverage.keys().next().value);
          coverage.set(`${key}:${manifest.builtAt}`, last);
        }
        const through = Number(url.searchParams.get('throughMs')) || now();
        refresh = through > last + Number(manifest.frameMs || 2000) && store.sourceChanged(date, exchange, symbol, manifest);
        if (!refresh) return send(res, 200, { manifest });
        const pending = store.buildStatus(date, exchange, symbol);
        if (pending) return send(res, 200, pending);
        if (now() < (refreshAfter.get(key) || 0)) return send(res, 200, { building: true, queued: true });
      }
      await resolveTickSize(exchange, symbol);
      const result = await store.manifestOrBuild(date, exchange, symbol, { refresh });
      if (refresh && result.building && !result.queued) {
        if (refreshAfter.size >= 64) refreshAfter.delete(refreshAfter.keys().next().value);
        refreshAfter.set(key, now() + 120_000);
      }
      return send(res, result.error ? 404 : 200, result);
    } catch {
      return send(res, 503, { error: 'Recorded liquidity history could not be prepared. Try again shortly.' });
    }
  };
}

export function startHeatmapHistoryServer() {
  const token = process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN;
  const ticks = new Map();
  const store = new HeatmapReplayStore({ dir: process.env.RITHMIC_RECORD_DIR || '/recordings',
    tickSizeFor: symbol => {
      const root = symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '');
      const tick = ticks.get(root);
      if (!tick) throw new Error('Instrument tick size is unavailable.');
      return tick;
    }, log: message => console.log(message),
  });
  const handler = createHeatmapHistoryHandler({ store, token, resolveTickSize: async (exchange, symbol) => {
    if (ticks.has(symbol)) return;
    const query = new URLSearchParams({ exchange, symbol, depthTicks: '20' });
    const response = await fetch(`${process.env.HEATMAP_GATEWAY_ORIGIN || 'http://gateway:8793'}/v1/heatmap/snapshot?${query}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json();
    const tick = Number(body.snapshot?.tickSize);
    if (!response.ok || !(tick > 0) || !Number.isFinite(tick)) throw new Error('No valid instrument tick size.');
    ticks.set(symbol, tick);
  } });
  const server = createServer(handler);
  server.requestTimeout = 30_000;
  server.listen(Number(process.env.HEATMAP_HISTORY_PORT || 8796), '0.0.0.0');
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  return server;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) startHeatmapHistoryServer();
