import test from 'node:test';
import assert from 'node:assert/strict';
import { writeChartHistoryCache, readChartHistoryCache } from '../src/lib/chartHistoryCache.ts';

test('a corrected historical wick survives memory eviction and a durable cache restore', async () => {
  // Minimal asynchronous IndexedDB contract: exercise the real cache adapter,
  // not a browser session or the owner's actual database.
  const stored = new Map();
  const later = value => {
    const request = {};
    queueMicrotask(() => { request.result = value; request.onsuccess?.(); });
    return request;
  };
  const database = {
    transaction() {
      const transaction = { objectStore: () => ({
        get: key => later(structuredClone(stored.get(key))),
        put(record) {
          stored.set(record.key, structuredClone(record));
          queueMicrotask(() => transaction.oncomplete?.());
        },
        // No prunable records in this bounded test; maintenance cannot hold
        // candle arrays or alter the observation being verified.
        openCursor: () => later(null),
      }) };
      return transaction;
    },
  };
  const originalWindow = globalThis.window;
  globalThis.window = { indexedDB: { open: () => later(database) } };
  try {
    const timestamp = Date.now() - 600000;
    const initial = [
      { timestamp, open: 100, high: 102, low: 99, close: 101, volume: 10 },
      { timestamp: timestamp + 60000, open: 101, high: 103, low: 100, close: 102, volume: 12 },
    ];
    await writeChartHistoryCache('DURABLE-WICK', '1m', initial);
    const corrected = [{ ...initial[0], high: 115, low: 92 }, initial[1]];
    await writeChartHistoryCache('DURABLE-WICK', '1m', corrected);
    assert.equal([...stored.values()].find(r => r.symbol === 'DURABLE-WICK').candles[0].high, 115);
    for (let i = 0; i < 13; i++) await writeChartHistoryCache(`EVICT-${i}`, '1m', initial);
    const restored = await readChartHistoryCache('DURABLE-WICK', '1m');
    assert.equal(restored.candles[0].high, 115);
    assert.equal(restored.candles[0].low, 92);
    assert.equal(restored.candles[1].close, 102);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
