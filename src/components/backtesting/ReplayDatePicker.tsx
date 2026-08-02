"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PickerView = "days" | "months" | "years";

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonth(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function displayDate(value: string) {
  const date = parseDateKey(value);
  if (!date) return "Choose replay date";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ReplayDatePicker({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  const initialDate = parseDateKey(value) ?? parseDateKey(max) ?? new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>("days");
  const [month, setMonth] = useState(() => monthStart(initialDate));
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const minDate = parseDateKey(min);
  const maxDate = parseDateKey(max);
  const todayKey = dateKey(new Date());

  const days = useMemo(() => {
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1 || day > daysInMonth) return null;
      const date = new Date(Date.UTC(year, monthIndex, day));
      return { key: dateKey(date), day };
    });
  }, [month]);

  const openPicker = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, Math.max(260, window.innerWidth - 16));
    const estimatedHeight = 374;
    const below = rect.bottom + 8;
    setMonth(monthStart(parseDateKey(value) ?? parseDateKey(max) ?? new Date()));
    setView("days");
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: below + estimatedHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - estimatedHeight - 8),
      width,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  const choose = (nextValue: string) => {
    if (nextValue < min || nextValue > max) return;
    onChange(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const monthLabel = month.toLocaleDateString("en-AU", { timeZone: "UTC", month: "long", year: "numeric" });
  const decadeStart = Math.floor(month.getUTCFullYear() / 10) * 10;
  const canShowMonth = (candidate: Date) => {
    const start = dateKey(candidate);
    const end = dateKey(new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)));
    return (!minDate || end >= min) && (!maxDate || start <= max);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPicker()}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Choose replay date"
        className={`group flex h-11 w-full items-center gap-3 rounded-xl border bg-background px-3 text-left text-[12px] text-foreground outline-none transition-all ${open ? "border-primary/40 bg-primary/[0.05] ring-2 ring-primary/10" : "border-border hover:border-primary/25 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/10"}`}
      >
        <CalendarDays className={`h-3.5 w-3.5 shrink-0 transition-colors ${open ? "text-primary" : "text-muted group-hover:text-primary"}`} />
        <span className="min-w-0 flex-1 truncate font-medium">{displayDate(value)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
      </button>

      {open && position && typeof document !== "undefined" ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Replay date calendar"
          className="fixed z-[2400] overflow-hidden rounded-[22px] border border-border bg-panel/98 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl"
          style={{ left: position.left, top: position.top, width: position.width }}
        >
          <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (view === "years") setMonth(new Date(Date.UTC(month.getUTCFullYear() - 10, month.getUTCMonth(), 1)));
                  else if (view === "months") setMonth(new Date(Date.UTC(month.getUTCFullYear() - 1, month.getUTCMonth(), 1)));
                  else setMonth((current) => canShowMonth(shiftMonth(current, -1)) ? shiftMonth(current, -1) : current);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted transition hover:border-border hover:bg-surface hover:text-foreground"
                aria-label={view === "years" ? "Previous decade" : view === "months" ? "Previous year" : "Previous month"}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView((current) => current === "days" ? "months" : current === "months" ? "years" : "months")}
                className="min-w-0 flex-1 rounded-xl px-3 py-2 text-[11px] font-semibold text-foreground transition hover:bg-surface"
              >
                {view === "days" ? monthLabel : view === "months" ? month.getUTCFullYear() : `${decadeStart} – ${decadeStart + 9}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (view === "years") setMonth(new Date(Date.UTC(month.getUTCFullYear() + 10, month.getUTCMonth(), 1)));
                  else if (view === "months") setMonth(new Date(Date.UTC(month.getUTCFullYear() + 1, month.getUTCMonth(), 1)));
                  else setMonth((current) => canShowMonth(shiftMonth(current, 1)) ? shiftMonth(current, 1) : current);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted transition hover:border-border hover:bg-surface hover:text-foreground"
                aria-label={view === "years" ? "Next decade" : view === "months" ? "Next year" : "Next month"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {view === "days" ? (
              <>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[7px] font-semibold uppercase tracking-[0.14em] text-muted/70">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1.5">{day}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((item, index) => item ? (
                    <button
                      key={item.key}
                      type="button"
                      disabled={item.key < min || item.key > max}
                      onClick={() => choose(item.key)}
                      className={`relative flex h-8 items-center justify-center rounded-lg font-mono text-[9px] transition-all disabled:cursor-not-allowed disabled:opacity-20 ${item.key === value ? "bg-primary font-bold text-background shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_28%,transparent)]" : item.key === todayKey ? "border border-primary/35 text-primary hover:bg-primary/10" : "text-muted hover:bg-surface hover:text-foreground"}`}
                    >
                      {item.day}
                    </button>
                  ) : <span key={`empty-${index}`} className="h-8" />)}
                </div>
              </>
            ) : view === "months" ? (
              <div className="mt-3 grid grid-cols-3 gap-2 py-2">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const candidate = new Date(Date.UTC(month.getUTCFullYear(), monthIndex, 1));
                  const enabled = canShowMonth(candidate);
                  return (
                    <button
                      key={monthIndex}
                      type="button"
                      disabled={!enabled}
                      onClick={() => { setMonth(candidate); setView("days"); }}
                      className={`h-10 rounded-xl text-[9px] font-semibold transition disabled:opacity-20 ${monthIndex === month.getUTCMonth() ? "border border-primary/30 bg-primary/10 text-primary" : "border border-border/60 text-muted hover:border-primary/20 hover:bg-surface hover:text-foreground"}`}
                    >
                      {candidate.toLocaleDateString("en-AU", { timeZone: "UTC", month: "short" })}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 py-2">
                {Array.from({ length: 12 }, (_, index) => decadeStart - 1 + index).map((year) => {
                  const enabled = (!minDate || year >= minDate.getUTCFullYear()) && (!maxDate || year <= maxDate.getUTCFullYear());
                  return (
                    <button
                      key={year}
                      type="button"
                      disabled={!enabled}
                      onClick={() => { setMonth(new Date(Date.UTC(year, month.getUTCMonth(), 1))); setView("months"); }}
                      className={`h-10 rounded-xl font-mono text-[9px] font-semibold transition disabled:opacity-20 ${year === month.getUTCFullYear() ? "border border-primary/30 bg-primary/10 text-primary" : "border border-border/60 text-muted hover:border-primary/20 hover:bg-surface hover:text-foreground"}`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-background/30 px-3 py-2.5">
            <span className="text-[7px] uppercase tracking-[0.14em] text-muted">Historical replay</span>
            <button type="button" onClick={() => choose(max < todayKey ? max : todayKey)} className="rounded-lg border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-[8px] font-semibold text-primary transition hover:bg-primary/12">Today</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
