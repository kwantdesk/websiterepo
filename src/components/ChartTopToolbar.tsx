"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BarChart3,
  ChevronDown,
  Gauge,
  LineChart,
  Plus,
  Settings2,
  TrendingUp,
  Waves,
} from "lucide-react";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";

// A horizontal quick-access indicator bar pinned to the top of each chart,
// styled after the site's top navigation. Every entry maps to an existing
// chart indicator id, so toggling one here is identical to adding it from the
// full indicator library — it just puts the most common studies one click
// away, TradingView-header style. Nothing here invents a new indicator.
type QuickIndicator = { id: string; label: string; hint: string };
type QuickGroup = { key: string; label: string; icon: typeof TrendingUp; items: QuickIndicator[] };

const QUICK_GROUPS: QuickGroup[] = [
  {
    key: "overlays",
    label: "MA · Bands",
    icon: TrendingUp,
    items: [
      { id: "moving-average", label: "Moving Average", hint: "Simple/exponential moving average overlay" },
      { id: "bollinger-bands", label: "Bollinger Bands", hint: "Standard-deviation envelope around a moving average" },
      { id: "keltner-channel", label: "Keltner Channel", hint: "ATR envelope around an EMA" },
      { id: "donchian-channel", label: "Donchian Channel", hint: "Rolling high/low channel" },
    ],
  },
  {
    key: "vwap",
    label: "VWAP",
    icon: LineChart,
    items: [
      { id: "vwap", label: "VWAP", hint: "Session volume-weighted average price" },
      { id: "vwap-envelopes", label: "VWAP Envelopes", hint: "Deviation bands around session VWAP" },
      { id: "rolling-vwap", label: "Rolling VWAP", hint: "Fixed-length rolling VWAP" },
    ],
  },
  {
    key: "volume",
    label: "Volume",
    icon: BarChart3,
    items: [
      { id: "volume", label: "Volume", hint: "Traded volume histogram" },
      { id: "kwant-profile", label: "Session Volume Profile", hint: "Traded-at-price distribution for the session" },
      { id: "weekly-volume-profile", label: "Weekly Volume Profile", hint: "Volume profile over the visible week" },
    ],
  },
  {
    key: "oscillators",
    label: "Oscillators",
    icon: Activity,
    items: [
      { id: "relative-strength-index-rsi", label: "RSI", hint: "Relative Strength Index" },
      { id: "macd-indicator", label: "MACD", hint: "Moving Average Convergence Divergence" },
      { id: "stochastic-oscillator", label: "Stochastic", hint: "Stochastic oscillator" },
      { id: "momentum-indicator", label: "Momentum", hint: "Momentum indicator" },
      { id: "rate-of-change-roc", label: "ROC", hint: "Rate of Change" },
      { id: "commodity-channel-index-cci", label: "CCI", hint: "Commodity Channel Index" },
      { id: "williams-r", label: "Williams %R", hint: "Williams Percent Range" },
      { id: "aroon-up-down", label: "Aroon", hint: "Aroon up/down" },
    ],
  },
  {
    key: "volatility",
    label: "Volatility",
    icon: Gauge,
    items: [
      { id: "average-true-range-atr", label: "ATR", hint: "Average True Range" },
      { id: "standard-deviation", label: "Std Deviation", hint: "Rolling standard deviation" },
    ],
  },
  {
    key: "structure",
    label: "Structure",
    icon: Waves,
    items: [
      { id: "sessions", label: "Sessions", hint: "Session background shading" },
      { id: "session-highs-lows", label: "Session Highs & Lows", hint: "Prior session high/low levels" },
      { id: "ib-levels", label: "IB Levels", hint: "Initial-balance high/low, with optional fib" },
    ],
  },
];

type Props = {
  indicators: ChartIndicatorInstance[];
  onToggle: (indicatorId: string) => void;
  onOpenSettings: (instanceId: string) => void;
  onOpenLibrary: () => void;
};

export default function ChartTopToolbar({ indicators, onToggle, onOpenSettings, onOpenLibrary }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const enabledById = new Map<string, ChartIndicatorInstance>();
  for (const instance of indicators) {
    if (instance.enabled && !enabledById.has(instance.indicatorId)) enabledById.set(instance.indicatorId, instance);
  }
  const activeCount = (group: QuickGroup) => group.items.filter((item) => enabledById.has(item.id)).length;

  const toggleGroup = (key: string) => {
    if (openGroup === key) {
      setOpenGroup(null);
      return;
    }
    const rect = triggerRefs.current[key]?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 258)),
      top: rect.bottom + 6,
    });
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
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
        const count = activeCount(group);
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
            title={`${group.label} indicators`}
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
            className="fixed z-[280] w-[250px] overflow-hidden rounded-xl border border-border bg-panel/97 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{ left: menuPosition.left, top: menuPosition.top } as CSSProperties}
          >
            <div className="px-2 pb-1 pt-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted">{activeGroup.label}</div>
            {activeGroup.items.map((item) => {
              const active = enabledById.get(item.id);
              return (
                <div
                  key={item.id}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${active ? "bg-primary/10" : "hover:bg-surface"}`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title={item.hint}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px] ${active ? "border-primary bg-primary text-background" : "border-border text-transparent"}`}>✓</span>
                    <span className={`truncate text-[11px] ${active ? "text-primary" : "text-foreground"}`}>{item.label}</span>
                  </button>
                  {active ? (
                    <button
                      type="button"
                      onClick={() => onOpenSettings(active.instanceId)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-background hover:text-primary group-hover:opacity-100"
                      title={`${item.label} settings`}
                      aria-label={`${item.label} settings`}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
