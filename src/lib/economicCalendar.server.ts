import { createHash } from "node:crypto";
import {
  ECONOMIC_CALENDAR_CURRENCIES,
  economicCalendarCoverage,
  hasUpcomingEconomicEvents,
  type EconomicCalendarEvent,
  type EconomicCalendarPayload,
  type EconomicCurrency,
  type EconomicImpact,
} from "@/lib/economicCalendar";

const FAIR_ECONOMY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const COUNTRY_TO_CURRENCY: Record<string, EconomicCurrency> = {
  "united states": "USD",
  "euro area": "EUR",
  germany: "EUR",
  france: "EUR",
  italy: "EUR",
  spain: "EUR",
  "united kingdom": "GBP",
  japan: "JPY",
  australia: "AUD",
  canada: "CAD",
  switzerland: "CHF",
  "new zealand": "NZD",
  china: "CNY",
};
const TRADING_ECONOMICS_COUNTRIES = [
  "united states",
  "euro area",
  "united kingdom",
  "japan",
  "australia",
  "canada",
  "switzerland",
  "new zealand",
  "china",
].join(",");
const TRADING_ECONOMICS_REVALIDATE_SECONDS = 300;
const TRADING_VIEW_REVALIDATE_SECONDS = 300;
const FAIR_ECONOMY_REVALIDATE_SECONDS = 14_400;
const FAIR_ECONOMY_ROLLOVER_REVALIDATE_SECONDS = 300;
const STALE_CALENDAR_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

type CalendarCacheEntry = {
  payload: EconomicCalendarPayload;
  storedAt: number;
};

const calendarGlobal = globalThis as typeof globalThis & {
  __kwantdeskEconomicCalendarCache?: Map<string, CalendarCacheEntry>;
  __kwantdeskEconomicCalendarRequests?: Map<string, Promise<EconomicCalendarPayload>>;
};
const calendarCache = calendarGlobal.__kwantdeskEconomicCalendarCache
  ?? (calendarGlobal.__kwantdeskEconomicCalendarCache = new Map<string, CalendarCacheEntry>());
const calendarRequests = calendarGlobal.__kwantdeskEconomicCalendarRequests
  ?? (calendarGlobal.__kwantdeskEconomicCalendarRequests = new Map<string, Promise<EconomicCalendarPayload>>());

type FairEconomyEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
};

type TradingEconomicsEvent = {
  CalendarId?: string | number;
  Date?: string;
  Country?: string;
  Category?: string;
  Event?: string;
  Reference?: string;
  Source?: string;
  SourceURL?: string;
  Actual?: string | number;
  Previous?: string | number;
  Forecast?: string | number;
  TEForecast?: string | number;
  Importance?: string | number;
  LastUpdate?: string;
  Revised?: string | number;
  Currency?: string;
  Unit?: string;
};

type TradingViewEvent = {
  id?: string | number;
  title?: string;
  country?: string;
  indicator?: string;
  date?: string;
  source?: string;
  source_url?: string;
  actual?: string | number | null;
  previous?: string | number | null;
  forecast?: string | number | null;
  currency?: string;
  importance?: string | number;
};

type TradingViewResponse = {
  status?: string;
  result?: TradingViewEvent[];
};

function stableId(parts: Array<string | number | undefined>) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 18);
}

function asText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeImpact(value: unknown): EconomicImpact {
  const impact = asText(value).toLowerCase();
  if (impact === "3" || impact.includes("high")) return "High";
  if (impact === "2" || impact.includes("medium")) return "Medium";
  return "Low";
}

function validCurrency(value: unknown): EconomicCurrency | null {
  const currency = asText(value).toUpperCase();
  return ECONOMIC_CALENDAR_CURRENCIES.includes(currency as EconomicCurrency)
    ? currency as EconomicCurrency
    : null;
}

function normalizeIso(value: string) {
  if (!value) return "";
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const parsed = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function normalizeFairEconomy(rows: FairEconomyEvent[]) {
  return rows.flatMap((row): EconomicCalendarEvent[] => {
    const currency = validCurrency(row.country);
    const date = normalizeIso(asText(row.date));
    const name = asText(row.title);
    if (!currency || !date || !name) return [];
    return [{
      id: `fe-${stableId([name, row.country, date])}`,
      date,
      currency,
      country: currency,
      impact: normalizeImpact(row.impact),
      name,
      category: name,
      forecast: asText(row.forecast),
      previous: asText(row.previous),
      actual: "",
      revised: "",
      reference: "",
      source: "Fair Economy",
      sourceUrl: "",
      unit: "",
      status: new Date(date).getTime() <= Date.now() ? "released" : "scheduled",
    }];
  });
}

function normalizeTradingViewImpact(value: unknown): EconomicImpact {
  const importance = Number(value);
  if (importance >= 1) return "High";
  if (importance === 0) return "Medium";
  return "Low";
}

function normalizeTradingView(rows: TradingViewEvent[]) {
  return rows.flatMap((row): EconomicCalendarEvent[] => {
    const currency = validCurrency(row.currency);
    const date = normalizeIso(asText(row.date));
    const name = asText(row.title) || asText(row.indicator);
    if (!currency || !date || !name) return [];
    const actual = asText(row.actual);
    return [{
      id: `tv-${asText(row.id) || stableId([name, row.country, date])}`,
      date,
      currency,
      country: asText(row.country) || currency,
      impact: normalizeTradingViewImpact(row.importance),
      name,
      category: asText(row.indicator) || name,
      forecast: asText(row.forecast),
      previous: asText(row.previous),
      actual,
      revised: "",
      reference: "",
      source: asText(row.source) || "TradingView Economic Calendar",
      sourceUrl: asText(row.source_url),
      unit: "",
      status: actual || new Date(date).getTime() <= Date.now() ? "released" : "scheduled",
    }];
  });
}

function normalizeTradingEconomics(rows: TradingEconomicsEvent[]) {
  return rows.flatMap((row): EconomicCalendarEvent[] => {
    const country = asText(row.Country);
    const currency = validCurrency(row.Currency) ?? COUNTRY_TO_CURRENCY[country.toLowerCase()] ?? null;
    const date = normalizeIso(asText(row.Date));
    const name = asText(row.Event) || asText(row.Category);
    if (!currency || !date || !name) return [];
    const actual = asText(row.Actual);
    return [{
      id: `te-${asText(row.CalendarId) || stableId([name, country, date])}`,
      date,
      currency,
      country,
      impact: normalizeImpact(row.Importance),
      name,
      category: asText(row.Category) || name,
      forecast: asText(row.Forecast) || asText(row.TEForecast),
      previous: asText(row.Previous),
      actual,
      revised: asText(row.Revised),
      reference: asText(row.Reference),
      source: asText(row.Source) || "Trading Economics",
      sourceUrl: asText(row.SourceURL),
      unit: asText(row.Unit),
      status: actual || new Date(date).getTime() <= Date.now() ? "released" : "scheduled",
    }];
  });
}

function sortEvents(events: EconomicCalendarEvent[]) {
  return events
    .filter((event, index, rows) => rows.findIndex((row) => row.id === event.id) === index)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function fetchTradingEconomics(
  apiKey: string,
  from: string,
  to: string,
): Promise<EconomicCalendarPayload> {
  const countries = encodeURIComponent(TRADING_ECONOMICS_COUNTRIES);
  const url = `https://api.tradingeconomics.com/calendar/country/${countries}/${from}/${to}?c=${encodeURIComponent(apiKey)}&f=json`;
  const response = await fetch(url, {
    next: { revalidate: TRADING_ECONOMICS_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Trading Economics returned ${response.status}.`);
  const rows = await response.json() as TradingEconomicsEvent[];
  if (!Array.isArray(rows)) throw new Error("Trading Economics returned an invalid calendar.");
  return {
    events: sortEvents(normalizeTradingEconomics(rows)),
    provider: "Trading Economics",
    fetchedAt: new Date().toISOString(),
    refreshAfterMs: TRADING_ECONOMICS_REVALIDATE_SECONDS * 1_000,
    coverage: { from, to, longRange: true },
    partial: rows.length >= 1_000,
    note: rows.length >= 1_000
      ? "The forward schedule is live and refreshing automatically. The provider returned its maximum event count for this window."
      : "Forward calendar, forecasts and released values refresh automatically.",
  };
}

function shiftIsoDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function fetchTradingView(from: string, to: string): Promise<EconomicCalendarPayload> {
  const fromTimestamp = encodeURIComponent(`${from}T00:00:00.000Z`);
  const toTimestamp = encodeURIComponent(`${to}T23:59:59.999Z`);
  const countries = "US,EU,GB,JP,AU,CA,CH,NZ,CN";
  const url = `https://economic-calendar.tradingview.com/events?from=${fromTimestamp}&to=${toTimestamp}&countries=${countries}`;
  const response = await fetch(url, {
    next: { revalidate: TRADING_VIEW_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/json",
      Origin: "https://www.tradingview.com",
      Referer: "https://www.tradingview.com/",
    },
  });
  if (!response.ok) throw new Error(`Forward economic calendar returned ${response.status}.`);
  const body = await response.json() as TradingViewResponse;
  if (body.status !== "ok" || !Array.isArray(body.result)) {
    throw new Error("Forward economic calendar returned an invalid response.");
  }
  const events = sortEvents(normalizeTradingView(body.result));
  const coverage = economicCalendarCoverage(events, from, to);
  return {
    events,
    provider: "TradingView",
    fetchedAt: new Date().toISOString(),
    refreshAfterMs: TRADING_VIEW_REVALIDATE_SECONDS * 1_000,
    coverage: { ...coverage, longRange: coverage.to > shiftIsoDate(from, 7) },
    partial: false,
    note: "Published forward events, forecasts and released values refresh automatically.",
  };
}

async function fetchFairEconomy(): Promise<EconomicCalendarPayload> {
  const response = await fetch(FAIR_ECONOMY_URL, {
    next: { revalidate: FAIR_ECONOMY_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Economic calendar returned ${response.status}.`);
  const rows = await response.json() as FairEconomyEvent[];
  if (!Array.isArray(rows)) throw new Error("Economic calendar returned an invalid response.");
  const events = sortEvents(normalizeFairEconomy(rows));
  const today = new Date().toISOString().slice(0, 10);
  const coverage = economicCalendarCoverage(events, today);
  const hasUpcoming = hasUpcomingEconomicEvents(events);
  const refreshAfterMs = (hasUpcoming
    ? FAIR_ECONOMY_REVALIDATE_SECONDS
    : FAIR_ECONOMY_ROLLOVER_REVALIDATE_SECONDS) * 1_000;
  return {
    events,
    provider: "Fair Economy",
    fetchedAt: new Date().toISOString(),
    refreshAfterMs,
    coverage: { ...coverage, longRange: false },
    partial: !hasUpcoming,
    note: hasUpcoming
      ? "Current-week scheduled events and consensus values refresh automatically."
      : "The next published week has not reached the fallback feed yet. Checking automatically every five minutes.",
  };
}

function cacheKey(provider: "te" | "tv" | "fair", from: string, to: string) {
  return provider === "fair" ? provider : `${provider}:${from}:${to}`;
}

function freshFor(payload: EconomicCalendarPayload) {
  if (payload.provider === "Trading Economics") return TRADING_ECONOMICS_REVALIDATE_SECONDS * 1_000;
  if (payload.provider === "TradingView") return TRADING_VIEW_REVALIDATE_SECONDS * 1_000;
  return payload.refreshAfterMs;
}

function cachedCalendar(key: string, allowStale = false) {
  const cached = calendarCache.get(key);
  if (!cached) return null;
  const age = Date.now() - cached.storedAt;
  if (age > (allowStale ? STALE_CALENDAR_MAX_AGE_MS : freshFor(cached.payload))) return null;
  return cached.payload;
}

function rememberCalendar(key: string, payload: EconomicCalendarPayload) {
  calendarCache.set(key, { payload, storedAt: Date.now() });
  return payload;
}

function staleCalendar(key: string) {
  const cached = cachedCalendar(key, true);
  if (!cached) return null;
  return {
    ...cached,
    partial: true,
    refreshAfterMs: 60_000,
    note: "Calendar data is being served from the verified cache while the live source reconnects automatically.",
  } satisfies EconomicCalendarPayload;
}

async function loadEconomicCalendar(from: string, to: string) {
  const apiKey = process.env.TRADING_ECONOMICS_API_KEY?.trim();
  if (apiKey) {
    const key = cacheKey("te", from, to);
    try {
      return rememberCalendar(key, await fetchTradingEconomics(apiKey, from, to));
    } catch (primaryError) {
      const stale = staleCalendar(key);
      if (stale) return stale;
      try {
        const fallbackKey = cacheKey("tv", from, to);
        const fallback = cachedCalendar(fallbackKey)
          ?? rememberCalendar(fallbackKey, await fetchTradingView(from, to));
        return {
          ...fallback,
          partial: true,
          note: "The primary forward source is reconnecting automatically. The published forward schedule remains available.",
        };
      } catch {
        const fairKey = cacheKey("fair", from, to);
        try {
          return cachedCalendar(fairKey)
            ?? rememberCalendar(fairKey, await fetchFairEconomy());
        } catch {
          throw new Error(
            primaryError instanceof Error
              ? `The forward calendar is reconnecting: ${primaryError.message}`
              : "The forward calendar is reconnecting.",
          );
        }
      }
    }
  }

  const key = cacheKey("tv", from, to);
  try {
    return rememberCalendar(key, await fetchTradingView(from, to));
  } catch {
    const stale = staleCalendar(key);
    if (stale) return stale;
    const fairKey = cacheKey("fair", from, to);
    try {
      return cachedCalendar(fairKey)
        ?? rememberCalendar(fairKey, await fetchFairEconomy());
    } catch {
      const fairStale = staleCalendar(fairKey);
      if (fairStale) return fairStale;
      throw new Error("The economic calendar is reconnecting automatically.");
    }
  }
}

export async function getEconomicCalendar(from: string, to: string) {
  const provider = process.env.TRADING_ECONOMICS_API_KEY?.trim() ? "te" : "tv";
  const key = cacheKey(provider, from, to);
  const cached = cachedCalendar(key);
  if (cached) return cached;

  const pending = calendarRequests.get(key);
  if (pending) return pending;

  const request = loadEconomicCalendar(from, to)
    .then((payload) => rememberCalendar(key, payload))
    .finally(() => {
      calendarRequests.delete(key);
    });
  calendarRequests.set(key, request);
  return request;
}
