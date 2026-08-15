import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chartSource = readFileSync(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);
const primitiveSource = readFileSync(
  new URL("../src/lib/bigBlocksPrimitive.ts", import.meta.url),
  "utf8",
);
const catalogSource = readFileSync(
  new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url),
  "utf8",
);
const configSource = readFileSync(
  new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url),
  "utf8",
);

test("KWANT effort is presented as Big Blocks and migrates saved labels", () => {
  assert.match(catalogSource, /indicator\("Big Blocks", "KWANT Systems"/);
  assert.match(configSource, /shortName: "Big Blocks"/);
  assert.match(configSource, /effortSettingsVersion: 3/);
  assert.match(
    configSource,
    /normalizedInstance\.indicatorId === "deep-m-effort-nq"[\s\S]*?shortName: "Big Blocks"/,
  );
});

test("Big Blocks uses a chart-native underlay anchored by time and price", () => {
  assert.match(primitiveSource, /timeScale\.timeToCoordinate\(zone\.startTime\)/);
  assert.match(primitiveSource, /params\.series\.priceToCoordinate\(zone\.top\)/);
  assert.match(primitiveSource, /return "bottom" as const;/);
  assert.match(chartSource, /candleSeries\.attachPrimitive\(bigBlocksPrimitive\)/);
  assert.doesNotMatch(chartSource, /positionedEffortZones/);
});
