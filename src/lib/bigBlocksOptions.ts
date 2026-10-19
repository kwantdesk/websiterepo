import type { GexFlowRow } from "./gexFlow";

export const BIG_BLOCKS_OPTIONS_DEFAULTS = {
  minContracts: 100, minPremium: 0, binSize: 0.25, windowMinutes: 0,
  maxLevels: 60, widthPx: 150, barHeight: 12, opacity: 85,
  useStrikePrice: false, sizeByPremium: false, includeMultiLeg: false,
  showCalls: true, showPuts: true, showValues: true, useThemeColors: true,
  callColor: "#22c55e", putColor: "#ef4444",
};
export type BigOptionsSettings = typeof BIG_BLOCKS_OPTIONS_DEFAULTS;
export function normalizeBigOptionsSettings(input: Record<string, unknown> = {}): BigOptionsSettings {
  const result = { ...BIG_BLOCKS_OPTIONS_DEFAULTS };
  const limits: Record<string, [number, number]> = {
    minContracts: [0, 1000000], minPremium: [0, 1000000000], binSize: [0.01, 1000],
    windowMinutes: [0, 1440], maxLevels: [1, 200], widthPx: [30, 400], barHeight: [4, 30], opacity: [10, 100],
  };
  for (const key of Object.keys(result) as Array<keyof BigOptionsSettings>) {
    const value = input[key];
    if (typeof result[key] === "number" && typeof value === "number" && Number.isFinite(value)) {
      const [min, max] = limits[key];
      Object.assign(result, { [key]: Math.max(min, Math.min(max, value)) });
    } else if (typeof result[key] === "boolean" && typeof value === "boolean") Object.assign(result, { [key]: value });
    else if (typeof result[key] === "string" && typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) Object.assign(result, { [key]: value });
  }
  return result;
}
export type BigOptionsLevel = { price: number; call: number; put: number; callContracts: number; putContracts: number; trades: number };
type RetainedPrint = Pick<GexFlowRow, "id" | "ticker" | "contractType" | "size" | "premium" | "stockPrice" | "strikePrice" | "tradeTime" | "multiLeg">;

/** One authoritative consolidated parent per ID. Never sum comprising children. */
export class BigOptionsTape {
  private session = "";
  private records = new Map<string, RetainedPrint>();
  truncated = false;
  update(session: string, rows: readonly GexFlowRow[]) {
    if (session !== this.session) { this.records.clear(); this.session = session; this.truncated = false; }
    for (const row of rows) if (row && typeof row.id === "string" && row.id && !row.parentId && Number.isFinite(row.tradeTime)) {
      // Do not retain the tape's large Greeks/ratio/enrichment objects per pane.
      const { id, ticker, contractType, size, premium, stockPrice, strikePrice, tradeTime, multiLeg } = row;
      this.records.set(id, { id, ticker, contractType, size, premium, stockPrice, strikePrice, tradeTime, multiLeg });
    }
    if (this.records.size > 5000) {
      const retained = [...this.records.values()].sort((a, b) => b.tradeTime - a.tradeTime).slice(0, 5000);
      this.records = new Map(retained.map(row => [row.id, row]));
      this.truncated = true;
    }
  }
  size() { return this.records.size; }
  levels(symbol: string, settings: BigOptionsSettings, clockMs: number): BigOptionsLevel[] {
    const levels = new Map<number, BigOptionsLevel>();
    const cutoff = settings.windowMinutes > 0 ? clockMs - settings.windowMinutes * 60000 : -Infinity;
    for (const row of this.records.values()) {
      if (row.ticker !== symbol || row.tradeTime > clockMs || row.tradeTime < cutoff
        || !Number.isFinite(row.size) || row.size <= 0 || row.size < settings.minContracts
        || !Number.isFinite(row.premium) || row.premium < settings.minPremium
        || (!settings.includeMultiLeg && row.multiLeg)
        || (row.contractType !== "CALL" && row.contractType !== "PUT")) continue;
      if ((row.contractType === "CALL" && !settings.showCalls) || (row.contractType === "PUT" && !settings.showPuts)) continue;
      const rawPrice = settings.useStrikePrice ? row.strikePrice : row.stockPrice;
      if (rawPrice === null || !Number.isFinite(rawPrice) || rawPrice <= 0) continue;
      const price = Number((Math.round(rawPrice / settings.binSize) * settings.binSize).toFixed(8));
      const level = levels.get(price) ?? { price, call: 0, put: 0, callContracts: 0, putContracts: 0, trades: 0 };
      const value = settings.sizeByPremium ? row.premium : row.size;
      if (row.contractType === "CALL") { level.call += value; level.callContracts += row.size; }
      else { level.put += value; level.putContracts += row.size; }
      level.trades++;
      levels.set(price, level);
    }
    return [...levels.values()].sort((a, b) => Math.max(b.call, b.put) - Math.max(a.call, a.put))
      .slice(0, Math.floor(settings.maxLevels)).sort((a, b) => a.price - b.price);
  }
}
