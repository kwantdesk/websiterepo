import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";
import { classifyGammaEnvironment } from "../src/lib/optionsFlow.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/gamma-environment-authoritative.json",
  import.meta.url,
), "utf8"));

const defaults = defaultIndicatorSettings(fixture.indicatorId);
for (const [key, expected] of Object.entries(fixture.defaultSettings)) {
  assert.deepEqual(defaults[key], expected, `browser default mismatch for ${key}`);
}

for (const row of fixture.classificationCases) {
  assert.deepEqual(
    classifyGammaEnvironment(row.net, row.gross),
    row.expected,
    `browser Gamma classification mismatch for net=${row.net} gross=${row.gross}`,
  );
}

const compact = fixture.smallScaleLabel.input.split(/\s[-·]\s/)[0];
assert.equal(compact, fixture.smallScaleLabel.expected);
assert.ok(fixture.positionChoices.includes(defaults.position));
assert.equal(fixture.snapshots.find((snapshot) => snapshot.replayAsOfMs)?.stale, true);
console.log("Gamma Environment browser authority fixture passed.");
