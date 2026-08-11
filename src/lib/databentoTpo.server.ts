import {
  resolveFrontMonthDefinition,
  type NqInstrumentDefinition,
  type TpoSessionInput,
} from "@/lib/tpoLevels";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
} from "@/lib/vendorMarketData.server";


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
  definition: NqInstrumentDefinition,
  window: { date: string; start: number; end: number },
): Promise<TpoSessionInput> {
  const trades: TpoSessionInput["trades"] = [];
  await databentoStream({
    symbols: definition.rawSymbol,
    stype_in: "raw_symbol",
    schema: "trades",
    start: new Date(window.start).toISOString(),
    // End is deliberately exact and the engine is also end-exclusive. A CME
    // print stamped 16:00:00 New York must never become a clamped 14th bracket.
    end: new Date(window.end).toISOString(),
  }, (record, line) => {
    const hd = header(record);
    const timestamp = millisecondsFromNanoseconds(
      record.ts_event ?? hd.ts_event ?? record.ts_recv,
      exactInteger(line, "ts_event") ?? exactInteger(line, "ts_recv"),
    );
    const price = fixedPointPrice(record.price, exactInteger(line, "price"));
    const size = Math.max(0, Number(record.size ?? 0));
    const instrumentId = record.instrument_id ?? hd.instrument_id ?? definition.instrumentId;
    if (timestamp < window.start || timestamp >= window.end || price <= 0 || size <= 0) return;
    trades.push({
      timestamp,
      price,
      size,
      instrumentId: instrumentId == null ? null : String(instrumentId),
      symbol: definition.rawSymbol,
    });
  });
  trades.sort((left, right) => left.timestamp - right.timestamp || left.price - right.price);
  return {
    ...window,
    trades,
    contract: definition.rawSymbol,
  };
}

function cachedNqSessionTrades(
  definition: NqInstrumentDefinition,
  window: { date: string; start: number; end: number },
) {
  const key = `${definition.rawSymbol}:${window.start}:${window.end}`;
  const cached = tpoSessionCache.get(key);
  if (cached) return cached.promise;
  const promise = getNqSessionTrades(definition, window);
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
  const definitions = await getNqOutrightDefinitions(
    windows[0].start - 24 * 60 * 60_000,
    windows.at(-1)!.end + 24 * 60 * 60_000,
  );
  if (!definitions.length) throw new Error("Databento returned no NQ outright definitions.");
  // Completed RTH sessions never mutate. Keep each session promise on the warm
  // server and pull cold-cache sessions in a small parallel pool rather than
  // making ten large historical requests serially.
  return mapWithConcurrency(windows, 3, async (window) => {
    const front = resolveFrontMonthDefinition(definitions, window.end);
    if (!front) {
      return { ...window, trades: [], contract: null };
    }
    return cachedNqSessionTrades(front, window);
  });
}
