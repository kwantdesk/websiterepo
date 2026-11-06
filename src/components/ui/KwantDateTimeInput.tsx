"use client";

import { useState } from "react";
import KwantDatePicker from "./KwantDatePicker";

type Props = {
  type: "date" | "time" | "datetime-local";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onFocus?: () => void;
  id?: string;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  step?: string | number;
  title?: string;
};

function normalizeClock(text: string, seconds: boolean) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(text.trim());
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}${seconds || match[3] ? `:${match[3] ?? "00"}` : ""}`;
}

/** Date and time fields use calendar keys and wall-clock strings as before. */
export default function KwantDateTimeInput({
  type, value, defaultValue = "", onValueChange, onFocus, id, "aria-label": label,
  className = "", disabled, min, max, step, title,
}: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [draft, setDraft] = useState<string | null>(null);
  const selected = value ?? internalValue;
  const [date, time = ""] = type === "datetime-local" ? selected.split("T") : ["", selected];
  const seconds = Number(step) === 1 || time.length > 5;
  const timeText = draft ?? time;
  const commit = (next: string) => {
    if (next === selected) return;
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  };
  const clock = (inputId?: string, inputLabel?: string) => (
    <input
      id={inputId}
      type="text"
      aria-label={inputLabel}
      aria-invalid={draft !== null && draft !== "" && !normalizeClock(draft, seconds)}
      title={title ?? (seconds ? "24-hour time (HH:mm:ss)" : "24-hour time (HH:mm)")}
      placeholder={seconds ? "HH:mm:ss" : "HH:mm"}
      autoComplete="off"
      spellCheck={false}
      disabled={disabled || (type === "datetime-local" && !date)}
      className={`min-w-0 rounded-lg border border-border bg-background px-2 font-mono text-foreground ${className}`}
      value={timeText}
      onFocus={onFocus}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const normalized = normalizeClock(timeText, seconds);
        setDraft(null);
        if (normalized) commit(type === "datetime-local" ? `${date}T${normalized}` : normalized);
        else if (!timeText.trim()) commit("");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
  if (type === "time") return clock(id, label);
  const calendar = (
    <KwantDatePicker
      id={id}
      label={label ?? (type === "datetime-local" ? "Select date" : undefined)}
      title={title}
      value={type === "date" ? selected : date}
      disabled={disabled}
      min={min}
      max={max}
      allowClear
      isDateSelectable={() => true}
      onFocus={onFocus}
      className={`min-w-0 ${className}`}
      onChange={(next) => commit(type === "datetime-local" && next ? `${next}T${time || "00:00"}` : next)}
    />
  );
  if (type === "date") return calendar;
  return <div className="grid min-w-0 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-1.5">{calendar}{clock(undefined, label ? `${label} clock` : "Time")}</div>;
}
