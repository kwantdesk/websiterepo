import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const configSource = readFileSync(
  new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url),
  "utf8",
);
const controlsSource = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url),
  "utf8",
);

test("Big Contracts manual threshold uses a fine 1-to-5000 contract control", () => {
  assert.match(
    configSource,
    /key: "manualFilter", label: "Manual minimum trade size", defaultValue: 30, min: 1, max: 5000, step: 1/,
  );
  assert.match(configSource, /filterMode: "manual"/);
  assert.match(configSource, /bigTradesSettingsVersion: 6/);
});

test("changing the manual threshold activates manual filtering immediately", () => {
  assert.match(
    controlsSource,
    /if \(key === "manualFilter"\) return \{ filterMode: "manual" \}/,
  );
});
