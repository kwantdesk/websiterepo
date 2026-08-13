import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { createGunzip } from "node:zlib";

import { chicagoTradingDate } from "./trading-session.mjs";

const TRADE_TEMPLATE_ID = 150;
const completedProfileCache = new Map();
const PERSISTED_CACHE_VERSION = 1;

function contractRoot(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
}

function archiveFile(args) {
  const tradingDate = chicagoTradingDate(args.startMs);
  const dayDir = join(args.dir, tradingDate);
  if (!existsSync(dayDir)) return null;
  const exchange = String(args.exchange || "").toUpperCase();
  const requestedSymbol = String(args.symbol || "").toUpperCase();
  const requestedRoot = contractRoot(requestedSymbol);
  const names = readdirSync(dayDir)
    .filter((name) => name.endsWith(".ndjson") || name.endsWith(".ndjson.gz"))
    .filter((name) => !name.startsWith("UNKNOWN-"));
  const exactPrefix = `${exchange}-${requestedSymbol}.NDJSON`;
  const exact = names.find((name) => name.toUpperCase().startsWith(exactPrefix));
  if (exact) return { path: join(dayDir, exact), tradingDate, symbol: requestedSymbol };
  const sameRoot = names.find((name) => {
    const upper = name.toUpperCase();
    if (!upper.startsWith(`${exchange}-`)) return false;
    const archivedSymbol = upper
      .slice(exchange.length + 1)
      .replace(/\.NDJSON(?:\.GZ)?$/, "");
    return contractRoot(archivedSymbol) === requestedRoot;
  });
  if (!sameRoot) return null;
  return {
    path: join(dayDir, sameRoot),
    tradingDate,
    symbol: sameRoot
      .slice(exchange.length + 1)
      .replace(/\.ndjson(?:\.gz)?$/i, "")
      .toUpperCase(),
  };
}

function tradeTimestamp(payload, receivedAt) {
  const seconds = Number(payload?.ssboe ?? payload?.sourceSsboe);
  const micros = Number(payload?.usecs ?? payload?.sourceUsecs ?? 0);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1_000 + (Number.isFinite(micros) ? Math.floor(micros / 1_000) : 0);
  }
  const parsed = Date.parse(receivedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tickPrecision(tickSize) {
  const text = Number(tickSize).toFixed(10).replace(/0+$/, "");
  const decimal = text.indexOf(".");
  return decimal < 0 ? 0 : text.length - decimal - 1;
}

function tickPrice(tickIndex, tickSize) {
  return Number((tickIndex * tickSize).toFixed(tickPrecision(tickSize)));
}

function finalize(rows, totals, tickSize, valueAreaPercent) {
  const ordered = [...rows.entries()]
    .filter(([, volume]) => Number.isFinite(volume) && volume > 0)
    .sort(([left], [right]) => left - right);
  if (!ordered.length || totals.volume <= 0 || totals.firstTradeAt === null || totals.lastTradeAt === null) {
    return null;
  }
  const boundedPercent = Math.max(0.5, Math.min(0.95, valueAreaPercent));
  const vwap = totals.priceVolume / totals.volume;
  const vwapTick = vwap / tickSize;
  let pocIndex = 0;
  ordered.forEach(([tickIndex, volume], index) => {
    const [currentTick, currentVolume] = ordered[pocIndex];
    if (
      volume > currentVolume
      || (volume === currentVolume && (
        Math.abs(tickIndex - vwapTick) < Math.abs(currentTick - vwapTick)
        || (Math.abs(tickIndex - vwapTick) === Math.abs(currentTick - vwapTick) && tickIndex < currentTick)
      ))
    ) {
      pocIndex = index;
    }
  });
  const target = totals.volume * boundedPercent;
  let low = pocIndex;
  let high = pocIndex;
  let valueAreaVolume = ordered[pocIndex][1];
  while (valueAreaVolume < target && (low > 0 || high < ordered.length - 1)) {
    const lower = low > 0 ? ordered[low - 1][1] : Number.NEGATIVE_INFINITY;
    const upper = high < ordered.length - 1 ? ordered[high + 1][1] : Number.NEGATIVE_INFINITY;
    if (lower === upper && Number.isFinite(lower)) {
      low -= 1;
      high += 1;
      valueAreaVolume += lower + upper;
    } else if (upper > lower) {
      high += 1;
      valueAreaVolume += upper;
    } else if (low > 0) {
      low -= 1;
      valueAreaVolume += lower;
    } else {
      high += 1;
      valueAreaVolume += upper;
    }
  }
  return {
    vah: tickPrice(ordered[high][0], tickSize),
    val: tickPrice(ordered[low][0], tickSize),
    poc: tickPrice(ordered[pocIndex][0], tickSize),
    vwap,
    totalVolume: totals.volume,
    valueAreaVolume,
    valueAreaPercent: valueAreaVolume / totals.volume,
    tradeRecords: totals.trades,
    priceLevels: ordered.length,
    firstTradeAt: totals.firstTradeAt,
    lastTradeAt: totals.lastTradeAt,
  };
}

/**
 * Reconstruct a completed CME value area from the append-only Rithmic tape.
 *
 * Databento's historical edge can lag the just-closed session by hours. The
 * recorder already holds every trade locally, so completed prior-session
 * levels should use that exact tape instead of disappearing until the vendor
 * archive catches up.
 */
export async function buildArchivedValueAreaProfile(args) {
  if (!args.dir || !Number.isFinite(args.startMs) || !Number.isFinite(args.endMs) || args.endMs <= args.startMs) {
    return null;
  }
  const tickSize = Number(args.tickSize);
  if (!Number.isFinite(tickSize) || tickSize <= 0) return null;
  const file = archiveFile(args);
  if (!file) return null;
  const metadata = statSync(file.path);
  const cacheKey = [file.path, metadata.size, metadata.mtimeMs, args.startMs, args.endMs, tickSize].join(":");
  const cached = completedProfileCache.get(cacheKey);
  if (cached) return cached;
  const persistedPath = `${file.path}.kwant-value-area.json`;
  try {
    const persisted = JSON.parse(readFileSync(persistedPath, "utf8"));
    if (
      persisted?.version === PERSISTED_CACHE_VERSION
      && persisted.fileSize === metadata.size
      && persisted.fileMtimeMs === metadata.mtimeMs
      && persisted.startMs === args.startMs
      && persisted.endMs === args.endMs
      && persisted.tickSize === tickSize
      && persisted.profile
    ) {
      completedProfileCache.set(cacheKey, persisted.profile);
      return persisted.profile;
    }
  } catch {}

  const rows = new Map();
  const totals = {
    volume: 0,
    priceVolume: 0,
    trades: 0,
    firstTradeAt: null,
    lastTradeAt: null,
    gaps: 0,
    dropped: 0,
    archiveErrors: 0,
  };
  const input = file.path.endsWith(".gz")
    ? createReadStream(file.path).pipe(createGunzip())
    : createReadStream(file.path);
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record?.type === "GAP") {
        const timestamp = Date.parse(record.receivedAt);
        if (timestamp >= args.startMs && timestamp < args.endMs) totals.gaps += 1;
        continue;
      }
      if (record?.type === "DROPPED") {
        const timestamp = Date.parse(record.receivedAt);
        if (timestamp >= args.startMs && timestamp < args.endMs) {
          totals.dropped += Math.max(1, Number(record.droppedMessages) || 1);
        }
        continue;
      }
      if (record?.templateId !== TRADE_TEMPLATE_ID || !record.payload) continue;
      const timestamp = tradeTimestamp(record.payload, record.receivedAt);
      if (timestamp < args.startMs || timestamp >= args.endMs) continue;
      const price = Number(record.payload.tradePrice);
      const size = Number(record.payload.tradeSize);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0) continue;
      const tickIndex = Math.round(price / tickSize);
      rows.set(tickIndex, (rows.get(tickIndex) ?? 0) + size);
      totals.volume += size;
      totals.priceVolume += price * size;
      totals.trades += 1;
      totals.firstTradeAt = totals.firstTradeAt === null ? timestamp : Math.min(totals.firstTradeAt, timestamp);
      totals.lastTradeAt = totals.lastTradeAt === null ? timestamp : Math.max(totals.lastTradeAt, timestamp);
    }
  } catch (error) {
    // Preserve any readable prefix for diagnostics, but mark it compromised.
    // Callers reject profiles with integrityGaps > 0, so a corrupt gzip member
    // can never masquerade as a complete session or turn into trading levels.
    totals.archiveErrors += 1;
  }
  const profile = finalize(rows, totals, tickSize, Number(args.valueAreaPercent ?? 0.7));
  if (!profile) return null;
  const result = {
    ...profile,
    provider: "Rithmic",
    source: "Rithmic recorded trade tape",
    tradingDate: file.tradingDate,
    contractSymbol: file.symbol,
    startMs: args.startMs,
    endMs: args.endMs,
    integrityGaps: totals.gaps + totals.archiveErrors,
    droppedMessages: totals.dropped,
  };
  completedProfileCache.set(cacheKey, result);
  // Archive reconstruction can scan hundreds of compressed megabytes. Store
  // the completed profile OR its integrity rejection beside the immutable
  // session file so container restarts never repeat that cold scan.
  try {
    writeFileSync(persistedPath, JSON.stringify({
      version: PERSISTED_CACHE_VERSION,
      fileSize: metadata.size,
      fileMtimeMs: metadata.mtimeMs,
      startMs: args.startMs,
      endMs: args.endMs,
      tickSize,
      profile: result,
    }));
  } catch {}
  return result;
}
