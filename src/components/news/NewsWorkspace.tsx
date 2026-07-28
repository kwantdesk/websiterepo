"use client";

import {
  AlarmClock,
  AlertTriangle,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ECONOMIC_CALENDAR_CURRENCIES,
  type EconomicCalendarEvent,
  type EconomicCalendarPayload,
  type EconomicCurrency,
  type EconomicImpact,
} from "@/lib/economicCalendar";

const TIME_ZONE = "Australia/Brisbane";
const ALERTS_STORAGE_KEY = "kwantdesk:economic-calendar-alerts:v1";
const CURRENCIES_STORAGE_KEY = "kwantdesk:economic-calendar-currencies:v1";
const DEFAULT_CURRENCIES: EconomicCurrency[] = ["USD", "EUR", "GBP", "JPY", "AUD"];
const IMPACT_ORDER: Record<EconomicImpact, number> = { High: 3, Medium: 2, Low: 1 };
const CURRENCY_COUNTRY: Record<EconomicCurrency, string> = {
  USD: "United States",
  EUR: "Euro Area",
  GBP: "United Kingdom",
  JPY: "Japan",
  AUD: "Australia",
  CAD: "Canada",
  CHF: "Switzerland",
  NZD: "New Zealand",
  CNY: "China",
};

function dateKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function localDateFromKey(key: string) {
  return new Date(`${key}T12:00:00+10:00`);
}

function shiftDate(key: string, days: number) {
  const date = localDateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function formatDay(key: string) {
  return localDateFromKey(key).toLocaleDateString("en-AU", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-AU", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-AU", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function timeUntil(value: string, now: Date) {
  const delta = new Date(value).getTime() - now.getTime();
  if (delta <= 0) return "released";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function impactClasses(impact: EconomicImpact) {
  if (impact === "High") return "border-danger/25 bg-danger/10 text-danger";
  if (impact === "Medium") return "border-primary/25 bg-primary/10 text-primary";
  return "border-border bg-surface text-muted";
}

function eventRelevance(event: EconomicCalendarEvent) {
  const currency = event.currency;
  const major = event.impact === "High" ? "This is a high-impact release" : event.impact === "Medium" ? "This can create a meaningful volatility window" : "This is normally a lower-volatility release";
  const markets = currency === "USD"
    ? "USD pairs, US index futures, Treasury yields and gold"
    : currency === "EUR"
      ? "EUR pairs, European indices and global bond yields"
      : currency === "JPY"
        ? "JPY pairs, Nikkei futures and global carry trades"
        : currency === "AUD" || currency === "NZD" || currency === "CAD"
          ? `${currency} pairs, commodities and regional risk sentiment`
          : `${currency} pairs and related regional markets`;
  return `${major}. Watch ${markets}; the first response can be a liquidity sweep, so wait for price to accept outside the initial reaction range.`;
}

function CurrencyBadge({ currency }: { currency: EconomicCurrency }) {
  return (
    <span className="inline-flex min-w-[42px] items-center justify-center rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[10px] font-semibold text-foreground">
      {currency}
    </span>
  );
}

function CalendarPopover({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(() => {
    const selectedDate = localDateFromKey(selected);
    return new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1));
  });
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });

  return (
    <>
      <button type="button" aria-label="Close calendar" onClick={onClose} className="fixed inset-0 z-[130] cursor-default" />
      <div className="absolute left-0 top-[calc(100%+8px)] z-[140] w-[304px] rounded-2xl border border-border bg-panel p-3 shadow-[0_24px_80px_rgba(0,0,0,.5)]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <div className="text-[11px] font-semibold">{month.toLocaleDateString("en-AU", { timeZone: "UTC", month: "long", year: "numeric" })}</div>
          <button type="button" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-1">{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((key, index) => key ? (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`flex h-8 items-center justify-center rounded-lg font-mono text-[10px] transition-colors ${
                key === selected
                  ? "bg-primary font-semibold text-background"
                  : key === dateKey(new Date())
                    ? "border border-primary/30 text-primary"
                    : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {Number(key.slice(-2))}
            </button>
          ) : <span key={`empty-${index}`} />)}
        </div>
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="mt-4 text-[13px] font-semibold">Loading the economic calendar</div>
        <div className="mt-1 text-[10px] text-muted">Scheduled releases, forecasts and impact</div>
      </div>
    </div>
  );
}

function EventDetail({ event }: { event: EconomicCalendarEvent }) {
  return (
    <div className="border-t border-border bg-background/35 px-4 py-4 lg:px-5">
      <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">Why traders care</div>
          <p className="mt-2 text-[11px] leading-5 text-foreground">{eventRelevance(event)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[9px] text-muted">{event.category || event.name}</span>
            {event.reference ? <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[9px] text-muted">Reference {event.reference}</span> : null}
            <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[9px] text-muted">{CURRENCY_COUNTRY[event.currency]}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Actual", event.actual || "—"],
            ["Forecast", event.forecast || "—"],
            ["Previous", event.revised || event.previous || "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3">
              <div className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">{label}</div>
              <div className={`mt-2 font-mono text-[13px] font-semibold ${label === "Actual" && event.actual ? "text-primary" : "text-foreground"}`}>{value}</div>
              {event.unit ? <div className="mt-1 text-[8px] text-muted">{event.unit}</div> : null}
            </div>
          ))}
          <div className="col-span-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[9px] text-muted">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{event.source || "Economic calendar source"}</span>
            {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-primary">Official source <ExternalLink className="h-3 w-3" /></a> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewsWorkspace() {
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [selectedCurrencies, setSelectedCurrencies] = useState<EconomicCurrency[]>(DEFAULT_CURRENCIES);
  const [selectedImpacts, setSelectedImpacts] = useState<EconomicImpact[]>(["High", "Medium", "Low"]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [payload, setPayload] = useState<EconomicCalendarPayload | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const alertTimersRef = useRef<number[]>([]);

  useEffect(() => {
    try {
      const currencies = JSON.parse(window.localStorage.getItem(CURRENCIES_STORAGE_KEY) ?? "null") as EconomicCurrency[] | null;
      if (Array.isArray(currencies)) {
        setSelectedCurrencies(currencies.filter((currency) => ECONOMIC_CALENDAR_CURRENCIES.includes(currency)));
      }
      const savedAlerts = JSON.parse(window.localStorage.getItem(ALERTS_STORAGE_KEY) ?? "[]") as string[];
      if (Array.isArray(savedAlerts)) setAlerts(savedAlerts.filter((id) => typeof id === "string"));
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadCalendar = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const from = shiftDate(selectedDate, -1);
      const to = shiftDate(selectedDate, 1);
      const response = await fetch(`/api/economic-calendar?from=${from}&to=${to}`, { cache: "no-store" });
      const next = await response.json() as EconomicCalendarPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Economic calendar could not be loaded.");
      setPayload(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Economic calendar could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCalendar(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCalendar]);

  useEffect(() => {
    if (!payload) return;
    const timer = window.setInterval(() => void loadCalendar(true), payload.refreshAfterMs);
    return () => window.clearInterval(timer);
  }, [loadCalendar, payload]);

  useEffect(() => {
    alertTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    alertTimersRef.current = [];
    if (!payload || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const event of payload.events) {
      if (!alerts.includes(event.id)) continue;
      const delay = new Date(event.date).getTime() - Date.now() - 15 * 60_000;
      if (delay <= 0 || delay > 2_147_000_000) continue;
      const timer = window.setTimeout(() => {
        new Notification(`${event.currency} · ${event.name}`, {
          body: `${event.impact} impact in 15 minutes · ${formatTime(event.date)} AEST`,
          tag: event.id,
        });
      }, delay);
      alertTimersRef.current.push(timer);
    }
    return () => {
      alertTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      alertTimersRef.current = [];
    };
  }, [alerts, payload]);

  const filteredEvents = useMemo(() => {
    if (!payload) return [];
    return payload.events
      .filter((event) => dateKey(event.date) === selectedDate)
      .filter((event) => selectedCurrencies.includes(event.currency))
      .filter((event) => selectedImpacts.includes(event.impact))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payload, selectedCurrencies, selectedDate, selectedImpacts]);

  const allDayEvents = useMemo(
    () => payload?.events.filter((event) => dateKey(event.date) === selectedDate) ?? [],
    [payload, selectedDate],
  );
  const nextEvent = filteredEvents.find((event) => new Date(event.date).getTime() > clock.getTime()) ?? null;
  const highImpactCount = filteredEvents.filter((event) => event.impact === "High").length;
  const isToday = selectedDate === dateKey(clock);

  const toggleCurrency = (currency: EconomicCurrency) => {
    setSelectedCurrencies((current) => {
      const next = current.includes(currency)
        ? current.filter((item) => item !== currency)
        : [...current, currency];
      window.localStorage.setItem(CURRENCIES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleImpact = (impact: EconomicImpact) => {
    setSelectedImpacts((current) => current.includes(impact) ? current.filter((item) => item !== impact) : [...current, impact]);
  };

  const toggleAlert = async (event: EconomicCalendarEvent) => {
    if (new Date(event.date).getTime() <= Date.now()) return;
    if (!alerts.includes(event.id) && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setAlerts((current) => {
      const next = current.includes(event.id) ? current.filter((id) => id !== event.id) : [...current, event.id];
      window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  if (loading && !payload) return <LoadingState />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-[58px] shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-3 py-2 lg:px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Globe2 className="h-[17px] w-[17px]" /></span>
        <div className="mr-auto">
          <div className="text-[12px] font-semibold">Economic Calendar</div>
          <div className="text-[9px] text-muted">Scheduled catalysts, forecasts and event risk</div>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 md:flex">
          <Clock3 className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] font-semibold">{formatClock(clock)}</span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">AEST</span>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] ${payload?.partial ? "border-danger/20 bg-danger/10 text-danger" : "border-border bg-surface text-muted"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${payload ? "bg-primary" : "bg-muted"}`} />
          {payload?.provider ?? "Calendar feed"}
        </div>
        <button type="button" onClick={() => void loadCalendar(true)} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-50" aria-label="Refresh calendar">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="shrink-0 border-b border-border bg-panel px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="mr-1 flex shrink-0 items-center gap-1.5 px-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted"><Filter className="h-3 w-3" /> Currencies</span>
          {ECONOMIC_CALENDAR_CURRENCIES.map((currency) => {
            const active = selectedCurrencies.includes(currency);
            return (
              <button
                key={currency}
                type="button"
                onClick={() => toggleCurrency(currency)}
                aria-pressed={active}
                className={`flex h-8 shrink-0 items-center gap-2 rounded-xl border px-3 font-mono text-[10px] font-semibold transition-all ${
                  active ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent bg-surface/50 text-muted hover:border-border hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted/40"}`} />
                {currency}
              </button>
            );
          })}
          <button type="button" onClick={() => {
            const next = selectedCurrencies.length === ECONOMIC_CALENDAR_CURRENCIES.length ? [] : [...ECONOMIC_CALENDAR_CURRENCIES];
            setSelectedCurrencies(next);
            window.localStorage.setItem(CURRENCIES_STORAGE_KEY, JSON.stringify(next));
          }} className="ml-1 h-8 shrink-0 rounded-xl px-2.5 text-[9px] font-semibold text-muted hover:text-foreground">
            {selectedCurrencies.length === ECONOMIC_CALENDAR_CURRENCIES.length ? "Clear" : "All"}
          </button>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {error ? <div className="border-b border-danger/20 bg-danger/10 px-4 py-2 text-center text-[10px] text-danger">{error}{payload ? " · Showing the last good calendar." : ""}</div> : null}
        <div className="mx-auto max-w-[1680px] p-3 lg:p-4 xl:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel text-muted hover:text-foreground" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
            <div className="relative">
              <button type="button" onClick={() => setCalendarOpen(!calendarOpen)} className={`flex h-9 min-w-[215px] items-center gap-2 rounded-xl border bg-panel px-3 text-left text-[10px] font-semibold ${calendarOpen ? "border-primary/30 text-primary" : "border-border text-foreground"}`}>
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1">{formatDay(selectedDate)}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
              </button>
              {calendarOpen ? <CalendarPopover selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} onClose={() => setCalendarOpen(false)} /> : null}
            </div>
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel text-muted hover:text-foreground" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
            {!isToday ? <button type="button" onClick={() => setSelectedDate(dateKey(new Date()))} className="h-9 rounded-xl border border-primary/20 bg-primary/10 px-3 text-[9px] font-semibold text-primary">Today</button> : null}
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-panel p-1">
              {(["High", "Medium", "Low"] as const).map((impact) => {
                const active = selectedImpacts.includes(impact);
                return (
                  <button key={impact} type="button" onClick={() => toggleImpact(impact)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[9px] font-semibold ${active ? impactClasses(impact) : "text-muted opacity-55"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${impact === "High" ? "bg-danger" : impact === "Medium" ? "bg-primary" : "bg-muted"}`} />
                    {impact}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-panel p-4">
              <div className="text-[8px] font-semibold uppercase tracking-[0.15em] text-muted">Events in view</div>
              <div className="mt-2 font-mono text-[22px] font-semibold">{filteredEvents.length}</div>
              <div className="mt-1 text-[9px] text-muted">{allDayEvents.length} total before filters</div>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-4">
              <div className="text-[8px] font-semibold uppercase tracking-[0.15em] text-muted">High impact</div>
              <div className={`mt-2 font-mono text-[22px] font-semibold ${highImpactCount ? "text-danger" : "text-foreground"}`}>{highImpactCount}</div>
              <div className="mt-1 text-[9px] text-muted">{highImpactCount ? "Protect the release windows" : "No major release in this view"}</div>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.15em] text-muted"><AlarmClock className="h-3 w-3 text-primary" /> Next catalyst</div>
              {nextEvent ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CurrencyBadge currency={nextEvent.currency} />
                  <span className="text-[12px] font-semibold">{nextEvent.name}</span>
                  <span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${impactClasses(nextEvent.impact)}`}>{nextEvent.impact}</span>
                  <span className="ml-auto font-mono text-[10px] text-primary">{timeUntil(nextEvent.date, clock)}</span>
                </div>
              ) : <div className="mt-2 text-[11px] text-muted">No later event matches the active filters.</div>}
            </div>
          </div>

          {payload && !payload.coverage.longRange && (selectedDate < payload.coverage.from || selectedDate > payload.coverage.to) ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.055] px-4 py-3 text-[10px] leading-5 text-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <span>This backup feed covers {payload.coverage.from} to {payload.coverage.to}. Add the long-range calendar key to populate dates beyond the current published week.</span>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-border bg-panel">
            <div className="grid grid-cols-[88px_72px_72px_minmax(220px,1fr)_64px_78px] gap-3 border-b border-border bg-surface/35 px-4 py-2.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted max-lg:hidden">
              <span>Date</span><span>Time</span><span>Currency</span><span>Impact · Event</span><span className="text-center">Alert</span><span className="text-right">Details</span>
            </div>
            {filteredEvents.length ? (
              filteredEvents.map((event, index) => {
                const expanded = expandedEvent === event.id;
                const alertActive = alerts.includes(event.id);
                const upcoming = new Date(event.date).getTime() > clock.getTime();
                const insertNow = isToday
                  && upcoming
                  && (index === 0 || new Date(filteredEvents[index - 1].date).getTime() <= clock.getTime());
                return (
                  <div key={event.id}>
                    {insertNow ? (
                      <div className="relative flex items-center gap-2 px-4 py-1.5">
                        <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-primary">Now {formatClock(clock).slice(0, 5)}</span>
                        <span className="h-px flex-1 bg-primary/35" />
                      </div>
                    ) : null}
                    <div className={`grid items-center gap-3 border-t border-border/70 px-4 py-3 transition-colors lg:grid-cols-[88px_72px_72px_minmax(220px,1fr)_64px_78px] ${expanded ? "bg-primary/[0.035]" : "hover:bg-surface/30"} ${event.status === "released" ? "opacity-65" : ""}`}>
                      <div className="font-mono text-[9px] text-muted">{formatShortDate(event.date)}</div>
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-foreground">{formatTime(event.date)}</div>
                        <div className={`mt-0.5 text-[8px] ${upcoming ? "text-primary" : "text-muted"}`}>{timeUntil(event.date, clock)}</div>
                      </div>
                      <div><CurrencyBadge currency={event.currency} /></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] ${impactClasses(event.impact)}`}>{event.impact}</span>
                          <span className="truncate text-[11px] font-semibold text-foreground lg:text-[12px]">{event.name}</span>
                        </div>
                        <div className="mt-1 flex gap-3 font-mono text-[8px] text-muted">
                          {event.forecast ? <span>F {event.forecast}</span> : null}
                          {event.previous ? <span>P {event.previous}</span> : null}
                          {event.actual ? <span className="text-primary">A {event.actual}</span> : null}
                        </div>
                      </div>
                      <div className="flex justify-start lg:justify-center">
                        <button
                          type="button"
                          onClick={() => void toggleAlert(event)}
                          disabled={!upcoming}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 ${alertActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}
                          aria-label={`${alertActive ? "Remove" : "Add"} alert for ${event.name}`}
                          title={upcoming ? "Alert 15 minutes before" : "Event already released"}
                        >
                          {alertActive ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <button type="button" onClick={() => setExpandedEvent(expanded ? null : event.id)} className={`flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[9px] font-semibold ${expanded ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}>
                        {expanded ? "Close" : "Detailed"} <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {expanded ? <EventDetail event={event} /> : null}
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                <CircleAlert className="h-6 w-6 text-muted" />
                <h3 className="mt-3 text-[12px] font-semibold">No events match this view</h3>
                <p className="mt-1 max-w-sm text-[10px] leading-5 text-muted">
                  Select more currencies or impact levels, or choose another date from the calendar.
                </p>
              </div>
            )}
          </section>

          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-panel px-4 py-3 text-[9px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>{payload?.note ?? "Economic calendar loading."}</span>
            <span className="shrink-0 font-mono">{payload ? `Updated ${formatTime(payload.fetchedAt)} AEST` : "Connecting"}</span>
          </div>
          <div className="mt-3 flex items-start gap-2 px-2 py-2 text-[9px] leading-5 text-muted">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Event times and forecasts can change. Alerts are device-local and fire 15 minutes before an event while notifications are permitted. Always verify the final schedule before trading a release.
          </div>
        </div>
      </main>
    </div>
  );
}
