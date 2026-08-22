import assert from "node:assert/strict";
import { resolveDeltaBarWidth } from "../src/lib/nativeVolumeProfilePrimitive.ts";

/**
 * "Delta and total volume" draws a signed delta bar behind the volume half.
 * The width maths has several degenerate inputs that a canvas swallows in
 * silence — a NaN or negative rect simply does not paint — so a broken delta
 * bar looks exactly like the profile type having been removed rather than an
 * error anyone can chase.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const base = { mode: "delta-volume", profileWidth: 120, deltaScaleWidth: 120, deltaScaleMaximum: 400 };

check("a normal row scales against the profile's largest delta", () => {
  const width = resolveDeltaBarWidth({ ...base, delta: 200, volume: 1_000 });
  assert.equal(width, 60, "half the peak delta should be half the delta width");
});

check("the sign does not change the width", () => {
  const up = resolveDeltaBarWidth({ ...base, delta: 200, volume: 1_000 });
  const down = resolveDeltaBarWidth({ ...base, delta: -200, volume: 1_000 });
  assert.equal(up, down);
});

check("a profile with no delta at all draws nothing, and never NaN", () => {
  // This is the regression: maxAbsDelta of 0 made the old inline form divide
  // by zero, and Math.max(0.5, NaN) is NaN.
  const width = resolveDeltaBarWidth({ ...base, delta: 0, volume: 1_000, deltaScaleMaximum: 0 });
  assert.ok(Number.isFinite(width), `width must be finite, got ${width}`);
  assert.equal(width, 0);
});

check("a delta row against a zero scale never returns Infinity", () => {
  const width = resolveDeltaBarWidth({ ...base, delta: 25, volume: 1_000, deltaScaleMaximum: 0 });
  assert.ok(Number.isFinite(width), `width must be finite, got ${width}`);
  assert.equal(width, 0);
});

check("no row exceeds the space allotted to delta", () => {
  // Live prints can push a row past the scale maximum the snapshot was built
  // from; the bar must not spill across the rest of the profile.
  const width = resolveDeltaBarWidth({ ...base, delta: 4_000, volume: 5_000 });
  assert.equal(width, base.deltaScaleWidth);
});

check("a visible delta always gets a visible bar", () => {
  const width = resolveDeltaBarWidth({ ...base, delta: 1, volume: 500_000 });
  assert.ok(width >= 0.5, `a real delta must be drawable, got ${width}`);
});

check("delta percentage reads one-sidedness, not size", () => {
  const thinOneSided = resolveDeltaBarWidth({ ...base, mode: "delta-percentage", delta: 10, volume: 10 });
  const heavyBalanced = resolveDeltaBarWidth({ ...base, mode: "delta-percentage", delta: 10, volume: 5_000 });
  assert.equal(thinOneSided, base.deltaScaleWidth, "fully one-sided should use the whole width");
  assert.ok(heavyBalanced < thinOneSided);
});

check("a collapsed profile draws no delta", () => {
  assert.equal(resolveDeltaBarWidth({ ...base, delta: 200, volume: 1_000, profileWidth: 0 }), 0);
  assert.equal(resolveDeltaBarWidth({ ...base, delta: 200, volume: 1_000, deltaScaleWidth: 0 }), 0);
});

console.log(`\nvolume profile delta bar: ${passed}/${passed} checks passed`);
