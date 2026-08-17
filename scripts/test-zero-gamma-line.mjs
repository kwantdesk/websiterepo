import assert from "node:assert/strict";
import {
  isZeroGammaLinePayload,
  zeroGammaRootForInstrument,
} from "../src/lib/zeroGammaLine.ts";

assert.equal(zeroGammaRootForInstrument("NQ"), "NQ");
assert.equal(zeroGammaRootForInstrument("MNQU6"), "NQ");
assert.equal(zeroGammaRootForInstrument("ES"), "ES");
assert.equal(zeroGammaRootForInstrument("MESU6"), "ES");
assert.equal(zeroGammaRootForInstrument("QQQ"), null, "cash scales must not receive an unconverted futures zero-gamma value");

assert.equal(isZeroGammaLinePayload({
  root: "NQ",
  displayInstrument: "MNQ",
  asOf: "2026-08-17T00:00:00.000Z",
  status: "EOD",
  positiveAbove: true,
  points: [{ timestampMs: 1_776_000_000_000, sessionDate: "2026-08-14", value: 30125.5, status: "HISTORICAL" }],
  method: "TRUE_OI_SCENARIO",
  disclosure: "test",
}), true);
assert.equal(isZeroGammaLinePayload({ root: "NQ", points: [{ timestampMs: 1, value: Number.NaN }] }), false);

console.log("Zero Gamma Line contract tests passed.");
