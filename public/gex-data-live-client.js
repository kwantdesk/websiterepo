/** One direct VPS lease per exact tool selection, shared by local frames.
 * This transports acquired snapshots; it does not imply upstream push access.
 */
const tools = new Set(('contract-statistics contract-trade-side-statistics exposure-by-expiration exposure-by-strike gainers-losers heat-map interval-map iv-rank market-share max-pain max-pain-over-time net-drift option-price-over-time net-flow volatility-skew volatility-drift term-structure open-interest-by-strike open-interest-by-expiration open-interest-over-time open-interest-change order-flow-consolidated order-flow-unconsolidated dark-flow dark-pool-levels equity-prints exchange-notifications market-map stock-price-over-time news-articles').split(' '));
// Other paged tapes retain finite REST delivery until their page merges are
// audited. Latest-first Equity has a tested provider-ID merge for loaded pages.
for (const tool of ['open-interest-change', 'news-articles']) tools.delete(tool);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export class GexDataStreamUnavailable extends Error {}

export function createGexDataLiveClient({ createSource, onFrame = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const entries = new Map(), owners = new Map(); let disposed = false, bytes = 0;
  const fallbackUntil = new Map();
  const forget = entry => {
    entry.source.close(); entries.delete(entry.key); bytes -= entry.bytes;
    for (const waiter of [...entry.waiters]) waiter.reject(new Error('This data selection was closed.'));
  };
  const release = consumer => {
    for (const [slot, key] of [...owners]) if (slot.startsWith(consumer + '\n')) {
      owners.delete(slot); const entry = entries.get(key); entry?.owners.delete(slot);
      if (entry && !entry.owners.size) forget(entry);
    }
  };
  const response = entry => new Response(entry.text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  function request(url, options, consumer) {
    const tool = url?.replace('/api/gex-data/', '');
    if (disposed || !consumer || options?.method?.toUpperCase() !== 'POST' || !tools.has(tool) || typeof options.body !== 'string') return null;
    const slot = consumer + '\n' + url;
    const fallback = () => { const old = owners.get(slot), previous = entries.get(old); owners.delete(slot); previous?.owners.delete(slot); if (previous && !previous.owners.size) forget(previous); return null; };
    let body, text;
    try {
      body = JSON.parse(options.body);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fallback();
      // Older pages are finite REST requests. They do not close the same
      // selection's first-page live channel while the user scrolls back.
      // A pinned Market Map minute is a finite read, never a live subscription.
      if (tool === 'market-map' && body.snapshotTime) return fallback();
      if (body.searchAfter) return ['equity-prints','exchange-notifications','order-flow-consolidated','order-flow-unconsolidated'].includes(tool) ? null : fallback();
      const chronologicalField=['equity-prints','order-flow-consolidated','order-flow-unconsolidated'].includes(tool)?'TRADE_TIME':tool==='exchange-notifications'?'CREATED_TIME':null;
      if (chronologicalField && (body.sort?.field !== chronologicalField || body.sort?.direction !== 'DESCENDING')) return fallback();
      text = JSON.stringify(canonical(body));
    } catch { return fallback(); }
    const encodedBytes = new TextEncoder().encode(text); if (encodedBytes.length > 2900) return fallback();
    const key = url + ':' + text;
    if ((fallbackUntil.get(key) ?? 0) > Date.now()) return fallback();
    fallbackUntil.delete(key);
    const old = owners.get(slot);
    if (old && old !== key) { const previous = entries.get(old); previous?.owners.delete(slot); if (previous && !previous.owners.size) forget(previous); }
    owners.set(slot, key);
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= 32) { owners.delete(slot); return Promise.reject(new Error('Too many active data selections.')); }
      const encoded = btoa(String.fromCharCode(...encodedBytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
      const source = createSource('/api/gex-data/stream?' + new URLSearchParams({ tool, request: encoded }));
      entry = { key, source, owners: new Set(), waiters: new Set(), text: null, bytes: 0, at: -Infinity, revision: null, failed: false, fail: null };
      entries.set(key, entry);
      entry.fail = () => {
        if (entries.get(key) !== entry) return;
        entry.failed = true;
        // A provider error on an established stream may recover in place. A
        // transport failure or missing initial frame must release its lease.
        fallbackUntil.set(key, Date.now() + 60_000);
        if (fallbackUntil.size > 64) fallbackUntil.delete(fallbackUntil.keys().next().value);
        for (const slot of entry.owners) owners.delete(slot);
        for (const waiter of [...entry.waiters]) waiter.reject(new GexDataStreamUnavailable('Live delivery is unavailable.'));
        forget(entry);
      };
      source.addEventListener('feed-error', () => { if (entry.text === null) entry.fail(); else entry.failed = true; });
      source.addEventListener('error', entry.fail);
      source.addEventListener('verified', () => { entry.failed = false; });
      source.addEventListener('snapshot', event => {
        if (entries.get(key) !== entry || !entry.owners.size) return;
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }
        const meta = payload?._gexData, at = Date.parse(meta?.gatewayFetchedAt);
        if (!Number.isFinite(at) || at < entry.at || typeof meta?.revision !== 'string') return;
        entry.failed = false;
        if (entry.revision === meta.revision) return;
        if (event.data.length > 12_000_000 || bytes - entry.bytes + event.data.length > 24_000_000) { entry.failed = true; return; }
        const hadFrame = entry.text !== null;
        bytes += event.data.length - entry.bytes; entry.bytes = event.data.length;
        entry.text = event.data; entry.at = at; entry.revision = meta.revision;
        for (const waiter of [...entry.waiters]) waiter.resolve(response(entry));
        // The first frame already completes the pending request. Only subsequent
        // changes request an in-place redraw, never a second provider call.
        if (hadFrame) for (const owner of entry.owners) onFrame({ consumer: owner.split('\n')[0], url });
      });
    }
    entry.owners.add(slot);
    if (entry.failed) return Promise.reject(new Error('Live data is temporarily unavailable.'));
    if (entry.text !== null) return Promise.resolve(response(entry));
    return new Promise((resolve, reject) => {
      let timer;
      const finish = fn => value => { clearTimer(timer); options.signal?.removeEventListener('abort', abort); entry.waiters.delete(waiter); fn(value); };
      const waiter = { resolve: finish(resolve), reject: finish(reject) };
      const abort = () => waiter.reject(new DOMException('The data request was cancelled.', 'AbortError'));
      entry.waiters.add(waiter); timer = setTimer(entry.fail, 10_000);
      options.signal?.addEventListener('abort', abort, { once: true }); if (options.signal?.aborted) abort();
    });
  }
  return { request, release, pause() { for (const slot of [...owners.keys()]) release(slot.split('\n')[0]); },
    dispose() { disposed = true; this.pause(); fallbackUntil.clear(); }, status: () => ({ selections: entries.size, owners: owners.size, bytes }) };
}
