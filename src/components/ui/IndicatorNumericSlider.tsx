"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  formatIndicatorNumericValue,
  indicatorSliderModel,
  indicatorValueFromRail,
  normalizeIndicatorNumericValue,
} from "@/lib/indicatorNumericSlider";

type IndicatorNumericSliderProps = {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
};

export default function IndicatorNumericSlider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  className = "",
  onChange,
}: IndicatorNumericSliderProps) {
  const model = indicatorSliderModel(value, min, max, step);
  const format = useCallback(
    (next: number) => formatIndicatorNumericValue(next, model.precision),
    [model.precision],
  );
  const [draft, setDraft] = useState(() => format(model.value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(format(model.value));
  }, [editing, format, model.value]);

  const commitDraft = () => {
    const requested = draft.trim() === "" ? Number.NaN : Number(draft);
    const next = normalizeIndicatorNumericValue(requested, model.value, model.min, model.max, model.step);
    setDraft(format(next));
    setEditing(false);
    if (next !== model.value) onChange(next);
  };

  return (
    <div className={`kwant-indicator-numeric ${disabled ? "opacity-40" : ""} ${className}`.trim()}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <input
          type="number"
          min={model.min}
          max={model.max}
          step={model.step}
          value={draft}
          disabled={disabled}
          onFocus={() => setEditing(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onDoubleClick={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(format(model.value));
              event.currentTarget.blur();
            }
          }}
          aria-label={typeof label === "string" ? label : "Numeric indicator setting"}
          className="kwant-indicator-number h-7 w-24 border border-border bg-background px-2 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/60 disabled:cursor-not-allowed"
        />
      </div>
      <input
        type="range"
        min={model.railMin}
        max={model.railMax}
        step={model.railStep}
        value={model.railValue}
        disabled={disabled}
        onChange={(event) => onChange(indicatorValueFromRail(Number(event.target.value), model))}
        aria-label={`${typeof label === "string" ? label : "Numeric indicator setting"} slider`}
        aria-valuemin={model.min}
        aria-valuemax={model.max}
        aria-valuenow={model.value}
        className="kwant-indicator-slider w-full disabled:cursor-not-allowed"
        style={{ "--kwant-slider-fill": `${model.fillPercent}%` } as CSSProperties}
      />
    </div>
  );
}
