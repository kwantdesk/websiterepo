import "server-only";

import { streamHistoricalTradeRows } from "@/lib/databento";
import { calculateVolumeProfileValueArea, volumeProfileBinTick } from "@/lib/volumeProfileMath";
import type {
  InstitutionalVolumeProfile,
  InstitutionalVolumeProfileLevel,
} from "@/lib/institutionalMarketData";

// Execution-accurate volume profile, ported from Kwantify's
// services/market_data/app/historical.py (volume_profile_executions).
//
// This is the piece that made the original profile show real nodes. It counts
// EVERY historical execution at EVERY traded price with its true aggressor
// side, straight from Databento's `trades` schema. The alternative the port
// had been living with — distributing a candle's single volume figure across
// the whole high/low range — mathematically destroys exactly the structure a
// node is: it smears a concentration into a plateau, and it cannot produce
// delta at all because an OHLCV bar contains no buy/sell information.
//
// Databento side semantics: 'A'/'S' = aggressor lifted the ask (buy),
// 'B' = aggressor hit the bid (sell), 'N' = none. Matches the Python source.

type ProfileArgs = {
  symbol: string;
  contractSymbol?: string | null;
  startMs: number;
  endMs: number;
  tickSize: number;
  groupTicks?: number;
  valueAreaPercent?: number;
  minTradeVolume?: number;
  maxTradeVolume?: number;
  period?: InstitutionalVolumeProfile["period"];
  tradingDate?: string | null;
};

const CACHE_MS = 60_000;
const cache = new Map<string, { storedAt: number; profile: InstitutionalVolumeProfile }>();
const inFlight = new Map<string, Promise<InstitutionalVolumeProfile | null>>();

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventMs(row: Record<string, unknown>): number | null {
  // Databento nests the event timestamp inside the record header:
  //   { hd: { ts_event, instrument_id, ... }, side, price, size }
  // Reading only a top-level ts_event silently rejected every single row,
  // which presented as an empty profile rather than an error.
  const header = row.hd as Record<string, unknown> | undefined;
  const raw = header?.ts_event ?? row.ts_event ?? row.tsEvent ?? row.ts_recv;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
    const nanos = Number(raw);
    return Number.isFinite(nanos) ? Math.floor(nanos / 1_000_000) : null;
  }
  const nanos = numeric(raw);
  if (nanos === null) return null;
  // Databento sends nanoseconds since epoch unless pretty_ts rewrote it.
  return nanos > 1e15 ? Math.floor(nanos / 1_000_000) : nanos;
}

function aggressorSide(row: Record<string, unknown>): "BUY" | "SELL" | "NONE" {
  const raw = row.side ?? row.aggressor_side;
  const side = String(typeof raw === "object" && raw !== null ? (raw as { value?: unknown }).value ?? "" : raw ?? "")
    .toUpperCase()
    .slice(0, 1);
  if (side === "A" || side === "S") return "BUY";
  if (side === "B") return "SELL";
  return "NONE";
}

export async function buildDatabentoExecutionProfile(
  args: ProfileArgs,
): Promise<InstitutionalVolumeProfile | null> {
  const groupTicks = Math.max(1, Math.round(args.groupTicks ?? 1));
  const valueAreaPercent = Math.min(100, Math.max(1, args.valueAreaPercent ?? 70));
  const minTradeVolume = Math.max(0, args.minTradeVolume ?? 0);
  const maxTradeVolume = Math.max(0, args.maxTradeVolume ?? 0);
  const contractSymbol = (args.contractSymbol ?? "").trim().toUpperCase();
  if (!Number.isFinite(args.tickSize) || args.tickSize <= 0) return null;
  if (!Number.isFinite(args.startMs) || !Number.isFinite(args.endMs) || args.endMs <= args.startMs) {
    return null;
  }

  const key = [
    args.symbol, contractSymbol, args.startMs, args.endMs,
    args.tickSize, groupTicks, valueAreaPercent, minTradeVolume, maxTradeVolume,
  ].join(":");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.storedAt <= CACHE_MS) return cached.profile;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async (): Promise<InstitutionalVolumeProfile | null> => {
    const rows = new Map<number, InstitutionalVolumeProfileLevel>();
    let totalVolume = 0;
    let bidVolume = 0;
    let askVolume = 0;
    let trades = 0;
    let priceVolume = 0;
    let priceSquaredVolume = 0;
    let coverageStartMs: number | null = null;
    let coverageEndMs: number | null = null;

    // Databento's live edge trails real time by minutes and it rejects the
    // WHOLE request with 422 when `end` runs past it, rather than returning
    // what exists. Retry once against the edge it reports, so the current
    // session still produces a profile instead of silently falling back.
    const streamWindow = async (endMs: number, allowRetry: boolean): Promise<void> => {
      try {
        await streamHistoricalTradeRows(
          {
            symbols: contractSymbol || args.symbol,
            stype_in: contractSymbol ? "raw_symbol" : "continuous",
            start: new Date(args.startMs).toISOString(),
            end: new Date(endMs).toISOString(),
          },
          onRow,
        );
      } catch (error) {
        // Databento's live edge trails real time. Prefer the edge it reports
        // as a value; fall back to parsing the raw message for the case where
        // the error was not normalized.
        const carried = (error as { availableEndMs?: number })?.availableEndMs;
        const message = error instanceof Error ? error.message : String(error);
        const parsed = /data available up to '([^']+)'/.exec(message)?.[1];
        const availableMs = Number.isFinite(carried)
          ? Number(carried)
          : parsed
            ? Date.parse(parsed.replace(" ", "T"))
            : Number.NaN;
        if (allowRetry && Number.isFinite(availableMs) && availableMs > args.startMs) {
          await streamWindow(availableMs, false);
          return;
        }
        throw error;
      }
    };

    const onRow =
      (row: Record<string, unknown>) => {
        const timestampMs = eventMs(row);
        const price = numeric(row.price ?? row.pretty_price);
        const size = numeric(row.size);
        if (timestampMs === null || price === null || size === null) return;
        if (timestampMs < args.startMs || timestampMs >= args.endMs) return;
        if (size <= 0 || size < minTradeVolume) return;
        if (maxTradeVolume > 0 && size > maxTradeVolume) return;

        const groupedTick = volumeProfileBinTick(Math.round(price / args.tickSize), groupTicks);
        const levelPrice = Number((groupedTick * args.tickSize).toFixed(10));
        const level = rows.get(groupedTick) ?? {
          price: levelPrice, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0,
        };
        const side = aggressorSide(row);
        level.volume += size;
        level.trades += 1;
        if (side === "BUY") level.askVolume += size;
        else if (side === "SELL") level.bidVolume += size;
        level.delta = level.askVolume - level.bidVolume;
        rows.set(groupedTick, level);

        totalVolume += size;
        trades += 1;
        if (side === "BUY") askVolume += size;
        else if (side === "SELL") bidVolume += size;
        priceVolume += price * size;
        priceSquaredVolume += price * price * size;
        if (coverageStartMs === null || timestampMs < coverageStartMs) coverageStartMs = timestampMs;
        if (coverageEndMs === null || timestampMs > coverageEndMs) coverageEndMs = timestampMs;
      };

    await streamWindow(args.endMs, true);

    const levels = [...rows.values()].sort((left, right) => left.price - right.price);
    if (!levels.length || totalVolume <= 0) return null;

    const valueArea = calculateVolumeProfileValueArea(
      levels,
      args.tickSize * groupTicks,
      valueAreaPercent,
    );
    const vwap = priceVolume / totalVolume;
    const variance = Math.max(0, priceSquaredVolume / totalVolume - vwap * vwap);

    const profile: InstitutionalVolumeProfile = {
      schemaVersion: "kwantify-volume-profile-v1",
      // Not "Chart": this is real execution data and must never be treated as
      // the approximation, nor carry the APPROX watermark.
      provider: "Databento",
      source: "GLBX.MDP3 historical trade executions",
      root: args.symbol.toUpperCase(),
      contractSymbol: contractSymbol || args.symbol.toUpperCase(),
      period: args.period ?? "daily",
      tradingDate: args.tradingDate ?? null,
      startMs: args.startMs,
      endMs: args.endMs,
      coverageStartMs: coverageStartMs ?? args.startMs,
      coverageEndMs: coverageEndMs ?? args.endMs,
      tickSize: args.tickSize,
      groupTicks,
      valueAreaPercent,
      minTradeVolume,
      maxTradeVolume,
      totalVolume,
      bidVolume,
      askVolume,
      delta: askVolume - bidVolume,
      trades,
      poc: valueArea.poc,
      vah: valueArea.vah,
      val: valueArea.val,
      vwap,
      standardDeviation: Math.sqrt(variance),
      levels,
      developingPoc: [],
      asOf: new Date().toISOString(),
    };
    cache.set(key, { storedAt: Date.now(), profile });
    return profile;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}
