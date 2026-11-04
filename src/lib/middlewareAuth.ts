/** A routing decision must finish before the platform middleware deadline. */
export function createMiddlewareAuthBudget(timeoutMs = 5_000, fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unavailable = () => new Error("Session verification is temporarily unavailable.");
  // A terminal HTTP timeout stops the auth SDK's automatic refresh retry loop.
  // This response exists only inside the SDK; no cookie writes are forwarded.
  const timedOutResponse = () => Response.json({ message: "Session verification timed out.", error_code: "middleware_auth_timeout" }, { status: 408 });
  const boundedFetch: typeof fetch = async (input, init) => {
    if (controller.signal.aborted) return timedOutResponse();
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : null);
    let publicKeyRead = false;
    try {
      publicKeyRead = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() === "GET"
        && new URL(input instanceof Request ? input.url : String(input)).pathname.endsWith("/.well-known/jwks.json");
    } catch { /* Non-URL requests keep the normal auth deadline. */ }
    for (let attempt = 0; ; attempt++) {
      try {
        const signals = [controller.signal, ...(callerSignal ? [callerSignal] : []), ...(publicKeyRead ? [AbortSignal.timeout(1800)] : [])];
        return await fetcher(input, { ...init, signal: AbortSignal.any(signals) });
      } catch (error) {
        if (controller.signal.aborted) return timedOutResponse();
        // Retry only a public, idempotent key GET, never a refresh/login POST
        // or rejected credentials. Both attempts share the routing deadline.
        if (publicKeyRead && attempt === 0 && !callerSignal?.aborted) continue;
        throw error;
      }
    }
  };
  return {
    fetch: boundedFetch,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(unavailable());
        }, timeoutMs);
      });
      try {
        return await Promise.race([Promise.resolve().then(operation), deadline]);
      } finally {
        clearTimeout(timer);
      }
    },
    get expired() { return controller.signal.aborted; },
  };
}

export function isTemporaryMiddlewareAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { status, name } = error as { status?: number; name?: string };
  return status === 0 || status === 408 || status === 429 || (typeof status === "number" && status >= 500)
    || name === "AuthRetryableFetchError" || name === "AuthUnknownError";
}

/** Public recovery shell only; never contains workspace data or grants access. */
export function middlewareAuthRecoveryHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reconnect session · KwantDesk</title><style>:root{color-scheme:light dark}body{margin:0;background:Canvas;color:CanvasText;font:16px system-ui;min-height:100vh;display:grid;place-items:center}main{max-width:30rem;padding:2rem}h1{font-size:1.35rem}p{line-height:1.6;opacity:.8}button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:.6rem;padding:.7rem 1rem;cursor:pointer}</style><script src="/auth-recovery.js" defer></script></head><body><main><h1>Reconnecting your session</h1><p>Session verification is temporarily unavailable. Your session has not been cleared.</p><p id="recovery-status" role="status">Retrying shortly…</p><button id="retry-session" type="button">Try again</button></main></body></html>`;
}
