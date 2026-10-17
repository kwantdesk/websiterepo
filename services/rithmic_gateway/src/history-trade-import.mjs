import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { RithmicHistoryPlantClient } from "./history-plant-client.mjs";
import { cmeSessionBounds } from "./trading-session.mjs";
import { futuresTickSize } from "./event-bar-builder.mjs";

const compress = promisify(gzip);

export function validateHistoryTradeChunk(rows, bars) {
  const minutes = new Map();
  for (const [timestamp, price, volume, side] of rows) {
    const key = Math.floor(timestamp / 60000) * 60000;
    const m = minutes.get(key) ?? { open: price, high: price, low: price, close: price, volume: 0, bid: 0, ask: 0 };
    m.high = Math.max(m.high, price); m.low = Math.min(m.low, price); m.close = price;
    m.volume += volume; m.bid += side < 0 ? volume : 0; m.ask += side > 0 ? volume : 0;
    minutes.set(key, m);
  }
  for (const bar of bars) {
    if (!(Number(bar.volume) > 0)) continue;
    // History Plant's minute marker is the closing boundary, not bar open.
    const key = Number(bar.marker) * 1000 - 60000, m = minutes.get(key);
    if (!m || m.open !== Number(bar.openPrice) || m.high !== Number(bar.highPrice)
      || m.low !== Number(bar.lowPrice) || m.close !== Number(bar.closePrice) || m.volume !== Number(bar.volume)
      || (bar.bidVolume !== undefined && m.bid !== Number(bar.bidVolume))
      || (bar.askVolume !== undefined && m.ask !== Number(bar.askVolume))) {
      throw new Error(`Individual trades do not reconcile with History Plant minute ${key}: ${JSON.stringify({ trades: m, minute: { open: bar.openPrice, high: bar.highPrice, low: bar.lowPrice, close: bar.closePrice, volume: bar.volume, bid: bar.bidVolume, ask: bar.askVolume } })}`);
    }
    minutes.delete(key);
  }
  if (minutes.size) throw new Error("Individual trades have no matching authoritative minute bar.");
}

export function decodeIndividualHistoryTrade(row, { exchange, symbol, fromMs, toMs }) {
  const timestamp = Number(row.dataBarSsboe?.at(-1)) * 1000 + Number(row.dataBarUsecs?.at(-1) ?? 0) / 1000;
  const price = Number(row.closePrice), size = Number(row.volume);
  const bid = Number(row.bidVolume ?? 0), ask = Number(row.askVolume ?? 0);
  const tick = futuresTickSize(symbol);
  if (row.symbol !== symbol || row.exchange !== exchange || Number(row.numTrades) !== 1
    || !Number.isFinite(timestamp) || timestamp < fromMs || timestamp >= toMs
    || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(size) || size <= 0
    || Number(row.openPrice) !== price || Number(row.highPrice) !== price || Number(row.lowPrice) !== price
    || !Number.isSafeInteger(bid) || !Number.isSafeInteger(ask) || bid < 0 || ask < 0
    || (bid !== 0 && ask !== 0) || (bid + ask !== 0 && bid + ask !== size)
    || Math.abs(price / tick - Math.round(price / tick)) > 1e-5) {
    throw new Error("History Plant returned a non-atomic or invalid trade row.");
  }
  return [timestamp, price, size, ask > 0 ? 1 : bid > 0 ? -1 : 0];
}

export async function importHistoryTrades(config, { dir, exchange, symbol, tradingDate, maxBytes = 512 * 1024 * 1024 }, {
  createClient = (settings) => new RithmicHistoryPlantClient(settings, { requestTimeoutMs: 120_000 }),
} = {}) {
  if (!/^[A-Z0-9]+$/.test(exchange) || !/^[A-Z0-9]+$/.test(symbol)) throw new Error("Invalid instrument.");
  const bounds = cmeSessionBounds(tradingDate);
  if (!bounds || bounds.endMs > Date.now()) throw new Error("Import requires a completed trading session.");
  const folder = join(dir, "trades", tradingDate);
  const target = join(folder, `${exchange}-${symbol}.trades.history.ndjson.gz`);
  if (existsSync(target)) return { cached: true, target };
  const stage = join(dir, "history-import", "trades", `${exchange}-${symbol}-${tradingDate}`);
  mkdirSync(stage, { recursive: true });
  const budgetFile = join(dir, "history-import", "trade-transfer-budget.json");
  let previouslyUsed = 0;
  if (existsSync(budgetFile)) previouslyUsed = Number(JSON.parse(await readFile(budgetFile, "utf8")).bytes) || 0;
  // Conservative cumulative ceiling: no automatic reset can accidentally
  // replenish the provider's shared weekly allowance during a recovery.
  const globalLimit = 36 * 1024 ** 3;
  if (previouslyUsed >= globalLimit) throw new Error("History transfer safety budget exhausted.");
  const client = createClient(config);
  const chunks = [];
  const totals = { open: null, high: -Infinity, low: Infinity, close: null, volume: 0, bid: 0, ask: 0, trades: 0 };
  let count = 0, used = 0;
  try {
    for (let fromMs = bounds.startMs; fromMs < bounds.endMs; fromMs += 3600000) {
      const toMs = Math.min(fromMs + 3600000, bounds.endMs);
      const file = join(stage, `${fromMs}.json.gz`);
      let rows;
      if (existsSync(file)) {
        // Checkpointed chunks are immutable, private provider imports.
        const { gunzip } = await import("node:zlib");
        rows = JSON.parse((await promisify(gunzip)(await readFile(file))).toString());
      }
      // An empty provider response is not a durable checkpoint: during an
      // outage it can mean history is temporarily unavailable, not no trading.
      // Revisit it on recovery; only a reconciled full session is published.
      if (!rows?.length) {
        if (client.bytesReceived >= maxBytes || previouslyUsed + client.bytesReceived >= globalLimit) throw new Error("History trade import transfer safety budget reached.");
        rows = [];
        let previous = -Infinity;
        const before = client.bytesReceived;
        await client.replayIndividualTrades({ exchange, symbol,
          // A one-tick bar may need the following print to finalize. Request
          // one second of right context, then retain only the half-open window.
          startSec: fromMs / 1000, finishSec: toMs / 1000 + 1,
          onTrade: (row) => {
            if (client.bytesReceived > maxBytes || previouslyUsed + client.bytesReceived > globalLimit) throw new Error("History trade import transfer safety budget reached.");
            const at = Number(row.dataBarSsboe?.at(-1)) * 1000 + Number(row.dataBarUsecs?.at(-1) ?? 0) / 1000;
            if (Number.isFinite(at) && (at < fromMs || at >= toMs)) return;
            const trade = decodeIndividualHistoryTrade(row, { exchange, symbol, fromMs, toMs });
            if (trade[0] < previous) throw new Error("History Plant trade order reversed.");
            previous = trade[0]; rows.push(trade);
            if (rows.length > 500000) throw new Error("History trade chunk exceeds bounded capacity.");
          } });
        used += client.bytesReceived - before;
        if (rows.length) {
          await writeFile(`${file}.tmp`, await compress(JSON.stringify(rows), { level: 1 }));
          await rename(`${file}.tmp`, file);
        }
      }
      count += rows.length;
      for (const [, price, volume, side] of rows) {
        totals.open ??= price; totals.close = price;
        totals.high = Math.max(totals.high, price); totals.low = Math.min(totals.low, price);
        totals.volume += volume; totals.bid += side < 0 ? volume : 0; totals.ask += side > 0 ? volume : 0; totals.trades++;
      }
      chunks.push(await compress(rows.map(row => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), { level: 1 }));
      console.log(JSON.stringify({ symbol, tradingDate, hour: new Date(fromMs).toISOString(), trades: rows.length, bytesReceived: used }));
    }
    if (!count) throw new Error("History Plant returned no trades for the session.");
    // Provider minute bars can include the first few milliseconds AFTER the
    // cash-close boundary in the preceding bar. Never move real print times
    // to conceal that difference. Reconcile the complete session instead.
    const expected = { open: null, high: -Infinity, low: Infinity, close: null, volume: 0, bid: 0, ask: 0, trades: 0 };
    const bars = [];
    await client.replayMinuteBars({ exchange, symbol, startSec: bounds.startMs / 1000,
      finishSec: bounds.endMs / 1000 - 1, onBar: bar => bars.push(bar) });
    bars.sort((a, b) => Number(a.marker) - Number(b.marker));
    for (const bar of bars) {
      if (!(Number(bar.volume) > 0)) continue;
      expected.open ??= Number(bar.openPrice); expected.close = Number(bar.closePrice);
      expected.high = Math.max(expected.high, Number(bar.highPrice)); expected.low = Math.min(expected.low, Number(bar.lowPrice));
      expected.volume += Number(bar.volume); expected.bid += Number(bar.bidVolume ?? 0); expected.ask += Number(bar.askVolume ?? 0);
      expected.trades += Number(bar.numTrades);
    }
    if (Object.keys(expected).some(key => expected[key] !== totals[key])) {
      throw new Error(`Completed-session trade reconciliation failed: ${JSON.stringify({ actual: totals, expected })}`);
    }
    mkdirSync(folder, { recursive: true });
    // Concatenated gzip members are supported by the existing archive reader.
    // Publish only after every hour has finished. Never expose a partial day.
    await writeFile(`${target}.tmp`, Buffer.concat(chunks));
    await rename(`${target}.tmp`, target);
    return { target, trades: count, bytesReceived: used };
  } finally {
    client.close();
    await writeFile(`${budgetFile}.tmp`, JSON.stringify({ bytes: previouslyUsed + client.bytesReceived, updatedAt: new Date().toISOString() }));
    await rename(`${budgetFile}.tmp`, budgetFile);
  }
}
