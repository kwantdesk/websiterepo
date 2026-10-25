import type { Drawing, DrawPoint } from "@/lib/chartDrawTools";
import type { DrawCandle } from "@/components/ChartDrawLayer";

export type StateDrawingGeometry = {
  left: number; right: number; top: number; bottom: number;
  startTime: number; endTime: number; minPrice: number; maxPrice: number;
  timeX(time: number): number; priceY(price: number): number;
};
export type StateDrawingFrame = {
  ticker: string; width: number; height: number; geometry: StateDrawingGeometry | null;
  candles: Array<Omit<DrawCandle, "volume"> & { volume?: number }>;
  multiplier: number; offset: number; interval: number; bullish: string; bearish: string;
  lastPrice?: number | null;
  active?: boolean;
  replayTimestampMs?: number | null;
  panelId?: string;
  indicatorPaneHost?: HTMLElement | null;
  candlesVisible?: boolean;
};
export type StateDrawingApi = {
  read(ticker?: string): Drawing[]; write(drawings: Drawing[], ticker?: string): void; activate(): void;
  zoom(event: { x: number; y: number; deltaY: number; deltaMode: number; ctrlKey: boolean }): void;
  readIndicators?(ticker: string): import("@/lib/chartIndicatorCatalog").ChartIndicatorInstance[];
  writeIndicators?(indicators: import("@/lib/chartIndicatorCatalog").ChartIndicatorInstance[], ticker: string): void;
  reserveIndicatorHeight?(height: number): void;
  setPriceVisible?(visible: boolean): void;
};
export type StateDrawingMount = {
  update(frame: StateDrawingFrame): void; dispose(): void;
};
// Drawings use the SAME seconds/raw-price convention as normal chart drawings.
// Only the display projection applies the State multiplier/offset. Exposure,
// strike-row positions and the positioning snapshot clock never own anchors.
export function stateDrawingCoordinates(frame: () => StateDrawingFrame) {
  return {
    toX(time: number) { const g = frame().geometry; return g ? g.timeX(time * 1000) : null; },
    toY(price: number) { const f = frame(); return f.geometry ? f.geometry.priceY(price * f.multiplier + f.offset) : null; },
    fromXY(x: number, y: number): DrawPoint | null {
      const f = frame(), g = f.geometry;
      if (!g || !Number.isFinite(f.multiplier) || f.multiplier <= 0 || x < g.left || x > g.right || y < g.top || y > g.bottom
        || !(g.endTime > g.startTime) || !(g.maxPrice > g.minPrice)) return null;
      return {
        time: (g.startTime + (x - g.left) / (g.right - g.left) * (g.endTime - g.startTime)) / 1000,
        price: (g.maxPrice - (y - g.top) / (g.bottom - g.top) * (g.maxPrice - g.minPrice) - f.offset) / f.multiplier,
      };
    },
  };
}
export const stateDrawingSource = (ticker: string) => ticker === "ES_SPX" ? "ES" : ticker === "NQ_NDX" ? "NQ" : ticker === "SPXW" ? "SPX" : ticker;
export function stateProfileWindow(drawing: Drawing, frame: StateDrawingFrame) {
  const times = drawing.points.map(point => point.time * 1000);
  if (!times.length || !times.every(Number.isFinite)) return null;
  const startMs = Math.floor(Math.min(...times));
  const endMs = Math.ceil(drawing.tool === "anchoredVolumeProfile"
    ? (frame.candles.at(-1)?.time ?? startMs) + frame.interval
    : Math.max(...times));
  return endMs > startMs ? { startMs, endMs } : null;
}
