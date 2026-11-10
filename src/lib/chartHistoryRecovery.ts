import { MarketDataResponseError } from "./marketDataRequest";

export function isTransientHistoryFailure(error: unknown): boolean {
  if (error instanceof MarketDataResponseError) {
    return [200, 429, 500, 502, 503, 504].includes(error.status);
  }
  return error instanceof TypeError || error instanceof Error
    && ["TimeoutError", "AbortError"].includes(error.name);
}

/** Retry a failed pane quietly, never an unbounded full-history polling loop.
 * Matching pane reads still share the workspace's in-flight request. */
export class ChartHistoryRecovery {
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  schedule(retry: () => void): boolean {
    if (this.disposed || this.timer !== null || this.attempts >= 3) return false;
    const delay = 2_000 * 2 ** this.attempts++;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.disposed) retry();
    }, delay);
    return true;
  }

  dispose() {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
