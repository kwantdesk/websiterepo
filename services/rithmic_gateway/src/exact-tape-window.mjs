import { join } from "node:path";
import { sessionTradeFiles } from "./trade-tape-archive.mjs";
import { tradingDatesBetween } from "./futures-bar-archive.mjs";
import { runArchiveFold } from "./archive-fold-worker-client.mjs";

const pending = new Map();
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
