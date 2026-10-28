const clamp = value => Math.max(0, Math.min(1000, Number(value) || 0));

// Negotiate a tiny authenticated lease; depth JSON travels straight from the
// VPS, never through Vercel and never through a cross-origin redirect.
export async function fetchRecordedHistory(path, query, signal) {
  const search = new URLSearchParams(query);
  search.set('historyLease', '1');
  const response = await fetch(`/api/institutional-market-data${path}?${search}`, {
    signal, cache: 'no-store', headers: { Accept: 'application/json' },
  });
  const lease = await response.json().catch(() => null);
  const destination = new URL(lease?.url || 'https://invalid.invalid');
  const keys = [...destination.searchParams.keys()];
  if (!response.ok || lease?.transport !== 'direct-vps'
    || destination.origin !== 'https://feed.kwantdesk.com'
    || destination.pathname !== '/liquidity-history' || destination.username || destination.password
    || keys.length !== 1 || keys[0] !== 'ticket' || !destination.searchParams.get('ticket')
    || !Number.isFinite(lease.expiresAt) || lease.expiresAt <= Date.now() || lease.expiresAt > Date.now() + 310_000) {
    throw new Error('Recorded liquidity connection is unavailable.');
  }
  return fetch(destination.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', headers: { Accept: 'application/json' } });
}

export function historyTimeAt(position, startMs, endMs) {
  return startMs + (endMs - startMs) * clamp(position) / 1000;
}

export function historyPosition(timestamp, startMs, endMs) {
  return endMs > startMs ? clamp((timestamp - startMs) / (endMs - startMs) * 1000) : 1000;
}

// Archive directories use the session's opening Chicago calendar date.
export function archiveDate(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(timestamp).map(part => [part.type, part.value]));
  const midnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(midnight - (Number(parts.hour) < 17 ? 86400_000 : 0)).toISOString().slice(0, 10);
}

export function nearestHistoryFrame(frames, timestamp) {
  if (!frames.length || timestamp < frames[0].timestamp || timestamp > frames.at(-1).timestamp) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].timestamp <= timestamp) lo = mid;
    else hi = mid - 1;
  }
  // Do not bridge a recording outage with an old book.
  return timestamp - frames[lo].timestamp <= 10_000 ? lo : -1;
}
