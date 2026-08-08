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
