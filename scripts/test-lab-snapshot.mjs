import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  LAB_SNAPSHOT_VERSION,
  clampLabRefreshMs,
  isLabSnapshot,
  labSnapshotFreshness,
  nextNewYorkOpen,
  parseLabSnapshot,
} from "../src/lib/labSnapshot.ts";

const fixtureUrl = new URL("../tests/fixtures/lab-repository/AUGUST_V1_QUANT_DESK_FRAMEWORK/runtime/NQ/current.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

assert.equal(fixture.version, LAB_SNAPSHOT_VERSION);
assert.equal(isLabSnapshot(fixture), true, "complete August V1 snapshot must pass");
assert.equal(parseLabSnapshot(fixture).mode.value, "FOLLOW");
assert.equal(labSnapshotFreshness(fixture, Date.parse(fixture.updatedAt) + 20_000), "CURRENT");
assert.equal(labSnapshotFreshness(fixture, Date.parse(fixture.updatedAt) + 20 * 60_000), "STALE");
assert.equal(clampLabRefreshMs(100), 5_000);
assert.equal(clampLabRefreshMs(999_999), 60_000);

const nextOpen = nextNewYorkOpen(new Date("2026-08-25T12:00:00.000Z"));
assert.equal(nextOpen.toISOString(), "2026-08-25T13:30:00.000Z", "09:30 New York resolves through DST");

assert.equal(isLabSnapshot({ ...fixture, environment: "PAPER" }), false);
assert.equal(isLabSnapshot({ ...fixture, root: "YM" }), false);
assert.equal(isLabSnapshot({ ...fixture, refreshAfterMs: 500 }), false);
assert.throws(() => parseLabSnapshot({ ...fixture, film: { ...fixture.film, status: "READY", deltas: new Array(21).fill(fixture.film.deltas[0]) } }), /invalid August V1/);

const explainedSetup = {
  ...fixture,
  trade: {
    ...fixture.trade,
    qualityGrade: "A+",
    qualityScore: 88,
    optionsAlignment: "Dealer positioning and premium flow agree with the setup side.",
    technicalReasoning: ["The wall is verified by two independent sources."],
  },
};
assert.equal(isLabSnapshot(explainedSetup), true, "source-backed A+ reasoning must pass");
assert.equal(isLabSnapshot({ ...explainedSetup, trade: { ...explainedSetup.trade, qualityScore: 101 } }), false);
assert.equal(isLabSnapshot({ ...explainedSetup, trade: { ...explainedSetup.trade, technicalReasoning: ["Valid", 42] } }), false);

console.log("THE LAB snapshot contract: 15 assertions passed");
