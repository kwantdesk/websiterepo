import type { DarkPoolMappingReceipt } from "./darkPoolMap";

export function causalDarkPoolMappingSamples<T extends { timeMs: number }>(samples: T[], at: number, windowMinutes: number) {
  return samples.filter((sample) => sample.timeMs >= at - windowMinutes * 60_000 && sample.timeMs <= at).slice(-1_000);
}

export function causalDarkPoolMappingReceipt(cached: DarkPoolMappingReceipt | undefined, current: DarkPoolMappingReceipt, at: number) {
  return cached && cached.calculatedAtMs <= at ? cached : { ...current };
}
