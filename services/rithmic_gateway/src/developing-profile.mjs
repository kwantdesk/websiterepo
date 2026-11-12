import { foldPrintsToMinuteLevels, sumMinuteLevels } from "./session-profile-archive.mjs";

/**
 * Developing statistics for one trading window. Feed only complete minute
 * buckets in chronological order, with the same execution filters as the
 * final profile. The accumulator can continue when the next minute closes.
 */
export function createDevelopingProfile({ tickSize, groupTicks = 1, valueAreaPercent = 70,
  minTradeVolume = 0, maxTradeVolume = 0 }) {
  const rows = new Map();
  let prices = [];
  let totalVolume = 0;
  let weightedTicks = 0;
  let pocTick = null;
  let pocVolume = 0;
  let lastMinute = null;

  function addMinute(minute) {
    if (lastMinute !== null && minute.t <= lastMinute) {
      throw new Error("Developing profile minutes must be strictly increasing.");
    }
    lastMinute = minute.t;
    const { totals, coverageEndMs } = sumMinuteLevels(
      [minute], minute.t, minute.t + 1, { minTradeVolume, maxTradeVolume },
    );
    if (!totals.size) return null;

    let addedPrice = false;
    for (const [priceTick, row] of totals) {
      const groupedTick = Math.floor(priceTick / groupTicks) * groupTicks;
      addedPrice ||= !rows.has(groupedTick);
      const volume = (rows.get(groupedTick) ?? 0) + row.volume;
      rows.set(groupedTick, volume);
      totalVolume += row.volume;
      weightedTicks += priceTick * row.volume;
      if (volume > pocVolume || (volume === pocVolume && groupedTick < pocTick)) {
        pocTick = groupedTick;
        pocVolume = volume;
      }
    }
    if (addedPrice) prices = [...rows.keys()].sort((a, b) => a - b);

    // Same tie and adjacency rules as the final gateway profile. An
    // untraded price never becomes a row just because there is a gap.
    let low = prices.indexOf(pocTick);
    let high = low;
    let selectedVolume = pocVolume;
    const target = totalVolume * (valueAreaPercent / 100);
    while (selectedVolume < target && (low > 0 || high < prices.length - 1)) {
      const left = low > 0 ? rows.get(prices[low - 1]) : -1;
      const right = high < prices.length - 1 ? rows.get(prices[high + 1]) : -1;
      if (right > left) {
        high += 1;
        selectedVolume += right;
      } else {
        low -= 1;
        selectedVolume += left;
      }
    }
    return {
      timestamp: coverageEndMs,
      poc: pocTick * tickSize,
      vah: prices[high] * tickSize,
      val: prices[low] * tickSize,
      vwap: (weightedTicks / totalVolume) * tickSize,
    };
  }

  return { addMinute };
}

/**
 * Turn an owned archive prefix and a deduplicated live execution suffix into
 * one series. At the handoff both sources may contribute to the same minute.
 */
export function buildDevelopingProfileSeries({ minutes, tailTrades = [], fromMs, toMs, ...settings }) {
  const byMinute = new Map();
  for (const minute of minutes) {
    // A compact minute cannot answer a request starting inside the bucket.
    // Its recorded final execution must also precede the exclusive cutoff.
    const last = minute.last ?? minute.t + 59_999;
    if (last < fromMs || minute.t >= toMs) continue;
    if (minute.t < fromMs || last >= toMs) return null;
    if (byMinute.has(minute.t)) throw new Error("Duplicate compact developing profile minute.");
    byMinute.set(minute.t, minute);
  }
  const live = foldPrintsToMinuteLevels(
    tailTrades.filter((trade) => trade.timestamp >= fromMs && trade.timestamp < toMs),
    settings.tickSize,
  );
  for (const minute of live) {
    const archived = byMinute.get(minute.t);
    byMinute.set(minute.t, archived ? {
      t: minute.t,
      last: Math.max(archived.last ?? archived.t + 59_999, minute.last),
      levels: [...archived.levels, ...minute.levels],
    } : minute);
  }
  const stream = createDevelopingProfile(settings);
  const developingPoc = [];
  const developingValueArea = [];
  const developingVwap = [];
  for (const minute of [...byMinute.values()].sort((left, right) => left.t - right.t)) {
    const point = stream.addMinute(minute);
    if (!point) continue;
    const { timestamp, poc, vah, val, vwap } = point;
    developingPoc.push({ timestamp, price: poc });
    developingValueArea.push({ timestamp, vah, val });
    developingVwap.push({ timestamp, price: vwap });
  }
  return { developingPoc, developingValueArea, developingVwap };
}
