export type VolumeProfileMathLevel = {
  price: number;
  volume: number;
};

export type VolumeProfileValueArea = {
  poc: number | null;
  vah: number | null;
  val: number | null;
};

// Market-standard volume profiles use a fixed 70% value area around POC.
// This is a measurement convention, not a visual preference.
export const STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT = 70;

export function volumeProfileBinTick(tick: number, groupTicks: number) {
  const size = Math.max(1, Math.round(groupTicks));
  return Math.floor(tick / size) * size;
}

/**
 * Calculates a contiguous value area around POC. Empty price rows are kept so
 * gaps are not treated as adjacent, and each expansion compares two-row blocks
 * above and below POC, matching the conventional volume-profile method.
 */
export function calculateVolumeProfileValueArea(
  sourceLevels: VolumeProfileMathLevel[],
  priceIncrement: number,
  valueAreaPercent: number,
): VolumeProfileValueArea {
  if (!sourceLevels.length || !Number.isFinite(priceIncrement) || priceIncrement <= 0) {
    return { poc: null, vah: null, val: null };
  }

  const volumesByTick = new Map<number, number>();
  for (const level of sourceLevels) {
    const tick = Math.round(level.price / priceIncrement);
    volumesByTick.set(tick, (volumesByTick.get(tick) ?? 0) + Math.max(0, level.volume));
  }
  const occupiedTicks = [...volumesByTick.keys()].sort((a, b) => a - b);
  if (!occupiedTicks.length) return { poc: null, vah: null, val: null };

  const firstTick = occupiedTicks[0];
  const lastTick = occupiedTicks[occupiedTicks.length - 1];
  const volumes: number[] = [];
  let totalVolume = 0;
  let pocIndex = 0;
  let pocVolume = -1;
  for (let tick = firstTick; tick <= lastTick; tick += 1) {
    const volume = volumesByTick.get(tick) ?? 0;
    volumes.push(volume);
    totalVolume += volume;
    // Ascending iteration resolves equal-volume POCs to the lower price.
    if (volume > pocVolume) {
      pocVolume = volume;
      pocIndex = volumes.length - 1;
    }
  }

  const target = totalVolume * Math.min(100, Math.max(1, valueAreaPercent)) / 100;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let included = volumes[pocIndex] ?? 0;
  while (included < target && (lowIndex > 0 || highIndex < volumes.length - 1)) {
    const lowerStart = Math.max(0, lowIndex - 2);
    const upperEnd = Math.min(volumes.length - 1, highIndex + 2);
    let lowerVolume = -1;
    let upperVolume = -1;
    if (lowIndex > 0) {
      lowerVolume = 0;
      for (let index = lowerStart; index < lowIndex; index += 1) lowerVolume += volumes[index];
    }
    if (highIndex < volumes.length - 1) {
      upperVolume = 0;
      for (let index = highIndex + 1; index <= upperEnd; index += 1) upperVolume += volumes[index];
    }
    if (upperVolume >= lowerVolume) {
      for (let index = highIndex + 1; index <= upperEnd; index += 1) included += volumes[index];
      highIndex = upperEnd;
    } else {
      for (let index = lowerStart; index < lowIndex; index += 1) included += volumes[index];
      lowIndex = lowerStart;
    }
  }

  const priceForIndex = (index: number) =>
    Number(((firstTick + index) * priceIncrement).toFixed(10));
  return {
    poc: priceForIndex(pocIndex),
    vah: priceForIndex(highIndex),
    val: priceForIndex(lowIndex),
  };
}

/**
 * Rows a profile aims for when tick grouping is left on Automatic. The chart's
 * candle-backed profiles already bin to roughly range/140, so automatic
 * grouping targets the same density and stays visually consistent with them.
 */
export const AUTOMATIC_VOLUME_PROFILE_TARGET_ROWS = 140;

/**
 * Ticks per profile row when grouping is Automatic.
 *
 * The row count is derived from the session's own price range rather than a
 * fixed tick count, so a 400-point NQ day and a 40-point day both produce a
 * readable profile instead of 1,600 hairlines or a dozen fat blocks. `factor`
 * is the user's Auto group factory: 1 keeps the derived value, 2 halves the
 * row count, and so on. Returns 1 (no grouping) when the range is not yet
 * known, which is the honest state before any candles have loaded.
 */
export function automaticVolumeProfileGroupTicks(
  priceRange: number,
  tickSize: number,
  factor = 1,
  targetRows = AUTOMATIC_VOLUME_PROFILE_TARGET_ROWS,
): number {
  const safeFactor = Math.max(1, Math.round(Number.isFinite(factor) ? factor : 1));
  if (!Number.isFinite(priceRange) || priceRange <= 0) return safeFactor;
  if (!Number.isFinite(tickSize) || tickSize <= 0) return safeFactor;
  const rows = Math.max(1, Math.round(targetRows));
  const rangeTicks = priceRange / tickSize;
  if (!Number.isFinite(rangeTicks) || rangeTicks <= 0) return safeFactor;
  const derived = Math.ceil(rangeTicks / rows);
  return Math.max(1, derived) * safeFactor;
}

export type VolumeProfileInputData = "volume" | "trades";

/**
 * Applies the Data Settings "Input data" choice to a profile.
 *
 * Volume mode is the profile as recorded. Trades mode re-expresses every row
 * as its executed trade COUNT, which answers "where did the most transactions
 * happen" rather than "where did the most contracts trade" — the two disagree
 * whenever size is concentrated in a few large prints. Aggressor split and
 * delta are left untouched because they remain true either way.
 *
 * The original object is returned unchanged in volume mode so referential
 * equality — and the render memoisation built on it — is preserved.
 */
export function volumeProfileWithInputData<
  Level extends { volume: number; trades: number },
  Profile extends { levels: Level[]; totalVolume: number },
>(profile: Profile, inputData: VolumeProfileInputData): Profile {
  if (inputData !== "trades") return profile;
  const levels = profile.levels.map((level) => ({ ...level, volume: Math.max(0, level.trades) }));
  return {
    ...profile,
    levels,
    totalVolume: levels.reduce((sum, level) => sum + level.volume, 0),
  };
}
