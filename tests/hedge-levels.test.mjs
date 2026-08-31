import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  convertHedgeLevels,
  deriveHedgeLevels,
  hedgeFreshnessPill,
  hedgeLevelMovement,
  renderableHedgeLevels,
  staggerHedgeLabels,
} from "../src/lib/hedgeLevels.ts";

const sessionDate = "2026-08-06";
const row = (strike, call, put, expiration = undefined) => ({ strike, call, put, net: call + put, expiration });

test("1. sign-correct selection never mistakes the largest negative magnitude for the magnet", () => {
  const result = deriveHedgeLevels({
    strikes: [row(98, 15, -5), row(100, 20, -120), row(102, 50, -10)],
  }, 100, sessionDate);
  assert.equal(result.levels.find((level) => level.kind === "ACCELERATOR")?.sourcePrice, 100);
  assert.equal(result.levels.find((level) => level.kind === "ACCELERATOR")?.label, "accelerator");
  assert.equal(result.levels.find((level) => level.kind === "MAGNET")?.sourcePrice, 102);
});

test("2. cumulative crossings use bracket midpoints, retain every crossing and select nearest spot", () => {
  const result = deriveHedgeLevels({
    strikes: [row(90, 10, 0), row(100, 0, -20), row(110, 30, 0), row(120, 0, -50)],
  }, 108, sessionDate);
  assert.deepEqual(result.allCrossings, [95, 105, 115]);
  assert.equal(result.flip, 105);
  assert.equal(result.contested, true);
});

test("3. no crossing emits no flip and reports the absence without substitution", () => {
  const result = deriveHedgeLevels({ strikes: [row(98, 10, -1), row(100, 20, -2), row(102, 30, -3)] }, 100, sessionDate);
  assert.equal(result.flip, null);
  assert.equal(result.flipNote, "no flip in this surface");
  assert.equal(result.levels.some((level) => level.kind === "FLIP"), false);
});

test("4. an all-positive local window has no accelerator and renders the other four objects", () => {
  const result = deriveHedgeLevels({
    strikes: [row(90, 0, -50), row(98, 70, -10), row(100, 90, -20), row(102, 60, -10)],
  }, 100, sessionDate);
  assert.equal(result.levels.some((level) => level.kind === "ACCELERATOR"), false);
  assert.deepEqual(new Set(result.levels.map((level) => level.kind)), new Set(["MAJOR_CALL", "MAJOR_PUT", "MAGNET", "FLIP"]));
});

test("5. regime language changes while stable object ids remain stable", () => {
  const surface = { strikes: [row(98, 0, -50), row(100, 30, 0), row(102, 40, 0)] };
  const negative = deriveHedgeLevels(surface, 99, sessionDate);
  const positive = deriveHedgeLevels(surface, 102, sessionDate);
  assert.equal(negative.regime, "NEGATIVE");
  assert.equal(positive.regime, "POSITIVE");
  assert.equal(negative.levels.find((level) => level.kind === "MAGNET")?.label, "weak glue");
  assert.equal(positive.levels.find((level) => level.kind === "MAGNET")?.label, "glue — exits only");
  assert.equal(negative.levels.find((level) => level.kind === "MAGNET")?.id, positive.levels.find((level) => level.kind === "MAGNET")?.id);
});

test("6. conversion uses the supplied live scale and the route rejects insane ratios through the shared calibrator", async () => {
  const surface = deriveHedgeLevels({ strikes: [row(98, 30, -5), row(100, 5, -20), row(102, 40, -5)] }, 100, sessionDate);
  const converted = convertHedgeLevels(surface, 2, 0.25);
  assert.equal(converted?.levels.find((level) => level.kind === "MAJOR_CALL")?.price, 204);
  assert.equal(convertHedgeLevels(surface, Number.NaN), null);
  const route = await readFile(new URL("../src/app/api/hedge-levels/route.ts", import.meta.url), "utf8");
  assert.match(route, /buildChartGammaCalibration/);
  assert.match(route, /if \(!calibration\)/);
});

test("7. freshness never presents stale data as live", () => {
  const base = {
    stale: false,
    frozen: false,
    frozenAt: null,
    dataAge: 0,
    generatedAt: "2026-08-06T14:00:00.000Z",
  };
  assert.equal(hedgeFreshnessPill(base), "live · 60s");
  assert.match(hedgeFreshnessPill({ ...base, frozen: true, frozenAt: "2026-08-06T20:00:00.000Z" }), /^frozen /);
  assert.match(hedgeFreshnessPill({ ...base, stale: true }, Date.parse(base.generatedAt) + 65_000), /^stale 1m$/);
});

test("8. a move larger than one strike interval creates exactly one re-strike pulse", () => {
  const oldLevel = { id: "hedge-magnet", price: 100 };
  const nextLevel = { id: "hedge-magnet", price: 126 };
  const moved = hedgeLevelMovement([oldLevel], [nextLevel], 25);
  assert.deepEqual(moved.pulseIds, ["hedge-magnet"]);
  assert.deepEqual(hedgeLevelMovement([nextLevel], [nextLevel], 25).pulseIds, []);
});

test("9. labels closer than one label height are staggered", () => {
  const labels = staggerHedgeLabels([{ id: "a", y: 100 }, { id: "b", y: 104 }], 14);
  assert.equal(labels[1].labelY - labels[0].labelY, 14);
});

test("10. toggle off leaves zero residual bands", () => {
  assert.deepEqual(renderableHedgeLevels(false, [{ id: "hedge-magnet" }]), []);
});

test("11. identical input produces byte-stable output", () => {
  const input = {
    strikes: [row(95, 5, -20), row(100, 30, -10), row(105, 15, -35)],
    expiryStrikes: [
      row(95, 5, -20, "2026-08-07"),
      row(100, 30, -10, "2026-08-07"),
      row(105, 15, -35, "2026-08-07"),
      row(110, 5_000, 0, "2026-08-21"),
    ],
  };
  const first = deriveHedgeLevels(input, 100, sessionDate);
  const second = deriveHedgeLevels(input, 100, sessionDate);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.expiryScope, "NEAR_TERM_7D");
  assert.equal(first.strikeInterval, 5);
  assert.equal(first.levels.some((level) => level.sourcePrice === 110), false);
});

test("12. the normalized desktop edge uses internal timing-safe auth and a bounded derived receipt", async () => {
  const route = await readFile(new URL("../src/app/api/hedge-levels/route.ts", import.meta.url), "utf8");
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /x-kwantdesk-internal-analytics-token/);
  assert.match(route, /schemaVersion:\s*1/);
  assert.match(route, /id:\s*"hedge-levels"/);
  assert.match(route, /receivedAtMs:\s*Date\.now\(\)/);
  assert.doesNotMatch(route, /apiKey.*searchParams/i);
});
