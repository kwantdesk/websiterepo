"use client";

import { captureDropdownDismissal } from "@/lib/dropdownDismissal";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A session date picker in the desk's own chrome.
 *
 * `input type="date"` hands the browser's native calendar to the trader, which
 * on Windows is a system popover with system fonts and system colours sitting
 * on top of a dark cockpit. This follows the same portal-and-position pattern
 * as KwantSelect so a date reads like every other control here.
 *
 * Trading calendars default to weekdays. General-purpose fields can pass their own date rules.
 */
export function isInsideKwantDatePicker(target: EventTarget | Node | null): boolean {
  return target instanceof Element ? Boolean(target.closest("[data-kwant-date-menu]")) : false;
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Calendar maths in plain UTC — a date here is a label, never an instant. */
const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toValue = (date: Date) => date.toISOString().slice(0, 10);
const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;

function monthFor(value: string) {
  const date = toDate(value);
  return startOfMonth(Number.isFinite(date.getTime()) ? date : new Date());
}

type KwantDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable date, inclusive. */
  max?: string;
  /** Earliest selectable date, inclusive. */
  min?: string;
  id?: string;
  label?: string;
  title?: string;
  allowClear?: boolean;
  onFocus?: () => void;
  className?: string;
  disabled?: boolean;
  isDateSelectable?: (date: string) => boolean;
};

export default function KwantDatePicker({
  value,
  onChange,
  max,
  min,
  id,
  label = "Select date",
  title,
  allowClear = false,
  onFocus,
  className = "",
  disabled = false,
  isDateSelectable,
}: KwantDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [typedDate, setTypedDate] = useState(value);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [month, setMonth] = useState(() => monthFor(value));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setMonth(monthFor(value));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (triggerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const menu = menuRef.current;
    (menu?.querySelector<HTMLElement>('[aria-pressed="true"]:not(:disabled)')
      ?? menu?.querySelector<HTMLElement>("button:not(:disabled)"))?.focus();
    const stopOutsideDismissal = captureDropdownDismissal(onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      stopOutsideDismissal();
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const WIDTH = 244;
  const HEIGHT = allowClear ? 300 : 258;
  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || disabled) return;
    const below = rect.bottom + 7;
    // The replay bar sits at the bottom of the workspace, so this normally
    // opens upward rather than off the end of the window.
    const top = below + HEIGHT <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - HEIGHT - 7);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8)),
      top,
    });
    setTypedDate(value);
    setOpen(true);
  };

  const days = useMemo(() => {
    const first = startOfMonth(month);
    // Monday-first, matching how a trading week is read.
    const lead = (first.getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= total; day += 1) {
      cells.push(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)));
    }
    return cells;
  }, [month]);

  const outOfRange = (date: Date) => {
    const iso = toValue(date);
    if (max && iso > max) return true;
    if (min && iso < min) return true;
    return false;
  };

  const selectDate = (date: string) => {
    onChange(date);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const parsedTypedDate = toDate(typedDate);
  const typedDateValid = Number.isFinite(parsedTypedDate.getTime())
    && toValue(parsedTypedDate) === typedDate && !outOfRange(parsedTypedDate)
    && (isDateSelectable ? isDateSelectable(typedDate) : !isWeekend(parsedTypedDate));

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(month);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onFocus={onFocus}
        disabled={disabled}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`group inline-flex h-7 shrink-0 items-center gap-1.5 border border-border bg-surface px-2 font-mono text-[9px] text-foreground outline-none transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-45 ${open ? "border-primary/50" : ""} ${className}`}
      >
        <CalendarDays className="h-3 w-3 shrink-0 text-muted group-hover:text-primary" />
        <span className="truncate tabular-nums">{value || "—"}</span>
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            data-kwant-date-menu
            role="dialog"
            aria-label={label}
            className="fixed z-[12000] max-h-[calc(100dvh-16px)] overflow-auto rounded-2xl border border-border bg-panel/95 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: WIDTH }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, -1))}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-border text-muted hover:border-primary/40 hover:text-primary"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-border text-muted hover:border-primary/40 hover:text-primary"
                aria-label="Next month"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1">
              {WEEKDAY_LABELS.map((weekday, index) => (
                <span
                  key={`${weekday}-${index}`}
                  className="text-center font-mono text-[8px] uppercase tracking-[0.1em] text-muted"
                >
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 px-0.5">
              {days.map((date, index) => {
                if (!date) return <span key={`pad-${index}`} />;
                const iso = toValue(date);
                const unavailable = outOfRange(date) || (isDateSelectable ? !isDateSelectable(iso) : isWeekend(date));
                const selected = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={selected}
                    onClick={() => selectDate(iso)}
                    className={`flex h-7 items-center justify-center rounded-lg font-mono text-[10px] tabular-nums transition-colors ${
                      selected
                        ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                        : unavailable
                          ? "cursor-not-allowed text-muted/35"
                          : "text-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {date.getUTCDate()}
                  </button>
                );
              })}
            </div>
            {allowClear ? (
              <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
                <input
                  type="text"
                  aria-label="Date (YYYY-MM-DD)"
                  placeholder="YYYY-MM-DD"
                  className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-[10px] text-foreground"
                  value={typedDate}
                  onChange={(event) => setTypedDate(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (typedDateValid) selectDate(typedDate);
                  }}
                />
                <button type="button" disabled={!typedDateValid} onClick={() => selectDate(typedDate)}
                  className="rounded-lg px-2 py-1 text-[10px] text-primary disabled:opacity-40">Set</button>
                {value ? <button type="button" onClick={() => selectDate("")}
                  className="rounded-lg px-2 py-1 text-[10px] text-muted hover:text-foreground">Clear</button> : null}
              </div>
            ) : null}
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
