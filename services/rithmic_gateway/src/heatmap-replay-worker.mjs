import { parentPort, workerData } from 'node:worker_threads';
import { HeatmapReplayStore } from './heatmap-replay.mjs';

const { dir, tradingDate, exchange, symbol, tickSize } = workerData;
const store = new HeatmapReplayStore({ dir, tickSizeFor: () => tickSize });
const progress = setInterval(() => parentPort.postMessage(store.buildStatus(tradingDate, exchange, symbol) || {}), 1000);
try {
  const result = await store.manifestOrBuild(tradingDate, exchange, symbol);
  if (result.error) throw new Error(result.error);
  for (const build of store.builds.values()) await build.promise;
  const manifest = await store.readManifest(tradingDate, exchange, symbol);
  if (!manifest) throw new Error('Replay build did not publish a completed manifest.');
  parentPort.postMessage({ events: manifest.events, frames: manifest.frames });
} finally {
  clearInterval(progress);
}
