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
    try {
      return await fetcher(input, {
        ...init,
        signal: callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) return timedOutResponse();
      throw error;
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
