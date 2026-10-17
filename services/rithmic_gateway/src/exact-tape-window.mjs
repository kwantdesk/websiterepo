import { join } from "node:path";
import { sessionTradeFiles } from "./trade-tape-archive.mjs";
import { tradingDatesBetween } from "./futures-bar-archive.mjs";
import { runArchiveFold } from "./archive-fold-worker-client.mjs";
import { statSync } from "node:fs";

const pending = new Map();
const compact = new Map();
let compactInFlight = 0;
export function loadExactFootprintWindow({ dir, exchange, symbol, starts, toMs, minimumTradeVolume = 0, maximumTradeVolume = 0 }) {
  if (!Array.isArray(starts) || !starts.length || starts.length > 1000
    || starts.some((t, i) => !Number.isSafeInteger(t) || t <= 0 || (i > 0 && t <= starts[i - 1]))
    || !Number.isSafeInteger(toMs) || toMs <= starts.at(-1) || toMs - starts[0] > 10 * 86400000
    || !Number.isFinite(minimumTradeVolume) || minimumTradeVolume < 0
    || !Number.isFinite(maximumTradeVolume) || maximumTradeVolume < 0) throw new Error("Invalid Footprint window.");
  const files = tradingDatesBetween(starts[0], toMs).flatMap(date => sessionTradeFiles(join(dir, "trades"), date, exchange, symbol));
  const sources = files.map(file => { const s = statSync(file); return `${file}:${s.size}:${s.mtimeMs}`; });
  const key = JSON.stringify([symbol, exchange, starts, toMs, minimumTradeVolume, maximumTradeVolume, sources]);
  const cached = compact.get(key);
  if (cached && cached.expires > Date.now()) return cached.request;
  if (compactInFlight >= 8) throw new Error("Footprint history is busy; retry shortly.");
  // Coalesce across users; bound completed/in-flight cache entries.
  if (compact.size >= 8) compact.delete(compact.keys().next().value);
  compactInFlight++;
  const request = runArchiveFold({ kind: "exact-footprint", files, starts, toMs, minimumTradeVolume, maximumTradeVolume }, 25_000)
    .then(result => ({ ...result, contractSymbol: symbol, fromMs: starts[0], toMs,
      minimumTradeVolume, maximumTradeVolume, schemaVersion: "kwantdesk-exact-footprint-v1" }))
    .catch(error => { compact.delete(key); throw error; })
    .finally(() => { compactInFlight--; });
  compact.set(key, { request, expires: Date.now() + 60_000 });
  return request;
}
export function loadExactTapeWindow({ dir, exchange, symbol, fromMs, toMs }) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs <= 0 || toMs <= fromMs || toMs - fromMs > 10 * 86400000) {
    throw new Error("Invalid exact execution window.");
  }
  const key = `${dir}:${exchange}:${symbol}:${fromMs}:${toMs}`;
  if (pending.has(key)) return pending.get(key);
  const files = tradingDatesBetween(fromMs, toMs).flatMap(date => sessionTradeFiles(join(dir, "trades"), date, exchange, symbol));
  const request = runArchiveFold({ kind: "exact-tape-window", files, fromMs, toMs, limit: 100000 })
    .then(result => ({ ...result, contractSymbol: symbol, exchange, fromMs, toMs, schemaVersion: "kwantdesk-exact-tape-window-v1" }))
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
