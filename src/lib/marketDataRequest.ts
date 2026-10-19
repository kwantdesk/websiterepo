/** The deadline must remain attached while callers consume the response body.
 * Clearing an AbortController timer after fetch() only times the headers. */
export function fetchWithDeadline(url: string, init: RequestInit = {}, timeoutMs = 20_000) {
  const deadline = AbortSignal.timeout(timeoutMs);
  return fetch(url, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
  });
}

const retryable = (status: number) => [429, 502, 503, 504].includes(status);

/** One end-to-end budget for headers, JSON download and bounded GET retry. */
export async function fetchJsonWithBudget(url: string, timeoutMs = 20_000) {
  const signal = AbortSignal.timeout(timeoutMs);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {cache: "no-store", signal});
      if (retryable(response.status) && attempt === 0) {
        void response.body?.cancel().catch(() => undefined);
      } else {
        const payload: unknown = await response.json();
        return {response, payload};
      }
    } catch (error) {
      if (signal.aborted || attempt === 1 || error instanceof SyntaxError) throw error;
    }
    // Never start a second full timeout or keep a retry alive after its budget.
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 350);
      signal.addEventListener("abort", abort, {once: true});
    });
  }
  throw new Error("Workspace data could not be loaded.");
}
