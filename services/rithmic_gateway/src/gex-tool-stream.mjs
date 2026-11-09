const OPTIONS = ['contract-statistics', 'contract-trade-side-statistics', 'exposure-by-expiration', 'exposure-by-strike',
  'gainers-losers', 'heat-map', 'interval-map', 'iv-rank', 'market-share', 'max-pain', 'max-pain-over-time',
  'net-drift', 'option-price-over-time', 'net-flow', 'volatility-skew', 'volatility-drift', 'term-structure',
  'open-interest-by-strike', 'open-interest-by-expiration', 'open-interest-over-time', 'open-interest-change'];
export const GEX_TOOL_STREAM_PATHS = new Map([
  ...OPTIONS.map(id => [id, `/v1/options/tool/${id}`]),
  ['order-flow-consolidated', '/v1/options/tool/order-flow/consolidated'],
  ['order-flow-unconsolidated', '/v1/options/tool/order-flow/unconsolidated'],
  ...['dark-flow', 'dark-pool-levels', 'equity-prints', 'exchange-notifications', 'market-map', 'stock-price-over-time']
    .map(id => [id, `/v1/equities/tool/${id}`]),
  ['news-articles', '/v1/news/tool/news-articles'],
]);

export function gexToolStreamSelection(search, now = Date.now()) {
  if (typeof search !== 'string' || search.length > 4096) throw Error('Invalid live data selection.');
  const params = new URLSearchParams(search);
  if ([...params.keys()].some(key => !['tool', 'request'].includes(key))
    || params.getAll('tool').length !== 1 || params.getAll('request').length !== 1) throw Error('Invalid live data selection.');
  const tool = params.get('tool'), path = GEX_TOOL_STREAM_PATHS.get(tool), encoded = params.get('request');
  if (!path || !encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw Error('Invalid live data selection.');
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.toString('base64url') !== encoded || bytes.length > 3000) throw Error('Invalid live data selection.');
  const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Invalid live data selection.');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const selectedDate = body.sessionDate ?? body.sessionDateRange?.endDate;
  const once = Boolean(body.snapshotTime || body.timeRange || selectedDate && selectedDate < date);
  const pollMs = tool.startsWith('open-interest') || tool === 'iv-rank' ? 60000 : tool === 'news-articles' ? 30000 : 2000;
  return { tool, path, body, once, pollMs };
}

/** SSE owns no provider connection; all viewers subscribe to the shared pool. */
export function attachGexToolStream(request, response, url, pool, { now = Date.now, setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const selection = gexToolStreamSelection(url.search, now());
  response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  response.flushHeaders?.(); response.write('retry: 1500\n\n');
  let closed = false, stop, heartbeat, lease, pending = null;
  const cleanup = () => {
    if (closed) return; closed = true; pending = null; stop?.();
    clearIntervalImpl(heartbeat); clearTimeoutImpl(lease);
    response.off('drain', drain); request.off('close', cleanup); response.off('close', cleanup); response.off('error', cleanup);
  };
  const send = frame => {
    if (closed) return;
    // Keep at most one latest pending frame, never an unbounded per-client queue.
    if (response.writableNeedDrain) { pending = frame; return; }
    const payload = { ...frame.payload, _gexData: { gatewayFetchedAt: new Date(frame.retrievedAt).toISOString(),
      requestedSessionDate: selection.body.sessionDate ?? null, liveVerified: false,
      delivery: 'shared-vps-snapshot', revision: frame.revision, sourceTimestamp: frame.sourceTimestamp } };
    response.write(`event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  const drain = () => { if (pending) { const frame = pending; pending = null; send(frame); } };
  response.on('drain', drain); request.on('close', cleanup); response.on('close', cleanup); response.on('error', cleanup);
  try {
    stop = pool.subscribe(selection, send, () => {
      if (!closed && !response.writableNeedDrain) response.write('event: feed-error\ndata: {"code":"market_data_unavailable","message":"Live data is temporarily unavailable."}\n\n');
    }, () => {
      // Acquisition receipt only; never a fabricated data revision.
      if (!closed && !response.writableNeedDrain) response.write('event: verified\ndata: {}\n\n');
    });
    if (closed) stop();
    heartbeat = setIntervalImpl(() => { if (!closed && !response.writableNeedDrain) response.write(': keepalive\n\n'); }, 8000);
    lease = setTimeoutImpl(() => { cleanup(); response.end(); }, 270000);
    heartbeat?.unref?.(); lease?.unref?.();
  } catch { cleanup(); response.end(); }
  return cleanup;
}
