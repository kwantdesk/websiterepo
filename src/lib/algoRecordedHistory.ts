import { algoSessionTimestamp, type AlgoCandle, type AlgoConfig, type AlgoRun } from "./algoWorkspace";
import { fetchWithDeadline, readMarketDataJson } from "./marketDataRequest";

/** Existing recorded-history route, one finite read on Run; no polling/provider login. */
export async function runAlgoOnRecordedHistory(config: AlgoConfig, signal: AbortSignal): Promise<AlgoRun> {
  const from = algoSessionTimestamp(config.from, config.sessionStart, config.timeZone);
  const to = algoSessionTimestamp(config.to, config.sessionEnd, config.timeZone);
  if (to > Date.now()) throw new Error("Choose completed sessions for a backtest.");
  if (to - from > 30 * 86400000) throw new Error("Select up to 30 calendar days per test.");
  const response = await fetchWithDeadline("/api/cme-history?" + new URLSearchParams({
    symbol: config.instrument, timeframe: "1m", days: "30", from: String(from), to: String(to),
  }), { signal }, 60_000);
  const data = await readMarketDataJson<{ candles?: AlgoCandle[]; error?: string }>(response);
  if (!response.ok || !Array.isArray(data.candles)) throw new Error(data.error || "Recorded history could not be loaded.");
  signal.throwIfAborted();
  return new Promise((resolve,reject) => {
    const worker = new Worker(new URL("./algoBacktest.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { worker.terminate(); signal.removeEventListener("abort", abort); clearTimeout(timeout); };
    const abort = () => { finish(); reject(new DOMException("Backtest cancelled.", "AbortError")); };
    const timeout = setTimeout(() => { finish(); reject(new Error("Backtest calculation timed out.")); }, 30_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e: MessageEvent<{ run?: AlgoRun; error?: string }>) => {
      finish(); if (e.data.run) resolve(e.data.run); else reject(new Error(e.data.error || "Backtest failed."));
    };
    worker.onerror = () => { finish(); reject(new Error("Backtest calculation could not start.")); };
    worker.postMessage({ config, candles: data.candles });
  });
}
