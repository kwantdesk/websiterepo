"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import { calendarDateState, calendarMonthCells, dateLabel, exchangeDate, MONTHS } from "@/lib/optionsExpirationCalendar";
import { ALL_FUTURES_CALENDAR_SOURCE, FUTURES_CALENDAR_SOURCE, FUTURES_CALENDAR_YEARS, FUTURES_PRODUCTS, FUTURES_VERIFIED_ON, futuresCalendarEvents, type FuturesCalendarEvent, type FuturesProduct } from "@/lib/futuresExpirationCalendar";

const eventLabel = (event: FuturesCalendarEvent) => `${event.family === "us" ? "U.S. equity indexes" : "Nikkei / TOPIX"} · ${event.contract} · ${event.kind === "roll" ? "Customary roll" : "Expiration"}`;
const eventColor = (kind: FuturesCalendarEvent["kind"]) => kind === "roll" ? "bg-warning" : "bg-primary";

export default function FuturesExpirationCalendar() {
  const [today,setToday] = useState(exchangeDate);
  const [year,setYear] = useState(() => FUTURES_CALENDAR_YEARS.find(value => value === Number(exchangeDate().slice(0,4))) ?? FUTURES_CALENDAR_YEARS[0]);
  const [month,setMonth] = useState(() => Number(exchangeDate().slice(5,7))-1);
  const [view,setView] = useState<"year" | "month" | "agenda">("year");
  const [product,setProduct] = useState<FuturesProduct>("All covered products");
  const [kind,setKind] = useState<"all" | FuturesCalendarEvent["kind"]>("all");
  const [selected,setSelected] = useState(exchangeDate);
  const [upcoming,setUpcoming] = useState(true);
  useEffect(() => {
    const update = () => { if (!document.hidden) setToday(exchangeDate()); };
    const timer = setInterval(update,60_000);
    document.addEventListener("visibilitychange",update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange",update); };
  },[]);
  const events = useMemo(() => futuresCalendarEvents(year,product,kind),[year,product,kind]);
  const dates = useMemo(() => {
    const result = new Map<string,FuturesCalendarEvent[]>();
    for (const event of events) result.set(event.date,[...(result.get(event.date) ?? []),event]);
    return result;
  },[events]);
  const selectedEvents = dates.get(selected) ?? [];
  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(year,month+delta,1));
    const nextYear = FUTURES_CALENDAR_YEARS.find(value => value === next.getUTCFullYear());
    if (nextYear) { setYear(nextYear); setMonth(next.getUTCMonth()); }
  };
  const goToday = () => {
    const thisYear = FUTURES_CALENDAR_YEARS.find(value => value === Number(today.slice(0,4)));
    if (thisYear) { setYear(thisYear); setMonth(Number(today.slice(5,7))-1); setSelected(today); }
  };
  const monthPanel = (index: number) => <section key={index} className="rounded border border-border bg-panel p-3" aria-label={`${MONTHS[index]} ${year}`}>
    <button onClick={() => { setMonth(index); setView("month"); }} className="mb-2 text-sm hover:text-primary">{MONTHS[index]} <span className="text-muted">{year}</span></button>
    <div className="grid grid-cols-7 text-center text-[10px] text-muted" aria-hidden="true">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <span key={day}>{day}</span>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">{calendarMonthCells(year,index).map((date,i) => {
      if (!date) return <span key={`empty-${i}`} />;
      const state = calendarDateState(date,today,selected),items = dates.get(date) ?? [];
      return <button key={date} onClick={() => setSelected(date)} data-past={state.past} aria-current={state.today ? "date" : undefined} aria-pressed={state.selected}
        aria-label={`${dateLabel(date)}. ${state.today ? "Today. " : state.past ? "Past date. " : ""}${items.map(eventLabel).join("; ") || "No covered event"}`}
        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded border px-1 py-1 text-sm hover:border-primary hover:opacity-100 focus-visible:opacity-100 ${state.selected ? "border-primary bg-primary/20" : "border-transparent bg-surface/40"} ${state.today ? "ring-2 ring-primary font-bold" : ""} ${state.past ? "opacity-45" : ""}`}>
        {Number(date.slice(-2))}<span className="flex w-full gap-0.5" aria-hidden="true">{items.map(event => <span key={`${event.family}:${event.kind}`} className={`h-1.5 min-w-0 flex-1 rounded ${eventColor(event.kind)}`} />)}</span>
      </button>;
    })}</div>
  </section>;
  const control = "rounded border border-border bg-panel px-3 py-1.5 text-xs hover:border-primary";
  return <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Futures expiration calendar">
    <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3"><CalendarDays className="h-5 w-5 text-primary" /><h1 className="text-lg">Futures Expiration Calendar</h1><a href={FUTURES_CALENDAR_SOURCE} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-xs text-primary">CME source <ExternalLink size={12} /></a></header>
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
      <button onClick={goToday} className={control}>Today</button>
      <KwantSelect value={String(year)} onChange={event => setYear(Number(event.target.value) as typeof year)} className={control} menuLabel="Futures calendar year">{FUTURES_CALENDAR_YEARS.map(value => <option key={value} value={value}>{value}</option>)}</KwantSelect>
      {(["year","month","agenda"] as const).map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`${control} ${view === value ? "border-primary text-primary" : ""}`}>{value[0].toUpperCase()+value.slice(1)}</button>)}
      <KwantSelect value={product} onChange={event => setProduct(event.target.value as FuturesProduct)} className={control} menuLabel="Futures product">{FUTURES_PRODUCTS.map(value => <option key={value}>{value}</option>)}</KwantSelect>
      <KwantSelect value={kind} onChange={event => setKind(event.target.value as typeof kind)} className={control} menuLabel="Futures event type"><option value="all">All events</option><option value="expiration">Expirations</option><option value="roll">Customary rolls</option></KwantSelect>
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border px-4 py-3 text-xs"><strong>TODAY · {dateLabel(today)}</strong><span className="text-muted">New York date</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-primary" />Expiration</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-warning" />Customary roll</span><span className="text-muted">Past dates dimmed · Today outlined</span></div>
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <p className="mb-4 text-xs leading-relaxed text-muted">Published CME equity-index schedule · 2026–2028 · Reference checked {FUTURES_VERIFIED_ON}. Covers U.S. indexes and Nikkei / TOPIX only, not energy, metals, rates or other futures. Dates are not generated or a live exchange feed. <a href={ALL_FUTURES_CALENDAR_SOURCE} target="_blank" rel="noreferrer" className="text-primary underline">All products, delivery and notice dates at CME <ExternalLink className="inline" size={11} /></a></p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]"><div>
        {view === "year" ? <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{MONTHS.map((_,i) => monthPanel(i))}</div> : view === "month" ? <><div className="mb-3 flex items-center justify-between"><button aria-label="Previous month" onClick={() => moveMonth(-1)} className={control}><ChevronLeft size={16} /></button><h2>{MONTHS[month]} {year}</h2><button aria-label="Next month" onClick={() => moveMonth(1)} className={control}><ChevronRight size={16} /></button></div>{monthPanel(month)}</> : <div><label className="mb-3 flex gap-2 text-xs"><input type="checkbox" checked={upcoming} onChange={event => setUpcoming(event.target.checked)} />Upcoming only</label>{events.filter(event => !upcoming || event.date >= today).map(event => <button key={`${event.date}:${event.family}:${event.kind}`} onClick={() => setSelected(event.date)} data-past={event.date < today} className={`flex w-full flex-wrap items-center gap-3 border-b border-border py-3 text-left text-sm hover:opacity-100 ${event.date < today ? "opacity-45" : ""} ${selected === event.date ? "bg-primary/10" : ""}`}><span className={`h-2 w-2 rounded ${eventColor(event.kind)}`} /><strong>{dateLabel(event.date)}</strong><span>{eventLabel(event)}</span></button>)}{!events.some(event => !upcoming || event.date >= today) && <p className="p-4 text-sm text-muted">No matching upcoming events in this published year.</p>}</div>}
      </div><aside className="sticky top-0 rounded border border-border bg-panel p-4" aria-label="Selected futures date"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">Selected date{selected === today ? " · Today" : selected < today ? " · Past" : ""}</p><h2 className="mb-4 text-sm font-semibold">{dateLabel(selected)}</h2>{selectedEvents.length ? selectedEvents.map(event => <article key={`${event.family}:${event.kind}`} className="mb-4 border-b border-border pb-3"><h3 className="mb-2 text-sm">{eventLabel(event)}</h3><p className="text-xs text-muted">{event.products.join(" · ")}</p><p className="mt-2 text-xs leading-relaxed">{event.kind === "roll" ? "A customary lead-contract transition, not mandatory expiry or a broker deadline. Positions can be rolled at other times." : "Published contract expiration date. Check the contract’s final trading time, settlement rules and your broker’s earlier cutoff before holding into expiration."}</p></article>) : <p className="mb-4 text-sm text-muted">No covered event for this date and current filters.</p>}<p className="text-xs leading-relaxed text-muted">June 2026 U.S. index expiry is June 18, not June 19, per CME’s holiday-adjusted table. Roll, expiration, first notice, delivery and settlement are different events. This view does not show physical-delivery notice dates.</p></aside></div>
    </div>
  </section>;
}
