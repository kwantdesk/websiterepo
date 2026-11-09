// Negotiate on the authenticated website, then receive bytes directly from
// the VPS. Never use a cross-origin redirect (it can turn Origin into null).
export function createLeasedMarketSource(endpoint) {
  const allowed = ['/api/databento/live',
    '/api/gex-data/stream',
    '/api/institutional-market-data/v1/market-data/index-stream',
    '/api/institutional-market-data/v1/heatmap/stream'];
  const request = new URL(endpoint, 'https://www.kwantdesk.com');
  if (!allowed.includes(request.pathname) || request.origin !== 'https://www.kwantdesk.com') {
    throw Error('Unsupported market stream');
  }
  request.searchParams.set('streamLease', '1');
  const events = new EventTarget();
  let active = null, pending = null, timer = null, closed = false, generation = 0;
  let controller = null;
  const source = {
    url: endpoint, withCredentials: false,
    get readyState() { return closed ? 2 : active?.readyState ?? 0; },
    onopen: null, onmessage: null, onerror: null,
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    dispatchEvent: event => events.dispatchEvent(event),
    close() {
      closed = true; generation++; clearTimeout(timer); controller?.abort();
      active?.close(); pending?.close(); active = pending = null;
    },
  };
  function emit(type, event) {
    const copy = type === 'open' || type === 'error' ? new Event(type)
      : new MessageEvent(type, { data: event.data, lastEventId: event.lastEventId });
    events.dispatchEvent(copy);
    source['on' + type]?.(copy);
  }
  function schedule(ms) {
    clearTimeout(timer);
    if (!closed) timer = setTimeout(() => { void connect(); }, ms);
  }
  async function connect() {
    const current = ++generation;
    controller?.abort(); const attempt = new AbortController(); controller = attempt;
    const deadline = setTimeout(() => attempt.abort(), 5000);
    try {
      const response = await fetch(request.pathname + request.search, {
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      });
      if (!response.ok) throw Error('Market lease unavailable');
      const lease = await response.json();
      const destination = new URL(String(lease.url));
      const expiry = Number(lease.expiresAt);
      if (lease.transport !== 'direct-vps' || destination.origin !== 'https://feed.kwantdesk.com'
        || destination.pathname !== '/browser-stream' || destination.username || destination.password
        || destination.hash || destination.searchParams.size !== 1 || !destination.searchParams.get('ticket')
        || !Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 310000) {
        throw Error('Invalid market lease');
      }
      if (closed || current !== generation) return;
      const next = new EventSource(destination.href);
      pending = next;
      const valid = () => !closed && (active === next || current === generation && pending === next);
      next.onopen = event => {
        if (!valid()) return;
        active?.close(); active = next; pending = null;
        schedule(Math.max(1, expiry - Date.now() - 10000));
        emit('open', event);
      };
      // Preserve named events and the wire payload; no per-tick proxy, parsing,
      // sampling or additional provider request is introduced here.
      for (const type of ['message', 'snapshot', 'verified', 'status', 'depth', 'history', 'cvd-history', 'ready', 'heartbeat', 'tick', 'rotate', 'feed-error', 'error-info']) {
        next.addEventListener(type, event => { if (valid()) emit(type, event); });
      }
      next.onerror = event => {
        if (!valid()) return;
        next.close(); if (pending === next) pending = null;
        if (active === next) active = null;
        if (!active) emit('error', event);
        if (!pending) schedule(1000);
      };
    } catch {
      if (!closed && current === generation) {
        if (!active) emit('error', new Event('error'));
        schedule(1000);
      }
    } finally { clearTimeout(deadline); }
  }
  void connect();
  return source;
}
