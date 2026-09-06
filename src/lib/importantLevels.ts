import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { exchangeClockParts } from "@/lib/exchangeClock";
import type { FootprintBarModel } from "@/lib/footprintTypes";

export const IMPORTANT_LEVELS_DEFAULTS = {
  days: 2, weeks: 1, months: 1, skipLast: false,
  plotType: "label-and-line", textAlign: "right", fontSize: 10, lineWidth: 1,
  filterTime: "eth", customStartTime: "08:30", customEndTime: "15:15",
  dailyAverage: true, dailyLow: true, dailyHigh: true, dailyOpen: true, dailyClose: true, dailyPoc: true, dailyValueArea: true, dailyVwap: true,
  weeklyAverage: true, weeklyLow: true, weeklyHigh: true, weeklyOpen: true, weeklyClose: true, weeklyPoc: true, weeklyValueArea: true, weeklyVwap: true,
  monthlyAverage: false, monthlyLow: true, monthlyHigh: true, monthlyOpen: true, monthlyClose: true, monthlyPoc: true, monthlyValueArea: true, monthlyVwap: true,
  useThemeColors: true,
  lowColor: "#EF4444", highColor: "#22C55E", openColor: "#A3A3A3", closeColor: "#FFFFFF",
  midColor: "#F59E0B", pocColor: "#F59E0B", valueAreaColor: "#38BDF8", vwapColor: "#A78BFA",
  importantLevelsSettingsVersion: 1,
} as const;

type Period = "daily" | "weekly" | "monthly";
type LevelName = "Average" | "Low" | "High" | "Open" | "Close" | "POC" | "VAH" | "VAL" | "VWAP";
type PeriodBucket = { key: string; candles: Candle[]; footprints: FootprintBarModel[] };

const hm = (value: unknown, fallback: string) => /^\d{2}:\d{2}$/.test(String(value)) ? String(value) : fallback;
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const enabled = (raw: Record<string, unknown>, key: string, fallback: boolean) => raw[key] === undefined ? fallback : raw[key] === true;

function tradingDate(candle: Candle) {
  const p = exchangeClockParts(candle.timestamp, "America/Chicago");
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  if (p.hour < 17) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}
function periodKey(candle: Candle, period: Period) {
  const date = tradingDate(candle);
  if (period === "daily") return date.toISOString().slice(0, 10);
  if (period === "weekly") {
    const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - day + 1);
    return date.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 7);
}
function passesTime(candle: Candle, mode: string, start: string, end: string) {
  if (mode === "none" || mode === "eth") return true;
  const p = exchangeClockParts(candle.timestamp, "America/Chicago");
  const current = p.hour * 60 + p.minute;
  const from = mode === "rth" ? 8 * 60 + 30 : minutes(start);
  const to = mode === "rth" ? 15 * 60 + 15 : minutes(end);
  return from <= to ? current >= from && current <= to : current >= from || current <= to;
}
function profileLevels(bars: FootprintBarModel[]) {
  const volume = new Map<number, number>();
  for (const bar of bars) for (const row of bar.rows) volume.set(row.tickIndex, (volume.get(row.tickIndex) ?? 0) + row.totalVolume);
  if (!volume.size) return { poc: null, vah: null, val: null };
  const rows = [...volume.entries()].sort((a, b) => a[0] - b[0]);
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  let pocIndex = rows.reduce((best, row, index) => row[1] > rows[best][1] ? index : best, 0);
  let low = pocIndex, high = pocIndex, accepted = rows[pocIndex][1];
  while (accepted < total * 0.7 && (low > 0 || high < rows.length - 1)) {
    const below = low > 0 ? rows[low - 1][1] : -1; const above = high < rows.length - 1 ? rows[high + 1][1] : -1;
    if (above >= below) { high += 1; accepted += rows[high][1]; } else { low -= 1; accepted += rows[low][1]; }
  }
  const price = (index: number) => bars.find((bar) => bar.rows.some((row) => row.tickIndex === rows[index][0]))?.rows.find((row) => row.tickIndex === rows[index][0])?.price ?? null;
  return { poc: price(pocIndex), vah: price(high), val: price(low) };
}

export function calculateImportantLevels(candles: Candle[], footprints: readonly FootprintBarModel[], raw: Record<string, unknown>, theme: IndicatorTheme): CalculatedIndicatorSeries[] {
  const filterTime = ["none", "eth", "rth", "custom"].includes(String(raw.filterTime)) ? String(raw.filterTime) : "eth";
  const start = hm(raw.customStartTime, "08:30"), end = hm(raw.customEndTime, "15:15");
  const filtered = candles.map((candle, index) => ({ candle, footprint: footprints[index] })).filter(({ candle }) => passesTime(candle, filterTime, start, end));
  if (!filtered.length) return [];
  const plotType = ["label", "line", "label-and-line"].includes(String(raw.plotType)) ? String(raw.plotType) : "label-and-line";
  const align = raw.textAlign === "left" ? "left" : "right";
  const fontSize = Math.max(6, Math.min(40, Number(raw.fontSize ?? 10)));
  const lineWidth = Math.max(1, Math.min(4, Math.round(Number(raw.lineWidth ?? 1)))) as 1 | 2 | 3 | 4;
  const useTheme = raw.useThemeColors !== false;
  const colorFor = (name: LevelName) => {
    const key = name === "Low" ? "lowColor" : name === "High" ? "highColor" : name === "Open" ? "openColor" : name === "Close" ? "closeColor" : name === "Average" ? "midColor" : name === "POC" ? "pocColor" : name === "VWAP" ? "vwapColor" : "valueAreaColor";
    if (!useTheme) return String(raw[key] ?? IMPORTANT_LEVELS_DEFAULTS[key]);
    return name === "Low" ? theme.negative : name === "High" ? theme.positive : name === "POC" || name === "Average" ? theme.secondary : name === "VAH" || name === "VAL" ? theme.muted : theme.primary;
  };
  const output: CalculatedIndicatorSeries[] = [];
  for (const period of ["daily", "weekly", "monthly"] as const) {
    const count = Math.max(0, Math.min(100, Math.round(Number(raw[`${period === "daily" ? "days" : period === "weekly" ? "weeks" : "months"}`] ?? (period === "daily" ? 2 : 1)))));
    if (!count) continue;
    const map = new Map<string, PeriodBucket>();
    filtered.forEach(({ candle, footprint }) => { const key = periodKey(candle, period); const bucket = map.get(key) ?? { key, candles: [], footprints: [] }; bucket.candles.push(candle); if (footprint) bucket.footprints.push(footprint); map.set(key, bucket); });
    let buckets = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
    if (raw.skipLast === true) buckets = buckets.slice(0, -1);
    buckets = buckets.slice(-count);
    const roleEnabled = (role: string) => enabled(raw, `${period}${role}`, IMPORTANT_LEVELS_DEFAULTS[`${period}${role}` as keyof typeof IMPORTANT_LEVELS_DEFAULTS] === true);
    for (const bucket of buckets) {
      const cs = bucket.candles; if (!cs.length) continue;
      const high = Math.max(...cs.map((c) => c.high)), low = Math.min(...cs.map((c) => c.low));
      const volume = cs.reduce((sum, c) => sum + Math.max(0, Number(c.volume ?? 0)), 0);
      const vwap = volume > 0 ? cs.reduce((sum, c) => sum + ((c.high + c.low + c.close) / 3) * Math.max(0, Number(c.volume ?? 0)), 0) / volume : null;
      const profile = profileLevels(bucket.footprints);
      const values: Array<[LevelName, number | null, boolean]> = [
        ["Average", (high + low) / 2, roleEnabled("Average")], ["Low", low, roleEnabled("Low")], ["High", high, roleEnabled("High")],
        ["Open", cs[0].open, roleEnabled("Open")], ["Close", cs.at(-1)!.close, roleEnabled("Close")], ["POC", profile.poc, roleEnabled("Poc")],
        ["VAH", profile.vah, roleEnabled("ValueArea")], ["VAL", profile.val, roleEnabled("ValueArea")], ["VWAP", vwap, roleEnabled("Vwap")],
      ];
      for (const [name, value, show] of values) if (show && value !== null && Number.isFinite(value)) {
        const first = cs[0].timestamp / 1000, last = cs.at(-1)!.timestamp / 1000;
        output.push({ key: `important-${period}-${bucket.key}-${name}`, label: `${period[0].toUpperCase()} ${name}`, kind: "line", placement: "overlay", color: colorFor(name), lineWidth,
          lineVisible: plotType !== "label", lastValueVisible: false, excludeFromAutoScale: true,
          pivotLabels: plotType === "line" ? undefined : { label: `${period[0].toUpperCase()} ${name}`, align, fontSize },
          data: [{ time: first, value }, { time: last, value }] });
      }
    }
  }
  return output;
}
