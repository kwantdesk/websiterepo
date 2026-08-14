"use client";

import { Check, ChevronDown, Clock3, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  browserTimeZone,
  compactTimeZoneLabel,
  normalizeTimeZone,
  timeZoneOptions,
} from "@/lib/timeZones";

export default function TimeZoneSelect({
  value,
  onChange,
  className = "",
  menuLabel = "Chart timezone",
  compact = false,
}: {
  value: string;
  onChange: (timeZone: string) => void;
  className?: string;
  menuLabel?: string;
  compact?: boolean;
}) {
  const normalizedValue = normalizeTimeZone(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ left: 8, top: 8, width: 350 });
  const options = useMemo(() => timeZoneOptions(), []);
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return options;
    return options.filter((option) => option.searchText.includes(search));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(370, Math.max(240, window.innerWidth - 16));
    const estimatedHeight = Math.min(460, window.innerHeight - 16);
    const below = rect.bottom + 7;
    const top = below + estimatedHeight <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - estimatedHeight - 7);
    setPosition({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top,
      width,
    });
    setOpen(true);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    const handleViewportChange = () => close();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const choose = (timeZone: string) => {
    onChange(normalizeTimeZone(timeZone));
    close();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? close() : openMenu()}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={compactTimeZoneLabel(normalizedValue)}
        className={`group inline-flex items-center justify-between gap-2 border bg-surface text-left outline-none transition-colors ${
          open
            ? "border-primary/40 text-primary"
            : "border-border text-muted hover:border-primary/25 hover:text-foreground"
        } ${compact ? "kwant-chart-row-control h-7 rounded-[3px] px-2.5 text-[10px]" : "h-10 w-full rounded-xl px-3 text-[12px]"} ${className}`}
      >
        <Clock3 className={`h-3.5 w-3.5 shrink-0 ${compact ? "text-current" : "text-primary"}`} />
        <span className={`min-w-0 flex-1 truncate ${compact ? "font-semibold uppercase tracking-[0.075em]" : "font-mono"}`}>
          {compactTimeZoneLabel(normalizedValue)}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={menuLabel}
            className="fixed z-[420] overflow-hidden rounded-2xl border border-border bg-panel/98 p-2 shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: position.width }}
          >
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">{menuLabel}</div>
                <div className="mt-0.5 text-[9px] text-muted">Times update immediately</div>
              </div>
              <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Close timezone menu">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search city, region or UTC offset"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[11px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40"
              />
            </div>
            <button
              type="button"
              onClick={() => choose(browserTimeZone())}
              className="mb-2 flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2.5 text-left text-[11px] text-primary hover:bg-primary/10"
            >
              <Clock3 className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1 truncate">Use my device · {compactTimeZoneLabel(browserTimeZone())}</span>
            </button>
            <div className="max-h-[320px] space-y-0.5 overflow-y-auto">
              {filteredOptions.length ? filteredOptions.map((option) => {
                const active = option.value === normalizedValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(option.value)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] font-semibold">{option.label}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-muted">{option.value}</span>
                    </span>
                    {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                );
              }) : (
                <div className="px-3 py-8 text-center text-[11px] text-muted">No timezone matches that search.</div>
              )}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
