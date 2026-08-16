"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Crown } from "lucide-react";
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
  showKings: boolean;
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

function GexCalendarMatrix({ matrix, differenceMode, normalization, selected, onSelect, onOpen, showKings }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, left: 0, width: 900, height: 500 });
  const values = useMemo(() => matrix.cells.map((cell) => Math.abs(differenceMode ? cell.change ?? 0 : cell.value)).filter(Boolean).sort((a, b) => a - b), [differenceMode, matrix.cells]);
  const byKey = useMemo(() => new Map(matrix.cells.map((cell) => [`${cell.strike}:${cell.expiration}`, cell])), [matrix.cells]);
  const columnMax = useMemo(() => new Map(matrix.expirations.map((expiration) => [expiration, Math.max(0, ...matrix.cells.filter((cell) => cell.expiration === expiration).map((cell) => Math.abs(differenceMode ? cell.change ?? 0 : cell.value)))])), [differenceMode, matrix]);
  const rowMax = useMemo(() => new Map(matrix.strikes.map((strike) => [strike, Math.max(0, ...matrix.cells.filter((cell) => cell.strike === strike).map((cell) => Math.abs(differenceMode ? cell.change ?? 0 : cell.value)))])), [differenceMode, matrix]);
  const kingKey = matrix.globalKing ? `${matrix.globalKing.strike}:${matrix.globalKing.expiration}` : "";

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setViewport((current) => ({ ...current, width: node.clientWidth, height: node.clientHeight }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const startRow = Math.max(0, Math.floor(viewport.top / ROW_HEIGHT) - 5);
  const endRow = Math.min(matrix.strikes.length, Math.ceil((viewport.top + viewport.height) / ROW_HEIGHT) + 5);
  const cellWidth = Math.max(
    MIN_CELL_WIDTH,
    (viewport.width - STRIKE_WIDTH) / VISIBLE_EXPIRATION_COLUMNS,
  );
  const startColumn = Math.max(0, Math.floor(Math.max(0, viewport.left - STRIKE_WIDTH) / cellWidth) - 2);
  const endColumn = Math.min(matrix.expirations.length, Math.ceil((Math.max(0, viewport.left - STRIKE_WIDTH) + viewport.width) / cellWidth) + 2);
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
  const totalHeight = matrix.strikes.length * ROW_HEIGHT;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden border border-border bg-background" aria-label="GEX expiration by strike matrix">
      <div className="absolute left-0 top-0 z-20 flex h-9 w-[92px] items-center border-b border-r border-border bg-panel px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Strike</div>
      <div className="absolute left-[92px] right-0 top-0 z-10 h-9 overflow-hidden border-b border-border bg-panel">
        <div className="relative h-full" style={{ width: totalWidth - STRIKE_WIDTH, transform: `translateX(${-Math.max(0, viewport.left - STRIKE_WIDTH)}px)` }}>
          {visibleColumns.map((expiration, index) => <div key={expiration} className="absolute top-0 flex h-9 items-center justify-center border-r border-border px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground" style={{ left: (startColumn + index) * cellWidth, width: cellWidth }}>{expiration.slice(5)}</div>)}
        </div>
      </div>
      <div
        ref={viewportRef}
        className="absolute inset-x-0 bottom-0 top-9 overflow-x-scroll overflow-y-auto [scrollbar-color:var(--primary)_var(--panel)] [scrollbar-width:thin]"
        onScroll={(event) => setViewport((current) => ({ ...current, top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }))}
        aria-label="Scrollable GEX calendar surface"
      >
        <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
          {visibleRows.map((strike, rowIndex) => {
            const actualRow = startRow + rowIndex;
            return <div key={strike}>
              <div className="sticky left-0 z-10 flex items-center justify-end border-b border-r border-border bg-panel px-3 font-mono text-[10px] text-foreground" style={{ position: "absolute", left: viewport.left, top: actualRow * ROW_HEIGHT, width: STRIKE_WIDTH, height: ROW_HEIGHT }}>{strike.toLocaleString()}</div>
              {visibleColumns.map((expiration, columnIndex) => {
                const cell = byKey.get(`${strike}:${expiration}`);
                const value = cell ? (differenceMode ? cell.change : cell.value) : null;
                const magnitude = value === null ? 0 : scale(Math.abs(value ?? 0), expiration, strike);
                const positive = (value ?? 0) >= 0;
                const isKing = showKings && `${strike}:${expiration}` === kingKey;
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
                    top: actualRow * ROW_HEIGHT,
                    width: cellWidth,
                    height: ROW_HEIGHT,
                    color: cell ? "var(--foreground)" : undefined,
                    background: cell ? `color-mix(in srgb, ${positive ? "var(--candle-up)" : "var(--candle-down)"} ${Math.round(10 + magnitude * 76)}%, var(--background))` : undefined,
                    boxShadow: isKing ? "inset 0 0 0 2px var(--primary), 0 0 12px color-mix(in srgb, var(--primary) 42%, transparent)" : undefined,
                  }}
                  title={cell ? `${expiration} · ${strike}\n${compact(value ?? 0)}` : "Missing provider cell"}
                >
                  {isKing ? <Crown className="mr-1 h-3 w-3 text-primary" /> : null}
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
