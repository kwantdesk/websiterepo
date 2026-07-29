import { createHash } from "node:crypto";
import {
  ECONOMIC_CALENDAR_CURRENCIES,
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
const FAIR_ECONOMY_REVALIDATE_SECONDS = 14_400;
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

function weekBounds(now = new Date()) {
  const day = now.getUTCDay();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
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

async function fetchFairEconomy(): Promise<EconomicCalendarPayload> {
  const response = await fetch(FAIR_ECONOMY_URL, {
    next: { revalidate: FAIR_ECONOMY_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Economic calendar returned ${response.status}.`);
  const rows = await response.json() as FairEconomyEvent[];
  if (!Array.isArray(rows)) throw new Error("Economic calendar returned an invalid response.");
  const coverage = weekBounds();
  return {
    events: sortEvents(normalizeFairEconomy(rows)),
    provider: "Fair Economy",
    fetchedAt: new Date().toISOString(),
    refreshAfterMs: FAIR_ECONOMY_REVALIDATE_SECONDS * 1_000,
    coverage: { ...coverage, longRange: false },
    partial: false,
    note: "Current-week scheduled events and consensus values refresh automatically.",
  };
}

function cacheKey(provider: "te" | "fair", from: string, to: string) {
  return provider === "te" ? `${provider}:${from}:${to}` : provider;
}

function freshFor(payload: EconomicCalendarPayload) {
  return payload.provider === "Trading Economics"
    ? TRADING_ECONOMICS_REVALIDATE_SECONDS * 1_000
    : FAIR_ECONOMY_REVALIDATE_SECONDS * 1_000;
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
        const fallbackKey = cacheKey("fair", from, to);
        const fallback = cachedCalendar(fallbackKey)
          ?? rememberCalendar(fallbackKey, await fetchFairEconomy());
        return {
          ...fallback,
          partial: true,
          note: "The forward source is reconnecting automatically. Current-week events remain available.",
        };
      } catch {
        throw new Error(
          primaryError instanceof Error
            ? `The forward calendar is reconnecting: ${primaryError.message}`
            : "The forward calendar is reconnecting.",
        );
      }
    }
  }

  const key = cacheKey("fair", from, to);
  try {
    return rememberCalendar(key, await fetchFairEconomy());
  } catch {
    const stale = staleCalendar(key);
    if (stale) return stale;
    throw new Error("The economic calendar is reconnecting automatically.");
  }
}

export async function getEconomicCalendar(from: string, to: string) {
  const provider = process.env.TRADING_ECONOMICS_API_KEY?.trim() ? "te" : "fair";
  const key = cacheKey(provider, from, to);
  const cached = cachedCalendar(key);
  if (cached) return cached;

  const pending = calendarRequests.get(key);
  if (pending) return pending;

  const request = loadEconomicCalendar(from, to).finally(() => {
    calendarRequests.delete(key);
  });
  calendarRequests.set(key, request);
  return request;
}
