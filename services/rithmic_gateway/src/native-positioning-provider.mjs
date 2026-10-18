import { readFile } from 'node:fs/promises';

import { gunzip } from 'node:zlib';
import {promisify} from 'node:util';
const decompress=promisify(gunzip);

const ROOT = 'https://api.gex.bot/v2';
export const FALLBACK_CATALOG = Object.freeze({
  tickers: ['AAPL','AMD','AMZN','APP','AVGO','BABA','BOIL','COIN','CRWD','CRWV','DDOG','DIA','GLD','GME','GOOG','GOOGL','HOOD','HYG','IBIT','INTC','IONQ','IWM','META','MSFT','MSTR','MU','NFLX','NVDA','NVO','ORCL','PL','PLTR','QQQ','RDDT','ROKU','SHOP','SLV','SMCI','SNDK','SNOW','SOFI','SPCX','SPY','TLT','TQQQ','TSLA','TSM','UBER','UNG','UNH','USO','UVXY','VALE','ZS','NDX','RUT','SPX','VIX','ES_SPX','NQ_NDX'],
  packages: { classic: ['gex_full','gex_zero','gex_one'], state: ['gex_full','gex_zero','gex_one','delta_zero','delta_one','gamma_zero','gamma_one','vanna_zero','vanna_one','charm_zero','charm_one'], orderflow: ['orderflow'] }
});

export class ProviderError extends Error {
  constructor(status, code, retryAfterSeconds = null) {
    super(code); this.status = status; this.code = code; this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function resolveKey(env = process.env) {
  if (env.GEXBOT_API_KEY?.trim()) return env.GEXBOT_API_KEY.trim();
  for (const candidate of [env.KWANTDESK_POSITIONING_KEY_FILE].filter(Boolean)) {
    try { const key=parseKeyFile(await readFile(candidate,'utf8')); if(key)return key; } catch { /* Optional server-only files; never log credentials. */ }
  }
  return null;
}

export function parseKeyFile(text) {
  const line = String(text).split(/\r?\n/).find(value => /^\s*(?:export\s+)?GEXBOT_API_KEY\s*=/.test(value));
  const value = line?.slice(line.indexOf('=') + 1).trim();
  if (!value) return null;
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0], end = value.indexOf(quote, 1);
    return end >= 1 ? value.slice(1, end).trim() || null : null;
  }
  return value.replace(/\s+#.*$/, '').trim() || null;
}

export function validateSelection(input, catalog = FALLBACK_CATALOG, history = false, now = Date.now()) {
  const ticker = String(input.ticker || 'SPX').toUpperCase();
  const pkg = String(input.package || 'classic');
  const category = String(input.category || (pkg === 'orderflow' ? 'orderflow' : 'gex_full'));
  const view = String(input.view || '');
  if (!catalog.tickers.includes(ticker) || !Object.hasOwn(catalog.packages, pkg) || !catalog.packages[pkg].includes(category)) throw new ProviderError(400, 'UNSUPPORTED_SELECTION');
  if (view && (!['majors','maxchange'].includes(view) || pkg === 'orderflow')) throw new ProviderError(400, 'UNSUPPORTED_VIEW');
  if (view && !['gex_full','gex_zero','gex_one'].includes(category)) throw new ProviderError(400, 'UNSUPPORTED_VIEW');
  const out = { ticker, package: pkg, category, view };
  if (history) {
    const date = String(input.date || '');
    const ms = Date.parse(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date || ms > now || now - ms > 90 * 86400000 || view) throw new ProviderError(400, 'INVALID_HISTORY_DATE');
    out.date = date;
  }
  return out;
}

function safeEntitlements(identity) {
  const allowed = new Set(['CLASSIC','STATE','ORDERFLOW','QUANT','RESEARCH']);
  const pick = values => (Array.isArray(values) ? values : []).filter(x => typeof x === 'string' && allowed.has(x.toUpperCase()));
  // Current 2.10 contract: level is an array, permissions is an array.
  // Project subscription names only; never account/key/user identity fields.
  const levels = pick(identity.level);
  const productLevel = typeof identity.entitlements?.gexbot?.level === 'string' && allowed.has(identity.entitlements.gexbot.level.toUpperCase()) ? identity.entitlements.gexbot.level : null;
  const permissions = Array.isArray(identity.permissions) ? identity.permissions : null;
  return { levels, highestLevel: allowed.has(String(identity.max_level).toUpperCase()) ? identity.max_level : null, productLevel, restAllowed: permissions ? permissions.includes('api_rest_access') : null, websocketAllowed: permissions ? permissions.includes('api_websocket_access') : null };
}

async function boundedBytes(response, maximum) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maximum) { await response.body?.cancel(); throw new ProviderError(502, 'UPSTREAM_RESPONSE_TOO_LARGE'); }
  const chunks = []; let length = 0;
  if (response.body) for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > maximum) throw new ProviderError(502, 'UPSTREAM_RESPONSE_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createProvider({ key = null, fetchImpl = fetch, now = Date.now, timeoutMs = 12000, cacheTtlMs = 1000 } = {}) {
  const ttl = Math.max(0, Math.min(1000, cacheTtlMs));
  const cache = new Map(), inFlight = new Map(), cooldowns = new Map();
  let activeCatalog = structuredClone(FALLBACK_CATALOG), catalogSource = 'public-catalog-fallback-2026-10-18', catalogFetchedAt = null;
  let verified = null, identityCheckedAt = null, identityError = null;
  function remember(path, entry) {
    entry.bytes=JSON.stringify(entry.data).length*2;
    if (path.startsWith('hist/')) for (const previous of cache.keys()) if (previous.startsWith('hist/')) cache.delete(previous);
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(path, entry);
    let bytes=[...cache.values()].reduce((sum,value)=>sum+value.bytes,0);
    while(cache.size>16||bytes>24_000_000){const oldest=cache.keys().next().value;bytes-=cache.get(oldest).bytes;cache.delete(oldest);}
  }
  async function request(path, authenticated = true, maximum = 8 * 1024 * 1024) {
    if (authenticated && !key) throw new ProviderError(503, 'API_KEY_REQUIRED');
    const delay = cooldowns.get(path) || 0;
    if (delay > now()) throw new ProviderError(429, 'UPSTREAM_RATE_LIMITED', Math.ceil((delay - now()) / 1000));
    let response;
    try {
      response = await fetchImpl(`${ROOT}/${path}`, { headers: { 'User-Agent': 'KwantDesk-Positioning/1.0', Accept: 'application/json', ...(authenticated ? { Authorization: `Bearer ${key}` } : {}) }, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        await response.body?.cancel();
        const header = response.headers.get('retry-after');
        const parsed = /^\d+$/.test(header || '') ? Number(header) : Math.ceil((Date.parse(header) - now()) / 1000);
        const retry = response.status === 429 ? Math.max(1, Math.min(3600, Number.isFinite(parsed) ? parsed : 5)) : null;
        if (retry) cooldowns.set(path, now() + retry * 1000);
        if (response.status === 401) { verified = false; identityError = 'UPSTREAM_AUTH_REJECTED'; }
        throw new ProviderError([400,401,403,404,429].includes(response.status) ? response.status : 502, response.status === 401 ? 'UPSTREAM_AUTH_REJECTED' : response.status === 403 ? 'UPSTREAM_ENTITLEMENT_REQUIRED' : response.status === 429 ? 'UPSTREAM_RATE_LIMITED' : response.status === 404 ? 'UPSTREAM_DATA_NOT_FOUND' : 'UPSTREAM_REQUEST_FAILED', retry);
      }
      const bytes = await boundedBytes(response, maximum);
      try { return JSON.parse(bytes.toString('utf8')); } catch { throw new ProviderError(502, 'UPSTREAM_INVALID_JSON'); }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 504 : 502, error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE');
    }
  }
  async function catalog() {
    if (catalogFetchedAt && now() - catalogFetchedAt < 3600000) return catalogResult();
    if (inFlight.has('catalog')) return inFlight.get('catalog');
    const promise = (async () => {
      try {
        const [tickers, classic, state, orderflow] = await Promise.all([request('tickers', false), ...['classic','state','orderflow'].map(pkg => request(`${pkg}/categories`, false))]);
        const list = [...(tickers.stocks || []), ...(tickers.indexes || []), ...(tickers.futures || [])];
        if (!list.length || [classic,state,orderflow].some(x => !Array.isArray(x) || !x.length)) throw new ProviderError(502, 'INVALID_CATALOG');
        if ([...list,...classic,...state,...orderflow].some(x => typeof x !== 'string' || !/^[A-Za-z0-9_]{1,32}$/.test(x))) throw new ProviderError(502, 'INVALID_CATALOG');
        activeCatalog = { tickers: [...new Set(list)], packages: { classic, state, orderflow } };
        catalogSource = 'public-api'; catalogFetchedAt = now();
      } catch { catalogSource = catalogFetchedAt ? 'public-api-stale' : 'public-catalog-fallback-2026-10-18'; }
      return catalogResult();
    })().finally(() => inFlight.delete('catalog'));
    inFlight.set('catalog', promise); return promise;
  }
  function catalogResult() { return { provider: 'GEXbot', ...structuredClone(activeCatalog), catalogSource, fetchedAt: catalogFetchedAt ? new Date(catalogFetchedAt).toISOString() : null }; }
  async function status() {
    if (key && (identityCheckedAt === null || now() - identityCheckedAt >= 60000)) {
      if (!inFlight.has('identity')) inFlight.set('identity', (async () => {
        try { const identity = await request('whoami'); verified = safeEntitlements(identity); identityError = null; }
        catch (error) { verified = false; identityError = error.code || 'UPSTREAM_UNAVAILABLE'; }
        identityCheckedAt = now();
      })().finally(() => inFlight.delete('identity')));
      await inFlight.get('identity');
    }
    return { provider: 'GEXbot', keyConfigured: Boolean(key), authenticated: Boolean(verified), entitlements: verified || null, checkedAt: identityCheckedAt === null ? null : new Date(identityCheckedAt).toISOString(), error: !key ? 'API_KEY_REQUIRED' : identityError, transport: 'REST polling', streaming: false, streamReason: 'Native websocket not negotiated; would modify shared API slot', personalLocalOnly: true };
  }
  function envelope(entry, selection, hit, historical = false) {
    const timestamp = Number(entry.data?.timestamp);
    const asOf = Number.isFinite(timestamp) && timestamp > 0 && timestamp < 1e12 ? timestamp * 1000 : Number.isFinite(timestamp) && timestamp >= 1e12 ? timestamp : null;
    const age = asOf === null ? null : now() - asOf;
    return { provider: 'GEXbot', ...selection, data: entry.data, providerAsOf: asOf === null ? null : new Date(asOf).toISOString(), fetchedAt: new Date(entry.fetchedAt).toISOString(), cache: { hit, ageMs: Math.max(0, now() - entry.fetchedAt), ttlMs: historical ? 3600000 : ttl }, freshness: { ageMs: age, state: historical ? 'historical' : age === null ? 'unknown' : age < 0 ? 'future-clock-skew' : age <= 5000 ? 'recent' : 'frozen-or-stale' }, transport: 'REST polling' };
  }
  async function snapshot(input) {
    if(inFlight.size>=16)throw new ProviderError(503,'POSITIONING_QUEUE_BUSY');
    const selection = validateSelection(input, activeCatalog);
    const path = `${selection.ticker}/${selection.package}/${selection.category}${selection.view ? `/${selection.view}` : ''}`;
    const existing = cache.get(path);
    if (existing && now() - existing.startedAt < ttl) return envelope(existing, selection, true);
    if (inFlight.has(path)) return envelope(await inFlight.get(path), selection, true);
    const startedAt = now();
    const promise = request(path).then(data => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError(502, 'UPSTREAM_INVALID_SNAPSHOT');
      const entry = { data, fetchedAt: now(), startedAt };
      remember(path, entry); return entry;
    }).finally(() => inFlight.delete(path));
    inFlight.set(path, promise); return envelope(await promise, selection, false);
  }
  async function history(input) {
    const selection = validateSelection(input, activeCatalog, true, now());
    const path = `hist/${selection.ticker}/${selection.package}/${selection.category}/${selection.date}`;
    const existing = cache.get(path);
    if (existing && now() - existing.startedAt < 3600000) return envelope(existing, selection, true, true);
    if (inFlight.has(path)) return envelope(await inFlight.get(path), selection, true, true);
    const promise = (async () => {
      const startedAt = now();
      const metadata = await request(`${path}?noredirect`, true);
      let url;
      try { url = new URL(metadata.url); } catch { throw new ProviderError(502, 'INVALID_HISTORY_LOCATION'); }
      // URL comes ONLY from authenticated provider metadata, never caller input.
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname) || url.hostname === 'api.gex.bot')) throw new ProviderError(502, 'UNSUPPORTED_HISTORY_STORAGE');
      let response;
      try { response = await fetchImpl(url, { headers: { 'User-Agent': 'KwantDesk-Positioning/1.0' }, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
      catch { throw new ProviderError(502, 'HISTORY_DOWNLOAD_FAILED'); }
      if (!response.ok) { await response.body?.cancel(); throw new ProviderError(502, 'HISTORY_DOWNLOAD_FAILED'); }
      let bytes = await boundedBytes(response, 12 * 1024 * 1024);
      try { if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await decompress(bytes, { maxOutputLength: 16 * 1024 * 1024 }); }
      catch { throw new ProviderError(502, 'HISTORY_DECOMPRESSION_FAILED'); }
      let data;
      try { data = JSON.parse(bytes.toString('utf8')); } catch { throw new ProviderError(502, 'HISTORY_INVALID_JSON'); }
      const entry = { data, startedAt, fetchedAt: now() };
      remember(path, entry); return entry;
    })().finally(() => inFlight.delete(path));
    inFlight.set(path, promise); return envelope(await promise, selection, false, true);
  }
  return { catalog, status, snapshot, history };
}
