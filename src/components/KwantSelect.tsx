"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

/**
 * The site's one dropdown.
 *
 * A native <select> renders the operating system's own menu — on Windows a grey
 * list in a system font that ignores the theme entirely. It cannot be styled,
 * so every one of them was a hole in the interface.
 *
 * This is the portaled menu GEX Map already used, promoted so everything can
 * share it: it escapes any clipping or stacking context, closes on an outside
 * press, on Escape, and on scroll or resize (a menu measured against a trigger
 * that has since moved is worse than no menu), and returns focus to the
 * trigger when dismissed by keyboard.
 */

export type KwantSelectOption<T extends string> = {
  value: T;
  label: string;
  detail?: string;
};

export default function KwantSelect<T extends string>({
  ariaLabel,
  value,
  options,
  menuLabel,
  menuWidth,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: KwantSelectOption<T>[];
  menuLabel: string;
  menuWidth: number;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      top: rect.bottom + 7,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleMenu}
        className={`gex-map-dropdown group flex h-7 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-[3px] border px-2 text-left transition-colors ${
          open
            ? "border-primary/40 bg-primary/[0.08] text-primary"
            : "border-border/70 bg-background/35 text-foreground hover:border-primary/30 hover:bg-surface"
        }`}
      >
        <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.075em]">{selected?.label ?? value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-primary" : "group-hover:text-foreground"}`} />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            data-gex-map-dropdown-menu=""
            className="fixed z-[280] overflow-hidden rounded-2xl border border-border bg-panel/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: menuWidth }}
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted">
              <span>{menuLabel}</span>
              <span>{options.length}</span>
            </div>
            <div className="max-h-[300px] space-y-0.5 overflow-y-auto">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-surface"
                    }`}
                  >
                    <span className={`flex h-7 min-w-12 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-[10px] font-semibold ${
                      active
                        ? "bg-primary text-background shadow-[0_0_14px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]"
                        : "border border-border bg-card text-foreground"
                    }`}>
                      {option.label}
                    </span>
                    {option.detail ? (
                      <span className="min-w-0 flex-1 truncate text-[9px] text-muted">{option.detail}</span>
                    ) : null}
                    {active ? <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
