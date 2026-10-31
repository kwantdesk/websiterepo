import type { Trade } from "./backtester";
export type AlgoChartFocus = { id: string; fromMs: number; toMs: number; atMs: number };
export type AlgoChartIntegration = {
  symbol: string; trades: (Trade & { markerVisible?: boolean })[];
  focus: AlgoChartFocus | null; onInstrumentChange: (symbol: string) => void;
};
