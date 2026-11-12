import { existsSync } from "node:fs";
import { join } from "node:path";
import { runArchiveFold } from "./archive-fold-worker-client.mjs";
import { sessionTradeFiles } from "./trade-tape-archive.mjs";
import { chicagoTradingDate, cmeSessionBounds } from "./trading-session.mjs";
import { profileFileName } from "./session-profile-archive.mjs";

const MINUTE = 60_000;
const MAX_CACHE = 64;
const MAX_QUEUED = 8;
const RESPONSE_WAIT_MS = 2_500;

export class DevelopingProfileArchive {
  constructor({ dir, fold = runArchiveFold, now = Date.now }) {
    this.dir = dir;
    this.fold = fold;
    this.now = now;
    this.cache = new Map();
    this.pending = new Map();
  }

  async load({ exchange, symbol, fromMs, windowEndMs, cutoffMs, tickSize, groupTicks,
    valueAreaPercent, minTradeVolume, maxTradeVolume, tailTrades = [] }) {
    if (!/^[A-Z0-9]+$/.test(exchange) || !/^[A-Z0-9]+$/.test(symbol)) return null;
    if (![fromMs, windowEndMs, cutoffMs].every(Number.isSafeInteger)
      || fromMs <= 0 || cutoffMs <= fromMs || cutoffMs > windowEndMs
      || windowEndMs - fromMs > 26 * 60 * MINUTE) return null;

    const date = chicagoTradingDate(fromMs);
    const bounds = cmeSessionBounds(date);
    // The daily route only sends single venue windows. A cross-session range
    // would need separate contract ownership at rollover.
    if (!bounds || windowEndMs > bounds.endMs) return null;

    const now = this.now();
    const closed = bounds.endMs <= now;
    const key = JSON.stringify([exchange, symbol, fromMs, windowEndMs, tickSize,
      groupTicks, valueAreaPercent, minTradeVolume, maxTradeVolume]);
    const cached = this.cache.get(key);
    if (cached && cached.validUntil > now) return clipDevelopingProfile(cached.series, cutoffMs);

    let job = this.pending.get(key);
    if (!job) {
      // Keep a saved multi-pane workspace from monopolising the shared
      // archive workers while cold history is being restored.
      if (this.pending.size >= MAX_QUEUED) return null;
      const basename = profileFileName(exchange, symbol);
      const file = join(this.dir, "profiles", date, closed ? basename : basename + ".active");
      const files = existsSync(file) ? [file] : [];
      const tradeFiles = !files.length
        ? sessionTradeFiles(join(this.dir, "trades"), date, exchange, symbol)
        : [];
      if (!files.length && !tradeFiles.length) return null;
      const args = { fromMs, toMs: Math.min(windowEndMs, Math.floor(now / MINUTE) * MINUTE),
        tickSize, groupTicks, valueAreaPercent, minTradeVolume, maxTradeVolume,
        tailTrades: closed ? [] : tailTrades };
      if (args.toMs <= fromMs) return null;
      job = this.fold({ kind: "developing-volume-profile", files, tradeFiles, args })
        .then((series) => {
          if (!series) return null;
          this.cache.delete(key);
          this.cache.set(key, { series, validUntil: this.now() + (closed ? 30 * MINUTE : files.length ? MINUTE : 5 * MINUTE) });
          if (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
          return series;
        })
        .catch(() => null)
        .finally(() => this.pending.delete(key));
      this.pending.set(key, job);
    }
    // A cold trail continues warming after the histogram's response budget.
    // Subsequent requests share the pending job or use its completed result.
    let timer;
    try {
      const series = await Promise.race([
        job,
        new Promise((resolve) => { timer = setTimeout(() => resolve(null), RESPONSE_WAIT_MS); }),
      ]);
      return clipDevelopingProfile(series, cutoffMs);
    } finally {
      clearTimeout(timer);
    }
  }
}

function clipDevelopingProfile(series, cutoffMs) {
  if (!series) return null;
  return {
    developingPoc: series.developingPoc.filter((point) => point.timestamp < cutoffMs),
    developingValueArea: series.developingValueArea.filter((point) => point.timestamp < cutoffMs),
    developingVwap: series.developingVwap.filter((point) => point.timestamp < cutoffMs),
  };
}
