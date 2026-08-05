import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptiveIntensity,
  buildStructuralZones,
  interpolateZeroCrossing,
  mapStrikeToFutures,
  normalizeEpoch,
  validateOptionsHeatmapInputs,
} from "../src/lib/optionsHeatmap.ts";

test("maps an options strike into timestamp-aligned futures space", () => {
  assert.equal(mapStrikeToFutures(505, 505, 28_000), 28_000);
  assert.equal(mapStrikeToFutures(505, 0, 28_000), null);
});

test("normalizes supported provider timestamp units deterministically", () => {
  assert.equal(normalizeEpoch(1_800_000_000), 1_800_000_000_000);
  assert.equal(normalizeEpoch(1_800_000_000_000), 1_800_000_000_000);
  assert.equal(normalizeEpoch(-1), null);
});

test("interpolates the zero-gamma crossing closest to futures price", () => {
  const crossing = interpolateZeroCrossing([
    { price: 27_900, net: -200 },
    { price: 28_000, net: 200 },
    { price: 28_100, net: -100 },
  ], 27_970);
  assert.equal(crossing, 27_950);
});

test("adaptive heat intensity is bounded and monotonic", () => {
  const low = adaptiveIntensity(10, 100);
  const high = adaptiveIntensity(80, 100);
  assert.ok(low > 0 && low < high);
  assert.equal(adaptiveIntensity(200, 100), 1);
});

test("clusters adjacent positioning strikes while preserving source metadata", () => {
  const payload = {
    nqPrice: 28_000,
    agreement: { score: 82 },
    rail: [
      { price: 27_990, call: 80, put: -10, net: 70, gross: 90, zeroDteGross: 45, ndxNet: 40, ndxGross: 50, qqqNet: 30, qqqGross: 40, sourceAgreement: 100, ndxStrikes: [20_400], qqqStrikes: [504] },
      { price: 28_010, call: 60, put: -20, net: 40, gross: 80, zeroDteGross: 40, ndxNet: 20, ndxGross: 40, qqqNet: 20, qqqGross: 40, sourceAgreement: 100, ndxStrikes: [20_425], qqqStrikes: [505] },
      { price: 28_120, call: 10, put: -90, net: -80, gross: 100, zeroDteGross: 70, ndxNet: -50, ndxGross: 60, qqqNet: -30, qqqGross: 40, sourceAgreement: 100, ndxStrikes: [20_500], qqqStrikes: [507] },
    ],
    sources: [],
  };
  const zones = buildStructuralZones(payload, "COMBINED", "ALL", 25);
  assert.equal(zones.length, 2);
  assert.ok(zones[0].center > 27_990 && zones[0].center < 28_010);
  assert.deepEqual(zones[0].ndxStrikes, [20_400, 20_425]);
  assert.equal(zones[1].behaviour, "AMPLIFYING");
});

test("rejects malformed payloads instead of painting synthetic heat", () => {
  assert.deepEqual(validateOptionsHeatmapInputs({}, null), {
    payloadValid: false,
    historyValid: true,
    valid: false,
  });
});
