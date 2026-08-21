import assert from "node:assert/strict";

import {
  DEFAULT_PEAK_VALLEY_SETTINGS,
  calculateVolumeProfileStructure,
  calculateVolumeProfileVwap,
  peakValleyWindow,
  summarizeVolumeProfile,
} from "../src/lib/volumeProfileStructure.ts";

/**
 * Peak and Valley, VWAP and Summary parity with DeepChart's DP: DeltaVol tabs.
 */

const rows = (volumes, startPrice = 100, step = 1) =>
  volumes.map((volume, index) => ({ price: startPrice + index * step, volume }));

// --- sensitivity inverts into the comparison window ---
{
  assert.ok(peakValleyWindow(0) > peakValleyWindow(100), "low sensitivity compares over a wider window");
  assert.equal(peakValleyWindow(100), 1, "full sensitivity compares against immediate neighbours");
  assert.equal(peakValleyWindow(40), peakValleyWindow(40), "deterministic");
  for (const bad of [Number.NaN, -50, 500]) {
    assert.ok(peakValleyWindow(bad) >= 1, `window stays valid for ${bad}`);
  }
}

// --- a clean two-peak profile: two HVNs with an LVN between them ---
{
  //             100 101 102 103 104 105 106
  const profile = rows([10, 90, 20, 5, 25, 80, 12]);
  const structure = calculateVolumeProfileStructure(profile, {
    ...DEFAULT_PEAK_VALLEY_SETTINGS,
    sensitivity: 100, // compare against immediate neighbours
  });

  const peakPrices = structure.peaks.map((p) => p.price).sort((a, b) => a - b);
  const valleyPrices = structure.valleys.map((v) => v.price).sort((a, b) => a - b);

  assert.deepEqual(peakPrices, [101, 105], "the two high-volume nodes are found");
  assert.ok(valleyPrices.includes(103), "the low-volume node between them is found");

  // Business zone spans the outermost peaks, not the profile extremes.
  assert.deepEqual(structure.businessZone, { low: 101, high: 105 });
}

// --- excludeHighLow drops edge rows, which are rejections rather than nodes ---
{
  // The busiest row sits at the very top edge.
  const profile = rows([5, 10, 8, 99]);
  const included = calculateVolumeProfileStructure(profile, {
    ...DEFAULT_PEAK_VALLEY_SETTINGS, sensitivity: 100, excludeHighLow: false,
  });
  const excluded = calculateVolumeProfileStructure(profile, {
    ...DEFAULT_PEAK_VALLEY_SETTINGS, sensitivity: 100, excludeHighLow: true,
  });
  assert.ok(included.peaks.some((p) => p.price === 103), "edge row is a peak when edges are kept");
  assert.ok(!excluded.peaks.some((p) => p.price === 103), "edge row is dropped when edges are excluded");
}

// --- volume thresholds gate which nodes qualify ---
{
  const profile = rows([10, 90, 20, 5, 25, 80, 12]);
  const base = { ...DEFAULT_PEAK_VALLEY_SETTINGS, sensitivity: 100 };

  // Busiest row is 90, so 80 is ~88.9% of it. Requiring 95% leaves only the 90 row.
  const strict = calculateVolumeProfileStructure(profile, { ...base, peakMinVolumePercent: 95 });
  assert.deepEqual(strict.peaks.map((p) => p.price), [101], "Peak min volume excludes the weaker node");
  assert.equal(strict.businessZone, null, "one peak cannot define a business zone");

  // Valleys capped at 10% of the busiest row: only the 5 row (5.6%) survives.
  const valleys = calculateVolumeProfileStructure(profile, { ...base, valleyMaxVolumePercent: 10 });
  assert.ok(valleys.valleys.every((v) => v.volumePercent <= 10), "Valley max volume is enforced");
  assert.ok(valleys.valleys.some((v) => v.price === 103), "the true LVN still qualifies");
}

// --- outside-value-area filters ---
{
  const profile = rows([10, 90, 20, 5, 25, 80, 12]);
  const base = { ...DEFAULT_PEAK_VALLEY_SETTINGS, sensitivity: 100 };
  const valueArea = { vah: 105, val: 101 };

  const unfiltered = calculateVolumeProfileStructure(profile, base, valueArea);
  assert.ok(unfiltered.peaks.length >= 2, "both peaks are reported without the filter");

  const outsideOnly = calculateVolumeProfileStructure(
    profile, { ...base, peakOnlyOutsideValueArea: true }, valueArea,
  );
  assert.ok(
    outsideOnly.peaks.every((p) => p.price > 105 || p.price < 101),
    "peaks inside the value area are removed",
  );
}

// --- a flat shelf reports one node, not a run of identical ones ---
{
  const flat = rows([5, 40, 40, 40, 5]);
  const structure = calculateVolumeProfileStructure(flat, {
    ...DEFAULT_PEAK_VALLEY_SETTINGS, sensitivity: 100, excludeHighLow: false,
  });
  assert.equal(structure.peaks.length, 1, "a shelf of equal rows collapses to a single peak");
}

// --- degenerate input is honest ---
{
  for (const bad of [[], rows([1]), rows([1, 2])]) {
    const structure = calculateVolumeProfileStructure(bad);
    assert.deepEqual(structure.peaks, []);
    assert.deepEqual(structure.valleys, []);
    assert.equal(structure.businessZone, null);
  }
  const zeroVolume = calculateVolumeProfileStructure(rows([0, 0, 0, 0]));
  assert.deepEqual(zeroVolume.peaks, [], "an empty profile reports no structure");
}

// --- VWAP and deviation envelopes ---
{
  // Symmetric profile around 102 -> VWAP is exactly 102.
  const symmetric = rows([10, 20, 40, 20, 10]);
  const vwap = calculateVolumeProfileVwap(symmetric, [1, 2]);
  assert.ok(vwap.vwap !== null);
  assert.ok(Math.abs(vwap.vwap - 102) < 1e-9, `expected VWAP 102, got ${vwap.vwap}`);
  assert.ok(vwap.standardDeviation > 0, "a spread profile has non-zero deviation");

  assert.equal(vwap.bands.length, 2, "one band per requested deviation");
  const [one, two] = vwap.bands;
  assert.ok(Math.abs((one.upper - one.lower) / 2 - vwap.standardDeviation) < 1e-9, "1σ band is ±1 deviation");
  assert.ok(Math.abs((two.upper - two.lower) / 2 - vwap.standardDeviation * 2) < 1e-9, "2σ band is ±2 deviations");
  assert.ok(two.upper > one.upper && two.lower < one.lower, "wider deviations produce wider bands");

  // Skewed volume drags VWAP toward the heavy side.
  const skewed = calculateVolumeProfileVwap(rows([100, 1, 1, 1, 1]));
  assert.ok(skewed.vwap < 101, "VWAP follows where the volume actually traded");

  // A single price has no dispersion.
  const single = calculateVolumeProfileVwap([{ price: 100, volume: 50 }], [1]);
  assert.equal(single.vwap, 100);
  assert.equal(single.standardDeviation, 0);
  assert.equal(single.bands[0].upper, 100, "a zero-deviation band collapses onto VWAP");

  // Nothing traded -> nothing claimed.
  const empty = calculateVolumeProfileVwap([], [1]);
  assert.equal(empty.vwap, null);
  assert.deepEqual(empty.bands, []);
  // Non-positive deviations are rejected rather than mirrored.
  assert.deepEqual(calculateVolumeProfileVwap(symmetric, [0, -1]).bands, []);
}

// --- summary totals ---
{
  const levels = [
    { volume: 10, bidVolume: 4, askVolume: 6, trades: 3 },
    { volume: 20, bidVolume: 15, askVolume: 5, trades: 7 },
  ];
  const summary = summarizeVolumeProfile(levels);
  assert.equal(summary.totalVolume, 30);
  assert.equal(summary.bidVolume, 19);
  assert.equal(summary.askVolume, 11);
  assert.equal(summary.delta, -8, "delta is ask minus bid");
  assert.equal(summary.trades, 10);
  assert.equal(summarizeVolumeProfile([]).totalVolume, 0);
}

console.log("Volume profile structure (peaks, valleys, VWAP, summary) tests passed.");
