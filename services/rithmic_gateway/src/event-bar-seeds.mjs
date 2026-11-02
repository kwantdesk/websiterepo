import { readFileSync } from "node:fs";
import { readdir, stat, readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createEventBarBuilder } from "./event-bar-builder.mjs";
import { sessionTradeFiles, decodeTrade, sessionTradeFileBounds, readSessionTradeRecords } from "./trade-tape-archive.mjs";

const engineFingerprint = createHash("sha256").update(readFileSync(new URL("./event-bar-builder.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n")).digest("hex");

// A continuous event bar carries state across sessions. Rebuilding from a
// moving ten-day first tick shifts every subsequent threshold. Checkpoint
// only the forming bar from the earlier owned tape, never fabricated OHLC.
export async function eventSeedInputs(dir, exchange, symbol, beforeDate, continuous = false) {
  const tape = join(dir, "trades"), files = [];
  for (const date of (await readdir(tape).catch(() => [])).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < beforeDate).sort()) {
    files.push(...sessionTradeFiles(tape, date, exchange, symbol, continuous));
  }
  const stamps = await Promise.all(files.map(async file => { const s = await stat(file); const b = sessionTradeFileBounds(file, symbol, continuous); return Number.isFinite(b.start) || Number.isFinite(b.end) ? [file, s.size, s.mtimeMs, b.start, b.end] : [file, s.size, s.mtimeMs]; }));
  return { files, fingerprint: createHash("sha256").update(engineFingerprint + JSON.stringify(stamps)).digest("hex") };
}

export function eventSeedFile(dir, exchange, symbol, interval, beforeDate, continuous = false) {
  return join(dir, "event-seeds", beforeDate, `${exchange}-${symbol}-${encodeURIComponent(interval)}${continuous ? ".root" : ""}.json`);
}

export async function saveEventSeed(dir, exchange, symbol, interval, beforeDate, fingerprint, candle, continuous = false) {
  const file = eventSeedFile(dir, exchange, symbol, interval, beforeDate, continuous);
  await mkdir(join(dir, "event-seeds", beforeDate), { recursive: true });
  const temp = file + "." + process.pid + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify({ version: 1, source: "VPS recorded live trades", fingerprint, candle }));
  await rename(temp, file);
}

export async function loadEventBarSeed(dir, exchange, symbol, interval, beforeDate, continuous = false) {
  const input = await eventSeedInputs(dir, exchange, symbol, beforeDate, continuous);
  const cached = await readFile(eventSeedFile(dir, exchange, symbol, interval, beforeDate, continuous), "utf8").then(JSON.parse).catch(() => null);
  if (cached?.version === 1 && cached.fingerprint === input.fingerprint) return cached.candle ? [cached.candle] : [];
  let seed = [], since = "";
  for (const date of (await readdir(join(dir, "event-seeds")).catch(() => [])).filter(d => d < beforeDate).sort().reverse()) {
    const previous = await readFile(eventSeedFile(dir, exchange, symbol, interval, date, continuous), "utf8").then(JSON.parse).catch(() => null);
    if (!previous || previous.version !== 1) continue;
    const prefix = await eventSeedInputs(dir, exchange, symbol, date, continuous);
    if (previous.fingerprint !== prefix.fingerprint) continue;
    seed = previous.candle ? [previous.candle] : []; since = date; break;
  }
  const builder = createEventBarBuilder(interval, symbol, 1, seed);
  for (const file of input.files.filter(f => !since || f.split(/[\\/]/).at(-2) >= since)) await readSessionTradeRecords(file, symbol, continuous, row => {
    const t = decodeTrade(row);
    if (t) builder.add({ timestamp: t.timestamp, price: t.price, size: t.size, trades: 1,
      delta: t.side > 0 ? t.size : t.side < 0 ? -t.size : 0,
      contractSymbol: file.split(/[\\/]/).at(-1).split(".")[0].slice(exchange.length + 1) });
  });
  const candle = builder.finish().at(-1) ?? null;
  await saveEventSeed(dir, exchange, symbol, interval, beforeDate, input.fingerprint, candle, continuous);
  return candle ? [candle] : [];
}
