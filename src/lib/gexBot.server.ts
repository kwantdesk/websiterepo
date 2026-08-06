import "server-only";

import { gunzipSync } from "node:zlib";

import type {
  GexBotMajorsFrame,
  GexBotMaxChangeFrame,
  GexBotOrderflowFrame,
  GexBotProfileFrame,
  GexBotStrike,
  GexBotTerminalEnvelope,
} from "@/lib/gexBotTypes";

type View = "classic" | "state" | "orderflow";

const API_ROOT = "https://api.gex.bot/v2";
const LIVE_TTL_MS = 2_000;
const CLOSED_TTL_MS = 60_000;
const STALE_IF_ERROR_MS = 18 * 60 * 60_000;

const responseCache = new Map<string, { value: unknown; receivedAt: number }>();
const inFlight = new Map<string, Promise<unknown>>();
const historyCache = new Map<string, { value: unknown[]; receivedAt: number }>();
const historyInFlight = new Map<string, Promise<unknown[]>>();

type HistoryResult = {
  rows: unknown[];
  date: string | null;
  attemptedDates: string[];
  error?: string;
};

function apiKey() {
  return process.env.GEXBOT_API_KEY?.trim() ?? "";
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampMs(value: unknown): number {
  if (typeof value === "string" && value.trim() && !Number.isFinite(Number(value))) {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }
  const parsed = finite(value);
  if (parsed === null || parsed <= 0) return Date.now();
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePriors(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(finite).filter((item): item is number => item !== null);
}

function normalizeStrikes(value: unknown): GexBotStrike[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 3) return [];
    const strike = finite(entry[0]);
    const volume = finite(entry[1]);
    const oi = finite(entry[2]);
    if (strike === null || volume === null || oi === null) return [];
    return [[strike, volume, oi, normalizePriors(entry[3])] as GexBotStrike];
  });
}

function normalizeProfile(payload: unknown): GexBotProfileFrame {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const spot = finite(source.spot);
  if (spot === null || spot <= 0) throw new Error("GEXBot returned a frame without a valid spot price.");
  return {
    timestamp: timestampMs(source.timestamp),
    ticker: stringValue(source.ticker, "UNKNOWN"),
    min_dte: source.min_dte as string | number | null | undefined,
    sec_min_dte: source.sec_min_dte as string | number | null | undefined,
    spot,
    zero_gamma: finite(source.zero_gamma),
    major_pos_vol: finite(source.major_pos_vol),
    major_pos_oi: finite(source.major_pos_oi),
    major_neg_vol: finite(source.major_neg_vol),
    major_neg_oi: finite(source.major_neg_oi),
    strikes: normalizeStrikes(source.strikes),
    sum_gex_vol: finite(source.sum_gex_vol),
    sum_gex_oi: finite(source.sum_gex_oi),
    delta_risk_reversal: finite(source.delta_risk_reversal),
    max_priors: Array.isArray(source.max_priors)
      ? source.max_priors.flatMap((entry) => {
          if (!Array.isArray(entry)) return [];
          const strike = finite(entry[0]);
          const exposure = finite(entry[1]);
          return strike === null || exposure === null ? [] : [[strike, exposure] as [number, number]];
        })
      : [],
  };
}

function normalizeOrderflow(payload: unknown): GexBotOrderflowFrame {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const profile = normalizeProfile(source);
  const fields = [
    "z_mlgamma", "z_msgamma", "o_mlgamma", "o_msgamma", "zero_mcall", "zero_mput",
    "one_mcall", "one_mput", "zcvr", "ocvr", "zgr", "ogr", "zvanna", "ovanna",
    "zcharm", "ocharm", "agg_dex", "one_agg_dex", "agg_call_dex", "one_agg_call_dex",
    "agg_put_dex", "one_agg_put_dex", "net_dex", "one_net_dex", "net_call_dex",
    "one_net_call_dex", "net_put_dex", "one_net_put_dex", "dexoflow", "gexoflow",
    "cvroflow", "one_dexoflow", "one_gexoflow", "one_cvroflow",
  ] as const;
  const extras = Object.fromEntries(fields.map((field) => [field, finite(source[field])])) as Partial<GexBotOrderflowFrame>;
  return { ...profile, ...extras };
}

function nyParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
}

function completedNewYorkTradingDates(now = new Date(), count = 4) {
  const current = nyParts(now);
  const currentMinutes = Number(current.hour) * 60 + Number(current.minute);
  const currentIsWeekday = current.weekday !== "Sat" && current.weekday !== "Sun";
  const cursor = new Date(Date.UTC(Number(current.year), Number(current.month) - 1, Number(current.day), 17));

  // An archive is a completed New York session. Before the close, begin with the
  // preceding trading day rather than asking for an archive that cannot exist yet.
  if (!currentIsWeekday || currentMinutes < 16 * 60) cursor.setUTCDate(cursor.getUTCDate() - 1);

  const dates: string[] = [];
  for (let attempt = 0; attempt < 12 && dates.length < count; attempt += 1) {
    const parts = nyParts(cursor);
    if (parts.weekday !== "Sat" && parts.weekday !== "Sun") {
      dates.push(`${parts.year}-${parts.month}-${parts.day}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

export function isNewYorkRth(now = new Date()) {
  const parts = nyParts(now);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

async function requestJson(path: string, marketOpen: boolean): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new Error("GEXBot is not configured on this deployment.");
  const now = Date.now();
  const cached = responseCache.get(path);
  const ttl = marketOpen ? LIVE_TTL_MS : CLOSED_TTL_MS;
  if (cached && now - cached.receivedAt <= ttl) return cached.value;
  const pending = inFlight.get(path);
  if (pending) return pending;

  const request = fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "KwantDesk/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        const message = [payload.detail, payload.error, payload.message]
          .find((value) => typeof value === "string" && value.trim());
        const error = new Error(typeof message === "string" ? message : `GEXBot request failed (${response.status}).`);
        Object.assign(error, { status: response.status });
        throw error;
      }
      responseCache.set(path, { value: payload, receivedAt: Date.now() });
      return payload;
    })
    .catch((error) => {
      if (cached && now - cached.receivedAt <= STALE_IF_ERROR_MS) return cached.value;
      throw error;
    })
    .finally(() => inFlight.delete(path));

  inFlight.set(path, request);
  return request;
}

function rowsFromHistoryPayload(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    if (payload.length === 0 || typeof payload[0] !== "string") return payload;
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  for (const key of ["data", "history", "frames", "results"]) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  return null;
}

function signedHistoryUrl(payload: unknown) {
  if (Array.isArray(payload)) {
    const candidate = payload.find((value) => typeof value === "string" && value.startsWith("https://"));
    return typeof candidate === "string" ? candidate : null;
  }
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  for (const key of ["url", "download_url", "signed_url"]) {
    if (typeof source[key] === "string" && source[key].startsWith("https://")) return source[key] as string;
  }
  return null;
}

function parseHistoryBytes(input: Buffer) {
  let bytes = input;
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    return rowsFromHistoryPayload(parsed) ?? [];
  } catch {
    // Some archive builds are newline-delimited JSON rather than one JSON array.
    return text.split(/\r?\n/).flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      try { return [JSON.parse(trimmed) as unknown]; } catch { return []; }
    });
  }
}

function sampleCompleteSession<T>(items: T[], maximum = 6_000) {
  if (items.length <= maximum) return items;
  const sampled: T[] = [];
  const finalIndex = items.length - 1;
  for (let index = 0; index < maximum; index += 1) {
    sampled.push(items[Math.round((index * finalIndex) / (maximum - 1))]);
  }
  return sampled;
}

async function requestHistoryDate(ticker: string, view: View, category: string, date: string, marketOpen: boolean) {
  const cacheKey = `${ticker}:${view}:${category}:${date}`;
  const cached = historyCache.get(cacheKey);
  const ttl = marketOpen ? 60_000 : 10 * 60_000;
  if (cached && Date.now() - cached.receivedAt <= ttl) return cached.value;
  const pending = historyInFlight.get(cacheKey);
  if (pending) return pending;
  const key = apiKey();
  if (!key) throw new Error("GEXBot is not configured on this deployment.");

  const request = (async () => {
    const path = `${API_ROOT}/hist/${encodeURIComponent(ticker)}/${view}/${encodeURIComponent(category)}/${date}?noredirect`;
    const signedResponse = await fetch(path, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
        Authorization: `Bearer ${key}`,
        "User-Agent": "KwantDesk/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const signedPayload = await signedResponse.json().catch(() => null) as unknown;
    if (!signedResponse.ok) {
      const detail = signedPayload && typeof signedPayload === "object"
        ? stringValue((signedPayload as Record<string, unknown>).detail)
          || stringValue((signedPayload as Record<string, unknown>).message)
        : "";
      throw new Error(detail || `GEXBot history request failed (${signedResponse.status}) for ${date}.`);
    }

    const directRows = rowsFromHistoryPayload(signedPayload);
    let rows: unknown[];
    if (directRows) {
      rows = directRows;
    } else {
      const downloadUrl = signedHistoryUrl(signedPayload);
      if (!downloadUrl) throw new Error(`GEXBot did not return a history archive for ${date}.`);
      const fileResponse = await fetch(downloadUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!fileResponse.ok) throw new Error(`GEXBot history archive failed (${fileResponse.status}) for ${date}.`);
      rows = parseHistoryBytes(Buffer.from(await fileResponse.arrayBuffer()));
    }
    if (!rows.length) throw new Error(`GEXBot history archive was empty for ${date}.`);
    historyCache.set(cacheKey, { value: rows, receivedAt: Date.now() });
    return rows;
  })().finally(() => historyInFlight.delete(cacheKey));
  historyInFlight.set(cacheKey, request);
  return request;
}

async function requestHistory(ticker: string, view: View, category: string, marketOpen: boolean): Promise<HistoryResult> {
  const attemptedDates = completedNewYorkTradingDates();
  let lastError = "No completed New York trading session was available.";
  for (const date of attemptedDates) {
    try {
      const rows = await requestHistoryDate(ticker, view, category, date, marketOpen);
      if (rows.length) return { rows, date, attemptedDates };
    } catch (error) {
      lastError = error instanceof Error ? error.message : `GEXBot history was unavailable for ${date}.`;
    }
  }
  return { rows: [], date: null, attemptedDates, error: lastError };
}

function normalizeMajors(payload: unknown): GexBotMajorsFrame {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return {
    timestamp: timestampMs(source.timestamp),
    ticker: stringValue(source.ticker),
    spot: finite(source.spot) ?? undefined,
    zero_gamma: finite(source.zero_gamma),
    mpos_vol: finite(source.mpos_vol),
    mpos_oi: finite(source.mpos_oi),
    mneg_vol: finite(source.mneg_vol),
    mneg_oi: finite(source.mneg_oi),
    net_gex_vol: finite(source.net_gex_vol),
    net_gex_oi: finite(source.net_gex_oi),
  };
}

function pair(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  const first = finite(value[0]);
  const second = finite(value[1]);
  return first === null || second === null ? null : [first, second];
}

function normalizeMaxChange(payload: unknown): GexBotMaxChangeFrame {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return {
    timestamp: timestampMs(source.timestamp),
    ticker: stringValue(source.ticker),
    current: pair(source.current),
    one: pair(source.one),
    five: pair(source.five),
    ten: pair(source.ten),
    fifteen: pair(source.fifteen),
    thirty: pair(source.thirty),
  };
}

function frameSession(frameTimestamp: number, marketOpen: boolean) {
  if (!marketOpen) return "FROZEN_NEW_YORK_CLOSE" as const;
  return Date.now() - frameTimestamp > 5 * 60_000 ? "DELAYED" as const : "LIVE_RTH" as const;
}

export async function fetchGexBotTerminal(
  view: View,
  ticker: string,
  category: string,
  includeHistory = false,
): Promise<GexBotTerminalEnvelope<GexBotProfileFrame | GexBotOrderflowFrame>> {
  const marketOpen = isNewYorkRth();
  const base = `/${encodeURIComponent(ticker)}/${view}`;
  try {
    const [frameResult, majorsResult, maxChangeResult, historyResult] = await Promise.allSettled([
      requestJson(`${base}/${encodeURIComponent(category)}`, marketOpen),
      view === "orderflow" ? Promise.resolve(null) : requestJson(`${base}/majors`, marketOpen),
      view === "orderflow" ? Promise.resolve(null) : requestJson(`${base}/maxchange`, marketOpen),
      includeHistory ? requestHistory(ticker, view, category, marketOpen) : Promise.resolve<HistoryResult>({ rows: [], date: null, attemptedDates: [] }),
    ]);
    if (frameResult.status === "rejected") throw frameResult.reason;
    const frame = view === "orderflow"
      ? normalizeOrderflow(frameResult.value)
      : normalizeProfile(frameResult.value);
    return {
      ok: true,
      view,
      ticker,
      category,
      session: frameSession(frame.timestamp, marketOpen),
      marketOpen,
      checkedAt: Date.now(),
      frame,
      history: historyResult.status === "fulfilled"
        ? sampleCompleteSession(historyResult.value.rows.flatMap((entry) => {
            try { return [view === "orderflow" ? normalizeOrderflow(entry) : normalizeProfile(entry)]; }
            catch { return []; }
          }))
        : null,
      historyDate: historyResult.status === "fulfilled" ? historyResult.value.date : null,
      historyStatus: !includeHistory
        ? "NOT_REQUESTED"
        : historyResult.status === "fulfilled" && historyResult.value.rows.length
          ? "LOADED"
          : "UNAVAILABLE",
      historyError: historyResult.status === "fulfilled" ? historyResult.value.error : "GEXBot history request failed.",
      majors: majorsResult.status === "fulfilled" && majorsResult.value
        ? normalizeMajors(majorsResult.value)
        : null,
      maxChange: maxChangeResult.status === "fulfilled" && maxChangeResult.value
        ? normalizeMaxChange(maxChangeResult.value)
        : null,
    };
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status);
    return {
      ok: false,
      view,
      ticker,
      category,
      session: marketOpen ? "DELAYED" : "FROZEN_NEW_YORK_CLOSE",
      marketOpen,
      checkedAt: Date.now(),
      frame: null,
      history: null,
      historyDate: null,
      historyStatus: includeHistory ? "UNAVAILABLE" : "NOT_REQUESTED",
      majors: null,
      maxChange: null,
      entitlementRequired: status === 401 || status === 403,
      error: error instanceof Error ? error.message : "GEXBot could not be reached.",
    };
  }
}
