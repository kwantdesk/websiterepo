"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  DRAW_TOOL_GROUPS,
  DRAW_TOOL_LAST_USED_EVENT,
  DRAW_TOOL_LAST_USED_STORAGE_KEY,
  DRAW_TOOL_LIST,
  DRAW_TOOL_SPECS,
  MAGNET_STRENGTHS,
  normalizeLastUsedDrawTools,
  quickDrawToolForGroup,
  rememberLastUsedDrawTool,
  type DrawToolGroupId,
  type DrawToolId,
  type LastUsedDrawTools,
  type MagnetStrength,
} from "@/lib/chartDrawTools";

// Top charting-tools bar. Clean-room line-art icons (nothing copied from
// TradingView's assets), grouped exactly the way TradingView collapses its
// left toolbar. Selecting a tool arms the drawing overlay.
type ToolIcon = (props: { className?: string }) => ReactNode;

const svg = (children: ReactNode): ToolIcon =>
  function Icon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    );
  };

const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={1.5} fill="currentColor" stroke="none" />;

const ICONS: Partial<Record<DrawToolId, ToolIcon>> = {
  cursor: svg(<path d="M5 4l7 16 2-7 7-2z" />),
  eraser: svg(<><path d="M4 15l7-7 6 6-5 5H8z" /><path d="M4 21h16" /></>),
  trendLine: svg(<><line x1="4" y1="19" x2="20" y2="5" />{dot(4, 19)}{dot(20, 5)}</>),
  ray: svg(<><line x1="4" y1="18" x2="21" y2="6" />{dot(4, 18)}</>),
  extendedLine: svg(<><line x1="3" y1="18" x2="21" y2="6" />{dot(9, 14)}{dot(15, 10)}</>),
  trendAngle: svg(<><line x1="4" y1="19" x2="20" y2="7" /><line x1="4" y1="19" x2="18" y2="19" /><path d="M9 19a5 5 0 0 1 1.5-3.5" /></>),
  infoLine: svg(<><line x1="4" y1="18" x2="20" y2="6" /><path d="M13 4h5v5" /></>),
  horizontalLine: svg(<><line x1="3" y1="12" x2="21" y2="12" />{dot(12, 12)}</>),
  horizontalRay: svg(<><line x1="6" y1="12" x2="21" y2="12" />{dot(6, 12)}</>),
  verticalLine: svg(<><line x1="12" y1="3" x2="12" y2="21" />{dot(12, 12)}</>),
  crossLine: svg(<><line x1="3" y1="12" x2="21" y2="12" /><line x1="12" y1="3" x2="12" y2="21" /></>),
  parallelChannel: svg(<><line x1="4" y1="17" x2="20" y2="7" /><line x1="4" y1="21" x2="20" y2="11" /></>),
  flatChannel: svg(<><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" /></>),
  fibRetracement: svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><line x1="4" y1="18" x2="20" y2="18" /></>),
  fibExtension: svg(<><line x1="4" y1="18" x2="10" y2="6" /><line x1="10" y1="6" x2="14" y2="14" /><line x1="12" y1="8" x2="21" y2="8" /><line x1="12" y1="12" x2="21" y2="12" /></>),
  fibChannel: svg(<><line x1="4" y1="16" x2="18" y2="6" /><line x1="6" y1="18" x2="20" y2="8" /><line x1="8" y1="20" x2="22" y2="10" /></>),
  fibTimeZone: svg(<><line x1="6" y1="4" x2="6" y2="20" /><line x1="10" y1="4" x2="10" y2="20" /><line x1="16" y1="4" x2="16" y2="20" /></>),
  fibCircles: svg(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.5" /></>),
  fibSpeedFan: svg(<><line x1="4" y1="20" x2="20" y2="6" /><line x1="4" y1="20" x2="20" y2="12" /><line x1="4" y1="20" x2="20" y2="18" /></>),
  xabcd: svg(<><path d="M4 18l4-10 4 8 4-10 4 8" /></>),
  abcd: svg(<><path d="M5 18l5-10 4 8 5-10" /></>),
  trianglePattern: svg(<><path d="M4 18l5-8 5 6 6-9" /></>),
  headShoulders: svg(<><path d="M3 17l4-4 3 2 2-7 2 7 3-2 4 4" /></>),
  threeDrivers: svg(<><path d="M3 18l3-5 3 4 3-7 3 5 3-8 3 6" /></>),
  longPosition: svg(<><rect x="5" y="5" width="14" height="6" /><rect x="5" y="13" width="14" height="6" /><line x1="5" y1="11" x2="19" y2="11" strokeWidth={2} /></>),
  shortPosition: svg(<><rect x="5" y="13" width="14" height="6" /><rect x="5" y="5" width="14" height="6" /><line x1="5" y1="13" x2="19" y2="13" strokeWidth={2} /></>),
  forecast: svg(<><path d="M4 16l6-4" /><path d="M10 12l4 6 6-12" strokeDasharray="3 2" /></>),
  priceRange: svg(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="8" y1="5" x2="16" y2="5" /><line x1="8" y1="19" x2="16" y2="19" /></>),
  dateRange: svg(<><line x1="5" y1="12" x2="19" y2="12" /><line x1="5" y1="8" x2="5" y2="16" /><line x1="19" y1="8" x2="19" y2="16" /></>),
  datePriceRange: svg(<><rect x="5" y="6" width="14" height="12" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  rectangle: svg(<rect x="4" y="6" width="16" height="12" rx="1" />),
  rotatedRectangle: svg(<path d="M4 12l6-6 10 6-6 6z" />),
  ellipse: svg(<ellipse cx="12" cy="12" rx="9" ry="6" />),
  circle: svg(<circle cx="12" cy="12" r="8" />),
  triangleShape: svg(<path d="M12 4l8 16H4z" />),
  polyline: svg(<><path d="M4 18l5-8 4 5 7-9" />{dot(4, 18)}{dot(9, 10)}{dot(13, 15)}{dot(20, 6)}</>),
  path: svg(<><path d="M4 18l5-8 4 5 7-9" /><path d="M18 4l2 2-2 2" /></>),
  brush: svg(<path d="M4 20c3 0 3-4 6-4s3 4 6-2 4-8 4-8" />),
  highlighter: svg(<><path d="M6 18l8-8 3 3-8 8H6z" /><line x1="4" y1="21" x2="20" y2="21" strokeWidth={3} /></>),
  text: svg(<><path d="M6 6h12" /><path d="M12 6v13" /></>),
  note: svg(<><rect x="5" y="4" width="14" height="12" rx="2" /><path d="M9 20l3-4" /></>),
  callout: svg(<><rect x="4" y="5" width="12" height="9" rx="2" /><path d="M8 14l-2 5 6-5" /></>),
  priceLabel: svg(<><rect x="4" y="9" width="16" height="6" rx="1" /><path d="M20 12h1" /></>),
  signpost: svg(<><line x1="12" y1="4" x2="12" y2="20" /><rect x="12" y="6" width="8" height="6" /></>),
  // The sideways triangles the chart paints on a real fill: an entry points
  // RIGHT into the trade, an exit points LEFT out of it.
  entryArrow: svg(<path d="M7 6l10 6-10 6z" fill="currentColor" stroke="none" />),
  exitArrow: svg(<path d="M17 6L7 12l10 6z" fill="currentColor" stroke="none" />),
  arrowMarker: svg(<><line x1="4" y1="20" x2="18" y2="6" /><path d="M13 5h6v6" /></>),
  flagMark: svg(<><line x1="6" y1="4" x2="6" y2="20" /><path d="M6 5h11l-3 4 3 4H6z" /></>),
  measure: svg(<><rect x="4" y="7" width="16" height="10" /><line x1="8" y1="7" x2="8" y2="11" /><line x1="12" y1="7" x2="12" y2="11" /><line x1="16" y1="7" x2="16" y2="11" /></>),
  regressionTrend: svg(<><line x1="4" y1="17" x2="20" y2="7" /><line x1="4" y1="20" x2="20" y2="10" strokeDasharray="2 2" /><line x1="4" y1="14" x2="20" y2="4" strokeDasharray="2 2" /></>),
  gannFan: svg(<><line x1="4" y1="20" x2="20" y2="4" /><line x1="4" y1="20" x2="20" y2="12" /><line x1="4" y1="20" x2="12" y2="4" /><line x1="4" y1="20" x2="20" y2="18" /></>),
  gannBox: svg(<><rect x="4" y="5" width="16" height="14" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="12" y1="5" x2="12" y2="19" /></>),
  pitchfork: svg(<><line x1="4" y1="12" x2="20" y2="12" /><line x1="8" y1="5" x2="20" y2="5" /><line x1="8" y1="19" x2="20" y2="19" /><line x1="4" y1="12" x2="8" y2="5" /><line x1="4" y1="12" x2="8" y2="19" /></>),
  schiffPitchfork: svg(<><line x1="4" y1="12" x2="20" y2="12" /><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="18" x2="20" y2="18" /></>),
  modifiedSchiffPitchfork: svg(<><line x1="4" y1="12" x2="20" y2="10" /><line x1="8" y1="6" x2="20" y2="5" /><line x1="8" y1="18" x2="20" y2="16" /></>),
  insidePitchfork: svg(<><line x1="6" y1="12" x2="20" y2="12" /><line x1="9" y1="8" x2="20" y2="8" /><line x1="9" y1="16" x2="20" y2="16" /></>),
  cypher: svg(<><path d="M4 16l4-9 4 6 4-9 4 8" /></>),
  elliottImpulse: svg(<><path d="M3 19l3-5 3 3 3-8 3 5 4-9" /></>),
  elliottCorrection: svg(<><path d="M5 8l4 8 4-6 5 7" /></>),
  barsPattern: svg(<><line x1="7" y1="5" x2="7" y2="19" /><rect x="5.5" y="9" width="3" height="6" fill="currentColor" stroke="none" /><line x1="14" y1="5" x2="14" y2="19" /><rect x="12.5" y="7" width="3" height="8" fill="currentColor" stroke="none" /></>),
  fixedRangeVolumeProfile: svg(<><line x1="4" y1="4" x2="4" y2="20" /><rect x="4" y="5" width="10" height="2.4" fill="currentColor" stroke="none" /><rect x="4" y="9" width="14" height="2.4" fill="currentColor" stroke="none" /><rect x="4" y="13" width="7" height="2.4" fill="currentColor" stroke="none" /><rect x="4" y="17" width="4" height="2.4" fill="currentColor" stroke="none" /></>),
  anchoredVolumeProfile: svg(<><path d="M4 4v16" /><rect x="4" y="6" width="8" height="2.2" fill="currentColor" stroke="none" /><rect x="4" y="10" width="13" height="2.2" fill="currentColor" stroke="none" /><rect x="4" y="14" width="6" height="2.2" fill="currentColor" stroke="none" /></>),
  anchoredVwap: svg(<><path d="M4 18v2" /><path d="M4 18c4 0 6-9 9-9s3 5 7-4" strokeDasharray="1 0" /></>),
};

const fallbackIcon = svg(<circle cx="12" cy="12" r="7" />);
const iconFor = (id: DrawToolId): ToolIcon => ICONS[id] ?? fallbackIcon;
const toolsOf = (group: DrawToolGroupId): DrawToolId[] => DRAW_TOOL_LIST.filter((t) => t.group === group).map((t) => t.id);

type Props = {
  activeTool: DrawToolId;
  keepDrawing: boolean;
  magnet: boolean;
  magnetStrength: MagnetStrength;
  onSelectTool: (tool: DrawToolId) => void;
  onToggleKeepDrawing: () => void;
  onToggleMagnet: () => void;
  onSelectMagnetStrength: (strength: MagnetStrength) => void;
  onOpenSettings: () => void;
  hasSelection: boolean;
  onDeleteSelection: () => void;
  onClearAll: () => void;
};

export default function ChartDrawToolbar({
  activeTool, keepDrawing, magnet, magnetStrength, onSelectTool, onToggleKeepDrawing, onToggleMagnet, onSelectMagnetStrength, onOpenSettings, hasSelection, onDeleteSelection, onClearAll,
}: Props) {
  const [magnetMenuOpen, setMagnetMenuOpen] = useState(false);
  const [magnetMenuPos, setMagnetMenuPos] = useState<{ left: number; top: number } | null>(null);
  const magnetTrigger = useRef<HTMLButtonElement | null>(null);
  const magnetMenuRef = useRef<HTMLDivElement>(null);
  const [openGroup, setOpenGroup] = useState<DrawToolGroupId | null>(null);
  const [lastUsedToolByGroup, setLastUsedToolByGroup] = useState<LastUsedDrawTools>({});
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncLastUsed = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== DRAW_TOOL_LAST_USED_STORAGE_KEY) return;
      try {
        const stored = JSON.parse(window.localStorage.getItem(DRAW_TOOL_LAST_USED_STORAGE_KEY) ?? "{}");
        setLastUsedToolByGroup(normalizeLastUsedDrawTools(stored));
      } catch {
        setLastUsedToolByGroup({});
      }
    };

    syncLastUsed();
    window.addEventListener("storage", syncLastUsed);
    window.addEventListener(DRAW_TOOL_LAST_USED_EVENT, syncLastUsed);
    return () => {
      window.removeEventListener("storage", syncLastUsed);
      window.removeEventListener(DRAW_TOOL_LAST_USED_EVENT, syncLastUsed);
    };
  }, []);

  const selectTool = (tool: DrawToolId) => {
    const next = rememberLastUsedDrawTool(lastUsedToolByGroup, tool);
    setLastUsedToolByGroup(next);
    try {
      window.localStorage.setItem(DRAW_TOOL_LAST_USED_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(DRAW_TOOL_LAST_USED_EVENT));
    } catch {
      // The current chart still remembers in memory when storage is blocked.
    }
    onSelectTool(tool);
  };

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

  useEffect(() => {
    if (!magnetMenuOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (magnetMenuRef.current?.contains(target)) return;
      if (magnetTrigger.current?.contains(target)) return;
      setMagnetMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [magnetMenuOpen]);

  const openFlyout = (group: DrawToolGroupId) => {
    const rect = triggers.current[group]?.getBoundingClientRect();
    if (!rect) return;
    // The rail sits on the chart's left edge, so flyouts open to the RIGHT of
    // their trigger, clamped inside the viewport vertically.
    setMenuPos({
      left: Math.min(rect.right + 6, window.innerWidth - 226),
      top: Math.max(8, Math.min(rect.top, window.innerHeight - 340)),
    });
    setOpenGroup(group);
  };

  const chip = "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border transition-colors";
  const textChip = "flex h-5 w-7 shrink-0 items-center justify-center rounded-[3px] border text-[8px] font-semibold uppercase tracking-[0.02em] transition-colors";
  const flyoutTools = openGroup ? toolsOf(openGroup) : [];

  return (
    <div className="pointer-events-auto z-[26] flex h-full w-9 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-border/70 bg-panel/85 py-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {DRAW_TOOL_GROUPS.map((group) => {
        const groupTools = toolsOf(group.id);
        const shown = quickDrawToolForGroup(group.id, activeTool, lastUsedToolByGroup);
        const Icon = iconFor(shown);
        const groupActive = groupTools.includes(activeTool);
        const multi = groupTools.length > 1;
        return (
          <div key={group.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => selectTool(shown)}
              className={`${chip} ${groupActive ? "border-primary/40 bg-primary/[0.10] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
              title={DRAW_TOOL_SPECS[shown].label}
            >
              <Icon className="h-4 w-4" />
            </button>
            {multi ? (
              <button
                type="button"
                ref={(node) => { triggers.current[group.id] = node; }}
                onClick={() => (openGroup === group.id ? setOpenGroup(null) : openFlyout(group.id))}
                className="absolute -right-0.5 bottom-0 flex h-3 w-3 items-center justify-center rounded-[2px] text-muted hover:text-foreground"
                aria-label={`${group.label} tools`}
              >
                <ChevronDown className="h-2.5 w-2.5 -rotate-90" />
              </button>
            ) : null}
          </div>
        );
      })}

      <span className="my-0.5 h-px w-4 shrink-0 bg-border/70" />
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={onToggleMagnet}
          className={`${chip} ${magnet ? "border-primary/40 bg-primary/[0.10] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
          title={`Magnet (${magnetStrength}) - snap drawing points to the nearest candle wick/body`}
          aria-pressed={magnet}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4v7a6 6 0 0 0 12 0V4" /><path d="M6 8h4" /><path d="M14 8h4" />
          </svg>
        </button>
        <button
          type="button"
          ref={magnetTrigger}
          onClick={() => {
            const rect = magnetTrigger.current?.getBoundingClientRect();
            if (!rect) return;
            setMagnetMenuPos({
              left: Math.min(rect.right + 6, window.innerWidth - 186),
              top: Math.max(8, Math.min(rect.top, window.innerHeight - 96)),
            });
            setMagnetMenuOpen((value) => !value);
          }}
          className="absolute -right-0.5 bottom-0 flex h-3 w-3 items-center justify-center rounded-[2px] text-muted hover:text-foreground"
          aria-label="Magnet strength"
        >
          <ChevronDown className="h-2.5 w-2.5 -rotate-90" />
        </button>
      </div>
      <button type="button" onClick={onToggleKeepDrawing} className={`${textChip} ${keepDrawing ? "border-primary/40 bg-primary/[0.10] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`} title="Keep the tool active after drawing">Stay</button>
      <button type="button" onClick={onOpenSettings} disabled={!hasSelection} className={`${textChip} ${hasSelection ? "border-transparent text-muted hover:bg-surface hover:text-foreground" : "border-transparent text-muted/30"}`} title="Selected drawing style">Sty</button>
      <button type="button" onClick={onDeleteSelection} disabled={!hasSelection} className={`${textChip} ${hasSelection ? "border-transparent text-muted hover:bg-surface hover:text-danger" : "border-transparent text-muted/30"}`} title="Delete selected drawing">Del</button>
      <button type="button" onClick={onClearAll} className={`${textChip} border-transparent text-muted hover:bg-surface hover:text-danger`} title="Remove every drawing on this chart">Clr</button>

      {magnetMenuOpen && magnetMenuPos && typeof document !== "undefined"
        ? createPortal(
          <div ref={magnetMenuRef} className="fixed z-[280] w-[178px] rounded-xl border border-border bg-panel/97 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl" style={{ left: magnetMenuPos.left, top: magnetMenuPos.top } as CSSProperties}>
            {MAGNET_STRENGTHS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => { onSelectMagnetStrength(entry.id); setMagnetMenuOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] ${magnetStrength === entry.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface"}`}
              >
                <span>{entry.label}</span>
                <span className="text-[9px] text-muted">{entry.radiusPx}px</span>
              </button>
            ))}
          </div>,
          document.body,
        )
        : null}

      {openGroup && menuPos && typeof document !== "undefined"
        ? createPortal(
          <div ref={menuRef} className="fixed z-[280] max-h-[70vh] w-[218px] overflow-y-auto rounded-xl border border-border bg-panel/97 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl" style={{ left: menuPos.left, top: menuPos.top } as CSSProperties}>
            {flyoutTools.map((toolId) => {
              const Icon = iconFor(toolId);
              const isActive = activeTool === toolId;
              return (
                <button key={toolId} type="button" onClick={() => { selectTool(toolId); setOpenGroup(null); }} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface"}`}>
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
