import type { FootprintHistoryWindow } from "./compactFootprintHistory";

export type FootprintHistoryUpdate = { result?: FootprintHistoryWindow; error: string | null };
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, {once: true});
  });
}

/** Publish exact neighbours immediately; retry temporary gaps without an
 * unbounded poll or making a trader pan/reload to recover the same window. */
export async function recoverFootprintHistory(
  load: () => Promise<FootprintHistoryWindow>,
  publish: (update: FootprintHistoryUpdate) => void,
  signal: AbortSignal,
  wait: (ms: number, signal: AbortSignal) => Promise<void> = delay,
) {
  const backoff = [1_500, 4_000, 10_000];
  for (let attempt = 0; attempt <= backoff.length && !signal.aborted; attempt++) {
    try {
      const result = await load();
      if (signal.aborted) return;
      const missing = result.missingTimestamps.length;
      publish({ result, error: missing
        ? `Footprint history incomplete for ${missing} of ${result.totalBars} settled bars. Showing verified data only.`
        : null });
      if (!missing) return;
    } catch (error) {
      if (signal.aborted) return;
      publish({error: error instanceof Error ? error.message : "Exact Footprint history is unavailable."});
    }
    if (attempt < backoff.length) {
      try { await wait(backoff[attempt], signal); } catch { return; }
    }
  }
}
