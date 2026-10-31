import { runRecordedAlgoBacktest } from "./algoBacktest";
import type { AlgoCandle, AlgoConfig } from "./algoWorkspace";
self.onmessage = (e: MessageEvent<{ config: AlgoConfig; candles: AlgoCandle[] }>) => {
  try { self.postMessage({ run: runRecordedAlgoBacktest(e.data.config, e.data.candles) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "The backtest failed." }); }
};
