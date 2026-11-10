import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import type { Candle } from "@/lib/backtester";

export const SPEED_OF_TAPE_DEFAULTS = {
  database: "volume", filterMin: 1, filterMax: 0, numberSeconds: 10, standardDeviationPerFilter: 0,
  paneHeight: 190, useThemeColors: true, bullBorderColor: "#22C55E", bullFillColor: "#22C55E",
  bearBorderColor: "#EF4444", bearFillColor: "#EF4444", speedOfTapeSettingsVersion: 1,
} as const;
export type SpeedOfTapeStatus = "ready" | "waiting-for-executions" | "orders-unavailable";
export type SpeedOfTapeFrame = { status: SpeedOfTapeStatus; bars: Array<{ startMs: number; endMs: number; value: number; delta: number; color: string }>; mean: number; standardDeviation: number };
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeSpeedOfTapeSettings(raw: Record<string, unknown> = {}) {
  return {
    ...SPEED_OF_TAPE_DEFAULTS, ...raw,
    database: ["volume", "order", "trades"].includes(String(raw.database)) ? String(raw.database) : "volume",
    filterMin: Math.max(0, Math.min(10_000_000, finite(raw.filterMin, 1))),
    filterMax: Math.max(0, Math.min(10_000_000, finite(raw.filterMax, 0))),
    numberSeconds: Math.round(Math.max(1, Math.min(3_600, finite(raw.numberSeconds, 10)))),
    standardDeviationPerFilter: Math.max(0, Math.min(10, finite(raw.standardDeviationPerFilter, 0))),
    paneHeight: Math.round(Math.max(120, Math.min(520, finite(raw.paneHeight, 190)))),
    useThemeColors: raw.useThemeColors !== false,
    bullBorderColor: String(raw.bullBorderColor ?? SPEED_OF_TAPE_DEFAULTS.bullBorderColor),
    bullFillColor: String(raw.bullFillColor ?? SPEED_OF_TAPE_DEFAULTS.bullFillColor),
    bearBorderColor: String(raw.bearBorderColor ?? SPEED_OF_TAPE_DEFAULTS.bearBorderColor),
    bearFillColor: String(raw.bearFillColor ?? SPEED_OF_TAPE_DEFAULTS.bearFillColor),
    speedOfTapeSettingsVersion: 1,
  };
}

export function buildSpeedOfTapeFrame(trades: readonly InstitutionalTrade[], raw: Record<string, unknown>, theme: IndicatorTheme): SpeedOfTapeFrame {
  const settings = normalizeSpeedOfTapeSettings(raw);
  if (settings.database === "order") return { status: "orders-unavailable", bars: [], mean: 0, standardDeviation: 0 };
  const exact = trades.filter((trade) => !trade.flowOnly && Number.isFinite(trade.timestamp) && Number.isFinite(trade.volume)).slice().sort((a, b) => a.timestamp - b.timestamp || a.recordIndex - b.recordIndex);
  if (!exact.length) return { status: "waiting-for-executions", bars: [], mean: 0, standardDeviation: 0 };
  const duration = settings.numberSeconds * 1_000;
  const buckets = new Map<number, { startMs: number; endMs: number; value: number; buy: number; sell: number }>();
  for (const trade of exact) {
    const size = settings.database === "trades" ? Math.max(1, Number(trade.trades) || 1) : Math.max(0, Number(trade.volume));
    if (size < settings.filterMin || (settings.filterMax > 0 && size > settings.filterMax)) continue;
    const startMs = Math.floor(trade.timestamp / duration) * duration;
    const bucket = buckets.get(startMs) ?? { startMs, endMs: startMs + duration, value: 0, buy: 0, sell: 0 };
    bucket.value += size;
    if (trade.aggressor === "BUY") bucket.buy += size; else if (trade.aggressor === "SELL") bucket.sell += size;
    buckets.set(startMs, bucket);
  }
  const rows = [...buckets.values()].sort((a, b) => a.startMs - b.startMs);
  const mean = rows.reduce((sum, row) => sum + row.value, 0) / Math.max(1, rows.length);
  const standardDeviation = Math.sqrt(rows.reduce((sum, row) => sum + (row.value - mean) ** 2, 0) / Math.max(1, rows.length));
  const threshold = settings.standardDeviationPerFilter > 0
    ? mean + standardDeviation * settings.standardDeviationPerFilter
    : Number.NEGATIVE_INFINITY;
  const bull = settings.useThemeColors ? theme.positive : settings.bullFillColor;
  const bear = settings.useThemeColors ? theme.negative : settings.bearFillColor;
  return { status: "ready", mean, standardDeviation, bars: rows.filter((row) => row.value >= threshold).map((row) => ({ ...row, delta: row.buy - row.sell, color: row.buy >= row.sell ? bull : bear })) };
}

export function speedOfTapeSeries(frame: SpeedOfTapeFrame, instanceId: string): CalculatedIndicatorSeries[] {
  if (frame.status !== "ready") return [];
  return [{ key: `${instanceId}-speed`, label: "Speed of Tape", kind: "histogram", placement: "pane", color: "#ffffff", includeZeroInScale: true,
    data: frame.bars.map((bar) => ({ time: bar.endMs / 1_000, value: bar.value, color: bar.color })) }];
}

/** Sample the trailing N-second execution window at each actual candle.
 * Native chart coordinates only exist at candle timestamps, not at arbitrary
 * ten-second boundaries. Keep the clock window independent of bar duration. */
export function buildChartSpeedOfTapeFrame(
  trades: readonly InstitutionalTrade[], raw: Record<string, unknown>, theme: IndicatorTheme,
  candles: readonly Candle[], intervalMs: number | null, asOfMs: number, completeFromMs = -Infinity,
): SpeedOfTapeFrame {
  const settings = normalizeSpeedOfTapeSettings(raw);
  const empty = (status: SpeedOfTapeStatus): SpeedOfTapeFrame => ({status, bars: [], mean: 0, standardDeviation: 0});
  if (settings.database === "order") return empty("orders-unavailable");
  const exact = trades.filter(trade => !trade.flowOnly && Number.isFinite(trade.timestamp)
    && Number.isFinite(trade.volume) && trade.volume > 0 && trade.timestamp <= asOfMs);
  if (!exact.length || !candles.length) return empty("waiting-for-executions");
  if (exact.some((trade, i) => i > 0 && trade.timestamp < exact[i - 1].timestamp)) {
    exact.sort((a, b) => a.timestamp - b.timestamp || a.recordIndex - b.recordIndex);
  }
  // Filters refer to the execution's size, also in trade-count mode.
  const eligible = exact.filter(trade => trade.volume >= settings.filterMin
    && !(settings.filterMax > 0 && trade.volume > settings.filterMax));
  const duration = settings.numberSeconds * 1_000;
  const rows: SpeedOfTapeFrame["bars"] = [];
  let left = 0, right = 0, value = 0, delta = 0;
  const size = (trade: InstitutionalTrade) => settings.database === "trades"
    ? Math.max(1, Number(trade.trades) || 1) : trade.volume;
  const signed = (trade: InstitutionalTrade) => trade.aggressor === "BUY" ? size(trade)
    : trade.aggressor === "SELL" ? -size(trade) : 0;
  for (let index = 0; index < candles.length; index++) {
    const candle = candles[index];
    if (candle.timestamp > asOfMs) break;
    const endMs = Math.min(asOfMs, intervalMs !== null
      ? candle.timestamp + intervalMs - 1
      : candle.sourceEndTimestamp ?? candle.timestamp);
    // The retained tape can begin mid-session: never invent earlier readings.
    if (endMs < exact[0].timestamp || endMs - duration < completeFromMs) continue;
    while (right < eligible.length && eligible[right].timestamp <= endMs) {
      value += size(eligible[right]); delta += signed(eligible[right]); right++;
    }
    while (left < right && eligible[left].timestamp <= endMs - duration) {
      value -= size(eligible[left]); delta -= signed(eligible[left]); left++;
    }
    rows.push({startMs: candle.timestamp, endMs, value, delta, color: delta >= 0
      ? settings.useThemeColors ? theme.positive : settings.bullFillColor
      : settings.useThemeColors ? theme.negative : settings.bearFillColor});
  }
  const mean = rows.reduce((sum, row) => sum + row.value, 0) / Math.max(1, rows.length);
  const standardDeviation = Math.sqrt(rows.reduce((sum, row) => sum + (row.value - mean) ** 2, 0) / Math.max(1, rows.length));
  const threshold = settings.standardDeviationPerFilter > 0 ? mean + standardDeviation * settings.standardDeviationPerFilter : -Infinity;
  // Retain zeroes for filtered windows so the histogram never bridges a gap.
  return {status: "ready", mean, standardDeviation, bars: rows.map(row => row.value >= threshold ? row : {...row, value: 0})};
}

export function chartSpeedOfTapeSeries(frame: SpeedOfTapeFrame, instanceId: string): CalculatedIndicatorSeries[] {
  if (frame.status !== "ready") return [];
  return [{key: `${instanceId}-speed`, label: "Speed of Tape", kind: "histogram", placement: "pane",
    color: "#ffffff", includeZeroInScale: true,
    data: frame.bars.map(bar => ({time: bar.startMs / 1_000, value: bar.value, color: bar.color}))}];
}
