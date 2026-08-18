"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy } from "lucide-react";

const RECENT_COLORS_STORAGE_KEY = "olisa-recent-colors";
const POPOVER_WIDTH = 224;

export function normalizeHexColor(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${[...raw].map((part) => `${part}${part}`).join("").toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

function componentToHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0").toUpperCase();
}

function hsvToHex(h: number, s: number, v: number) {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = value - chroma;
  const [r, g, b] =
    h < 60 ? [chroma, x, 0] :
    h < 120 ? [x, chroma, 0] :
    h < 180 ? [0, chroma, x] :
    h < 240 ? [0, x, chroma] :
    h < 300 ? [x, 0, chroma] :
    [chroma, 0, x];
  return `#${componentToHex((r + m) * 255)}${componentToHex((g + m) * 255)}${componentToHex((b + m) * 255)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const normalized = normalizeHexColor(hex) ?? "#FFFFFF";
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

function readRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_COLORS_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && normalizeHexColor(item) !== null).slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

function rememberRecentColor(color: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [color, ...readRecentColors().filter((item) => item !== color)].slice(0, 12);
    window.localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recent colours are a convenience; the chosen colour still applies.
  }
}

/**
 * Theme-native colour control shared by indicator settings dialogs. The
 * trigger is a compact cockpit swatch; the popover offers an HSV surface,
 * hue rail, exact #hex entry and the workspace-wide recent colours — the
 * same recents the chart settings picker maintains.
 */
export default function ChartColorField({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  title,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
}) {
  const normalizedValue = normalizeHexColor(value) ?? "#FFFFFF";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(normalizedValue));
  const [hexDraft, setHexDraft] = useState(normalizedValue.replace("#", ""));
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  const copyHex = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(normalizedValue);
      setCopied(true);
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 1_200);
    } catch {
      // Clipboard access can be denied; the hex remains selectable in the field.
    }
  }, [normalizedValue]);

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  const applyColor = useCallback((hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    setHexDraft(normalized.replace("#", ""));
    rememberRecentColor(normalized);
    onChange(normalized);
  }, [onChange]);

  const openPopover = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 286);
    setPosition({ left, top });
    setHsv(hexToHsv(normalizedValue));
    setHexDraft(normalizedValue.replace("#", ""));
    setRecentColors(readRecentColors());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const beginSurfaceDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      const rect = surface.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width)) * 100;
      const v = (1 - Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height))) * 100;
      setHsv((current) => {
        const next = { ...current, s, v };
        applyColor(hsvToHex(next.h, next.s, next.v));
        return next;
      });
    };
    move(event);
    const handleMove = (moveEvent: PointerEvent) => move(moveEvent);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const beginHueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const rail = hueRef.current;
    if (!rail) return;
    rail.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      const rect = rail.getBoundingClientRect();
      const h = Math.max(0, Math.min(0.9999, (moveEvent.clientX - rect.left) / rect.width)) * 360;
      setHsv((current) => {
        const next = { ...current, h };
        applyColor(hsvToHex(next.h, next.s, next.v));
        return next;
      });
    };
    move(event);
    const handleMove = (moveEvent: PointerEvent) => move(moveEvent);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const hueColor = hsvToHex(hsv.h, 100, 100);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={`flex h-7 items-center gap-1.5 rounded-lg border px-1.5 transition-colors ${
          open ? "border-primary/40 bg-primary/10" : "border-border bg-surface hover:border-primary/30"
        } ${disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
      >
        <span className="h-4 w-4 shrink-0 rounded-[3px] border border-border" style={{ background: normalizedValue }} />
        <span className="font-mono text-[8px] font-semibold tracking-[0.04em] text-foreground">{normalizedValue}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${ariaLabel} picker`}
            // The picker opens from inside settings dialogs that stack as high
            // as z-[10000]; it must always sit above whichever surface hosts it.
            className="fixed z-[10050] rounded-xl border border-border bg-panel/95 p-2.5 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: POPOVER_WIDTH }}
          >
            <div
              ref={surfaceRef}
              onPointerDown={beginSurfaceDrag}
              className="relative h-[118px] w-full cursor-crosshair touch-none rounded-lg border border-border"
              style={{
                background: `linear-gradient(0deg, #000, transparent), linear-gradient(90deg, #fff, ${hueColor})`,
              }}
            >
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_5px_rgba(0,0,0,0.7)]"
                style={{ left: `${hsv.s}%`, bottom: `${hsv.v}%`, background: normalizedValue }}
              />
            </div>
            <div
              ref={hueRef}
              onPointerDown={beginHueDrag}
              className="relative mt-2 h-3 w-full cursor-pointer touch-none rounded-full border border-border"
              style={{
                background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            >
              <span
                className="pointer-events-none absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_5px_rgba(0,0,0,0.7)]"
                style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
              />
            </div>
            <label className="mt-2 flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2">
              <span className="font-mono text-[10px] font-semibold text-muted">#</span>
              <input
                type="text"
                value={hexDraft}
                maxLength={6}
                spellCheck={false}
                aria-label={`${ariaLabel} hex code`}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                  setHexDraft(raw.toUpperCase());
                  const normalized = normalizeHexColor(raw);
                  if (normalized) {
                    setHsv(hexToHsv(normalized));
                    applyColor(normalized);
                  }
                }}
                className="w-full bg-transparent font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground outline-none"
              />
              <span className="h-4 w-4 shrink-0 rounded-[3px] border border-border" style={{ background: normalizedValue }} />
              <button
                type="button"
                onClick={() => void copyHex()}
                aria-label={`Copy ${normalizedValue}`}
                title={copied ? "Copied" : `Copy ${normalizedValue}`}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                  copied ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted hover:text-primary"
                }`}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </label>
            {recentColors.length ? (
              <div className="mt-2">
                <div className="mb-1 text-[7px] font-semibold uppercase tracking-[0.16em] text-muted">Recent</div>
                <div className="flex flex-wrap gap-1">
                  {recentColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Use ${color}`}
                      title={color}
                      onClick={() => {
                        setHsv(hexToHsv(color));
                        applyColor(color);
                      }}
                      className={`h-5 w-5 rounded-[4px] border transition-transform hover:scale-110 ${
                        color === normalizedValue ? "border-primary" : "border-border"
                      }`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
