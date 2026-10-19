/** Account-isolated, bounded request sharing for embedded analytical tools.
 * No polling timer: original tools own cadence and visibility. */
export function createOptionsFlowRequestPool(fetcher: typeof fetch = fetch) {
  type Entry = { text: string; status: number; headers: [string, string][]; until: number };
  const cache = new Map<string, Entry>();
  const pending = new Map<string, Promise<Entry>>();
  const controllers = new Set<AbortController>();
  const waiting: Array<() => void> = [];
  let running = 0, disposed = false;
  async function request(url: string, options: RequestInit = {}) {
    if (disposed) throw new Error("This workspace is closed.");
    if (!/^\/api\/(?:gex-data\/[a-z-]+|kwanty\/(?:status|catalog|snapshot|history)(?:\?[^#]*)?|gex-flow(?:\/ratios|\?[^#]*))$/.test(url)) throw new Error("Unsupported tool request.");
    if (options.body != null && typeof options.body !== "string") throw new Error("Unsupported request body.");
    const key = `${options.method ?? "GET"}:${url}:${options.body ?? ""}`;
    let entry = cache.get(key);
    if (!entry || entry.until <= Date.now()) {
      let job = pending.get(key);
      if (!job) {
        if (pending.size >= 32) throw new Error("Too many active requests. Try again shortly.");
        job = (async () => {
          if (running >= 4) await new Promise<void>(resolve => waiting.push(resolve));
          running++;
          const controller = new AbortController(); controllers.add(controller);
          const timeout = setTimeout(() => controller.abort(), 35_000);
          try {
            if (disposed) throw new Error("This workspace is closed.");
            const response = await fetcher(url, { ...options, credentials: "same-origin", signal: controller.signal });
            const text = await response.text();
            if (text.length > 12_000_000) throw new Error("Data response too large. Narrow the range.");
            const maxAge = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] ?? 0) * 1000;
            const value = { text, status: response.status, headers: [...response.headers.entries()] as [string, string][],
              until: Date.now() + (response.ok ? Math.min(300_000, Math.max(1_000, maxAge)) : 15_000) };
            if (!disposed) {
              cache.delete(key); cache.set(key, value);
              let bytes = [...cache.values()].reduce((sum, item) => sum + item.text.length, 0);
              while (cache.size > 48 || bytes > 24_000_000) { const first = cache.keys().next().value!; bytes -= cache.get(first)!.text.length; cache.delete(first); }
            }
            return value;
          } finally { clearTimeout(timeout); controllers.delete(controller); running--; waiting.shift()?.(); }
        })().finally(() => pending.delete(key));
        pending.set(key, job);
      }
      entry = await job;
    }
    if (disposed || options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    return new Response(entry.text, { status: entry.status, headers: entry.headers });
  }
  return { request, dispose() { disposed = true; controllers.forEach(controller => controller.abort()); waiting.splice(0).forEach(resolve => resolve()); cache.clear(); } };
}
const pools = new Map<string, { pool: ReturnType<typeof createOptionsFlowRequestPool>; users: number }>();
export function acquireOptionsFlowRequests(accountKey: string) {
  let entry = pools.get(accountKey);
  if (!entry) { entry = { pool: createOptionsFlowRequestPool(), users: 0 }; pools.set(accountKey, entry); }
  entry.users++;
  let released = false;
  return { request: entry.pool.request, release() {
    if (released) return; released = true;
    if (--entry.users === 0) { entry.pool.dispose(); pools.delete(accountKey); }
  } };
}
