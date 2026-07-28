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
  provider: "Trading Economics" | "Fair Economy";
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
