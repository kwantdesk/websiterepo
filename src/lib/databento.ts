import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";
import { applyMarketTradesToEventBars, type MarketTrade } from "@/lib/eventBars";
import type { Candle } from "@/lib/backtester";
import {
  addValueAreaTrade,
  createValueAreaAccumulator,
  finalizeValueAreaProfile,
  type ValueAreaProfile,
} from "@/lib/valueArea";
import {
  databentoEventTimestampMs,
  databentoTradeAggressor,
} from "@/lib/tradeAggressor";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
} from "@/lib/vendorMarketData.server";
import { availableEndFromError, clampEndToLicence, rememberAvailableEnd } from "@/lib/databentoAvailableEnd";
import { fetchInstitutionalMarketData } from "@/lib/institutionalMarketData.server";
import { fetchRecordedTape, fetchRecordedTrades } from "@/lib/recordedTradeTape.server";

export const DATABENTO_HISTORICAL_BASE_URL = "https://api.databento.com/v0";

export type DatabentoInstrument = {
  symbol: string;
  label: string;
  venue: "CME" | "CBOT" | "NYMEX" | "COMEX";
  kind: "future" | "option";
  group: string;
  parent?: string;
};

export type DatabentoBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Compact tuple sent to the browser for execution-tape indicators:
// timestamp, price, size, signed aggressor delta.
export type DatabentoExecutionTuple = [
  timestamp: number,
  price: number,
  size: number,
  delta: number,
];

export type DatabentoOrderFlowHistory = {
  candles: Candle[];
  executions: DatabentoExecutionTuple[];
};

export const DATABENTO_FUTURES: DatabentoInstrument[] = [
  { symbol: "ES.v.0", label: "E-mini S&P 500", venue: "CME", kind: "future", group: "Equity index" },
  { symbol: "NQ.v.0", label: "E-mini Nasdaq-100", venue: "CME", kind: "future", group: "Equity index" },
  { symbol: "YM.v.0", label: "E-mini Dow", venue: "CBOT", kind: "future", group: "Equity index" },
  { symbol: "RTY.v.0", label: "E-mini Russell 2000", venue: "CME", kind: "future", group: "Equity index" },
  { symbol: "MES.v.0", label: "Micro E-mini S&P 500", venue: "CME", kind: "future", group: "Micro index" },
  { symbol: "MNQ.v.0", label: "Micro E-mini Nasdaq-100", venue: "CME", kind: "future", group: "Micro index" },
  { symbol: "M2K.v.0", label: "Micro E-mini Russell 2000", venue: "CME", kind: "future", group: "Micro index" },
  { symbol: "MYM.v.0", label: "Micro E-mini Dow", venue: "CBOT", kind: "future", group: "Micro index" },
  { symbol: "CL.v.0", label: "WTI Crude Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "MCL.v.0", label: "Micro WTI Crude Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "QM.v.0", label: "E-mini Crude Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "NG.v.0", label: "Henry Hub Natural Gas", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "QG.v.0", label: "E-mini Natural Gas", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "RB.v.0", label: "RBOB Gasoline", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "HO.v.0", label: "ULSD Heating Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "GC.v.0", label: "Gold", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "MGC.v.0", label: "Micro Gold", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "SI.v.0", label: "Silver", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "SIL.v.0", label: "Micro Silver", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "HG.v.0", label: "Copper", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "PL.v.0", label: "Platinum", venue: "NYMEX", kind: "future", group: "Metals" },
  { symbol: "PA.v.0", label: "Palladium", venue: "NYMEX", kind: "future", group: "Metals" },
  { symbol: "ZN.v.0", label: "10-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZB.v.0", label: "30-Year Treasury Bond", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZF.v.0", label: "5-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZT.v.0", label: "2-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "TN.v.0", label: "Ultra 10-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "UB.v.0", label: "Ultra Treasury Bond", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "10Y.v.0", label: "10-Year Treasury Yield", venue: "CME", kind: "future", group: "Rates" },
  { symbol: "SR3.v.0", label: "3-Month SOFR", venue: "CME", kind: "future", group: "Rates" },
  { symbol: "6E.v.0", label: "Euro FX", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6J.v.0", label: "Japanese Yen", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6B.v.0", label: "British Pound", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6A.v.0", label: "Australian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6C.v.0", label: "Canadian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6S.v.0", label: "Swiss Franc", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6N.v.0", label: "New Zealand Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6M.v.0", label: "Mexican Peso", venue: "CME", kind: "future", group: "FX" },
  { symbol: "M6E.v.0", label: "Micro Euro FX", venue: "CME", kind: "future", group: "Micro FX" },
  { symbol: "M6B.v.0", label: "Micro British Pound", venue: "CME", kind: "future", group: "Micro FX" },
  { symbol: "M6A.v.0", label: "Micro Australian Dollar", venue: "CME", kind: "future", group: "Micro FX" },
  { symbol: "BTC.v.0", label: "Bitcoin", venue: "CME", kind: "future", group: "Cryptocurrency" },
  { symbol: "MBT.v.0", label: "Micro Bitcoin", venue: "CME", kind: "future", group: "Cryptocurrency" },
  { symbol: "ETH.v.0", label: "Ether", venue: "CME", kind: "future", group: "Cryptocurrency" },
  { symbol: "MET.v.0", label: "Micro Ether", venue: "CME", kind: "future", group: "Cryptocurrency" },
  { symbol: "ZC.v.0", label: "Corn", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZS.v.0", label: "Soybeans", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZW.v.0", label: "Wheat", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZM.v.0", label: "Soybean Meal", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZL.v.0", label: "Soybean Oil", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "LE.v.0", label: "Live Cattle", venue: "CME", kind: "future", group: "Livestock" },
  { symbol: "HE.v.0", label: "Lean Hogs", venue: "CME", kind: "future", group: "Livestock" },
  { symbol: "GF.v.0", label: "Feeder Cattle", venue: "CME", kind: "future", group: "Livestock" },
];

export const DATABENTO_DEFAULT_SYMBOLS = [
  "ES.v.0",
  "NQ.v.0",
  "MES.v.0",
  "MNQ.v.0",
  "YM.v.0",
  "RTY.v.0",
  "CL.v.0",
  "GC.v.0",
  "ZN.v.0",
  "10Y.v.0",
  "6E.v.0",
];

const OPTION_ROOTS: Array<{ root: string; label: string; venue: DatabentoInstrument["venue"] }> = [
  { root: "ES", label: "E-mini S&P 500", venue: "CME" },
  { root: "NQ", label: "E-mini Nasdaq-100", venue: "CME" },
  { root: "CL", label: "WTI Crude Oil", venue: "NYMEX" },
  { root: "GC", label: "Gold", venue: "COMEX" },
  { root: "ZN", label: "10-Year Treasury Note", venue: "CBOT" },
];

function parseRows(payload: string): Record<string, unknown>[] {
  return payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        if (Array.isArray(value)) return value;
        return value && typeof value === "object" ? [value] : [];
      } catch {
        return [];
      }
    });
}

function price(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 100_000_000 ? parsed / 1_000_000_000 : parsed;
}

function time(value: unknown) {
  return databentoEventTimestampMs(value) ?? 0;
}

async function historicalRequest(rawParams: Record<string, string>, canRetryAvailableEnd = true) {
  const params = clampEndToLicence(rawParams);
  if (!vendorMarketDataConfigured("databento")) throw new Error("Databento is not configured.");

  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "true",
    pretty_ts: "true",
    map_symbols: "true",
    ...params,
  });
  const response = await vendorMarketDataFetch("databento", "/v0/timeseries.get_range", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    const availableEnd = response.status === 422 && canRetryAvailableEnd
      ? availableEndFromError(detail)
      : null;
    // Remember it even when this particular request cannot be rescued: the
    // boundary is a property of the licence, not of one call.
    rememberAvailableEnd(availableEnd);
    const requestedStart = Date.parse(params.start ?? "");
    const requestedEnd = Date.parse(params.end ?? "");
    if (
      availableEnd
      && Number.isFinite(requestedStart)
      && availableEnd > requestedStart
      && (!Number.isFinite(requestedEnd) || availableEnd < requestedEnd)
    ) {
      return historicalRequest(
        {
          ...params,
          end: new Date(availableEnd - 1).toISOString(),
        },
        false,
      );
    }
    throw new Error(`Databento request failed (${response.status}): ${detail.slice(0, 400)}`);
  }
  return parseRows(await response.text());
}

/**
 * Stream the raw `trades` schema for an arbitrary window. Exposed so the
 * execution-accurate volume profile can aggregate every real print at every
 * real price, rather than reconstructing a profile from OHLCV bars.
 */
export async function streamHistoricalTradeRows(
  params: Record<string, string>,
  onRow: (row: Record<string, unknown>) => void,
): Promise<void> {
  return streamHistoricalRows({ schema: "trades", ...params }, onRow);
}

async function streamHistoricalRows(
  params: Record<string, string>,
  onRow: (row: Record<string, unknown>) => void,
): Promise<void> {
  if (!vendorMarketDataConfigured("databento")) throw new Error("Databento is not configured.");

  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "true",
    pretty_ts: "true",
    map_symbols: "true",
    ...params,
  });
  const response = await vendorMarketDataFetch("databento", "/v0/timeseries.get_range", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    const availableEnd = response.status === 422
      ? availableEndFromError(detail)
      : null;
    const requestedStart = Date.parse(params.start ?? "");
    const requestedEnd = Date.parse(params.end ?? "");
    if (
      availableEnd
      && Number.isFinite(requestedStart)
      && availableEnd > requestedStart
      && (!Number.isFinite(requestedEnd) || availableEnd < requestedEnd)
    ) {
      // Carry the available edge as data, not prose. Rewriting it into a
      // sentence made it unrecoverable: callers that could simply retry
      // against the edge had nothing to parse, so a live-session profile
      // failed permanently instead of returning the data that does exist.
      const incomplete = new Error(
        "Databento has not completed the requested CME profile window yet.",
      ) as Error & { availableEndMs?: number };
      incomplete.availableEndMs = availableEnd;
      throw incomplete;
    }
    throw new Error(`Databento request failed (${response.status}): ${detail.slice(0, 400)}`);
  }
  if (!response.body) throw new Error("Databento returned an empty CME trade stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let malformedRecords = 0;
  const processLine = (line: string) => {
    const text = line.trim();
    if (!text) return;
    try {
      const decoded = JSON.parse(text) as unknown;
      const records = Array.isArray(decoded) ? decoded : [decoded];
      records.forEach((record) => {
        if (record && typeof record === "object" && !Array.isArray(record)) {
          onRow(record as Record<string, unknown>);
        }
      });
    } catch {
      malformedRecords += 1;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      processLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  processLine(buffer);
  if (malformedRecords > 0) {
    throw new Error("Databento returned malformed CME trade records; the profile was rejected.");
  }
}

export async function getDatabentoValueAreaProfile(
  symbol: string,
  start: string,
  end: string,
  tickSize: number,
): Promise<ValueAreaProfile | null> {
  return (await getDatabentoValueAreaProfiles(
    symbol,
    [{ start, end }],
    tickSize,
  ))[0] ?? null;
}

/**
 * Build several exact trade-by-trade profiles from one Databento stream.
 *
 * This matters at the Sunday/Monday reopen: the prior daily session (Friday)
 * sits completely inside the prior weekly window. Downloading both windows
 * separately duplicated Friday's full tick tape and made a cold chart wait.
 */
export async function getDatabentoValueAreaProfiles(
  symbol: string,
  windows: Array<{ start: string; end: string }>,
  tickSize: number,
): Promise<Array<ValueAreaProfile | null>> {
  const parsedWindows = windows.map((window) => ({
    start: Date.parse(window.start),
    end: Date.parse(window.end),
  }));
  if (
    parsedWindows.length === 0
    || parsedWindows.some((window) =>
      !Number.isFinite(window.start)
      || !Number.isFinite(window.end)
      || window.end <= window.start)
  ) {
    throw new Error("A valid CME value-area window is required.");
  }

  const accumulators = parsedWindows.map(() => createValueAreaAccumulator(tickSize));
  const requestStart = Math.min(...parsedWindows.map((window) => window.start));
  const requestEnd = Math.max(...parsedWindows.map((window) => window.end));
  /*
   * Exact trade-by-trade profiles from the desk's own recorded prints.
   *
   * A value area is the price band that held a share of the session's traded
   * volume, so it has to be counted print by print - bars would put a minute's
   * whole volume on one price. These were bought from the vendor, whose
   * account answers 402 "insufficient budget", so every daily and weekly value
   * area failed outright.
   *
   * One request covers the union of the windows and fills each accumulator
   * from it. That matters at the Sunday/Monday reopen: the prior daily session
   * (Friday) sits completely inside the prior weekly window, and fetching them
   * separately would carry Friday's whole tape twice.
   */
  const recorded = await fetchRecordedTape({
    symbol,
    startMs: requestStart,
    endMs: requestEnd,
  });
  for (const print of recorded.trades) {
    const trade = { timestamp: print.timestamp, price: print.price, size: print.size };
    for (let index = 0; index < parsedWindows.length; index += 1) {
      const window = parsedWindows[index];
      if (print.timestamp >= window.start && print.timestamp < window.end) {
        addValueAreaTrade(accumulators[index], trade);
      }
    }
  }
  /*
   * A window the archive does not fully cover has no value area.
   *
   * The value area is the band that held a share of ALL the volume in its
   * window, so a partly covered one is not a rougher answer - it is a
   * confident answer at the wrong prices. The recorder started mid-way through
   * the earliest week it can serve, and half a week of prints produces a
   * perfectly plausible weekly profile nobody could tell was wrong.
   *
   * The tolerance allows for a window opening in a quiet moment; it is far
   * smaller than a missing session.
   */
  const coverageToleranceMs = 5 * 60_000;
  const earliest = recorded.earliestMs;
  return accumulators.map((accumulator, index) => {
    const window = parsedWindows[index];
    const covered = earliest !== null && earliest <= window.start + coverageToleranceMs;
    if (!covered) return null;
    return finalizeValueAreaProfile(accumulator);
  });
}

function sourceSchema(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (match?.[2] === "s") return "ohlcv-1s";
  if (match?.[2] === "h") return "ohlcv-1h";
  if (match && ["D", "W", "M"].includes(match[2])) return "ohlcv-1d";
  return "ohlcv-1m";
}

function timeframeMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) return 5 * 60_000;
  const value = Math.max(1, Number(match[1]));
  const units: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 86_400_000,
    W: 7 * 86_400_000,
    M: 30 * 86_400_000,
  };
  return value * (units[match[2]] ?? 5 * 60_000);
}

function resample(rows: DatabentoBar[], timeframe: string) {
  const size = timeframeMs(timeframe);
  const schema = sourceSchema(timeframe);
  const sourceSize = schema === "ohlcv-1s"
    ? 1_000
    : schema === "ohlcv-1m"
      ? 60_000
      : schema === "ohlcv-1h"
        ? 60 * 60_000
        : 86_400_000;
  if (size < sourceSize) return rows;
  const buckets = new Map<number, DatabentoBar>();
  for (const row of rows) {
    const timestamp = Math.floor(row.timestamp / size) * size;
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, { ...row, timestamp });
      continue;
    }
    existing.high = Math.max(existing.high, row.high);
    existing.low = Math.min(existing.low, row.low);
    existing.close = row.close;
    existing.volume += row.volume;
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * "NQ.c.0" and "NQZ5" both mean the NQ book to the collector, which resolves
 * the front month itself from its own subscriptions.
 */
export function contractRootSymbol(symbol: string) {
  const upper = String(symbol || "").toUpperCase();
  // .c / .v / .n are continuous, volume and tick-bar roots respectively; all
  // three name the same book to the collector.
  const continuous = upper.match(/^([A-Z0-9]{1,3})\.[A-Z]\.\d+$/);
  if (continuous) return continuous[1];
  return upper.replace(/[A-Z]\d$/, "") || upper;
}

export function isContinuousFuture(symbol: string) {
  return /\.[vnc]\.\d+$/.test(symbol);
}

function completedHistoricalEnd(end: string) {
  const requested = Date.parse(end);
  if (!Number.isFinite(requested)) return end;
  // Historical GLBX files trail the live venue, but the API reports its exact
  // available_end and historicalRequest already retries against that value.
  // A fixed twenty-minute cut-off manufactured a much larger seam than the
  // provider actually had. Ask through the last completed minute and let the
  // precise availability response trim it when necessary.
  const safeLiveEdge = Date.now() - 60_000;
  if (requested <= safeLiveEdge) return end;
  return new Date(Math.floor(safeLiveEdge / 60_000) * 60_000).toISOString();
}

export async function getDatabentoBars(symbol: string, timeframe: string, start: string, end: string): Promise<DatabentoBar[]> {
  if (!getChartInterval(timeframe)) throw new Error(`Unsupported chart interval: ${timeframe}`);
  if (isEventBasedChartInterval(timeframe)) {
    /*
     * Range, volume, renko and tick bars are BUILT from individual prints.
     *
     * They close on price travelled or contracts traded, so the path taken
     * within a minute is exactly the information they need and exactly what an
     * OHLC bar discards - a minute-bar history cannot produce them at any
     * resolution. This asked the vendor for a raw trades feed; that
     * subscription is gone (the account answers 402), so these chart types had
     * no history at all.
     *
     * The prints come from the desk's own recorded tape now, served by the
     * collector in the four fields a bar builder needs.
     */
    const requestedStart = Date.parse(start);
    const requestedEnd = Date.parse(end);
    const recentStart = Math.max(
      Number.isFinite(requestedStart) ? requestedStart : 0,
      (Number.isFinite(requestedEnd) ? requestedEnd : Date.now()) - 6 * 60 * 60_000,
    );
    const query = new URLSearchParams({
      exchange: "CME",
      symbol: contractRootSymbol(symbol),
      fromMs: String(recentStart),
      toMs: String(Number.isFinite(requestedEnd) ? requestedEnd : Date.now()),
      limit: "1500000",
    });
    const response = await fetchInstitutionalMarketData(`/v1/market-data/trade-tape?${query}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`The recorded trade tape is unavailable (${response.status}): ${detail.slice(0, 200)}`);
    }
    const payload = (await response.json()) as { trades?: unknown };
    const tradeRows = Array.isArray(payload.trades) ? payload.trades : [];

    const trades: MarketTrade[] = tradeRows
      .map((row) => {
        const record = row as Record<string, unknown>;
        const size = Math.max(0, Number(record.size ?? 0));
        // The tape carries the aggressor as 1 / -1 / 0, recorded rather than
        // inferred; 0 means the feed did not say and must not be guessed.
        const side = Number(record.side ?? 0);
        return {
          timestamp: Number(record.timestamp),
          price: Number(record.price),
          size,
          trades: 1,
          delta: side > 0 ? size : side < 0 ? -size : 0,
        };
      })
      .filter((row) => row.timestamp > 0 && row.price > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    return applyMarketTradesToEventBars([], trades, timeframe, symbol, 3_000).map((bar) => ({
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume ?? 0,
    }));
  }

  /*
   * Bars come from the desk's own recorded Rithmic prints.
   *
   * They used to be bought per request from Databento. That subscription is
   * gone: the account answers 402 "insufficient budget", and because the
   * busiest window of the day is the most expensive request, the US cash
   * session was precisely the part that stopped being served - charts drew a
   * live right-hand edge with a hole through the middle of the day.
   *
   * The collector has been recording every print the whole time. The gateway
   * aggregates them into minute bars and serves them from its own disk, so
   * history no longer depends on anyone's billing and cannot be revoked.
   */
  const requestedFrom = Date.parse(start);
  const requestedTo = Date.parse(completedHistoricalEnd(end));
  const query = new URLSearchParams({
    symbol: contractRootSymbol(symbol),
    interval: timeframe,
  });
  if (Number.isFinite(requestedFrom)) query.set("fromMs", String(requestedFrom));
  if (Number.isFinite(requestedTo)) query.set("toMs", String(requestedTo));
  const response = await fetchInstitutionalMarketData(`/v1/market-data/history?${query}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chart history is unavailable (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { candles?: unknown };
  const bars = (Array.isArray(payload.candles) ? payload.candles : [])
    .map((row) => {
      const candle = row as Record<string, unknown>;
      return {
        timestamp: Number(candle.timestamp),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume ?? 0),
      };
    })
    .filter((row) => row.timestamp > 0 && row.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  // The gateway already rolls its minutes up to the requested interval; this
  // is a no-op for anything it served and still correct if it ever returns
  // finer bars than were asked for.
  return resample(bars, timeframe);
}

export async function getDatabentoOrderFlowHistory(
  symbol: string,
  timeframe: string,
  start: string,
  end: string,
): Promise<DatabentoOrderFlowHistory> {
  if (isEventBasedChartInterval(timeframe)) {
    const bars = await getDatabentoBars(symbol, timeframe, start, end);
    return { candles: bars, executions: [] };
  }

  /*
   * Bars and their aggressor flow come back together, from the collector.
   *
   * This used to fetch the bars and then stream the vendor's raw trades to
   * rebuild the bid/ask split. That subscription is gone, and because the
   * flow was fetched inside the same call, its failure threw away the BARS
   * too - so every time-based chart fell back to whatever it had accumulated
   * live and showed only the last few minutes. The bars were sitting on our
   * own disk the whole time.
   *
   * The aggregation happens on the gateway rather than here: a five-day NQ
   * window is 1.5 million prints and 6 MB gzipped per pane per load, against
   * roughly 1,400 rows once folded into bars.
   */
  const requestedFrom = Date.parse(start);
  const requestedTo = Date.parse(completedHistoricalEnd(end));
  const query = new URLSearchParams({
    symbol: contractRootSymbol(symbol),
    interval: timeframe,
    orderFlow: "1",
  });
  if (Number.isFinite(requestedFrom)) query.set("fromMs", String(requestedFrom));
  if (Number.isFinite(requestedTo)) query.set("toMs", String(requestedTo));
  const response = await fetchInstitutionalMarketData(`/v1/market-data/history?${query}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chart history is unavailable (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { candles?: unknown; executions?: unknown };

  const candles = (Array.isArray(payload.candles) ? payload.candles : [])
    .map((row) => {
      const candle = row as Record<string, unknown>;
      const bar: DatabentoBar & Record<string, unknown> = {
        timestamp: Number(candle.timestamp),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume ?? 0),
      };
      /*
       * Flow is copied across only when the bar actually carries it. An
       * untaped instrument returns bars with no flow fields at all, and
       * filling those in as zeros would claim the market traded perfectly
       * balanced when the truth is that nobody recorded the side.
       */
      if (candle.delta !== undefined) {
        bar.trades = Number(candle.trades ?? 0);
        bar.askVolume = Number(candle.askVolume ?? 0);
        bar.bidVolume = Number(candle.bidVolume ?? 0);
        bar.delta = Number(candle.delta ?? 0);
        bar.deltaOpen = 0;
        bar.deltaHigh = Number(candle.deltaHigh ?? 0);
        bar.deltaLow = Number(candle.deltaLow ?? 0);
        bar.deltaClose = Number(candle.delta ?? 0);
      }
      return bar;
    })
    .filter((row) => row.timestamp > 0 && row.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const executions = (Array.isArray(payload.executions) ? payload.executions : [])
    .map((row) => {
      const tuple = row as unknown[];
      return [
        Number(tuple[0]), Number(tuple[1]), Number(tuple[2]), Number(tuple[3]),
      ] as DatabentoExecutionTuple;
    })
    .filter((tuple) => tuple[0] > 0 && tuple[1] > 0 && tuple[2] > 0);

  return { candles, executions };
}

export async function getDatabentoBarsWithOrderFlow(
  symbol: string,
  timeframe: string,
  start: string,
  end: string,
) {
  return (await getDatabentoOrderFlowHistory(symbol, timeframe, start, end)).candles;
}

function optionClass(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "C" || normalized === "CALL" || normalized === "3") return "Call";
  if (normalized === "P" || normalized === "PUT" || normalized === "4") return "Put";
  return null;
}

export async function getDatabentoOptions() {
  const now = Date.now();
  const instruments: DatabentoInstrument[] = [];

  for (const optionRoot of OPTION_ROOTS) {
    const underlying = `${optionRoot.root}.v.0`;
    const recentBars = await getDatabentoBars(
      underlying,
      "1m",
      new Date(now - 6 * 60 * 60_000).toISOString(),
      new Date(now).toISOString(),
    );
    const underlyingPrice = recentBars.at(-1)?.close ?? 0;
    const definitions = await historicalRequest({
      symbols: `${optionRoot.root}.OPT`,
      stype_in: "parent",
      schema: "definition",
      start: new Date(now).toISOString().slice(0, 10),
      limit: "50000",
    });

    const candidates = definitions
      .map((row) => {
        const symbol = String(row.raw_symbol ?? row.symbol ?? "").trim();
        const side = optionClass(row.instrument_class);
        const strike = price(row.strike_price);
        const expiration = time(row.expiration);
        return { symbol, side, strike, expiration };
      })
      .filter((row) => row.symbol && row.side && row.strike > 0 && row.expiration > now && row.expiration < now + 75 * 86_400_000)
      .sort((a, b) => a.expiration - b.expiration || Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice));

    const nearestExpiry = candidates[0]?.expiration;
    if (!nearestExpiry) continue;
    for (const side of ["Call", "Put"] as const) {
      candidates
        .filter((row) => row.expiration === nearestExpiry && row.side === side)
        .slice(0, 6)
        .forEach((row) => {
          instruments.push({
            symbol: row.symbol,
            label: `${optionRoot.label} ${side} ${row.strike.toLocaleString("en-US")}`,
            venue: optionRoot.venue,
            kind: "option",
            group: `Options · ${new Date(row.expiration).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" })}`,
            parent: `${optionRoot.root}.OPT`,
          });
        });
    }
  }
  return instruments;
}
