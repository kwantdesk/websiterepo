import "server-only";

import { after } from "next/server";
import { isWithinSessionSegments, type SessionSegment } from "@/lib/volumeProfileSessions";

import { streamHistoricalTradeRows } from "@/lib/databento";
import {
  calculateVolumeProfileValueArea,
  STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  volumeProfileBinTick,
} from "@/lib/volumeProfileMath";
import {
  databentoEventTimestampMs,
  databentoTradeAggressor,
} from "@/lib/tradeAggressor";
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
// Databento Trade semantics: 'A'/'S' = seller aggressor,
// 'B' = buyer aggressor, 'N' = none. Matches the Python source.

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
  /**
   * Session windows this profile is restricted to. Empty (the default) counts
   * every execution in the range, which is the untouched behaviour.
   */
  sessionSegments?: readonly SessionSegment[];
};

const CACHE_MS = 60_000;
/**
 * How long a profile may still be SERVED after it goes stale.
 *
 * Building one is a replay of the session's whole execution tape — the weekly
 * composite covers five days of it — so recomputing before answering made
 * every reopened profile workspace sit on a spinner while the tape was walked
 * again. A profile a few minutes past its refresh window is the same auction;
 * it is returned immediately and rebuilt behind the response.
 */
const STALE_SERVE_MS = 15 * 60_000;
const cache = new Map<string, { storedAt: number; profile: InstitutionalVolumeProfile }>();
const inFlight = new Map<string, Promise<InstitutionalVolumeProfile | null>>();
/** One background rebuild per key; extra hits ride the same promise. */
const backgroundRebuilds = new Map<string, Promise<unknown>>();

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
  return databentoEventTimestampMs(raw);
}

export async function buildDatabentoExecutionProfile(
  args: ProfileArgs,
): Promise<InstitutionalVolumeProfile | null> {
  const groupTicks = Math.max(1, Math.round(args.groupTicks ?? 1));
  // The trader's own % Value Area. This was pinned to the 70% convention here,
  // so the setting was discarded at the last step even after the route and the
  // client were both fixed to forward it.
  const requestedValueArea = Number(args.valueAreaPercent);
  const valueAreaPercent = Number.isFinite(requestedValueArea) && requestedValueArea > 0
    ? Math.min(100, requestedValueArea)
    : STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT;
  const minTradeVolume = Math.max(0, args.minTradeVolume ?? 0);
  const maxTradeVolume = Math.max(0, args.maxTradeVolume ?? 0);
  const contractSymbol = (args.contractSymbol ?? "").trim().toUpperCase();
  if (!Number.isFinite(args.tickSize) || args.tickSize <= 0) return null;
  if (!Number.isFinite(args.startMs) || !Number.isFinite(args.endMs) || args.endMs <= args.startMs) {
    return null;
  }

  /*
   * Every input that changes the answer belongs in the key.
   *
   * The session segments did not. Filter/Split Time was therefore a control
   * that appeared to work and did nothing: the first request for a window
   * cached the unfiltered profile, and every later request for the SAME window
   * with a different filter was served that entry. Measured on NQ - filtering
   * to RTH returned the full session's numbers byte for byte, identical volume
   * included, while narrowing the window by hand moved POC 65 points.
   *
   * The segments' boundaries are what the filter actually does, so those are
   * what identify it. The mode and window names would not: a custom window and
   * an RTH one can both be "custom" while covering different hours.
   */
  const segmentKey = (args.sessionSegments ?? [])
    .map((segment) => `${segment.id}@${segment.startMs}-${segment.endMs}`)
    .join(",");
  const key = [
    args.symbol, contractSymbol, args.startMs, args.endMs,
    args.tickSize, groupTicks, valueAreaPercent, minTradeVolume, maxTradeVolume,
    segmentKey,
  ].join(":");
  const cached = cache.get(key);
  const age = cached ? Date.now() - cached.storedAt : Number.POSITIVE_INFINITY;
  if (cached && age <= CACHE_MS) return cached.profile;
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

    const sessionSegments = args.sessionSegments ?? [];
    const onRow =
      (row: Record<string, unknown>) => {
        const timestampMs = eventMs(row);
        const price = numeric(row.price ?? row.pretty_price);
        const size = numeric(row.size);
        if (timestampMs === null || price === null || size === null) return;
        if (timestampMs < args.startMs || timestampMs >= args.endMs) return;
        // Filter/Split Time: outside the requested session windows an
        // execution is simply not part of this profile.
        if (sessionSegments.length && !isWithinSessionSegments(timestampMs, sessionSegments)) return;
        if (size <= 0 || size < minTradeVolume) return;
        if (maxTradeVolume > 0 && size > maxTradeVolume) return;

        const groupedTick = volumeProfileBinTick(Math.round(price / args.tickSize), groupTicks);
        const levelPrice = Number((groupedTick * args.tickSize).toFixed(10));
        const level = rows.get(groupedTick) ?? {
          price: levelPrice, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0,
        };
        const side = databentoTradeAggressor(row.side ?? row.aggressor_side);
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
  if (cached && age <= CACHE_MS + STALE_SERVE_MS) {
    // A rebuild is now under way. Answer from the retained profile straight
    // away and let it finish behind the response, so reopening a profile never
    // waits on a full tape replay.
    if (!backgroundRebuilds.has(key)) {
      const rebuild = request
        .catch(() => null)
        .finally(() => backgroundRebuilds.delete(key));
      backgroundRebuilds.set(key, rebuild);
      // `after` needs a request context. Local scripts and tests call this
      // builder directly, where the rebuild simply runs unattached.
      try {
        after(() => rebuild);
      } catch {
        void rebuild;
      }
    }
    return cached.profile;
  }
  return request;
}
