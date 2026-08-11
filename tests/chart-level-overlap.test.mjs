import assert from "node:assert/strict";
import test from "node:test";
import { resolveChartLevelOverlaps } from "../src/lib/chartLevelOverlap.ts";

const level = (id, label, lineWidth = 1) => ({
  id,
  label,
  price: 29_800,
  color: "#b6ff00",
  lineWidth,
  axisLabelVisible: true,
});

test("dense gamma confluence uses concise canonical labels", () => {
  const resolved = resolveChartLevelOverlaps([
    level("call", "Major call — rail", 3),
    level("magnet", "Magnet — weak glue", 2),
    level("mpo", "MPO"),
    level("mpv", "Major Positive Volume"),
    level("gex", "KWANT 1"),
  ], []);

  assert.equal(resolved.foreground.length, 1);
  assert.equal(resolved.foreground[0].label, "Major Call + Gamma Magnet +3");
});

test("two coincident references remain fully visible and abbreviated", () => {
  const resolved = resolveChartLevelOverlaps([
    level("gex", "KWANT 4", 2),
    level("vah", "PD VAH"),
  ], []);

  assert.equal(resolved.foreground[0].label, "KWANT 4 + PD VAH");
});
