"use client";

import {
  AlarmClock,
  AlertTriangle,
  Bell,
  BellRing,
  BrainCircuit,
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
  Radio,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import MacroWorkspace, { type MacroNewsView } from "@/components/news/MacroWorkspace";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import WorkspaceSubnav from "@/components/ui/WorkspaceSubnav";
import {
  ECONOMIC_CALENDAR_CURRENCIES,
  type EconomicCalendarEvent,
  type EconomicCalendarPayload,
  type EconomicCurrency,
  type EconomicImpact,
} from "@/lib/economicCalendar";
import {
  browserTimeZone,
  compactTimeZoneLabel,
  normalizeTimeZone,
} from "@/lib/timeZones";
import type { FriendSummary, FriendsPayload } from "@/lib/friends";

const ALERTS_STORAGE_KEY = "kwantdesk:economic-calendar-alerts:v1";
const CURRENCIES_STORAGE_KEY = "kwantdesk:economic-calendar-currencies:v1";
const CALENDAR_CACHE_STORAGE_KEY = "kwantdesk:economic-calendar-cache:v2";
const TIME_ZONE_STORAGE_KEY = "kwantdesk:economic-calendar-timezone:v1";
const CALENDAR_HISTORY_DAYS = 7;
const CALENDAR_FORWARD_DAYS = 90;
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

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Device-local preferences and caches must never be able to crash NEWS.
  }
}

function sanitizeCalendarEvent(value: unknown): EconomicCalendarEvent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<EconomicCalendarEvent>;
  const timestamp = typeof candidate.date === "string" ? Date.parse(candidate.date) : Number.NaN;
  const currency = candidate.currency;
  const impact = candidate.impact;
  if (
    typeof candidate.id !== "string"
    || !candidate.id
    || !Number.isFinite(timestamp)
    || !currency
    || !ECONOMIC_CALENDAR_CURRENCIES.includes(currency)
    || (impact !== "High" && impact !== "Medium" && impact !== "Low")
    || typeof candidate.name !== "string"
    || !candidate.name
  ) return null;

  const text = (field: keyof EconomicCalendarEvent) =>
    typeof candidate[field] === "string" ? candidate[field] as string : "";

  return {
    id: candidate.id,
    date: new Date(timestamp).toISOString(),
    currency,
    country: text("country") || CURRENCY_COUNTRY[currency],
    impact,
    name: candidate.name,
    category: text("category"),
    forecast: text("forecast"),
    previous: text("previous"),
    actual: text("actual"),
    revised: text("revised"),
    reference: text("reference"),
    source: text("source"),
    sourceUrl: text("sourceUrl"),
    unit: text("unit"),
    status: candidate.status === "released" ? "released" : "scheduled",
  };
}

function sanitizeCalendarPayload(value: unknown): EconomicCalendarPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<EconomicCalendarPayload>;
  if (
    !Array.isArray(candidate.events)
    || typeof candidate.fetchedAt !== "string"
    || !Number.isFinite(Date.parse(candidate.fetchedAt))
    || typeof candidate.coverage?.from !== "string"
    || typeof candidate.coverage?.to !== "string"
  ) return null;

  const events = candidate.events
    .map(sanitizeCalendarEvent)
    .filter((event): event is EconomicCalendarEvent => event !== null);

  return {
    events,
    provider: candidate.provider === "Trading Economics"
      ? "Trading Economics"
      : candidate.provider === "TradingView"
        ? "TradingView"
        : "Fair Economy",
    fetchedAt: new Date(candidate.fetchedAt).toISOString(),
    refreshAfterMs: Number.isFinite(candidate.refreshAfterMs)
      ? Math.max(60_000, Number(candidate.refreshAfterMs))
      : 60_000,
    coverage: {
      from: candidate.coverage.from,
      to: candidate.coverage.to,
      longRange: candidate.coverage.longRange === true,
    },
    partial: candidate.partial === true,
    note: typeof candidate.note === "string" ? candidate.note : "Economic calendar loaded.",
  };
}

function dateKey(date: Date | string, timeZone: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(value.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function localDateFromKey(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

function shiftDate(key: string, days: number) {
  const date = localDateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDay(key: string) {
  return localDateFromKey(key).toLocaleDateString("en-AU", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: string, timeZone: string) {
  return new Date(value).toLocaleDateString("en-AU", {
    timeZone: normalizeTimeZone(timeZone),
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString("en-AU", {
    timeZone: normalizeTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatClock(date: Date, timeZone: string) {
  return date.toLocaleTimeString("en-AU", {
    timeZone: normalizeTimeZone(timeZone),
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

/*
 * Impact severity does NOT follow the theme.
 *
 * It was drawn from `danger` and `primary`, which are whatever the palette
 * chose - and ten of the forty-four have a danger that is not red at all, so a
 * high-impact release rendered blue on Kwant Desk and cyan on Solar Flare. Red
 * for high and orange for medium is a convention every economic calendar
 * shares, and a trader reads it before the word next to it; a theme is not
 * entitled to overrule that.
 *
 * Low impact keeps the theme's muted tone. There is no convention to break -
 * it means "no strong colour", which is exactly what muted is for.
 */
const IMPACT_HIGH = "#EF4444";
const IMPACT_MEDIUM = "#F59E0B";

function impactClasses(impact: EconomicImpact) {
  if (impact === "High") return `border-[${IMPACT_HIGH}]/30 bg-[${IMPACT_HIGH}]/10 text-[${IMPACT_HIGH}]`;
  if (impact === "Medium") return `border-[${IMPACT_MEDIUM}]/30 bg-[${IMPACT_MEDIUM}]/10 text-[${IMPACT_MEDIUM}]`;
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
  timeZone,
  onSelect,
  onClose,
}: {
  selected: string;
  timeZone: string;
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
                  ? "bg-primary font-semibold text-on-primary"
                  : key === dateKey(new Date(), timeZone)
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
    <KwantLoader
      page
      icon={CalendarDays}
      title="Loading the economic calendar"
      detail="Scheduled releases, forecasts and impact"
    />
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

function EconomicCalendarWorkspace() {
  const [timeZone, setTimeZone] = useState(() => {
    if (typeof window === "undefined") return "UTC";
    return normalizeTimeZone(
      readLocalStorage(TIME_ZONE_STORAGE_KEY) ?? browserTimeZone(),
    );
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const initialTimeZone = typeof window === "undefined"
      ? "UTC"
      : normalizeTimeZone(
          readLocalStorage(TIME_ZONE_STORAGE_KEY) ?? browserTimeZone(),
        );
    return dateKey(new Date(), initialTimeZone);
  });
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
  const [shareEvent, setShareEvent] = useState<EconomicCalendarEvent | null>(null);
  const [shareFriends, setShareFriends] = useState<FriendSummary[]>([]);
  const [shareFriendIds, setShareFriendIds] = useState<string[]>([]);
  const [shareQuery, setShareQuery] = useState("");
  const [shareState, setShareState] = useState<"idle" | "loading" | "sending" | "sent" | "error">("idle");
  const [shareError, setShareError] = useState("");
  const shareFriendsLoadedRef = useRef(false);
  const selectedDateTouchedRef = useRef(false);
  const alertTimersRef = useRef<number[]>([]);
  const payloadRef = useRef<EconomicCalendarPayload | null>(null);

  useEffect(() => {
    try {
      const currencies = JSON.parse(readLocalStorage(CURRENCIES_STORAGE_KEY) ?? "null") as EconomicCurrency[] | null;
      if (Array.isArray(currencies)) {
        setSelectedCurrencies(currencies.filter((currency) => ECONOMIC_CALENDAR_CURRENCIES.includes(currency)));
      }
      const savedAlerts = JSON.parse(readLocalStorage(ALERTS_STORAGE_KEY) ?? "[]") as string[];
      if (Array.isArray(savedAlerts)) setAlerts(savedAlerts.filter((id) => typeof id === "string"));
      const savedCalendar = sanitizeCalendarPayload(
        JSON.parse(readLocalStorage(CALENDAR_CACHE_STORAGE_KEY) ?? "null"),
      );
      if (savedCalendar) {
        payloadRef.current = savedCalendar;
        setPayload(savedCalendar);
        setLoading(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    writeLocalStorage(TIME_ZONE_STORAGE_KEY, timeZone);
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [timeZone]);

  const loadCalendar = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else if (!payloadRef.current) setLoading(true);
    try {
      const today = dateKey(new Date(), timeZone);
      const from = shiftDate(today, -CALENDAR_HISTORY_DAYS);
      const to = shiftDate(today, CALENDAR_FORWARD_DAYS);
      const response = await fetch(`/api/economic-calendar?from=${from}&to=${to}`, { cache: "no-store" });
      const responsePayload = await response.json() as EconomicCalendarPayload & { error?: string };
      if (!response.ok) throw new Error(responsePayload.error || "Economic calendar could not be loaded.");
      const next = sanitizeCalendarPayload(responsePayload);
      if (!next) throw new Error("The economic calendar returned malformed data.");
      payloadRef.current = next;
      setPayload(next);
      writeLocalStorage(CALENDAR_CACHE_STORAGE_KEY, JSON.stringify(next));
      setError(null);
    } catch {
      setError(payloadRef.current ? null : "The calendar is reconnecting. It will retry automatically.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeZone]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCalendar(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCalendar]);

  useEffect(() => {
    const refreshAfterMs = Math.max(60_000, payload?.refreshAfterMs ?? 60_000);
    const timer = window.setInterval(() => void loadCalendar(), refreshAfterMs);
    return () => window.clearInterval(timer);
  }, [loadCalendar, payload]);

  useEffect(() => {
    if (!payload || selectedDateTouchedRef.current) return;
    const today = dateKey(new Date(), timeZone);
    if (selectedDate !== today) return;
    const now = Date.now();
    const hasUpcomingEventsToday = payload.events.some((event) => (
      dateKey(event.date, timeZone) === today && Date.parse(event.date) >= now
    ));
    if (hasUpcomingEventsToday) return;
    const next = payload.events.find((event) => Date.parse(event.date) >= now);
    if (next) setSelectedDate(dateKey(next.date, timeZone));
  }, [payload, selectedDate, timeZone]);

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
          body: `${event.impact} impact in 15 minutes · ${formatTime(event.date, timeZone)} ${compactTimeZoneLabel(timeZone)}`,
          tag: event.id,
        });
      }, delay);
      alertTimersRef.current.push(timer);
    }
    return () => {
      alertTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      alertTimersRef.current = [];
    };
  }, [alerts, payload, timeZone]);

  const filteredEvents = useMemo(() => {
    if (!payload) return [];
    return payload.events
      .filter((event) => dateKey(event.date, timeZone) === selectedDate)
      .filter((event) => selectedCurrencies.includes(event.currency))
      .filter((event) => selectedImpacts.includes(event.impact))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payload, selectedCurrencies, selectedDate, selectedImpacts, timeZone]);

  const allDayEvents = useMemo(
    () => payload?.events.filter((event) => dateKey(event.date, timeZone) === selectedDate) ?? [],
    [payload, selectedDate, timeZone],
  );
  const nextEvent = filteredEvents.find((event) => new Date(event.date).getTime() > clock.getTime()) ?? null;
  const nextAvailableDate = useMemo(() => {
    if (!payload) return null;
    const next = payload.events.find((event) => dateKey(event.date, timeZone) > selectedDate);
    return next ? dateKey(next.date, timeZone) : null;
  }, [payload, selectedDate, timeZone]);
  const highImpactCount = filteredEvents.filter((event) => event.impact === "High").length;
  const isToday = selectedDate === dateKey(clock, timeZone);

  const changeTimeZone = (nextTimeZone: string) => {
    const normalized = normalizeTimeZone(nextTimeZone);
    selectedDateTouchedRef.current = false;
    setTimeZone(normalized);
    setSelectedDate(dateKey(clock, normalized));
  };

  const selectDate = (date: string) => {
    selectedDateTouchedRef.current = true;
    setSelectedDate(date);
  };

  const toggleCurrency = (currency: EconomicCurrency) => {
    setSelectedCurrencies((current) => {
      const next = current.includes(currency)
        ? current.filter((item) => item !== currency)
        : [...current, currency];
      writeLocalStorage(CURRENCIES_STORAGE_KEY, JSON.stringify(next));
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
      writeLocalStorage(ALERTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadShareFriends = useCallback(async (showLoading = false) => {
    if (shareFriendsLoadedRef.current) return;
    if (showLoading) setShareState("loading");
    try {
      const response = await fetch("/api/friends", { cache: "no-store" });
      const body = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok || !body.cloud) throw new Error(body.error || "Friends could not be loaded.");
      setShareFriends(body.friends ?? []);
      shareFriendsLoadedRef.current = true;
      setShareState("idle");
      setShareError("");
    } catch (reason) {
      setShareState("error");
      setShareError(reason instanceof Error ? reason.message : "Friends could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadShareFriends(false), 250);
    return () => window.clearTimeout(timer);
  }, [loadShareFriends]);

  const openShare = (event: EconomicCalendarEvent) => {
    setShareEvent(event);
    setShareFriendIds([]);
    setShareQuery("");
    setShareError("");
    setShareState(shareFriendsLoadedRef.current ? "idle" : "loading");
    void loadShareFriends(true);
  };

  const sendCalendarEvent = async () => {
    if (!shareEvent || !shareFriendIds.length) return;
    setShareState("sending");
    setShareError("");
    const eventUrl = `${window.location.origin}/news?event=${encodeURIComponent(shareEvent.id)}`;
    const message = [
      `ECONOMIC CALENDAR · ${shareEvent.currency} · ${shareEvent.impact.toUpperCase()}`,
      shareEvent.name,
      `${formatShortDate(shareEvent.date, timeZone)} · ${formatTime(shareEvent.date, timeZone)} ${compactTimeZoneLabel(timeZone)}`,
      [shareEvent.forecast && `Forecast ${shareEvent.forecast}`, shareEvent.previous && `Previous ${shareEvent.previous}`, shareEvent.actual && `Actual ${shareEvent.actual}`].filter(Boolean).join(" · "),
      eventUrl,
    ].filter(Boolean).join("\n");
    const results = await Promise.allSettled(shareFriendIds.map(async (targetUserId) => {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          targetUserId,
          body: message,
          clientMessageId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `calendar-${Date.now()}-${targetUserId}`,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "The calendar event could not be sent.");
    }));
    const sent = results.filter((result) => result.status === "fulfilled").length;
    if (!sent) {
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      setShareState("error");
      setShareError(failed?.reason instanceof Error ? failed.reason.message : "The calendar event could not be sent.");
      return;
    }
    setShareState("sent");
    window.setTimeout(() => setShareEvent(null), 650);
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
          <span className="font-mono text-[10px] font-semibold">{formatClock(clock, timeZone)}</span>
        </div>
        <TimeZoneSelect
          value={timeZone}
          onChange={changeTimeZone}
          menuLabel="Economic calendar timezone"
          compact
        />
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[9px] text-muted">
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
            writeLocalStorage(CURRENCIES_STORAGE_KEY, JSON.stringify(next));
          }} className="ml-1 h-8 shrink-0 rounded-xl px-2.5 text-[9px] font-semibold text-muted hover:text-foreground">
            {selectedCurrencies.length === ECONOMIC_CALENDAR_CURRENCIES.length ? "Clear" : "All"}
          </button>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {error && !payload ? <div className="border-b border-danger/20 bg-danger/10 px-4 py-2 text-center text-[10px] text-danger">{error}</div> : null}
        <div className="mx-auto max-w-[1680px] p-3 lg:p-4 xl:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => selectDate(shiftDate(selectedDate, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel text-muted hover:text-foreground" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
            <div className="relative">
              <button type="button" onClick={() => setCalendarOpen(!calendarOpen)} className={`flex h-9 min-w-[215px] items-center gap-2 rounded-xl border bg-panel px-3 text-left text-[10px] font-semibold ${calendarOpen ? "border-primary/30 text-primary" : "border-border text-foreground"}`}>
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1">{formatDay(selectedDate)}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
              </button>
              {calendarOpen ? <CalendarPopover selected={selectedDate} timeZone={timeZone} onSelect={(date) => { selectDate(date); setCalendarOpen(false); }} onClose={() => setCalendarOpen(false)} /> : null}
            </div>
            <button type="button" onClick={() => selectDate(shiftDate(selectedDate, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel text-muted hover:text-foreground" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
            {!isToday ? <button type="button" onClick={() => selectDate(dateKey(new Date(), timeZone))} className="h-9 rounded-xl border border-primary/20 bg-primary/10 px-3 text-[9px] font-semibold text-primary">Today</button> : null}
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-panel p-1">
              {(["High", "Medium", "Low"] as const).map((impact) => {
                const active = selectedImpacts.includes(impact);
                return (
                  <button key={impact} type="button" onClick={() => toggleImpact(impact)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[9px] font-semibold ${active ? impactClasses(impact) : "text-muted opacity-55"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${impact === "High" ? `bg-[${IMPACT_HIGH}]` : impact === "Medium" ? `bg-[${IMPACT_MEDIUM}]` : "bg-muted"}`} />
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
              <div className={`mt-2 font-mono text-[22px] font-semibold ${highImpactCount ? `text-[${IMPACT_HIGH}]` : "text-foreground"}`}>{highImpactCount}</div>
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
              <span>The current-week source covers {payload.coverage.from} to {payload.coverage.to}. The forward source is reconnecting automatically.</span>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-border bg-panel">
            <div className="grid grid-cols-[88px_72px_72px_minmax(220px,1fr)_86px_78px] gap-3 border-b border-border bg-surface/35 px-4 py-2.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted max-lg:hidden">
              <span>Date</span><span>Time</span><span>Currency</span><span>Impact · Event</span><span className="text-center">Alert · Send</span><span className="text-right">Details</span>
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
                        <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-primary">Now {formatClock(clock, timeZone).slice(0, 5)}</span>
                        <span className="h-px flex-1 bg-primary/35" />
                      </div>
                    ) : null}
                    <div className={`grid items-center gap-3 border-t border-border/70 px-4 py-3 transition-colors lg:grid-cols-[88px_72px_72px_minmax(220px,1fr)_86px_78px] ${expanded ? "bg-primary/[0.035]" : "hover:bg-surface/30"} ${event.status === "released" ? "opacity-65" : ""}`}>
                      <div className="font-mono text-[9px] text-muted">{formatShortDate(event.date, timeZone)}</div>
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-foreground">{formatTime(event.date, timeZone)}</div>
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
                      <div className="flex justify-start gap-1.5 lg:justify-center">
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
                        <button
                          type="button"
                          onClick={() => openShare(event)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                          aria-label={`Send ${event.name} to friends`}
                          title="Send to friends"
                        >
                          <Send className="h-3.5 w-3.5" />
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
                {nextAvailableDate ? (
                  <button
                    type="button"
                    onClick={() => selectDate(nextAvailableDate)}
                    className="mt-4 h-9 rounded-xl border border-primary/25 bg-primary/10 px-4 text-[9px] font-semibold text-primary transition-colors hover:bg-primary/15"
                  >
                    Open next scheduled day · {formatDay(nextAvailableDate)}
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-panel px-4 py-3 text-[9px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>{payload?.note ?? "Economic calendar loading."}</span>
            <span className="shrink-0 font-mono">
              {payload ? `Updated ${formatTime(payload.fetchedAt, timeZone)} ${compactTimeZoneLabel(timeZone)} · Coverage ${payload.coverage.from} to ${payload.coverage.to}` : "Connecting"}
            </span>
          </div>
          <div className="mt-3 flex items-start gap-2 px-2 py-2 text-[9px] leading-5 text-muted">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Event times and forecasts can change. Alerts are device-local and fire 15 minutes before an event while notifications are permitted. Always verify the final schedule before trading a release.
          </div>
        </div>
      </main>
      {shareEvent ? (() => {
        const query = shareQuery.trim().toLowerCase();
        const visibleFriends = shareFriends.filter((friend) => !query || `${friend.displayName} ${friend.handle}`.toLowerCase().includes(query));
        return (
          <div className="fixed inset-0 z-[1180] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget && shareState !== "sending") setShareEvent(null); }}>
            <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl">
              <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Send className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><h2 className="text-[14px] font-semibold">Send calendar event</h2><p className="mt-1 truncate text-[8px] text-muted">{shareEvent.currency} · {shareEvent.name}</p></div>
                <button type="button" onClick={() => setShareEvent(null)} disabled={shareState === "sending"} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40" aria-label="Close"><X className="h-4 w-4" /></button>
              </header>
              <div className="p-5">
                <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.045] p-3">
                  <div className="flex items-center gap-2"><span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase ${impactClasses(shareEvent.impact)}`}>{shareEvent.impact}</span><strong className="truncate text-[10px]">{shareEvent.name}</strong></div>
                  <p className="mt-2 font-mono text-[8px] text-muted">{formatShortDate(shareEvent.date, timeZone)} · {formatTime(shareEvent.date, timeZone)} {compactTimeZoneLabel(timeZone)}</p>
                </div>
                <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary/40"><Search className="h-3.5 w-3.5 text-muted" /><input value={shareQuery} onChange={(event) => setShareQuery(event.target.value)} placeholder="Search friends" className="min-w-0 flex-1 bg-transparent text-[9px] outline-none placeholder:text-muted/55" /></label>
                <div className="mt-3 grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {shareState === "loading" ? <div className="col-span-full flex min-h-40 items-center justify-center gap-2 text-[9px] text-muted"><Loader2 className="h-4 w-4 animate-spin text-primary" />Loading friends</div> : null}
                  {shareState !== "loading" && visibleFriends.map((friend) => {
                    const selected = shareFriendIds.includes(friend.userId);
                    return <button key={friend.userId} type="button" onClick={() => setShareFriendIds((current) => selected ? current.filter((id) => id !== friend.userId) : [...current, friend.userId])} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${selected ? "border-primary/45 bg-primary/[0.075]" : "border-border bg-background/35 hover:border-primary/25"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-[9px] font-semibold text-primary">{friend.displayName.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold">{friend.displayName}</span><span className="mt-0.5 block truncate text-[7px] text-muted">@{friend.handle}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-on-primary" : "border-border text-transparent"}`}><Check className="h-3 w-3" /></span></button>;
                  })}
                  {shareState !== "loading" && !visibleFriends.length ? <div className="col-span-full flex min-h-32 items-center justify-center text-[9px] text-muted">No friends found.</div> : null}
                </div>
                {shareError ? <p className="mt-3 text-[9px] text-danger">{shareError}</p> : null}
              </div>
              <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                <button type="button" onClick={() => setShareEvent(null)} disabled={shareState === "sending"} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button>
                <button type="button" onClick={() => void sendCalendarEvent()} disabled={!shareFriendIds.length || shareState === "loading" || shareState === "sending" || shareState === "sent"} className="flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-on-primary disabled:opacity-40">{shareState === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shareState === "sent" ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}{shareState === "sending" ? "Sending…" : shareState === "sent" ? "Sent" : `Send${shareFriendIds.length ? ` (${shareFriendIds.length})` : ""}`}</button>
              </footer>
            </section>
          </div>
        );
      })() : null}
    </div>
  );
}

type NewsView = "calendar" | MacroNewsView;

export default function NewsWorkspace() {
  const [view, setView] = useState<NewsView>("calendar");
  const sections: Array<{ id: NewsView; label: string; description: string; icon: typeof CalendarDays }> = [
    { id: "calendar", label: "Economic Calendar", description: "Scheduled catalysts", icon: CalendarDays },
    { id: "macro", label: "Macroeconomics", description: "Causal event maps", icon: BrainCircuit },
    { id: "developments", label: "Live Macro Developments", description: "Policy and geopolitical shocks", icon: Radio },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <WorkspaceSubnav items={sections} value={view} onChange={setView} ariaLabel="News sections" />
      <div className="min-h-0 flex-1">
        {view === "calendar" ? <EconomicCalendarWorkspace /> : <MacroWorkspace view={view} />}
      </div>
    </div>
  );
}
