import {
  resolveFrontMonthDefinition,
  type NqInstrumentDefinition,
  type TpoSessionInput,
} from "@/lib/tpoLevels";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
} from "@/lib/vendorMarketData.server";
import { fetchRecordedTape } from "@/lib/recordedTradeTape.server";


type CachedTpoSession = { promise: Promise<TpoSessionInput> };
const globalTpoSessionCache = globalThis as typeof globalThis & {
  __kwantdeskTpoSessions?: Map<string, CachedTpoSession>;
};
const tpoSessionCache = globalTpoSessionCache.__kwantdeskTpoSessions
  ?? (globalTpoSessionCache.__kwantdeskTpoSessions = new Map<string, CachedTpoSession>());

export class DatabentoTpoAuthError extends Error {
  constructor() {
    super("TPO Levels: data source needs re-authentication");
    this.name = "DatabentoTpoAuthError";
  }
}

function exactInteger(line: string, key: string) {
  const match = new RegExp(`"${key}"\\s*:\\s*"?(-?\\d+)"?`).exec(line);
  if (!match) return null;
  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
}

function millisecondsFromNanoseconds(value: unknown, exact: bigint | null = null) {
  if (exact !== null) return Number(exact / 1_000_000n);
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return Number(BigInt(value) / 1_000_000n);
    } catch {
      return 0;
    }
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric > 10_000_000_000_000_000) return Math.floor(numeric / 1_000_000);
    if (numeric > 10_000_000_000_000) return Math.floor(numeric / 1_000);
    return numeric;
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fixedPointPrice(value: unknown, exact: bigint | null = null) {
  if (exact !== null) return Number(exact) / 1_000_000_000;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    try {
      return Number(BigInt(value)) / 1_000_000_000;
    } catch {
      return 0;
    }
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.abs(numeric) >= 100_000_000 ? numeric / 1_000_000_000 : numeric;
}

async function databentoStream(
  params: Record<string, string>,
  onRecord: (record: Record<string, unknown>, rawLine: string) => void,
) {
  if (!vendorMarketDataConfigured("databento")) throw new DatabentoTpoAuthError();
  const response = await vendorMarketDataFetch("databento", "/v0/timeseries.get_range", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      dataset: "GLBX.MDP3",
      encoding: "json",
      pretty_px: "false",
      pretty_ts: "false",
      map_symbols: "false",
      ...params,
    }),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new DatabentoTpoAuthError();
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Databento TPO request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  if (!response.body) throw new Error("Databento returned an empty TPO stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let malformed = 0;
  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;
    try {
      const decoded = JSON.parse(line) as unknown;
      const records = Array.isArray(decoded) ? decoded : [decoded];
      records.forEach((record) => {
        if (record && typeof record === "object" && !Array.isArray(record)) {
          onRecord(record as Record<string, unknown>, line);
        }
      });
    } catch {
      malformed += 1;
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
  if (malformed) throw new Error("Databento returned malformed TPO records; the pull was rejected.");
}

function header(record: Record<string, unknown>) {
  return record.hd && typeof record.hd === "object"
    ? record.hd as Record<string, unknown>
    : {};
}

export async function getNqOutrightDefinitions(start: number, end: number) {
  const definitions = new Map<string, NqInstrumentDefinition>();
  await databentoStream({
    symbols: "NQ.FUT",
    stype_in: "parent",
    schema: "definition",
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }, (record, line) => {
    const hd = header(record);
    const instrumentId = record.instrument_id ?? hd.instrument_id;
    const rawSymbol = String(record.raw_symbol ?? record.symbol ?? "").trim();
    const expiration = millisecondsFromNanoseconds(
      record.expiration,
      exactInteger(line, "expiration"),
    );
    if (instrumentId == null || !rawSymbol || !expiration) return;
    const activation = millisecondsFromNanoseconds(
      record.activation,
      exactInteger(line, "activation"),
    );
    const key = `${instrumentId}:${rawSymbol}:${expiration}`;
    definitions.set(key, {
      instrumentId: String(instrumentId),
      rawSymbol,
      expiration,
      activation: activation || null,
      instrumentClass: String(record.instrument_class ?? ""),
    });
  });
  return [...definitions.values()];
}

async function getNqSessionTrades(
  window: { date: string; start: number; end: number },
): Promise<TpoSessionInput> {
  /*
   * Built from the desk's own recorded prints.
   *
   * TPO needs to know which prices traded inside each half-hour bracket, so it
   * genuinely needs individual prints - a minute bar's high and low would
   * merge the bracket's shape away. It used to buy them from the vendor, whose
   * CME account now answers 422 for the whole window, so TPO Levels returned
   * "unavailable" on every request.
   *
   * The window is asked for exactly: the engine is end-exclusive, and a CME
   * print stamped 16:00:00 New York must never become a clamped 14th bracket.
   */
  const { symbol, trades: prints } = await fetchRecordedTape({
    symbol: "NQ",
    startMs: window.start,
    endMs: window.end,
  });
  const trades: TpoSessionInput["trades"] = [];
  for (const print of prints) {
    if (print.timestamp < window.start || print.timestamp >= window.end) continue;
    if (print.price <= 0 || print.size <= 0) continue;
    trades.push({
      timestamp: print.timestamp,
      price: print.price,
      size: print.size,
      // The collector does not carry the vendor's numeric instrument ids, and
      // inventing one would make a fabricated value look like a real record.
      instrumentId: null,
      symbol,
    });
  }
  trades.sort((left, right) => left.timestamp - right.timestamp || left.price - right.price);
  return { ...window, trades, contract: symbol };
}

function cachedNqSessionTrades(window: { date: string; start: number; end: number }) {
  const key = `${window.start}:${window.end}`;
  const cached = tpoSessionCache.get(key);
  if (cached) return cached.promise;
  const promise = getNqSessionTrades(window);
  tpoSessionCache.set(key, { promise });
  void promise.catch(() => {
    if (tpoSessionCache.get(key)?.promise === promise) tpoSessionCache.delete(key);
  });
  return promise;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}

export async function getDatabentoTpoSessions(
  windowsNewestFirst: Array<{ date: string; start: number; end: number }>,
) {
  if (!windowsNewestFirst.length) return [];
  const windows = windowsNewestFirst.slice().sort((left, right) => left.start - right.start);
  /*
   * The contract no longer has to be resolved from a vendor definition feed:
   * the collector records the book it is subscribed to and names it back, so
   * each session reports the contract its own prints came from.
   *
   * Completed RTH sessions never mutate. Keep each session promise on the warm
   * server and pull cold-cache sessions in a small parallel pool rather than
   * asking for ten sessions of prints at once.
   */
  return mapWithConcurrency(windows, 2, async (window) => cachedNqSessionTrades(window));
}
