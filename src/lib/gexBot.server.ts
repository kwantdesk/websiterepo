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

function recentNewYorkTradingDate(now = new Date()) {
  const cursor = new Date(now);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = nyParts(cursor);
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const weekday = parts.weekday;
    if (weekday !== "Sat" && weekday !== "Sun" && (attempt > 0 || minutes >= 9 * 60 + 30)) {
      return `${parts.year}-${parts.month}-${parts.day}`;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return "";
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

async function requestHistory(ticker: string, view: View, category: string, marketOpen: boolean) {
  const date = recentNewYorkTradingDate();
  if (!date) return [];
  const cacheKey = `${ticker}:${view}:${category}:${date}`;
  const cached = historyCache.get(cacheKey);
  const ttl = marketOpen ? 60_000 : 10 * 60_000;
  if (cached && Date.now() - cached.receivedAt <= ttl) return cached.value;
  const pending = historyInFlight.get(cacheKey);
  if (pending) return pending;
  const key = apiKey();
  if (!key) return [];

  const request = (async () => {
    const path = `${API_ROOT}/hist/${encodeURIComponent(ticker)}/${view}/${encodeURIComponent(category)}/${date}?noredirect=true`;
    const getSignedUrl = async (scheme: "Basic" | "Bearer") => fetch(path, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
        Authorization: `${scheme} ${key}`,
        "User-Agent": "KwantDesk/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    let signedResponse = await getSignedUrl("Basic");
    if (!signedResponse.ok) signedResponse = await getSignedUrl("Bearer");
    if (!signedResponse.ok) return [];
    const signedPayload = await signedResponse.json().catch(() => ({})) as { url?: unknown };
    if (typeof signedPayload.url !== "string" || !signedPayload.url.startsWith("https://")) return [];
    const fileResponse = await fetch(signedPayload.url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!fileResponse.ok) return [];
    let bytes = Buffer.from(await fileResponse.arrayBuffer());
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [];
    historyCache.set(cacheKey, { value: rows, receivedAt: Date.now() });
    return rows;
  })().catch(() => [] as unknown[]).finally(() => historyInFlight.delete(cacheKey));
  historyInFlight.set(cacheKey, request);
  return request;
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
      includeHistory ? requestHistory(ticker, view, category, marketOpen) : Promise.resolve([]),
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
        ? historyResult.value.flatMap((entry) => {
            try { return [view === "orderflow" ? normalizeOrderflow(entry) : normalizeProfile(entry)]; }
            catch { return []; }
          }).slice(-1_500)
        : null,
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
      majors: null,
      maxChange: null,
      entitlementRequired: status === 401 || status === 403,
      error: error instanceof Error ? error.message : "GEXBot could not be reached.",
    };
  }
}
