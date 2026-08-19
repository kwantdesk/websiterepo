"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { DRAW_TOOL_SPECS, type DrawToolId } from "@/lib/chartDrawTools";

// Top charting-tools bar. Clean-room line-art icons in TradingView's visual
// language (nothing copied from their assets), grouped the way their left
// toolbar groups collapse. Selecting a tool arms the drawing overlay.
type ToolIcon = (props: { className?: string }) => ReactNode;

const svg = (children: ReactNode): ToolIcon =>
  function Icon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    );
  };

const ICONS: Record<DrawToolId, ToolIcon> = {
  cursor: svg(<><path d="M5 4l7 16 2-7 7-2z" /></>),
  trendLine: svg(<><line x1="4" y1="19" x2="20" y2="5" /><circle cx="4" cy="19" r="1.6" /><circle cx="20" cy="5" r="1.6" /></>),
  ray: svg(<><line x1="4" y1="18" x2="21" y2="6" /><circle cx="4" cy="18" r="1.6" /></>),
  extendedLine: svg(<><line x1="3" y1="18" x2="21" y2="6" /><circle cx="9" cy="14" r="1.4" /><circle cx="15" cy="10" r="1.4" /></>),
  horizontalLine: svg(<><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.6" /></>),
  horizontalRay: svg(<><line x1="6" y1="12" x2="21" y2="12" /><circle cx="6" cy="12" r="1.6" /></>),
  verticalLine: svg(<><line x1="12" y1="3" x2="12" y2="21" /><circle cx="12" cy="12" r="1.6" /></>),
  rectangle: svg(<><rect x="4" y="6" width="16" height="12" rx="1" /></>),
  fibRetracement: svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><line x1="4" y1="18" x2="20" y2="18" /></>),
  text: svg(<><path d="M6 6h12" /><path d="M12 6v13" /></>),
};

const GROUPS: { key: string; label: string; primary: DrawToolId; tools: DrawToolId[] }[] = [
  { key: "cursor", label: "Cursor", primary: "cursor", tools: ["cursor"] },
  { key: "trend", label: "Lines", primary: "trendLine", tools: ["trendLine", "ray", "extendedLine", "horizontalLine", "horizontalRay", "verticalLine"] },
  { key: "fib", label: "Fib", primary: "fibRetracement", tools: ["fibRetracement"] },
  { key: "shapes", label: "Shapes", primary: "rectangle", tools: ["rectangle"] },
  { key: "annotation", label: "Text", primary: "text", tools: ["text"] },
];

type Props = {
  activeTool: DrawToolId;
  keepDrawing: boolean;
  onSelectTool: (tool: DrawToolId) => void;
  onToggleKeepDrawing: () => void;
  onOpenSettings: () => void;
  hasSelection: boolean;
  onDeleteSelection: () => void;
};

export default function ChartDrawToolbar({
  activeTool,
  keepDrawing,
  onSelectTool,
  onToggleKeepDrawing,
  onOpenSettings,
  hasSelection,
  onDeleteSelection,
}: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openGroup) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (Object.values(triggers.current).some((n) => n?.contains(target))) return;
      setOpenGroup(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openGroup]);

  const openFlyout = (key: string) => {
    const rect = triggers.current[key]?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ left: Math.max(8, rect.left), top: rect.bottom + 4 });
    setOpenGroup(key);
  };

  const chip = "flex h-6 shrink-0 items-center gap-1 rounded-[3px] border px-1.5 transition-colors";
  const flyoutGroup = GROUPS.find((g) => g.key === openGroup) ?? null;

  return (
    <div className="pointer-events-auto absolute left-0 right-[var(--chart-price-axis-inset,64px)] top-0 z-[26] flex h-7 min-w-0 items-center gap-1 overflow-x-auto border-b border-border/70 bg-panel/85 px-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {GROUPS.map((group) => {
        const Primary = ICONS[group.primary];
        const groupActive = group.tools.includes(activeTool);
        const multi = group.tools.length > 1;
        return (
          <div key={group.key} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onSelectTool(group.primary === "cursor" ? "cursor" : (group.tools.includes(activeTool) ? activeTool : group.primary))}
              className={`${chip} ${groupActive ? "border-primary/40 bg-primary/[0.10] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
              title={DRAW_TOOL_SPECS[group.primary].label}
            >
              <Primary className="h-4 w-4" />
            </button>
            {multi ? (
              <button
                type="button"
                ref={(node) => { triggers.current[group.key] = node; }}
                onClick={() => (openGroup === group.key ? setOpenGroup(null) : openFlyout(group.key))}
                className="flex h-6 w-3 items-center justify-center rounded-[3px] text-muted hover:text-foreground"
                aria-label={`${group.label} tools`}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        );
      })}

      <span className="h-4 w-px shrink-0 bg-border/70" />
      <button
        type="button"
        onClick={onToggleKeepDrawing}
        className={`${chip} text-[9px] font-semibold uppercase tracking-[0.06em] ${keepDrawing ? "border-primary/40 bg-primary/[0.10] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
        title="Keep the tool active after drawing"
      >
        Stay
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        disabled={!hasSelection}
        className={`${chip} text-[9px] font-semibold uppercase tracking-[0.06em] ${hasSelection ? "border-transparent text-muted hover:bg-surface hover:text-foreground" : "border-transparent text-muted/30"}`}
        title="Selected drawing settings"
      >
        Style
      </button>
      <button
        type="button"
        onClick={onDeleteSelection}
        disabled={!hasSelection}
        className={`${chip} text-[9px] font-semibold uppercase tracking-[0.06em] ${hasSelection ? "border-transparent text-muted hover:bg-surface hover:text-danger" : "border-transparent text-muted/30"}`}
        title="Delete the selected drawing"
      >
        Delete
      </button>

      {openGroup && flyoutGroup && menuPos && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[280] w-[210px] overflow-hidden rounded-xl border border-border bg-panel/97 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{ left: menuPos.left, top: menuPos.top } as CSSProperties}
          >
            {flyoutGroup.tools.map((toolId) => {
              const Icon = ICONS[toolId];
              const isActive = activeTool === toolId;
              return (
                <button
                  key={toolId}
                  type="button"
                  onClick={() => { onSelectTool(toolId); setOpenGroup(null); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-[11px]">{DRAW_TOOL_SPECS[toolId].label}</span>
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
