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
    cache: "no-store",
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
    refreshAfterMs: 300_000,
    coverage: { from, to, longRange: true },
    partial: false,
    note: "Forward calendar, forecasts and released values supplied by Trading Economics.",
  };
}

async function fetchFairEconomy(): Promise<EconomicCalendarPayload> {
  const response = await fetch(FAIR_ECONOMY_URL, {
    cache: "no-store",
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
    refreshAfterMs: 600_000,
    coverage: { ...coverage, longRange: false },
    partial: false,
    note: "Current-week scheduled events and consensus values. Add a Trading Economics key for long-range dates, actual releases and official-source links.",
  };
}

export async function getEconomicCalendar(from: string, to: string) {
  const apiKey = process.env.TRADING_ECONOMICS_API_KEY?.trim();
  if (apiKey) {
    try {
      return await fetchTradingEconomics(apiKey, from, to);
    } catch {
      const fallback = await fetchFairEconomy();
      return {
        ...fallback,
        partial: true,
        note: "The long-range calendar is temporarily unavailable. Showing the current-week backup feed.",
      };
    }
  }
  return fetchFairEconomy();
}
