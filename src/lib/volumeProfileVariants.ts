import type { Candle } from "@/lib/backtester";
import { cmeSessionDateKey, cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { monthlyProfileRanges, profileVariantJob, visibleProfileRange, type ProfileVariantJob } from "@/lib/profileVariantJobs";
import { resolveSessionSegments, RTH_END_MINUTES, RTH_START_MINUTES } from "@/lib/volumeProfileSessions";

const number = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const count = (value: unknown, fallback: number) => Math.max(1, Math.min(12, Math.round(number(value, fallback))));

function requestSource(instance: ChartIndicatorInstance, symbol: string, contractSymbol?: string) {
  const settings = instance.settings ?? {};
  return {
    symbol,
    contractSymbol,
    groupTicks: 1,
    valueAreaPercent: Math.max(1, Math.min(100, number(settings.valueAreaPercent, 70))),
    minTradeVolume: Math.max(0, number(settings.minTradeVolume, 0)),
    maxTradeVolume: Math.max(0, number(settings.maxTradeVolume, 0)),
    filterMode: "none" as const,
  };
}

function sessionJobs(args: VariantProfilePlanArgs, instance: ChartIndicatorInstance): ProfileVariantJob[] {
  const settings = instance.settings ?? {};
  const dates = [...new Set(args.candles.map((candle) => cmeSessionDateKey(candle.timestamp)).filter(Boolean) as string[])]
    .sort().slice(-count(settings.numberOfProfiles, 5));
  const mode = String(settings.filterMode ?? "filter");
  const requestedMode = mode === "triple" ? "triple" : mode === "splitted" ? "splitted" : "filter";
  const requestedWindow = ["rth", "eth", "custom"].includes(String(settings.filterTime))
    ? String(settings.filterTime) as "rth" | "eth" | "custom"
    : "rth";
  return dates.flatMap((tradingDate) => {
    const day = cmeSessionWindowForDate(tradingDate);
    if (!day) return [];
    return resolveSessionSegments(day.startMs, Math.min(day.endMs, args.clockMs), {
      mode: requestedMode,
      window: requestedWindow,
      customStartMinutes: number(settings.sessionStartMinutes, RTH_START_MINUTES),
      customEndMinutes: number(settings.sessionEndMinutes, RTH_END_MINUTES),
      useEndSessionAsStartDay: settings.useEndSessionAsStartDay === true,
    }).map((range) => profileVariantJob({
      ownerId: instance.instanceId,
      label: `${tradingDate} · ${range.label}`,
      range,
      source: requestSource(instance, args.symbol, args.contractSymbol),
    }));
  });
}

export type VariantProfilePlanArgs = {
  instances: readonly ChartIndicatorInstance[];
  candles: readonly Candle[];
  visibleLogicalRange: { from: number; to: number } | null;
  intervalMs: number | null;
  clockMs: number;
  symbol: string;
  contractSymbol?: string;
};

/** One owner and one exact execution range per requested profile. */
export function planVolumeProfileVariantJobs(args: VariantProfilePlanArgs): ProfileVariantJob[] {
  const jobs: ProfileVariantJob[] = [];
  for (const instance of args.instances) {
    if (!instance.enabled) continue;
    const settings = instance.settings ?? {};
    if (instance.indicatorId === "monthly-volume-profile") {
      // Disjoint session filters over a month need a multi-window gateway
      // contract. Refuse that unsupported combination instead of returning a
      // whole-month profile labelled RTH.
      if (String(settings.filterMode ?? "none") !== "none") continue;
      for (const range of monthlyProfileRanges(args.clockMs, count(settings.numberOfProfiles, 3))) {
        jobs.push(profileVariantJob({ ownerId: instance.instanceId, label: range.label, range,
          source: requestSource(instance, args.symbol, args.contractSymbol) }));
      }
    } else if (instance.indicatorId === "session-volume-profile") {
      jobs.push(...sessionJobs(args, instance));
    } else if (instance.indicatorId === "visible-range-volume-profile") {
      if (String(settings.filterMode ?? "none") !== "none" || !args.visibleLogicalRange) continue;
      const range = visibleProfileRange({
        candles: args.candles,
        from: args.visibleLogicalRange.from,
        to: args.visibleLogicalRange.to,
        intervalMs: args.intervalMs,
        clockMs: args.clockMs,
      });
      if (range) jobs.push(profileVariantJob({ ownerId: instance.instanceId, label: "Visible range", range,
        source: requestSource(instance, args.symbol, args.contractSymbol) }));
    }
  }
  return jobs.sort((left, right) => right.startMs - left.startMs);
}
