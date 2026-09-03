"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { GexCalCell, GexCalMatrix } from "@/lib/gexCalendar";

const ROW_HEIGHT = 30;
const STRIKE_WIDTH = 92;
const VISIBLE_EXPIRATION_COLUMNS = 7;
const MIN_CELL_WIDTH = 72;

type Props = {
  matrix: GexCalMatrix;
  differenceMode: boolean;
  normalization: "GLOBAL" | "COLUMN" | "ROW" | "PERCENTILE";
  selected: GexCalCell | null;
  onSelect: (cell: GexCalCell) => void;
  onOpen: (cell: GexCalCell) => void;
  showStars: boolean;
};

const compact = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  if (absolute >= 1e12) return `${sign}${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(1)}M`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

function GexCalendarMatrix({ matrix, differenceMode, normalization, selected, onSelect, onOpen, showStars }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerTrackRef = useRef<HTMLDivElement>(null);
  const cellWidthRef = useRef(MIN_CELL_WIDTH);
  const rowHeightRef = useRef(ROW_HEIGHT);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({ top: 0, left: 0 });
  const [viewport, setViewport] = useState({ top: 0, left: 0, width: 900, height: 500 });
  const { values, byKey, columnMax, rowMax } = useMemo(() => {
    const nextValues: number[] = [];
    const nextByKey = new Map<string, GexCalCell>();
    const nextColumnMax = new Map<string, number>();
    const nextRowMax = new Map<number, number>();

    for (const cell of matrix.cells) {
      const absolute = Math.abs(differenceMode ? cell.change ?? 0 : cell.value);
      nextByKey.set(`${cell.strike}:${cell.expiration}`, cell);
      if (absolute) nextValues.push(absolute);
      if (absolute > (nextColumnMax.get(cell.expiration) ?? 0)) nextColumnMax.set(cell.expiration, absolute);
      if (absolute > (nextRowMax.get(cell.strike) ?? 0)) nextRowMax.set(cell.strike, absolute);
    }
    nextValues.sort((a, b) => a - b);
    return { values: nextValues, byKey: nextByKey, columnMax: nextColumnMax, rowMax: nextRowMax };
  }, [differenceMode, matrix.cells]);
  const starKey = matrix.globalStar ? `${matrix.globalStar.strike}:${matrix.globalStar.expiration}` : "";
  const currentStrike = useMemo(() => {
    if (!Number.isFinite(matrix.spot) || matrix.spot === null || matrix.strikes.length === 0) return null;
    return matrix.strikes.reduce((nearest, strike) => {
      const nearestDistance = Math.abs(nearest - matrix.spot!);
      const strikeDistance = Math.abs(strike - matrix.spot!);
      return strikeDistance < nearestDistance ? strike : nearest;
    });
  }, [matrix.spot, matrix.strikes]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setViewport((current) => current.width === width && current.height === height
        ? current
        : { ...current, width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    pendingScrollRef.current = {
      top: event.currentTarget.scrollTop,
      left: event.currentTarget.scrollLeft,
    };
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const next = pendingScrollRef.current;
      const cellWidth = cellWidthRef.current;
      const liveRowHeight = rowHeightRef.current;
      const top = Math.floor(next.top / liveRowHeight) * liveRowHeight;
      const left = Math.floor(next.left / cellWidth) * cellWidth;
      if (headerTrackRef.current) {
        headerTrackRef.current.style.transform = `translate3d(${-next.left}px, 0, 0)`;
      }
      setViewport((current) => current.top === top && current.left === left
        ? current
        : { ...current, top, left });
    });
  }, []);

  // The surface always reaches the right and bottom edges: columns divide the
  // viewport across however many expirations exist (up to the visible cap),
  // and rows stretch taller when the strike list is shorter than the pane.
  const columnCount = Math.max(1, Math.min(VISIBLE_EXPIRATION_COLUMNS, matrix.expirations.length));
  const rowHeight = matrix.strikes.length > 0 && matrix.strikes.length * ROW_HEIGHT < viewport.height
    ? viewport.height / matrix.strikes.length
    : ROW_HEIGHT;
  rowHeightRef.current = rowHeight;
  const startRow = Math.max(0, Math.floor(viewport.top / rowHeight) - 5);
  const endRow = Math.min(matrix.strikes.length, Math.ceil((viewport.top + viewport.height) / rowHeight) + 5);
  const cellWidth = Math.max(
    MIN_CELL_WIDTH,
    (viewport.width - STRIKE_WIDTH) / columnCount,
  );
  cellWidthRef.current = cellWidth;
  const startColumn = Math.max(0, Math.floor(viewport.left / cellWidth) - 2);
  const endColumn = Math.min(matrix.expirations.length, Math.ceil((viewport.left + Math.max(0, viewport.width - STRIKE_WIDTH)) / cellWidth) + 2);
  const visibleRows = matrix.strikes.slice(startRow, endRow);
  const visibleColumns = matrix.expirations.slice(startColumn, endColumn);
  const scale = (absolute: number, expiration: string, strike: number) => {
    if (!absolute) return 0;
    if (normalization === "COLUMN") return Math.min(1, absolute / Math.max(1, columnMax.get(expiration) ?? 1));
    if (normalization === "ROW") return Math.min(1, absolute / Math.max(1, rowMax.get(strike) ?? 1));
    if (normalization === "PERCENTILE") {
      let low = 0; let high = values.length;
      while (low < high) { const mid = (low + high) >> 1; if (values[mid] <= absolute) low = mid + 1; else high = mid; }
      return low / Math.max(1, values.length);
    }
    return Math.min(1, absolute / Math.max(1, values.at(-1) ?? 1));
  };
  const totalWidth = STRIKE_WIDTH + matrix.expirations.length * cellWidth;
  const totalHeight = matrix.strikes.length * rowHeight;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden border border-border bg-background [contain:layout_paint]" aria-label="GEX expiration by strike matrix">
      <div className="absolute left-0 top-0 z-20 flex h-9 w-[92px] items-center border-b border-r border-border bg-panel px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Strike</div>
      <div className="absolute left-[92px] right-0 top-0 z-10 h-9 overflow-hidden border-b border-border bg-panel">
        <div ref={headerTrackRef} className="relative h-full will-change-transform" style={{ width: totalWidth - STRIKE_WIDTH, transform: `translate3d(${-pendingScrollRef.current.left}px, 0, 0)` }}>
          {visibleColumns.map((expiration, index) => <div key={expiration} className="absolute top-0 flex h-9 items-center justify-center border-r border-border px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground" style={{ left: (startColumn + index) * cellWidth, width: cellWidth }}>{expiration.slice(5)}</div>)}
        </div>
      </div>
      <div
        ref={viewportRef}
        className="absolute inset-x-0 bottom-0 top-9 overflow-x-scroll overflow-y-auto"
        onScroll={handleScroll}
        aria-label="Scrollable GEX calendar surface"
      >
        <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
          {visibleRows.map((strike, rowIndex) => {
            const actualRow = startRow + rowIndex;
            const isCurrentStrike = strike === currentStrike;
            return <div key={strike} className="absolute left-0" style={{ top: actualRow * rowHeight, width: totalWidth, height: rowHeight }}>
              <div
                aria-current={isCurrentStrike ? "true" : undefined}
                className={`sticky left-0 z-10 flex items-center justify-end border-b border-r px-3 font-mono text-[10px] transition-[background-color,color,border-color,box-shadow] ${isCurrentStrike
                  ? "border-primary bg-[color-mix(in_srgb,var(--primary)_24%,var(--panel))] font-semibold text-primary shadow-[inset_3px_0_0_var(--primary),0_0_18px_color-mix(in_srgb,var(--primary)_38%,transparent)]"
                  : "border-border bg-panel text-foreground"}`}
                style={{ width: STRIKE_WIDTH, height: rowHeight }}
                title={isCurrentStrike ? `Current strike nearest ${matrix.spot?.toLocaleString()}` : undefined}
              >
                {strike.toLocaleString()}
              </div>
              {visibleColumns.map((expiration, columnIndex) => {
                const cell = byKey.get(`${strike}:${expiration}`);
                const value = cell ? (differenceMode ? cell.change : cell.value) : null;
                const magnitude = value === null ? 0 : scale(Math.abs(value ?? 0), expiration, strike);
                const positive = (value ?? 0) >= 0;
                const isStar = showStars && `${strike}:${expiration}` === starKey;
                const isSelected = selected?.strike === strike && selected.expiration === expiration;
                return <button
                  key={expiration}
                  type="button"
                  disabled={!cell}
                  onClick={() => cell && onSelect(cell)}
                  onDoubleClick={() => cell && onOpen(cell)}
                  onContextMenu={(event) => { event.preventDefault(); if (cell) onOpen(cell); }}
                  className={`absolute flex items-center justify-center border-b border-r border-border font-mono text-[9px] transition-[filter,outline] ${cell ? "hover:brightness-125" : "bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,color-mix(in_srgb,var(--border)_18%,transparent)_5px,color-mix(in_srgb,var(--border)_18%,transparent)_6px)] text-muted/30"} ${isSelected ? "outline outline-1 outline-primary" : ""}`}
                  style={{
                    left: STRIKE_WIDTH + (startColumn + columnIndex) * cellWidth,
                    top: 0,
                    width: cellWidth,
                    height: rowHeight,
                    color: cell ? "var(--foreground)" : undefined,
                    background: cell ? `color-mix(in srgb, ${positive ? "var(--candle-up)" : "var(--candle-down)"} ${Math.round(10 + magnitude * 76)}%, var(--background))` : undefined,
                    boxShadow: isStar ? "inset 0 0 0 2px var(--primary), 0 0 12px color-mix(in srgb, var(--primary) 42%, transparent)" : undefined,
                  }}
                  title={cell ? `${expiration} · ${strike}\n${compact(value ?? 0)}` : "Missing provider cell"}
                >
                  {isStar ? <Star className="mr-1 h-3 w-3 fill-current text-primary" /> : null}
                  {cell ? compact(value ?? 0) : "—"}
                </button>;
              })}
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(GexCalendarMatrix);
