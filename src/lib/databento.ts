export type DatabentoInstrument = {
  symbol: string;
  label: string;
  venue: "CME" | "CBOT" | "NYMEX" | "COMEX";
  kind: "future" | "option-chain";
  group: string;
};

// Continuous contracts use Databento's volume-ranked front-month convention.
// Option-chain entries use parent symbology and are deliberately not fetched until
// a concrete contract is chosen, avoiding an accidental all-chain request.
export const DATABENTO_INSTRUMENTS: DatabentoInstrument[] = [
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
  { symbol: "SR3.v.0", label: "3-Month SOFR", venue: "CME", kind: "future", group: "Rates" },
  { symbol: "6E.v.0", label: "Euro FX", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6J.v.0", label: "Japanese Yen", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6B.v.0", label: "British Pound", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6A.v.0", label: "Australian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "ZC.v.0", label: "Corn", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZS.v.0", label: "Soybeans", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZW.v.0", label: "Wheat", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ES.OPT", label: "E-mini S&P 500 options", venue: "CME", kind: "option-chain", group: "Options on futures" },
  { symbol: "NQ.OPT", label: "E-mini Nasdaq-100 options", venue: "CME", kind: "option-chain", group: "Options on futures" },
  { symbol: "CL.OPT", label: "WTI Crude Oil options", venue: "NYMEX", kind: "option-chain", group: "Options on futures" },
  { symbol: "GC.OPT", label: "Gold options", venue: "COMEX", kind: "option-chain", group: "Options on futures" },
  { symbol: "ZN.OPT", label: "10-Year Treasury Note options", venue: "CBOT", kind: "option-chain", group: "Options on futures" },
];

export type MarketBar = { timestamp: number; time: number; open: number; high: number; low: number; close: number; volume: number };
export type LevelOneQuote = { symbol: string; last: number; bid: number; ask: number; change: number; changePercent: number; timestamp: number };

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "records", "result"]) {
      if (Array.isArray(record[key])) return record[key].filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }
  }
  return [];
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 10_000_000 ? parsed / 1_000_000_000 : parsed;
}

function timestamp(value: unknown) {
  if (typeof value === "number") return value > 10_000_000_000_000 ? Math.floor(value / 1_000_000) : value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function rowSymbol(row: Record<string, unknown>, fallback: string) {
  const symbol = row.symbol ?? row.raw_symbol ?? row.stype_out_symbol;
  return typeof symbol === "string" && symbol.trim() ? symbol.trim() : fallback;
}

async function request(params: Record<string, string>) {
  const key = process.env.DATABENTO_API_KEY;
  if (!key) throw new Error("Databento is not configured.");

  const url = new URL("https://hist.databento.com/v0/timeseries.get_range");
  Object.entries({ dataset: "GLBX.MDP3", encoding: "json", pretty_px: "true", pretty_ts: "true", map_symbols: "true", ...params })
    .forEach(([name, value]) => url.searchParams.set(name, value));

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Databento request failed (${response.status}).`);
  return asRows(await response.json());
}

function schemaFor(timeframe: string) {
  return timeframe === "1D" ? "ohlcv-1d" : "ohlcv-1m";
}

function bucketSize(timeframe: string) {
  const minutes: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240 };
  return (minutes[timeframe] ?? 5) * 60_000;
}

function resample(rows: MarketBar[], timeframe: string) {
  if (timeframe === "1m" || timeframe === "1D") return rows;
  const size = bucketSize(timeframe);
  const grouped = new Map<number, MarketBar>();
  for (const bar of rows) {
    const bucket = Math.floor(bar.time / size) * size;
    const existing = grouped.get(bucket);
    if (!existing) grouped.set(bucket, { ...bar, time: bucket, timestamp: bucket });
    else {
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close;
      existing.volume += bar.volume;
    }
  }
  return [...grouped.values()].sort((a, b) => a.time - b.time);
}

export async function getBars(symbol: string, timeframe: string, start: string, end: string) {
  const rows = await request({ symbols: symbol, stype_in: "continuous", schema: schemaFor(timeframe), start, end });
  const bars = rows.map((row) => ({
    time: timestamp(row.ts_event ?? row.ts_recv), timestamp: timestamp(row.ts_event ?? row.ts_recv),
    open: number(row.open), high: number(row.high), low: number(row.low), close: number(row.close), volume: number(row.volume),
  })).filter((bar) => bar.time && bar.close > 0);
  return resample(bars, timeframe);
}

export async function getLevelOne(symbols: string[]) {
  const rows = await request({
    symbols: symbols.join(","), stype_in: "continuous", schema: "mbp-1",
    start: new Date(Date.now() - 10 * 60_000).toISOString(), end: new Date().toISOString(), limit: "20000",
  });
  const latest = new Map<string, LevelOneQuote>();
  for (const row of rows) {
    const symbol = rowSymbol(row, symbols[0] ?? "");
    const bid = number(row.bid_px_00 ?? row.bid_price ?? row.bid);
    const ask = number(row.ask_px_00 ?? row.ask_price ?? row.ask);
    const last = number(row.price ?? row.last_price) || (bid && ask ? (bid + ask) / 2 : bid || ask);
    if (!last) continue;
    const previous = latest.get(symbol);
    const change = previous ? last - previous.last : 0;
    latest.set(symbol, { symbol, last, bid: bid || last, ask: ask || last, change, changePercent: previous?.last ? (change / previous.last) * 100 : 0, timestamp: timestamp(row.ts_event ?? row.ts_recv) });
  }
  return [...latest.values()];
}
