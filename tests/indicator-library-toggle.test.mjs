import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);

test("indicator library uses Add and Added as a chart-scoped toggle", () => {
  assert.match(
    source,
    /const toggleLibraryIndicator = \(indicatorId: string\) => \{[\s\S]*?onChange\(indicators\.filter\(\(instance\) => !matchingInstanceIds\.has\(instance\.instanceId\)\)\);/,
  );
  assert.match(source, /onClick=\{\(\) => toggleLibraryIndicator\(definition\.id\)\}/);
  assert.match(source, /aria-pressed=\{added\}/);
  assert.match(source, /\{added \? "Added" : live \? "Add" : "Pending"\}/);
  assert.doesNotMatch(source, /disabled=\{!live \|\| added\}/);
});

test("removing an indicator also closes settings for its instance", () => {
  assert.match(
    source,
    /if \(settingsInstanceId && matchingInstanceIds\.has\(settingsInstanceId\)\) \{\s*setSettingsInstanceId\(null\);\s*\}/,
  );
});
