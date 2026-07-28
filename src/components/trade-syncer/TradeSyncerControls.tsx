"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";

export function TradeSyncerModal({
  title,
  description,
  onClose,
  closeHref,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  closeHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <div className="text-[20px] font-semibold text-foreground">{title}</div>
            {description ? <div className="mt-2 text-[13px] leading-6 text-muted">{description}</div> : null}
          </div>
          {closeHref ? (
            <Link
              href={closeHref}
              className="rounded-xl border border-border bg-background/40 p-2 text-muted transition-colors hover:border-primary/30 hover:text-primary"
            >
              <X className="h-4 w-4" />
            </Link>
          ) : (
            <button
              onClick={onClose}
              className="rounded-xl border border-border bg-background/40 p-2 text-muted transition-colors hover:border-primary/30 hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function TradeSyncerSegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
              active ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function TradeSyncerField({
  label,
  placeholder,
  type = "text",
  name,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type?: string;
  name?: string;
  value?: string;
  onChange?: (next: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary/30"
      />
    </label>
  );
}

export function TradeSyncerSelect({
  label,
  options,
  name,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  name?: string;
  value?: string;
  onChange?: (next: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          className="w-full appearance-none rounded-xl border border-border bg-background/40 px-4 py-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary/30"
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </label>
  );
}
