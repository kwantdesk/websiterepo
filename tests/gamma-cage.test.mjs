import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveGammaCage,
  filterGammaExposureHorizon,
  gammaCageLabel,
  gammaCageNarrative,
  isGammaCageGameplanLevel,
  operationalGammaFlip,
  staggerGammaLabels,
} from "../src/lib/gammaCage.ts";

function exposure(strikes, expiryStrikes) {
  return {
    mode: "GAMMA",
    representation: "PER_ONE_PERCENT_MOVE",
    net: strikes.reduce((sum, row) => sum + row.net, 0),
    gross: strikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    strikes,
    expiries: expiryStrikes
      ? [...new Set(expiryStrikes.map((row) => row.expiration))].map((expiration) => {
          const rows = expiryStrikes.filter((row) => row.expiration === expiration);
          return {
            expiration,
            call: rows.reduce((sum, row) => sum + row.call, 0),
            put: rows.reduce((sum, row) => sum + row.put, 0),
            net: rows.reduce((sum, row) => sum + row.net, 0),
          };
        })
      : [],
    ...(expiryStrikes ? { expiryStrikes } : {}),
  };
}

const row = (strike, net) => ({
  strike,
  call: net > 0 ? net : 0,
  put: net < 0 ? net : 0,
  net,
});

test("1. a large negative strike is an accelerator and never a magnet", () => {
  const result = deriveGammaCage(exposure([row(98, 20), row(100, -500), row(102, 40)]), 100);
  assert.equal(result.gammaMagnet, 102);
  assert.equal(result.gammaAccelerator, 100);
  assert.notEqual(result.gammaMagnet, 100);
});

test("2. gamma flip is a cumulative crossing, distinct from the HVL shelf", () => {
  const result = deriveGammaCage(exposure([row(90, 5), row(100, -2), row(110, -10)]), 105);
  assert.equal(result.gammaFlip, 103);
  assert.notEqual(result.gammaFlip, result.gammaHvl);
  assert.equal(result.regime, "POSITIVE");
});

test("3. a surface without a crossing emits no flip and the exact disclosure", () => {
  const result = deriveGammaCage(exposure([row(90, 4), row(100, 3), row(110, 2)]), 100);
  assert.equal(result.gammaFlip, null);
  assert.deepEqual(result.gammaCrossings, []);
  assert.equal(result.flipNote, "no flip exists in this surface");
});

test("4. every cumulative crossing is retained and a contested book is flagged", () => {
  const result = deriveGammaCage(exposure([row(90, 10), row(100, -20), row(110, 20), row(120, -20)]), 104);
  assert.deepEqual(result.gammaCrossings, [95, 105, 115]);
  assert.equal(result.gammaFlip, 105);
  assert.equal(result.flipNote, "3 cumulative gamma crossings; contested book");
});

test("5. regime inversion changes labels and narratives without mutating career fields", () => {
  const career = [{ date: "2026-08-05", result: "held" }];
  const record = { career: structuredClone(career) };
  assert.equal(gammaCageLabel("CALL_WALL", "POSITIVE"), "Major call — cage ceiling");
  assert.equal(gammaCageLabel("CALL_WALL", "NEGATIVE"), "Major call — rail");
  assert.match(gammaCageNarrative("CALL_WALL", "NEGATIVE").visit, /rail/i);
  assert.deepEqual(record.career, career);
});

test("6. Expected Move levels are excluded from the Gamma Cage gameplan ladder", () => {
  assert.equal(isGammaCageGameplanLevel("EXPECTED_MOVE_MAX"), false);
  assert.equal(isGammaCageGameplanLevel("EXPECTED_MOVE_MIN"), false);
  assert.equal(isGammaCageGameplanLevel("GAMMA_ACCELERATOR"), true);
});

test("7. a far-expiry monster cannot contaminate the 0–7 day cage", () => {
  const expiryRows = [
    { ...row(100, 40), expiration: "2026-08-06" },
    { ...row(101, -25), expiration: "2026-08-07" },
    { ...row(102, 50_000), expiration: "2026-09-18" },
  ];
  const full = exposure([row(100, 40), row(101, -25), row(102, 50_000)], expiryRows);
  const near = filterGammaExposureHorizon(full, "2026-08-05", 7);
  assert.ok(near);
  assert.deepEqual(near.strikes.map((item) => item.strike), [100, 101]);
  assert.equal(deriveGammaCage(near, 101).gammaMagnet, 100);
  assert.equal(deriveGammaCage(full, 101, "FULL_CHAIN").gammaMagnet, 102);
});

test("8. an all-positive surface emits no accelerator", () => {
  const result = deriveGammaCage(exposure([row(99, 5), row(100, 8), row(101, 6)]), 100);
  assert.equal(result.gammaAccelerator, null);
  assert.equal(result.gammaMagnet, 100);
});

test("9. provider-native zero gamma has operational precedence", () => {
  assert.deepEqual(operationalGammaFlip(100.25, 100, 0.5), {
    price: 100.25,
    source: "NATIVE",
    withinTolerance: true,
  });
  assert.equal(operationalGammaFlip(104, 100, 0.5).price, 104);
  assert.equal(operationalGammaFlip(null, 100).source, "COMPUTED");
});

test("10. right-rail labels are deterministically staggered without overlap", () => {
  const labels = staggerGammaLabels([
    { id: "c", y: 11 },
    { id: "a", y: 10 },
    { id: "b", y: 10 },
  ], 16);
  assert.deepEqual(labels.map((item) => item.id), ["a", "b", "c"]);
  assert.ok(labels[1].displayY - labels[0].displayY >= 16);
  assert.ok(labels[2].displayY - labels[1].displayY >= 16);
});

test("11. identical Gamma Cage inputs produce byte-stable outputs", () => {
  const input = exposure([row(98, 25), row(100, -15), row(102, 30)]);
  const first = deriveGammaCage(input, 100);
  const second = deriveGammaCage(structuredClone(input), 100);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
