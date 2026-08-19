"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  LineChart,
  Plus,
  Settings2,
  TrendingUp,
  Waves,
} from "lucide-react";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { TvIndicatorInstance } from "@/lib/tvIndicators";

// A horizontal quick-access study bar pinned to the top of each chart, styled
// after the site's top navigation. The MA/Bands, VWAP, Oscillators and
// Volatility groups add brand-new TradingView-identical studies (their own
// engine, their own Inputs/Style dialog). The Structure group keeps the
// KwantDesk-specific session/IB studies, which have no TradingView twin.
type TvEntry = { kind: "tv"; specId: string; label: string; hint: string };
type LegacyEntry = { kind: "legacy"; id: string; label: string; hint: string };
type QuickEntry = TvEntry | LegacyEntry;
type QuickGroup = { key: string; label: string; icon: typeof TrendingUp; items: QuickEntry[] };

const QUICK_GROUPS: QuickGroup[] = [
  {
    key: "overlays",
    label: "MA · Bands",
    icon: TrendingUp,
    items: [
      { kind: "tv", specId: "tv-ma", label: "Moving Average", hint: "SMA/EMA/WMA/RMA overlay (TradingView-identical)" },
      { kind: "tv", specId: "tv-ema", label: "EMA", hint: "Exponential moving average" },
      { kind: "tv", specId: "tv-bb", label: "Bollinger Bands", hint: "Basis ± standard-deviation bands" },
    ],
  },
  {
    key: "vwap",
    label: "VWAP",
    icon: LineChart,
    items: [
      { kind: "tv", specId: "tv-vwap", label: "VWAP", hint: "Session/weekly volume-weighted average price" },
    ],
  },
  {
    key: "structure",
    label: "Structure",
    icon: Waves,
    items: [
      { kind: "legacy", id: "sessions", label: "Sessions", hint: "Session background shading" },
      { kind: "legacy", id: "session-highs-lows", label: "Session Highs & Lows", hint: "Prior session high/low levels" },
      { kind: "legacy", id: "ib-levels", label: "IB Levels", hint: "Initial-balance high/low, with optional fib" },
    ],
  },
];

type Props = {
  legacyIndicators: ChartIndicatorInstance[];
  tvIndicators: TvIndicatorInstance[];
  onAddTv: (specId: string) => void;
  onOpenTvSettings: (instanceId: string) => void;
  onToggleLegacy: (indicatorId: string) => void;
  onOpenLibrary: () => void;
};

export default function ChartTopToolbar({
  legacyIndicators,
  tvIndicators,
  onAddTv,
  onOpenTvSettings,
  onToggleLegacy,
  onOpenLibrary,
}: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const tvBySpec = new Map<string, TvIndicatorInstance[]>();
  for (const instance of tvIndicators) {
    const list = tvBySpec.get(instance.specId) ?? [];
    list.push(instance);
    tvBySpec.set(instance.specId, list);
  }
  const legacyEnabled = new Set(legacyIndicators.filter((i) => i.enabled).map((i) => i.indicatorId));
  const groupCount = (group: QuickGroup) => group.items.reduce((total, item) =>
    total + (item.kind === "tv" ? (tvBySpec.get(item.specId)?.length ?? 0) : (legacyEnabled.has(item.id) ? 1 : 0)), 0);

  const toggleGroup = (key: string) => {
    if (openGroup === key) { setOpenGroup(null); return; }
    const rect = triggerRefs.current[key]?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 262)), top: rect.bottom + 6 });
    setOpenGroup(key);
  };

  useEffect(() => {
    if (!openGroup) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (Object.values(triggerRefs.current).some((node) => node?.contains(target))) return;
      setOpenGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenGroup(null); };
    const closeOnScroll = () => setOpenGroup(null);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnScroll);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnScroll);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [openGroup]);

  const chipBase = "flex h-6 shrink-0 items-center gap-1.5 rounded-[3px] border px-2 text-[10px] font-semibold uppercase leading-none tracking-[0.075em] transition-colors";
  const activeGroup = QUICK_GROUPS.find((group) => group.key === openGroup) ?? null;

  return (
    <div className="pointer-events-auto absolute left-0 right-[var(--chart-price-axis-inset,64px)] top-0 z-[26] flex h-7 min-w-0 items-center gap-1 overflow-x-auto border-b border-border/70 bg-panel/85 px-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={onOpenLibrary}
        className={`${chipBase} border-border/70 bg-background/35 text-muted hover:border-primary/30 hover:bg-surface hover:text-foreground`}
        title="Open the full indicator library"
      >
        <Plus className="h-3 w-3" /><span>Indicators</span>
      </button>
      <span className="h-4 w-px shrink-0 bg-border/70" />
      {QUICK_GROUPS.map((group) => {
        const Icon = group.icon;
        const count = groupCount(group);
        const open = openGroup === group.key;
        return (
          <button
            key={group.key}
            ref={(node) => { triggerRefs.current[group.key] = node; }}
            type="button"
            aria-expanded={open}
            onClick={() => toggleGroup(group.key)}
            className={`${chipBase} ${open || count > 0
              ? "border-primary/35 bg-primary/[0.08] text-primary"
              : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
            title={`${group.label} studies`}
          >
            <Icon className="h-3 w-3" />
            <span>{group.label}</span>
            {count > 0 ? <span className="rounded-full bg-primary/20 px-1 text-[8px] leading-[13px] text-primary">{count}</span> : null}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        );
      })}

      {openGroup && activeGroup && menuPosition && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            data-chart-top-toolbar-menu=""
            className="fixed z-[280] w-[254px] overflow-hidden rounded-xl border border-border bg-panel/97 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{ left: menuPosition.left, top: menuPosition.top } as CSSProperties}
          >
            <div className="px-2 pb-1 pt-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted">{activeGroup.label}</div>
            {activeGroup.items.map((item) => {
              if (item.kind === "tv") {
                const instances = tvBySpec.get(item.specId) ?? [];
                return (
                  <div key={item.specId} className="rounded-lg px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => onAddTv(item.specId)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
                      title={item.hint}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-[11px] text-foreground">{item.label}</span>
                      {instances.length ? <span className="ml-auto rounded-full bg-primary/20 px-1.5 text-[8px] leading-[15px] text-primary">{instances.length}</span> : null}
                    </button>
                    {instances.map((instance, index) => (
                      <button
                        key={instance.instanceId}
                        type="button"
                        onClick={() => onOpenTvSettings(instance.instanceId)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 pl-7 text-left text-muted hover:bg-surface hover:text-foreground"
                        title={`${item.label} #${index + 1} settings`}
                      >
                        <Settings2 className="h-3 w-3 shrink-0" />
                        <span className="truncate text-[10px]">{item.label} #{index + 1}</span>
                      </button>
                    ))}
                  </div>
                );
              }
              const active = legacyEnabled.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggleLegacy(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${active ? "bg-primary/10" : "hover:bg-surface"}`}
                  title={item.hint}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px] ${active ? "border-primary bg-primary text-background" : "border-border text-transparent"}`}>✓</span>
                  <span className={`truncate text-[11px] ${active ? "text-primary" : "text-foreground"}`}>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
