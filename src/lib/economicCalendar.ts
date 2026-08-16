export const ECONOMIC_CALENDAR_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
  "CNY",
] as const;

export type EconomicCurrency = (typeof ECONOMIC_CALENDAR_CURRENCIES)[number];
export type EconomicImpact = "High" | "Medium" | "Low";

export type EconomicCalendarEvent = {
  id: string;
  date: string;
  currency: EconomicCurrency;
  country: string;
  impact: EconomicImpact;
  name: string;
  category: string;
  forecast: string;
  previous: string;
  actual: string;
  revised: string;
  reference: string;
  source: string;
  sourceUrl: string;
  unit: string;
  status: "scheduled" | "released";
};

export type EconomicCalendarPayload = {
  events: EconomicCalendarEvent[];
  provider: "Trading Economics" | "TradingView" | "Fair Economy";
  fetchedAt: string;
  refreshAfterMs: number;
  coverage: {
    from: string;
    to: string;
    longRange: boolean;
  };
  partial: boolean;
  note: string;
};

export function economicCalendarCoverage(
  events: EconomicCalendarEvent[],
  fallbackFrom: string,
  fallbackTo = fallbackFrom,
) {
  const dates = events
    .map((event) => event.date.slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  return {
    from: dates[0] ?? fallbackFrom,
    to: dates.at(-1) ?? fallbackTo,
  };
}

export function hasUpcomingEconomicEvents(
  events: EconomicCalendarEvent[],
  now: Date | number = Date.now(),
) {
  const timestamp = now instanceof Date ? now.getTime() : now;
  return events.some((event) => Date.parse(event.date) >= timestamp);
}
