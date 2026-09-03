import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

test("an empty Footprint does not cover the chart with a status card", () => {
  assert.doesNotMatch(chart, /No executed trade data/);
  assert.doesNotMatch(chart, /Loading executed trade history/);
  assert.doesNotMatch(chart, /The Footprint will paint as classified executions arrive/);
});

test("the actionable execution-classification warning remains available", () => {
  assert.match(chart, /footprintHasPriceLevelFlow && !footprintHasClassifiedFlow/);
  assert.match(chart, /Limited execution classification/);
});
