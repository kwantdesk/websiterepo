import type { InstitutionalVolumeProfile } from "@/lib/institutionalMarketData";

export type CustomDrawVolumeProfile = {
  bins: Array<{ priceLow: number; priceHigh: number; volume: number }>;
  poc: number;
  pocIndex: number;
  maxVol: number;
  valLow: number;
  vahHigh: number;
};

/** Convert exact gateway price rows into the geometry used by the draw layer. */
export function exactCustomDrawVolumeProfile(
  profile: InstitutionalVolumeProfile | null | undefined,
): CustomDrawVolumeProfile | null {
  if (!profile?.levels.length || profile.poc == null || profile.vah == null || profile.val == null) return null;
  const rowSize = Math.max(Number.EPSILON, profile.tickSize * Math.max(1, profile.groupTicks));
  const bins = profile.levels
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.volume) && level.volume > 0)
    .map((level) => ({
      priceLow: level.price - rowSize / 2,
      priceHigh: level.price + rowSize / 2,
      volume: level.volume,
    }))
    .sort((left, right) => left.priceLow - right.priceLow);
  if (!bins.length) return null;
  const maxVol = Math.max(...bins.map((bin) => bin.volume));
  const pocIndex = bins.reduce((best, bin, index) => (
    Math.abs((bin.priceLow + bin.priceHigh) / 2 - profile.poc!)
      < Math.abs((bins[best].priceLow + bins[best].priceHigh) / 2 - profile.poc!)
      ? index
      : best
  ), 0);
  return {
    bins,
    poc: profile.poc,
    pocIndex,
    maxVol,
    valLow: profile.val,
    vahHigh: profile.vah,
  };
}
