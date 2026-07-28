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
  { symbol: "NG.v.0", label: "Henry Hub Natural Gas", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "RB.v.0", label: "RBOB Gasoline", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "HO.v.0", label: "ULSD Heating Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "GC.v.0", label: "Gold", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "SI.v.0", label: "Silver", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "HG.v.0", label: "Copper", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "PL.v.0", label: "Platinum", venue: "NYMEX", kind: "future", group: "Metals" },
  { symbol: "ZN.v.0", label: "10-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZB.v.0", label: "30-Year Treasury Bond", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZF.v.0", label: "5-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZT.v.0", label: "2-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "SR3.v.0", label: "3-Month SOFR", venue: "CME", kind: "future", group: "Rates" },
  { symbol: "6E.v.0", label: "Euro FX", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6J.v.0", label: "Japanese Yen", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6B.v.0", label: "British Pound", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6A.v.0", label: "Australian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6C.v.0", label: "Canadian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "ZC.v.0", label: "Corn", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZS.v.0", label: "Soybeans", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZW.v.0", label: "Wheat", venue: "CBOT", kind: "future", group: "Agriculture" },
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
  if (typeof value === "number") {
    if (value > 10_000_000_000_000_000) return Math.floor(value / 1_000_000);
    if (value > 10_000_000_000_000) return Math.floor(value / 1_000);
    return value;
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function historicalRequest(params: Record<string, string>) {
  const key = process.env.DATABENTO_API_KEY;
  if (!key) throw new Error("Databento is not configured.");

  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "true",
    pretty_ts: "true",
    map_symbols: "true",
    ...params,
  });
  const response = await fetch("https://hist.databento.com/v0/timeseries.get_range", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Databento request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  return parseRows(await response.text());
}

function sourceSchema(timeframe: string) {
  if (["1s", "5s", "10s", "15s", "30s"].includes(timeframe)) return "ohlcv-1s";
  if (["1D", "2D", "3D", "1W", "1M", "3M", "6M", "1Y"].includes(timeframe)) return "ohlcv-1d";
  return "ohlcv-1m";
}

function timeframeMs(timeframe: string) {
  const second = 1_000;
  const minute = 60_000;
  const day = 86_400_000;
  const values: Record<string, number> = {
    "1s": second,
    "5s": 5 * second,
    "10s": 10 * second,
    "15s": 15 * second,
    "30s": 30 * second,
    "1m": minute,
    "3m": 3 * minute,
    "5m": 5 * minute,
    "10m": 10 * minute,
    "15m": 15 * minute,
    "30m": 30 * minute,
    "45m": 45 * minute,
    "1h": 60 * minute,
    "2h": 120 * minute,
    "3h": 180 * minute,
    "4h": 240 * minute,
    "6h": 360 * minute,
    "8h": 480 * minute,
    "12h": 720 * minute,
    "1D": day,
    "2D": 2 * day,
    "3D": 3 * day,
    "1W": 7 * day,
    "1M": 30 * day,
    "3M": 90 * day,
    "6M": 180 * day,
    "1Y": 365 * day,
  };
  return values[timeframe] ?? 5 * minute;
}

function resample(rows: DatabentoBar[], timeframe: string) {
  const size = timeframeMs(timeframe);
  const sourceSize = sourceSchema(timeframe) === "ohlcv-1s" ? 1_000 : sourceSchema(timeframe) === "ohlcv-1m" ? 60_000 : 86_400_000;
  if (size <= sourceSize) return rows;
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

export function isContinuousFuture(symbol: string) {
  return /\.[vnc]\.\d+$/.test(symbol);
}

export async function getDatabentoBars(symbol: string, timeframe: string, start: string, end: string) {
  const rows = await historicalRequest({
    symbols: symbol,
    stype_in: isContinuousFuture(symbol) ? "continuous" : "raw_symbol",
    schema: sourceSchema(timeframe),
    start,
    end,
  });
  const bars = rows
    .map((row) => ({
      timestamp: time(row.ts_event ?? row.ts_recv ?? (row.hd as Record<string, unknown> | undefined)?.ts_event),
      open: price(row.open),
      high: price(row.high),
      low: price(row.low),
      close: price(row.close),
      volume: Number(row.volume ?? 0),
    }))
    .filter((row) => row.timestamp > 0 && row.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  return resample(bars, timeframe);
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
