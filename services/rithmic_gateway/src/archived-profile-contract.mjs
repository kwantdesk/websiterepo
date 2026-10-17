import { readdirSync } from "node:fs";
import { join } from "node:path";
import { tradingDatesBetween } from "./futures-bar-archive.mjs";

/** Historical profile identity, NOT a current/live front-month decision. */
export function archivedProfileContract(dir, exchange, root, fromMs, toMs) {
  if (!/^[A-Z0-9]+$/.test(exchange) || !/^[A-Z0-9]+$/.test(root)) return null;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs <= 0 || toMs <= fromMs || toMs - fromMs > 366 * 86400000) return null;
  const dates = tradingDatesBetween(fromMs, toMs - 1).reverse();
  for (const date of dates) {
    let files;
    try { files = readdirSync(join(dir, "trades", date)); } catch { continue; }
    const candidates = new Set();
    for (const file of files) {
      const match = file.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.trades(?:\.history|\.backfill)?\.ndjson\.gz$/);
      if (!match || match[1] !== exchange) continue;
      const contract = match[2].match(/^([A-Z0-9]+)[FGHJKMNQUVXZ]\d{1,2}$/);
      if (contract?.[1] === root) candidates.add(match[2]);
    }
    // Around rollover, never choose an arbitrary contract or add two books.
    if (candidates.size > 1) return null;
    if (candidates.size === 1) return [...candidates][0];
  }
  return null;
}
