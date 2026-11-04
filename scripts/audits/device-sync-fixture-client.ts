// Isolated HTTP/SSE test transport. Never imported by the application.
const owner = new URLSearchParams(location.search).get('owner') || 'device-fixture';
const device = crypto.randomUUID();
const user = { id: owner, email: 'fixture@example.invalid', user_metadata: { username: 'fixture' } };
const client = {
  auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: { user } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), updateUser: async () => ({ error: null }) },
  from(table: string) {
    const filters: Record<string, unknown> = {}; let op = 'read', payload: unknown, signal: AbortSignal;
    const execute = () => fetch('/fixture/preferences', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ table, owner, op, filters, payload }), signal }).then(r => r.json());
    const query = { select() { return query; }, eq(key: string, value: unknown) { filters[key] = value; return query; },
      abortSignal(value: AbortSignal) { signal = value; return query; }, update(value: unknown) { payload = value; op = 'update'; return query; },
      insert(value: unknown) { payload = value; op = 'insert'; return query; }, maybeSingle: execute, single: execute,
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) { return execute().then(resolve, reject); } };
    return query;
  },
  channel(topic: string) {
    let receive = () => {}, source: EventSource | null = null;
    const channel = { on(type: string, _filter: unknown, callback: () => void) { if(type === 'broadcast') receive = callback; return channel; },
      subscribe(callback?: (status: string) => void) {
        if (topic.startsWith('account-preference-hints:')) { source = new EventSource(`/fixture/events?owner=${encodeURIComponent(owner)}&device=${device}`); source.onmessage = () => receive(); source.onopen = () => callback?.('SUBSCRIBED'); }
        else queueMicrotask(() => callback?.('SUBSCRIBED'));
        return channel;
      },
      async send() { await fetch('/fixture/hint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner, device }) }); },
      close() { source?.close(); } };
    return channel;
  },
  removeChannel(channel: { close(): void }) { channel.close(); },
};
export function createClient() { return client; }
