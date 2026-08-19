"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  TV_SPEC_BY_ID,
  type TvIndicatorInstance,
} from "@/lib/tvIndicators";

// TradingView-style settings dialog: an Inputs tab (parameters) and a Style
// tab (per-plot colour, width, visibility), generated from the indicator spec
// exactly the way TradingView builds its own study dialogs.
type Props = {
  instance: TvIndicatorInstance | null;
  onChange: (next: TvIndicatorInstance) => void;
  onClose: () => void;
};

export default function TvIndicatorSettings({ instance, onChange, onClose }: Props) {
  const [tab, setTab] = useState<"inputs" | "style">("inputs");

  useEffect(() => {
    if (!instance) return;
    setTab("inputs");
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [instance, onClose]);

  if (!instance || typeof document === "undefined") return null;
  const spec = TV_SPEC_BY_ID.get(instance.specId);
  if (!spec) return null;

  const setInput = (key: string, value: number | string | boolean) =>
    onChange({ ...instance, inputs: { ...instance.inputs, [key]: value } });
  const setStyle = (key: string, patch: Partial<{ color: string; width: number; visible: boolean }>) =>
    onChange({ ...instance, style: { ...instance.style, [key]: { ...instance.style[key], ...patch } } });

  return createPortal(
    <div className="fixed inset-0 z-[290] flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onPointerDown={onClose}>
      <section
        className="w-full max-w-[440px] overflow-hidden rounded-xl border border-border bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.6)]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-11 items-center gap-3 border-b border-border px-4">
          <div className="text-[12px] font-semibold text-foreground">{spec.name}</div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
            aria-label="Close indicator settings"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex border-b border-border px-2">
          {(["inputs", "style"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${tab === key ? "text-primary shadow-[inset_0_-2px_0_var(--primary)]" : "text-muted hover:text-foreground"}`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="max-h-[52vh] space-y-3 overflow-y-auto p-4">
          {tab === "inputs" ? spec.inputs.map((field) => (
            <label key={field.key} className="flex items-center justify-between gap-4">
              <span className="text-[12px] text-foreground">{field.label}</span>
              {field.type === "number" ? (
                <input
                  type="number"
                  value={Number(instance.inputs[field.key] ?? field.default)}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 1}
                  onChange={(event) => setInput(field.key, Number(event.target.value))}
                  className="h-8 w-28 rounded-lg border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-primary/40"
                />
              ) : field.type === "boolean" ? (
                <input
                  type="checkbox"
                  checked={Boolean(instance.inputs[field.key] ?? field.default)}
                  onChange={(event) => setInput(field.key, event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              ) : (
                <select
                  value={String(instance.inputs[field.key] ?? field.default)}
                  onChange={(event) => setInput(field.key, event.target.value)}
                  className="h-8 w-40 rounded-lg border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary/40"
                >
                  {(field.type === "source"
                    ? [
                      { value: "close", label: "Close" }, { value: "open", label: "Open" },
                      { value: "high", label: "High" }, { value: "low", label: "Low" },
                      { value: "hl2", label: "HL2" }, { value: "hlc3", label: "HLC3" }, { value: "ohlc4", label: "OHLC4" },
                    ]
                    : field.options
                  ).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </label>
          )) : spec.styles.map((field) => {
            const current = instance.style[field.key];
            return (
              <div key={field.key} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[12px] text-foreground">
                  <input
                    type="checkbox"
                    checked={current?.visible !== false}
                    onChange={(event) => setStyle(field.key, { visible: event.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={current?.color ?? field.defaultColor}
                    onChange={(event) => setStyle(field.key, { color: event.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border border-border bg-background"
                    aria-label={`${field.label} colour`}
                  />
                  <select
                    value={String(current?.width ?? field.defaultWidth)}
                    onChange={(event) => setStyle(field.key, { width: Number(event.target.value) })}
                    className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary/40"
                    aria-label={`${field.label} width`}
                  >
                    {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w}px</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-background"
          >
            Done
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
